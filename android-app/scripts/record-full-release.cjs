// Refuse to stage a release without evidence from its exact signed APK.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),version='1.0.3';
const read=file=>fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'');
const json=file=>JSON.parse(read(file));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const suite=file=>{
 const tag=read(file).match(/<testsuite\b[^>]*>/)[0];
 return Object.fromEntries(['tests','failures','errors','skipped'].map(key=>[key,Number(new RegExp(`${key}="(\\d+)"`).exec(tag)?.[1]||0)]));
};
const passedBrowser=(file,minimum)=>{
 const stats=json(file).stats;assert.ok(stats.expected>=minimum,file);assert.equal(stats.unexpected+stats.flaky+stats.skipped,0,file);return stats.expected;
};
const apk=`android-app/releases/DapurOS-POS-${version}.apk`,sha=hash(apk),identity=json('android-app/release-identity.json');
const regression=suite('tmp/full-e2e-contracts.xml');assert.equal(regression.tests,249);assert.equal(regression.failures+regression.errors+regression.skipped,0);
const transactionCount=(read('tmp/full-e2e-contracts.xml').match(/classname="backend.tests.test_restaurant_release"/g)||[]).length;assert.equal(transactionCount,12);
const socketCount=Number(read('tmp/full-e2e-sockets.log').match(/\b(\d+) passed,/)?.[1]);assert.equal(socketCount,21);assert.doesNotMatch(read('tmp/full-e2e-sockets.log'),/\d+ failed/);
const fullStack=passedBrowser('tmp/full-e2e-final.json',23),browser=passedBrowser('tmp/full-e2e-final-android-parity.json',33),companionBrowser=passedBrowser('tmp/full-e2e-final-companion-browser.json',16);
const profiles=['phone','xiaomi-landscape','samsung-landscape'];
const installed=profiles.map(profile=>json(`android-app/app/build/reports/${version}-native/${profile}/verification.json`));
const subscriptionTheme=profiles.map(profile=>json(`android-app/app/build/reports/${version}-native/${profile}-billing/verification.json`));
for(const [rows,count] of [[installed,7],[subscriptionTheme,2]])for(const row of rows){assert.equal(row.status,'passed');assert.equal(row.checks.length,count);assert.equal(row.apkSha256,sha);assert.equal(row.installedApkSha256,sha);}
const companionSwitching=profiles.map(profile=>json(`../tmp/companion-native/dapuros-${profile}.json`));
for(const row of companionSwitching){assert.equal(row.status,'passed');assert.equal(row.version,version);assert.equal(row.installedApkSha256,sha);assert.equal(row.sessionRetained,true);assert.equal(row.documentRetained,true);}
const startupRecovery=json('../tmp/companion-native/dapuros-startup-recovery.json');assert.equal(startupRecovery.status,'passed');assert.equal(startupRecovery.installedApkSha256,sha);
assert.match(read('../tmp/companion-native/dapuros-phone-missing-missingCompanionOffersDownloadBrowserAndCancel.txt'),/OK \(1 test\)/);
const seed=json(`tmp/${version}-upgrade-seed.json`),upgrade=json(`android-app/app/build/reports/${version}-native/upgrade/verification.json`);
assert.match(seed.client_order_id,/^[0-9a-f-]{36}$/);assert.equal(upgrade.status,'passed');assert.equal(upgrade.installedApkSha256,sha);
const unitDirectory='android-app/app/build/test-results/testReleaseUnitTest';
const units=fs.readdirSync(path.join(root,unitDirectory)).filter(file=>file.endsWith('.xml')).map(file=>suite(unitDirectory+'/'+file));
const unitTests=units.reduce((sum,row)=>sum+row.tests,0);assert.ok(unitTests>=28);assert.equal(units.reduce((sum,row)=>sum+row.failures+row.errors+row.skipped,0),0);
const lint=read('android-app/app/build/reports/lint-results-release.xml');assert.equal((lint.match(/severity="Error"/g)||[]).length,0);
assert.match(read(`tmp/${version}-package-website.log`),/Verified DapurOS identity, signature, Android 14\+, package alignment, bundle and private-credential exclusion/);
const assets=json(`tmp/${version}-website-assets.json`),bundle=json(`tmp/${version}-bundle-assets.json`);assert.equal(assets.sha256,sha);assert.ok(assets.frontendManifestEntriesVerified>=92);assert.equal(bundle.frontendManifestEntriesVerified,assets.frontendManifestEntriesVerified);
const fence=crypto.createHash('sha256').update(read('backend/erasure_guard.py').replaceAll('\r\n','\n')).digest('hex');assert.equal(fence,'b24297360d8862948a165252c0a18fa3726df8ef26a81245001b67524700d8e1');
assert.equal(hash('../GerainaOS/frontend/src/pages/payments/PaymentConfig.jsx'),'5780f06c5e6508d8383eda9ddb638ed520e6e3b5f06fc406c36c1e99b520052d');
const portalLog=read('../tmp/full-e2e-final-portal-tests.log');assert.match(portalLog,/\bpass\s+65\b/);assert.match(portalLog,/\bfail\s+0\b/);
const output=path.join(root,`docs/ANDROID-${version}-VERIFICATION.json`),previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):{};
const report={schemaVersion:1,status:previous.publication?.status==='published'?'passed-published':'passed-candidate',verifiedAt:new Date().toISOString(),sourceBaseline:'dae457c',nativeEvidenceDirectory:`${version}-native`,
 package:{applicationId:identity.applicationId,version,versionCode:5,minimumSdk:34,supportedAbis:['arm64-v8a','x86_64'],apkSha256:sha,apkBytes:fs.statSync(path.join(root,apk)).size,aabSha256:hash(`android-app/releases/DapurOS-POS-${version}.aab`),signingCertificateSha256:identity.signingCertificateSha256,unitTests,lintErrors:0,lintWarnings:(lint.match(/severity="Warning"/g)||[]).length,privateCredentialScan:'passed',frontendManifestEntriesVerified:assets.frontendManifestEntriesVerified},
 backend:{contractsPassed:regression.tests-transactionCount,realTransactionPassed:transactionCount,socketAndIntegrityPassed:socketCount,failed:0,realPayments:0,realEmailsSent:0,customerRecordsErased:0,writeFencePreserved:true,normalizedWriteFenceSha256:fence},
 fullStack:{passed:fullStack,failed:0,canonicalScreens:58,transport:'Real local FastAPI and disposable MongoDB replica; browser socket disabled to exercise HTTP fallback',catalogueItems:618},
 browser:{passed:browser,companionSessionsPassed:companionBrowser,failed:0,flaky:0},installed,subscriptionTheme,companionSwitching,startupRecovery,
 upgrade:{status:'passed',baselineVersion:'1.0.2',finalVersion:version,pendingSaleId:seed.client_order_id,baselineReceipt:seed.receipt,finalInstalledApkSha256:sha,evidence:upgrade},
 portalUnitTests:{passed:65,failed:0},
 fixes:['Demo ordering UI, sample database, fake payment generation and unsigned simulation routes removed','Atomic menu, recipe, inventory adjustment, stock transfer and purchase receiving writes','Complete paged catalogues and record lists; bounded rows and recovery from partial read failures','Saved sale costs, paid-only reporting and actual recorded tax export','Public guest table ordering, price validation, retry recovery and revocable QR links','Recoverable split payments, stale-bill protection and quantity-aware kitchen cancellation','Idempotent debt payments, synchronized supplier invoices and protected earned customer points','Atomic employee and device capacities, staff lifecycle and server-enforced access restrictions','Existing independent subscriptions, product themes, sessions and native companion-app launch preserved'],
 limitations:['No physical printer paper output, live merchant settlement, provider email/message delivery or Play submission was performed','Screen profiles run on an isolated AOSP Android 14 emulator, not physical Xiaomi or Samsung firmware','Legacy sales without saved costs are reported as unknown rather than recalculated from current product costs','Old inventory history may lack movements recorded before this release; new movements are written atomically','Offline recipe sales reconcile using the recipe at synchronization and flag shortages for staff review'],
 ...(previous.publication?{publication:previous.publication}:{})};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,version,apkSha256:sha,fullStack,browser,backendChecks:regression.tests,socketAndIntegrity:socketCount,nativeGroups:27}));
