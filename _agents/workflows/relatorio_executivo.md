---
description: Como Gerar e Enviar o Relatório Executivo por E-mail
---

Este fluxo consolida a extração de métricas do JSM (Incidentes, Mudanças e Problemas), gera o Dashboard HTML, monta o PDF Premium com papel timbrado e dispara o e-mail de envio automático.

### Pré-requisitos
- Executar a partir da raiz do projeto (`jira-reports`).
- Dependências instaladas (`npm install`).

### Como Usar

Para rodar todo o processo de uma só vez:

```bash
node executive_reports/run_all.mjs
```

#### Passos que o script executa automaticamente:
1. **`executive_report_generator.mjs`**: Atualiza métricas e dados de volume de chamados por prioridades no `executive_dashboard.html`.
2. **`pdf_with_template.mjs`**: Abre o dashboard via Puppeteer e faz a fusão transparente com o arquivo `timbrado.pdf`.
3. **`send_report_email.mjs`**: Dispara o relatório via Nodemailer de forma segura por porta com fallback SMTP.

---

### Solução de Problemas (Troubleshooting)

#### ✉️ O E-mail não chegou?
- Verifique a pasta de **SPAM / Lixo Eletrônico** do destinatário no seu cliente corporativo.
- Confirme se a senha continua `N@osei0102` no arquivo `executive_reports/send_report_email.mjs` (linha 22).

#### ❌ Erro de Autenticação (`535 Incorrect authentication data`)?
- Significa que o servidor de E-mail (`mail.cednet.com.br`) rejeitou a senha. Verifique se o e-mail não expirou a validade ou exige criação de senha de aplicativo em painel administrativo da TI.
