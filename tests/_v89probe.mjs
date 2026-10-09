// V89 探针：官方加盟 API 详情端点 —— 逐个查『是否有费用类字段』（三件证据用 · 只读不落库）
const ids=[8,12,16,17,26,27,30];
const 名={8:'桔子酒店',12:'美仑美奂',16:'你好酒店',17:'怡莱酒店',26:'桔子水晶酒店',27:'CitiGO欢阁酒店',30:'美仑国际'};
for(const id of ids){
  try{
    const r=await fetch('https://franchise-cmsapi.huazhu.com/brand/brand/'+id,{headers:{'User-Agent':'Mozilla/5.0'}});
    const j=await r.json();
    const d=j.data||j;
    console.log('id='+id+' '+(名[id]||''));
    console.log('   顶层键: '+Object.keys(d).join(','));
    console.log('   invests: '+JSON.stringify(d.invests||[]).slice(0,220));
    const s=JSON.stringify(d);
    const 命中=['加盟费','管理费','费率','CRS','保证金','筹备费'].filter(k=>s.includes(k));
    console.log('   费用类字段: '+(命中.length?命中.join('/'):'（无）'));
  }catch(e){ console.log('id='+id+' 失败: '+String(e.message).slice(0,80)); }
}
