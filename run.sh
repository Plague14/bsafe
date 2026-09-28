#!/bin/bash

echo "============================================"
echo "          BSafe - Iniciando Projeto"
echo "============================================"
echo

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERRO] Node.js não encontrado!${NC}"
    echo "Por favor, instale o Node.js em: https://nodejs.org/"
    exit 1
fi

# Mostra versão do Node.js
echo -e "${GREEN}[INFO]${NC} Node.js versão:"
node --version
echo

# Navega para o diretório do script
cd "$(dirname "$0")"

# Verifica se node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[INFO]${NC} Instalando dependências..."
    echo
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERRO] Falha ao instalar dependências!${NC}"
        exit 1
    fi
    echo
fi

# Inicia o servidor de desenvolvimento
echo -e "${GREEN}[INFO]${NC} Iniciando servidor de desenvolvimento..."
echo -e "${GREEN}[INFO]${NC} Acesse: http://localhost:5173"
echo -e "${YELLOW}[INFO]${NC} Pressione Ctrl+C para parar"
echo

npm run dev
