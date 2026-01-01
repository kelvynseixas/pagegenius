#!/bin/bash

# SEUS DADOS
DOMAIN="pagegenius.maisalem.net"
REPO="https://github.com/kelvynseixas/pagegenius.git"
API_KEY="AIzaSyBmdktClDSXnHx0Yhc4iOqIkxfWpLckE2U"
DB_PASS="Pg_Genius_2024_Secure!" # Senha gerada automaticamente para segurança
JWT_SECRET=$(openssl rand -hex 32)

APP_DIR="/var/www/pagegenius"
DB_NAME="pagegenius"
DB_USER="pagegenius_user"

# 1. Instalar Dependências do Sistema
echo ">>> Instalando dependências..."
sudo apt update
sudo apt install -y nodejs npm nginx postgresql postgresql-contrib git certbot python3-certbot-nginx
# Garante Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Configurar Banco de Dados PostgreSQL
echo ">>> Configurando Banco de Dados..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || true
sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "ALTER SCHEMA public OWNER TO $DB_USER;"

# 3. Clonar Repositório e Configurar App
echo ">>> Configurando Aplicação..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR
    git pull
else
    git clone $REPO $APP_DIR
    cd $APP_DIR
fi

# 4. Criar arquivo .env
echo ">>> Criando .env..."
cat > .env <<EOF
PORT=3000
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
API_KEY=$API_KEY
EOF

# 5. Instalar Dependências e Buildar
echo ">>> Instalando pacotes e gerando build..."
npm install
npm run build

# 6. Configurar PM2 (Gerenciador de Processos)
echo ">>> Iniciando Servidor com PM2..."
sudo npm install -g pm2
pm2 delete pagegenius || true
pm2 start server/index.js --name "pagegenius"
pm2 save
pm2 startup | bash || true

# 7. Configurar Nginx (Proxy Reverso)
echo ">>> Configurando Nginx..."
cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/ || true
sudo rm /etc/nginx/sites-enabled/default || true
sudo nginx -t
sudo systemctl restart nginx

# 8. HTTPS (SSL)
echo ">>> Configurando SSL..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || echo "Aviso: Certbot falhou ou já existe."

echo ">>> DEPLOY CONCLUÍDO! Acesse: https://$DOMAIN"
