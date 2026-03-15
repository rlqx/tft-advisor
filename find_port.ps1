# 用netstat找LCU端口，再读注册表找token
$pid = (Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue).Id
if (-not $pid) { Write-Host '未找到LeagueClientUx进程'; exit 1 }
Write-Host "LeagueClientUx PID: $pid"

# 用netstat找该进程监听的端口
$netstat = netstat -ano | Select-String "LISTENING" | Select-String $pid.ToString()
Write-Host "监听端口:"
$netstat | ForEach-Object { Write-Host $_ }

# 尝试WMI获取命令行
$wmi = Get-WmiObject Win32_Process -Filter "ProcessId=$pid"
Write-Host ""
Write-Host "CommandLine:"
Write-Host $wmi.CommandLine
