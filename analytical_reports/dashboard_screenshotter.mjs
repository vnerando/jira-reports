// Execute com: node dashboard_screenshotter.mjs
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.join(process.cwd(), 'presentation_assets');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

const { MONTH_OFFSET = "1" } = process.env;
const offset = parseInt(MONTH_OFFSET);

const dataRelatorio = new Date();
dataRelatorio.setMonth(dataRelatorio.getMonth() - offset);
const mesRefStr = dataRelatorio.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
const tituloMes = mesRefStr.charAt(0).toUpperCase() + mesRefStr.slice(1);
const suffix = tituloMes.replace(/ /g, '_').replace(/de_/g, '');

const dashboards = [
    {
        name: 'Analitical',
        path: path.join(process.cwd(), 'analytical_reports', `dashboard_${suffix}.html`),
        selectors: ['#creatorChart', '#resolutionTimeChart', '#dailyFrTimeChart', '#dailyResTimeChart']
    },
    {
        name: 'Executive',
        path: path.join(process.cwd(), 'executive_reports', `executive_dashboard.html`),
        selectors: ['#volumeChart', '#slaChart']
    },
    {
        name: 'Comparative',
        path: path.join(process.cwd(), 'executive_reports', 'comparative_dashboard.html'),
        selectors: ['#compVolumeChart', '#compSlaChart', '#compFrTimeChart', '#compResTimeChart']
    }
];

(async () => {
    console.log("🚀 Iniciando captura de telas para o Canva...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    for (const dashboard of dashboards) {
        if (!fs.existsSync(dashboard.path)) {
            console.warn(`⚠️ Dashboard não encontrado: ${dashboard.path}`);
            continue;
        }

        console.log(`\nCarregando ${dashboard.name}...`);
        await page.goto(`file://${dashboard.path}`, { waitUntil: 'networkidle0' });
        
        // Aguarda animações do Chart.js
        await new Promise(r => setTimeout(r, 2000));

        for (const selector of dashboard.selectors) {
            const element = await page.$(selector);
            if (element) {
                // Se for o comparativo, não usa sufixo do mês específico
                const isComparative = dashboard.name === 'Comparative';
                const fileName = isComparative 
                    ? `${dashboard.name}_${selector.replace('#', '')}.png`
                    : `${dashboard.name}_${selector.replace('#', '')}_${suffix}.png`;
                    
                const filePath = path.join(screenshotDir, fileName);
                
                // Tirar print apenas do elemento do gráfico com fundo transparente (opcional) ou branco
                await element.screenshot({ path: filePath, omitBackground: false });
                console.log(`✅ Gráfico salvo: ${fileName}`);
            } else {
                console.warn(`❌ Elemento ${selector} não encontrado em ${dashboard.name}`);
            }
        }
    }

    await browser.close();
    console.log(`\n🎉 Todas as capturas foram salvas em: ${screenshotDir}`);
})();
