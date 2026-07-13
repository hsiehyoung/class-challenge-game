// 排行榜儲存層：有 DATABASE_URL 就用 PostgreSQL（Neon），
// 沒有就退回記憶體儲存（重啟即清空，僅供本機測試）。
const { Pool } = require('pg');

const MAX_ROWS = 50;

let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  pool.on('error', (err) => console.error('[db] pool error:', err.message));
}

// 記憶體備援
const mem = { single: [], duo: [] };

function cleanName(name) {
  return String(name || '').trim().slice(0, 20) || '無名氏';
}

function cleanScore(score) {
  const n = Math.floor(Number(score));
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 9999999);
}

async function healthCheck() {
  if (!pool) return { ok: true, db: 'memory' };
  await pool.query('SELECT 1');
  return { ok: true, db: 'postgres' };
}

async function addSingleScore(name, score) {
  const playerName = cleanName(name);
  const s = cleanScore(score);
  if (pool) {
    await pool.query(
      'INSERT INTO single_scores (player_name, score) VALUES ($1, $2)',
      [playerName, s]
    );
  } else {
    mem.single.push({ player_name: playerName, score: s, played_at: new Date().toISOString() });
  }
}

async function addDuoMatch(studentName, disruptorName, score, winner) {
  const stu = cleanName(studentName);
  const dis = cleanName(disruptorName);
  const s = cleanScore(score);
  const win = winner === 'student' ? 'student' : 'disruptor';
  if (pool) {
    await pool.query(
      'INSERT INTO duo_matches (student_name, disruptor_name, score, winner) VALUES ($1, $2, $3, $4)',
      [stu, dis, s, win]
    );
  } else {
    mem.duo.push({
      student_name: stu,
      disruptor_name: dis,
      score: s,
      winner: win,
      played_at: new Date().toISOString(),
    });
  }
}

async function getSingleLeaderboard() {
  if (pool) {
    const { rows } = await pool.query(
      'SELECT player_name, score, played_at FROM single_scores ORDER BY score DESC, played_at ASC LIMIT $1',
      [MAX_ROWS]
    );
    return rows;
  }
  return [...mem.single].sort((a, b) => b.score - a.score).slice(0, MAX_ROWS);
}

async function getDuoLeaderboard() {
  if (pool) {
    const { rows } = await pool.query(
      'SELECT student_name, disruptor_name, score, winner, played_at FROM duo_matches ORDER BY played_at DESC LIMIT $1',
      [MAX_ROWS]
    );
    return rows;
  }
  return [...mem.duo].reverse().slice(0, MAX_ROWS);
}

module.exports = {
  healthCheck,
  addSingleScore,
  addDuoMatch,
  getSingleLeaderboard,
  getDuoLeaderboard,
  usingPostgres: () => Boolean(pool),
};
