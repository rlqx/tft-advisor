/**
 * LCU API 连接器 - 云顶之弈国服数据
 * 通过读取 LeagueClientUx 日志自动获取端口和 token
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const LOG_DIR = 'D:\\WeGameApps\\英雄联盟\\LeagueClient';

function getCredentials() {
  const logs = fs.readdirSync(LOG_DIR)
    .filter(f => /^\d{4}-.*_LeagueClientUx\.log$/.test(f))
    .sort().reverse();
  for (const log of logs) {
    const content = fs.readFileSync(path.join(LOG_DIR, log), 'utf8').slice(0, 4096);
    const port  = content.match(/--app-port=(\d+)/);
    const token = content.match(/--remoting-auth-token=([\w-]+)/);
    if (port && token) return { port: parseInt(port[1]), token: token[1] };
  }
  throw new Error('未找到 LCU 凭据，请确认 LOL 客户端正在运行');
}

function request(port, token, apiPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`riot:${token}`).toString('base64');
    const options = {
      hostname: '127.0.0.1',
      port, path: apiPath, method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: false,
      timeout: 8000,
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
    req.on('timeout', () => { req.destroy(); reject(new Error('LCU 请求超时')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

class LCUClient {
  constructor() {
    const creds = getCredentials();
    this.port  = creds.port;
    this.token = creds.token;
  }

  get(apiPath)    { return request(this.port, this.token, apiPath); }
  post(p, body)   { return request(this.port, this.token, p, 'POST', body); }

  // 当前玩家
  getSummoner()   { return this.get('/lol-summoner/v1/current-summoner'); }

  // 游戏阶段
  getPhase()      { return this.get('/lol-gameflow/v1/gameflow-phase'); }

  // TFT 历史对局列表（国服不支持 count/begIndex 参数）
  getTFTMatchHistory(puuid) {
    return this.get(`/lol-match-history/v1/products/tft/${puuid}/matches`);
  }

  // TFT 对局详情
  getTFTMatchDetail(gameId) {
    return this.get(`/lol-match-history/v1/games/${gameId}`);
  }

  // 排位信息
  getRankedStats(puuid) {
    return this.get(`/lol-ranked/v1/ranked-stats/${puuid}`);
  }
}

module.exports = { LCUClient };

// 直接运行时执行测试
if (require.main === module) {
  (async () => {
    const client = new LCUClient();
    console.log(`✓ LCU 连接: 端口=${client.port}\n`);

    const { body: s } = await client.getSummoner();
    console.log('=== 召唤师 ===');
    console.log(`  名称: ${s.displayName || '(未登录)'}`);
    console.log(`  PUUID: ${s.puuid}`);
    console.log(`  等级: ${s.summonerLevel}`);

    const { body: phase } = await client.getPhase();
    console.log(`\n=== 游戏阶段: ${phase} ===`);

    console.log('\n=== TFT 历史对局 ===');
    const hist = await client.getTFTMatchHistory(s.puuid, 5);
    // 国服结构: { active_puuid, games: [{json: {...}}] }
    const rawGames = hist.body?.games || [];
    // 国服格式：游戏数据在 g.json 字段（对象）内
    const games = rawGames.map(g => g.json || g);

    if (games.length) {
      console.log(`  共 ${games.length} 场记录:`);
      games.slice(0, 5).forEach(g => {
        const participants = g.participants || [];
        const me = participants.find(p => p.puuid === s.puuid) || participants[0];
        const placement = me?.placement ?? '?';
        const duration = g.game_length || g.gameDuration || 0;
        const gameId = g.game_id || g.gameId;
        console.log(`  gameId=${gameId} | ${Math.floor(duration/60)}分 | 名次: ${placement}`);
        if (me?.units) {
          const units = me.units.slice(0,4).map(u => u.character_id || u.characterId).join(', ');
          console.log(`    英雄: ${units}`);
        }
        if (me?.traits) {
          const traits = me.traits.filter(t => t.tier_current > 0).map(t => `${t.name}(${t.num_units})`).join(', ');
          console.log(`    羁绊: ${traits}`);
        }
      });
    } else {
      console.log('  暂无对局记录');
    }

    // 排位信息
    console.log('\n=== TFT 排位 ===');
    const ranked = await client.getRankedStats(s.puuid);
    if (ranked.status === 200) {
      const tft = ranked.body?.queueMap?.RANKED_TFT;
      if (tft) {
        console.log(`  段位: ${tft.tier} ${tft.division} ${tft.leaguePoints}LP`);
      } else {
        console.log('  暂未定级');
      }
    } else {
      console.log('  排位接口:', ranked.status);
    }

    console.log('\n✅ 测试完成');
  })().catch(e => console.error('❌', e.message));
}
