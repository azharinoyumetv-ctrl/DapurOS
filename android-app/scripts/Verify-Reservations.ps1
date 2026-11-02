param([string]$VersionName='1.0.4',[string]$Serial='emulator-5570')
$ErrorActionPreference='Stop'
if ($Serial -ne 'emulator-5570') { throw 'Only the isolated reservation test emulator is permitted.' }
$root=Split-Path -Parent $PSScriptRoot
$adb=Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk/platform-tools/adb.exe'
$apk=Join-Path $root "releases/DapurOS-POS-$VersionName.apk"
$expectedHash=(Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLower()
$profiles=@(
 @{Name='phone';Size='1080x2400';Density='420';Rotation='0'},
 @{Name='xiaomi-landscape';Size='2032x3048';Density='320';Rotation='1'},
 @{Name='samsung-landscape';Size='1848x2960';Density='240';Rotation='1'}
)
foreach ($profile in $profiles) {
 & $adb -s $Serial shell wm size $profile.Size
 & $adb -s $Serial shell wm density $profile.Density
 & $adb -s $Serial shell settings put system accelerometer_rotation 0
 & $adb -s $Serial shell settings put system user_rotation $profile.Rotation
 $name=$profile.Name+'-reservation'
 $report=Join-Path $root "app/build/reports/$VersionName-native/$name"
 New-Item -ItemType Directory -Force -Path $report | Out-Null
 $output=& $adb -s $Serial shell am instrument -w -r -e class 'com.example.dapurospos.DapurOSReleaseFlowTest#reservationFormAndBusinessGate' -e profile $name com.dagangos.dapuros.test/androidx.test.runner.AndroidJUnitRunner
 $output | Set-Content -LiteralPath (Join-Path $report 'instrumentation.txt')
 if (!($output -join "`n").Contains('OK (1 test)')) { throw "Reservation verification failed: $name" }
 & $adb -s $Serial pull "/sdcard/Android/data/com.dagangos.dapuros/files/release-verification/$name/verification.json" (Join-Path $report 'verification.json')
 if ($LASTEXITCODE -ne 0) { throw 'Missing reservation evidence.' }
 $data=Get-Content -LiteralPath (Join-Path $report 'verification.json') -Raw | ConvertFrom-Json
 if ($data.status -ne 'passed' -or $data.checks.Count -ne 2) { throw 'Incomplete reservation evidence.' }
 $installedPath=(& $adb -s $Serial shell pm path com.dagangos.dapuros | Select-Object -First 1) -replace '^package:',''
 $installedHash=((& $adb -s $Serial shell sha256sum $installedPath) -split '\s+')[0].ToLower()
 if ($installedHash -ne $expectedHash) { throw 'Installed APK differs from reservation release.' }
 $data | Add-Member -NotePropertyName apkSha256 -NotePropertyValue $expectedHash -Force
 $data | Add-Member -NotePropertyName installedApkSha256 -NotePropertyValue $installedHash -Force
 $data | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $report 'verification.json')
 foreach ($check in $data.checks) {
  $label=($check -replace '[^a-zA-Z0-9]+','-')
  $file=$label.Substring(0,[Math]::Min(65,$label.Length))+'.png'
  & $adb -s $Serial pull "/sdcard/Android/data/com.dagangos.dapuros/files/release-verification/$name/$file" (Join-Path $report $file)
  if ($LASTEXITCODE -ne 0) { throw 'Missing reservation screenshot.' }
 }
 Write-Output "$name passed both groups"
}
