importScripts('core.js');
let queue = Promise.resolve();
const key = origin => 'store:' + origin;
async function store(origin) {
  const k=key(origin); return (await chrome.storage.local.get(k))[k] || {enabled:false,auto:true,codes:[]};
}
async function handle(msg,sender) {
  const trusted=!sender.tab && sender.url?.startsWith(chrome.runtime.getURL(''));
  const origin=sender.tab ? new URL(sender.url).origin : msg.origin;
  if(!/^https?:\/\//.test(origin || '')) throw Error('Open a shopping website first.');
  const state=await store(origin);
  if(msg.type==='state') return state;
  if(msg.type==='collect') {
    if(!state.enabled) return state;
    const codes=Array.isArray(msg.codes)?msg.codes.slice(0,30):[];
    state.codes=CouponCore.merge(state.codes,codes,'Store page');
  } else if(trusted && msg.type==='add') {
    if(!CouponCore.validCode(msg.code)) throw Error('Use a code of 3–32 letters, numbers, underscores or hyphens.');
    state.codes=CouponCore.merge(state.codes,[msg.code],'Added by you');
  } else if(trusted && msg.type==='remove') {
    state.codes=state.codes.filter(c=>c.code!==msg.code);
  } else if(trusted && msg.type==='settings') {
    if(typeof msg.auto==='boolean') state.auto=msg.auto;
    if(typeof msg.enabled==='boolean') {
      const url=new URL(origin);
      const pattern=url.protocol+'//'+url.hostname+'/*';
      const id='site-'+Array.from(origin,c=>c.charCodeAt(0).toString(16)).join('');
      if(msg.enabled) {
        if(!await chrome.permissions.contains({origins:[pattern]})) throw Error('Site access was not granted.');
        await chrome.scripting.unregisterContentScripts({ids:[id]}).catch(()=>{});
        await chrome.scripting.registerContentScripts([{id,matches:[pattern],js:['core.js','content.js'],runAt:'document_idle',persistAcrossSessions:true}]);
      } else await chrome.scripting.unregisterContentScripts({ids:[id]}).catch(()=>{});
      state.enabled=msg.enabled;
    }
  } else throw Error('Unknown request.');
  await chrome.storage.local.set({[key(origin)]:state});
  return state;
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  queue=queue.then(()=>handle(msg,sender)).then(data=>respond({ok:true,data}),err=>respond({ok:false,error:err.message}));
  return true;
});
