/**
 * TFT 推荐引擎 - 基于 DataTFT 数据
 * 提供英雄出装和阵容推荐
 */
const fs = require('fs');
const path = require('path');
const { fetchRecommendation } = require('./datatft_api.js');

// 加载官方数据
const champData = JSON.parse(fs.readFileSync(path.join(__dirname, 'set16_champions.json'), 'utf8'));
const traitData = JSON.parse(fs.readFileSync(path.join(__dirname, 'set16_traits.json'), 'utf8'));
const itemData = JSON.parse(fs.readFileSync(path.join(__dirname, 'set16_items.json'), 'utf8'));

// 装备名称映射
const itemNames = {
  'TFT_Item_GuinsoosRageblade': '鬼索的狂暴之刃',
  'TFT_Item_GiantSlayer': '巨人杀手',
  'TFT_Item_Bloodthirster': '饮血剑',
  'TFT_Item_InfinityEdge': '无尽之刃',
  'TFT_Item_LastWhisper': '最后的轻语',
  'TFT_Item_Quicksilver': '水银',
  'TFT_Item_Deathblade': '死亡之刃',
  'TFT_Item_HandOfJustice': '正义之手',
  'TFT_Item_SpearOfShojin': '朔极之矛',
  'TFT_Item_StatikkShiv': '斯塔缇克电刃',
  'TFT_Item_NashorsTooth': '纳什之牙',
  'TFT_Item_RabadonsDeathcap': '灭世者的死亡之帽',
  'TFT_Item_JeweledGauntlet': '珠光护手',
  'TFT_Item_HextechGunblade': '海克斯科技枪刃',
  'TFT_Item_Morellonomicon': '莫雷洛秘典',
  'TFT_Item_ArchangelsStaff': '大天使之杖',
  'TFT_Item_BlueBuff': '蓝霸符',
  'TFT_Item_IonicSpark': '离子火花',
  'TFT_Item_WarmogsArmor': '狂徒铠甲',
  'TFT_Item_BrambleVest': '棘刺背心',
  'TFT_Item_DragonsClaw': '巨龙之爪',
  'TFT_Item_GargoylesStoneplate': '石像鬼石板甲',
  'TFT_Item_SunfireCape': '日炎斗篷',
  'TFT_Item_Redemption': '救赎',
  'TFT_Item_TitansResolve': '泰坦的坚决',
  'TFT_Item_SteraksGage': '斯特拉克的挑战护手',
  'TFT_Item_ThiefsGloves': '窃贼手套',
  'TFT_Item_FrozenHeart': '冰霜之心',
  'TFT_Item_RunaansHurricane': '卢安娜的飓风',
  'TFT_Item_GuardianAngel': '守护天使',
  'TFT_Item_RedBuff': '红霸符',
  'TFT_Item_ThievesGloves': '窃贼手套',
  'TFT_Item_Leviathan': '利维坦',
  'TFT_Item_UnstableConcoction': '不稳定炼金',
  'TFT_Item_SpectralGauntlet': '幽魂手套',
  'TFT_Item_NightHarvester': '暗夜收割者',
  'TFT_Item_PowerGauntlet': '能量护手',
  'TFT_Item_AdaptiveHelm': '适应性头盔',
  'TFT_Item_Crownguard': '皇冠守卫',
  'TFT_Item_ForceOfNature': '自然之力',
  'TFT_Item_MadredsBloodrazor': '麦瑞德裂血手套',
  'TFT16_Item_NoxusEmblemItem': '诺克萨斯纹章',
  'TFT16_Item_VanquisherEmblemItem': '征服者纹章',
  'TFT16_Item_SlayerEmblemItem': '屠龙勇士纹章',
  'TFT16_Item_JuggernautEmblemItem': '决斗大师纹章',
  'TFT16_Item_RapidfireEmblemItem': '速射纹章',
  'TFT16_Item_BrawlerEmblemItem': '格斗家纹章',
  'TFT16_Item_InvokerEmblemItem': '唤魔师纹章',
  'TFT16_Item_DefenderEmblemItem': '守护者纹章',
  'TFT16_Item_MagusEmblemItem': '法师纹章',
  'TFT16_Item_SorcererEmblemItem': '巫师纹章',
  'TFT16_Item_FreljordEmblemItem': '弗雷尔卓德纹章',
  'TFT16_Item_VoidEmblemItem': '虚空纹章',
  'TFT16_Item_IoniaEmblemItem': '艾欧尼亚纹章',
  'TFT16_Item_PiltoverEmblemItem': '皮尔特沃夫纹章',
  'TFT16_Item_ZaunEmblemItem': '祖安纹章',
  'TFT16_Item_DemaciaEmblemItem': '德玛西亚纹章',
  'TFT16_Item_YordleEmblemItem': '约德尔人纹章',
  'TFT16_Item_BilgewaterEmblemItem': '比尔吉沃特纹章',
  'TFT16_Item_IxtalEmblemItem': '以绪塔尔纹章',
  'TFT16_Item_GunslingerEmblemItem': '枪手纹章',
  'TFT16_Item_LongshotEmblemItem': '远射纹章',
  'TFT16_Item_WardenEmblemItem': '守卫纹章',
  'TFT_Item_BFSword': '暴风大剑',
  'TFT_Item_ChainVest': '锁子甲',
  'TFT_Item_GiantsBelt': '巨人腰带',
  'TFT_Item_NeedlesslyLargeRod': '无用大棒',
  'TFT_Item_NegatronCloak': '负极斗篷',
  'TFT_Item_RecurveBow': '反曲弓',
  'TFT_Item_SparringGloves': '格斗手套',
  'TFT_Item_TearOfTheGoddess': '女神之泪',
  'TFT_Item_Spatula': '铲子',
  'TFT_Item_TacticiansRing': '战术家戒指',
  'TFT_Item_TacticiansScepter': '战术家权杖',
  'TFT_Item_RapidFireCannon': '疾射火炮',
  'TFT_Item_FryingPan': '平底锅'
};

// 英雄定位
const championRoles = {
  // ADC/Carry
  'tft16_tristana': 'adc', 'tft16_jinx': 'adc', 'tft16_ashe': 'adc', 'tft16_varus': 'adc',
  'tft16_caitlyn': 'adc', 'tft16_aphelios': 'adc', 'tft16_samira': 'adc', 'tft16_kaisa': 'adc',
  'tft16_kalista': 'adc', 'tft16_kindred': 'adc', 'tft16_nidalee': 'adc', 'tft16_missfortune': 'adc',
  'tft16_vayne': 'adc', 'tft16_lucian': 'adc', 'tft16_yunara': 'adc', 'tft16_tristana': 'adc',

  // AP Carry
  'tft16_ahri': 'apc', 'tft16_lux': 'apc', 'tft16_malzahar': 'apc', 'tft16_ziggs': 'apc',
  'tft16_soraka': 'support', 'tft16_seraphine': 'apc', 'tft16_leblanc': 'apc', 'tft16_syndra': 'apc',
  'tft16_azir': 'apc', 'tft16_xerath': 'apc', 'tft16_zoe': 'apc', 'tft16_lissandra': 'apc',
  'tft16_neeko': 'apc', 'tft16_milio': 'support', 'tft16_annie': 'apc', 'tft16_vex': 'apc',
  'tft16_ryze': 'apc', 'tft16_mel': 'apc', 'tft16_zaahen': 'apc', 'tft16_fiddlesticks': 'apc',
  'tft16_zilean': 'support', 'tft16_bard': 'support', 'tft16_aurelionsol': 'apc',

  // 坦克
  'tft16_garen': 'tank', 'tft16_braum': 'tank', 'tft16_sett': 'tank', 'tft16_sejuani': 'tank',
  'tft16_ornn': 'tank', 'tft16_aatrox': 'tank', 'tft16_swain': 'tank', 'tft16_drmundo': 'tank',
  'tft16_tahmkench': 'tank', 'tft16_taric': 'tank', 'tft16_jarvaniv': 'tank', 'tft16_leona': 'tank',
  'tft16_wukong': 'tank', 'tft16_volibear': 'tank', 'tft16_shen': 'tank', 'tft16_poppy': 'tank',
  'tft16_kobuko': 'tank', 'tft16_galio': 'tank', 'tft16_thresh': 'tank', 'tft16_nautilus': 'tank',
  'tft16_sion': 'tank', 'tft16_brock': 'tank',

  // 战士
  'tft16_yone': 'fighter', 'tft16_yasuo': 'fighter', 'tft16_viego': 'fighter',
  'tft16_diana': 'fighter', 'tft16_akali': 'assassin', 'tft16_kayn': 'fighter',
  'tft16_gwen': 'fighter', 'tft16_ambessa': 'fighter', 'tft16_graves': 'fighter',
  'tft16_ekko': 'fighter', 'tft16_xinzhao': 'fighter', 'tft16_vi': 'fighter',
  'tft16_warwick': 'fighter', 'tft16_yorick': 'fighter', 'tft16_sylas': 'fighter',
  'tft16_shyvana': 'fighter', 'tft16_renekton': 'fighter', 'tft16_tryndamere': 'fighter',
  'tft16_darius': 'fighter', 'tft16_draven': 'fighter', 'tft16_fizz': 'assassin',
  'tft16_belveth': 'fighter', 'tft16_kennen': 'fighter', 'tft16_singed': 'fighter',
  'tft16_nasus': 'fighter', 'tft16_illaoi': 'fighter',

  // 特殊
  'tft16_briar': 'fighter', 'tft16_kobuko': 'tank', 'tft16_riftheld': 'tank',
  'tft16_annietibbers': 'tank', 'tft16_baronnashor': 'apc'
};

function getChampName(apiName) {
  const normalized = apiName.toLowerCase();
  const champ = champData[normalized];
  return champ ? champ.name : apiName.replace(/^TFT\d+_/, '');
}

function getTraitName(apiName) {
  if (!apiName) return '';

  // 尝试多种格式匹配
  const formats = [
    apiName.toLowerCase(),                          // tft16_freljord
    apiName.replace(/^Set\d+_/i, 'tft16_').toLowerCase(),  // Set16_Freljord -> tft16_freljord
    `tft16_${apiName.toLowerCase()}`,               // Freljord -> tft16_freljord
    apiName.toLowerCase().replace(/^tft\d+_/, ''),  // 去除前缀
  ];

  for (const fmt of formats) {
    const trait = traitData[fmt];
    if (trait) return trait.name;
  }

  // 未找到则返回清理后的名称
  return apiName.replace(/^TFT\d+_/i, '').replace(/^Set\d+_/i, '');
}

function getItemName(apiName) {
  return itemNames[apiName] || itemData[apiName]?.name || apiName.replace(/^TFT_Item_/, '').replace(/^TFT16_Item_/, '');
}

/**
 * 获取推荐数据（从 DataTFT API）
 */
async function getRecommendation(champId) {
  const normalized = champId.toLowerCase();
  const champ = champData[normalized];

  if (!champ) return null;

  const heroKey = champ.apiName || normalized;
  const heroName = champ.name;

  // 从 DataTFT 获取数据
  let dataTftData = null;
  try {
    dataTftData = await fetchRecommendation(heroKey, heroName);
  } catch (e) {
    console.error('DataTFT API 调用失败:', e.message);
  }

  // 构建推荐装备
  let recommendedItems = [];

  if (dataTftData && dataTftData.unitEquips && dataTftData.unitEquips.length > 0) {
    // 从 DataTFT 数据构建装备推荐
    recommendedItems = dataTftData.unitEquips
      .filter(item => item.top4 >= 35) // 过滤前四率 >= 35%
      .slice(0, 6) // 取前6个
      .map(item => ({
        id: item.key,
        name: getItemName(item.key),
        winRate: item.won,
        top4Rate: item.top4,
        avgPlace: item.place,
        count: item.count
      }));
  }

  // 如果 DataTFT 数据不足，使用默认推荐
  if (recommendedItems.length < 3) {
    recommendedItems = getDefaultItems(normalized);
  }

  // 构建推荐阵容
  let recommendedComps = [];

  if (dataTftData && dataTftData.traits && dataTftData.traits.length > 0) {
    // 从羁绊数据推断阵容
    const topTraits = dataTftData.traits
      .filter(t => t.top4 >= 50) // 前四率 >= 50%
      .slice(0, 5);

    recommendedComps = topTraits.map(trait => ({
      name: getTraitName(trait.key),
      tier: trait.tier,
      winRate: trait.won,
      top4Rate: trait.top4,
      avgPlace: trait.place,
      playRate: (trait.count / (dataTftData.base?.count || 1) * 100).toFixed(1)
    }));
  }

  // 获取英雄星级数据
  let starData = null;
  if (dataTftData && dataTftData.starUnits) {
    starData = dataTftData.starUnits.find(u => u.key.toLowerCase() === normalized);
  }

  // 处理出装组合（三神装）
  let buildCombinations = [];
  if (dataTftData && dataTftData.equipBuilds && dataTftData.equipBuilds.length > 0) {
    // 筛选3件装备的组合
    buildCombinations = dataTftData.equipBuilds
      .filter(b => b.key && b.key.length >= 2 && b.top4 >= 45)
      .slice(0, 6)
      .map(build => ({
        items: build.key.map(k => getItemName(k)),
        winRate: build.won,
        top4Rate: build.top4,
        avgPlace: build.place,
        count: build.count
      }));
  }

  // 处理相关弈子
  let relatedUnits = [];
  if (dataTftData && dataTftData.units && dataTftData.units.length > 0) {
    relatedUnits = dataTftData.units
      .filter(u => u.count >= 1000)
      .slice(0, 8)
      .map(u => ({
        id: u.key,
        name: getChampName(u.key),
        winRate: u.won,
        top4Rate: u.top4,
        avgPlace: u.place,
        starRate: u.rate3,
        count: u.count
      }));
  }

  // 处理羁绊数据
  let traitStats = [];
  if (dataTftData && dataTftData.traits && dataTftData.traits.length > 0) {
    traitStats = dataTftData.traits
      .filter(t => t.count >= 5000)
      .slice(0, 8)
      .map(t => ({
        name: getTraitName(t.key),
        tier: t.tier,
        winRate: t.won,
        top4Rate: t.top4,
        avgPlace: t.place,
        count: t.count
      }));
  }

  // 基础统计
  let baseStats = null;
  if (dataTftData && dataTftData.base) {
    baseStats = {
      totalGames: dataTftData.base.count,
      avgPlace: dataTftData.base.place,
      winRate: dataTftData.base.won,
      top4Rate: dataTftData.base.top4,
      avgLevel: dataTftData.base.level
    };
  }

  return {
    unitId: champ.apiName || normalized,
    unitName: champ.name,
    cost: champ.cost,
    traits: champ.traits || [],
    role: championRoles[normalized] || 'unknown',
    // 单件装备
    recommendedItems: recommendedItems,
    // 出装组合
    buildCombinations: buildCombinations,
    // 相关弈子
    relatedUnits: relatedUnits,
    // 羁绊统计
    traitStats: traitStats,
    // 兼容旧格式
    recommendedComps: traitStats.slice(0, 5),
    // 星级数据
    starData: starData,
    // 基础统计
    baseStats: baseStats,
    dataSource: 'DataTFT'
  };
}

/**
 * 获取默认装备推荐
 */
function getDefaultItems(champId) {
  const role = championRoles[champId];

  if (role === 'adc') {
    return [
      { id: 'TFT_Item_GuinsoosRageblade', name: '鬼索的狂暴之刃', type: 'attack_speed' },
      { id: 'TFT_Item_GiantSlayer', name: '巨人杀手', type: 'damage' },
      { id: 'TFT_Item_Bloodthirster', name: '饮血剑', type: 'lifesteal' }
    ];
  }

  if (role === 'apc') {
    return [
      { id: 'TFT_Item_BlueBuff', name: '蓝霸符', type: 'mana' },
      { id: 'TFT_Item_JeweledGauntlet', name: '珠光护手', type: 'ap_crit' },
      { id: 'TFT_Item_RabadonsDeathcap', name: '灭世者的死亡之帽', type: 'ap' }
    ];
  }

  if (role === 'tank') {
    return [
      { id: 'TFT_Item_WarmogsArmor', name: '狂徒铠甲', type: 'hp' },
      { id: 'TFT_Item_BrambleVest', name: '棘刺背心', type: 'armor' },
      { id: 'TFT_Item_DragonsClaw', name: '巨龙之爪', type: 'mr' }
    ];
  }

  if (role === 'fighter') {
    return [
      { id: 'TFT_Item_Bloodthirster', name: '饮血剑', type: 'lifesteal' },
      { id: 'TFT_Item_TitansResolve', name: '泰坦的坚决', type: 'hybrid_stacks' },
      { id: 'TFT_Item_SteraksGage', name: '斯特拉克的挑战护手', type: 'shield' }
    ];
  }

  if (role === 'assassin') {
    return [
      { id: 'TFT_Item_InfinityEdge', name: '无尽之刃', type: 'crit' },
      { id: 'TFT_Item_Bloodthirster', name: '饮血剑', type: 'lifesteal' },
      { id: 'TFT_Item_LastWhisper', name: '最后的轻语', type: 'armor_pen' }
    ];
  }

  return [
    { id: 'TFT_Item_GiantSlayer', name: '巨人杀手', type: 'damage' },
    { id: 'TFT_Item_Bloodthirster', name: '饮血剑', type: 'lifesteal' },
    { id: 'TFT_Item_GargoylesStoneplate', name: '石像鬼石板甲', type: 'tank' }
  ];
}

// 分析玩家历史对局（保留原有功能）
function analyzeGames(games, targetPuuid) {
  const unitStats = {};
  const compStats = {};

  for (const g of games) {
    const me = (g.participants || []).find(p => p.puuid === targetPuuid);
    if (!me) continue;
    const placement = me.placement || 9;
    const isTop4 = placement <= 4;

    for (const unit of (me.units || [])) {
      const uid = unit.character_id;
      if (!unitStats[uid]) unitStats[uid] = { games: 0, top4: 0, items: {} };
      unitStats[uid].games++;
      if (isTop4) unitStats[uid].top4++;

      for (const item of (unit.itemNames || [])) {
        if (!unitStats[uid].items[item]) unitStats[uid].items[item] = { count: 0, top4: 0 };
        unitStats[uid].items[item].count++;
        if (isTop4) unitStats[uid].items[item].top4++;
      }
    }

    const activeTraits = (me.traits || [])
      .filter(t => t.tier_current > 0)
      .map(t => `${t.name}(${t.num_units})`)
      .join('|');
    if (!compStats[activeTraits]) compStats[activeTraits] = { games: 0, top4: 0 };
    compStats[activeTraits].games++;
    if (isTop4) compStats[activeTraits].top4++;
  }

  return { unitStats, compStats };
}

module.exports = {
  analyzeGames,
  getRecommendation,
  getChampName,
  getTraitName,
  getItemName,
  getDefaultItems,
  championRoles,
  itemNames
};