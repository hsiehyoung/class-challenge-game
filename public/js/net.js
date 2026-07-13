// 網路層：Socket.IO 連線（雙人模式）、單人模式隨機事件產生器、單人分數上傳
import { API_BASE } from './config.js';

// vendor/socket.io.min.js 以 <script> 載入後提供全域 io()
export function createSocket() {
  const socket = API_BASE ? window.io(API_BASE) : window.io();
  return socket;
}

// 單人模式：每 12~20 秒隨機觸發一次「丟粉筆」或「看飛碟」（機率各半），
// 取代原版靠鍵盤除錯鍵手動觸發的做法。
export function startSinglePlayerEvents(state, enqueue) {
  let timer = null;
  let stopped = false;

  function scheduleNext() {
    if (stopped) return;
    const delay = 12000 + Math.random() * 8000; // 12~20 秒
    timer = setTimeout(() => {
      if (stopped) return;
      if (state.start && !state.dead && !state.timeUp) {
        const type = Math.random() < 0.5 ? 'chalk' : 'ufo';
        enqueue({ type, from: '神秘同學' });
      }
      scheduleNext();
    }, delay);
  }

  scheduleNext();
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

// 單人模式結束後上傳分數
export async function submitSingleScore(name, score) {
  try {
    const res = await fetch(`${API_BASE}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score }),
    });
    return await res.json();
  } catch (err) {
    console.error('分數上傳失敗:', err);
    return { ok: false };
  }
}
