@echo off
echo ========================================
echo    READING ADVENTURE - LAUNCHER
echo ========================================
echo.
echo Starting backend server...

REM Start the backend in a new window
start cmd /k "cd backend && node server.js"

REM Wait 3 seconds for backend to initialize
timeout /t 3 /nobreak > nul

echo Starting frontend...
start cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo ✅ GAME IS RUNNING!
echo ========================================
echo.
echo Open your browser to: http://localhost:3000
echo.
echo ℹ️  Close both terminal windows to stop the game
echo.
pause