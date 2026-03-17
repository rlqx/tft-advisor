const fs = require('fs');
const { execSync } = require('child_process');

// Node.js 直接用 UTF-8 路径访问
const lockfilePath = 'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile';

console.log('文件是否存在:', fs.existsSync(lockfilePath));

try {
  // 先 stat
  const stat = fs.statSync(lockfilePath);
  console.log('文件大小:', stat.size, 'bytes');
  console.log('修改时间:', stat.mtime);

  // 用 open flag 'r' 以共享方式读
  const buf = Buffer.alloc(1024);
  const fd = fs.openSync(lockfilePath, 'r');
  const bytes = fs.readSync(fd, buf, 0, 1024, 0);
  fs.closeSync(fd);
  const content = buf.slice(0, bytes).toString('utf8');
  console.log('\nlockfile内容:', JSON.stringify(content));

  const parts = content.trim().split(':');
  console.log('\n解析结果:');
  console.log('  进程名:', parts[0]);
  console.log('  PID:   ', parts[1]);
  console.log('  端口:  ', parts[2]);
  console.log('  协议:  ', parts[3]);
  console.log('  Token: ', parts[4]);
} catch(e) {
  console.error('读取失败:', e.code, e.message);
}
