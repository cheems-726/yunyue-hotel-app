// V186 · PC「返回上一步」· 源码/行为守门（挂 run-all fast · 不依赖浏览器）
// 规格：2-任务包/现行/任务包-V186-PC返回上一步.md（读于基线 ad1160d）
// 判据：§4 验收总表 1–10 的静态部分 + §5 RV-1/2/3/4/5/6/7 的可证伪锚点
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = f => readFileSync(join(SRC, f), 'utf8')

console.log('▶ V186 · PC 返回上一步（源码守门）')

// ── [1] StepBack 组件本体（§2 规格）────────────────────────────────
console.log('\n[1] StepBack 组件：锚点/无障碍/44px/variant')
{
  ok(existsSync(join(SRC, 'StepBack.jsx')), 'StepBack.jsx 存在')
  const sb = src('StepBack.jsx')
  ok(sb.includes('data-step-back="1"'), '根元素带 data-step-back 测试锚点')
  ok(sb.includes('aria-label="返回上一步"'), '按钮带 aria-label="返回上一步"')
  ok(/minHeight:\s*44/.test(sb) && /minWidth:\s*44/.test(sb), '尺寸 ≥44px（PC 与 390 同时满足 · 不只在移动端达标）')
  ok(/if \(variant !== 'top'\) return btn/.test(sb) && /className="v186-topbar"/.test(sb), "variant='top' 走 .v186-topbar（≥1024 才显示）")
  ok(/disabled = false/.test(sb) && /title=\{disabled \? disabledReason/.test(sb), 'disabled 时给 disabledReason 说明（不是无声禁用）')
}

// ── [2] CSS：顶栏 ≥1024 才显示（<1024 只保留底栏）────────────────
console.log('\n[2] 响应式：顶栏 ≥1024 显示 · <1024 只留底栏')
{
  const css = src('styles.css')
  ok(/\.v186-topbar\s*\{\s*display:\s*none/.test(css), '<1024：.v186-topbar display:none（只保留底栏）')
  ok(/@media \(min-width: 1024px\)[\s\S]{0,120}\.v186-topbar[\s\S]{0,40}display:\s*flex/.test(css), '≥1024：.v186-topbar display:flex')
}

// ── [3] 预言弹窗：可返回 · 不落库 · 草稿保留 · Esc/遮罩 ──────────
console.log('\n[3] 预言弹窗（§3.1）')
{
  const site = src('SiteSelection.jsx')
  ok(/import StepBack from '\.\/StepBack\.jsx'/.test(site), '引入 StepBack')
  ok(/<StepBack onBack=\{返回预言\}/.test(site), '弹窗内渲染 StepBack（RV-1：删掉 ⇒ 红）')
  ok(/function 返回预言\(\) \{ set预言弹\(null\) \}/.test(site), '返回 = 只关弹窗（RV-2：仍写 预言s ⇒ 红）')
  const 返回体 = (site.match(/function 返回预言\(\) \{([^}]*)\}/) || [])[1] || ''
  ok(!/set预言s/.test(返回体) && !/onLog/.test(返回体), '返回函数体内无 set预言s / 无 onLog（不写 decision_logs）')
  ok(/useEscClose\(!!预言弹, 返回预言\)/.test(site), 'Esc = 取消（与「上一步」同义）')
  ok(/onClick=\{返回预言\}[\s\S]{0,200}<div className="card"[^>]*onClick=\{e => e\.stopPropagation\(\)\}/.test(site), '遮罩点击 = 返回 + 卡片 stopPropagation')
  ok(/set草稿区/.test(site) && /草稿区 !== d\.name/.test(site), '草稿按区保留（同区重开还在 · 换区才清）')
  ok(/重新押注/.test(site) && /\{p && \(/.test(site), '「重新押注」入口存在且仅在已押注时出现')
  ok(!/承诺书 &&[\s\S]{0,80}重新押注/.test(site), '重押入口不在承诺书已签分支（签署后消失 ⇒ 判据 4）')
  ok(/'location-prediction-rebet'/.test(site), '重押写入独立 decision_logs 标识（覆盖有痕）')
}

// ── [4] 认领 6 步（§3.2）───────────────────────────────────────
console.log('\n[4] 认领：第 1–5 步可返回 · 第 0 步不渲染返回 + 一行原因')
{
  const claim = src('Claim.jsx')
  ok(/import StepBack from '\.\/StepBack\.jsx'/.test(claim), '引入 StepBack')
  ok(/\{step > 0 && \(\s*<StepBack onBack=\{prev\}/.test(claim), '底栏：step>0 才渲染 StepBack')
  ok(/<StepBack variant="top"[\s\S]{0,120}onBack=\{prev\}/.test(claim), '顶栏 StepBack 与底栏同一 onBack')
  ok(/品牌可重选：点下方/.test(claim), '第 0 步给一行「可退回」说明（V188-b 改口径）')
  ok(/useWizardBack\(step > 0, prev\)/.test(claim), 'Alt+← / 侧键只在 step>0 生效')
}

// ── [5] 筹建 4 步 + 圆圈旁路（§3.3）────────────────────────────
console.log('\n[5] 筹建：StepBack + 圆圈不能跳未完成步')
{
  const est = src('Establishment.jsx')
  ok(/import StepBack from '\.\/StepBack\.jsx'/.test(est), '引入 StepBack')
  ok(/\{currentStep > 0 && \(\s*<StepBack onBack=\{prev\}/.test(est), '底栏：currentStep>0 才渲染 StepBack')
  ok(/onClick=\{\(\) => 圆圈跳步\(i\)\}/.test(est), '圆圈改走 圆圈跳步（RV-4：改回 setCurrentStep(i) ⇒ 红）')
  ok(/if \(i > currentStep && !done\[i\]\)/.test(est), '向前跳未完成步被拦（判据：i>currentStep 且该步未 done）')
  ok(/跳步提示\(`先完成第 \$\{currentStep \+ 1\} 步/.test(est), '拦截时给一行提示（不是静默无视）')
  ok(/可随时退回：换物业/.test(est), '第 0 步给一行「可退回」说明（V188-b 改口径）')
  ok(/useWizardBack\(currentStep > 0, prev\)/.test(est), 'Alt+← / 侧键只在 currentStep>0 生效')
}

// ── [6] 阶段级不可逆（§3.4 · 判据 7 / RV-5）────────────────────
console.log('\n[6] 不可逆点：有说明、无返回控件（负向断言 @HEAD）')
{
  const brand = src('BrandSelection.jsx')
  ok(/选址可重选：点上方/.test(brand), '品牌页有「选址可重选」说明行（V188-b）')
  ok(!/StepBack/.test(brand), '品牌页不渲染任何 StepBack（不可逆点不渲染返回控件）')
  const site = src('SiteSelection.jsx')
  // ★ V188-b（用户令 2026-11-08「任何情况都不需要锁死」）—— 原 §6-A「不放开跨阶段返回」已被推翻：
  //   现在要求三个阶段各有一个「退回上一阶段」的控件，且必须带二次确认（防误点清空进度）。
  //   RV：删掉任一处的返回按钮/确认 ⇒ 对应断言红。
  ok(/返回品牌/.test(src('Claim.jsx')) && /换物业/.test(src('Establishment.jsx')) && /返回选址重选/.test(src('BrandSelection.jsx')),
    '阶段级退回：品牌/认领/筹建三处都在（V188-b · 任何情况不锁死）')
  ok(/window\.confirm/.test(src('Claim.jsx')) && /window\.confirm/.test(src('Establishment.jsx')) && /window\.confirm/.test(src('BrandSelection.jsx')),
    '三处退回都有二次确认（防误点清空进度）')
}

// ── [7] 键盘/鼠标（§3.5 · RV-6）────────────────────────────────
console.log('\n[7] useWizardBack：Alt+← / 侧键 · 只在向导内 · 不劫持经营页')
{
  ok(existsSync(join(SRC, 'useWizardBack.mjs')), 'useWizardBack.mjs 存在')
  const uw = src('useWizardBack.mjs')
  ok(/e\.altKey && \(e\.key === 'ArrowLeft' \|\| e\.code === 'ArrowLeft'\)/.test(uw), 'Alt+ArrowLeft 触发')
  ok(/e\.button === 4/.test(uw), '鼠标侧键（button===4）触发')
  ok(/if \(!active \|\| typeof onBack !== 'function' \|\| disabled\) return/.test(uw), 'onBack 不存在/禁用时不注册（RV-6：去掉 ⇒ 经营页被吞键 ⇒ 红）')
  ok(/useWizardBack\(!!预言弹, 返回预言\)/.test(src('SiteSelection.jsx')), '预言弹窗挂载')
  // 负向：经营页/教师端不挂（App.jsx 与 TeacherDashboard 均无 useWizardBack）
  ok(!/useWizardBack/.test(src('App.jsx')) && !/useWizardBack/.test(src('TeacherDashboard.jsx')), '经营页/教师端不挂（浏览器后退行为不变）')
}

// ── [8] 零口径改动（判据 10）──────────────────────────────────
console.log('\n[8] 零口径：本卡未触碰结算/评分/加盟模型')
{
  for (const f of ['settlement.js', 'franchiseModel.mjs', 'processScore.mjs']) {
    const s = src(f)
    ok(!/V186/.test(s), `${f} 无 V186 改动痕迹（口径文件一字不动）`)
  }
}

// ── [9] 套件挂载（RV-7：只写套件不挂 run-all = 没跑）──────────────
console.log('\n[9] 两条套件已挂 run-all')
{
  const runall = readFileSync(join(HERE, 'run-all.mjs'), 'utf8')
  ok(runall.includes('v186BackNav.test.mjs'), 'run-all SUITES 含 v186BackNav（守门）')
  ok(runall.includes('v186BackNavUi.test.mjs'), 'run-all SUITES 含 v186BackNavUi（浏览器 · RV-7）')
  ok(/v186BackNavUi[^\n]*browser: true/.test(runall), '浏览器套件标 browser: true')
}

console.log(`\nV186 源码守门：${pass} 通过 / ${fail} 失败`)
if (fail) process.exit(1)
