// Content Script для cursor.com

(function() {
  'use strict';
  
  // Проверяем, был ли уже показан диалог
  let dialogShown = false;
  
  // Проверяем, была ли уже одобрена очистка данных
  function checkIfAlreadyCleared() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['clearDataApproved', 'lastClearTimestamp'], (result) => {
        // Если очистка была одобрена и прошло менее 10 минут, не показываем диалог
        if (result.clearDataApproved && result.lastClearTimestamp) {
          const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
          if (result.lastClearTimestamp > tenMinutesAgo) {
            console.log('⏰ Очистка была недавно (менее 10 минут назад), пропускаем диалог');
            resolve(true);
            return;
          }
        }
        resolve(false);
      });
    });
  }
  
  // Функция принудительного сброса флага очистки (для тестирования)
  window.resetClearFlag = function() {
    chrome.storage.local.set({ 
      clearDataApproved: false,
      lastClearTimestamp: 0
    }, () => {
      console.log('✅ Флаг очистки сброшен. Обновите страницу.');
    });
  };
  
  // Создание и показ диалога очистки данных
  async function showClearDataDialog() {
    if (dialogShown) return;
    
    // Проверяем, не была ли недавно очистка
    const alreadyCleared = await checkIfAlreadyCleared();
    if (alreadyCleared) {
      console.log('Данные были недавно очищены, диалог пропущен');
      return;
    }
    
    dialogShown = true;
    
    // Создаем overlay
    const overlay = document.createElement('div');
    overlay.id = 'cursor-clear-overlay';
    overlay.innerHTML = `
      <div class="cursor-clear-dialog">
        <div class="cursor-clear-header">
          <h2>Cursor Auto Register</h2>
        </div>
        <div class="cursor-clear-body">
          <p>Очистить все данные сайта?</p>
          <p class="cursor-clear-hint">Cookies, LocalStorage, Cache</p>
        </div>
        <div class="cursor-clear-actions">
          <button id="cursor-clear-yes" class="cursor-btn cursor-btn-yes">
            Да
          </button>
          <button id="cursor-clear-no" class="cursor-btn cursor-btn-no">
            Нет
          </button>
        </div>
        <div id="cursor-clear-status" class="cursor-clear-status"></div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Обработчики кнопок с разными типами событий
    const yesBtn = document.getElementById('cursor-clear-yes');
    const noBtn = document.getElementById('cursor-clear-no');
    
    console.log('🎯 Добавляем обработчики кликов...');
    
    // Множественные обработчики для надежности
    yesBtn.addEventListener('click', handleClearYes, true);
    yesBtn.addEventListener('mousedown', handleClearYes, true);
    yesBtn.onclick = handleClearYes;
    
    noBtn.addEventListener('click', handleClearNo, true);
    noBtn.addEventListener('mousedown', handleClearNo, true);
    noBtn.onclick = handleClearNo;
    
    console.log('✓ Обработчики добавлены');
    
    // Анимация появления
    setTimeout(() => {
      overlay.classList.add('active');
      console.log('✓ Диалог показан');
    }, 100);
  }
  
  // Обработчик "Да"
  function handleClearYes(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log('🖱️ Клик по кнопке "Да"');
    
    const statusDiv = document.getElementById('cursor-clear-status');
    const yesBtn = document.getElementById('cursor-clear-yes');
    const noBtn = document.getElementById('cursor-clear-no');
    
    // Блокируем кнопки
    yesBtn.disabled = true;
    noBtn.disabled = true;
    
    statusDiv.innerHTML = '<div class="cursor-loader"></div><p>Очистка данных...</p>';
    statusDiv.classList.add('active');
    
    console.log('💾 Сохраняем timestamp...');
    
    // Сохраняем временную метку ПЕРЕД очисткой
    chrome.storage.local.set({ 
      clearDataApproved: true,
      lastClearTimestamp: Date.now()
    }, () => {
      console.log('✓ Timestamp сохранен');
      console.log('📤 Отправляем сообщение на очистку данных...');
      
      // Отправляем сообщение background script
      chrome.runtime.sendMessage(
        { action: 'clearCursorData' },
        (response) => {
          if (response && response.success) {
            console.log('✓ Данные очищены успешно');
            statusDiv.innerHTML = '<p class="cursor-success">✓ Данные очищены! Перезагрузка...</p>';
            
            // Страница будет перезагружена background script
          } else {
            console.error('✗ Ошибка очистки данных:', response);
            statusDiv.innerHTML = '<p class="cursor-error">✗ Ошибка очистки данных</p>';
            yesBtn.disabled = false;
            noBtn.disabled = false;
          }
        }
      );
    });
  }
  
  // Обработчик "Нет"
  function handleClearNo(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log('🖱️ Клик по кнопке "Нет"');
    
    const overlay = document.getElementById('cursor-clear-overlay');
    
    // Отправляем сообщение о отказе
    console.log('📤 Отправляем сообщение об отказе...');
    chrome.runtime.sendMessage({ action: 'declineClearData' });
    
    // Анимация закрытия
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      dialogShown = false;
      console.log('✓ Диалог закрыт');
    }, 300);
  }
  
  // Слушаем сообщения от background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'cursorDetected') {
      showClearDataDialog();
      sendResponse({ received: true });
    }
    
    if (request.action === 'forceCleanAndRegister') {
      console.log('🚀 Получена команда принудительной очистки и регистрации!');
      
      // Сразу запускаем очистку без диалога
      chrome.runtime.sendMessage(
        { action: 'clearCursorData' },
        (response) => {
          if (response && response.success) {
            console.log('✓ Данные очищены, переход на регистрацию...');
          }
        }
      );
      
      sendResponse({ received: true, started: true });
    }
  });
  
  // Показываем диалог при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(showClearDataDialog, 500);
    });
  } else {
    setTimeout(showClearDataDialog, 500);
  }
  
  // Добавляем глобальную функцию для тестирования в консоли
  window.testCursorDialog = () => {
    console.log('🧪 Тестирование диалога...');
    dialogShown = false;
    showClearDataDialog();
  };
  
  console.log('💡 Полезные команды для консоли:');
  console.log('  testCursorDialog() - показать диалог очистки');
  console.log('  resetClearFlag() - сбросить флаг "данные очищены" (если диалог не показывается)');
})();

