---
name: jsm_sla_reports
description: Regras e padrões para extrair, paginar e analisar tickets do Jira Service Management via JQL (foco em SLA)
---

# Extração de Dados e Análise de SLA - Jira Service Management (JSM)

Esta skill documenta o fluxo de trabalho obrigatório e as nuances sobre como buscar, paginar e analisar chamados do Jira via REST API (V3) em Javascript.

## 1. Requisição Padrão (Busca JQL)
Para buscar tickets baseados em JQL, sempre utilize o endpoint HTTP POST `rest/api/3/search/jql`.

```javascript
// A autenticação exigida pela Atlassian via Fetch API é Basic (Email:Token_Pessoal) em Base64
const authToken = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const endpoint = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;
```

## 2. Paginação Obrigatória (nextPageToken)
A API V3 possui um hard limit de **100 resultados por página**. Para buscar mais, você deve obrigatoriamente usar o sistema sequencial baseado em cursor (`nextPageToken`).

**Regra de Ouro:** A paginação só termina quando a flag `isLast` no Response JSON retornar `true`.

```javascript
// Exemplo de Loop de Paginação (do..while)
let allIssues = [];
let isLastPage = false;
let nextPageToken = null;

do {
  if (nextPageToken) payload.nextPageToken = nextPageToken;

  const response = await fetch(endpoint, /* Headers Basic Auth + json... */);
  const data = await response.json();
  
  if (data.issues) allIssues = allIssues.concat(data.issues);

  // Atualiza as flags
  isLastPage = data.isLast !== undefined ? data.isLast : true;
  nextPageToken = data.nextPageToken || null;
} while (!isLastPage && nextPageToken);
```

## 3. Trabalhando com Datas na JQL
Sempre utilize funções dinâmicas do Jira para criar períodos relativos automatizados (sempre em aspas duplas):
- **Mês passado inteiro:** `created >= startOfMonth("-1") AND created <= endOfMonth("-1")`
- **Semana atual:** `created >= startOfWeek()`

> **Importante:** A construção `ORDER BY` não leva o operador `AND` antecedendo-a no JQL. Exemplo correto: `project = "Nome" ORDER BY created DESC`.

## 4. Análise Específica de SLAs (Atrasos)
No Jira Service Management, os SLAs são tratados como campos customizados complexos.
- Exemplo de campo de *Time to first response*: `customfield_10033`.
- Exemplo de campo de *Time to resolution*: `customfield_10032`.

### Estrutura do Json de SLA
Para saber se o SLA foi estourado verifique sempre o `completedCycles` da *issue*:

```javascript
const slaField = issue.fields.customfield_10033;
if (slaField && slaField.completedCycles && slaField.completedCycles.length > 0) {
  // Pega o último ciclo de tempo
  const lastCycle = slaField.completedCycles[slaField.completedCycles.length - 1];
  
  // A propriedade 'breached' define a quebra do tempo acordado
  if (lastCycle.breached === true) {
     const msAtrasado = Math.abs(lastCycle.remainingTime.millis);
     const formtVisual = lastCycle.remainingTime.friendly; // ex: "-13h 36m"
  }
}
```

## 5. Regras de Negócio e Exceções de SLA (Grupo Cednet)
É importante frisar que **não é necessário** criar filtros manuais no código ou excluir manualmente items (como *Incidentes de Transporte Indisponível* ou *Criadores Específicos*) para calcular os SLAs de Primeira Resposta ou Resolução.

Todas as regras de negócio complexas configuradas no painel administrativo do Jira (incluindo as exclusões JQL do painel SLA e pausas por falso-positivo em comentários de clientes) já **são absorvidas pelo motor interno do Jira**. 

O array de `completedCycles` já fornece o `elapsedTime` e os tickets finalizados com precisão cirúrgica, processados e calculados nativamente. Basta puxar o último ciclo da issue e utilizar seus dados limpos!
