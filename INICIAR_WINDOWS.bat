@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js nao encontrado. Instale Node 22 ou superior antes de continuar.
 pause
 exit /b 1
)
if not exist node_modules (
 echo Instalando as dependencias do OrçaPro... Este passo requer conexao com o registro npm.
 call npm install
 if errorlevel 1 (
  echo Falha na instalacao. Verifique internet, proxy e versao do Node.
  pause
  exit /b 1
 )
)
echo Iniciando OrçaPro em http://localhost:3000
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
call npm run dev
pause
