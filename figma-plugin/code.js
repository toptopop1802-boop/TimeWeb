// Figma Plugin: Frame to Rust CUI Exporter
const API_URL = 'https://bublickrust.ru/api/images/upload';
let currentApiToken = '';
let currentScale = 0.6; // Глобальный масштаб элементов (0.6 = 60% от оригинала, оптимально для игры)

// Показать UI (увеличенный размер для большого количества логов)
figma.showUI(__html__, { width: 500, height: 800, themeColors: true });

// Обработка сообщений от UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-code') {
    currentApiToken = msg.apiToken || '';
    const s = parseFloat(msg.scale);
    currentScale = Number.isFinite(s) && s > 0 ? s : 0.6;
    if (!currentApiToken) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Не указан API токен'
      });
      return;
    }
    await generateCode();
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  } else if (msg.type === 'save-token') {
    try {
      await figma.clientStorage.setAsync('apiToken', msg.apiToken || '');
      currentApiToken = msg.apiToken || '';
    } catch (e) {}
  }
};

// При старте пробуем восстановить токен из локального хранилища
(async () => {
  try {
    const saved = await figma.clientStorage.getAsync('apiToken');
    if (saved) {
      currentApiToken = saved;
      figma.ui.postMessage({ type: 'prefill-token', apiToken: saved });
    }
  } catch (_) {}
})();

// Главная функция генерации кода
async function generateCode() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Пожалуйста, выберите фрейм'
    });
    return;
  }

  const node = selection[0];

  if (node.type !== 'FRAME' && node.type !== 'COMPONENT' && node.type !== 'INSTANCE') {
    figma.ui.postMessage({
      type: 'error',
      message: 'Выберите Frame, Component или Instance'
    });
    return;
  }

  figma.ui.postMessage({
    type: 'status',
    message: 'Начинаю генерацию кода...'
  });

  try {
    // Обрабатываем изображения
    figma.ui.postMessage({
      type: 'log',
      message: 'Поиск изображений в фрейме...'
    });
    
    const images = await processImages(node);
    
    figma.ui.postMessage({
      type: 'log',
      message: `Найдено изображений: ${images.length}`
    });

    // Загружаем изображения на сервер
    const uploadedImages = await uploadImages(images);
    
    figma.ui.postMessage({
      type: 'log',
      message: `Загружено изображений: ${uploadedImages.length}/${images.length}`
    });

    // Генерируем Rust CUI код
    figma.ui.postMessage({
      type: 'log',
      message: 'Генерация CUI кода...'
    });
    
    // Создаем Map с URL изображений
    const imageMap = new Map();
    for (const img of uploadedImages) {
      imageMap.set(img.hash, img.url);
    }
    
    // Даем Figma "передохнуть" перед генерацией
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cuiCode = generateRustCUI(node, uploadedImages);
    
    // Даем Figma "передохнуть" между генерациями
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const csharpCode = generateCSharpCode(node, imageMap);

    // Отправляем результат в UI
    figma.ui.postMessage({
      type: 'code-generated',
      cui: cuiCode,
      csharp: csharpCode
    });

    figma.ui.postMessage({
      type: 'log',
      message: 'Генерация завершена!'
    });

  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: `Ошибка: ${error.message}`
    });
    
    figma.ui.postMessage({
      type: 'log',
      message: `Детали ошибки: ${error.stack || error.message}`
    });
  }
}

// Обработка изображений в ноде
async function processImages(node) {
  const images = [];
  
  async function traverse(n) {
    // Проверяем на изображения
    if ('fills' in n && Array.isArray(n.fills)) {
      for (const fill of n.fills) {
        if (fill.type === 'IMAGE' && fill.imageHash) {
          const image = figma.getImageByHash(fill.imageHash);
          if (image) {
            const bytes = await image.getBytesAsync();
            images.push({
              node: n,
              bytes: bytes,
              hash: fill.imageHash
            });
          }
        }
      }
    }

    // Рекурсивно обходим детей
    if ('children' in n) {
      for (const child of n.children) {
        await traverse(child);
      }
    }
  }

  await traverse(node);
  return images;
}

// Загрузка изображений через API с батчингом
async function uploadImages(images) {
  const uploaded = [];
  const BATCH_SIZE = 8; // Больше параллелизма
  const DELAY_MS = 200; // Меньше задержка между батчами
  const RETRY_ATTEMPTS = 6; // Повторные проверки доступности URL
  const RETRY_DELAY = 400; // мс между проверками

  // Локальный кэш по хешу Figma, чтобы не загружать одно и то же изображение повторно
  const hashToUrl = new Map();

  figma.ui.postMessage({
    type: 'log',
    message: `Начинаю загрузку ${images.length} изображений (батчами по ${BATCH_SIZE})...`
  });

  // Проверка доступности прямой ссылки (некоторые CDN/проксирующие слои активируются с задержкой)
  async function ensureDirectUrlAvailable(url) {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const resp = await fetch(`${url}?cb=${Date.now()}`, { method: 'GET' });
        if (resp.ok) {
          return true;
        }
      } catch (_) {
        // игнорируем сетевые ошибки и повторяем
      }
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
    return false;
  }

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imageName = `figma-image-${img.hash.substring(0, 8)}.png`;
    
    // Добавляем задержку после каждого батча
    if (i > 0 && i % BATCH_SIZE === 0) {
      figma.ui.postMessage({
        type: 'log',
        message: `Пауза ${DELAY_MS}ms перед следующим батчем...`
      });
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
    
    // Дедупликация: если такой hash уже загружали — переиспользуем URL и не шлём запрос
    if (hashToUrl.has(img.hash)) {
      const reusedUrl = hashToUrl.get(img.hash);
      uploaded.push({ hash: img.hash, url: reusedUrl, node: img.node });
      figma.ui.postMessage({
        type: 'log',
        message: `[${i + 1}/${images.length}] Повтор: ${imageName} -> reuse ${reusedUrl}`
      });
      continue;
    }

    figma.ui.postMessage({
      type: 'log',
      message: `[${i + 1}/${images.length}] Загружаю: ${imageName}`
    });

    figma.ui.postMessage({
      type: 'log',
      message: `   Размер: ${(img.bytes.length / 1024).toFixed(2)} KB`
    });

    try {
      figma.ui.postMessage({
        type: 'log',
        message: `   Создаю multipart/form-data...`
      });
      
      // Создаем multipart/form-data вручную (FormData и TextEncoder недоступны в Figma Plugin)
      const boundary = '----FigmaBoundary' + Date.now();
      
      // Формируем тело запроса
      const header = `------${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${imageName}"\r\nContent-Type: image/png\r\n\r\n`;
      const footer = `\r\n------${boundary}--\r\n`;
      
      // Конвертируем строки в байты вручную (без TextEncoder)
      function stringToBytes(str) {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
          bytes[i] = str.charCodeAt(i) & 0xFF;
        }
        return bytes;
      }
      
      const headerBytes = stringToBytes(header);
      const footerBytes = stringToBytes(footer);
      
      figma.ui.postMessage({
        type: 'log',
        message: `   Размер запроса: ${((headerBytes.length + img.bytes.length + footerBytes.length) / 1024).toFixed(2)} KB`
      });
      
      // Объединяем все части
      const bodyBytes = new Uint8Array(headerBytes.length + img.bytes.length + footerBytes.length);
      bodyBytes.set(headerBytes, 0);
      bodyBytes.set(img.bytes, headerBytes.length);
      bodyBytes.set(footerBytes, headerBytes.length + img.bytes.length);

      figma.ui.postMessage({
        type: 'log',
        message: `   Отправка POST на: ${API_URL}`
      });

      figma.ui.postMessage({
        type: 'log',
        message: `   Authorization: Bearer ${currentApiToken.substring(0, 20)}...`
      });

      // Отправляем на API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentApiToken}`,
          'Content-Type': `multipart/form-data; boundary=----${boundary}`
        },
        body: bodyBytes
      });

      figma.ui.postMessage({
        type: 'log',
        message: `   Статус: ${response.status} ${response.statusText}`
      });

      if (!response.ok) {
        const errorText = await response.text();
        figma.ui.postMessage({
          type: 'log',
          message: `   Ошибка: ${errorText.substring(0, 200)}`
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      figma.ui.postMessage({
        type: 'log',
        message: `   Ответ (${responseText.length} символов): ${responseText.substring(0, 100)}...`
      });

      const data = JSON.parse(responseText);

      if (data.success) {
        const url = data.directUrl;
        // Проверяем доступность прямой ссылки, иногда требуется время на репликацию
        const available = await ensureDirectUrlAvailable(url);
        if (!available) {
          figma.ui.postMessage({
            type: 'log',
            message: `   URL пока недоступен (проверки исчерпаны). Пропускаю картинку для генерации: ${url}`
          });
          // Не добавляем в карту, чтобы генератор не вставлял битую ссылку
        } else {
          uploaded.push({ hash: img.hash, url, node: img.node });
          hashToUrl.set(img.hash, url);
        }
        
        figma.ui.postMessage({
          type: 'log',
          message: `   Успех! URL: ${url}`
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка');
      }

    } catch (error) {
      figma.ui.postMessage({
        type: 'log',
        message: `   Ошибка: ${error.message}`
      });
      
      figma.ui.postMessage({
        type: 'error',
        message: `Не удалось загрузить изображение ${i + 1}: ${error.message}`
      });
    }
  }

  figma.ui.postMessage({
    type: 'log',
    message: `Итого загружено: ${uploaded.length}/${images.length} изображений`
  });

  return uploaded;
}

// Генерация Rust CUI (JSON)
function generateRustCUI(node, uploadedImages) {
  const imageMap = new Map(uploadedImages.map(img => [img.hash, img.url]));
  const cuiElements = [];
  
  // Рекурсивно обходим элементы
  traverseForCUI(node, cuiElements, imageMap);
  
  const cui = {
    name: sanitizeClassName(node.name),
    parent: "Overlay",
    components: cuiElements
  };
  
  return JSON.stringify(cui, null, 2);
}

function traverseForCUI(node, elements, imageMap, parentName = "root") {
  const element = {
    name: sanitizeClassName(`${parentName}_${node.name}`),
    parent: parentName
  };
  
  // Определяем тип элемента
  if (node.type === 'TEXT') {
    element.components = [{
      type: "UnityEngine.UI.Text",
      text: node.characters || "",
      fontSize: node.fontSize || 14,
      color: getFillColor(node),
      align: getTextAlign(node)
    }];
  } else if (hasImageFill(node, imageMap)) {
    const imageUrl = getImageUrl(node, imageMap);
    element.components = [{
      type: "UnityEngine.UI.RawImage",
      url: imageUrl,
      color: "1 1 1 1"
    }];
  } else {
    element.components = [{
      type: "UnityEngine.UI.Image",
      color: getFillColor(node) || "1 1 1 0.5"
    }];
  }
  
  // Позиция и размер (фиксированные пиксели, якорь по центру)
  element.components.push({
    type: "RectTransform",
    anchormin: calculateAnchorCenter(node),
    anchormax: calculateAnchorCenter(node),
    offsetmin: calculateOffsetMin(node),
    offsetmax: calculateOffsetMax(node)
  });
  
  elements.push(element);
  
  // Обрабатываем детей
  if ('children' in node) {
    for (const child of node.children) {
      traverseForCUI(child, elements, imageMap, element.name);
    }
  }
}

// Генерация C# кода для Rust
function generateCSharpCode(node, imageMap) {
  const className = toPascalCase(sanitizeClassName(node.name));
  const uiName = className;
  const commandName = className.toLowerCase();
  const rootWidth = Math.round(('width' in node ? node.width : 1104) || 1104);
  const rootHeight = Math.round(('height' in node ? node.height : 738) || 738);
  const scale = (Number.isFinite(currentScale) && currentScale > 0) ? currentScale : 0.6;
  const halfW = Math.round((rootWidth / 2) * scale);
  const halfH = Math.round((rootHeight / 2) * scale);
  
  let code = `using Oxide.Core.Plugins;\n`;
  code += `using Oxide.Game.Rust.Cui;\n`;
  code += `using System.Collections.Generic;\n`;
  code += `using UnityEngine;\n\n`;
  code += `namespace Oxide.Plugins\n{\n`;
  code += `    [Info("${className}UI", "BublickRust", "1.0.0")]\n`;
  code += `    [Description("Auto-generated UI from Figma")]\n`;
  code += `    class ${className}UI : RustPlugin\n    {\n`;
  code += `        private const string UIName = "${uiName}";\n`;
  code += `        private readonly HashSet<ulong> playersWithUI = new HashSet<ulong>();\n\n`;
  code += `        void Init()\n        {\n`;
  code += `            Puts("[${className}UI] Plugin initialized. Use /${commandName} to toggle UI");\n`;
  code += `        }\n\n`;
  
  // Chat command для toggle
  code += `        [ChatCommand("${commandName}")]\n`;
  code += `        void CmdToggleUI(BasePlayer player, string command, string[] args)\n        {\n`;
  code += `            Puts($"[${className}UI] Command /${commandName} called by {player.displayName}");\n`;
  code += `            if (HasUI(player))\n`;
  code += `            {\n`;
  code += `                Puts($"[${className}UI] Closing UI for {player.displayName}");\n`;
  code += `                CloseUI(player);\n`;
  code += `            }\n`;
  code += `            else\n`;
  code += `            {\n`;
  code += `                Puts($"[${className}UI] Opening UI for {player.displayName}");\n`;
  code += `                ShowUI(player);\n`;
  code += `            }\n`;
  code += `        }\n\n`;
  
  // Console commands
  code += `        [ConsoleCommand("${commandName}.show")]\n`;
  code += `        void ConsoleShowUI(ConsoleSystem.Arg arg)\n        {\n`;
  code += `            var player = arg.Player();\n`;
  code += `            if (player == null) return;\n`;
  code += `            ShowUI(player);\n`;
  code += `        }\n\n`;
  
  code += `        [ConsoleCommand("${commandName}.close")]\n`;
  code += `        void ConsoleCloseUI(ConsoleSystem.Arg arg)\n        {\n`;
  code += `            var player = arg.Player();\n`;
  code += `            if (player == null) return;\n`;
  code += `            CloseUI(player);\n`;
  code += `        }\n\n`;
  
  // HasUI check
  code += `        private bool HasUI(BasePlayer player)\n        {\n`;
  code += `            return playersWithUI.Contains(player.userID);\n`;
  code += `        }\n\n`;
  
  // ShowUI method
  code += `        private void ShowUI(BasePlayer player)\n        {\n`;
  code += `            Puts($"[${className}UI] ShowUI called for {player.displayName}");\n`;
  code += `            CloseUI(player);\n`;
  code += `            playersWithUI.Add(player.userID);\n            \n`;
  code += `            var elements = new CuiElementContainer();\n`;
  code += `            Puts($"[${className}UI] Creating UI elements...");\n\n`;
  code += `            // Main background panel with blur\n`;
  code += `            elements.Add(new CuiPanel\n`;
  code += `            {\n`;
  code += `                Image = { Color = "0 0 0 0.8", Material = "assets/content/ui/uibackgroundblur-ingamemenu.mat" },\n`;
  code += `                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },\n`;
  code += `                CursorEnabled = true\n`;
  code += `            }, "Overlay", UIName);\n\n`;
  
  code += `            // Invisible button for closing on background click\n`;
  code += `            elements.Add(new CuiButton\n`;
  code += `            {\n`;
  code += `                Button = { Color = "0 0 0 0", Command = "${commandName}.close" },\n`;
  code += `                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },\n`;
  code += `                Text = { Text = "", Color = "0 0 0 0" }\n`;
  code += `            }, UIName, UIName + ".CloseBackground");\n\n`;
  
  code += `            // Content container (on top of close button)\n`;
  code += `            elements.Add(new CuiPanel\n`;
  code += `            {\n`;
  code += `                Image = { Color = "0 0 0 0" },\n`;
  code += `                RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },\n`;
  code += `                CursorEnabled = false\n`;
  code += `            }, UIName, UIName + ".Content");\n\n`;

  // Center wrapper to keep layout centered across aspect ratios
  code += `            // Center wrapper (keeps Figma frame centered)\n`;
  code += `            elements.Add(new CuiPanel\n`;
  code += `            {\n`;
  code += `                Image = { Color = "0 0 0 0" },\n`;
  code += `                RectTransform = { AnchorMin = "0.5 0.5", AnchorMax = "0.5 0.5", OffsetMin = "-${halfW} -${halfH}", OffsetMax = "${halfW} ${halfH}" }\n`;
  code += `            }, UIName + ".Content", UIName + ".Center");\n\n`;
  
  code += generateCSharpElements(node, `UIName + ".Center"`, 3, imageMap);
  
  code += `            Puts($"[${className}UI] Adding {elements.Count} UI elements to player");\n`;
  code += `            CuiHelper.AddUi(player, elements);\n`;
  code += `            Puts($"[${className}UI] UI successfully shown to {player.displayName}");\n`;
  code += `        }\n\n`;
  
  // CloseUI method
  code += `        private void CloseUI(BasePlayer player)\n        {\n`;
  code += `            CuiHelper.DestroyUi(player, UIName);\n`;
  code += `            playersWithUI.Remove(player.userID);\n`;
  code += `        }\n\n`;
  
  // OnPlayerDisconnected
  code += `        void OnPlayerDisconnected(BasePlayer player)\n        {\n`;
  code += `            playersWithUI.Remove(player.userID);\n`;
  code += `        }\n\n`;
  
  // Unload
  code += `        void Unload()\n        {\n`;
  code += `            foreach (var player in BasePlayer.activePlayerList)\n`;
  code += `                CloseUI(player);\n`;
  code += `            playersWithUI.Clear();\n`;
  code += `        }\n`;
  
  code += `    }\n`;
  code += `}\n`;
  
  return code;
}

function generateCSharpElements(node, parentName, level, imageMap) {
  let code = '';
  const indent = '        ' + '    '.repeat(level);
  const scale = (Number.isFinite(currentScale) && currentScale > 0) ? currentScale : 0.6;
  
  // ЛОГ: Сканируем элемент
  if (level <= 3) { // Логируем только верхние уровни, чтобы не захламлять
    figma.ui.postMessage({
      type: 'log',
      message: `${'  '.repeat(level)}[${node.type}] "${node.name}" (level ${level}, children: ${'children' in node ? node.children.length : 0})`
    });
  }
  
  // Функция для экранирования текста в C# строках
  function escapeCSharpString(text) {
    if (!text) return '';
    
    // 1. Убираем ВСЕ невидимые и управляющие символы Unicode
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Управляющие символы C0 и C1
    text = text.replace(/[\u200B-\u200F]/g, ''); // Zero-width символы
    text = text.replace(/[\u2028-\u202F]/g, ''); // Разделители строк и параграфов
    text = text.replace(/[\uFEFF\uFFF9-\uFFFB]/g, ''); // BOM и другие невидимые
    text = text.replace(/[\u180E]/g, ''); // Mongolian vowel separator
    text = text.replace(/[\u061C]/g, ''); // Arabic letter mark
    // Дополнительно удаляем проблемные невидимые/форматирующие символы, встречающиеся в Figma
    text = text.replace(/\u00AD/g, ''); // Soft hyphen
    text = text.replace(/[\u2060-\u206F]/g, ''); // Word joiner и прочие управления
    text = text.replace(/[\uFE00-\uFE0F]/g, ''); // Variation Selectors
    text = text.replace(/[\uE000-\uF8FF]/g, ''); // Private Use Area
    
    // 2. Нормализуем пробелы (все виды пробелов -> обычный пробел)
    text = text.replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, ' ');
    text = text.trim();
    
    // 3. Экранируем специальные символы C#
    return text
      .replace(/\\/g, '\\\\')   // Экранируем обратные слеши
      .replace(/"/g, '\\"')     // Экранируем кавычки
      .replace(/\n/g, '\\n')    // Экранируем переносы строк
      .replace(/\r/g, '\\r')    // Экранируем возврат каретки
      .replace(/\t/g, '\\t');   // Экранируем табы
  }
  
  // Санитизация текста для комментариев (без экранирования кавычек)
  function sanitizeComment(text, maxLen = 120) {
    if (!text) return '';
    // 1) удаляем невидимые/управляющие символы
    text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    text = text.replace(/[\u200B-\u200F]/g, '');
    text = text.replace(/[\u2028-\u202F]/g, '');
    text = text.replace(/[\uFEFF\uFFF9-\uFFFB]/g, '');
    text = text.replace(/[\u180E]/g, '');
    text = text.replace(/[\u061C]/g, '');
    text = text.replace(/\u00AD/g, '');
    text = text.replace(/[\u2060-\u206F]/g, '');
    text = text.replace(/[\uFE00-\uFE0F]/g, '');
    text = text.replace(/[\uE000-\uF8FF]/g, '');
    // 2) нормализуем пробелы
    text = text.replace(/[\s\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/g, ' ').trim();
    // 3) убираем возможные последовательности комментариев
    text = text.replace(/\*\//g, '');
    text = text.replace(/\/\//g, '/');
    // 4) ограничиваем длину
    if (text.length > maxLen) {
      text = text.slice(0, maxLen - 1) + '…';
    }
    return text;
  }
  
  if ('children' in node) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childName = sanitizeClassName(`${node.name}_${child.name}_${i}`);
      
      if (child.type === 'TEXT') {
        const textColor = getRGBAColor(child);
        const textAlign = getTextAlign(child);
        const originalText = child.characters || '';
        const escapedText = escapeCSharpString(originalText);
        const commentPreview = sanitizeComment(child.name || originalText, 120);
        
        // ЛОГИ ДЛЯ ОТЛАДКИ ТЕКСТА
        if (originalText.length > 50) {
          figma.ui.postMessage({
            type: 'log',
            message: `[TEXT] "${child.name}": ${originalText.length} символов (обрезано до ${escapedText.length})`
          });
        }
        
        // Определяем шрифт на основе веса текста (как в примерах)
        let fontName = 'robotocondensed-regular.ttf';
        if (child.fontWeight >= 700 || (child.fontName && child.fontName.style && child.fontName.style.toLowerCase().includes('bold'))) {
          fontName = 'robotocondensed-bold.ttf';
        }
        
        code += `${indent}// Text: ${commentPreview}\n`;
        code += `${indent}elements.Add(new CuiLabel\n`;
        code += `${indent}{\n`;
        const scaledFontSize = Math.max(1, Math.round((child.fontSize || 14) * scale));
        code += `${indent}    Text = { Text = "${escapedText}", FontSize = ${scaledFontSize}, Align = TextAnchor.${textAlign}, Color = "${textColor}", Font = "${fontName}" },\n`;
        code += `${indent}    RectTransform = { AnchorMin = "${calculateAnchorCenter(child)}", AnchorMax = "${calculateAnchorCenter(child)}", OffsetMin = "${calculateOffsetMin(child)}", OffsetMax = "${calculateOffsetMax(child)}" }\n`;
        code += `${indent}}, ${parentName});\n\n`;
      } else {
        // Проверяем, есть ли изображение
        const hasImage = hasImageFill(child, imageMap);
        const imageUrl = hasImage ? getImageUrl(child, imageMap) : null;
        const color = getRGBAColor(child);
        
        code += `${indent}// Panel: ${child.name}\n`;
        
        if (hasImage && imageUrl) {
          // Создаём контейнер панель
          code += `${indent}elements.Add(new CuiPanel\n`;
          code += `${indent}{\n`;
          code += `${indent}    Image = { Color = "${color}" },\n`;
          code += `${indent}    RectTransform = { AnchorMin = "${calculateAnchorCenter(child)}", AnchorMax = "${calculateAnchorCenter(child)}", OffsetMin = "${calculateOffsetMin(child)}", OffsetMax = "${calculateOffsetMax(child)}" }\n`;
          code += `${indent}}, ${parentName}, "${childName}");\n\n`;
          
          // Добавляем RawImage поверх панели для отображения изображения
          code += `${indent}// Image for ${child.name}\n`;
          code += `${indent}elements.Add(new CuiElement\n`;
          code += `${indent}{\n`;
          code += `${indent}    Parent = "${childName}",\n`;
          code += `${indent}    Components =\n`;
          code += `${indent}    {\n`;
          code += `${indent}        new CuiRawImageComponent { Url = "${imageUrl}" },\n`;
          code += `${indent}        new CuiRectTransformComponent { AnchorMin = "0 0", AnchorMax = "1 1" }\n`;
          code += `${indent}    }\n`;
          code += `${indent}});\n\n`;
        } else {
          code += `${indent}elements.Add(new CuiPanel\n`;
          code += `${indent}{\n`;
          code += `${indent}    Image = { Color = "${color}" },\n`;
          code += `${indent}    RectTransform = { AnchorMin = "${calculateAnchorCenter(child)}", AnchorMax = "${calculateAnchorCenter(child)}", OffsetMin = "${calculateOffsetMin(child)}", OffsetMax = "${calculateOffsetMax(child)}" }\n`;
          code += `${indent}}, ${parentName}, "${childName}");\n\n`;
        }
        
        code += generateCSharpElements(child, `"${childName}"`, level + 1, imageMap);
      }
    }
  }
  
  return code;
}

// Генерация HTML элемента
function generateHTML(node, className, imageMap, level = 0) {
  const indent = '  '.repeat(level);
  let html = '';

  // Определяем тег
  let tag = 'div';
  if (node.type === 'TEXT') {
    tag = 'p';
  }

  // Открывающий тег
  html += `${indent}<${tag} class="${className}">\n`;

  // Контент текста
  if (node.type === 'TEXT' && 'characters' in node) {
    html += `${indent}  ${node.characters}\n`;
  }

  // Обрабатываем детей
  if ('children' in node) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childClass = sanitizeClassName(`${className}-${child.name}-${i}`);
      html += generateHTML(child, childClass, imageMap, level + 1);
    }
  }

  // Закрывающий тег
  html += `${indent}</${tag}>\n`;

  return html;
}

// Генерация CSS для элемента
function generateCSS(node, className, isRoot = false) {
  let css = '';
  css += `.${className} {\n`;

  // Позиционирование
  if (!isRoot) {
    css += `  position: absolute;\n`;
    css += `  left: ${node.x}px;\n`;
    css += `  top: ${node.y}px;\n`;
  } else {
    css += `  position: relative;\n`;
  }

  // Размеры
  if ('width' in node && 'height' in node) {
    css += `  width: ${node.width}px;\n`;
    css += `  height: ${node.height}px;\n`;
  }

  // Фон и заливки
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.visible !== false) {
        const color = rgbToHex(fill.color);
        const opacity = fill.opacity !== undefined ? fill.opacity : 1;
        css += `  background-color: ${color};\n`;
        if (opacity < 1) {
          css += `  opacity: ${opacity};\n`;
        }
      } else if (fill.type === 'IMAGE' && fill.imageHash) {
        // Найдем URL изображения
        // (в реальности нужно использовать imageMap)
        css += `  background-image: url('IMAGE_URL_HERE');\n`;
        css += `  background-size: cover;\n`;
        css += `  background-position: center;\n`;
      }
    }
  }

  // Рамки
  if ('strokes' in node && Array.isArray(node.strokes) && node.strokes.length > 0) {
    const stroke = node.strokes[0];
    if (stroke.type === 'SOLID') {
      const color = rgbToHex(stroke.color);
      const width = 'strokeWeight' in node ? node.strokeWeight : 1;
      css += `  border: ${width}px solid ${color};\n`;
    }
  }

  // Скругление углов
  if ('cornerRadius' in node && node.cornerRadius > 0) {
    css += `  border-radius: ${node.cornerRadius}px;\n`;
  }

  // Текстовые стили
  if (node.type === 'TEXT') {
    if ('fontSize' in node) {
      css += `  font-size: ${node.fontSize}px;\n`;
    }
    if ('fontName' in node && node.fontName) {
      css += `  font-family: '${node.fontName.family}';\n`;
      css += `  font-weight: ${node.fontName.style};\n`;
    }
    if ('textAlignHorizontal' in node) {
      const align = node.textAlignHorizontal.toLowerCase();
      css += `  text-align: ${align};\n`;
    }
    if ('fills' in node && node.fills.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        css += `  color: ${rgbToHex(fill.color)};\n`;
      }
    }
    if ('lineHeight' in node && typeof node.lineHeight === 'object') {
      css += `  line-height: ${node.lineHeight.value}${node.lineHeight.unit === 'PIXELS' ? 'px' : '%'};\n`;
    }
  }

  // Тень
  if ('effects' in node && Array.isArray(node.effects)) {
    const shadows = node.effects.filter(e => e.type === 'DROP_SHADOW' && e.visible);
    if (shadows.length > 0) {
      const shadowCSS = shadows.map(s => {
        const color = `rgba(${Math.round(s.color.r * 255)}, ${Math.round(s.color.g * 255)}, ${Math.round(s.color.b * 255)}, ${s.color.a})`;
        return `${s.offset.x}px ${s.offset.y}px ${s.radius}px ${color}`;
      }).join(', ');
      css += `  box-shadow: ${shadowCSS};\n`;
    }
  }

  // Прозрачность
  if ('opacity' in node && node.opacity < 1) {
    css += `  opacity: ${node.opacity};\n`;
  }

  css += `}\n\n`;

  // Рекурсивно для детей
  if ('children' in node) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childClass = sanitizeClassName(`${className}-${child.name}-${i}`);
      css += generateCSS(child, childClass);
    }
  }

  return css;
}

// ===== UTILITY FUNCTIONS FOR RUST CUI =====

function sanitizeClassName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function toPascalCase(str) {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function getFillColor(node) {
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      const r = fill.color.r;
      const g = fill.color.g;
      const b = fill.color.b;
      const a = fill.opacity !== undefined ? fill.opacity : 1;
      return `${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)} ${a.toFixed(2)}`;
    }
  }
  // Нет заливки в Figma -> делаем панель прозрачной
  return "0 0 0 0";
}

function getRGBAColor(node) {
  if ('fills' in node && Array.isArray(node.fills) && node.fills.length > 0) {
    const fill = node.fills[0];
    if (fill.type === 'SOLID') {
      const r = fill.color.r.toFixed(3);
      const g = fill.color.g.toFixed(3);
      const b = fill.color.b.toFixed(3);
      const a = (fill.opacity !== undefined ? fill.opacity : 1).toFixed(3);
      return `${r} ${g} ${b} ${a}`;
    }
  }
  // Нет заливки -> полностью прозрачный цвет
  return "0 0 0 0";
}

function getTextAlign(node) {
  if ('textAlignHorizontal' in node) {
    const align = node.textAlignHorizontal;
    if (align === 'CENTER') return "MiddleCenter";
    if (align === 'LEFT') return "MiddleLeft";
    if (align === 'RIGHT') return "MiddleRight";
  }
  return "MiddleCenter";
}

function hasImageFill(node, imageMap) {
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash && imageMap.has(fill.imageHash)) {
        return true;
      }
    }
  }
  return false;
}

function getImageUrl(node, imageMap) {
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageHash && imageMap.has(fill.imageHash)) {
        return imageMap.get(fill.imageHash);
      }
    }
  }
  return "";
}

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function calculateAnchorMin(node) {
  const parent = node.parent;
  if (!parent || !('width' in parent) || !('height' in parent)) {
    return "0 0";
  }
  
  const x = node.x / parent.width;
  const y = 1 - ((node.y + node.height) / parent.height);
  
  return `${clamp01(x).toFixed(4)} ${clamp01(y).toFixed(4)}`;
}

function calculateAnchorMax(node) {
  const parent = node.parent;
  if (!parent || !('width' in parent) || !('height' in parent)) {
    return "1 1";
  }
  
  const x = (node.x + node.width) / parent.width;
  const y = 1 - (node.y / parent.height);
  
  return `${clamp01(x).toFixed(4)} ${clamp01(y).toFixed(4)}`;
}

// Центрированный якорь (для фиксированных размеров без растягивания)
function calculateAnchorCenter(node) {
  const parent = node.parent;
  if (!parent || !('width' in parent) || !('height' in parent) || !('width' in node) || !('height' in node)) {
    return "0.5 0.5";
  }
  const cx = (node.x + node.width / 2) / parent.width;
  const cy = 1 - ((node.y + node.height / 2) / parent.height);
  return `${clamp01(cx).toFixed(4)} ${clamp01(cy).toFixed(4)}`;
}

// Пиксельные оффсеты для фиксированного размера прямоугольника
function calculateOffsetMin(node) {
  const scale = (Number.isFinite(currentScale) && currentScale > 0) ? currentScale : 0.6;
  const w = ('width' in node) ? Math.round((node.width / 2) * scale) : 0;
  const h = ('height' in node) ? Math.round((node.height / 2) * scale) : 0;
  return `-${w} -${h}`;
}

function calculateOffsetMax(node) {
  const scale = (Number.isFinite(currentScale) && currentScale > 0) ? currentScale : 0.6;
  const w = ('width' in node) ? Math.round((node.width / 2) * scale) : 0;
  const h = ('height' in node) ? Math.round((node.height / 2) * scale) : 0;
  return `${w} ${h}`;
}


