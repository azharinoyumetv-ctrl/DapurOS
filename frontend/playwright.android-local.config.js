const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  outputDir:'../tmp/browser-artifacts',testDir:'./tests',testMatch:'android-parity-local.spec.js',workers:1,retries:0,
  timeout:40000,expect:{timeout:12000},
  use:{channel:'chrome',headless:true,actionTimeout:12000,screenshot:'only-on-failure'},
});
