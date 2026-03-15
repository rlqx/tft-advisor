/**
 * DataTFT API 客户端
 * 连接云顶大数据 (datatft.com) 获取英雄装备和阵容推荐
 */

const https = require('https');

const API_BASE = 'https://api.datatft.com';
const CURRENT_VERSION = '16.6';

/**
 * 发送 HTTPS 请求
 */
function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.datatft.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.datatft.com',
        'Referer': 'https://www.datatft.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * 获取英雄装备推荐
 * @param {string} heroKey - 英雄 TFT ID (如: TFT16_Briar)
 * @param {string} heroName - 英雄中文名
 * @param {string} tier - 段位 (diamond, platinum, gold, silver, bronze, all)
 * @param {number} time - 时间范围 (天数)
 */
async function getHeroEquipRecommendation(heroKey, heroName, tier = 'diamond', time = 5) {
  try {
    const body = {
      version: CURRENT_VERSION,
      time: time,
      tier: tier,
      advancedMode: false,
      filterOptions: [
        {
          id: Date.now(),
          name: heroName,
          key: heroKey,
          type: 'hero',
          levelValue: '任意',
          equipValue: '任意',
          carryHeroValue: '任意',
          switchVal: true,
          conditionVal: true
        }
      ]
    };

    const result = await request('/data/explore', 'POST', body);

    if (result.status === 200 && result.body && result.body.success) {
      return result.body.data;
    }

    return null;
  } catch (error) {
    console.error('DataTFT API 错误:', error.message);
    return null;
  }
}

/**
 * 获取英雄数据概览（无筛选条件）
 */
async function getHeroOverview(tier = 'diamond', time = 5) {
  try {
    const body = {
      version: CURRENT_VERSION,
      time: time,
      tier: tier,
      advancedMode: false,
      filterOptions: []
    };

    const result = await request('/data/explore', 'POST', body);

    if (result.status === 200 && result.body && result.body.success) {
      return result.body.data;
    }

    return null;
  } catch (error) {
    console.error('DataTFT API 错误:', error.message);
    return null;
  }
}

/**
 * 从 DataTFT 获取推荐数据并转换为应用格式
 */
async function fetchRecommendation(heroKey, heroName) {
  const data = await getHeroEquipRecommendation(heroKey, heroName);

  if (!data) return null;

  return {
    // 单件装备
    unitEquips: data.unitEquips || [],
    // 出装组合
    equipBuilds: data.equipBuilds || [],
    // 两件组合
    equipBuilds2: data.equipBuilds2 || [],
    // 羁绊
    traits: data.traits || [],
    // 相关弈子
    units: data.units || [],
    // 三星弈子
    starUnits: data.star_units || [],
    // 装备总览
    equips: data.equips || [],
    // 装备数量统计
    equipCounts: data.equipCounts || [],
    // 基础统计
    base: data.base || null
  };
}

module.exports = {
  request,
  getHeroEquipRecommendation,
  getHeroOverview,
  fetchRecommendation,
  CURRENT_VERSION
};

// 测试
if (require.main === module) {
  (async () => {
    console.log('=== 测试 DataTFT API ===\n');

    // 测试获取贝蕾亚数据
    const data = await getHeroEquipRecommendation('TFT16_Briar', '贝蕾亚');

    if (data) {
      console.log('✓ 成功获取数据');
      console.log(`  - 装备数据: ${data.unitEquips?.length || 0} 条`);
      console.log(`  - 出装推荐: ${data.equipBuilds?.length || 0} 条`);
      console.log(`  - 英雄数据: ${data.units?.length || 0} 条`);

      // 显示前5个装备推荐
      if (data.unitEquips && data.unitEquips.length > 0) {
        console.log('\n推荐装备 TOP 5:');
        data.unitEquips.slice(0, 5).forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.key} - 胜率: ${item.won}% 前四率: ${item.top4}%`);
        });
      }
    } else {
      console.log('✗ 获取数据失败');
    }
  })().catch(console.error);
}