$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendDir = Join-Path $root 'backend'
$backendEnv = Join-Path $backendDir '.env'
$nodeExe = 'C:\Program Files\nodejs\node.exe'

$env:DOTENV_CONFIG_PATH = $backendEnv

$process = Start-Process `
  -FilePath $nodeExe `
  -ArgumentList @('--preserve-symlinks', '--preserve-symlinks-main', 'dev-start.mjs') `
  -WorkingDirectory $backendDir `
  -PassThru

Write-Output "Backend daemon started with PID $($process.Id)"
