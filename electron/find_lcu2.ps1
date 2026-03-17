# 通过 WMI 获取进程工作目录
$proc = Get-WmiObject Win32_Process -Filter "ProcessId=4160"
$path = $proc.ExecutablePath
$cwd  = $proc.WorkingSetSize  # just a test
Write-Host "ExecutablePath: $path"

# 尝试另一个方法：查 LeagueClient.exe（父进程）
$parent = Get-WmiObject Win32_Process -Filter "name='LeagueClient.exe'"
if ($parent) {
    Write-Host "LeagueClient.exe path: $($parent.ExecutablePath)"
    Write-Host "LeagueClient.exe cmdline: $($parent.CommandLine)"
}

# 直接搜索已知 TFT lockfile 路径模式
$pattern = @(
    'D:\Riot Games\League of Legends\lockfile',
    'E:\Riot Games\League of Legends\lockfile',
    'F:\Riot Games\League of Legends\lockfile',
    'C:\Riot Games\League of Legends\lockfile',
    'D:\LOL\lockfile',
    'E:\LOL\lockfile',
    'C:\LOL\lockfile',
    'D:\英雄联盟\lockfile',
    'C:\英雄联盟\lockfile',
    'E:\英雄联盟\lockfile'
)
foreach ($p in $pattern) {
    if (Test-Path $p) {
        Write-Host "找到 lockfile: $p"
        Get-Content $p
    }
}
