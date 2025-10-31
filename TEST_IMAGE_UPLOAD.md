# 🖼️ Тестирование Image Upload API

Инструкции для тестирования загрузки изображений через API.

## 📋 Доступные методы тестирования

### 1. **HTML-страница (Веб-интерфейс)** ⭐ Рекомендуется

Самый простой способ для тестирования!

**Как использовать:**

1. Откройте в браузере: `https://bublickrust.ru/test-image-upload.html`
2. Введите ваш токен (или он загрузится автоматически из localStorage)
3. Выберите изображение
4. Нажмите "Загрузить"
5. Смотрите подробный лог и результат!

**Преимущества:**
- ✅ Детальный лог всех операций
- ✅ Автоматическая загрузка токена
- ✅ Предпросмотр загруженного изображения
- ✅ Копирование ссылки одной кнопкой
- ✅ Красивый интерфейс

---

### 2. **Python скрипт**

**Требования:**
```bash
pip install requests
```

**Использование:**
```bash
python test_image_upload.py photo.jpg "YOUR_AUTH_TOKEN"
```

**Пример с другим API URL:**
```bash
python test_image_upload.py photo.jpg "YOUR_TOKEN" "http://localhost:3000/api/images/upload"
```

**Что делает:**
- ✅ Проверяет существование файла
- ✅ Проверяет размер и формат
- ✅ Показывает детальный лог запроса
- ✅ Выводит прямую ссылку на загруженное изображение

---

### 3. **Node.js скрипт**

**Использование:**
```bash
node test-image-upload.js photo.jpg "YOUR_AUTH_TOKEN"
```

**Пример с другим API URL:**
```bash
node test-image-upload.js photo.jpg "YOUR_TOKEN" "http://localhost:3000/api/images/upload"
```

**Преимущества:**
- ✅ Не требует дополнительных зависимостей (только Node.js)
- ✅ Полный контроль над запросом
- ✅ Детальный лог всех операций

---

### 4. **cURL (командная строка)**

**Простой запрос:**
```bash
curl -X POST https://bublickrust.ru/api/images/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@photo.jpg"
```

**С детальным выводом:**
```bash
curl -X POST https://bublickrust.ru/api/images/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@photo.jpg" \
  -v
```

---

## 🔑 Получение токена авторизации

### Способ 1: Через консоль браузера

1. Войдите на сайт `https://bublickrust.ru`
2. Откройте консоль браузера (F12)
3. Выполните команду:
   ```javascript
   localStorage.getItem("auth_token")
   ```
4. Скопируйте полученный токен

### Способ 2: Из DevTools

1. Откройте DevTools (F12)
2. Перейдите в Application → Local Storage → https://bublickrust.ru
3. Найдите ключ `auth_token`
4. Скопируйте значение

---

## 📝 Формат API

### Endpoint
```
POST /api/images/upload
```

### Headers
```
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data
```

### Body
```
FormData с полем "image"
```

### Успешный ответ (200)
```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "shortCode": "A1B2C3D",
  "directUrl": "https://bublickrust.ru/i/A1B2C3D"
}
```

### Ошибка (4xx/5xx)
```json
{
  "error": "Описание ошибки"
}
```

---

## ⚠️ Ограничения

- **Максимальный размер файла:** 15 MB
- **Разрешенные форматы:** PNG, JPG, JPEG, GIF, WebP
- **Авторизация:** Обязательна (Bearer token)

---

## 🐛 Возможные ошибки

### `Failed to fetch`
**Причина:** CORS, сетевая ошибка, или сервер недоступен

**Решение:**
1. Проверьте, что сервер запущен
2. Проверьте CORS настройки в `server.js`
3. Проверьте URL API

### `403 Forbidden`
**Причина:** Неверный или истекший токен

**Решение:**
1. Получите новый токен из localStorage
2. Убедитесь, что токен передается в заголовке `Authorization: Bearer TOKEN`

### `400 Bad Request - Файл не получен`
**Причина:** Файл не был отправлен или неправильное имя поля

**Решение:**
1. Убедитесь, что поле формы называется `"image"`
2. Проверьте, что файл правильно прикреплен к FormData

### `413 Payload Too Large`
**Причина:** Файл слишком большой

**Решение:**
- Сожмите изображение до размера < 15 MB

### `Bucket not found`
**Причина:** Storage bucket "images" не создан в Supabase

**Решение:**
1. Войдите в Supabase Dashboard
2. Перейдите в Storage
3. Создайте bucket с именем `images`
4. Установите Public access

---

## 🔧 Отладка

### Включить подробный лог в браузере

Откройте консоль браузера (F12) и используйте HTML-страницу для тестирования.

### Проверить статус API

```bash
curl https://bublickrust.ru/api/health
```

Ответ должен содержать:
```json
{
  "status": "ok",
  "supabase": true
}
```

### Проверить доступ к /api/images/upload

```bash
curl https://bublickrust.ru/api/images/upload
```

Должна открыться красивая HTML-страница со статусом API.

---

## 📞 Поддержка

Если ничего не помогает:

1. Проверьте логи сервера:
   ```bash
   pm2 logs dsbot
   ```

2. Проверьте, что сервер запущен:
   ```bash
   pm2 status
   ```

3. Перезапустите сервер:
   ```bash
   pm2 restart dsbot
   ```

---

## ✅ Быстрый чеклист

- [ ] Сервер запущен (`pm2 status`)
- [ ] API отвечает (`curl /api/health`)
- [ ] Токен актуален (проверить в localStorage)
- [ ] Файл < 15 MB
- [ ] Файл в правильном формате (PNG/JPG/GIF/WebP)
- [ ] Supabase Storage bucket "images" создан
- [ ] CORS включен в server.js

---

**Удачи с тестированием! 🚀**

