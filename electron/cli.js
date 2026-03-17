/**
 * TFT Advisor - 命令行版
 * 输入英雄名，返回装备和阵容推荐
 */
const readline = require('readline');
const { LCUClient } = require('./lcu.js');
const { analyzeGames, getRecommendation, getChampName } = require('./recommender.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function query(q, unitStats, compStats) {
  // 模糊匹配
  let matchedId = null;
  const allIds = Object.keys(unitStats);

  // 1. 精确匹配英文ID
  if (q.startsWith('TFT')) {
    matchedId = allIds.find(id => id.toLowerCase() === q.toLowerCase());
  }
  // 2. 中文名匹配
  if (!matchedId) {
    matchedId = allIds.find(id => getChampName(id) === q);
  }
  // 3. 模糊匹配
  if (!matchedId) {
    matchedId = allIds.find(id => getChampName(id).includes(q));
  }

  if (!matchedId) {
    console.log('\x1b[31m未找到该英雄数据\x1b[0m\n');
    return;
  }

  const rec = getRecommendation(matchedId, unitStats, compStats);
  if (!rec) {
    console.log('\x1b[31m数据不足\x1b[0m\n');
    return;
  }

  const costColors = { 1: '37', 2: '32', 3: '34', 4: '35', 5: '33' };
  const c = costColors[Math.min(rec.cost || 1, 5)];

  console.log('');
  console.log(`  \x1b[1m${rec.unitName}\x1b[0m \x1b[${c}m(${rec.cost}费)\x1b[0m - ${rec.totalGames}场 top4率:${(rec.top4Rate*100).toFixed(0)}%`);
  console.log('\x1b[90m' + '─'.repeat(40) + '\x1b[0m');

  if (rec.bestItems.length) {
    console.log('\x1b[33m  推荐装备:\x1b[0m');
    rec.bestItems.slice(0, 5).forEach((i, n) => {
      console.log(`    ${n+1}. ${i.name} \x1b[90m(top4 ${(i.top4Rate*100).toFixed(0)}%)\x1b[0m`);
    });
  }

  if (rec.bestComps.length) {
    console.log('\x1b[33m  推荐阵容:\x1b[0m');
    rec.bestComps.slice(0, 3).forEach((c, n) => {
      const traits = c.traits.map(t => `${t.name}${t.count}`).join(' ');
      console.log(`    ${n+1}. ${traits} \x1b[90m(top4 ${(c.top4Rate*100).toFixed(0)}% / ${c.games}场)\x1b[0m`);
    });
  }
  console.log('');
}

console.log('\x1b[33m%s\x1b[0m', `
╔════════════════════════════════════════╗
║        TFT Advisor - 云顶之弈助手        ║
║        输入英雄名查询装备/阵容推荐        ║
║        输入 q 退出                       ║
╚════════════════════════════════════════╝
`);

const args = process.argv.slice(2);
const interactive = args.length === 0;

(async () => {
  const client = new LCUClient();
  const { body: s } = await client.getSummoner();
  const hist = await client.getTFTMatchHistory(s.puuid);
  const rawGames = hist.body?.games || [];
  const games = rawGames.map(g => g.json || g);
  const { unitStats, compStats } = analyzeGames(games, s.puuid);

  console.log('\x1b[36m%s\x1b[0m', `已加载 ${games.length} 场对局数据\n`);

  // 非交互模式：直接查询命令行参数
  if (!interactive) {
    const q = args.join(' ');
    await query(q, unitStats, compStats);
    rl.close();
    process.exit(0);
    return;
  }

  // 交互模式
  const ask = () => {
    rl.question('\x1b[32m输入英雄名>\x1b[0m ', async (input) => {
      const q = input.trim();
      if (q === 'q' || q === 'quit') { rl.close(); return; }
      if (!q) { ask(); return; }
      await query(q, unitStats, compStats);
      ask();
    });
  };
  ask();
})();