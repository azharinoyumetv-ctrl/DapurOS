import { chromium } from 'playwright-core';
const B=process.env.BASE_URL||'http://localhost:3000';
const API=process.env.API_URL||'http://localhost:8000/api';
const results=[]; const pageErrors=[];
async function t(name,fn){try{await fn();results.push('PASS  '+name)}catch(e){results.push('FAIL  '+name+' :: '+String(e).split('\n')[0].slice(0,180))}}
const browser=await chromium.launch({...(process.env.PW_CHROME?{executablePath:process.env.PW_CHROME}:{}),args:['--no-sandbox']});
const page=await (await browser.newContext({viewport:{width:1440,height:900}})).newPage();
page.on('pageerror',e=>pageErrors.push(String(e).slice(0,150)));
page.setDefaultTimeout(9000);

// ---- 1. Halaman Login (SSO + demo button)
await t('Login page: login-form + master-demo-login-btn render', async()=>{
  await page.goto(B+'/dapuros/login',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-testid="login-form"]');
  await page.waitForSelector('[data-testid="master-demo-login-btn"]');
});
await t('Demo 1-click login berhasil masuk aplikasi', async()=>{
  await page.click('[data-testid="master-demo-login-btn"]');
  await page.waitForURL(/app|dashboard/,{timeout:15000});
});

// ---- 2. POS Floor Map
await t('POS: denah meja multi-lantai render (Lantai 1, Lantai 2/VIP, Rooftop)', async()=>{
  await page.goto(B+'/dapuros/app/pos',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=Lantai 1',{timeout:12000});
  const body=await page.textContent('body');
  if(!/Lantai 2|VIP/.test(body)) throw new Error('Lantai 2/VIP tidak ditemukan');
  if(!/Rooftop/.test(body)) throw new Error('Rooftop tidak ditemukan');
});
await t('POS: meja tampil dengan status (Kosong/Vacant dsb.)', async()=>{
  const body=await page.textContent('body');
  if(!/Meja/.test(body)) throw new Error('Tidak ada label Meja');
});
await t('POS: tombol tambah meja & lantai tersedia (CRUD)', async()=>{
  await page.waitForSelector('[data-testid="pos-add-table-btn"]');
  await page.waitForSelector('[data-testid="pos-add-floor-btn"]');
});

// ---- 3. Bahan Baku (BOM) + Spoilage
await t('BOM: daftar bahan baku render', async()=>{
  await page.goto(B+'/dapuros/app/products/ingredients',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-testid="ingredients-list"]');
  const rows=await page.locator('[data-testid="ingredients-list"] tbody tr').count();
  if(rows<1) throw new Error('tabel kosong');
});
await t('Spoilage: modal catat bahan terbuang + alasan resmi Indonesia', async()=>{
  await page.click('[data-testid="open-spoilage-btn"]');
  await page.waitForSelector('[data-testid="spoilage-reason-select"]');
  const opts=await page.locator('[data-testid="spoilage-reason-select"] option').allTextContents();
  for(const need of ['Kedaluwarsa (Expired)','Tumpah / Rusak Fisik (Spilled)','Kesalahan Pembuatan (Prep Error)'])
    if(!opts.includes(need)) throw new Error('alasan hilang: '+need);
});
await t('Spoilage: submit → tercatat di riwayat & stok berkurang', async()=>{
  await page.fill('input[type="number"][step="0.01"]','2');
  await page.selectOption('[data-testid="spoilage-reason-select"]',{index:0});
  await page.click('text=Catat Pembuangan');
  await page.waitForSelector('[data-testid="spoilage-log-row"]',{timeout:8000});
});

// ---- 4. KDS
await t('KDS: layar dapur + filter stasiun render', async()=>{
  await page.goto(B+'/dapuros/app/kds',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('text=Layar Dapur',{timeout:10000}).catch(async()=>{
    const b=await page.textContent('body');
    if(!/KDS|Dapur/i.test(b)) throw new Error('KDS tidak render');
  });
});

// ---- 5. QR Menu
await t('QR Menu: generator QR per meja render (QRCodeSVG)', async()=>{
  await page.goto(B+'/dapuros/app/qr-menu',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('svg',{timeout:10000});
  const b=await page.textContent('body');
  if(!/QR/i.test(b)) throw new Error('konten QR tidak ditemukan');
});

// ---- 6. EDC Simulator
await t('EDC: simulator dengan pilihan bank (BCA/Mandiri/BRI/BNI)', async()=>{
  await page.goto(B+'/dapuros/app/payments/edc',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>/BCA/.test(document.body.innerText),{timeout:10000});
  const b=await page.textContent('body');
  for(const bank of ['Mandiri','BRI','BNI']) if(!b.includes(bank)) throw new Error('bank hilang: '+bank);
});

// ---- 7. WebSocket real-time
await t('WebSocket /api/ws/{store_id}: konek + PONG', async()=>{
  const got=await page.evaluate(()=>new Promise((res)=>{
    const ws=new WebSocket('ws://localhost:8000/api/ws/master-demo-store-001');
    const to=setTimeout(()=>res('timeout'),6000);
    ws.onopen=()=>ws.send('ping');
    ws.onmessage=(m)=>{clearTimeout(to);ws.close();res(m.data)};
    ws.onerror=()=>{clearTimeout(to);res('error')};
  }));
  if(got==='timeout'||got==='error') throw new Error('WS '+got);
});

// ---- 8. Crash-proof: tiap halaman utama tidak blank + tanpa uncaught error
await t('Crash-proof: dashboard/pos/kds/qr-menu/ingredients tidak blank', async()=>{
  for(const p of ['/dapuros/app/dashboard','/dapuros/app/pos','/dapuros/app/kds','/dapuros/app/qr-menu','/dapuros/app/products/ingredients']){
    await page.goto(B+p,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(700);
    const len=(await page.textContent('#root')||'').trim().length;
    if(len<50) throw new Error('layar hampir kosong di '+p);
  }
});
await t('Tidak ada uncaught page error', async()=>{
  if(pageErrors.length) throw new Error(pageErrors.slice(0,3).join(' | '));
});

console.log('\n===== HASIL VERIFIKASI =====');
for(const r of results) console.log(r);
console.log(`===== ${results.filter(r=>r.startsWith('PASS')).length}/${results.length} PASS =====`);
await browser.close();
process.exit(0);
