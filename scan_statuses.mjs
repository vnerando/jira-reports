import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'recurring_analysis', 'raw_quarterly_data.json');
if (!fs.existsSync(inputPath)) {
    console.error('Dados não encontrados.');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const counts = {
    statuses: {},
    resolutions: {},
    total: data.issues.length
};

data.issues.forEach(issue => {
    const status = issue.fields.status?.name || 'N/A';
    const resolution = issue.fields.resolution?.name || 'Open/Unresolved';
    
    counts.statuses[status] = (counts.statuses[status] || 0) + 1;
    counts.resolutions[resolution] = (counts.resolutions[resolution] || 0) + 1;
});

console.log(JSON.stringify(counts, null, 2));
