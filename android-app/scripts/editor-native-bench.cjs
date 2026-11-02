// Enables CDP only through a separately installed test APK on the owned emulator.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const adbPath='C:/Users/azhar/AppData/Local/Android/Sdk/platform-tools/adb.exe',serial='emulator-5570';
let child,finished,descriptor;
const folder='/sdcard/Android/data/com.dagangos.dapuros/files/product-editor-bench';
exports.start=async(adb,out)=>{
 assert.equal(adb(['shell','getprop','ro.boot.qemu.avd_name']).trim(),'DagangOS_Companion_API_34');
 adb(['install','-r',path.resolve(__dirname,'../app/build/outputs/apk/androidTest/release/app-release-androidTest.apk')]);
 descriptor=fs.openSync(path.join(out,'bench-'+Date.now()+'.txt'),'w');
 child=spawn(adbPath,['-s',serial,'shell','am','instrument','-w','-r','-e','class','com.example.dapurospos.ProductEditorBenchTest#serveWebView','com.dagangos.dapuros.test/androidx.test.runner.AndroidJUnitRunner'],{windowsHide:true,stdio:['ignore',descriptor,descriptor]});
 finished=new Promise(resolve=>child.once('close',resolve));
 for(let i=0;i<80;i++){
  if(child.exitCode!==null)throw Error('Editor instrumentation closed before CDP was ready. Inspect bench log.');
  try{if(adb(['shell','cat',folder+'/ready']).trim()==='isolated-test-bench')return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('Isolated editor instrumentation did not become ready.');
};
exports.stop=async(adb)=>{
 if(!child)return;
 try{adb(['shell','touch',folder+'/stop']);await Promise.race([finished,new Promise(resolve=>setTimeout(resolve,5000))]);}
 finally {if(child.exitCode===null)child.kill();child=null;if(descriptor!==undefined){fs.closeSync(descriptor);descriptor=undefined;}}
};
