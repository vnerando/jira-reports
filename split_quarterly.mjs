import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'recurring_analysis', 'raw_quarterly_data.json');
const outputDir = path.join(process.cwd(), 'issues_by_type');

if (!fs.existsSync(inputPath)) {
    console.error('Arquivo raw_quarterly_data.json não encontrado.');
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_]/gi, '_').replace(/_+/g, '_').toLowerCase();
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const issuesByType = {};

data.issues.forEach(issue => {
    const typeName = issue.fields?.issuetype?.name || "Desconhecido";
    if (!issuesByType[typeName]) {
        issuesByType[typeName] = [];
    }
    issuesByType[typeName].push(issue);
});

// Limpar diretório
fs.readdirSync(outputDir).forEach(f => {
    if (f.endsWith('.json')) fs.unlinkSync(path.join(outputDir, f));
});

for (const [type, issues] of Object.entries(issuesByType)) {
    const filename = `type_${sanitizeFilename(type)}.json`;
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(issues, null, 2));
    console.log(`Salvo: ${filename} (${issues.length} issues)`);
}
