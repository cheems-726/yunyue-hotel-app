// V157 阶段二 · class_state 行定位（多班单源）
//
// 迁移 supabase-migration-v157-multiclass.sql 已应用 ⇒ class_state 多行（class_code 唯一），
//   全部 class_state 调用按 class_code 定位（fetchClassState / setClassWeek / setClassInjections /
//   setClassSupervisorAuth / setClassContinue / setSemesterStatus / advanceClassOffset / resetClassGameStates）。
// 迁移未应用 ⇒ .eq('class_code', …) 报 42501/错误 ⇒ 调用方按「迁移未应用」回退（各函数已有 fallback）。
// 兜底：fallback id=1 旧路径保留 —— class_code 缺省 = '酒管2401'（现存真实班 · 与迁移回填一致）。
export const 默认班 = '酒管2401'

export function 定位(classCode) {
  // 多班定位器：迁移未应用时按 class_code 查询会 0 行 ⇒ 调用方回退 id=1（fetchClassState 内实现）
  return classCode && String(classCode).trim() ? String(classCode).trim() : 默认班
}
