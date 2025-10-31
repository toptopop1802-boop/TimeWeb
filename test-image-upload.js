#!/usr/bin/env node
/**
 * Тест загрузки изображений через API
 * Использование: node test-image-upload.js <path_to_image> <auth_token>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Цвета для вывода
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSuccess(msg) {
    log(`✅ ${msg}`, 'green');
}

function logError(msg) {
    log(`❌ ${msg}`, 'red');
}

function logInfo(msg) {
    log(`ℹ️  ${msg}`, 'cyan');
}

function logWarning(msg) {
    log(`⚠️  ${msg}`, 'yellow');
}

function logHeader(msg) {
    console.log();
    log('='.repeat(60), 'blue');
    log(msg, 'blue');
    log('='.repeat(60), 'blue');
    console.log();
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function uploadImage(imagePath, token, apiUrl = 'https://bublickrust.ru/api/images/upload') {
    logHeader('🖼️  Тест загрузки изображений через API');

    // Проверка файла
    if (!fs.existsSync(imagePath)) {
        logError(`Файл не найден: ${imagePath}`);
        return false;
    }

    const stats = fs.statSync(imagePath);
    const fileName = path.basename(imagePath);
    const fileExt = path.extname(imagePath).toLowerCase();
    const fileSize = stats.size;

    logInfo(`Файл: ${fileName}`);
    logInfo(`Размер: ${formatSize(fileSize)}`);
    logInfo(`Тип: ${fileExt}`);

    // Проверка расширения
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (!allowedExtensions.includes(fileExt)) {
        logWarning(`Файл может быть отклонен. Разрешенные форматы: ${allowedExtensions.join(', ')}`);
    }

    // Проверка размера
    const maxSize = 15 * 1024 * 1024; // 15 MB
    if (fileSize > maxSize) {
        logError(`Файл слишком большой! Максимум: ${formatSize(maxSize)}`);
        return false;
    }

    logInfo(`API URL: ${apiUrl}`);
    logInfo(`Token: ${token.substring(0, 20)}...`);

    try {
        console.log('\n🚀 Начинаю загрузку...\n');

        // Читаем файл
        const fileBuffer = fs.readFileSync(imagePath);

        // Создаем multipart/form-data
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const mimeType = getMimeType(fileExt);

        const formData = Buffer.concat([
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from(`Content-Disposition: form-data; name="image"; filename="${fileName}"\r\n`),
            Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`),
            fileBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        // Парсим URL
        const url = new URL(apiUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': formData.length
            }
        };

        logInfo('📤 Отправка POST запроса...');

        // Отправляем запрос
        const response = await new Promise((resolve, reject) => {
            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage,
                        headers: res.headers,
                        body: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));

            req.write(formData);
            req.end();
        });

        logInfo(`📥 Статус: ${response.statusCode} ${response.statusMessage}`);
        logInfo(`📄 Content-Type: ${response.headers['content-type'] || 'unknown'}`);
        logInfo(`📄 Тело ответа (${response.body.length} символов):`);
        log(response.body.substring(0, 500), 'cyan');

        // Парсим JSON
        let data;
        try {
            data = JSON.parse(response.body);
        } catch (e) {
            logError(`Ошибка парсинга JSON: ${e.message}`);
            logError(`Полный ответ: ${response.body}`);
            return false;
        }

        // Проверка результата
        if (response.statusCode === 200 && data.success) {
            logSuccess('Изображение успешно загружено!');
            console.log('\n' + '='.repeat(60));
            log('📊 Результат:', 'bright');
            console.log('='.repeat(60));
            console.log(`  ${colors.bright}ID:${colors.reset} ${data.id}`);
            console.log(`  ${colors.bright}Short Code:${colors.reset} ${data.shortCode}`);
            console.log(`  ${colors.bright}Прямая ссылка:${colors.reset}`);
            console.log(`    ${colors.green}${data.directUrl}${colors.reset}`);
            console.log('='.repeat(60) + '\n');
            return true;
        } else {
            const errorMsg = data.error || 'Неизвестная ошибка';
            logError(`Ошибка API: ${errorMsg}`);
            return false;
        }

    } catch (error) {
        logError(`Ошибка: ${error.message}`);
        console.error(error);
        return false;
    }
}

function getMimeType(ext) {
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// Main
async function main() {
    logHeader('🧪 Image Upload API Tester');

    if (process.argv.length < 4) {
        logError('Недостаточно аргументов!');
        console.log(`\n${colors.bright}Использование:${colors.reset}`);
        console.log(`  node ${path.basename(process.argv[1])} <путь_к_изображению> <auth_token>\n`);
        console.log(`${colors.bright}Пример:${colors.reset}`);
        console.log(`  node ${path.basename(process.argv[1])} photo.jpg 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'\n`);
        process.exit(1);
    }

    const imagePath = process.argv[2];
    const token = process.argv[3];
    const apiUrl = process.argv[4] || 'https://bublickrust.ru/api/images/upload';

    const success = await uploadImage(imagePath, token, apiUrl);

    if (success) {
        logSuccess('Тест пройден успешно! 🎉');
        process.exit(0);
    } else {
        logError('Тест провален ❌');
        process.exit(1);
    }
}

main();

