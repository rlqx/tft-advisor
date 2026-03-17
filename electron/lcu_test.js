const https = require('https');
const fs = require('fs');
const path = require('path');

// 从最新日志自动提取 port 和 token
function getLcuCredentials() {
  const logDir = 'D:\\WeGameApps\\英雄联盟\\LeagueClient';
  const logs = fs.readdirSync(logDir)
    .filter(f => f.match(/^\d{4}-.*_LeagueClientUx\.log$/))
    .sort().reverse();

  for (const log of logs) {
    const content = fs.readFileSync(path.join(logDir, log), 'utf8').slice(0, 4096);
    const port = content.match(/--app-port=(\d+)/);
    const token = content.match(/--remoting-auth-token=([\w-]+)/);
    if (port && token) {
      return { port: parseInt(port[1]), token: token[1], log };
    }
  }
  throw new Error('无法从日志获取 LCU 凭据');
}

function lcuGet(port, token, apiPath) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`riot:${token}`).toString('base64');
    const options = {
      hostname: '127.0.0.1',
      port, path: apiPath,
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
      rejectUnauthorized: false,
      timeout: 5000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function main() {
  console.log('从日志提取 LCU 凭据...');
  const { port, token, log } = getLcuCredentials();
  console.log(`日志文件: ${log}`);
  console.log(`端口: ${port}`);
  console.log(`Token: ${token}\n`);

  // 测试1: 当前玩家信息
  console.log('=== 当前玩家信息 ===');
  const s = await lcuGet(port, token, '/lol-summoner/v1/current-summoner');
  if (s.status === 200) {
    console.log(`召唤师名: ${s.body.displayName}`);
    console.log(`PUUID:    ${s.body.puuid}`);
    console.log(`等级:     ${s.body.summonerLevel}`);
  } else {
    console.log(`HTTP ${s.status}:`, JSON.stringify(s.body).slice(0, 200));
  }

  // 测试2: 游戏阶段
  console.log('\n=== 游戏阶段 ===');
  const phase = await lcuGet(port, token, '/lol-gameflow/v1/gameflow-phase');
  console.log(`阶段: ${phase.body}`);

  // 测试3: TFT 历史
  if (s.status === 200 && s.body.puuid) {
    console.log('\n=== TFT 历史对局 ===');
    const hist = await lcuGet(port, token,
      `/lol-match-history/v1/products/tft/${s.body.puuid}/matches?begIndex=0&endIndex=5`);
    const games = hist.body?.games?.games || [];
    if (games.length) {
      games.forEach(g => {
        const min = Math.floor(g.gameDuration/60);
        const sec = g.gameDuration % 60;
        console.log(`  对局 ${g.gameId} | ${min}分${sec}秒`);
      });
    } else {
      console.log('  暂无记录 (', JSON.stringify(hist.body).slice(0,100), ')');
    }
  }

  console.log('\n✅ LCU API 连接成功！');
}

main().catch(e => console.error('\n❌', e.message));
