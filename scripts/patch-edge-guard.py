# -*- coding: utf-8 -*-
# P1 补：左边缘 24px 触摸拦截层（仅弹层/决策面板打开时启用）+ 样式
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

a = rep('src/App.jsx', [
    # ① 拦截层：ref + 原生非被动监听（React 合成事件对 touch 是被动的，preventDefault 必须用原生非被动监听）
    ("""  React.useEffect(() => {
    try { window.history.pushState({ app: 1 }, '') } catch (e) {}""",
     """  // P1-补：左边缘 24px 触摸拦截层 —— 仅在【弹层/决策面板打开时】启用，避免挡住正常左侧交互。
  // 目的：把"左边缘右滑"在应用内消化掉，不让它被系统/浏览器解释成返回。
  // ⚠️ 真机预期（如实记录）：Android 的【系统】返回手势由 OS 在网页之前处理，网页通常拦不住；
  //    本层至少能挡住浏览器级的边缘滑动/横滚，并让"面板打开时左边缘拖动"不产生副作用。
  //    必须用原生 addEventListener({passive:false})：React 的合成 touch 监听是被动的，preventDefault 无效。
  const edgeGuardRef = React.useRef(null)
  const anyLayerOpen = !!(openPage || currentDecision)
  React.useEffect(() => {
    const el = edgeGuardRef.current
    if (!el || !anyLayerOpen) return
    const stop = (e) => { e.preventDefault(); e.stopPropagation() }
    const opts = { passive: false }
    el.addEventListener('touchstart', stop, opts)
    el.addEventListener('touchmove', stop, opts)
    el.addEventListener('touchend', stop, opts)
    return () => {
      el.removeEventListener('touchstart', stop)
      el.removeEventListener('touchmove', stop)
      el.removeEventListener('touchend', stop)
    }
  }, [anyLayerOpen])

  React.useEffect(() => {
    try { window.history.pushState({ app: 1 }, '') } catch (e) {}"""),
    # ② 渲染拦截层（fixed，位置无视觉影响；只在有弹层时存在）
    ("""      <div className="tabbar">""",
     """      {/* P1-补：左边缘手势拦截层（仅弹层/决策面板打开时渲染） */}
      {anyLayerOpen && <div ref={edgeGuardRef} className="edge-guard" aria-hidden="true" />}

      <div className="tabbar">"""),
])

b = rep('src/styles.css', [
    ("""/* P1：滑块只吃横向手势、不吃页面级滑动；滚动容器只允许纵向手势 */""",
     """/* P1-补：左边缘 24px 触摸拦截层（仅弹层/决策面板打开时渲染）——透明、不可见，只吃手势 */
.edge-guard {
  position: fixed; left: 0; top: 0; bottom: 0; width: 24px;
  z-index: 400; background: transparent; touch-action: none;
}

/* P1：滑块只吃横向手势、不吃页面级滑动；滚动容器只允许纵向手势 */"""),
])

print('\n结果：App=' + str(a) + ' styles=' + str(b))
