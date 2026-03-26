import fs from 'fs';
import path from 'path';

const {
  JIRA_DOMAIN,
  JIRA_EMAIL,
  JIRA_API_TOKEN,
  MONTH_OFFSET = "1" // Mês padrão para o teste
} = process.env;

if (!JIRA_DOMAIN || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Erro: Variáveis de ambiente ausentes. Verifique o arquivo .env.");
  process.exit(1);
}

const offset = parseInt(MONTH_OFFSET);
const authToken = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const endpoint = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;

async function fetchWorkflowData() {
  const jqlQuery = `project = "Grupo Cednet" AND created >= startOfMonth("-${offset}") AND created <= endOfMonth("-${offset}") ORDER BY created DESC`;

  try {
    const payload = {
      jql: jqlQuery,
      fields: ["status", "issuetype", "created", "resolutiondate"],
      expand: "changelog"
    };

    let allIssues = [];
    let nextPageToken = null;
    let totalFetched = 0;

    console.log("=== Iniciando Requisição de Histórico de Workflow ===");
    console.log(`JQL: ${jqlQuery}\n`);

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

      const data = await response.json();

      if (data.errorMessages) {
          console.error("Erro na API do Jira:", data.errorMessages);
          return;
      }

      if (data.issues) {
          allIssues = allIssues.concat(data.issues);
          totalFetched = allIssues.length;
      }

      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    if (allIssues.length === 0) {
        console.log("Nenhum chamado encontrado para o período especificado.");
        return;
    }

    const outputDir = path.join('workflow_analysis', 'raw_data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Salvar o dump bruto
    const rawFilePath = path.join(outputDir, `raw_changelog_offset_${offset}.json`);
    fs.writeFileSync(rawFilePath, JSON.stringify({ issues: allIssues }, null, 2));
    console.log(`-> Todos os dados (${allIssues.length}) salvos em: ${rawFilePath}`);

    // Extração e Análise básica
    const analysisResults = [];

    allIssues.forEach(issue => {
        const issueKey = issue.key;
        const issueType = issue.fields.issuetype.name;
        const createdDate = issue.fields.created;
        
        const historyList = issue.changelog ? issue.changelog.histories : [];
        
        // Filtra as transições do campo 'status'
        const statusTransitions = historyList.flatMap(h => {
             return h.items
                .filter(i => i.field === 'status')
                .map(i => ({
                    date: h.created,
                    from: i.fromString,
                    to: i.toString
                }));
        });

        // Ordenar transições cronologicamente (da mais antiga para a mais recente)
        statusTransitions.sort((a, b) => new Date(a.date) - new Date(b.date));

        analysisResults.push({
            key: issueKey,
            type: issueType,
            created: createdDate,
            transitionsCount: statusTransitions.length,
            transitions: statusTransitions
        });
    });

    const summaryFilePath = path.join('workflow_analysis', `workflow_summary_offset_${offset}.json`);
    fs.writeFileSync(summaryFilePath, JSON.stringify(analysisResults, null, 2));
    console.log(`-> Sumário salvo em: ${summaryFilePath}`);

    console.log(`\n=== Resultados para Amostra de ${analysisResults.length} Chamados ===`);
    console.log("Configurações Carregadas com Sucesso!");
    console.log("Exemplo de Transições coletadas:");
    const sample = analysisResults.find(a => a.transitionsCount > 0);
    if (sample) {
        console.log(JSON.stringify(sample, null, 2));
    } else {
        console.log("Nota: Os chamados retornados não possuem transições registradas ainda (talvez novos).");
    }

  } catch (error) {
    console.error("Falha ao processar o histórico de changelog:", error);
  }
}

fetchWorkflowData();
