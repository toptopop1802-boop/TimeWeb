// Background Service Worker для отслеживания вкладок и состояния

// Система логирования
const Logger = {
  log(level, source, message, data = null) {
    const logEntry = {
      timestamp: Date.now(),
      level: level, // 'info', 'success', 'warning', 'error', 'debug'
      source: source, // 'background', 'register', 'stripe', etc.
      message: message,
      data: data
    };

    // Сохраняем в storage
    chrome.storage.local.get(['extensionLogs'], (result) => {
      const logs = result.extensionLogs || [];
      logs.push(logEntry);
      
      // Ограничиваем до 1000 записей
      if (logs.length > 1000) {
        logs.shift();
      }
      
      chrome.storage.local.set({ extensionLogs: logs });
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

// Хранение состояния расширения
let extensionState = {
  cursorTabId: null,
  stripeTabId: null,
  clearDataApproved: false,
  autoFillEnabled: true,
  // Храним текущий аккаунт NotLetters
  currentNotLettersAccount: null,
  currentNotLettersEmail: null
};

// Список аккаунтов NotLetters (email:password)
// Формат: { email: 'email@domain.com', password: 'password' }
// Можно добавлять новые аккаунты в массив для ротации
const NOTLETTERS_ACCOUNTS = [
  { email: 'andrews197937@bublickrust.ru', password: 'oyc1YAfSzrw4' }
];

// Токен NotLetters API - ВАЖНО: обновите этот токен на актуальный!
// Получить токен можно на https://notletters.com/account
const NOTLETTERS_TOKEN = 'y0iRqPnAEihzo2qdHV9YPFwLv6CASSHJ'; // TODO: Обновить токен
const NOTLETTERS_API_URL = 'https://api.notletters.com/v1/letters';

// Слушатель установки расширения
chrome.runtime.onInstalled.addListener(() => {
  Logger.info('background', 'Cursor Auto Register установлено');
  
  // Загружаем сохраненные настройки
  chrome.storage.local.get(['autoFillEnabled'], (result) => {
    if (result.autoFillEnabled !== undefined) {
      extensionState.autoFillEnabled = result.autoFillEnabled;
    }
  });
});

// Отслеживание открытия новых вкладок
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Проверка cursor.com
    if (tab.url.includes('cursor.com')) {
      extensionState.cursorTabId = tabId;
      console.log('Cursor.com обнаружен на вкладке:', tabId);
      
      // Отправляем сообщение content script
      chrome.tabs.sendMessage(tabId, {
        action: 'cursorDetected'
      }).catch(err => console.log('Content script еще не загружен'));
    }
    
    // Проверка Stripe checkout
    if (tab.url.includes('checkout.stripe.com')) {
      extensionState.stripeTabId = tabId;
      Logger.info('background', 'Stripe checkout обнаружен', { tabId, url: tab.url });
      console.log('Stripe checkout обнаружен на вкладке:', tabId);
      
      // Проверяем настройки автозаполнения
      chrome.storage.local.get(['autoFillEnabled'], (result) => {
        Logger.info('background', 'Проверка настроек автозаполнения Stripe', { 
          autoFillEnabled: result.autoFillEnabled 
        });
        
        if (result.autoFillEnabled !== false) {
          Logger.info('background', 'Автозаполнение Stripe включено, отправляем команду');
          // Отправляем сообщение для автозаполнения
          chrome.tabs.sendMessage(tabId, {
            action: 'autoFillStripe'
          }).catch(err => {
            Logger.warning('background', 'Content script Stripe еще не загружен', { error: err.message });
            console.log('Content script еще не загружен');
          });
        } else {
          Logger.info('background', 'Автозаполнение Stripe выключено');
        }
      });
    }
  }
});

// Обработка сообщений от content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearCursorData') {
    // Очистка всех данных для cursor.com
    const tabId = sender.tab?.id;
    
    if (!tabId) {
      Logger.error('background', 'Не указан tabId для очистки данных', { 
        hasRequest: !!request, 
        hasSender: !!sender,
        senderTab: sender.tab
      });
      sendResponse({ success: false, error: 'Tab ID не указан' });
      return true; // Важно для async ответа
    }
    
    clearCursorData(tabId)
      .then(() => {
        Logger.success('background', 'Данные cursor.com успешно очищены');
        sendResponse({ success: true });
        
        // Сохраняем флаг одобрения очистки с временной меткой
        chrome.storage.local.set({ 
          clearDataApproved: true,
          lastClearTimestamp: Date.now()
        });
        extensionState.clearDataApproved = true;
      })
      .catch((error) => {
        Logger.error('background', 'Ошибка очистки данных cursor.com', { error: error.message });
        console.error('Ошибка очистки данных:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Асинхронный ответ
  }
  
  if (request.action === 'declineClearData') {
    // Пользователь отказался от очистки
    chrome.storage.local.set({ clearDataApproved: false });
    extensionState.clearDataApproved = false;
    sendResponse({ success: true });
  }
  
  if (request.action === 'getSettings') {
    chrome.storage.local.get(['autoFillEnabled'], (result) => {
      sendResponse({ 
        autoFillEnabled: result.autoFillEnabled !== undefined ? result.autoFillEnabled : true 
      });
    });
    return true;
  }
  
  if (request.action === 'updateSettings') {
    chrome.storage.local.set(request.settings, () => {
      extensionState = { ...extensionState, ...request.settings };
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'stripeCompleted') {
    Logger.success('background', 'Stripe автозаполнение завершено');
    sendResponse({ success: true });
  }

  // Обработка добавления лога от content scripts
  if (request.action === 'addLog') {
    Logger.log(request.log.level, request.log.source, request.log.message, request.log.data);
    sendResponse({ success: true });
  }

  // Обработка запроса на получение email от NotLetters
  if (request.action === 'getNotLettersEmail') {
    const getEmailFromNotLetters = async () => {
      try {
        Logger.info('background', '🔵 NOTLETTERS: Запрос на получение email для регистрации CURSOR', {});
        
        // Выбираем случайный аккаунт из списка
        if (NOTLETTERS_ACCOUNTS.length === 0) {
          throw new Error('Нет доступных аккаунтов NotLetters');
        }

        // Пока используем первый аккаунт (потом можно добавить ротацию)
        const account = NOTLETTERS_ACCOUNTS[0];
        const email = account.email;

        // Сохраняем текущий аккаунт для дальнейшего использования
        extensionState.currentNotLettersAccount = account;
        extensionState.currentNotLettersEmail = email;

        Logger.success('background', '🔵 NOTLETTERS: Email получен (ДЛЯ CURSOR РЕГИСТРАЦИИ)', { 
          email,
          note: 'Этот email НЕ для Stripe, а для получения кода подтверждения Cursor'
        });
        console.log('✓ NotLetters: Email получен из аккаунта:', email);
        return email;
      } catch (error) {
        Logger.error('background', 'Ошибка при получении email от NotLetters', { error: error.message });
        console.error('NotLetters: Ошибка при получении email:', error);
        throw error;
      }
    };

    getEmailFromNotLetters()
      .then((email) => sendResponse({ success: true, email }))
      .catch((error) => {
        Logger.error('background', 'Не удалось получить email', { error: error.message });
        console.error('NotLetters: Ошибка при получении email:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Асинхронный ответ
  }

  // Ожидание письма от Cursor и извлечение 6-значного кода через NotLetters API
  if (request.action === 'waitForNotLettersCode') {
    const { email, timeout = 60000 } = request;

    const getLettersFromNotLetters = async (accountEmail, accountPassword, searchQuery = '') => {
      try {
        Logger.debug('background', 'Отправка запроса к NotLetters API', { 
          accountEmail, 
          searchQuery,
          url: NOTLETTERS_API_URL
        });

        const response = await fetch(NOTLETTERS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NOTLETTERS_TOKEN}`
          },
          body: JSON.stringify({
            email: accountEmail,
            password: accountPassword,
            filters: {
              search: searchQuery,
              star: false
            }
          })
        });

        Logger.debug('background', 'Ответ от NotLetters API получен', { 
          status: response.status, 
          statusText: response.statusText,
          ok: response.ok
        });

        if (!response.ok) {
          const errorText = await response.text();
          Logger.error('background', 'NotLetters API вернул ошибку', { 
            status: response.status, 
            statusText: response.statusText,
            errorText: errorText.substring(0, 500)
          });
          
          // Специальная обработка ошибок
          if (response.status === 401) {
            throw new Error('NotLetters API: Неверный токен или пароль. Проверьте NOTLETTERS_TOKEN и пароль аккаунта в background.js');
          }
          if (response.status === 523) {
            throw new Error('NotLetters API: Сервис временно недоступен (523). Попробуйте позже.');
          }
          
          throw new Error(`NotLetters API error: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        Logger.debug('background', 'Данные от NotLetters API распарсены', { 
          hasData: !!data.data,
          lettersCount: data.data?.letters?.length || 0
        });
        
        console.log('📨 NotLetters RAW Response:', {
          hasData: !!data.data,
          lettersCount: data.data?.letters?.length || 0,
          letters: data.data?.letters?.map(l => ({
            sender: l.sender,
            subject: l.subject,
            hasLetter: !!l.letter,
            hasHtml: !!l.letter?.html,
            hasText: !!l.letter?.text
          }))
        });
        
        return data.data?.letters || [];
      } catch (error) {
        Logger.error('background', 'Ошибка при получении писем от NotLetters', { 
          error: error.message,
          errorName: error.name,
          accountEmail,
          searchQuery
        });
        console.error('NotLetters: Ошибка при получении писем:', error);
        throw error;
      }
    };

    const extractCodeFromLetter = (letterContent) => {
      console.log('🔍 Извлекаем код из письма...');
      console.log('📧 Структура письма:', {
        hasHtml: !!letterContent.html,
        hasText: !!letterContent.text,
        htmlLength: letterContent.html?.length || 0,
        textLength: letterContent.text?.length || 0
      });
      
      // Выводим первые 500 символов для отладки
      if (letterContent.html) {
        console.log('📝 HTML (первые 500 символов):', letterContent.html.substring(0, 500));
      }
      if (letterContent.text) {
        console.log('📝 TEXT (первые 500 символов):', letterContent.text.substring(0, 500));
      }
      
      // Более точные паттерны (по приоритету)
      const patterns = [
        // Специфичные паттерны для Cursor (высокий приоритет)
        /(?:код|code)[^\d]*(\d{6})/i,
        /verification[^\d]*(\d{6})/i,
        /confirm[^\d]*(\d{6})/i,
        /введите[^\d]*(\d{6})/i,
        /enter[^\d]*(\d{6})/i,
        
        // Поиск изолированного 6-значного числа в HTML тегах
        />\s*(\d{6})\s*</,
        /<p[^>]*>\s*(\d{6})\s*<\/p>/,
        /<div[^>]*>\s*(\d{6})\s*<\/div>/,
        /<h\d[^>]*>\s*(\d{6})\s*<\/h\d>/,
        
        // Общие паттерны (низкий приоритет)
        /code\s*is[:\s]*(\d{6})/i,
        /your\s*code[:\s]*(\d{6})/i,
        /ваш\s*код[:\s]*(\d{6})/i
      ];

      const checkContent = (content, contentType) => {
        if (!content) {
          console.log(`⚠️ ${contentType} пустой`);
          return null;
        }
        
        console.log(`🔍 Проверяем ${contentType}...`);
        
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1]) {
            const code = match[1];
            // Проверяем что это не повторяющиеся цифры (666666, 111111)
            const uniqueDigits = new Set(code.split('')).size;
            if (uniqueDigits === 1) {
              console.log(`⚠️ Пропускаем подозрительный код ${code} (все цифры одинаковые)`);
              continue;
            }
            console.log(`✅ Код найден в ${contentType}: ${code} (паттерн: ${pattern})`);
            return code;
          }
        }
        
        // Фолбэк: ищем любое 6-значное число, НО исключаем повторяющиеся
        const allSixDigits = content.match(/\b\d{6}\b/g);
        if (allSixDigits && allSixDigits.length > 0) {
          console.log(`🔍 Найдено 6-значных чисел в ${contentType}:`, allSixDigits);
          for (const code of allSixDigits) {
            const uniqueDigits = new Set(code.split('')).size;
            if (uniqueDigits > 1) {
              console.log(`✅ Код найден (фолбэк) в ${contentType}: ${code}`);
              return code;
            } else {
              console.log(`⚠️ Пропускаем ${code} (все цифры одинаковые)`);
            }
          }
        }
        
        console.log(`❌ Код не найден в ${contentType}`);
        return null;
      };

      // Проверяем HTML содержимое
      if (letterContent.html) {
        const code = checkContent(letterContent.html, 'HTML');
        if (code) return code;
      }

      // Проверяем текстовое содержимое
      if (letterContent.text) {
        const code = checkContent(letterContent.text, 'TEXT');
        if (code) return code;
      }

      console.log('❌ Код не найден ни в HTML, ни в TEXT');
      return null;
    };

    (async () => {
      let responseSent = false;
      
      const safeSendResponse = (response) => {
        if (!responseSent) {
          responseSent = true;
          try {
            sendResponse(response);
          } catch (e) {
            console.error('NotLetters: Ошибка при отправке ответа:', e);
          }
        }
      };

      try {
        const start = Date.now();
        
        // Используем сохраненный аккаунт или находим по email
        let account = extensionState.currentNotLettersAccount;
        if (!account || account.email !== email) {
          account = NOTLETTERS_ACCOUNTS.find(acc => acc.email === email);
          if (!account) {
            // Если не нашли, используем первый доступный
            account = NOTLETTERS_ACCOUNTS[0];
          }
        }

        if (!account) {
          throw new Error('Не найден аккаунт NotLetters для email: ' + email);
        }

        Logger.info('background', 'Ожидаем письмо от Cursor', { email, accountEmail: account.email });
        console.log(`NotLetters: Ожидаем письмо от Cursor для ${email}...`);

        // Поисковые запросы для поиска письма от Cursor
        const searchQueries = ['cursor', 'authenticator', 'verification', 'verify', 'noreply'];

        while (Date.now() - start < timeout) {
          // Пробуем разные поисковые запросы
          for (const searchQuery of searchQueries) {
            if (responseSent) break; // Прерываем если ответ уже отправлен
            
            try {
              Logger.debug('background', 'Запрос писем через NotLetters API', { searchQuery, accountEmail: account.email });
              const letters = await getLettersFromNotLetters(account.email, account.password, searchQuery);
              
              Logger.debug('background', 'Получены письма от NotLetters', { count: letters.length, searchQuery });
              console.log(`📬 Получено писем: ${letters.length} для запроса "${searchQuery}"`);
              
              // Ищем письмо от Cursor
              for (const letter of letters) {
                if (responseSent) break; // Прерываем если ответ уже отправлен
                
                const sender = (letter.sender || '').toLowerCase();
                const subject = (letter.subject || '').toLowerCase();
                
                if (
                  sender.includes('cursor') ||
                  sender.includes('noreply') ||
                  subject.includes('cursor') ||
                  subject.includes('verification') ||
                  subject.includes('verify') ||
                  subject.includes('код')
                ) {
                  Logger.success('background', 'Найдено письмо от Cursor', { 
                    sender: letter.sender, 
                    subject: letter.subject,
                    letterId: letter.id
                  });
                  console.log('✓ NotLetters: Найдено письмо от Cursor:', letter.subject);
                  
                  // Извлекаем код из письма
                  const code = extractCodeFromLetter(letter.letter || {});
                  
                  if (code) {
                    Logger.success('background', 'Код найден в письме', { code, sender: letter.sender });
                    console.log('✓ NotLetters: Код найден:', code);
                    // Возвращаем HTML содержимое письма для совместимости с extractVerificationCode
                    const letterContent = letter.letter?.html || letter.letter?.text || '';
                    safeSendResponse({ success: true, code, letterContent });
                    return;
                  } else {
                    Logger.warning('background', 'Код не найден в письме', { 
                      sender: letter.sender, 
                      subject: letter.subject,
                      letterContent: (letter.letter?.html || letter.letter?.text || '').substring(0, 200)
                    });
                    console.log('⚠ NotLetters: Код не найден в письме, возвращаем содержимое для ручного извлечения');
                    // Если код не найден автоматически, возвращаем содержимое письма
                    const letterContent = letter.letter?.html || letter.letter?.text || '';
                    if (letterContent) {
                      safeSendResponse({ success: true, code: null, letterContent });
                      return;
                    }
                  }
                }
              }
            } catch (error) {
              Logger.error('background', 'Ошибка при поиске писем', { error: error.message, searchQuery });
              console.error('NotLetters: Ошибка при поиске писем:', error);
            }
          }

          if (responseSent) break; // Прерываем цикл если ответ уже отправлен

          // Ждем перед следующей проверкой
          await new Promise((r) => setTimeout(r, 3000));
        }

        // Таймаут (только если ответ еще не отправлен)
        if (!responseSent) {
          Logger.warning('background', 'Таймаут ожидания письма', { email, timeout });
          safeSendResponse({ success: false, error: 'Письмо не получено в течение заданного времени' });
        }
      } catch (error) {
        Logger.error('background', 'Ошибка при ожидании кода', { error: error.message, email });
        console.error('NotLetters: Ошибка при ожидании кода:', error);
        if (!responseSent) {
          safeSendResponse({ success: false, error: error.message });
        }
      }
    })();

    return true; // Асинхронный ответ
  }
});

// Функция очистки всех данных cursor.com
async function clearCursorData(tabId) {
  Logger.info('background', 'Начинаем очистку данных cursor.com', { tabId });
  
  const cookieDomains = [
    'cursor.com',
    '.cursor.com',
    'www.cursor.com',
    'authenticator.cursor.sh'
  ];
  
  const origins = [
    'https://cursor.com',
    'https://www.cursor.com',
    'https://authenticator.cursor.sh'
  ];
  
  try {
    Logger.info('background', 'Очистка cookies для всех доменов cursor.com');
    
    // Очистка cookies для всех релевантных доменов
    let cookiesRemoved = 0;
    for (const domain of cookieDomains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain });
        Logger.debug('background', `Найдено cookies для ${domain}`, { count: cookies.length });
        
        for (const cookie of cookies) {
          try {
            const scheme = cookie.secure ? 'https' : 'http';
            const url = `${scheme}://${cookie.domain}${cookie.path}`;
            await chrome.cookies.remove({ url, name: cookie.name });
            cookiesRemoved++;
          } catch (e) {
            Logger.warning('background', `Не удалось удалить cookie`, { 
              name: cookie.name, 
              domain: cookie.domain,
              error: e.message 
            });
          }
        }
      } catch (e) {
        Logger.warning('background', `Ошибка при получении cookies для ${domain}`, { error: e.message });
      }
    }
    
    Logger.success('background', 'Cookies удалены', { count: cookiesRemoved });
    
    // Очистка browsing data для всех origins
    Logger.info('background', 'Очистка browsing data (кэш, localStorage, indexedDB и т.д.)');
    
    // Очищаем для каждого origin отдельно для надежности
    for (const origin of origins) {
      try {
        await chrome.browsingData.remove(
          { origins: [origin] },
          {
            cache: true,
            cookies: true,
            localStorage: true,
            sessionStorage: true,
            indexedDB: true,
            serviceWorkers: true,
            cacheStorage: true,
            fileSystems: true,
            webSQL: true
          }
        );
        Logger.debug('background', `Данные очищены для ${origin}`);
      } catch (e) {
        Logger.warning('background', `Ошибка очистки данных для ${origin}`, { error: e.message });
      }
    }
    
    // Также очищаем для всех поддоменов cursor.com
    try {
      await chrome.browsingData.remove(
        { 
          origins: origins,
          // Также очищаем по домену для поддоменов
          hostnames: ['cursor.com', '*.cursor.com', 'authenticator.cursor.sh', '*.authenticator.cursor.sh']
        },
        {
          cache: true,
          cookies: true,
          localStorage: true,
          sessionStorage: true,
          indexedDB: true,
          serviceWorkers: true,
          cacheStorage: true,
          fileSystems: true,
          webSQL: true
        }
      );
    } catch (e) {
      Logger.warning('background', 'Ошибка при очистке данных по доменам', { error: e.message });
    }
    
    // Дополнительная очистка всех cookies для cursor.com через browsingData
    try {
      await chrome.browsingData.remove(
        { 
          origins: ['https://cursor.com', 'https://*.cursor.com'],
          since: 0 // Все время
        },
        {
          cookies: true
        }
      );
    } catch (e) {
      Logger.warning('background', 'Ошибка при дополнительной очистке cookies', { error: e.message });
    }
    
    Logger.success('background', 'Все данные cursor.com успешно очищены', { 
      cookiesRemoved,
      originsCleared: origins.length 
    });
    console.log('Все данные cursor.com и authenticator.cursor.sh успешно очищены');
    
    // Перезагружаем вкладку если она существует
    if (tabId) {
      try {
        await chrome.tabs.reload(tabId);
        Logger.info('background', 'Вкладка перезагружена', { tabId });
      } catch (e) {
        // Если не удалось перезагрузить, просто переходим на dashboard
        try {
          await chrome.tabs.update(tabId, { url: 'https://cursor.com/dashboard' });
          Logger.info('background', 'Переход на dashboard', { tabId });
        } catch (e2) {
          Logger.warning('background', 'Не удалось обновить вкладку', { error: e2.message });
        }
      }
    }
    
    return true;
  } catch (error) {
    Logger.error('background', 'Ошибка при очистке данных cursor.com', { error: error.message });
    console.error('Ошибка при очистке данных:', error);
    throw error;
  }
}

// Очистка флага при закрытии всех вкладок cursor.com
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === extensionState.cursorTabId) {
    extensionState.cursorTabId = null;
  }
  if (tabId === extensionState.stripeTabId) {
    extensionState.stripeTabId = null;
  }
});

