@echo off
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules\" (
  echo [ERRO] Dependencias nao encontradas em frontend\node_modules
  echo Instale uma vez: npm install
  pause
  exit /b 1
)

echo.
echo Sanelis Medical EcoSystem - Frontend
echo API local:   http://localhost:8000  (rode start-backend.bat antes)
echo Aplicacao:   http://localhost:4200
echo.
echo Pressione Ctrl+C para encerrar.
echo.

npm start
