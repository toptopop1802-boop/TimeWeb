# PowerShell скрипт для запуска бота и дашборда одновременно

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Discord Bot + Dashboard Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Python
Write-Host "[1/5] Проверка Python..." -ForegroundColor Yellow
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python не найден! Установите Python 3.8+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Python найден: $(python --version)" -ForegroundColor Green

# Проверка наличия Node.js
Write-Host "[2/5] Проверка Node.js..." -ForegroundColor Yellow
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js не найден! Установите Node.js 16+" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js найден: $(node --version)" -ForegroundColor Green

# Проверка виртуального окружения Python
Write-Host "[3/5] Проверка виртуального окружения..." -ForegroundColor Yellow
if (!(Test-Path "botenv\Scripts\activate.ps1")) {
    Write-Host "⚠️  Виртуальное окружение не найдено. Создаю..." -ForegroundColor Yellow
    python -m venv botenv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка создания виртуального окружения!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Виртуальное окружение создано" -ForegroundColor Green
    
    Write-Host "📦 Установка Python зависимостей..." -ForegroundColor Yellow
    & "botenv\Scripts\pip.exe" install -r requirements.txt
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка установки зависимостей!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ Виртуальное окружение найдено" -ForegroundColor Green
}

# Проверка node_modules
Write-Host "[4/5] Проверка Node.js зависимостей..." -ForegroundColor Yellow
if (!(Test-Path "dashboard\node_modules")) {
    Write-Host "⚠️  Node modules не найдены. Устанавливаю..." -ForegroundColor Yellow
    Push-Location dashboard
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка установки зависимостей!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "✅ Node modules установлены" -ForegroundColor Green
} else {
    Write-Host "✅ Node modules найдены" -ForegroundColor Green
}

# Проверка .env файлов
Write-Host "[5/5] Проверка конфигурации..." -ForegroundColor Yellow
$envMissing = $false
if (!(Test-Path ".env")) {
    Write-Host "⚠️  Файл .env не найден в корне проекта!" -ForegroundColor Yellow
    $envMissing = $true
}
if (!(Test-Path "dashboard\.env")) {
    Write-Host "⚠️  Файл .env не найден в dashboard!" -ForegroundColor Yellow
    $envMissing = $true
}

if ($envMissing) {
    Write-Host "⚠️  Создайте .env файлы на основе env.example" -ForegroundColor Yellow
    Write-Host "   Продолжаю запуск..." -ForegroundColor Yellow
} else {
    Write-Host "✅ Конфигурация найдена" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Запуск сервисов..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Функция для запуска процесса и вывода логов
function Start-Service {
    param(
        [string]$Name,
        [string]$Command,
        [string]$WorkingDirectory = $PWD
    )
    
    Write-Host "🚀 Запуск $Name..." -ForegroundColor Cyan
    
    $job = Start-Job -ScriptBlock {
        param($cmd, $dir)
        Set-Location $dir
        Invoke-Expression $cmd
    } -ArgumentList $Command, $WorkingDirectory
    
    return $job
}

# Запуск Discord бота
$botJob = Start-Service -Name "Discord Bot" -Command "botenv\Scripts\python.exe broadcast_bot.py"

# Небольшая задержка перед запуском дашборда
Start-Sleep -Seconds 2

# Запуск Dashboard
$dashboardJob = Start-Service -Name "Dashboard" -Command "node server.js" -WorkingDirectory "$PWD\dashboard"

Write-Host ""
Write-Host "✅ Сервисы запущены!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🤖 Discord Bot: Работает в фоне" -ForegroundColor Cyan
Write-Host ""
Write-Host "Нажмите Ctrl+C для остановки всех сервисов" -ForegroundColor Yellow
Write-Host ""

# Обработчик Ctrl+C
$null = Register-ObjectEvent -InputObject ([System.Console]) -EventName CancelKeyPress -Action {
    Write-Host "`n`n⏹️  Остановка сервисов..." -ForegroundColor Yellow
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "✅ Все сервисы остановлены" -ForegroundColor Green
    exit 0
}

# Вывод логов в реальном времени
try {
    while ($true) {
        # Вывод логов бота
        Receive-Job -Job $botJob -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "[BOT] $_" -ForegroundColor Magenta
        }
        
        # Вывод логов дашборда
        Receive-Job -Job $dashboardJob -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "[DASH] $_" -ForegroundColor Blue
        }
        
        # Проверка статуса jobs
        if (($botJob.State -eq "Failed" -or $botJob.State -eq "Stopped") -and 
            ($dashboardJob.State -eq "Failed" -or $dashboardJob.State -eq "Stopped")) {
            Write-Host "❌ Все сервисы остановлены" -ForegroundColor Red
            break
        }
        
        Start-Sleep -Milliseconds 100
    }
} finally {
    # Очистка
    Get-Job | Stop-Job
    Get-Job | Remove-Job
    Write-Host "`n✅ Очистка завершена" -ForegroundColor Green
}

