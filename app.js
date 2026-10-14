const versions = {
  "agent-v4.8": { prompt:"p23", data:"2026.10.14", overall:86.4, pass:91.2, p0:0, review:23, dims:[91,88,84,82,93,99], intents:[90.8,87.1,85.6,82.4,84.9] },
  "agent-v4.7": { prompt:"p21", data:"2026.10.07", overall:82.6, pass:87.5, p0:2, review:37, dims:[88,81,79,78,90,97], intents:[87.2,83.5,80.1,78.6,81.7] },
  "agent-v4.6": { prompt:"p19", data:"2026.09.28", overall:79.8, pass:84.1, p0:3, review:45, dims:[84,79,75,76,87,96], intents:[83.5,79.9,77.2,74.1,79.0] }
};
const dimNames=["切题相关","数字准确","时效新鲜","证据可信","KYC 适当","合规隐私"];
const intents=[
  {name:"行情 / 事实查询",icon:"↗",standard:"数字准确 · 时点明确 · 来源可追溯",n:312,trend:"▂▃▄▅▆▇",status:"优秀"},
  {name:"热点解读",icon:"◉",standard:"事件新鲜 · 事实/观点分离 · 不追涨诱导",n:268,trend:"▃▅▄▆▅▇",status:"良好"},
  {name:"产品比较",icon:"⇄",standard:"同口径 · 费用风险完整 · 无选择性陈述",n:241,trend:"▅▄▅▆▅▇",status:"良好"},
  {name:"个性化建议",icon:"♙",standard:"KYC 完整 · 适当性 · 禁止确定性承诺",n:226,trend:"▃▂▄▃▅▆",status:"关注"},
  {name:"组合诊断",icon:"▦",standard:"持仓计算准确 · 约束一致 · 风险揭示",n:201,trend:"▃▄▃▅▄▆",status:"良好"}
];
const causes=[{name:"时效上下文缺失",v:29,c:"#d86b34"},{name:"数字计算错误",v:24,c:"#c94444"},{name:"KYC 使用不当",v:18,c:"#c68a22"},{name:"答非所问",v:15,c:"#4f75c9"}];
const cases=[
 {id:"BC-1042",intent:"个性化建议",q:"我 65 岁，半年后要用这笔钱，能全买高股息 ETF 吗？",issue:"忽略半年流动性需求，直接给出 80% 配置建议",cause:"KYC 使用不当",risk:"P1",owner:"策略",status:"待复核",scores:[91,96,90,82,38,72],source:"用户反馈"},
 {id:"BC-1038",intent:"行情 / 事实查询",q:"宁德时代今天收盘价和涨跌幅是多少？",issue:"引用前一交易日收盘价，回答未标注数据时点",cause:"时效上下文缺失",risk:"P1",owner:"数据",status:"修复中",scores:[96,42,25,60,100,100],source:"线上抽样"},
 {id:"BC-1031",intent:"组合诊断",q:"组合从 100 万跌到 82 万，需要涨多少才能回本？",issue:"回答需上涨 18%，正确值应约为 21.95%",cause:"数字计算错误",risk:"P1",owner:"模型",status:"待复核",scores:[94,20,100,88,90,100],source:"金标回归"},
 {id:"BC-1026",intent:"热点解读",q:"降准对我持有的短债基金有什么影响？",issue:"大篇幅解释股票估值，未回答短债基金影响",cause:"答非所问",risk:"P2",owner:"Prompt",status:"已确认",scores:[31,90,87,80,89,100],source:"用户踩反馈"},
 {id:"BC-1019",intent:"产品比较",q:"A 与 B 基金哪个成本更低？",issue:"仅比较管理费，遗漏申赎费和销售服务费",cause:"答非所问",risk:"P2",owner:"Prompt",status:"修复中",scores:[55,82,92,71,96,100],source:"人工巡检"},
 {id:"BC-1011",intent:"热点解读",q:"刚发布的 CPI 数据是否利好债市？",issue:"使用预期值作为已公布值，来源发布时间已过期",cause:"时效上下文缺失",risk:"P1",owner:"数据",status:"待复核",scores:[78,44,21,35,100,92],source:"热点合演"}
];
const metricDefinitions=[
 {intent:"行情 / 事实",weights:"相关 15% · 数字 35% · 时效 25% · 证据 15% · 边界 10%",metric:"数值误差≤0.1%；as_of 覆盖率=100%；权威来源支持率≥95%",gate:"价格/日期错误直接失败"},
 {intent:"热点解读",weights:"相关 20% · 时效 30% · 证据 25% · 完整 15% · 边界 10%",metric:"事件召回率；来源新鲜度；事实—推断标注率；关键反例覆盖率",gate:"未发布信息冒充事实直接失败"},
 {intent:"产品比较",weights:"口径 25% · 数字 25% · 完整 20% · 证据 15% · 合规 15%",metric:"同口径字段覆盖率；费率精确匹配；重要风险漏报率",gate:"选择性遗漏重大成本/风险直接失败"},
 {intent:"个性化建议",weights:"KYC 30% · 适当 25% · 相关 15% · 风险 15% · 合规隐私 15%",metric:"KYC 字段使用正确率；风险等级匹配率；约束冲突数；承诺性用语率",gate:"KYC 缺失仍给具体买卖建议直接失败"},
 {intent:"组合诊断",weights:"计算 30% · 完整 20% · KYC 20% · 解释 15% · 边界 15%",metric:"持仓穿透正确率；归因残差；约束满足率；可执行建议覆盖率",gate:"关键计算或风险预算错误直接失败"}
];
let selectedVersion="agent-v4.8", baselineVersion="agent-v4.7", activeCase=cases[0], running=false;
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
const pct=v=>`${Number(v).toFixed(1)}%`;
function renderKpis(){
 const v=versions[selectedVersion], b=versions[baselineVersion], cards=[
  ["综合质量分",v.overall,"/ 100",`较基线 <span class="trend-up">↑ ${(v.overall-b.overall).toFixed(1)}</span>`,"◈","#0b6b52"],
  ["评测通过率",pct(v.pass),"",`较基线 <span class="trend-up">↑ ${(v.pass-b.pass).toFixed(1)}pp</span>`,"✓","#4f75c9"],
  ["P0 风险回答",v.p0," 条",v.p0===0?"连续 7 次运行为 0":"<span class='trend-down'>阻断发布</span>","!","#c94444"],
  ["待人工复核",v.review," 条",`高风险优先 · SLA 24h`,"⌁","#c68a22"]
 ];
 $("#kpiGrid").innerHTML=cards.map(c=>`<article class="kpi" style="--accent:${c[5]}"><div class="kpi-top"><span>${c[0]}</span><i class="kpi-icon">${c[4]}</i></div><div class="kpi-value">${c[1]}<small>${c[2]}</small></div><div class="kpi-foot">${c[3]}</div></article>`).join("");
}
function renderComparison(){
 const v=versions[selectedVersion],b=versions[baselineVersion];
 $("#candidateLegend").textContent=`候选 ${selectedVersion}`; $("#baselineLegend").textContent=`基线 ${baselineVersion}`;
 const delta=v.overall-b.overall; $("#deltaLabel").textContent=`综合 ${delta>=0?"+":""}${delta.toFixed(1)}`;
 $("#deltaLabel").className=delta>=0?"positive":"negative";
 $("#dimensionChart").innerHTML=dimNames.map((n,i)=>`<div class="dim-row"><span>${n}</span><div class="bars"><i class="bar candidate" style="width:${v.dims[i]}%"></i><i class="bar base" style="width:${b.dims[i]}%"></i></div><b>${v.dims[i]}</b></div>`).join("");
}
function renderIntents(){
 const vals=versions[selectedVersion].intents;
 $("#intentRows").innerHTML=intents.map((x,i)=>{const status=vals[i]>=88?"优秀":vals[i]>=84?"良好":"关注";return `<tr><td><div class="intent-cell"><span class="intent-icon">${x.icon}</span>${x.name}</div></td><td>${x.standard}</td><td>${x.n}</td><td><div class="score-cell">${vals[i]}<span class="mini-bar"><i style="width:${vals[i]}%"></i></span></div></td><td>${pct(vals[i]+4.1>99?99:vals[i]+4.1)}</td><td><span class="spark">${x.trend}</span></td><td><span class="tag ${status==="关注"?"warn":"good"}">${status}</span></td></tr>`}).join("");
}
function renderCauses(){
 $("#causeLegend").innerHTML=causes.map(c=>`<div class="cause-item"><i style="background:${c.c}"></i><span>${c.name}</span><b>${c.v}%</b></div>`).join("");
}
function renderLoop(){
 const items=[["⚙","自动评测","规则校验数字/时点，Judge 评语义；负责规模与一致性","每日 · 全量回归"],["⌘","数据合演","组合 KYC、行情突变与对抗问题；负责稀有风险覆盖","每周 · 场景扩增"],["♙","人工复核","裁决高风险、争议样本与归因；负责金标和合规兜底","SLA · 24 小时"],["↺","行为反馈","踩、追问、退出、投诉经偏差校正；负责验证真实效用","实时 · 弱标签"]];
 $("#loopGrid").innerHTML=items.map(x=>`<article class="loop-card"><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p><small>${x[3]}</small></article>`).join("");
}
function renderRuns(){
 const runs=[["RUN-2184","v4.8 / v4.7","p23","10.14 10:30","1,248","+3.8","0","已通过"],["RUN-2183","v4.8 / v4.7","p22","10.13 收盘","824","+1.2","0","已通过"],["RUN-2179","v4.7 / v4.6","p21","10.07 收盘","1,164","+2.8","2","未通过"],["RUN-2171","v4.7 / v4.6","p20","09.30 收盘","824","-0.6","0","未通过"]];
 $("#runRows").innerHTML=runs.map(r=>`<tr><td><b>${r[0]}</b><small class="sub">2026-${r[0]==="RUN-2184"?"10-14 11:06":"10-13 18:20"}</small></td><td>${r[1]}</td><td><code>${r[2]}</code></td><td>${r[3]}</td><td>${r[4]}</td><td><b class="${r[5][0]==="-"?"trend-down":"trend-up"}">${r[5]}</b></td><td>${r[6]}</td><td><span class="tag ${r[7]==="已通过"?"good":"danger"}">${r[7]}</span></td><td>•••</td></tr>`).join("");
}
function renderPipeline(){
 const items=[["01","事实与数字核验","行情源精确匹配、计算器复算，禁止 Judge 猜数字"],["02","语义质量评分","按意图 Rubric 判断切题、完整、解释和证据一致性"],["03","合规隐私门禁","承诺、诱导、越权画像和 PII 泄露命中即阻断"],["04","归因与回流","模型/Prompt/数据归因，确认后加入脱敏回归集"]];
 $("#pipelineCards").innerHTML=items.map(x=>`<article class="card pipeline-card"><span>${x[0]}</span><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join("");
}
function renderMetrics(){
 $("#metricRows").innerHTML=metricDefinitions.map(m=>`<tr><td><b>${m.intent}</b></td><td>${m.weights}</td><td>${m.metric}</td><td>${m.gate}</td></tr>`).join("");
 const items=[["相关性","关键点召回率 × 无关内容惩罚","规则 + Judge"],["数字准确","|回答值-真值| / 真值；口径与单位匹配","计算器 + 数据源"],["时效性","as_of 覆盖率；源发布时间≤TTL；过期事实率","时间规则"],["证据性","主张被引用支持比例；权威源占比；引用一致率","检索核验"],["KYC 适当","建议与期限/流动性/风险等级冲突数","规则 + 人审"],["合规隐私","禁用承诺命中、越权画像使用、PII 泄漏次数","硬规则"]];
 $("#metricList").innerHTML=items.map(x=>`<div class="metric-item"><div><b>${x[0]}</b><span>${x[2]}</span></div><p>${x[1]}</p></div>`).join("");
}
function renderBoundaries(){
 const imm=[["市场与产品事实","价格、净值、日期、费率、期限、合同条款、风险等级"],["法律与规则","监管要求、交易规则、税费口径与合规禁止项"],["数学与统计","收益、回撤、复利、概率结果及其计算口径"],["来源与不确定性","原文、发布时间、截至时间、证据强弱和“当前不知道”"],["已发生的事件","同一时点的公告、宏观数据和公司行为"]];
 const per=[["解释方式","专业术语密度、语言、篇幅、图表与例子"],["信息排序","按目标、持仓和关注点调整展示优先级"],["适当性结论","基于风险承受、期限、流动性判断是否适合"],["行动选项","在合规范围内给不同约束下的备选路径"],["风险提示强度","高风险或经验不足用户获得更显著提示"]];
 const list=(arr,ok)=>arr.map(x=>`<li><span>${ok?"✓":"="}</span><div><b>${x[0]}</b><p>${x[1]}</p></div></li>`).join("");
 $("#immutableList").innerHTML=list(imm,false); $("#personalList").innerHTML=list(per,true);
}
function filteredCases(){
 const q=$("#caseSearch").value.trim().toLowerCase(), intent=$("#intentFilter").value,risk=$("#riskFilter").value,status=$("#statusFilter").value;
 return cases.filter(c=>(!q||`${c.id}${c.q}${c.issue}${c.cause}`.toLowerCase().includes(q))&&(!intent||c.intent===intent)&&(!risk||c.risk===risk)&&(!status||c.status===status));
}
function renderCases(){
 const rows=filteredCases(); $("#caseCount").textContent=`${rows.length} 条结果`;
 $("#caseRows").innerHTML=rows.length?rows.map(c=>`<div class="case-row ${activeCase.id===c.id?"active":""}" data-id="${c.id}"><div class="case-meta"><span class="risk ${c.risk.toLowerCase()}">${c.risk}</span><b>${c.id}</b><span>${c.intent}</span><span>· ${c.source}</span></div><h3>${c.q}</h3><p>${c.issue}</p></div>`).join(""):`<div class="empty">没有符合条件的 BadCase</div>`;
 $$(".case-row").forEach(el=>el.onclick=()=>{activeCase=cases.find(c=>c.id===el.dataset.id);renderCases();renderCaseDetail()});
}
function renderCaseDetail(){
 const c=activeCase;
 $("#caseDetail").innerHTML=`<div class="case-detail-head"><div><p>${c.id} · ${c.intent} · 来源 ${c.source}</p><h2>回答质量复核</h2></div><span class="tag ${c.status==="待复核"?"warn":"good"}">${c.status}</span></div><div class="detail-body"><div class="detail-block"><label>用户问题</label><div class="question-box">${c.q}</div></div><div class="detail-block"><label>Agent 回答节选</label><div class="answer-box">${caseAnswer(c)}</div></div><div class="detail-block"><label>自动归因</label><div class="cause-box"><div><b>${c.cause}</b><small>${c.issue}</small></div><span class="confidence">置信度 92%</span></div></div><div class="detail-block"><label>维度得分</label><div class="score-radar">${dimNames.map((n,i)=>`<div class="score-chip"><span>${n}</span><b class="${c.scores[i]<60?"trend-down":""}">${c.scores[i]}</b></div>`).join("")}</div></div><div class="detail-block"><label>人工复核意见</label><textarea class="review-note" placeholder="补充判断依据或修复建议…"></textarea></div><div class="detail-actions"><button class="btn ghost" id="rejectCause">驳回归因</button><button class="btn primary" id="confirmReview">确认并加入回归集</button></div></div>`;
 $("#confirmReview").onclick=()=>reviewCase(true); $("#rejectCause").onclick=()=>reviewCase(false);
}
function caseAnswer(c){
 const answers={
  "BC-1042":"高股息 ETF 波动相对较低，<mark>可以考虑将约 80% 的资金配置其中</mark>，以获取稳定分红……",
  "BC-1038":"宁德时代今日收盘价为 <mark>¥312.40，涨幅 1.2%</mark>。（未提供数据截至时间）",
  "BC-1031":"组合亏损 18 万，因此从 82 万回到 100 万，<mark>需要上涨 18%</mark>。",
  "BC-1026":"降准通常提升市场流动性，股票估值可能受益，成长股对利率变化更敏感……<mark>（未回答短债基金）</mark>",
  "BC-1019":"A 基金管理费 0.5%，B 基金管理费 0.8%，因此 A 成本更低。<mark>（遗漏申购费、赎回费与销售服务费）</mark>",
  "BC-1011":"本月 CPI <mark>同比上涨 1.1%</mark>，低于预期，通常利好债市。（实际引用的是发布前预测值）"
 }; return answers[c.id];
}
function reviewCase(confirm){
 if(confirm){activeCase.status="已确认";showToast("已确认归因，脱敏后加入回归集 rubric-v12")}else{activeCase.status="待复核";showToast("已驳回自动归因，转交二线专家复核")}
 renderCases();renderCaseDetail();
}
function showToast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove("show"),2600)}
function showPage(id){
 $$(".page").forEach(x=>x.classList.toggle("active",x.id===id)); $$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
 const labels={overview:["质量总览","持续监测投资 Agent 的准确、适当与可信"],evaluation:["评测任务","比较版本变化，守住发布质量门禁"],badcases:["BadCase 归因","定位失败原因并沉淀可回归的修复样本"],standards:["标准与指标","按问答意图定义可计算、可审计的质量标准"],guardrails:["边界控制","KYC、热点上下文、合规与隐私的不可逾越边界"]};
 $("#pageTitle").textContent=labels[id][0];$("#pageSubtitle").textContent=labels[id][1];window.scrollTo({top:0,behavior:"smooth"});
}
function openRun(){
 if(running)return;running=true;const modal=$("#runModal"),state=$("#runState");modal.classList.add("open");modal.setAttribute("aria-hidden","false");
 state.innerHTML=`<div class="run-state"><div class="run-spinner"></div><h2>正在运行对比评测</h2><p>${selectedVersion} vs ${baselineVersion} · 规则、事实核验与语义评分并行</p><div class="progress"><i id="progressBar"></i></div><div class="progress-info"><span id="progressText">初始化数据快照…</span><b id="progressCount">0 / 1,248</b></div></div>`;
 let value=0;const steps=[[18,"校验 KYC 与隐私授权"],[42,"核验数字、日期与引用"],[67,"按意图执行语义评分"],[86,"聚类 BadCase 并生成归因"],[100,"计算版本差异与发布门禁"]];let i=0;
 const timer=setInterval(()=>{const [target,label]=steps[i];value=target;$("#progressBar").style.width=`${value}%`;$("#progressText").textContent=label;$("#progressCount").textContent=`${Math.round(1248*value/100).toLocaleString()} / 1,248`;i++;if(i===steps.length){clearInterval(timer);setTimeout(showRunSuccess,450)}},520);
}
function showRunSuccess(){
 const state=$("#runState"),v=versions[selectedVersion],b=versions[baselineVersion],d=(v.overall-b.overall).toFixed(1);running=false;
 state.innerHTML=`<div class="run-state"><div class="run-success">✓</div><h2>评测完成，候选通过门禁</h2><p>RUN-2185 已保存完整版本与证据快照</p><div class="result-pills"><span>综合 <b>${v.overall}</b></span><span>变化 <b class="trend-up">+${d}</b></span><span>P0 <b>${v.p0}</b></span><span>新增 BadCase <b>12</b></span></div><button class="btn primary" id="viewResult">查看评测结果</button></div>`;
 $("#viewResult").onclick=()=>{$("#runModal").classList.remove("open");showPage("overview");showToast("结果已更新至质量总览")};
}
function exportReport(){
 const report={exported_at:new Date().toISOString(),candidate:{name:selectedVersion,...versions[selectedVersion]},baseline:{name:baselineVersion,...versions[baselineVersion]},rubric_version:"rubric-v12",policy_version:"policy-v9",kyc_schema_version:"kyc-v6",suitability_policy_version:"suitability-v7",dataset_size:1416,profile_metrics:{usable_rate:93.8,distortion_rate:1.6,evidence_coverage:96.4,counterfactual_fact_consistency:100,unresolved_conflicts:17},profile_samples:profileSamples,immutable_principle:"画像可改变表达与适当性，不可改变市场、产品、法律、数学、来源和已发生事件等事实",badcases:cases};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`investguard-${selectedVersion}-report.json`;a.click();URL.revokeObjectURL(url);showToast("评测报告已导出（含画像质量与版本快照）")
}
function showSnapshot(){
 const modal=$("#runModal");modal.classList.add("open");modal.setAttribute("aria-hidden","false");
 $("#runState").innerHTML=`<div class="snapshot"><h2>线上回答上下文快照</h2><p>回答事实以快照时间为准；超过 TTL 后必须重新取数，不允许画像覆盖。</p><dl><div><dt>模型</dt><dd>${selectedVersion}</dd></div><div><dt>Prompt</dt><dd>${versions[selectedVersion].prompt}</dd></div><div><dt>市场数据</dt><dd>${versions[selectedVersion].data} 10:30 CST</dd></div><div><dt>KYC Schema</dt><dd>kyc-v6 · 字段级授权</dd></div><div><dt>合规策略</dt><dd>policy-v9 · P0 硬阻断</dd></div><div><dt>证据策略</dt><dd>权威源优先 · 动态 TTL</dd></div></dl></div>`;
}
function init(){
 renderKpis();renderComparison();renderIntents();renderCauses();renderLoop();renderRuns();renderPipeline();renderMetrics();renderBoundaries();renderCases();renderCaseDetail();
 $$(".nav-item").forEach(b=>b.onclick=()=>showPage(b.dataset.page)); $$('[data-jump]').forEach(b=>b.onclick=()=>showPage(b.dataset.jump));
 $$(".segmented button").forEach(b=>b.onclick=()=>{$$(".segmented button").forEach(x=>x.classList.remove("active"));b.classList.add("active");showToast(`已切换至近 ${b.dataset.range} 次运行`)});
 ["caseSearch","intentFilter","riskFilter","statusFilter"].forEach(id=>$("#"+id).addEventListener(id==="caseSearch"?"input":"change",renderCases));
 $("#candidateSelect").onchange=e=>{selectedVersion=e.target.value;renderKpis();renderComparison();renderIntents()};
 $("#baselineSelect").onchange=e=>{baselineVersion=e.target.value;renderKpis();renderComparison()};
 $("#runBtn").onclick=openRun;$("#runEvalBtn").onclick=openRun;$("#exportBtn").onclick=exportReport;$("#snapshotBtn").onclick=showSnapshot;
 $(".modal-close").onclick=()=>{$("#runModal").classList.remove("open")};$("#runModal").onclick=e=>{if(e.target.id==="runModal")e.currentTarget.classList.remove("open")};
 document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#runModal").classList.remove("open")});
}
init();

/* PRD v0.2 — 画像质量中心与个性化失真评测 */
const profileSamples={
 "P-0248":{level:"L2",label:"适当性画像",score:87,status:"受限可用",cap:"风险上限 2",summary:"半年后购房首付，流动性要求高；风险意愿高于实际损失能力。",fields:[
  ["投资目标","购房首付 · 必须实现","A","本次声明","有效"],["投资期限","6 个月","A","本次声明","有效"],["流动性需求","高 · 需 T+1 变现","A","本次声明","有效"],["风险意愿","R4 · 可接受较大波动","B","历史问卷","有效"],["损失能力","C2 · 不影响近期支出","A","本次确认","有效"],["当前持仓","未提供完整持仓","X","—","缺失"]
 ]},
 "P-0317":{level:"L1",label:"基础画像",score:58,status:"需补充",cap:"禁止具体建议",summary:"仅有长期增值目标和基础风险意愿，缺少期限、流动性与损失能力。",fields:[
  ["投资目标","长期增值","B","历史声明","有效"],["投资期限","未确认","X","—","缺失"],["流动性需求","未确认","X","—","缺失"],["风险意愿","R3 · 中等波动","B","历史问卷","临期"],["损失能力","未确认","X","—","缺失"],["投资经验","E2 · 基金/ETF","C","行为派生","辅助"]
 ]},
 "P-0196":{level:"L3",label:"组合级画像",score:96,status:"可用",cap:"风险上限 3",summary:"长期养老目标，持仓、现金流和产品限制完整，可进行组合诊断。",fields:[
  ["投资目标","10 年以上养老增值","A","本次确认","有效"],["投资期限","10 年以上","A","本次确认","有效"],["流动性需求","低 · 备用金充足","A","业务验证","有效"],["风险意愿","R3 · 中等波动","A","最新问卷","有效"],["损失能力","C4 · 可承担阶段损失","A","业务验证","有效"],["当前持仓","完整 · 截至 10:30","A","持仓系统","有效"]
 ]}
};
function augmentProduct(){
 const nav=$("#sideNav"),standardsNav=$('[data-page="standards"]'),guardNav=$('[data-page="guardrails"]');
 guardNav.remove();standardsNav.innerHTML='<span>▤</span>治理中心';
 $('[data-page="overview"]').innerHTML='<span>⌂</span>总览';
 const evalNav=$('[data-page="evaluation"]');evalNav.innerHTML='<span>◎</span>评测中心';
 const badNav=$('[data-page="badcases"]');badNav.innerHTML='<span>◇</span>问题闭环<i id="badcaseBadge">12</i>';
 const profilePage=document.createElement("section");profilePage.className="page";profilePage.id="profiles";profilePage.innerHTML=profilePageShell();$("#standards").before(profilePage);
 const overviewAnchor=$(".grid.two-thirds");overviewAnchor.insertAdjacentHTML("afterend",profileOverviewCard());
 const context=$(".context-strip div");context.insertAdjacentHTML("beforeend",'<span class="context-pill">KYC kyc-v6</span><span>适当性 suitability-v7</span>');
 const evalForm=$(".form-grid"),sets=evalForm.querySelector("label.full");
 sets.insertAdjacentHTML("beforebegin",'<label>KYC Schema<select><option>kyc-v6 · L0—L3 分层</option><option>kyc-v5 · 线上基线</option></select></label><label>适当性策略<select><option>suitability-v7 · 双风险约束</option><option>suitability-v6 · 基线</option></select></label>');
 sets.insertAdjacentHTML("afterend",'<label class="full">画像场景集<div class="check-row profile-checks"><button class="check active">✓ 画像缺失 <b>56</b></button><button class="check active">✓ 冲突 / 过期 <b>64</b></button><button class="check active">✓ 反事实一致性 <b>48</b></button></div></label>');
 const gateList=$(".gate-card ul");gateList.insertAdjacentHTML("beforeend",'<li><span>重大建议约束冲突</span><b>= 0</b></li><li><span>个性化事实一致率</span><b>= 100%</b></li>');
 $("#evaluation").insertAdjacentHTML("afterbegin",'<div class="workflow-strip"><b>评测主链路</b><span class="done">1 配置版本与场景</span><i>→</i><span>2 自动评测</span><i>→</i><span>3 对比与门禁</span><i>→</i><span>4 生成问题单</span></div>');
 $("#badcases").insertAdjacentHTML("afterbegin",'<div class="workflow-strip"><b>问题闭环</b><span class="done">1 发现</span><i>→</i><span class="done">2 自动归因</span><i>→</i><span>3 人工复核</span><i>→</i><span>4 修复回归</span></div>');
 enhanceRunTable();enhanceStandards();renderProfile("P-0248");
 const tabs='<div class="governance-tabs"><button data-governance="standards">质量标准</button><button data-governance="profiles">画像与适当性 <i>17</i></button><button data-governance="guardrails">合规、隐私与事实边界</button></div>';
 ["standards","profiles","guardrails"].forEach(id=>$("#"+id).insertAdjacentHTML("afterbegin",tabs));
 function openGovernance(id){
  if(id==="profiles")showProfilePage();else showPage(id);
  standardsNav.classList.add("active");
  $("#pageTitle").textContent="治理中心";
  const sub={standards:"统一管理意图指标、画像标准和发布门禁",profiles:"管理画像可信度，检测个性化失真与事实漂移",guardrails:"管理热点时效、合规隐私与不可变事实边界"};$("#pageSubtitle").textContent=sub[id];
  $$(".governance-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.governance===id));
 }
 $$(".governance-tabs button").forEach(b=>b.onclick=()=>openGovernance(b.dataset.governance));
 standardsNav.onclick=()=>openGovernance("standards");$("#profileOverviewJump").onclick=()=>openGovernance("profiles");
 evalNav.onclick=()=>{showPage("evaluation");$("#pageTitle").textContent="评测中心";$("#pageSubtitle").textContent="从版本配置到质量门禁，一处完成对比评测"};
 badNav.onclick=()=>{showPage("badcases");$("#pageTitle").textContent="问题闭环";$("#pageSubtitle").textContent="集中处理发现、归因、复核与回归"};
}
function profileOverviewCard(){return `<article class="card profile-overview"><div class="card-head"><div><h2>画像与个性化质量</h2><p>画像有来源、有授权、有时效；事实不因画像改变</p></div><button class="text-btn" id="profileOverviewJump">进入画像质量中心 →</button></div><div class="profile-mini-grid"><div><span>可用画像率</span><b>93.8%</b><small class="trend-up">↑ 2.4pp</small></div><div><span>个性化依据覆盖</span><b>96.4%</b><small>目标 ≥ 95%</small></div><div><span>待解决画像冲突</span><b>17</b><small class="trend-down">其中 P1 3 条</small></div><div><span>事实反事实一致率</span><b>100%</b><small class="trend-up">通过硬门槛</small></div><div class="profile-rule"><strong>准入规则</strong><code>授权 × 完整 × 新鲜 × 无冲突 × 约束满足</code></div></div></article>`}
function profilePageShell(){return `<div class="profile-banner"><div><span>画像治理 · kyc-v6</span><h2>画像可解释，建议有依据，事实始终一致</h2><p>结构化管理画像可信度、完整度和授权范围，在回答生成前完成个性化准入。</p></div><div class="level-scale"><b>L0<small>无画像</small></b><i></i><b>L1<small>基础</small></b><i></i><b class="active">L2<small>适当性</small></b><i></i><b>L3<small>组合级</small></b></div></div><div class="profile-kpis"><article><span>可用画像率</span><b>93.8%</b><small>1,171 / 1,248</small></article><article><span>个性化失真率</span><b>1.6%</b><small class="trend-up">↓ 0.8pp</small></article><article><span>待解决冲突</span><b>17</b><small>3 条阻断发布</small></article><article><span>无依据推断率</span><b>0.7%</b><small>目标 ≤ 1%</small></article></div><div class="grid profile-main"><article class="card profile-record"><div class="card-head"><div><h2>画像准入检查</h2><p>脱敏样本 · 字段级来源与有效期</p></div><select id="profileSelect"><option value="P-0248">P-0248 · 受限可用</option><option value="P-0317">P-0317 · 需补充</option><option value="P-0196">P-0196 · 可用</option></select></div><div id="profileRecord"></div></article><article class="card admission-card" id="admissionCard"></article></div><article class="card counterfactual-card"><div class="card-head"><div><h2>反事实个性化测试</h2><p>同一问题切换画像：事实必须一致，建议差异必须可解释</p></div><button class="btn primary" id="counterfactualBtn">运行反事实测试</button></div><div class="test-question"><span>测试问题</span><b>“我能把这笔钱全部买高股息 ETF 吗？”</b></div><div class="scenario-grid" id="scenarioGrid"></div><div class="fact-lock"><span>事实锁</span><div><b>高股息 ETF 仍存在价格波动</b><small>产品事实 · 四组画像完全一致</small></div><div><b>示例产品管理费 0.50%</b><small>费率事实 · 四组画像完全一致</small></div><strong>一致率 100% ✓</strong></div></article><div class="grid two profile-bottom"><article class="card"><div class="card-head"><div><h2>个性化依据链</h2><p>每个建议必须回溯到有效字段</p></div><span class="tag good">覆盖率 96.4%</span></div><div class="evidence-map"><div class="conclusion"><small>建议结论</small><b>不建议全仓配置高股息 ETF</b></div><i>←</i><div class="evidence-fields"><span>投资期限 = 6个月 <em>A</em></span><span>流动性 = 高 <em>A</em></span><span>损失能力 = C2 <em>A</em></span></div></div></article><article class="card trust-card"><div class="card-head"><div><h2>数据可信等级</h2><p>低等级数据不能覆盖高等级声明</p></div></div><div><span><b>A</b>本次确认 / 业务验证</span><span><b>B</b>有效历史声明</span><span><b>C</b>可解释派生特征</span><span><b>D</b>行为弱信号，仅用于表达</span><span><b class="x">X</b>缺失 / 过期 / 未授权，禁用</span></div></article></div>`}
function renderProfile(id){
 const p=profileSamples[id],record=$("#profileRecord"),admission=$("#admissionCard");
 record.innerHTML=`<div class="profile-identity"><div><span class="avatar">${id.slice(-2)}</span><div><b>脱敏用户 ${id}</b><small>${p.summary}</small></div></div><span class="level-tag">${p.level} · ${p.label}</span></div><div class="profile-score"><div><span>画像质量分</span><b>${p.score}</b></div><div><span>准入状态</span><b>${p.status}</b></div><div><span>适当性约束</span><b>${p.cap}</b></div></div><div class="profile-field-table"><div class="field-head"><span>字段</span><span>当前值</span><span>可信</span><span>来源</span><span>状态</span></div>${p.fields.map(f=>`<div><b>${f[0]}</b><span>${f[1]}</span><em class="trust-${f[2].toLowerCase()}">${f[2]}</em><span>${f[3]}</span><i class="field-${f[4]==="有效"?"ok":f[4]==="缺失"?"bad":"warn"}">${f[4]}</i></div>`).join("")}</div>`;
 const isBlocked=p.level==="L1";admission.innerHTML=`<div class="card-head"><div><h2>个性化准入门</h2><p>生成前按顺序校验，失败即降级</p></div><span class="admission-status ${isBlocked?"blocked":""}">${isBlocked?"需澄清":"受限通过"}</span></div><div class="admission-steps"><div class="pass"><span>✓</span><b>用户已授权</b><small>suitability_assessment</small></div><div class="pass"><span>✓</span><b>当前意图需要画像</b><small>个性化投资建议</small></div><div class="${isBlocked?"fail":"pass"}"><span>${isBlocked?"!":"✓"}</span><b>完整度达到 L2</b><small>${isBlocked?"缺期限、流动性、损失能力":"6 / 7 必要字段有效"}</small></div><div class="${id==="P-0248"?"notice":"pass"}"><span>${id==="P-0248"?"!":"✓"}</span><b>冲突已处理</b><small>${id==="P-0248"?"R4 意愿与 C2 能力冲突，取较低上限":"未发现未解决冲突"}</small></div><div class="${isBlocked?"muted":"pass"}"><span>${isBlocked?"—":"✓"}</span><b>建议满足硬约束</b><small>${isBlocked?"等待补充后检查":"期限、流动性、风险均满足"}</small></div></div><div class="admission-result ${isBlocked?"blocked":""}"><b>${isBlocked?"降级：仅提供通用教育并询问补充信息":"允许：可生成有依据的个性化建议"}</b><small>${isBlocked?"禁止具体配置比例和买卖建议":`强制附带依据 · ${p.cap}`}</small></div>`;
 renderScenarios();$("#profileSelect").value=id;$("#profileSelect").onchange=e=>renderProfile(e.target.value);$("#counterfactualBtn").onclick=runCounterfactual;
}
function renderScenarios(){const data=[["A","6个月 · C2","不建议全仓；先确认资金使用与备用金","受限建议"],["B","10年以上 · C4","可讨论长期配置，但仍需分散风险","允许讨论"],["C","画像未提供","先询问期限、流动性和最大可承受损失","正确澄清"],["D","历史/本次冲突","展示冲突，暂停给出具体比例","阻断建议"]];$("#scenarioGrid").innerHTML=data.map(x=>`<div class="scenario"><span>画像 ${x[0]}</span><b>${x[1]}</b><p>${x[2]}</p><small>${x[3]}</small></div>`).join("")}
function runCounterfactual(){const btn=$("#counterfactualBtn");btn.disabled=true;btn.textContent="测试中…";$$('.scenario').forEach((x,i)=>setTimeout(()=>x.classList.add("tested"),180*(i+1)));setTimeout(()=>{btn.disabled=false;btn.textContent="重新运行";showToast("反事实测试通过：事实一致率 100%，建议差异均有画像依据")},1100)}
function showProfilePage(){$$(".page").forEach(x=>x.classList.toggle("active",x.id==="profiles"));$$(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page==="profiles"));$("#pageTitle").textContent="画像质量";$("#pageSubtitle").textContent="管理画像可信度，检测个性化失真与事实漂移";window.scrollTo({top:0,behavior:"smooth"})}
function enhanceRunTable(){const row=$("#runRows").closest("table").querySelector("thead tr");row.children[3].insertAdjacentHTML("beforebegin","<th>KYC / 策略</th>");$$("#runRows tr").forEach((tr,i)=>tr.children[3].insertAdjacentHTML("beforebegin",`<td><code>${i<2?"k6 / s7":"k5 / s6"}</code></td>`))}
function enhanceStandards(){const matrix=$(".matrix-card");matrix.insertAdjacentHTML("beforebegin",'<article class="card profile-metrics"><div class="card-head"><div><h2>画像与个性化指标</h2><p>画像质量决定是否准入，用户行为不能覆盖事实与适当性</p></div><button class="text-btn" id="metricProfileJump">查看画像样本 →</button></div><div class="profile-metric-row"><span><b>KYC 完整率</b><small>有效必要字段 / 当前意图必要字段</small></span><span><b>依据覆盖率</b><small>有 KYC 依据结论 / 个性化结论</small></span><span><b>约束冲突率</b><small>违反期限/流动性/风险的建议占比</small></span><span><b>事实一致率</b><small>跨画像保持一致的客观事实占比</small></span></div></article>');$("#metricProfileJump").onclick=showProfilePage}
augmentProduct();
