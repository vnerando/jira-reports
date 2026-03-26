// Execute com: node executive_report_generator.mjs

import fs from 'fs';
import path from 'path';

const { MONTH_OFFSET = "1" } = process.env;
const offset = parseInt(MONTH_OFFSET);

const dataRelatorio = new Date();
dataRelatorio.setMonth(dataRelatorio.getMonth() - offset);
const mesRefStr = dataRelatorio.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
const tituloMes = mesRefStr.charAt(0).toUpperCase() + mesRefStr.slice(1);
const suffix = tituloMes.replace(/ /g, '_').replace(/de_/g, '');

const outputDir = path.join(process.cwd(), 'issues_by_type');
const reportPath = path.join(process.cwd(), 'executive_reports', `Relatorio_Executivo_${suffix}.md`);
const outputCanvaCsv = path.join(process.cwd(), 'analytical_reports', `canva_bulk_${suffix}.csv`);

// Função auxiliar para converter milissegundos num formato amigável
function formatMillisToFriendly(millis) {
  if (isNaN(millis) || millis === null) return "N/A";
  const absoluteMillis = Math.abs(millis);
  const days = Math.floor(absoluteMillis / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absoluteMillis % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((absoluteMillis % (1000 * 60 * 60)) / (1000 * 60));
  
  let result = [];
  if (days > 0) result.push(`${days}d`);
  if (hours > 0) result.push(`${hours}h`);
  if (mins > 0 || result.length === 0) result.push(`${mins}m`);
  
  const sign = millis < 0 ? "-" : "";
  return `${sign}${result.join(' ')}`;
}

// Calculadora de Porcentagem
function calcPercent(part, total) {
  if (total === 0) return "0.0%";
  return ((part / total) * 100).toFixed(1) + "%";
}

if (!fs.existsSync(outputDir)) {
  console.error(`O diretório ${outputDir} não existe.`);
  process.exit(1);
}

const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));

// Descobrir dinamicamente o mês passado (baseado na data de execução) para o título
const dataAtual = new Date();
dataAtual.setMonth(dataAtual.getMonth() - 1);
const mesPassadoStr = dataAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
const tituloDataStr = mesPassadoStr.charAt(0).toUpperCase() + mesPassadoStr.slice(1);

let markdownReport = `# Resumo do Mês - Jira Service Management (${tituloDataStr})\n\n`;
markdownReport += `*Este relatório consolida a operação do JSM: Volume, Ciclo de Vida do Chamado (MTTR), SLA de Incidentes e Eficiência.*\n\n`;
markdownReport += `---\n\n`;

// Validar Exclusões de Negócio based on Jira SLAs
function isSlaValidForAggregation(issue, slaName) {
    const requestTypeObj = issue.fields.customfield_10010;
    const requestType = requestTypeObj?.requestType?.name || requestTypeObj?.name || requestTypeObj || "";
    const creatorId = issue.fields.creator?.accountId || "";
    const reporterId = issue.fields.reporter?.accountId || "";
    const assigneeId = issue.fields.assignee?.accountId || "";

    if (slaName === 'resolution') {
        if (typeof requestType === 'string' && requestType.includes("Transporte indisponivel")) return false;
        return true;
    }

    if (slaName === 'firstResponse') {
        if (creatorId === "qm:955b6e41-e3c5-480c-8c9f-aba4b14ef33b:3ddbe838-7745-4718-be74-388c0956fbe0") return false;
        if (creatorId === "62388a2ca2f6400069e9bc0b") return false;
        if (creatorId === "61449641e057c6006a53fa89") return false; // NOC
        if (reporterId && assigneeId && reporterId === assigneeId) return false;
        return true;
    }
    return true;
}

const globalMetrics = {
  totalCriados: 0,
  totalResolvidos: 0,
  fr: { totalMillis: 0, count: 0, met: 0 },
  res: { totalMillis: 0, count: 0, met: 0 }
};

files.forEach(file => {
  const filepath = path.join(outputDir, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const typeName = file.replace('type_', '').replace('.json', '').replace(/_+/g, ' ').trim().toUpperCase();
  
  globalMetrics.totalCriados += data.length;
  const resolvedStatuses = ['Completed', 'Fechada', 'Concluído', 'Resolvido'];
  data.forEach(iss => {
      if (resolvedStatuses.includes(iss.fields.status?.name)) globalMetrics.totalResolvidos++;
  });
  
  const metrics = {
    totalVolume: data.length,
    firstResponse: { totalMillis: 0, count: 0, breached: 0, met: 0 },
    resolution: { totalMillis: 0, count: 0, breached: 0, met: 0 },
    assignees: {}
  };

  data.forEach(issue => {
    // Top Assignees
    const assigneeName = issue.fields.assignee?.displayName || "Não Atribuído";
    metrics.assignees[assigneeName] = (metrics.assignees[assigneeName] || 0) + 1;

    // SLA Primeira Resposta (customfield_10033)
    const frSla = issue.fields.customfield_10033;
    const isValidFR = isSlaValidForAggregation(issue, 'firstResponse');
    if (isValidFR && frSla && frSla.completedCycles && frSla.completedCycles.length > 0) {
      const lastCycle = frSla.completedCycles[frSla.completedCycles.length - 1];
      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
        metrics.firstResponse.totalMillis += lastCycle.elapsedTime.millis;
        metrics.firstResponse.count++;
        if (lastCycle.breached) {
           metrics.firstResponse.breached++;
        } else {
           metrics.firstResponse.met++;
        }
        // Global - Apenas Incidentes e Problemas para Primeira Resposta no Canva
        if (typeName === "SYSTEM INCIDENT" || typeName === "SYSTEM PROBLEM") {
           globalMetrics.fr.totalMillis += lastCycle.elapsedTime.millis;
           globalMetrics.fr.count++;
           if (lastCycle.breached) {} else globalMetrics.fr.met++;
        }
      }
    }

    // SLA Resolução (customfield_10032)
    const resSla = issue.fields.customfield_10032;
    const isValidRes = isSlaValidForAggregation(issue, 'resolution');
    if (isValidRes && resSla && resSla.completedCycles && resSla.completedCycles.length > 0) {
      const lastCycle = resSla.completedCycles[resSla.completedCycles.length - 1];
      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
        metrics.resolution.totalMillis += lastCycle.elapsedTime.millis;
        metrics.resolution.count++;
         if (lastCycle.breached) {
            metrics.resolution.breached++;
         } else {
            metrics.resolution.met++;
         }
         // Global
         globalMetrics.res.totalMillis += lastCycle.elapsedTime.millis;
         globalMetrics.res.count++;
         if (lastCycle.breached) {} else globalMetrics.res.met++;
      }
    }
  });

  // Sort Assignees
  const topAssignees = Object.entries(metrics.assignees)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`)
    .join(', ');

  // Averages
  const avgFR = metrics.firstResponse.count > 0 ? metrics.firstResponse.totalMillis / metrics.firstResponse.count : null;
  const avgRes = metrics.resolution.count > 0 ? metrics.resolution.totalMillis / metrics.resolution.count : null;

  markdownReport += `## 🟢 [${typeName}] - Volume: ${metrics.totalVolume} tickets\n`;
  markdownReport += `**👨‍💻 Top Responsáveis:** ${topAssignees}\n\n`;

  markdownReport += `### ⏱️ SLA: Tempo de Primeira Resposta\n`;
  if (metrics.firstResponse.count > 0) {
    markdownReport += `- **Tempo Médio:** ${formatMillisToFriendly(avgFR)}\n`;
    markdownReport += `- **Dentro da Meta:** ${metrics.firstResponse.met} (${calcPercent(metrics.firstResponse.met, metrics.firstResponse.count)})\n`;
    markdownReport += `- **Violados:** ${metrics.firstResponse.breached} (${calcPercent(metrics.firstResponse.breached, metrics.firstResponse.count)})\n`;
  } else {
    markdownReport += `- *Métrica não aplicável a este tipo no período.*\n`;
  }
  
  markdownReport += `\n### 🏁 SLA: Tempo de Resolução\n`;
  if (metrics.resolution.count > 0) {
    markdownReport += `- **Tempo Médio:** ${formatMillisToFriendly(avgRes)}\n`;
    markdownReport += `- **Dentro da Meta:** ${metrics.resolution.met} (${calcPercent(metrics.resolution.met, metrics.resolution.count)})\n`;
    markdownReport += `- **Violados:** ${metrics.resolution.breached} (${calcPercent(metrics.resolution.breached, metrics.resolution.count)})\n`;
  } else {
    markdownReport += `- *Métrica não aplicável a este tipo no período.*\n`;
  }
  
  markdownReport += `\n---\n\n`;
});

fs.writeFileSync(reportPath, markdownReport, 'utf8');
console.log(`Relatório Executivo gerado com sucesso em: ${reportPath}`);

// GENERATE CANVA CSV (BULK CREATE)
const formatH = (ms) => ms > 0 ? (Math.abs(ms) / (1000 * 60 * 60)).toFixed(2) + "h" : "0h";
const calcP = (met, total) => total > 0 ? ((met / total) * 100).toFixed(1) + "%" : "0%";

const generateBriefAnalysis = () => {
    const frP = (globalMetrics.fr.met / globalMetrics.fr.count) * 100;
    const resP = (globalMetrics.res.met / globalMetrics.res.count) * 100;
    const vol = globalMetrics.totalCriados;
    
    let analysis = `No mês de ${tituloMes}, tivemos um volume de ${vol} chamados. `;
    if (frP >= 90) analysis += "A resposta inicial foi excelente, mantendo o SLA acima de 90%. ";
    else if (frP >= 70) analysis += "A resposta inicial foi estável, mas há pontos de melhoria na agilidade. ";
    else analysis += "Atenção: O SLA de primeira resposta está abaixo do esperado, indicando gargalo triagem. ";
    if (resP >= 80) analysis += "A taxa de resolução final segue saudável e dentro da meta. ";
    else analysis += "Notamos uma queda na resolução dentro do prazo, sugerindo tickets mais complexos ou falta de pessoal. ";
    const ratio = globalMetrics.totalResolvidos / globalMetrics.totalCriados;
    if (ratio >= 0.95) analysis += "Concluímos quase todos os chamados abertos no período.";
    else analysis += `A taxa de vazão (resolvidos/criados) foi de ${(ratio * 100).toFixed(0)}%.`;
    return analysis;
};

const canvaHeader = ["Mes_Referencia","Total_Criados","Total_Resolvidos","Tempo_Medio_Primeira_Resposta","Tempo_Medio_Resolucao","SLA_Met_Primeira_Resposta","SLA_Met_Resolucao","Analise_Breve"].join(",");
const canvaRow = [
    `"${tituloMes}"`,
    globalMetrics.totalCriados,
    globalMetrics.totalResolvidos,
    `"${formatH(globalMetrics.fr.count > 0 ? globalMetrics.fr.totalMillis / globalMetrics.fr.count : 0)}"`,
    `"${formatH(globalMetrics.res.count > 0 ? globalMetrics.res.totalMillis / globalMetrics.res.count : 0)}"`,
    `"${calcP(globalMetrics.fr.met, globalMetrics.fr.count)}"`,
    `"${calcP(globalMetrics.res.met, globalMetrics.res.count)}"`,
    `"${generateBriefAnalysis()}"`
].join(",");

fs.writeFileSync(outputCanvaCsv, canvaHeader + "\n" + canvaRow + "\n", 'utf8');
console.log(`✅ Arquivo para Canva (Bulk Create) gerado: ${outputCanvaCsv}`);

// --- GERAÇÃO DINÂMICA DO EXECUTIVE_DASHBOARD.HTML ---

const metricsPath = path.join(process.cwd(), 'workflow_analysis', `metrics_summary_offset_${offset}.json`);
let timelineMetrics = {};
if (fs.existsSync(metricsPath)) {
    timelineMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
}

const incidentTimeline = timelineMetrics["[System] Incident"] || { mttrResponse: 0, mttrRepair: 0, mttrWaiting: 0, mttrResolution: 0, mtbf: 0 };
const changeTimeline = timelineMetrics["[System] Change"] || { mttrResponse: 0, mttrRepair: 0, mttrWaiting: 0, mttrResolution: 0, mtbf: 0 };
const problemTimeline = timelineMetrics["[System] Problem"] || { mttrResponse: 0, mttrRepair: 0, mttrWaiting: 0, mttrResolution: 0, mtbf: 0 };

const htmlDashboardPath = path.join(process.cwd(), 'executive_reports', 'executive_dashboard.html');

const htmlDashboardContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resumo do Mês - Jira Service Management</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
    <style>
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: transparent !important; }
            .no-print { display: none; }
            .page-break { page-break-before: always; }
        }
        body { background-color: transparent; color: #172b4d; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        /* AJUSTE DE MEDIDAS DA PÁGINA AQUI: */
        .dashboard-container { 
            max-width: 700px; /* Reduzido para caber na folha A4 em PDF */
            margin: 100px auto 40px auto; 
            padding: 50px; 
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <header class="mb-3 border-b border-gray-200 pb-2">
            <h1 class="text-2xl font-bold text-blue-800 leading-tight">Resumo do Mês - Jira Service Management</h1>
            <p class="text-xs text-gray-600 mt-1">Consolidação de Volume, Ciclo de Vida (MTTR), SLA de Incidentes e Eficiência Operacional (${tituloMes}).</p>
        </header>

        <!-- Pilares do Relatório explicitamente listados -->
        <div class="grid grid-cols-4 gap-2 mb-4 text-center text-[10px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
            <div class="flex items-center justify-center gap-1">📊 <b>Volume:</b> Chamados Abertos</div>
            <div class="flex items-center justify-center gap-1">⏳ <b>Ciclo:</b> Vida do Chamado</div>
            <div class="flex items-center justify-center gap-1">✅ <b>SLA:</b> Meta de Incidentes</div>
            <div class="flex items-center justify-center gap-1">⏱️ <b>MTTR:</b> Resolução Incidentes</div>
        </div>

        <!-- Sumário Executivo Dinâmico -->
        <div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4 rounded-r-lg text-xs leading-relaxed">
            <h2 class="font-bold text-blue-800 mb-1 flex items-center">
                <span class="mr-1">📌</span> Sumário Executivo do Mês
            </h2>
            <p class="text-gray-700">${generateBriefAnalysis()}</p>
        </div>

        <!-- Cards de Resumo -->
        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <h3 class="text-xs font-semibold text-gray-500 uppercase">Volume Total</h3>
                <p class="text-2xl font-bold mt-1">${globalMetrics.totalCriados} <span class="text-xs font-normal text-gray-400">Tickets</span></p>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-green-500">
                <h3 class="text-xs font-semibold text-gray-500 uppercase">SLA Resolução</h3>
                <p class="text-2xl font-bold mt-1 text-green-600">${calcP(globalMetrics.res.met, globalMetrics.res.count)} <span class="text-xs font-normal text-gray-400">Cumprido</span></p>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
                <h3 class="text-xs font-semibold text-gray-500 uppercase">MTTR (Incidentes)</h3>
                <p class="text-2xl font-bold mt-1 text-blue-600">${incidentTimeline.mttrResolution.toFixed(1)}h</p>
            </div>
        </div>

        <!-- Área de Gráficos -->
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <h2 class="text-sm font-bold mb-2 text-gray-700">Volume por Tipo</h2>
                <canvas id="volumeChart" height="140"></canvas>
            </div>
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <h2 class="text-sm font-bold mb-2 text-gray-700">SLA Resolução</h2>
                <div class="relative h-[140px] flex justify-center items-center">
                    <canvas id="slaChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Bloco de Timeline / Eficiência -->
        <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-2">
            <h2 class="text-sm font-bold mb-2 text-gray-700">Timeline de Ciclo de Vida (Incidentes, Mudanças e Problemas - Médias)</h2>
            <div class="relative h-[160px] w-full"> <!-- Altura aumentada para três barras -->
                <canvas id="timelineChart"></canvas>
            </div>
            <div class="flex justify-center gap-4 mt-2 text-center text-xs">
                <div><span class="inline-block w-2 h-2 bg-[#f59e0b] rounded-full mr-1"></span> ⏱️ Resposta</div>
                <div><span class="inline-block w-2 h-2 bg-[#10b981] rounded-full mr-1"></span> 🛠️ Reparo</div>
                <div><span class="inline-block w-2 h-2 bg-[#8b5cf6] rounded-full mr-1"></span> ⏳ Em Espera</div>
            </div>
        </div>
    </div>

    <script>
        // Registrar o plugin de datalabels para exibir os números nas barras
        Chart.register(ChartDataLabels);

        // Gráfico de Volume
        const ctxVol = document.getElementById('volumeChart').getContext('2d');
        new Chart(ctxVol, {
            type: 'bar',
            data: {
                labels: ['Incidentes', 'Mudanças', 'Problemas'],
                datasets: [{
                    label: 'Quantidade',
                    data: [
                        ${(timelineMetrics["[System] Incident"] || {}).totalTickets || 0},
                        ${(timelineMetrics["[System] Change"] || {}).totalTickets || 0},
                        ${(timelineMetrics["[System] Problem"] || {}).totalTickets || 0}
                    ],
                    backgroundColor: ['#eb5757', '#f2994a', '#9b51e0'],
                    borderRadius: 5
                }]
            },
            options: { 
                responsive: true, 
                plugins: { 
                    legend: { display: false },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        formatter: Math.round,
                        font: { weight: 'bold' },
                        color: '#4b5563'
                    }
                }, 
                scales: { y: { beginAtZero: true } } 
            }
        });

        // Gráfico de SLA
        const ctxSla = document.getElementById('slaChart').getContext('2d');
        new Chart(ctxSla, {
            type: 'doughnut',
            data: {
                labels: ['Dentro da Meta', 'Violado'],
                datasets: [{
                    data: [${globalMetrics.res.met}, ${(globalMetrics.res.count - globalMetrics.res.met)}],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }
        });

        // Gráfico de Timeline (Lifespan Stacked)
        const ctxTime = document.getElementById('timelineChart').getContext('2d');
        new Chart(ctxTime, {
            type: 'bar',
            data: {
                labels: ['Incidentes', 'Mudanças', 'Problemas'],
                datasets: [
                    { label: 'MTTR-R (Response)', data: [${incidentTimeline.mttrResponse.toFixed(2)}, ${changeTimeline.mttrResponse.toFixed(2)}, ${problemTimeline.mttrResponse.toFixed(2)}], backgroundColor: '#f59e0b' },
                    { label: 'MTR (Repair)', data: [${incidentTimeline.mttrRepair.toFixed(2)}, ${changeTimeline.mttrRepair.toFixed(2)}, ${problemTimeline.mttrRepair.toFixed(2)}], backgroundColor: '#10b981' },
                    { label: 'Wait (Blocks)', data: [${incidentTimeline.mttrWaiting.toFixed(2)}, ${changeTimeline.mttrWaiting.toFixed(2)}, ${problemTimeline.mttrWaiting.toFixed(2)}], backgroundColor: '#8b5cf6' }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, grid: { display: false } } },
                plugins: { legend: { display: false } }
            }
        });
    </script>
</body>
</html>
`;

fs.writeFileSync(htmlDashboardPath, htmlDashboardContent, 'utf8');
console.log(`✅ Dashboard HTML atualizado com dados dinâmicos: ${htmlDashboardPath}`);

