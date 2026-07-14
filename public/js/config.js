// ★ 部署設定 ★
//
// PROD_API：正式後端（Render）網址，結尾不要加斜線。
// 本機開發（localhost 或區網 IP，例如手機連 http://192.168.x.x:3100）會自動
// 改走「同源」後端（npm start 起的那台），不需要手動切換。
const PROD_API = 'https://class-challenge-game.onrender.com';

const host = window.location.hostname;
const isLocal =
  host === 'localhost' ||
  host === '127.0.0.1' ||
  /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);

export const API_BASE = isLocal ? '' : PROD_API;
