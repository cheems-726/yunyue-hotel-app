// 引擎统一出口（批次 B2-3 · T3.1）
//
// ── 为什么要有它 ────────────────────────────────────────────────
// 同一个引擎要跑在【两端】：浏览器（学生端 App / 教师端 Dashboard）与 Node（门禁测试 / 长跑脚本）。
// 原先两端各自 `import ... from '../src/某文件.js'`，谁多引一个模块都容易漏 ——
// 出问题时的表现是"两端结果不一致"，而这类 bug 最难查（M4 同构验证就是为它设的）。
// 现在统一从 `src/engine/index.js` 取，两端 import 面收敛成一处。
//
// ── 边界（本批只做出口，不改实现）──────────────────────────────
//   ★ 本文件【只 re-export】，不含任何逻辑、不复制代码、不改变任何模块的对外行为。
//   ★ 已查重名：12 个模块的 79 个导出【零冲突】（重名会让 `export *` 静默覆盖，必须查）
//   ★ 引擎模块全部零 DOM 依赖（M4 已验），故本出口在 Node / Deno / 浏览器三处都能直接 import
//
// ── 分层说明 ────────────────────────────────────────────────────
//   核心计算：settlement（周结算）/ dayEngine（周→7天）/ attrs（属性池）/ guests（客人·评价内容）
//             reviewRate（评价率）/ liveReview（实时评价纯核心）
//   派生展示：dailyReport（日报）/ missingWeeks（缺周）/ teachingClock（教学日历）/ hotelTitle（称号）
//   存档口径：stateMigration（D25 迁移 + 版本标记）
//   参考资料：franchiseModel（纯数据，不参与计算）

// 核心计算
export * from '../settlement.js'
export * from '../dayEngine.js'
export * from '../attrs.js'
export * from '../guests.js'
export * from '../reviewRate.js'
export * from '../liveReview.js'

// 派生展示
export * from '../dailyReport.mjs'
export * from '../missingWeeks.mjs'
export * from '../teachingClock.mjs'
export * from '../hotelTitle.js'

// 存档口径
export * from '../stateMigration.mjs'

// 参考资料（纯数据）
export * from '../franchiseModel.mjs'

// 站点数据（选址/客群/竞品）—— 引擎消费它，两端也要读同一份
export * from '../siteLocations.mjs'
