param(
    [Parameter(Mandatory = $true)]
    [string] $FtpHost,

    [Parameter(Mandatory = $true)]
    [string] $FtpUser,

    [Parameter(Mandatory = $true)]
    [string] $FtpPassword,

    [string] $MenuLocal = '',
    [string] $ApiLocal = '',
    [string] $MenuRemote = '/public_html/menu',
    [string] $ApiRemote = '/public_html/api-menu',
    [switch] $SkipMenu,
    [switch] $SkipApi
)

$ErrorActionPreference = 'Stop'
$scriptRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $MenuLocal) { $MenuLocal = Join-Path $scriptRoot '..\frontend\dist' }
if (-not $ApiLocal) { $ApiLocal = Join-Path $scriptRoot '..\laravel-backend' }
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
            # Directory may already exist. Ignore and continue.
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

function Upload-Folder {
    param(
        [Parameter(Mandatory = $true)][string] $LocalRoot,
        [Parameter(Mandatory = $true)][string] $RemoteRoot,
        [string[]] $ExcludePatterns = @()
    )

    $root = (Resolve-Path -LiteralPath $LocalRoot).Path
    Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
        $relative = $_.FullName.Substring($root.Length).TrimStart('\', '/')
        $skip = $false
        foreach ($pattern in $ExcludePatterns) {
            if ($relative -like $pattern -or $_.FullName -like $pattern) {
                $skip = $true
                break
            }
        }

        if ($skip) {
            return
        }

        $remotePath = ($RemoteRoot.TrimEnd('/') + '/' + $relative.Replace('\', '/')).Replace('//', '/')
        Upload-File -LocalFile $_.FullName -RemoteFile $remotePath
    }
}

if (-not $SkipMenu) {
    Write-Host 'Uploading React frontend to menu.crevo-eg.com target...'
    Upload-Folder -LocalRoot $MenuLocal -RemoteRoot $MenuRemote
}

if (-not $SkipApi) {
    Write-Host 'Uploading Laravel backend to api-menu.crevo-eg.com target...'
    Upload-Folder -LocalRoot $ApiLocal -RemoteRoot $ApiRemote -ExcludePatterns @(
        'vendor*',
        '*.git*',
        '*.tmp_*',
        '*backend-runtime.log',
        '*backend-runtime.err',
        '*backend-start.log',
        '*backend-start.err',
        '*laravel-backend/database/database.sqlite'
    )
}

Write-Host 'FTP deployment completed.'
