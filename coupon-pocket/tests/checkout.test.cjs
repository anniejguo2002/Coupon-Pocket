const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../content.js'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'../core.js'),'utf8');
function harness({auto=true,value='',label='Apply',outcome='normal'}={}) {
 let message='',panel,buttons=[],calls=[];let statusText='';const listeners=[];
 class Input{constructor(){this.name='coupon';this.type='text';this.labels=[];this.parentElement={querySelectorAll:()=>[button]};this._value=value;}get value(){return this._value;}set value(v){this._value=v;}getClientRects(){return [1];}getAttribute(){return '';}dispatchEvent(){}}
 const input=new Input();const button={innerText:label,isConnected:true,getClientRects:()=>[1],click(){calls.push(input.value);statusText=outcome==='ambiguous'?'Please review your cart.':input.value==='POCKET15'?'POCKET15 applied successfully.':'Coupon code is invalid.';}};
 const feedback={getClientRects:()=>[1],get innerText(){return statusText;}};
 const state={enabled:true,auto,codes:[]};
 const document={body:{innerText:'Use code EXPIRED20. Use code POCKET15.'},documentElement:{append(){}},querySelectorAll(selector){if(selector==='input')return [input];return [feedback];},getElementById(){},createElement(){const text={set textContent(v){message=v;}};const b={};buttons.push(b);return panel={attachShadow(){return this.shadowRoot={querySelector:s=>s==='p'?text:b};},remove(){}};}};
 const context={document,window:{},HTMLInputElement:Input,Event:class{},MutationObserver:class{observe(){}},getComputedStyle:()=>({visibility:'visible'}),setTimeout:fn=>setTimeout(fn,1),clearTimeout,chrome:{runtime:{sendMessage:async m=>{if(m.type==='collect')state.codes=m.codes.map(code=>({code,seen:Date.now()}));return {ok:true,data:structuredClone(state)};},onMessage:{addListener:fn=>listeners.push(fn)}},storage:{onChanged:{addListener(){}}}}};
 vm.createContext(context);vm.runInContext(core,context);vm.runInContext(source,context);
 return {calls,state,input,buttons,get message(){return message;}};
}
const wait=()=>new Promise(r=>setTimeout(r,150));
test('collects and tries rejected code then accepted code',async()=>{const h=harness();await wait();assert.deepEqual(h.calls,['EXPIRED20','POCKET15']);assert.match(h.message,/was accepted/);});
test('does not apply with auto disabled',async()=>{const h=harness({auto:false});await wait();assert.equal(h.state.codes.length,2);assert.deepEqual(h.calls,[]);});
test('preserves an existing code',async()=>{const h=harness({value:'MYCODE'});await wait();assert.deepEqual(h.calls,[]);assert.equal(h.input.value,'MYCODE');});
test('will not click a purchase button',async()=>{const h=harness({label:'Place order'});await wait();assert.deepEqual(h.calls,[]);});
test('stops when feedback is ambiguous',async()=>{const h=harness({outcome:'ambiguous'});await wait();assert.deepEqual(h.calls,['EXPIRED20']);assert.match(h.message,/No clear result/);});
