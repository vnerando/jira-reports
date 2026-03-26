import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function deploy() {
  console.log('🚀 Iniciando deployização para 10.254.192.212...');
  try {
    await ssh.connect({
      host: '10.254.192.212',
      username: 'root',
      password: 'Bw37!Xy29%'
    });
    console.log('✅ Conectado ao servidor!');

    console.log('📦 Criando diretório remoto /root/jira-reports...');
    await ssh.execCommand('mkdir -p /root/jira-reports');

    console.log('⬆️ Fazendo upload do pacote deploy.tgz...');
    await ssh.putFile('deploy.tgz', '/root/jira-reports/deploy.tgz');
    console.log('✅ Upload concluído!');

    console.log('💥 Extraindo arquivos e subindo o Docker (Isso pode demorar alguns minutos)...');
    const result = await ssh.execCommand('cd /root/jira-reports && tar -xzf deploy.tgz && docker-compose up -d --build || docker compose up -d --build', {
      onStdout: (chunk) => process.stdout.write(chunk.toString('utf8')),
      onStderr: (chunk) => process.stderr.write(chunk.toString('utf8'))
    });

    console.log('Código de Saída:', result.code);
    if (result.code !== 0) {
      console.error('❌ Erro no build/docker-compose!');
    } else {
      console.log('🎉 Deploy concluído com sucesso!');
    }

  } catch (error) {
    console.error('❌ Falha dramática:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
