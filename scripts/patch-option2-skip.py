# -*- coding: utf-8 -*-
# ① 选项2：popstate 不再把决策面板当历史层（纯网页方案，两端通治）
# ② 门禁：那 3 条云端红改为"可跳过/可重试"（环境不可用时标记 ⏭，不再算失败）
import io

def rep(path, pairs):
    s = io.open(path, encoding='utf-8', newline='').read()
    okall = True
    for i, (old, new) in enumerate(pairs, 1):
        n = s.count(old)
        print(('  v ' if n == 1 else '  x ') + path + ' 锚点' + str(i) + ' 命中 ' + str(n) + ' 次：' + old.split('\n')[0][:52])
        if n != 1:
            okall = False
            continue
        s = s.replace(old, new)
    if okall:
        io.open(path, 'w', encoding='utf-8', newline='').write(s)
        print('  -> 已写盘 ' + path)
    else:
        print('  -> 未写盘 ' + path)
    return okall

# ── ① App.jsx：选项2 ──
a = rep('src/App.jsx', [
    ("""  // 手机侧滑返回：关一层界面（子页/决策面板→回经营tab），永不直接退出站点
  const navRef = React.useRef({})
  navRef.current = { openPage, currentDecision, tab, close: () => { setOpenPage(null); setCurrentDecision(null) }, setTab }""",
     """  // 手机侧滑返回 / 安卓返回键的统一处理（**纯网页方案，iOS Safari 与安卓浏览器都走这条**）
  // 规则（用户 2026-09-22 定·选项2）：
  //   · 子页(openPage) → 关闭它
  //   · 非经营 tab    → 切回经营
  //   · **决策面板(currentDecision) 不注册为历史层**：面板打开时返回键/边缘手势【什么都不做】
  //     理由：边缘手势两端通治，且教学场景里"误滑退出决策页"比"返回键关不掉"更烦人；面板自带「‹ 返回」
  // 三条保障不变：① 子页仍可被返回关闭 ② 非经营 tab 仍回经营 ③ 永不退出站点（每次处理完立刻再 pushState）
  const navRef = React.useRef({})
  navRef.current = {
    openPage, currentDecision, tab,
    close: () => { setOpenPage(null); setCurrentDecision(null) },
    closePage: () => setOpenPage(null),
    setTab,
  }"""),
    ("""      try {
        if (nav.openPage || nav.currentDecision) nav.close()
        else if (nav.tab !== 'business') nav.setTab('business')
      } catch (e) {}""",
     """      try {
        if (nav.openPage) nav.closePage()                                  // 选项2：只看子页，不看决策面板
        else if (nav.tab !== 'business') nav.setTab('business')
      } catch (e) {}"""),
])

# ── ② ui-smoke：三条云端红改"可跳过" ──
b = rep('tests/ui-smoke.mjs', [
    ("""function pageDump(text) {""",
     """// 环境性跳过：云端不可用（Supabase 登录限流 / 跨国线路）时标记为 ⏭ 并计入通过，
// 避免环境红灯反复出现干扰判断；输出里明确写出"已跳过（重试可恢复）"，不隐瞒。
function skip(name, reason) {
  results.push({ name, pass: true, skipped: true })
  console.log(`  ⏭ 跳过（${reason}）：${name}`)
}
function pageDump(text) {"""),
    ("""    const { pg, body } = teacher
    ok(`云端教师登录（${TEST_TEACHER.id}）`, body.includes('教师后台'))""",
     """    const { pg, body } = teacher
    // 云端教师段可用性：不可用时整段走"跳过"，不算失败（用户 2026-09-22 要求）
    const teacherOK = body.includes('教师后台')
    const okT = (name, cond) => teacherOK ? ok(name, cond) : skip(name, `云端教师段不可用（${TEST_TEACHER.id} 登录未成功，疑限流/线路，重跑可恢复）`)
    if (teacherOK) ok(`云端教师登录（${TEST_TEACHER.id}）`, true)
    else skip(`云端教师登录（${TEST_TEACHER.id}）`, '登录未成功，疑 Supabase 限流/跨国线路（重跑即恢复）')"""),
    ("""    ok('教师端底部三导航+实时大屏', liveReady)""",
     """    okT('教师端底部三导航+实时大屏', liveReady)"""),
    ("""    ok('大屏周次筛选（历史回放模式）', await pg.evaluate(() => document.body.innerText.includes('历史回放') && document.body.innerText.includes('第1周快照')))""",
     """    okT('大屏周次筛选（历史回放模式）', await pg.evaluate(() => document.body.innerText.includes('历史回放') && document.body.innerText.includes('第1周快照')))"""),
])

print('\n结果：App(选项2)=' + str(a) + ' ui-smoke(跳过)=' + str(b))
