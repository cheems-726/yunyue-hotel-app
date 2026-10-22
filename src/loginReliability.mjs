// V129 · 登录可靠性（R109-1/R109-2）—— 纯逻辑：连通预检 / 入口建议 / 错误分级 / 工号校验
//
// 红线：
//   · 入口只作【建议】，不写死为唯一路径（用户仍可手输/继续用当前入口）
//   · 预检失败不阻塞离线演示
//   · 密码首尾空格仍要能登录（旧行为不回退）—— 本模块不参与 trim 决策，登录处继续 trim

const 备选入口 = [
  { 名: 'B 备选（HTTP）', url: 'http://121.196.196.37' },
  { 名: 'C 备选（HTTPS · 自签）', url: 'https://121.196.196.37' },
]

/** 四类错误（文案 + 下一步 必须同时存在） */
export const 错误类型 = {
  网络不可达: '网络不可达',
  凭证错误: '凭证错误',
  工号格式: '工号格式',
  服务器故障: '服务器故障',
  其他: '其他',
}

/**
 * 登录错误分级
 * @param {{message?:string, status?:number, name?:string, 入口?:string, 重试次数?:number}} e
 */
export function 分类登录错误({ message = '', status = 0, name = '', 入口 = '当前入口', 重试次数 = 0 } = {}) {
  const msg = String(message || '')
  const st = Number(status) || 0
  // ① 网络不可达：fetch 抛错 / 无状态码 / 明确的网络错误名
  if (st === 0 || name === 'TypeError' || /failed to fetch|networkerror|load failed|err_|network request failed/i.test(msg)) {
    return {
      类型: 错误类型.网络不可达,
      文案: `连不上服务器（${入口} 不通）`,
      下一步: '换用探测到的可用入口，或检查网络/梯子；也可先用「离线演示」',
      可重试: true,
    }
  }
  // ①-0 账号停用：GoTrue 对禁用账号返回 400 user_banned（必须先于 400 通用分支，否则会显示成"密码错"）
  if (/user.?banned|user is banned/i.test(msg)) {
    return {
      类型: 错误类型.凭证错误,
      文案: '账号已停用（不能登录）',
      下一步: '该账号已被停用；需要恢复请联系老师',
      可重试: false,
    }
  }
  // ①-1 限流：429 / GoTrue 的 rate limit 文案（旧代码会并进 400 凭证错 ⇒ 误导"密码不对"）
  if (st === 429 || /rate.?limit|too many requests|请求过多|尝试太频繁|email.?send.?rate/i.test(msg)) {
    return {
      类型: 错误类型.服务器故障,
      文案: '尝试太频繁，请 60 秒后再试',
      下一步: '停 1 分钟再登录；连续点 10 次会触发服务端限流',
      可重试: true,
    }
  }
  // ② 凭证错误：Supabase 400 invalid_credentials（必须在服务器故障之前判，避免 4xx 被并进网络错）
  if (st === 400 || /invalid.?login|invalid.?credentials|账号或密码错误/i.test(msg)) {
    return {
      类型: 错误类型.凭证错误,
      文案: '工号或密码不对（注意大小写、首尾空格）',
      下一步: '口令改过的话旧口令立即失效；忘记口令请找老师重置',
      可重试: false,
    }
  }
  // ③ 服务器故障：5xx / 超时 / 限流
  if (st >= 500 || st === 408 || st === 429 || /timeout|超时|502|503|504|服务暂不可用/i.test(msg)) {
    return {
      类型: 错误类型.服务器故障,
      文案: `服务器忙或故障（已重试 ${Math.max(0, Number(重试次数) || 0)} 次）`,
      下一步: '点「重试」再试一次；已填的账号密码会保留',
      可重试: true,
    }
  }
  return {
    类型: 错误类型.其他,
    文案: '登录失败：' + (msg || '未知错误'),
    下一步: '重试一次；仍失败请联系老师（附上这条提示）',
    可重试: true,
  }
}

/** 学号/工号输入规范化（只在登录时用，不回显）：去空白 → 全角转半角 → 去误输的邮箱后缀 */
export function 规范化账号(v) {
  let s = String(v == null ? '' : v).trim()
  s = s.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
  s = s.replace(/[　]/g, ' ')
  s = s.replace(/@yunyue\.study$/i, '').trim()
  return s
}

/** 密码里容易被手机键盘带进来的字符（只提示，不改密码）：全角字符 / 内部空格 */
export function 密码问题提示(pw) {
  const s = String(pw == null ? '' : pw)
  const 有全角 = /[！-～　]/.test(s)
  const 内部空格 = /\S\s+\S/.test(s.trim())
  if (有全角) return '密码里含全角字符，确认键盘是英文状态'
  if (内部空格) return '密码中间有空格，确认没有多打'
  return ''
}

/** 内核文本（诊断面板/错误面板共用）：Chrome/xx · X5/XWeb · iOS WebKit */
export function 内核文本(ua) {
  const s = String(ua || '')
  const c = /Chrome\/(\d+)/.exec(s)
  const x5 = /X5|XWeb/i.test(s) || (/MicroMessenger/i.test(s) && /Android/i.test(s))
  const ios = /iPhone|iPad|iPod/i.test(s)
  const base = c ? `Chrome/${c[1]}` : (ios ? 'iOS WebKit' : '未知内核')
  return base + (x5 ? ' · X5/XWeb' : '')
}

/** 诊断面板的 base 判定：含旧云端 supabase.co ⇒ 旧包（红字） */
export function base是旧云端(base) {
  return /supabase\.co/i.test(String(base || ''))
}

/** 工号/学号格式（前端校验 · 与登录页同口径） */
export function 校验工号(role, id) {
  const v = String(id == null ? '' : id)
  if (role === 'student' && !/^\d{4,12}$/.test(v)) return '学号应为 4-12 位数字'
  if (role === 'teacher' && !/^[tT]\d{1,6}$/.test(v)) return '教师工号应为 T+数字（如 T2024）'
  return ''
}

/** 单地址探测（默认 3s 超时 · 不抛错，返回结构化结果） */
export async function 探测地址(url, { timeout = 3000, fetchImpl = globalThis.fetch } = {}) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null
  // 静默理由：AbortController 已被平台回收/不可用 ⇒ 超时兜底失败不影响探测结果（fetch 自身会超时）
  const t = setTimeout(() => { try { ctl && ctl.abort() } catch (e) {} }, Math.max(100, Number(timeout) || 3000))
  try {
    const r = await fetchImpl(url, { signal: ctl ? ctl.signal : undefined, cache: 'no-store', mode: 'cors' })
    return { url, ok: !!r.ok, status: Number(r.status) || 0 }
  } catch (e) {
    return { url, ok: false, status: 0, error: (e && (e.name || e.message)) || 'error' }
  } finally { clearTimeout(t) }
}

/** 入口候选：A 当前 origin · B/C 备选（只作建议） */
export function 入口候选(origin) {
  return [
    { 名: 'A 当前入口', url: String(origin || '') },
    ...备选入口,
  ]
}

/**
 * 登录前连通预检
 * @returns {{状态:'ok'|'入口可用'|'全不通', supabaseOk:boolean, 可用入口:string|null, 入口s:Array, 说明:string}}
 */
export async function 登录预检({ supabaseUrl = '', origin = '', timeout = 3000, fetchImpl = globalThis.fetch } = {}) {
  const 健康 = await 探测地址(`${String(supabaseUrl).replace(/\/+$/, '')}/auth/v1/health`, { timeout, fetchImpl })
  if (健康.ok) {
    return { 状态: 'ok', supabaseOk: true, 可用入口: null, 入口s: [], 说明: '登录服务器可达' }
  }
  const 入口s = []
  for (const e of 入口候选(origin)) {
    if (!e.url) continue
    const r = await 探测地址(`${e.url.replace(/\/+$/, '')}/health`, { timeout, fetchImpl })
    入口s.push({ ...e, ok: r.ok, status: r.status, ...(r.error ? { error: r.error } : {}) })
  }
  const 可用 = 入口s.filter(x => x.ok)
  if (可用.length) {
    return { 状态: '入口可用', supabaseOk: false, 可用入口: 可用[0].url, 入口s, 说明: `登录服务器不可达；可用入口：${可用[0].名}` }
  }
  return { 状态: '全不通', supabaseOk: false, 可用入口: null, 入口s, 说明: '三个入口都不通（不是密码问题）' }
}
