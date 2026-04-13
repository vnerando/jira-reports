// Execute com: node analytical_report_generator.mjs

import fs from 'fs';
import path from 'path';

const { MONTH_OFFSET = "1", REPORT_LABEL } = process.env;
const offset = parseInt(MONTH_OFFSET);

let suffix = '';
let tituloMes = '';

if (REPORT_LABEL) {
    suffix = REPORT_LABEL.replace(/ /g, '_');
    tituloMes = REPORT_LABEL.replace(/_/g, ' ');
} else {
    const offset = parseInt(MONTH_OFFSET);
    const dataRelatorio = new Date();
    dataRelatorio.setMonth(dataRelatorio.getMonth() - offset);
    const mesRefStr = dataRelatorio.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    tituloMes = mesRefStr.charAt(0).toUpperCase() + mesRefStr.slice(1);
    suffix = tituloMes.replace(/ /g, '_').replace(/de_/g, '');
}

const inputDir = path.join(process.cwd(), 'issues_by_type');
const outputDir = path.join(process.cwd(), 'analytical_reports');
const outputReport = path.join(outputDir, `Relatorio_Analitico_${suffix}.csv`);
const outputHtml = path.join(outputDir, `dashboard_${suffix}.html`);
const outputCanvaCsv = path.join(outputDir, `canva_bulk_${suffix}.csv`);

// Verifica se a pasta existe antes de avançar
if (!fs.existsSync(inputDir)) {
  console.error(`O diretório de dados ${inputDir} não existe. Execute o issue_separator.mjs primeiro.`);
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));

let csvContent = [
    // Cabeçalho da Tabela
    "Chave do Ticket",
    "Tipo de Solicitacao",
    "Motivo / Request Type",
    "Localidade",
    "Resumo",
    "Status Atual",
    "Criador",
    "Atribuido Para",
    "Resolucao",
    "SLA: Primeira Resposta (Foi Violado?)",
    "SLA: Primeira Resposta (Tempo Gasto)",
    "SLA: Tempo Resolucao (Foi Violado?)",
    "SLA: Tempo Resolucao (Tempo Gasto)",
    "Data de Criacao"
].join(",") + "\n";

console.log("Iniciando varredura analítica linha a linha...");

// Variáveis para agregação analítica
const aggregation = {
  totalIssues: 0,
  resolvedIssues: 0,
  volumeByType: {},
  rootCausesIncident: {},
  rootCausesProblem: {},
  byCity: {},
  slaOffenders: {},
  byCreator: {},
  resolutionTimeByType: {}, // { "Incident": { totalMillis: X, count: Y }, ... }
  dailySLA: {}, // { "YYYY-MM-DD": { frTotal: X, frCount: Y, resTotal: Z, resCount: W } }
  slaSummary: {
      frMet: 0, frBreached: 0, frTotalMillis: 0, frCount: 0,
      resMet: 0, resBreached: 0, resTotalMillis: 0, resCount: 0
  }
};

// Validar Exclusões de Negócio based on Jira SLAs
function isSlaValidForAggregation(issue, slaName) {
    // Exclusões tratadas nativamente pelo Jira (skill: jsm_sla_reports)
    return true;
}

// Mapeamento de Bots conhecidos para separar (heurística simples por nome)
const botNames = ['Automation for Jira', 'Jira Service Desk Widget', 'Jira Bot'];

// Função para normalizar resumos (Availability grouping)
function normalizeSummary(summary) {
    if (!summary) return "N/A";
    let str = summary.toLowerCase();
    const availabilityTerms = ['caiu', 'down', 'indisponivel', 'indisponível', 'off', 'queda', 'fora do ar', 'desconectado', 'offline', 'sem sinal'];
    if (availabilityTerms.some(term => str.includes(term))) return "Indisponibilidade / Queda de Serviço";
    str = str.replace(/\[.*?\]/g, '').replace(/gc-\d+/g, '').replace(/re:|fwd:|resumo:|assunto:/g, '').replace(/\d{8,}/g, '');
    return str.trim() || summary;
}

const recurringGroups = {}; // { "City|Summary": { city, summary, issues: [createdDates] } }

files.forEach(file => {
  const filepath = path.join(inputDir, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  data.forEach(issue => {
    // Incrementa agregador de totais
    aggregation.totalIssues++;

    // Agregações do Criador (separar Bot vs Humano sem prefixo estrito "Pessoa")
    const rawCreatorName = issue.fields.creator?.displayName || "Desconhecido";
    const creatorGroup = botNames.some(bot => rawCreatorName.includes(bot)) ? `[Bot] ${rawCreatorName}` : rawCreatorName;
    
    aggregation.byCreator[creatorGroup] = (aggregation.byCreator[creatorGroup] || 0) + 1;

    // Escapar aspas duplas e quebras de linha para evitar quebra no CSV
    const escapeCsv = (str) => `"${(str || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    const key = issue.key;
    const type = issue.fields.issuetype?.name || "N/A";
    
    aggregation.volumeByType[type] = (aggregation.volumeByType[type] || 0) + 1;
    
    const requestTypeObj = issue.fields.customfield_10010;
    const reqType = requestTypeObj?.requestType?.name || requestTypeObj?.name || (typeof requestTypeObj === "string" ? requestTypeObj : "N/A");
    
    if (type.toUpperCase().includes('INCIDENT') && reqType !== "N/A") {
        aggregation.rootCausesIncident[reqType] = (aggregation.rootCausesIncident[reqType] || 0) + 1;
    }
    if (type.toUpperCase().includes('PROBLEM') && reqType !== "N/A") {
        aggregation.rootCausesProblem[reqType] = (aggregation.rootCausesProblem[reqType] || 0) + 1;
    }

    // CITY Map
    const cityField = issue.fields.customfield_10105;
    const city = cityField?.value || (typeof cityField === "string" ? cityField : "Não Informado");
    aggregation.byCity[city] = (aggregation.byCity[city] || 0) + 1;

    const summary = issue.fields.summary || "N/A";
    const status = issue.fields.status?.name || "N/A";
    const creator = rawCreatorName;
    const assignee = issue.fields.assignee?.displayName || "N/A";
    const resolution = issue.fields.resolution?.name || "Em Aberto";
    const createdDate = new Date(issue.fields.created).toLocaleString('pt-BR');
    
    // Aggregation string Date for Daily SLA chart (YYYY-MM-DD)
    const dayDate = issue.fields.created.substring(0, 10);
    if (!aggregation.dailySLA[dayDate]) {
        aggregation.dailySLA[dayDate] = { frTotal: 0, frCount: 0, resTotal: 0, resCount: 0 };
    }

    // Verificando se foi Resolvido
    const resolvedStatuses = ['Completed', 'Fechada', 'Concluído', 'Resolvido'];
    if (resolvedStatuses.includes(status)) {
        aggregation.resolvedIssues++;
    }

    // Lógica de Recorrência
    const normSummary = normalizeSummary(summary);
    const groupKey = `${city} | ${normSummary}`;
    if (!recurringGroups[groupKey]) {
        recurringGroups[groupKey] = { city, summary: normSummary, issues: [] };
    }
    recurringGroups[groupKey].issues.push(new Date(issue.fields.created));

    // Analisando SLA 1 - Primeira Resposta
    let firstResponseBreached = "N/A";
    let firstResponseTime = "N/A";
    const frSla = issue.fields.customfield_10033;
    const isValidFR = isSlaValidForAggregation(issue, 'firstResponse');

    if (isValidFR && frSla && frSla.completedCycles && frSla.completedCycles.length > 0) {
      const lastCycle = frSla.completedCycles[frSla.completedCycles.length - 1];
      firstResponseBreached = lastCycle.breached ? "SIM" : "NAO";
      firstResponseTime = lastCycle.elapsedTime?.friendly || "0m";

      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
         aggregation.dailySLA[dayDate].frTotal += lastCycle.elapsedTime.millis;
         aggregation.dailySLA[dayDate].frCount++;
         
         aggregation.slaSummary.frTotalMillis += lastCycle.elapsedTime.millis;
         aggregation.slaSummary.frCount++;
         if (lastCycle.breached) { 
             aggregation.slaSummary.frBreached++;
             if (reqType !== "N/A") aggregation.slaOffenders[reqType] = (aggregation.slaOffenders[reqType] || 0) + 1;
         }
         else aggregation.slaSummary.frMet++;
      }
    } else if (!isValidFR) {
      firstResponseBreached = "N/A (Excluído)";
      firstResponseTime = "N/A (Excluído)";
    }

    // Analisando SLA 2 - Resolução Final
    let resolutionBreached = "N/A";
    let resolutionTime = "N/A";
    const resSla = issue.fields.customfield_10032;
    const isValidRes = isSlaValidForAggregation(issue, 'resolution');

    if (isValidRes && resSla && resSla.completedCycles && resSla.completedCycles.length > 0) {
      const lastCycle = resSla.completedCycles[resSla.completedCycles.length - 1];
      resolutionBreached = lastCycle.breached ? "SIM" : "NAO";
      resolutionTime = lastCycle.elapsedTime?.friendly || "0m";

      // Agrega tempo de resolução em millis para "Por Tipo"
      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
         if (!aggregation.resolutionTimeByType[type]) {
             aggregation.resolutionTimeByType[type] = { totalMillis: 0, count: 0 };
         }
         aggregation.resolutionTimeByType[type].totalMillis += lastCycle.elapsedTime.millis;
         aggregation.resolutionTimeByType[type].count++;

         // Agrega tempo de resolução para o "Linha Diária"
         aggregation.dailySLA[dayDate].resTotal += lastCycle.elapsedTime.millis;
         aggregation.dailySLA[dayDate].resCount++;

         aggregation.slaSummary.resTotalMillis += lastCycle.elapsedTime.millis;
         aggregation.slaSummary.resCount++;
         if (lastCycle.breached) {
             aggregation.slaSummary.resBreached++;
             if (reqType !== "N/A") aggregation.slaOffenders[reqType] = (aggregation.slaOffenders[reqType] || 0) + 1;
         }
         else aggregation.slaSummary.resMet++;
      }
    } else if (!isValidRes) {
      resolutionBreached = "N/A (Excluído)";
      resolutionTime = "N/A (Excluído)";
    }

    const row = [
        escapeCsv(key),
        escapeCsv(type),
        escapeCsv(reqType),
        escapeCsv(city),
        escapeCsv(summary),
        escapeCsv(status),
        escapeCsv(creator),
        escapeCsv(assignee),
        escapeCsv(resolution),
        escapeCsv(firstResponseBreached),
        escapeCsv(firstResponseTime),
        escapeCsv(resolutionBreached),
        escapeCsv(resolutionTime),
        escapeCsv(createdDate)
    ];

    csvContent += row.join(",") + "\n";
  });
});

fs.writeFileSync(outputReport, csvContent, 'utf8');

console.log(`✅ Relatório Analítico Tabular (CSV) atualizado.`);

// Pós-Processamento da Agregação para o Dashboard
// 1. Médias de tempo por Tipo
const avgResolutionHoursByType = {};
for (const [t, data] of Object.entries(aggregation.resolutionTimeByType)) {
    if (data.count > 0) {
        // Converte ms médios para Horas
        const avgMs = data.totalMillis / data.count;
        avgResolutionHoursByType[t] = parseFloat((Math.abs(avgMs) / (1000 * 60 * 60)).toFixed(2));
    }
}

// 2. Transforma Criadores e Volume
const creatorLabels = Object.keys(aggregation.byCreator);
const creatorData = Object.values(aggregation.byCreator);
const volumeLabels = Object.keys(aggregation.volumeByType);
const volumeData = Object.values(aggregation.volumeByType);

// 3. Top 5 Root Causes, Cities, SLA Offenders
const topIncidents = Object.entries(aggregation.rootCausesIncident).sort((a,b) => b[1]-a[1]).slice(0, 5);
const topProblems = Object.entries(aggregation.rootCausesProblem).sort((a,b) => b[1]-a[1]).slice(0, 5);
const topCities = Object.entries(aggregation.byCity).sort((a,b) => b[1]-a[1]).slice(0, 5);
const topOffenders = Object.entries(aggregation.slaOffenders).sort((a,b) => b[1]-a[1]).slice(0, 5);

// 3.1 Processar Recorrência e TBF
const recurringResults = Object.values(recurringGroups)
    .filter(g => g.issues.length > 1)
    .map(g => {
        g.issues.sort((a, b) => a - b);
        let totalTbf = 0;
        for (let i = 1; i < g.issues.length; i++) {
            totalTbf += (g.issues[i] - g.issues[i-1]);
        }
        const avgTbfHours = parseFloat((totalTbf / (g.issues.length - 1) / (1000 * 60 * 60)).toFixed(1));
        return { city: g.city, summary: g.summary, count: g.issues.length, avgTbfHours };
    })
    .sort((a, b) => b.count - a.count);

const topRecurring = recurringResults.slice(0, 5);

// 4. Formata os Tempos Diários de SLA para Linhas
const sortedDays = Object.keys(aggregation.dailySLA).sort();
const dailyLabels = [];
const dailyFrAvg = [];
const dailyResAvg = [];

sortedDays.forEach(day => {
    const parts = day.split('-');
    if(parts.length === 3) dailyLabels.push(`${parts[2]}/${parts[1]}`);
    else dailyLabels.push(day);

    const data = aggregation.dailySLA[day];
    
    let frAvg = 0;
    if (data.frCount > 0) frAvg = parseFloat((Math.abs(data.frTotal / data.frCount) / (1000 * 60 * 60)).toFixed(2));
    dailyFrAvg.push(frAvg);

    let resAvg = 0;
    if (data.resCount > 0) resAvg = parseFloat((Math.abs(data.resTotal / data.resCount) / (1000 * 60 * 60)).toFixed(2));
    dailyResAvg.push(resAvg);
});

// 5. Importar Metrics do Workflow (MTTR)
const metricsPath = path.join(process.cwd(), 'workflow_analysis', `metrics_summary_offset_${offset}.json`);
let timelineMetrics = {};
if (fs.existsSync(metricsPath)) {
    timelineMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
}
const incidentTimeline = timelineMetrics["[System] Incident"] || { mttrResponse: 0, mttrRepair: 0, mttrWaiting: 0, mttrResolution: 0 };
const changeTimeline = timelineMetrics["[System] Change"] || { mttrResponse: 0, mttrRepair: 0, mttrWaiting: 0, mttrResolution: 0 };
const problemTimeline = timelineMetrics["[System] Problem"] || { mttrResponse: 0, mttrRepair: 0, mttrWaiting: 0, mttrResolution: 0 };

// Gera a página HTML da Dashboard Analítica
const htmlTemplate = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Analítico de Ticket Causality - ${tituloMes}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2"></script>
</head>
<body class="bg-gray-50 text-gray-800 p-8 font-sans">
    <div class="max-w-7xl mx-auto">
        <header class="mb-10 text-center">
            <h1 class="text-3xl font-bold text-indigo-900">Métricas Analíticas Aprofundadas - ${tituloMes}</h1>
            <p class="text-gray-500 mt-2">Visão detalhada forense de Volume, Origem, Motivadores e Ciclo de Vida.</p>
        </header>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center col-span-1 lg:col-span-1 border-l-4 border-l-blue-500">
                <div>
                   <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Analisados</h2>
                   <p class="text-4xl font-extrabold text-blue-600 mt-1">${aggregation.totalIssues}</p>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 lg:col-span-3">
                <h3 class="font-bold text-sm mb-2 text-gray-700">Volume por Categoria</h3>
                <div class="relative w-full h-[120px] mx-auto">
                    <canvas id="volumeAnalyticChart"></canvas>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Causa Raiz Incidentes -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="font-bold text-lg mb-4 text-gray-700 text-red-600 flex items-center gap-2">🔥 Top 5 Causas/Motivos: Incidentes</h3>
                <ul class="space-y-3">
                    ${topIncidents.length > 0 ? topIncidents.map((t, i) => `<li class="flex justify-between items-center text-sm border-b pb-2"><span>${i+1}. ${t[0]}</span> <span class="font-bold bg-gray-100 px-2 rounded">${t[1]}</span></li>`).join('') : '<li class="text-sm text-gray-400 italic">Sem volume para ranquear.</li>'}
                </ul>
            </div>
            
            <!-- Causa Raiz Problemas -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="font-bold text-lg mb-4 text-gray-700 text-purple-600 flex items-center gap-2">🧩 Top 5 Causas/Motivos: Problemas</h3>
                <ul class="space-y-3">
                    ${topProblems.length > 0 ? topProblems.map((t, i) => `<li class="flex justify-between items-center text-sm border-b pb-2"><span>${i+1}. ${t[0]}</span> <span class="font-bold bg-gray-100 px-2 rounded">${t[1]}</span></li>`).join('') : '<li class="text-sm text-gray-400 italic">Sem volume para ranquear.</li>'}
                </ul>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Mapeamento Geográfico -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="font-bold text-lg mb-4 text-gray-700 text-emerald-600 flex items-center gap-2">📍 Top 5 Cidades/Regiões (Volume)</h3>
                <ul class="space-y-3">
                    ${topCities.length > 0 ? topCities.map((t, i) => `<li class="flex justify-between items-center text-sm border-b pb-2"><span>${i+1}. ${t[0]}</span> <span class="font-bold bg-gray-100 px-2 rounded">${t[1]}</span></li>`).join('') : '<li class="text-sm text-gray-400 italic">Sem cidades identificadas.</li>'}
                </ul>
            </div>
            
            <!-- Top Ofensores SLA -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="font-bold text-lg mb-4 text-gray-700 text-orange-600 flex items-center gap-2">⏱️ Top 5 Causadores de Atraso (SLA Violado)</h3>
                <ul class="space-y-3">
                    ${topOffenders.length > 0 ? topOffenders.map((t, i) => `<li class="flex justify-between items-center text-sm border-b pb-2"><span>${i+1}. ${t[0]}</span> <span class="font-bold bg-red-100 px-2 rounded text-red-600">${t[1]} atrasos</span></li>`).join('') : '<li class="text-sm text-gray-400 italic mt-2">✨ Ótimo! Nenhuma violação grave encontrada.</li>'}
                </ul>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Recorrência e TBF -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 class="font-bold text-lg mb-4 text-gray-700 text-indigo-600 flex items-center gap-2">🔄 Top 5 Falhas Recorrentes (Estabilidade)</h3>
                <ul class="space-y-3">
                    ${topRecurring.length > 0 ? topRecurring.map((r, i) => `
                        <li class="border-b pb-2">
                            <div class="flex justify-between items-center mb-1">
                                <span class="font-bold text-sm">${i+1}. ${r.city}</span>
                                <span class="text-xs bg-indigo-100 text-indigo-700 px-2 rounded-full font-bold">${r.count}x</span>
                            </div>
                            <div class="flex justify-between items-center text-xs text-gray-500">
                                <span class="truncate max-w-[200px]">${r.summary}</span>
                                <span>TBF Médio: <b class="text-indigo-600">${r.avgTbfHours}h</b></span>
                            </div>
                        </li>
                    `).join('') : '<li class="text-sm text-gray-400 italic">Sem recorrência significativa detectada.</li>'}
                </ul>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Frequência de Falhas (TBF em Horas)</h3>
                <div class="relative w-full h-[250px] flex-1">
                    <canvas id="tbfChart"></canvas>
                </div>
            </div>
        </div>

        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
             <h3 class="font-bold text-lg mb-2 text-gray-700">Análise de Ciclo de Vida (MTTR Completo)</h3>
             <p class="text-sm text-gray-500 mb-4">Quebra das pontas operacionais: Esperando o cliente ou 3º (Wait), Triando (Response) e Solucionando ativamente (Repair).</p>
             <div class="relative w-full h-[200px] flex-1 flex justify-center items-center">
                 <canvas id="lifespanChart"></canvas>
             </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Gráfico: Tempo de Resolução -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Média Horas Resolução Direta</h3>
                <div class="relative w-full h-[300px] flex-1 flex justify-center items-center">
                    <canvas id="resolutionTimeChart"></canvas>
                </div>
            </div>
            <!-- Gráfico: Criadores -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Origem de Abertura</h3>
                <div class="relative w-full h-[300px] flex-1 flex justify-center items-center">
                    <canvas id="creatorChart"></canvas>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Gráfico: Evolução Diária Resposta -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Diário: Média 1ª Resposta (Horas)</h3>
                <div class="relative w-full h-[300px] flex-1 flex justify-center items-center">
                    <canvas id="dailyFrTimeChart"></canvas>
                </div>
            </div>
            <!-- Gráfico: Evolução Diária Resolução -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Diário: Média Resolução (Horas)</h3>
                <div class="relative w-full h-[300px] flex-1 flex justify-center items-center">
                    <canvas id="dailyResTimeChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        Chart.register(ChartDataLabels);
    
        const volumeLabels = ${JSON.stringify(volumeLabels)};
        const volumeData = ${JSON.stringify(volumeData)};
        const creatorLabels = ${JSON.stringify(creatorLabels)};
        const creatorData = ${JSON.stringify(creatorData)};
        const typeLabels = ${JSON.stringify(Object.keys(avgResolutionHoursByType))};
        const typeData = ${JSON.stringify(Object.values(avgResolutionHoursByType))};
        const dailyLabels = ${JSON.stringify(dailyLabels)};
        const dailyFrAvg = ${JSON.stringify(dailyFrAvg)};
        const dailyResAvg = ${JSON.stringify(dailyResAvg)};
        const tbfLabels = ${JSON.stringify(topRecurring.map(r => r.city))};
        const tbfData = ${JSON.stringify(topRecurring.map(r => r.avgTbfHours))};

        // Volume Bar Horizontal
        new Chart(document.getElementById('volumeAnalyticChart'), {
            type: 'bar',
            data: {
                labels: volumeLabels,
                datasets: [{
                    label: 'Tickets', data: volumeData,
                    backgroundColor: '#1d4ed8', borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { align: 'right', anchor: 'end', color: '#1f2937', font: { weight: 'bold' } } },
                scales: { x: { display: false }, y: { grid: { display: false } } }
            }
        });

        // Lifespan Stacked
        new Chart(document.getElementById('lifespanChart'), {
            type: 'bar',
            data: {
                labels: ['Incidentes', 'Mudanças', 'Problemas'],
                datasets: [
                    { label: 'MTTR-R (Triage/Response)', data: [${incidentTimeline.mttrResponse.toFixed(2)}, ${changeTimeline.mttrResponse.toFixed(2)}, ${problemTimeline.mttrResponse.toFixed(2)}], backgroundColor: '#f59e0b' },
                    { label: 'MTR (Repair ativ.)', data: [${incidentTimeline.mttrRepair.toFixed(2)}, ${changeTimeline.mttrRepair.toFixed(2)}, ${problemTimeline.mttrRepair.toFixed(2)}], backgroundColor: '#10b981' },
                    { label: 'Wait (Pausado/Fila)', data: [${incidentTimeline.mttrWaiting.toFixed(2)}, ${changeTimeline.mttrWaiting.toFixed(2)}, ${problemTimeline.mttrWaiting.toFixed(2)}], backgroundColor: '#8b5cf6' }
                ]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true, grid: { display: false } } },
                plugins: { legend: { position: 'bottom' }, datalabels: { display: false } }
            }
        });

        // Creator Doughnut
        new Chart(document.getElementById('creatorChart'), {
            type: 'pie',
            data: { labels: creatorLabels, datasets: [{ data: creatorData, backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#64748b'], borderWidth: 1 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' }, datalabels: { display: false } } }
        });

        // Resolution Bar
        new Chart(document.getElementById('resolutionTimeChart'), {
            type: 'bar',
            data: { labels: typeLabels, datasets: [{ label: 'Horas', data: typeData, backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas Corridas' } } } }
        });

        // Daily First Response Chart
        new Chart(document.getElementById('dailyFrTimeChart'), {
            type: 'line',
            data: { labels: dailyLabels, datasets: [{ label: '1ª Resposta (Média Horas)', data: dailyFrAvg, borderColor: '#22c55e', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } } }
        });

        // Daily Resolution Chart
        new Chart(document.getElementById('dailyResTimeChart'), {
            type: 'line',
            data: { labels: dailyLabels, datasets: [{ label: 'Resolução (Média Horas)', data: dailyResAvg, borderColor: '#f97316', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderWidth: 2, fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } } }
        });

        // TBF Chart (Horizontal Bar)
        new Chart(document.getElementById('tbfChart'), {
            type: 'bar',
            data: {
                labels: tbfLabels,
                datasets: [{
                    label: 'TBF (Horas)', data: tbfData,
                    backgroundColor: '#6366f1', borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { align: 'right', anchor: 'end', color: '#1f2937', font: { weight: 'bold' } } },
                scales: { x: { beginAtZero: true, title: { display: true, text: 'Horas' } }, y: { grid: { display: false } } }
            }
        });
    </script>
</body>
</html>`;
fs.writeFileSync(outputHtml, htmlTemplate, 'utf8');
console.log(`✅ Dashboard HTML gerado: ${outputHtml}`);
// Retornar dados completos via stdout para o servidor ler (Sem salvar arquivos)
const enrichedOutput = {
    ...aggregation,
    avgResolutionHoursByType,
    topCities,
    topOffenders,
    topIncidents,
    topProblems,
    dailyLabels,
    dailyFrAvg,
    dailyResAvg,
    topRecurring,
    timeline: {
        incident: incidentTimeline,
        change: changeTimeline,
        problem: problemTimeline
    }
};
console.log('###DATA###' + JSON.stringify(enrichedOutput) + '###DATA###');
