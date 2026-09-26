# -*- coding: utf-8 -*-
# 第零批 Batch1：B1 断言 / B2·B3 改名弹窗迁 Profile / B4 教师端去完成
import io

def read(p):
    return io.open(p, encoding='utf-8', newline='').read()

def write(p, s):
    io.open(p, 'w', encoding='utf-8', newline='').write(s)

def rep(path, pairs):
    s = read(path)
    for i, (old, new) in enumerate(pairs, 1):
        n = s.count(old)
        print(('  v ' if n == 1 else '  x ') + path + ' 锚点' + str(i) + ' 命中 ' + str(n) + ' 次：' + old.split('\n')[0][:52])
        if n != 1:
            print('  -> 未写盘 ' + path)
            return False
        s = s.replace(old, new)
    write(path, s)
    print('  -> 已写盘 ' + path)
    return True

DIALOG = """      {/* 真实姓名修改弹窗（B2/B3：state 与弹窗都在本组件，与入口 ✏️ 同处） */}
      {renameOpen && (
        <div onClick={() => setRenameOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 20, padding: 22, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>✏️ 修改真实姓名</div>
            <input
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              placeholder="输入真实姓名（教师端将显示）"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRenameOpen(false)}>取消</button>
              <button className="btn-confirm" style={{ flex: 2, opacity: renameVal.trim() ? 1 : 0.5 }} disabled={!renameVal.trim()}
                onClick={() => { const n = renameVal.trim(); if (n && n !== user?.name) onRename(n); setRenameOpen(false) }}>保存</button>
            </div>
          </div>
        </div>
      )}
"""

DIALOG_OLD = DIALOG.replace('      {/* 真实姓名修改弹窗（B2/B3：state 与弹窗都在本组件，与入口 ✏️ 同处） */}\n', '      {/* 真实姓名修改弹窗 */}\n')

B1 = """console.log('\\n[10] 触发条件回归：18 项决策全做完且答案一致（曾被 TDZ 崩掉）')
{
  // 触发条件只能靠【垃圾输入】构造：18 项答案字符串完全相同就不可能每项都合法
  const ids = ['pricing', 'shifts', 'overbook', 'hygiene', 'linen', 'energy', 'campaign', 'ota',
    'member-convert', 'member-threshold', 'corporate', 'reputation', 'hr-optimize', 'renovation',
    'quality-check', 'service', 'breakfast', 'parking']
  const same = {}
  ids.forEach(k => { same[k] = '统一答案' })
  let r = null, err = null
  try { r = settle({ site: SITE, brand: BRAND, decisions: same, week: 1 }) } catch (e) { err = e }
  ok(!err, '18 项同答案 → settle 不抛异常（TDZ 修复回归）' + (err ? ' 实际：' + err.message : ''))
  ok(!!r && Array.isArray(r.insights) && r.insights.some(x => String(x.text).includes('决策模式异常一致')),
    '防作弊提醒照常产出（insights 含决策模式异常一致）')
}

"""

ok1 = rep('tests/settlement.test.mjs', [[
    "console.log(`\\n结果: ${pass} 通过, ${fail} 失败`)",
    B1 + "console.log(`\\n结果: ${pass} 通过, ${fail} 失败`)",
]])

ok2 = rep('src/App.jsx', [
    # ① Profile 补 state
    ("function Profile({ onOpen, user, location, brand, property, onLogout, doneDecisions, week, history, report, onRename, attrs }) {",
     """function Profile({ onOpen, user, location, brand, property, onLogout, doneDecisions, week, history, report, onRename, attrs }) {
  // B2/B3 修复：改名弹窗的 state 与 JSX 必须和入口（下方 ✏️）在同一组件。
  // 原实现弹窗在 Business、入口在 Profile → 两边都 ReferenceError（真机表现"点了没反应"）
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameVal, setRenameVal] = useState(user?.name || '')"""),
    # ② Profile 树内插入弹窗
    ("        <div style={{ minWidth: 0 }}>", DIALOG + "        <div style={{ minWidth: 0 }}>"),
    # ③ 删 Business 的两处 state
    ("""  const [renameOpen, setRenameOpen] = useState(false) // 真实姓名修改弹窗（替代window.prompt移动端bug）
  const [renameVal, setRenameVal] = useState(user?.name || '')
""", ""),
    # ④ 删 Business 的弹窗副本
    (DIALOG_OLD, ""),
])

ok3 = rep('src/TeacherDashboard.jsx', [
    ('onGoDecision={(id) => { close(); onGoDecision && onGoDecision(id) }}',
     'onGoDecision={(id) => { setExpandedUid(null); onGoDecision && onGoDecision(id) }}'),
])

print('\n结果：B1=' + str(ok1) + ' App=' + str(ok2) + ' Teacher=' + str(ok3))
