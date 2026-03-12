// Execute com o comando no terminal: node --env-file=.env sla_analyzer.mjs

import fs from 'fs';

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

async function analyzeSlaViolations() {
  // Construindo a JQL para pegar apenas chamados onde a data de criação seja do mês passado
  // A sintaxe do Jira JQL suporta funções dinâmicas: startOfMonth(-1) e endOfMonth(-1)
  const jqlQuery = `project = "Grupo Cednet" AND created >= startOfMonth("-1") AND created <= endOfMonth("-1") ORDER BY created DESC`;

  const payload = {
    jql: jqlQuery,
    fields: [
      "summary",
      "status",
      "created",
      "assignee",
      "customfield_10033" // Campo específico do "Time to first response"
    ],
    maxResults: 100
  };

  try {
    console.log("Buscando chamados no Jira para Análise de SLA (com paginação até 1000)...\n");
    
    let allIssues = [];
    let isLastPage = false;
    let nextPageToken = null;
    let totalFetched = 0;
    const MAX_PAGINATION_LIMIT = 1000;

    // Loop de paginação
    do {
      // Adiciona o token da próxima página no payload caso exista
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

      // Atualiza as flags baseadas na resposta da API
      isLastPage = data.isLast !== undefined ? data.isLast : true;
      nextPageToken = data.nextPageToken || null;

      // Proteção para não estourar o limite rígido de 1000
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

    const breachedIssues = [];

    allIssues.forEach(issue => {
      // O campo 10033 possui os ciclos do SLA
      const firstResponseSla = issue.fields.customfield_10033;
      
      if (firstResponseSla && firstResponseSla.completedCycles && firstResponseSla.completedCycles.length > 0) {
        // Verifica o último ciclo concluído
        const lastCycle = firstResponseSla.completedCycles[firstResponseSla.completedCycles.length - 1];
        
        if (lastCycle.breached === true) {
          breachedIssues.push({
            chave: issue.key,
            resumo: issue.fields.summary,
            status: issue.fields.status?.name || "Desconhecido",
            responsavel: issue.fields.assignee?.displayName || "Não atribuído",
            criadoEm: new Date(issue.fields.created).toLocaleString('pt-BR'),
            tempoEstourado_ms: Math.abs(lastCycle.remainingTime.millis),
            tempoEstourado_formatoVisual: lastCycle.remainingTime.friendly
          });
        }
      }
    });

    console.log(`--- RELATÓRIO DE SLA VIOLADO (Time to first response) ---`);
    console.log(`* Total de tickets analisados: ${allIssues.length}`);
    console.log(`* Total de tickets com SLA estourado: ${breachedIssues.length}\n`);

    if (breachedIssues.length > 0) {
      console.log("Detalhes das Violações:");
      // Ordena do maior tempo estourado para o menor
      breachedIssues.sort((a, b) => b.tempoEstourado_ms - a.tempoEstourado_ms);
      
      breachedIssues.forEach((item, index) => {
        console.log(`${index + 1}. [${item.chave}] ${item.resumo}`);
        console.log(`   Responsável: ${item.responsavel}`);
        console.log(`   Status: ${item.status}`);
        console.log(`   Estouro de Tempo: ${item.tempoEstourado_formatoVisual}`);
        console.log(`   Data de Abertura: ${item.criadoEm}\n`);
      });

      // Opcional: Salvar o relatório em um JSON limpo
      fs.writeFileSync('sla_breaches_report.json', JSON.stringify(breachedIssues, null, 2));
      console.log("-> Um arquivo detalhado 'sla_breaches_report.json' foi salvo na pasta.");
    } else {
      console.log("Parabéns! Nenhum ticket violou o tempo de Primeira Resposta nesta amostra.");
    }

  } catch (error) {
    console.error("Erro ao analisar SLA:", error);
  }
}

analyzeSlaViolations();
