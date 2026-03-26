import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
    try {
        console.log("=== Testando Dimensões do Dashboard ===");
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Ajustar viewport igual ao script original
        await page.setViewport({ width: 1200, height: 1200 });
        
        const htmlPath = `file://${path.resolve('executive_reports/executive_dashboard.html')}`;
        console.log(`Abrindo: ${htmlPath}`);
        
        await page.goto(htmlPath, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 2000)); // Esperar o Chart.js

        const metrics = await page.evaluate(() => {
            const el = document.querySelector('.dashboard-container');
            if (!el) return { error: "Elemento .dashboard-container não encontrado!" };

            const style = window.getComputedStyle(el);
            return {
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
                elWidth: el.getBoundingClientRect().width,
                elHeight: el.getBoundingClientRect().height,
                padding: style.padding,
                margin: style.margin,
                maxWidth: style.maxWidth,
                boxSizing: style.boxSizing
            };
        });

        console.log("\n📊 Métricas do contêiner:");
        console.log(JSON.stringify(metrics, null, 2));

        // Capturar tela para garantia visual
        const screenshotPath = path.resolve('dashboard_viewport_test.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`\n📸 Screenshot salvo em: ${screenshotPath}`);

        await browser.close();
    } catch (e) {
        console.error("Erro no teste:", e);
    }
})();
