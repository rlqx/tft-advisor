const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { LCUClient } = require('./lcu.js');
const { analyzeGames, getRecommendation, getChampName } = require('./recommender.js');

// 加载英雄中文映射
const champMap = require('./champions_zh.json');

let win;
let client;
let gameCache = { games: [], puuid: '', unitStats: {}, compStats: {} };

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 360,
    height: 520,
    x: width - 380,
    y: 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile('index.html');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

async function initLCU() {
  try {
    client = new LCUClient();
    const { body: s } = await client.getSummoner();
    const puuid = s.puuid;

    const hist = await client.getTFTMatchHistory(puuid);
    const rawGames = hist.body?.games || [];
    const games = rawGames.map(g => g.json || g);

    const { unitStats, compStats } = analyzeGames(games, puuid);
    gameCache = { games, puuid, unitStats, compStats };

    return { ok: true, summoner: s.displayName || puuid.slice(0,8), games: games.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('init', async () => initLCU());

ipcMain.handle('recommend', async (_, unitId) => {
  if (!unitId) return null;

  let matchedId = null;

  // 1. 尝试从已出场英雄中匹配
  const allIds = Object.keys(gameCache.unitStats);
  const fuzzyHit = allIds.find(id => getChampName(id).includes(unitId) || unitId.includes(getChampName(id)));
  if (fuzzyHit) {
    matchedId = fuzzyHit;
  }

  // 2. 从英雄映射表中按中文名查找
  if (!matchedId && !unitId.toLowerCase().startsWith('tft')) {
    const matches = Object.entries(champMap).filter(([, v]) => v.name === unitId);
    if (matches.length > 0) {
      // 优先使用 Set16 版本
      const set16Match = matches.find(([id]) => id.startsWith('tft16'));
      matchedId = set16Match ? set16Match[0] : matches[0][0];
    }
  }

  // 3. 直接使用 TFT ID
  if (!matchedId && unitId.toLowerCase().startsWith('tft')) {
    matchedId = unitId;
  }

  // 使用新的推荐引擎获取数据
  return matchedId ? await getRecommendation(matchedId) : null;
});

ipcMain.handle('get-phase', async () => {
  if (!client) return 'None';
  try {
    const { body } = await client.getPhase();
    return body;
  } catch { return 'None'; }
});

ipcMain.on('close-win', () => app.quit());
ipcMain.on('minimize-win', () => win.minimize());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
