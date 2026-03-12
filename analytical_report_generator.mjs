// Execute com: node analytical_report_generator.mjs

import fs from 'fs';
import path from 'path';

const inputDir = path.join(process.cwd(), 'issues_by_type');
const outputReport = path.join(process.cwd(), 'analytical_reports', 'Relatorio_Analitico_Completo.csv');

// Verifica se a pasta existe antes de avançar
if (!fs.existsSync(inputDir)) {
  console.error(`O diretório de dados ${inputDir} não existe. Execute o issue_separator.mjs primeiro.`);
  process.exit(1);
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

files.forEach(file => {
  const filepath = path.join(inputDir, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  data.forEach(issue => {
    // Escapar aspas duplas e quebras de linha para evitar quebra no CSV
    const escapeCsv = (str) => `"${(str || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    const key = issue.key;
    const type = issue.fields.issuetype?.name || "N/A";
    const summary = issue.fields.summary || "N/A";
    const status = issue.fields.status?.name || "N/A";
    const creator = issue.fields.creator?.displayName || "N/A";
    const assignee = issue.fields.assignee?.displayName || "N/A";
    const resolution = issue.fields.resolution?.name || "Em Aberto";
    const createdDate = new Date(issue.fields.created).toLocaleString('pt-BR');

    // Analisando SLA 1 - Primeira Resposta
    let firstResponseBreached = "N/A";
    let firstResponseTime = "N/A";
    const frSla = issue.fields.customfield_10033;
    if (frSla && frSla.completedCycles && frSla.completedCycles.length > 0) {
      const lastCycle = frSla.completedCycles[frSla.completedCycles.length - 1];
      firstResponseBreached = lastCycle.breached ? "SIM" : "NAO";
      firstResponseTime = lastCycle.elapsedTime?.friendly || "0m";
    }

    // Analisando SLA 2 - Resolução Final
    let resolutionBreached = "N/A";
    let resolutionTime = "N/A";
    const resSla = issue.fields.customfield_10032;
    if (resSla && resSla.completedCycles && resSla.completedCycles.length > 0) {
      const lastCycle = resSla.completedCycles[resSla.completedCycles.length - 1];
      resolutionBreached = lastCycle.breached ? "SIM" : "NAO";
      resolutionTime = lastCycle.elapsedTime?.friendly || "0m";
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

console.log(`\n===========================================`);
console.log(`✅ Relatório Analítico tabular gerado com sucesso!`);
console.log(`Caminho salvo: ${outputReport}`);
console.log(`===========================================\n`);
