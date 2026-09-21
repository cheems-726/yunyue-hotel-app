// 成德绵区县选址数据（从 SiteSelection.jsx 抽取，供测试复用）
export const districts = {
  成都: [
    { name:'锦江区', confidence:'red', tag:'核心', tagCls:'tag-core', attrs:{客流:5,房价:5,租金:5,竞争:5,人力:4,波动:2},
      good:'春熙路/太古里，客流与消费力成都天花板', warn:'租金爆贵、竞争惨烈，新手极可能开不起' },
    { name:'高新区', confidence:'red', tag:'商务', tagCls:'tag-ind', attrs:{客流:5,房价:5,租金:5,竞争:4,人力:5,波动:3},
      good:'金融城/软件园，高端商务客流充沛', warn:'人力成本极高，周末写字楼区客流骤减' },
    { name:'武侯区', confidence:'red', tag:'文旅', tagCls:'tag-tour', attrs:{客流:4,房价:4,租金:4,竞争:4,人力:4,波动:3},
      good:'武侯祠/锦里，旅游+商务双重客流', warn:'景区周边同质化竞争，淡旺季明显' },
    { name:'青羊区', confidence:'red', tag:'文旅', tagCls:'tag-tour', attrs:{客流:4,房价:4,租金:4,竞争:3,人力:3,波动:3},
      good:'天府广场/宽窄巷子，政务+文旅客流', warn:'政务客流波动，旅游淡季有空置风险' },
    { name:'金牛区', confidence:'red', tag:'核心', tagCls:'tag-core', attrs:{客流:4,房价:4,租金:4,竞争:4,人力:4,波动:2},
      good:'产业+居住混合，客流稳定', warn:'核心城区成本高，需精细运营' },
    { name:'龙泉驿区', confidence:'red', tag:'工业', tagCls:'tag-ind', attrs:{客流:3,房价:3,租金:2,竞争:2,人力:3,波动:3},
      good:'汽车产业园区，工作日商务客稳定', warn:'周末/节假日客流少，客群单一' },
    { name:'双流区', confidence:'red', tag:'空港', tagCls:'tag-ind', attrs:{客流:3,房价:3,租金:2,竞争:2,人力:2,波动:3},
      good:'机场客流+物流产业，交通便利', warn:'机场过夜客价格敏感，利润薄' },
    { name:'都江堰市', confidence:'red', tag:'旅游', tagCls:'tag-tour', attrs:{客流:4,房价:4,租金:2,竞争:2,人力:2,波动:5},
      good:'青城山/都江堰景区，旺季客流旺盛', warn:'季节性波动极大，淡季可能空置' },
    { name:'简阳市', confidence:'red', tag:'潜力', tagCls:'tag-county', attrs:{客流:2,房价:2,租金:1,竞争:1,人力:2,波动:3},
      good:'天府机场带动机遇，成本低', warn:'当前配套不成熟，客流培育期长' },
  ],
  // ===== 德阳（保留完整版：含五洲广场商圈 + 广汉三星堆实测数据） =====
  德阳: [
    { name:'旌阳区', confidence:'red', tag:'城区', tagCls:'tag-ind', attrs:{客流:3,房价:3,租金:3,竞争:2,人力:2,波动:2},
      good:'德阳主城区，工业商务客稳定', warn:'消费力天花板低，知名度不及成都' },
    { name:'五洲广场商圈', confidence:'yellow', tag:'核心商圈', tagCls:'tag-core', attrs:{客流:4,房价:3,租金:4,竞争:3,人力:3,波动:2},
      good:'德阳最大城市综合体（120万㎡），日均客流3.45万人次，"10亿级"商圈，S11线五洲广场站', warn:'租金偏高，竞争逐步加剧' },
    { name:'广汉市', confidence:'green', tag:'文旅', tagCls:'tag-tour', attrs:{客流:4,房价:2,租金:1,竞争:1,人力:2,波动:4},
      good:'三星堆2025年608万游客，全域旅游1197万人次/117.8亿收入，全市住宿仅42家（供给缺口明显）', warn:'景区依赖型，淡季空置，房价天花板低' },
    { name:'绵竹市', confidence:'red', tag:'工业', tagCls:'tag-ind', attrs:{客流:2,房价:2,租金:1,竞争:1,人力:2,波动:2},
      good:'白酒产业，商务接待需求稳定', warn:'县域客源有限，增长空间小' },
    { name:'中江县', confidence:'red', tag:'县域', tagCls:'tag-county', attrs:{客流:2,房价:2,租金:1,竞争:1,人力:1,波动:2},
      good:'成本极低，竞争几乎为零', warn:'客流少、消费力弱，可能养不活' },
  ],
  绵阳: [
    { name:'涪城区', confidence:'red', tag:'城区', tagCls:'tag-ind', attrs:{客流:3,房价:3,租金:3,竞争:2,人力:2,波动:2},
      good:'绵阳主城区，科技城核心，商务稳定', warn:'消费力天花板低于成都，客流有限' },
    { name:'游仙区', confidence:'red', tag:'科研', tagCls:'tag-ind', attrs:{客流:3,房价:3,租金:2,竞争:2,人力:2,波动:2},
      good:'军工科研单位聚集，客源稳定', warn:'客群单一，市场化客流不足' },
    { name:'江油市', confidence:'red', tag:'文旅', tagCls:'tag-tour', attrs:{客流:3,房价:2,租金:1,竞争:1,人力:2,波动:3},
      good:'李白故里，文旅+工业双支撑', warn:'县域经济，房价天花板低' },
    { name:'三台县', confidence:'red', tag:'县域', tagCls:'tag-county', attrs:{客流:2,房价:2,租金:1,竞争:1,人力:1,波动:2},
      good:'人口大县，成本极低', warn:'消费力弱，酒店市场未成熟' },
  ],


  // ===== 承德（需求文档新增城市，极端季节性教学场景） =====
  承德: [
    { name:'双桥区', confidence:'green', tag:'主城+景区', tagCls:'tag-tour', attrs:{客流:5,房价:4,租金:4,竞争:4,人力:3,波动:5},
      good:'避暑山庄所在地（世界遗产5A），暑期日均3-5万游客，全市年游客1.04亿人次', warn:'极端季节性：暑期限流6万/日，冬季客流断崖，酒店旺季涨30-50%' },
    { name:'双滦区', confidence:'red', tag:'城区', tagCls:'tag-ind', attrs:{客流:2,房价:2,租金:2,竞争:2,人力:2,波动:4},
      good:'成本低于双桥区，承接溢出客源', warn:'离景区远，游客首选率低' },
    { name:'承德县', confidence:'yellow', tag:'县域', tagCls:'tag-county', attrs:{客流:2,房价:2,租金:1,竞争:1,人力:2,波动:3},
      good:'成本极低', warn:'约34万人口，客流有限' },
    { name:'围场满族蒙古族自治县', confidence:'green', tag:'草原旅游', tagCls:'tag-tour', attrs:{客流:3,房价:3,租金:2,竞争:2,人力:2,波动:5},
      good:'河北面积最大县（9058km²），草原旅游旺季爆满', warn:'42万人口，距市区远，淡季完全空置' },
  ],

  // ===== 重庆（需求文档新增城市，圈层价格差教学场景） =====
  重庆: [
    { name:'解放碑商圈', confidence:'yellow', tag:'核心商圈', tagCls:'tag-core', attrs:{客流:5,房价:5,租金:5,竞争:5,人力:4,波动:2},
      good:'全国商圈热度前五，清明日均客流破百万，紧邻洪崖洞景区', warn:'暑期酒店三四百起步、节假日溢价2-3倍，竞争极其激烈' },
    { name:'观音桥商圈', confidence:'yellow', tag:'本地商圈', tagCls:'tag-ind', attrs:{客流:5,房价:3,租金:3,竞争:4,人力:3,波动:2},
      good:'日均60万客流（全国前十），本地人最爱，经济型约70元/舒适型约180元', warn:'游客占比低于解放碑，价格天花板明显' },
    { name:'南滨路', confidence:'yellow', tag:'江景高端', tagCls:'tag-tour', attrs:{客流:3,房价:5,租金:4,竞争:3,人力:3,波动:2},
      good:'江景房约400元/晚，万豪/丽笙世嘉等高端品牌集中', warn:'投入极高，客群窄（高端度假）' },
    { name:'沙坪坝区', confidence:'red', tag:'科教城区', tagCls:'tag-ind', attrs:{客流:3,房价:3,租金:3,竞争:3,人力:3,波动:2},
      good:'大学城+科教文化区，年轻客群', warn:'消费力中等，价格敏感' },
  ],
}


// 竞品酒店数据（每个区县的周边竞争对手）
// level: 品牌档次 (budget=经济/mid=中端/upscale=中高端/luxury=高端)
// basePrice: 基准房价
// aggression: 侵略性 (1-5, 越高越积极调价)
export const COMPETITORS = {
  // 成都
  '锦江区': [
    { name: '亚朵酒店', level: 'upscale', basePrice: 450, aggression: 4 },
    { name: '如家精选', level: 'mid', basePrice: 280, aggression: 3 },
    { name: '7天连锁', level: 'budget', basePrice: 160, aggression: 5 },
  ],
  '高新区': [
    { name: '希尔顿欢朋', level: 'upscale', basePrice: 420, aggression: 3 },
    { name: '维也纳', level: 'mid', basePrice: 300, aggression: 4 },
  ],
  '武侯区': [
    { name: '全季酒店', level: 'mid', basePrice: 350, aggression: 3 },
    { name: '汉庭', level: 'budget', basePrice: 200, aggression: 4 },
  ],
  '青羊区': [
    { name: '亚朵S', level: 'upscale', basePrice: 480, aggression: 2 },
    { name: '如家商旅', level: 'mid', basePrice: 260, aggression: 3 },
  ],
  '金牛区': [
    { name: '桔子酒店', level: 'mid', basePrice: 320, aggression: 3 },
    { name: '锦江之星', level: 'budget', basePrice: 180, aggression: 3 },
  ],
  '龙泉驿区': [
    { name: '尚客优', level: 'budget', basePrice: 150, aggression: 4 },
  ],
  '双流区': [
    { name: '空港酒店', level: 'mid', basePrice: 240, aggression: 3 },
  ],
  '都江堰市': [
    { name: '青城山度假酒店', level: 'upscale', basePrice: 500, aggression: 2 },
    { name: '景区客栈', level: 'budget', basePrice: 120, aggression: 3 },
  ],
  '简阳市': [
    { name: '天府机场快捷', level: 'budget', basePrice: 140, aggression: 3 },
  ],
  // 德阳
  '旌阳区': [
    { name: '德阳大酒店', level: 'mid', basePrice: 260, aggression: 2 },
    { name: '速8酒店', level: 'budget', basePrice: 150, aggression: 3 },
  ],
  '绵竹市': [
    { name: '绵竹宾馆', level: 'budget', basePrice: 130, aggression: 2 },
  ],
  '中江县': [
    { name: '中江商务酒店', level: 'budget', basePrice: 100, aggression: 2 },
  ],
  '广汉市': [
    { name: '三星堆酒店', level: 'mid', basePrice: 280, aggression: 3 },
    { name: '广汉宾馆', level: 'budget', basePrice: 140, aggression: 2 },
  ],
}


// 客群画像数据（每个区县的三类客群占比，总和100%）
// persona: business=商务客 tourist=游客 family=家庭客
// 商务客看 WiFi+位置+安静 | 游客看 价格+景区距离 | 家庭客看 空间+安全+早餐
export const CUSTOMER_PERSONAS = {
  '锦江区':   { business: 55, tourist: 30, family: 15, dominant: 'business', note: '春熙路商圈，商务客为主' },
  '高新区':   { business: 65, tourist: 15, family: 20, dominant: 'business', note: '软件园+金融城，商务客绝对主力' },
  '武侯区':   { business: 40, tourist: 35, family: 25, dominant: 'business', note: '武侯祠景区+商务混合' },
  '青羊区':   { business: 35, tourist: 40, family: 25, dominant: 'tourist', note: '宽窄巷子景区，游客偏多' },
  '金牛区':   { business: 35, tourist: 20, family: 45, dominant: 'family', note: '居住区为主，家庭客多' },
  '龙泉驿区': { business: 30, tourist: 20, family: 50, dominant: 'family', note: '汽车产业工人家庭' },
  '双流区':   { business: 45, tourist: 35, family: 20, dominant: 'business', note: '机场中转客' },
  '都江堰市': { business: 10, tourist: 60, family: 30, dominant: 'tourist', note: '景区度假型，游客绝对主力' },
  '简阳市':   { business: 30, tourist: 45, family: 25, dominant: 'tourist', note: '天府机场中转+周边游' },
  '旌阳区':   { business: 50, tourist: 15, family: 35, dominant: 'business', note: '德阳市中心，政商务客' },
  '绵竹市':   { business: 25, tourist: 30, family: 45, dominant: 'family', note: '白酒产业+本地家庭' },
  '中江县':   { business: 15, tourist: 10, family: 75, dominant: 'family', note: '县域本地客为主' },
  '广汉市':   { business: 20, tourist: 55, family: 25, dominant: 'tourist', note: '三星堆景区驱动' },
  '五洲广场商圈': { business: 45, tourist: 20, family: 35, dominant: 'business', note: '政商混合型商圈' },
  '双桥区':   { business: 15, tourist: 65, family: 20, dominant: 'tourist', note: '避暑山庄景区，游客绝对主力' },
  '双滦区':   { business: 25, tourist: 30, family: 45, dominant: 'family', note: '本地居住区' },
  '承德县':   { business: 20, tourist: 20, family: 60, dominant: 'family', note: '县域本地客' },
  '围场满族蒙古族自治县': { business: 10, tourist: 70, family: 20, dominant: 'tourist', note: '草原旅游驱动' },
  '解放碑商圈': { business: 30, tourist: 50, family: 20, dominant: 'tourist', note: '景区+商圈混合' },
  '观音桥商圈': { business: 40, tourist: 25, family: 35, dominant: 'business', note: '本地生活商圈' },
  '南滨路':   { business: 25, tourist: 50, family: 25, dominant: 'tourist', note: '江景度假驱动' },
  '沙坪坝区': { business: 30, tourist: 25, family: 45, dominant: 'family', note: '大学城+居住' },
}
