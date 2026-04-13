import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'recurring_analysis', 'raw_quarterly_data.json');
const outputPath = path.join(process.cwd(), 'recurring_analysis', 'report.md');
const csvPath = path.join(process.cwd(), 'recurring_analysis', 'recurring_data.csv');

function normalizeSummary(summary) {
    if (!summary) return "N/A";
    
    let str = summary.toLowerCase();
    
    // Lista de termos que indicam indisponibilidade
    const availabilityTerms = ['caiu', 'down', 'indisponivel', 'indisponível', 'off', 'queda', 'fora do ar', 'desconectado', 'offline', 'sem sinal'];
    
    const isAvailability = availabilityTerms.some(term => str.includes(term));
    if (isAvailability) {
        return "Indisponibilidade / Queda de Serviço";
    }
    
    // Limpeza de prefixos comuns e protocolos
    str = str.replace(/\[.*?\]/g, ''); // Remove [Tags]
    str = str.replace(/gc-\d+/g, ''); // Remove chaves de ticket
    str = str.replace(/re:|fwd:|resumo:|assunto:/g, ''); // Remove prefixos de email
    str = str.replace(/\d{8,}/g, ''); // Remove números longos (provavelmente protocolos)
    
    return str.trim() || summary;
}

function formatMillis(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
}

async function analyzeRecurrence() {
    try {
        console.log("Lendo dados trimestrais...");
        const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
        const issues = rawData.issues;
        
        console.log(`Analisando ${issues.length} chamados...`);
        
        const groups = {};
        
        issues.forEach(issue => {
            const city = issue.fields.customfield_10105?.value || "Não Informada";
            const rawSummary = issue.fields.summary;
            const normSummary = normalizeSummary(rawSummary);
            const created = new Date(issue.fields.created);
            
            const key = `${city} | ${normSummary}`;
            
            if (!groups[key]) {
                groups[key] = {
                    city,
                    summary: normSummary,
                    issues: []
                };
            }
            groups[key].issues.push({
                key: issue.key,
                rawSummary,
                created
            });
        });
        
        // Filtrar apenas os que aconteceram mais de uma vez
        const recurring = Object.values(groups)
            .filter(g => g.issues.length > 1)
            .sort((a, b) => b.issues.length - a.issues.length);
            
        console.log(`Encontrados ${recurring.length} grupos recorrentes.`);
        
        let reportMd = "# Relatório de Recorrência e Tempo Entre Falhas (TBF)\n";
        reportMd += `Período: 01/01/2026 a 31/03/2026\n\n`;
        reportMd += "| Localidade | Resumo Normalizado | Ocorrências | TBF Médio | Detalhes |\n";
        reportMd += "| :--- | :--- | :---: | :---: | :--- |\n";
        
        let csvContent = "Cidade,Resumo,Ocorrencias,TB_Medio_Horas\n";
        
        recurring.forEach(group => {
            // Sort issues by date
            group.issues.sort((a, b) => a.created - b.created);
            
            let totalTbf = 0;
            let intervals = [];
            
            for (let i = 1; i < group.issues.length; i++) {
                const diff = group.issues[i].created - group.issues[i-1].created;
                totalTbf += diff;
                intervals.push(diff);
            }
            
            const avgTbf = totalTbf / intervals.length;
            const avgHours = (avgTbf / (1000 * 60 * 60)).toFixed(1);
            
            reportMd += `| ${group.city} | ${group.summary} | ${group.issues.length} | ${formatMillis(avgTbf)} | ${group.issues.map(i => i.key).join(', ')} |\n`;
            csvContent += `"${group.city}","${group.summary}",${group.issues.length},${avgHours}\n`;
        });
        
        fs.writeFileSync(outputPath, reportMd);
        fs.writeFileSync(csvPath, csvContent);
        
        console.log(`\n✅ Análise concluída!`);
        console.log(`Relatório Markdown: ${outputPath}`);
        console.log(`Dados CSV: ${csvPath}`);
        
    } catch (error) {
        console.error("Erro na análise:", error);
    }
}

analyzeRecurrence();
