# Скрипт для обновления Discord Client Secret

Write-Host "=================================="
Write-Host "Обновление Discord Client Secret"
Write-Host "=================================="
Write-Host ""
Write-Host "1. Откройте Discord Developer Portal"
Write-Host "2. Перейдите в OAuth2 вашего приложения"
Write-Host "3. Нажмите 'Reset Secret' и скопируйте показанный секрет"
Write-Host ""

$secret = Read-Host "Введите Client Secret из Discord"

if ([string]::IsNullOrWhiteSpace($secret)) {
    Write-Host "❌ Секрет не может быть пустым!" -ForegroundColor Red
    exit 1
}

# Обновляем .env файл
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    (Get-Content $envPath) -replace 'DISCORD_CLIENT_SECRET=.*', "DISCORD_CLIENT_SECRET=$secret" | Set-Content $envPath
    Write-Host "✅ Client Secret успешно обновлен в .env файле!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Теперь:"
    Write-Host "1. Убедитесь что в Discord Portal в Redirects есть:"
    Write-Host "   https://bublickrust.ru/signin-discord"
    Write-Host "2. Нажмите 'Save Changes' в Discord Portal"
    Write-Host "3. Перезапустите сервер"
} else {
    Write-Host "❌ Файл .env не найден!" -ForegroundColor Red
    exit 1
}

