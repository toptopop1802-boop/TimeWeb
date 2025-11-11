// Content Script для Stripe Checkout
// Базируется на функционале: https://github.com/Dynamicearner/cursortrailautofill

(function() {
  'use strict';
  
  let autoFillStarted = false;
  let cardButtonClicked = false;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  
  // API Configuration
  const API_BASE = 'https://bublickrust.ru'; // Ваш домен
  
  // Функция получения аккаунта с сервера
  async function getStripeAccountFromServer() {
    try {
      // Логируем в систему расширения
      chrome.runtime.sendMessage({
        action: 'addLog',
        log: {
          level: 'info',
          source: 'stripe',
          message: '🟢 STRIPE: Запрос аккаунта с сервера (ДЛЯ ОПЛАТЫ)',
          data: { url: `${API_BASE}/api/stripe-accounts/random` }
        }
      }).catch(() => {});
      
      console.log('🌐 Запрашиваем аккаунт Stripe с сервера...');
      console.log('📍 URL:', `${API_BASE}/api/stripe-accounts/random`);
      
      const response = await fetch(`${API_BASE}/api/stripe-accounts/random`);
      
      console.log('📊 Ответ сервера:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Ошибка получения аккаунта:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 200)
        });
        return null;
      }
      
      const data = await response.json();
      
      // Логируем успешное получение
      chrome.runtime.sendMessage({
        action: 'addLog',
        log: {
          level: 'success',
          source: 'stripe',
          message: '🟢 STRIPE: Аккаунт успешно получен С СЕРВЕРА',
          data: { 
            email: data.email,
            account_type: data.account_type,
            hasPassword: !!data.password,
            note: 'Эти данные для STRIPE оплаты, НЕ для Cursor регистрации'
          }
        }
      }).catch(() => {});
      
      console.log('✅ Аккаунт получен с сервера:', {
        email: data.email,
        type: data.account_type,
        hasPassword: !!data.password
      });
      return data;
    } catch (error) {
      console.error('❌ Ошибка сети при получении аккаунта:', error);
      console.error('Проверьте:');
      console.error('1. Сервер доступен:', API_BASE);
      console.error('2. CORS настроен правильно');
      console.error('3. В базе есть активные аккаунты');
      return null;
    }
  }
  
  // Функция логирования использования аккаунта
  async function logAccountUsage(email, accountType, success = true, errorMessage = null) {
    try {
      const response = await fetch(`${API_BASE}/api/stripe-accounts/log-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          account_type: accountType,
          success,
          error_message: errorMessage,
          registration_location: await getLocationString()
        })
      });
      
      if (response.ok) {
        console.log('✅ Использование аккаунта залогировано');
      }
    } catch (error) {
      console.error('⚠️ Не удалось залогировать использование:', error);
    }
  }
  
  // Получение строки локации
  async function getLocationString() {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      return `${data.city || 'Unknown'}, ${data.country_name || 'Unknown'}`;
    } catch {
      return 'Unknown';
    }
  }
  
  // Генератор случайных данных
  const randomGenerator = {
    // Генерация номера карты по BIN
    generateCardNumber(bin = '544422') {
      let cardNumber = bin;
      // Дополняем до 15 цифр случайными числами
      while (cardNumber.length < 15) {
        cardNumber += Math.floor(Math.random() * 10);
      }
      // Добавляем контрольную цифру по алгоритму Луна
      cardNumber += this.getLuhnCheckDigit(cardNumber);
      return cardNumber;
    },
    
    // Алгоритм Луна для проверочной цифры
    getLuhnCheckDigit(number) {
      let sum = 0;
      let isEven = true;
      
      for (let i = number.length - 1; i >= 0; i--) {
        let digit = parseInt(number[i]);
        
        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }
        
        sum += digit;
        isEven = !isEven;
      }
      
      return (10 - (sum % 10)) % 10;
    },
    
    // Генерация даты истечения (1-5 лет в будущем)
    generateExpiry() {
      const now = new Date();
      const futureYears = Math.floor(Math.random() * 5) + 1;
      const month = Math.floor(Math.random() * 12) + 1;
      const year = now.getFullYear() + futureYears;
      
      return {
        month: String(month).padStart(2, '0'),
        year: String(year).slice(-2)
      };
    },
    
    // Генерация CVC
    generateCVC() {
      return String(Math.floor(Math.random() * 900) + 100);
    },
    
    // Случайное имя (английские имена для владельца карты)
    getRandomName() {
      const firstNames = ['Alexander', 'Dmitry', 'Maxim', 'Sergey', 'Andrew', 'Alexey', 'Artem', 'Ilya', 'Kirill', 'Mikhail'];
      const lastNames = ['Ivanov', 'Petrov', 'Smirnov', 'Kozlov', 'Popov', 'Sokolov', 'Lebedev', 'Novikov', 'Morozov', 'Volkov'];
      
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      
      return `${firstName} ${lastName}`;
    },
    
    // Случайный email (латиница + русские домены)
    getRandomEmail() {
      const domains = ['mail.ru', 'yandex.ru', 'gmail.com', 'rambler.ru'];
      const prefixes = ['alex', 'dmitry', 'maxim', 'sergey', 'ivan', 'andrey', 'roman', 'igor', 'oleg', 'viktor'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const number = Math.floor(Math.random() * 10000);
      const domain = domains[Math.floor(Math.random() * domains.length)];
      
      return `${prefix}${number}@${domain}`;
    },
    
    // Случайный адрес (Россия)
    getRandomAddress() {
      const streets = ['Ленина', 'Пушкина', 'Гагарина', 'Мира', 'Советская', 'Центральная', 'Московская', 'Кирова'];
      const cities = ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Челябинск', 'Самара'];
      
      return {
        line1: `ул. ${streets[Math.floor(Math.random() * streets.length)]}, д. ${Math.floor(Math.random() * 200) + 1}`,
        city: cities[Math.floor(Math.random() * cities.length)],
        state: 'Московская область',
        postalCode: String(Math.floor(Math.random() * 900000) + 100000), // 6 цифр для России
        country: 'RU'
      };
    }
  };
  
  // Функция безопасной установки значения в поле
  function setInputValue(element, value) {
    if (!element) return false;
    
    // Устанавливаем значение
    element.value = value;
    
    // Триггерим события для React/Vue и других фреймворков
    const events = ['input', 'change', 'blur'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });
    
    // Для React
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    ).set;
    nativeInputValueSetter.call(element, value);
    
    const inputEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(inputEvent);
    
    return true;
  }
  
  // Функция симуляции клавиатурного ввода (для iframe)
  async function simulateKeyboardInput(element, text) {
    if (!element) return false;
    
    try {
      // Фокусируемся на элементе
      element.focus();
      await delay(100);
      
      // Очищаем поле
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await delay(50);
      
      // Вводим текст посимвольно с событиями клавиатуры
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isDigit = /[0-9]/.test(char);
        const isSpace = char === ' ';
        
        // Определяем код клавиши
        let keyCode, code;
        if (isDigit) {
          keyCode = 48 + parseInt(char); // 48-57 для цифр 0-9
          code = `Digit${char}`;
        } else if (isSpace) {
          keyCode = 32;
          code = 'Space';
        } else {
          keyCode = char.charCodeAt(0);
          code = `Key${char.toUpperCase()}`;
        }
        
        // События клавиатуры
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: char,
          code: code,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true
        });
        
        const keyPressEvent = new KeyboardEvent('keypress', {
          key: char,
          code: code,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true
        });
        
        const keyUpEvent = new KeyboardEvent('keyup', {
          key: char,
          code: code,
          keyCode: keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true
        });
        
        element.dispatchEvent(keyDownEvent);
        element.dispatchEvent(keyPressEvent);
        
        // Добавляем символ
        element.value += char;
        
        // Событие input
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent);
        
        element.dispatchEvent(keyUpEvent);
        
        await delay(30); // Небольшая задержка между символами
      }
      
      // Финальные события
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
      
      return true;
    } catch (e) {
      console.log('⚠ Ошибка симуляции клавиатуры:', e.message);
      // Fallback - обычная установка значения
      return setInputValue(element, text);
    }
  }
  
  // Улучшенная функция поиска полей Stripe (включая iframe через клики)
  async function findStripeField(selectorArray, timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // 1. Пробуем найти в основном документе
      for (const selector of selectorArray) {
        try {
          const element = document.querySelector(selector);
          if (element && element.offsetParent !== null && !element.disabled) {
            console.log(`✓ Найдено поле по селектору: ${selector}`);
            return element;
          }
        } catch (e) {
          // Игнорируем ошибки
        }
      }
      
      // 2. Пробуем найти через все iframe (даже cross-origin)
      try {
        const allIframes = document.querySelectorAll('iframe');
        for (const iframe of allIframes) {
          try {
            // Пробуем получить доступ к iframe
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              for (const selector of selectorArray) {
                const element = iframeDoc.querySelector(selector);
                if (element && element.offsetParent !== null && !element.disabled) {
                  console.log(`✓ Найдено поле в iframe по селектору: ${selector}`);
                  return element;
                }
              }
            }
          } catch (e) {
            // Cross-origin iframe - используем другой подход
            // Кликаем в iframe и используем события клавиатуры
            try {
              const rect = iframe.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              
              // Кликаем в центр iframe
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              
              iframe.dispatchEvent(clickEvent);
              await delay(200);
              
              // Пробуем найти поле через активный элемент
              const activeElement = document.activeElement;
              if (activeElement && activeElement.tagName === 'INPUT') {
                console.log('✓ Найдено активное поле через iframe клик');
                return activeElement;
              }
            } catch (e2) {
              // Игнорируем ошибки клика
            }
          }
        }
      } catch (e) {
        // Игнорируем ошибки iframe
      }
      
      // 3. Пробуем найти через aria-label и placeholder
      const allInputs = document.querySelectorAll('input, textarea');
      for (const input of allInputs) {
        const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
        const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
        const name = (input.getAttribute('name') || '').toLowerCase();
        const id = (input.getAttribute('id') || '').toLowerCase();
        
        for (const selector of selectorArray) {
          const searchTerms = [
            'card number', 'cardnumber', 'номер карты',
            'exp', 'expiry', 'срок', 'mm/yy', 'mm / yy',
            'cvc', 'cvv', 'cvc/cvv',
            'name', 'имя', 'cardholder'
          ];
          
          for (const term of searchTerms) {
            if (
              (placeholder.includes(term) || 
               ariaLabel.includes(term) || 
               name.includes(term) || 
               id.includes(term)) &&
              input.offsetParent !== null &&
              !input.disabled
            ) {
              console.log(`✓ Найдено поле по тексту: ${term}`);
              return input;
            }
          }
        }
      }
      
      await delay(200);
    }
    
    console.log(`⚠ Поле не найдено за ${timeout}ms`);
    return null;
  }
  
  // Функция ожидания появления элемента
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
  
  // Задержка
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Функция надежного клика по радио-кнопке
  async function clickRadioButton(radio) {
    if (!radio) return false;
    
    try {
      console.log('🖱️ Пробуем кликнуть на радио-кнопку...');
      
      // Метод 1: Установка checked напрямую (самый надежный)
      radio.checked = true;
      const changeEvent1 = new Event('change', { bubbles: true, cancelable: true });
      radio.dispatchEvent(changeEvent1);
      await delay(50);
      
      if (radio.checked) {
        console.log('✓ Метод 1: Установка checked сработала');
      }
      
      // Метод 2: Клик по label, если есть (часто более надежно)
      const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
      if (label) {
        console.log('✓ Найден label, кликаем по нему...');
        label.focus();
        label.click();
        await delay(50);
        
        if (radio.checked) {
          console.log('✓ Метод 2: Клик по label сработал');
        }
      }
      
      // Метод 3: Клик по самой радио-кнопке
      radio.focus();
      radio.click();
      await delay(50);
      
      if (radio.checked) {
        console.log('✓ Метод 3: Клик по радио-кнопке сработал');
      }
      
      // Метод 4: Клик через события мыши на радио-кнопке
      const mouseDown = new MouseEvent('mousedown', { 
        bubbles: true, 
        cancelable: true,
        view: window,
        button: 0
      });
      const mouseUp = new MouseEvent('mouseup', { 
        bubbles: true, 
        cancelable: true,
        view: window,
        button: 0
      });
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0
      });
      
      radio.dispatchEvent(mouseDown);
      await delay(10);
      radio.dispatchEvent(mouseUp);
      await delay(10);
      radio.dispatchEvent(clickEvent);
      await delay(50);
      
      if (radio.checked) {
        console.log('✓ Метод 4: События мыши сработали');
      }
      
      // Метод 5: Клик по родительскому элементу
      const parent = radio.closest('div, li, label, span, button');
      if (parent && parent !== label) {
        console.log('✓ Кликаем по родительскому элементу:', parent.tagName);
        parent.focus();
        parent.click();
        await delay(50);
        
        if (radio.checked) {
          console.log('✓ Метод 5: Клик по родителю сработал');
        }
      }
      
      // Финальная проверка
      await delay(100);
      
      if (radio.checked) {
        console.log('✅ Радио-кнопка успешно выбрана!');
        return true;
      } else {
        console.log('⚠ Радио-кнопка не выбрана после всех попыток');
        // Последняя попытка - установка checked напрямую
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        radio.dispatchEvent(new Event('input', { bubbles: true }));
        return radio.checked;
      }
    } catch (e) {
      console.log('⚠ Ошибка при клике на радио-кнопку:', e.message);
      // В случае ошибки все равно пробуем установить checked
      try {
        radio.checked = true;
        return true;
      } catch (e2) {
        return false;
      }
    }
  }
  
  // Функция поиска и клика по кнопке "Карта" с постоянным мониторингом
  function startCardButtonMonitor() {
    if (cardButtonClicked) return;
    
    console.log('🔍 Начинаем постоянный мониторинг кнопки "Карта"...');
    
    const checkForButton = async () => {
      if (cardButtonClicked) return;
      
      // Ищем все радио-кнопки
      const allRadios = document.querySelectorAll('input[type="radio"]');
      
      for (const radio of allRadios) {
        // Получаем текст рядом с радио-кнопкой
        const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
        const parent = radio.closest('div, li, form, section, span');
        
        const radioText = (radio.getAttribute('aria-label') || '').toLowerCase();
        const labelText = label ? (label.textContent || label.innerText || '').toLowerCase() : '';
        const parentText = parent ? (parent.textContent || parent.innerText || '').toLowerCase() : '';
        const value = (radio.value || '').toLowerCase();
        
        // Проверяем, содержит ли текст "карта" или "card"
        const hasCardText = 
          radioText.includes('карта') || 
          radioText.includes('card') ||
          labelText.includes('карта') || 
          labelText.includes('картой') ||
          parentText.includes('карта') ||
          parentText.includes('картой') ||
          value.includes('card');
        
        if (hasCardText && !radio.checked) {
          console.log('✓ Радио-кнопка "Карта" найдена, нажимаем...');
          console.log('  - Label текст:', labelText.substring(0, 50));
          console.log('  - Parent текст:', parentText.substring(0, 50));
          
          const success = await clickRadioButton(radio);
          if (success) {
            cardButtonClicked = true;
            console.log('✅ Радио-кнопка "Карта" успешно выбрана!');
            
            // Ждем, пока форма визуально отобразится
            await delay(500);
            
            // Проверяем, что форма действительно видна
            let formAppeared = false;
            for (let i = 0; i < 20; i++) {
              const cardFields = document.querySelectorAll('input[name="cardnumber"], input[placeholder*="card" i], iframe[src*="stripe"], iframe[name*="card" i]');
              for (const field of cardFields) {
                const rect = field.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  formAppeared = true;
                  console.log('✓ Форма карты появилась на экране');
                  break;
                }
              }
              if (formAppeared) break;
              await delay(200);
            }
            
            return;
          }
        }
      }
      
      // Также ищем кнопки
      const allButtons = document.querySelectorAll('button, [role="button"]');
      for (const btn of allButtons) {
        const text = (btn.textContent || btn.innerText || '').toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        
        if (
          (text.includes('карта') || text.includes('картой') || ariaLabel.includes('карта') || ariaLabel.includes('card')) &&
          !btn.classList.contains('AccordionButton-open')
        ) {
          console.log('✓ Кнопка "Карта" найдена, нажимаем...');
          btn.focus();
          btn.click();
          cardButtonClicked = true;
          return;
        }
      }
    };
    
    // Запускаем проверку каждые 100ms
    const intervalId = setInterval(() => {
      if (cardButtonClicked) {
        clearInterval(intervalId);
        return;
      }
      checkForButton();
    }, 100);
    
    // Также используем MutationObserver
    const observer = new MutationObserver(() => {
      if (!cardButtonClicked) {
        checkForButton();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-expanded', 'checked', 'value']
    });
    
    // Останавливаем через 30 секунд
    setTimeout(() => {
      clearInterval(intervalId);
      observer.disconnect();
    }, 30000);
  }
  
  // Функция поиска и клика по кнопке "Начать пробное пользование"
  function findAndClickStartTrialButton(silent = false) {
    if (!silent) {
      console.log('🔍 Ищем кнопку "Начать пробное пользование"...');
    }
    
    const buttonTexts = [
      'Начать пробное пользование',
      'Start trial',
      'Начать пробный период',
      'Subscribe',
      'Подписаться',
      'Continue',
      'Продолжить',
      'Pay',
      'Оплатить',
      'Complete',
      'Завершить'
    ];
    
    const allButtons = document.querySelectorAll('button, [role="button"], a[role="button"], input[type="submit"]');
    
    for (const btn of allButtons) {
      const text = (btn.textContent || btn.innerText || '').trim();
      const ariaLabel = (btn.getAttribute('aria-label') || '').trim();
      const value = (btn.value || '').trim();
      
      for (const searchText of buttonTexts) {
        if (text.includes(searchText) || ariaLabel.includes(searchText) || value.includes(searchText)) {
          if (!btn.disabled && btn.offsetParent !== null) {
            console.log(`✓ Кнопка "${searchText}" найдена, нажимаем...`);
            btn.focus();
            setTimeout(() => {
              btn.click();
            }, 200);
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // Функция проверки ошибки "Карта отклонена"
  function checkForCardDeclinedError() {
    const errorTexts = [
      'Карта отклонена',
      'отклонена',
      'declined',
      'Card declined',
      'Try a different card',
      'Попробуйте другой картой',
      'Ваша кредитная карта отклонена'
    ];
    
    const allText = document.body.textContent || document.body.innerText || '';
    
    for (const errorText of errorTexts) {
      if (allText.toLowerCase().includes(errorText.toLowerCase())) {
        // Проверяем видимые элементы с ошибкой
        const errorElements = document.querySelectorAll('div, span, p, [role="alert"]');
        for (const el of errorElements) {
          const text = (el.textContent || el.innerText || '').toLowerCase();
          if (text.includes(errorText.toLowerCase()) && el.offsetParent !== null) {
            console.log('⚠ Обнаружена ошибка "Карта отклонена"');
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // Основная функция автозаполнения
  async function autoFillStripeForm(regenerateCard = false) {
    if (autoFillStarted && !regenerateCard) {
      console.log('⚠️ Stripe: Автозаполнение уже запущено');
      return;
    }
    
    if (!regenerateCard) {
      autoFillStarted = true;
    }
    
    console.log('🚀 Начинаем автозаполнение Stripe формы...');
    console.log('📍 URL:', window.location.href);
    
    try {
      // Запускаем постоянный мониторинг кнопки "Карта"
      if (!cardButtonClicked) {
        startCardButtonMonitor();
      }
      
      // Ждем, пока радио-кнопка будет нажата и форма отобразится
      console.log('⏳ Ждем, пока форма карты отобразится...');
      let formVisible = false;
      const maxWaitTime = 15000; // 15 секунд
      const startWaitTime = Date.now();
      
      while (!formVisible && (Date.now() - startWaitTime) < maxWaitTime) {
        // Проверяем, видна ли форма карты
        const cardFields = document.querySelectorAll('input[name="cardnumber"], input[placeholder*="card" i], iframe[src*="stripe"], iframe[name*="card" i]');
        
        // Проверяем, что форма действительно видна
        for (const field of cardFields) {
          const rect = field.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && field.offsetParent !== null) {
            formVisible = true;
            console.log('✓ Форма карты отображена на экране');
            break;
          }
        }
        
        if (!formVisible) {
          await delay(200);
        }
      }
      
      if (!formVisible) {
        console.log('⚠ Форма карты не отобразилась за отведенное время, продолжаем...');
      }
      
      // Даем дополнительное время для полной загрузки
      await delay(2000);
      
      // Получаем аккаунт с сервера
      console.log('═══════════════════════════════════════');
      console.log('🔄 ПОЛУЧЕНИЕ АККАУНТА С СЕРВЕРА');
      console.log('═══════════════════════════════════════');
      const serverAccount = await getStripeAccountFromServer();
      
      // Определяем тип аккаунта и email/password
      let accountEmail, accountPassword, accountType = 'FREE';
      
      if (serverAccount) {
        accountEmail = serverAccount.email;
        accountPassword = serverAccount.password;
        accountType = serverAccount.account_type || 'FREE';
        console.log('═══════════════════════════════════════');
        console.log('✅ ИСПОЛЬЗУЕМ АККАУНТ С СЕРВЕРА:');
        console.log(`   Email: ${accountEmail}`);
        console.log(`   Password: ${accountPassword ? '***' + accountPassword.slice(-4) : 'НЕТ'}`);
        console.log(`   Тип: ${accountType}`);
        console.log('═══════════════════════════════════════');
      } else {
        // Фолбэк: генерируем случайный email если сервер недоступен
        chrome.runtime.sendMessage({
          action: 'addLog',
          log: {
            level: 'warning',
            source: 'stripe',
            message: '⚠️ STRIPE: Используется ФОЛБЭК - случайные данные',
            data: { 
              reason: 'Сервер недоступен или нет активных аккаунтов',
              note: 'Проверьте API и добавьте аккаунты на сайте'
            }
          }
        }).catch(() => {});
        
        console.log('═══════════════════════════════════════');
        console.log('⚠️ ФОЛБЭК: Сервер недоступен');
        console.log('   Генерируем случайные данные');
        console.log('═══════════════════════════════════════');
        accountEmail = randomGenerator.getRandomEmail();
        accountPassword = null;
      }
      
      // Генерируем данные карты
      const cardData = {
        number: randomGenerator.generateCardNumber('544422'),
        expiry: randomGenerator.generateExpiry(),
        cvc: randomGenerator.generateCVC(),
        name: randomGenerator.getRandomName(),
        email: accountEmail,
        password: accountPassword,
        accountType: accountType,
        address: randomGenerator.getRandomAddress()
      };
      
      console.log('📝 Данные для заполнения:', { 
        email: cardData.email, 
        type: cardData.accountType,
        hasPassword: !!cardData.password 
      });
      
      // Расширенные селекторы для полей Stripe (Stripe использует iframe и специальные поля)
      const selectors = {
        cardNumber: [
          'input[name="cardnumber"]',
          'input[placeholder*="card number" i]',
          'input[placeholder*="Card number" i]',
          'input[autocomplete="cc-number"]',
          'input[id*="cardNumber"]',
          'input[id*="card-number"]',
          '#cardNumber',
          'input[data-elements-stable-field-name="cardNumber"]'
        ],
        expiry: [
          'input[name="exp-date"]',
          'input[name="expDate"]',
          'input[placeholder*="MM" i]',
          'input[placeholder*="YY" i]',
          'input[placeholder*="MM / YY" i]',
          'input[autocomplete="cc-exp"]',
          'input[id*="expiry"]',
          'input[id*="expDate"]',
          '#expDate',
          'input[data-elements-stable-field-name="cardExpiry"]'
        ],
        cvc: [
          'input[name="cvc"]',
          'input[name="cvv"]',
          'input[placeholder*="CVC" i]',
          'input[placeholder*="CVV" i]',
          'input[autocomplete="cc-csc"]',
          'input[id*="cvc"]',
          'input[id*="cvv"]',
          '#cvc',
          'input[data-elements-stable-field-name="cardCvc"]'
        ],
        name: [
          'input[name="name"]',
          'input[name="cardholderName"]',
          'input[placeholder*="name" i]',
          'input[placeholder*="Name" i]',
          'input[autocomplete="cc-name"]',
          'input[id*="name"]',
          '#name'
        ],
        email: [
          'input[type="email"]',
          'input[name="email"]',
          'input[placeholder*="email" i]',
          'input[placeholder*="Email" i]',
          'input[autocomplete="email"]',
          'input[id*="email"]',
          '#email'
        ],
        addressLine1: [
          'input[name="billingAddressLine1"]',
          'input[id="billingAddressLine1"]',
          '#billingAddressLine1',
          'input[autocomplete="billing address-line1"]',
          'input[autocomplete="address-line1"]',
          'input[name="address"]',
          'input[name="addressLine1"]',
          'input[id*="address"]',
          '#address',
          'input[placeholder*="адрес" i]',
          'input[placeholder*="Введите адрес" i]',
          'input[aria-label*="адрес" i]'
        ],
        city: [
          'input[name="billingCity"]',
          'input[id="billingCity"]',
          '#billingCity',
          'input[autocomplete="billing address-level2"]',
          'input[autocomplete="address-level2"]',
          'input[name="city"]',
          'input[id*="city"]',
          '#city',
          'input[placeholder*="Город" i]',
          'input[aria-label*="Город" i]'
        ],
        state: [
          'select[name="billingState"]',
          'select[id="billingState"]',
          '#billingState',
          'select[autocomplete="billing address-level1"]',
          'select[autocomplete="address-level1"]',
          'select[name="state"]',
          'select[id*="state"]',
          '#state',
          'select[aria-label*="Область" i]'
        ],
        postalCode: [
          'input[name="billingPostalCode"]',
          'input[id="billingPostalCode"]',
          '#billingPostalCode',
          'input[autocomplete="billing postal-code"]',
          'input[autocomplete="postal-code"]',
          'input[name="postalCode"]',
          'input[name="zip"]',
          'input[name="postal"]',
          'input[id*="postal"]',
          'input[id*="zip"]',
          '#postalCode',
          '#zip',
          'input[placeholder*="Почтовый индекс" i]',
          'input[placeholder*="индекс" i]',
          'input[aria-label*="индекс" i]'
        ],
        country: [
          'select[name="billingCountry"]',
          'select[id="billingCountry"]',
          '#billingCountry',
          'select[autocomplete="billing country"]',
          'select[autocomplete="country"]',
          'select[name="country"]',
          'select[id*="country"]',
          '#country'
        ]
      };
      
  // Функция поиска элемента (использует улучшенный поиск)
  const findElement = findStripeField;
      
      // Заполняем номер карты
      try {
        console.log('🔍 Ищем поле номера карты...');
        const cardNumberInput = await findStripeField(selectors.cardNumber, 15000);
        if (cardNumberInput) {
          await delay(500);
          // Пробуем симуляцию клавиатуры для iframe
          const success = await simulateKeyboardInput(cardNumberInput, cardData.number);
          if (!success) {
            setInputValue(cardNumberInput, cardData.number);
          }
          console.log('✓ Номер карты заполнен:', cardData.number);
        } else {
          console.log('⚠ Поле номера карты не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении номера карты:', e.message);
      }
      
      // Заполняем срок действия
      try {
        console.log('🔍 Ищем поле срока действия...');
        const expiryInput = await findStripeField(selectors.expiry, 10000);
        if (expiryInput) {
          await delay(500);
          const expiryValue = `${cardData.expiry.month}${cardData.expiry.year}`;
          const success = await simulateKeyboardInput(expiryInput, expiryValue);
          if (!success) {
            setInputValue(expiryInput, expiryValue);
          }
          console.log('✓ Срок действия заполнен:', expiryValue);
        } else {
          console.log('⚠ Поле срока действия не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении срока действия:', e.message);
      }
      
      // Заполняем CVC
      try {
        console.log('🔍 Ищем поле CVC...');
        const cvcInput = await findStripeField(selectors.cvc, 10000);
        if (cvcInput) {
          await delay(500);
          const success = await simulateKeyboardInput(cvcInput, cardData.cvc);
          if (!success) {
            setInputValue(cvcInput, cardData.cvc);
          }
          console.log('✓ CVC заполнен:', cardData.cvc);
        } else {
          console.log('⚠ Поле CVC не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении CVC:', e.message);
      }
      
      // Заполняем имя
      try {
        console.log('🔍 Ищем поле имени...');
        const nameInput = await findStripeField(selectors.name, 5000);
        if (nameInput) {
          await delay(300);
          await simulateKeyboardInput(nameInput, cardData.name) || setInputValue(nameInput, cardData.name);
          console.log('✓ Имя заполнено:', cardData.name);
        } else {
          console.log('⚠ Поле имени не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении имени:', e.message);
      }
      
      // Заполняем email
      try {
        console.log('🔍 Ищем поле email...');
        const emailInput = await findStripeField(selectors.email, 5000);
        if (emailInput) {
          await delay(300);
          await simulateKeyboardInput(emailInput, cardData.email) || setInputValue(emailInput, cardData.email);
          console.log('✓ Email заполнен:', cardData.email);
        } else {
          console.log('⚠ Поле email не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении email:', e.message);
      }
      
      // Заполняем адрес
      try {
        console.log('🔍 Ищем поле адреса...');
        const addressInput = await findStripeField(selectors.addressLine1, 8000);
        if (addressInput) {
          await delay(500);
          addressInput.click();
          await delay(200);
          await simulateKeyboardInput(addressInput, cardData.address.line1) || setInputValue(addressInput, cardData.address.line1);
          
          // Триггерим дополнительные события для Stripe autocomplete
          addressInput.dispatchEvent(new Event('focus', { bubbles: true }));
          addressInput.dispatchEvent(new Event('input', { bubbles: true }));
          addressInput.dispatchEvent(new Event('change', { bubbles: true }));
          addressInput.dispatchEvent(new Event('blur', { bubbles: true }));
          
          console.log('✓ Адрес заполнен:', cardData.address.line1);
          await delay(1000);
        } else {
          console.log('⚠ Поле адреса не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении адреса:', e.message);
      }
      
      // Заполняем город
      try {
        console.log('🔍 Ищем поле города...');
        const cityInput = await findStripeField(selectors.city, 8000);
        if (cityInput) {
          await delay(500);
          cityInput.click();
          await delay(200);
          await simulateKeyboardInput(cityInput, cardData.address.city) || setInputValue(cityInput, cardData.address.city);
          
          cityInput.dispatchEvent(new Event('input', { bubbles: true }));
          cityInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log('✓ Город заполнен:', cardData.address.city);
          await delay(500);
        } else {
          console.log('⚠ Поле города не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении города:', e.message);
      }
      
      // Заполняем область (state) - это может быть select или input
      try {
        console.log('🔍 Ищем поле области...');
        const stateField = await findStripeField(selectors.state, 5000);
        if (stateField) {
          await delay(300);
          if (stateField.tagName === 'SELECT') {
            const options = Array.from(stateField.options);
            const moscowOption = options.find(opt => 
              opt.text.includes('Московская') || 
              opt.text.includes('Moscow') ||
              opt.value.includes('MOS') ||
              opt.value.includes('MO')
            );
            if (moscowOption) {
              stateField.value = moscowOption.value;
              stateField.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('✓ Область установлена:', moscowOption.text);
            } else if (options.length > 0) {
              stateField.value = options[1].value;
              stateField.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('✓ Область установлена (первая доступная)');
            }
          } else {
            await simulateKeyboardInput(stateField, cardData.address.state) || setInputValue(stateField, cardData.address.state);
            console.log('✓ Область заполнена:', cardData.address.state);
          }
          await delay(300);
        } else {
          console.log('⚠ Поле области не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении области:', e.message);
      }
      
      // Заполняем почтовый индекс
      try {
        console.log('🔍 Ищем поле почтового индекса...');
        const postalInput = await findStripeField(selectors.postalCode, 8000);
        if (postalInput) {
          await delay(500);
          postalInput.click();
          await delay(200);
          await simulateKeyboardInput(postalInput, cardData.address.postalCode) || setInputValue(postalInput, cardData.address.postalCode);
          
          postalInput.dispatchEvent(new Event('input', { bubbles: true }));
          postalInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          console.log('✓ Индекс заполнен:', cardData.address.postalCode);
          await delay(500);
        } else {
          console.log('⚠ Поле индекса не найдено');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении индекса:', e.message);
      }
      
      // Заполняем страну (Россия)
      try {
        console.log('🔍 Ищем поле страны...');
        const countrySelect = await findStripeField(selectors.country, 8000);
        if (countrySelect && countrySelect.tagName === 'SELECT') {
          await delay(300);
          countrySelect.focus();
          await delay(200);
          
          const options = Array.from(countrySelect.options);
          const ruOption = options.find(opt => 
            opt.value === 'RU' || 
            opt.value === 'ru' ||
            opt.text.includes('Russia') || 
            opt.text.includes('Россия') ||
            opt.text.includes('Russian') ||
            opt.value.toLowerCase() === 'ru'
          );
          
          if (ruOption) {
            countrySelect.value = ruOption.value;
            countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✓ Страна установлена: Россия (RU)');
          } else {
            countrySelect.value = 'RU';
            countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('✓ Страна установлена: RU (напрямую)');
          }
          await delay(500);
        } else {
          console.log('⚠ Поле страны не найдено или не является select');
        }
      } catch (e) {
        console.log('⚠ Ошибка при заполнении страны:', e.message);
      }
      
      console.log('✅ Автозаполнение завершено!');
      
      // Логируем использование аккаунта
      if (cardData.email) {
        logAccountUsage(cardData.email, cardData.accountType, true).catch(err => {
          console.error('⚠️ Ошибка логирования:', err);
        });
      }
      
      // Показываем анимацию успеха
      showSuccessAnimation();
      
      // Ждем немного и ищем кнопку "Начать пробное пользование"
      await delay(2000);
      
      // Постоянно ищем и нажимаем кнопку "Начать пробное пользование"
      const startTrialInterval = setInterval(() => {
        if (findAndClickStartTrialButton(true)) { // silent = true для повторных вызовов
          clearInterval(startTrialInterval);
          console.log('✓ Кнопка "Начать пробное пользование" нажата');
        }
      }, 500);
      
      // Останавливаем поиск через 30 секунд
      setTimeout(() => {
        clearInterval(startTrialInterval);
      }, 30000);
      
      // Мониторим ошибки "Карта отклонена"
      const errorCheckInterval = setInterval(() => {
        if (checkForCardDeclinedError()) {
          clearInterval(errorCheckInterval);
          clearInterval(startTrialInterval);
          
          console.log('⚠ Обнаружена ошибка "Карта отклонена", генерируем новые данные...');
          
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log(`🔄 Попытка ${retryCount}/${MAX_RETRIES}: Генерируем новые данные карты...`);
            
            // Селекторы для полей карты
            const cardSelectors = {
              cardNumber: [
                'input[name="cardnumber"]',
                'input[placeholder*="card number" i]',
                'input[autocomplete="cc-number"]',
                'input[id*="cardNumber"]',
                '#cardNumber'
              ],
              expiry: [
                'input[name="exp-date"]',
                'input[name="expDate"]',
                'input[placeholder*="MM / YY" i]',
                'input[autocomplete="cc-exp"]',
                '#expDate'
              ],
              cvc: [
                'input[name="cvc"]',
                'input[name="cvv"]',
                'input[placeholder*="CVC" i]',
                'input[autocomplete="cc-csc"]',
                '#cvc'
              ]
            };
            
            // Очищаем только поля карты перед повторным заполнением
            const cardFields = [
              ...cardSelectors.cardNumber,
              ...cardSelectors.expiry,
              ...cardSelectors.cvc
            ];
            
            for (const selector of cardFields) {
              try {
                const field = document.querySelector(selector);
                if (field) {
                  field.value = '';
                  field.dispatchEvent(new Event('input', { bubbles: true }));
                  field.dispatchEvent(new Event('change', { bubbles: true }));
                }
              } catch (e) {
                // Игнорируем ошибки
              }
            }
            
            // Сбрасываем флаг и генерируем новые данные
            autoFillStarted = false;
            
            // Ждем немного и повторяем заполнение только полей карты
            setTimeout(async () => {
              const newCardData = {
                number: randomGenerator.generateCardNumber('544422'),
                expiry: randomGenerator.generateExpiry(),
                cvc: randomGenerator.generateCVC()
              };
              
              console.log('🔄 Заполняем новые данные карты:', newCardData);
              
      // Заполняем только поля карты
      const cardNumberInput = await findStripeField(cardSelectors.cardNumber, 10000);
      if (cardNumberInput) {
        await simulateKeyboardInput(cardNumberInput, newCardData.number) || setInputValue(cardNumberInput, newCardData.number);
        console.log('✓ Новый номер карты заполнен');
      }
      
      const expiryInput = await findStripeField(cardSelectors.expiry, 10000);
      if (expiryInput) {
        const expiryValue = `${newCardData.expiry.month}${newCardData.expiry.year}`;
        await simulateKeyboardInput(expiryInput, expiryValue) || setInputValue(expiryInput, expiryValue);
        console.log('✓ Новый срок действия заполнен');
      }
      
      const cvcInput = await findStripeField(cardSelectors.cvc, 10000);
      if (cvcInput) {
        await simulateKeyboardInput(cvcInput, newCardData.cvc) || setInputValue(cvcInput, newCardData.cvc);
        console.log('✓ Новый CVC заполнен');
      }
              
              // Снова ищем кнопку "Начать пробное пользование"
              await delay(1000);
              findAndClickStartTrialButton();
              
              // Продолжаем мониторинг ошибок
              const retryErrorCheck = setInterval(() => {
                if (checkForCardDeclinedError()) {
                  clearInterval(retryErrorCheck);
                  if (retryCount < MAX_RETRIES) {
                    // Рекурсивно вызываем обработку ошибки
                    setTimeout(() => {
                      const event = new Event('cardDeclinedRetry');
                      document.dispatchEvent(event);
                    }, 1000);
                  }
                }
              }, 1000);
            }, 2000);
          } else {
            console.log('❌ Достигнут лимит попыток');
            showErrorAnimation('Карта отклонена. Достигнут лимит попыток.');
          }
        }
      }, 1000);
      
      // Останавливаем проверку ошибок через 60 секунд
      setTimeout(() => {
        clearInterval(errorCheckInterval);
      }, 60000);
      
      // Уведомляем background script
      chrome.runtime.sendMessage({ action: 'stripeCompleted' });
      
    } catch (error) {
      console.error('❌ Ошибка автозаполнения:', error);
      showErrorAnimation(error.message);
      if (!regenerateCard) {
        autoFillStarted = false; // Сбрасываем флаг при ошибке только если не регенерация
      }
    }
  }
  
  // Анимация успешного завершения
  function showSuccessAnimation() {
    const overlay = document.createElement('div');
    overlay.id = 'stripe-success-overlay';
    overlay.innerHTML = `
      <div class="stripe-success-dialog">
        <div class="success-checkmark">
          <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
        <h2 class="success-title">Готово!</h2>
        <p class="success-message">Все данные заполнены</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.classList.add('active');
    }, 100);
    
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 500);
    }, 3000);
  }
  
  // Анимация ошибки
  function showErrorAnimation(message) {
    const overlay = document.createElement('div');
    overlay.id = 'stripe-error-overlay';
    overlay.innerHTML = `
      <div class="stripe-error-dialog">
        <div class="error-icon">✗</div>
        <h2 class="error-title">Ошибка</h2>
        <p class="error-message">${message}</p>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.classList.add('active');
    }, 100);
    
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 500);
    }, 4000);
  }
  
  // Слушаем сообщения от background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'autoFillStripe') {
      autoFillStripeForm();
      sendResponse({ received: true });
    }
  });
  
  // Автоматический запуск при загрузке страницы
  chrome.storage.local.get(['autoFillEnabled'], (result) => {
    console.log('🔍 Stripe: Проверка настроек автозаполнения', result);
    
    // Проверяем только autoFillEnabled, clearDataApproved не нужен для Stripe
    if (result.autoFillEnabled !== false) {
      console.log('✅ Stripe: Автозаполнение включено, запускаем...');
      
      // Сразу запускаем мониторинг кнопки "Карта"
      startCardButtonMonitor();
      
      // Ждем полной загрузки страницы и появления полей Stripe
      let autoFillTriggered = false;
      const tryAutoFill = () => {
        if (autoFillTriggered || autoFillStarted) {
          return;
        }
        
        // Проверяем, есть ли поля Stripe на странице
        const hasStripeFields = document.querySelector('input[name="cardnumber"], input[placeholder*="card" i], iframe[src*="stripe"], iframe');
        
        if (hasStripeFields || document.readyState === 'complete') {
          autoFillTriggered = true;
          console.log('🚀 Stripe: Запускаем автозаполнение...');
          setTimeout(() => {
            autoFillStripeForm();
          }, 1000);
        } else {
          console.log('⏳ Stripe: Ждем загрузки полей...');
          setTimeout(tryAutoFill, 1000);
        }
      };
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(tryAutoFill, 2000);
        });
      } else {
        setTimeout(tryAutoFill, 2000);
      }
    } else {
      console.log('⚠️ Stripe: Автозаполнение выключено');
    }
  });
})();

