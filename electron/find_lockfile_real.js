const fs = require('fs');
const { execSync } = require('child_process');

// 枚举常见 lockfile 位置
const candidates = [
  'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\Riot Client\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\TCLS\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\Launcher\\lockfile',
];

for (const p of candidates) {
  if (fs.existsSync(p)) {
    const stat = fs.statSync(p);
    const mtime = stat.mtime;
    const age = (Date.now() - mtime.getTime()) / 1000;
    console.log(`${p} | size=${stat.size} | age=${Math.round(age)}s`);
    if (stat.size > 0) {
      const content = fs.readFileSync(p, 'utf8');
      console.log('  内容:', content.trim());
    }
  }
}

// 也用 cmd dir /s 找所有 lockfile（深度搜索）
console.log('\n深度搜索中...');
try {
  const out = execSync('cmd /c dir /s /b "D:\\WeGameApps\\英雄联盟\\lockfile" 2>nul', {encoding:'utf8', timeout:5000});
  console.log(out.trim() || '未找到');
} catch(e) {
  console.log('搜索完成，无结果');
}
