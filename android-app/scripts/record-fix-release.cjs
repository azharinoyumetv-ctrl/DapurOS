const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),version='1.0.1';
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'');
const json=file=>JSON.parse(read(file));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const suite=file=>{const tag=read(file).match(/<testsuite\b[^>]*>/)[0];return Object.fromEntries(['tests','failures','errors'].map(key=>[key,Number(new RegExp(`${key}="(\\d+)"`).exec(tag)?.[1]||0)]));};
const apk=`android-app/releases/DapurOS-POS-${version}.apk`,sha=hash(apk),identity=json('android-app/release-identity.json');
const contracts=suite('tmp/1.0.1-backend-contracts.xml'),geraina=suite('tmp/1.0.1-geraina-entitlements.xml'),transactions=suite('tmp/1.0.1-restaurant-transactions.xml');
assert.equal(contracts.tests,237);assert.equal(geraina.tests,22);assert.equal(transactions.tests,12);
assert.equal(contracts.failures+contracts.errors+geraina.failures+geraina.errors+transactions.failures+transactions.errors,0);
const browser=json('tmp/1.0.1-browser.json').stats;assert.equal(browser.expected,33);assert.equal(browser.unexpected+browser.flaky+browser.skipped,0);
const installed=['phone','xiaomi-landscape','samsung-landscape'].map(profile=>json(`android-app/app/build/reports/${version}-native/${profile}/verification.json`));
const subscriptionTheme=['phone','xiaomi-landscape','samsung-landscape'].map(profile=>json(`android-app/app/build/reports/${version}-native/${profile}-billing/verification.json`));
for(const row of [...installed,...subscriptionTheme]){assert.equal(row.status,'passed');assert.equal(row.apkSha256,sha);assert.equal(row.installedApkSha256,sha);}
assert.equal(installed.reduce((n,row)=>n+row.checks.length,0),21);assert.equal(subscriptionTheme.reduce((n,row)=>n+row.checks.length,0),6);
const units=fs.readdirSync(path.join(root,'android-app/app/build/test-results/testReleaseUnitTest')).filter(file=>file.endsWith('.xml')).map(file=>suite('android-app/app/build/test-results/testReleaseUnitTest/'+file));
assert.equal(units.reduce((n,row)=>n+row.tests,0),27);assert.equal(units.reduce((n,row)=>n+row.failures+row.errors,0),0);
const lint=read('android-app/app/build/reports/lint-results-release.xml');assert.equal((lint.match(/severity="Error"/g)||[]).length,0);
assert.match(read('tmp/1.0.1-package-website.log'),/Verified DapurOS identity, signature, Android 14\+, package alignment, bundle and private-credential exclusion/);
const assets=json('tmp/1.0.1-website-assets.json');assert.equal(assets.sha256,sha);assert.equal(assets.frontendManifestEntriesVerified,92);assert.equal(json('tmp/1.0.1-bundle-assets.json').frontendManifestEntriesVerified,92);
const retained=json('tmp/1.0.1-final-pending-retention.json');assert.equal(retained.status,'passed');
const fence=crypto.createHash('sha256').update(read('backend/erasure_guard.py').replaceAll('\r\n','\n')).digest('hex');
assert.equal(fence,'b24297360d8862948a165252c0a18fa3726df8ef26a81245001b67524700d8e1');
const output=path.join(root,'docs/ANDROID-1.0.1-VERIFICATION.json');
const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{};
const report={schemaVersion:1,status:previous.publication?.status==='published'?'passed-published':'passed-candidate',verifiedAt:new Date().toISOString(),nativeEvidenceDirectory:`${version}-native`,
 package:{applicationId:identity.applicationId,version,versionCode:3,minimumSdk:34,supportedAbis:['arm64-v8a','x86_64'],apkSha256:sha,apkBytes:fs.statSync(path.join(root,apk)).size,aabSha256:hash(`android-app/releases/DapurOS-POS-${version}.aab`),signingCertificateSha256:identity.signingCertificateSha256,unitTests:27,lintErrors:0,lintWarnings:(lint.match(/severity="Warning"/g)||[]).length,privateCredentialScan:'passed',frontendManifestEntriesVerified:92},
 backend:{contractsPassed:contracts.tests,gerainaProductIsolationPassed:geraina.tests,realTransactionPassed:transactions.tests,failed:0,realPayments:0,realEmailsSent:0,customerRecordsErased:0,writeFencePreserved:true,normalizedWriteFenceSha256:fence},
 browser:{passed:33,failed:0,flaky:0},installed,subscriptionTheme,
 upgrade:{status:'passed',baselineVersion:'1.0.0',finalVersion:version,baselineReceipt:'OFF-86F13D299EAD44CD',pendingSaleId:'86f13d29-9ead-44cd-b0a2-8466d95cae75',pendingAmount:11000,baselineScreenshot:'tmp/1.0.1-upgrade-seed.png',finalInstalledApkSha256:sha,evidence:retained},
 fixes:['Each product resolves its own paid subscription, trial clock and store membership','Legacy global plans apply only to the original positively bound store; ambiguous unlabelled stores require verification','Legacy trial/upgrade endpoint cannot rewrite shared account entitlements','Cached account details must carry the current product before offline reuse','DapurOS uses its own colors in WebView UI, native controls and system bar background','Trial upgrade offers Starter, Pro and Business without a second free-trial card'],
 limitations:['No customer records were migrated or rewritten to infer ownership of an ambiguous legacy store','The first launch after upgrading an unstamped legacy session requires online revalidation; pending IndexedDB sales remain stored','Screen profiles are AOSP emulators, not physical Xiaomi/Samsung firmware','No live charge, settlement, email delivery or physical printer output was performed','The pre-existing unauthenticated public guest QR ordering service remains unverified'],
 verificationRepairs:['The original upgrade harness used a missing localStorage test marker; the exact pre-upgrade receipt UUID and amount were verified in final IndexedDB instead','Native assertions now wait for the new login document and loaded payment settings; screenshot capture waits for rendering only when the WebView is focused','Theme assertions compare the resolved CSS brand color, avoiding a one-channel RGB rounding assumption'],
 ...(previous.publication?{publication:previous.publication}:{})};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,version,apkSha256:sha,backendContracts:237,gerainaIsolation:22,browser:33,nativeGroups:27}));
