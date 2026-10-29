const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'./tests',testMatch:'companion-sessions-local.spec.js',outputDir:'../tmp/companion-browser-artifacts',workers:1,retries:0,timeout:30000,expect:{timeout:8000},use:{channel:'chrome',headless:true,viewport:{width:1440,height:1000},screenshot:'only-on-failure'}});
