#!/bin/bash

# Cores para logs
GREEN='\033[0;32m'
NC='\033[0m'

# Verifica argumentos
if [ "$#" -ne 2 ]; then
    echo "Uso: $0 <DOMINIO> <URL_REPO_GITHUB>"
    echo "Exemplo: $0 meudominio.com https://github.com/usuario/repo.git"
    exit 1
fi

DOMAIN=$1
REPO_URL=$2
APP_DIR="/var/www/$DOMAIN"
DB_NAME="pagegenius"
DB_USER="pagegenius_user"
DB_PASS="pagegenius_password" # Em produção, gere isso aleatoriamente ou peça input

echo -e "${GREEN}>>> Atualizando Sistema...${NC}"
sudo apt update && sudo apt upgrade -y

echo -e "${GREEN}>>> Instalando Dependências (Node, Nginx, PostgreSQL, Git)...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx postgresql postgresql-contrib git certbot python3-certbot-nginx

echo -e "${GREEN}>>> Configurando PostgreSQL...${NC}"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true

# Permite que o usuário crie as tabelas
sudo -u postgres psql -d $DB_NAME -c "ALTER SCHEMA public OWNER TO $DB_USER;"

echo -e "${GREEN}>>> Configurando Aplicação...${NC}"
# Cria diretório se não existir
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Clone ou Pull
if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR
    git pull
else
    git clone $REPO_URL $APP_DIR
    cd $APP_DIR
fi

# Instala dependências e Build
echo -e "${GREEN}>>> Instalando pacotes e gerando Build...${NC}"
npm install
npm run build

# Configuração do .env (Interativo simplificado)
if [ ! -f .env ]; then
    echo -e "${GREEN}>>> Criando arquivo .env...${NC}"
    cat > .env <<EOF
PORT=3000
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$(openssl rand -hex 32)
API_KEY=SUA_API_KEY_AQUI
EOF
    echo "AVISO: Um arquivo .env foi criado. Edite-o com sua API KEY do Gemini depois: nano $APP_DIR/.env"
fi

# Migração do Banco de Dados (Schema)
echo -e "${GREEN}>>> Executando Migrações...${NC}"
PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME -f schema.sql

# Configuração do PM2 (Process Manager)
echo -e "${GREEN}>>> Configurando PM2...${NC}"
sudo npm install -g pm2
pm2 delete pagegenius-backend || true
pm2 start server/index.js --name "pagegenius-backend"
pm2 save
pm2 startup | bash || true

# Configuração do Nginx
echo -e "${GREEN}>>> Configurando Nginx...${NC}"
sudo rm /etc/nginx/sites-enabled/default || true

cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Frontend (Arquivos Estáticos do Vite)
    location / {
        root $APP_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    # Backend (API Proxy)
    location /auth {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /admin {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /pages {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

echo -e "${GREEN}>>> Instalação Concluída!${NC}"
echo "Sua aplicação deve estar rodando em http://$DOMAIN"
echo "Para configurar HTTPS, rode: sudo certbot --nginx -d $DOMAIN"
