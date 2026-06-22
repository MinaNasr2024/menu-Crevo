param(
    [Parameter(Mandatory = $true)]
    [string] $FtpHost,

    [Parameter(Mandatory = $true)]
    [string] $FtpUser,

    [Parameter(Mandatory = $true)]
    [string] $FtpPassword,

    [string] $LocalRoot = '',
    [string] $RemoteRoot = '/public_html/api-menu',
    [string[]] $Files = @(
        'laravel-backend/app/Http/Controllers/Api/PublicController.php',
        'laravel-backend/app/Http/Controllers/Api/SiteSettingsController.php',
        'laravel-backend/app/Http/Controllers/Api/BiController.php',
        'laravel-backend/bootstrap/app.php'
    )
)

$ErrorActionPreference = 'Stop'
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $LocalRoot) { $LocalRoot = Split-Path -Parent $scriptRoot }
$ftpCredential = New-Object System.Net.NetworkCredential($FtpUser, $FtpPassword)

function New-FtpRequest {
    param(
        [Parameter(Mandatory = $true)][string] $Uri,
        [Parameter(Mandatory = $true)][string] $Method
    )

    $request = [System.Net.FtpWebRequest]::Create($Uri)
    $request.Credentials = $ftpCredential
    $request.Method = $Method
    $request.UseBinary = $true
    $request.UsePassive = $true
    $request.KeepAlive = $false
    return $request
}

function Ensure-RemoteDirectory {
    param([Parameter(Mandatory = $true)][string] $RemoteDir)

    $normalized = $RemoteDir.Trim('/').Replace('\', '/')
    if (-not $normalized) {
        return
    }

    $current = ''
    foreach ($part in $normalized.Split('/')) {
        if (-not $part) { continue }
        $current = if ($current) { "$current/$part" } else { $part }
        $uri = "ftp://$FtpHost/$current"
        try {
            $request = New-FtpRequest -Uri $uri -Method ([System.Net.WebRequestMethods+Ftp]::MakeDirectory)
            $response = $request.GetResponse()
            $response.Close()
        } catch {
        }
    }
}

function Upload-File {
    param(
        [Parameter(Mandatory = $true)][string] $LocalFile,
        [Parameter(Mandatory = $true)][string] $RemoteFile
    )

    $parent = Split-Path -Path $RemoteFile -Parent
    if ($parent) {
        Ensure-RemoteDirectory -RemoteDir $parent
    }

    $uri = "ftp://$FtpHost/$($RemoteFile.TrimStart('/').Replace('\', '/'))"
    $request = New-FtpRequest -Uri $uri -Method ([System.Net.WebRequestMethods+Ftp]::UploadFile)
    $fileBytes = [System.IO.File]::ReadAllBytes($LocalFile)
    $request.ContentLength = $fileBytes.Length

    $stream = $request.GetRequestStream()
    try {
        $stream.Write($fileBytes, 0, $fileBytes.Length)
    } finally {
        $stream.Close()
    }

    $response = $request.GetResponse()
    try {
        Write-Host "Uploaded: $RemoteFile"
    } finally {
        $response.Close()
    }
}

$root = (Resolve-Path -LiteralPath $LocalRoot).Path
foreach ($relative in $Files) {
    $localPath = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $localPath)) {
        throw "Missing file: $localPath"
    }
    $remotePath = ($RemoteRoot.TrimEnd('/') + '/' + ($relative -replace '\\','/').Substring('laravel-backend/'.Length)).Replace('//','/')
    Upload-File -LocalFile $localPath -RemoteFile $remotePath
}

Write-Host 'Selected backend files deployed.'
