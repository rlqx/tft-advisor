const { LCUClient } = require('./lcu.js');

(async () => {
  const client = new LCUClient();
  const { body: s } = await client.getSummoner();

  const hist = await client.get(`/lol-match-history/v1/products/tft/${s.puuid}/matches`);
  console.log('status:', hist.status);

  const raw = JSON.stringify(hist.body);
  console.log('\n原始结构 (前800字符):');
  console.log(raw.slice(0, 800));

  // 深入看第一条
  const games = hist.body?.games?.games || [];
  if (games.length > 0) {
    console.log('\n第一条原始:');
    console.log(JSON.stringify(games[0]).slice(0, 600));

    // 如果有 json 字段
    if (games[0].json) {
      console.log('\njson字段类型:', typeof games[0].json);
      const inner = typeof games[0].json === 'string'
        ? JSON.parse(games[0].json)
        : games[0].json;
      console.log('\ninner结构:');
      console.log(JSON.stringify(inner).slice(0, 600));
    }
  }
})().catch(e => console.error('❌', e.message));
