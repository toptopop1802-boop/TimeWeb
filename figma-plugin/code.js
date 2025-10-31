// Figma Plugin: Frame to HTML/CSS Exporter
// API Token встроен
const API_TOKEN = '58076245d1f7985852fc5dc77d2da0294dac4c714f3cdc773029d470ccd10511';
const API_URL = 'https://bublickrust.ru/api/images/upload';

// Показать UI
figma.showUI(__html__, { width: 400, height: 600, themeColors: true });

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
    const images = await processImages(node);
    
    figma.ui.postMessage({
      type: 'status',
      message: `Найдено изображений: ${images.length}`
    });

    // Загружаем изображения на сервер
    const uploadedImages = await uploadImages(images);
    
    figma.ui.postMessage({
      type: 'status',
      message: `Загружено изображений: ${uploadedImages.length}`
    });

    // Генерируем HTML/CSS
    const { html, css } = generateHTMLCSS(node, uploadedImages);

    // Отправляем результат в UI
    figma.ui.postMessage({
      type: 'code-generated',
      html: html,
      css: css
    });

  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: `Ошибка: ${error.message}`
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

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    
    figma.ui.postMessage({
      type: 'status',
      message: `Загружаю изображение ${i + 1}/${images.length}...`
    });

    try {
      // Создаем FormData
      const formData = new FormData();
      const blob = new Blob([img.bytes], { type: 'image/png' });
      formData.append('image', blob, `figma-image-${img.hash}.png`);

      // Отправляем на API
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        uploaded.push({
          hash: img.hash,
          url: data.directUrl,
          node: img.node
        });
        
        figma.ui.postMessage({
          type: 'status',
          message: `✅ Загружено: ${data.directUrl}`
        });
      } else {
        throw new Error(data.error || 'Неизвестная ошибка');
      }

    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: `Ошибка загрузки изображения: ${error.message}`
      });
    }
  }

  return uploaded;
}

// Генерация HTML/CSS кода
function generateHTMLCSS(node, uploadedImages) {
  let html = '';
  let css = '';
  const imageMap = new Map(uploadedImages.map(img => [img.hash, img.url]));

  // Генерируем CSS для корневого фрейма
  const frameClass = sanitizeClassName(node.name);
  css += generateCSS(node, frameClass, true);

  // Генерируем HTML
  html += generateHTML(node, frameClass, imageMap);

  return { html, css };
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

// Утилиты
function rgbToHex(rgb) {
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function sanitizeClassName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

