const {test,expect} = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),origin='https://dagangos.com';
const assets=path.join(root,'android-app/app/src/main/assets');
const css=['mobile-ui.css','mobile-support.css'].map(f=>fs.readFileSync(path.join(assets,f),'utf8')).join('\n');
const native=['android-bridge.js','device-features.js','mobile-support.js','mobile-ui.js'].map(f=>fs.readFileSync(path.join(assets,f),'utf8').replace('__GERAINA_MOBILE_STYLE__',JSON.stringify(css))).join('\n');

async function fixture(page,context,{role='Owner',delay=0,offlineFail=false,plan='business'}={}) {
  const user={id:'browser-fixture',store_id:'browser-store',email:'browser@example.invalid',store_name:'DapurOS Fixture',role,plan,trial_ends_at:'2099-01-01T00:00:00Z',stores:[{module:'dapuros',store_id:'browser-store'}]};
  const products=Array.from({length:70},(_,i)=>({id:'menu-'+i,name:'Menu resep '+i,sku:'899TEST'+i,price:10000,stock:100,category:'Minuman',recipe:[{ingredient_id:'beans',quantity:15}]}));
  const errors=[],writes=[],replays=[];let fail=offlineFail;
  await context.addInitScript({content:`window.__dapurosSubscriptionPurchases=true;window.__dapurosAppInfo={versionName:'1.0.0',versionCode:1,updateChannel:'website'};window.DapurOSNative={postMessage:message=>{(window.__nativeMessages||=[]).push(JSON.parse(message));}};${native}`});
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin)return route.fulfill({status:403,body:'External traffic blocked by fixture'});
    if(url.pathname.startsWith('/api/')){
      if(req.method()!=='GET')writes.push({method:req.method(),path:url.pathname,body:req.postDataJSON()});
      let body=[];let status=200;
      switch(url.pathname){
        case '/api/auth/me':if(delay)await new Promise(r=>setTimeout(r,delay));body=user;break;
        case '/api/auth/login':body={access_token:'browser-fixture-token',user};break;
        case '/api/products':body=products;break;
        case '/api/products/catalogue':body={items:products,total:products.length,next_cursor:null};break;
        case '/api/products/category-names':body=['Minuman'];break;
        case '/api/products/units':body=[{id:'pcs',name:'Pcs',short_name:'pcs'}];break;
        case '/api/ingredients':body=[{id:'beans',name:'Biji kopi',unit:'g',stock:2000,safety_stock:500}];break;
        case '/api/floors':body=[{id:'floor',name:'Lantai 1',level:1}];break;
        case '/api/tables':body=[{id:'table',floor_id:'floor',label:'Meja 1',capacity:4,status:'Vacant'}];break;
        case '/api/payments/options':body={methods:{cash:{enabled:true,displayed:true},qris_bank:{enabled:false},ewallet:{enabled:false},va:{enabled:false},credit_card:{enabled:false},doku:{enabled:false}},ewallet_channels:[]};break;
        case '/api/payments/config':body={cash:{is_active:true}};break;
        case '/api/orders/stats':body={today_sales:0,today_orders:0,week_sales:0,month_sales:0,product_count:products.length};break;
        case '/api/settings':body={general:{store_name:user.store_name,timezone:'Asia/Jakarta'},receipt:{footer_text:'Fixture'},printer:{mode:'local',paper_size:'80mm'}};break;
        case '/api/subscriptions/current':body={billing_model:'prepaid',auto_renew:false,can_manage:role==='Owner',plan,subscription:plan==='business'?{tier:'business',status:'active',active:true,expires_at:'2099-01-01T00:00:00Z'}:null,addons:{offers:[],purchases:[]}};break;
        case '/api/support/context':body={customer_email:user.email,recipient:'contact@dagangos.com',store_name:user.store_name,delivery_ready:false};break;
        case '/api/offline/orders':{
          const sale=req.postDataJSON();replays.push(sale.client_order_id);
          body=fail?{detail:'Offline fixture'}:{...sale,id:sale.client_order_id,store_id:sale.expected_store_id,order_no:'DP-FIXTURE',payment_status:'paid',total:11000,subtotal:10000,tax_amount:1000,created_at:sale.sold_at};status=fail?503:200;break;
        }
        default:if(url.pathname.startsWith('/api/records/'))body={items:[],total:0,next_cursor:null};if(req.method()!=='GET'){status=403;body={detail:'Fixture blocks unapproved writes'};}
      }
      return route.fulfill({status,json:body});
    }
    if(url.pathname==='/dapuros/pricing'){
      const worker=(await import(pathToFileURL(path.join(root,'../src/index.js')).href)).default;
      const response=await worker.fetch(new Request(url.href),{ASSETS:{fetch:async request=>{
        const file=path.join(root,'../public',new URL(request.url).pathname);
        return fs.existsSync(file)?new Response(fs.readFileSync(file)):new Response('Missing',{status:404});
      }}},{});
      return route.fulfill({status:response.status,contentType:'text/html',body:await response.text()});
    }
    const publicFile=path.join(root,'../public',url.pathname);
    if(!url.pathname.startsWith('/dapuros/static/')&&fs.existsSync(publicFile)&&fs.statSync(publicFile).isFile())return route.fulfill({path:publicFile});
    const rel=url.pathname.startsWith('/dapuros/static/')?url.pathname.slice('/dapuros/'.length):url.pathname.startsWith('/assets/')?url.pathname.slice(1):'index.html';
    const target=path.resolve(root,'frontend/build',rel);
    if(!target.startsWith(path.resolve(root,'frontend/build')+path.sep))return route.abort();
    return fs.existsSync(target)?route.fulfill({path:target}):route.fulfill({status:404,body:'Fixture asset missing'});
  });
  page.on('pageerror',e=>errors.push(e.message));
  const enter=async route=>{
    await page.goto(origin+'/dapuros/login');
    await page.evaluate(user=>{localStorage.setItem('dapuros_token','browser-fixture-token');localStorage.setItem('dapuros_user',JSON.stringify(user));},user);
    await page.goto(origin+'/dapuros/app/'+route);
    await expect(page.getByTestId('app-layout')).toBeVisible();
  };
  const go=async route=>{await page.evaluate(route=>window.DapurOSRouter.navigate(location.origin+'/dapuros/app/'+route),route);await expect(page.getByTestId('route-loading')).toHaveCount(0);};
  return {user,products,errors,writes,replays,enter,go,recover:()=>{fail=false;}};
}

for(const layout of [{name:'phone',width:393,height:852},{name:'xiaomi-pad',width:1524,height:1016},{name:'samsung-large',width:1973,height:1232}]){
 test.describe(layout.name,()=>{
  test.use({viewport:{width:layout.width,height:layout.height}});
  test('startup and menu navigation retain the document during delayed validation',async({page,context})=>{
    const f=await fixture(page,context,{delay:2200});
    await f.enter('dashboard');
    await page.evaluate(()=>window.__sameDocument='preserved');
    await f.go('pos');await expect(page.getByText('Langsung Takeaway')).toBeVisible();
    expect(await page.evaluate(()=>window.__sameDocument)).toBe('preserved');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBeTruthy();
    expect(f.errors).toEqual([]);
  });
  test('cash takeaway queues durably and retries the same UUID without unconfigured methods',async({page,context})=>{
    const f=await fixture(page,context,{offlineFail:true});await f.enter('pos');
    await page.getByText('Langsung Takeaway').click();
    await expect(page.getByTestId('pos-product-menu-0')).toBeVisible();
    await expect(page.locator('[data-testid^="pos-product-menu-"]')).toHaveCount(48);
    await page.getByTestId('pos-product-menu-0').click();
    if(layout.name==='phone')await page.getByTestId('mobile-cart-open').click();
    await expect(page.getByTestId('cart-total')).toHaveText('Rp 11.000');
    await expect(page.getByTestId('pm-cash')).toBeVisible();await expect(page.getByTestId('pm-ewallet')).toHaveCount(0);
    await page.getByTestId('cart-cash-received').fill('20000');await page.getByTestId('checkout-btn').click();
    await expect(page.getByTestId('receipt-pending-sync')).toBeVisible();
    await expect.poll(()=>f.replays.length).toBeGreaterThan(0);
    f.recover();await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await expect(page.getByTestId('receipt-pending-sync')).toHaveCount(0);
    expect(new Set(f.replays).size).toBe(1);
    expect(f.writes.filter(x=>!['/api/offline/orders','/api/auth/login'].includes(x.path))).toEqual([]);
    expect(f.errors).toEqual([]);
    await page.screenshot({path:path.join(root,'tmp',layout.name+'-checkout.png')});
  });
  test('recipe editor retains ingredients and barcode filling requires explicit save',async({page,context})=>{
    const f=await fixture(page,context);await f.enter('products');await page.getByTestId('new-product-btn').click();
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('dapuros-barcode',{detail:{target:'product',value:'899BARCODE'}})));
    await expect(page.getByTestId('pf-sku')).toHaveValue('899BARCODE');
    await expect(page.getByTestId('product-form')).toContainText('Bahan');
    expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
  });
  test('kitchen QR ordering preview and ingredient inventory remain available',async({page,context})=>{
    const f=await fixture(page,context);await f.enter('kds');
    await expect(page.getByText('Kitchen Display System',{exact:false}).or(page.getByText('Layar Dapur',{exact:false})).first()).toBeVisible();
    await f.go('qr-menu');await expect(page.getByTestId('qr-menu-page')).toBeVisible();
    await expect(page.getByTestId('qr-menu-page')).toContainText('Meja 1');
    await f.go('products/ingredients');await expect(page.getByTestId('ingredients-page')).toBeVisible();
    await expect(page.getByTestId('ingredients-list')).toContainText('Biji kopi');
    expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
  });
  test('category validation and failed save recover without duplicate submissions',async({page,context})=>{
    const f=await fixture(page,context);await f.enter('products/categories');
    await page.getByTestId('category-submit').click();await expect(page.getByTestId('category-error')).toBeVisible();
    await page.getByTestId('category-name-input').fill('Kategori fixture');
    let attempts=0;
    await context.route('**/api/products/categories',route=>{
      if(route.request().method()!=='POST')return route.fallback();
      attempts++;return route.fulfill(attempts===1?{status:503,json:{detail:'Fixture temporarily unavailable'}}:{json:{id:'category-fixture',name:'Kategori fixture'}});
    });
    await page.getByTestId('category-submit').click();await expect(page.getByTestId('category-error')).toContainText('Fixture');
    await page.getByTestId('category-submit').click();await expect(page.getByTestId('category-success')).toBeVisible();
    expect(attempts).toBe(2);expect(f.errors).toEqual([]);
  });
  test('billing about and support keep account identity and paid expiry consistent',async({page,context})=>{
    const f=await fixture(page,context);await f.enter('settings/billing');
    await expect(page.locator('.route-stage')).toContainText('Business');await expect(page.locator('.route-stage')).toContainText('2099');
    await f.go('about');await expect(page.locator('.route-stage')).toContainText('1.0.0');
    await expect(page.locator('.route-stage')).toContainText('Business');
    expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
  });
  test('trial upgrade shows three paid plans with a consistent DapurOS theme',async({page,context})=>{
    const f=await fixture(page,context,{plan:'trial'});await f.enter('settings/billing');
    await expect(page.getByTestId('subscription-status-badge')).toHaveText('TRIAL');
    const brand=await page.evaluate(()=>{const probe=document.createElement('span');probe.style.color='hsl(var(--primary))';document.body.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color;});
    expect(await page.getByTestId('view-pricing-matrix-link').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe(brand);
    await page.getByTestId('view-pricing-matrix-link').click();
    await expect(page.locator('.price-card')).toHaveCount(3);
    await expect(page.locator('.price-card h2')).toHaveText(['Starter','Pro','Business']);
    await expect(page.locator('a[href="/dapuros/register"]')).toHaveCount(0);
    await expect(page.locator('.price-card')).not.toContainText(['Free Trial','Mulai Trial','Beli Trial']);
    expect(await page.locator('.pricing-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(layout.width>980?3:layout.width>640?2:1);
    expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
  });
  test('a shared Geraina session cannot supply a cached DapurOS paid account',async({page,context})=>{
    const f=await fixture(page,context);
    await context.route('**/api/auth/me',route=>route.fulfill({status:503,json:{detail:'Isolated unavailable identity'}}));
    await context.addInitScript(()=>{localStorage.setItem('dagangos_token','cross-product-fixture-token');localStorage.setItem('dagangos_user',JSON.stringify({id:'geraina-only',store_id:'geraina-store',role:'Owner',plan:'business',current_module:'geraina'}));localStorage.removeItem('dapuros_user');});
    await page.goto(origin+'/dapuros/app/dashboard');await expect(page.getByTestId('login-submit-btn')).toBeVisible();
    await expect(page.getByTestId('app-layout')).toHaveCount(0);expect(f.writes).toEqual([]);
  });
  test('an old unstamped DapurOS paid cache requires product revalidation',async({page,context})=>{
    const f=await fixture(page,context);
    await context.route('**/api/auth/me',route=>route.fulfill({status:503,json:{detail:'Isolated unavailable identity'}}));
    await context.addInitScript(()=>{localStorage.setItem('dapuros_token','legacy-fixture-token');localStorage.setItem('dapuros_user',JSON.stringify({id:'legacy-owner',store_id:'legacy-store',role:'Owner',plan:'business'}));});
    await page.goto(origin+'/dapuros/app/dashboard');await expect(page.getByTestId('login-submit-btn')).toBeVisible();
    await expect(page.getByTestId('app-layout')).toHaveCount(0);expect(f.writes).toEqual([]);
  });
  test('cashier cannot elevate using stored selected roles or owner-only URLs',async({page,context})=>{
    const f=await fixture(page,context,{role:'Cashier'});await page.addInitScript(()=>localStorage.setItem('dapuros_selected_role','Owner'));
    await f.enter('settings/general');await expect(page.getByTestId('access-denied-page')).toBeVisible();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dapuros_user')).role)).toBe('Cashier');
    expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);
  });
  test('failed menu download recovers without losing the current session',async({page,context})=>{
    const f=await fixture(page,context);await f.enter('dashboard');
    await context.route('**/dapuros/static/js/*.chunk.js',route=>route.abort('failed'));
    await page.evaluate(()=>window.DapurOSRouter.navigate(location.origin+'/dapuros/app/products/categories'));
    await expect(page.getByTestId('route-error')).toBeVisible();await expect(page.getByTestId('app-layout')).toBeVisible();
    await context.unroute('**/dapuros/static/js/*.chunk.js');
    await page.getByRole('button',{name:'Coba lagi',exact:true}).click();
    await expect(page.getByTestId('route-error')).toHaveCount(0);await expect(page.locator('.route-stage')).toContainText('Kategori');
    expect(await page.evaluate(()=>localStorage.getItem('dapuros_token'))).toBe('browser-fixture-token');
  });
 });
}
