import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("=== 🚀 Iniciando Geração Unificada do Relatório Executivo ===");

try {
    // 1. Executar o timeline generator
    console.log("\n-> 📊 Calculando métricas de MTTR e Timeline...");
    execSync('node --env-file=credentials/.env workflow_analysis/timeline_generator.mjs', { stdio: 'inherit' });

    // 2. Executar o executive dashboard generator
    console.log("\n-> 📄 Atualizando dados dinâmicos do Dashboard HTML...");
    execSync('node --env-file=credentials/.env executive_reports/executive_report_generator.mjs', { stdio: 'inherit' });

    // 3. Executar o mesclador com Papel Timbrado
    console.log("\n-> 📑 Mesclando dados dinâmicos com o Papel Timbrado...");
    execSync('node executive_reports/pdf_with_template.mjs', { stdio: 'inherit' });

    // 4. Copiar o arquivo final para a pasta raiz com Timestamp para evitar travas do Reader
    const sourceDir = path.join(process.cwd(), 'executive_reports');
    const files = fs.readdirSync(sourceDir).filter(f => f.startsWith('Relatorio_Executivo_Premium') && f.endsWith('.pdf'));

    if (files.length > 0) {
        // Encontrar o mais recente
        const newest = files.map(f => ({ name: f, time: fs.statSync(path.join(sourceDir, f)).mtime }))
                            .sort((a, b) => b.time - a.time)[0].name;

        const sourcePdf = path.join(sourceDir, newest);
        const timestamp = Date.now();
        const destPdf = path.join(process.cwd(), `Relatorio_Final_Timbrado_${timestamp}.pdf`);

        fs.copyFileSync(sourcePdf, destPdf);
        console.log(`\n✅ SUCESSO! Relatório pronto e salvo na pasta raiz:`);
        console.log(`➡️ ${destPdf}`);
    } else {
         console.error("\n❌ Erro: O arquivo mesclado não foi encontrado.");
    }

} catch (error) {
    console.error("\n❌ Falha durante a execução do script:", error.message);
}
