@echo off
echo =======================================================================
echo           DIVINEPARK — SCRIPT DE ARRANQUE DEL SERVIDOR LOCAL
echo =======================================================================
echo.
echo [1/3] Detectando entorno virtual (venv)...
if not exist "%~dp0venv\Scripts\activate.bat" (
    echo [ERROR] No se encontro el entorno virtual en la carpeta actual.
    echo Por favor ejecuta: python -m venv venv e instala los requerimientos.
    pause
    exit /b
)

echo [2/3] Activando entorno virtual...
call "%~dp0venv\Scripts\activate.bat"

echo [3/3] Iniciando servidor de desarrollo de Django (http://127.0.0.1:8000)...
echo Presiona Ctrl+C para detener el servidor.
echo.
python "%~dp0manage.py" runserver

pause
