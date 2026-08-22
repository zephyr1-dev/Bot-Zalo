@echo off
setlocal

if not exist "node_modules" (
    echo "No required modules found, starting module installation process..."
    npm install
) else (
    echo "Starting Bot Zalo HA HUY HOANG  - V2.5.0 Developed by HA HUY HOANG"
)

npm run bot

endlocal
