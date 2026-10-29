param([string]$VersionName='1.0.0',[ValidateSet('website','play')][string]$Distribution='website')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$releaseDir=Join-Path $projectRoot 'releases'
if ($Distribution -eq 'play') { $releaseDir=Join-Path $releaseDir 'play' }
$apk=Join-Path $releaseDir "DapurOS-POS-$VersionName.apk"
$bundle=Join-Path $releaseDir "DapurOS-POS-$VersionName.aab"
$tools=Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk/build-tools/36.0.0'
$bundletool=Join-Path $projectRoot 'build/tools/bundletool-all-1.18.3.jar'
$identity=Get-Content -LiteralPath (Join-Path $projectRoot 'release-identity.json') -Raw | ConvertFrom-Json
if ($identity.applicationId -ne 'com.dagangos.dapuros' -or $identity.signingCertificateSha256 -eq '52e14a39a7da4f5f528838f33602860e35960373070a6132d08f682487494ec8') { throw 'DapurOS must have its own application and signing identity.' }
$signature=& (Join-Path $tools 'apksigner.bat') verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0 -or !($signature -join "`n").Contains($identity.signingCertificateSha256)) { throw 'APK signature does not match the pinned DapurOS certificate.' }
& (Join-Path $tools 'zipalign.exe') -c -P 16 4 $apk
if ($LASTEXITCODE -ne 0) { throw 'APK alignment verification failed.' }
& java -jar $bundletool validate "--bundle=$bundle"
if ($LASTEXITCODE -ne 0) { throw 'Bundle validation failed.' }
$badging=& (Join-Path $tools 'aapt2.exe') dump badging $apk
if ($LASTEXITCODE -ne 0 -or !($badging -join "`n").Contains("name='com.dagangos.dapuros'") -or !($badging -join "`n").Contains("minSdkVersion:'34'")) { throw 'Package identity or Android requirement is incorrect.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sensitive=@()
foreach ($config in @((Join-Path $projectRoot '../backend/.env'),(Join-Path $projectRoot '../.env.android-test'))) {
    if (Test-Path -LiteralPath $config) {
        foreach ($line in Get-Content -LiteralPath $config) {
            if ($line -match '^\s*[A-Z_]*(?:PASSWORD|SECRET|TOKEN|API_KEY)[A-Z_]*\s*=\s*(.+)$') {
                $value=$Matches[1].Trim().Trim('"').Trim("'")
                if ($value.Length -ge 12) { $sensitive += $value }
            }
        }
    }
}
foreach ($package in @($apk,$bundle)) {
    $zip=[IO.Compression.ZipFile]::OpenRead($package)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName -match '(?:^|/)(?:\.env[^/]*|keystore\.properties|[^/]+\.jks)$') { throw 'Private configuration found inside package.' }
            if (!$entry.Length) { continue }
            $stream=$entry.Open(); $memory=[IO.MemoryStream]::new()
            try {
                $stream.CopyTo($memory); $contents=[Text.Encoding]::UTF8.GetString($memory.ToArray())
                foreach ($secret in $sensitive) { if ($contents.Contains($secret)) { throw 'Private credential found inside package.' } }
            } finally { $stream.Dispose(); $memory.Dispose() }
        }
    } finally { $zip.Dispose() }
}
Write-Output 'Verified DapurOS identity, signature, Android 14+, package alignment, bundle and private-credential exclusion.'
