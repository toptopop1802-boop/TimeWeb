// ============================================
// ADMIN CHANGELOG PAGE
// ============================================

let adminChangelogData = [];

async function loadAdminChangelog() {
    const list = document.getElementById('admin-changelog-list');
    if (list) {
        list.innerHTML = '<div class="admin-loading">Загрузка...</div>';
    }
    
    try {
        const response = await fetch(`${API_URL}/api/admin/changelog`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Админ API не найден. Убедитесь, что сервер перезапущен.');
            } else if (response.status === 503) {
                throw new Error('Supabase не настроен. Проверьте переменные окружения.');
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        adminChangelogData = data || [];
        renderAdminChangelogList();
    } catch (error) {
        console.error('Error loading admin changelog:', error);
        adminChangelogData = [];
        if (list) {
            list.innerHTML = `<div class="admin-empty" style="color: var(--danger);">Ошибка загрузки: ${error.message}<br><br>Убедитесь, что:<br>1. Сервер перезапущен<br>2. Таблица changelog создана в Supabase<br>3. Переменные окружения настроены</div>`;
        }
    }
}

function renderAdminChangelogList() {
    const list = document.getElementById('admin-changelog-list');
    if (!list) return;

    if (adminChangelogData.length === 0) {
        list.innerHTML = '<div class="admin-empty">Нет изменений. Создайте первую запись.</div>';
        return;
    }

    list.innerHTML = adminChangelogData.map(changelog => {
        const date = new Date(changelog.date);
        const dateStr = date.toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        }) + ' ' + date.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const totalAdded = changelog.added ? changelog.added.length : 0;
        const totalFixed = changelog.fixed ? changelog.fixed.length : 0;
        const totalChanged = changelog.changed ? changelog.changed.length : 0;

        return `
            <div class="admin-changelog-item">
                <div class="admin-changelog-info">
                    <div class="admin-changelog-header">
                        <h3># ${escapeHtml(changelog.build)}</h3>
                        <span class="admin-changelog-views">👁 ${changelog.views || 0}</span>
                    </div>
                    ${changelog.subtitle ? `<p class="admin-changelog-subtitle">${escapeHtml(changelog.subtitle)}</p>` : ''}
                    <div class="admin-changelog-meta">
                        <span>📅 ${dateStr}</span>
                        <span>✅ +${totalAdded}</span>
                        <span>🔧 ${totalFixed}</span>
                        <span>🔄 ${totalChanged}</span>
                    </div>
                </div>
                <div class="admin-changelog-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editChangelog('${changelog.id}')">✏️ Редактировать</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteChangelog('${changelog.id}')">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

function addAdminItem(type) {
    const list = document.getElementById(`admin-${type}-list`);
    if (!list) return;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'admin-item-row';
    itemDiv.innerHTML = `
        <input type="text" class="form-control admin-item-input" placeholder="Введите описание...">
        <button type="button" class="btn btn-danger btn-sm" onclick="removeAdminItem(this)">✕</button>
    `;
    list.appendChild(itemDiv);
}

function removeAdminItem(btn) {
    btn.closest('.admin-item-row').remove();
}

function openAdminModal(changelog = null) {
    const modal = document.getElementById('admin-changelog-modal');
    const title = document.getElementById('admin-modal-title');
    const form = document.getElementById('admin-changelog-form');
    
    if (changelog) {
        title.textContent = 'Редактировать изменение';
        document.getElementById('admin-changelog-id').value = changelog.id;
        document.getElementById('admin-build').value = changelog.build || '';
        document.getElementById('admin-subtitle').value = changelog.subtitle || '';
        
        const date = new Date(changelog.date);
        const dateLocal = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        document.getElementById('admin-date').value = dateLocal;

        // Fill items
        renderAdminItems('added', changelog.added || []);
        renderAdminItems('fixed', changelog.fixed || []);
        renderAdminItems('changed', changelog.changed || []);
    } else {
        title.textContent = 'Создать изменение';
        form.reset();
        document.getElementById('admin-changelog-id').value = '';
        
        // Set today's date by default
        setTodayDate();
        
        renderAdminItems('added', []);
        renderAdminItems('fixed', []);
        renderAdminItems('changed', []);
    }

    modal.classList.add('active');
}

function renderAdminItems(type, items) {
    const list = document.getElementById(`admin-${type}-list`);
    if (!list) return;

    list.innerHTML = '';
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'admin-item-row';
        itemDiv.innerHTML = `
            <input type="text" class="form-control admin-item-input" value="${escapeHtml(item)}" placeholder="Введите описание...">
            <button type="button" class="btn btn-danger btn-sm" onclick="removeAdminItem(this)">✕</button>
        `;
        list.appendChild(itemDiv);
    });
}

function closeAdminModal() {
    const modal = document.getElementById('admin-changelog-modal');
    modal.classList.remove('active');
}

function getAdminItems(type) {
    const list = document.getElementById(`admin-${type}-list`);
    if (!list) return [];

    return Array.from(list.querySelectorAll('.admin-item-input'))
        .map(input => input.value.trim())
        .filter(text => text.length > 0);
}

async function saveChangelog() {
    const id = document.getElementById('admin-changelog-id').value;
    const build = document.getElementById('admin-build').value.trim();
    const subtitle = document.getElementById('admin-subtitle').value.trim();
    const date = document.getElementById('admin-date').value;

    if (!build) {
        showToast('Номер сборки обязателен');
        return;
    }

    const data = {
        build,
        subtitle,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        added: getAdminItems('added'),
        fixed: getAdminItems('fixed'),
        changed: getAdminItems('changed')
    };

    try {
        let response;
        if (id) {
            // Update
            response = await fetch(`${API_URL}/api/admin/changelog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            // Create
            response = await fetch(`${API_URL}/api/admin/changelog`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }

        if (response.ok) {
            showToast(id ? 'Изменение обновлено' : 'Изменение создано');
            closeAdminModal();
            await loadAdminChangelog();
            // Reload changelog page if it's visible
            if (document.getElementById('page-changelog').style.display !== 'none') {
                await loadChangelog();
            }
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка сохранения');
        }
    } catch (error) {
        showToast(`Ошибка: ${error.message}`);
    }
}

async function editChangelog(id) {
    const changelog = adminChangelogData.find(item => item.id === id);
    if (changelog) {
        openAdminModal(changelog);
    }
}

async function deleteChangelog(id) {
    if (!confirm('Вы уверены, что хотите удалить это изменение?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/changelog/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Изменение удалено');
            await loadAdminChangelog();
            // Reload changelog page if it's visible
            if (document.getElementById('page-changelog').style.display !== 'none') {
                await loadChangelog();
            }
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка удаления');
        }
    } catch (error) {
        showToast(`Ошибка: ${error.message}`);
    }
}

function setupAdminPage() {
    const addBtn = document.getElementById('admin-add-btn');
    const modal = document.getElementById('admin-changelog-modal');
    const closeBtn = document.getElementById('admin-modal-close');
    const cancelBtn = document.getElementById('admin-modal-cancel');
    const saveBtn = document.getElementById('admin-modal-save');

    if (addBtn) {
        addBtn.addEventListener('click', () => openAdminModal());
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeAdminModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAdminModal);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveChangelog);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAdminModal();
            }
        });
    }

    // Close on ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeAdminModal();
        }
    });
}

function setTodayDate() {
    const dateInput = document.getElementById('admin-date');
    if (!dateInput) return;
    
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    dateInput.value = localDate.toISOString().slice(0, 16);
}

// Make functions global for onclick handlers
window.addAdminItem = addAdminItem;
window.removeAdminItem = removeAdminItem;
window.editChangelog = editChangelog;
window.deleteChangelog = deleteChangelog;
window.setTodayDate = setTodayDate;

