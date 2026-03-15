const { execSync } = require('child_process');
const fs = require('fs');

// 查找 system.yaml - LCU 配置文件
const bases = [
  'D:\\WeGameApps\\英雄联盟\\LeagueClient',
  'D:\\WeGameApps\\英雄联盟',
];

for (const base of bases) {
  try {
    const files = fs.readdirSync(base);
    const interesting = files.filter(f =>
      /yaml|json|cfg|ini|config|system/i.test(f)
    );
    if (interesting.length) {
      console.log(`${base}:`);
      interesting.forEach(f => console.log('  ', f));
    }
  } catch {}
}

// 查找 LeagueClient 目录下所有子目录
console.log('\nLeagueClient 子目录:');
try {
  const entries = fs.readdirSync('D:\\WeGameApps\\英雄联盟\\LeagueClient', {withFileTypes: true});
  entries.forEach(e => {
    if (e.isDirectory()) console.log('  [DIR]', e.name);
    else if (e.size > 0 || true) console.log('  [FILE]', e.name, '(检查)');
  });
} catch(e) { console.error(e.message); }

// 查找 Config/system.yaml
const systemYaml = 'D:\\WeGameApps\\英雄联盟\\LeagueClient\\Config\\system.yaml';
if (fs.existsSync(systemYaml)) {
  console.log('\nsystem.yaml:');
  console.log(fs.readFileSync(systemYaml, 'utf8').slice(0, 500));
}
