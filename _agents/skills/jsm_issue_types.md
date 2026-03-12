---
name: jsm_issue_types
description: Análise de estruturas de Issue Types (Categorias de Ticket) do Jira Service Management e quais campos customizados as caracterizam no ecossistema atual.
---

# Estrutura de Issue Types no Jira

Esta base de conhecimento descreve as peculiaridades identificadas na estrutura JSON dos diferentes tipos de chamados (Issue Types) do Jira no projeto Cloud. 

Quando buscamos tickets (`project = GC`), o Jira pode retornar os seguintes tipos no campo `issue.fields.issuetype.name`:
- `[System] Problem`
- `[System] Change`
- `[System] Incident`
- `[System] Service request`
- `Tarefa`

## Comportamento Comum de Campos (Visível em todos)
Ao inspecionar e separar os JSONs de devolução, notamos que a maioria dos campos vitais são globais e persistem independentemente do tipo:
- **Campos Nativos Básicos:** `statusCategory`, `priority`, `status`, `creator`, `reporter`, `project`, `description`, `summary`.
- **Campos de Controle de SLA:** 
  - `customfield_10060`: "Time to review normal change"
  - `customfield_10172`: "Time to repear"
  - `customfield_10032`: "Time to resolution"
  - `customfield_10033`: "Time to first response"
  - `customfield_10059`: "Time to close after resolution"
- **Organizacional:**
  - `customfield_10002`: Organização responsável (ex: Suporte, Suporte Interno).
  - `customfield_10010`: Request Type do Service Desk (Portal do Cliente).
  - `customfield_10105`: Campo customizado comumente indicando a cidade/região (ex: "Fartura").

## Diferenças e Particularidades nos `customfields`
Embora a base seja igual, a análise cruzada mostra dependências de tipo de solicitação (Service Desk form):

- **[System] Problem:** Frequentemente não utiliza campos de "Time to first response" se gerado internamente, mas possui vasto preenchimento de resoluções.
- **[System] Change (Mudança):** Ocupa campos exclusivos associados a ITIL, como os motivos de mudança técnica programada `customfield_10173` e `customfield_10138`.
- **[System] Incident (Incidente):** Grande uso de anexos e uso intensivo de sub-rastreios. O campo `customfield_10113` pode ser notado sendo populado.
- **[System] Service request / Tarefa:** Costumam ter o preenchimento mais magro por serem interações primais de primeiro nível (N1) com clientes, sendo a porta de entrada com `customfield_10043`.

## Como Lidar Programaticamente
Quando solicitar a criação de exportadores ou análises que cruzam diferentes categorias, certifique-se de envolver `optional chaining` (`?.`) ou verificações explícitas no JavaScript se for tentar ler um `customfield` que você identificou em *Change* mas que pode estar nulo ou inexistente em *Service request*:

```javascript
// Exemplo Seguro
const slaResolution = issue.fields.customfield_10032?.completedCycles || [];
const cityRegion = issue.fields.customfield_10105?.value || "Desconhecida";
```
