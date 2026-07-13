// 首頁：姓名輸入 + 模式選擇。
// 連線狀態燈綠燈（後端喚醒完成）前，遊戲入口鎖定。
// 干擾同學改由獨立手機入口 join.html 進入（不需在此輸入姓名）。
import { initStatusLight } from './status.js';

const $id = (id) => document.getElementById(id);

let systemReady = false;

const nameInput = $id('player_name');
nameInput.value = sessionStorage.getItem('tvs_name') || '';

function refreshButtons() {
  const nameOk = nameInput.value.trim() !== '';
  $id('btn_single').disabled = !(systemReady && nameOk);
  $id('btn_create').disabled = !(systemReady && nameOk);
  $id('btn_board').classList.toggle('tvs-disabled', !systemReady);
}

initStatusLight({
  onReady() {
    systemReady = true;
    refreshButtons();
  },
  onDown() {
    systemReady = false;
    refreshButtons();
  },
});

nameInput.addEventListener('input', refreshButtons);
refreshButtons();

function saveName() {
  const name = nameInput.value.trim().slice(0, 20);
  sessionStorage.setItem('tvs_name', name);
  return name;
}

$id('btn_single').addEventListener('click', () => {
  saveName();
  sessionStorage.setItem('tvs_mode', 'single');
  sessionStorage.setItem('tvs_role', 'student');
  sessionStorage.removeItem('tvs_room');
  window.location.href = 'game.html';
});

$id('btn_create').addEventListener('click', () => {
  saveName();
  sessionStorage.setItem('tvs_mode', 'duo');
  sessionStorage.setItem('tvs_role', 'student');
  sessionStorage.removeItem('tvs_room');
  window.location.href = 'game.html';
});

// 排行榜在綠燈前擋下
$id('btn_board').addEventListener('click', (e) => {
  if (!systemReady) e.preventDefault();
});
