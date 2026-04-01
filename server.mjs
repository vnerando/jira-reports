// Execute com: node --env-file=credentials/.env server.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import jwt from 'jsonwebtoken';

const PORT       = process.env.PORT_SERVER || 3000;
const JWT_SECRET = process.env.JWT_SECRET  || 'fallback-secret-change-me';
const AUTH_USER  = process.env.AUTH_USER   || 'admin';
const AUTH_PASS  = process.env.AUTH_PASS   || 'admin';
const SMTP_USER  = process.env.EMAIL       || '';
const SMTP_PASS  = process.env.SENHA       || '';
const SMTP_HOST  = process.env.SMTP_HOST   || 'mail.grupocednet.com.br';

// ─── Helpers de segurança ───────────────────────────────────────────────
// Verifica JWT no header Authorization: Bearer <token>
const verifyToken = (req) => {
    const auth = req.headers['authorization'] || '';
    if (!auth.startsWith('Bearer ')) {
        console.log('[Auth Debug] Header "authorization" não inicia com Bearer ou está vazio:', req.headers['authorization']);
        return null;
    }
    try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
        return decoded;
    } catch (err) {
        console.log('[Auth Debug] jwt.verify falhou:', err.message, 'Token:', auth.slice(7));
        return null;
    }
};

// Sanitiza label: permite apenas letras, números, _ e -
const sanitizeLabel = (s = '') => /^[\w\-]{1,80}$/.test(s) ? s : null;

// Bloqueia path traversal: garante que o caminho está dentro da raiz do projeto
const safeJoin = (base, ...parts) => {
    // path.resolve ignora o base se o part começar com '/'. Precisamos limpar a string.
    const cleanParts = parts.map(p => typeof p === 'string' ? p.replace(/^\/+/, '') : p);
    const full = path.resolve(base, ...cleanParts);
    if (!full.startsWith(path.resolve(base))) throw new Error('Path traversal detectado');
    return full;
};



// ─── Cache em memória (sem arquivos extras em disco) ────────────────────────
// Limpo automaticamente ao reiniciar o servidor.
const reportCache = new Map(); // label → { data, label, timestamp }
const pdfCache    = new Map(); // label → Buffer PDF


const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv; charset=utf-8'
};

const server = http.createServer(async (req, res) => {
  // Configurar cabeçalhos CORS genéricos para o mesmo domínio
  const origin = req.headers['origin'] || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder requisições preflight OPTIONS
  if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
  }

  const url = req.url;
  const decodedUrl = decodeURIComponent(url);

  if (decodedUrl.startsWith('/api/')) {
      console.log(`\n[REQ] INCOMING: Method=${req.method} URL=${decodedUrl}`);
      console.log(`[REQ] Headers: Origin=${req.headers['origin'] || 'N/A'}, Auth=${req.headers['authorization'] ? 'Present' : 'MISSING'}`);
  }

  if (decodedUrl === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ status: "API is active. Please use the React frontend (Vite) on port 5173 for the UI." }));
      return;
  }

  // ── LOGIN (público — único endpoint sem auth) ───────────────────────
  if (decodedUrl === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
          try {
              const { user, pass } = JSON.parse(body);
              if (user === AUTH_USER && pass === AUTH_PASS) {
                  const token = jwt.sign({ user }, JWT_SECRET, { expiresIn: '8h' });
                  console.log(`[Auth] Login bem-sucedido: ${user}`);
                  res.writeHead(200, MIME_TYPES['.json']);
                  res.end(JSON.stringify({ success: true, token }));
              } else {
                  console.warn(`[Auth] Tentativa de login inválida: ${user}`);
                  res.writeHead(401, MIME_TYPES['.json']);
                  res.end(JSON.stringify({ success: false, error: 'Usuário ou senha inválidos.' }));
              }
          } catch {
              res.writeHead(400, MIME_TYPES['.json']);
              res.end(JSON.stringify({ error: 'JSON inválido.' }));
          }
      });
      return;
  }

  // ── Guarda de autenticação para todos os /api/* restantes ──────────
  if (decodedUrl.startsWith('/api/')) {
      if (!verifyToken(req)) {
          res.writeHead(401, MIME_TYPES['.json']);
          res.end(JSON.stringify({ success: false, error: 'Não autorizado. Faça login.' }));
          return;
      }
  }

  // API para listar histórico de buscas
  if (decodedUrl === '/api/history' && req.method === 'GET') {
      try {
          const historyPath = path.join(process.cwd(), 'analytical_reports', 'history.json');
          if (!fs.existsSync(historyPath)) {
              res.writeHead(200, MIME_TYPES['.json']);
              res.end(JSON.stringify([]));
              return;
          }
          const data = fs.readFileSync(historyPath, 'utf8');
          res.writeHead(200, MIME_TYPES['.json']);
          res.end(data);
          return;
      } catch (e) {
          res.writeHead(500, MIME_TYPES['.json']);
          res.end(JSON.stringify({ error: "Erro ao ler histórico." }));
          return;
      }
  }

  // API para Gerar Relatório Sob Demanda
  if (decodedUrl.startsWith('/api/generate') && req.method === 'POST') {
      const forceRefresh = new URL('http://x' + decodedUrl).searchParams.get('force') === 'true';
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
          try {
              const data = JSON.parse(body);
              const { offset, startDate, endDate, label } = data;

              // ── Serve do cache se já existir (e não for força) ───────────────
              if (!forceRefresh && reportCache.has(label)) {
                  const cached = reportCache.get(label);
                  console.log(`[Cache] HIT report: ${label} (gerado em ${new Date(cached.timestamp).toLocaleTimeString('pt-BR')})`);
                  res.writeHead(200, MIME_TYPES['.json']);
                  res.end(JSON.stringify({ success: true, label: cached.label, data: cached.data, fromCache: true }));
                  return;
              }

              console.log(`[API] Gerando em tempo real: Start=${startDate}, End=${endDate}, Label=${label}${forceRefresh ? ' [FORCE]' : ''}`);

              const envVars = { ...process.env };
              if (offset !== undefined) envVars.MONTH_OFFSET = String(offset);
              if (startDate) envVars.START_DATE = startDate;
              if (endDate) envVars.END_DATE = endDate;
              if (label) envVars.REPORT_LABEL = label;

              const scriptChain = `node --env-file=credentials/.env issue_separator.mjs && node --env-file=credentials/.env analytical_report_generator.mjs`;

              exec(scriptChain, { env: envVars }, (error, stdout, stderr) => {
                  if (error) {
                      console.error(`[Exec Error]: ${error.message}`);
                      res.writeHead(500, MIME_TYPES['.json']);
                      res.end(JSON.stringify({ success: false, error: error.message }));
                      return;
                  }

                  try {
                      const match = stdout.match(/###DATA###(.*)###DATA###/);
                      if (!match) throw new Error("Saída de dados corrompida ou vazia.");
                      const aggregation = JSON.parse(match[1]);

                      // Salva no cache de dados e invalida PDF do mesmo label
                      reportCache.set(label, { data: aggregation, label, timestamp: Date.now() });
                      if (pdfCache.has(label)) {
                          pdfCache.delete(label);
                          console.log(`[Cache] PDF invalidado: ${label}`);
                      }

                      const historyPath = path.join(process.cwd(), 'analytical_reports', 'history.json');
                      let history = [];
                      if (fs.existsSync(historyPath)) {
                          history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                      }
                      
                      const existingIndex = history.findIndex(h => h.label === label);
                      const historyItem = { label, startDate, endDate, created_at: new Date() };
                      if (existingIndex >= 0) history[existingIndex] = historyItem;
                      else history.push(historyItem);

                      if (!fs.existsSync(path.join(process.cwd(), 'analytical_reports'))) {
                          fs.mkdirSync(path.join(process.cwd(), 'analytical_reports'));
                      }
                      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');

                      res.writeHead(200, MIME_TYPES['.json']);
                      res.end(JSON.stringify({ success: true, label, data: aggregation }));
                  } catch (parseError) {
                      console.error(`[Parse Error]: ${parseError.message}`, stdout);
                      res.writeHead(500, MIME_TYPES['.json']);
                      res.end(JSON.stringify({ success: false, error: "Falha ao processar os dados gerados." }));
                  }
              });
          } catch (e) {
              res.writeHead(400, MIME_TYPES['.json']);
              res.end(JSON.stringify({ error: "JSON Inválido ou erro no disparo." }));
          }
      });
      return;
  }

  // API para Gerar PDF (Cache em memória + pipeline na falta)
  if (decodedUrl.startsWith('/api/download-pdf/') && req.method === 'GET') {
      const label = sanitizeLabel(decodedUrl.split('/').pop());
      if (!label) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Label inválida.' }));
          return;
      }

      // ── Serve do cache de PDF se já existir ──────────────────────────────
      if (pdfCache.has(label)) {
          console.log(`[Cache] Servindo PDF para ${label} via memória.`);
          res.writeHead(200, {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Relatorio_Executivo_${label}.pdf"`
          });
          res.end(pdfCache.get(label));
          return;
      }

      console.log(`[API] Gerando PDF Executivo para o label: ${label}`);

      try {
          // 1. Busca as datas no history.json
          const historyPath = path.join(process.cwd(), 'analytical_reports', 'history.json');
          if (!fs.existsSync(historyPath)) throw new Error('Histórico não encontrado. Gere um relatório primeiro.');

          const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
          const entry = history.find(h => h.label === label);
          if (!entry) throw new Error(`Label "${label}" não encontrado no histórico.`);

          const { startDate, endDate } = entry;
          console.log(`-> Período: ${startDate} a ${endDate}`);

          // 2. Chama o gerador de PDF dedicado
          const pdfPath = await new Promise((resolve, reject) => {
              exec(
                  `node executive_reports/generate_pdf_report.mjs`,
                  {
                      env: { ...process.env, START_DATE: startDate, END_DATE: endDate, REPORT_LABEL: label },
                      timeout: 180000,
                      cwd: process.cwd()
                  },
                  (err, stdout, stderr) => {
                      if (err) {
                          console.error('[PDF Generator Error]', err.message, stderr);
                          reject(new Error(err.message));
                          return;
                      }
                      const match = stdout.match(/###PDF###(.+)###PDF###/);
                      if (!match) {
                          reject(new Error('PDF não foi gerado corretamente.'));
                          return;
                      }
                      resolve(match[1].trim());
                  }
              );
          });

          if (!fs.existsSync(pdfPath)) throw new Error(`Arquivo PDF não encontrado: ${pdfPath}`);
          const pdfBuffer = fs.readFileSync(pdfPath);

          pdfCache.set(label, pdfBuffer);
          console.log(`[Cache] PDF armazenado em memória: ${label}`);

          res.writeHead(200, {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Relatorio_Executivo_${label}.pdf"`
          });
          res.end(pdfBuffer);
          console.log(`✅ PDF "${path.basename(pdfPath)}" enviado.`);

      } catch (err) {
          console.error('❌ Erro ao gerar PDF:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
  }

  // API para Gerar/Baixar Apresentação (Slides baseados no PDF NOC)
  if (decodedUrl.startsWith('/api/download-presentation/') && req.method === 'GET') {
      const label = sanitizeLabel(decodedUrl.split('/').pop());
      if (!label) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Label inválida.' }));
          return;
      }

      console.log(`[API] Gerando Apresentação NOC para o label: ${label}`);

      try {
          const historyPath = path.join(process.cwd(), 'analytical_reports', 'history.json');
          if (!fs.existsSync(historyPath)) throw new Error('Histórico não encontrado.');

          const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
          const entry = history.find(h => h.label === label);
          if (!entry) throw new Error(`Label "${label}" não encontrado.`);

          const pdfPath = await new Promise((resolve, reject) => {
              exec(
                  `node executive_reports/generate_presentation.mjs`,
                  { env: { ...process.env, REPORT_LABEL: label }, timeout: 180000, cwd: process.cwd() },
                  (err, stdout, stderr) => {
                      if (err) {
                          console.error('[Presentation Generator Error]', err.message, stderr);
                          reject(new Error(err.message));
                          return;
                      }
                      const match = stdout.match(/###PDF_PRESENTATION###(.+)###PDF_PRESENTATION###/);
                      if (!match) return reject(new Error('Apresentação não gerada.'));
                      resolve(match[1].trim());
                  }
              );
          });

          if (!fs.existsSync(pdfPath)) throw new Error(`Arquivo não encontrado: ${pdfPath}`);
          const pdfBuffer = fs.readFileSync(pdfPath);

          res.writeHead(200, {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Apresentacao_NOC_${label}.pdf"`
          });
          res.end(pdfBuffer);
          console.log(`✅ Apresentação "${path.basename(pdfPath)}" enviada.`);
      } catch (err) {
          console.error('❌ Erro ao gerar Apresentação:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
  }

  // API para Enviar Relatório por E-mail
  if (decodedUrl === '/api/send-email' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
          try {
              const { to, format, label } = JSON.parse(body);
              if (!to || !format || !label) throw new Error('Parâmetros obrigatórios: to, format, label.');

              console.log(`[API] Enviando e-mail para ${to} | formato: ${format} | label: ${label}`);

              const { default: nodemailer } = await import('nodemailer');

              const transporter = nodemailer.createTransport({
                  host: SMTP_HOST,
                  port: process.env.SMTP_PORT || 587,
                  secure: false,
                  auth: { user: SMTP_USER, pass: SMTP_PASS },
                  tls: { rejectUnauthorized: false }
              });

              let attachments = [];
              let subjectLabel = label.replace(/_/g, ' ');

              if (format === 'csv') {
                  // Anexa o CSV já gerado em disco
                  const csvPath = path.join(process.cwd(), 'analytical_reports', `Relatorio_Analitico_${label}.csv`);
                  if (!fs.existsSync(csvPath)) throw new Error(`CSV não encontrado: ${csvPath}. Gere o relatório primeiro.`);
                  attachments.push({
                      filename: `Relatorio_Analitico_${label}.csv`,
                      path: csvPath,
                      contentType: 'text/csv'
                  });
              } else if (format === 'pdf') {
                  // Usa o PDF do cache (ou gera se não tiver)
                  let pdfBuffer = pdfCache.get(label);
                  if (!pdfBuffer) {
                      const historyPath = path.join(process.cwd(), 'analytical_reports', 'history.json');
                      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                      const entry = history.find(h => h.label === label);
                      if (!entry) throw new Error(`Label "${label}" não encontrado no histórico.`);

                      const pdfPath = await new Promise((resolve, reject) => {
                          exec(
                              `node executive_reports/generate_pdf_report.mjs`,
                              { env: { ...process.env, START_DATE: entry.startDate, END_DATE: entry.endDate, REPORT_LABEL: label }, timeout: 180000, cwd: process.cwd() },
                              (err, stdout) => {
                                  if (err) return reject(err);
                                  const match = stdout.match(/###PDF###(.+)###PDF###/);
                                  if (!match) return reject(new Error('PDF não gerado.'));
                                  resolve(match[1].trim());
                              }
                          );
                      });
                      pdfBuffer = fs.readFileSync(pdfPath);
                      pdfCache.set(label, pdfBuffer);
                  }
                  attachments.push({
                      filename: `Relatorio_Executivo_${label}.pdf`,
                      content: pdfBuffer,
                      contentType: 'application/pdf'
                  });
              } else {
                  throw new Error('Formato inválido. Use "csv" ou "pdf".');
              }

              // Verifica se a assinatura de imagem existe para anexar
              const assinaturaPath = path.join(process.cwd(), 'assinatura.png');
              let signatureHtml = '<p>Atenciosamente,<br><strong>NOC - Grupo Cednet</strong></p>';
              
              if (fs.existsSync(assinaturaPath)) {
                  attachments.push({
                      filename: 'assinatura.png',
                      path: assinaturaPath,
                      cid: 'assinatura_noc'
                  });
                  signatureHtml = '<br><br><img src="cid:assinatura_noc" alt="NOC - Grupo Cednet" style="max-width: 500px;" />';
              }

              const mailOptions = {
                  from: `"NOC - Grupo Cednet" <${SMTP_USER}>`,
                  to,
                  subject: `Relatório JSM — ${subjectLabel}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; color: #333;">
                      <h2 style="color: #4f46e5;">Relatório Jira Service Management</h2>
                      <p>Olá,</p>
                      <p>Segue em anexo o relatório <strong>${subjectLabel}</strong> no formato <strong>${format.toUpperCase()}</strong>.</p>
                      <p>O documento consolida as principais métricas do período:</p>
                      <ul>
                        <li>Volume de Incidentes, Mudanças e Problemas</li>
                        <li>Cumprimento de SLA (1ª Resposta e Resolução)</li>
                        <li>Ciclo de Vida (MTTR) por tipo de chamado</li>
                      </ul>
                      ${signatureHtml}
                    </div>
                  `,
                  attachments
              };

              await transporter.sendMail(mailOptions);
              console.log(`✅ E-mail enviado para ${to}`);

              res.writeHead(200, MIME_TYPES['.json']);
              res.end(JSON.stringify({ success: true, message: `E-mail enviado para ${to}` }));

          } catch (err) {
              console.error('❌ Erro ao enviar e-mail:', err.message);
              res.writeHead(500, MIME_TYPES['.json']);
              res.end(JSON.stringify({ success: false, error: err.message }));
          }
      });
      return;
  }




  // Servir arquivos estáticos com proteção contra path traversal
  try {
      let filePath = safeJoin(process.cwd(), decodedUrl);
      
      // Procura em diversas pastas
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = safeJoin(process.cwd(), 'analytical_reports', decodedUrl);
          if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
              filePath = safeJoin(process.cwd(), 'executive_reports', decodedUrl);
              if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
                  filePath = safeJoin(process.cwd(), 'portal', 'dist', decodedUrl);
              }
          }
      }

      // Se achou um arquivo real, serve ele
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
      } else {
          // SPA Fallback: Se não achou e não é uma requisição de API, serve o index.html do React
          const indexPath = safeJoin(process.cwd(), 'portal', 'dist', 'index.html');
          if (fs.existsSync(indexPath)) {
              res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
              fs.createReadStream(indexPath).pipe(res);
          } else {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('404 Not Found');
          }
      }
  } catch {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
  }
});

server.listen(PORT, () => {
    console.log(`🚀 Portal de Dashboards rodando em http://localhost:${PORT}`);
});
