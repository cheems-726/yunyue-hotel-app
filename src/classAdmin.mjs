// V165 · 开箱全流程纯层 —— 花名册解析 / 班级名与状态单源（无 IO · 教师端/学生端/单测同一份）
// 红线：本文件零网络；已存在学号一律"跳过不覆盖"，绝不写死任何名单。

/** 学期四态（+paused）学生端人话文案 —— 单源（App 横幅 / 教师端开课卡 / 单测都引这份） */
export const STUDENT_STATE_COPY = {
  draft: '老师还没开课',
  running: '',
  paused: '本周暂停（老师暂停了教学推进）——决策先别做，等老师继续',
  finished: '本学期已结课，等待老师归档',
  archived: '已归档，数据只读',
}

/** 合法学期状态集合（setSemesterStatus 同源校验用 · 见 S***base client 层说明见项目文档） */
export const SEMESTER_STATES = ['draft', 'running', 'paused', 'finished', 'archived']

/** 班级名合法性（§1：空格 / 斜杠等非法字符 ⇒ 行内提示；重名由调用方查库判定） */
export function 校验班级名(名) {
  const t = String(名 || '').trim()
  if (!t) return { ok: false, error: '班级名不能为空' }
  if (/[\s/\\#?=&%]/.test(t)) return { ok: false, error: '班级名不能含空格、斜杠等特殊字符' }
  if (t.length > 20) return { ok: false, error: '班级名过长（≤20 字符）' }
  return { ok: true, 名: t }
}

/**
 * 解析粘贴花名册（§2①：每行 `学号` 或 `学号 姓名`）
 * @returns {Array<{学号, 姓名, 组号?:number, 行号, 错误?:string}>} 错误行带 错误+原因，其余可进预览
 */
export function 解析花名册(text) {
  const rows = []
  String(text || '').split(/\r?\n/).forEach((line, i) => {
    const t = line.trim()
    if (!t) return   // 空行跳过（不算格式错）
    const parts = t.split(/\s+/)   // 每行「学号 姓名」（空格分隔 · 姓名内空格合并）
    const 学号 = parts[0], 姓名 = parts.slice(1).join('')
    if (!/^\d{6,10}$/.test(学号 || '')) { rows.push({ 行号: i + 1, 学号: 学号 || '', 姓名, 错误: '学号必须是 6–10 位数字' }); return }
    if (姓名 && /[\/\\]/.test(姓名)) { rows.push({ 行号: i + 1, 学号, 姓名, 错误: '姓名不能含斜杠' }); return }
    rows.push({ 行号: i + 1, 学号, 姓名 })
  })
  return rows
}

/** 预览分组：未手填组号的行按【导入批内顺序】每 6 人一组（组内已填组号的以手填为准，不重排） */
export function 预览分组(rows, 每组人数 = 6) {
  let 自动 = 0
  return rows.map(r => {
    if (r.错误) return r
    if (r.组号 != null) return r
    自动++
    return { ...r, 组号: Math.floor((自动 - 1) / 每组人数) + 1 }
  })
}

/** 口令清单文本（§2：默认口令 = 学号后 6 位 · 界面明示 + 可复制） */
export function 口令清单(rows) {
  return rows.filter(r => !r.错误).map(r => `${r.学号} ${r.姓名 || ''} 第${r.组号 || '?'}组 口令 ${String(r.学号).slice(-6).padStart(6, '0')}`).join('\n')
}

/** 周次回退审计记录键（decision_logs.decision_id 单源；RV：去掉审计 ⇒ 本键不出现 ⇒ 测试红） */
export const 回退审计键 = '__class_week_rollback__'
