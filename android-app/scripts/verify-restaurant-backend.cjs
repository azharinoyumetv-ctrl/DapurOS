const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {MongoMemoryReplSet} = require('../../../tmp/offline-mongo/node_modules/mongodb-memory-server');
const root = path.resolve(__dirname, '../..');
(async () => {
  const temporary = path.resolve(root, 'tmp/restaurant-mongo-' + Date.now());
  if (!temporary.startsWith(path.join(root, 'tmp') + path.sep)) throw Error('Unexpected fixture path');
  fs.mkdirSync(temporary, {recursive:true});
  let replica;
  try {
    replica = await MongoMemoryReplSet.create({binary:{version:'8.0.17',downloadDir:path.resolve(root,'../tmp/mongodb-bin')},instanceOpts:[{dbPath:temporary}],replSet:{count:1,storageEngine:'wiredTiger',ip:'127.0.0.1'}});
    fs.writeFileSync(path.join(root,'tmp/release-mongo.json'),JSON.stringify({uri:replica.getUri()}));
    process.exitCode = await new Promise((resolve,reject) => {
      const child = spawn(path.resolve(root,'../GerainaOS/backend/venv/Scripts/python.exe'),['-m','pytest','backend/tests/test_restaurant_release.py','-q','--disable-warnings','--junitxml=tmp/restaurant-transactions.xml'],{cwd:root,stdio:'inherit',windowsHide:true});
      child.once('error',reject); child.once('close',code=>resolve(code ?? 1));
    });
  } finally { if(replica) await replica.stop({doCleanup:false}); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
