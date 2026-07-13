// 連線狀態燈：🔴 等待系統啟動（Render 冷啟動中）→ 🟢 系統正常運作
// 輪詢 /api/health（該請求本身就會喚醒 Render 與 Neon）。
// 綠燈前由呼叫端透過 onReady/onDown 鎖定、解鎖操作。
import { API_BASE } from './config.js';

const POLL_COLD_MS = 3000;   // 尚未連上時：密集輪詢（兼喚醒）
const POLL_WARM_MS = 15000;  // 已連上後：低頻確認
const FETCH_TIMEOUT_MS = 5000;

export function initStatusLight({ onReady, onDown } = {}) {
  const el = document.createElement('div');
  el.className = 'tvs-status';
  el.innerHTML = '<span class="tvs-status-dot"></span><span class="tvs-status-text">等待系統啟動…</span>';
  document.body.appendChild(el);
  const textEl = el.querySelector('.tvs-status-text');

  let ready = false;
  let timer = null;
  let stopped = false;

  function render(ok, text) {
    el.classList.toggle('tvs-status-ok', ok);
    textEl.textContent = text;
  }

  function setGreen() {
    render(true, '系統正常運作');
    if (!ready) {
      ready = true;
      if (onReady) onReady();
    }
  }

  function setRed(text = '等待系統啟動…') {
    render(false, text);
    if (ready) {
      ready = false;
      if (onDown) onDown();
    }
  }

  async function ping() {
    if (stopped) return;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(t);
      const data = await res.json();
      if (data && data.ok) setGreen();
      else setRed('系統啟動中，請稍候…');
    } catch (err) {
      setRed('系統啟動中，請稍候…');
    }
    schedule();
  }

  function schedule() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(ping, ready ? POLL_WARM_MS : POLL_COLD_MS);
  }

  ping();

  return {
    isReady: () => ready,
    // 讓 Socket.IO 的 connect/disconnect 直接驅動狀態燈
    setExternal(ok, text) {
      if (ok) setGreen();
      else setRed(text || '連線中斷，重新連線中…');
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
