const https = require('https');
const fs = require('fs');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function main() {
  // 1. 获取最新版本号
  console.log('获取版本列表...');
  const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
  const latest = versions[0];
  console.log('最新版本:', latest);

  // 2. 获取 TFT 英雄数据（中文）
  console.log('\n获取 TFT 英雄数据...');
  const url = `https://ddragon.leagueoflegends.com/cdn/${latest}/data/zh_CN/tft-champion.json`;
  const data = await fetchJson(url);

  const champions = Object.values(data.data);
  console.log(`共 ${champions.length} 个英雄`);
  console.log('\n前5个英雄:');
  champions.slice(0, 5).forEach(c => {
    console.log(`  id=${c.id} | 名称=${c.name} | 费用=${c.cost}`);
  });

  // 3. 保存到本地
  const mapped = {};
  champions.forEach(c => {
    mapped[c.id.toLowerCase()] = {
      name: c.name,
      cost: c.cost,
      traits: c.traits || [],
      image: c.image?.full,
    };
  });
  fs.writeFileSync('champions_zh.json', JSON.stringify(mapped, null, 2), 'utf8');
  console.log('\n已保存到 champions_zh.json');

  // 4. 测试映射
  console.log('\n=== 测试 TFT16 英雄映射 ===');
  const testIds = ['TFT16_JarvanIV', 'TFT16_Sona', 'TFT16_Poppy', 'TFT16_Gangplank'];
  testIds.forEach(id => {
    const key = id.toLowerCase();
    const found = mapped[key];
    if (found) {
      console.log(`  ${id} => ${found.name} (${found.cost}费)`);
    } else {
      console.log(`  ${id} => 未找到`);
    }
  });
}

main().catch(e => console.error('❌', e.message));
