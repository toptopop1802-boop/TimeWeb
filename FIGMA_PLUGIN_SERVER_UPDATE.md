# 🚀 Обновление сервера для Figma плагина

## Что изменено:

### ✅ Dashboard (server.js)
1. **Глобальный CORS middleware** - позволяет Figma плагину делать запросы
2. **Детальное логирование** - показывает все входящие запросы на загрузку изображений
3. **Удалены дублирующиеся CORS headers** - теперь все централизовано

## 📋 Применить на сервере:

```bash
# 1. Подключитесь к серверу
ssh root@bublickrust.ru

# 2. Перейдите в папку проекта
cd /root/dsbot

# 3. Получите последние изменения
git pull origin main

# 4. Перезапустите dashboard
cd dashboard
pm2 restart dsbot

# 5. Проверьте логи
pm2 logs dsbot --lines 50
```

## 🔍 Что искать в логах:

Когда Figma плагин отправит запрос, вы увидите:

```
📤 [Image Upload] Request received
   Headers: {
     "authorization": "Bearer 58076245d1f7985...",
     "content-type": "multipart/form-data; boundary=...",
     ...
   }
   File: figma-image-10352062.png (451156 bytes)
   ✅ Authenticated as: username
```

Или если есть ошибка:

```
📤 [Image Upload] Request received
   Headers: {...}
   File: NO FILE
   ❌ Auth failed
```

## 🧪 Тест после обновления:

1. **В Figma:** Перезагрузите плагин (`Ctrl+Alt+P` → выберите плагин снова)
2. **Выберите Frame** с изображением
3. **Нажмите "Генерировать код"**
4. **На сервере:** Смотрите логи `pm2 logs dsbot`

## ⚡ Что исправлено:

### Проблема 1: CORS блокирует preflight запросы
**До:**
- CORS headers добавлялись только в конкретный endpoint
- OPTIONS запрос мог не проходить

**После:**
- Глобальный middleware обрабатывает все OPTIONS запросы
- CORS headers на всех маршрутах

### Проблема 2: Нет логов для отладки
**До:**
- Неясно, доходят ли запросы от Figma

**После:**
- Детальные логи показывают headers, file, auth статус
- Легко диагностировать проблемы

## 🎯 Ожидаемый результат:

После обновления Figma плагин должен успешно загружать изображения:

```
📤 [1/1] Загружаю: figma-image-10352062.png
   📊 Размер: 440.59 KB
   🔨 Создаю multipart/form-data...
   📦 Размер запроса: 440.77 KB
   🌐 Отправка POST на: https://bublickrust.ru/api/images/upload
   🔑 Authorization: Bearer 58076245d1f7985...
   📥 Статус: 200 OK
   📄 Ответ: {"success":true,...}
   ✅ Успех! URL: https://bublickrust.ru/i/ABC1234
```

---

## 🆘 Если проблема осталась:

Смотрите логи сервера и отправьте их мне:

```bash
pm2 logs dsbot --lines 100 > figma_logs.txt
cat figma_logs.txt
```

Также проверьте в браузерной консоли Figma, что именно приходит в ответ.

