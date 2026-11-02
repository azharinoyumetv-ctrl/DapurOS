const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const runtime=JSON.parse(fs.readFileSync(path.join(root,'tmp/full-e2e-runtime.json'),'utf8'));
if(!runtime.base.startsWith('http://127.0.0.1:')||!runtime.dbName.startsWith('dapuros_e2e_'))throw Error('Only the isolated local backend is permitted');
const coverage=[];
test.beforeEach(async({context,page,request})=>{
 const reset=await request.post(runtime.base+'/__e2e/reset',{headers:{'X-E2E-Fixture':runtime.fixtureKey}});expect(reset.ok()).toBeTruthy();
 page.on('dialog',dialog=>dialog.accept());
 await context.routeWebSocket('**/*',socket=>socket.close());
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!=='https://dagangos.com')return route.abort();
  if(url.pathname.startsWith('/api/')){
   const headers={...req.headers()};delete headers.host;delete headers['content-length'];
   return route.fulfill({response:await route.fetch({url:runtime.base+url.pathname+url.search,headers})});
  }
  const publicFile=path.resolve(root,'../public','.'+url.pathname);
  if(publicFile.startsWith(path.resolve(root,'../public')+path.sep)&&fs.existsSync(publicFile)&&fs.statSync(publicFile).isFile())return route.fulfill({path:publicFile});
  const relative=url.pathname.startsWith('/dapuros/static/')?url.pathname.slice('/dapuros/'.length):'index.html';
  const file=path.resolve(root,'frontend/build',relative);
  if(!file.startsWith(path.resolve(root,'frontend/build')+path.sep))return route.abort();
  return fs.existsSync(file)?route.fulfill({path:file}):route.abort();
 });
});
async function register(page,request,{plan='business'}={}){
 await page.goto('/dapuros/register');
 await page.getByTestId('register-store-input').fill('E2E Test Restaurant');
 await page.getByTestId('register-email-input').fill(`e2e-${Date.now()}@example.com`);
 await page.getByTestId('register-password-input').fill('E2E-local-only-12345');
 await page.getByTestId('register-submit-btn').click();
 await expect(page.getByTestId('app-layout')).toBeVisible();
 const session=await page.evaluate(()=>({user:JSON.parse(localStorage.getItem('dapuros_user')),token:localStorage.getItem('dapuros_token')}));
 if(plan!=='trial'){
  const response=await request.post(runtime.base+'/__e2e/plan',{headers:{'X-E2E-Fixture':runtime.fixtureKey},data:{store_id:session.user.store_id,plan}});expect(response.ok()).toBeTruthy();
  await page.reload();await expect(page.getByTestId('app-layout')).toBeVisible();
 }
 return {...session,headers:{Authorization:`Bearer ${session.token}`,'X-DagangOS-Module':'dapuros'}};
}
async function api(request,session,method,url,data,extra={}){
 const response=await request[method](runtime.base+'/api'+url,{headers:session.headers,...(data===undefined?{}:{data}),...extra});
 expect(response.ok(),`${method} ${url}: ${response.status()} ${await response.text()}`).toBeTruthy();return response.json();
}
const product=async(request,session,extra={})=>api(request,session,'post','/products',{name:'E2E Kopi',sku:'E2E-COFFEE',price:10000,cost:3000,stock:20,category:'Minuman',unit:'pcs',...extra});
async function employee(request,owner,role){
 const data={name:'E2E '+role,email:`e2e-${role.toLowerCase()}@example.com`,role,initial_password:'E2E-temporary-12345',status:'Aktif'};
 const staff=await api(request,owner,'post','/staff',data);
 const login=await api(request,owner,'post','/auth/login',{email:data.email,password:data.initial_password});
 const temporary={headers:{...owner.headers,Authorization:'Bearer '+login.access_token}};
 expect((await request.get(runtime.base+'/api/products',{headers:temporary.headers})).status()).toBe(403);
 const changed=await api(request,temporary,'post','/auth/change-password',{current_password:data.initial_password,new_password:'E2E-personal-password-54321'});
 return {user:changed.user,token:changed.access_token,staff,data,headers:{...owner.headers,Authorization:'Bearer '+changed.access_token}};
}
test('concurrent device and staff registrations cannot exceed Starter capacity',async({page,request})=>{
 const owner=await register(page,request,{plan:'starter'});
 const devices=await Promise.all(Array.from({length:6},(_,i)=>request.post(runtime.base+'/api/devices',{headers:owner.headers,data:{device_id:'e2e-device-'+i,name:'E2E '+i}})));
 expect.soft(devices.filter(r=>r.ok()).length,'Starter device cap').toBe(2);
 expect.soft((await api(request,owner,'get','/devices')).length).toBe(2);
 const staff=await Promise.all(Array.from({length:6},(_,i)=>request.post(runtime.base+'/api/staff',{headers:owner.headers,data:{name:'E2E Staff '+i,email:`capacity-${i}@example.com`,role:'Cashier',initial_password:'E2E-capacity-pass-12345',status:'Aktif'}})));
 expect.soft(staff.filter(r=>r.ok()).length,'Starter employee cap').toBe(5);
 expect.soft((await api(request,owner,'get','/staff')).length).toBe(5);
});
test('supplier invoice and partial payable stay synchronized without duplicate or excessive payments',async({page,request})=>{
 const owner=await register(page,request),p=await product(request,owner),supplier=await api(request,owner,'post','/suppliers',{name:'Invoice E2E Supplier'});
 await api(request,owner,'post','/purchase/orders',{po_no:'PO-INVOICE',supplier_id:supplier.id,supplier_name:supplier.name,total:10000,items:[{product_id:p.id,qty:2,cost:5000}]});
 const data={invoice_no:'INV-E2E',po_no:'PO-INVOICE',amount:10000,status:'Unpaid',due_date:'2026-11-30'};
 await page.goto('/dapuros/app/purchase/invoices');await page.getByLabel('Nomor faktur',{exact:true}).fill(data.invoice_no);await page.getByLabel('Referensi PO',{exact:true}).selectOption(data.po_no);await page.getByLabel('Jatuh tempo',{exact:true}).fill(data.due_date);await page.getByTestId('invoice-create').click();
 await expect(page.getByRole('cell',{name:data.invoice_no,exact:true})).toBeVisible();
 const [invoice]=await api(request,owner,'get','/purchase/invoices');
 await api(request,owner,'post','/purchase/invoices',data);
 expect.soft(await api(request,owner,'get','/purchase/invoices'),'Invoice retry').toHaveLength(1);
 const payables=await api(request,owner,'get','/debt/payables');expect.soft(payables,'Payable created once').toHaveLength(1);
 const payment={paid_amount:4000,expected_paid_amount:0,status:'Paid',request_id:require('node:crypto').randomUUID()};
 const partial=await api(request,owner,'put','/debt/payables/'+payables[0].id,payment);expect(partial.status).toBe('Partial');
 expect((await api(request,owner,'put','/debt/payables/'+payables[0].id,payment)).paid_amount).toBe(4000);
 expect((await request.put(runtime.base+'/api/debt/payables/'+payables[0].id,{headers:owner.headers,data:{...payment,request_id:require('node:crypto').randomUUID()}})).status()).toBe(409);
 expect((await api(request,owner,'get','/purchase/invoices'))[0].status).toBe('Partial');
 expect((await request.put(runtime.base+'/api/debt/payables/'+payables[0].id,{headers:owner.headers,data:{paid_amount:5000,expected_paid_amount:0}})).status()).toBe(409);
 await api(request,owner,'put','/purchase/invoices/'+invoice.id,{status:'Paid'});
 expect((await api(request,owner,'get','/debt/payables'))[0].paid_amount).toBe(10000);
 expect((await request.put(runtime.base+'/api/purchase/invoices/'+invoice.id,{headers:owner.headers,data:{status:'Unpaid'}})).status()).toBe(409);
});
test('inventory transfer UI applies shipment, receive and cancellation once; fractional PO receipt conserves units',async({page,request})=>{
 const session=await register(page,request),p=await product(request,session);
 const branch=await api(request,session,'post','/branches',{name:'E2E Cabang'});
 await page.goto('/dapuros/app/products/stock-transfer');
 await page.getByTestId('transfer-dest-select').selectOption(branch.id);
 await page.getByTestId('transfer-form').locator('select').nth(2).selectOption(p.id);
 await page.getByTestId('transfer-form').locator('input[type=number]').fill('5');
 await page.getByRole('button',{name:'Kirim Barang'}).click();await expect(page.getByTestId('transfer-list')).toContainText(p.name);
 const [transfer]=await api(request,session,'get','/products/stock-transfers');
 expect((await api(request,session,'get','/products'))[0].stock).toBe(15);
 await page.getByRole('button',{name:'Terima',exact:true}).click();await expect(page.getByTestId('transfer-list')).toContainText('Received');
 await api(request,session,'post',`/products/stock-transfers/${transfer.id}/receive`);
 let saved=(await api(request,session,'get','/products'))[0];expect(saved.stock_by_branch[branch.id]).toBe(5);expect(saved.stock).toBe(15);
 const sent=await api(request,session,'post','/products/stock-transfers',{from_branch:branch.id,to_branch:'main',request_id:'back-to-main',items:[{product_id:p.id,qty:3}]});
 await api(request,session,'post',`/products/stock-transfers/${sent.id}/cancel`);await api(request,session,'post',`/products/stock-transfers/${sent.id}/cancel`);
 saved=(await api(request,session,'get','/products'))[0];expect(saved.stock_by_branch[branch.id]).toBe(5);expect(saved.stock).toBe(15);
 const ing=await api(request,session,'post','/ingredients',{name:'E2E Biji',stock:0,safety_stock:0,unit:'kg'}),supplier=await api(request,session,'post','/suppliers',{name:'E2E Biji Supplier'});
 await api(request,session,'post','/purchase/orders',{po_no:'PO-FRACTION',supplier_id:supplier.id,supplier_name:supplier.name,total:300,status:'Ordered',items:[{product_id:ing.id,kind:'ingredient',qty:0.3,cost:1000}]});
 for(const qty of [0.1,0.2])await api(request,session,'post','/purchase/receiving',{po_no:'PO-FRACTION',request_id:'fraction-'+qty,items:[{product_id:ing.id,kind:'ingredient',qty}]});
 expect((await api(request,session,'get','/purchase/orders'))[0].status).toBe('Received');
 expect((await api(request,session,'get','/ingredients'))[0].stock).toBeCloseTo(0.3,9);
});
test('recipe stock, spoilage, CSV import, historical profit and idempotent loyalty survive edits',async({page,request})=>{
 const session=await register(page,request),ing=await api(request,session,'post','/ingredients',{name:'E2E Resep Bahan',stock:20,safety_stock:2,unit:'ml'});
 await page.goto('/dapuros/app/products');await page.getByTestId('new-product-btn').click();
 await page.getByTestId('pf-name').fill('E2E Recipe Drink');await page.getByTestId('pf-sku').fill('E2E-BOM');await page.getByTestId('pf-price').fill('10000');await page.getByTestId('pf-cost').fill('2500');
 const form=page.getByTestId('product-form');await form.locator('select').filter({has:page.locator(`option[value="${ing.id}"]`)}).selectOption(ing.id);
 await form.getByPlaceholder('0.00').fill('2');await form.getByRole('button',{name:'Tambah',exact:true}).click();await page.getByTestId('pf-save').click();await expect(page.getByTestId('product-form-modal')).toHaveCount(0);
 const [p]=await api(request,session,'get','/products');expect(p.recipe).toEqual([{ingredient_id:ing.id,quantity:2}]);
 await page.getByTestId('open-import-btn').click();await page.getByTestId('import-file-input').setInputFiles({name:'menu.csv',mimeType:'text/csv',buffer:Buffer.from('name,price,sku\nE2E Recipe Drink,12000,E2E-BOM\nE2E New Menu,2000,E2E-NEW\n')});await page.getByTestId('import-upload-btn').click();
 await expect(page.getByTestId('import-inserted')).toHaveText('1');await expect(page.getByTestId('import-updated')).toHaveText('1');
 expect((await api(request,session,'get','/products')).find(x=>x.id===p.id).recipe).toEqual(p.recipe);
 const customer=await api(request,session,'post','/customers',{name:'E2E Loyalty Guest',phone:'08000000000',membership_tier:'Bronze',loyalty_points:0});
 await api(request,session,'post','/customers/loyalty',{conversion_rate:1000,point_value:100,min_redeem_points:1});
 const order=await api(request,session,'post','/orders',{customer_id:customer.id,payment_method:'cash',cash_received:20000,items:[{product_id:p.id,name:p.name,price:12000,quantity:1,subtotal:12000}]},{headers:{...session.headers,'Idempotency-Key':'E2E-LOYALTY'}});
 expect((await api(request,session,'get','/ingredients'))[0].stock).toBe(18);
 expect((await api(request,session,'get','/customers'))[0].loyalty_points).toBe(12);
 await api(request,session,'put',`/products/${p.id}`,{cost:8000,recipe:[{ingredient_id:ing.id,quantity:4}]});
 // Import must retain unspecified stock and cost, as well as the recipe.
 expect((await api(request,session,'get','/reports/profit')).totals.cogs).toBe(2500);
 for(let i=0;i<2;i++)await api(request,session,'post',`/orders/${order.id}/void`);
 expect((await api(request,session,'get','/ingredients'))[0].stock).toBe(20);expect((await api(request,session,'get','/customers'))[0].loyalty_points).toBe(0);
 const waste={quantity_lost:2,reason:'spilled',request_id:'E2E-SPOILAGE'};
 for(let i=0;i<2;i++)await api(request,session,'post',`/ingredients/${ing.id}/spoilage`,waste);
 expect((await api(request,session,'get','/ingredients'))[0].stock).toBe(18);
 const movements=await api(request,session,'get','/inventory/movements');
 expect(movements.items.filter(x=>x.product_id===ing.id&&x.kind==='ingredient_sale').map(x=>x.quantity)).toEqual([-2]);
 expect(movements.items.filter(x=>x.product_id===ing.id&&x.kind==='ingredient_spoilage').map(x=>x.quantity)).toEqual([-2]);
 const pdf=await request.get(runtime.base+'/api/pdf/receipt/'+order.id,{headers:session.headers});expect(pdf.ok(),await pdf.text()).toBe(true);expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-');
});
test('staff temporary password, role restrictions, attendance and deactivation use real accounts',async({page,request})=>{
 const owner=await register(page,request),cashier=await employee(request,owner,'Cashier');
 for(const [method,url,data] of [['post','/products',{name:'No',price:1}],['get','/staff'],['get','/integrations'],['get','/devices'],['post','/customers/loyalty',{conversion_rate:1000,point_value:100,min_redeem_points:1}],['post','/customers/memberships',{name:'Unauthorized',min_points:0,discount_percent:100}],['post','/settings',{general:{store_name:'No'}}]]){
  const response=await request[method](runtime.base+'/api'+url,{headers:cashier.headers,...(data?{data}:{})});expect(response.status(),method+' '+url).toBe(403);
 }
 const checkin=await api(request,cashier,'post','/attendance/me/check-in',{request_id:require('node:crypto').randomUUID()});
 const me=await api(request,cashier,'get','/attendance/me');expect(JSON.stringify(me)).toContain(checkin.id);
 await api(request,cashier,'post','/attendance/me/check-out',{attendance_id:checkin.id});
 await api(request,cashier,'post','/attendance/me/check-out',{attendance_id:checkin.id});
 await api(request,owner,'delete',`/staff/${cashier.staff.id}`);
 expect((await request.get(runtime.base+'/api/products',{headers:cashier.headers})).status()).toBe(401);
});
for(const plan of ['starter','pro','business'])test(`real ${plan} dashboard makes only allowed requests and retains its own subscription`,async({page,request})=>{
 await register(page,request,{plan});const failures=[];
 page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)failures.push([new URL(r.url()).pathname,r.status()]);});
 await page.goto('/dapuros/app/dashboard');await expect(page.getByTestId('stat-revenue')).toContainText('Rp');await page.waitForTimeout(500);
 expect(failures).toEqual([]);await expect(page.getByTestId('stat-profit')).not.toContainText('40%');
 if(plan==='starter')await expect(page.getByTestId('dashboard-buka-qr-menu-btn')).toHaveCount(0);
});
test('settings and payment configuration persist, provider failures never claim a paid sale',async({page,request})=>{
 const owner=await register(page,request),p=await product(request,owner);
 await api(request,owner,'post','/settings',{general:{store_name:'E2E Persisted Restaurant',timezone:'Asia/Tokyo',currency:'IDR',language:'id'},receipt:{header_text:'E2E Receipt',footer_text:'E2E Footer'}});
 const settings=await api(request,owner,'get','/settings');expect(settings.general.store_name).toBe('E2E Persisted Restaurant');expect(settings.receipt.header_text).toBe('E2E Receipt');
 await api(request,owner,'post','/payments/config',{cash:{is_active:true,require_drawer:false}});expect((await api(request,owner,'get','/payments/config')).cash.is_active).toBe(true);
 expect((await request.post(runtime.base+'/api/payments/config',{headers:owner.headers,data:{edc:{is_active:true}}})).status()).toBe(400);
 expect((await request.post(runtime.base+'/api/orders',{headers:owner.headers,data:{payment_method:'ewallet',ewallet_channel:'ID_DANA',items:[{product_id:p.id,name:p.name,price:p.price,quantity:1,subtotal:p.price}]}})).status()).toBe(400);
 expect((await api(request,owner,'get','/products'))[0].stock).toBe(20);expect(await api(request,owner,'get','/orders')).toHaveLength(0);
});
async function dining(request,session){
 const floors=await api(request,session,'get','/floors');
 const floor=floors[0]||await api(request,session,'post','/floors',{name:'Lantai E2E'});
 return api(request,session,'post','/tables',{floor_id:floor.id,label:'E2E Meja 1',capacity:4});
}
test('restaurant invariants: one session, protected open bills, bounded ingredients and debt',async({page,request})=>{
 const session=await register(page,request),p=await product(request,session),table=await dining(request,session);
 const opened=await Promise.all(Array.from({length:6},()=>api(request,session,'post',`/tables/${table.id}/session`)));
 expect.soft(new Set(opened.map(s=>s.id)).size,'Concurrent staff opening must return one active session').toBe(1);
 await api(request,session,'post','/orders',{session_id:opened[0].id,payment_method:'cash',items:[{product_id:p.id,name:p.name,price:p.price,quantity:1,subtotal:p.price}]});
 for(const url of [`/tables/${table.id}`,`/floors/${table.floor_id}`])expect.soft((await request.delete(runtime.base+'/api'+url,{headers:session.headers})).status(),url+' preserves unpaid bill').toBe(409);
 const ing=await api(request,session,'post','/ingredients',{name:'E2E Susu',stock:10,safety_stock:1,unit:'ml'});
 expect.soft((await request.put(runtime.base+'/api/ingredients/'+ing.id,{headers:session.headers,data:{stock:-10}})).status(),'Negative ingredient stock').toBe(422);
 const recipe=await product(request,session,{name:'E2E Resep',sku:'E2E-RECIPE',recipe:[{ingredient_id:ing.id,quantity:2}]});
 expect.soft((await request.delete(runtime.base+'/api/ingredients/'+ing.id,{headers:session.headers})).status(),'Referenced ingredient').toBe(409);
 for(const kind of ['receivables','payables']){
  const data={customer_name:'E2E Guest',supplier_name:'E2E Supplier',order_no:'E2E-REF',invoice_no:'E2E-INV',amount:1000,paid_amount:0,due_date:'2026-11-30'};
  expect.soft((await request.post(runtime.base+'/api/debt/'+kind,{headers:session.headers,data:{...data,amount:-1}})).status(),kind+' negative amount').toBe(422);
  const debt=await api(request,session,'post','/debt/'+kind,data);
  expect.soft((await request.put(runtime.base+'/api/debt/'+kind+'/'+debt.id,{headers:session.headers,data:{paid_amount:2000,status:'Paid'}})).status(),kind+' overpayment').toBe(422);
 }
});
test('public QR guest order reaches the actual kitchen and table bill without operator credentials',async({context,page,request})=>{
 const session=await register(page,request),p=await product(request,session),table=await dining(request,session);
 await api(request,session,'post',`/tables/${table.id}/session`);
 await page.goto('/dapuros/app/qr-menu');
 await expect(page.getByTestId('qr-menu-page')).not.toContainText(/simulator|simulasi|Input Pesanan Meja oleh Staf|Tingkat Gula/i);
 await page.getByTestId('qr-enable').click();
 const url=await page.getByTestId('qr-public-link').getAttribute('href');expect(url).toContain('/dapuros/qr-order?token=');
 expect(await api(request,session,'get','/orders')).toHaveLength(0);
 const qrDownload=page.waitForEvent('download');await page.getByTestId('qr-download').click();
 const savedQr=await qrDownload;expect(fs.readFileSync(await savedQr.path(),'utf8')).toContain('<svg');
 expect(savedQr.suggestedFilename()).toBe(`DapurOS-QR-${table.id}.svg`);
 await page.screenshot({path:path.join(root,'tmp/full-e2e-qr-desktop.png'),fullPage:true});
 await page.setViewportSize({width:393,height:852});await page.reload();await expect(page.getByTestId('qr-public-link')).toBeVisible();await page.screenshot({path:path.join(root,'tmp/full-e2e-qr-phone.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const kitchen=await context.newPage();await kitchen.goto('/dapuros/app/kds');await expect(kitchen.getByTestId('kds-page')).toBeVisible();
 // Same browser has an operator token: the public page must still omit it.
 const guest=await context.newPage(),guestHeaders=[];
 guest.on('request',r=>{if(r.url().includes('/api/public/qr/'))guestHeaders.push(r.headers());});
 await guest.goto(url);await expect(guest.getByTestId('guest-menu-page')).toBeVisible();
 await guest.getByTestId(`guest-add-${p.id}`).click();await guest.getByLabel(`Catatan ${p.name}`).fill('E2E less sugar');
 await guest.getByTestId('guest-send-order').click();await expect(guest.getByTestId('guest-order-success')).toBeVisible();
 const orders=await api(request,session,'get','/orders');expect(orders).toHaveLength(1);expect(orders[0].payment_status).toBe('pending');expect(orders[0].total).toBe(11550);
 expect(orders[0].items[0].note).toBe('E2E less sugar');
 expect((await api(request,session,'get','/products'))[0].stock).toBe(19);
 const bill=await api(request,session,'get',`/tables/${table.id}/session`);expect(bill.grand_total).toBe(11550);
 const tickets=await api(request,session,'get','/kds');expect(tickets).toHaveLength(1);
 await expect(kitchen.getByTestId(`kds-ticket-${tickets[0].id}`)).toBeVisible({timeout:12000});
 for(const name of ['Mulai Masak','Tandai Siap (Ready)','Sajikan / Clear'])await kitchen.getByRole('button',{name,exact:true}).click();
 await expect(kitchen.getByTestId(`kds-ticket-${tickets[0].id}`)).toHaveCount(0);
 await api(request,session,'post',`/tables/${table.id}/checkout`,{payment_method:'cash',cash_received:20000,expected_session_id:bill.session.id});
 expect((await api(request,session,'get','/reports/tax')).tax_amount).toBe(1050);
 await page.goto('/dapuros/app/reports/tax');await expect(page.getByTestId('recorded-tax-total')).toContainText('1.050');
 const downloadPromise=page.waitForEvent('download');await page.getByTestId('recorded-tax-download').click();
 const download=await downloadPromise;expect(fs.readFileSync(await download.path(),'utf8')).toContain(orders[0].order_no);
 await expect(guest.getByTestId('guest-order-status')).toContainText('Pembayaran telah tercatat',{timeout:12000});
 expect(guestHeaders.length).toBeGreaterThan(2);expect(guestHeaders.every(h=>!h.authorization)).toBe(true);
 await api(request,session,'post',`/tables/${table.id}/qr-link`,{enabled:false});
 await guest.reload();await expect(guest.getByTestId('guest-menu-error')).toContainText('tidak aktif');
});
test('public QR validates session, prices, tenant scope, retries and revocation',async({page,request})=>{
 const session=await register(page,request),p=await product(request,session),table=await dining(request,session);
 const qr=await api(request,session,'post',`/tables/${table.id}/qr-link`,{enabled:true}),token=new URL(qr.url).searchParams.get('token');
 const endpoint=runtime.base+'/api/public/qr/'+token+'/orders',key=require('node:crypto').randomUUID();
 const data={items:[{product_id:p.id,quantity:1,expected_price:p.price,note:''}]},options={headers:{'Idempotency-Key':key},data};
 expect((await request.post(endpoint,options)).status()).toBe(409);
 await api(request,session,'post',`/tables/${table.id}/session`);
 expect((await request.post(endpoint,{...options,data:{items:[{...data.items[0],expected_price:1}]}})).status()).toBe(409);
 expect((await request.post(endpoint,{...options,data:{...data,payment_status:'paid'}})).status()).toBe(422);
 const first=await request.post(endpoint,options);expect(first.ok(),await first.text()).toBe(true);
 const saved=await first.json();const retry=await request.post(endpoint,options);expect(await retry.json()).toEqual(saved);
 expect(await api(request,session,'get','/orders')).toHaveLength(1);expect((await api(request,session,'get','/products'))[0].stock).toBe(19);
 expect((await request.post(endpoint,{...options,data:{items:[{...data.items[0],quantity:2}]}})).status()).toBe(409);
 await api(request,session,'post',`/tables/${table.id}/qr-link`,{enabled:true,rotate:true});
 expect((await request.get(runtime.base+'/api/public/qr/'+token)).status()).toBe(404);
});
test('a lost guest response and page refresh recover the same order without a duplicate',async({context,page,request})=>{
 const owner=await register(page,request),p=await product(request,owner),table=await dining(request,owner);
 await api(request,owner,'post',`/tables/${table.id}/session`);
 const qr=await api(request,owner,'post',`/tables/${table.id}/qr-link`,{enabled:true});
 let interrupted=false;const attempts=[];
 await context.route('**/api/public/qr/*/orders',async route=>{
  if(route.request().method()!=='POST'||interrupted)return route.fallback();
  attempts.push(route.request().headers()['idempotency-key']);
  const result=await route.fetch({url:runtime.base+new URL(route.request().url()).pathname});expect(result.ok(),await result.text()).toBe(true);
  interrupted=true;return route.abort('failed');
 });
 await page.goto(qr.url);await page.getByTestId(`guest-add-${p.id}`).click();await page.getByTestId('guest-send-order').click();
 await expect(page.getByTestId('guest-menu-error')).toContainText('referensi yang sama');
 await page.reload();await expect(page.getByTestId('guest-order-success')).toBeVisible();
 const reference=await page.getByTestId('guest-order-reference').textContent();
 await page.reload();await expect(page.getByTestId('guest-order-reference')).toHaveText(reference);
 expect(attempts).toHaveLength(1);expect(await api(request,owner,'get','/orders')).toHaveLength(1);expect((await api(request,owner,'get','/products'))[0].stock).toBe(19);
});
test('real checkout, immutable historical cost, paid reporting, void and stock restoration',async({page,request})=>{
 const session=await register(page,request),p=await product(request,session);
 await page.goto('/dapuros/app/pos');await page.getByText('Langsung Takeaway').click();
 await page.getByTestId(`pos-product-${p.id}`).click();await page.getByTestId('cart-cash-received').fill('20000');await page.getByTestId('checkout-btn').click();
 await expect(page.getByTestId('receipt-order-no')).toBeVisible();
 const orders=await api(request,session,'get','/orders');expect(orders).toHaveLength(1);expect(orders[0].payment_status).toBe('paid');
 expect((await api(request,session,'get','/products')).find(x=>x.id===p.id).stock).toBe(19);
 await api(request,session,'put',`/products/${p.id}`,{cost:9000});
 const profit=await api(request,session,'get','/reports/profit');expect(profit.totals.cogs).toBe(3000);
 await api(request,session,'post',`/orders/${orders[0].id}/void`);await api(request,session,'post',`/orders/${orders[0].id}/void`);
 expect((await api(request,session,'get','/products')).find(x=>x.id===p.id).stock).toBe(20);
 expect((await api(request,session,'get','/orders/stats')).today_sales).toBe(0);
 expect(await api(request,session,'get','/kds')).toHaveLength(0);
});
test('staff can split a real table bill by item and settle both portions without losing quantity',async({page,request})=>{
 const owner=await register(page,request),p=await product(request,owner),table=await dining(request,owner);
 const opened=await api(request,owner,'post',`/tables/${table.id}/session`);
 await api(request,owner,'post','/orders',{session_id:opened.id,payment_method:'cash',items:[{product_id:p.id,name:p.name,price:p.price,quantity:2,subtotal:2*p.price}]});
 await page.goto('/dapuros/app/pos');await page.getByText(table.label,{exact:true}).click();
 await expect(page.getByText('2x '+p.name,{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Split Bill (Bagi Tagihan)',exact:true}).click();await page.getByRole('button',{name:'Bagi Per Item',exact:true}).click();
 const modal=page.getByTestId('split-modal');await modal.getByRole('button',{name:'+',exact:true}).click();await modal.getByRole('button',{name:'Pisahkan ke Bill Baru',exact:true}).click();
 await expect(page.getByTestId('split-payment-modal')).toBeVisible();await page.getByRole('button',{name:'Batal & Settle Nanti',exact:true}).click();
 const part=(await api(request,owner,'get','/orders')).find(order=>order.source_session_id===opened.id);
 await page.reload();await page.getByText(table.label,{exact:true}).click();await page.getByTestId('split-unpaid-'+part.id).click();
 await page.getByTestId('split-payment-modal').getByRole('button',{name:'Tunai',exact:true}).click();
 await expect(page.getByTestId('receipt-order-no')).toBeVisible();
 await page.getByTestId('receipt-close').click();
 await page.getByTestId('settle-open-btn').click();await page.getByTestId('settle-cash').click();
 await expect(page.getByTestId('settle-modal')).toHaveCount(0);
 expect((await api(request,owner,'get','/orders')).filter(x=>x.payment_status==='paid').reduce((sum,x)=>sum+x.total,0)).toBe(23100);
 expect((await api(request,owner,'get','/tables')).find(x=>x.id===table.id).status).toBe('Vacant');
 expect((await api(request,owner,'get','/products'))[0].stock).toBe(18);
});

test('offline cash survives a reload and reconnects to the real backend exactly once',async({context,page,request})=>{
 const owner=await register(page,request),p=await product(request,owner);
 await context.addInitScript(()=>{
  window.DapurOSDevice={offline:true};window.__dapurosAndroid=true;
  document.addEventListener('DOMContentLoaded',()=>document.documentElement.setAttribute('data-ga-ui','phone'));
  Object.defineProperty(navigator,'onLine',{get:()=>sessionStorage.getItem('fixture-offline')!=='true'});
 });
 await page.setViewportSize({width:393,height:852});await page.goto('/dapuros/app/pos');
 await expect(page.getByTestId(`pos-product-${p.id}`)).toHaveCount(0);
 await page.getByText('Langsung Takeaway').click();await expect(page.getByTestId(`pos-product-${p.id}`)).toBeVisible();
 await expect(page.getByTestId('offline-status')).not.toContainText('Buka kasir saat terhubung');
 let offline=true;await context.route('**/api/**',route=>offline?route.abort('internetdisconnected'):route.fallback());
 await page.evaluate(()=>{sessionStorage.setItem('fixture-offline','true');window.dispatchEvent(new Event('offline'));});
 await page.getByTestId(`pos-product-${p.id}`).click();await page.getByTestId('mobile-cart-open').click();
 await page.getByTestId('cart-cash-received').fill('20000');await page.getByTestId('checkout-btn').click();
 await expect(page.getByTestId('receipt-order-no')).toContainText('OFF-');
 expect(await api(request,owner,'get','/orders')).toHaveLength(0);
 await page.reload();await expect(page.getByTestId('app-layout')).toBeVisible();
 await expect(page.getByTestId('offline-status')).toContainText('1 transaksi tersimpan');
 await page.getByText('Transaksi perangkat ini (1)',{exact:true}).click();
 const local=page.locator('[data-testid^="local-sale-"]');await expect(local).toContainText('Menunggu sinkronisasi');
 offline=false;await page.evaluate(()=>{sessionStorage.removeItem('fixture-offline');window.dispatchEvent(new Event('online'));});
 await expect(local).toContainText('Tersinkron');
 await page.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('dapuros-sync-requested'));});
 const orders=await api(request,owner,'get','/orders');expect(orders).toHaveLength(1);expect(orders[0].payment_status).toBe('paid');
 expect((await api(request,owner,'get','/products'))[0].stock).toBe(19);
 await page.screenshot({path:path.join(root,'tmp/full-e2e-offline-phone.png'),fullPage:true});
});

test('customer entry works on Pro without Business requests and protects earned points',async({page,request})=>{
 const owner=await register(page,request,{plan:'pro'}),failures=[];
 page.on('response',r=>{if(r.url().includes('/api/')&&r.status()>=400)failures.push([new URL(r.url()).pathname,r.status()]);});
 await page.goto('/dapuros/app/customers');
 const form=page.getByTestId('customer-form');await form.getByPlaceholder('Contoh: Budi Gunawan').fill('E2E UI Guest');await form.getByPlaceholder('08...').fill('0811111111');
 await form.getByRole('button',{name:'Tambah Pelanggan',exact:true}).click();
 await expect(page.getByRole('cell',{name:'E2E UI Guest',exact:true})).toBeVisible();expect(failures).toEqual([]);
 let customer=(await api(request,owner,'get','/customers'))[0];
 await api(request,owner,'put','/customers/'+customer.id,{name:customer.name,loyalty_points:10});
 await page.getByTitle('Edit',{exact:true}).click();
 await form.getByPlaceholder('Contoh: Budi Gunawan').fill('E2E Edited Guest');await form.getByRole('button',{name:'Simpan Perubahan',exact:true}).click();
 // An edit begun before points changed must not overwrite the new balance.
 await expect(page.getByRole('alert')).toContainText('Poin berubah');
 expect((await api(request,owner,'get','/customers'))[0].loyalty_points).toBe(10);
 const cashier=await employee(request,owner,'Cashier');
 expect((await request.put(runtime.base+'/api/customers/'+customer.id,{headers:cashier.headers,data:{name:customer.name,loyalty_points:100}})).status()).toBe(403);
 await api(request,cashier,'put','/customers/'+customer.id,{name:'E2E Name Only'});
 expect((await api(request,owner,'get','/customers'))[0].loyalty_points).toBe(10);
 const warehouse=await employee(request,owner,'Warehouse');expect((await request.get(runtime.base+'/api/pdf/receipt/missing',{headers:warehouse.headers})).status()).toBe(403);
});

test('stale table totals and split cancellation preserve unpaid quantities and kitchen tickets',async({page,request})=>{
 const owner=await register(page,request),p=await product(request,owner),table=await dining(request,owner),opened=await api(request,owner,'post',`/tables/${table.id}/session`);
 const order=await api(request,owner,'post','/orders',{session_id:opened.id,payment_method:'cash',items:[{product_id:p.id,name:p.name,price:p.price,quantity:2,subtotal:2*p.price}]});
 expect((await request.post(runtime.base+`/api/tables/${table.id}/checkout`,{headers:owner.headers,data:{payment_method:'cash',cash_received:30000,expected_session_id:opened.id,expected_total:11550}})).status()).toBe(409);
 const split=await api(request,owner,'post',`/tables/${table.id}/split-bill`,{type:'item',items:[{product_id:p.id,quantity:1}]});
 await api(request,owner,'post',`/orders/${split.split_order.id}/void`);
 const tickets=await api(request,owner,'get','/kds');expect(tickets).toHaveLength(1);expect(tickets[0].items.reduce((n,x)=>n+x.qty,0)).toBe(1);
 await api(request,owner,'post',`/orders/${order.id}/void`);expect(await api(request,owner,'get','/kds')).toHaveLength(0);
 await api(request,owner,'post',`/tables/${table.id}/close-empty`,{expected_session_id:opened.id});
 expect((await api(request,owner,'get','/tables'))[0].status).toBe('Vacant');
});

test('a complete 618-item catalogue stays searchable with bounded rows and recovers a failed page',async({context,page,request})=>{
 const owner=await register(page,request);
 const seed=await request.post(runtime.base+'/__e2e/catalogue',{headers:{'X-E2E-Fixture':runtime.fixtureKey},data:{store_id:owner.user.store_id,count:618}});expect(seed.ok()).toBe(true);
 const calls=[];page.on('request',r=>{if(r.url().includes('/api/products/catalogue'))calls.push(r.url());});
 await page.goto('/dapuros/app/products');await expect(page.getByTestId('table-pagination')).toContainText('618 menu');
 expect(await page.locator('[data-testid^="product-row-"]').count()).toBe(25);
 const readCount=calls.length;await page.getByTestId('products-search').fill('E2E Menu 0617');await expect(page.getByTestId('product-row-e2e-menu-0617')).toBeVisible();
 expect(calls).toHaveLength(readCount);await expect(page.getByTestId('products-page')).not.toContainText('Foreign retail product');
 let interrupted=true;
 await context.route('**/api/products/catalogue?*',route=>interrupted&&new URL(route.request().url()).searchParams.has('cursor')?route.abort('failed'):route.fallback());
 await page.reload();await expect(page.getByTestId('products-read-state')).toContainText('belum dapat diperbarui');
 await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(0);
 interrupted=false;await page.getByRole('button',{name:'Coba lagi',exact:true}).click();await expect(page.getByTestId('table-pagination')).toContainText('618 menu');
 await page.screenshot({path:path.join(root,'tmp/full-e2e-catalogue-desktop.png'),fullPage:true});
});
test('receiving a purchase actually increases stock once and persists item lines',async({page,request})=>{
 const session=await register(page,request),p=await product(request,session);
 const supplier=await api(request,session,'post','/suppliers',{name:'E2E Supplier'});
 await api(request,session,'post','/purchase/orders',{po_no:'PO-E2E-RECEIVE',supplier_id:supplier.id,supplier_name:supplier.name,total:15000,status:'Ordered',items:[{product_id:p.id,quantity:5,unit_cost:3000}]});
 await page.goto('/dapuros/app/purchase/receiving');await page.getByRole('button',{name:'Terima Barang'}).click();
 await expect(page.getByTestId('receiving-list')).toContainText('PO-E2E-RECEIVE');
 expect((await api(request,session,'get','/products')).find(x=>x.id===p.id).stock).toBe(25);
 const receipts=await api(request,session,'get','/purchase/receiving');expect(receipts).toHaveLength(1);
 await api(request,session,'post','/purchase/receiving',{po_no:'PO-E2E-RECEIVE',gr_no:'RETRY',received_by:'untrusted UI value'});
 expect((await api(request,session,'get','/products')).find(x=>x.id===p.id).stock).toBe(25);
 expect(await api(request,session,'get','/purchase/receiving')).toHaveLength(1);
});
test('inventory adjustment rejects unknown products and insufficient stock without partial records',async({page,request})=>{
 const session=await register(page,request),p=await product(request,session);
 const missing=await request.post(runtime.base+'/api/products/stock-adjustments',{headers:session.headers,data:{product_name:'Missing',sku:'MISSING',adjustment_qty:3,type:'add',reason:'E2E'}});
 expect(missing.status()).toBe(404);
 const excessive=await request.post(runtime.base+'/api/products/stock-adjustments',{headers:session.headers,data:{product_name:p.name,sku:p.sku,adjustment_qty:21,type:'sub',reason:'E2E'}});
 expect(excessive.status()).toBe(409);
 expect(await api(request,session,'get','/products/stock-adjustments')).toHaveLength(0);
 expect((await api(request,session,'get','/products')).find(x=>x.id===p.id).stock).toBe(20);
});
test('real registration, persisted category CRUD and session restart',async({page,request})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await register(page,request);
 await page.goto('/dapuros/app/products/categories');
 await page.getByTestId('category-name-input').fill('E2E Minuman');await page.getByTestId('category-submit').click();
 await expect(page.getByTestId('categories-list')).toContainText('E2E Minuman');
 await page.reload();await expect(page.getByTestId('categories-list')).toContainText('E2E Minuman');
 const row=page.getByTestId('categories-list').locator('tr',{hasText:'E2E Minuman'});
 await row.getByTitle('Edit').click();await page.getByTestId('category-name-input').fill('E2E Kopi');await page.getByTestId('category-submit').click();
 await expect(page.getByTestId('categories-list')).toContainText('E2E Kopi');
 await page.getByTestId('categories-list').locator('tr',{hasText:'E2E Kopi'}).getByTitle('Hapus').click();
 await expect(page.getByTestId('categories-list')).not.toContainText('E2E Kopi');
 expect(errors).toEqual([]);coverage.push('registration/category CRUD/reload');
});
test('every customer module loads against the real backend without failed reads',async({page,request})=>{
 test.setTimeout(240000);await register(page,request);
 const errors=[],failures=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.url().includes('/api/')&&response.status()>=400)failures.push({url:new URL(response.url()).pathname,status:response.status()});});
 const routes=['dashboard','pos','sales','kds','qr-menu','products','products/ingredients','products/categories','products/brands','products/units','products/stock-adjustment','products/stock-transfer','inventory/overview','inventory/movement','inventory/valuation','inventory/low-stock','inventory/dead-stock','purchase/orders','purchase/receiving','purchase/invoices','suppliers','customers','customers/membership','customers/loyalty','debt/receivable','debt/payable','reports/sales','reports/product','reports/inventory','reports/profit','reports/cashflow','reports/tax','staff/management','staff/roles','staff/permissions','staff/attendance','attendance','branches','license','about','settings/general','settings/store','settings/billing','settings/receipt','settings/printer','settings/users','settings/license','payments/cash','payments/qris','payments/ewallet','payments/va','payments/credit_card','payments/bank_transfer','payments/edc','integrations/xendit','integrations/doku','integrations/qris','integrations/whatsapp'];
 for(const route of routes){
  await page.goto('/dapuros/app/'+route);await expect(page.getByTestId('app-layout'),route).toBeVisible();
  await expect(page.getByTestId('route-loading')).toHaveCount(0);await page.waitForTimeout(200);
  await expect.soft(page.locator('.route-stage'),route).not.toContainText(/Halaman tidak ditemukan|Memuat halaman/);
  coverage.push(route);
 }
 expect(errors).toEqual([]);expect(failures).toEqual([]);
 fs.writeFileSync(path.join(root,'tmp/full-e2e-navigation.json'),JSON.stringify({routes,errors,failures},null,2));
});
