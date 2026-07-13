// 干擾同學端：加入房間 → 準備 → 發送干擾（丟粉筆 / 看飛碟）
// 冷卻由伺服器驗證（20 秒），前端進度條僅是呈現。
import { initStatusLight } from './status.js';
import { createSocket } from './net.js';
import { playReadyGo } from './readygo.js';

const $id = (id) => document.getElementById(id);

const role = sessionStorage.getItem('tvs_role');
const myName = sessionStorage.getItem('tvs_name') || '';
const roomCode = (sessionStorage.getItem('tvs_room') || '').toUpperCase();

// 沒帶房間資訊（直接開這頁）→ 回首頁走正常流程
if (role !== 'disruptor' || !roomCode) {
  window.location.replace('index.html');
}

let joined = false;
let playing = false;
let cooling = false;
let cooldownTimer = null;

const light = initStatusLight({});
const socket = createSocket();

function showBanner(text) {
  const banner = $id('net_banner');
  banner.textContent = text;
  banner.style.display = 'block';
}

function setButtonsEnabled(enabled) {
  for (const id of ['right', 'left']) {
    const el = $id(id);
    el.style.opacity = enabled ? '1' : '0.4';
    el.style.pointerEvents = enabled ? 'auto' : 'none';
  }
}
setButtonsEnabled(false);

// ---- 加入房間 ----
socket.on('connect', () => {
  light.setExternal(true);
  if (joined) {
    showBanner('連線曾中斷，房間已失效，請回首頁重新加入');
    setButtonsEnabled(false);
    return;
  }
  socket.emit('room:join', { name: myName, roomCode }, (res) => {
    if (!res || !res.ok) {
      $id('lobby_room').textContent = `房號：${roomCode}`;
      $id('lobby_info').textContent = `加入失敗：${(res && res.error) || '未知錯誤'}`;
      return;
    }
    joined = true;
    $id('lobby_room').textContent = `房號：${res.roomCode}`;
    $id('lobby_info').textContent = `學生「${res.studentName}」正在等你，請按下準備！`;
    $id('btn_ready').style.display = '';
  });
});

socket.on('disconnect', () => {
  light.setExternal(false, '連線中斷，重新連線中…');
  setButtonsEnabled(false);
});

socket.on('room:update', (snap) => {
  if (playing) return;
  if (snap.disruptorReady && !snap.studentReady) {
    $id('lobby_info').textContent = '已準備，等待學生準備…';
  } else if (!snap.disruptorReady && snap.studentReady) {
    $id('lobby_info').textContent = `學生「${snap.studentName}」已準備，就等你了！`;
  }
});

$id('btn_ready').addEventListener('click', () => {
  socket.emit('player:ready');
  $id('btn_ready').disabled = true;
  $id('lobby_info').textContent = '已準備，等待學生準備…';
});

// ---- 開賽：與學生端同步 7 秒上課鐘，顯示「準備→開始」動畫 ----
socket.on('game:start', () => {
  playing = true;
  $id('lobby_overlay').style.display = 'none';
  playReadyGo(7000);
  setTimeout(() => { if (playing) setButtonsEnabled(true); }, 7000);
});

// ---- 冷卻進度條（沿用原版 200ms 更新節奏）----
function startCooldown(totalMs) {
  cooling = true;
  setButtonsEnabled(false);
  const startAt = Date.now();
  const bar = document.querySelector('.progress-bar');
  clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    const pct = Math.min(((Date.now() - startAt) / totalMs) * 100, 100);
    bar.style.width = `${pct}%`;
    if (pct >= 100) {
      clearInterval(cooldownTimer);
      bar.style.width = '0%';
      cooling = false;
      if (playing) setButtonsEnabled(true);
    }
  }, 200);
}

function sendAction(type) {
  if (cooling || !playing) return;
  socket.emit('disruptor:action', { type }, (res) => {
    if (res && res.ok) {
      startCooldown(res.cooldownMs);
    } else if (res && res.remainingMs > 0) {
      // 與伺服器冷卻同步（防連點/多分頁）
      startCooldown(res.remainingMs);
    }
  });
}

$id('right').addEventListener('click', () => sendAction('chalk')); // 丟粉筆
$id('left').addEventListener('click', () => sendAction('ufo'));    // 看飛碟

// ---- 結果與斷線 ----
socket.on('game:result', (res) => {
  playing = false;
  setButtonsEnabled(false);
  clearInterval(cooldownTimer);
  const win = res.winner === 'disruptor';
  $id('result_title').textContent = win ? '🎉 干擾成功，你贏了！' : '😪 干擾失敗，學生獲勝';
  $id('result_detail').textContent =
    `學生「${res.studentName}」得分 ${res.score} 分（目標 ${res.winScore} 分）`;
  $id('result_overlay').style.display = '';
});

socket.on('room:closed', (info) => {
  showBanner(`${info.reason}，即將返回首頁…`);
  setTimeout(() => { window.location.href = 'index.html'; }, 2500);
});
