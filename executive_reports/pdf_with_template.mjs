import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        console.log("=== Iniciando Geração de PDF com Papel Timbrado ===");

        const htmlPath = `file://${path.join(process.cwd(), 'executive_reports', 'executive_dashboard.html')}`;
        const templatePath = path.join(process.cwd(), 'timbrado.pdf');
        const outputPath = path.join(process.cwd(), 'executive_reports', 'Relatorio_Executivo_Premium.pdf');

        if (!fs.existsSync(templatePath)) {
            console.error(`Erro: Arquivo timbreado não encontrado em: ${templatePath}`);
            process.exit(1);
        }

        // 1. Renderizar o Dashboard HTML via Puppeteer
        console.log("-> Renderizando Dashboard HTML com Puppeteer...");
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 1200 }); // Dashboard ideal

        await page.goto(htmlPath, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 2000)); // Espera animações do Chart.js

        const dashboardPdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true, // Mantém cores transparentes por garantia
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });

        await browser.close();

        // 2. Mesclar o Dashboard com o Papel Timbrado usando pdf-lib
        console.log("-> Mesclando com o arquivo timbrado.pdf...");

        const templatePdfBytes = fs.readFileSync(templatePath);
        const dashboardPdfBytes = dashboardPdfBuffer;

        const mainPdfDoc = await PDFDocument.load(templatePdfBytes);
        const dashPdfDoc = await PDFDocument.load(dashboardPdfBytes);

        // Pega a primeira página do papel timbrado para usar como template de fundo
        const templatePage = mainPdfDoc.getPages()[0];

        // Copia a página do Dashboard para o documento principal
        const [dashPage] = await mainPdfDoc.embedPdf(dashboardPdfBytes, [0]); // Pega a pág 1

        // Desenha o dashboard por cima do Papel Timbrado
        // Se o body no HTML for transparente, o logo do timbrado aparecerá por baixo!
        const { width, height } = templatePage.getSize();

        templatePage.drawPage(dashPage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
        });

        const mergedPdfBytes = await mainPdfDoc.save();
        let finalPath = outputPath;
        try {
            fs.writeFileSync(finalPath, mergedPdfBytes);
        } catch (e) {
            if (e.code === 'EBUSY') {
                const timestamp = Date.now();
                const dir = path.dirname(outputPath);
                const ext = path.extname(outputPath);
                const base = path.basename(outputPath, ext);
                finalPath = path.join(dir, `${base}_${timestamp}${ext}`);
                fs.writeFileSync(finalPath, mergedPdfBytes);
                console.log(`\n⚠️ Arquivo estava bloqueado por outro programa. Salvo em cópia: \n${finalPath}`);
            } else {
                throw e;
            }
        }

        console.log(`\n✅ Relatório Executivo Premium salvo em: \n${finalPath}`);

    } catch (error) {
        console.error("Falha ao gerar o PDF consolidado:", error);
    }
})();
