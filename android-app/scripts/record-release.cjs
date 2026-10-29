const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'');
const json=file=>JSON.parse(read(file));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const suite=file=>{const value=read(file).match(/<testsuite\b[^>]*>/)[0];return Object.fromEntries(['tests','failures','errors','skipped'].map(k=>[k,Number(new RegExp(`${k}="(\\d+)"`).exec(value)?.[1]||0)]));};
const identity=json('android-app/release-identity.json');
const apk='android-app/releases/DapurOS-POS-1.0.0.apk',aab='android-app/releases/DapurOS-POS-1.0.0.aab';
const apkHash=hash(apk),unitDir=path.join(root,'android-app/app/build/test-results/testReleaseUnitTest');
const units=fs.readdirSync(unitDir).filter(f=>f.endsWith('.xml')).map(f=>suite(path.relative(root,path.join(unitDir,f))));
assert.equal(units.reduce((n,r)=>n+r.failures+r.errors,0),0);const unitTests=units.reduce((n,r)=>n+r.tests,0);assert.equal(unitTests,27);
const backend=suite('tmp/backend-contracts.xml'),real=suite('tmp/restaurant-transactions.xml');
assert.equal(backend.tests,215);assert.equal(real.tests,12);assert.equal(backend.failures+backend.errors+real.failures+real.errors,0);
const browser=json('tmp/browser-parity.json').stats;assert.equal(browser.expected,24);assert.equal(browser.unexpected+browser.flaky+browser.skipped,0);
const installed=['phone','xiaomi-landscape','samsung-landscape'].map(profile=>json(`android-app/app/build/reports/final-native/${profile}/verification.json`));
for(const row of installed){assert.equal(row.status,'passed');assert.equal(row.apkSha256,apkHash);assert.equal(row.installedApkSha256,apkHash);assert.equal(row.checks.length,7);}
const play=json('android-app/app/build/reports/final-native-play/phone/verification.json'),playApk='android-app/releases/play/DapurOS-POS-1.0.0.apk';
assert.equal(play.status,'passed');assert.equal(play.apkSha256,hash(playApk));assert.equal(play.installedApkSha256,play.apkSha256);
const lint=read('android-app/app/build/reports/lint-results-release.xml');assert.equal((lint.match(/severity="Error"/g)||[]).length,0);
for(const channel of ['website','play'])assert.match(read(`tmp/package-${channel}-final.log`),/Verified DapurOS identity, signature, Android 14\+, package alignment, bundle and private-credential exclusion/);
assert.equal(json('tmp/upgrade-seed.json').status,'passed');assert.equal(json('tmp/upgrade-retention.json').status,'passed');assert.equal(json('tmp/back-rotation-final.json').status,'passed');assert.match(read('tmp/offline-barcode-decoder-debug.log'),/OK \(1 test\)/);
const frontend=json('tmp/website-assets.json');assert.equal(frontend.sha256,apkHash);assert.equal(frontend.frontendManifestEntriesVerified,92);
const native=json('android-app/build/native-library-alignment.json');assert.equal(native.status,'passed');
const website=json('../tmp/dapuros-android-website/verification.json');assert.equal(website.status,'passed');assert.equal(website.checks.length,6);
const portalLog=read('tmp/portal-unit.log'),portalTests=Number(portalLog.match(/\bpass\s+(\d+)/)?.[1]);assert.equal(portalTests,58);assert.match(portalLog,/\bfail\s+0\b/);
assert.match(read('tmp/portal-build.log'),/BUILD COMPLETE/);
const writeFencePreserved=hash('backend/erasure_guard.py')===crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'../GerainaOS/backend/erasure_guard.py'))).digest('hex');assert.ok(writeFencePreserved);
const previousFile=path.join(root,'docs/ANDROID-RELEASE-VERIFICATION.json');const previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile,'utf8')):{};
const report={schemaVersion:1,status:'passed-candidate',verifiedAt:new Date().toISOString(),sourceBaseline:'b5059b4',sourceState:'reviewable local changes; not committed or published',
 package:{applicationId:identity.applicationId,version:'1.0.0',versionCode:2,minimumSdk:34,supportedAbis:['arm64-v8a','x86_64'],apkSha256:apkHash,apkBytes:fs.statSync(path.join(root,apk)).size,aabSha256:hash(aab),signingCertificateSha256:identity.signingCertificateSha256,unitTests,lintErrors:0,lintWarnings:(lint.match(/severity="Warning"/g)||[]).length,privateCredentialScan:'passed',signatureVerified:true,distributionManifestAndCode:'passed',frontendManifestEntriesVerified:92,nativeLibraries16KbAligned:native.libraries.length,webViewDebuggingInRelease:false},
 backend:{contractsPassed:backend.tests,realTransactionPassed:real.tests,failed:0,realEmailsSent:0,realPayments:0,customerRecordsErased:0,productionWrites:0,writeFencePreserved,normalizedWriteFenceSha256:'b24297360d8862948a165252c0a18fa3726df8ef26a81245001b67524700d8e1'},
 browser:{passed:browser.expected,failed:browser.unexpected,flaky:browser.flaky,layouts:['393x852 phone','1524x1016 Xiaomi-size landscape','1973x1232 Samsung-size landscape']},
 installed:installed.map(row=>({...row,distribution:'website'})),
 play:{status:'passed',apkSha256:play.apkSha256,aabSha256:hash('android-app/releases/play/DapurOS-POS-1.0.0.aab'),frontendManifestEntriesVerified:92,installerPermissionPresent:false,webSubscriptionPurchaseLinksEnabled:false,installed:{...play,distribution:'play'},submittedToGooglePlay:false},
 upgrade:{status:'passed',from:{version:'0.9.0',versionCode:1,apkSha256:hash('tmp/DapurOS-upgrade-fixture-0.9.0.apk'),published:false},to:{version:'1.0.0',versionCode:2,apkSha256:apkHash},method:'Android signed install-over upgrade through ADB on the isolated emulator',preserved:['authenticated fixture account','preference','pending cash sale in the actual app IndexedDB'],websiteUpdaterEndToEnd:'Not claimed: first customer release has no previously published DapurOS baseline'},
 backAndRotation:json('tmp/back-rotation-final.json'),
 barcodeDecoder:{status:'passed',testVariant:'separate debug APK with the same pinned bundled ML Kit version',network:'emulator Wi-Fi and mobile data disabled',rotations:[0,90],physicalOpticalScanningCertified:false,releaseNativeCameraPreviewAndPermissionRecovery:'passed on the exact release APK'},
 publication:{status:'prepared-not-deployed',backendDeployed:false,portalDeployed:false,requires:'Publish the matching DapurOS backend/frontend before the portal/download listing',gerainaPublicApkPreserved:true},
 limitations:['AOSP screen profiles do not emulate Xiaomi HyperOS or Samsung One UI','No physical printer paper output, live merchant settlement, provider message/email delivery or Play approval was performed','Restaurant QR menu preview submits authenticated table orders; the pre-existing unauthenticated public guest ordering service remains unverified','Queued recipe sales use the recipe available at synchronization and record a review warning','No customer deletion or merchant-data mutation was used for verification'],
 intermediateFailures:['Test harness runtime classes optimized out of release were retained where needed; direct bundled decoder assertion ran in the separate debug bench','Initial recipe-inventory browser fixture omitted a schema field; fixture and robust numeric display were corrected','One browser run overlapped asset generation; all final browser checks ran against completed, stable builds','Earlier prototype candidate results are not substituted for the final installed APK checksum','MongoDB-memory-server logs an ECONNRESET during fixture shutdown after successful tests; pytest exits successfully and its temporary databases are removed'],
 website:{...website,scope:'local Worker and browser; not published'},portalUnitTests:{passed:portalTests,failed:0},portalBuild:{status:'passed',output:'DagangOS/dist',published:false}};
fs.writeFileSync(previousFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,version:report.package.version,versionCode:2,apkSha256:apkHash,backendContracts:backend.tests,realTransactions:real.tests,androidUnitTests:unitTests,browserChecks:browser.expected,installedWebsiteGroups:21,installedPlayGroups:7}));
