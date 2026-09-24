(() => {
  if(window.__couponPocket) return;
  window.__couponPocket=true;
  let preparing=false,running=false,cancelled=false,timer,lastScan='',panel,autoDone=false;
  const attempted=new Set();
  const visible=el=>el && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
  async function request(type,extra={}) {
    const r=await chrome.runtime.sendMessage({type,...extra});if(!r.ok) throw Error(r.error);return r.data;
  }
  function notice(text,stop=false) {
    if(!panel) {
      panel=document.createElement('div');panel.id='coupon-pocket-panel';
      const shadow=panel.attachShadow({mode:'open'});
      shadow.innerHTML='<style>:host{all:initial;position:fixed;right:20px;bottom:20px;z-index:2147483647}section{font:14px system-ui;background:#173e2b;color:white;box-shadow:0 8px 35px #0003;border-radius:14px;padding:18px;width:290px;line-height:1.5}b{color:#d8eea4}p{margin:8px 0}button{background:#d8eea4;color:#173e2b;border:0;border-radius:6px;padding:6px 12px;cursor:pointer}</style><section aria-live="polite"><b>✳ Coupon Pocket</b><p></p><button></button></section>';
      document.documentElement.append(panel);
    }
    panel.shadowRoot.querySelector('p').textContent=text;
    const button=panel.shadowRoot.querySelector('button');button.textContent=stop?'Stop testing':'Dismiss';
    button.onclick=()=>{cancelled=true;panel.remove();panel=null;};
  }
  function field() {
    const candidates=[...document.querySelectorAll('input')].filter(el=>visible(el)&&!el.disabled&&!el.readOnly && ['text','search',''].includes(el.type) && /coupon|promo|discount|reduction/i.test([el.name,el.id,el.placeholder,el.getAttribute('aria-label'),...Array.from(el.labels||[],l=>l.textContent)].join(' ')));
    return candidates.length===1?candidates[0]:null;
  }
  function buttonFor(input) {
    for(let container=input.parentElement,depth=0;container&&depth<4;container=container.parentElement,depth++) {
      const buttons=[...container.querySelectorAll('button,input[type=button],input[type=submit]')].filter(b=>visible(b)&&/^(apply|apply code|apply coupon|apply discount|apply promo code|redeem|redeem code|add code)$/i.test((b.innerText||b.value||b.getAttribute('aria-label')||'').trim()));
      if(buttons.length===1)return buttons[0];
      if(container.tagName==='FORM')break;
    }
    return null;
  }
  function feedback(input) {
    const nodes=new Set(document.querySelectorAll('[role=alert],[role=status],[aria-live=polite],[aria-live=assertive],.field__message--error,.field__message--success,[data-coupon-message]'));
    for(const id of (input.getAttribute('aria-describedby')||'').split(/\s+/)) if(id) {const el=document.getElementById(id);if(el)nodes.add(el);}
    return [...nodes].filter(visible).map(n=>n.innerText.trim()).filter(Boolean).join('\n');
  }
  function result(text,code) {
    const safe=code.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const rejected=/(?:invalid|expired|not applied|not added|not valid|not applicable|not eligible|not recognized|cannot be applied|couldn.t be applied|already used|does not apply|not found)/i;
    const coupon=/coupon|promo|discount|code/i;
    for(const line of text.split('\n')) {
      if(coupon.test(line)&&rejected.test(line))return 'rejected';
      if(!rejected.test(line)&&(/(?:coupon|promo|discount|code).{0,35}(?:successfully applied|has been applied|was applied|applied successfully)/i.test(line)||new RegExp(safe+'.{0,25}(?:applied|added)','i').test(line)))return 'accepted';
    }
    return null;
  }
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function attempt(manual=false) {
    if(preparing||running)return "Already testing coupons.";
    preparing=true;
    try {return await startAttempt(manual);} finally {preparing=false;}
  }
  async function startAttempt(manual=false) {
    if(running)return 'Already testing coupons.';
    const state=await request('state');
    if(!state.enabled || (!manual&&!state.auto))return 'Enable this store first.';
    const input=field();
    if(!input)return 'Open checkout and reveal a single coupon field first.';
    if(input.value.trim())return 'A code is already entered. Clear it first to try saved codes.';
    const button=buttonFor(input);
    if(!button)return 'Could not identify a dedicated Apply button. Enter a saved code manually.';
    const codes=state.codes.filter(c=>Date.now()-c.seen<30*86400000&&!attempted.has(c.code)).slice(0,10);
    if(!codes.length)return 'No untried codes saved for this store.';
    running=true;cancelled=false;autoDone=true;
    notice('Checking '+codes.length+' saved code'+(codes.length===1?'':'s')+'…',true);
    (async()=>{
      try {
        for(const {code} of codes) {
          if(cancelled)break;
          const current=await request('state');
          if(!current.enabled || (!manual&&!current.auto)) {notice('Automatic testing stopped.');break;}
          const f=field();const b=f&&buttonFor(f);
          if(!f||!b) {notice('Checkout changed. Please review the coupon field.');break;}
          const before=feedback(f);
          attempted.add(code);
          notice('Trying '+code+'…',true);
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,code);
          f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));
          await sleep(250);
          if(cancelled)break;
          // Only a dedicated coupon action; never submit a checkout form directly.
          const readyButton=field()&&buttonFor(field());
          if(!readyButton||!readyButton.isConnected||readyButton.disabled) {notice('Apply is unavailable. Please review checkout.');break;}
          readyButton.click();
          let outcome=null;
          for(let i=0;i<32&&!cancelled;i++) {
            await sleep(250);
            const text=feedback(field()||f);
            if(text!==before)outcome=result(text,code);
            if(outcome)break;
          }
          if(cancelled)break;
          if(outcome==='accepted') {notice(code+' was accepted. Review your order total before paying.');break;}
          if(!outcome) {notice('No clear result for '+code+'. Testing stopped. Please review checkout.');break;}
          if(code===codes[codes.length-1].code)notice('These codes were not accepted. Your store may require a minimum spend or specific items.');
          else await sleep(1000);
        }
      } catch(e) {notice('Testing stopped. Reopen the extension and review checkout.');}
      finally {running=false;}
    })();
    return 'Testing started. Follow the progress on the shopping page.';
  }
  async function scan() {
    const state=await request('state');if(!state.enabled)return;
    // Read rendered promotional text only, never input values.
    const text=(document.body?.innerText||'').slice(0,200000);
    const codes=CouponCore.extract(text);
    const signature=JSON.stringify(codes);
    if(signature!==lastScan) {lastScan=signature;if(codes.length)await request('collect',{codes});}
    if(!running&&!autoDone&&state.auto)await attempt();
  }
  const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>scan().catch(()=>{}),1000);});
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
    if(msg.type==='scan'){scan().then(()=>respond({ok:true})).catch(e=>respond({error:e.message}));return true;}
    if(msg.type==='try'){attempt(true).then(message=>respond({message})).catch(e=>respond({message:e.message}));return true;}
    if(msg.type==='stop'){cancelled=true;respond({ok:true});}
  });
  chrome.storage.onChanged.addListener(()=>{scan().catch(()=>{});});
  scan().catch(()=>{});
})();
