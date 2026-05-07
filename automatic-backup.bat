@echo off
cd /d "c:\Or\web\projects\backups-manager"
echo Starting Automatic Differential Backup...
npm run sync
echo.
echo Backup process finished.
pause
