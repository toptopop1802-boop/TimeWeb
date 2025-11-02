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
    
    // Discord OAuth callback handler
    app.get('/signin-discord', async (req, res) => {
        try {
            const { code, error } = req.query;
            
            if (error) {
                console.error('❌ Discord OAuth error:', error);
                return res.redirect('/login.html?error=discord_auth_failed');
            }
            
            if (!code) {
                return res.redirect('/login.html?error=no_code');
            }
            
            const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
            const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
            const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://bublickrust.ru/signin-discord';
            
            if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
                console.error('❌ Discord OAuth credentials not configured');
                return res.redirect('/login.html?error=discord_not_configured');
            }
            
            // Обмениваем код на access token
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: DISCORD_CLIENT_ID,
                    client_secret: DISCORD_CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI,
                }),
            });
            
            if (!tokenResponse.ok) {
                const errorText = await tokenResponse.text();
                console.error('❌ Discord token exchange failed:', errorText);
                return res.redirect('/login.html?error=token_exchange_failed');
            }
            
            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;
            
            // Получаем данные пользователя из Discord
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            
            if (!userResponse.ok) {
                const errorText = await userResponse.text();
                console.error('❌ Discord user fetch failed:', errorText);
                return res.redirect('/login.html?error=user_fetch_failed');
            }
            
            const discordUser = await userResponse.json();
            
            // Проверяем существование пользователя по Discord ID
            let { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('*')
                .eq('discord_id', discordUser.id)
                .maybeSingle();
            
            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Database check error:', checkError);
                return res.redirect('/login.html?error=database_error');
            }
            
            let user;
            
            if (existingUser) {
                // Пользователь существует - обновляем данные Discord
                const { data: updatedUser, error: updateError } = await supabase
                    .from('users')
                    .update({
                        discord_username: discordUser.username,
                        discord_avatar: discordUser.avatar,
                        last_login: new Date().toISOString(),
                    })
                    .eq('id', existingUser.id)
                    .select()
                    .single();
                
                if (updateError) {
                    console.error('❌ Failed to update user:', updateError);
                    user = existingUser; // Используем существующие данные
                } else {
                    user = updatedUser;
                }
                
                console.log('✅ Existing Discord user logged in:', discordUser.username);
            } else {
                // Проверяем, есть ли пользователь с таким email (если он был создан через простую регистрацию)
                // Пытаемся найти пользователя по email или username
                const { data: existingLocalUser } = await supabase
                    .from('users')
                    .select('*')
                    .or(`email.eq.discord_${discordUser.id}@discord.user,username.eq.${discordUser.username}`)
                    .maybeSingle();
                
                if (existingLocalUser && !existingLocalUser.discord_id) {
                    // Найден существующий пользователь без Discord ID - привязываем Discord
                    const { data: updatedUser, error: updateError } = await supabase
                        .from('users')
                        .update({
                            discord_id: discordUser.id,
                            discord_username: discordUser.username,
                            discord_avatar: discordUser.avatar,
                            last_login: new Date().toISOString(),
                        })
                        .eq('id', existingLocalUser.id)
                        .select()
                        .single();
                    
                    if (updateError) {
                        console.error('❌ Failed to link Discord to existing user:', updateError);
                        // Продолжаем создавать нового пользователя
                    } else {
                        user = updatedUser;
                        console.log('✅ Discord linked to existing user:', existingLocalUser.username);
                        
                        // Создаем сессию
                        const token = generateToken();
                        const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                        
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
                                    login_type: 'discord_oauth_linked'
                                }
                            });
                        
                        return res.redirect(`/?discord_token=${token}`);
                    }
                }
                
                // Пользователь не существует - создаем нового
                const discordUsername = discordUser.username || `discord_${discordUser.id}`;
                const uniqueEmail = `discord_${discordUser.id}@discord.user`;
                
                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert({
                        username: discordUsername,
                        email: uniqueEmail,
                        password_hash: '', // Пустой хеш для Discord пользователей
                        role: 'user',
                        discord_id: discordUser.id,
                        discord_username: discordUser.username,
                        discord_avatar: discordUser.avatar,
                    })
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('❌ Failed to create Discord user:', insertError);
                    return res.redirect('/login.html?error=user_creation_failed');
                }
                
                user = newUser;
                
                console.log('✅ New Discord user created:', discordUser.username);
                
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
                        user_agent: req.headers['user-agent'],
                        login_type: 'discord_oauth'
                    }
                });
            
            // Редиректим на главную страницу с токеном в URL (который будет сохранен в localStorage)
            return res.redirect(`/?discord_token=${token}`);
        } catch (error) {
            console.error('❌ Discord OAuth error:', error);
            return res.redirect('/login.html?error=oauth_error');
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
                    created_at: req.user.created_at,
                    discord_id: req.user.discord_id || null,
                    discord_username: req.user.discord_username || null,
                    discord_avatar: req.user.discord_avatar || null
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

    // ============================================
    // TOURNAMENT APPLICATIONS API
    // ============================================
    
    // Подать заявку на турнир
    app.post('/api/tournament/apply', async (req, res) => {
        await requireAuth(req, res, async () => {
            try {
                const { steamId } = req.body;
                
                if (!steamId || !steamId.trim()) {
                    return res.status(400).json({ error: 'Steam ID обязателен' });
                }
                
                // Проверка, что Steam ID содержит только цифры
                if (!/^\d+$/.test(steamId.trim())) {
                    return res.status(400).json({ error: 'Steam ID должен содержать только цифры' });
                }
                
                // Проверяем, что пользователь авторизован через Discord
                if (!req.user.discord_id) {
                    return res.status(400).json({ error: 'Требуется авторизация через Discord' });
                }
                
                // Проверяем, есть ли уже заявка
                const { data: existingApp } = await supabase
                    .from('tournament_applications')
                    .select('*')
                    .eq('discord_id', req.user.discord_id)
                    .maybeSingle();
                
                if (existingApp) {
                    return res.status(400).json({ error: 'Вы уже подали заявку на турнир' });
                }
                
                // Проверяем, открыта ли регистрация
                const { data: settings } = await supabase
                    .from('tournament_registration_settings')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (settings && !settings.is_open) {
                    const closesAt = settings.closes_at;
                    if (closesAt) {
                        const closeTime = new Date(closesAt);
                        if (new Date() >= closeTime) {
                            return res.status(400).json({ error: 'Регистрация на турнир закрыта' });
                        }
                    } else {
                        return res.status(400).json({ error: 'Регистрация на турнир закрыта' });
                    }
                }
                
                // Отправляем заявку боту через HTTP API (опционально)
                const API_SECRET = process.env.API_SECRET || 'bublickrust';
                const API_PORT = process.env.API_PORT || '8787';
                const API_HOST = process.env.API_HOST || '127.0.0.1'; // Используем 127.0.0.1 вместо localhost для надежности
                
                console.log(`🔗 [Tournament Application] Attempting to connect to bot at http://${API_HOST}:${API_PORT}/api/tournament-application`);
                
                let botData = null;
                try {
                    // Используем AbortController для таймаута
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
                    
                    const botResponse = await fetch(`http://${API_HOST}:${API_PORT}/api/tournament-application`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${API_SECRET}`
                        },
                        body: JSON.stringify({
                            userId: req.user.id,
                            discordId: req.user.discord_id,
                            discordUsername: req.user.discord_username || req.user.username,
                            steamId: steamId.trim()
                        }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    console.log(`📥 [Tournament Application] Bot response status: ${botResponse.status}`);
                    
                    if (botResponse.ok) {
                        botData = await botResponse.json();
                        console.log(`✅ [Tournament Application] Bot accepted application: ${JSON.stringify(botData)}`);
                    } else {
                        const errorText = await botResponse.text();
                        console.warn(`⚠️ [Tournament Application] Bot API returned error ${botResponse.status}: ${errorText}`);
                        // Продолжаем без бота, сохраняем в БД
                    }
                } catch (botError) {
                    if (botError.name === 'AbortError') {
                        console.warn('⏱️ [Tournament Application] Bot API timeout (5s), сохраняем заявку только в БД');
                    } else {
                        console.warn(`❌ [Tournament Application] Bot API недоступен: ${botError.message}, сохраняем заявку только в БД`);
                    }
                    // Продолжаем без бота, сохраняем в БД
                }
                
                // Сохраняем заявку в БД
                const { data: application, error: appError } = await supabase
                    .from('tournament_applications')
                    .insert({
                        user_id: req.user.id,
                        discord_id: req.user.discord_id,
                        steam_id: steamId.trim(),
                        status: 'pending'
                    })
                    .select()
                    .single();
                
                if (appError) {
                    console.error('Database insert error:', appError);
                    // Если не удалось сохранить в БД, но бот получил заявку - это нормально
                    if (botData && botData.success) {
                        return res.json({
                            success: true,
                            message: 'Заявка успешно подана в Discord',
                            application: { id: botData.messageId }
                        });
                    }
                    // Если и БД, и бот недоступны - ошибка
                    return res.status(500).json({ 
                        error: 'Не удалось сохранить заявку. Попробуйте позже.' 
                    });
                }
                
                // Если заявка сохранена в БД, но бот недоступен - это нормально
                // Заявка будет отправлена в Discord позже (можно добавить cron job)
                res.json({
                    success: true,
                    message: botData ? 'Заявка успешно подана' : 'Заявка сохранена. Отправка в Discord будет выполнена позже.',
                    application: application || { id: botData?.messageId }
                });
            } catch (error) {
                console.error('Tournament application error:', error);
                res.status(500).json({ error: error.message });
            }
        }, supabase);
    });
    
    // Проверить статус заявки пользователя
    app.get('/api/tournament/status', async (req, res) => {
        await requireAuth(req, res, async () => {
            try {
                // Проверяем заявку пользователя
                const { data: application } = await supabase
                    .from('tournament_applications')
                    .select('*')
                    .eq('discord_id', req.user.discord_id)
                    .maybeSingle();
                
                // Проверяем настройки регистрации
                const { data: settings } = await supabase
                    .from('tournament_registration_settings')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                const isOpen = settings ? settings.is_open : true;
                let closesAt = settings?.closes_at || null;
                
                // Проверяем, не истекло ли время закрытия
                if (closesAt && isOpen) {
                    const closeTime = new Date(closesAt);
                    if (new Date() >= closeTime) {
                        closesAt = null; // Время истекло
                    }
                }
                
                res.json({
                    hasApplication: !!application,
                    application: application || null,
                    registrationOpen: isOpen && (!closesAt || new Date() < new Date(closesAt)),
                    closesAt: closesAt
                });
            } catch (error) {
                console.error('Get tournament status error:', error);
                res.status(500).json({ error: error.message });
            }
        }, supabase);
    });
    
    // Получить все заявки (только для админа)
    app.get('/api/tournament/applications', async (req, res) => {
        await requireAuth(req, res, async () => {
            requireAdmin(req, res, async () => {
                try {
                    const { status } = req.query;
                    
                    let query = supabase
                        .from('tournament_applications')
                        .select(`
                            *,
                            users:user_id (
                                id,
                                username,
                                email,
                                discord_username,
                                discord_avatar
                            )
                        `)
                        .order('created_at', { ascending: false });
                    
                    if (status) {
                        query = query.eq('status', status);
                    }
                    
                    const { data: applications, error } = await query;
                    
                    if (error) throw error;
                    
                    res.json({ applications: applications || [] });
                } catch (error) {
                    console.error('Get tournament applications error:', error);
                    res.status(500).json({ error: error.message });
                }
            });
        }, supabase);
    });
    
    // Управление настройками регистрации (только для админа)
    app.post('/api/tournament/settings', async (req, res) => {
        await requireAuth(req, res, async () => {
            requireAdmin(req, res, async () => {
                try {
                    const { isOpen, closesAt } = req.body;
                    
                    if (typeof isOpen !== 'boolean') {
                        return res.status(400).json({ error: 'isOpen должен быть boolean' });
                    }
                    
                    const { data: settings, error } = await supabase
                        .from('tournament_registration_settings')
                        .insert({
                            is_open: isOpen,
                            closes_at: closesAt || null
                        })
                        .select()
                        .single();
                    
                    if (error) throw error;
                    
                    res.json({ success: true, settings });
                } catch (error) {
                    console.error('Update tournament settings error:', error);
                    res.status(500).json({ error: error.message });
                }
            });
        }, supabase);
    });
    
    // Получить настройки регистрации (для админа)
    app.get('/api/tournament/settings', async (req, res) => {
        await requireAuth(req, res, async () => {
            requireAdmin(req, res, async () => {
                try {
                    const { data: settings } = await supabase
                        .from('tournament_registration_settings')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    
                    res.json({ settings: settings || { is_open: true, closes_at: null } });
                } catch (error) {
                    console.error('Get tournament settings error:', error);
                    res.status(500).json({ error: error.message });
                }
            });
        }, supabase);
    });
}

module.exports = { setupAuthRoutes };

