# 老師 vs 學生（重製版）

課堂打瞌睡小遊戲。上課偷睡覺賺分數，老師轉身前要醒來；雙人模式時另一位同學可以丟粉筆、放飛碟干擾你。

## 玩法

| 模式 | 說明 |
|---|---|
| 😴 單人 | 事件每 12~20 秒隨機發生（丟粉筆 / 看飛碟） |
| 🥊 雙人 | 學生選「雙人模式」取得 4 碼教室號碼 → 干擾同學用**手機**開「干擾同學入口」（`join.html`）輸入教室號碼 → 雙方按準備後開賽（有「準備→開始」動畫） |

- **睡覺**：按住學生不放（手機可長按），睡越久進入「深層睡眠」加分更快
- **被抓**：老師轉身時還在睡 → 遊戲結束，雙人模式判干擾同學勝
- **丟粉筆**：干擾者選擇丟擲方向（左／右），老師**隨機**往一邊閃躲——猜中老師閃躲的方向就砸中，老師會憤怒緊盯學生 4 回合（此時睡覺極易被抓）；學生無需任何操作
- **看飛碟**：老師走到窗邊看熱鬧約 5.6 秒，學生可趁機安心睡
- **時間到**：時鐘轉滿一圈（約 2 分鐘）下課；雙人模式學生 **≥ 1000 分學生勝，否則干擾同學勝**
- **干擾冷卻**：干擾發動後 20 秒冷卻（伺服器驗證，連點無效）
- **排行榜**：單人（分數 Top 50）與雙人（近 50 場、含勝方）各自獨立

## 技術架構

```
public/    前端（原生 JS ES Modules，無打包）→ 部署 GitHub Pages（不休眠）
server/    Node.js + Express + Socket.IO      → 部署 Render 免費方案
資料庫      PostgreSQL（Neon 免費方案）；未設定 DATABASE_URL 時自動退回記憶體儲存
```

因為 Render 免費方案閒置 15 分鐘會休眠，前端內建**連線狀態燈**：
頁面開啟即顯示 🔴「等待系統啟動…」並每 3 秒輪詢 `/api/health`（此請求同時喚醒 Render 與 Neon），
成功後轉 🟢「系統正常運作」才解鎖遊戲入口。遊戲中若斷線，燈會轉紅並鎖定操作，重連後自動恢復。

## 本機開發

```bash
npm install
npm start          # http://localhost:3000（前後端同源）
```

不需要資料庫即可開發（排行榜暫存記憶體，重啟清空）。要接 Neon 時：

```bash
cp .env.example .env    # 填入 DATABASE_URL
```

## 部署指引（全部免費）

### 1. Neon — 排行榜資料庫

1. 到 [neon.tech](https://neon.tech) 用 GitHub 帳號註冊 → **Create Project**（Free plan）
2. 開啟 **SQL Editor**，貼上 [`server/schema.sql`](server/schema.sql) 全文執行
3. 在 Dashboard 複製 **Connection string**（形如 `postgresql://...@ep-xxx.aws.neon.tech/neondb?sslmode=require`）備用

### 2. GitHub — 程式碼

1. 將本資料夾（`remake/`）推成一個 GitHub repo（repo 根目錄 = 本資料夾）
2. `.env` 已在 `.gitignore`，連線字串不會外洩

### 3. Render — 後端（支援 WebSocket）

1. 到 [render.com](https://render.com) 用 GitHub 註冊 → **New → Web Service** → 選擇該 repo
2. 設定：
   - Runtime：**Node**
   - Build Command：`npm install`
   - Start Command：`node server/index.js`
   - Instance Type：**Free**
3. **Environment Variables**：
   - `DATABASE_URL` = Neon 連線字串
   - `ALLOWED_ORIGIN` = 你的 GitHub Pages 網址（例 `https://<帳號>.github.io`，可先留待步驟 4 後回來補）
4. Deploy 完成後記下網址，例如 `https://teacher-vs-student.onrender.com`

### 4. GitHub Pages — 前端（永不休眠的入口）

1. 編輯 [`public/js/config.js`](public/js/config.js)，把 `API_BASE` 改成 Render 網址：
   ```js
   export const API_BASE = 'https://teacher-vs-student.onrender.com';
   ```
   commit + push
2. Repo → **Settings → Pages → Source 選「GitHub Actions」**
   （已附好 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)，push 後自動發佈 `public/`）
3. 完成後玩家入口為 `https://<帳號>.github.io/<repo>/`
4. 回到 Render 把 `ALLOWED_ORIGIN` 補上這個網址（含 `https://`，結尾不要斜線）

### 部署後的預期行為

- 打開 Pages 首頁 **秒開**，若 Render 正在休眠會顯示 🔴 紅燈約 30~60 秒，喚醒後自動轉 🟢 綠燈解鎖，**全程不需重新整理**
- Neon 免費方案閒置會暫停運算，健康檢查會一併喚醒，資料不會消失
- 直接用 Render 網址開遊戲也可以（同源模式），只是首次進站要等冷啟動、沒有紅燈緩衝的體驗

## 專案結構

```
server/index.js    Express + REST API（health / 排行榜）+ Socket.IO 掛載
server/rooms.js    房間系統：建房、加入、準備、冷卻驗證（20 秒）、勝負判定、斷線清理
server/db.js       Neon PostgreSQL 連線池；無 DATABASE_URL 時退回記憶體
public/game.html   學生玩家端（沿用原版 DOM 結構與 main.css，版面像素級一致）
public/disruptor.html  干擾同學端（手機版面）
public/js/game.js  遊戲主迴圈（計分、老師狀態機、事件佇列、結算）
public/js/status.js    連線狀態燈（紅/綠燈與輪詢喚醒）
public/js/config.js    ★ 部署時唯一要改的檔案（API_BASE）
```

## 沿用原版的遊戲數值

老師狀態機每 1.5 秒切換、睡覺 +1/100ms、深層睡眠 +10/100ms、
粉筆命中後老師憤怒攻擊 4 回合、看飛碟約 5.6 秒、
時鐘 330ms/度 × 360 度 ≈ 2 分鐘一場。
（與原版不同處：丟粉筆改為干擾者選方向、老師隨機閃躲，學生端不再有閃躲操作。）
