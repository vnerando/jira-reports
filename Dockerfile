FROM node:20-bullseye-slim

# Instalar dependências necessárias para o Puppeteer (Chromium Headless)
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar a variável para que o Puppeteer use a instalação do Google Chrome local (economiza espaço e evita erro de download no NPM)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Copiar os arquivos de lock e packages primeiro
COPY package*.json ./
COPY portal/package*.json ./portal/

# Instalar as dependências de backend e de frontend
RUN npm install
RUN cd portal && npm install

# Copiar todo o código fonte restante
COPY . .

# Fazer o build de produção do Frontend (cria a pasta portal/dist)
RUN cd portal && npm run build

# O servidor precisa estar acessível de fora
EXPOSE 3000

# Script inicial nativo do backend
CMD ["node", "--env-file=credentials/.env", "server.mjs"]
