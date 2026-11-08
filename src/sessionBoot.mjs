// ★ V190 · 打开网址时"回不回登录页"的唯一判断点
//   规则（2026-11-08 用户令）：从外部新打开网址 ⇒ 一律回登录页；刷新/后退 ⇒ 保留登录态。
//   自动化浏览器（navigator.webdriver）保留登录态，否则所有浏览器套件都会停在登录页。
export function 应保留登录({ navType, webdriver } = {}) {
  if (webdriver) return true
  return navType === 'reload' || navType === 'back_forward'
}
