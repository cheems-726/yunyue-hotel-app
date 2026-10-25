// V154 批3 · 教师端课堂包（纯函数层）—— 投屏/对比/学期报告共用
// 数据全部来自 semesterResult.mjs / reportCard.mjs 的纯重排层；本模块不自算一分。
import { 班级并排 } from './semesterResult.mjs'
import { 成绩单行, 成绩单CSV, 归档快照, 归档CSV, 与scoreOf零差 } from './reportCard.mjs'
import { SCORE_WEIGHTS, wan1 } from './metricDefs.mjs'
import { TOTAL_WEEKS } from './semester.mjs'

export const 万元 = (v) => (Number.isFinite(v) ? (v >= 0 ? '+' : '−') + wan1(Math.abs(v)) : '—')   // 金额→万换算单源 metricDefs.wan1（stale-scale R6）
export const 率 = (v) => (v == null || !Number.isFinite(v)) ? '—' : Math.round(v * 100) + '%'
export const pctInt = (v) => (v == null || v === '' ? '—' : Math.round(v) + '%')

export { 成绩单CSV, 归档快照, 归档CSV, 与scoreOf零差 } from './reportCard.mjs'   // ★ 供 ClassroomPack.jsx 复用（单源 reportCard）

/** 从教师端 rawStates/groups 组装并排行 + 每组 history 索引（单一入口，给投屏/对比/学期报告共用） */
export function 组装课堂行({ groups = [], rawStates = [], classByUid = {}, filterClass = '' }) {
  const vis = filterClass ? groups.filter(g => classByUid[g.uid] === filterClass) : groups
  const 输入 = vis.map(g => {
    const gs = rawStates.find(x => x.user_id === g.uid) || {}
    return { 组号: g.name, 班级: '', 酒店名: g.hotel || '', history: (gs.state && gs.state.history) || [] }
  })
  const rows = 输入.map(x => 成绩单行(x))
  const histBy组号 = Object.fromEntries(输入.map(x => [x.组号, x.history]))
  return { rows, histBy组号 }
}


/** 学期版一键报告（导出 HTML 文件 · 可打印为 PDF）：学期成果 + 六组成绩单 + 归档说明 */
export function 学期报告HTML({ 班级 = '', rows = [], 摘要 = [], 生成人 = '' }) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const 头 = `<h1 style="font-size:22px;margin:0 0 6px">云悦酒店 · 学期报告${班级 ? ' · ' + esc(班级) : ''}</h1>
  <p style="font-size:12px;color:#666;margin:0 0 12px">口径 A：利润 ${SCORE_WEIGHTS.profit * 100}/口碑 ${SCORE_WEIGHTS.reputation * 100}/出租 ${SCORE_WEIGHTS.occupancy * 100}/差评 ${SCORE_WEIGHTS.negative * 100}（过程分不进总表）· 学期口径 = 前 ${TOTAL_WEEKS} 周 · 并排展示不排名 · 生成 ${new Date().toLocaleString('zh-CN', { hour12: false })} · ${esc(生成人) || '教师'}</p>`
  const 行 = rows.map(r => `<tr>
    <td style="text-align:left;font-weight:700">${esc(r.组号)}</td><td>${esc(r.酒店名) || '—'}</td>
    <td style="text-align:right">${万元(r.累计营收)}</td>
    <td style="text-align:right">${万元(r.经营净利)}</td>
    <td style="text-align:right">${率(r.净利率)}</td>
    <td style="text-align:right">${pctInt(r.平均出租率)}</td>
    <td style="text-align:right">${pctInt(r.平均好评率)}</td>
    <td style="text-align:right">${r.差评处理率 == null ? '无待办' : 率(r.差评处理率)}</td>
    <td style="text-align:right">${r.利润分}</td><td style="text-align:right">${r.口碑分}</td>
    <td style="text-align:right">${r.出租率分}</td><td style="text-align:right">${r.差评分}</td>
    <td style="text-align:right;font-weight:700">${r.总分}</td><td>${esc(r.等级)}</td></tr>`).join('')
  const 摘 = 摘要.map(m => `<li>${esc(m.组 || m.组号 || '')}：${m.周数 ?? '—'} 周 · 期末资金 ${m.资金 == null ? '—' : 万元(m.资金)}</li>`).join('')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>云悦酒店 · 学期报告</title>
  <style>body{font-family:system-ui,'Microsoft YaHei',sans-serif;color:#222;max-width:960px;margin:24px auto;padding:0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f4f5f7;border-bottom:1.5px solid #333;padding:6px 6px;text-align:right;white-space:nowrap}
  td{border-bottom:1px solid #ddd;padding:7px 6px;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}
  @media print{.noprint{display:none}body{margin:0}}</style></head><body>
  ${头}
  <h2 style="font-size:16px">一、六组期末成绩单（口径 A）</h2>
  <table><thead><tr><th>组</th><th>酒店</th><th>营收</th><th>经营净利</th><th>净利率</th><th>出租率</th><th>好评率</th><th>差评处理</th><th>利润分</th><th>口碑分</th><th>出租分</th><th>差评分</th><th>总分</th><th>等级</th></tr></thead><tbody>${行}</tbody></table>
  <h2 style="font-size:16px">二、学期摘要（前 ${TOTAL_WEEKS} 周）</h2><ul style="font-size:13px">${摘 || '<li>（无）</li>'}</ul>
  <p style="font-size:12px;color:#666">归档：教师端「归档本学期」生成 JSON/CSV 快照（值拷贝冻结，不随数据变化）· 本报告只读重排，不重算引擎。</p>
  <button class="noprint" onclick="window.print()" style="padding:10px 18px;font-size:14px;cursor:pointer">打印 / 存 PDF</button>
  </body></html>`
}
