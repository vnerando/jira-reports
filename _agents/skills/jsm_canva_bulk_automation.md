# Automação de Apresentações no Canva (Bulk Create)

Este guia descreve como gerar e exportar os dados do Jira Service Management para preenchimento em lote no **Canva Design** usando a ferramenta "Criar em Lote" (Bulk Create).

---

## 📊 1. Estrutura dos Dados de Entrada (CSV)

Os scripts geram arquivos `.csv` otimizados para o Canva contendo **metas mensais de desempenho**.

### 🗓️ A. Relatório Mensal (`canva_bulk_[Mes]_[Ano].csv`)
Gera **uma única linha** com os dados consolidados do mês de referência.

| Cabeçalho | Descrição / Tipo | Exemplo |
| :--- | :--- | :--- |
| `Mes_Referencia` | Nome do mês e ano | `"Fevereiro de 2026"` |
| `Total_Criados` | Inteiro | `209` |
| `Total_Resolvidos` | Inteiro | `203` |
| `Tempo_Medio_Primeira_Resposta` | String formatada (h) | `"0.56h"` |
| `Tempo_Medio_Resolucao` | String formatada (h) | `"4.90h"` |
| `SLA_Met_Primeira_Resposta` | Porcentagem (%) | `"80.0%"` |
| `SLA_Met_Resolucao` | Porcentagem (%) | `"88.1%"` |
| `Analise_Breve` | Parágrafo de insights qualitativos auto-gerado | `"No mês de Fevereiro..."` |

### 📈 B. Relatório Comparativo Trimestral (`canva_bulk_comparativo.csv`)
Gera **uma linha** unindo os últimos 3 meses cronológicos.

-   **Estrutura:** Colunas `Mes_1`, `Criados_1` ... `Mes_2`, `Criados_2` ... `Mes_3`, `Criados_3`.
-   **Coluna de Insight:** `Analise_Comparativa` contendo um texto macro avaliando a tendência de volume e SLAs do trimestre.

---

## 🖼️ 2. Capturas de Tela Automáticas (PNGs)

Os dados são renderizados em Dashboards HTML utilizando Puppeteer para printar apenas os gráficos.

### 📁 Destino: `presentation_assets/`
Essas imagens são otimizadas para serem **arrastadas e soltas** nos slides do Canva.

#### 📈 Gráficos Diários (Por Mês)
-   `Analitical_dailyFrTimeChart_[Mes].png` (Evolução diária do Tempo de Resposta)
-   `Analitical_dailyResTimeChart_[Mes].png` (Evolução diária do Tempo de Resolução)

#### 📊 Gráficos Comparativos (Trimestre)
-   `Comparative_compVolumeChart.png` (Barras lado a lado de Volume)
-   `Comparative_compSlaChart.png` (Linhas de cumprimento de SLA %)
-   `Comparative_compFrTimeChart.png` (Linha de Tempo de 1ª Resposta em Horas)
-   `Comparative_compResTimeChart.png` (Linha de Tempo de Resolução em Horas)

---

## 🚀 3. Fluxo de Execução

Para atualizar os dados de múltiplos meses, utilize o `MONTH_OFFSET` (1 = mês passado, 2 = retrasado, etc.):

```powershell
# 1. Baixar os dados de Dezembro (Offset 3), Janeiro (Offset 2) e Fevereiro (Offset 1)
$env:MONTH_OFFSET="3"; node issue_separator.mjs; node analytical_report_generator.mjs; node executive_reports/executive_report_generator.mjs; node analytical_reports/dashboard_screenshotter.mjs;
$env:MONTH_OFFSET="2"; node issue_separator.mjs; ...
$env:MONTH_OFFSET="1"; node issue_separator.mjs; ...

# 2. Unificar os Comparativos
node comparative_report_generator.mjs; node analytical_reports/dashboard_screenshotter.mjs;
```

---

## 💡 4. Dica de Uso no Canva
1. No Canva, crie caixas de texto separadas para o `% SLA`, `Criados` etc.
2. Vá em **Apps** > **Criar em lote** > **Fazer upload de CSV**.
3. Clique com o botão direito nas caixas de texto > **Conectar dados** > Selecione a coluna correspondente.
4. Clique em **Continuar** e **Gerar** para preencher automaticamente.
