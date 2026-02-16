@echo off
echo ========================================
echo    READING ADVENTURE - SETUP
echo ========================================
echo.
echo This will install everything needed to run the game.
echo.

echo Step 1: Installing Backend Dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Backend installation failed!
    pause
    exit /b %errorlevel%
)
echo ✅ Backend installed successfully!
echo.

echo Step 2: Installing Frontend Dependencies...
cd ../frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ Frontend installation failed!
    pause
    exit /b %errorlevel%
)
echo ✅ Frontend installed successfully!
echo.

echo ========================================
echo ✅ SETUP COMPLETE!
echo ========================================
echo.
echo To PLAY the game:
echo 1. Double-click PLAY.bat
echo 2. Open your browser to http://localhost:3000
echo.
pause