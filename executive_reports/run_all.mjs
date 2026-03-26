import { execSync } from 'child_process';
import path from 'path';

console.log('=== Iniciando Geração do Relatório Executivo e Envio por E-mail ===');

try {
  console.log('\n[1/3] Gerando dados analíticos e atualizando Dashboard...');
  execSync('node executive_reports/executive_report_generator.mjs', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n[2/3] Consolidando PDF com Template (Premium)...');
  execSync('node executive_reports/pdf_with_template.mjs', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n[3/3] Enviando E-mail...');
  execSync('node executive_reports/send_report_email.mjs', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n✅ Processo concluído com sucesso!');
} catch (error) {
  console.error('\n❌ Erro durante a execução do processo:', error.message);
}
