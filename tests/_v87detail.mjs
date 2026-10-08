import { writeFileSync } from 'node:fs'
const out = {}
for (const id of [12, 30, 17, 29, 27]) {
  try {
    const r = await fetch('https://franchise-cmsapi.huazhu.com/brand/brand/' + id, { signal: AbortSignal.timeout(15000) })
    const d = (await r.json()).data
    out[id] = {
      name: d.name, isOpen: d.isOpen,
      des: (d.des || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 200),
      invests: (d.brandSingleInvests || []).map(s => ({
        version: s.version || '',
        details: (s.brandSingleInvestDetailList || []).map(x => ({ pricing: x.pricing, affixe: x.affixe, type: x.type })),
      })),
    }
    console.log('==', id, d.name, JSON.stringify(out[id].invests))
  } catch (e) { console.log(id, 'ERR', String(e).slice(0, 50)) }
  await new Promise(r => setTimeout(r, 600))
}
writeFileSync('../4-审计与报告/V87-新品牌官方明细.json', JSON.stringify(out, null, 1))
console.log('已存 V87-新品牌官方明细.json')
