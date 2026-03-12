// Execute com: node pdf_exporter.mjs

import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
    try {
        console.log("Iniciando motor PDF (Puppeteer)...");
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Define viewport tamanho A4 paisagem
        await page.setViewport({ width: 1280, height: 1024 });

        const htmlPath = `file://${path.join(process.cwd(), 'executive_reports', 'executive_dashboard.html')}`;
        console.log(`Carregando Dashboard: ${htmlPath}`);

        // Acessa o HTML e aguarda o carregamento total inclusive da rede (Chart.js)
        await page.goto(htmlPath, { waitUntil: 'networkidle0' });

        // Aguarda 2 segundos extras para garantir que a animação inicial do Chart.js finalizou
        console.log("Aguardando renderização dos gráficos Chart.js...");
        await new Promise(r => setTimeout(r, 2000));

        const outputPath = path.join(process.cwd(), 'executive_reports', 'Relatorio_Executivo_Jira.pdf');
        
        console.log("Gerando arquivo PDF...");
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        await browser.close();
        console.log(`\n✅ Sucesso! Relatório Executivo PDF salvo em: \n${outputPath}`);
        console.log("Você já pode abrí-lo ou enviar por e-mail.");

    } catch (error) {
        console.error("Erro ao gerar o PDF:", error);
    }
})();
