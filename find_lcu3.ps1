# 通过 LeagueClient 主进程获取路径和端口
$lc = Get-WmiObject Win32_Process -Filter "ProcessId=58328"
Write-Host "LeagueClient ExecutablePath: $($lc.ExecutablePath)"
Write-Host "LeagueClient CommandLine: $($lc.CommandLine)"

# 通过 LeagueClientUx 命令行获取端口和token
$lcux = Get-WmiObject Win32_Process -Filter "ProcessId=4160"
Write-Host ""
Write-Host "LeagueClientUx CommandLine:"
Write-Host $lcux.CommandLine

# 用 netstat 找 LeagueClient(58328) 监听端口
Write-Host ""
Write-Host "LeagueClient(58328) 监听端口:"
netstat -ano | Where-Object { $_ -match 'LISTENING' } | Where-Object { $_ -match '\s58328$' } | ForEach-Object {
    Write-Host $_
}

# RiotClientServices 端口
Write-Host ""
Write-Host "RiotClientServices(8352) 监听端口:"
netstat -ano | Where-Object { $_ -match 'LISTENING' } | Where-Object { $_ -match '\s8352$' } | ForEach-Object {
    Write-Host $_
}
