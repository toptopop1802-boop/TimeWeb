// Auth API routes
const { generateToken, hashPassword, verifyPassword, requireAuth, requireAdmin } = require('./auth-middleware');

function setupAuthRoutes(app, supabase) {
    
    // Регистрация нового пользователя
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
}

module.exports = { setupAuthRoutes };

