// Exact signed APK with a disposable DapurOS API; never contacts a payment provider.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process'), {createHash} = require('node:crypto');
const {_android} = require('../../frontend/node_modules/playwright');
const bench = require('./editor-native-bench.cjs');
const runtime = JSON.parse(fs.readFileSync(path.join(__dirname, '../../tmp/full-e2e-runtime.json')));
assert(runtime.base.startsWith('http://127.0.0.1:') && runtime.dbName.startsWith('dapuros_e2e_'));
const serial = 'emulator-5570', app = 'com.dagangos.dapuros';
const adbExe = 'C:/Users/azhar/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const apk = path.resolve(process.argv[2] || path.join(__dirname, '../releases/DapurOS-POS-1.0.8.apk'));
const output = path.join(__dirname, '../app/build/reports/table-payment-native');
fs.mkdirSync(output, {recursive:true});

function adb(args) {
  const result = spawnSync(adbExe, ['-s', serial, ...args], {encoding:'utf8', windowsHide:true, timeout:90000});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
async function api(url, data, headers = {}) {
  const response = await fetch(runtime.base + url, {method:data === undefined ? 'GET' : 'POST',
    headers:{'Content-Type':'application/json','X-DagangOS-Module':'dapuros', ...headers},
    body:data === undefined ? undefined : JSON.stringify(data)});
  if(!response.ok) throw Error(`${url}: ${response.status} ${await response.text()}`);
  return response.json();
}
async function until(operation, message) {
  for(let i=0;i<50;i++) { if(await operation()) return; await new Promise(r=>setTimeout(r, 300)); }
  throw Error(message);
}
let device, safeEmulator=false;
(async()=>{
  assert.equal(adb(['shell','getprop','ro.boot.qemu.avd_name']), 'DagangOS_Companion_API_34');
  safeEmulator=true;
  adb(['shell','svc','wifi','disable']); adb(['shell','svc','data','disable']);
  const fixture = {'X-E2E-Fixture':runtime.fixtureKey};
  await api('/__e2e/editor-reset', {}, fixture);
  const session = await api('/api/auth/login', {email:'dapuros-editor-a@example.com', password:'DapurEditorFixture-5642'});
  const auth = {Authorization:'Bearer '+session.access_token};
  const store = session.user.store_id;
  await api('/__e2e/gateway', {store_id:store}, fixture);
  const floor = await api('/api/floors', {name:'Fixture Hall'}, auth);
  const table = await api('/api/tables', {floor_id:floor.id,label:'Meja Gateway',capacity:4}, auth);
  const ingredient = await api('/api/ingredients', {name:'Native Kaldu',unit:'L',stock:0.3}, auth);
  const dish = await api('/api/products', {name:'Native Sup Kaldu',price:10000,stock:0,
    recipe:[{ingredient_id:ingredient.id,quantity:0.1}]}, auth);
  const opened = await api(`/api/tables/${table.id}/session`, {}, auth);
  await api('/api/orders', {session_id:opened.id, payment_method:'cash',
    items:[{product_id:'product-0000', name:'Legacy product', price:1000, quantity:2, subtotal:2000}]}, auth);

  adb(['install','-r',apk]);
  const installed = adb(['shell','pm','path',app]).split('\n')[0].replace('package:','');
  const sha256 = createHash('sha256').update(fs.readFileSync(apk)).digest('hex');
  assert.equal(adb(['shell','sha256sum',installed]).split(' ')[0], sha256);
  await bench.start(adb, output);
  device = (await _android.devices({omitDriverInstall:true})).find(d=>d.serial()===serial);
  assert(device);
  const page = await (await device.webView({pkg:app},{timeout:30000})).page();
  page.setDefaultTimeout(20000);
  // The API is online through the isolated route below while Android radios are off.
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', {get:()=>true}));
  await page.route('https://dagangos.com/api/**', async route=>{
    const req=route.request(), url=new URL(req.url()), headers={...req.headers()};
    delete headers.host; delete headers['content-length'];
    const response=await fetch(runtime.base+url.pathname+url.search,{method:req.method(),headers,body:req.postDataBuffer()||undefined});
    await route.fulfill({status:response.status,contentType:response.headers.get('content-type')||'application/json',body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto('https://dagangos.com/dapuros/login',{waitUntil:'domcontentloaded'});
  await page.evaluate(session=>{
    localStorage.setItem('dapuros_token',session.access_token);
    localStorage.setItem('dapuros_user',JSON.stringify({...session.user,current_module:'dapuros'}));
    localStorage.removeItem('dapuros_signed_out');
  },session);
  await page.goto('https://dagangos.com/dapuros/app/pos',{waitUntil:'domcontentloaded'});
  const {today} = await api('/api/tables/schedule', undefined, auth);
  const future = new Date(Date.parse(today+'T00:00:00Z') + 2 * 86400000).toISOString().slice(0,10);
  await page.getByTestId('reservation-calendar-open').click();
  await page.getByTestId('calendar-new').click();
  await page.getByTestId('calendar-start').fill(future+'T19:30');
  await page.getByTestId('calendar-table').selectOption(table.id);
  await page.getByTestId('calendar-name').fill('Native Tamu Kalender');
  await page.getByTestId('calendar-save').click();
  await page.getByText('Native Tamu Kalender',{exact:true}).waitFor();
  const calendar = await api('/api/tables/schedule?day='+future, undefined, auth);
  assert.equal(calendar.bookings[0].table_id,table.id);
  assert.equal((await api(`/api/tables/${table.id}/session`,undefined,auth)).session.id,opened.id);
  await page.getByTestId('reservation-calendar').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByText('Langsung Takeaway',{exact:false}).click();
  const dishCard = page.getByTestId('pos-product-'+dish.id);
  for (const portions of [3, 2, 1]) {
    await dishCard.getByText(portions+' porsi',{exact:true}).waitFor();
    await dishCard.click();
    const mobileCart = page.getByTestId('mobile-cart-open');
    if (await mobileCart.isVisible()) await mobileCart.click();
    await page.getByTestId('cart-cash-received').fill('20000');
    await page.getByTestId('checkout-btn').click();
    await page.getByTestId('receipt-close').click();
  }
  await dishCard.getByText('Bahan habis',{exact:true}).waitFor();
  const orders = await api('/api/orders', undefined, auth);
  assert.equal(orders.filter(order=>order.items.some(item=>item.product_id===dish.id)).length,3);
  await page.goto('https://dagangos.com/dapuros/app/pos',{waitUntil:'domcontentloaded'});
  await page.getByText(table.label,{exact:true}).click();
  await page.getByTestId('settle-open-btn').click();
  await page.getByTestId('settle-va').click();
  const link=page.getByTestId('table-gateway-open');
  await link.waitFor();
  const {gateway_payment:payment}=await api(`/api/tables/${table.id}/session`,undefined,auth);
  assert.equal(payment.total,2310);
  assert.equal(await link.getAttribute('href'),payment.gateway_checkout_url);
  await link.click({noWaitAfter:true});
  await until(()=>adb(['shell','dumpsys','activity','activities']).includes(payment.gateway_checkout_url),
    'Android did not hand off the checkout link to an external activity.');
  adb(['shell','input','keyevent','4']);
  await api('/api/webhooks/xendit',{event:'payment_session.completed',data:{reference_id:payment.reference,
    payment_session_id:'fixture-'+payment.reference,session_type:'PAY',currency:'IDR',amount:2310,status:'COMPLETED'}},
    {'x-callback-token':'fixture-'+store});
  // The WebView's external navigation is intercepted by Android; Playwright's
  // navigation waiter may still wait for a document that will never load here.
  await until(()=>page.evaluate(()=>document.querySelector('[data-testid="table-gateway-status"]')?.textContent
    .includes('Pembayaran diterima. Meja sudah ditutup.')), 'The app did not show verified settlement after returning.');
  const tables=await api('/api/tables',undefined,auth);
  assert.equal(tables.find(t=>t.id===table.id).status,'Vacant');
  const result={status:'passed',apkSha256:sha256,checks:['signed-app-installed','native-external-payment-handoff',
    'merchant-confirmation-closes-table','three-native-cash-sales-deduct-fractional-recipe','sold-out-recipe-stays-visible',
    'future-reservation-created-in-android-with-live-session-intact'],productionCharges:0};
  fs.writeFileSync(path.join(output,'verification.json'), JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{
  if(!safeEmulator)return;
  if(device) await Promise.race([device.close(),new Promise(r=>setTimeout(r,3000))]).catch(()=>{});
  await bench.stop(adb).catch(()=>{});
  adb(['shell','am','force-stop',app]);
  adb(['shell','svc','wifi','enable']);adb(['shell','svc','data','enable']);
});
