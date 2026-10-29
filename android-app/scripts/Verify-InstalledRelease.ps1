param([ValidateSet('phone','xiaomi-landscape','samsung-landscape')][string]$Profile='phone',[string]$Serial='emulator-5570',[ValidateSet('website','play')][string]$Distribution='website',[string]$VersionName='1.0.0',[string]$EvidencePrefix='final-native')
$ErrorActionPreference='Stop'
if ($Serial -notmatch '^emulator-\d+$') { throw 'This fixture bench only targets an isolated emulator.' }
$root=Split-Path -Parent $PSScriptRoot
$adb=Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk/platform-tools/adb.exe'
$settings=@{phone=@(1080,2400,420,0);'xiaomi-landscape'=@(2032,3048,320,1);'samsung-landscape'=@(1848,2960,240,1)}[$Profile]
& $adb -s $Serial shell wm size "$($settings[0])x$($settings[1])"
& $adb -s $Serial shell wm density $settings[2]
& $adb -s $Serial shell settings put system accelerometer_rotation 0
& $adb -s $Serial shell settings put system user_rotation $settings[3]
$apk=Join-Path $root "releases/DapurOS-POS-$VersionName.apk"
if ($Distribution -eq 'play') { $apk=Join-Path $root "releases/play/DapurOS-POS-$VersionName.apk" }
$expectedHash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLower()
& $adb -s $Serial install -r $apk
if ($LASTEXITCODE -ne 0) { throw 'Signed APK installation failed.' }
& $adb -s $Serial install -r (Join-Path $root 'app/build/outputs/apk/androidTest/release/app-release-androidTest.apk')
if ($LASTEXITCODE -ne 0) { throw 'Signed test package installation failed.' }
& $adb -s $Serial shell pm revoke com.dagangos.dapuros android.permission.CAMERA 2>$null
& $adb -s $Serial shell pm clear-permission-flags com.dagangos.dapuros android.permission.CAMERA user-set user-fixed
$output=& $adb -s $Serial shell am instrument -w -r -e class 'com.example.dapurospos.DapurOSReleaseFlowTest#restaurantReleaseFlow' -e profile $Profile -e distribution $Distribution com.dagangos.dapuros.test/androidx.test.runner.AndroidJUnitRunner
$reportKind=if ($Distribution -eq 'play') { "$EvidencePrefix-play" } else { $EvidencePrefix }
$report=Join-Path $root "app/build/reports/$reportKind/$Profile"
New-Item -ItemType Directory -Path $report -Force | Out-Null
$output | Set-Content -LiteralPath (Join-Path $report 'instrumentation.txt')
& $adb -s $Serial pull "/sdcard/Android/data/com.dagangos.dapuros/files/release-verification/$Profile/verification.json" (Join-Path $report 'verification.json')
if (!($output -join "`n").Contains('OK (1 test)')) { throw 'Installed release checks failed. See the retained instrumentation report.' }
$evidence=Get-Content -LiteralPath (Join-Path $report 'verification.json') -Raw | ConvertFrom-Json
if ($evidence.status -ne 'passed' -or $evidence.checks.Count -ne 7) { throw 'Installed release evidence is incomplete.' }
$installedPath=(& $adb -s $Serial shell pm path com.dagangos.dapuros | Select-Object -First 1) -replace '^package:',''
if ($installedPath -notmatch '^/data/app/.+/base\.apk$') { throw 'Cannot locate the installed release package.' }
$installedHash=((& $adb -s $Serial shell sha256sum $installedPath) -split '\s+')[0].ToLower()
if ($installedHash -ne $expectedHash -or (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLower() -ne $expectedHash) { throw 'Installed APK or candidate bytes changed during verification.' }
$evidence | Add-Member -NotePropertyName apkSha256 -NotePropertyValue $expectedHash -Force
$evidence | Add-Member -NotePropertyName installedApkSha256 -NotePropertyValue $installedHash -Force
$evidence | Add-Member -NotePropertyName deviceApi -NotePropertyValue ([int](& $adb -s $Serial shell getprop ro.build.version.sdk)) -Force
$evidence | Add-Member -NotePropertyName physicalScreenPixels -NotePropertyValue @($settings[0],$settings[1]) -Force
$evidence | Add-Member -NotePropertyName density -NotePropertyValue $settings[2] -Force
$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $report 'verification.json')
$screens=Join-Path $report 'screenshots'
New-Item -ItemType Directory -Path $screens -Force | Out-Null
foreach ($check in $evidence.checks) {
    $name=($check -replace '[^a-zA-Z0-9]+','-')
    $filename=$name.Substring(0,[Math]::Min(65,$name.Length))+'.png'
    & $adb -s $Serial pull "/sdcard/Android/data/com.dagangos.dapuros/files/release-verification/$Profile/$filename" (Join-Path $screens $filename)
    if ($LASTEXITCODE -ne 0) { throw 'A verified device screenshot is missing.' }
}
Write-Output "Signed release: $Profile passed all seven groups."
