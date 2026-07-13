// 排行榜：單人（分數 Top 50）/ 雙人（近 50 場，含勝方）
import { API_BASE } from './config.js';
import { initStatusLight } from './status.js';

const $id = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ` +
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function loadSingle() {
  const box = $id('board_single');
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard/single`);
    const data = await res.json();
    if (!data.ok) throw new Error('查詢失敗');
    if (data.rows.length === 0) {
      box.innerHTML = '<p class="tvs-hint">還沒有任何紀錄，快去玩一場吧！</p>';
      return;
    }
    box.innerHTML = `
      <table class="tvs-table">
        <thead><tr><th>#</th><th>姓名</th><th>分數</th><th>日期</th></tr></thead>
        <tbody>
          ${data.rows.map((r, i) => `
            <tr class="${i < 3 ? 'tvs-top3' : ''}">
              <td>${i + 1}</td>
              <td>${escapeHtml(r.player_name)}</td>
              <td>${r.score}</td>
              <td>${fmtDate(r.played_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    box.innerHTML = '<p class="tvs-hint">讀取失敗，請等狀態燈變綠後重新整理</p>';
  }
}

async function loadDuo() {
  const box = $id('board_duo');
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard/duo`);
    const data = await res.json();
    if (!data.ok) throw new Error('查詢失敗');
    if (data.rows.length === 0) {
      box.innerHTML = '<p class="tvs-hint">還沒有任何對戰紀錄，揪同學來一場吧！</p>';
      return;
    }
    box.innerHTML = `
      <table class="tvs-table">
        <thead><tr><th>學生</th><th>干擾同學</th><th>分數</th><th>勝方</th><th>日期</th></tr></thead>
        <tbody>
          ${data.rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.student_name)}${r.winner === 'student' ? ' 👑' : ''}</td>
              <td>${escapeHtml(r.disruptor_name)}${r.winner === 'disruptor' ? ' 👑' : ''}</td>
              <td>${r.score}</td>
              <td>${r.winner === 'student' ? '😴 學生' : '😈 干擾同學'}</td>
              <td>${fmtDate(r.played_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    box.innerHTML = '<p class="tvs-hint">讀取失敗，請等狀態燈變綠後重新整理</p>';
  }
}

function showTab(which) {
  $id('board_single').style.display = which === 'single' ? '' : 'none';
  $id('board_duo').style.display = which === 'duo' ? '' : 'none';
  $id('tab_single').classList.toggle('tvs-tab-active', which === 'single');
  $id('tab_duo').classList.toggle('tvs-tab-active', which === 'duo');
}

$id('tab_single').addEventListener('click', () => showTab('single'));
$id('tab_duo').addEventListener('click', () => showTab('duo'));

let loadedOnce = false;
initStatusLight({
  onReady() {
    // 後端喚醒後（含冷啟動恢復）自動載入資料
    if (!loadedOnce) {
      loadedOnce = true;
      loadSingle();
      loadDuo();
    }
  },
});
