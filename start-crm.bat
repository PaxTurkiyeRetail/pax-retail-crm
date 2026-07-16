@echo off
cd /d C:\Users\user\Desktop\Repos\DevOPS\pax-retail-crm-finalv1

if not exist logs mkdir logs

echo ================================ >> logs\service-debug.log
echo CRM start: %date% %time% >> logs\service-debug.log

set NODE_ENV=production
set PORT=3000

"C:\Program Files\nodejs\npm.cmd" run start >> logs\service-debug.log 2>&1