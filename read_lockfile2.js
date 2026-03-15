const { execSync } = require('child_process');

// 用 PowerShell FileStream 以共享读写方式读取被锁定的文件
const ps = `
$path = 'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile'
$stream = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$reader = New-Object System.IO.StreamReader($stream)
$content = $reader.ReadToEnd()
$reader.Close()
$stream.Close()
Write-Output $content
`;

try {
  const result = execSync(`powershell.exe -ExecutionPolicy Bypass -Command "${ps.replace(/\n/g,'\n')}"`,
    { encoding: 'utf8', timeout: 5000 });
  const content = result.trim();
  console.log('lockfile内容:', JSON.stringify(content));
  const parts = content.split(':');
  console.log('\n解析:');
  console.log('  进程名:', parts[0]);
  console.log('  PID:   ', parts[1]);
  console.log('  端口:  ', parts[2]);
  console.log('  协议:  ', parts[3]);
  console.log('  Token: ', parts[4]);
} catch(e) {
  console.error('失败:', e.message.slice(0, 300));
}
