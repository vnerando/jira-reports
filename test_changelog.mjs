import fs from 'fs';

const {
  JIRA_DOMAIN,
  JIRA_EMAIL,
  JIRA_API_TOKEN
} = process.env;

const authToken = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const endpoint = `https://${JIRA_DOMAIN}/rest/api/3/search/jql`;

async function test() {
  const payload = {
    jql: 'key = "GC-9226"',
    fields: ["status", "issuetype"],
    expand: "changelog",
    maxResults: 1
  };

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
  console.log(JSON.stringify(data, null, 2));
  if (data.issues && data.issues[0]) {
      const issue = data.issues[0];
      console.log(`Chave: ${issue.key}`);
      console.log(`Tipo: ${issue.fields.issuetype.name}`);
      console.log(`Changelog presente: ${!!issue.changelog}`);
      
      if (issue.changelog && issue.changelog.histories) {
          console.log(`Total de Históricos: ${issue.changelog.histories.length}`);
          const statusChanges = issue.changelog.histories.map(h => {
             const statusItem = h.items.find(i => i.field === 'status');
             if (statusItem) {
                 return {
                     data: h.created,
                     de: statusItem.fromString,
                     para: statusItem.toString
                 };
             }
             return null;
          }).filter(Boolean);
          
          console.log("\nLista de Transições de Status:");
          console.log(JSON.stringify(statusChanges, null, 2));
      }
  } else {
      console.log("Nenhum chamado retornado.");
  }
}

test();
