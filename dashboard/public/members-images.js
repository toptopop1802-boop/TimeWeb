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
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load members:', error);
        document.getElementById('members-list').innerHTML = '<p style="text-align:center;color:var(--danger);padding:40px 0;">Ошибка загрузки</p>';
    }
}

// ============================================
// IMAGES HOSTING PAGE
// ============================================

let uploadedImages = [];

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
                
                // Show result
                const preview = document.getElementById('image-preview');
                const urlInput = document.getElementById('image-direct-url');
                
                preview.src = response.directUrl;
                urlInput.value = response.directUrl;
                
                progressDiv.style.display = 'none';
                resultDiv.style.display = 'block';

                // Add to history
                uploadedImages.unshift({
                    id: response.id,
                    shortCode: response.shortCode,
                    directUrl: response.directUrl,
                    uploadedAt: new Date().toISOString()
                });
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

function copyImageUrl() {
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
        listDiv.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:40px 0;">Загрузите первое изображение</p>';
        return;
    }

    listDiv.innerHTML = uploadedImages.map(img => `
        <div style="background:var(--bg-secondary);border-radius:12px;padding:15px;margin-bottom:15px;display:flex;gap:15px;align-items:center;">
            <img src="${img.directUrl}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;">
            <div style="flex:1;">
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
                    <input type="text" value="${img.directUrl}" readonly style="flex:1;padding:8px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:6px;color:var(--text-primary);font-family:monospace;font-size:12px;">
                    <button class="btn btn-sm" onclick="copyToClipboard('${img.directUrl}')" style="padding:8px 16px;">📋</button>
                </div>
                <p style="color:var(--text-secondary);font-size:12px;margin:0;">Загружено: ${new Date(img.uploadedAt).toLocaleString('ru-RU')}</p>
            </div>
        </div>
    `).join('');
}

function copyToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
        } else {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        showToast('✅ Скопировано!', 'success');
    } catch (err) {
        showToast('Не удалось скопировать');
    }
}

// Global exports
window.copyImageUrl = copyImageUrl;
window.copyToClipboard = copyToClipboard;

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

