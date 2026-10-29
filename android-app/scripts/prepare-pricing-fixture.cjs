// The real portal renderer and assets are included only in the instrumentation APK.
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const portal=path.resolve(__dirname,'../../..'),out=path.resolve(__dirname,'../app/build/generated/pricing-test-assets/public');
(async()=>{
 const worker=(await import(pathToFileURL(path.join(portal,'src/index.js')).href)).default;
 const response=await worker.fetch(new Request('https://dagangos.com/dapuros/pricing'),{ASSETS:{fetch:async request=>{
  const file=path.join(portal,'public',new URL(request.url).pathname);
  return fs.existsSync(file)?new Response(fs.readFileSync(file)):new Response('Missing',{status:404});
 }}},{});
 if(!response.ok)throw Error('Pricing fixture rendering failed');
 const html=await response.text();
 if(html.includes('<h2>Free Trial</h2>')||(html.match(/class="price-card/g)||[]).length!==3)throw Error('Pricing fixture must contain only the three paid plans');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'pricing.html'),html);
 for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]+\.(?:js|css|png))(?:[?#][^"]*)?"/g)){
  const source=path.join(portal,'public',match[1]);if(!fs.existsSync(source))continue;
  const target=path.join(out,match[1]);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
 }
 console.log('Prepared actual portal pricing UI in test-only assets.');
})().catch(error=>{console.error(error);process.exitCode=1;});
