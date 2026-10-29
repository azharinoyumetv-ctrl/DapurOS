const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const roots={dapuros:path.resolve(__dirname,'../build'),geraina:path.resolve(__dirname,'../../../GerainaOS/frontend/build')};
const origin='https://dagangos.com';
const other=m=>m==='dapuros'?'geraina':'dapuros';
const account=m=>({id:`${m}-fixture-owner`,store_id:`${m}-fixture-store`,store_name:`${m} fixture`,email:`${m}@example.invalid`,role:'Owner',current_module:m,plan:m==='dapuros'?'starter':'business',trial_ends_at:null});
async function transport(context,{status=200,delay=0}={}){
 const requests=[];
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==origin)return route.abort();
  if(url.pathname.startsWith('/api/')){
   const m=req.headers()['x-dagangos-module'];requests.push({module:m,path:url.pathname,token:req.headers().authorization});
   if(!roots[m])return route.fulfill({status:400,json:{detail:'Module required'}});
   if(url.pathname==='/api/auth/login')return route.fulfill({json:{access_token:`${m}-fixture-token`,user:account(m)}});
   if(url.pathname==='/api/auth/me'){
    if(delay)await new Promise(r=>setTimeout(r,delay));
    return route.fulfill({status,json:status===200?{...account(m),stores:[{module:m,store_id:`${m}-fixture-store`},{module:other(m),store_id:`${other(m)}-fixture-store`}]}:{detail:'Fixture unavailable'}});
   }
   const body=url.pathname==='/api/orders/stats'?{today_sales:0,today_orders:0,week_sales:0,month_sales:0,product_count:0}:url.pathname==='/api/settings'?{general:{store_name:`${m} fixture`}}:url.pathname.startsWith('/api/records/')?{items:[],total:0}:[];
   return route.fulfill({status:req.method()==='GET'?200:403,json:body});
  }
  const m=url.pathname.split('/')[1];
  const base=roots[m];
  if(!base)return route.abort();
  const relative=url.pathname.startsWith(`/${m}/static/`)?url.pathname.slice(m.length+2):'index.html';
  const target=path.resolve(base,relative);
  if(!target.startsWith(base+path.sep)||!fs.existsSync(target))return route.abort();
  return route.fulfill({path:target});
 });return requests;
}
async function seed(page){
 await page.goto(origin+'/dapuros/login');
 await expect(page.getByTestId('login-submit-btn')).toBeVisible();
 await page.evaluate(accounts=>{for(const [m,u]of Object.entries(accounts)){localStorage.setItem(`${m}_token`,`${m}-fixture-token`);localStorage.setItem(`${m}_user`,JSON.stringify(u));}}, {dapuros:account('dapuros'),geraina:account('geraina')});
}
for(const m of ['dapuros','geraina']){
 test(`${m}: an unavailable cold-start check offers retry without discarding the token`,async({context,page})=>{
  await transport(context,{status:503});await page.goto(origin+`/${m}/login`);await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  await page.evaluate(m=>{localStorage.setItem(`${m}_token`,`${m}-fixture-token`);localStorage.removeItem(`${m}_user`);},m);
  await page.goto(origin+`/${m}/app/dashboard`);await expect(page.getByTestId('session-recovery')).toBeVisible();await expect(page.getByTestId('login-submit-btn')).toHaveCount(0);
  expect(await page.evaluate(m=>localStorage.getItem(`${m}_token`),m)).toBe(`${m}-fixture-token`);
  await context.route('**/api/auth/me',route=>route.fulfill({json:account(m)}));await page.getByTestId('session-retry').click();await expect(page.getByTestId('app-layout')).toBeVisible();
 });
 test(`${m}: an anonymous visit still permits a later suite login after product validation`,async({context,page})=>{
  const requests=await transport(context);await page.goto(origin+`/${m}/login`);await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  await page.evaluate(other=>localStorage.setItem(`${other}_token`,`${other}-fixture-token`),other(m));
  await page.goto(origin+`/${m}/app/dashboard`);await expect(page.getByTestId('app-layout')).toBeVisible();
  expect(await page.evaluate(m=>JSON.parse(localStorage.getItem(`${m}_user`)).current_module,m)).toBe(m);
  expect(requests.some(r=>r.module===m&&r.path==='/api/auth/me'&&r.token===`Bearer ${other(m)}-fixture-token`)).toBeTruthy();
 });
 test(`${m}: an already activated store cannot be sent back to store creation`,async({context,page})=>{
  await transport(context);await seed(page);await page.goto(origin+`/${m}/activate`);
  await expect(page.getByTestId('app-layout')).toBeVisible();await expect(page.getByTestId('activate-form')).toHaveCount(0);
 });
 test(`${m}: signing in leaves the other product and its open document intact`,async({context,page})=>{
  const requests=await transport(context);await seed(page);
  const companion=await context.newPage();await companion.goto(origin+`/${other(m)}/app/dashboard`);await expect(companion.getByTestId('app-layout')).toBeVisible();
  await companion.evaluate(()=>window.__companionDocument='retained');
  await page.goto(origin+`/${m}/login`);await expect(page.getByTestId('app-layout')).toBeVisible();await page.getByTestId('logout-btn').click();
  await page.getByTestId('login-email-input').fill('fixture@example.invalid');await page.getByTestId('login-password-input').fill('fixture-only');await page.getByTestId('login-submit-btn').click();
  await expect(page.getByTestId('app-layout')).toBeVisible();await expect(companion.getByTestId('app-layout')).toBeVisible();
  expect(await companion.evaluate(()=>window.__companionDocument)).toBe('retained');
  expect(await companion.evaluate(m=>localStorage.getItem(`${m}_token`),other(m))).toBe(`${other(m)}-fixture-token`);
  expect(requests.filter(r=>r.module===m&&r.path==='/api/auth/login')).toHaveLength(1);
 });
 test(`${m}: logout leaves the other product signed in`,async({context,page})=>{
  await transport(context);await seed(page);
  const companion=await context.newPage();await companion.goto(origin+`/${other(m)}/app/dashboard`);await expect(companion.getByTestId('app-layout')).toBeVisible();
  await page.goto(origin+`/${m}/app/dashboard`);await expect(page.getByTestId('app-layout')).toBeVisible();
  await page.getByTestId('logout-btn').click();await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  expect(await page.evaluate(m=>localStorage.getItem(`${m}_token`),other(m))).toBe(`${other(m)}-fixture-token`);
  await expect(companion.getByTestId('app-layout')).toBeVisible();
 });
 test(`${m}: native switch never presents a stale activation claim`,async({context,page})=>{
  await transport(context);await context.addInitScript(()=>{window.DapurOSDevice={offline:true};window.GerainaDevice={offline:true};});
  await seed(page);await page.goto(origin+`/${m}/login`);
  await page.getByTestId('logout-btn').click();
  await page.getByTestId('login-email-input').fill('fixture@example.invalid');await page.getByTestId('login-password-input').fill('fixture-only');await page.getByTestId('login-submit-btn').click();
  await page.getByTestId('odoo-ecosystem-switcher-btn').click();
  await expect(page.getByTestId(`suite-tile-${other(m)}`)).toHaveAttribute('href',`/${other(m)}/app/dashboard`);
  await expect(page.getByTestId(`suite-tile-${other(m)}`)).toContainText('Buka aplikasi');
 });
 test(`${m}: a temporary validation outage preserves its own cached session and tier`,async({context,page})=>{
  await transport(context,{status:503,delay:1400});await context.addInitScript(()=>{window.DapurOSDevice={offline:true};window.GerainaDevice={offline:true};});await seed(page);
  await page.goto(origin+`/${m}/app/dashboard`);await expect(page.getByTestId('app-layout')).toBeVisible();
  await page.waitForTimeout(1600);await expect(page.getByTestId('app-layout')).toBeVisible();
  expect(await page.evaluate(m=>JSON.parse(localStorage.getItem(`${m}_user`)).plan,m)).toBe(account(m).plan);
 });
 test(`${m}: an expired token clears only its own session`,async({context,page})=>{
  await transport(context,{status:401});await seed(page);await page.goto(origin+`/${m}/app/dashboard`);
  await expect(page.getByTestId('login-submit-btn')).toBeVisible();
  expect(await page.evaluate(m=>localStorage.getItem(`${m}_token`),m)).toBeNull();
  expect(await page.evaluate(m=>localStorage.getItem(`${m}_token`),other(m))).toBe(`${other(m)}-fixture-token`);
 });
}
