const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.jgytwxaeeezmdbxfsyvs:Yunyue2026!Hotel%23Teach@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres' });
c.connect().then(async () => {
  // 只清理冒烟测试残留的两类测试批注（真实学生批注不受影响——按文案精确匹配）
  const r1 = await c.query(`delete from teacher_notes where note like '经营策略清晰，决策完成度高%' returning id`);
  const r2 = await c.query(`delete from teacher_notes where note like '验证删除功能-测试批注%' returning id`);
  const r3 = await c.query(`delete from teacher_notes where note like '诊断删除-测试批注%' returning id`);
  console.log('清理: 冒烟残留', r1.rowCount, '/ 验证残留', r2.rowCount, '/ 诊断残留', r3.rowCount);
  const left = await c.query(`select count(*)::int as n from teacher_notes`);
  console.log('teacher_notes 剩余行数:', left.rows[0].n);
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
