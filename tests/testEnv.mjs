// ── 测试专用配置中心 ──────────────────────────────────────────────
// 原则：仓库内不存放任何凭据。账号/密码/数据库连接串一律从环境变量读取。
//
// 环境变量一览：
//   SMOKE_TEACHER_ID / SMOKE_TEACHER_PW   教师测试账号（默认 t001 / 123456 —— 教学演示环境测试号，非真实用户）
//   SMOKE_STUDENT_ID / SMOKE_STUDENT_PW   学生测试账号（默认 2025 / 123456 —— 可能尚未注册，冒烟走跳过分支）
//   SMOKE_CREW_ID    / SMOKE_CREW_PW      验收脚本的"队友B"测试账号（默认 20249998 / 123456，脚本结束会自行删除）
//   SMOKE_GROUP_KEY                       验收脚本操作的演示组档（默认 酒管2401|1）
//   SUPABASE_PG                           数据库直连串（**故意不给默认值**：含密码，绝不入库）
//                                         缺失时，依赖直连的断言自动跳过并提示
//   ALLOW_PROD_WRITE=1                    允许脚本写入线上库（默认关闭，仅写库脚本需要）
//
// 用法示例：
//   node tests/ui-smoke.mjs
//   ALLOW_PROD_WRITE=1 SUPABASE_PG='postgresql://...' node tests/acceptance-cloud-save.mjs
//
// 说明：以下默认账号是**测试专用**（教学演示环境里的测试号），不涉及真实师生账号；
//       仍可通过环境变量覆盖，便于换环境/换班运行时不必改代码。

export const TEST_TEACHER = {
  id: process.env.SMOKE_TEACHER_ID || 't001',
  pw: process.env.SMOKE_TEACHER_PW || '123456',
}
export const TEST_STUDENT = {
  id: process.env.SMOKE_STUDENT_ID || '2025',
  pw: process.env.SMOKE_STUDENT_PW || '123456',
}
export const TEST_CREW = {
  id: process.env.SMOKE_CREW_ID || '20249998',
  pw: process.env.SMOKE_CREW_PW || '123456',
}

// 演示组档（验收脚本的写入目标）：班级|组号
export const TEST_GROUP_KEY = process.env.SMOKE_GROUP_KEY || '酒管2401|1'
export const TEST_GROUP = TEST_GROUP_KEY.split('|')

// 数据库直连：无默认值（含密码，不进仓库）；未配置时调用方应跳过相关断言
export const PG_URL = process.env.SUPABASE_PG || ''

// 写线上库的显式开关：脚本会创建/删除测试账号、改写演示组档
export const PROD_WRITE_OK = process.env.ALLOW_PROD_WRITE === '1'

export const PG_HINT = `缺少 SUPABASE_PG（数据库直连串，含密码故不入仓库），相关断言将跳过。
如需完整校验：SUPABASE_PG='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' node <脚本>`
export const PROD_WRITE_HINT = `⛔ 本脚本会写入线上库（创建/删除测试账号 ${TEST_CREW.id}、写入演示组档 ${TEST_GROUP_KEY}）。
确认无误后显式开启：ALLOW_PROD_WRITE=1 node <脚本>`
