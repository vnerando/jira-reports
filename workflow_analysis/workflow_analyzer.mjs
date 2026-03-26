import fs from 'fs';
import path from 'path';

const {
  MONTH_OFFSET = "1"
} = process.env;

const offset = parseInt(MONTH_OFFSET);
const summaryFilePath = path.join('workflow_analysis', `workflow_summary_offset_${offset}.json`);

function runAnalysis() {
  if (!fs.existsSync(summaryFilePath)) {
      console.error(`Erro: Arquivo de sumário não encontrado em ${summaryFilePath}. Execute o extractor primeiro.`);
      process.exit(1);
  }

  const issues = JSON.parse(fs.readFileSync(summaryFilePath, 'utf8'));
  console.log(`Processando ${issues.length} chamados para análise...\n`);

  // Estrutura: { [issueType]: { [status]: { totalHours: 0, count: 0 } } }
  const aggregation = {};

  issues.forEach(issue => {
      const type = issue.type;
      const transitions = issue.transitions;
      const createdAt = new Date(issue.created);

      if (!aggregation[type]) {
          aggregation[type] = {};
      }

      if (transitions.length === 0) {
          // Chamado sem nenhuma transição registrado no rastreador
          return;
      }

      // 1. Identificar o Status Inicial
      // O 'from' da primeira transição geralmente indica qual era o status inicial.
      let currentStatus = transitions[0].from;
      let prevTime = createdAt;

      transitions.forEach(t => {
          const transitionTime = new Date(t.date);
          const durationMs = transitionTime - prevTime;
          const durationHours = durationMs / (1000 * 60 * 60);

          if (durationHours >= 0) { // Evitar anomalias de fuso
              if (!aggregation[type][currentStatus]) {
                  aggregation[type][currentStatus] = { totalHours: 0, count: 0 };
              }
              aggregation[type][currentStatus].totalHours += durationHours;
              aggregation[type][currentStatus].count += 1;
          }

          // Atualiza para o próximo passo
          currentStatus = t.to;
          prevTime = transitionTime;
      });
  });

  // 3. Formatar os resultados e calcular as Médias
  const reportLines = [];
  reportLines.push(`# 📊 Análise de Workflow - Mês Anterior (Offset ${offset})`);
  reportLines.push(`*Dados extraídos de ${issues.length} chamados.*\n`);

  Object.keys(aggregation).forEach(type => {
      reportLines.push(`## 📌 Tipo de Chamado: \`${type}\``);
      reportLines.push(`| Status do Workflow | Tempo Médio Retido (Horas) | Ocorrências | Total Acumulado (Horas) |`);
      reportLines.push(`| :--- | :--- | :--- | :--- |`);

      const statusMap = aggregation[type];
      
      // Ordenar por maior tempo médio para destacar o gargalo
      const sortedStatus = Object.keys(statusMap).map(status => {
          const data = statusMap[status];
          const avg = data.count > 0 ? (data.totalHours / data.count) : 0;
          return { status, avg, count: data.count, total: data.totalHours };
      }).sort((a, b) => b.avg - a.avg);

      sortedStatus.forEach(item => {
          reportLines.push(`| **${item.status}** | ${item.avg.toFixed(2)}h | ${item.count} | ${item.total.toFixed(2)}h |`);
      });

      reportLines.push("\n");
  });

  const reportPath = path.join('workflow_analysis', `analise_workflow_offset_${offset}.md`);
  fs.writeFileSync(reportPath, reportLines.join('\n'));
  console.log(`✅ Relatório analítico gerado: ${reportPath}`);

  // Print resumido no console
  console.log("\n=== Resumo das Médias de Tempo ===");
  Object.keys(aggregation).forEach(type => {
      console.log(`\n🔹 ${type}:`);
      Object.keys(aggregation[type]).forEach(status => {
          const item = aggregation[type][status];
          const avg = item.totalHours / item.count;
          if (avg > 1) { // Só printar os que dão mais de 1 hora no terminal para não poluir
              console.log(` - ${status}: ${avg.toFixed(1)} horas (Média baseada em ${item.count} transições)`);
          }
      });
  });
}

runAnalysis();
