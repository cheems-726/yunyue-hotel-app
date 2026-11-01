// 华住品牌数据（★ V76：从 BrandSelection.jsx 抽出为纯数据模块 —— 供界面与 node 守门测试共用单源）
// 华住全部品牌（按档次分组，含加盟费/造价/房价带）
export const brandGroups = [
  {
    level: '经济型 · 国民',
    brands: [
      { name: '汉庭', icon: 'prop.hotel', fee: '2800元/间(≥18万)', cost: '6.77万/间', price: '210-310元', standard: '客房70间起', rentFactor: 0.30, desc: '华住旗舰经济型，干净便捷性价比高，全球单一品牌客房数第二。' },   // ★ V134 §1（D162）：ADR 带按 2024 经济型 200–300 上调（中值 260）；租金系数 0.5——经济型多选低租金物业/二楼以上
      // ★ V146 §2-A：0.5 → 0.30（租金占营收 24.8%→14.9%，落在真实 15–20% 下沿；0.42 只能到 20.8% 且六组仍有负）
      // 🔴 §16.2-B1（2026-09-28）：你好/桔子/桔子水晶 = **半接入**（造价/门槛有官方现行 API，费率查不到）
       //   ★ 2026-10-09 **部分变更（D235）**：**有源即显示 · 无源仍待补 · 计费层另论** ——
       //     桔子加盟费 3000元/间（两源交叉·置信中）已显示；管理费/CRS 公开面无源 ⇒ 仍显「待补」；
       //     **展示有数 ≠ 引擎计费**（桔子不在 franchiseFees.已接入品牌 ⇒ 结算不计费，见 propertyQuote 断言 D235①–③）
      //   ⇒ 原先手写的"约2000元/间 / 5-6万间"这类**无来源数字**一律撤下，改显式「费率待补」+ 官方造价原文。
      //   （边界① 不许编造数据；依据 5-参考资料/加盟数值层-…-参数表.md §一 覆盖矩阵）
      { name: '你好', icon: 'prop.hotel', fee: '费率待补', cost: '7.08万/间·官方现行', price: '150-220元', standard: '客房60间起', desc: '国民新品牌，聚焦下沉市场，简约实用。' },
      { name: '海友', icon: 'prop.hotel', fee: '约2000元/间', cost: '5-6万/间', price: '120-180元', standard: '客房50间起', desc: '超经济型，极致性价比。' },
      { name: '宜必思', icon: 'prop.hotel', fee: '约2500元/间', cost: '6-7万/间', price: '160-240元', standard: '客房60间起', desc: '国际经济型品牌，年轻活力、标准化服务。' },
      // ★ V87（2026-10-08）：官方 API 全量枚举新增（渠道① 官方原页 · franchise-cmsapi.huazhu.com/brand/brand/17）
      // ★ V136 §2：怡莱房价带 = 官方案例三口取外包（芜湖店 169 · 成都翻牌前 114.3/后 140.8 · 单位元，单房售价=ADR）
      //   来源 https://franchise-cmsapi.huazhu.com/brand/brand/17（updateTime 2025-09-19）· 取数 2026-10-21 · 置信中（单店案例，非品牌公开带宽）
      { name: '怡莱', icon: 'prop.hotel', fee: '3000元/间(≥10万)·旧版官方', cost: '造价待补（官方现行 API 无此字段）', price: '115-170元', standard: '待补（以官网登记为准）', desc: '华住 2019 年升级的中小微经济型单体酒店管理品牌（官方 API brand/17）。' },
    ]
  },
  {
    level: '中档',
    brands: [
      { name: '全季', icon: 'prop.hotel', fee: '约4000元/间', cost: '8-10万/间', price: '280-400元', standard: '客房80间起', rentFactor: 0.79, desc: '华住主力中档，东方人文、极简设计、好而不贵。' },   // ★ V146：租金系数 0.9（保持“全季高于汉庭”定位；见批次报告）
      { name: '桔子', icon: 'prop.hotel', fee: '加盟费 3000元/间（两源交叉·置信中）', cost: '10.8万/间·官方现行', price: '260-380元', standard: '客房80间起', desc: '中档精品，时尚设计，年轻客群。' },
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
      { name: '美仑', icon: 'prop.hotel', fee: '费率待补🔴（管理费%/会员费%/加盟费均无公开源 · 已试渠道见批次报告-v172）', cost: '15~16万/间·官方现行（翻牌 1万/间起）', price: '380-520元', standard: '客房80间起', desc: '中高端商务品牌。' },   // ★ V172§1（2026-11-01）：造价按官方 API brand/14 现行更新（updateTime 2025-10-13 · 置信高）；费率三件无源 🔴
      // ★ V87：官方 API 枚举新增（brand/27 · 门槛/限一二线为官方 API 现行；费率官方无 ⇒ 待补）
      { name: 'CitiGO 欢阁', icon: 'prop.hotel', fee: '费率待补', cost: '14万/间·官方现行', price: '待补', standard: '客房60间起·≥2500㎡·限一二线', desc: '华住唯一以年轻人为主要客群的生活方式酒店（官方 API brand/27）。' },
    ]
  },
  {
    level: '高档',
    brands: [
      { name: '禧玥', icon: 'prop.hotel', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '华住高端，东方雅致生活。' },
      { name: '花间堂', icon: 'prop.hotel', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房50间起', desc: '度假型高端，人文度假。' },
      // ★ V154 批2（品牌 30+ 补名录）：官网『关于华住』高档档点名 Jaz in the City（音乐生活方式 · 与环球音乐合资）。ADR 带/费率公开面无 ⇒ 待补 🔴（不编）
      { name: 'Jaz in the City', icon: 'prop.hotel', fee: '费率待补', cost: '待补', price: '待补', standard: '待补（以官网登记为准）', desc: '音乐生活方式酒店（华住 × 环球音乐合资 · 官网高档档点名 2026-10-24）。' },
      { name: '施柏阁', icon: 'prop.hotel', fee: '洽谈', cost: '20万+/间', price: '600-1000元', standard: '客房60间起', desc: '德系高端，德意志传统。' },
      { name: '诺富特', icon: 'prop.hotel', fee: '洽谈', cost: '18万+/间', price: '500-900元', standard: '客房70间起', desc: '国际高端商务品牌。' },
      // ★ V87：官方 API 枚举新增（brand/12 · brand/30 · 单房造价为官方 API pricing 原文 · 费率官方无 ⇒ 待补）
      { name: '美仑美奂', icon: 'prop.hotel', fee: '费率待补', cost: '25万~30万/间·轻改1万起·官方现行', price: '待补', standard: '待补（以官网登记为准）', desc: '华住国际高端精选酒店品牌，源自德意志酒店集团（官方 API brand/12）。' },
      { name: '美仑国际', icon: 'prop.hotel', fee: '费率待补', cost: '20万~22万/间(含公区)·轻改1万起·官方现行', price: '待补', standard: '待补（以官网登记为准）', desc: '华住高端全服务酒店品牌，一站式会宴服务（官方 API brand/30）。' },
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