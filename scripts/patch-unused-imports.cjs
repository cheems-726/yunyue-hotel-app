// -*- coding: utf-8 -*-
// 第三层④：移除确认未使用的 import（JSX 自动运行时下多余的 React 默认导入 + TeacherDashboard 的 setGroupRole）
// 每个文件都先确认：正文里不再出现该标识符（扫描器已确认），且改后 build/门禁全绿
const fs = require('fs')
const ReactFiles = ['BrandSelection.jsx', 'Claim.jsx', 'DecisionPanel.jsx', 'Establishment.jsx', 'RadarChart.jsx', 'Reputation.jsx', 'ResultFeedback.jsx', 'SiteSelection.jsx', 'WeeklyReport.jsx', 'Welcome.jsx']
let changed = 0
for (const f of ReactFiles) {
  const p = 'src/' + f
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  s = s.replace(/^import React, \{/, 'import {')
  s = s.replace(/^import React from 'react'\r?\n/, '')
  if (s === before) { console.log('  · 未变（形态不同，跳过）：' + f); continue }
  if (/\bReact\b/.test(s.replace(/^import[^\n]*\n/gm, ''))) { console.log('  x 正文仍用 React，跳过：' + f); continue }
  fs.writeFileSync(p, s, 'utf8')
  console.log('  v ' + f)
  changed++
}
// TeacherDashboard：移除未使用的 setGroupRole
{
  const p = 'src/TeacherDashboard.jsx'
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  s = s.replace(/(\n\s*)setGroupRole,/, '$1')
  if (s !== before && !/\bsetGroupRole\b/.test(s.replace(/^import[^\n]*\n/gm, ''))) {
    fs.writeFileSync(p, s, 'utf8')
    console.log('  v TeacherDashboard.jsx（去 setGroupRole）')
    changed++
  } else console.log('  x TeacherDashboard setGroupRole 处理失败/仍被使用')
}
console.log('共修改 ' + changed + ' 个文件')
