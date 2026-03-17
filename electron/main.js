const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { LCUClient } = require('./lcu.js');
const { analyzeGames, getRecommendation, getChampName, getTraitName, getItemName } = require('./recommender.js');

// 加载英雄中文映射
const champMap = require('./champions_zh.json');
// 加载英雄别名映射
const champAliases = require('./champion_aliases.json');

let win;
let client;
let gameCache = { games: [], puuid: '', unitStats: {}, compStats: {}, summoner: null, rankedStats: null };

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 320,
    height: 620,
    x: width - 340,
    y: 60,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });

  win.loadFile('index.html');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAlwaysOnTop(true, 'pop-up-menu');
  win.setHasShadow(false); // 禁用窗口阴影
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

    // 获取排位信息
    let rankedStats = null;
    try {
      const rankedRes = await client.getRankedStats(puuid);
      rankedStats = rankedRes.body?.queueMap?.RANKED_TFT || null;
    } catch {}

    gameCache = { games, puuid, unitStats, compStats, summoner: s, rankedStats };

    return { ok: true, summoner: s.displayName || puuid.slice(0,8), games: games.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

ipcMain.handle('init', async () => initLCU());

// 获取英雄列表（供搜索建议使用）
ipcMain.handle('get-champion-list', async () => {
  const champions = [];
  const aliasMap = champAliases['外号映射'] || {};

  // 从 set16_champions.json 获取英雄
  for (const [id, data] of Object.entries(champMap)) {
    if (id.startsWith('tft16')) {
      champions.push({
        id: id,
        name: data.name,
        cost: data.cost,
        aliases: []
      });
    }
  }

  // 添加别名
  for (const [alias, standardName] of Object.entries(aliasMap)) {
    const champ = champions.find(c => c.name === standardName);
    if (champ) {
      champ.aliases.push(alias);
    }
  }

  return champions;
});

ipcMain.handle('recommend', async (_, unitId) => {
  if (!unitId) return null;

  let matchedId = null;
  const query = unitId.trim().toLowerCase();

  // 0. 尝试从别名映射表中查找
  const aliasMap = champAliases['外号映射'] || {};
  if (aliasMap[query]) {
    // 找到别名，转换为标准名称
    unitId = aliasMap[query];
  }

  // 1. 尝试从已出场英雄中匹配
  const allIds = Object.keys(gameCache.unitStats);
  const fuzzyHit = allIds.find(id => getChampName(id).includes(unitId) || unitId.includes(getChampName(id)));
  if (fuzzyHit) {
    matchedId = fuzzyHit;
  }

  // 2. 从英雄映射表中按中文名查找（支持部分匹配）
  if (!matchedId && !unitId.toLowerCase().startsWith('tft')) {
    // 精确匹配
    const exactMatches = Object.entries(champMap).filter(([, v]) => v.name === unitId);
    if (exactMatches.length > 0) {
      const set16Match = exactMatches.find(([id]) => id.startsWith('tft16'));
      matchedId = set16Match ? set16Match[0] : exactMatches[0][0];
    } else {
      // 部分匹配（包含关系）
      const partialMatches = Object.entries(champMap).filter(([, v]) =>
        v.name.includes(unitId) || unitId.includes(v.name)
      );
      if (partialMatches.length > 0) {
        const set16Match = partialMatches.find(([id]) => id.startsWith('tft16'));
        matchedId = set16Match ? set16Match[0] : partialMatches[0][0];
      }
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

// 获取个人统计数据
ipcMain.handle('get-player-stats', async () => {
  if (!gameCache.summoner) return null;

  const s = gameCache.summoner;
  const rank = gameCache.rankedStats;

  // 构建排名字符串
  let rankStr = '未定级';
  if (rank && rank.tier) {
    rankStr = `${rank.tier} ${rank.division} ${rank.leaguePoints}LP`;
  }

  // 常用英雄 TOP 10
  const topUnits = Object.entries(gameCache.unitStats)
    .map(([id, stats]) => ({
      id,
      name: getChampName(id),
      games: stats.games,
      top4: stats.top4,
      top4Rate: stats.games > 0 ? Math.round(stats.top4 / stats.games * 100) : 0
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);

  // 最近对局
  const recentMatches = gameCache.games.slice(0, 10).map(g => {
    const me = (g.participants || []).find(p => p.puuid === gameCache.puuid);
    if (!me) return null;
    const units = (me.units || []).slice(0, 5).map(u => ({
      id: u.character_id,
      name: getChampName(u.character_id)
    }));
    const traits = (me.traits || [])
      .filter(t => t.tier_current > 0)
      .map(t => `${getTraitName(t.name)}(${t.num_units})`)
      .join(', ');
    return {
      placement: me.placement,
      units,
      traits
    };
  }).filter(Boolean);

  return {
    summoner: {
      name: s.displayName,
      level: s.summonerLevel,
      puuid: s.puuid
    },
    rank: rankStr,
    games: {
      totalGames: gameCache.games.length
    },
    topUnits,
    recentMatches
  };
});

// 获取实时对局数据
ipcMain.handle('get-live-data', async () => {
  if (!client) return { source: 'error', message: '未连接到 LCU' };
  try {
    // 先获取游戏阶段
    const phaseRes = await client.getPhase();
    const phase = phaseRes.body || 'None';

    // 如果不在游戏中，返回空
    if (phase !== 'InProgress') {
      return {
        source: 'waiting',
        phase: phase,
        message: '等待游戏开始'
      };
    }

    // 尝试获取游戏会话信息
    const session = await client.get('/lol-gameflow/v1/session');

    if (session.body && session.status === 200) {
      const s = session.body;
      const gameTime = s.gameClient?.running ?
        Math.floor((Date.now() - (s.gameData?.gameStartTime || Date.now())) / 1000) : 0;

      return {
        source: 'lcu',
        phase: phase,
        gameInfo: {
          queueId: s.gameData?.queue?.id,
          queueName: s.gameData?.queue?.name || 'TFT 游戏',
          mapName: s.gameData?.map?.name || '云顶之弈',
          gameTime: Math.max(0, gameTime),
          isRanked: s.gameData?.queue?.isRanked
        }
      };
    }

    // 回退：只返回阶段信息
    return {
      source: 'phase_only',
      phase: phase,
      message: '游戏进行中'
    };
  } catch (e) {
    console.error('get-live-data error:', e.message);
    return {
      source: 'error',
      message: e.message
    };
  }
});

// 对比出装
ipcMain.handle('compare-builds', async (_, unitId) => {
  if (!unitId || !gameCache.unitStats[unitId]) return null;

  const unitStats = gameCache.unitStats[unitId];
  const unitName = getChampName(unitId);

  // 我的常用出装
  const myItems = Object.entries(unitStats.items || {})
    .map(([id, stats]) => ({
      id,
      name: getItemName(id),
      count: stats.count,
      top4Rate: stats.count > 0 ? Math.round(stats.top4 / stats.count * 100) : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // 获取推荐出装
  const rec = await getRecommendation(unitId);
  const recommendedItems = rec?.recommendedItems || [];

  // 生成建议
  const suggestions = [];
  const myItemIds = new Set(myItems.map(i => i.id));

  recommendedItems.slice(0, 3).forEach(recItem => {
    if (!myItemIds.has(recItem.id)) {
      suggestions.push(`尝试添加 ${recItem.name}（前四率 ${recItem.top4Rate}%）`);
    }
  });

  if (suggestions.length === 0 && myItems.length > 0) {
    suggestions.push('你的出装已经符合主流推荐！');
  }

  return {
    unitId,
    unitName,
    myGames: unitStats.games,
    myItems,
    recommendedItems,
    suggestions
  };
});

ipcMain.on('close-win', () => app.quit());
ipcMain.on('minimize-win', () => win.minimize());

// 折叠/展开窗口
ipcMain.on('toggle-collapse', (_, isCollapsed) => {
  if (isCollapsed) {
    win.setSize(320, 45);
    win.setShape([{ x: 0, y: 0, width: 320, height: 45 }]);
  } else {
    win.setSize(320, 620);
    win.setShape([{ x: 0, y: 0, width: 320, height: 620 }]);
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
