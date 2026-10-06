// V60 · businessDensity 接线（进 PROFILE 条目内部 · 不破坏嵌套）
import { readFileSync, writeFileSync } from 'node:fs'
const p = 'src/siteLocations.mjs'
const bs = String.fromCharCode(92)
let s = readFileSync(p, 'utf8')

const BD = {
  锦江区: "{ stock: '甲写楼盘约 31 个', vacancy: '18.7%', rent: '租金企稳（全国 6 个企稳商圈之一）', desc: '春熙路商圈写字楼密集', src: '搜狐产业资讯 · 中指研究院（2021/2025Q3）', grade: 'high' }",
  青羊区: "{ desc: '天府广场-骡马市传统商务区（定性）', grade: 'none', src: '区级甲写专项数据未检索到（2026-10-05 WebSearch 实试）' }",
  高新区: "{ rent: '日均租金约 4.5 元/㎡/天', occupancy: '甲写入驻率超 96%', desc: '金融城/交子公园板块=成都写字楼价值制高点 · 交子金融广场 2025 竣工（2号办公楼 11 万㎡）', grade: 'mid', src: '本地租赁资讯 028hzcbd（机构口径以季报为准）· 香港交易所公告（2025）' }",
  武侯区: "{ desc: '人民南路沿线商务带（定性）', grade: 'none', src: '区级甲写专项数据未检索到（2026-10-05 WebSearch 实试）' }",
  金牛区: "{ desc: '人北商务区/金牛万达（定性）', grade: 'none', src: '区级甲写专项数据未检索到（2026-10-05 WebSearch 实试）' }",
  龙泉驿区: "{ desc: '经开区汽车产业商务配套（定性）', grade: 'none', src: '区级甲写专项数据未检索到（2026-10-05 WebSearch 实试）' }",
  都江堰市: "{ desc: '旅游城市 ⇒ 商务密度低（与景区客流 101.66 万互证·定性）', grade: 'none', src: '与表一互证 · 区级专项数据未检索到' }",
  旌阳区: "{ desc: '首次入围全国百强区 · 特斯联 AI CITY/云上天府智算中心/德阳数字科创城/凤翥湖数字小镇（数字经济商务载体在建）', grade: 'mid', src: '德阳市/旌阳区政府通报（媒体转载 · 2025-26）' }",
  五洲广场商圈: "{ rent: '文庙广场商圈办公租金约 0.73 元/㎡/天', desc: '旌阳城南商务+政务复合商圈：中小面积精装办公为主 · 客流=政务办事+办公人群+周边居民 · S11 市域铁路五洲广场站在建', grade: 'mid', src: '58 同城商办 listings · 高德 POI · 规划公开信息（2025-26）' }",
  广汉市: "{ desc: '三星堆文旅带动（与景区客流 11.98 万互证·定性）', grade: 'none', src: '商务密度专项数据未检索到' }",
  涪城区: "{ desc: '绵阳主城商务区（定性）', grade: 'none', src: '市级甲写存量/空置未检索到 ⇒ 区级更无' }",
  江油市: "{ desc: '县级市商办以沿街商铺+中小办公为主（定性 · 与表一 2025 旅游收入近 9 亿互证）', grade: 'none', src: '专项数据未检索到' }",
  双桥区: "{ desc: '避暑山庄旅游城市 ⇒ 商务密度低、客源以文旅为主（与景区客流 36.04 万互证·定性）', grade: 'none', src: '专项数据未检索到' }",
  解放碑商圈: "{ stock: '重庆甲写存量 270.5 万㎡（2025）', desc: '解放碑/化龙桥/江北嘴=存量前三区域 · 解放碑+江北嘴聚集全市甲写 83% 传统金融租户 · CBD 高质量发展三年行动方案推进中', grade: 'high', src: '解放碑CBD企业办公升级报告（转载）· 仲量联行 40 城指数（2025）' }",
  观音桥商圈: "{ desc: '商圈日均客流约 60 万人次 · 单日峰值 105 万 · 年销售额超 3700 亿元（重庆人气最旺商圈 · 国家级旅游休闲街区）· 部分重点商场年客流破 4000 万', grade: 'high', src: '人民网重庆频道 · 腾讯新闻/上游新闻（2025-26）' }",
}

let count = 0
for (const [name, bd] of Object.entries(BD)) {
  // 锚：条目首行；再找该条目内 conf 行，把行尾 ' },' 前插入 businessDensity
  const ai = s.indexOf(`'${name}': { pop:`)
  if (ai < 0) { console.log('skip', name); continue }
  const segEnd = s.indexOf('\n', ai)
  // 在 anchor 行之后找含 conf: 的第一行（即本条目 src/conf 行）
  const rest = s.slice(ai)
  const lines = rest.split('\n')
  let confK = -1
  for (let k = 0; k < Math.min(lines.length, 8); k++) {
    if (lines[k].includes("conf: '")) { confK = k; break }
  }
  if (confK < 0) { console.log('skip(no conf)', name); continue }
  const absConf = ai + lines.slice(0, confK).join('\n').length + (confK ? 1 : 0)
  const confLine = lines[confK]
  // 在 conf 行内把 " },' 结尾替换为 ", businessDensity: {...} },'
  const m = confLine.match(/(conf: '[^']+')\s*\},/)
  if (!m) { console.log('skip(no conf-close)', name, confLine.slice(0, 60)); continue }
  const newConfLine = confLine.replace(/(conf: '[^']+')\s*\},/, `$1, businessDensity: ${bd} },`)
  s = s.slice(0, absConf) + newConfLine + s.slice(absConf + confLine.length)
  count++
}
writeFileSync(p, s)
console.log('businessDensity 接入', count, '条')
