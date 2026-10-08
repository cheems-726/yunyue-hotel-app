// 华住品牌数据（★ V76：从 BrandSelection.jsx 抽出为纯数据模块 —— 供界面与 node 守门测试共用单源）
// 华住全部品牌（按档次分组，含加盟费/造价/房价带）
export const brandGroups = [
  {
    level: '经济型 · 国民',
    brands: [
      { name: '汉庭', icon: 'prop.hotel', fee: '2800元/间(≥18万)', cost: '6.77万/间', price: '180-280元', standard: '客房70间起', desc: '华住旗舰经济型，干净便捷性价比高，全球单一品牌客房数第二。' },
      // 🔴 §16.2-B1（2026-09-28）：你好/桔子/桔子水晶 = **半接入**（造价/门槛有官方现行 API，费率查不到）
      //   ⇒ 原先手写的"约2000元/间 / 5-6万间"这类**无来源数字**一律撤下，改显式「费率待补」+ 官方造价原文。
      //   （边界① 不许编造数据；依据 5-参考资料/加盟数值层-…-参数表.md §一 覆盖矩阵）
      { name: '你好', icon: 'prop.hotel', fee: '费率待补', cost: '7.08万/间·官方现行', price: '150-220元', standard: '客房60间起', desc: '国民新品牌，聚焦下沉市场，简约实用。' },
      { name: '海友', icon: 'prop.hotel', fee: '约2000元/间', cost: '5-6万/间', price: '120-180元', standard: '客房50间起', desc: '超经济型，极致性价比。' },
      { name: '宜必思', icon: 'prop.hotel', fee: '约2500元/间', cost: '6-7万/间', price: '160-240元', standard: '客房60间起', desc: '国际经济型品牌，年轻活力、标准化服务。' },
    ]
  },
  {
    level: '中档',
    brands: [
      { name: '全季', icon: 'prop.hotel', fee: '约4000元/间', cost: '8-10万/间', price: '280-400元', standard: '客房80间起', desc: '华住主力中档，东方人文、极简设计、好而不贵。' },
      { name: '桔子', icon: 'prop.hotel', fee: '费率待补', cost: '10.8万/间·官方现行', price: '260-380元', standard: '客房80间起', desc: '中档精品，时尚设计，年轻客群。' },
      { name: '星程', icon: 'prop.hotel', fee: '约3500元/间', cost: '7-9万/间', price: '240-350元', standard: '客房70间起', desc: '中档连锁，商务休闲兼顾。' },
      { name: '漫心', icon: 'prop.hotel', fee: '约4000元/间', cost: '8-10万/间', price: '300-420元', standard: '客房70间起', desc: '中档精品，人文艺术风格。' },
    ]
  },
  {
    level: '精选 · 中高档',
    brands: [
      { name: '桔子水晶', icon: 'prop.hotel', fee: '费率待补', cost: '15.43万/间·官方现行', price: '400-600元', standard: '客房80间起', desc: '桔子升级版，更高品质设计。' },
      { name: '全季大观', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '400-550元', standard: '客房80间起', desc: '全季升级版，更高端中档。' },
      { name: '城际', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '交通枢纽型中高端。' },
      { name: '美居', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '雅高系中高端，法式优雅。' },
      { name: '美仑', icon: 'prop.hotel', fee: '约5000元/间', cost: '10-13万/间', price: '380-520元', standard: '客房80间起', desc: '中高端商务品牌。' },
    ]
  },
  {
    level: '高档',
    brands: [
      { name: '禧玥', icon: 'prop.hotel', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '华住高端，东方雅致生活。' },
      { name: '花间堂', icon: 'prop.hotel', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房50间起', desc: '度假型高端，人文度假。' },
      { name: '施柏阁', icon: 'prop.hotel', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '德系高端，德意志传统。' },
      { name: '诺富特', icon: 'prop.hotel', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房70间起', desc: '国际高端商务品牌。' },
    ]
  },
  {
    level: '奢华',
    brands: [
      { name: '宋品', icon: 'prop.hotel', fee: '洽谈', cost: '30万+/间', price: '1000-2000元', standard: '客房50间起', desc: '华住奢华，东方奢华。' },
      { name: '施柏阁大观', icon: 'prop.hotel', fee: '洽谈', cost: '30万+/间', price: '1200-2500元', standard: '客房50间起', desc: '施柏阁顶级，极致奢华。' },
    ]
  },
]