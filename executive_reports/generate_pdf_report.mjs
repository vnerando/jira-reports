/**
 * generate_pdf_report.mjs
 * Gera um PDF Executivo profissional com capa + página de dados,
 * mesclado ao timbrado.pdf (cabeçalho e rodapé visíveis).
 * Uso: node executive_reports/generate_pdf_report.mjs
 * Variáveis de ambiente: START_DATE, END_DATE, REPORT_LABEL
 */

import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const { START_DATE, END_DATE, REPORT_LABEL = 'Relatorio' } = process.env;

if (!START_DATE || !END_DATE) {
    console.error('❌ Variáveis START_DATE e END_DATE são obrigatórias.');
    process.exit(1);
}

const fmtDate = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const periodoLabel = `${fmtDate(START_DATE)} a ${fmtDate(END_DATE)}`;
const tituloLabel  = REPORT_LABEL.replace(/_/g, ' ');
const geradoEm     = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

// ─── 1. Pipeline de dados ────────────────────────────────────────────────────
console.log(`-> Coletando dados de ${START_DATE} a ${END_DATE}...`);
const dataJson = await new Promise((resolve, reject) => {
    exec(
        `node --env-file=credentials/.env issue_separator.mjs && node --env-file=credentials/.env analytical_report_generator.mjs`,
        { env: { ...process.env, START_DATE, END_DATE, REPORT_LABEL }, timeout: 120000, cwd: process.cwd() },
        (err, stdout) => {
            if (err) return reject(new Error(err.message));
            const match = stdout.match(/###DATA###(.*)###DATA###/);
            if (!match) return reject(new Error('Dados não encontrados no stdout.'));
            resolve(JSON.parse(match[1]));
        }
    );
});
console.log('✅ Dados coletados.');

// ─── 2. Prepara métricas ─────────────────────────────────────────────────────
const d = dataJson;
const total       = d.totalIssues || 0;
const resolved    = d.resolved || 0;
const frMet       = d.slaSummary?.frMet || 0;
const frBreached  = d.slaSummary?.frBreached || 0;
const resMet      = d.slaSummary?.resMet || 0;
const resBreached = d.slaSummary?.resBreached || 0;
const frPct  = (frMet + frBreached)  > 0 ? Math.round(frMet  / (frMet  + frBreached)  * 100) : 0;
const resPct = (resMet + resBreached) > 0 ? Math.round(resMet / (resMet + resBreached) * 100) : 0;
const avgPct = Math.round((frPct + resPct) / 2);
const slaColor = avgPct >= 85 ? '#16a34a' : avgPct >= 70 ? '#d97706' : '#dc2626';
const slaLabel = avgPct >= 85 ? '🟢 ÓTIMO' : avgPct >= 70 ? '🟡 ATENÇÃO' : '🔴 CRÍTICO';
const slaDesc  = avgPct >= 85 ? 'Dentro da meta' : avgPct >= 70 ? 'Abaixo da meta' : 'Requer intervenção';

const topOffenders = (d.topOffenders || []).slice(0, 5);
const topIncidents = (d.topIncidents || []).slice(0, 5);
const timeline     = d.timeline || {};
const volLabels    = Object.keys(d.volumeByType || {}).map(k => k.replace('[System] ', ''));
const volData      = Object.values(d.volumeByType || {});
const mttrTypes    = ['Incidente', 'Mudança', 'Problema'];
const mttrResp     = [timeline.incident?.mttrResponse||0, timeline.change?.mttrResponse||0, timeline.problem?.mttrResponse||0].map(v => +v.toFixed(1));
const mttrRepair   = [timeline.incident?.mttrRepair||0,   timeline.change?.mttrRepair||0,   timeline.problem?.mttrRepair||0].map(v => +v.toFixed(1));
const mttrWaiting  = [timeline.incident?.mttrWaiting||0,  timeline.change?.mttrWaiting||0,  timeline.problem?.mttrWaiting||0].map(v => +v.toFixed(1));

// ─── 3. HTML do relatório ────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Executivo — ${tituloLabel}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:transparent; color:#1e293b; font-size:12px; }

  /* ── CAPA (Página 1) ── */
  .cover {
    width:100%; height:100vh; display:flex; flex-direction:column;
    justify-content:flex-end; padding:60px 60px 80px;
    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4f46e5 100%);
    page-break-after: always;
  }
  .cover-tag   { color:#a5b4fc; font-size:10px; letter-spacing:3px; text-transform:uppercase; margin-bottom:12px; }
  .cover-title { color:#fff; font-size:40px; font-weight:800; line-height:1.15; margin-bottom:10px; }
  .cover-sub   { color:#c7d2fe; font-size:16px; margin-bottom:40px; }
  .cover-div   { width:60px; height:4px; background:#818cf8; border-radius:2px; margin-bottom:32px; }
  .cover-meta  { display:flex; gap:40px; }
  .cover-meta label { color:#818cf8; font-size:9px; letter-spacing:2px; text-transform:uppercase; display:block; margin-bottom:4px; }
  .cover-meta span  { color:#e0e7ff; font-size:14px; font-weight:600; }

  /*
   * ── PÁGINA DE DADOS (Página 2) ──
   *
   * O timbrado.pdf tem:
   *   - Cabeçalho (logo CEDNET + linha azul): ~110px do topo
   *   - Rodapé (faixa azul + contatos):      ~90px do fundo
   *   - Margens laterais:                     ~40px
   *
   * padding: top right bottom left
   */
  .data-page {
    padding: 118px 44px 98px 44px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 13px;
  }

  .page-title    { font-size:9px; font-weight:800; color:#1e40af; letter-spacing:2.5px; text-transform:uppercase; }
  .page-subtitle { font-size:8px; color:#64748b; margin-top:2px; }

  .section-label {
    font-size:8px; font-weight:700; color:#6366f1; letter-spacing:2px; text-transform:uppercase;
    border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:8px;
  }

  /* KPIs */
  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
  .kpi  { background:rgba(255,255,255,0.88); border-radius:8px; padding:10px 14px; border:1px solid #e2e8f0; }
  .kpi label { font-size:8px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; display:block; margin-bottom:4px; }
  .kpi span  { font-size:22px; font-weight:800; color:#1e293b; }

  /* Farol SLA */
  .sla-card   { border-radius:10px; padding:14px 20px; border:2px solid; display:flex; align-items:center; justify-content:space-between; }
  .sla-status { font-size:20px; font-weight:900; }
  .sla-desc   { font-size:10px; opacity:.8; margin-top:2px; }
  .sla-badges { display:flex; gap:12px; }
  .sla-badge  { background:rgba(255,255,255,0.35); border-radius:8px; padding:8px 16px; text-align:center; }
  .sla-badge label { font-size:8px; text-transform:uppercase; letter-spacing:1px; display:block; opacity:.8; }
  .sla-badge span  { font-size:18px; font-weight:800; }

  /* Gráficos */
  .charts    { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .chart-box { background:rgba(255,255,255,0.88); border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
  .chart-box h4 { font-size:9px; font-weight:700; color:#475569; margin-bottom:8px; }
  .chart-box canvas { max-height:140px; }

  /* Tabelas */
  .tables    { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .table-box { background:rgba(255,255,255,0.88); border:1px solid #e2e8f0; border-radius:8px; padding:12px; }
  .table-box h4  { font-size:9px; font-weight:700; color:#475569; margin-bottom:8px; }
  .table-row     { display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #f1f5f9; font-size:10px; }
  .table-row:last-child { border-bottom:none; }
  .lbl    { color:#475569; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:190px; }
  .badge  { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; }
  .b-red  { background:#fee2e2; color:#dc2626; }
  .b-ind  { background:#e0e7ff; color:#4338ca; }
</style>
</head>
<body>

<!-- CAPA -->
<div class="cover">
  <div class="cover-tag">NOC - Grupo Cednet · Jira Service Management</div>
  <div class="cover-title">Relatório Executivo</div>
  <div class="cover-sub">${tituloLabel}</div>
  <div class="cover-div"></div>
  <div class="cover-meta">
    <div><label>Período</label><span>${periodoLabel}</span></div>
    <div><label>Gerado em</label><span>${geradoEm}</span></div>
    <div><label>Total de Chamados</label><span>${total}</span></div>
  </div>
</div>

<!-- DADOS — respeitando cabeçalho e rodapé do timbrado -->
<div class="data-page">

  <div>
    <div class="page-title">Indicadores do Período</div>
    <div class="page-subtitle">${tituloLabel} &nbsp;·&nbsp; ${periodoLabel}</div>
  </div>

  <!-- KPIs -->
  <div>
    <div class="section-label">Resumo Geral</div>
    <div class="kpis">
      <div class="kpi"><label>Total de Chamados</label><span>${total}</span></div>
      <div class="kpi"><label>Resolvidos</label><span>${resolved}</span></div>
      <div class="kpi"><label>SLA 1ª Resp.</label><span>${frPct}%</span></div>
      <div class="kpi"><label>SLA Resolução</label><span>${resPct}%</span></div>
    </div>
  </div>

  <!-- Farol SLA -->
  <div>
    <div class="section-label">Status Geral de SLA</div>
    <div class="sla-card" style="background:${slaColor}15; border-color:${slaColor}; color:${slaColor};">
      <div>
        <div class="sla-status">${slaLabel}</div>
        <div class="sla-desc">${slaDesc} &nbsp;·&nbsp; SLA Médio: ${avgPct}%</div>
      </div>
      <div class="sla-badges">
        <div class="sla-badge"><label>1ª Resposta</label><span>${frPct}%</span></div>
        <div class="sla-badge"><label>Resolução</label><span>${resPct}%</span></div>
      </div>
    </div>
  </div>

  <!-- Gráficos -->
  <div>
    <div class="section-label">Análise de Volume e MTTR</div>
    <div class="charts">
      <div class="chart-box"><h4>Volume por Categoria</h4><canvas id="volChart"></canvas></div>
      <div class="chart-box"><h4>MTTR — Ciclo de Vida por Tipo (h)</h4><canvas id="mttrChart"></canvas></div>
    </div>
  </div>

  <!-- Tabelas -->
  <div>
    <div class="section-label">Principais Ocorrências</div>
    <div class="tables">
      <div class="table-box">
        <h4>Top Ofensores de SLA</h4>
        ${topOffenders.map(([lbl,cnt]) => `<div class="table-row"><span class="lbl">⚠️ ${lbl}</span><span class="badge b-red">${cnt}</span></div>`).join('') || '<p style="color:#94a3b8;font-size:10px">Sem ofensores</p>'}
      </div>
      <div class="table-box">
        <h4>Top Incidentes</h4>
        ${topIncidents.map(([lbl,cnt]) => `<div class="table-row"><span class="lbl">🔔 ${lbl}</span><span class="badge b-ind">${cnt}</span></div>`).join('') || '<p style="color:#94a3b8;font-size:10px">Sem incidentes</p>'}
      </div>
    </div>
  </div>

</div>

<script>
new Chart(document.getElementById('volChart'), {
  type:'bar',
  data:{ labels:${JSON.stringify(volLabels)}, datasets:[{ label:'Chamados', data:${JSON.stringify(volData)}, backgroundColor:['#6366f1','#22c55e','#8b5cf6','#f59e0b','#ef4444'], borderRadius:4 }] },
  options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,grid:{color:'#f1f5f9'}},x:{grid:{display:false}}} }
});
new Chart(document.getElementById('mttrChart'), {
  type:'bar',
  data:{ labels:${JSON.stringify(mttrTypes)}, datasets:[
    {label:'Triage/Resposta', data:${JSON.stringify(mttrResp)},   backgroundColor:'#6366f1', borderRadius:3},
    {label:'Reparo',          data:${JSON.stringify(mttrRepair)},  backgroundColor:'#22c55e', borderRadius:3},
    {label:'Espera',          data:${JSON.stringify(mttrWaiting)}, backgroundColor:'#8b5cf6', borderRadius:3},
  ]},
  options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
    scales:{x:{stacked:true,grid:{color:'#f1f5f9'}},y:{stacked:true,grid:{display:false}}},
    plugins:{legend:{position:'bottom',labels:{font:{size:8},padding:6}}} }
});
</script>
</body>
</html>`;

// ─── 4. Puppeteer: HTML → PDF ────────────────────────────────────────────────
console.log('-> Renderizando HTML com Puppeteer...');
const tmpHtml = path.join(process.cwd(), 'executive_reports', '_tmp_report.html');
fs.writeFileSync(tmpHtml, html, 'utf8');

const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page    = await browser.newPage();
await page.goto(`file://${tmpHtml}`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500));

const reportBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    omitBackground: true,  // fundo transparente → timbrado aparece por baixo
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
});
await browser.close();
fs.unlinkSync(tmpHtml);

// ─── 5. Mescla com timbrado.pdf ──────────────────────────────────────────────
console.log('-> Mesclando com timbrado.pdf...');
const templatePath = path.join(process.cwd(), 'timbrado.pdf');
if (!fs.existsSync(templatePath)) throw new Error('timbrado.pdf não encontrado na raiz.');

const templateBytes = fs.readFileSync(templatePath);
const reportDoc     = await PDFDocument.load(reportBuffer);
const templateDoc   = await PDFDocument.load(templateBytes);
const finalDoc      = await PDFDocument.create();
const numPages      = reportDoc.getPageCount();

for (let i = 0; i < numPages; i++) {
    const [tplPage] = await finalDoc.copyPages(templateDoc, [0]);
    finalDoc.addPage(tplPage);
    const addedPage = finalDoc.getPages()[i];
    const { width, height } = addedPage.getSize();
    const [embeddedPage] = await finalDoc.embedPdf(reportBuffer, [i]);
    addedPage.drawPage(embeddedPage, { x: 0, y: 0, width, height });
}

const timestamp  = Date.now();
const outputPath = path.join(process.cwd(), 'executive_reports', `Relatorio_Executivo_Premium_${timestamp}.pdf`);
fs.writeFileSync(outputPath, await finalDoc.save());

console.log(`\n✅ PDF Gerado: ${outputPath}`);
process.stdout.write(`###PDF###${outputPath}###PDF###`);
