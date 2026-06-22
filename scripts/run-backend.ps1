$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$backendEnv = Join-Path $root 'backend\.env'
 $backendDir = Join-Path $root 'backend'

$env:DOTENV_CONFIG_PATH = $backendEnv
Set-Location $backendDir
$nodeExe = 'C:\Program Files\nodejs\node.exe'
& $nodeExe --preserve-symlinks --preserve-symlinks-main (Join-Path $backendDir 'dev-start.mjs')
