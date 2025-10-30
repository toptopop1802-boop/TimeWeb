// Auth API routes
const crypto = require('crypto');
const { generateToken, hashPassword, verifyPassword, requireAuth, requireAdmin } = require('./auth-middleware');

function setupAuthRoutes(app, supabase) {
    
    // Простая регистрация - только имя пользователя
    app.post('/api/auth/simple-register', async (req, res) => {
        try {
            const { username } = req.body;

            if (!username || username.trim().length < 2) {
                return res.status(400).json({ error: 'Имя должно быть минимум 2 символа' });
            }

            const cleanUsername = username.trim();

            // Проверяем существование пользователя с таким именем
            const { data: existing } = await supabase
                .from('users')
                .select('id, username, role')
                .eq('username', cleanUsername)
                .single();

            let user;
            
            if (existing) {
                // Если пользователь существует - входим
                user = existing;
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

                if (error) throw error;
                user = newUser;
                
                // Записываем аналитику регистрации
                await supabase
                    .from('user_registrations')
                    .insert({
                        user_id: user.id,
                        username: user.username,
                        ip_address: req.ip,
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
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
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
            console.error('Simple register error:', error);
            res.status(500).json({ error: error.message });
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
                    ip_address: req.ip,
                    user_agent: req.headers['user-agent']
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
                    ip_address: req.ip,
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
                    ip_address: req.ip,
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
                    ip_address: req.ip,
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

