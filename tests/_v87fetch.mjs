// V87 · 华住官方加盟 API 品牌名册枚举（渠道①·官方原页 · 高置信）
// 端点：franchise-cmsapi.huazhu.com/brand/brand/{id}（决策端线索 + V76 先例 brand/8/11/16/26/27）
import { writeFileSync } from 'node:fs'
const out = []
for (let id = 1; id <= 45; id++) {
  try {
    const r = await fetch('https://franchise-cmsapi.huazhu.com/brand/brand/' + id, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) { console.log(id, 'HTTP', r.status); continue }
    const j = await r.json()
    const d = j.data
    if (!d || !d.name) { console.log(id, '空'); continue }
    const 投资明细 = (d.brandSingleInvests || []).flatMap(s => s.brandSingleInvestDetailList || [])
    const 门槛 = (d.brandSiteRequirements || d.siteRequirements || null)
    out.push({
      id, name: d.name, isOpen: d.isOpen, levels: d.levels,
      des: (d.des || '').replace(/<[^>]+>/g, '').slice(0, 120),
      invests: (d.brandSingleInvests || []).map(s => ({ id: s.id, details: (s.brandSingleInvestDetailList || []).map(x => ({ item: x.item || x.name, value: x.value ?? x.content, unit: x.unit ?? null })) })),
      keys: Object.keys(d).filter(k => /invest|require|cost|fee|room/i.test(k)),
    })
    console.log(id, d.name, 'invest明细', 投资明细.length, '条')
  } catch (e) { console.log(id, 'ERR', String(e).slice(0, 60)) }
  await new Promise(r => setTimeout(r, 700))
}
writeFileSync('../4-审计与报告/V87-官方API名册-raw.json', JSON.stringify(out, null, 1))
console.log('共', out.length, '个品牌已存 V87-官方API名册-raw.json')
