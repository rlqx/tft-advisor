const https = require('https');
const http = require('http');

// 从已知进程信息获取 token 的备选方案
// LeagueClient PID=58328 监听端口: 30425, 40017, 51403, 59272
const ports = [30425, 40017, 51403, 59272];

// LCU 不需要 token 的端点（返回 200 或 401）
const testPaths = [
  '/lol-login/v1/session',
  '/riotclient/auth-token',
  '/riotclient/region-locale',
  '/',
];

function probeHttps(port, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: '127.0.0.1',
      port, path,
      method: 'GET',
      rejectUnauthorized: false,
      timeout: 2000,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ port, path, status: res.statusCode, body: data.slice(0, 150) }));
    });
    req.on('error', e => resolve({ port, path, error: e.code }));
    req.on('timeout', () => { req.destroy(); resolve({ port, path, error: 'TIMEOUT' }); });
    req.end();
  });
}

async function main() {
  console.log('探测 LCU 端口响应...\n');
  for (const port of ports) {
    for (const path of testPaths.slice(0, 2)) {
      const r = await probeHttps(port, path);
      if (!r.error) {
        console.log(`✓ HTTPS Port ${port} ${path} => ${r.status}`);
        console.log(`  Body: ${r.body}`);
      } else {
        console.log(`✗ HTTPS Port ${port} ${path} => ${r.error}`);
      }
    }
  }

  // 也试 RiotClientServices 端口 60373
  console.log('\n探测 RiotClientServices(60373)...');
  const rc = await probeHttps(60373, '/riotclient/auth-token');
  console.log(`Port 60373 /riotclient/auth-token => ${rc.status || rc.error}`);
  if (rc.body) console.log('  Body:', rc.body);

  const rc2 = await probeHttps(60373, '/riotclient/region-locale');
  console.log(`Port 60373 /riotclient/region-locale => ${rc2.status || rc2.error}`);
  if (rc2.body) console.log('  Body:', rc2.body);
}

main();
