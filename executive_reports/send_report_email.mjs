import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Configuração do relatório gerado
const pdfFileName = 'Relatorio_Executivo_Premium.pdf';
const reportPath = path.join(process.cwd(), 'executive_reports', pdfFileName);

async function sendEmail() {
  if (!fs.existsSync(reportPath)) {
    console.error(`Erro: Arquivo do relatório não encontrado em ${reportPath}`);
    process.exit(1);
  }

  // Configuração do serviço SMTP
  let transporter = nodemailer.createTransport({
    host: 'mail.cednet.com.br', // Tentativa padrão baseada no DNS / Domínio
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: 'eduardov@cednet.com.br',
      pass: 'N@osei0102'
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: '"Relatórios JSM" <eduardov@cednet.com.br>',
    to: 'eduardov@grupocednet.com.br, eduardov@cednet.com.br', // Enviando para ambos os domínios
    subject: 'Resumo Mensal - Jira Service Management (MTTR e SLA)',
    html: `
      <h2>Resumo Mensal - Jira Service Management</h2>
      <p>Olá,</p>
      <p>Segue em anexo o relatório executivo mensal consolidado. O documento foca nas métricas principais:</p>
      <ul>
        <li>Volume de Incidentes e Mudanças</li>
        <li>Cumprimento de SLA de Resolução</li>
        <li>Ciclo de Vida (MTTR) detalhado</li>
      </ul>
      <p>Qualquer dúvida, por favor responda a este e-mail.</p>
      <br>
      <p>Atenciosamente,<br>Automação de Relatórios</p>
    `,
    attachments: [
      {
        filename: pdfFileName,
        path: reportPath,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    console.log(`📡 Tentando enviar o e-mail via mail.cednet.com.br porta 587...`);
    let info = await transporter.sendMail(mailOptions);
    console.log(`✅ E-mail enviado com sucesso: ${info.messageId}`);
  } catch (error) {
    console.log(`⚠️ Falha na primeira tentativa: ${error.message}`);
    console.log(`📡 Tentando alternativa: porta 465 (Secure)...`);

    transporter = nodemailer.createTransport({
      host: 'mail.cednet.com.br',
      port: 465,
      secure: true,
      auth: {
        user: 'eduardov@cednet.com.br',
        pass: 'N@osei0102'
      },
      tls: { rejectUnauthorized: false }
    });

    try {
      let info2 = await transporter.sendMail(mailOptions);
      console.log(`✅ E-mail enviado com sucesso com porta 465: ${info2.messageId}`);
    } catch (err2) {
      console.error(`❌ Erro definitivo ao enviar o e-mail:`, err2.message);
      process.exit(1);
    }
  }
}

sendEmail().catch(console.error);
