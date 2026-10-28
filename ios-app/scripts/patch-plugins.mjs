// Small fixes to native plugins, applied after `npm ci` (copy-web.mjs runs this). Each patch is idempotent.
// 1. @capgo/native-purchases starts StoreKit purchases with product.purchase(options:), which doesn't say which
//    window to present over. Squiggle is a UIScene app, and there the Apple Account sign-in can finish without the
//    payment sheet ever appearing. iOS 17+ has purchase(confirmIn:options:), which takes the scene; use it.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const f = join(here, '..', 'node_modules', '@capgo', 'native-purchases', 'ios', 'Sources', 'NativePurchasesPlugin', 'NativePurchasesPlugin.swift');
if (existsSync(f)) {
  const s = readFileSync(f, 'utf8');
  const old = 'let result = try await product.purchase(options: purchaseOptions)';
  const neu = `let result: Product.PurchaseResult
                if #available(iOS 17.0, *), let scene = (UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) ?? UIApplication.shared.connectedScenes.first) {
                    result = try await product.purchase(confirmIn: scene, options: purchaseOptions) // squiggle-patch
                } else {
                    result = try await product.purchase(options: purchaseOptions)
                }`;
  if (s.includes('squiggle-patch')) console.log('native-purchases: already patched');
  else if (s.includes(old)) { writeFileSync(f, s.replace(old, neu)); console.log('native-purchases: purchases now present over the app scene'); }
  else console.log('native-purchases: purchase call not found; the plugin changed, review scripts/patch-plugins.mjs');
}
