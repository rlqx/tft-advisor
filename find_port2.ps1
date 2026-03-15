# 用 netstat 找 PID=4160 监听的端口
$pid = 4160
$lines = netstat -ano | Where-Object { $_ -match "LISTENING" -and $_ -match "\s$pid$" }
Write-Host "LeagueClientUx 监听端口:"
$lines | ForEach-Object {
    if ($_ -match ':(\d+)\s') { Write-Host "  端口: $($Matches[1])" }
}

# 同时找所有 Riot/LOL 进程
Write-Host ""
Write-Host "所有 Riot/LOL 进程:"
Get-Process | Where-Object { $_.Name -match 'League|Riot|lol|tft' } | ForEach-Object {
    Write-Host "  $($_.Name) PID=$($_.Id)"
    $plines = netstat -ano | Where-Object { $_ -match "LISTENING" -and $_ -match "\s$($_.Id)$" }
    $plines | ForEach-Object {
        if ($_ -match ':(\d+)\s') { Write-Host "    -> 端口: $($Matches[1])" }
    }
}
