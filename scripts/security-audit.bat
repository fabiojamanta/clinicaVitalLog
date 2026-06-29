@echo off
setlocal
cd /d "%~dp0.."

echo === pip-audit (backend) ===
cd backend
if exist .venv\Scripts\pip.exe (
  .venv\Scripts\pip.exe install pip-audit -q
  .venv\Scripts\pip-audit.exe -r requirements.txt
) else (
  pip install pip-audit -q
  pip-audit -r requirements.txt
)
cd ..

echo.
echo === npm audit (frontend) ===
cd frontend
call npm audit --audit-level=high
cd ..

echo.
echo Auditoria concluida.
