import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'recurring_analysis', 'raw_quarterly_data.json');
const outputPath = path.join(process.cwd(), 'cancelled_analysis');

if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Identificar bots
const botNames = ['Automation for Jira', 'Jira Service Desk Widget', 'Jira Bot'];

function extractTextFromADF(adf) {
    if (!adf) return "";
    let text = "";
    if (typeof adf === 'string') return adf;
    if (adf.type === 'text' && adf.text) {
        text += adf.text;
    }
    if (adf.content && Array.isArray(adf.content)) {
        adf.content.forEach(c => {
            text += extractTextFromADF(c) + " ";
        });
    }
    return text.trim();
}

const canceled = data.issues.filter(i => {
    const res = i.fields.resolution?.name || '';
    return ['Não fazer', 'Duplicado', 'Rejeitado'].includes(res);
});

let markdown = `# Análise de Causas Raízes - Chamados Cancelados/Rejeitados\n\n`;
markdown += `Total de chamados analisados: ${canceled.length}\n\n`;

const motivos = {
    'Não fazer': [],
    'Duplicado': [],
    'Rejeitado': []
};

canceled.forEach(issue => {
    const res = issue.fields.resolution?.name;
    const comments = issue.fields.comment?.comments || [];
    
    let lastHumanComment = "Sem comentário registrado";
    // Search backwards for the last meaningful comment
    for (let i = comments.length - 1; i >= 0; i--) {
        const author = comments[i].author?.displayName || 'Unknown';
        if (!botNames.includes(author)) {
            const bodyText = extractTextFromADF(comments[i].body);
            if (!bodyText.includes("Notificação automática")) {
                lastHumanComment = bodyText;
                break;
            }
        }
    }
    
    // Add fallback if only automatic notifications exist, but take the first part of the text
    if (lastHumanComment === "Sem comentário registrado" && comments.length > 0) {
        lastHumanComment = "[Automático] " + extractTextFromADF(comments[comments.length - 1].body);
    }
    
    const cityField = issue.fields.customfield_10105;
    const city = cityField?.value || (typeof cityField === 'string' ? cityField : 'N/A');
    
    motivos[res].push({
        key: issue.key,
        city: city,
        summary: issue.fields.summary,
        comment: lastHumanComment
    });
});

Object.keys(motivos).forEach(res => {
    markdown += `## Resolução: ${res} (${motivos[res].length})\n\n`;
    if (motivos[res].length === 0) {
        markdown += `Nenhum chamado nesta categoria.\n\n`;
        return;
    }
    markdown += `| Chamado | Cidade | Resumo | Último Comentário (Causa) |\n`;
    markdown += `|---|---|---|---|\n`;
    
    motivos[res].forEach(m => {
        let cleanComment = m.comment.replace(/\n|\|/g, ' ').substring(0, 150);
        if (m.comment.length > 150) cleanComment += '...';
        markdown += `| ${m.key} | ${m.city} | ${m.summary} | ${cleanComment} |\n`;
    });
    
    markdown += `\n`;
});

fs.writeFileSync(path.join(outputPath, 'cancellation_causes.md'), markdown);
console.log('Gerado: cancelled_analysis/cancellation_causes.md');
