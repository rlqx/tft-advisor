const https = require('https');
const { execSync } = require('child_process');

function getLcuCredentials() {
  try {
    const output = execSync(
      'wmic process where "name=\'LeagueClientUx.exe\'" get CommandLine /format:list',
      { encoding: 'utf8', timeout: 5000 }
    );
    const portMatch = output.match(/--app-port=(\d+)/);
    const tokenMatch = output.match(/--remoting-auth-token=([\w-]+)/);
    if (!portMatch || !tokenMatch) {
      throw new Error('LOL 客户端未运行，请先启动游戏客户端');
    }
    return { port: parseInt(portMatch[1]), token: tokenMatch[1] };
  } catch (e) {
    if (e.message.includes('LOL')) throw e;
    throw new Error('LOL 客户端未运行，请先启动游戏客户端');
  }
}

function lcuGet(port, token, path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`riot:${token}`).toString('base64');
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
      rejectUnauthorized: false,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(JSON.parse(data));
          }
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('正在连接 LOL 客户端...');

  const { port, token } = getLcuCredentials();
  console.log(`[LCU] 连接到端口: ${port}\n`);

  // 1. 当前玩家
  console.log('=== 当前玩家信息 ===');
  const summoner = await lcuGet(port, token, '/lol-summoner/v1/current-summoner');
  console.log(`召唤师名: ${summoner.displayName}`);
  console.log(`PUUID:    ${summoner.puuid}`);
  console.log(`等级:     ${summoner.summonerLevel}`);

  // 2. 游戏阶段
  console.log('\n=== 游戏当前阶段 ===');
  const phase = await lcuGet(port, token, '/lol-gameflow/v1/gameflow-phase');
  console.log(`阶段: ${phase}`);

  // 3. TFT 历史对局
  console.log('\n=== TFT 历史对局（最近5场）===');
  const puuid = summoner.puuid;
  const history = await lcuGet(
    port, token,
    `/lol-match-history/v1/products/tft/${puuid}/matches?begIndex=0&endIndex=5`
  );
  const games = history?.games?.games || [];
  if (games.length > 0) {
    for (const g of games) {
      const min = Math.floor(g.gameDuration / 60);
      const sec = g.gameDuration % 60;
      console.log(`  对局ID: ${g.gameId} | 时长: ${min}分${sec}秒`);
    }
  } else {
    console.log('  暂无 TFT 历史对局数据');
    console.log('  原始返回:', JSON.stringify(history).slice(0, 300));
  }

  console.log('\n✅ LCU API 连接测试成功！');
}

main().catch(e => console.error(`\n❌ ${e.message}`));
