// Figma Plugin: Frame to Rust CUI Exporter
// API Token встроен
const API_TOKEN = '58076245d1f7985852fc5dc77d2da0294dac4c714f3cdc773029d470ccd10511';
const API_URL = 'https://bublickrust.ru/api/images/upload';

// Показать UI
figma.showUI(__html__, { width: 450, height: 650, themeColors: true });

// Обработка сообщений от UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-code') {
    await generateCode();
  } else if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

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
      message: '🔍 Поиск изображений в фрейме...'
    });
    
    const images = await processImages(node);
    
    figma.ui.postMessage({
      type: 'log',
      message: `📸 Найдено изображений: ${images.length}`
    });

    // Загружаем изображения на сервер
    const uploadedImages = await uploadImages(images);
    
    figma.ui.postMessage({
      type: 'log',
      message: `✅ Загружено изображений: ${uploadedImages.length}/${images.length}`
    });

    // Генерируем Rust CUI код
    figma.ui.postMessage({
      type: 'log',
      message: '⚙️ Генерация CUI кода...'
    });
    
    const cuiCode = generateRustCUI(node, uploadedImages);
    const csharpCode = generateCSharpCode(node);

    // Отправляем результат в UI
    figma.ui.postMessage({
      type: 'code-generated',
      cui: cuiCode,
      csharp: csharpCode
    });

    figma.ui.postMessage({
      type: 'log',
      message: '🎉 Генерация завершена!'
    });

  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: `❌ Ошибка: ${error.message}`
    });
    
    figma.ui.postMessage({
      type: 'log',
      message: `❌ Детали ошибки: ${error.stack || error.message}`
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

// Загрузка изображений через API
async function uploadImages(images) {
  const uploaded = [];

  figma.ui.postMessage({
    type: 'log',
    message: `📤 Начинаю загрузку ${images.length} изображений...`
  });

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imageName = `figma-image-${img.hash.substring(0, 8)}.png`;
    
    figma.ui.postMessage({
      type: 'log',
      message: `📤 [${i + 1}/${images.length}] Загружаю: ${imageName}`
    });

    figma.ui.postMessage({
      type: 'log',
      message: `   📊 Размер: ${(img.bytes.length / 1024).toFixed(2)} KB`
    });

    try {
      figma.ui.postMessage({
        type: 'log',
        message: `   🔨 Создаю multipart/form-data...`
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
        message: `   📦 Размер запроса: ${((headerBytes.length + img.bytes.length + footerBytes.length) / 1024).toFixed(2)} KB`
      });
      
      // Объединяем все части
      const bodyBytes = new Uint8Array(headerBytes.length + img.bytes.length + footerBytes.length);
      bodyBytes.set(headerBytes, 0);
      bodyBytes.set(img.bytes, headerBytes.length);
      bodyBytes.set(footerBytes, headerBytes.length + img.bytes.length);

      figma.ui.postMessage({
        type: 'log',
        message: `   🌐 Отправка POST на: ${API_URL}`
      });

      figma.ui.postMessage({
        type: 'log',
        message: `   🔑 Authorization: Bearer ${API_TOKEN.substring(0, 20)}...`
      });

      // Отправляем на API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': `multipart/form-data; boundary=----${boundary}`
        },
        body: bodyBytes
      });

      figma.ui.postMessage({
        type: 'log',
        message: `   📥 Статус: ${response.status} ${response.statusText}`
      });

      if (!response.ok) {
        const errorText = await response.text();
        figma.ui.postMessage({
          type: 'log',
          message: `   ❌ Ошибка: ${errorText.substring(0, 200)}`
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      figma.ui.postMessage({
        type: 'log',
        message: `   📄 Ответ (${responseText.length} символов): ${responseText.substring(0, 100)}...`
      });

      const data = JSON.parse(responseText);

      if (data.success) {
        uploaded.push({
          hash: img.hash,
          url: data.directUrl,
          node: img.node
        });
        
        figma.ui.postMessage({
          type: 'log',
          message: `   ✅ Успех! URL: ${data.directUrl}`
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка');
      }

    } catch (error) {
      figma.ui.postMessage({
        type: 'log',
        message: `   ❌ Ошибка: ${error.message}`
      });
      
      figma.ui.postMessage({
        type: 'error',
        message: `Не удалось загрузить изображение ${i + 1}: ${error.message}`
      });
    }
  }

  figma.ui.postMessage({
    type: 'log',
    message: `📦 Итого загружено: ${uploaded.length}/${images.length} изображений`
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
  
  // Позиция и размер
  element.components.push({
    type: "RectTransform",
    anchormin: calculateAnchorMin(node),
    anchormax: calculateAnchorMax(node),
    offsetmin: "0 0",
    offsetmax: "0 0"
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
function generateCSharpCode(node) {
  const className = toPascalCase(sanitizeClassName(node.name));
  let code = `using Oxide.Game.Rust.Cui;\nusing System.Collections.Generic;\nusing UnityEngine;\n\n`;
  code += `public class ${className}UI\n{\n`;
  code += `    public static void Show(BasePlayer player)\n    {\n`;
  code += `        var elements = new CuiElementContainer();\n\n`;
  code += `        // Main panel\n`;
  code += `        elements.Add(new CuiPanel\n`;
  code += `        {\n`;
  code += `            Image = { Color = "0 0 0 0.8" },\n`;
  code += `            RectTransform = { AnchorMin = "0 0", AnchorMax = "1 1" },\n`;
  code += `            CursorEnabled = true\n`;
  code += `        }, "Overlay", "${className}");\n\n`;
  
  code += generateCSharpElements(node, `"${className}"`, 1);
  
  code += `        CuiHelper.AddUi(player, elements);\n`;
  code += `    }\n\n`;
  code += `    public static void Close(BasePlayer player)\n    {\n`;
  code += `        CuiHelper.DestroyUi(player, "${className}");\n`;
  code += `    }\n`;
  code += `}\n`;
  
  return code;
}

function generateCSharpElements(node, parentName, level) {
  let code = '';
  const indent = '        ' + '    '.repeat(level);
  
  if ('children' in node) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const childName = sanitizeClassName(`${node.name}_${child.name}_${i}`);
      
      if (child.type === 'TEXT') {
        code += `${indent}// Text: ${child.name}\n`;
        code += `${indent}elements.Add(new CuiLabel\n`;
        code += `${indent}{\n`;
        code += `${indent}    Text = { Text = "${child.characters || ''}", FontSize = ${child.fontSize || 14}, Align = TextAnchor.MiddleCenter },\n`;
        code += `${indent}    RectTransform = { AnchorMin = "${calculateAnchorMin(child)}", AnchorMax = "${calculateAnchorMax(child)}" }\n`;
        code += `${indent}}, ${parentName});\n\n`;
      } else {
        const color = getRGBAColor(child);
        code += `${indent}// Panel: ${child.name}\n`;
        code += `${indent}elements.Add(new CuiPanel\n`;
        code += `${indent}{\n`;
        code += `${indent}    Image = { Color = "${color}" },\n`;
        code += `${indent}    RectTransform = { AnchorMin = "${calculateAnchorMin(child)}", AnchorMax = "${calculateAnchorMax(child)}" }\n`;
        code += `${indent}}, ${parentName}, "${childName}");\n\n`;
        
        code += generateCSharpElements(child, `"${childName}"`, level + 1);
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
  return "1 1 1 1";
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
  return "1 1 1 0.5";
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

function calculateAnchorMin(node) {
  const parent = node.parent;
  if (!parent || !('width' in parent) || !('height' in parent)) {
    return "0 0";
  }
  
  const x = node.x / parent.width;
  const y = 1 - ((node.y + node.height) / parent.height);
  
  return `${x.toFixed(4)} ${y.toFixed(4)}`;
}

function calculateAnchorMax(node) {
  const parent = node.parent;
  if (!parent || !('width' in parent) || !('height' in parent)) {
    return "1 1";
  }
  
  const x = (node.x + node.width) / parent.width;
  const y = 1 - (node.y / parent.height);
  
  return `${x.toFixed(4)} ${y.toFixed(4)}`;
}

