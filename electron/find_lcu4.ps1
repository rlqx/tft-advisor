# 通过句柄找 LeagueClient 工作目录
$pid = 58328

# 方法1: 用 handle.exe 或 /proc 等价物 - 改用注册表
$regPath = 'HKLM:\SOFTWARE\WOW6432Node\Riot Games\League of Legends'
$regPath2 = 'HKLM:\SOFTWARE\Riot Games\League of Legends'
$regPath3 = 'HKCU:\SOFTWARE\Riot Games\League of Legends'

foreach ($r in @($regPath, $regPath2, $regPath3)) {
    if (Test-Path $r) {
        Write-Host "注册表路径: $r"
        Get-ItemProperty $r | Format-List
    }
}

# 方法2: 查 icreateLol 进程路径（它是安装器，能获取路径）
$ic = Get-WmiObject Win32_Process -Filter "name='icreateLol.exe'" | Select-Object -First 1
if ($ic) {
    Write-Host "icreateLol CommandLine: $($ic.CommandLine)"
}

# 方法3: 查 QMLolAssist（腾讯助手）路径
$qa = Get-WmiObject Win32_Process -Filter "name='QMLolAssist.exe'"
if ($qa) {
    Write-Host "QMLolAssist CommandLine: $($qa.CommandLine)"
}
