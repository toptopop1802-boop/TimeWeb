// Content Script для автоматической регистрации на cursor.com

(function() {
  'use strict';
  
  // Система логирования для content script
  const Logger = {
    log(level, source, message, data = null) {
      const logEntry = {
        timestamp: Date.now(),
        level: level,
        source: source,
        message: message,
        data: data
      };

      // Отправляем в background для сохранения
      chrome.runtime.sendMessage({
        action: 'addLog',
        log: logEntry
      }).catch(() => {
        // Если background не доступен, сохраняем локально
        chrome.storage.local.get(['extensionLogs'], (result) => {
          const logs = result.extensionLogs || [];
          logs.push(logEntry);
          if (logs.length > 1000) logs.shift();
          chrome.storage.local.set({ extensionLogs: logs });
        });
      });

      // Также выводим в консоль
      const prefix = `[${source}]`;
      const logMessage = data ? `${message} | Data: ${JSON.stringify(data)}` : message;
      
      switch(level) {
        case 'error':
          console.error(prefix, logMessage);
          break;
        case 'warning':
          console.warn(prefix, logMessage);
          break;
        case 'success':
          console.log(prefix, '✓', logMessage);
          break;
        default:
          console.log(prefix, logMessage);
      }
    },

    info(source, message, data) {
      this.log('info', source, message, data);
    },

    success(source, message, data) {
      this.log('success', source, message, data);
    },

    warning(source, message, data) {
      this.log('warning', source, message, data);
    },

    error(source, message, data) {
      this.log('error', source, message, data);
    },

    debug(source, message, data) {
      this.log('debug', source, message, data);
    }
  };
  
  let registrationStarted = false;
  
  // Генератор случайных данных для EU
  const randomGenerator = {
    // EU имена
    getFirstName() {
      const names = [
        'Alexander', 'Benjamin', 'Christian', 'Daniel', 'Erik',
        'Felix', 'Gabriel', 'Henrik', 'Ivan', 'Jakob',
        'Karl', 'Lucas', 'Martin', 'Nikolai', 'Oliver',
        'Peter', 'Robert', 'Sebastian', 'Thomas', 'Viktor'
      ];
      return names[Math.floor(Math.random() * names.length)];
    },
    
    // EU фамилии
    getLastName() {
      const surnames = [
        'Anderson', 'Berg', 'Carlson', 'Dahl', 'Eriksson',
        'Fischer', 'Gustafsson', 'Hansen', 'Ivanov', 'Jensen',
        'Koch', 'Larsen', 'Müller', 'Nielsen', 'Olsen',
        'Petrov', 'Richter', 'Schmidt', 'Thomsen', 'Wagner'
      ];
      return surnames[Math.floor(Math.random() * surnames.length)];
    },
    
  };
  
  // NotLetters API интеграция
  const NotLettersAPI = {
    baseUrl: 'https://api.notletters.com/v1',
    token: 'y0iRqPnAEihzo2qdHV9YPFwLv6CASSHJ',
    
    async getRandomEmail() {
      try {
        console.log('📧 NotLetters: Запрашиваем email у background скрипта...');
        const email = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'getNotLettersEmail' }, (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (response && response.success) {
              resolve(response.email);
            } else {
              reject(new Error(response ? response.error : 'Unknown error'));
            }
          });
        });

        if (email) {
          console.log('✓ NotLetters: Email получен:', email);
          return email;
        } else {
          console.log('⚠️ NotLetters: Не удалось получить email от background скрипта.');
          return null;
        }

      } catch (error) {
        console.error('❌ NotLetters: Ошибка при получении email:', error);
        return null;
      }
    },

    async waitForCursorEmail(email, timeout = 60000) {
      try {
        const result = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'waitForNotLettersCode', email, timeout }, (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            resolve(response);
          });
        });

        if (result && result.success) {
          // Если код уже извлечен, возвращаем его
          if (result.code) {
            return String(result.code);
          }
          // Если есть содержимое письма, извлекаем код из него
          if (result.letterContent) {
            const code = NotLettersAPI.extractVerificationCode(result.letterContent);
            if (code) {
              return code;
            }
            // Если код не найден, возвращаем содержимое для дальнейшей обработки
            return result.letterContent;
          }
        }
        return null;
      } catch (error) {
        console.error('❌ NotLetters: Ошибка при ожидании письма:', error);
        return null;
      }
    },

    extractVerificationCode(messageContent) {
      // Метод для извлечения кода из письма NotLetters
      console.log('🔍 Ищем код в письме NotLetters...');
      const patterns = [
        /\b\d{6}\b/,
        /code is: (\d{6})/i,
        />(\d{6})</,
        /code[:\s]*(\d{6})/i,
        /verification[:\s]*(\d{6})/i,
        /код[:\s]*(\d{6})/i
      ];
      for (const pattern of patterns) {
        const match = messageContent.match(pattern);
        if (match && match[1]) {
          console.log('✓ Код найден:', match[1]);
          return match[1];
        }
        if (match && match[0] && !match[1]) {
             const digits = match[0].replace(/\D/g, '');
             if (digits.length === 6) {
                console.log('✓ Код найден (общий паттерн):', digits);
                return digits;
             }
        }
      }
      console.log('⚠️ Код не найден в письме NotLetters');
      return null;
    }
  };
  
  // Генератор безопасного пароля
  function generateSecurePassword() {
    // Требования к паролю:
    // - Минимум 12 символов
    // - Заглавные и строчные буквы
    // - Цифры
    // - Спецсимволы
    
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    
    // Гарантируем хотя бы один символ каждого типа
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Заполняем оставшиеся символы (до 16 символов)
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < 16; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Перемешиваем символы для случайности
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    
    return password;
  }
  
  // Функция безопасного клика (имитация человека с реалистичными паузами)
  function humanClick(element) {
    if (!element) {
      console.error('humanClick: элемент не передан');
      return Promise.resolve(false);
    }
    
    console.log('humanClick: начинаем клик по элементу', element);
    
    // Скроллим к элементу
    try {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      console.log('humanClick: скролл выполнен');
    } catch (e) {
      console.warn('humanClick: ошибка скролла', e);
    }
    
    // Реалистичная задержка с вариацией
    // Быстрый клик: 200-400ms
    // Обычный клик: 400-700ms
    // Медленный клик: 700-1200ms
    const baseDelay = 300 + Math.random() * 400; // 300-700ms
    
    // Иногда человек колеблется перед кликом (20% шанс)
    const hesitationDelay = Math.random() < 0.20 ? (500 + Math.random() * 500) : 0;
    
    const totalDelay = baseDelay + hesitationDelay;
    
    return new Promise(resolve => {
      setTimeout(async () => {
        try {
          // Получаем реальные координаты элемента для более реалистичных событий
          const rect = element.getBoundingClientRect();
          const clientX = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.4;
          const clientY = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.4;
          
          // Имитация движения мыши к элементу (mousemove)
          const mousemoveEvent = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: clientX,
            clientY: clientY
          });
          element.dispatchEvent(mousemoveEvent);
          
          // Небольшая пауза после движения мыши
          await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
          
          // Триггерим события мыши с реальными координатами
          const events = ['mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'];
          for (const eventType of events) {
            const event = new MouseEvent(eventType, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: clientX,
              clientY: clientY,
              buttons: eventType === 'mousedown' ? 1 : 0
            });
            element.dispatchEvent(event);
            console.log(`humanClick: событие ${eventType} отправлено`);
            
            // Минимальная задержка между событиями
            await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
          }
          
          // Нативный клик (для надежности)
          try {
            element.click();
            console.log('humanClick: нативный click() выполнен');
          } catch (e) {
            console.warn('humanClick: ошибка нативного click()', e);
          }
          
          // Для ссылок - НЕ переходим здесь, пусть вызывающий код решает
          if (element.tagName === 'A') {
            const href = element.getAttribute('href');
            console.log('humanClick: это ссылка, href:', href);
            console.log('humanClick: переход будет выполнен вызывающим кодом');
          }
          
          // Также триггерим фокус для input/textarea
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.focus();
            console.log('humanClick: фокус установлен');
          }
          
          resolve(true);
        } catch (error) {
          console.error('humanClick: ошибка при клике', error);
          resolve(false);
        }
      }, totalDelay);
    });
  }
  
  // Функция безопасного ввода текста (имитация печати с реалистичными паттернами)
  async function humanType(element, text) {
    if (!element) return false;
    
    element.focus();
    element.value = '';
    
    // Начальная пауза (человек думает перед вводом)
    await delay(200 + Math.random() * 300);
    
    // Печатаем по одному символу с реалистичными задержками
    for (let i = 0; i < text.length; i++) {
      // Имитация опечаток с вероятностью 5%
      if (Math.random() < 0.05 && i > 0) {
        // Вводим случайный неправильный символ
        const wrongChars = 'qwertyuiopasdfghjklzxcvbnm';
        const wrongChar = wrongChars[Math.floor(Math.random() * wrongChars.length)];
        element.value += wrongChar;
        
        const inputEvent1 = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent1);
        
        // Пауза осознания ошибки (150-300ms)
        await delay(150 + Math.random() * 150);
        
        // Backspace
        element.value = element.value.slice(0, -1);
        const inputEvent2 = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent2);
        
        // Короткая пауза после исправления
        await delay(50 + Math.random() * 50);
      }
      
      // Вводим правильный символ
      element.value += text[i];
      
      // Триггерим события
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      element.dispatchEvent(inputEvent);
      
      const keyEvent = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
      element.dispatchEvent(keyEvent);
      
      // Реалистичная задержка между символами
      // Быстрая печать: 40-80ms
      // Средняя печать: 80-150ms  
      // Медленная печать: 150-250ms
      // Пробелы и знаки препинания - дольше
      let baseDelay = 60 + Math.random() * 70; // 60-130ms базовая
      
      // Замедление на пробелах и знаках препинания
      if (text[i] === ' ' || text[i] === '.' || text[i] === ',') {
        baseDelay += 50 + Math.random() * 50; // +50-100ms
      }
      
      // Случайные длинные паузы (раздумья) с вероятностью 10%
      if (Math.random() < 0.10) {
        baseDelay += 200 + Math.random() * 300; // +200-500ms
      }
      
      // Вариация скорости печати (иногда быстрее, иногда медленнее)
      const speedMultiplier = 0.7 + Math.random() * 0.6; // 0.7-1.3x
      baseDelay *= speedMultiplier;
      
      await delay(baseDelay);
    }
    
    // Финальная пауза перед events
    await delay(100 + Math.random() * 200);
    
    // Финальные события
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    element.dispatchEvent(changeEvent);
    
    const blurEvent = new Event('blur', { bubbles: true, cancelable: true });
    element.dispatchEvent(blurEvent);
    
    return true;
  }
  
  // Задержка
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Функция ожидания элемента
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Элемент ${selector} не найден за ${timeout}ms`));
      }, timeout);
    });
  }
  
  // Функция поиска элемента по тексту класса
  function findElementByClass(className) {
    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      if (el.className && el.className.includes && el.className.includes(className)) {
        return el;
      }
    }
    return null;
  }
  
  // Показ индикатора прогресса
  function showProgressIndicator() {
    // Проверяем, нет ли уже индикатора
    if (document.getElementById('cursor-progress-overlay')) {
      return;
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'cursor-progress-overlay';
    overlay.innerHTML = `
      <div class="cursor-progress-dialog">
        <h3 class="progress-title">Автоматическая регистрация</h3>
        <div class="progress-steps">
          <div class="progress-step" data-step="1">
            <div class="step-icon">1</div>
            <div class="step-text">Переход на регистрацию</div>
          </div>
          <div class="progress-step" data-step="2">
            <div class="step-icon">2</div>
            <div class="step-text">Заполнение имени</div>
          </div>
          <div class="progress-step" data-step="3">
            <div class="step-icon">3</div>
            <div class="step-text">Заполнение фамилии</div>
          </div>
          <div class="progress-step" data-step="4">
            <div class="step-icon">4</div>
            <div class="step-text">Заполнение email</div>
          </div>
          <div class="progress-step" data-step="5">
            <div class="step-icon">5</div>
            <div class="step-text">Отправка формы</div>
          </div>
          <div class="progress-step" data-step="6">
            <div class="step-icon">6</div>
            <div class="step-text">Установка пароля</div>
          </div>
          <div class="progress-step" data-step="7">
            <div class="step-icon">7</div>
            <div class="step-text">Получение и ввод кода из email</div>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" id="cursor-progress-bar"></div>
        </div>
        <div class="progress-status" id="cursor-progress-status">Начинаем...</div>
      </div>
    `;
    
    // Добавляем стили
    const style = document.createElement('style');
    style.id = 'cursor-progress-styles';
    style.textContent = `
      #cursor-progress-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999998;
        animation: slideInRight 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .cursor-progress-dialog {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 20px;
        width: 320px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      }
      
      .progress-title {
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        letter-spacing: -0.5px;
      }
      
      .progress-steps {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
      }
      
      .progress-step {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px;
        border-radius: 6px;
        transition: all 0.2s ease;
        opacity: 0.5;
      }
      
      .progress-step.active {
        background: #222;
        opacity: 1;
      }
      
      .progress-step.completed {
        opacity: 1;
      }
      
      .step-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #333;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      
      .progress-step.active .step-icon {
        background: #fff;
        color: #000;
        animation: pulse 1.5s ease infinite;
      }
      
      .progress-step.completed .step-icon {
        background: #4CAF50;
        color: #fff;
      }
      
      .progress-step.completed .step-icon::before {
        content: '✓';
      }
      
      .step-text {
        color: #666;
        font-size: 13px;
        font-weight: 500;
        transition: color 0.2s ease;
      }
      
      .progress-step.active .step-text {
        color: #fff;
      }
      
      .progress-step.completed .step-text {
        color: #4CAF50;
      }
      
      .progress-bar-container {
        width: 100%;
        height: 4px;
        background: #333;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      
      .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #fff, #ccc);
        width: 0%;
        transition: width 0.3s ease;
        border-radius: 2px;
      }
      
      .progress-status {
        color: #a0a0a0;
        font-size: 12px;
        text-align: center;
      }
      
      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.1);
          opacity: 0.8;
        }
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
  }
  
  // Обновление прогресса
  function updateProgress(step, status) {
    const overlay = document.getElementById('cursor-progress-overlay');
    if (!overlay) return;
    
    // Обновляем шаги
    const steps = overlay.querySelectorAll('.progress-step');
    steps.forEach((stepEl, index) => {
      stepEl.classList.remove('active');
      if (index < step - 1) {
        stepEl.classList.add('completed');
      } else if (index === step - 1) {
        stepEl.classList.add('active');
      } else {
        stepEl.classList.remove('completed');
      }
    });
    
    // Обновляем прогресс-бар
    const progressBar = document.getElementById('cursor-progress-bar');
    if (progressBar) {
      const percentage = (step / 7) * 100;
      progressBar.style.width = percentage + '%';
    }
    
    // Обновляем статус
    const statusEl = document.getElementById('cursor-progress-status');
    if (statusEl && status) {
      statusEl.textContent = status;
    }
  }
  
  // Скрытие индикатора прогресса
  function hideProgressIndicator(delay = 3000) {
    setTimeout(() => {
      const overlay = document.getElementById('cursor-progress-overlay');
      const style = document.getElementById('cursor-progress-styles');
      if (overlay) {
        overlay.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
          overlay.remove();
          if (style) style.remove();
        }, 300);
      }
    }, delay);
  }
  
  // Основная функция автоматической регистрации
  async function startAutoRegistration() {
    if (registrationStarted) return;
    registrationStarted = true;
    
    Logger.info('register', 'Начинаем автоматическую регистрацию на cursor.com');
    console.log('🤖 Начинаем автоматическую регистрацию на cursor.com...');
    
    // Показываем индикатор прогресса
    showProgressIndicator();
    
    try {
      // Генерируем данные
      const firstName = randomGenerator.getFirstName();
      const lastName = randomGenerator.getLastName();
      
      // Получаем email через NotLetters
      console.log('📧 Получаем email через NotLetters...');
      const email = await NotLettersAPI.getRandomEmail();

      if (!email) {
        throw new Error('Не удалось получить email через NotLetters');
      }
      
      console.log('📝 Сгенерированные данные:', { firstName, lastName, email });
      
      // Шаг 1: Прямой переход на страницу регистрации (упрощенный вариант)
      updateProgress(1, 'Переход на страницу регистрации...');
      console.log('🔍 Проверяем текущий URL...');
      console.log('📍 Текущий URL:', window.location.href);
      
      // Проверяем, не находимся ли уже на странице регистрации
      if (window.location.href.includes('sign-up') || window.location.href.includes('authenticator.cursor.sh')) {
        console.log('✓ Уже на странице регистрации, пропускаем переход');
      } else {
        console.log('🚀 Переходим напрямую на страницу регистрации...');
        console.log('📍 Целевой URL: https://authenticator.cursor.sh/sign-up');
        
        // Прямой переход без поиска кнопок
        window.location.href = 'https://authenticator.cursor.sh/sign-up';
        
        console.log('⏳ Ждем загрузки страницы регистрации...');
        await delay(3000);
        
        // После перехода страница перезагрузится, код ниже не выполнится
        // Но это нормально - скрипт продолжит работу на новой странице
        console.log('📍 URL после перехода:', window.location.href);
      }
      
      // Шаг 2: Заполняем имя
      updateProgress(2, 'Заполнение имени...');
      console.log('🔍 Ищем поле "Ваше имя"...');
      console.log('📍 Текущая страница:', window.location.href);
      
      // Показываем все input поля на странице для отладки
      const allInputs = document.querySelectorAll('input');
      console.log(`📊 Всего input полей на странице: ${allInputs.length}`);
      allInputs.forEach((input, index) => {
        console.log(`  Input ${index + 1}:`, {
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className
        });
      });
      
      const firstNameInput = await waitForElement('input[placeholder*="имя" i], input[placeholder*="name" i], input[name*="first" i], input[type="text"]', 10000)
        .catch(() => {
          console.log('⚠ waitForElement не нашел поле, пробуем альтернативный поиск...');
          // Альтернативный поиск
          const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
          console.log(`  Найдено ${inputs.length} текстовых полей`);
          
          for (const input of inputs) {
            const placeholder = (input.placeholder || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            
            console.log(`  Проверяем поле: placeholder="${placeholder}", name="${name}", id="${id}"`);
            
            if (placeholder.includes('first') || placeholder.includes('имя') || 
                name.includes('first') || name.includes('name') ||
                id.includes('first') || id.includes('name')) {
              console.log('  ✓ Найдено подходящее поле!');
              return input;
            }
          }
          
          // Если не нашли, берем первое текстовое поле
          if (inputs.length > 0) {
            console.log('  ⚠ Берем первое текстовое поле по индексу');
            return inputs[0];
          }
          
          return null;
        });
      
      if (firstNameInput) {
        console.log('✓ Поле имени найдено:', firstNameInput);
        console.log('  Атрибуты:', {
          type: firstNameInput.type,
          name: firstNameInput.name,
          placeholder: firstNameInput.placeholder
        });
        console.log('🖊️ Вводим имя:', firstName);
        await humanType(firstNameInput, firstName);
        await delay(500);
        console.log('✓ Имя введено');
      } else {
        console.error('❌ Поле имени НЕ НАЙДЕНО!');
      }
      
      // Шаг 3: Заполняем фамилию
      updateProgress(3, 'Заполнение фамилии...');
      console.log('🔍 Ищем поле "Ваша фамилия"...');
      const lastNameInput = await waitForElement('input[placeholder*="фамилия" i], input[placeholder*="last" i], input[name*="last" i]', 5000)
        .catch(() => {
          const inputs = document.querySelectorAll('input[type="text"]');
          for (const input of inputs) {
            const placeholder = input.placeholder.toLowerCase();
            if (placeholder.includes('last') || placeholder.includes('фамилия') || placeholder.includes('surname')) {
              return input;
            }
          }
          return null;
        });
      
      if (lastNameInput) {
        console.log('✓ Поле фамилии найдено, вводим:', lastName);
        await humanType(lastNameInput, lastName);
        await delay(500);
      } else {
        console.log('⚠ Поле фамилии не найдено');
      }
      
      // Шаг 4: Заполняем email
      updateProgress(4, 'Заполнение email...');
      console.log('🔍 Ищем поле email...');
      const emailInput = await waitForElement('input[type="email"], input[placeholder*="email" i], input[placeholder*="электронной почты" i]', 5000)
        .catch(() => {
          const inputs = document.querySelectorAll('input');
          for (const input of inputs) {
            const placeholder = input.placeholder.toLowerCase();
            const type = input.type.toLowerCase();
            if (type === 'email' || placeholder.includes('email') || placeholder.includes('почт')) {
              return input;
            }
          }
          return null;
        });
      
      if (emailInput) {
        console.log('✓ Поле email найдено, вводим:', email);
        await humanType(emailInput, email);
        await delay(500);
        
        // Сохраняем email для дальнейшего использования
        chrome.storage.local.set({ lastRegistrationEmail: email });
      } else {
        console.log('⚠ Поле email не найдено');
      }
      
      // Шаг 5: Предпочитаем вход по коду из email (magic-code)
      updateProgress(5, 'Выбор входа по коду из email...');
      console.log('🔍 Ищем кнопку "Продолжить с кодом из email"...');
      await delay(1000);

      const magicCodeButton = await waitForElement('button[name="intent"][value="magic-code"], button[data-method="email"][name="intent"][value="magic-code"]', 5000)
        .catch(() => {
          const buttons = document.querySelectorAll('button');
          for (const button of buttons) {
            const text = (button.textContent || '').trim();
            if (text.includes('Продолжить с кодом из email')) {
              return button;
            }
          }
          return null;
        });

      let usedMagicCodeFlow = false;
      if (magicCodeButton) {
        console.log('✓ Кнопка magic-code найдена');
        // Если кнопка выключена, пробуем отправить форму через requestSubmit
        const isDisabled = magicCodeButton.hasAttribute('disabled') || magicCodeButton.getAttribute('data-disabled') === 'true';
        const form = magicCodeButton.form || magicCodeButton.closest('form');
        if (isDisabled && form && typeof form.requestSubmit === 'function') {
          console.log('⚙️ Кнопка отключена, вызываем form.requestSubmit(button)');
          form.requestSubmit(magicCodeButton);
        } else {
          console.log('🖱️ Нажимаем кнопку magic-code');
          await humanClick(magicCodeButton);
        }
        await delay(2000);

        // Пробуем обработать OTP сразу (минуя пароль)
        if (await waitAndEnterEmailCode(email, false)) {
          console.log('✅ OTP обработан по потоку magic-code, завершаем регистрацию');
          return;
        } else {
          console.log('⚠ OTP поля не появились, откатываемся к стандартной отправке формы');
        }
      }

      // Фолбэк: стандартная кнопка submit
      console.log('🔍 Ищем стандартную кнопку отправки формы...');
      const submitButton = await waitForElement('button[type="submit"], input[type="submit"]', 5000)
        .catch(() => {
          const buttons = document.querySelectorAll('button');
          for (const button of buttons) {
            const text = button.textContent.toLowerCase();
            if (text.includes('sign up') || 
                text.includes('register') || 
                text.includes('submit') ||
                text.includes('продолжить') ||
                text.includes('зарегистр')) {
              return button;
            }
          }
          return null;
        });

      if (submitButton) {
        console.log('✓ Кнопка submit найдена, отправляем форму...');
        await humanClick(submitButton);
        await delay(2000);
      } else {
        console.log('⚠ Кнопка submit не найдена');
      }
      
      // Шаг 6: Ждем поле пароля и автоматически устанавливаем пароль
      updateProgress(6, 'Ожидание поля пароля...');
      console.log('🔍 Ожидаем появления поля пароля...');
      const passwordInput = await waitForElement('input[placeholder*="пароль" i], input[placeholder*="password" i], input[type="password"]', 30000)
        .catch(() => {
          console.log('⚠ Поле пароля не появилось в течение 15 секунд');
          return null;
        });
      
      if (passwordInput) {
        console.log('✅ Поле пароля обнаружено!');
        console.log('🔐 Начинаем автоматическую установку пароля...');
        
        // Генерируем надежный пароль
        const password = generateSecurePassword();
        console.log('🔑 Пароль сгенерирован');
        
        // Ждем немного перед вводом пароля
        await delay(1000 + Math.random() * 1000);
        
        // Ищем все поля паролей (обычно два - пароль и подтверждение)
        const passwordFields = document.querySelectorAll('input[type="password"]');
        console.log(`📊 Найдено полей пароля: ${passwordFields.length}`);
        
        if (passwordFields.length >= 1) {
          // Вводим пароль в первое поле
          console.log('🖊️ Вводим пароль в первое поле...');
          await humanType(passwordFields[0], password);
          await delay(500);
          
          // Если есть второе поле (подтверждение пароля)
          if (passwordFields.length >= 2) {
            console.log('🖊️ Вводим пароль во второе поле (подтверждение)...');
            await humanType(passwordFields[1], password);
            await delay(500);
          }
          
          // Сохраняем пароль в storage
          chrome.storage.local.set({ 
            registrationCompleted: true,
            registrationEmail: email,
            registrationPassword: password,
            registrationTimestamp: Date.now()
          });
          
          console.log('💾 Пароль сохранен в storage');
          
          // Ищем кнопку "Продолжить" / "Submit" / "Create account"
          await delay(1000);
          console.log('🔍 Ищем кнопку подтверждения пароля...');
          
          const passwordSubmitButton = await waitForElement('button[type="submit"], button:not([type])', 5000)
            .catch(() => {
              // Альтернативный поиск
              const buttons = document.querySelectorAll('button');
              for (const button of buttons) {
                const text = button.textContent.toLowerCase();
                if (text.includes('continue') || 
                    text.includes('продолжить') ||
                    text.includes('create') ||
                    text.includes('submit') ||
                    text.includes('next') ||
                    text.includes('далее')) {
                  return button;
                }
              }
              return null;
            });
          
          if (passwordSubmitButton) {
            console.log('✓ Кнопка подтверждения пароля найдена, нажимаем...');
            await humanClick(passwordSubmitButton);
            await delay(2000);
          } else {
            console.log('⚠ Кнопка подтверждения пароля не найдена');
          }
          
          // Шаг 7: Обработка OTP после установки пароля
          if (await waitAndEnterEmailCode(email, true)) {
            console.log('✅ OTP успешно обработан после установки пароля');
          }
        } else {
          console.log('⚠ Поля пароля не найдены');
          showErrorNotification('Не удалось найти поля для ввода пароля');
          hideProgressIndicator(3000);
        }
      } else {
        console.log('⚠ Не удалось дождаться поля пароля');
        updateProgress(6, 'Ошибка: поле пароля не появилось');
        showErrorNotification('Поле пароля не появилось.');
        hideProgressIndicator(3000);
      }
      
      console.log('✅ Автоматическая регистрация завершена!');
      
    } catch (error) {
      console.error('❌ Ошибка автоматической регистрации:', error);
      
      // Специальная обработка ошибки контекста расширения
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('⚠️ Расширение было перезагружено. Перезагрузите страницу вручную.');
        showErrorNotification('Расширение перезагружено. Обновите страницу (F5)');
      } else {
        showErrorNotification('Ошибка регистрации: ' + error.message);
      }
      
      hideProgressIndicator(3000);
    }
  }
  
  // Показ уведомления об успехе
  function showSuccessNotification(message) {
    const overlay = document.createElement('div');
    overlay.id = 'cursor-register-success';
    overlay.innerHTML = `
      <div class="cursor-register-dialog">
        <div class="register-icon">✓</div>
        <h3>${message}</h3>
      </div>
    `;
    
    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = `
      #cursor-register-success {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        animation: slideInRight 0.3s ease;
      }
      
      .cursor-register-dialog {
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 20px 24px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 320px;
      }
      
      .register-icon {
        width: 32px;
        height: 32px;
        background: #fff;
        color: #000;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: bold;
        flex-shrink: 0;
      }
      
      .cursor-register-dialog h3 {
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        margin: 0;
        line-height: 1.4;
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
      overlay.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => overlay.remove(), 300);
    }, 5000);
  }
  
  // Показ уведомления об ошибке
  function showErrorNotification(message) {
    const overlay = document.createElement('div');
    overlay.id = 'cursor-register-error';
    overlay.innerHTML = `
      <div class="cursor-register-dialog error">
        <div class="register-icon error">✗</div>
        <h3>${message}</h3>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      #cursor-register-error .cursor-register-dialog {
        background: #1a1a1a;
        border: 1px solid #ff4444;
      }
      
      #cursor-register-error .register-icon.error {
        background: #ff4444;
        color: #fff;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => overlay.remove(), 300);
    }, 5000);
  }

  // Ожидание появления OTP и ввод кода из email
  async function waitAndEnterEmailCode(email, includePasswordNote = false) {
    try {
      updateProgress(7, 'Получение кода из email...');
      console.log('📧 Ожидаем поля для ввода кода подтверждения...');

      // Функция поиска OTP полей с разными селекторами
      const findOTPFields = () => {
        const selectors = [
          '.ak-OtpInput input[data-index]',           // Стандартный селектор
          'input[data-index]',                         // Без класса
          'input[type="text"][maxlength="1"]',        // По типу и maxlength
          'input[autocomplete="one-time-code"]',      // По autocomplete
          '.otp-input input',                         // Общий класс OTP
          '[class*="otp"] input',                     // Любой класс содержащий otp
          '[class*="code"] input[maxlength="1"]'      // Класс code + maxlength
        ];

        for (const selector of selectors) {
          const inputs = document.querySelectorAll(selector);
          console.log(`🔍 Селектор "${selector}": найдено ${inputs.length} полей`);
          
          if (inputs.length >= 6) {
            console.log(`✅ Найдено ${inputs.length} OTP полей с селектором: ${selector}`);
            return Array.from(inputs).slice(0, 6);
          }
        }
        
        return null;
      };

      // Ждем появления OTP полей
      let codeInputs = null;
      let attempts = 0;
      const maxAttempts = 60; // 30 секунд (по 500ms)

      while (!codeInputs && attempts < maxAttempts) {
        codeInputs = findOTPFields();
        
        if (!codeInputs) {
          await delay(500);
          attempts++;
          
          if (attempts % 10 === 0) {
            console.log(`⏳ Ожидание OTP полей... Попытка ${attempts}/${maxAttempts}`);
          }
        }
      }

      if (!codeInputs || codeInputs.length !== 6) {
        // Дополнительная отладка - показываем все input поля
        const allInputs = document.querySelectorAll('input');
        console.log('🔍 ОТЛАДКА: Все input поля на странице:');
        allInputs.forEach((input, idx) => {
          console.log(`  ${idx + 1}. type="${input.type}" maxlength="${input.maxLength}" ` +
                      `class="${input.className}" data-index="${input.getAttribute('data-index')}" ` +
                      `autocomplete="${input.autocomplete}" id="${input.id}"`);
        });
        
        Logger.error('register', 'OTP поля не найдены или их недостаточно', { 
          found: codeInputs ? codeInputs.length : 0, 
          expected: 6,
          totalInputsOnPage: allInputs.length
        });
        console.log('⚠ Поле для кода не найдено');
        console.log('💡 Возможно страница изменилась. Проверьте URL:', window.location.href);
        updateProgress(7, 'Поле кода не найдено. Проверьте страницу.');
        showErrorNotification('Не удалось найти поле для кода.');
        hideProgressIndicator(5000);
        return false;
      }

      Logger.success('register', 'Все 6 OTP полей найдены и готовы к вводу', { 
        fields: codeInputs.map((inp, idx) => ({ 
          index: idx, 
          dataIndex: inp.getAttribute('data-index'),
          currentValue: inp.value
        }))
      });
      console.log('✓ Все 6 OTP полей найдены!');
      console.log('📬 Запрашиваем код из NotLetters...');

      // Ждем письмо от Cursor через NotLetters
      const cursorEmail = await NotLettersAPI.waitForCursorEmail(email, 120000);

      if (!cursorEmail) {
        console.log('⚠ Письмо не получено в течение 120 секунд');
        updateProgress(7, 'Письмо не получено, введите код вручную');
        showErrorNotification('Письмо не получено. Проверьте email и введите код вручную.');
        return false;
      }

      console.log('✓ Письмо получено!');
      let verificationCode = NotLettersAPI.extractVerificationCode(cursorEmail);

      Logger.info('register', 'Письмо получено от NotLetters', { email, hasCode: !!verificationCode });
      
      if (!verificationCode) {
        Logger.warning('register', 'Не удалось извлечь код из письма', { email, letterContent: cursorEmail.substring(0, 200) });
        console.log('⚠ Не удалось извлечь код из письма');
        updateProgress(7, 'Введите код вручную из email');
        showErrorNotification('Код не найден в письме. Введите вручную.');
        return false;
      }

      Logger.success('register', 'Код подтверждения извлечен', { email, code: verificationCode });
      console.log('✓ Код подтверждения извлечен:', verificationCode);
      await delay(500);

      // Вводим код по одной цифре в каждое поле (быстро, без имитации человека - только здесь!)
      Logger.info('register', 'Начинаем ввод кода в OTP поля', { code: verificationCode, fieldsCount: codeInputs.length });
      
      for (let i = 0; i < 6 && i < verificationCode.length; i++) {
        const digit = verificationCode[i];
        const input = codeInputs[i];

        if (input) {
          Logger.debug('register', `Ввод цифры ${i + 1}/6`, { digit, fieldIndex: i });
          
          // Прямой ввод без задержек
          input.focus();
          
          // Проверяем текущее значение поля перед вводом
          const beforeValue = input.value;
          
          // Триггерим для React и обычного input
          try {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(input, digit);
          } catch (e) {
            Logger.warning('register', 'Ошибка при установке значения через nativeSetter', { error: e.message, digit });
            input.value = digit;
          }

          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);

          const changeEvent = new Event('change', { bubbles: true });
          input.dispatchEvent(changeEvent);

          // Проверяем значение после ввода
          const afterValue = input.value;
          
          if (afterValue === digit || afterValue.includes(digit)) {
            Logger.success('register', `Цифра ${i + 1}/6 успешно введена`, { digit, beforeValue, afterValue });
            console.log(`✓ Введена цифра ${i + 1}/6: ${digit}`);
          } else {
            Logger.error('register', `Цифра ${i + 1}/6 НЕ введена!`, { digit, beforeValue, afterValue, expected: digit });
            console.error(`✗ ОШИБКА: Цифра ${i + 1}/6 не введена! Ожидалось: ${digit}, Получено: ${afterValue}`);
          }
        } else {
          Logger.error('register', `Поле ${i + 1} не найдено!`, { index: i, totalFields: codeInputs.length });
        }
      }

      // Проверяем итоговый результат
      const finalValues = Array.from(codeInputs).map((inp, idx) => ({ index: idx, value: inp.value }));
      const enteredCode = finalValues.map(v => v.value).join('');
      Logger.info('register', 'Проверка введенного кода', { 
        expectedCode: verificationCode, 
        enteredCode, 
        fields: finalValues,
        match: enteredCode === verificationCode
      });

      if (enteredCode !== verificationCode) {
        Logger.error('register', 'Код введен НЕПРАВИЛЬНО!', { 
          expected: verificationCode, 
          entered: enteredCode,
          fields: finalValues
        });
      } else {
        Logger.success('register', 'Код успешно введен во все поля', { code: verificationCode });
      }

      await delay(1000);

      // Ищем кнопку подтверждения кода
      const confirmCodeButton = await waitForElement('button[type="submit"], button:not([type])', 5000)
        .catch(() => {
          const buttons = document.querySelectorAll('button');
          for (const button of buttons) {
            const text = (button.textContent || '').toLowerCase();
            if (text.includes('verify') ||
                text.includes('confirm') ||
                text.includes('подтвердить') ||
                text.includes('continue') ||
                text.includes('продолжить')) {
              return button;
            }
          }
          return null;
        });

      if (confirmCodeButton) {
        Logger.info('register', 'Кнопка подтверждения кода найдена, нажимаем', { buttonText: confirmCodeButton.textContent });
        console.log('✓ Кнопка подтверждения кода найдена, нажимаем...');
        
        // Используем humanClick для имитации человека (имитация остаётся везде кроме ввода кода)
        await humanClick(confirmCodeButton);
        await delay(1000);

        // Проверяем, завершилась ли регистрация (страница изменилась или появился dashboard)
        await delay(2000);
        const currentUrl = window.location.href;
        const isRegistrationComplete = currentUrl.includes('/dashboard') || 
                                       currentUrl.includes('/app') ||
                                       !currentUrl.includes('/sign-up') && !currentUrl.includes('/authenticator');
        
        if (isRegistrationComplete) {
          Logger.success('register', 'Регистрация успешно завершена!', { finalUrl: currentUrl });
          updateProgress(7, 'Регистрация завершена!');
          const message = includePasswordNote
            ? `✅ Регистрация завершена!\n📧 Email: ${email}\n🔐 Пароль сохранен`
            : `✅ Регистрация завершена!\n📧 Email: ${email}`;
          showSuccessNotification(message);
          hideProgressIndicator(5000);
          
          // Сохраняем флаг завершенной регистрации
          chrome.storage.local.set({ 
            registrationCompleted: true,
            registrationCompletedAt: Date.now()
          });
          
          // Устанавливаем флаг, чтобы не запускать новую регистрацию
          registrationStarted = false;
          
          console.log('✅ Автоматическая регистрация ПОЛНОСТЬЮ завершена!');
          return true;
        } else {
          Logger.warning('register', 'Код введен, но регистрация может быть не завершена', { currentUrl });
          updateProgress(7, 'Код введен. Проверьте страницу.');
          showSuccessNotification(`Код введен!\n📧 Email: ${email}`);
          hideProgressIndicator(5000);
          return true;
        }
      } else {
        Logger.warning('register', 'Кнопка подтверждения кода не найдена', {});
        console.log('⚠ Кнопка подтверждения кода не найдена, код введен');
        updateProgress(7, 'Код введен. Проверьте страницу.');
        showSuccessNotification(`Код введен!\n📧 Email: ${email}`);
        hideProgressIndicator(5000);
        return true;
      }
    } catch (e) {
      console.error('❌ Ошибка при обработке OTP:', e);
      showErrorNotification('Ошибка при вводе кода: ' + e.message);
      return false;
    }
  }
  
  // Проверяем, нужно ли запускать автоматическую регистрацию
  function checkIfShouldRegister() {
    console.log('🔍 checkIfShouldRegister вызвана');
    console.log('📍 URL:', window.location.href);
    console.log('📍 Hostname:', window.location.hostname);
    
    // Проверяем URL - должны быть на cursor.com или authenticator.cursor.sh
    const isValidDomain = window.location.hostname.includes('cursor.com') || 
                          window.location.hostname.includes('cursor.sh');
    
    console.log('✓ Валидный домен:', isValidDomain);
    
    if (!isValidDomain) {
      console.log('⚠ Не на cursor.com/cursor.sh, выходим');
      return false;
    }
    
    // Проверяем, не завершена ли уже регистрация (пользователь на dashboard/app)
    const currentUrl = window.location.href;
    const pathname = window.location.pathname;
    
    // Только dashboard и app страницы означают что пользователь уже зарегистрирован
    const isAlreadyRegistered = pathname.includes('/dashboard') || 
                                pathname.includes('/app');
    
    if (isAlreadyRegistered) {
      Logger.info('register', 'Пользователь уже зарегистрирован, пропускаем регистрацию', { url: currentUrl, pathname });
      console.log('✓ Пользователь уже зарегистрирован, регистрация не нужна');
      return false;
    }
    
    // Главная страница cursor.com/ - НЕ означает что пользователь зарегистрирован
    console.log('📍 Pathname:', pathname, '- пользователь НЕ зарегистрирован');
    
    // Проверяем, была ли недавно очистка данных
    chrome.storage.local.get(['clearDataApproved', 'lastClearTimestamp', 'autoCleanEnabled', 'registrationCompleted'], (result) => {
      console.log('💾 Storage данные:', result);
      
      // Если регистрация уже завершена недавно (менее 5 минут назад), не запускаем
      if (result.registrationCompleted && result.registrationCompletedAt) {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (result.registrationCompletedAt > fiveMinutesAgo) {
          Logger.info('register', 'Регистрация недавно завершена, пропускаем', { 
            completedAt: new Date(result.registrationCompletedAt).toISOString() 
          });
          console.log('✓ Регистрация недавно завершена, не запускаем новую');
          return;
        }
      }
      
      if (result.clearDataApproved && result.lastClearTimestamp) {
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const timePassed = Date.now() - result.lastClearTimestamp;
        
        console.log(`⏱️ Время с последней очистки: ${Math.round(timePassed / 1000)} секунд`);
        
        // Если очистка была менее 5 минут назад, запускаем регистрацию
        if (result.lastClearTimestamp > fiveMinutesAgo) {
          console.log('✅ Очистка была недавно (< 5 минут), запускаем регистрацию...');
          
          // Ждем полной загрузки страницы
          if (document.readyState === 'loading') {
            console.log('⏳ Страница загружается, ждем DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', () => {
              console.log('✓ DOMContentLoaded, запускаем через 2 сек');
              setTimeout(startAutoRegistration, 2000);
            });
          } else {
            console.log('✓ Страница загружена, запускаем через 2 сек');
            setTimeout(startAutoRegistration, 2000);
          }
        } else {
          console.log('⚠ Очистка была давно (> 5 минут), не запускаем');
        }
      } else {
        console.log('⚠ Нет данных об очистке, не запускаем');
      }
    });
  }
  
  // Слушаем сообщения от background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startRegistration') {
      startAutoRegistration();
      sendResponse({ received: true });
    }
  });
  
  // Запускаем проверку
  checkIfShouldRegister();
  
})();

