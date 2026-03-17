const https = require('https');
const fs = require('fs');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function main() {
  const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
  const latest = versions[0];
  console.log('版本:', latest);

  // 获取羁绊数据
  const traitData = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${latest}/data/zh_CN/tft-trait.json`
  );
  const traits = Object.values(traitData.data);
  console.log(`共 ${traits.length} 个羁绊`);
  console.log('\n前5个:');
  traits.slice(0, 5).forEach(t => console.log(`  id=${t.id} | 名称=${t.name}`));

  // 保存羁绊映射
  const traitMap = {};
  traits.forEach(t => { traitMap[t.id.toLowerCase()] = { name: t.name, desc: t.description }; });
  fs.writeFileSync('traits_zh.json', JSON.stringify(traitMap, null, 2), 'utf8');

  // 获取物品数据
  const itemData = await fetchJson(
    `https://ddragon.leagueoflegends.com/cdn/${latest}/data/zh_CN/tft-item.json`
  );
  const items = Object.values(itemData.data);
  console.log(`\n共 ${items.length} 个物品`);

  const itemMap = {};
  items.forEach(i => { itemMap[i.id] = { name: i.name, desc: i.description, image: i.image?.full }; });
  fs.writeFileSync('items_zh.json', JSON.stringify(itemMap, null, 2), 'utf8');

  console.log('\n=== 测试羁绊映射 ===');
  ['TFT16_Demacia','TFT16_Bilgewater','TFT16_Ionia','TFT16_Noxus'].forEach(id => {
    const found = traitMap[id.toLowerCase()];
    console.log(`  ${id} => ${found ? found.name : '未找到'}`);
  });

  console.log('\n已保存 champions_zh.json / traits_zh.json / items_zh.json');
}

main().catch(e => console.error('❌', e.message));
