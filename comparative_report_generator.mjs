import fs from 'fs';
import path from 'path';

const reportsDir = path.join(process.cwd(), 'analytical_reports');
const outputCsv = path.join(reportsDir, 'canva_bulk_comparativo.csv');
const outputHtml = path.join(process.cwd(), 'executive_reports', 'comparative_dashboard.html');

console.log("Iniciando geração de relatório comparativo trimestral...\n");

// Regex para extrair dados da string CSV "Mês de 202x",100,100,"...",...
const parseCSVLine = (line) => {
    // Usando split primitivo pois sabemos que há aspas apenas nos textos
    const parts = line.split(',');
    return {
        mes: parts[0].replace(/"/g, '').trim(),
        criados: parseInt(parts[1], 10),
        resolvidos: parseInt(parts[2], 10),
        frTempo: parseFloat(parts[3].replace(/[A-Za-z" ]/g, '')),
        resTempo: parseFloat(parts[4].replace(/[A-Za-z" ]/g, '')),
        frPct: parseFloat(parts[5].replace(/[%"]/g, '')),
        resPct: parseFloat(parts[6].replace(/[%"]/g, ''))
    };
};

const mapMonthToDate = (mesRef) => {
    // Ex: "Fevereiro de 2026" ou "Fevereiro_2026"
    const lower = mesRef.toLowerCase();
    const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    let mIndex = 0;
    let year = 2020;
    months.forEach((m, i) => { if (lower.includes(m)) mIndex = i; });
    const match = lower.match(/\d{4}/);
    if (match) year = parseInt(match[0], 10);
    return new Date(year, mIndex, 1);
};

const files = fs.readdirSync(reportsDir).filter(f => f.startsWith('canva_bulk_') && f.endsWith('.csv') && !f.includes('comparativo'));

if (files.length === 0) {
    console.error("Nenhum arquivo canva_bulk encontrado.");
    process.exit(1);
}

const dataLog = [];

files.forEach(file => {
    const raw = fs.readFileSync(path.join(reportsDir, file), 'utf8');
    const lines = raw.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 2) {
        try {
            const data = parseCSVLine(lines[1]);
            dataLog.push(data);
        } catch (e) {
            console.error(`Erro ao parsear arquivo ${file}:`, e.message);
        }
    }
});

// Ordenar cronologicamente
dataLog.sort((a, b) => mapMonthToDate(a.mes) - mapMonthToDate(b.mes));

console.log(`Dados consolidados de ${dataLog.length} meses:`);
dataLog.forEach(d => console.log(`- ${d.mes}: ${d.criados} criados / ${d.frTempo}h Resp.`));

// Gerar CSV Comparativo (Wide Format)
const canvaHeader = [];
const canvaRow = [];

dataLog.forEach((d, i) => {
    const idx = i + 1;
    canvaHeader.push(`Mes_${idx}`, `Criados_${idx}`, `Resolvidos_${idx}`, `Tempo_Resp_${idx}`, `SLA_Resp_Pct_${idx}`);
    canvaRow.push(`"${d.mes}"`, d.criados, d.resolvidos, `"${d.frTempo.toFixed(2)}h"`, `"${d.frPct.toFixed(1)}%"`);
});

// Análise macro
const lastIndex = dataLog.length - 1;
const firstIndex = 0;
let analysis = `Comparativo do trimestre: `;
if (dataLog.length > 1) {
    const volDiff = dataLog[lastIndex].criados - dataLog[firstIndex].criados;
    if (volDiff > 0) analysis += `Observamos um aumento no volume de tickets de ${dataLog[firstIndex].criados} para ${dataLog[lastIndex].criados}. `;
    else analysis += `Notamos uma queda no volume de chamados de ${dataLog[firstIndex].criados} para ${dataLog[lastIndex].criados}. `;

    const slaDiff = dataLog[lastIndex].frPct - dataLog[firstIndex].frPct;
    if (slaDiff > 0) analysis += `A aprovação do SLA de primeira resposta melhorou em ${(slaDiff).toFixed(1)}%.`;
    else analysis += `A aprovação do SLA de primeira resposta teve uma variação de ${(slaDiff).toFixed(1)}%.`;
}

canvaHeader.push("Analise_Comparativa");
canvaRow.push(`"${analysis}"`);

fs.writeFileSync(outputCsv, canvaHeader.join(",") + "\n" + canvaRow.join(",") + "\n", 'utf8');
console.log(`✅ CSV Comparativo salvo em: ${outputCsv}`);

// Gerar HTML Dashboard
const labels = JSON.stringify(dataLog.map(d => d.mes));
const dataCriados = JSON.stringify(dataLog.map(d => d.criados));
const dataResolvidos = JSON.stringify(dataLog.map(d => d.resolvidos));
const dataSlaFr = JSON.stringify(dataLog.map(d => d.frPct));
const dataSlaRes = JSON.stringify(dataLog.map(d => d.resPct));
const dataTempoFr = JSON.stringify(dataLog.map(d => d.frTempo));
const dataTempoRes = JSON.stringify(dataLog.map(d => d.resTempo));

const htmlTemplate = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Dashboard Comparativo JSM</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Inter', sans-serif; background-color: #f4f5f7; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0; padding: 20px; }
        .chart-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 800px; height: 400px; margin-bottom: 20px;}
        h2 { color: #172B4D; text-align: center; }
    </style>
</head>
<body>
    <div class="chart-container">
        <h2>Comparativo de Volume Lado a Lado</h2>
        <canvas id="compVolumeChart"></canvas>
    </div>
    
    <div class="chart-container">
        <h2>Evolução do Cumprimento do SLA (%)</h2>
        <canvas id="compSlaChart"></canvas>
    </div>

    <div class="chart-container">
        <h2>Tempo Médio de Primeira Resposta (Horas)</h2>
        <canvas id="compFrTimeChart"></canvas>
    </div>

    <div class="chart-container">
        <h2>Tempo Médio de Resolução (Horas)</h2>
        <canvas id="compResTimeChart"></canvas>
    </div>

    <script>
        const ctxVol = document.getElementById('compVolumeChart').getContext('2d');
        new Chart(ctxVol, {
            type: 'bar',
            data: {
                labels: ${labels},
                datasets: [
                    { label: 'Chamados Criados', data: ${dataCriados}, backgroundColor: '#FF5630', borderRadius: 6 },
                    { label: 'Chamados Resolvidos', data: ${dataResolvidos}, backgroundColor: '#36B37E', borderRadius: 6 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        const ctxSla = document.getElementById('compSlaChart').getContext('2d');
        new Chart(ctxSla, {
            type: 'line',
            data: {
                labels: ${labels},
                datasets: [
                    { label: 'SLA 1ª Resposta Met %', data: ${dataSlaFr}, borderColor: '#0052CC', backgroundColor: '#0052CC', tension: 0.2, fill: false, borderWidth: 3 },
                    { label: 'SLA Resolução Met %', data: ${dataSlaRes}, borderColor: '#00B8D9', backgroundColor: '#00B8D9', tension: 0.2, fill: false, borderWidth: 3 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { min: 0, max: 100 } }
            }
        });

        const ctxFrTime = document.getElementById('compFrTimeChart').getContext('2d');
        new Chart(ctxFrTime, {
            type: 'line',
            data: {
                labels: ${labels},
                datasets: [
                    { label: 'Tempo Médio 1ª Resposta (h)', data: ${dataTempoFr}, borderColor: '#FFAB00', backgroundColor: '#FFAB00', tension: 0.2, fill: false, borderWidth: 3 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } }
            }
        });

        const ctxResTime = document.getElementById('compResTimeChart').getContext('2d');
        new Chart(ctxResTime, {
            type: 'line',
            data: {
                labels: ${labels},
                datasets: [
                    { label: 'Tempo Médio Resolução (h)', data: ${dataTempoRes}, borderColor: '#6554C0', backgroundColor: '#6554C0', tension: 0.2, fill: false, borderWidth: 3 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'bottom' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    </script>
</body>
</html>`;

fs.writeFileSync(outputHtml, htmlTemplate, 'utf8');
console.log(`✅ HTML Comparativo salvo em: ${outputHtml}`);
