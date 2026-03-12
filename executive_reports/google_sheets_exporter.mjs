// Execute com: node google_sheets_exporter.mjs

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const SPREADSHEET_ID = '1vn3ld1sM4nQWk5LZyK1KviCai60x875Vdt3MHfN3eZE';
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials', 'google-credentials.json');
const CSV_PATH = path.join(process.cwd(), 'analytical_reports', 'Relatorio_Analitico_Completo.csv');

if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`ERRO: Arquivo de credenciais não encontrado em: ${CREDENTIALS_PATH}`);
    process.exit(1);
}

if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERRO: Planilha CSV não encontrada em: ${CSV_PATH}. Rode o analytical_report_generator.mjs primeiro.`);
    process.exit(1);
}

// 1. Setup Auth
const auth = new google.auth.GoogleAuth({
  keyFile: CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

async function uploadToGoogleSheets() {
    try {
        console.log("-----------------------------------------");
        console.log("🚀 Iniciando Integração Google Sheets...");
        
        // 2. Extrair dados limpos do nosso CSV local
        console.log("Lendo arquivo analítico local...");
        const csvText = fs.readFileSync(CSV_PATH, 'utf8');
        const rows = parse(csvText, {
            columns: false,
            skip_empty_lines: true
        });
        
        console.log(`Dados na memória: ${rows.length} linhas (+ cabeçalho).`);

        // 3. Obter nome da primeira Aba (Sheet) para usar nos formatadores
        const spreadsheetMeta = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });
        const sheetId = spreadsheetMeta.data.sheets[0].properties.sheetId;
        const sheetName = spreadsheetMeta.data.sheets[0].properties.title;

        // 4. Limpar a aba atual completamente antes de injetar
        console.log("Limpando a planilha do Google...");
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1:Z`,
        });

        // 5. Inserir a Massa de Dados
        console.log("Realizando upload e injetando as matrizes...");
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: rows,
            },
        });

        // 6. Aplicar formatação cosmética (Linha 1 congelada e Header em Negrito)
        console.log("Aplicando Regras Visuais de Estilo Executivo...");
        const requests = [
            {
                // Congela a 1ª Linha
                updateSheetProperties: {
                    properties: {
                        sheetId: sheetId,
                        gridProperties: {
                            frozenRowCount: 1,
                        }
                    },
                    fields: 'gridProperties.frozenRowCount',
                }
            },
            {
                // Deixa o Cabeçalho Colorido/Negrito
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: 0,
                        endRowIndex: 1,
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                            textFormat: { bold: true },
                            horizontalAlignment: "CENTER"
                        }
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
                }
            },
            {
                // Auto-Resize das colunas baseadas no tamanho do texto interno
                autoResizeDimensions: {
                    dimensions: {
                        sheetId: sheetId,
                        dimension: "COLUMNS",
                        startIndex: 0,
                        endIndex: rows[0].length
                    }
                }
            }
        ];

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: requests
            }
        });

        console.log("✅ Concluído com Sucesso Total!");
        console.log(`🔗 Link Direto: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/`);
        console.log("-----------------------------------------");

    } catch (error) {
        console.error("Erro Fatal ao injetar na planilha:", error.message);
    }
}

// Executar main pipeline
uploadToGoogleSheets();
