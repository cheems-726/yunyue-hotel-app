// 防作弊三件套（Wave 1 · W1-4 / T3.6）
//
// ① 决策日志链式校验（E3 已把语义回写 B1 §四，本文件是实现）
//      hash_0 = 'genesis' ；hash_N = FNV1a(hash_{N-1} + entryId)
//    性质：任一条被【改动/删除/插入】，其后所有 hash 全部失配 ⇒ 服务端可定位首个坏点。
// ② 服务端范围检查：越界决策被拒（见 serverTick.validateDecisions / validateStateBounds）
// ③ 留痕 + 异常模式提示：append-only 日志 + "决策模式异常一致"提示（教学防作弊，非惩罚）
//
// ── 设计取舍（写在明处）──────────────────────────────────────────
//   · 只用 FNV-1a 32 位：它【不是密码学哈希】，挡不住"有预谋的伪造"。
//     这里的目标是【可检测的意外/廉价篡改】（学生改本机存档后上传），不是对抗有资源的攻击者。
//     要抗伪造需 HMAC + 服务端密钥（属二期；接口已留出：verifyChain 可换 hashFn）。
//   · hash 由【服务端】计算并保管基准值；客户端只提交 entryId 序列（不回传明文链）。

export const CHAIN_GENESIS = 'genesis'

// FNV-1a 32 位（纯函数）
export function fnv1a(str) {
  let h = 0x811c9dc5
  const s = String(str)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h >>> 0
}

// 日志条目 → 稳定 entryId（同一条日志永远得同一个 id；字段顺序固定，避免 JSON 键序差异）
export function entryIdOf(e) {
  const raw = [
    e && e.day != null ? e.day : '',
    e && e.item != null ? e.item : '',
    JSON.stringify(e && e.to !== undefined ? e.to : ''),
    e && e.type != null ? e.type : '',
    e && e.confirmed ? 1 : 0,
  ].join('|')
  return fnv1a(raw).toString(16).padStart(8, '0')
}

// 追加一条并返回 { log, hash }（不可变：返回新数组）
export function appendEntry(log, entry) {
  const arr = Array.isArray(log) ? log : []
  const prev = chainHash(arr).hash
  const id = entryIdOf(entry)
  const hash = fnv1a(prev + id).toString(16).padStart(8, '0')
  return { log: [...arr, { ...entry, entryId: id, prevHash: prev, hash }], hash }
}

// 重算整条链
export function chainHash(log) {
  const arr = Array.isArray(log) ? log : []
  let hash = CHAIN_GENESIS
  for (const e of arr) hash = fnv1a(hash + entryIdOf(e)).toString(16).padStart(8, '0')
  return { hash, length: arr.length }
}

/**
 * 校验链：若条目自带 hash，则逐条比对，返回首个断点。
 * @returns {{ ok: boolean, brokenAt: number|null, expected: string|null, got: string|null, length: number }}
 */
export function verifyChain(log) {
  const arr = Array.isArray(log) ? log : []
  let hash = CHAIN_GENESIS
  for (let i = 0; i < arr.length; i++) {
    const derived = entryIdOf(arr[i])
    // ★ 存储的 entryId 是"派生值的副本"，权威值永远由内容重算。
    //   若两者不符 ⇒ 说明有人改写了 id 字段（或改了内容却留着旧 id）⇒ 同样要报断点。
    const storedId = arr[i] && typeof arr[i].entryId === 'string' ? arr[i].entryId : null
    if (storedId && storedId !== derived) {
      return { ok: false, brokenAt: i, expected: derived, got: storedId, reason: 'entryId 与内容不符', length: arr.length }
    }
    hash = fnv1a(hash + derived).toString(16).padStart(8, '0')
    const claimed = arr[i] && typeof arr[i].hash === 'string' ? arr[i].hash : null
    if (claimed && claimed !== hash) return { ok: false, brokenAt: i, expected: hash, got: claimed, reason: 'hash 与链不符', length: arr.length }
  }
  return { ok: true, brokenAt: null, expected: null, got: null, reason: null, length: arr.length }
}

/**
 * ③ "决策模式异常一致"检测（教学提示，非惩罚）。
 * 与 settlement.js 内既有提示同口径：18 项决策全部选了同一个取值 ⇒ 提示复核。
 * @returns {{ suspicious: boolean, reason: string|null, sameValue?: any, count?: number }}
 */
export function detectUniformPattern(decisions) {
  const d = decisions && typeof decisions === 'object' ? decisions : {}
  const keys = Object.keys(d).filter(k => !k.startsWith('__'))
  const vals = keys.map(k => (typeof d[k] === 'string' ? d[k] : JSON.stringify(d[k]))).filter(v => v != null && v !== '')
  if (vals.length < 3) return { suspicious: false, reason: null }
  const uniq = [...new Set(vals)]
  // 全同（且项数够多）才提示；2 项相同属正常
  if (uniq.length === 1 && vals.length >= 8) {
    return { suspicious: true, reason: `全部 ${vals.length} 项决策取了同一取值「${uniq[0]}」`, sameValue: uniq[0], count: vals.length }
  }
  return { suspicious: false, reason: null }
}
