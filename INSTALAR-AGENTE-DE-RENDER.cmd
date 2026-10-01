@echo off
REM Reels Engine IA - instala o Agente de Render (executar UMA unica vez).
REM Depois disso o agente liga sozinho com o Windows. Nao e preciso rodar de novo.
cd /d "%~dp0"
node scripts\agent-install.mjs
pause
