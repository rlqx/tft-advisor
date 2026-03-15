$proc = Get-WmiObject Win32_Process -Filter "ProcessId=4160"
$cmd = $proc.CommandLine
[System.IO.File]::WriteAllText('E:\claude workspace\tft-advisor\cmdline.txt', $cmd, [System.Text.Encoding]::UTF8)
Write-Host 'done'
