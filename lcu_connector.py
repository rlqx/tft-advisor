import subprocess
import re
import base64
import requests
import urllib3
import json

urllib3.disable_warnings()  # LCU 使用自签名证书


def get_lcu_credentials():
    """从进程参数中读取 LCU 端口和密钥"""
    result = subprocess.run(
        ["wmic", "process", "where",
         "name='LeagueClientUx.exe'",
         "get", "CommandLine"],
        capture_output=True, text=True, encoding="utf-8"
    )
    cmd = result.stdout
    port = re.search(r'--app-port=(\d+)', cmd)
    token = re.search(r'--remoting-auth-token=([\w-]+)', cmd)
    if not port or not token:
        raise RuntimeError("LOL 客户端未运行，请先启动游戏客户端")
    return int(port.group(1)), token.group(1)


class LCUClient:
    def __init__(self):
        port, token = get_lcu_credentials()
        self.base = f"https://127.0.0.1:{port}"
        auth = base64.b64encode(f"riot:{token}".encode()).decode()
        self.headers = {"Authorization": f"Basic {auth}"}
        print(f"[LCU] 连接到端口: {port}")

    def get(self, path):
        r = requests.get(
            f"{self.base}{path}",
            headers=self.headers,
            verify=False
        )
        r.raise_for_status()
        return r.json()

    def get_current_summoner(self):
        """获取当前登录玩家信息"""
        return self.get("/lol-summoner/v1/current-summoner")

    def get_tft_match_history(self, puuid, count=20):
        """获取 TFT 历史对局"""
        return self.get(
            f"/lol-match-history/v1/products/tft/{puuid}/matches?begIndex=0&endIndex={count}"
        )

    def get_game_flow_phase(self):
        """获取当前游戏阶段"""
        return self.get("/lol-gameflow/v1/gameflow-phase")

    def get_game_session(self):
        """获取当前游戏会话详情"""
        return self.get("/lol-gameflow/v1/session")


if __name__ == "__main__":
    try:
        print("正在连接 LOL 客户端...")
        client = LCUClient()

        print("\n=== 当前玩家信息 ===")
        summoner = client.get_current_summoner()
        print(f"召唤师名:  {summoner.get('displayName', 'N/A')}")
        print(f"PUUID:     {summoner.get('puuid', 'N/A')}")
        print(f"等级:      {summoner.get('summonerLevel', 'N/A')}")

        print("\n=== 游戏当前阶段 ===")
        phase = client.get_game_flow_phase()
        print(f"阶段: {phase}")

        print("\n=== TFT 历史对局（最近5场）===")
        puuid = summoner.get('puuid')
        if puuid:
            history = client.get_tft_match_history(puuid, count=5)
            games = history.get('games', {}).get('games', [])
            if games:
                for g in games:
                    gid = g.get('gameId', 'N/A')
                    duration = g.get('gameDuration', 0)
                    print(f"  对局ID: {gid} | 时长: {duration}s ({duration//60}分{duration%60}秒)")
            else:
                print("  暂无 TFT 历史对局数据")
                print(f"  原始返回: {json.dumps(history, ensure_ascii=False)[:300]}")

        print("\n✅ LCU API 连接测试成功！")

    except RuntimeError as e:
        print(f"\n❌ {e}")
    except requests.HTTPError as e:
        print(f"\n❌ HTTP 错误: {e.response.status_code} - {e.response.text[:200]}")
    except Exception as e:
        print(f"\n❌ 连接失败: {type(e).__name__}: {e}")
