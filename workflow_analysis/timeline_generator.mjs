import fs from 'fs';
import path from 'path';

const {
  MONTH_OFFSET = "1"
} = process.env;

const offset = parseInt(MONTH_OFFSET);
const summaryFilePath = path.join('workflow_analysis', `workflow_summary_offset_${offset}.json`);

function runTimelineAnalysis() {
  if (!fs.existsSync(summaryFilePath)) {
      console.error(`Erro: Sumário não encontrado em ${summaryFilePath}`);
      process.exit(1);
  }

  const issues = JSON.parse(fs.readFileSync(summaryFilePath, 'utf8'));

  // Estrutura de agregação por Tipo de Chamado
  const metrics = {};

  // Mapeamento de Status para as Métricas (Baseado nos seus workflows)
  const STATUS_MAPPING = {
      // 1. RESPONSE (Tempo para responder/alocar)
      response: ["Open", "Waiting for support", "Review", "Planning"],
      // 2. REPAIR (Tempo de correção ativa)
      repair: ["Work in progress", "Implementing", "Em andamento", "Under investigation", "In Progress"],
      // 3. RESOLUTION / WAITING (Espera ou finalização)
      waiting: ["Pending", "Authorize", "Awaiting implementation", "Under review"],
      resolved: ["Completed", "Resolved", "Closed"]
  };

  issues.forEach(issue => {
      const type = issue.type;
      const transitions = issue.transitions;
      const createdAt = new Date(issue.created);

      if (!metrics[type]) {
          metrics[type] = {
              totalTickets: 0,
              createdDates: [],
              sumResponseHours: 0, countResponse: 0,
              sumRepairHours: 0, countRepair: 0,
              sumWaitingHours: 0, countWaiting: 0,
              sumTotalResolutionHours: 0, countResolved: 0
          };
      }

      metrics[type].totalTickets += 1;
      metrics[type].createdDates.push(createdAt);

      if (transitions.length === 0) return;

      let currentStatus = transitions[0].from;
      let prevTime = createdAt;
      let issueResponse = 0;
      let issueRepair = 0;
      let issueWaiting = 0;

      transitions.forEach(t => {
          const transitionTime = new Date(t.date);
          const duration = (transitionTime - prevTime) / (1000 * 60 * 60); // em horas

          if (duration >= 0) {
              if (STATUS_MAPPING.response.includes(currentStatus)) issueResponse += duration;
              else if (STATUS_MAPPING.repair.includes(currentStatus)) issueRepair += duration;
              else if (STATUS_MAPPING.waiting.includes(currentStatus)) issueWaiting += duration;
          }

          currentStatus = t.to;
          prevTime = transitionTime;
      });

      // Se o chamado foi resolvido (existe transição para status de resolução)
      const hasResolved = transitions.some(t => STATUS_MAPPING.resolved.includes(t.to));
      if (hasResolved) {
          metrics[type].sumResponseHours += issueResponse;
          metrics[type].countResponse += 1;

          metrics[type].sumRepairHours += issueRepair;
          metrics[type].countRepair += 1;

          metrics[type].sumWaitingHours += issueWaiting;
          metrics[type].countWaiting += 1;

          metrics[type].sumTotalResolutionHours += (issueResponse + issueRepair + issueWaiting);
          metrics[type].countResolved += 1;
      }
  });

  // Cálculo de MTBF (Mean Time Between Failures)
  Object.keys(metrics).forEach(type => {
      const dates = metrics[type].createdDates.sort((a, b) => a - b);
      let totalIntervalHours = 0;
      let countIntervals = 0;

      for (let i = 1; i < dates.length; i++) {
          const interval = (dates[i] - dates[i-1]) / (1000 * 60 * 60);
          totalIntervalHours += interval;
          countIntervals += 1;
      }

      metrics[type].mtbf = countIntervals > 0 ? (totalIntervalHours / countIntervals) : 0;
      metrics[type].mttrResponse = metrics[type].countResponse > 0 ? (metrics[type].sumResponseHours / metrics[type].countResponse) : 0;
      metrics[type].mttrRepair = metrics[type].countRepair > 0 ? (metrics[type].sumRepairHours / metrics[type].countRepair) : 0;
      metrics[type].mttrWaiting = metrics[type].countWaiting > 0 ? (metrics[type].sumWaitingHours / metrics[type].countWaiting) : 0;
      metrics[type].mttrResolution = metrics[type].countResolved > 0 ? (metrics[type].sumTotalResolutionHours / metrics[type].countResolved) : 0;
  });

  // Gerar HTML Dashboard
  const htmlContent = generateDashboardHTML(metrics, offset);
  const htmlPath = path.join('workflow_analysis', `dashboard_timeline_offset_${offset}.html`);
  fs.writeFileSync(htmlPath, htmlContent);
  console.log(`✅ Dashboard Timeline criado: ${htmlPath}`);

  // Retornar um backup JSON
  const metricsPath = path.join('workflow_analysis', `metrics_summary_offset_${offset}.json`);
  fs.writeFileSync(metricsPath, JSON.stringify(metrics, null, 2));
}

function generateDashboardHTML(metrics, offset) {
const labels = Object.keys(metrics);
const mttrResponse = labels.map(l => metrics[l].mttrResponse.toFixed(1));
const mttrRepair = labels.map(l => metrics[l].mttrRepair.toFixed(1));
const mttrWaiting = labels.map(l => metrics[l].mttrWaiting.toFixed(1));
const mtbf = labels.map(l => metrics[l].mtbf.toFixed(1));

return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Timeline Dashboard - Métricas de Chamados</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; margin: 20px; }
        .container { max-width: 1100px; margin: 0 auto; background: #161b22; padding: 20px; border-radius: 12px; border: 1px solid #30363d; }
        h1 { text-align: center; color: #58a6ff; margin-bottom: 30px; }
        .cards { display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 30px; justify-content: space-around; }
        .card { background: #21262d; border: 1px solid #30363d; padding: 15px; border-radius: 8px; flex: 1; min-width: 200px; text-align: center; }
        .card h3 { margin: 0; font-size: 14px; color: #8b949e; }
        .card p { font-size: 24px; font-weight: bold; margin: 8px 0; color: #58a6ff; }
        .chart-box { background: #161b22; padding: 15px; border-radius: 10px; border: 1px solid #30363d; margin-top: 20px; height: 500px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Timeline Metrics Dashboard (Offset ${offset})</h1>
        <div class="cards">
            <div class="card"><h3>Total Incidentes</h3><p>${metrics["[System] Incident"] ? metrics["[System] Incident"].totalTickets : 0}</p></div>
            <div class="card"><h3>MTBR (Incident)</h3><p>${metrics["[System] Incident"] ? metrics["[System] Incident"].mttrResponse.toFixed(1) + "h" : "N/A"}</p></div>
            <div class="card"><h3>MTR (Incident)</h3><p>${metrics["[System] Incident"] ? metrics["[System] Incident"].mttrRepair.toFixed(1) + "h" : "N/A"}</p></div>
            <div class="card"><h3>MTDA (MTBF aprox)</h3><p>${metrics["[System] Incident"] ? metrics["[System] Incident"].mtbf.toFixed(1) + "h" : "N/A"}</p></div>
        </div>

        <div class="chart-box">
            <canvas id="timelineChart"></canvas>
        </div>
    </div>

    <script>
        const ctx = document.getElementById('timelineChart').getContext('2d');
        const labels = ${JSON.stringify(labels)};
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'MTTR-R (Response)', data: ${JSON.stringify(mttrResponse)}, backgroundColor: '#b08d07' },
                    { label: 'MTR (Repair/Investigate)', data: ${JSON.stringify(mttrRepair)}, backgroundColor: '#238636' },
                    { label: 'Awaiting / Blocks', data: ${JSON.stringify(mttrWaiting)}, backgroundColor: '#8957e5' }
                ]
            },
            options: {
                indexAxis: 'y', // Barra Horizontal ( proposta da Timeline )
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, title: { display: true, text: 'Horas Decorridas', color: '#8b949e' }, grid: { color: '#30363d' }, ticks: { color: '#c9d1d9' } },
                    y: { stacked: true, grid: { color: '#30363d' }, ticks: { color: '#c9d1d9' } }
                },
                plugins: {
                    legend: { position: 'top', labels: { color: '#c9d1d9' } },
                    tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': ' + context.raw + ' horas'; } } }
                }
            }
        });
    </script>
</body>
</html>
`;
}

runTimelineAnalysis();
