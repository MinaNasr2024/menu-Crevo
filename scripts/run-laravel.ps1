$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$junction = Join-Path $env:TEMP 'food-crevo-laravel-link'

if (Test-Path $junction) {
  Remove-Item $junction -Recurse -Force
}

New-Item -ItemType Junction -Path $junction -Target $root | Out-Null

Set-Location (Join-Path $junction 'laravel-backend')
php artisan serve --host 127.0.0.1 --port 8000
