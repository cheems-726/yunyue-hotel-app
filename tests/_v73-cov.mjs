import { districts, COMPETITORS, CUSTOMER_PERSONAS, LOCATION_PROFILE } from '../src/siteLocations.mjs'
const 全部 = Object.values(districts).flat()
console.log('区位总数：', 全部.length, '| 竞品键数：', Object.keys(COMPETITORS).length, '| 客群键数：', Object.keys(CUSTOMER_PERSONAS).length, '| 画像键数：', Object.keys(LOCATION_PROFILE).length)
console.log('\n区位\t竞品\t优势\t代价\t客群\t画像')
for (const d of 全部) {
  const comp = COMPETITORS[d.name] || [], per = CUSTOMER_PERSONAS[d.name], prof = LOCATION_PROFILE[d.name]
  console.log([d.name, comp.length ? comp.length+'家' : '无', d.good?'有':'无', d.warn?'有':'无', per?`${per.business}/${per.tourist}/${per.family}`:'无', prof?'有':'无'].join('\t'))
}
console.log('\n缺客群：', 全部.filter(d=>!CUSTOMER_PERSONAS[d.name]).map(d=>d.name).join('、') || '无')
console.log('缺竞品：', 全部.filter(d=>!(COMPETITORS[d.name]||[]).length).map(d=>d.name).join('、') || '无')
console.log('缺画像：', 全部.filter(d=>!LOCATION_PROFILE[d.name]).map(d=>d.name).join('、') || '无')
console.log('\n竞品条数：')
for (const [k,v] of Object.entries(COMPETITORS)) console.log('  ', k, v.length)
