# 通过进程句柄获取LOL安装路径和lockfile
$proc = Get-Process -Name 'LeagueClientUx' -ErrorAction SilentlyContinue
if ($proc) {
    Write-Host "找到进程 PID: $($proc.Id)"
    Write-Host "主模块路径: $($proc.MainModule.FileName)"
    $dir = Split-Path $proc.MainModule.FileName
    Write-Host "目录: $dir"
    $lockfile = Join-Path $dir 'lockfile'
    if (Test-Path $lockfile) {
        Write-Host "lockfile内容:"
        Get-Content $lockfile
    } else {
        Write-Host "当前目录无lockfile，向上查找..."
        $parent = Split-Path $dir
        $lockfile2 = Join-Path $parent 'lockfile'
        if (Test-Path $lockfile2) {
            Write-Host "lockfile内容:"
            Get-Content $lockfile2
        } else {
            Write-Host "父目录: $parent"
            Get-ChildItem $parent -ErrorAction SilentlyContinue | Select-Object Name
        }
    }
} else {
    Write-Host "未找到 LeagueClientUx 进程"
}
