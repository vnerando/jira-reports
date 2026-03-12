// Execute com o comando no terminal: node average_time_analyzer.mjs

import fs from 'fs';
import path from 'path';

const outputDir = path.join(process.cwd(), 'issues_by_type');

// Função auxiliar para converter milissegundos num formato amigável (Dias, Horas, Minutos)
function formatMillisToFriendly(millis) {
  if (isNaN(millis)) return "N/A";
  
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

// Analisando cada arquivo de Issue Type isolado
if (!fs.existsSync(outputDir)) {
  console.error(`O diretório ${outputDir} não existe. Rode o issue_separator.mjs primeiro.`);
  process.exit(1);
}

const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));

console.log("Analisando Tempo Médio por Issue Type (Mês Passado)\n");

files.forEach(file => {
  const filepath = path.join(outputDir, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  
  const metrics = {
    firstResponse: { totalMillis: 0, count: 0 }, // customfield_10033
    resolution: { totalMillis: 0, count: 0 }     // customfield_10032
  };

  data.forEach(issue => {
    // 1. Time to first response (customfield_10033)
    const firstResponseSla = issue.fields.customfield_10033;
    if (firstResponseSla && firstResponseSla.completedCycles && firstResponseSla.completedCycles.length > 0) {
      // Pega o último ciclo completo de resposta do ticket
      const lastCycle = firstResponseSla.completedCycles[firstResponseSla.completedCycles.length - 1];
      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
        metrics.firstResponse.totalMillis += lastCycle.elapsedTime.millis;
        metrics.firstResponse.count++;
      }
    }

    // 2. Time to resolution (customfield_10032)
    const resolutionSla = issue.fields.customfield_10032;
    if (resolutionSla && resolutionSla.completedCycles && resolutionSla.completedCycles.length > 0) {
      // Pega o último ciclo completo de resolução do ticket
      const lastCycle = resolutionSla.completedCycles[resolutionSla.completedCycles.length - 1];
      if (lastCycle.elapsedTime && lastCycle.elapsedTime.millis !== undefined) {
        metrics.resolution.totalMillis += lastCycle.elapsedTime.millis;
        metrics.resolution.count++;
      }
    }
  });

  const typeName = file.replace('type_', '').replace('.json', '');
  console.log(`===========================================`);
  console.log(`🟢 Issue Type: ${typeName.toUpperCase()} (${data.length} tickets na base)`);
  
  if (metrics.firstResponse.count > 0) {
    const avgFR = metrics.firstResponse.totalMillis / metrics.firstResponse.count;
    console.log(`   -> Méd. Primeira Resposta : ${formatMillisToFriendly(avgFR)} (Amostra de ${metrics.firstResponse.count} tickets)`);
  } else {
    console.log(`   -> Méd. Primeira Resposta : Não aplicável ou sem amostra`);
  }

  if (metrics.resolution.count > 0) {
    const avgRes = metrics.resolution.totalMillis / metrics.resolution.count;
    console.log(`   -> Méd. Resolução Ticket  : ${formatMillisToFriendly(avgRes)} (Amostra de ${metrics.resolution.count} tickets)`);
  } else {
    console.log(`   -> Méd. Resolução Ticket  : Não aplicável ou sem amostra`);
  }
  
  console.log(""); // Spacing
});
