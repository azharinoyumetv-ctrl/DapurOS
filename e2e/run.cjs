const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {MongoMemoryReplSet}=require('../../tmp/offline-mongo/node_modules/mongodb-memory-server');
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'tmp/full-e2e-runtime.json');
const port=18763,fixtureKey=crypto.randomBytes(32).toString('hex');
let mongo,backend;
function run(command,args,options={}){return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:root,windowsHide:true,...options});p.once('error',reject);p.once('close',code=>resolve(code??1));});}
(async()=>{try{
 fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
 mongo=await MongoMemoryReplSet.create({binary:{version:'8.0.17',downloadDir:path.join(root,'../tmp/mongodb-bin')},replSet:{count:1,storageEngine:'wiredTiger',ip:'127.0.0.1'}});
 const dbName='dapuros_e2e_'+crypto.randomUUID().replaceAll('-','');
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','PATHEXT','SYSTEMROOT','WINDIR','TEMP','TMP','USERPROFILE','LOCALAPPDATA','APPDATA','COMSPEC','PYTHONPATH'].includes(key.toUpperCase())));
 Object.assign(env,{ENV:'test',MONGO_URL:mongo.getUri(),DB_NAME:dbName,JWT_SECRET_KEY:crypto.randomBytes(48).toString('hex'),E2E_FIXTURE_KEY:fixtureKey,PYTHONUNBUFFERED:'1'});
 const log=fs.openSync(path.join(root,'tmp/full-e2e-backend.log'),'w');
 backend=spawn(path.join(root,'../GerainaOS/backend/venv/Scripts/python.exe'),['-m','uvicorn','e2e.backend:app','--host','127.0.0.1','--port',String(port)],{cwd:root,env,windowsHide:true,stdio:['ignore',log,log]});
 backend.once('error',error=>{throw error;});
 const base=`http://127.0.0.1:${port}`;
 let ready=false;
 for(let i=0;i<100;i++){
  try{const response=await fetch(base+'/api/health');if(response.ok&&(await response.json()).ok){ready=true;break;}}catch{}
  if(backend.exitCode!==null)throw Error('The isolated backend stopped; see tmp/full-e2e-backend.log');
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 if(!ready)throw Error('The isolated backend did not become healthy');
 fs.writeFileSync(runtime,JSON.stringify({base,fixtureKey,dbName}));
 console.error('Real DapurOS backend and isolated MongoDB replica are ready.');
 const args=process.argv.slice(2),withSockets=args.includes('--with-sockets'),withContracts=args.includes('--with-contracts'),withTransactions=args.includes('--with-transactions');
 const editor=args.includes('--editor'),nativeEditor=args.includes('--editor-native');
 const selectedArgs=args.filter(arg=>!['--with-sockets','--with-contracts','--with-transactions','--editor','--editor-native'].includes(arg));
 process.exitCode=nativeEditor
  ?await run(process.execPath,['android-app/scripts/verify-product-editor-android.cjs',...selectedArgs],{stdio:'inherit'})
  :await run(process.execPath,['frontend/node_modules/@playwright/test/cli.js','test','--config',editor?'frontend/playwright.product-editor.config.js':'frontend/playwright.full-local.config.js',...selectedArgs],{stdio:'inherit'});
 if(withSockets){
  const socketLog=fs.openSync(path.join(root,'tmp/full-e2e-sockets.log'),'w');
  const result=await run(path.join(root,'../GerainaOS/backend/venv/Scripts/python.exe'),['-m','pytest','-q','e2e/test_websocket.py','e2e/test_integrity.py'],{env:{...env,DB_NAME:dbName+'_socket'},stdio:['ignore',socketLog,socketLog]});
  fs.closeSync(socketLog);console.error(`ASGI socket checks: ${result===0?'passed':'failed (see tmp/full-e2e-sockets.log)'}`);if(result)process.exitCode=result;
 }
 if(withContracts||withTransactions){
  const selected=withContracts?fs.readdirSync(path.join(root,'backend/tests')).filter(name=>/^test_.*\.py$/.test(name)&&name!=='test_restaurant_release.py').map(name=>'backend/tests/'+name):[];
  if(withTransactions){fs.writeFileSync(path.join(root,'tmp/release-mongo.json'),JSON.stringify({uri:mongo.getUri()}));selected.push('backend/tests/test_restaurant_release.py');}
  const log=fs.openSync(path.join(root,'tmp/full-e2e-contracts.log'),'w');
  const result=await run(path.join(root,'../GerainaOS/backend/venv/Scripts/python.exe'),['-c','import e2e.backend; import pytest, sys; sys.exit(pytest.main(sys.argv[1:]))','-q','--disable-warnings','--junitxml=tmp/full-e2e-contracts.xml',...selected],{env:{...env,DB_NAME:dbName+'_contracts'},stdio:['ignore',log,log]});
  fs.closeSync(log);console.error(`Backend regression checks: ${result===0?'passed':'failed (see tmp/full-e2e-contracts.log)'}`);if(result)process.exitCode=result;
 }
}finally{
 if(backend){backend.kill();await new Promise(resolve=>backend.exitCode!==null?resolve():backend.once('close',resolve));}
 if(mongo)await mongo.stop().catch(error=>console.warn('Fixture shutdown diagnostic:',error.message));
}})().catch(error=>{console.error(error.message);process.exitCode=1;});
