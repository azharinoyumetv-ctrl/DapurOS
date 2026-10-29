param([string]$VersionName='1.0.1',[string]$Serial='emulator-5570',[string[]]$Profiles=@('phone','xiaomi-landscape','samsung-landscape'))
$ErrorActionPreference='Stop'
if ($Serial -notmatch '^emulator-\d+$') { throw 'Only an isolated emulator is permitted.' }
$root=Split-Path -Parent $PSScriptRoot
$adb=Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk/platform-tools/adb.exe'
$apk=Join-Path $root "releases/DapurOS-POS-$VersionName.apk"
$expectedHash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLower()
foreach ($profile in $Profiles) {
    & (Join-Path $PSScriptRoot 'Verify-InstalledRelease.ps1') -Profile $profile -Serial $Serial -VersionName $VersionName -EvidencePrefix "$VersionName-native" *> (Join-Path $root "../tmp/$VersionName-native-$profile.log")
    $billingProfile="$profile-billing"
    $output=& $adb -s $Serial shell am instrument -w -r -e class 'com.example.dapurospos.DapurOSReleaseFlowTest#trialUpgradeAndTheme' -e profile $billingProfile com.dagangos.dapuros.test/androidx.test.runner.AndroidJUnitRunner
    $output | Set-Content -LiteralPath (Join-Path $root "../tmp/$VersionName-native-$billingProfile.log")
    if (!($output -join "`n").Contains('OK (1 test)')) { $output | Select-Object -Last 25; throw 'Installed subscription/theme verification failed.' }
    $report=Join-Path $root "app/build/reports/$VersionName-native/$billingProfile"
    New-Item -ItemType Directory -Force -Path $report | Out-Null
    & $adb -s $Serial pull "/sdcard/Android/data/com.dagangos.dapuros/files/release-verification/$billingProfile/verification.json" (Join-Path $report 'verification.json')
    $data=Get-Content -LiteralPath (Join-Path $report 'verification.json') -Raw | ConvertFrom-Json
    if ($data.status -ne 'passed' -or $data.checks.Count -ne 2) { throw 'Incomplete subscription/theme evidence.' }
    $installedPath=(& $adb -s $Serial shell pm path com.dagangos.dapuros | Select-Object -First 1) -replace '^package:',''
    $installedHash=((& $adb -s $Serial shell sha256sum $installedPath) -split '\s+')[0].ToLower()
    if ($installedHash -ne $expectedHash) { throw 'Installed APK differs from the release.' }
    $data | Add-Member -NotePropertyName apkSha256 -NotePropertyValue $expectedHash -Force
    $data | Add-Member -NotePropertyName installedApkSha256 -NotePropertyValue $installedHash -Force
    $data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $report 'verification.json')
    foreach ($check in $data.checks) {
        $filename=($check -replace '[^a-zA-Z0-9]+','-')+'.png'
        & $adb -s $Serial pull "/sdcard/Android/data/com.dagangos.dapuros/files/release-verification/$billingProfile/$filename" (Join-Path $report $filename)
        if ($LASTEXITCODE -ne 0) { throw 'Missing signed subscription/theme screenshot.' }
    }
    Write-Output ($profile+': signed core and subscription/theme checks passed')
}
