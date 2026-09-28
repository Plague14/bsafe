@echo off
chcp 65001 >nul
title BSafe - Development Server

echo ============================================
echo           BSafe - Iniciando Projeto
echo ============================================
echo.

:: Verifica se o Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js nao encontrado!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b 1
)

:: Mostra versão do Node.js
echo [INFO] Node.js versao:
node --version
echo.

:: Verifica se node_modules existe
if not exist "node_modules\" (
    echo [INFO] Instalando dependencias...
    echo.
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERRO] Falha ao instalar dependencias!
        pause
        exit /b 1
    )
    echo.
)

:: Inicia o servidor de desenvolvimento
echo [INFO] Iniciando servidor de desenvolvimento...
echo [INFO] Acesse: http://localhost:5173
echo [INFO] Pressione Ctrl+C para parar
echo.

call npm run dev

pause
