// 學生玩家端主邏輯：移植自原版 main.html 內嵌 script（去 jQuery 化），
// 所有計時間隔、圖片切換、計分數值皆沿用原版。
// 單人模式：事件由 net.js 的隨機產生器觸發；
// 雙人模式：事件由干擾同學透過 Socket.IO 觸發，勝負由伺服器判定。
import { initStatusLight } from './status.js';
import { changeTeacher } from './teacher.js';
import { handleChalkEvent, handleUfoEvent } from './events.js';
import { createSocket, startSinglePlayerEvents, submitSingleScore } from './net.js';
import { playReadyGo } from './readygo.js';

const $id = (id) => document.getElementById(id);

// ---- 模式與玩家資訊（由首頁 index.html 寫入 sessionStorage）----
const mode = sessionStorage.getItem('tvs_mode') === 'duo' ? 'duo' : 'single';
const initialName = sessionStorage.getItem('tvs_name') || '';

// ---- 遊戲狀態（對應原版全域變數）----
const state = {
  turnPrepare: false,
  isTurn: false,
  sleep: false,
  score: 0,
  dead: false,
  start: false,
  deg: 0,
  deg2: 0,
  backgroundMusic: true,
  chalkAttack: false,
  chalkAttackCount: 0,
  dodgeCond: false,
  ufoEvent: false,
  timeUp: false,
  ended: false,
  disruptorEvents: [],
  disruptorsName: [],
  ufoDeg: Math.floor(Math.random() * (350 - 30 + 1) + 30),
  playerName: '',
};

const audio = new Audio('audio/bgm.wav');
audio.loop = true;

// 除錯用：可在 DevTools 觀察/調整遊戲狀態（例如 __tvs.deg = 350 快轉到下課前）
window.__tvs = state;

let socket = null;
let lightReady = false;
let roomCreated = false;
const duo = { roomCode: null, disruptorName: null, result: null };
let singleEvents = null;
const feed = [];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function playOnce(src) {
  new Audio(src).play().catch(() => {});
}

function showBanner(text) {
  const banner = $id('net_banner');
  banner.textContent = text;
  banner.style.display = 'block';
}

// ---- 連線狀態燈 ----
const light = initStatusLight({
  onReady() {
    lightReady = true;
    refreshStartButton();
  },
  onDown() {
    lightReady = false;
    refreshStartButton();
  },
});

// ---- 開始面板 ----
function refreshStartButton() {
  if (mode !== 'single') return;
  const nameOk = (initialName || $id('name').value.trim()) !== '';
  $id('btn_start').disabled = !(nameOk && lightReady);
}

function beginClassStart() {
  // 原版：播放 7 秒上課鐘聲後正式開始；期間顯示「準備→開始」動畫
  $id('start_background').style.display = 'none';
  audio.pause();
  state.backgroundMusic = false;
  playOnce('audio/classstart.wav');
  playReadyGo(7000);
  setTimeout(() => {
    state.backgroundMusic = true;
    state.start = true;
    if (mode === 'single') {
      singleEvents = startSinglePlayerEvents(state, enqueueEvent);
    }
  }, 7000);
}

function initSingle() {
  const nameInput = $id('name');
  if (initialName) {
    // 首頁已輸入過姓名：不再重複要求填寫
    $id('row_name_label').style.display = 'none';
    $id('row_name_input').style.display = 'none';
    $id('row_lobby_status').style.display = '';
    $id('lobby_status_text').textContent = `${initialName}，準備好就開始吧！`;
    $id('btn_start').textContent = '開始上課！';
  } else {
    nameInput.addEventListener('input', refreshStartButton);
  }
  refreshStartButton();

  $id('btn_start').addEventListener('click', () => {
    if ($id('btn_start').disabled) return;
    state.playerName = (initialName || nameInput.value.trim()) || '無名氏';
    sessionStorage.setItem('tvs_name', state.playerName);
    beginClassStart();
  });
}

// ---- 雙人模式：建房 / 大廳 / 開賽 ----
function setLobbyUI({ waitingText, showReady, readyDisabled }) {
  $id('start_content').style.display = '';
  $id('loading_content').style.display = 'none';
  $id('row_name_label').style.display = 'none';
  $id('row_name_input').style.display = 'none';
  $id('row_room').style.display = '';
  $id('room_code_text').textContent = `房號：${duo.roomCode}`;
  $id('row_lobby_status').style.display = '';
  $id('lobby_status_text').textContent = waitingText;
  const btn = $id('btn_start');
  btn.textContent = '準備';
  btn.style.display = showReady ? '' : 'none';
  btn.disabled = Boolean(readyDisabled);
}

function initDuo() {
  state.playerName = initialName || '無名氏';
  // 建房中：先顯示 spinner
  $id('start_content').style.display = 'none';
  $id('loading_content').style.display = 'block';
  $id('loading_text').textContent = '正在連線並建立房間…';

  socket = createSocket();

  socket.on('connect', () => {
    light.setExternal(true);
    if (roomCreated) {
      // 斷線重連後原房間已失效
      showBanner('連線曾中斷，原房間已失效，請回首頁重新開房');
      return;
    }
    roomCreated = true;
    socket.emit('room:create', { name: state.playerName }, (res) => {
      if (!res || !res.ok) {
        showBanner((res && res.error) || '建立房間失敗，請回首頁重試');
        return;
      }
      duo.roomCode = res.roomCode;
      setLobbyUI({ waitingText: '等待干擾同學加入…', showReady: false });
    });
  });

  socket.on('disconnect', () => {
    light.setExternal(false, '連線中斷，重新連線中…');
  });

  socket.on('room:update', (snap) => {
    if (state.start || state.ended) return;
    duo.disruptorName = snap.disruptorName;
    if (!snap.disruptorName) {
      setLobbyUI({ waitingText: '干擾同學離開了，等待新的干擾同學加入…', showReady: false });
      return;
    }
    if (snap.studentReady) {
      setLobbyUI({
        waitingText: `干擾同學「${snap.disruptorName}」已加入，等待對方準備…`,
        showReady: true,
        readyDisabled: true,
      });
    } else {
      setLobbyUI({
        waitingText: `干擾同學「${snap.disruptorName}」已加入！請按下準備`,
        showReady: true,
      });
    }
  });

  $id('btn_start').addEventListener('click', () => {
    if ($id('btn_start').disabled) return;
    socket.emit('player:ready');
    $id('btn_start').disabled = true;
    $id('lobby_status_text').textContent = '已準備，等待對方…';
  });

  socket.on('game:start', (snap) => {
    duo.disruptorName = snap.disruptorName;
    beginClassStart();
  });

  socket.on('event:trigger', (ev) => {
    if (!state.start || state.dead || state.timeUp) return;
    enqueueEvent({ type: ev.type, dir: ev.dir, from: ev.from });
  });

  socket.on('game:result', (res) => {
    duo.result = res;
    applyDuoResultText();
  });

  socket.on('room:closed', (info) => {
    if (state.ended) return;
    if (!state.start) {
      showBanner(`${info.reason}，即將返回首頁…`);
      setTimeout(() => { window.location.href = 'index.html'; }, 2500);
    } else {
      // 遊戲中對方離線：本場不列入排行榜，可繼續玩完
      showBanner(`${info.reason}（本場不列入排行榜）`);
    }
  });
}

function setEndDisruptorText(text, wrap) {
  const el = $id('end_disruptor');
  el.textContent = text;
  el.classList.toggle('tvs-wrap', Boolean(wrap));
}

function applyDuoResultText() {
  const res = duo.result;
  if (!res || !state.ended) return;
  setEndDisruptorText(
    res.winner === 'disruptor'
      ? `${res.disruptorName}\n干擾成功！`
      : `${res.disruptorName}\n干擾失敗～`,
    true
  );
}

// ---- 干擾事件佇列與側欄文字 ----
function enqueueEvent(ev) {
  state.disruptorEvents.push(ev);
  if (!state.disruptorsName.includes(ev.from)) state.disruptorsName.push(ev.from);
  feed.push(ev);
  if (feed.length > 5) feed.shift();
  $id('event_text').innerHTML = feed
    .map((e) => `<div class="row">${escapeHtml(e.from)}: ${e.type === 'chalk' ? '丟粉筆' : '看飛碟'}</div>`)
    .join('');
}

// 粉筆攻擊：干擾者決定丟擲方向，老師隨機往左或往右閃；
// 老師恰好閃進粉筆軌跡 → 被砸中 → 憤怒攻擊 4 回合（學生此時睡覺極易被抓）。
// 學生端沒有任何操作，專心睡覺即可。
function startChalkEvent(chalkDir) {
  const teacherDodge = Math.random() < 0.5 ? 'left' : 'right';
  handleChalkEvent(teacherDodge, chalkDir, state);
}

// ---- 遊戲結束 ----
function reportResult(byDeath) {
  if (mode === 'duo') {
    if (socket && socket.connected) {
      socket.emit('game:over', { score: state.score, dead: byDeath });
    }
  } else {
    submitSingleScore(state.playerName, state.score);
  }
}

function finishGame(byDeath) {
  if (state.ended) return;
  state.ended = true;
  state.start = false;
  if (singleEvents) singleEvents.stop();
  audio.pause();

  $id('final_text').style.display = 'block';
  $id('final').style.display = 'block';
  $id('clock').src = 'img/clock_back.png';
  $id('end_stu').textContent = state.playerName;
  $id('end_score').textContent = state.score;

  if (byDeath) {
    if (mode === 'duo' && duo.disruptorName) {
      setEndDisruptorText(`${duo.disruptorName}\n干擾成功！`, true);
    } else {
      setEndDisruptorText('被老師\n抓到了…', true);
    }
    $id('end').src = 'img/end2.png';
    $id('end_right').style.display = 'none';
    playOnce('audio/sadsong.wav');
    // 原版：被抓後老師持續氣噗噗的小動畫
    setInterval(() => {
      const t = $id('img_teacher');
      t.src = t.src.endsWith('IMG_0165.png') ? 'img/IMG_0166.png' : 'img/IMG_0165.png';
    }, 1000);
  } else {
    if (mode === 'duo' && duo.disruptorName) {
      setEndDisruptorText(`${duo.disruptorName}`, true);
    } else {
      setEndDisruptorText('乾擾同學～', false); // 原版文字
    }
    playOnce('audio/afterclass.wav');
    if (state.score >= 1000) {
      $id('end').src = 'img/end3.png';
      $id('end_right').src = 'img/end_right1.png';
    } else {
      $id('end').src = 'img/end1.png';
      $id('end_right').src = 'img/end_right2.png';
    }
  }
  reportResult(byDeath);
  applyDuoResultText();
}

// ---- 主迴圈（間隔皆沿用原版）----

// 每 2 秒：學生抖腳待機動畫
setInterval(() => {
  if (!state.dead && state.start && !state.timeUp && !state.sleep) {
    const stu = $id('img_stu');
    stu.src = stu.src.endsWith('IMG_0188.png') ? 'img/IMG_0189.png' : 'img/IMG_0188.png';
  }
}, 2000);

// 每 1 秒：偵測遊戲結束
setInterval(() => {
  if (state.ended || !state.start) return;
  if (state.timeUp) finishGame(false);
  else if (state.dead) finishGame(true);
}, 1000);

// 每 2 秒：處理干擾事件佇列（原版為輪詢後端，這裡改為佇列消化）
setInterval(() => {
  if (
    !state.dead && state.start && !state.timeUp &&
    !state.ufoEvent && !state.dodgeCond &&
    state.disruptorEvents.length > 0
  ) {
    const ev = state.disruptorEvents.shift();
    if (ev.type === 'chalk') {
      startChalkEvent(ev.dir === 'right' ? 'right' : 'left');
    } else {
      state.ufoEvent = true;
      handleUfoEvent(state);
    }
  }
}, 2000);

// 每 1.5 秒：老師狀態機
setInterval(() => {
  if (!state.dead && state.start && !state.dodgeCond && !state.ufoEvent && !state.timeUp) {
    changeTeacher(state);
  }
}, 1500);

// 每 100ms：背景音樂 + 睡覺計分（氣泡放大 → 深層睡眠 x10）
setInterval(() => {
  if (!state.timeUp && state.backgroundMusic && !state.ended) {
    audio.play().catch(() => {});
  }

  if (!state.dead && state.start && !state.timeUp) {
    if (state.sleep) {
      const bubble = $id('img_sleep');
      let h = parseInt(getComputedStyle(bubble).height, 10);
      if (h < 5289) {
        // 尚未進入深層睡眠：氣泡持續放大（原版邏輯）
        const w = parseInt(getComputedStyle(bubble).width, 10);
        const left = parseInt(getComputedStyle(bubble).left, 10);
        const bottom = parseInt(getComputedStyle(bubble).bottom, 10);
        bubble.style.height = `${h * 1.2}px`;
        bubble.style.width = `${w * 1.2}px`;
        bubble.style.left = `${left - w * 1.2 * 0.12}px`;
        bubble.style.bottom = `${bottom - h * 1.2 * 0.1 + 30}px`;
        h = parseInt(getComputedStyle(bubble).height, 10);
      }
      // 達到門檻後固定尺寸與位置，避免無限放大導致圖案被推出畫面外消失
      if (h >= 5289) {
        bubble.src = 'img/sleep_fast.png';
        $id('title_sleep_fast').style.display = 'block';
        state.score += 10;
      } else {
        state.score += 1;
      }
      $id('title').textContent = `Score: ${state.score}`;
    }
  }
}, 100);

// 每 50ms：被抓判定（老師轉身時正在睡）
setInterval(() => {
  if (!state.dead && state.start && !state.timeUp && !state.ufoEvent) {
    if (state.isTurn && state.sleep) {
      state.dead = true;
      $id('img_teacher').src = 'img/IMG_0165.png';
    }
  }
}, 50);

// 每 330ms：時鐘（360 度 = 下課）
setInterval(() => {
  if (!state.dead && state.start && !state.timeUp) {
    if (state.deg === 360) {
      state.timeUp = true;
    } else {
      if (state.deg === 270) {
        $id('clock').src = 'img/Clock_Alert.gif';
      }
      if (state.deg === state.ufoDeg) {
        $id('img_background').src = 'img/IMG_0157.gif';
      }
      if (state.deg === state.ufoDeg + 3) {
        $id('img_background').src = 'img/IMG_0271.png';
      }
      state.deg += 1;
      state.deg2 += 0.1;
      $id('clock_min_hand').style.transform = `rotate(${state.deg}deg)`;
      $id('clock_hour_hand').style.transform = `rotate(${state.deg2 + 120}deg)`;
    }
  }
}, 330);

// ---- 操作事件 ----
// 按住學生 = 睡覺；放開 = 醒來（pointer 事件同時支援滑鼠與觸控）
const stuImg = $id('img_stu');
stuImg.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  state.sleep = true;
  stuImg.src = 'img/IMG_0187.png';
  $id('img_sleep').style.display = 'block';
});

function wakeUp() {
  state.sleep = false;
  stuImg.src = 'img/IMG_0188.png';
  const bubble = $id('img_sleep');
  bubble.style.height = '10vh';
  bubble.style.width = '10vh';
  bubble.style.left = '83vw';
  bubble.style.bottom = '4vw';
  bubble.style.display = 'none';
  bubble.src = 'img/sleep.png';
  $id('title_sleep_fast').style.display = 'none';
}
window.addEventListener('pointerup', () => { if (state.sleep) wakeUp(); });
window.addEventListener('pointercancel', () => { if (state.sleep) wakeUp(); });
stuImg.addEventListener('dragstart', (e) => e.preventDefault());

// ---- 進入點 ----
if (mode === 'duo') initDuo();
else initSingle();
