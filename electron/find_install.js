// 通过 QMLolAssist/icreateLol 进程路径推断LOL安装目录
const { execSync } = require('child_process');

function wmicCmdline(name) {
  try {
    const out = execSync(
      `wmic process where "name='${name}'" get ExecutablePath /format:list`,
      { encoding: 'buffer', timeout: 5000 }
    );
    // 转为 gbk -> utf8 via iconv or just latin1
    const str = out.toString('latin1');
    const match = str.match(/ExecutablePath=(.+)/);
    return match ? match[1].trim() : null;
  } catch { return null; }
}

const procs = [
  'QMLolAssist.exe',
  'icreateLol.exe',
  'LolAICoach.exe',
  'LeagueClient.exe',
  'LeagueClientUx.exe',
];

for (const p of procs) {
  const path = wmicCmdline(p);
  if (path) console.log(`${p} => ${path}`);
  else console.log(`${p} => (no path)`);
}

// 尝试读取所有盘的 Riot Games 目录
const fs = require('fs');
const drives = ['C:', 'D:', 'E:', 'F:', 'G:'];
const candidates = [
  'Riot Games/League of Legends/lockfile',
  'Riot Games/League of Legends/LeagueClient.exe',
  '英雄联盟/lockfile',
  'LOL/lockfile',
  'TGP/League of Legends/lockfile',
];

for (const d of drives) {
  for (const c of candidates) {
    const p = `${d}/${c}`;
    if (fs.existsSync(p)) {
      console.log(`\n找到: ${p}`);
      if (p.endsWith('lockfile')) {
        console.log('lockfile内容:', fs.readFileSync(p, 'utf8'));
      }
    }
  }
}
