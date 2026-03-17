$drives = @('C','D','E','F','G','H')
foreach ($d in $drives) {
    $p = "${d}:\Riot Games\League of Legends\lockfile"
    if (Test-Path $p) {
        Write-Host "Found: $p"
        Get-Content $p
        exit 0
    }
}
Write-Host 'lockfile not found, trying other locations...'
$candidates = @(
    'C:\Program Files\Riot Games\League of Legends\lockfile',
    'C:\Program Files (x86)\Riot Games\League of Legends\lockfile'
)
foreach ($p in $candidates) {
    if (Test-Path $p) {
        Write-Host "Found: $p"
        Get-Content $p
        exit 0
    }
}
# 搜索所有固定盘
Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    $root = $_.Root
    $paths = @(
        "${root}Riot Games\League of Legends\lockfile",
        "${root}LOL\lockfile",
        "${root}lol\lockfile"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) {
            Write-Host "Found: $p"
            Get-Content $p
            exit 0
        }
    }
}
Write-Host 'lockfile not found on any drive'
