#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWINDOWATTRIBUTE};

// 全局状态
struct AppState {
    lcu: Mutex<Option<LcuClient>>,
    champ_map: Mutex<serde_json::Value>,
    champ_aliases: Mutex<serde_json::Value>,
    trait_map: Mutex<serde_json::Value>,
}

#[derive(Clone, Serialize, Deserialize)]
struct LcuClient {
    port: String,
    password: String,
}

#[derive(Serialize)]
struct InitResult {
    ok: bool,
    games: i32,
    error: Option<String>,
}

#[derive(Serialize, Clone)]
struct ChampionInfo {
    id: String,
    name: String,
    cost: i32,
    aliases: Vec<String>,
}

// 获取 LCU 凭证
fn get_lcu_credentials() -> Option<LcuClient> {
    // 优先通过进程获取 LeagueClientUx 凭证（最可靠）
    if let Some(lcu) = find_lcu_from_process() {
        return Some(lcu);
    }

    // 尝试从 lockfile 读取（部分情况下可用）
    let lockfile_paths = [
        // LeagueClient 目录
        "D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile",
        "C:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile",
        // 国际服常见路径
        "C:\\Riot Games\\League of Legends\\lockfile",
        "D:\\Riot Games\\League of Legends\\lockfile",
        "E:\\Riot Games\\League of Legends\\lockfile",
        "C:\\Games\\League of Legends\\lockfile",
        "D:\\Games\\League of Legends\\lockfile",
        "E:\\Games\\League of Legends\\lockfile",
        // 国服（腾讯）常见路径
        "C:\\Program Files\\腾讯游戏\\英雄联盟\\lockfile",
        "D:\\Program Files\\腾讯游戏\\英雄联盟\\lockfile",
        "D:\\腾讯游戏\\英雄联盟\\lockfile",
        "E:\\腾讯游戏\\英雄联盟\\lockfile",
        "C:\\英雄联盟\\lockfile",
        "D:\\英雄联盟\\lockfile",
        "E:\\英雄联盟\\lockfile",
        // WeGame 启动路径
        "C:\\WeGame\\英雄联盟\\lockfile",
        "D:\\WeGame\\英雄联盟\\lockfile",
    ];

    for path in &lockfile_paths {
        if let Ok(content) = fs::read_to_string(path) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                let parts: Vec<&str> = trimmed.split(':').collect();
                if parts.len() >= 4 {
                    // 只接受 LeagueClient 的 lockfile，忽略 Riot Client
                    if parts[0] == "LeagueClient" || parts[0] == "LeagueClientUx" {
                        return Some(LcuClient {
                            port: parts[2].to_string(),
                            password: parts[3].to_string(),
                        });
                    }
                }
            }
        }
    }

    None
}

// 通过进程命令行查找 LCU 凭证
fn find_lcu_from_process() -> Option<LcuClient> {
    use std::process::Command;

    // 使用 PowerShell 查找 LeagueClientUx 进程的命令行参数
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-WmiObject Win32_Process -Filter 'Name=\"LeagueClientUx.exe\"' | Select-Object CommandLine | Format-List"
        ])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // 去掉换行和多余空格，合并为一行
    let clean_output: String = stdout.chars()
        .filter(|c| !c.is_whitespace())
        .collect();

    // 使用正则表达式提取参数
    let mut port: Option<String> = None;
    let mut password: Option<String> = None;

    // 查找 --app-port=数字
    if let Some(start) = clean_output.find("--app-port=") {
        let rest = &clean_output[start + 11..];
        let end = rest.find('"').unwrap_or(rest.len());
        let end = rest[..end].find(|c: char| !c.is_ascii_digit()).unwrap_or(end);
        if end > 0 {
            port = Some(rest[..end].to_string());
        }
    }

    // 查找 --remoting-auth-token=值
    if let Some(start) = clean_output.find("--remoting-auth-token=") {
        let rest = &clean_output[start + 22..];
        let end = rest.find('"').unwrap_or(rest.len());
        if end > 0 {
            password = Some(rest[..end].to_string());
        }
    }

    match (port, password) {
        (Some(p), Some(pwd)) => Some(LcuClient { port: p, password: pwd }),
        _ => None,
    }
}

// 获取数据目录
fn get_data_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    // 首先尝试资源目录
    if let Ok(mut path) = app.path().resource_dir() {
        path.push("data");
        if path.exists() {
            return Some(path);
        }
    }
    // 回退到 exe 所在目录
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let data_path = exe_dir.join("data");
            if data_path.exists() {
                return Some(data_path);
            }
        }
    }
    None
}

// 加载 JSON 文件
fn load_json(path: &PathBuf) -> serde_json::Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::json!({}))
}

// 获取弈子中文名
fn get_champion_name(api_name: &str) -> String {
    let champ_map: &[(&str, &str)] = &[
        // 1费
        ("TFT16_Tristana", "崔丝塔娜"), ("TFT16_Lulu", "璐璐"), ("TFT16_Teemo", "提莫"),
        ("TFT16_Rumble", "兰博"), ("TFT16_Garen", "盖伦"), ("TFT16_Kled", "克烈"),
        ("TFT16_Caitlyn", "凯特琳"), ("TFT16_Poppy", "波比"), ("TFT16_Malzahar", "玛尔扎哈"),
        ("TFT16_Taliyah", "岩雀"), ("TFT16_Cassiopeia", "卡西奥佩娅"), ("TFT16_Darius", "德莱厄斯"),
        ("TFT16_Swain", "斯维因"), ("TFT16_Zac", "扎克"), ("TFT16_Viego", "佛耶戈"),
        ("TFT16_Irelia", "艾瑞莉娅"), ("TFT16_Jhin", "烬"), ("TFT16_Ziggs", "吉格斯"),
        // 召唤物
        ("TFT16_Atakhan", "厄塔汗"), ("tft16_atakhan", "厄塔汗"),
        // 2费
        ("TFT16_JarvanIV", "嘉文四世"), ("TFT16_Sona", "娑娜"), ("TFT16_Ekko", "艾克"),
        ("TFT16_Zed", "劫"), ("TFT16_Kayle", "凯尔"), ("TFT16_Soraka", "索拉卡"),
        ("TFT16_Sett", "瑟提"), ("TFT16_Varus", "韦鲁斯"), ("TFT16_Quinn", "奎因"),
        ("TFT16_Ashe", "艾希"), ("TFT16_Kalista", "卡莉丝塔"), ("TFT16_Diana", "黛安娜"),
        ("TFT16_Yasuo", "亚索"), ("TFT16_Yone", "永恩"), ("TFT16_Vex", "薇古丝"),
        ("TFT16_Malphite", "墨菲特"), ("TFT16_Taric", "塔里克"), ("TFT16_Heimerdinger", "黑默丁格"),
        ("TFT16_Twitch", "图奇"), ("TFT16_Jinx", "金克丝"), ("TFT16_Samira", "莎弥拉"),
        // 3费
        ("TFT16_Aatrox", "亚托克斯"), ("TFT16_Kennen", "凯南"), ("TFT16_Shaco", "萨科"),
        ("TFT16_Katarina", "卡特琳娜"), ("TFT16_Akali", "阿卡丽"), ("TFT16_Shen", "慎"),
        ("TFT16_Lissandra", "丽桑卓"), ("TFT16_Lux", "拉克丝"), ("TFT16_Draven", "德莱文"),
        ("TFT16_Leona", "蕾欧娜"), ("TFT16_Darius", "德莱厄斯"), ("TFT16_Wukong", "悟空"),
        ("TFT16_Galio", "加里奥"), ("TFT16_Nautilus", "诺提勒斯"), ("TFT16_MissFortune", "厄运小姐"),
        ("TFT16_Gangplank", "普朗克"), ("TFT16_Fiora", "菲奥娜"), ("TFT16_Jayce", "杰斯"),
        // 4费
        ("TFT16_Aphelios", "厄斐琉斯"), ("TFT16_Jinx", "金克丝"), ("TFT16_Kaisa", "卡莎"),
        ("TFT16_Sevika", "塞薇卡"), ("TFT16_Mel", "梅尔"), ("TFT16_Viktor", "维克托"),
        ("TFT16_Orianna", "奥莉安娜"), ("TFT16_Syndra", "辛德拉"), ("TFT16_Azir", "阿兹尔"),
        ("TFT16_Renekton", "雷克顿"), ("TFT16_Nasus", "内瑟斯"), ("TFT16_JarvanIV", "嘉文四世"),
        ("TFT16_Leona", "蕾欧娜"), ("TFT16_Braum", "布隆"), ("TFT16_Taric", "塔里克"),
        ("TFT16_Thresh", "锤石"), ("TFT16_Nautilus", "诺提勒斯"), ("TFT16_Ornn", "奥恩"),
        ("TFT16_Sejuani", "瑟庄妮"), ("TFT16_Volibear", "沃利贝尔"), ("TFT16_Sion", "赛恩"),
        // 5费
        ("TFT16_Briar", "贝蕾亚"), ("TFT16_Kindred", "千珏"), ("TFT16_AurelionSol", "奥瑞利安·索尔"),
        ("TFT16_Xerath", "泽拉斯"), ("TFT16_Senna", "赛娜"), ("TFT16_Lucian", "卢锡安"),
        ("TFT16_Ryze", "瑞兹"), ("TFT16_Belveth", "卑尔维斯"), ("TFT16_Sylas", "塞拉斯"),
        ("TFT16_Aatrox", "亚托克斯"), ("TFT16_Kayn", "凯隐"), ("TFT16_Zac", "扎克"),
        ("TFT16_LeBlanc", "乐芙兰"), ("TFT16_Vex", "薇古丝"), ("TFT16_Neeko", "妮蔻"),
        ("TFT16_Zoe", "佐伊"), ("TFT16_Ahri", "阿狸"), ("TFT16_Seraphine", "萨勒芬妮"),
        ("TFT16_Annie", "安妮"), ("TFT16_Viego", "佛耶戈"), ("TFT16_Mordekaiser", "莫德凯撒"),
        ("TFT16_Corki", "库奇"), ("TFT16_Graves", "格雷福斯"), ("TFT16_Nidalee", "奈德丽"),
        ("TFT16_Quinn", "奎因"), ("TFT16_Vayne", "薇恩"), ("TFT16_Warwick", "沃里克"),
        ("TFT16_Tryndamere", "泰达米尔"), ("TFT16_Fiora", "菲奥娜"), ("TFT16_Yasuo", "亚索"),
        ("TFT16_Riven", "锐雯"), ("TFT16_Illaoi", "俄洛伊"), ("TFT16_Gwen", "格温"),
        ("TFT16_Elise", "伊莉丝"), ("TFT16_Singed", "辛吉德"), ("TFT16_Zyra", "婕拉"),
        ("TFT16_Lillia", "莉莉娅"), ("TFT16_Drmundo", "蒙多医生"), ("TFT16_Shen", "慎"),
        ("TFT16_Ashe", "艾希"), ("TFT16_Caitlyn", "凯特琳"), ("TFT16_Jhin", "烬"),
        ("TFT16_Jinx", "金克丝"), ("TFT16_Tristana", "崔丝塔娜"), ("TFT16_Lucian", "卢锡安"),
        ("TFT16_Twitch", "图奇"), ("TFT16_MissFortune", "厄运小姐"), ("TFT16_Samira", "莎弥拉"),
        ("TFT16_Varus", "韦鲁斯"), ("TFT16_Kalista", "卡莉丝塔"), ("TFT16_Ashe", "艾希"),
        // TFT17 弈子
        ("TFT17_Aatrox", "亚托克斯"), ("TFT17_Ahri", "阿狸"), ("TFT17_Akali", "阿卡丽"),
        ("TFT17_Annie", "安妮"), ("TFT17_Aphelios", "厄斐琉斯"), ("TFT17_Ashe", "艾希"),
        ("TFT17_Azir", "阿兹尔"), ("TFT17_Belveth", "卑尔维斯"), ("TFT17_Briar", "贝蕾亚"),
        ("TFT17_Caitlyn", "凯特琳"), ("TFT17_Darius", "德莱厄斯"), ("TFT17_Diana", "黛安娜"),
        ("TFT17_Draven", "德莱文"), ("TFT17_Ekko", "艾克"), ("TFT17_Fiora", "菲奥娜"),
        ("TFT17_Galio", "加里奥"), ("TFT17_Garen", "盖伦"), ("TFT17_Gwen", "格温"),
        ("TFT17_Hecarim", "赫卡里姆"), ("TFT17_Illaoi", "俄洛伊"), ("TFT17_Irelia", "艾瑞莉娅"),
        ("TFT17_JarvanIV", "嘉文四世"), ("TFT17_Jhin", "烬"), ("TFT17_Jinx", "金克丝"),
        ("TFT17_Kaisa", "卡莎"), ("TFT17_Kalista", "卡莉丝塔"), ("TFT17_Kayn", "凯隐"),
        ("TFT17_Kennen", "凯南"), ("TFT17_Kindred", "千珏"), ("TFT17_Kled", "克烈"),
        ("TFT17_Leona", "蕾欧娜"), ("TFT17_Lillia", "莉莉娅"), ("TFT17_Lissandra", "丽桑卓"),
        ("TFT17_Lucian", "卢锡安"), ("TFT17_Lulu", "璐璐"), ("TFT17_Lux", "拉克丝"),
        ("TFT17_Malzahar", "玛尔扎哈"), ("TFT17_MissFortune", "厄运小姐"), ("TFT17_Mordekaiser", "莫德凯撒"),
        ("TFT17_Nautilus", "诺提勒斯"), ("TFT17_Nasus", "内瑟斯"), ("TFT17_Neeko", "妮蔻"),
        ("TFT17_Nidalee", "奈德丽"), ("TFT17_Ornn", "奥恩"), ("TFT17_Poppy", "波比"),
        ("TFT17_Quinn", "奎因"), ("TFT17_Rakan", "洛"), ("TFT17_RekSai", "雷克塞"),
        ("TFT17_Renekton", "雷克顿"), ("TFT17_Riven", "锐雯"), ("TFT17_Rumble", "兰博"),
        ("TFT17_Ryze", "瑞兹"), ("TFT17_Samira", "莎弥拉"), ("TFT17_Senna", "赛娜"),
        ("TFT17_Seraphine", "萨勒芬妮"), ("TFT17_Sett", "瑟提"), ("TFT17_Shen", "慎"),
        ("TFT17_Shyvana", "希瓦娜"), ("TFT17_Singed", "辛吉德"), ("TFT17_Sion", "赛恩"),
        ("TFT17_Soraka", "索拉卡"), ("TFT17_Swain", "斯维因"), ("TFT17_Sylas", "塞拉斯"),
        ("TFT17_Syndra", "辛德拉"), ("TFT17_TahmKench", "塔姆"), ("TFT17_Taliyah", "岩雀"),
        ("TFT17_Taric", "塔里克"), ("TFT17_Teemo", "提莫"), ("TFT17_Thresh", "锤石"),
        ("TFT17_Tristana", "崔丝塔娜"), ("TFT17_Tryndamere", "泰达米尔"), ("TFT17_TwistedFate", "崔斯特"),
        ("TFT17_Twitch", "图奇"), ("TFT17_Udyr", "乌迪尔"), ("TFT17_Varus", "韦鲁斯"),
        ("TFT17_Vayne", "薇恩"), ("TFT17_Veigar", "维迦"), ("TFT17_Vex", "薇古丝"),
        ("TFT17_Vi", "蔚"), ("TFT17_Viego", "佛耶戈"), ("TFT17_Viktor", "维克托"),
        ("TFT17_Vladimir", "弗拉基米尔"), ("TFT17_Volibear", "沃利贝尔"), ("TFT17_Warwick", "沃里克"),
        ("TFT17_Wukong", "悟空"), ("TFT17_Xayah", "霞"), ("TFT17_Xerath", "泽拉斯"),
        ("TFT17_XinZhao", "赵信"), ("TFT17_Yasuo", "亚索"), ("TFT17_Yone", "永恩"),
        ("TFT17_Yorick", "约里克"), ("TFT17_Yuumi", "悠米"), ("TFT17_Zac", "扎克"),
        ("TFT17_Zed", "劫"), ("TFT17_Ziggs", "吉格斯"), ("TFT17_Zoe", "佐伊"),
        ("TFT17_Zyra", "婕拉"),
    ];

    for (key, name) in champ_map {
        if api_name == *key || api_name.to_uppercase() == key.to_uppercase() {
            return name.to_string();
        }
    }

    // 移除前缀作为回退
    api_name
        .strip_prefix("TFT16_")
        .or_else(|| api_name.strip_prefix("TFT17_"))
        .or_else(|| api_name.strip_prefix("tft16_"))
        .or_else(|| api_name.strip_prefix("tft17_"))
        .unwrap_or(api_name)
        .to_string()
}

// 获取羁绊中文名
fn get_trait_name(api_name: &str) -> String {
    let trait_map: &[(&str, &str)] = &[
        // TFT16 基础羁绊
        ("TFT16_Demacia", "德玛西亚"), ("TFT16_Ionia", "艾欧尼亚"), ("TFT16_Void", "虚空"),
        ("TFT16_Freljord", "弗雷尔卓德"), ("TFT16_Juggernaut", "主宰"), ("TFT16_Rapidfire", "迅击战士"),
        ("TFT16_Longshot", "狙神"), ("TFT16_Vanquisher", "征服者"), ("TFT16_Slayer", "裁决战士"),
        ("TFT16_Sorcerer", "法师"), ("TFT16_Magus", "耀光使"), ("TFT16_Gunslinger", "枪手"),
        ("TFT16_Brawler", "斗士"), ("TFT16_Warden", "神盾使"), ("TFT16_Defender", "护卫"),
        ("TFT16_Invoker", "神谕者"), ("TFT16_Piltover", "皮尔特沃夫"), ("TFT16_Noxus", "诺克萨斯"),
        ("TFT16_Bilgewater", "比尔吉沃特"), ("TFT16_Yordle", "约德尔人"), ("TFT16_Zaun", "祖安"),
        ("TFT16_Targon", "巨神峰"), ("TFT16_Shurima", "恕瑞玛"), ("TFT16_ShadowIsles", "暗影岛"),
        // TFT16 特殊羁绊
        ("TFT16_Emperor", "沙漠皇帝"), ("TFT16_Blacksmith", "山隐之焰"), ("TFT16_TheBoss", "腕豪"),
        ("TFT16_Glutton", "河流之王"), ("TFT16_Caretaker", "星界游神"), ("TFT16_Explorer", "以绪塔尔"),
        ("TFT16_Harvester", "远古恐惧"), ("TFT16_DarkChild", "黑暗之女"), ("TFT16_DarkinWeapon", "暗裔"),
        ("TFT16_RuneMage", "符文法师"), ("TFT16_Heroic", "正义巨像"), ("TFT16_Huntress", "狂野女猎手"),
        ("TFT16_HexMech", "海克斯机甲"), ("TFT16_Chronokeeper", "时光守护者"),
        ("TFT16_Soulbound", "系魂圣枪"), ("TFT16_ZaahenTrait", "不落魔锋"),
        // TFT16 独特羁绊
        ("TFT16_XerathUnique", "远古巫灵"), ("TFT16_AurelionSolUnique", "铸星龙王"),
        ("TFT16_ShyvanaUnique", "龙血武姬"), ("TFT16_SylasTrait", "解脱者"),
        ("TFT16_KindredUnique", "永猎双子"), ("TFT16_KaisaUnique", "虚空之女"),
        ("TFT16_AatroxUnique", "暗裔剑魔"), ("TFT16_BaronUnique", "纳什男爵"),
        // TFT16 组合羁绊
        ("TFT16_Teamup_SingedTeemo", "绝命毒师"), ("TFT16_Teamup_EkkoZilean", "时间旅者"),
        ("TFT16_Teamup_JarvanShyvana", "巨龙卫士"), ("TFT16_Teamup_AmbessaKindred", "与狼共舞"),
        ("TFT16_Teamup_LucianVayne", "光明哨兵"),
        // TFT17 羁绊
        ("TFT17_Ghost", "幽灵"), ("TFT17_Inkshadow", "墨影"), ("TFT17_Reaper", "死神"),
        ("TFT17_Bruiser", "斗士"), ("TFT17_Dryad", "森灵"), ("TFT17_Duelist", "决斗大师"),
        ("TFT17_Fated", "灵魂莲华"), ("TFT17_Heavenly", "天将"), ("TFT17_Invoker", "法师"),
        ("TFT17_Mythic", "山海绘卷"), ("TFT17_Porcelain", "青花瓷"), ("TFT17_Sage", "贤者"),
        ("TFT17_Sniper", "狙神"), ("TFT17_Storyweaver", "剪纸仙灵"), ("TFT17_Arcanist", "术士"),
        ("TFT17_Altruist", "护卫"), ("TFT17_Behemoth", "擎天卫"), ("TFT17_Dragonlord", "龙王"),
        ("TFT17_Hunter", "猎人"), ("TFT17_Mystic", "秘术师"), ("TFT17_Warden", "守护者"),
    ];

    let api_upper = api_name.to_uppercase();
    for (key, name) in trait_map {
        if api_upper.contains(&key.to_uppercase()) || api_upper == key.to_uppercase() {
            return name.to_string();
        }
    }

    // 移除前缀作为回退
    api_name
        .strip_prefix("TFT16_")
        .or_else(|| api_name.strip_prefix("TFT17_"))
        .or_else(|| api_name.strip_prefix("tft16_"))
        .or_else(|| api_name.strip_prefix("tft17_"))
        .or_else(|| api_name.strip_prefix("TFT14_"))
        .unwrap_or(api_name)
        .to_string()
}

#[tauri::command]
async fn init(app: tauri::AppHandle) -> InitResult {
    let data_dir = match get_data_dir(&app) {
        Some(d) => d,
        None => {
            return InitResult {
                ok: false,
                games: 0,
                error: Some("无法找到数据目录".to_string()),
            }
        }
    };

    // 加载数据文件
    let champ_map_path = data_dir.join("champion.json");
    let alias_path = data_dir.join("champion_aliases.json");

    let state = app.state::<AppState>();

    // 加载英雄数据
    if champ_map_path.exists() {
        let champ_map = load_json(&champ_map_path);
        *state.champ_map.lock().unwrap() = champ_map;
    }

    // 加载别名数据
    if alias_path.exists() {
        let aliases = load_json(&alias_path);
        *state.champ_aliases.lock().unwrap() = aliases;
    }

    // 连接 LCU
    match get_lcu_credentials() {
        Some(lcu) => {
            *state.lcu.lock().unwrap() = Some(lcu.clone());

            // 获取历史对局数
            match get_match_count(&lcu).await {
                Ok(count) => InitResult {
                    ok: true,
                    games: count,
                    error: None,
                },
                Err(_) => InitResult {
                    ok: true,
                    games: 0,
                    error: None,
                },
            }
        }
        None => InitResult {
            ok: false,
            games: 0,
            error: Some("未检测到 LOL 客户端".to_string()),
        },
    }
}

async fn get_match_count(lcu: &LcuClient) -> Result<i32, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    // 先获取当前召唤师信息得到 puuid
    let summoner_url = format!("https://127.0.0.1:{}/lol-summoner/v1/current-summoner", lcu.port);
    let summoner_response = client
        .get(&summoner_url)
        .basic_auth("riot", Some(&lcu.password))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !summoner_response.status().is_success() {
        return Err("获取召唤师信息失败".to_string());
    }

    let summoner: serde_json::Value = summoner_response.json().await.map_err(|e| e.to_string())?;
    let puuid = summoner["puuid"].as_str().ok_or("无法获取 puuid")?;

    // 用 puuid 获取 TFT 对局历史
    let history_url = format!(
        "https://127.0.0.1:{}/lol-match-history/v1/products/tft/{}/matches",
        lcu.port, puuid
    );
    let history_response = client
        .get(&history_url)
        .basic_auth("riot", Some(&lcu.password))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if history_response.status().is_success() {
        let json: serde_json::Value = history_response.json().await.map_err(|e| e.to_string())?;
        // 计算对局数量
        let games = if let Some(games_array) = json["games"].as_array() {
            games_array.len() as i32
        } else {
            json["games"]["gameCount"].as_i64().unwrap_or(0) as i32
        };
        Ok(games)
    } else {
        Err("获取失败".to_string())
    }
}

#[tauri::command]
async fn get_champion_list(app: tauri::AppHandle) -> Vec<ChampionInfo> {
    let state = app.state::<AppState>();
    let champ_map = state.champ_map.lock().unwrap().clone();
    let alias_map = state.champ_aliases.lock().unwrap()["外号映射"].clone();

    let mut champions = Vec::new();

    if let Some(obj) = champ_map.as_object() {
        for (id, data) in obj {
            if id.starts_with("tft16") || id.starts_with("tft17") || id.starts_with("TFT16") || id.starts_with("TFT17") {
                let name = data["name"].as_str().unwrap_or("").to_string();
                let cost = data["cost"].as_i64().unwrap_or(1) as i32;

                champions.push(ChampionInfo {
                    id: id.clone(),
                    name: name.clone(),
                    cost,
                    aliases: Vec::new(),
                });
            }
        }
    }

    // 添加别名（优先常用中文外号）
    if let Some(alias_obj) = alias_map.as_object() {
        // 常用外号优先列表
        let priority_aliases = [
            "皇子", "瞎子", "盲僧", "VN", "vn", "EZ", "ez", "小炮", "提莫", "蘑菇",
            "德玛", "盖伦", "剑圣", "JS", "js", "蛮王", "蛮子", "女剑", "剑姬",
            "光头", "流浪", "奶妈", "琴女", "露露", "牛头", "老牛", "日女",
            "石头人", "木木", "狼人", "努努", "雪人", "火男", "火女", "小鱼",
            "亚索", "快乐风男", "永恩", "千珏", "奥巴马", "卢锡安", "滑板鞋",
            "女枪", "男枪", "瑞文", "光头", "死歌", "冰鸟", "乌鸦", "蜘蛛",
            "豹女", "妖姬", "卡牌", "小鱼人", "泰坦", "锤石", "机器", "日女",
            "扇子妈", "轮子妈", "女坦", "布隆", "牛头", "风女", "娜美", "琴女",
            "露露", "莫甘娜", "拉克丝", "光辉", "泽拉斯", "维迦", "小法", "卡萨丁",
        ];

        for champ in &mut champions {
            let mut priority = Vec::new();
            let mut chinese_aliases = Vec::new();
            let mut other_aliases = Vec::new();
            for (alias, standard_name) in alias_obj {
                if standard_name.as_str() == Some(&champ.name) && alias != &champ.name {
                    // 判断是否为优先别名
                    if priority_aliases.contains(&alias.as_str()) {
                        priority.push(alias.clone());
                    } else if alias.chars().any(|c| c >= '\u{4e00}' && c <= '\u{9fff}') {
                        chinese_aliases.push(alias.clone());
                    } else {
                        other_aliases.push(alias.clone());
                    }
                }
            }
            // 优先别名排最前，然后是其他中文，最后是英文
            chinese_aliases.sort_by(|a, b| a.len().cmp(&b.len()));
            other_aliases.sort_by(|a, b| a.len().cmp(&b.len()));
            champ.aliases = priority;
            champ.aliases.extend(chinese_aliases);
            champ.aliases.extend(other_aliases);
        }
    }

    champions.sort_by(|a, b| a.cost.cmp(&b.cost).then_with(|| a.name.cmp(&b.name)));
    champions
}

#[tauri::command]
async fn recommend(query: String, app: tauri::AppHandle) -> Option<serde_json::Value> {
    let state = app.state::<AppState>();
    let champ_map = state.champ_map.lock().unwrap().clone();
    let alias_map = state.champ_aliases.lock().unwrap()["外号映射"].clone();

    let query = query.trim().to_lowercase();

    // 辅助函数：根据英雄名称查找 (apiName, name, cost)
    let find_hero_info = |name: &str| -> Option<(String, String, i32)> {
        if let Some(obj) = champ_map.as_object() {
            for (_id, data) in obj {
                if let Some(n) = data["name"].as_str() {
                    if n.to_lowercase() == name.to_lowercase() {
                        if let Some(api_name) = data["apiName"].as_str() {
                            let cost = data["cost"].as_i64().unwrap_or(1) as i32;
                            return Some((api_name.to_string(), n.to_string(), cost));
                        }
                    }
                }
            }
        }
        None
    };

    // 1. 先从别名映射查找英雄中文名称
    let resolved_name = if let Some(alias_obj) = alias_map.as_object() {
        alias_obj
            .get(&query)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    } else {
        None
    };

    // 2. 根据中文名称查找 (apiName, name, cost)
    if let Some(name) = resolved_name {
        if let Some((api_name, hero_name, cost)) = find_hero_info(&name) {
            return fetch_recommendation(&api_name, &hero_name, cost).await;
        }
    }

    // 3. 直接在 champ_map 中精确匹配名称
    if let Some(obj) = champ_map.as_object() {
        for (_id, data) in obj {
            if let Some(name) = data["name"].as_str() {
                if name.to_lowercase() == query {
                    if let Some(api_name) = data["apiName"].as_str() {
                        let cost = data["cost"].as_i64().unwrap_or(1) as i32;
                        return fetch_recommendation(api_name, name, cost).await;
                    }
                }
            }
        }
    }

    // 4. 部分匹配
    if let Some(obj) = champ_map.as_object() {
        for (_id, data) in obj {
            if let Some(name) = data["name"].as_str() {
                if name.to_lowercase().contains(&query) || query.contains(&name.to_lowercase()) {
                    if let Some(api_name) = data["apiName"].as_str() {
                        let cost = data["cost"].as_i64().unwrap_or(1) as i32;
                        return fetch_recommendation(api_name, name, cost).await;
                    }
                }
            }
        }
    }

    None
}

async fn fetch_recommendation(unit_id: &str, unit_name: &str, cost: i32) -> Option<serde_json::Value> {
    let url = "https://api.datatft.com/data/explore";

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let body = serde_json::json!({
        "version": "16.6",
        "time": 5,
        "tier": "diamond",
        "advancedMode": false,
        "filterOptions": [
            {
                "id": timestamp,
                "name": unit_name,
                "key": unit_id,
                "type": "hero",
                "levelValue": "任意",
                "equipValue": "任意",
                "carryHeroValue": "任意",
                "switchVal": true,
                "conditionVal": true
            }
        ]
    });

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("Origin", "https://www.datatft.com")
        .header("Referer", "https://www.datatft.com/")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .json(&body)
        .send()
        .await
        .ok()?;

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.ok()?;
        if json["success"].as_bool().unwrap_or(false) {
            let data = &json["data"];
            let result = transform_recommendation_data(data, unit_id, unit_name, cost);
            // 如果装备数量足够，返回结果
            if let Some(items) = result["recommendedItems"].as_array() {
                if items.len() >= 3 {
                    return Some(result);
                }
            }
        }
    }

    // API 失败或数据不足，返回默认推荐
    Some(get_default_recommendation(unit_id, unit_name, cost))
}

fn transform_recommendation_data(data: &serde_json::Value, unit_id: &str, unit_name: &str, cost: i32) -> serde_json::Value {
    // 装备名称映射
    let item_names: std::collections::HashMap<&str, &str> = [
        // 合成装备
        ("TFT_Item_GuinsoosRageblade", "鬼索的狂暴之刃"),
        ("TFT_Item_GiantSlayer", "巨人杀手"),
        ("TFT_Item_Bloodthirster", "饮血剑"),
        ("TFT_Item_InfinityEdge", "无尽之刃"),
        ("TFT_Item_LastWhisper", "最后的轻语"),
        ("TFT_Item_Quicksilver", "水银"),
        ("TFT_Item_Deathblade", "死亡之刃"),
        ("TFT_Item_HandOfJustice", "正义之手"),
        ("TFT_Item_SpearOfShojin", "朔极之矛"),
        ("TFT_Item_StatikkShiv", "斯塔缇克电刃"),
        ("TFT_Item_NashorsTooth", "纳什之牙"),
        ("TFT_Item_RabadonsDeathcap", "灭世者的死亡之帽"),
        ("TFT_Item_JeweledGauntlet", "珠光护手"),
        ("TFT_Item_HextechGunblade", "海克斯科技枪刃"),
        ("TFT_Item_Morellonomicon", "莫雷洛秘典"),
        ("TFT_Item_ArchangelsStaff", "大天使之杖"),
        ("TFT_Item_BlueBuff", "蓝霸符"),
        ("TFT_Item_IonicSpark", "离子火花"),
        ("TFT_Item_WarmogsArmor", "狂徒铠甲"),
        ("TFT_Item_BrambleVest", "棘刺背心"),
        ("TFT_Item_DragonsClaw", "巨龙之爪"),
        ("TFT_Item_GargoylesStoneplate", "石像鬼石板甲"),
        ("TFT_Item_SunfireCape", "日炎斗篷"),
        ("TFT_Item_Redemption", "救赎"),
        ("TFT_Item_TitansResolve", "泰坦的坚决"),
        ("TFT_Item_SteraksGage", "斯特拉克的挑战护手"),
        ("TFT_Item_ThiefsGloves", "窃贼手套"),
        ("TFT_Item_ThievesGloves", "窃贼手套"),
        ("TFT_Item_FrozenHeart", "冰霜之心"),
        ("TFT_Item_RunaansHurricane", "卢安娜的飓风"),
        ("TFT_Item_RedBuff", "红霸符"),
        ("TFT_Item_AdaptiveHelm", "适应性头盔"),
        ("TFT_Item_Crownguard", "皇冠守卫"),
        ("TFT_Item_RapidFireCannon", "疾射火炮"),
        ("TFT_Item_GuardianAngel", "守护天使"),
        ("TFT_Item_ForceOfNature", "自然之力"),
        ("TFT_Item_ZekesHerald", "基克的先驱"),
        ("TFT_Item_LocketOfTheIronSolari", "钢铁烈阳之匣"),
        ("TFT_Item_ChaliceOfPower", "能量圣杯"),
        ("TFT_Item_ZzRotPortal", "兹若特传送门"),
        ("TFT_Item_BansheesClaw", "女妖爪"),
        ("TFT_Item_FunnelConcoction", "漏斗混合物"),
        ("TFT_Item_MogulsMail", "大亨之铠"),
        ("TFT_Item_DjinnsTailswipe", "巨神峰之矛"),
        ("TFT_Item_RecruiterBanner", "招募旗帜"),
        // 特殊装备
        ("TFT_Item_Leviathan", "利维坦"),
        ("TFT_Item_UnstableConcoction", "不稳定炼金"),
        ("TFT_Item_SpectralGauntlet", "幽魂手套"),
        ("TFT_Item_NightHarvester", "暗夜收割者"),
        ("TFT_Item_PowerGauntlet", "能量护手"),
        ("TFT_Item_MadredsBloodrazor", "麦瑞德裂血手套"),
        ("TFT_Item_FryingPan", "平底锅"),
        // 基础装备
        ("TFT_Item_BFSword", "暴风大剑"),
        ("TFT_Item_ChainVest", "锁子甲"),
        ("TFT_Item_GiantsBelt", "巨人腰带"),
        ("TFT_Item_NeedlesslyLargeRod", "无用大棒"),
        ("TFT_Item_NegatronCloak", "负极斗篷"),
        ("TFT_Item_RecurveBow", "反曲弓"),
        ("TFT_Item_SparringGloves", "格斗手套"),
        ("TFT_Item_TearOfTheGoddess", "女神之泪"),
        ("TFT_Item_Spatula", "铲子"),
        ("TFT_Item_TacticiansRing", "战术家戒指"),
        ("TFT_Item_TacticiansScepter", "战术家权杖"),
        // TFT16 纹章
        ("TFT16_Item_NoxusEmblemItem", "诺克萨斯纹章"),
        ("TFT16_Item_VanquisherEmblemItem", "征服者纹章"),
        ("TFT16_Item_SlayerEmblemItem", "屠龙勇士纹章"),
        ("TFT16_Item_JuggernautEmblemItem", "决斗大师纹章"),
        ("TFT16_Item_RapidfireEmblemItem", "速射纹章"),
        ("TFT16_Item_BrawlerEmblemItem", "格斗家纹章"),
        ("TFT16_Item_InvokerEmblemItem", "唤魔师纹章"),
        ("TFT16_Item_DefenderEmblemItem", "守护者纹章"),
        ("TFT16_Item_MagusEmblemItem", "法师纹章"),
        ("TFT16_Item_SorcererEmblemItem", "巫师纹章"),
        ("TFT16_Item_FreljordEmblemItem", "弗雷尔卓德纹章"),
        ("TFT16_Item_VoidEmblemItem", "虚空纹章"),
        ("TFT16_Item_IoniaEmblemItem", "艾欧尼亚纹章"),
        ("TFT16_Item_PiltoverEmblemItem", "皮尔特沃夫纹章"),
        ("TFT16_Item_ZaunEmblemItem", "祖安纹章"),
        ("TFT16_Item_DemaciaEmblemItem", "德玛西亚纹章"),
        ("TFT16_Item_YordleEmblemItem", "约德尔人纹章"),
        ("TFT16_Item_BilgewaterEmblemItem", "比尔吉沃特纹章"),
        ("TFT16_Item_IxtalEmblemItem", "以绪塔尔纹章"),
        ("TFT16_Item_GunslingerEmblemItem", "枪手纹章"),
        ("TFT16_Item_LongshotEmblemItem", "远射纹章"),
        ("TFT16_Item_WardenEmblemItem", "守卫纹章"),
    ].iter().cloned().collect();

    // 处理推荐装备
    let recommended_items = if let Some(equips) = data["unitEquips"].as_array() {
        equips.iter()
            .filter(|item| item["top4"].as_f64().unwrap_or(0.0) >= 35.0)
            .take(6)
            .map(|item| {
                let key = item["key"].as_str().unwrap_or("");
                let name = item_names.get(key).unwrap_or(&key).to_string();
                serde_json::json!({
                    "id": key,
                    "name": name,
                    "top4Rate": item["top4"].as_f64().unwrap_or(0.0) as i32,
                    "winRate": item["won"].as_f64().unwrap_or(0.0) as i32,
                    "count": item["count"].as_i64().unwrap_or(0)
                })
            })
            .collect::<Vec<_>>()
    } else {
        vec![]
    };

    // 处理出装组合
    let build_combinations = if let Some(builds) = data["equipBuilds"].as_array() {
        builds.iter()
            .filter(|b| b["top4"].as_f64().unwrap_or(0.0) >= 45.0)
            .take(6)
            .map(|build| {
                let items = if let Some(keys) = build["key"].as_array() {
                    keys.iter()
                        .map(|k| {
                            let key = k.as_str().unwrap_or("");
                            item_names.get(key).unwrap_or(&key).to_string()
                        })
                        .collect::<Vec<_>>()
                } else {
                    vec![]
                };
                serde_json::json!({
                    "items": items,
                    "top4Rate": build["top4"].as_f64().unwrap_or(0.0) as i32,
                    "winRate": build["won"].as_f64().unwrap_or(0.0) as i32,
                    "count": build["count"].as_i64().unwrap_or(0)
                })
            })
            .collect::<Vec<_>>()
    } else {
        vec![]
    };

    // 处理相关弈子
    let related_units = if let Some(units) = data["units"].as_array() {
        units.iter()
            .filter(|u| u["count"].as_i64().unwrap_or(0) >= 1000)
            .take(8)
            .map(|u| {
                let key = u["key"].as_str().unwrap_or("");
                let name = get_champion_name(key);
                serde_json::json!({
                    "id": key,
                    "name": name,
                    "top4Rate": u["top4"].as_f64().unwrap_or(0.0) as i32,
                    "starRate": u["rate3"].as_f64().unwrap_or(0.0) as i32
                })
            })
            .collect::<Vec<_>>()
    } else {
        vec![]
    };

    // 处理羁绊统计
    let trait_stats = if let Some(traits) = data["traits"].as_array() {
        traits.iter()
            .filter(|t| t["count"].as_i64().unwrap_or(0) >= 5000)
            .take(8)
            .map(|t| {
                let key = t["key"].as_str().unwrap_or("");
                let name = get_trait_name(key);
                serde_json::json!({
                    "name": name,
                    "tier": t["tier"].as_i64().unwrap_or(0),
                    "top4Rate": t["top4"].as_f64().unwrap_or(0.0) as i32,
                    "winRate": t["won"].as_f64().unwrap_or(0.0) as i32
                })
            })
            .collect::<Vec<_>>()
    } else {
        vec![]
    };

    // 基础统计
    let base_stats = if !data["base"].is_null() {
        Some(serde_json::json!({
            "totalGames": data["base"]["count"].as_i64().unwrap_or(0),
            "avgPlace": data["base"]["place"].as_f64().unwrap_or(0.0),
            "winRate": data["base"]["won"].as_f64().unwrap_or(0.0) as i32,
            "top4Rate": data["base"]["top4"].as_f64().unwrap_or(0.0) as i32
        }))
    } else {
        None
    };

    serde_json::json!({
        "unitId": unit_id,
        "unitName": unit_name,
        "cost": cost,
        "recommendedItems": recommended_items,
        "buildCombinations": build_combinations,
        "relatedUnits": related_units,
        "traitStats": trait_stats,
        "baseStats": base_stats,
        "traits": []
    })
}

// 根据英雄定位获取默认装备推荐
fn get_default_recommendation(unit_id: &str, unit_name: &str, cost: i32) -> serde_json::Value {
    let id_lower = unit_id.to_lowercase();

    // 判断英雄定位
    let role = if id_lower.contains("tristana") || id_lower.contains("jinx") || id_lower.contains("ashe")
        || id_lower.contains("varus") || id_lower.contains("caitlyn") || id_lower.contains("aphelios")
        || id_lower.contains("samira") || id_lower.contains("kaisa") || id_lower.contains("kalista")
        || id_lower.contains("kindred") || id_lower.contains("nidalee") || id_lower.contains("missfortune")
        || id_lower.contains("vayne") || id_lower.contains("lucian") || id_lower.contains("tristana") {
        "adc"
    } else if id_lower.contains("ahri") || id_lower.contains("lux") || id_lower.contains("malzahar")
        || id_lower.contains("ziggs") || id_lower.contains("leblanc") || id_lower.contains("syndra")
        || id_lower.contains("azir") || id_lower.contains("xerath") || id_lower.contains("zoe")
        || id_lower.contains("lissandra") || id_lower.contains("neeko") || id_lower.contains("annie")
        || id_lower.contains("vex") || id_lower.contains("ryze") || id_lower.contains("aurelionsol") {
        "apc"
    } else if id_lower.contains("garen") || id_lower.contains("braum") || id_lower.contains("sett")
        || id_lower.contains("sejuani") || id_lower.contains("ornn") || id_lower.contains("aatrox")
        || id_lower.contains("swain") || id_lower.contains("drmundo") || id_lower.contains("tahmkench")
        || id_lower.contains("taric") || id_lower.contains("jarvaniv") || id_lower.contains("leona")
        || id_lower.contains("wukong") || id_lower.contains("volibear") || id_lower.contains("shen")
        || id_lower.contains("poppy") || id_lower.contains("galio") || id_lower.contains("thresh")
        || id_lower.contains("nautilus") || id_lower.contains("sion") {
        "tank"
    } else if id_lower.contains("yone") || id_lower.contains("yasuo") || id_lower.contains("viego")
        || id_lower.contains("diana") || id_lower.contains("gwen") || id_lower.contains("graves")
        || id_lower.contains("ekko") || id_lower.contains("xinzhao") || id_lower.contains("vi")
        || id_lower.contains("warwick") || id_lower.contains("yorick") || id_lower.contains("sylas")
        || id_lower.contains("shyvana") || id_lower.contains("renekton") || id_lower.contains("tryndamere")
        || id_lower.contains("darius") || id_lower.contains("draven") || id_lower.contains("belveth")
        || id_lower.contains("kennen") || id_lower.contains("singed") || id_lower.contains("nasus")
        || id_lower.contains("illaoi") || id_lower.contains("briar") {
        "fighter"
    } else if id_lower.contains("akali") || id_lower.contains("fizz") || id_lower.contains("kayn") {
        "assassin"
    } else {
        "unknown"
    };

    let default_items = match role {
        "adc" => vec![
            serde_json::json!({"id": "TFT_Item_GuinsoosRageblade", "name": "鬼索的狂暴之刃", "type": "attack_speed"}),
            serde_json::json!({"id": "TFT_Item_GiantSlayer", "name": "巨人杀手", "type": "damage"}),
            serde_json::json!({"id": "TFT_Item_Bloodthirster", "name": "饮血剑", "type": "lifesteal"}),
        ],
        "apc" => vec![
            serde_json::json!({"id": "TFT_Item_BlueBuff", "name": "蓝霸符", "type": "mana"}),
            serde_json::json!({"id": "TFT_Item_JeweledGauntlet", "name": "珠光护手", "type": "ap_crit"}),
            serde_json::json!({"id": "TFT_Item_RabadonsDeathcap", "name": "灭世者的死亡之帽", "type": "ap"}),
        ],
        "tank" => vec![
            serde_json::json!({"id": "TFT_Item_WarmogsArmor", "name": "狂徒铠甲", "type": "hp"}),
            serde_json::json!({"id": "TFT_Item_BrambleVest", "name": "棘刺背心", "type": "armor"}),
            serde_json::json!({"id": "TFT_Item_DragonsClaw", "name": "巨龙之爪", "type": "mr"}),
        ],
        "fighter" => vec![
            serde_json::json!({"id": "TFT_Item_Bloodthirster", "name": "饮血剑", "type": "lifesteal"}),
            serde_json::json!({"id": "TFT_Item_TitansResolve", "name": "泰坦的坚决", "type": "hybrid_stacks"}),
            serde_json::json!({"id": "TFT_Item_SteraksGage", "name": "斯特拉克的挑战护手", "type": "shield"}),
        ],
        "assassin" => vec![
            serde_json::json!({"id": "TFT_Item_InfinityEdge", "name": "无尽之刃", "type": "crit"}),
            serde_json::json!({"id": "TFT_Item_Bloodthirster", "name": "饮血剑", "type": "lifesteal"}),
            serde_json::json!({"id": "TFT_Item_LastWhisper", "name": "最后的轻语", "type": "armor_pen"}),
        ],
        _ => vec![
            serde_json::json!({"id": "TFT_Item_GiantSlayer", "name": "巨人杀手", "type": "damage"}),
            serde_json::json!({"id": "TFT_Item_Bloodthirster", "name": "饮血剑", "type": "lifesteal"}),
            serde_json::json!({"id": "TFT_Item_GargoylesStoneplate", "name": "石像鬼石板甲", "type": "tank"}),
        ],
    };

    serde_json::json!({
        "unitId": unit_id,
        "unitName": unit_name,
        "cost": cost,
        "role": role,
        "recommendedItems": default_items,
        "buildCombinations": [],
        "relatedUnits": [],
        "traitStats": [],
        "baseStats": null,
        "traits": [],
        "dataSource": "default"
    })
}

#[tauri::command]
async fn get_phase(app: tauri::AppHandle) -> String {
    let state = app.state::<AppState>();
    let lcu = state.lcu.lock().unwrap().clone();

    match lcu {
        Some(lcu) => {
            let url = format!(
                "https://127.0.0.1:{}/lol-gameflow/v1/gameflow-phase",
                lcu.port
            );

            let client = match reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build()
            {
                Ok(c) => c,
                Err(_) => return "None".to_string(),
            };

            let response = match client
                .get(&url)
                .basic_auth("riot", Some(&lcu.password))
                .send()
                .await
            {
                Ok(r) => r,
                Err(_) => return "None".to_string(),
            };

            if response.status().is_success() {
                match response.json::<String>().await {
                    Ok(phase) => phase,
                    Err(_) => "None".to_string(),
                }
            } else {
                "None".to_string()
            }
        }
        None => "None".to_string(),
    }
}

#[tauri::command]
async fn get_player_stats(app: tauri::AppHandle) -> Option<serde_json::Value> {
    let state = app.state::<AppState>();
    let lcu = state.lcu.lock().unwrap().clone()?;
    let champ_map = state.champ_map.lock().unwrap().clone();

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .ok()?;

    // 获取召唤师信息
    let summoner_url = format!("https://127.0.0.1:{}/lol-summoner/v1/current-summoner", lcu.port);
    let summoner_resp = client
        .get(&summoner_url)
        .basic_auth("riot", Some(&lcu.password))
        .send()
        .await
        .ok()?;
    let summoner: serde_json::Value = summoner_resp.json().await.ok()?;
    let puuid = summoner["puuid"].as_str()?.to_string();

    // 获取排位信息
    let ranked_url = format!(
        "https://127.0.0.1:{}/lol-ranked/v1/ranked-stats/{}",
        lcu.port, puuid
    );
    let ranked_resp = client
        .get(&ranked_url)
        .basic_auth("riot", Some(&lcu.password))
        .send()
        .await
        .ok();
    let ranked: serde_json::Value = match ranked_resp {
        Some(r) => r.json().await.unwrap_or(serde_json::json!({})),
        None => serde_json::json!({}),
    };

    // 构建排名字符串
    let rank_str = if let Some(tier) = ranked["tier"].as_str() {
        let division = ranked["division"].as_str().unwrap_or("");
        let lp = ranked["leaguePoints"].as_i64().unwrap_or(0);
        format!("{} {} {}LP", tier, division, lp)
    } else {
        "未定级".to_string()
    };

    // 获取对局历史
    let history_url = format!(
        "https://127.0.0.1:{}/lol-match-history/v1/products/tft/{}/matches",
        lcu.port, puuid
    );
    let history_resp = client
        .get(&history_url)
        .basic_auth("riot", Some(&lcu.password))
        .send()
        .await
        .ok()?;
    let history: serde_json::Value = history_resp.json().await.ok()?;

    // 统计英雄使用情况
    let mut unit_stats: std::collections::HashMap<String, (i32, i32)> = std::collections::HashMap::new();
    let mut recent_matches = Vec::new();

    if let Some(games) = history["games"].as_array() {
        // 召唤物列表，不统计在常用英雄中
        let summons = [
            "TFT16_Atakhan", "tft16_atakhan",  // 厄塔汗 - 诺克萨斯召唤物
            "TFT16_AnnieTibbers", "TFT16_RiftHerald", // 其他可能的召唤物
            "TFT16_BaronNashor", "TFT16_Brock",
        ];

        for game in games.iter().take(50) {
            // 数据结构是 games[].json.participants
            let game_json = &game["json"];
            if let Some(participants) = game_json["participants"].as_array() {
                if let Some(me) = participants.iter().find(|p| p["puuid"].as_str() == Some(&puuid)) {
                    let placement = me["placement"].as_i64().unwrap_or(8) as i32;

                    // 统计英雄（排除召唤物）
                    if let Some(units) = me["units"].as_array() {
                        for unit in units {
                            if let Some(character_id) = unit["character_id"].as_str() {
                                // 跳过召唤物
                                if summons.contains(&character_id) || summons.contains(&character_id.to_uppercase().as_str()) {
                                    continue;
                                }
                                let entry = unit_stats.entry(character_id.to_string()).or_insert((0, 0));
                                entry.0 += 1;
                                if placement <= 4 {
                                    entry.1 += 1;
                                }
                            }
                        }
                    }

                    // 记录最近对局
                    if recent_matches.len() < 10 {
                        let units: Vec<serde_json::Value> = me["units"]
                            .as_array()
                            .map(|u| u.iter()
                                .filter(|unit| {
                                    let id = unit["character_id"].as_str().unwrap_or("");
                                    !summons.contains(&id) && !summons.contains(&id.to_uppercase().as_str())
                                })
                                .take(5)
                                .map(|unit| {
                                    let id = unit["character_id"].as_str().unwrap_or("");
                                    serde_json::json!({
                                        "id": id,
                                        "name": get_champion_name_from_map(id, &champ_map)
                                    })
                                }).collect())
                            .unwrap_or_default();

                        let traits: String = me["traits"]
                            .as_array()
                            .map(|t| t.iter()
                                .filter(|tr| tr["tier_current"].as_i64().unwrap_or(0) > 0)
                                .map(|tr| {
                                    let name = tr["name"].as_str().unwrap_or("");
                                    let num = tr["num_units"].as_i64().unwrap_or(0);
                                    format!("{}({})", get_trait_name(name), num)
                                })
                                .collect::<Vec<_>>()
                                .join(", "))
                            .unwrap_or_default();

                        recent_matches.push(serde_json::json!({
                            "placement": placement,
                            "units": units,
                            "traits": traits
                        }));
                    }
                }
            }
        }
    }

    // 排序常用英雄
    let mut top_units: Vec<(String, i32, i32)> = unit_stats
        .iter()
        .map(|(id, (games, top4))| (id.clone(), *games, *top4))
        .collect();
    top_units.sort_by(|a, b| b.1.cmp(&a.1));
    let top_units: Vec<serde_json::Value> = top_units
        .iter()
        .take(10)
        .map(|(id, games, top4)| {
            let rate = if *games > 0 { *top4 * 100 / *games } else { 0 };
            serde_json::json!({
                "id": id,
                "name": get_champion_name_from_map(id, &champ_map),
                "games": games,
                "top4": top4,
                "top4Rate": rate
            })
        })
        .collect();

    Some(serde_json::json!({
        "summoner": {
            "name": summoner["displayName"].as_str().unwrap_or("未知"),
            "level": summoner["summonerLevel"].as_i64().unwrap_or(0),
            "puuid": puuid
        },
        "rank": rank_str,
        "games": {
            "totalGames": history["games"].as_array().map(|g| g.len()).unwrap_or(0)
        },
        "topUnits": top_units,
        "recentMatches": recent_matches
    }))
}

fn get_champion_name_from_map(api_name: &str, champ_map: &serde_json::Value) -> String {
    // 先从映射表查找
    if let Some(obj) = champ_map.as_object() {
        for (_id, data) in obj {
            if let Some(api) = data["apiName"].as_str() {
                if api == api_name {
                    if let Some(name) = data["name"].as_str() {
                        return name.to_string();
                    }
                }
            }
        }
    }
    // 回退到内置映射
    get_champion_name(api_name)
}

#[tauri::command]
fn resize_window(app: tauri::AppHandle, height: i32) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize { width: 320, height: height as u32 }))
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        {
            if let Ok(hwnd) = window.hwnd() {
                unsafe {
                    // Windows 11 原生圆角（抗锯齿）
                    let corner_preference: i32 = 2; // DWMWCP_ROUND
                    let _ = DwmSetWindowAttribute(
                        hwnd,
                        DWMWINDOWATTRIBUTE(33),
                        &corner_preference as *const i32 as *const _,
                        std::mem::size_of::<i32>() as u32,
                    );
                }
            }
        }
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // 初始化状态
            let state = AppState {
                lcu: Mutex::new(None),
                champ_map: Mutex::new(serde_json::json!({})),
                champ_aliases: Mutex::new(serde_json::json!({})),
                trait_map: Mutex::new(serde_json::json!({})),
            };
            app.manage(state);

            // 设置窗口始终置顶
            let window = app.get_webview_window("main").unwrap();
            window.set_always_on_top(true).ok();

            // Windows 设置窗口圆角
            #[cfg(target_os = "windows")]
            {
                if let Ok(hwnd) = window.hwnd() {
                    unsafe {
                        // Windows 11 原生圆角（抗锯齿）
                        let corner_preference: i32 = 2; // DWMWCP_ROUND
                        let _ = DwmSetWindowAttribute(
                            hwnd,
                            DWMWINDOWATTRIBUTE(33),
                            &corner_preference as *const i32 as *const _,
                            std::mem::size_of::<i32>() as u32,
                        );
                    }
                }
            }

            // 开发时打开 devtools
            #[cfg(debug_assertions)]
            {
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init,
            get_champion_list,
            recommend,
            get_phase,
            get_player_stats,
            resize_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}