const https = require('https');

// LeagueClient 监听的端口
const ports = [30425, 40017, 51403, 59272];

// LCU 使用 Basic auth: riot:<token>
// token 从 lockfile 读取，但我们先尝试不带 auth 看响应
function probe(port, path = '/lol-summoner/v1/current-summoner', token = '') {
  return new Promise((resolve) => {
    const auth = token ? Buffer.from(`riot:${token}`).toString('base64') : '';
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET',
      headers: token ? { Authorization: `Basic ${auth}` } : {},
      rejectUnauthorized: false,
      timeout: 3000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ port, status: res.statusCode, body: data.slice(0, 200) }));
    });
    req.on('error', (e) => resolve({ port, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ port, error: 'timeout' }); });
    req.end();
  });
}

async function main() {
  console.log('探测 LCU API 端口...');
  for (const port of ports) {
    // 先试 https
    const r = await probe(port);
    console.log(`Port ${port}: status=${r.status || 'N/A'} error=${r.error || 'none'}`);
    if (r.status) {
      console.log(`  -> 响应: ${r.body.slice(0, 100)}`);
    }
  }

  // 也试 http
  console.log('\n探测 HTTP 端口...');
  const http = require('http');
  for (const port of ports) {
    await new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/lol-summoner/v1/current-summoner`, {timeout:2000}, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { console.log(`HTTP Port ${port}: ${res.statusCode} - ${d.slice(0,100)}`); resolve(); });
      });
      req.on('error', e => { console.log(`HTTP Port ${port}: error - ${e.message}`); resolve(); });
      req.on('timeout', () => { req.destroy(); resolve(); });
    });
  }
}

main();
