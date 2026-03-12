// Execute com: node --env-file=.env email_dispatcher.mjs

import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Carrega as variáveis do .env
const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    console.error("Erro: Credenciais SMTP não encontradas no arquivo .env.");
    console.error("Certifique-se de preencher: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD");
    process.exit(1);
}

// Configurações do e-mail
const destinatarios = 'SuaListaDeGestores@grupocednet.com.br'; // <-- DEFINA AQUI QUEM VAI RECEBER
const linkGoogleSheets = 'https://docs.google.com/spreadsheets/d/1vn3ld1sM4nQWk5LZyK1KviCai60x875Vdt3MHfN3eZE/edit?usp=sharing';

// Arquivo do relatório a ser anexado
const pdfPath = path.join(process.cwd(), 'executive_reports', 'Relatorio_Executivo_Jira.pdf');

// Descobre o mês corrente para colocar no título do e-mail
const dataAtual = new Date();
dataAtual.setMonth(dataAtual.getMonth() - 1);
const mesReferencia = dataAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
const tituloMes = mesReferencia.charAt(0).toUpperCase() + mesReferencia.slice(1);

const htmlTemplate = `
<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; line-height: 1.6;">
    <h2 style="color: #2684FF;">Relatório de SLA e Volumetria - ${tituloMes}</h2>
    <p>Olá equipe,</p>
    <p>O relatório mensal de acompanhamento de Service Level Agreement (SLA) do Grupo Cednet para o Operations Center acaba de ser gerado.</p>
    
    <div style="background-color: #f4f5f7; border-left: 4px solid #2684FF; padding: 15px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #172b4d;">📊 Acessos Rápidos</h4>
        <ul style="margin-bottom: 0;">
            <li><strong>Relatório Executivo PDF:</strong> Em anexo neste e-mail.</li>
            <li><strong>Dados Analíticos (CSV):</strong> O detalhamento linha a linha já foi atualizado automaticamente no nosso Docs corporativo. <br><a href="${linkGoogleSheets}" target="_blank" style="color: #2684FF; text-decoration: none; font-weight: bold;">Acessar Google Sheets Diário</a></li>
        </ul>
    </div>
    
    <p>Os painéis em HTML contendo a visão de Criadores (Bots x Humanos) e as Evoluções Diárias Filtradas estão disponíveis no servidor corporativo para consulta técnica.</p>
    <hr style="border: none; border-top: 1px solid #dfe1e6; margin: 30px 0;">
    <p style="font-size: 12px; color: #7a869a;">Este é um e-mail automático gerado pela automação Node.js do Jira Reports. Por favor não responda.</p>
</div>
`;

// Criação do Transporter (Motor de Envio)
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: parseInt(SMTP_PORT) === 465, // true para 465, false para outras portas
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD
    }
});

async function dispararEmail() {
    console.log(`📡 Conectando ao host SMTP: ${SMTP_HOST}:${SMTP_PORT} usando ${SMTP_USER}...`);
    try {
        const info = await transporter.sendMail({
            from: `"Jira Reports Automatizado" <${SMTP_USER}>`,
            to: destinatarios,
            subject: `[Jira Relatório] SLAs e Métricas - ${tituloMes}`,
            html: htmlTemplate,
            attachments: [
                {
                    filename: `Relatório_Executivo_Jira_${tituloMes.replace(' ', '_')}.pdf`,
                    path: pdfPath
                }
            ]
        });

        console.log("✅ E-mail enviado com sucesso!");
        console.log(`-> Identificador: ${info.messageId}`);
    } catch (error) {
        console.error("❌ Falha crítica ao enviar o e-mail.", error);
    }
}

dispararEmail();
