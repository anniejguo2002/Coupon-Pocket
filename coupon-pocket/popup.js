const $=id=>document.getElementById(id);
let tab,origin,state;
const status=text=>$('status').textContent=text;
async function request(type,extra={}) {
  const response=await chrome.runtime.sendMessage({type,origin,...extra});
  if(!response.ok) throw Error(response.error);
  return response.data;
}
function render() {
  $('enable').textContent=state.enabled?'Disable on this site':'Enable on this site';
  $('auto').checked=state.auto;
  $('scan').disabled=$('try').disabled=!state.enabled;
  const codes=state.codes.filter(c=>Date.now()-c.seen<30*86400000);
  $('count').textContent=codes.length;
  $('coupons').replaceChildren();
  if(!codes.length) {
    const li=document.createElement('li'); li.className='empty';li.textContent='No codes yet. Browse this store’s promotions or add a code below. Advertised codes are collected automatically.';$('coupons').append(li);
  }
  codes.slice().reverse().forEach(c=>{
    const li=document.createElement('li'),label=document.createElement('div'),code=document.createElement('strong'),meta=document.createElement('small'),remove=document.createElement('button');
    code.textContent=c.code;meta.textContent=c.source+' · '+new Date(c.seen).toLocaleDateString();label.append(code,meta);remove.textContent='×';remove.setAttribute('aria-label','Delete '+c.code);remove.className='link';
    remove.onclick=()=>run(async()=>{state=await request('remove',{code:c.code});render();});li.append(label,remove);$('coupons').append(li);
  });
}
async function run(fn) { try {await fn();} catch(e){status(e.message);} }
async function send(type) {
  try{return await chrome.tabs.sendMessage(tab.id,{type});}catch{throw Error('Reload this store page, then try again.');}
}
$('enable').onclick=()=>run(async()=>{
  const enabled=!state.enabled;
  if(enabled && !await chrome.permissions.request({origins:[new URL(origin).protocol+'//'+new URL(origin).hostname+'/*']})) throw Error('Site access was not granted.');
  state=await request('settings',{enabled});
  if(enabled) await chrome.scripting.executeScript({target:{tabId:tab.id},files:['core.js','content.js']});
  else await send('stop').catch(()=>{});
  render();status(enabled?'Enabled. Advertised codes will be collected as you browse.':'Disabled on this site.');
});
$('auto').onchange=()=>run(async()=>{state=await request('settings',{auto:$('auto').checked});render();});
$('add').onsubmit=e=>{e.preventDefault();run(async()=>{state=await request('add',{code:$('code').value.trim()});$('code').value='';render();status('Code saved.');});};
$('scan').onclick=()=>run(async()=>{await send('scan');state=await request('state');render();status('Page scanned for advertised codes.');});
$('try').onclick=()=>run(async()=>{const response=await send('try');status(response.message);});
run(async()=>{
  [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.url || !/^https?:/.test(tab.url)) {document.querySelectorAll('button,input').forEach(el=>el.disabled=true);throw Error('Open a shopping website to get started.');}
  origin=new URL(tab.url).origin;$('site').textContent=new URL(origin).host;
  state=await request('state');render();
});
chrome.storage.onChanged.addListener(()=>{if(origin) run(async()=>{state=await request('state');render();});});
