---
name: jsm_reporting_export
description: Regras e padrões para exportação de dados do Jira Service Management (Dashboard HTML, PDF via Puppeteer e Planilhas Google via Google Sheets API)
---

# Apresentação e Exportação de Dados do Jira

Esta skill documenta os aprendizados de como consumir massas de dados JSON oriundas do Jira Service Management e exportá-las para formatos visuais e gerenciais (PDFs e Google Sheets).

## 1. Relatórios Executivos (Visual & PDF)
Para sumarização executiva visual (ex: Volume de Chamados, % de SLA Cumprido), o melhor pipeline identificado é **HTML + Chart.js -> Puppeteer PDF**.

### HTML e Chart.js
- Desenhe a interface utilizando HTML básico e **Tailwind CSS** (via CDN) para manter um design moderno e de fácil prototipação rápida.
- Para gráficos interativos (Barras, Rosca), injete a biblioteca **Chart.js**.
- **Regra de Ouro (Responsividade):** Ao desenhar quadros usando `h-full` num contêiner sem altura absoluta pré-definida, o Chart.js com `maintainAspectRatio: false` entrará em um "loop infinito" de redimensionamento na tag `<canvas>`, quebrando a renderização e congelando a aba. **Sempre declare uma altura no pai (Ex: `h-[250px] relative`) para os gráficos**.
- Títulos de período podem usar Javascript embutido no HTML para descobrir dinamicamente o fechamento:
```javascript
const hMonth = document.getElementById('h_month');
const dataAtual = new Date();
dataAtual.setMonth(dataAtual.getMonth() - 1);
hMonth.innerText = dataAtual.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
```

### Puppeteer PDF
- Scripts Node.js (`pdf_exporter.mjs`) podem gerar o arquivo invocando um motor Google Chrome *headless*.
- Instalação simples: `npm install puppeteer`
- **Ponto de Atenção:** Devido a animações das bibliotecas de desenho de tela (Como o Chart.js), é mandatório usar `waitUntil: 'networkidle0'` ao carregar a página e também instruir o Node.js a **esperar (sleep/Timeout) cerca de 2 segundos** para garantir que a renderização do gráfico terminou no virtual antes de executar o `page.pdf()`.
- Lembre-se que o comando de gerar PDF no Windows emitirá um erro estante (Code 4082 - EBUSY) caso o arquivo alvo (`Relatorio.pdf`) já exista e esteja inadvertidamente aberto num leitor PDF ou aba do desktop pelo usuário. É necessário pedir que fechem o arquivo antes de "re-rodar" a função.

## 2. Relatórios Analíticos (Dados Tabulares)
Para análise forense de incidentes linha a linha, nós transformamos arrays JSON em planilhas injetadas pela nuvem via Google Sheets API.

### Integração Google Sheets via Node.js
- Instalação de biblioteca oficial: `npm install googleapis`
- A autenticação base deve ser feita obrigatoriamente através de uma Conta de Serviço de Máquina originária no Google Cloud Console (Service Account -> JSON Key).
- As credenciais devem sempre ser armazenadas numa pasta separada excluída de versionamento (ex: `credentials/google-credentials.json` e listada no `.gitignore`).
- Injeção Padrão (Batching update):
```javascript
    const auth = new google.auth.GoogleAuth({ keyFile: CREDENTIALS_PATH, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Deleta os dados antigos da guia antes do refresco
    await sheets.spreadsheets.values.clear({ spreadsheetId: ID, range: 'Folha1!A1:Z' });
    
    // Injeta a Array inteira [[]] 
    await sheets.spreadsheets.values.update({ spreadsheetId: ID, range: 'Folha1!A1', valueInputOption: 'USER_ENTERED', resource: { values: rows }});
```
- **Formatação de Layout:** Em um segundo passo assíncrono, invoque `batchUpdate` utilizando as propriedades da `gridProperties`. Você pode facilmente formatar a Planilha para visual Executivo mandando requests para congelar a primeira linha (`frozenRowCount: 1`), setar Negrito e cores de cor de fundo RGB na fila 0, além de aplicar o prático gatilho visual do `autoResizeDimensions` baseado no comprimento das Strings resultantes do seu CSV parser.
