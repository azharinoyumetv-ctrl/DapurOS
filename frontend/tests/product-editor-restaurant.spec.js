const {test,expect,host,runtime}=require('./product-editor.fixture.cjs');

test.describe('Desktop file selection',()=>{
 test.use({nativeShell:false});
 test('A regular browser keeps image-file selection and the restaurant editor',async({app:f})=>{
  await f.go('app/products');await f.page.getByTestId('new-product-btn').click();
  await expect(f.page.getByTestId('pf-photo-camera')).toHaveCount(0);
  await expect(f.page.getByTestId('pf-photo-gallery')).toHaveText('Pilih gambar');
  await expect(f.page.getByTestId('bom-add-ingredient-toggle')).toBeVisible();
  expect(await f.page.getByTestId('product-form-modal').evaluate(e=>e.parentElement===document.body)).toBe(true);
  const picker=f.page.waitForEvent('filechooser');await f.page.getByTestId('pf-photo-gallery').click();
  expect((await picker).isMultiple()).toBe(false);await f.page.getByTestId('pf-image-input').setInputFiles([]);
  await f.page.getByTestId('pf-cancel').click();await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);expect(f.errors).toEqual([]);
 });
});

test('Late registry responses from the previous account cannot populate the next account editor',async({app:f})=>{
 expect((await f.api('POST','/products/categories',{name:'Private category A'})).status).toBe(200);
 const login=await f.request.post(host+'/api/auth/login',{data:{email:'dapuros-editor-b@example.com',password:'DapurEditorFixture-5642'}});expect(login.status()).toBe(200);const other=await login.json();
 expect((await f.request.post(host+'/api/products/categories',{headers:{authorization:'Bearer '+other.access_token},data:{name:'Private category B'}})).status()).toBe(200);
 let held=false,release;const barrier=new Promise(resolve=>{release=resolve;});
 await f.page.route('**/api/records/categories?*',async route=>{
  if(route.request().headers().authorization!=='Bearer '+f.session.access_token)return route.fallback();
  held=true;await barrier;try{await route.fulfill({json:{items:[{id:'late-a',name:'Private category A'}],total:1,next_cursor:null}});}catch{}
 });
 await f.page.goto('https://dagangos.com/dapuros/app/products');await expect.poll(()=>held).toBe(true);
 await f.page.evaluate(other=>{localStorage.setItem('dapuros_token',other.access_token);localStorage.setItem('dapuros_user',JSON.stringify(other.user));window.dispatchEvent(new StorageEvent('storage',{key:'dapuros_token'}));},other);
 release();await f.go('app/products');await f.page.getByTestId('new-product-btn').click();
 await expect(f.page.getByTestId('pf-category').locator('option').filter({hasText:/^Private category B$/})).toHaveCount(1);
 await expect(f.page.getByTestId('pf-category').locator('option').filter({hasText:/^Private category A$/})).toHaveCount(0);expect(f.errors).toEqual([]);
});

test('Starter owners can select saved product units without ingredient entitlement or browse-time unit reads',async({app:f})=>{
 expect((await f.api('POST','/products/units',{name:'Kotak menu',short_name:'box'})).status).toBe(200);
 const changed=await f.request.post(host+'/__e2e/plan',{headers:{'X-E2E-Fixture':runtime.fixtureKey},data:{store_id:f.session.user.store_id,plan:'starter'}});expect(changed.ok()).toBe(true);
 await f.go('app/products');
 expect(f.reads.filter(r=>r.path==='/api/records/units')).toHaveLength(0);
 await f.page.getByTestId('new-product-btn').click();
 await expect(f.page.getByTestId('pf-unit').locator('option[value="unit:box"]')).toHaveText('Kotak menu (box)');
 await expect(f.page.getByTestId('bom-add-ingredient-toggle')).toHaveCount(0);
 expect(f.reads.filter(r=>r.path==='/api/records/ingredients')).toHaveLength(0);
 await f.page.getByTestId('pf-unit').selectOption('unit:box');await f.page.getByTestId('pf-name').fill('Starter boxed menu');await f.page.getByTestId('pf-price').fill('10000');await f.page.getByTestId('pf-save').click();
 await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
 expect((await f.api('GET','/products?q=Starter%20boxed%20menu')).data[0].unit).toBe('box');expect(f.errors).toEqual([]);
});

test('Changing a recipe product category, unit and photo preserves its ingredient quantities',async({app:f})=>{
 const ingredient=await f.api('POST','/ingredients',{name:'Biji resep',unit:'g',stock:2000,safety_stock:100});expect(ingredient.status).toBe(200);
 const recipe=[{ingredient_id:ingredient.data.id,quantity:15}];
 expect((await f.api('PUT','/products/product-0000',{recipe})).status).toBe(200);
 expect((await f.api('POST','/products/units',{name:'Cangkir',short_name:'cup'})).status).toBe(200);
 expect((await f.api('POST','/products/categories',{name:'Kopi resep'})).status).toBe(200);
 await f.go('app/products');await f.page.getByTestId('edit-product-product-0000').click();
 await expect(f.page.getByTestId('product-form')).toContainText('Biji resep');
 await f.page.getByTestId('pf-unit').selectOption('unit:cup');await f.page.getByTestId('pf-category').selectOption('category:Kopi resep');
 const encoded=await f.page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;c.getContext('2d').fillRect(0,0,640,480);return c.toDataURL('image/png').split(',')[1];});
 await f.page.getByTestId('pf-image-input').setInputFiles({name:'recipe.png',mimeType:'image/png',buffer:Buffer.from(encoded,'base64')});await expect(f.page.getByTestId('pf-image-preview')).toBeVisible();
 await f.page.getByTestId('pf-save').click();await expect(f.page.getByTestId('product-form-modal')).toHaveCount(0);
 const saved=(await f.api('GET','/products?q=Legacy')).data[0];expect(saved.recipe).toEqual(recipe);expect(saved.unit).toBe('cup');expect(saved.category).toBe('Kopi resep');expect(saved.image_url).toMatch(/^data:image\/jpeg;base64,/);
 await f.page.getByTestId('edit-product-product-0000').click();await expect(f.page.getByTestId('product-form')).toContainText('Biji resep');expect(f.errors).toEqual([]);
});
