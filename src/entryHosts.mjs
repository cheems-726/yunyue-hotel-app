// V142 §1 · 入口域名白名单（单一来源：登录横幅 / 诊断面板 / 单测共用）
// 背景：用户手机打开 www.2026911301.xyz —— 那是 Vercel 上的 10-19 旧包，账号不在那个站。
export const 正式入口 = 'https://test.2026911301.xyz'

export const 合法入口 = ['test.2026911301.xyz', 'localhost', '127.0.0.1']

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
