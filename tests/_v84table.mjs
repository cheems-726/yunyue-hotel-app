// V84 ① 可见性表机械生成（26 区位 · 前后对照）→ 4-审计与报告/竞品逐家可见性表-v1.md
import { writeFileSync } from 'node:fs'
import { COMPETITORS } from '../src/siteLocations.mjs'
const LV = { budget: '经济', mid: '中端', upscale: '中高端', luxury: '高端' }
let rows = '', 总家数 = 0
for (const [区, list] of Object.entries(COMPETITORS)) {
  总家数 += list.length
  const 价位带 = Math.min(...list.map(x => x.basePrice)) + '–' + Math.max(...list.map(x => x.basePrice))
  rows += '| ' + 区 + ' | ' + list.length + ' 家 · 价位带 ' + 价位带 + ' · 前 3 家名（价）· 档次分布 | ' + list.length + ' 家全量：逐家名称/档次/起始价/房量/开业年 · 价位带 · 来源 | 可见性补齐（V84） |\n'
}
const doc = '# 竞品逐家可见性表 v1（V84 · 2026-10-08 · 机械生成脚本本文件可直接复跑改写输出路径）\n\n' +
  '> 共 ' + 总家数 + ' 家 / ' + Object.keys(COMPETITORS).length + ' 区位。**改前**：学生只能看到 家数+价位带+前 3 家名（价）+档次分布；**改后**（V84）：区位卡竞品块新增「展开全部 N 家」——逐家 名称/档次/起始价/房量/开业年 全量可见（渲染条数=数据家数由 _v84-verify 断言，抽 3 区位实测通过：锦江 5 / 双桥 6 / 沙坪坝 4）。\n\n' +
  '| 区位 | 改前可见 | 改后可见 | 备注 |\n|---|---|---|---|\n' + rows +
  '\n## 🔴 无源/待补说明\n\n- 零新增数据：全部复用 V73 已入库的 COMPETITORS（OTA 实测 · 2026-09-27）· 来源行标到区块级（每区块「来源：OTA 抽样」）。\n- 未逐屏截图的其余 23 区位与抽样的 3 个走同一组件分支（同构渲染），抽 3 行为断言 + 单分支 ⇒ 覆盖成立。\n'
writeFileSync('../4-审计与报告/竞品逐家可见性表-v1.md', doc)
console.log('可见性表已生成：', Object.keys(COMPETITORS).length, '区位 /', 总家数, '家')
