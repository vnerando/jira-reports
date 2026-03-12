// Execute com o comando no terminal: node --env-file=.env issue_separator.mjs

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

// Função auxiliar para sanitizar nomes de arquivos
function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_]/gi, '_').replace(/_+/g, '_').toLowerCase();
}

async function fetchAndSeparateIssues() {
  const jqlQuery = `project = "Grupo Cednet" AND created >= startOfMonth("-1") AND created <= endOfMonth("-1") ORDER BY created DESC`;

  const payload = {
    jql: jqlQuery,
    fields: [
      "*all" // Buscando todos os campos para uma análise rica
    ],
    maxResults: 100
  };

  try {
    console.log("Buscando chamados no Jira para Separação por Tipo (Mês Passado)...\n");
    
    let allIssues = [];
    let isLastPage = false;
    let nextPageToken = null;
    let totalFetched = 0;
    const MAX_PAGINATION_LIMIT = 1000;

    // Loop de paginação
    do {
      if (nextPageToken) {
        payload.nextPageToken = nextPageToken;
      }

      console.log(`-> Fazendo request... (Buscados até agora: ${totalFetched})`);
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
        console.log(`[Aviso] Limite de ${MAX_PAGINATION_LIMIT} tickets atingido. Interrompendo a paginação.`);
        break;
      }

    } while (!isLastPage && nextPageToken);
    
    if (allIssues.length === 0) {
      console.log("Nenhum item encontrado no período.");
      return;
    }

    console.log(`\n===========================================`);
    console.log(`Busca Concluída! Total de issues extraídas: ${allIssues.length}`);
    console.log(`===========================================\n`);

    // Agrupando as issues por issuetype.name
    const issuesByType = {};

    allIssues.forEach(issue => {
      const typeName = issue.fields?.issuetype?.name || "Desconhecido";
      if (!issuesByType[typeName]) {
        issuesByType[typeName] = [];
      }
      issuesByType[typeName].push(issue);
    });

    console.log("-> Separando e salvando arquivos...\n");
    const outputDir = path.join(process.cwd(), 'issues_by_type');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const reportSummary = [];

    for (const [type, issues] of Object.entries(issuesByType)) {
      const safeName = sanitizeFilename(type);
      const filename = `type_${safeName}.json`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(issues, null, 2));
      console.log(`[+] Salvo: ${filename} com ${issues.length} tickets.`);

      reportSummary.push({
        type,
        count: issues.length,
        file: filename
      });
    }

    console.log("\nResumo da Análise:");
    console.table(reportSummary);

  } catch (error) {
    console.error("Erro geral na operação:", error);
  }
}

fetchAndSeparateIssues();
