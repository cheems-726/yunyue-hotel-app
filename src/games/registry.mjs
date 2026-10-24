// V133 · 游戏库唯一数据源 —— 列表页只读这里；新增游戏 = 加一条 + 放文件
// 红线：入口只负责"能玩"；不计分、不进台账、不打卡、不写经营 state。
export const 游戏库 = [
  {
    id: 'room-arrange',
    名称: '客房摆放',
    一句话: '把拆散的客房用品摆回正确位置，看你能拿几星',
    时长: '2–5 分钟',
    形态: 'iframe',                       // iframe | native
    入口: '/games/room-arrange/index.html', // iframe 必填
  },
  {
    id: 'price-elastic',
    名称: '价格弹性猜数',
    一句话: '再涨 10% 出租率会掉到多少？交决策前 2 分钟的热身题',
    时长: '1–2 分钟',
    形态: 'native',                       // native = 组件内玩（断网可玩）
  },
]
