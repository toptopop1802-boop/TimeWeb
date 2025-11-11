// Popup Script для управления расширением

document.addEventListener('DOMContentLoaded', () => {
  const autoFillToggle = document.getElementById('autoFillToggle');
  const autoFillStatus = document.getElementById('autoFillStatus');
  const clearStorageBtn = document.getElementById('clearStorageBtn');
  const openCursorBtn = document.getElementById('openCursorBtn');
  const openLogsBtn = document.getElementById('openLogsBtn');
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  
  let passwordVisible = false;
  
  // Загружаем сохраненные настройки
  loadSettings();
  
  // Загружаем учетные данные последней регистрации
  loadCredentials();
  
  // Обработчик переключателя автозаполнения
  autoFillToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    
    chrome.runtime.sendMessage({
      action: 'updateSettings',
      settings: { autoFillEnabled: enabled }
    }, (response) => {
      if (response && response.success) {
        updateStatusDisplay(enabled);
        showNotification(enabled ? 'Автозаполнение включено' : 'Автозаполнение выключено');
      }
    });
  });
  
  // Обработчик кнопки "Открыть логи"
  if (openLogsBtn) {
    openLogsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  // Обработчик кнопки "Открыть Cursor и очистить"
  openCursorBtn.addEventListener('click', () => {
    console.log('🚀 Открываем Cursor и запускаем очистку...');
    
    // Устанавливаем флаг автоматической очистки
    chrome.storage.local.set({ 
      autoCleanEnabled: true,
      clearDataApproved: true,
      lastClearTimestamp: Date.now()
    }, () => {
      // Открываем cursor.com
      chrome.tabs.create({ 
        url: 'https://cursor.com',
        active: true
      }, (tab) => {
        console.log('✓ Вкладка создана:', tab.id);
        showNotification('Открываю Cursor и очищаю данные...');
        
        // Ждем загрузки страницы и очищаем данные
        setTimeout(() => {
          // Очищаем данные через background script
          chrome.runtime.sendMessage({ 
            action: 'clearCursorData', 
            tabId: tab.id 
          }, (response) => {
            if (response && response.success) {
              showNotification('✓ Данные очищены!');
              
              // После очистки запускаем регистрацию
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                  action: 'forceCleanAndRegister'
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.log('Ждем загрузки страницы...');
                    // Content script запустится автоматически
                  } else {
                    console.log('✓ Сообщение отправлено:', response);
                  }
                });
              }, 2000);
            } else {
              showNotification('✗ Ошибка очистки данных');
            }
          });
        }, 2000);
        
        // Закрываем popup
        window.close();
      });
    });
  });
  
  // Обработчик кнопки очистки хранилища
  clearStorageBtn.addEventListener('click', () => {
    if (confirm('Очистить историю и сбросить все настройки?')) {
      chrome.storage.local.clear(() => {
        showNotification('История очищена');
        // Сбрасываем настройки по умолчанию
        chrome.storage.local.set({ autoFillEnabled: true }, () => {
          loadSettings();
        });
      });
    }
  });
  
  // Загрузка настроек из хранилища
  function loadSettings() {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response) {
        const enabled = response.autoFillEnabled !== undefined ? response.autoFillEnabled : true;
        autoFillToggle.checked = enabled;
        updateStatusDisplay(enabled);
      }
    });
  }
  
  // Обновление отображения статуса
  function updateStatusDisplay(enabled) {
    autoFillStatus.textContent = enabled ? 'Включено' : 'Выключено';
    autoFillStatus.className = 'status-value ' + (enabled ? 'status-active' : 'status-inactive');
  }
  
  // Показ уведомления
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'popup-notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
  
  // Загрузка сохраненных учетных данных
  function loadCredentials() {
    chrome.storage.local.get(['registrationEmail', 'registrationPassword', 'registrationTimestamp'], (result) => {
      if (result.registrationEmail && result.registrationPassword) {
        // Показываем секцию с учетными данными
        const credentialsSection = document.getElementById('credentialsSection');
        credentialsSection.style.display = 'block';
        
        // Заполняем данные
        document.getElementById('savedEmail').textContent = result.registrationEmail;
        document.getElementById('savedPassword').dataset.password = result.registrationPassword;
        
        // Форматируем время
        if (result.registrationTimestamp) {
          const date = new Date(result.registrationTimestamp);
          const timeStr = date.toLocaleString('ru-RU', { 
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          document.getElementById('savedTime').textContent = timeStr;
        }
      }
    });
  }
  
  // Обработчик показа/скрытия пароля
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const passwordEl = document.getElementById('savedPassword');
      const storedPassword = passwordEl.dataset.password;
      
      if (!storedPassword) return;
      
      passwordVisible = !passwordVisible;
      
      if (passwordVisible) {
        passwordEl.textContent = storedPassword;
        passwordEl.classList.remove('password-hidden');
        togglePasswordBtn.textContent = '🙈';
      } else {
        passwordEl.textContent = '••••••••••••';
        passwordEl.classList.add('password-hidden');
        togglePasswordBtn.textContent = '👁';
      }
    });
  }
});

