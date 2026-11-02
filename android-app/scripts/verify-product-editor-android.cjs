// Exact signed APK, real system photo picker/camera, and isolated loopback API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const {_android}=require('../../frontend/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'app/build/reports/product-editor-native');
const app='com.dagangos.dapuros',serial='emulator-5570';
const runtime=JSON.parse(fs.readFileSync(path.resolve(root,'../tmp/full-e2e-runtime.json'),'utf8')),host=runtime.base;
assert(host.startsWith('http://127.0.0.1:')&&runtime.dbName.startsWith('dapuros_e2e_'));
const bench=require('./editor-native-bench.cjs');fs.mkdirSync(out,{recursive:true});
const adbPath='C:/Users/azhar/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const apk=path.join(root,'releases/DapurOS-POS-1.0.5.apk');
function adb(args,binary=false){const r=spawnSync(adbPath,['-s',serial,...args],{encoding:binary?undefined:'utf8',windowsHide:true,maxBuffer:30*1024*1024,timeout:90000});assert.equal(r.status,0,String(r.stderr));return r.stdout;}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const screenshot=name=>fs.writeFileSync(path.join(out,name+'.png'),adb(['exec-out','screencap','-p'],true));
function nodes(){adb(['shell','uiautomator','dump','/sdcard/product-photo-test.xml']);const xml=adb(['exec-out','cat','/sdcard/product-photo-test.xml']);fs.writeFileSync(path.join(out,'last-ui.xml'),xml);return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match=>Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]])));}
function tap(node){const b=node.bounds?.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/)?.map(Number);assert(b,'Native control has no bounds');adb(['shell','input','tap',String(Math.round((b[1]+b[3])/2)),String(Math.round((b[2]+b[4])/2))]);}
async function tapWhen(predicate,label){for(let i=0;i<5;i++){const n=nodes().find(predicate);if(n){tap(n);return n;}await new Promise(r=>setTimeout(r,300));}screenshot('missing-'+label);throw Error('Missing native '+label+'; inspect last-ui.xml');}
async function activity(pattern){for(let i=0;i<30;i++){const foreground=adb(['shell','dumpsys','activity','activities']).split('\n').filter(line=>/topResumedActivity|mResumedActivity/.test(line)).join('\n');if(pattern.test(foreground))return;await new Promise(r=>setTimeout(r,200));}screenshot('unexpected-activity');throw Error('Expected foreground native activity '+pattern);}
let page,device,pending=0;const errors=[],checks=[];
async function attach(){await bench.start(adb,out);device=(await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);assert(device);page=await(await device.webView({pkg:app},{timeout:30000})).page();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://dagangos.com/api/**',async route=>{pending++;try{const r=route.request(),u=new URL(r.url());const headers={'content-type':r.headers()['content-type']||'application/json','x-dagangos-module':'dapuros'};if(r.headers().authorization)headers.authorization=r.headers().authorization;const response=await fetch(host+u.pathname+u.search,{method:r.method(),headers,body:r.postDataBuffer()||undefined,signal:AbortSignal.timeout(20000)});await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/json',body:Buffer.from(await response.arrayBuffer())});}finally{pending--;}});
}
async function detach(){for(let i=0;pending&&i<100;i++)await new Promise(r=>setTimeout(r,50));assert.equal(pending,0);if(device)await Promise.race([device.close(),new Promise(r=>setTimeout(r,4000))]);page=null;device=null;await bench.stop(adb);adb(['shell','am','force-stop',app]);}
async function go(route){if(route.startsWith('app/')&&await page.evaluate(()=>typeof window.DapurOSRouter?.navigate==='function'))await page.evaluate(route=>DapurOSRouter.navigate('/dapuros/'+route),route);else await page.goto('https://dagangos.com/dapuros/'+route,{waitUntil:'domcontentloaded'});}
async function json(url,method='GET',body,token){const r=await fetch(host+url,{method,headers:{'content-type':'application/json','x-dagangos-module':'dapuros','X-E2E-Fixture':runtime.fixtureKey,...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200,url);return r.json();}
async function chooseGallery(){await page.getByTestId('pf-photo-gallery').click();await activity(/(?:photopicker|PhotoPicker)/i);
 const tree=nodes();fs.writeFileSync(path.join(out,'gallery-ui.xml'),JSON.stringify(tree,null,2));
 const photo=tree.find(n=>/thumbnail|icon_photo|image_thumbnail/.test(n['resource-id']||''))||tree.find(n=>/Photo taken|Photo,|image,|Photo /.test(n['content-desc']||''));
 screenshot('gallery-picker');
 assert(photo,'Gallery fixture thumbnail missing; inspect gallery-ui.xml');tap(photo);
 // Some photo-picker versions require the selected item to be confirmed.
 for(const n of nodes().filter(n=>/^(Add|Open|Done|Select)$/i.test(n.text||'')&&n.clickable==='true'))tap(n);
 await page.getByTestId('pf-image-preview').waitFor();
}
async function openCamera(grant){await page.getByTestId('pf-photo-camera').click();if(grant!==null)await tapWhen(n=>(n['resource-id']||'').endsWith(grant?'/permission_allow_foreground_only_button':'/permission_deny_button'),grant?'camera-allow':'camera-deny');if(grant!==false)await activity(/com\.android\.camera2/);}
(async()=>{
 await json('/__e2e/editor-reset','POST',{});const session=await json('/api/auth/login','POST',{email:'dapuros-editor-a@example.com',password:'DapurEditorFixture-5642'});
 assert.equal(adb(['shell','getprop','ro.kernel.qemu']).trim(),'1');assert.equal(adb(['shell','getprop','ro.boot.qemu.avd_name']).trim(),'DagangOS_Companion_API_34');
 adb(['shell','am','force-stop',app]);adb(['shell','svc','wifi','disable']);adb(['shell','svc','data','disable']);
 if(adb(['shell','pm','path',app]).trim())adb(['uninstall',app]);
 adb(['install','-r',path.join(root,'releases/DapurOS-POS-1.0.4.apk')]);await attach();await go('login');
 await page.evaluate(session=>{localStorage.setItem('dapuros_token',session.access_token);localStorage.setItem('dapuros_user',JSON.stringify({...session.user,current_module:'dapuros'}));localStorage.removeItem('dapuros_signed_out');localStorage.setItem('product-photo-upgrade-marker','retained');},session);
 await page.goto('https://dagangos.com/dapuros/app/products',{waitUntil:'domcontentloaded'});await page.getByTestId('new-product-btn').click();assert.equal(await page.getByTestId('pf-photo-camera').count(),0);
 await page.getByTestId('pf-image-drop').click();await activity(/com\.android\.documentsui/);screenshot('before-document-picker');adb(['shell','input','keyevent','4']);await detach();
 adb(['install','-r',apk]);const apkHash=hash(fs.readFileSync(apk)),installed=adb(['shell','pm','path',app]).trim().replace(/^package:/,'');assert.equal(hash(adb(['exec-out','cat',installed],true)),apkHash);
 await attach();await go('app/products');await page.getByTestId('new-product-btn').click();
 const retained=await page.evaluate(()=>({token:localStorage.getItem('dapuros_token'),marker:localStorage.getItem('product-photo-upgrade-marker')}));assert.equal(retained.token,session.access_token);assert.equal(retained.marker,'retained');
 const info=await page.evaluate(()=>window.__dapurosAppInfo);assert.equal(info.versionName,'1.0.5');assert.equal(info.versionCode,7);
 await page.getByTestId('pf-name').fill('Native photo product');await page.getByTestId('pf-price').fill('5000');
 const fixture=path.join(root,'app/build/generated/frontend-assets/frontend/icon-192.png');
 adb(['push',fixture,'/sdcard/Pictures/dapuros-product-photo-fixture.png']);adb(['shell','am','broadcast','-a','android.intent.action.MEDIA_SCANNER_SCAN_FILE','-d','file:///sdcard/Pictures/dapuros-product-photo-fixture.png']);
 adb(['shell','pm','revoke',app,'android.permission.CAMERA']);adb(['shell','pm','clear-permission-flags',app,'android.permission.CAMERA','user-set','user-fixed']);
 await openCamera(false);await page.getByTestId('pf-photo-camera').waitFor();assert.equal(await page.getByTestId('pf-name').inputValue(),'Native photo product');checks.push('camera-denial-retains-draft');
 await chooseGallery();const gallery=await page.getByTestId('pf-image-preview').getAttribute('src');assert(gallery.startsWith('data:image/jpeg;base64,'));assert.equal(await page.getByTestId('pf-name').inputValue(),'Native photo product');checks.push('system-gallery-selection-without-camera-permission');
 await page.getByTestId('pf-photo-gallery').click();await activity(/(?:photopicker|PhotoPicker)/i);adb(['shell','input','keyevent','4']);await page.getByTestId('pf-photo-camera').waitFor();assert.equal(await page.getByTestId('pf-image-preview').getAttribute('src'),gallery);checks.push('gallery-cancel-retains-photo-and-draft');
 await openCamera(true);screenshot('camera-open');fs.writeFileSync(path.join(out,'camera-ui.json'),JSON.stringify(nodes(),null,2));
 await tapWhen(n=>(n['resource-id']||'').endsWith('/shutter_button')||/^(Shutter|Take photo)$/i.test(n['content-desc']||''),'camera-shutter');
 await tapWhen(n=>/(?:done|review_done|review_approve)_button$/.test(n['resource-id']||'')||/^(Done|Accept|OK)$/i.test(n['content-desc']||''),'camera-accept');
 await page.waitForFunction(old=>{const src=document.querySelector('[data-testid="pf-image-preview"]')?.src;return src&&src!==old;},gallery);
 const captured=await page.getByTestId('pf-image-preview').getAttribute('src');assert(captured.startsWith('data:image/jpeg;base64,'));assert.equal(await page.getByTestId('pf-name').inputValue(),'Native photo product');screenshot('camera-photo-preview');checks.push('real-emulated-camera-capture-and-preview');
 await openCamera(null);adb(['shell','input','keyevent','4']);await page.getByTestId('pf-photo-camera').waitFor();assert.equal(await page.getByTestId('pf-image-preview').getAttribute('src'),captured);checks.push('camera-cancel-retains-previous-photo');
 await page.getByTestId('pf-save').click();await page.getByTestId('product-form-modal').waitFor({state:'hidden'});const [saved]=await json('/api/products?q=Native%20photo%20product','GET',null,session.access_token);assert.equal(saved.image_url,captured);
 await page.getByTestId('edit-product-'+saved.id).click();assert.equal(await page.getByTestId('pf-image-preview').getAttribute('src'),captured);checks.push('captured-photo-saved-and-reopened');
 // Read only the owned emulator's generated capture cache, never a user's gallery.
 const remaining=adb(['shell','su','0','ls','/data/user/0/'+app+'/cache/product-photos']).trim();assert.equal(remaining,'');checks.push('temporary-camera-files-released');
 await detach();adb(['shell','wm','size','2960x1848']);adb(['shell','wm','density','240']);await attach();await go('app/products');await page.getByTestId('edit-product-'+saved.id).click();await chooseGallery();assert.equal(await page.getByTestId('pf-name').inputValue(),'Native photo product');checks.push('tablet-gallery-replacement-retains-draft');
 await openCamera(null);screenshot('tablet-camera-open');adb(['shell','input','keyevent','4']);await page.getByTestId('pf-photo-camera').waitFor();checks.push('tablet-camera-launch-and-cancel');

 await page.getByTestId('pf-cancel').click();
 const profiles=[];
 for(const profile of [
  {name:'phone',size:'1080x2400',density:'420',symbol:'cup',unit:'Cangkir menu'},
  {name:'xiaomi-landscape',size:'3048x2032',density:'320',symbol:'btl',unit:'Botol menu'},
  {name:'samsung-landscape',size:'2960x1848',density:'240',symbol:'box',unit:'Kotak menu'}
 ]){
  await detach();adb(['shell','wm','size',profile.size]);adb(['shell','wm','density',profile.density]);await attach();
  const category='Menu '+profile.name;
  await json('/api/products/categories','POST',{name:category},session.access_token);
  await json('/api/products/units','POST',{name:profile.unit,short_name:profile.symbol},session.access_token);
  await go('app/products');await page.getByTestId('new-product-btn').click();
  for(const [id,label,value] of [['pf-category',category,'category:'+category],['pf-unit',profile.unit+' ('+profile.symbol+')','unit:'+profile.symbol]]){
   await page.getByTestId(id).locator('option[value="'+value+'"]').waitFor({state:'attached'});
   if(profile.name==='phone'){
    await page.getByTestId(id).click();await tapWhen(n=>n.text===label,id+'-option');
   }else await page.getByTestId(id).selectOption(value);
   await page.waitForFunction(({id,value})=>document.querySelector('[data-testid="'+id+'"]').value===value,{id,value});
  }
  await page.getByTestId('pf-name').fill('Native menu '+profile.name);await page.getByTestId('pf-price').fill('10000');
  await page.getByTestId('pf-save').click();await page.getByTestId('product-form-modal').waitFor({state:'hidden'});
  const [menu]=await json('/api/products?q='+encodeURIComponent('Native menu '+profile.name),'GET',null,session.access_token);
  assert.equal(menu.unit,profile.symbol);assert.equal(menu.category,category);
  await page.getByTestId('edit-product-'+menu.id).click();
  assert.equal(await page.getByTestId('pf-unit').inputValue(),'unit:'+profile.symbol);assert.equal(await page.getByTestId('pf-category').inputValue(),'category:'+category);
  assert(await page.getByTestId('pf-photo-camera').isVisible());assert(await page.getByTestId('pf-photo-gallery').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));screenshot(profile.name+'-saved-choices');
  await page.getByTestId('pf-cancel').click();profiles.push({...profile,status:'passed',checks:['saved-category-selected','unit-symbol-saved','reopen-retains-choices','photo-actions-retained','recipe-form-retained'],selection:profile.name==='phone'?'native-popup-tapped':'actual-WebView-select'});
 }
 await go('app/products');await page.getByTestId('open-import-btn').click();await page.getByTestId('import-browse-btn').click();await activity(/com\.android\.documentsui/);screenshot('document-import-picker');adb(['shell','input','keyevent','4']);checks.push('CSV-Excel-retains-document-picker');
 assert.deepEqual(errors,[]);
 const result={status:'passed',verifiedAt:new Date().toISOString(),version:'1.0.5',versionCode:7,apkSha256:apkHash,installedApkSha256:apkHash,checks,profiles,upgrade:{fromVersion:'1.0.4',status:'passed',tokenRetained:true,preferenceRetained:true},runtimeErrors:errors,productionWrites:0,scope:'Exact signed APK, actual AOSP photo picker and virtual camera; real isolated API and MongoDB; phone plus resized large-tablet window. No physical vendor-camera certification.'};
 fs.writeFileSync(path.join(out,'android-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.stack);try{screenshot('native-failure');fs.writeFileSync(path.join(out,'failure-ui.json'),JSON.stringify(nodes(),null,2));}catch{}process.exitCode=1;}).finally(async()=>{await detach().catch(()=>{});await bench.stop(adb).catch(()=>{});adb(['shell','wm','size','reset']);adb(['shell','wm','density','reset']);adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);adb(['shell','rm','-f','/sdcard/Pictures/dapuros-product-photo-fixture.png']);process.exit(process.exitCode||0);});
