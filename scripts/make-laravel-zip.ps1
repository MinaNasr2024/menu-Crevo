param(
    [string] $SourceRoot = (Join-Path $PSScriptRoot '..\laravel-backend'),
    [string] $DestinationZip = (Join-Path (Join-Path $PSScriptRoot '..\deploy') 'api-menu-laravel.zip')
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceRoot).Path
$destDir = Split-Path -Parent $DestinationZip
if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir | Out-Null
}

if (Test-Path $DestinationZip) {
    Remove-Item -LiteralPath $DestinationZip -Force
}

$excluded = @(
    '\\storage\\framework\\sessions\\',
    '\\storage\\framework\\cache\\',
    '\\storage\\framework\\views\\',
    '\\storage\\logs\\',
    '\\node_modules\\',
    '\\.git\\',
    '\\backend-runtime.log',
    '\\backend-runtime.err',
    '\\backend-start.log',
    '\\backend-start.err'
)

$files = Get-ChildItem -LiteralPath $source -Recurse -File -Force | Where-Object {
    $full = $_.FullName
    foreach ($pattern in $excluded) {
        if ($full -match $pattern) {
            return $false
        }
    }
    return $true
}

Compress-Archive -Path $files.FullName -DestinationPath $DestinationZip -Force
Write-Host "Created $DestinationZip"
