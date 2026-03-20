# trackmebaby - One-line installer for Windows
# Usage: irm https://raw.githubusercontent.com/Feynmunh/trackmebaby/main/scripts/install.ps1 | iex
# With execution policy flag (if default policy is Restricted):
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Feynmunh/trackmebaby/main/scripts/install.ps1 | iex"

$repo = "Feynmunh/trackmebaby"

$oldProgressPreference = $ProgressPreference
$oldSecurityProtocol = [Net.ServicePointManager]::SecurityProtocol

$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# Logic to restore on completion or error
function Cleanup-Session {
    $ProgressPreference = $oldProgressPreference
    [Net.ServicePointManager]::SecurityProtocol = $oldSecurityProtocol
}

$isArm64 = $null -ne $env:PROCESSOR_ARCHITEW6432 -and $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64'
if (-not $env:PROCESSOR_ARCHITEW6432) {
    $isArm64 = $env:PROCESSOR_ARCHITECTURE -eq 'ARM64'
}
$fileName = if ($isArm64) { "trackmebaby-win-arm64-setup.exe" } else { "trackmebaby-win-x64-setup.exe" }
$url = "https://github.com/$repo/releases/latest/download/$fileName"

$existingPaths = @("$env:LOCALAPPDATA\trackmebaby\stable\app")
$foundInstall = $null
foreach ($p in $existingPaths) {
    if (Test-Path $p) { $foundInstall = $p; break }
}
if ($foundInstall) {
    Write-Host "WARNING: Found existing installation at: $foundInstall" -ForegroundColor Yellow
    Write-Host "Re-running installer will update to the latest version." -ForegroundColor Yellow
    $confirm = if ($PSVersionTable.PSVersion.Major -ge 7) { Read-Host "Continue? [Y/n]" } else { Read-Host "Continue? (Y/n)" }
    if ($confirm -ne 'Y' -and $confirm -ne 'y') {
        Write-Host "Installation cancelled."
        Cleanup-Session
        return
    }
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "NOTE: Running without admin privileges. If installation fails, run PowerShell as Administrator." -ForegroundColor Yellow
}

Write-Host "==> Downloading trackmebaby ($fileName)..." -ForegroundColor Blue

$tempDir = [System.IO.Path]::GetTempPath()
$destFile = Join-Path $tempDir $fileName

try {
    Invoke-WebRequest -Uri $url -OutFile $destFile -MaximumRetryCount 3 -RetryIntervalSec 1
} catch {
    Write-Host "Error: Download failed. Check your network connection and verify the release asset exists." -ForegroundColor Red
    Write-Host "URL: $url" -ForegroundColor Red
    exit 1
} finally {
    Cleanup-Session
}

if (-not (Test-Path $destFile)) {
    Write-Host "Error: Download failed. File not found." -ForegroundColor Red
    Cleanup-Session
    exit 1
}
$size = (Get-Item $destFile).Length
if ($size -eq 0) {
    Write-Host "Error: Downloaded file is empty." -ForegroundColor Red
    Cleanup-Session
    exit 1
}
if ($size -lt 1000) {
    $content = Get-Content $destFile -Raw -ErrorAction SilentlyContinue
    if ($content -match '<html|<!DOCTYPE') {
        Write-Host "Error: Received an HTML error page instead of the installer." -ForegroundColor Red
        Cleanup-Session
        exit 1
    }
}

Write-Host "==> Running installer..." -ForegroundColor Blue
Start-Process -FilePath $destFile -Wait

if (Test-Path $destFile) {
    Remove-Item $destFile -Force -ErrorAction SilentlyContinue
}

Cleanup-Session
Write-Host "SUCCESS: trackmebaby installation has been started!" -ForegroundColor Green
Write-Host "Check your desktop or Start menu for the trackmebaby icon."
