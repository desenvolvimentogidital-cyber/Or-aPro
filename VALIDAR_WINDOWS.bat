@echo off
setlocal
cd /d "%~dp0"
echo Verificando requisitos e compilacao antes do lancamento...
call npm install
if errorlevel 1 goto failed
call npm run lint
if errorlevel 1 goto failed
call npm run test:logic
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo Verificacoes automaticas locais concluidas. Ainda e necessario validar os fluxos reais e seguranca.
pause
exit /b 0
:failed
echo Alguma etapa falhou. Nao publique o sistema ate corrigir o erro.
pause
exit /b 1
