// Execute com: node analytical_report_generator.mjs

import fs from 'fs';
import path from 'path';

const inputDir = path.join(process.cwd(), 'issues_by_type');
const outputDir = path.join(process.cwd(), 'analytical_reports');
const outputReport = path.join(outputDir, 'Relatorio_Analitico_Completo.csv');
const outputHtml = path.join(outputDir, 'analytical_dashboard.html');

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
  byCreator: {},
  resolutionTimeByType: {}, // { "Incident": { totalMillis: X, count: Y }, ... }
  dailySLA: {} // { "YYYY-MM-DD": { frTotal: X, frCount: Y, resTotal: Z, resCount: W } }
};

// Mapeamento de Bots conhecidos para separar (heurística simples por nome)
const botNames = ['Automation for Jira', 'Jira Service Desk Widget', 'Jira Bot'];

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

    // Analisando SLA 1 - Primeira Resposta
    let firstResponseBreached = "N/A";
    let firstResponseTime = "N/A";
    const frSla = issue.fields.customfield_10033;
    if (frSla && frSla.completedCycles && frSla.completedCycles.length > 0) {
      const lastCycle = frSla.completedCycles[frSla.completedCycles.length - 1];
      firstResponseBreached = lastCycle.breached ? "SIM" : "NAO";
      firstResponseTime = lastCycle.elapsedTime?.friendly || "0m";

      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
         aggregation.dailySLA[dayDate].frTotal += lastCycle.elapsedTime.millis;
         aggregation.dailySLA[dayDate].frCount++;
      }
    }

    // Analisando SLA 2 - Resolução Final
    let resolutionBreached = "N/A";
    let resolutionTime = "N/A";
    const resSla = issue.fields.customfield_10032;
    if (resSla && resSla.completedCycles && resSla.completedCycles.length > 0) {
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
      }
    }

    const row = [
        escapeCsv(key),
        escapeCsv(type),
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

// 2. Transforma Criadores em Arrays para o Gráfico
const creatorLabels = Object.keys(aggregation.byCreator);
const creatorData = Object.values(aggregation.byCreator);

// 3. Formata os Tempos Diários de SLA para Linhas
const sortedDays = Object.keys(aggregation.dailySLA).sort();
const dailyLabels = [];
const dailyFrAvg = [];
const dailyResAvg = [];

sortedDays.forEach(day => {
    // Label format: DD/MM
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

// Gera a página HTML da Dashboard Analítica
const dataAtual = new Date();
dataAtual.setMonth(dataAtual.getMonth() - 1);
const mesReferencia = dataAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
const tituloMes = mesReferencia.charAt(0).toUpperCase() + mesReferencia.slice(1);

const htmlTemplate = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Analítico de Ticket Causality - ${tituloMes}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-50 text-gray-800 p-8 font-sans">
    <div class="max-w-7xl mx-auto">
        <header class="mb-10 text-center">
            <h1 class="text-3xl font-bold text-indigo-900">Métricas Analíticas Aprofundadas</h1>
            <p class="text-gray-500 mt-2">Origem, criadores e tempos de resolução detalhados em ${tituloMes}.</p>
        </header>

        <div class="grid grid-cols-1 mb-10">
            <div class="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                   <h2 class="text-sm font-bold text-gray-400 uppercase tracking-widest">Total de Chamados Analisados</h2>
                   <p class="text-5xl font-extrabold text-indigo-600 mt-2">${aggregation.totalIssues}</p>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <!-- Gráfico: Criadores (Pessoa vs Bot) -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Origem de Abertura</h3>
                <div class="relative w-full h-[300px] flex-1 flex justify-center items-center">
                    <canvas id="creatorChart"></canvas>
                </div>
            </div>

            <!-- Gráfico: Tempo de Resolução -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Média Horas Resolução (Por Tipo)</h3>
                <div class="relative w-full h-[300px] flex-1 flex justify-center items-center">
                    <canvas id="resolutionTimeChart"></canvas>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1">
            <!-- Gráfico: Evolução Diária dos SLAs -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
                <h3 class="font-bold text-lg mb-4 text-gray-700">Evolução Diária - Tempos de SLA (Em Horas)</h3>
                <div class="relative w-full h-[400px] flex-1 flex justify-center items-center">
                    <canvas id="dailySlaChart"></canvas>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Dados Injetados Pelo Node.js
        const creatorLabels = ${JSON.stringify(creatorLabels)};
        const creatorData = ${JSON.stringify(creatorData)};
        
        const typeLabels = ${JSON.stringify(Object.keys(avgResolutionHoursByType))};
        const typeData = ${JSON.stringify(Object.values(avgResolutionHoursByType))};

        const dailyLabels = ${JSON.stringify(dailyLabels)};
        const dailyFrAvg = ${JSON.stringify(dailyFrAvg)};
        const dailyResAvg = ${JSON.stringify(dailyResAvg)};

        // Creator Doughnut
        new Chart(document.getElementById('creatorChart'), {
            type: 'pie',
            data: {
                labels: creatorLabels,
                datasets: [{
                    data: creatorData,
                    backgroundColor: [
                        '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#64748b'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        // Resolution Bar
        new Chart(document.getElementById('resolutionTimeChart'), {
            type: 'bar',
            data: {
                labels: typeLabels,
                datasets: [{
                    label: 'Horas',
                    data: typeData,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Horas Corridas' } }
                }
            }
        });

        // Daily Line Chart
        new Chart(document.getElementById('dailySlaChart'), {
            type: 'line',
            data: {
                labels: dailyLabels,
                datasets: [
                    {
                        label: 'Primeira Resposta (Média Horas)',
                        data: dailyFrAvg,
                        borderColor: '#22c55e',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Resolução (Média Horas)',
                        data: dailyResAvg,
                        borderColor: '#f97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y + 'h';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Horas Corridas' } }
                }
            }
        });
    </script>
</body>
</html>`;
fs.writeFileSync(outputHtml, htmlTemplate, 'utf8');

console.log(`✅ Dashboard Analítica (HTML) gerada com sucesso!`);
console.log(`Caminho salvo: ${outputHtml}`);
