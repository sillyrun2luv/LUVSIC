# Build APK script for zi-wei-ba
# Usage: powershell -ExecutionPolicy Bypass -File build-apk.ps1

$ErrorActionPreference = "Stop"
$projectRoot = "D:\ai\d"

Write-Host "=== [1/4] Build frontend ===" -ForegroundColor Cyan
Set-Location $projectRoot
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend build FAILED" -ForegroundColor Red; exit 1 }

Write-Host "=== [2/4] Sync to Android ===" -ForegroundColor Cyan
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Host "Capacitor sync FAILED" -ForegroundColor Red; exit 1 }

Write-Host "=== [3/4] Compile APK ===" -ForegroundColor Cyan
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
$env:ANDROID_HOME = "D:\ai\d\android-sdk"
Set-Location "$projectRoot\android"
.\gradlew.bat assembleDebug --no-daemon -I init-mirrors.gradle
if ($LASTEXITCODE -ne 0) { Write-Host "APK build FAILED" -ForegroundColor Red; exit 1 }

Write-Host "=== [4/4] Copy APK ===" -ForegroundColor Cyan
$apkSrc = "$projectRoot\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDst = "$projectRoot\ziweiba.apk"
Copy-Item $apkSrc $apkDst -Force

$size = [math]::Round((Get-Item $apkDst).Length / 1MB, 1)
Write-Host ""
Write-Host "=== BUILD SUCCESS ===" -ForegroundColor Green
Write-Host "APK: $apkDst" -ForegroundColor Green
Write-Host "Size: $size MB" -ForegroundColor Green
