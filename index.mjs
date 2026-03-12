// Execute com o comando no terminal: node --env-file=.env index.mjs
import fs from 'fs';

const {
  JIRA_DOMAIN,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  JIRA_PROJECT_KEY
} = process.env;

if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
  console.error("Erro: Variáveis de ambiente ausentes. Verifique o arquivo .env.");
  process.exit(1);
}

// A autenticação do Jira requer Base64 no formato "email:api_token"
const authToken = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

// Endpoint conforme as regras globais e documentação da Atlassian:
// https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-post
const endpoint = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;

async function fetchJiraData() {
  // Alterado para buscar pelo nome do projeto conforme solicitado
  const payload = {
    jql: `project = "Grupo Cednet" ORDER BY created DESC`,
    fields: [
      "*all"
    ],
    maxResults: 100 // Alterado para buscar 100 resultados
  };

  try {
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
      return;
    }

    const data = await response.json();

    // Mostrar todo o retorno JSON para análise e salvar num arquivo local
    console.log("Baixando dados do Jira e salvando em output.json...");
    fs.writeFileSync('output.json', JSON.stringify(data, null, 2));
    console.log(`Foram retornados ${data.issues ? data.issues.length : 0} items.`);
  } catch (error) {
    console.error("Erro ao tentar buscar dados no Jira:", error);
  }
}

fetchJiraData();
