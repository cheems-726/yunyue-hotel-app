// §32-U8-§4：六组策略常量（唯一事实源）—— longRun126 / semesterRun12 / reportCaliber 三处共用
//   ★ 抽取自 tests/longRun126.test.mjs（原处保留 import，不再各写一份 ⇒ 改打法不会漏改另一处）
export const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' }
export const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
export const STRATEGIES = {
  '1勤奋型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2, 'member-threshold': 5 },
  '2省钱型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 20, overbook: 2, 'member-threshold': 5 },
  '3中间型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '不停房', linen: '自洗', 'hr-optimize': '全员培训', 'member-convert': '强调品质', reputation: '道歉+赔偿', energy: 23, overbook: 2, 'member-threshold': 5 },
  '4躺平型': { pricing: '跟降 10%', shifts: '精简省成本', hygiene: '不停房', linen: '外包', reputation: '模板回复', energy: 20, overbook: 2, 'member-threshold': 5 },
  '5激进型': { pricing: '降价 20% 抢客', shifts: '精简省成本', hygiene: '不停房', linen: '外包', 'hr-optimize': '裁员1人', 'member-convert': '强调优惠', reputation: '模板回复', energy: 25, overbook: 5, campaign: '大促营销', ota: '全渠道上架', 'member-threshold': 5 },
  '6逆袭型': { pricing: '不跟降', shifts: '满编保服务', hygiene: '停房深清洁', linen: '自洗', reputation: '道歉+赔偿', energy: 23, overbook: 2, 'member-threshold': 5 },
}
export const 组名s = Object.keys(STRATEGIES)

// ★ 差评处理率系数（longRun126 同款 · 每组不同 —— 影响好评率轨迹）
export const RESOLVE = { '1勤奋型': 0.9, '2省钱型': 0.2, '3中间型': 0.5, '4躺平型': 0, '5激进型': 0.1, '6逆袭型': 0.5 }
