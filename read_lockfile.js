const fs = require('fs');
const path = 'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile';

try {
  // 用共享读模式打开
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  const buf = Buffer.alloc(512);
  const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
  fs.closeSync(fd);
  const content = buf.slice(0, bytesRead).toString('utf8');
  console.log('lockfile内容:', content);

  // lockfile 格式: name:pid:port:protocol:password
  const parts = content.trim().split(':');
  console.log('\n解析结果:');
  console.log('  进程名:', parts[0]);
  console.log('  PID:   ', parts[1]);
  console.log('  端口:  ', parts[2]);
  console.log('  协议:  ', parts[3]);
  console.log('  Token: ', parts[4]);
} catch (e) {
  console.error('读取失败:', e.message);

  // 备选：用 Windows API 通过 child_process 复制再读
  const { execSync } = require('child_process');
  try {
    execSync(`cmd /c copy /Y "${path}" "%TEMP%\\lcu_lockfile.tmp"`);
    const tmp = process.env.TEMP + '\\lcu_lockfile.tmp';
    const content = fs.readFileSync(tmp, 'utf8');
    console.log('lockfile内容(copy):', content);
    fs.unlinkSync(tmp);
  } catch (e2) {
    console.error('备选方案失败:', e2.message);
  }
}
