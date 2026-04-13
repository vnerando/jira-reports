import fs from 'fs';
import path from 'path';

const {
  JIRA_DOMAIN,
  JIRA_EMAIL,
  JIRA_API_TOKEN
} = process.env;

if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Erro: Variáveis de ambiente ausentes. Verifique o arquivo .env.");
  process.exit(1);
}

const authToken = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const endpoint = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;

const outputDir = path.join(process.cwd(), 'recurring_analysis');
const outputFile = path.join(outputDir, 'raw_quarterly_data.json');

async function fetchQuarterlyData() {
  const jqlQuery = `project = "Grupo Cednet" AND created >= "2026-01-01" AND created <= "2026-03-31" ORDER BY created ASC`;

  // Payload BASE sem startAt e sem nextPageToken
  const payload = {
    jql: jqlQuery,
    fields: ["*all"],
    maxResults: 100
  };

  try {
    console.log("Buscando chamados trimestrais (Jan-Mar 2026)...\n");
    
    let allIssues = [];
    let isLastPage = false;
    let nextPageToken = null;
    let totalFetched = 0;
    const MAX_PAGINATION_LIMIT = 5000;

    do {
      if (nextPageToken) {
        payload.nextPageToken = nextPageToken;
      } else {
        delete payload.nextPageToken;
      }

      console.log(`-> Buscando... (Total até agora: ${totalFetched})`);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Erro na requisição: ${response.status} ${response.statusText}`);
        console.error("Detalhes:", errorText);
        break;
      }

      const data = await response.json();
      
      if (data.issues && data.issues.length > 0) {
        allIssues = allIssues.concat(data.issues);
        totalFetched += data.issues.length;
      }

      isLastPage = data.isLast !== undefined ? data.isLast : true;
      nextPageToken = data.nextPageToken || null;

      if (totalFetched >= MAX_PAGINATION_LIMIT) {
        console.log(`[Aviso] Limite de ${MAX_PAGINATION_LIMIT} tickets atingido.`);
        break;
      }

    } while (!isLastPage && nextPageToken);
    
    console.log(`\nTotal de issues extraídas: ${allIssues.length}`);
    fs.writeFileSync(outputFile, JSON.stringify({ issues: allIssues }, null, 2));
    console.log(`✅ Dados salvos em: ${outputFile}`);

  } catch (error) {
    console.error("Erro geral na operação:", error);
  }
}

fetchQuarterlyData();
