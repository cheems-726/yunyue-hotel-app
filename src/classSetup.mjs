// V157/V158 · 班级管理纯函数（建班校验 / 学生导入解析 / 结果分类）—— 零 IO 可单测

/** 校验班级名：字母/数字/汉字，3–20 字符，不含空格和特殊符号 */
export function 校验班级名(name) {
  const n = String(name || '').trim()
  if (!n) return { ok: false, 原因: '班级名不能为空' }
  if (n.length < 3 || n.length > 20) return { ok: false, 原因: '班级名 3–20 字符' }
  if (/[\s/\\<>"""']/.test(n)) return { ok: false, 原因: '班级名不能含空格或特殊符号' }
  return { ok: true, name: n }
}

/**
 * 解析学生导入文本（每行一条，允许 `学号 姓名` 两列以空格/制表符分隔）
 * @returns {{ valid: Array<{学号,姓名}>, duplicates: Array<{学号,姓名}>, errors: Array<{行号,原文,原因}> }}
 *   文内重复 = duplicates（同一批粘贴里出现多次）；格式错 = errors
 */
export function 解析导入文本(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const valid = [], duplicates = [], errors = []
  const seen = new Set()
  for (let i = 0; i < lines.length; i++) {
    const 原文 = lines[i]
    const 行号 = i + 1
    const cols = 原文.split(/[\t]+|\s{2,}|^\d+\s/).map(c => c.trim()).filter(Boolean)
    // 两种形态：`学号` 或 `学号 姓名`
    const parts = 原文.split(/[\t,，]+|\s+/).map(c => c.trim()).filter(Boolean)
    if (parts.length === 0) continue
    const 学号 = parts[0]
    const 姓名 = parts.slice(1).join(' ') || ''
    if (!/^\d{4,12}$/.test(学号)) { errors.push({ 行号, 原文, 原因: '学号须 4–12 位数字' }); continue }
    if (seen.has(学号)) { duplicates.push({ 学号, 姓名 }); continue }
    seen.add(学号)
    valid.push({ 学号, 姓名: 姓名 || ('学生' + 学号.slice(-4)) })
  }
  return { valid, duplicates, errors }
}

/** 默认口令规则：学号后 6 位（不足 6 位补前导零）—— 界面必须提示 */
export function 默认口令(学号) {
  const s = String(学号 || '')
  return s.length >= 6 ? s.slice(-6) : s.padStart(6, '0')
}

/** 导入结果行（UI 结果表用） */
export function 结果行(学号, 姓名, 组号, 结果, 原因 = '') {
  return { 学号, 姓名, 组号, 结果, 原因 }
}
