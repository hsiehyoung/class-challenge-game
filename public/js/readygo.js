// 開賽動畫：「準 備」（跳動）→ 最後 1.5 秒「開 始！」（彈出）→ 淡出
// durationMs 需與上課鐘聲長度一致（7000ms），結束時機即遊戲正式開始。
export function playReadyGo(durationMs = 7000) {
  const el = document.getElementById('ready_go');
  if (!el) return;
  const span = el.querySelector('span');
  el.style.display = 'flex';
  el.classList.remove('tvs-go', 'tvs-fade');
  span.textContent = '準 備';
  setTimeout(() => {
    el.classList.add('tvs-go');
    span.textContent = '開 始！';
  }, Math.max(durationMs - 1500, 0));
  setTimeout(() => { el.classList.add('tvs-fade'); }, durationMs);
  setTimeout(() => { el.style.display = 'none'; }, durationMs + 500);
}
