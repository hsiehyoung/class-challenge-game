// 雙人模式房間系統：建房 / 加入 / 準備 / 干擾事件冷卻 / 勝負判定 / 連線韌性
// 伺服器為權威方：冷卻與勝負皆在此判定，前端只負責呈現。
//
// 連線韌性設計：
// - 主動離開（關閉頁面/回首頁）：前端 pagehide 會送 room:leave → 立即通知對方、處理房間
// - 意外斷線（網路閃斷/手機鎖屏）：進入寬限期（GRACE_MS），期間對方看到「等待重連」，
//   斷線方憑 token 在寬限期內 room:rejoin 即可無縫恢復（含冷卻剩餘時間同步）
const crypto = require('crypto');
const db = require('./db');

const COOLDOWN_MS = 20 * 1000; // 干擾事件冷卻 20 秒
const WIN_SCORE = 1000;        // 時間到時學生 >= 1000 分則學生勝
const ROOM_TTL_MS = 30 * 60 * 1000; // 房間最長存活 30 分鐘
const GRACE_MS = Number(process.env.GRACE_MS) || 20 * 1000; // 意外斷線的重連寬限期
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 避開 0/O、1/I/L

const rooms = new Map(); // roomCode -> room

function cleanName(name) {
  return String(name || '').trim().slice(0, 20) || '無名氏';
}

function makeToken() {
  return crypto.randomBytes(12).toString('hex');
}

function genRoomCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return null; // 幾乎不可能發生
}

function roomSnapshot(room) {
  return {
    roomCode: room.code,
    studentName: room.student ? room.student.name : null,
    disruptorName: room.disruptor ? room.disruptor.name : null,
    studentReady: room.student ? room.student.ready : false,
    disruptorReady: room.disruptor ? room.disruptor.ready : false,
    state: room.state,
  };
}

function clearGrace(player) {
  if (player && player.graceTimer) {
    clearTimeout(player.graceTimer);
    player.graceTimer = null;
  }
  if (player) player.disconnectedAt = null;
}

function init(io) {
  // 定期清掉逾時房間
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.createdAt > ROOM_TTL_MS) {
        io.to(code).emit('room:closed', { reason: '房間已逾時，請重新開房' });
        destroyRoom(room);
      }
    }
  }, 60 * 1000);

  function destroyRoom(room) {
    clearGrace(room.student);
    clearGrace(room.disruptor);
    rooms.delete(room.code);
  }

  // 玩家確定離開（主動離開或寬限期滿）
  function finalizeLeave(room, role) {
    if (!rooms.has(room.code)) return;

    if (role === 'disruptor' && room.state !== 'playing') {
      // 遊戲開始前干擾者離開：房間退回等待狀態，學生可繼續等下一位
      clearGrace(room.disruptor);
      room.disruptor = null;
      room.state = 'waiting';
      if (room.student) room.student.ready = false;
      io.to(room.code).emit('room:update', roomSnapshot(room));
      return;
    }
    // 學生離開、或遊戲中任一方離開：關房
    io.to(room.code).emit('room:closed', { reason: '對方已離線，房間已關閉' });
    destroyRoom(room);
  }

  io.on('connection', (socket) => {
    socket.data.roomCode = null;
    socket.data.role = null;

    // 學生建房
    socket.on('room:create', (payload, cb) => {
      if (typeof cb !== 'function') return;
      const code = genRoomCode();
      if (!code) return cb({ ok: false, error: '房間額滿，請稍後再試' });

      const room = {
        code,
        student: {
          socketId: socket.id,
          name: cleanName(payload && payload.name),
          ready: false,
          token: makeToken(),
          disconnectedAt: null,
          graceTimer: null,
        },
        disruptor: null,
        state: 'waiting', // waiting -> lobby -> playing -> ended
        lastActionAt: 0,
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.role = 'student';
      cb({ ok: true, token: room.student.token, ...roomSnapshot(room) });
    });

    // 干擾同學加入
    socket.on('room:join', (payload, cb) => {
      if (typeof cb !== 'function') return;
      const code = String((payload && payload.roomCode) || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return cb({ ok: false, error: '找不到這個教室號碼' });
      if (room.disruptor) return cb({ ok: false, error: '這間房已經有干擾同學了' });
      if (room.state !== 'waiting') return cb({ ok: false, error: '這場遊戲已經開始' });

      room.disruptor = {
        socketId: socket.id,
        name: cleanName(payload && payload.name),
        ready: false,
        token: makeToken(),
        disconnectedAt: null,
        graceTimer: null,
      };
      room.state = 'lobby';
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.role = 'disruptor';
      cb({ ok: true, token: room.disruptor.token, ...roomSnapshot(room) });
      io.to(code).emit('room:update', roomSnapshot(room));
    });

    // 意外斷線後憑 token 重回房間（寬限期內有效）
    socket.on('room:rejoin', (payload, cb) => {
      if (typeof cb !== 'function') cb = () => {};
      const code = String((payload && payload.roomCode) || '').trim().toUpperCase();
      const token = String((payload && payload.token) || '');
      const room = rooms.get(code);
      if (!room || room.state === 'ended' || !token) {
        return cb({ ok: false, error: '房間已不存在' });
      }
      let role = null;
      let player = null;
      if (room.student && room.student.token === token) {
        role = 'student';
        player = room.student;
      } else if (room.disruptor && room.disruptor.token === token) {
        role = 'disruptor';
        player = room.disruptor;
      }
      if (!player) return cb({ ok: false, error: '重連驗證失敗' });

      clearGrace(player);
      player.socketId = socket.id;
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.role = role;

      const cooldownRemainingMs = room.state === 'playing' && room.lastActionAt
        ? Math.max(0, COOLDOWN_MS - (Date.now() - room.lastActionAt))
        : 0;
      cb({ ok: true, cooldownRemainingMs, ...roomSnapshot(room) });
      socket.to(code).emit('peer:connection', { role, connected: true });
    });

    // 雙方按下準備；都準備好就開賽
    socket.on('player:ready', () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room || room.state !== 'lobby') return;
      if (socket.data.role === 'student' && room.student) room.student.ready = true;
      if (socket.data.role === 'disruptor' && room.disruptor) room.disruptor.ready = true;
      io.to(room.code).emit('room:update', roomSnapshot(room));

      if (room.student && room.disruptor && room.student.ready && room.disruptor.ready) {
        room.state = 'playing';
        room.lastActionAt = 0;
        io.to(room.code).emit('game:start', roomSnapshot(room));
      }
    });

    // 干擾事件：伺服器端驗證冷卻
    socket.on('disruptor:action', (payload, cb) => {
      if (typeof cb !== 'function') cb = () => {};
      const room = rooms.get(socket.data.roomCode);
      if (!room || socket.data.role !== 'disruptor' || room.state !== 'playing') {
        return cb({ ok: false, error: '目前無法發送干擾', remainingMs: 0 });
      }
      const type = payload && payload.type === 'ufo' ? 'ufo' : payload && payload.type === 'chalk' ? 'chalk' : null;
      if (!type) return cb({ ok: false, error: '未知的干擾類型', remainingMs: 0 });
      // 粉筆丟擲方向由干擾者指定；缺漏或不合法時隨機補上
      const dir = payload && payload.dir === 'left' ? 'left'
        : payload && payload.dir === 'right' ? 'right'
        : Math.random() < 0.5 ? 'left' : 'right';

      const now = Date.now();
      const elapsed = now - room.lastActionAt;
      if (room.lastActionAt !== 0 && elapsed < COOLDOWN_MS) {
        return cb({ ok: false, error: '冷卻中', remainingMs: COOLDOWN_MS - elapsed });
      }
      room.lastActionAt = now;
      if (room.student) {
        io.to(room.student.socketId).emit('event:trigger', { type, dir, from: room.disruptor.name });
      }
      cb({ ok: true, cooldownMs: COOLDOWN_MS });
    });

    // 學生端回報遊戲結束（被抓 or 時間到）
    socket.on('game:over', async (payload) => {
      const room = rooms.get(socket.data.roomCode);
      if (!room || socket.data.role !== 'student' || room.state !== 'playing') return;
      room.state = 'ended';

      const dead = Boolean(payload && payload.dead);
      const score = Math.max(0, Math.floor(Number(payload && payload.score) || 0));
      const winner = !dead && score >= WIN_SCORE ? 'student' : 'disruptor';
      const result = {
        winner,
        score,
        dead,
        winScore: WIN_SCORE,
        studentName: room.student ? room.student.name : '無名氏',
        disruptorName: room.disruptor ? room.disruptor.name : '無名氏',
      };

      try {
        await db.addDuoMatch(result.studentName, result.disruptorName, score, winner);
      } catch (err) {
        console.error('[rooms] 寫入雙人排行榜失敗:', err.message);
      }
      io.to(room.code).emit('game:result', result);
      destroyRoom(room);
    });

    // 主動離開（前端 pagehide 觸發）：立即處理，不進寬限期
    socket.on('room:leave', () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const role = socket.data.role;
      const player = role === 'student' ? room.student : room.disruptor;
      if (!player || player.socketId !== socket.id) return;
      clearGrace(player);
      finalizeLeave(room, role);
    });

    // 意外斷線：進入寬限期，通知對方「等待重連」
    socket.on('disconnect', () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const role = socket.data.role;
      const player = role === 'student' ? room.student : room.disruptor;
      // 已被重連的新 socket 取代、或已離開 → 不處理
      if (!player || player.socketId !== socket.id) return;

      player.disconnectedAt = Date.now();
      io.to(room.code).emit('peer:connection', { role, connected: false });
      player.graceTimer = setTimeout(() => {
        player.graceTimer = null;
        // 寬限期滿仍未重連 → 視同離開
        finalizeLeave(room, role);
      }, GRACE_MS);
    });
  });
}

module.exports = { init, COOLDOWN_MS, WIN_SCORE, GRACE_MS };
