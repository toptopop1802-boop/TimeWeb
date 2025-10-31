# 🎨 Figma Plugin: Frame to HTML/CSS Exporter

Плагин для экспорта Figma фреймов в HTML/CSS код с автоматической загрузкой изображений на ваш сервер.

## ✨ Возможности

- 🖼️ **Автоматическая загрузка изображений** через ваш API
- 🎨 **Полный экспорт стилей**: цвета, прозрачность, тени, границы, скругления
- 📐 **Точная позиция элементов**: absolute позиционирование
- 📝 **Экспорт текста**: размер, шрифт, цвет, выравнивание
- 🔗 **Прямые ссылки на изображения**: загруженные через bublickrust.ru API
- 📋 **Копирование одной кнопкой**: HTML и CSS отдельно

## 🚀 Установка плагина в Figma

### Способ 1: Через Figma Desktop App

1. **Откройте Figma Desktop**

2. **Перейдите в меню плагинов:**
   - `Plugins` → `Development` → `Import plugin from manifest...`

3. **Выберите файл:**
   - Найдите файл `manifest.json` в папке `figma-plugin`

4. **Готово!** Плагин появится в списке

### Способ 2: Через Figma Community (публикация)

1. Опубликуйте плагин в Figma Community
2. Другие пользователи смогут установить его напрямую

## 📋 Как использовать

### Шаг 1: Выберите фрейм

1. Откройте ваш Figma файл
2. Выберите **Frame**, **Component** или **Instance**
3. Убедитесь, что в нем есть элементы

### Шаг 2: Запустите плагин

1. Нажмите `Plugins` → `Frame to HTML/CSS Exporter`
2. Откроется окно плагина

### Шаг 3: Сгенерируйте код

1. Нажмите кнопку **"⚡ Генерировать код"**
2. Дождитесь завершения (плагин загружает изображения на сервер)
3. Смотрите статус в окне плагина:
   - `Начинаю генерацию кода...`
   - `Найдено изображений: X`
   - `Загружаю изображение 1/X...`
   - `✅ Загружено: https://bublickrust.ru/i/ABC123`
   - `✅ Код успешно сгенерирован!`

### Шаг 4: Скопируйте код

1. Переключайтесь между вкладками **HTML** и **CSS**
2. Нажмите кнопку **"📋 Копировать"**
3. Вставьте код в ваш проект!

## 📦 Структура файлов

```
figma-plugin/
├── manifest.json    # Конфигурация плагина
├── code.js         # Основная логика (загрузка изображений, генерация кода)
├── ui.html         # Интерфейс плагина
└── README.md       # Эта инструкция
```

## 🔑 API Token

**Токен уже встроен в плагин:**
```
58076245d1f7985852fc5dc77d2da0294dac4c714f3cdc773029d470ccd10511
```

**API Endpoint:**
```
https://bublickrust.ru/api/images/upload
```

## 🎯 Что экспортируется

### Поддерживаемые элементы:

✅ **Frame / Component / Instance**
- Размеры (width, height)
- Позиция (x, y)
- Фон (цвет, прозрачность, изображения)
- Границы (stroke)
- Скругление углов (corner radius)
- Тени (drop shadow)
- Прозрачность (opacity)

✅ **Text**
- Содержимое текста
- Размер шрифта
- Семейство шрифтов
- Цвет
- Выравнивание
- Межстрочный интервал

✅ **Images**
- Автоматическая загрузка на сервер
- Прямые ссылки в CSS
- Background-image с cover

### Не поддерживается (пока):

❌ Gradients (градиенты)
❌ Blend modes (режимы наложения)
❌ Auto Layout (автолейаут)
❌ Constraints (ограничения)
❌ Animations (анимации)

## 📝 Пример результата

### Входные данные (Figma):
```
Frame "Hero Section"
├── Rectangle "Background" (цвет #c40552, прозрачность 0.8)
├── Image "Photo" (изображение)
└── Text "Hello World" (шрифт Inter, размер 32px)
```

### HTML результат:
```html
<div class="hero-section">
  <div class="hero-section-background-0"></div>
  <div class="hero-section-photo-1"></div>
  <p class="hero-section-hello-world-2">Hello World</p>
</div>
```

### CSS результат:
```css
.hero-section {
  position: relative;
  width: 1200px;
  height: 600px;
}

.hero-section-background-0 {
  position: absolute;
  left: 0px;
  top: 0px;
  width: 1200px;
  height: 600px;
  background-color: #c40552;
  opacity: 0.8;
}

.hero-section-photo-1 {
  position: absolute;
  left: 100px;
  top: 100px;
  width: 400px;
  height: 300px;
  background-image: url('https://bublickrust.ru/i/ABC1234');
  background-size: cover;
  background-position: center;
}

.hero-section-hello-world-2 {
  position: absolute;
  left: 550px;
  top: 250px;
  width: 500px;
  height: 100px;
  font-size: 32px;
  font-family: 'Inter';
  font-weight: Bold;
  text-align: center;
  color: #ffffff;
}
```

## 🔧 Настройка (если нужно изменить API)

Откройте `code.js` и измените константы в начале файла:

```javascript
const API_TOKEN = 'ВАШ_ТОКЕН';
const API_URL = 'https://your-domain.com/api/images/upload';
```

Также обновите `manifest.json`:

```json
{
  "networkAccess": {
    "allowedDomains": [
      "https://your-domain.com"
    ]
  }
}
```

## 🐛 Возможные проблемы

### "Пожалуйста, выберите фрейм"
**Решение:** Выберите Frame, Component или Instance в Figma

### "Ошибка загрузки изображения: HTTP 403"
**Причина:** Неверный токен или срок действия истек
**Решение:** Обновите `API_TOKEN` в `code.js`

### "Ошибка загрузки изображения: Failed to fetch"
**Причина:** Сервер недоступен или CORS блокирует запрос
**Решение:** 
1. Проверьте, что сервер запущен
2. Убедитесь, что домен добавлен в `manifest.json` → `networkAccess`

### Плагин не загружается
**Решение:**
1. Убедитесь, что все 3 файла (manifest.json, code.js, ui.html) в одной папке
2. Используйте Figma Desktop App (не браузерную версию)
3. Переустановите плагин

## 💡 Советы по использованию

### Для лучших результатов:

1. **Группируйте элементы** в frames
2. **Именуйте слои** понятно (имена станут CSS классами)
3. **Используйте простые цвета** (не градиенты)
4. **Оптимизируйте изображения** перед экспортом (< 15 MB)
5. **Проверяйте позиции** - используется absolute

### Для адаптивности:

После экспорта замените `px` на `%` или `vw/vh` для адаптивного дизайна.

### Для production:

1. Минифицируйте CSS
2. Добавьте префиксы (`-webkit-`, `-moz-`)
3. Оптимизируйте изображения
4. Используйте CDN для хостинга

## 🔄 Обновление плагина

1. Обновите файлы в папке `figma-plugin`
2. В Figma: `Plugins` → `Development` → `Reload plugin`
3. Или переимпортируйте `manifest.json`

## 📞 Поддержка

Если что-то не работает:

1. Проверьте логи в консоли Figma (`Ctrl+Alt+I` / `Cmd+Opt+I`)
2. Убедитесь, что API токен валиден
3. Проверьте статус сервера: `https://bublickrust.ru/api/health`

## 📄 Лицензия

Этот плагин создан специально для проекта Bublickrust.

---

**Удачной работы! 🚀**

Любые изображения автоматически загружаются на ваш сервер и доступны по ссылке!

