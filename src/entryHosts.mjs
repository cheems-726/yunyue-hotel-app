// V142 §1 · 入口域名白名单（单一来源：登录横幅 / 诊断面板 / 单测共用）
// 背景：用户手机打开 www.2026911301.xyz —— 那是 Vercel 上的 10-19 旧包，账号不在那个站。
export const 正式入口 = 'https://test.2026911301.xyz'

// ★ 2026-11-09 紧急：域名 test.2026911301.xyz **未备案**，运营商 HTTP 403 / HTTPS 重置（Non-compliance ICP Filing）。
//   IP 入口是本系统同一台服务器的合法入口（功能/账号/数据完全一致）——不再当"旧站点"赶人。
export const 合法入口 = ['test.2026911301.xyz', '121.196.196.37', 'localhost', '127.0.0.1']

/** host 是否本系统（大小写不敏感；空值一律非本系统） */
export function 是否本系统(host) {
  return 合法入口.indexOf(String(host || '').toLowerCase()) >= 0
}

/** 从当前 location 生成正式入口 URL（保留 path/search） */
export function 跳转地址(loc) {
  const l = loc || {}
  const p = l.pathname && String(l.pathname).charAt(0) === '/' ? l.pathname : '/'
  const s = l.search ? String(l.search) : ''
  return 正式入口 + p + s
}
