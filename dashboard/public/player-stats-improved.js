// Improved Player Statistics Panel with Analytics

// Загрузка списка игроков при открытии страницы
async function loadPlayersList() {
    const container = document.getElementById('player-stats-container');
    if (!container) return;
    
    const authData = getAuthData();
    if (!authData) {
        container.innerHTML = '<p style="color: var(--danger);">⛔ Требуется авторизация</p>';
        return;
    }
    
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">⏳ Загрузка списка игроков...</div>';
    
    try {
        // Загружаем список игроков (увеличиваем лимит для всех игроков)
        const response = await fetch('/api/rust/players?limit=1000', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки списка игроков');
        }
        
        const players = await response.json();
        
        if (!Array.isArray(players) || players.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="font-size: 48px; margin-bottom: 16px;">👥</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">Игроков не найдено</div>
                    <div style="font-size: 14px;">Введите Steam ID вручную в поле поиска</div>
                </div>
            `;
            return;
        }
        
        // Сортируем: сначала онлайн, потом по имени
        const sortedPlayers = players.sort((a, b) => {
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
        
        container.innerHTML = `
            <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">👥</span>
                    <span>Выберите игрока</span>
                    <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); padding: 6px 12px; border-radius: 8px; margin-left: auto;">${sortedPlayers.length} игроков</span>
                </h3>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; max-height: 600px; overflow-y: auto; padding-right: 8px;">
                    ${sortedPlayers.map(player => {
                        const onlineBadge = player.online 
                            ? '<span style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-right: 8px; animation: pulse 2s ease-in-out infinite;"></span>'
                            : '<span style="display: inline-block; width: 8px; height: 8px; background: #6b7280; border-radius: 50%; margin-right: 8px;"></span>';
                        
                        return `
                            <div onclick="selectPlayer('${player.steam_id || player.steamId}')" 
                                style="padding: 16px; background: ${player.online ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))' : 'var(--bg-secondary)'}; border-radius: 12px; border: 2px solid ${player.online ? '#10b98140' : 'var(--border-color)'}; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='${player.online ? '#10b981' : '#667eea'}'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.2)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.borderColor='${player.online ? '#10b98140' : 'var(--border-color)'}'; this.style.boxShadow='none'">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                                    <div style="font-weight: 600; font-size: 15px; color: var(--text-primary); display: flex; align-items: center;">
                                        ${onlineBadge}
                                        ${player.name || 'Без имени'}
                                    </div>
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary); font-family: monospace; margin-top: 4px;">
                                    ${player.steam_id || player.steamId}
                                </div>
                                ${player.grid ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">📍 ${player.grid}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Load players list error:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--danger);">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Ошибка загрузки списка игроков</div>
                <div style="font-size: 14px; color: var(--text-secondary);">${error.message}</div>
                <button onclick="loadPlayersList()" style="margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;">
                    🔄 Попробовать снова
                </button>
            </div>
        `;
    }
}

// Выбор игрока из списка
function selectPlayer(steamId) {
    const searchInput = document.getElementById('player-stats-search');
    if (searchInput) {
        searchInput.value = steamId;
    }
    // Обновляем URL с Steam ID
    updatePlayerStatsUrl(steamId);
    loadPlayerStats();
}

// Обновление URL с Steam ID
function updatePlayerStatsUrl(steamId) {
    if (steamId) {
        window.location.hash = `player-stats?steamId=${steamId}`;
    } else {
        window.location.hash = 'player-stats';
    }
}

// Получение Steam ID из URL
function getSteamIdFromUrl() {
    const hash = window.location.hash;
    if (hash.includes('player-stats?')) {
        const params = new URLSearchParams(hash.split('?')[1]);
        return params.get('steamId');
    }
    return null;
}

async function loadImprovedPlayerStatsPanel(steamId = null, days = 7) {
    const container = document.getElementById('player-stats-container');
    if (!container) {
        console.error('Player stats container not found');
        return;
    }
    
    const authData = getAuthData();
    if (!authData) {
        container.innerHTML = '<p style="color: var(--danger);">⛔ Требуется авторизация</p>';
        return;
    }
    
    // Если steamId не передан, пытаемся получить из URL или поля поиска
    if (!steamId) {
        // Сначала проверяем URL
        steamId = getSteamIdFromUrl();
        
        // Если нет в URL, проверяем поле поиска
        if (!steamId) {
            const searchInput = document.getElementById('player-stats-search');
            if (searchInput && searchInput.value.trim()) {
                steamId = searchInput.value.trim();
            } else {
                // Если Steam ID не указан, загружаем список игроков
                loadPlayersList();
                return;
            }
        }
    }
    
    // Обновляем поле поиска и URL если нужно
    const searchInput = document.getElementById('player-stats-search');
    if (searchInput && searchInput.value !== steamId) {
        searchInput.value = steamId;
    }
    updatePlayerStatsUrl(steamId);
    
    container.style.display = 'block';
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-secondary);">⏳ Загрузка статистики...</div>';
    
    try {
        // Получаем период из селекта
        const periodSelect = document.getElementById('player-stats-period');
        const selectedDays = periodSelect ? parseInt(periodSelect.value) || days : days;
        
        // Загружаем статистику игрока
        const response = await fetch(`/api/player-stats/${steamId}?days=${selectedDays}`, {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Ошибка загрузки статистики' }));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const stats = await response.json();
        
        console.log('📊 [Player Stats] Loaded:', stats);
        
        // Форматируем время
        const formatTime = (hours) => {
            if (hours < 1) return `${Math.round(hours * 60)} мин.`;
            if (hours < 24) return `${Math.round(hours)} ч.`;
            return `${Math.round(hours / 24)} дн.`;
        };
        
        // Рассчитываем K/D за период
        const periodKd = stats.deaths_period > 0 
            ? (stats.kills_period / stats.deaths_period).toFixed(2)
            : (stats.kills_period > 0 ? stats.kills_period.toFixed(2) : '0.00');
        
        // Рассчитываем процент хедшотов
        const headshots = stats.headshots || 0;
        const torsoHits = stats.torso_hits || 0;
        const limbHits = stats.limb_hits || 0;
        const totalHits = headshots + torsoHits + limbHits;
        const headshotPercent = totalHits > 0 
            ? ((headshots / totalHits) * 100).toFixed(1)
            : '0.0';
        
        container.innerHTML = `
            <!-- Быстрый обзор -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 32px; margin-bottom: 24px; color: white; box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">👤 Статистика игрока</div>
                        <h2 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700;">Steam ID: ${steamId}</h2>
                        <p style="margin: 0; opacity: 0.9; font-size: 15px; line-height: 1.6;">
                            Период: ${selectedDays === 365 ? 'Все время' : `${selectedDays} дней`}
                        </p>
                    </div>
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div style="text-align: center; padding: 16px 24px; background: rgba(255,255,255,0.2); border-radius: 12px; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700;">${stats.kills_period || 0}</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Убийств</div>
                        </div>
                        <div style="text-align: center; padding: 16px 24px; background: rgba(255,255,255,0.2); border-radius: 12px; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700;">${stats.deaths_period || 0}</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Смертей</div>
                        </div>
                        <div style="text-align: center; padding: 16px 24px; background: rgba(255,255,255,0.2); border-radius: 12px; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700;">${periodKd}</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">K/D</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                <!-- Основная статистика -->
                <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">📊</span>
                        <span>Основная статистика</span>
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; border-left: 4px solid #667eea;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">🎯 Общий K/D</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${stats.kd_ratio || '0.00'}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">🎯</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1)); border-radius: 12px; border-left: 4px solid #ef4444;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">💀 Всего убийств</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${stats.total_kills || 0}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">💀</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1)); border-radius: 12px; border-left: 4px solid #3b82f6;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">⚰️ Всего смертей</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${stats.total_deaths || 0}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">⚰️</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1)); border-radius: 12px; border-left: 4px solid #10b981;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">⏱️ Время на сервере</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${formatTime(stats.hours_played || 0)}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">⏱️</div>
                        </div>
                    </div>
                </div>
                
                <!-- Точность стрельбы -->
                <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">🎯</span>
                        <span>Точность стрельбы</span>
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1)); border-radius: 12px; border-left: 4px solid #f59e0b;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">🎯 Хедшоты</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${headshots}</div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${headshotPercent}% от попаданий</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">🎯</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1)); border-radius: 12px; border-left: 4px solid #ef4444;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">🫁 Попадания в корпус</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${torsoHits}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">🫁</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.1)); border-radius: 12px; border-left: 4px solid #3b82f6;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">🦵 Попадания в конечности</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${limbHits}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">🦵</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.1)); border-radius: 12px; border-left: 4px solid #8b5cf6;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">📊 Всего попаданий</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${totalHits}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">📊</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Последние убийства -->
            <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">⚔️</span>
                        <span>Последние убийства</span>
                        <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); padding: 6px 12px; border-radius: 8px;">${stats.recent_kills?.length || 0} записей</span>
                    </h3>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${stats.recent_kills && stats.recent_kills.length > 0 ? 
                        stats.recent_kills.map((kill, idx) => {
                            const killDate = new Date(kill.created_at);
                            const timeAgo = getTimeAgo(killDate);
                            
                            return `
                                <div style="padding: 20px; background: var(--bg-secondary); border-radius: 16px; border-left: 4px solid ${kill.is_headshot ? '#f59e0b' : '#667eea'}; position: relative; overflow: hidden; transition: all 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
                                    <div style="position: absolute; top: 0; right: 0; width: 200px; height: 200px; background: radial-gradient(circle, ${kill.is_headshot ? '#f59e0b20' : '#667eea20'} 0%, transparent 70%); pointer-events: none;"></div>
                                    
                                    <div style="position: relative; z-index: 1;">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; flex-wrap: wrap; gap: 12px;">
                                            <div style="display: flex; align-items: center; gap: 16px;">
                                                <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, ${kill.is_headshot ? '#f59e0b' : '#667eea'}, ${kill.is_headshot ? '#d97706' : '#764ba2'}); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 20px; box-shadow: 0 4px 12px ${kill.is_headshot ? '#f59e0b40' : '#667eea40'};">
                                                    ${kill.is_headshot ? '🎯' : '⚔️'}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; font-size: 16px; color: var(--text-primary); margin-bottom: 4px;">
                                                        ${kill.is_headshot ? '🎯 Хедшот!' : 'Убийство'} → ${kill.target_steam_id}
                                                    </div>
                                                    <div style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                                                        <span>🕐</span>
                                                        <span>${timeAgo}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style="padding: 8px 16px; background: ${kill.is_headshot ? '#f59e0b' : '#667eea'}; border-radius: 10px; font-size: 13px; font-weight: 600; color: white; white-space: nowrap;">
                                                ${kill.weapon || 'Неизвестно'}
                                            </div>
                                        </div>
                                        
                                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; padding: 16px; background: var(--bg-primary); border-radius: 12px;">
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Жертва</div>
                                                <code style="font-size: 13px; color: var(--text-primary); font-weight: 600; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; display: inline-block;">${kill.target_steam_id}</code>
                                            </div>
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Дистанция</div>
                                                <div style="font-size: 13px; color: var(--text-primary); font-weight: 600;">${kill.distance ? Math.round(kill.distance) + ' м' : 'N/A'}</div>
                                            </div>
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Время игры</div>
                                                <div style="font-size: 13px; color: var(--text-primary); font-weight: 600;">${kill.game_time || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Дата</div>
                                                <div style="font-size: 13px; color: var(--text-primary); font-weight: 600;">${killDate.toLocaleString('ru-RU')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('') :
                        '<div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);"><div style="font-size: 48px; margin-bottom: 16px;">📭</div><div style="font-size: 16px;">Убийств за этот период нет</div></div>'
                    }
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Load player stats error:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--danger);">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Ошибка загрузки статистики</div>
                <div style="font-size: 14px; color: var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}

// Вспомогательная функция для форматирования времени
function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffMins < 1440) return `${Math.floor(diffMins/60)} ч. назад`;
    return `${Math.floor(diffMins/1440)} дн. назад`;
}

// Функция для загрузки статистики (вызывается из app.js)
function loadPlayerStats() {
    const searchInput = document.getElementById('player-stats-search');
    const periodSelect = document.getElementById('player-stats-period');
    
    // Проверяем URL сначала
    let steamId = getSteamIdFromUrl();
    
    // Если нет в URL, берем из поля поиска
    if (!steamId) {
        if (!searchInput || !searchInput.value.trim()) {
            showToast('Введите Steam ID игрока', 'error');
            return;
        }
        steamId = searchInput.value.trim();
    }
    
    const days = periodSelect ? parseInt(periodSelect.value) || 7 : 7;
    
    // Обновляем URL
    updatePlayerStatsUrl(steamId);
    
    loadImprovedPlayerStatsPanel(steamId, days);
}

// Экспортируем функцию для использования в основном app.js
if (typeof window !== 'undefined') {
    window.loadImprovedPlayerStatsPanel = loadImprovedPlayerStatsPanel;
    window.loadPlayerStats = loadPlayerStats;
    window.loadPlayersList = loadPlayersList;
    window.selectPlayer = selectPlayer;
    window.updatePlayerStatsUrl = updatePlayerStatsUrl;
    window.getSteamIdFromUrl = getSteamIdFromUrl;
    window.handlePlayerStatsPageLoad = handlePlayerStatsPageLoad;
}

// Автоматически загружаем список игроков или статистику при открытии страницы
document.addEventListener('DOMContentLoaded', () => {
    // Проверяем, открыта ли страница статистики игроков
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'page-player-stats') {
                const display = window.getComputedStyle(mutation.target).display;
                if (display !== 'none') {
                    handlePlayerStatsPageLoad();
                }
            }
        });
    });
    
    const playerStatsPage = document.getElementById('page-player-stats');
    if (playerStatsPage) {
        observer.observe(playerStatsPage, { attributes: true, attributeFilter: ['style'] });
        
        // Загружаем сразу если страница уже открыта
        if (window.getComputedStyle(playerStatsPage).display !== 'none') {
            handlePlayerStatsPageLoad();
        }
    }
    
    // Обработчик изменения hash для загрузки статистики при переходе по ссылке
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash;
        if (hash.includes('player-stats')) {
            const playerStatsPage = document.getElementById('page-player-stats');
            if (playerStatsPage && window.getComputedStyle(playerStatsPage).display !== 'none') {
                handlePlayerStatsPageLoad();
            }
        }
    });
});

// Обработка загрузки страницы статистики игроков
function handlePlayerStatsPageLoad() {
    const steamId = getSteamIdFromUrl();
    const searchInput = document.getElementById('player-stats-search');
    
    if (steamId) {
        // Если есть Steam ID в URL, загружаем статистику
        if (searchInput) {
            searchInput.value = steamId;
        }
        const periodSelect = document.getElementById('player-stats-period');
        const days = periodSelect ? parseInt(periodSelect.value) || 7 : 7;
        loadImprovedPlayerStatsPanel(steamId, days);
    } else if (!searchInput || !searchInput.value.trim()) {
        // Если нет Steam ID, загружаем список игроков
        loadPlayersList();
    }
}

