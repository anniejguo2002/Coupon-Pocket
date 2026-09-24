# Coupon Pocket

A local-first Chrome extension prototype. It collects explicitly advertised coupon codes while you browse stores you enable, saves them for that exact website origin, and tries up to 10 saved codes at checkout. It stops on the first confirmed acceptance, an ambiguous response, or your Stop click. It does not find the mathematically best discount or complete purchases.

## Install

1. Open `chrome://extensions` in Google Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `coupon-pocket` folder (the folder containing `manifest.json`).
4. Open a shopping website, click the extension icon, and choose **Enable on this site**. Accept Chrome’s site access prompt.
5. Browse the store’s promotion pages. Codes in phrases such as “Use code SUMMER20” are collected. You can also add codes in the popup.
6. At checkout, reveal the coupon field. Automatic testing is enabled by default for stores you enable; turn it off in the popup if desired. You can also click **Try coupons at checkout**.

## Try the demo

From this folder run `python3 -m http.server 8765 --bind 127.0.0.1`, then open `http://127.0.0.1:8765/demo.html`. Enable the extension for that local site. The demo advertises an expired code followed by a working code, and the total should become $68.00. These codes work only in the demo. Reload to reset testing.

## Boundaries

- No external coupon API, crawling service, or pre-populated coupon database is included. Discovery only sees text on enabled pages you visit. A production coupon service needs a licensed/authorized data source and store-specific checkout adapters.
- Common English coupon labels and explicit Apply/Redeem buttons are supported. Closed shadow DOM, embedded checkout frames, non-English forms, and unusual store UIs may require custom adapters. Real retail stores have not been certified.
- Only explicit success/error feedback is trusted. If a response is unclear, testing stops instead of assuming a discount. Existing entered codes are preserved. The extension does not compare totals, remove existing discounts, or guarantee savings.
- Collection recognizes uppercase advertised codes and mixed/lowercase codes containing digits, plus explicit merchant coupon-code attributes. Codes retain their case. Codes expire locally 30 days after last seen; merchant terms can expire earlier.
- Website access is opt-in per origin. Different checkout hosts must be enabled separately. Disabling stops collection and testing but retains saved coupons and the browser’s site grant. Revoke access via Chrome extension settings or uninstall to remove stored data.
- Coupons and timestamps are stored in `chrome.storage.local`, on this browser only. No analytics, remote services, accounts, affiliate links, payment access, or remote code. Page text is processed locally; form values are not collected. The checkout code field is read only for applying coupons.

## Development

Plain JavaScript, Manifest V3, no build step or dependencies for the extension. `core.js` contains coupon extraction/storage rules; `background.js` serializes storage and manages site permissions; `content.js` handles discovery and cautious checkout interaction; `popup.*` supplies controls.

Run unit tests with `node --test tests/*.test.cjs`. Browser tests use Playwright (see `tests/browser.cjs`).

Chrome references: [Manifest V3](https://developer.chrome.com/docs/extensions/reference/manifest), [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), and [permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).

## Validation status

Fourteen automated unit and simulated-checkout checks pass. They cover discovery, expiry, invalid code filtering, rejected-to-accepted retry, auto-off, preserving entered codes, refusing payment buttons, and ambiguous-response stopping. The checkout tests use a simulated DOM and Chrome API. A Playwright browser suite is included but could not run in the build environment because Chrome failed to launch. Installation, native Chrome permissions, and real merchant checkout compatibility still need browser validation.

## Version 0.1.1

- Recognizes “Enter code”, “Apply code”, “Discount code is”, mixed-case codes containing digits, and visible merchant coupon-code data attributes.
- Detects coupon fields revealed through class/style changes and additional Apply button labels.
- Prevents frequent page updates from indefinitely postponing scans.
- Shows why automatic application is waiting: no codes collected, no visible field, unrecognized Apply button, or an existing entered code.

To update an unpacked installation, replace the contents of your installed extension folder with this version, click **Reload** on Coupon Pocket in `chrome://extensions`, then refresh your store tabs. Confirm version **0.1.1** and enable **Automatically try saved codes**. A coupon must still be advertised on a page you visit or otherwise added; this update does not connect an external coupon service.
