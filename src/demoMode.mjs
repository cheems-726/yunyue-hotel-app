// D367 · 演示口径开关（运行时版本：Node 测试 / Edge / 无构建环境）
//
// 构建时由 vite.config.js 的 resolve.alias 换成 demoMode.demo.mjs 或 demoMode.strict.mjs
//   · demo 构建   ⇒ export const DEMO_FILL = true   （字面量 ⇒ rollup 删除严格分支）
//   · strict 构建 ⇒ export const DEMO_FILL = false  （字面量 ⇒ rollup 删除演示分支）
// 这样"编译期常量"是**真·字面量**，不依赖 esbuild 对 process.env 的折叠能力；
// 同时本文件保留 typeof 保护 —— Edge(Deno) 没有 process，不能直接读。
export const DEMO_FILL = !(typeof process !== 'undefined' && process.env && process.env.YUNYUE_DEMO_FILL === '0')
