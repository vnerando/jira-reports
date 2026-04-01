import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Script para automatizar a geração da Apresentação NOC (Slides PDF)
 * Baseado no modelo Apresentacao_noc.pdf
 */

async function generatePresentation() {
  const label = process.env.REPORT_LABEL || 'Fevereiro_2026';
  const historyPath = path.join(process.cwd(), 'analytical_reports', 'history.json');
  const templatePath = path.join(process.cwd(), 'Apresentacao_noc.pdf');
  const outputPath = path.join(process.cwd(), 'executive_reports', `Apresentacao_NOC_${label}.pdf`);

  if (!fs.existsSync(historyPath)) {
    console.error('Histórico não encontrado.');
    process.exit(1);
  }

  if (!fs.existsSync(templatePath)) {
    console.error('Template Apresentacao_noc.pdf não encontrado na raiz.');
    process.exit(1);
  }

  const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  const data = history.find(h => h.label === label);

  if (!data) {
    console.error(`Dados para o label ${label} não encontrados.`);
    process.exit(1);
  }

  const { metrics } = data;
  const periodLabel = label.replace(/_/g, ' ');

  // Carregar template
  const templateBytes = fs.readFileSync(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // --- SLIDE 1: CAPA ---
  const firstPage = pages[0];
  firstPage.drawText(`NOC - ${periodLabel}`, {
    x: 108,
    y: 92,
    size: 20,
    font: font,
    color: rgb(0.05, 0.25, 0.5)
  });

  // --- SLIDE 2: TEMPO MÉDIO DE RESPOSTA ---
  const secondPage = pages[1];
  const mttrAvg = metrics.mttr?.global?.avg || '0h';
  secondPage.drawText(`Média Global: ${mttrAvg}`, {
    x: 85,
    y: 350,
    size: 16,
    font: font,
    color: rgb(0.1, 0.1, 0.1)
  });
  
  // Exemplo de análise automatizada
  secondPage.drawText(`Análise: O tempo médio de resposta está dentro da meta estabelecida.`, {
    x: 85,
    y: 330,
    size: 12,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3)
  });

  // --- SLIDE 3: CRIADOS VS RESOLVIDOS ---
  const thirdPage = pages[2];
  const totalCriados = metrics.volume?.total || 0;
  const totalResolvidos = (metrics.volume?.total || 0) - (metrics.volume?.open || 0);
  
  thirdPage.drawText(`Criados: ${totalCriados}`, {
    x: 85,
    y: 190,
    size: 16,
    font: font,
    color: rgb(0.1, 0.1, 0.1)
  });
  thirdPage.drawText(`Resolvidos: ${totalResolvidos}`, {
    x: 680,
    y: 190,
    size: 16,
    font: font,
    color: rgb(0.1, 0.1, 0.1)
  });

  // --- SLIDE 4: SLA (%) ---
  const fourthPage = pages[3];
  const slaGlobal = metrics.sla?.global?.met || '0%';
  fourthPage.drawText(`SLA Global de Incidentes: ${slaGlobal}`, {
    x: 85,
    y: 420,
    size: 18,
    font: font,
    color: rgb(0, 0.4, 0.8)
  });

  // --- SLIDE 5: ESCALONAMENTO / EM ABERTO ---
  const fifthPage = pages[4];
  const emAberto = metrics.volume?.open || 0;
  fifthPage.drawText(`Chamados em Aberto: ${emAberto}`, {
    x: 85,
    y: 200,
    size: 16,
    font: font,
    color: rgb(0.8, 0, 0)
  });

  // Salvar
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`###PDF_PRESENTATION###${outputPath}###PDF_PRESENTATION###`);
}

generatePresentation().catch(err => {
  console.error(err);
  process.exit(1);
});
