// 回复评分内核（词云式关键词计分）
// 🔴 规则只存在于本文件，绝不导出关键词/分值到任何 UI——学生只写话术，看结果
// 差评回复：道歉/补偿/解决措施/时效/称呼/预防 等要素越多越好；推责/敷衍扣分
// 好评回复：感谢/欢迎再来/小惊喜/倾听 等要素加分

const NEG_RULES = [
  { re: /道歉|抱歉|对不起|不好意思/, pts: 2 },
  { re: /补偿|退款|赔偿|免单|优惠券|折扣|升级|延迟退房|赠送|水果|早餐/, pts: 3 },
  { re: /解决|处理|整改|更换|维修|检查|排查|核实|已安排/, pts: 2 },
  { re: /立即|马上|第一时间|已在|24小时|当天|加急|今晚/, pts: 2 },
  { re: /培训|流程|制度|优化|改进|杜绝|避免再次/, pts: 1 },
  { re: /感谢|反馈|监督|意见|理解/, pts: 1 },
  { re: /您好|先生|女士|亲爱|您/, pts: 1 },
]
const NEG_PENALTIES = [
  { re: /客人自己|个人原因|个人使用|不可抗力|正常现象|无法避免|与我们无关/, pts: -3 },
  { re: /^(好的|收到|嗯|哦|ok|OK)/, pts: -2 },
  { re: /统一|模板|标准答复/, pts: -2 },
]

const GOOD_RULES = [
  { re: /感谢|谢谢|谢谢您/, pts: 3 },
  { re: /欢迎|期待|再次|下次|再来/, pts: 2 },
  { re: /惊喜|礼物|小小心意|会员|优惠|果汁|水果/, pts: 2 },
  { re: /您好|先生|女士|亲爱|您/, pts: 1 },
  { re: /意见|建议|监督|表扬|鼓励/, pts: 1 },
]

function lenAdjust(pts, text) {
  const len = text.replace(/\s/g, '').length
  if (len < 8) return Math.min(pts, 1) // 太短的话术没有诚意
  if (len < 20) return Math.min(pts, 4)
  return pts
}

// 差评回复评分 → tier: excellent / good / fair / poor
export function scoreNegativeReply(text) {
  let pts = 0
  for (const r of NEG_RULES) if (r.re.test(text)) pts += r.pts
  for (const r of NEG_PENALTIES) if (r.re.test(text)) pts += r.pts
  pts = lenAdjust(pts, text)
  const tier = pts >= 8 ? 'excellent' : pts >= 5 ? 'good' : pts >= 3 ? 'fair' : 'poor'
  return { pts, tier }
}

// 好评回复评分 → tier: warm / ok / cold
export function scoreGoodReply(text) {
  let pts = 0
  for (const r of GOOD_RULES) if (r.re.test(text)) pts += r.pts
  const len = text.replace(/\s/g, '').length
  if (len < 5) pts = 0
  const tier = pts >= 5 ? 'warm' : pts >= 3 ? 'ok' : 'cold'
  return { pts, tier }
}
