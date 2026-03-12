// Execute com: node executive_report_generator.mjs

import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), 'raw_data', 'issues_by_type');
const reportPath = path.join(process.cwd(), 'executive_reports', 'executive_summary.md');

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

let markdownReport = `# Relatório Executivo - SLA Jira (${tituloDataStr})\n\n`;
markdownReport += `*Este relatório consolida o volume, tempo médio e taxas de violação de SLA por tipo de solicitação.*\n\n`;
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
        if (reporterId && assigneeId && reporterId === assigneeId) return false;
        return true;
    }
    return true;
}

files.forEach(file => {
  const filepath = path.join(outputDir, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const typeName = file.replace('type_', '').replace('.json', '').replace(/_+/g, ' ').trim().toUpperCase();
  
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
