# $pid 是保留变量，用 $lcPid
$lcPid = 58328

# 查注册表找LOL安装路径
$regPaths = @(
    'HKLM:\SOFTWARE\WOW6432Node\Riot Games\League of Legends',
    'HKLM:\SOFTWARE\Riot Games\League of Legends',
    'HKCU:\SOFTWARE\Riot Games\League of Legends',
    'HKLM:\SOFTWARE\WOW6432Node\Tencent\LOL',
    'HKLM:\SOFTWARE\Tencent\LOL'
)
foreach ($r in $regPaths) {
    try {
        if (Test-Path $r) {
            Write-Host "Registry: $r"
            Get-ItemProperty $r | Format-List
        }
    } catch {}
}

# 查 QMLolAssist 找安装路径
$qa = Get-WmiObject Win32_Process -Filter "name='QMLolAssist.exe'" | Select-Object -First 1
if ($qa) { Write-Host "QMLolAssist cmdline: $($qa.CommandLine)" }

# 用 SysInternals handle 方式：枚举进程打开的文件（通过 /proc 等价）
# 改用：直接尝试 LeagueClient 的工作目录
try {
    $p = [System.Diagnostics.Process]::GetProcessById($lcPid)
    Write-Host "MainModule: $($p.MainModule.FileName)"
} catch { Write-Host "MainModule error: $_" }

# 列出所有盘根目录，查 Riot/LOL/TGP 文件夹
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $r = $_.Root
    @('Riot Games','LOL','英雄联盟','TGP','tgp','lol') | ForEach-Object {
        $p = Join-Path $r $_
        if (Test-Path $p) { Write-Host "Found dir: $p" }
    }
}
