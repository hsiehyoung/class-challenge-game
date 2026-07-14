// 嚴厲老師 vs 疲憊學生（重製版）後端進入點
// Express：靜態檔 + REST API（health / 排行榜）
// Socket.IO：雙人模式房間系統（見 rooms.js）
require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const db = require('./db');
const rooms = require('./rooms');

const PORT = process.env.PORT || 3000;

// ALLOWED_ORIGIN 未設定時允許所有來源（本機開發方便）；
// 部署後建議設成 GitHub Pages 網址，可用逗號分隔多個。
const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : true;

const app = express();
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// ---- REST API ----

// 健康檢查：連線狀態燈輪詢用；同時喚醒 Render 與 Neon
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.healthCheck();
    res.json(result);
  } catch (err) {
    console.error('[health] DB 尚未就緒:', err.message);
    res.status(503).json({ ok: false, error: 'database not ready' });
  }
});

// 單人排行榜（分數高到低 Top 50）
app.get('/api/leaderboard/single', async (req, res) => {
  try {
    res.json({ ok: true, rows: await db.getSingleLeaderboard() });
  } catch (err) {
    console.error('[leaderboard/single]', err.message);
    res.status(500).json({ ok: false, error: 'query failed' });
  }
});

// 雙人排行榜（最近 50 場，含勝方）
app.get('/api/leaderboard/duo', async (req, res) => {
  try {
    res.json({ ok: true, rows: await db.getDuoLeaderboard() });
  } catch (err) {
    console.error('[leaderboard/duo]', err.message);
    res.status(500).json({ ok: false, error: 'query failed' });
  }
});

// 單人模式分數上傳（雙人由 rooms.js 於伺服器端寫入，不開放前端直寫）
app.post('/api/scores', async (req, res) => {
  const { name, score } = req.body || {};
  if (typeof name !== 'string' || name.trim() === '' || !Number.isFinite(Number(score))) {
    return res.status(400).json({ ok: false, error: 'name 與 score 為必填' });
  }
  try {
    await db.addSingleScore(name, score);
    res.json({ ok: true });
  } catch (err) {
    console.error('[scores]', err.message);
    res.status(500).json({ ok: false, error: 'insert failed' });
  }
});

// ---- 靜態檔（本機開發與 Render 備用入口；正式前端在 GitHub Pages）----
// 圖檔/音檔/vendor 幾乎不變：給 30 天 immutable 快取，遊戲中換圖不會再打伺服器；
// HTML/JS/CSS 則每次重新驗證（ETag 304），改版後玩家能立即拿到新檔。
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders(res, filePath) {
    if (/[\\/](img|audio|vendor)[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ---- Socket.IO ----
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins },
});
rooms.init(io);

server.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[server] 排行榜儲存：${db.usingPostgres() ? 'PostgreSQL (Neon)' : '記憶體（重啟即清空，僅供測試）'}`);
});
