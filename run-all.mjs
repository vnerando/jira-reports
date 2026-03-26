import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Iniciando Portal e Servidor Backend...');

// 1. Iniciar Backend (Porta 3000)
const backend = spawn('node', ['--env-file=credentials/.env', 'server.mjs'], {
    stdio: 'inherit',
    shell: true
});

// 2. Iniciar Frontend (Porta 5173)
const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(process.cwd(), 'portal'),
    stdio: 'inherit',
    shell: true
});

// Tratamento de saída amigável
backend.on('error', (err) => console.error('❌ Erro no Backend:', err));
frontend.on('error', (err) => console.error('❌ Erro no Frontend:', err));

process.on('SIGINT', () => {
    backend.kill();
    frontend.kill();
    process.exit();
});
