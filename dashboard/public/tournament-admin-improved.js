// Improved Tournament Admin Panel with Analytics and Real-time Countdown

async function loadImprovedTournamentAdminPanel() {
    const container = document.getElementById('tournament-admin-container');
    if (!container) return;
    
    const authData = getAuthData();
    if (!authData || !isAdmin(authData)) {
        container.innerHTML = '<p style="color: var(--danger);">⛔ Доступ запрещен</p>';
        return;
    }
    
    try {
        // Загружаем настройки и заявки
        const [settingsRes, applicationsRes] = await Promise.all([
            fetch('/api/tournament/settings', {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            }),
            fetch('/api/tournament/applications', {
                headers: { 'Authorization': `Bearer ${authData.token}` }
            })
        ]);
        
        const settingsData = await settingsRes.json();
        const applicationsData = await applicationsRes.json();
        
        const settings = settingsData.settings || { is_open: true, closes_at: null };
        const applications = applicationsData.applications || [];
        
        // Группируем заявки по дате для графика
        const applicationsByDate = {};
        applications.forEach(app => {
            const date = new Date(app.created_at).toLocaleDateString('ru-RU');
            applicationsByDate[date] = (applicationsByDate[date] || 0) + 1;
        });
        
        const dates = Object.keys(applicationsByDate).sort((a, b) => {
            const dateA = a.split('.').reverse().join('-');
            const dateB = b.split('.').reverse().join('-');
            return new Date(dateA) - new Date(dateB);
        });
        const counts = dates.map(date => applicationsByDate[date]);
        
        container.innerHTML = `
            <!-- Быстрый старт -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 32px; margin-bottom: 24px; color: white; box-shadow: 0 12px 40px rgba(102, 126, 234, 0.4);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
                    <div style="flex: 1; min-width: 250px;">
                        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">⚡ Быстрое управление</div>
                        <h2 style="margin: 0 0 12px 0; font-size: 28px; font-weight: 700;">Турнир на сервере</h2>
                        <p style="margin: 0; opacity: 0.9; font-size: 15px; line-height: 1.6;">
                            ${settings.closes_at ? `Регистрация до ${new Date(settings.closes_at).toLocaleString('ru-RU')}` : 'Регистрация закрыта'}
                        </p>
                    </div>
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <div style="text-align: center; padding: 16px 24px; background: rgba(255,255,255,0.2); border-radius: 12px; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700;">${applications.length}</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Всего заявок</div>
                        </div>
                        <div style="text-align: center; padding: 16px 24px; background: rgba(255,255,255,0.2); border-radius: 12px; backdrop-filter: blur(10px);">
                            <div style="font-size: 32px; font-weight: 700;">${applications.filter(a => a.status === 'pending').length}</div>
                            <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Ожидают</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
                <!-- Управление регистрацией -->
                <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">⚙️</span>
                        <span>Управление</span>
                    </h3>
                    
                    <div style="margin-bottom: 20px; padding: 16px; background: ${settings.closes_at ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))'}; border-radius: 12px; border-left: 4px solid ${settings.closes_at ? '#10b981' : '#ef4444'};">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <div style="font-size: 24px;">${settings.closes_at ? '✅' : '❌'}</div>
                            <div style="font-weight: 700; font-size: 16px; color: var(--text-primary);">
                                ${settings.closes_at ? 'Регистрация открыта' : 'Регистрация закрыта'}
                            </div>
                        </div>
                        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                            ${settings.closes_at ? '✓ Игроки могут подавать заявки<br>✓ Таймер обратного отсчета активен' : '✓ Прием заявок завершен<br>✓ Чтобы открыть - установите дату'}
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 10px; font-weight: 600; font-size: 14px; color: var(--text-primary);">
                            📅 Дата и время закрытия
                        </label>
                        <input type="datetime-local" id="tournament-close-time" 
                            value="${settings.closes_at ? new Date(settings.closes_at).toISOString().slice(0, 16) : ''}"
                            style="width: 100%; padding: 14px 16px; background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 10px; color: var(--text-primary); font-size: 15px; transition: all 0.2s; font-weight: 500;"
                            onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'"
                            onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                        <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary); display: flex; align-items: start; gap: 8px;">
                            <span style="font-size: 14px;">💡</span>
                            <span>Оставьте пустым для закрытия регистрации</span>
                        </div>
                    </div>
                    
                    <button id="save-tournament-settings-btn" 
                        style="width: 100%; padding: 16px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 16px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4); display: flex; align-items: center; justify-content: center; gap: 10px;"
                        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(102, 126, 234, 0.5)'"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(102, 126, 234, 0.4)'">
                        <span style="font-size: 20px;">💾</span>
                        <span>Сохранить изменения</span>
                    </button>
                </div>
                
                <!-- Статистика -->
                <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">📊</span>
                        <span>Статистика</span>
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; border-left: 4px solid #667eea;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">📝 Всего заявок</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${applications.length}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">📝</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1)); border-radius: 12px; border-left: 4px solid #f59e0b;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">⏳ В ожидании</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${applications.filter(a => a.status === 'pending').length}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">⏳</div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1)); border-radius: 12px; border-left: 4px solid #10b981;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">✅ Одобрено</div>
                                <div style="font-size: 28px; font-weight: 700; color: var(--text-primary);">${applications.filter(a => a.status === 'approved').length}</div>
                            </div>
                            <div style="font-size: 40px; opacity: 0.3;">✅</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- График заявок -->
            <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">📈</span>
                        <span>Динамика регистрации</span>
                    </h3>
                    <div style="font-size: 13px; color: var(--text-secondary); background: var(--bg-secondary); padding: 8px 16px; border-radius: 8px;">
                        ${dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : 'Нет данных'}
                    </div>
                </div>
                <canvas id="applications-chart" style="max-height: 280px;"></canvas>
            </div>
            
            <!-- Детальные логи заявок -->
            <div style="background: var(--bg-card); border-radius: 20px; padding: 28px; border: 2px solid var(--border-color); box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                    <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 24px;">📋</span>
                        <span>Детальные логи заявок</span>
                        <span style="font-size: 14px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); padding: 6px 12px; border-radius: 8px;">${applications.length} записей</span>
                    </h3>
                    ${applications.filter(a => a.status === 'pending').length > 0 ? `
                        <button id="approve-all-btn" style="padding: 12px 24px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); display: flex; align-items: center; gap: 8px;"
                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)'"
                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">
                            <span>✅</span>
                            <span>Одобрить все (${applications.filter(a => a.status === 'pending').length})</span>
                        </button>
                    ` : ''}
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${applications.length === 0 ? 
                        '<div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);"><div style="font-size: 48px; margin-bottom: 16px;">📭</div><div style="font-size: 16px;">Заявок пока нет</div></div>' : 
                        applications.map(app => {
                            const statusColor = {
                                'pending': '#f59e0b',
                                'approved': '#10b981',
                                'rejected': '#ef4444'
                            }[app.status] || '#6b7280';
                            
                            const statusText = {
                                'pending': '⏳ Ожидание рассмотрения',
                                'approved': '✅ Одобрено',
                                'rejected': '❌ Отклонено'
                            }[app.status] || app.status;
                            
                            const createdDate = new Date(app.created_at);
                            const now = new Date();
                            const diffMs = now - createdDate;
                            const diffMins = Math.floor(diffMs / 60000);
                            const timeAgo = diffMins < 1 ? 'только что' : 
                                           diffMins < 60 ? `${diffMins} мин. назад` :
                                           diffMins < 1440 ? `${Math.floor(diffMins/60)} ч. назад` :
                                           `${Math.floor(diffMins/1440)} дн. назад`;
                            
                            return `
                                <div style="padding: 24px; background: var(--bg-secondary); border-radius: 16px; border-left: 4px solid ${statusColor}; position: relative; overflow: hidden; transition: all 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
                                    <!-- Gradient background -->
                                    <div style="position: absolute; top: 0; right: 0; width: 250px; height: 250px; background: radial-gradient(circle, ${statusColor}10 0%, transparent 70%); pointer-events: none;"></div>
                                    
                                    <div style="position: relative; z-index: 1;">
                                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                                            <div style="display: flex; align-items: center; gap: 16px;">
                                                <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, ${statusColor}, ${statusColor}DD); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 20px; box-shadow: 0 4px 12px ${statusColor}40;">
                                                    ${(app.users?.discord_username || app.users?.username || 'U')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style="font-weight: 700; font-size: 18px; color: var(--text-primary); margin-bottom: 4px;">
                                                        ${app.users?.discord_username || app.users?.username || 'Неизвестный пользователь'}
                                                    </div>
                                                    <div style="font-size: 13px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                                                        <span>🕐</span>
                                                        <span>${timeAgo}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div style="padding: 10px 20px; background: ${statusColor}; border-radius: 10px; font-size: 14px; font-weight: 600; color: white; white-space: nowrap; box-shadow: 0 4px 12px ${statusColor}40;">
                                                ${statusText}
                                            </div>
                                        </div>
                                        
                                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; padding: 20px; background: var(--bg-primary); border-radius: 12px;">
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Discord ID</div>
                                                <code style="font-size: 14px; color: var(--text-primary); font-weight: 600; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; display: inline-block;">${app.discord_id}</code>
                                            </div>
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Steam ID</div>
                                                <code style="font-size: 14px; color: var(--text-primary); font-weight: 600; background: var(--bg-secondary); padding: 4px 8px; border-radius: 6px; display: inline-block;">${app.steam_id}</code>
                                            </div>
                                            <div>
                                                <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Дата создания</div>
                                                <div style="font-size: 14px; color: var(--text-primary); font-weight: 600;">${createdDate.toLocaleString('ru-RU')}</div>
                                            </div>
                                            ${app.team_number ? `
                                                <div>
                                                    <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; font-weight: 600;">Команда</div>
                                                    <div style="font-size: 14px; color: ${app.team_number === 1 ? '#ef4444' : '#3b82f6'}; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; background: ${app.team_number === 1 ? '#ef444420' : '#3b82f620'}; padding: 6px 12px; border-radius: 8px;">
                                                        ${app.team_number === 1 ? '🔴 Команда 1' : '🔵 Команда 2'}
                                                    </div>
                                                </div>
                                            ` : ''}
                                        </div>
                                        
                                        <!-- Action buttons -->
                                        ${app.status === 'pending' ? `
                                            <div style="display: flex; gap: 12px; margin-top: 20px;">
                                                <button class="approve-application-btn" data-app-id="${app.id}" data-discord-id="${app.discord_id}" style="flex: 1; padding: 14px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);"
                                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)'"
                                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'">
                                                    ✅ Одобрить
                                                </button>
                                                <button class="reject-application-btn" data-app-id="${app.id}" data-discord-id="${app.discord_id}" style="flex: 1; padding: 14px; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);"
                                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(239, 68, 68, 0.4)'"
                                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.3)'">
                                                    ❌ Отклонить
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')
                    }
                </div>
            </div>
        `;
        
        // Создаем график заявок с анимацией
        const chartCanvas = document.getElementById('applications-chart');
        let tournamentChart = null;
        if (chartCanvas && dates.length > 0) {
            tournamentChart = new Chart(chartCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [{
                        label: 'Количество заявок',
                        data: counts,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#667eea',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#764ba2',
                        pointHoverBorderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 2000,
                        easing: 'easeInOutQuart',
                        onComplete: function() {
                            // Анимация линии (рисование)
                            const canvas = tournamentChart.canvas;
                            const meta = tournamentChart.getDatasetMeta(0);
                            const points = meta.data;
                            
                            if (points.length > 1) {
                                const ctx = canvas.getContext('2d');
                                ctx.save();
                                
                                // Создаем путь линии
                                ctx.beginPath();
                                ctx.moveTo(points[0].x, points[0].y);
                                for (let i = 1; i < points.length; i++) {
                                    const point = points[i];
                                    const prevPoint = points[i - 1];
                                    
                                    // Кривая Безье для плавности
                                    const cpX = prevPoint.x + (point.x - prevPoint.x) / 2;
                                    ctx.bezierCurveTo(
                                        cpX, prevPoint.y,
                                        cpX, point.y,
                                        point.x, point.y
                                    );
                                }
                                
                                ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)';
                                ctx.lineWidth = 3;
                                ctx.lineCap = 'round';
                                ctx.lineJoin = 'round';
                                
                                // Анимация рисования линии
                                const length = ctx.getLength ? ctx.getLength() : 1000;
                                ctx.setLineDash([length]);
                                ctx.lineDashOffset = length;
                                
                                ctx.restore();
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 14,
                                    weight: 600
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            padding: 16,
                            cornerRadius: 12,
                            titleFont: { size: 16, weight: 'bold' },
                            bodyFont: { size: 14 },
                            displayColors: false,
                            callbacks: {
                                title: (context) => `Дата: ${context[0].label}`,
                                label: (context) => `Заявок: ${context.parsed.y}`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1,
                                color: '#9ca3af',
                                font: {
                                    size: 12,
                                    weight: 600
                                }
                            },
                            grid: {
                                color: 'rgba(156, 163, 175, 0.1)',
                                borderDash: [5, 5]
                            }
                        },
                        x: {
                            ticks: {
                                color: '#9ca3af',
                                font: {
                                    size: 12,
                                    weight: 600
                                }
                            },
                            grid: {
                                display: false
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                },
                plugins: [{
                    id: 'animatedLine',
                    afterDatasetsDraw: function(chart) {
                        const meta = chart.getDatasetMeta(0);
                        if (!meta || meta.hidden) return;
                        
                        const ctx = chart.ctx;
                        const points = meta.data;
                        
                        if (points.length < 2) return;
                        
                        // Анимированная линия с градиентом
                        ctx.save();
                        ctx.strokeStyle = '#667eea';
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.lineJoin = 'round';
                        ctx.shadowColor = 'rgba(102, 126, 234, 0.5)';
                        ctx.shadowBlur = 10;
                        
                        // Создаем плавную кривую
                        ctx.beginPath();
                        ctx.moveTo(points[0].x, points[0].y);
                        
                        for (let i = 1; i < points.length; i++) {
                            const xc = (points[i - 1].x + points[i].x) / 2;
                            const yc = (points[i - 1].y + points[i].y) / 2;
                            ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
                        }
                        
                        ctx.quadraticCurveTo(
                            points[points.length - 2].x,
                            points[points.length - 2].y,
                            points[points.length - 1].x,
                            points[points.length - 1].y
                        );
                        
                        ctx.stroke();
                        ctx.restore();
                    }
                }]
            });
            
            // Добавляем анимацию после отрисовки
            setTimeout(() => {
                if (tournamentChart) {
                    tournamentChart.update('none');
                }
            }, 100);
        } else if (chartCanvas) {
            // Демо-режим с анимированным графиком
            const demoDates = ['01.11', '02.11', '03.11', '04.11', '05.11', '06.11', '07.11'];
            const demoCounts = [2, 5, 3, 8, 6, 10, 7];
            
            const chart = new Chart(chartCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: demoDates,
                    datasets: [{
                        label: 'Пример данных',
                        data: demoCounts,
                        borderColor: '#9ca3af',
                        backgroundColor: 'rgba(156, 163, 175, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 6,
                        pointHoverRadius: 10,
                        pointBackgroundColor: '#9ca3af',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointHoverBackgroundColor: '#6b7280',
                        pointHoverBorderWidth: 3,
                        borderDash: [5, 5]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 2500,
                        easing: 'easeInOutQuart',
                        delay: 200
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: {
                                    size: 14,
                                    weight: 600
                                },
                                color: '#9ca3af'
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            padding: 16,
                            cornerRadius: 12,
                            titleFont: { size: 16, weight: 'bold' },
                            bodyFont: { size: 14 },
                            displayColors: false,
                            callbacks: {
                                title: (context) => `Дата: ${context[0].label}`,
                                label: (context) => `Заявок: ${context.parsed.y} (демо)`
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 2,
                                color: '#9ca3af',
                                font: {
                                    size: 12,
                                    weight: 600
                                }
                            },
                            grid: {
                                color: 'rgba(156, 163, 175, 0.1)',
                                borderDash: [5, 5]
                            }
                        },
                        x: {
                            ticks: {
                                color: '#9ca3af',
                                font: {
                                    size: 12,
                                    weight: 600
                                }
                            },
                            grid: {
                                display: false
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    }
                },
                plugins: [{
                    id: 'demoWatermark',
                    afterDraw: function(chart) {
                        const ctx = chart.ctx;
                        const width = chart.width;
                        const height = chart.height;
                        
                        ctx.save();
                        ctx.font = 'bold 24px Arial';
                        ctx.fillStyle = 'rgba(156, 163, 175, 0.15)';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('ДЕМО ДАННЫЕ', width / 2, height / 2);
                        ctx.restore();
                    }
                }]
            });
        }
        
        // Обработчики событий
        const saveBtn = document.getElementById('save-tournament-settings-btn');
        const approveAllBtn = document.getElementById('approve-all-btn');
        
        // Обработчик кнопки "Одобрить все"
        if (approveAllBtn) {
            approveAllBtn.addEventListener('click', async () => {
                const pendingApps = applications.filter(a => a.status === 'pending');
                if (pendingApps.length === 0) return;
                
                if (!confirm(`Вы уверены, что хотите одобрить все ${pendingApps.length} заявок?`)) {
                    return;
                }
                
                approveAllBtn.disabled = true;
                approveAllBtn.innerHTML = '⏳ Одобряем...';
                
                let successCount = 0;
                let failCount = 0;
                
                for (const app of pendingApps) {
                    try {
                        const response = await fetch('/api/tournament/applications/approve', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authData.token}`
                            },
                            body: JSON.stringify({ application_id: app.id })
                        });
                        
                        if (response.ok) {
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (error) {
                        console.error('Error approving application:', error);
                        failCount++;
                    }
                }
                
                showToast(`✅ Одобрено: ${successCount} | ❌ Ошибок: ${failCount}`, successCount > 0 ? 'success' : 'error');
                
                // Перезагружаем панель
                setTimeout(() => loadImprovedTournamentAdminPanel(), 1000);
            });
        }
        
        // Обработчики кнопок "Одобрить" для отдельных заявок
        document.querySelectorAll('.approve-application-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const appId = this.getAttribute('data-app-id');
                const discordId = this.getAttribute('data-discord-id');
                
                this.disabled = true;
                this.innerHTML = '⏳ Одобряем...';
                
                try {
                    const response = await fetch('/api/tournament/applications/approve', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authData.token}`
                        },
                        body: JSON.stringify({ application_id: appId })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showToast('✅ Заявка одобрена', 'success');
                        setTimeout(() => loadImprovedTournamentAdminPanel(), 1000);
                    } else {
                        throw new Error(data.error || 'Ошибка одобрения');
                    }
                } catch (error) {
                    console.error('Error approving application:', error);
                    showToast(`❌ Ошибка: ${error.message}`, 'error');
                    this.disabled = false;
                    this.innerHTML = '✅ Одобрить';
                }
            });
        });
        
        // Обработчики кнопок "Отклонить" для отдельных заявок
        document.querySelectorAll('.reject-application-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const appId = this.getAttribute('data-app-id');
                const discordId = this.getAttribute('data-discord-id');
                
                if (!confirm('Вы уверены, что хотите отклонить эту заявку?')) {
                    return;
                }
                
                this.disabled = true;
                this.innerHTML = '⏳ Отклоняем...';
                
                try {
                    const response = await fetch('/api/tournament/applications/reject', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authData.token}`
                        },
                        body: JSON.stringify({ application_id: appId })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showToast('❌ Заявка отклонена', 'success');
                        setTimeout(() => loadImprovedTournamentAdminPanel(), 1000);
                    } else {
                        throw new Error(data.error || 'Ошибка отклонения');
                    }
                } catch (error) {
                    console.error('Error rejecting application:', error);
                    showToast(`❌ Ошибка: ${error.message}`, 'error');
                    this.disabled = false;
                    this.innerHTML = '❌ Отклонить';
                }
            });
        });
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const closesAt = document.getElementById('tournament-close-time')?.value || null;
                const isOpen = !!closesAt; // Регистрация открыта, если указана дата
                
                saveBtn.disabled = true;
                saveBtn.textContent = '⏳ Сохранение...';
                
                try {
                    const response = await fetch('/api/tournament/settings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authData.token}`
                        },
                        body: JSON.stringify({
                            isOpen,
                            closesAt: closesAt ? new Date(closesAt).toISOString() : null
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        showToast('✅ Настройки успешно сохранены', 'success');
                        setTimeout(() => loadImprovedTournamentAdminPanel(), 1000);
                    } else {
                        throw new Error(data.error || 'Ошибка сохранения');
                    }
                } catch (error) {
                    showToast(`❌ Ошибка: ${error.message}`, 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Сохранить настройки';
                }
            });
        }
        
    } catch (error) {
        console.error('Load tournament admin panel error:', error);
        if (container) {
            container.innerHTML = `<p style="color: var(--danger);">❌ Ошибка загрузки: ${error.message}</p>`;
        }
    }
}

// Экспортируем функцию для использования в основном app.js
if (typeof window !== 'undefined') {
    window.loadImprovedTournamentAdminPanel = loadImprovedTournamentAdminPanel;
}

