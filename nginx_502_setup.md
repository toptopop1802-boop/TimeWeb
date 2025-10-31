# Установка кастомной страницы ошибки 502

## Шаги для установки:

### 1. Скопировать файл 502.html на сервер

```bash
# Скопировать файл в директорию nginx
sudo cp dashboard/public/502.html /var/www/bublickrust/502.html

# Или создать директорию, если её нет
sudo mkdir -p /var/www/bublickrust
sudo cp dashboard/public/502.html /var/www/bublickrust/502.html

# Установить правильные права
sudo chown www-data:www-data /var/www/bublickrust/502.html
sudo chmod 644 /var/www/bublickrust/502.html
```

### 2. Обновить конфигурацию nginx

```bash
# Скопировать обновленный конфиг
sudo cp nginx_config_bublickrust.conf /etc/nginx/sites-available/bublickrust

# Или если конфиг уже есть, добавить в него строки из файла:
# - error_page директивы (строки 9-12)
# - location для /502.html (строки 15-18)
# - proxy_intercept_errors и error_page в location / (строки 81-83)
# - location @fallback (строки 86-90)

# Проверить конфигурацию
sudo nginx -t

# Перезагрузить nginx
sudo systemctl reload nginx
```

### 3. Альтернативный вариант (если файл в dashboard/public)

Если вы хотите, чтобы 502.html отдавался через Node.js сервер (из папки dashboard/public), то можно:

1. Добавить маршрут в server.js для `/502.html`
2. Или использовать статическую отдачу через nginx напрямую (как в конфиге)

### 4. Проверка

Чтобы проверить, что страница работает:
```bash
# Временно остановить Node.js сервер
# Затем попробовать открыть сайт - должна показаться красивая страница 502
```

## Важно:

- Файл должен быть доступен по пути `/var/www/bublickrust/502.html`
- Если используется другой путь, измените `root` в конфигурации nginx
- Страница автоматически обновляется каждые 30 секунд
- Кнопка "Обновить страницу" позволяет вручную перезагрузить

