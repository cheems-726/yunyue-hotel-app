// ALIAS · 中文任务词 → 代码标识符 别名表（单一来源）
// 🔴 唯一权威：本文件。tests/preflight.mjs 与 tests/docs-staleness.mjs 都从这里 import。
//   （此前 preflight 与 docs-staleness 各抄一份 = 两套口径会漂移；BL-3 教训的配套）
// 维护规则：新功能词出现"文档用中文、代码用英文"的鸿沟时，在这里加一行。
//
// P1-1b（别名拆细）：每个键可带 kind ——
//   kind: 'feature'（默认）= 功能实现存在即算命中
//   kind: 'wired'          = 还必须被【非测试文件】import/调用才算命中（防"文件在、没接线"）
//   kind: 'concept'        = 宽概念词，命中只给 low 置信度
export const ALIAS = {
  '职位体系': [{ id: 'role_in_group' }, { id: 'groupRole' }, { id: 'OWNER_LABELS' }],
  '职位': [{ id: 'role_in_group' }, { id: 'groupRole' }],
  '教师打分': [{ id: 'saveTeacherNote' }, { id: 'teacher_notes' }, { id: 'fetchMyNotes' }, { id: 'teacherNote' }],
  '教师批注': [{ id: 'saveTeacherNote' }, { id: 'teacher_notes' }, { id: 'fetchMyNotes' }],
  '批注打分': [{ id: 'saveTeacherNote' }, { id: 'fetchMyNotes' }, { id: 'replyTier' }],
  '资金扣减': [{ id: 'isBankrupt' }, { id: 'isWarning' }, { id: 'capital' }],
  '资金不可刷': [{ id: 'supabase', kind: 'wired' }],                      // 这是 RLS/服务端校验问题，isBankrupt 不能代表它
  '资金': [{ id: 'isBankrupt' }, { id: 'capital', kind: 'concept' }],
  '破产': [{ id: 'isBankrupt' }, { id: '破产预警' }],
  '日引擎': [{ id: 'dayEngine', kind: 'wired' }, { id: 'simulateDay', kind: 'wired' }],   // 文件在≠接线，必须查调用点
  '日引擎真实化': [{ id: 'dayEngine', kind: 'wired' }],
  '房量': [{ id: 'parseRooms' }],
  '差评处理率': [{ id: 'handleStats' }, { id: 'negativeScore' }],
  '属性': [{ id: 'attrs' }, { id: 'normalizeAttrs' }],
  '实时评价': [{ id: 'liveReview' }, { id: 'LiveFeed' }],
  '结算': [{ id: 'settle' }, { id: 'settlement' }],
  '决策流水': [{ id: 'saveDecisionLog' }, { id: 'decision_log' }],
  '防作弊': [{ id: '决策模式异常一致' }, { id: 'insights', kind: 'concept' }],   // "防作弊"是多件事，insights 只覆盖其中一角 → low
  '开业计划': [{ id: 'open-deco' }, { id: 'open-hr' }, { id: 'open-it' }],
  '证照': [{ id: 'licenses' }],
}
// 关键词展开：kw 本身 + "kw 包含的别名键"的展开值（"班级分组职位体系"含"职位体系"）
export function expandTerms(kw) {
  if (!kw) return []
  const keys = Object.keys(ALIAS).filter(k => kw.includes(k))
  return keys.flatMap(k => ALIAS[k].map(e => ({ key: k, ...e })))
}
