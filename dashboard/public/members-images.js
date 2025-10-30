// Members and Images Hosting functionality

// ============================================
// MEMBERS PAGE
// ============================================

async function loadMembers() {
    const authData = getAuthData();
    if (!authData) return;

    try {
        const response = await fetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });

        const users = await response.json();
        
        // Store users globally for export
        window.allUsers = users;

        // Update stats
        document.getElementById('total-users').textContent = users.length;
        document.getElementById('total-admins').textContent = users.filter(u => u.role === 'admin').length;
        
        // Get registrations today
        const today = new Date().toISOString().split('T')[0];
        const registrationsToday = users.filter(u => u.created_at && u.created_at.startsWith(today)).length;
        document.getElementById('total-registrations-today').textContent = registrationsToday;

        // Render members list
        const membersList = document.getElementById('members-list');
        if (users.length === 0) {
            membersList.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:40px 0;">Нет пользователей</p>';
            return;
        }

        membersList.innerHTML = `
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:var(--bg-secondary);text-align:left;">
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">ID</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Имя пользователя</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Email</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Роль</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Дата регистрации</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Последний вход</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Статус</th>
                            <th style="padding:12px;border-bottom:1px solid var(--border-color);">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr style="border-bottom:1px solid var(--border-color);">
                                <td style="padding:12px;font-family:monospace;font-size:11px;color:var(--text-secondary);">${user.id.substring(0, 8)}...</td>
                                <td style="padding:12px;font-weight:600;">${user.username}</td>
                                <td style="padding:12px;color:var(--text-secondary);font-size:13px;">${user.email}</td>
                                <td style="padding:12px;">
                                    <span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;${user.role === 'admin' ? 'background:rgba(239,68,68,0.1);color:#ef4444;' : 'background:rgba(16,185,129,0.1);color:#10b981;'}">
                                        ${user.role === 'admin' ? 'Админ' : 'Пользователь'}
                                    </span>
                                </td>
                                <td style="padding:12px;color:var(--text-secondary);font-size:13px;">${new Date(user.created_at).toLocaleString('ru-RU')}</td>
                                <td style="padding:12px;color:var(--text-secondary);font-size:13px;">${user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : '-'}</td>
                                <td style="padding:12px;">
                                    <span style="padding:4px 12px;border-radius:12px;font-size:12px;font-weight:600;${user.is_active ? 'background:rgba(16,185,129,0.1);color:#10b981;' : 'background:rgba(160,160,160,0.1);color:#a0a0a0;'}">
                                        ${user.is_active ? 'Активен' : 'Неактивен'}
                                    </span>
                                </td>
                                <td style="padding:12px;">
                                    <button onclick="deleteUser('${user.id}', '${user.username}')" 
                                            style="padding:6px 12px;background:#dc3545;color:white;border:none;border-radius:6px;font-size:12px;cursor:pointer;transition:all 0.2s;"
                                            onmouseover="this.style.background='#c82333'" 
                                            onmouseout="this.style.background='#dc3545'"
                                            ${user.role === 'admin' ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                                        🗑️ Удалить
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // Add export button
        addExportButton();
    } catch (error) {
        console.error('Failed to load members:', error);
        document.getElementById('members-list').innerHTML = '<p style="text-align:center;color:var(--danger);padding:40px 0;">Ошибка загрузки</p>';
    }
}

// ============================================
// IMAGES HOSTING PAGE (localStorage)
// ============================================

function getLocalImagesHistory() {
    try {
        const history = localStorage.getItem('images_history');
        return history ? JSON.parse(history) : [];
    } catch (e) {
        console.error('Ошибка чтения истории изображений:', e);
        return [];
    }
}

function saveImageToLocalHistory(image) {
    try {
        const history = getLocalImagesHistory();
        history.unshift(image);
        const limited = history.slice(0, 200);
        localStorage.setItem('images_history', JSON.stringify(limited));
        console.log('💾 Изображение сохранено локально');
        return limited;
    } catch (e) {
        console.error('Ошибка сохранения:', e);
        return history;
    }
}

let uploadedImages = getLocalImagesHistory();

function setupImageHosting() {
    const dropZone = document.getElementById('image-drop');
    const fileInput = document.getElementById('image-input');

    if (!dropZone || !fileInput) return;

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-primary)';
        dropZone.style.background = 'rgba(59, 155, 249, 0.05)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        dropZone.style.background = '';
        
        const file = e.dataTransfer.files[0];
        if (file) uploadImage(file);
    });

    // File input
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) uploadImage(file);
    });
}

async function uploadImage(file) {
    const authData = getAuthData();
    if (!authData) {
        showToast('Требуется авторизация');
        return;
    }

    // Validate file
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Допустимы только изображения PNG/JPG/GIF/WebP');
        return;
    }

    if (file.size > 15 * 1024 * 1024) {
        showToast('Файл слишком большой (макс. 15MB)');
        return;
    }

    const progressDiv = document.getElementById('image-upload-progress');
    const progressFill = document.getElementById('image-progress-fill');
    const progressText = document.getElementById('image-progress-text');
    const resultDiv = document.getElementById('image-result');

    progressDiv.style.display = 'block';
    resultDiv.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('image', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percent + '%';
                progressText.textContent = `Загрузка: ${percent}%`;
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                showToast('✅ Изображение загружено!', 'success');
                
                // Generate all link formats
                const directUrl = response.directUrl;
                const pageUrl = directUrl; // Same as direct for our case
                const fileName = file.name || 'image';
                
                displayImageResult(directUrl, pageUrl, fileName);
                
                progressDiv.style.display = 'none';
                resultDiv.style.display = 'block';

                // Add to local history
                const newImage = {
                    id: response.id,
                    shortCode: response.shortCode,
                    directUrl: response.directUrl,
                    fileName: fileName,
                    uploadedAt: new Date().toISOString()
                };
                uploadedImages = saveImageToLocalHistory(newImage);
                renderImagesHistory();
            } else {
                const error = JSON.parse(xhr.responseText);
                throw new Error(error.error || 'Ошибка загрузки');
            }
        });

        xhr.addEventListener('error', () => {
            throw new Error('Ошибка соединения');
        });

        xhr.open('POST', `${API_URL}/api/images/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${authData.token}`);
        xhr.send(formData);
    } catch (error) {
        showToast(`Ошибка: ${error.message}`);
        progressDiv.style.display = 'none';
    }
}

function displayImageResult(directUrl, pageUrl, fileName) {
    const resultDiv = document.getElementById('image-result');
    
    // SVG Icons
    const copyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    
    const links = [
        { title: 'Прямая ссылка', value: directUrl, icon: '🔗' },
        { title: 'Markdown', value: `[${fileName}](${pageUrl})`, icon: '📝' },
        { title: 'Markdown с превью', value: `[![${fileName}](${directUrl})](${pageUrl})`, icon: '🖼️' },
        { title: 'BBCode для форумов', value: `[url=${pageUrl}][img]${directUrl}[/img][/url]`, icon: '💬' },
        { title: 'HTML', value: `<a href='${pageUrl}' target='_blank'><img src='${directUrl}' alt='${fileName}'></a>`, icon: '🌐' }
    ];
    
    resultDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <img id="image-preview" src="${directUrl}" style="max-width: 100%; max-height: 300px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        </div>
        
        ${links.map((link, idx) => `
            <div style="margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-weight: 600; color: var(--text-primary); font-size: 13px;">
                    <span>${link.icon}</span>
                    <span>${link.title}</span>
                </label>
                <div style="display: flex; gap: 8px;">
                    <input 
                        type="text" 
                        value="${link.value.replace(/"/g, '&quot;')}" 
                        readonly 
                        id="link-${idx}"
                        onclick="this.select()"
                        style="flex: 1; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: 'Consolas', 'Monaco', monospace; font-size: 12px; transition: all 0.2s;"
                        onfocus="this.style.borderColor='var(--accent-primary)'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';"
                        onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none';"
                    >
                    <button 
                        onclick="copyToClipboard('${link.value.replace(/'/g, "\\'")}', this)" 
                        style="padding: 10px 16px; background: var(--accent-primary); color: white; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 600; transition: all 0.2s;"
                        onmouseover="this.style.background='var(--accent-hover)'; this.style.transform='translateY(-1px)';"
                        onmouseout="this.style.background='var(--accent-primary)'; this.style.transform='translateY(0)';"
                    >
                        ${copyIcon}
                        <span>Копировать</span>
                    </button>
                </div>
            </div>
        `).join('')}
        
        <div style="margin-top: 24px; padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1)); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2);">
            <p style="margin: 0; color: var(--text-secondary); font-size: 13px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 18px;">✅</span>
                <span>Эти ссылки можно использовать где угодно - на других сайтах, в Discord, Telegram и т.д.</span>
            </p>
        </div>
    `;
}

function copyToClipboard(text, button) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showCopySuccess(button);
            });
        } else {
            document.execCommand('copy');
            showCopySuccess(button);
        }
    } catch (err) {
        showToast('Не удалось скопировать');
    } finally {
        document.body.removeChild(textarea);
    }
}

function showCopySuccess(button) {
    const originalHTML = button.innerHTML;
    button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>Скопировано!</span>`;
    button.style.background = '#10b981';
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.background = 'var(--accent-primary)';
    }, 2000);
    
    showToast('✅ Скопировано в буфер обмена!', 'success');
}

function copyImageUrl() {
    // Legacy function, kept for compatibility
    const input = document.getElementById('image-direct-url');
    if (!input) return;

    input.select();
    input.setSelectionRange(0, 99999);

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value);
        } else {
            document.execCommand('copy');
        }
        showToast('✅ Ссылка скопирована!', 'success');
    } catch (err) {
        showToast('Не удалось скопировать');
    }
}

function renderImagesHistory() {
    const listDiv = document.getElementById('images-list');
    if (!listDiv) return;

    if (uploadedImages.length === 0) {
        listDiv.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px 0;">Загрузите первое изображение<br><small style="font-size: 11px;">История хранится локально на вашем устройстве</small></p>';
        return;
    }

    const copyIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

    listDiv.innerHTML = uploadedImages.map((img, idx) => {
        const fileName = img.fileName || 'image';
        const directUrl = img.directUrl;
        
        return `
        <div style="background:var(--bg-secondary);border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="display:flex;gap:15px;margin-bottom:15px;">
                <img src="${directUrl}" 
                     style="width:100px;height:100px;object-fit:cover;border-radius:8px;cursor:pointer;transition:transform 0.2s;" 
                     onclick="window.open('${directUrl}', '_blank')"
                     onmouseover="this.style.transform='scale(1.05)'"
                     onmouseout="this.style.transform='scale(1)'">
                <div style="flex:1;">
                    <h4 style="margin:0 0 8px 0;color:var(--text-primary);font-size:14px;">${fileName}</h4>
                    <p style="color:var(--text-secondary);font-size:12px;margin:0 0 12px 0;">
                        📅 ${new Date(img.uploadedAt).toLocaleString('ru-RU')}
                    </p>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button onclick="copyToClipboard('${directUrl.replace(/'/g, "\\'")}', this)" 
                                style="padding:6px 12px;background:var(--accent-primary);color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;"
                                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                            ${copyIcon} Прямая ссылка
                        </button>
                        <button onclick="copyToClipboard('[${fileName}](${directUrl})', this)" 
                                style="padding:6px 12px;background:#6366f1;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;"
                                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                            ${copyIcon} Markdown
                        </button>
                        <button onclick="copyToClipboard('[url=${directUrl}][img]${directUrl}[/img][/url]', this)" 
                                style="padding:6px 12px;background:#8b5cf6;color:white;border:none;border-radius:6px;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px;"
                                onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                            ${copyIcon} BBCode
                        </button>
                    </div>
                </div>
            </div>
            <details style="margin-top:12px;">
                <summary style="cursor:pointer;color:var(--accent-primary);font-size:12px;padding:8px;background:var(--bg-card);border-radius:6px;user-select:none;">
                    📋 Показать все форматы
                </summary>
                <div style="margin-top:12px;padding:12px;background:var(--bg-card);border-radius:8px;font-family:monospace;font-size:11px;color:var(--text-secondary);">
                    <div style="margin-bottom:8px;">
                        <strong style="color:var(--text-primary);">Прямая ссылка:</strong><br>
                        <code style="word-break:break-all;">${directUrl}</code>
                    </div>
                    <div style="margin-bottom:8px;">
                        <strong style="color:var(--text-primary);">Markdown:</strong><br>
                        <code>[${fileName}](${directUrl})</code>
                    </div>
                    <div style="margin-bottom:8px;">
                        <strong style="color:var(--text-primary);">HTML:</strong><br>
                        <code style="word-break:break-all;">&lt;img src="${directUrl}" alt="${fileName}"&gt;</code>
                    </div>
                </div>
            </details>
        </div>
        `;
    }).join('');
}

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

function addExportButton() {
    const header = document.querySelector('#page-members .page-header');
    if (!header) return;
    
    // Check if button already exists
    if (document.getElementById('export-users-btn')) return;
    
    const exportBtn = document.createElement('button');
    exportBtn.id = 'export-users-btn';
    exportBtn.className = 'btn btn-primary';
    exportBtn.innerHTML = '📥 Экспорт пользователей';
    exportBtn.style.cssText = 'margin-left: 10px;';
    exportBtn.onclick = exportUsers;
    
    header.appendChild(exportBtn);
}

function exportUsers() {
    if (!window.allUsers || window.allUsers.length === 0) {
        showToast('Нет пользователей для экспорта');
        return;
    }
    
    // Prepare CSV data
    const headers = ['ID', 'Username', 'Email', 'Role', 'Created At', 'Last Login', 'Is Active'];
    const rows = window.allUsers.map(user => [
        user.id,
        user.username,
        user.email || '',
        user.role,
        new Date(user.created_at).toLocaleString('ru-RU'),
        user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : '-',
        user.is_active ? 'Да' : 'Нет'
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    // Create and download file
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`✅ Экспортировано ${window.allUsers.length} пользователей`, 'success');
}

async function deleteUser(userId, username) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?\n\nЭто действие нельзя отменить!`)) {
        return;
    }
    
    const authData = getAuthData();
    if (!authData) {
        showToast('Требуется авторизация');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authData.token}` }
        });
        
        if (response.ok) {
            showToast(`✅ Пользователь "${username}" удален`, 'success');
            // Reload members list
            loadMembers();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Ошибка удаления пользователя');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showToast(`❌ ${error.message}`);
    }
}

// Global exports
window.copyImageUrl = copyImageUrl;
window.copyToClipboard = copyToClipboard;
window.exportUsers = exportUsers;
window.deleteUser = deleteUser;

// Init on page load
document.addEventListener('DOMContentLoaded', () => {
    setupImageHosting();
    
    // Load members when page becomes visible
    const observer = new MutationObserver(() => {
        const membersPage = document.getElementById('page-members');
        if (membersPage && membersPage.style.display !== 'none') {
            loadMembers();
        }
    });
    
    const membersPage = document.getElementById('page-members');
    if (membersPage) {
        observer.observe(membersPage, { attributes: true, attributeFilter: ['style'] });
    }
});

