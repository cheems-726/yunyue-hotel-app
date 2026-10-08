// §33-V80 · 12 周任务书 —— 【展示层】（只读 · 可打印为 PDF）
//   数据单源 src/semesterTasks.mjs（每周：任务/涉及决策/知识点/交付物/常见错误 · 零自拼）
//   决策 id → 名称/档位走 decisions.js + decisionCadence 实表（本文件不做口径运算）
//   学生入口：我的 → 玩法说明 → 「12 周任务书」；教师入口：教师端顶部「12 周任务书（打印版）」
import React from 'react'
import Icon from './Icon.jsx'
import { 周任务书 } from './semesterTasks.mjs'
import { decisions } from './decisions.js'
import { 档位 as cadenceOf, 档语 } from './decisionCadence.mjs'

const 名称Of = Object.fromEntries(decisions.map(d => [d.id, d.name]))
const 实时数 = decisions.filter(d => cadenceOf(d.id) === 'realtime').length
const 周期数 = decisions.filter(d => cadenceOf(d.id) === 'periodic').length
const 一次数 = decisions.filter(d => cadenceOf(d.id) === 'onetime').length

export default function SemesterTasks({ onClose }) {
  const 打印 = () => { try { window.print() } catch (e) {} }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--fill)', zIndex: 9000, overflowY: 'auto' }}>
      <style>{`
        @media print {
          .st-noprint { display: none !important; }
          .st-page { position: static !important; background: #fff !important; overflow: visible !important; }
          .st-card { break-inside: avoid; box-shadow: none !important; border: 1px solid var(--border); }
          body { background: #fff; }
        }
      `}</style>

      {/* 工具条（打印时隐藏） */}
      <div className="st-noprint" style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, zIndex: 2 }}>
        <button onClick={onClose} style={{ border: 'none', background: 'var(--fill)', borderRadius: 8, padding: '7px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← 返回</button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>12 周任务书</div>
        <div style={{ flex: 1 }} />
        <button onClick={打印} style={{ border: 'none', background: 'var(--warn)', color: '#fff', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>打印 / 另存 PDF</button>
      </div>

      <div className="st-page" style={{ maxWidth: 860, margin: '0 auto', padding: '14px 16px 40px' }}>
        <div className="st-card" style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>学生端 12 周任务书</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.8, marginTop: 6 }}>
            每周一条：<b>本周任务 / 涉及决策 / 知识点 / 交付物 / 常见错误</b>。涉及决策全部来自游戏内实际可做的 18 项决策
            （实时 {实时数} 项每周都做 · 周期 {周期数} 项 · 一次性 {一次数} 项），与引擎口径一致——
            课堂上老师讲到的每项决策，都能在对应周的决策面板里找到。
          </div>
        </div>

        {周任务书.map(w => (
          <div key={w.周} className="st-card" style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--warn)' }}>第 {w.周} 周</span>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{w.主题}</span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.9 }}>
              <div><b>任务：</b>{w.任务}</div>
              <div style={{ marginTop: 4 }}>
                <b>涉及决策：</b>
                {w.决策.map(id => {
                  const 语 = 档语[cadenceOf(id)]
                  return (
                    <span key={id} title={语 ? 语.名 + '：' + 语.说明 : id} style={{ display: 'inline-block', background: 'var(--fill)', borderRadius: 6, padding: '1px 8px', marginRight: 6, marginBottom: 3, fontSize: 11 }}>
                      {名称Of[id] || id}
                    </span>
                  )
                })}
              </div>
              <div style={{ marginTop: 4 }}><b>知识点：</b>{w.知识点}</div>
              <div style={{ marginTop: 4 }}><b>交付物：</b>{w.交付物}</div>
              <div style={{ marginTop: 4, color: 'var(--bad)' }}><b>常见错误：</b>{w.常见错误}</div>
            </div>
          </div>
        ))}

        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.8 }}>
          数据来源：决策清单与三档节奏 = 游戏实表（decisions.js 18 项 · decisionCadence 实测）；常见错误与引擎机制反例同源（V77 常见误区口径），零外部新增数字。<br />
          本页只读，可打印/另存 PDF 发给学生。
        </div>
      </div>
    </div>
  )
}
