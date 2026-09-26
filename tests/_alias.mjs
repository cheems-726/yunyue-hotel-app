// ALIAS · 中文任务词 → 代码标识符 别名表（单一来源）
// 🔴 唯一权威：本文件。tests/preflight.mjs 与 tests/docs-staleness.mjs 都从这里 import。
//   （此前 preflight 与 docs-staleness 各抄一份 = 两套口径会漂移；BL-3 教训的配套）
// 维护规则：新功能词出现"文档用中文、代码用英文"的鸿沟时，在这里加一行。
export const ALIAS = {
  '职位体系': ['role_in_group', 'groupRole', 'OWNER_LABELS'],
  '职位': ['role_in_group', 'groupRole'],
  '教师打分': ['saveTeacherNote', 'teacher_notes', 'fetchMyNotes', 'teacherNote'],
  '教师批注': ['saveTeacherNote', 'teacher_notes', 'fetchMyNotes'],
  '批注打分': ['saveTeacherNote', 'fetchMyNotes', 'replyTier'],
  '资金扣减': ['isBankrupt', 'isWarning', 'capital'],
  '资金': ['isBankrupt', 'capital'],
  '破产': ['isBankrupt', '破产预警'],
  '日引擎': ['dayEngine', 'simulateDay'],
  '房量': ['parseRooms'],
  '差评处理率': ['handleStats', 'negativeScore'],
  '属性': ['attrs', 'normalizeAttrs'],
  '实时评价': ['liveReview', 'LiveFeed'],
  '结算': ['settle', 'settlement'],
  '决策流水': ['saveDecisionLog', 'decision_log'],
  '防作弊': ['决策模式异常一致', 'insights'],
  '开业计划': ['open-deco', 'open-hr', 'open-it'],
  '证照': ['licenses'],
}
// 关键词展开：kw 本身 + "kw 包含的别名键"的展开值（"班级分组职位体系"含"职位体系"）
export function expandTerms(kw) {
  if (!kw) return []
  const keys = Object.keys(ALIAS).filter(k => kw.includes(k))
  return keys.flatMap(k => [k, ...ALIAS[k]])
}
