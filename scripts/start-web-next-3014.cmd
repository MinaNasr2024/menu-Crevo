@echo off
set PORT=3014
cd /d C:\Users\Media\Documents\food--Crevo\web-next
start "" /b cmd /c ""C:\Program Files\nodejs\node.exe" --preserve-symlinks --preserve-symlinks-main dev-server.mjs > "%TEMP%\crevo-next-3014.out.log" 2> "%TEMP%\crevo-next-3014.err.log""
