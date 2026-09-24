(function (root) {
  const validCode = code => typeof code === 'string' && /^[A-Z0-9][A-Z0-9_-]{2,31}$/i.test(code) && /[A-Z]/i.test(code);
  function extract(text) {
    const found = new Set();
    const re = /\b(?:use\s+(?:the\s+)?(?:promo\s+|coupon\s+|discount\s+)?code|(?:promo|coupon|discount)\s+code)\s*[:=\-]?\s*["'“]?([A-Z0-9][A-Z0-9_-]{2,31})\b/gi;
    for (const match of text.matchAll(re)) if (validCode(match[1]) && match[1] === match[1].toUpperCase() && !['HERE','BELOW','ENTER','CODE','YOUR','APPLY','COPIED'].includes(match[1])) found.add(match[1]);
    return [...found].slice(0,30);
  }
  function merge(old, codes, source, now=Date.now()) {
    const result = old.filter(c => c && validCode(c.code) && now-c.seen < 30*86400000);
    for (const code of codes.filter(validCode)) {
      const existing=result.find(c=>c.code===code);
      if(existing) { existing.seen=now; } else result.push({code,source,seen:now});
    }
    return result.slice(-100);
  }
  root.CouponCore={validCode,extract,merge};
})(globalThis);
