// V105 · 六组性格规则表（跑法 = 甲乙混合：bulk 走甲「引擎直调」，每组首周对照走乙「UI 真点击」）
// 值 = decisions.js 选项 label 原文（§2 纪律：与 UI 逐字一致，避免 id 漂移）· 滑块给数值 · sort 给数组 · budget 给分配
// 规则表为纯数据；需要条件的项（如 shifts 按上周出租率）由 v105-run.mjs 的解析器解释。

export const 站点 = '锦江区'   // 六组同址同品牌 ⇒ 差异只来自性格（验收①口径）
export const 品牌 = '全季'

export const 性格规则 = [
  { group: 1, 性格: '稳健经营型', 规则: {
    pricing: '不跟降', shifts: '按出租率(≥80满编,否则精简)', overbook: 2,
    'member-convert': '强调品质', linen: '外包', hygiene: '不停房',
    ota: { 携程: 40, 美团: 40, 飞猪: 20 }, campaign: { 线上广告: 1500, 门店物料: 1500, 员工激励: 1000, 会员礼包: 1000 },
    corporate: '坚守价格', reputation: '道歉+赔偿',
    'member-threshold': 8, 'report-diagnosis': '解决成本相关', 'revenue-mgmt': '组合套餐',
    'hr-optimize': '裁员1人', energy: 26, renovation: '不投', emergency: '立即送医+道歉',
    'quality-check': ['卫生', '床品', '隔音', '卫生间', '热水', '空调'],
  } },
  { group: 2, 性格: '激进扩张型', 规则: {
    pricing: '降价 20% 抢客', shifts: '满编保服务', overbook: 5,
    'member-convert': '强调优惠', linen: '外包', hygiene: '不停房',
    ota: { 携程: 45, 美团: 35, 飞猪: 20 }, campaign: { 线上广告: 2500, 门店物料: 750, 员工激励: 750, 会员礼包: 1000 },
    corporate: '让利签约', reputation: '道歉+赔偿',
    'member-threshold': 3, 'report-diagnosis': '解决利润相关', 'revenue-mgmt': '组合套餐',
    'hr-optimize': '全员培训', energy: 20, renovation: '投150万改造', emergency: '立即送医+道歉',
    'quality-check': ['隔音', '卫生', '床品', '卫生间', '空调', '热水'],
  } },
  { group: 3, 性格: '品质口碑型', 规则: {
    pricing: '提价 20%', shifts: '满编保服务', overbook: 1,
    'member-convert': '强调品质', linen: '自洗', hygiene: '停房深清洁',
    ota: { 携程: 25, 美团: 25, 飞猪: 50 }, campaign: { 线上广告: 1000, 门店物料: 1500, 员工激励: 1500, 会员礼包: 1000 },
    corporate: '坚守价格', reputation: '道歉+赔偿',
    'member-threshold': 10, 'report-diagnosis': '解决口碑相关', 'revenue-mgmt': '连住优惠',
    'hr-optimize': '全员培训', energy: 22, renovation: '投150万改造', emergency: '立即送医+道歉',
    'quality-check': ['卫生', '床品', '卫生间', '隔音', '热水', '空调'],
  } },
  { group: 4, 性格: '价格战型', 规则: {
    pricing: '降价 20% 抢客', shifts: '精简省成本', overbook: 4,
    'member-convert': '强调优惠', linen: '外包', hygiene: '不停房',
    ota: { 携程: 45, 美团: 45, 飞猪: 10 }, campaign: { 线上广告: 3000, 门店物料: 500, 员工激励: 500, 会员礼包: 1000 },
    corporate: '让利签约', reputation: '模板回复',
    'member-threshold': 3, 'report-diagnosis': '解决利润相关', 'revenue-mgmt': '尾房闪购',
    'hr-optimize': '裁员1人', energy: 26, renovation: '不投', emergency: '先安抚再处理',
    'quality-check': ['隔音', '空调', '热水', '床品', '卫生间', '卫生'],
  } },
  { group: 5, 性格: '数字化营销型', 规则: {
    pricing: '跟降 10%', shifts: '满编保服务', overbook: 3,
    'member-convert': '强调优惠', linen: '外包', hygiene: '不停房',
    ota: { 携程: 50, 美团: 30, 飞猪: 20 }, campaign: { 线上广告: 3000, 门店物料: 1000, 员工激励: 500, 会员礼包: 500 },
    corporate: '让利签约', reputation: '解释原因',
    'member-threshold': 5, 'report-diagnosis': '解决成本相关', 'revenue-mgmt': '组合套餐',
    'hr-optimize': '全员培训', energy: 24, renovation: '投150万改造', emergency: '立即送医+道歉',
    'quality-check': ['隔音', '卫生', '热水', '床品', '卫生间', '空调'],
  } },
  { group: 6, 性格: '躺平对照组', 规则: {
    pricing: '不跟降', shifts: '精简省成本', overbook: 0,
    'member-convert': '不主动推销', linen: '外包', hygiene: '不停房',
    ota: { 携程: 20, 美团: 20, 飞猪: 60 }, campaign: { 线上广告: 500, 门店物料: 500, 员工激励: 500, 会员礼包: 3500 },
    corporate: '坚守价格', reputation: '模板回复',
    'member-threshold': 10, 'report-diagnosis': '解决利润相关', 'revenue-mgmt': '组合套餐',
    'hr-optimize': '裁员1人', energy: 26, renovation: '不投', emergency: '模板回复',
    'quality-check': ['隔音', '空调', '床品', '卫生间', '热水', '卫生'],
  } },
]
