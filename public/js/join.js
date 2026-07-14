// 干擾同學入口（手機友善）：姓名 + 教室號碼 → disruptor.html
// 綠燈（後端喚醒）前鎖定加入按鈕。
import { initStatusLight } from './status.js';

const $id = (id) => document.getElementById(id);

let systemReady = false;

const nameInput = $id('player_name');
const codeInput = $id('room_code');
nameInput.value = sessionStorage.getItem('tvs_name') || '';

// 掃學生畫面的 QR 碼進來會帶 ?code=教室號碼 → 直接預填，干擾者只需輸入姓名
const urlCode = new URLSearchParams(window.location.search).get('code');
if (urlCode) {
  codeInput.value = urlCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  nameInput.focus();
}

function refresh() {
  const ok = systemReady &&
    nameInput.value.trim() !== '' &&
    codeInput.value.trim().length === 4;
  $id('btn_join_go').disabled = !ok;
}

initStatusLight({
  onReady() { systemReady = true; refresh(); },
  onDown() { systemReady = false; refresh(); },
});

nameInput.addEventListener('input', refresh);
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  refresh();
});

function join() {
  if ($id('btn_join_go').disabled) return;
  sessionStorage.setItem('tvs_name', nameInput.value.trim().slice(0, 20));
  sessionStorage.setItem('tvs_mode', 'duo');
  sessionStorage.setItem('tvs_role', 'disruptor');
  sessionStorage.setItem('tvs_room', codeInput.value.trim().toUpperCase());
  window.location.href = 'disruptor.html';
}

$id('btn_join_go').addEventListener('click', join);
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });

refresh();
