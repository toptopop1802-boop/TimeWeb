// Auth API routes
const crypto = require('crypto');
const { generateToken, hashPassword, verifyPassword, requireAuth, requireAdmin } = require('./auth-middleware');

// Функция для получения реального IP адреса
function getRealIP(req) {
    // Проверяем заголовки прокси в порядке приоритета
    return req.headers['x-real-ip'] || 
           req.headers['x-forwarded-for']?.split(',')[0].trim() || 
           req.headers['cf-connecting-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           'unknown';
}

function setupAuthRoutes(app, supabase) {
    
    // Discord OAuth callback
    app.get('/signin-discord', async (req, res) => {
        try {
            const { code, state } = req.query;

            if (!code) {
                return res.redirect('/login.html?error=discord_auth_failed');
            }

            // Exchange code for access token
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: '1250017421121556510',
                    client_secret: process.env.DISCORD_CLIENT_SECRET || '',
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: 'http://figma.rustremote.com/signin-discord',
                }),
            });

            if (!tokenResponse.ok) {
                console.error('Discord token exchange failed:', await tokenResponse.text());
                return res.redirect('/login.html?error=discord_token_failed');
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // Get user info from Discord
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!userResponse.ok) {
                console.error('Discord user fetch failed:', await userResponse.text());
                return res.redirect('/login.html?error=discord_user_failed');
            }

            const discordUser = await userResponse.json();

            // Check if user exists in database
            let { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', `${discordUser.id}@discord.user`)
                .or(`username.eq.${discordUser.username}`)
                .maybeSingle();

            let user;

            if (existingUser) {
                // Update existing user with Discord info
                const { data: updatedUser, error: updateError } = await supabase
                    .from('users')
                    .update({
                        username: discordUser.username,
                        email: `${discordUser.id}@discord.user`,
                        last_login: new Date().toISOString()
                    })
                    .eq('id', existingUser.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                user = updatedUser;
            } else {
                // Create new user from Discord
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert({
                        username: discordUser.username,
                        email: `${discordUser.id}@discord.user`,
                        password_hash: '', // No password for Discord users
                        role: 'user',
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                user = newUser;

                // Log registration
                await supabase
                    .from('user_registrations')
                    .insert({
                        user_id: user.id,
                        username: user.username,
                        ip_address: getRealIP(req),
                        user_agent: req.headers['user-agent']
                    });
            }

            // Create session
            const token = generateToken();
            const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

            await supabase
                .from('sessions')
                .insert({
                    user_id: user.id,
                    token,
                    expires_at: expires_at.toISOString(),
                    ip_address: getRealIP(req),
                    user_agent: req.headers['user-agent']
                });

            // Log login action
            await supabase
                .from('user_actions')
                .insert({
                    user_id: user.id,
                    action_type: 'login',
                    action_details: {
                        ip_address: getRealIP(req),
                        user_agent: req.headers['user-agent'],
                        login_type: 'discord'
                    }
                });

            // Redirect to main page with token
            res.redirect(`/?token=${token}`);
        } catch (error) {
            console.error('Discord OAuth error:', error);
            res.redirect('/login.html?error=discord_error');
        }
    });

    // Простая регистрация - только имя пользователя
    app.post('/api/auth/simple-register', async (req, res) => {
        try {
            const { username } = req.body;

            if (!username || username.trim().length < 2) {
                return res.status(400).json({ error: 'Имя должно быть минимум 2 символа' });
            }

            const cleanUsername = username.trim();

            // Проверяем существование пользователя с таким именем
            const { data: existing, error: checkError } = await supabase
                .from('users')
                .select('id, username, role, password_hash')
                .eq('username', cleanUsername)
                .maybeSingle(); // maybeSingle не выдаёт ошибку если не найдено

            // PGRST116 = not found - это норма
            if (checkError) {
                console.error('❌ Database check error:', checkError);
                console.error('   Code:', checkError.code);
                console.error('   Message:', checkError.message);
                
                // Если это не "not found" ошибка - возвращаем 500
                if (checkError.code && checkError.code !== 'PGRST116') {
                    return res.status(500).json({ 
                        error: 'Ошибка базы данных: ' + (checkError.message || 'Неизвестная ошибка')
                    });
                }
            }

            let user;
            
            if (existing) {
                // Если пользователь существует И у него есть пароль (не пустой) - требуем админ вход
                if (existing.password_hash && existing.password_hash.trim().length > 0) {
                    console.log('⚠️  User exists with password:', cleanUsername);
                    return res.status(400).json({ 
                        error: 'Это имя уже занято. Используйте другое имя или войдите через "Вход для админа".',
                        requiresPassword: true
                    });
                }
                // Если пароль пустой - это гостевой пользователь, можно войти
                user = existing;
                console.log('✅ Existing guest user logged in:', cleanUsername);
            } else {
                // Создаем нового пользователя
                const uniqueEmail = `${cleanUsername}-${Date.now()}@local.user`;
                const { data: newUser, error } = await supabase
                    .from('users')
                    .insert({
                        username: cleanUsername,
                        email: uniqueEmail,
                        password_hash: '', // Пустой хеш для простых пользователей
                        role: 'user'
                    })
                    .select()
                    .single();

                if (error) {
                    console.error('❌ Insert error:', error);
                    // Если дубликат username - значит race condition
                    if (error.code === '23505' && error.message.includes('users_username_key')) {
                        return res.status(400).json({ 
                            error: 'Это имя уже занято. Попробуйте другое имя.'
                        });
                    }
                    throw error;
                }
                user = newUser;
                
                console.log('✅ New user created:', cleanUsername);
                
                // Записываем аналитику регистрации
                await supabase
                    .from('user_registrations')
                    .insert({
                        user_id: user.id,
                        username: user.username,
                        ip_address: getRealIP(req),
                        user_agent: req.headers['user-agent']
                    });
            }

            // Создаем сессию
            const token = generateToken();
            const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

            await supabase
                .from('sessions')
                .insert({
                    user_id: user.id,
                    token,
                    expires_at: expires_at.toISOString(),
                    ip_address: getRealIP(req),
                    user_agent: req.headers['user-agent']
                });

            // Log login action
            await supabase
                .from('user_actions')
                .insert({
                    user_id: user.id,
                    action_type: 'login',
                    action_details: {
                        ip_address: getRealIP(req),
                        user_agent: req.headers['user-agent']
                    }
                });

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('❌ Simple register error:', error);
            console.error('   Error code:', error.code);
            console.error('   Error message:', error.message);
            console.error('   Error details:', error.details);
            res.status(500).json({ error: error.message || 'Ошибка сервера' });
        }
    });
    
    // Админ-логин (bublick / fufel52)
    app.post('/api/auth/admin-login', async (req, res) => {
        try {
            const { username, password } = req.body;

            // Hardcoded admin credentials
            if (username !== 'bublick' || password !== 'fufel52') {
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            // Находим или создаем админа в БД
            let { data: admin } = await supabase
                .from('users')
                .select('*')
                .or('username.eq.bublick,email.eq.admin@bublickrust.ru')
                .eq('role', 'admin')
                .single();

            if (!admin) {
                // Создаем админа если его нет
                const password_hash = await hashPassword('fufel52');
                
                const { data: newAdmin, error } = await supabase
                    .from('users')
                    .insert({
                        username: 'bublick',
                        email: 'admin@bublickrust.ru',
                        password_hash,
                        role: 'admin'
                    })
                    .select()
                    .single();

                if (error) throw error;
                admin = newAdmin;
            }

            // Обновляем last_login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', admin.id);

            // Создаем сессию
            const token = generateToken();
            const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await supabase
                .from('sessions')
                .insert({
                    user_id: admin.id,
                    token,
                    expires_at: expires_at.toISOString(),
                    ip_address: getRealIP(req),
                    user_agent: req.headers['user-agent']
                });

            // Log login action
            await supabase
                .from('user_actions')
                .insert({
                    user_id: admin.id,
                    action_type: 'login',
                    action_details: {
                        ip_address: getRealIP(req),
                        user_agent: req.headers['user-agent'],
                        login_type: 'admin'
                    }
                });

            res.json({
                success: true,
                token,
                user: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    role: admin.role
                }
            });
        } catch (error) {
            console.error('Admin login error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // Регистрация нового пользователя (старый метод, оставляем для совместимости)
    app.post('/api/auth/register', async (req, res) => {
        try {
            const { username, email, password } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Все поля обязательны' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
            }

            // Проверяем существование пользователя
            const { data: existing } = await supabase
                .from('users')
                .select('id')
                .or(`username.eq.${username},email.eq.${email}`)
                .single();

            if (existing) {
                return res.status(400).json({ error: 'Пользователь уже существует' });
            }

            // Хешируем пароль
            const password_hash = await hashPassword(password);

            // Создаем пользователя
            const { data: user, error } = await supabase
                .from('users')
                .insert({
                    username,
                    email,
                    password_hash,
                    role: 'user'
                })
                .select()
                .single();

            if (error) throw error;

            // Создаем сессию
            const token = generateToken();
            const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

            await supabase
                .from('sessions')
                .insert({
                    user_id: user.id,
                    token,
                    expires_at: expires_at.toISOString(),
                    ip_address: getRealIP(req),
                    user_agent: req.headers['user-agent']
                });

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Вход
    app.post('/api/auth/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Логин и пароль обязательны' });
            }

            // Находим пользователя
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('is_active', true)
                .single();

            if (error || !user) {
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            // Проверяем пароль
            const isValid = await verifyPassword(password, user.password_hash);

            if (!isValid) {
                return res.status(401).json({ error: 'Неверный логин или пароль' });
            }

            // Обновляем last_login
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', user.id);

            // Создаем сессию
            const token = generateToken();
            const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней

            await supabase
                .from('sessions')
                .insert({
                    user_id: user.id,
                    token,
                    expires_at: expires_at.toISOString(),
                    ip_address: getRealIP(req),
                    user_agent: req.headers['user-agent']
                });

            // Log login action
            await supabase
                .from('user_actions')
                .insert({
                    user_id: user.id,
                    action_type: 'login',
                    action_details: {
                        ip_address: getRealIP(req),
                        user_agent: req.headers['user-agent']
                    }
                });

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Гостевой вход (без регистрации)
    app.post('/api/auth/guest', async (req, res) => {
        try {
            // Создаем временного гостевого пользователя
            const guestUsername = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const guestEmail = `${guestUsername}@guest.local`;
            const guestPassword = crypto.randomBytes(32).toString('hex');
            
            const password_hash = await hashPassword(guestPassword);

            // Создаем гостевого пользователя в БД
            const { data: user, error } = await supabase
                .from('users')
                .insert({
                    username: guestUsername,
                    email: guestEmail,
                    password_hash,
                    role: 'user'
                })
                .select()
                .single();

            if (error) throw error;

            // Создаем сессию
            const token = generateToken();
            const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа для гостей

            await supabase
                .from('sessions')
                .insert({
                    user_id: user.id,
                    token,
                    expires_at: expires_at.toISOString(),
                    ip_address: getRealIP(req),
                    user_agent: req.headers['user-agent']
                });

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                }
            });
        } catch (error) {
            console.error('Guest login error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Выход
    app.post('/api/auth/logout', async (req, res) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');

            if (token) {
                await supabase
                    .from('sessions')
                    .delete()
                    .eq('token', token);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить текущего пользователя
    app.get('/api/auth/me', async (req, res) => {
        await requireAuth(req, res, async () => {
            res.json({
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    email: req.user.email,
                    role: req.user.role,
                    created_at: req.user.created_at
                }
            });
        }, supabase);
    });

    // Изменить пароль
    app.post('/api/auth/change-password', async (req, res) => {
        await requireAuth(req, res, async () => {
            try {
                const { old_password, new_password } = req.body;

                if (!old_password || !new_password) {
                    return res.status(400).json({ error: 'Все поля обязательны' });
                }

                if (new_password.length < 6) {
                    return res.status(400).json({ error: 'Новый пароль должен быть минимум 6 символов' });
                }

                // Проверяем старый пароль
                const isValid = await verifyPassword(old_password, req.user.password_hash);

                if (!isValid) {
                    return res.status(401).json({ error: 'Неверный текущий пароль' });
                }

                // Хешируем новый пароль
                const password_hash = await hashPassword(new_password);

                // Обновляем пароль
                await supabase
                    .from('users')
                    .update({ password_hash })
                    .eq('id', req.user.id);

                res.json({ success: true, message: 'Пароль успешно изменен' });
            } catch (error) {
                console.error('Change password error:', error);
                res.status(500).json({ error: error.message });
            }
        }, supabase);
    });

    // Список пользователей (только для админа)
    app.get('/api/admin/users', async (req, res) => {
        await requireAuth(req, res, async () => {
            requireAdmin(req, res, async () => {
                try {
                    const { data: users, error } = await supabase
                        .from('users')
                        .select('id, username, email, role, created_at, last_login, is_active')
                        .order('created_at', { ascending: false });

                    if (error) throw error;

                    res.json(users);
                } catch (error) {
                    console.error('List users error:', error);
                    res.status(500).json({ error: error.message });
                }
            });
        }, supabase);
    });

    // Удалить пользователя (только для админа)
    app.delete('/api/admin/users/:userId', async (req, res) => {
        await requireAuth(req, res, async () => {
            requireAdmin(req, res, async () => {
                try {
                    const { userId } = req.params;

                    // Проверяем что пользователь существует и не является админом
                    const { data: user, error: fetchError } = await supabase
                        .from('users')
                        .select('id, username, role')
                        .eq('id', userId)
                        .single();

                    if (fetchError || !user) {
                        return res.status(404).json({ error: 'Пользователь не найден' });
                    }

                    if (user.role === 'admin') {
                        return res.status(403).json({ error: 'Нельзя удалить администратора' });
                    }

                    // Удаляем пользователя
                    const { error: deleteError } = await supabase
                        .from('users')
                        .delete()
                        .eq('id', userId);

                    if (deleteError) throw deleteError;

                    console.log(`✅ User deleted by admin: ${user.username} (${userId})`);
                    res.json({ success: true, message: 'Пользователь удален' });
                } catch (error) {
                    console.error('Delete user error:', error);
                    res.status(500).json({ error: error.message });
                }
            });
        }, supabase);
    });
    
    // Получить статистику текущего пользователя
    app.get('/api/user/stats', async (req, res) => {
        await requireAuth(req, res, async () => {
            try {
                // Получаем количество действий пользователя
                const { count: actionsCount } = await supabase
                    .from('user_actions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', req.user.id);

                // Получаем количество входов
                const { count: loginsCount } = await supabase
                    .from('user_actions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', req.user.id)
                    .eq('action_type', 'login');

                res.json({
                    actions: actionsCount || 0,
                    logins: loginsCount || 0
                });
            } catch (error) {
                console.error('Get user stats error:', error);
                res.status(500).json({ error: error.message });
            }
        }, supabase);
    });

    // Получить действия текущего пользователя
    app.get('/api/user/actions', async (req, res) => {
        await requireAuth(req, res, async () => {
            try {
                const { data: actions, error } = await supabase
                    .from('user_actions')
                    .select('*')
                    .eq('user_id', req.user.id)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (error) throw error;

                res.json(actions || []);
            } catch (error) {
                console.error('Get user actions error:', error);
                res.status(500).json({ error: error.message });
            }
        }, supabase);
    });
}

module.exports = { setupAuthRoutes };

