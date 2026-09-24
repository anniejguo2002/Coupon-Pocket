const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 async function pageWith({html,auto=true,codes=[],mode='normal'}={}) {
 const page=await browser.newPage();
 await page.setContent(html||fs.readFileSync(path.join(root,'demo.html'),'utf8'));
 await page.evaluate(({auto,codes})=>{
   window.store={enabled:true,auto,codes:codes.map(code=>({code,seen:Date.now()}))};window.listeners=[];window.clicks=[];
   window.chrome={runtime:{sendMessage:async m=>{if(m.type==='collect')for(const code of m.codes)if(!store.codes.some(c=>c.code===code))store.codes.push({code,seen:Date.now()});return {ok:true,data:structuredClone(store)};},onMessage:{addListener:fn=>listeners.push(fn)}},storage:{onChanged:{addListener:()=>{}}}};
 },{auto,codes});
 if(!html) {
   await page.addScriptTag({path:path.join(root,'demo.js')});
   await page.evaluate(mode=>{document.querySelector('#apply').addEventListener('click',()=>clicks.push(document.querySelector('#coupon').value));if(mode==='ambiguous')document.querySelector('#apply').onclick=()=>{document.querySelector('#feedback').textContent='Please review your cart.';};},mode);
 }
 await page.addScriptTag({path:path.join(root,'core.js')});await page.addScriptTag({path:path.join(root,'content.js')});return page;
 }
 let p=await pageWith();await p.waitForFunction(()=>document.querySelector('#total').textContent==='$68.00');assert.deepEqual(await p.evaluate(()=>clicks),['EXPIRED20','POCKET15']);console.log('PASS collects, rejects expired code, applies valid code');await p.close();
 p=await pageWith({auto:false});await p.waitForTimeout(1200);assert.deepEqual(await p.evaluate(()=>clicks),[]);assert.equal(await p.evaluate(()=>store.codes.length),2);console.log('PASS auto-off still collects, without applying');await p.close();
 p=await pageWith({html:'<p>Use code SAVE10</p><label>Coupon <input name="coupon" value="MYCODE"></label><button>Apply</button>',codes:['SAVE10']});await p.waitForTimeout(1000);assert.equal(await p.locator('input').inputValue(),'MYCODE');console.log('PASS preserves existing code');await p.close();
 p=await pageWith({html:'<p>Use code SAVE10</p><label>Coupon <input name="coupon"></label><button id="pay">Place order</button>',codes:['SAVE10']});await p.evaluate(()=>document.querySelector('#pay').onclick=()=>clicks.push('payment'));await p.waitForTimeout(1000);assert.deepEqual(await p.evaluate(()=>clicks),[]);assert.equal(await p.locator('input').inputValue(),'');console.log('PASS refuses payment button');await p.close();
 p=await pageWith({mode:'ambiguous'});await p.waitForTimeout(9000);assert.deepEqual(await p.evaluate(()=>clicks),['EXPIRED20']);assert.match(await p.locator('#coupon-pocket-panel').innerText(),/No clear result/);console.log('PASS stops on ambiguous response');await p.close();
 p=await pageWith();await p.waitForFunction(()=>clicks.length===1);await p.locator('#coupon-pocket-panel').getByRole('button',{name:'Stop testing'}).click();await p.waitForTimeout(2000);assert.deepEqual(await p.evaluate(()=>clicks),['EXPIRED20']);console.log('PASS stop cancels further attempts');await p.close();
 p=await browser.newPage();await p.route('https://pocket.test/**',async route=>{const file=path.basename(new URL(route.request().url()).pathname)||'popup.html';await route.fulfill({path:path.join(root,file)});});
 await p.addInitScript(()=>{window.chrome={tabs:{query:async()=>[{id:1,url:'https://example-store.com/'}]},runtime:{sendMessage:async()=>({ok:true,data:{enabled:true,auto:true,codes:[{code:'WELCOME15',seen:Date.now(),source:'Store page'}]}})},storage:{onChanged:{addListener:()=>{}}}};});await p.goto('https://pocket.test/popup.html');await p.getByText('WELCOME15').waitFor();await p.setViewportSize({width:370,height:690});await p.screenshot({path:path.resolve(root,'../../work/popup.png')});console.log('PASS popup render');await p.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
