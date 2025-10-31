const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Client, GatewayIntentBits } = require('discord.js');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cookieParser = require('cookie-parser');
let sharp = null; try { sharp = require('sharp'); } catch (_) { /* optional */ }
require('dotenv').config();

const { setupAuthRoutes } = require('./auth-routes');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const PORT = process.env.PORT || 3000;
const IS_SERVERLESS = !!process.env.VERCEL;
const GALLERY_PATH = process.env.GALLERY_PATH || '/gallery-images-bublick';

function createApp() {
    const app = express();

    // CORS middleware для всех запросов (в том числе для Figma Plugin)
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        
        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        
        next();
    });

    // Middleware
    app.use(cookieParser());

    // Configure multer for file uploads (memory storage for serverless)
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 100 * 1024 * 1024 // 100MB limit
        },
        fileFilter: (req, file, cb) => {
            if (path.extname(file.originalname).toLowerCase() === '.map') {
                cb(null, true);
            } else {
                cb(new Error('Только файлы .map разрешены'));
            }
        }
    });

    // =====================
    // Public Image Hosting
    // =====================
    const imageUpload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 15 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const ok = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
            cb(ok ? null : new Error('Допустимы только изображения PNG/JPG/GIF/WebP'), ok);
        }
    });

    // GET endpoint for upload info - HTML page
    app.get('/api/images/upload', (req, res) => {
        res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Upload API - Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, rgba(196,5,82,0.1) 0%, rgba(228,115,92,0.1) 100%), #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
        }
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
                linear-gradient(0deg, rgba(0,0,0,0.02) 1px, transparent 1px) repeat-y,
                linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px) repeat-x;
            background-size: 24px 24px;
            z-index: 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.98);
            border-radius: 20px;
            border: 1px solid rgba(196,5,82,0.1);
            box-shadow: 0 10px 40px rgba(196,5,82,0.08), 0 2px 8px rgba(0,0,0,0.04);
            padding: 50px;
            max-width: 700px;
            width: 100%;
            position: relative;
            z-index: 1;
        }
        .status {
            text-align: center;
            margin-bottom: 40px;
        }
        .status-icon {
            font-size: 72px;
            margin-bottom: 15px;
            animation: pulse 2s infinite;
            filter: drop-shadow(0 4px 8px rgba(40,167,69,0.3));
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        h1 {
            color: #212529;
            margin-bottom: 12px;
            font-size: 32px;
            font-weight: 700;
        }
        .subtitle {
            color: #6c757d;
            font-size: 18px;
            margin-bottom: 20px;
        }
        .subtitle strong {
            color: #28a745;
            font-weight: 700;
        }
        .info-card {
            background: #f8f9fa;
            border-left: 4px solid #c40552;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #dee2e6;
        }
        .info-row:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #495057;
            font-size: 15px;
        }
        .value {
            color: #c40552;
            font-weight: 600;
            font-size: 15px;
        }
        .formats {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .format-tag {
            background: linear-gradient(135deg, #c40552, #e4735c);
            color: white;
            padding: 6px 14px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 6px rgba(196,5,82,0.25);
        }
        .example-code {
            background: #2d3748;
            color: #68d391;
            padding: 20px;
            border-radius: 12px;
            font-family: 'Courier New', Consolas, monospace;
            font-size: 13px;
            line-height: 1.6;
            overflow-x: auto;
            margin-top: 25px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .back-btn {
            display: inline-block;
            margin-top: 30px;
            padding: 14px 28px;
            background: linear-gradient(135deg, #c40552, #e4735c);
            color: white;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(196,5,82,0.3);
        }
        .back-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(196,5,82,0.4);
        }
        .back-btn:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status">
            <div class="status-icon">✅</div>
            <h1>Image Upload API</h1>
            <div class="subtitle">Статус: <strong>РАБОТАЕТ</strong></div>
        </div>

        <div class="info-card">
            <div class="info-row">
                <span class="label">Метод:</span>
                <span class="value">POST</span>
            </div>
            <div class="info-row">
                <span class="label">Endpoint:</span>
                <span class="value">/api/images/upload</span>
            </div>
            <div class="info-row">
                <span class="label">Авторизация:</span>
                <span class="value">Bearer Token</span>
            </div>
            <div class="info-row">
                <span class="label">Поле формы:</span>
                <span class="value">image</span>
            </div>
            <div class="info-row">
                <span class="label">Макс. размер:</span>
                <span class="value">15 MB</span>
            </div>
            <div class="info-row">
                <span class="label">Форматы:</span>
                <div class="formats">
                    <span class="format-tag">PNG</span>
                    <span class="format-tag">JPG</span>
                    <span class="format-tag">JPEG</span>
                    <span class="format-tag">GIF</span>
                    <span class="format-tag">WebP</span>
                </div>
            </div>
        </div>

        <div class="example-code">
curl -X POST https://bublickrust.ru/api/images/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "image=@your-image.png"
        </div>

        <center>
            <a href="/" class="back-btn">← Вернуться на главную</a>
        </center>
    </div>
</body>
</html>
        `);
    });

    // Authenticated upload, public read
    app.post('/api/images/upload', imageUpload.single('image'), async (req, res) => {
        try {
            console.log('📤 [Image Upload] Request received');
            console.log('   Headers:', JSON.stringify(req.headers, null, 2));
            console.log('   File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'NO FILE');
            
            if (!supabase) {
                console.log('   ❌ Supabase not configured');
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => { currentUser = req.user; }, supabase);
            if (!currentUser) {
                console.log('   ❌ Auth failed');
                return;
            }
            
            console.log('   ✅ Authenticated as:', currentUser.username || currentUser.id);

            if (!req.file) return res.status(400).json({ error: 'Файл не получен' });

            const ext = path.extname(req.file.originalname).toLowerCase();
            const id = uuidv4();
            const storagePath = `images/${id}${ext}`;

            const { error: upErr } = await supabase.storage
                .from('images')
                .upload(storagePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });
            
            if (upErr) {
                if (upErr.message && upErr.message.includes('Bucket not found')) {
                    return res.status(503).json({ error: 'Bucket "images" не создан в Supabase Storage. Создайте его в Dashboard.' });
                }
                throw upErr;
            }

            // Short code derived from id
            const cleaned = id.replace(/-/g, '');
            const hash = cleaned.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
            const shortCode = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');

            // Сохраняем метаданные в таблицу images_metadata
            try {
                const { error: metaError } = await supabase
                    .from('images_metadata')
                    .insert({
                        image_id: id,
                        user_id: currentUser.id,
                        original_name: req.file.originalname,
                        file_size: req.file.size,
                        mime_type: req.file.mimetype,
                        storage_path: storagePath,
                        short_code: shortCode
                    });
                
                if (metaError) {
                    console.error('   ⚠️  Failed to save image metadata:', metaError);
                } else {
                    console.log('   ✅ Image metadata saved:', shortCode);
                }
            } catch (metaErr) {
                console.error('   ⚠️  Image metadata error:', metaErr);
            }

            // Логируем действие пользователя
            await logUserAction(currentUser.id, 'image_upload', {
                image_id: id,
                short_code: shortCode,
                original_name: req.file.originalname,
                file_size: req.file.size
            });

            // Public direct URL via our domain
            const base = process.env.PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `${req.protocol}://${req.get('host')}`);
            const directUrl = `${base}/i/${shortCode}`;

            console.log('   🎉 Upload complete:', directUrl);

            res.json({ success: true, id, shortCode, directUrl });
        } catch (error) {
            console.error('Image upload error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // List images (for gallery)
    app.get('/api/images/list', async (req, res) => {
        try {
            if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
            const limit = Math.min(Math.max(parseInt(req.query.limit) || 60, 1), 200);
            const offset = Math.max(parseInt(req.query.offset) || 0, 0);
            const q = (req.query.q || '').trim();

            let query = supabase
                .from('images_metadata')
                .select('image_id, user_id, original_name, file_size, mime_type, storage_path, short_code, created_at', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (q) {
                // Поиск по имени или коду
                query = query.or(`original_name.ilike.%${q}%,short_code.ilike.%${q}%`);
            }

            query = query.range(offset, offset + limit - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            const base = process.env.PUBLIC_BASE_URL || (req.headers['x-forwarded-proto'] ? `${req.headers['x-forwarded-proto']}://${req.headers.host}` : `${req.protocol}://${req.get('host')}`);
            const items = (data || []).map(row => ({
                ...row,
                directUrl: `${base}/i/${row.short_code}`
            }));
            res.setHeader('Cache-Control', 'no-store');
            res.json({ items, count: count ?? items.length, offset, limit });
        } catch (e) {
            console.error('Image list error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    // Public image by short code
    app.get('/i/:shortCode([A-Z0-9]{7})', async (req, res) => {
        try {
            if (!supabase) return res.status(503).send('Supabase not configured');
            const shortCode = req.params.shortCode;

            // 1) Пытаемся найти запись напрямую в БД (самый быстрый и консистентный способ)
            let storagePath = null;
            try {
                const { data: row, error: metaErr } = await supabase
                    .from('images_metadata')
                    .select('storage_path')
                    .eq('short_code', shortCode)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                if (!metaErr && row && row.storage_path) {
                    storagePath = row.storage_path;
                }
            } catch (e) {
                // игнорируем и используем резервный путь
            }

            // 2) Резервный путь — сканируем bucket и вычисляем код (дорого, но рабочий)
            if (!storagePath) {
                let files = null;
                const r1 = await supabase.storage.from('images').list('images');
                files = (!r1.error && r1.data) ? r1.data : (await supabase.storage.from('images').list('')).data;

                const file = files?.find(f => {
                    const ext = path.extname(f.name);
                    const fileId = path.basename(f.name, ext);
                    const cleaned = fileId.replace(/-/g, '');
                    const hash = cleaned.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
                    const code = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
                    return code === shortCode;
                });
                if (file) {
                    storagePath = file.name.startsWith('images/') ? file.name : `images/${file.name}`;
                }
            }

            if (!storagePath) return res.status(404).send('Not found');

            const { data, error } = await supabase.storage.from('images').download(storagePath);
            if (error || !data) return res.status(404).send('Not found');

            const arrayBuffer = await data.arrayBuffer();
            const original = Buffer.from(arrayBuffer);

            // Optional resizing for thumbnails
            const w = parseInt(req.query.w);
            const h = parseInt(req.query.h);
            const q = Math.min(Math.max(parseInt(req.query.q) || 75, 10), 95);
            const wantResize = sharp && ((w && w > 0) || (h && h > 0));
            if (wantResize) {
                try {
                    const s = sharp(original, { failOn: 'none' });
                    if (w || h) s.resize({ width: w || null, height: h || null, fit: 'inside' });
                    const webp = await s.webp({ quality: q }).toBuffer();
                    res.setHeader('Content-Type', 'image/webp');
                    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
                    res.setHeader('Content-Length', webp.length);
                    return res.send(webp);
                } catch (e) {
                    console.warn('Resize failed, sending original:', e.message);
                }
            }

            const ext = path.extname(storagePath).toLowerCase();
            const type = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'application/octet-stream';
            res.setHeader('Content-Type', type);
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            res.setHeader('Content-Length', original.length);
            res.send(original);
        } catch (error) {
            console.error('Public image error:', error);
            res.status(500).send('Internal error');
        }
    });
    // Middleware
    app.use(cors());
    app.use(express.json());

    // Supabase Client (guard missing env)
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;
    let supabase = null;
    if (SUPABASE_URL && SUPABASE_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.warn('⚠️  SUPABASE_URL or SUPABASE_KEY is not set. Supabase-dependent endpoints will return 503.');
    }

    // Discord Client (disable on serverless)
    let discordReady = false;
    const discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    if (!IS_SERVERLESS && process.env.DISCORD_BOT_TOKEN) {
        discordClient.once('ready', () => {
            console.log(`✅ Discord bot connected as ${discordClient.user.tag}`);
            discordReady = true;
        });
        discordClient.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
            console.error('❌ Failed to login to Discord:', err);
        });
    } else if (IS_SERVERLESS) {
        console.warn('⚠️  Discord features are disabled in serverless environment.');
    }

    // ============================================
    // API ENDPOINTS
    // ============================================

    // Setup auth routes
    if (supabase) {
        setupAuthRoutes(app, supabase);
        console.log('✅ Auth routes initialized');
    }

    // Получить статистику за период
    app.get('/api/stats', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }
            const days = parseInt(req.query.days) || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const { data, error } = await supabase
                .from('server_analytics')
                .select('*')
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Группируем по типам событий
            const stats = {
                wipe_created: 0,
                ticket_created: 0,
                tournament_role_created: 0,
                channel_deleted: 0,
                member_count: 0,
                timeline: []
            };

            const timelineMap = new Map();

            data.forEach(event => {
                // Подсчет по типам
                stats[event.event_type] = (stats[event.event_type] || 0) + 1;

                // Временная шкала (по дням)
                const date = new Date(event.created_at).toISOString().split('T')[0];
                if (!timelineMap.has(date)) {
                    timelineMap.set(date, {
                        date,
                        wipe_created: 0,
                        ticket_created: 0,
                        tournament_role_created: 0,
                        channel_deleted: 0,
                        member_count: 0,
                        wipe_signup_looking: 0,
                        wipe_signup_ready: 0,
                        wipe_signup_not_coming: 0
                    });
                }
                const dayStats = timelineMap.get(date);
                if (event.event_type === 'member_count') {
                    const count = (event.event_data && (event.event_data.count || event.event_data["count"])) || 0;
                    // сохраняем последний или максимальный на день
                    dayStats.member_count = Math.max(dayStats.member_count || 0, count);
                    stats.member_count = Math.max(stats.member_count || 0, count);
                } else {
                    dayStats[event.event_type] = (dayStats[event.event_type] || 0) + 1;
                    stats[event.event_type] = (stats[event.event_type] || 0) + 1;
                }
            });

            // Получаем статистику записи на вайп из отдельной таблицы
            const { data: wipeSignupData, error: wipeSignupError } = await supabase
                .from('wipe_signup_stats')
                .select('*')
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: true });

            if (!wipeSignupError && wipeSignupData) {
                stats.wipe_signup_looking = 0;
                stats.wipe_signup_ready = 0;
                stats.wipe_signup_not_coming = 0;

                wipeSignupData.forEach(signup => {
                    const date = new Date(signup.created_at).toISOString().split('T')[0];
                    
                    // Убедимся что дата есть в timeline
                    if (!timelineMap.has(date)) {
                        timelineMap.set(date, {
                            date,
                            wipe_created: 0,
                            ticket_created: 0,
                            tournament_role_created: 0,
                            channel_deleted: 0,
                            member_count: 0,
                            wipe_signup_looking: 0,
                            wipe_signup_ready: 0,
                            wipe_signup_not_coming: 0
                        });
                    }
                    
                    const dayStats = timelineMap.get(date);
                    
                    // Подсчитываем по типам
                    if (signup.signup_type === 'looking') {
                        stats.wipe_signup_looking++;
                        dayStats.wipe_signup_looking++;
                    } else if (signup.signup_type === 'ready') {
                        stats.wipe_signup_ready++;
                        dayStats.wipe_signup_ready++;
                    } else if (signup.signup_type === 'not_coming') {
                        stats.wipe_signup_not_coming++;
                        dayStats.wipe_signup_not_coming++;
                    }
                });
            }

            stats.timeline = Array.from(timelineMap.values());
            stats.total = data.length;

            res.json(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить статистику записи на вайп
    app.get('/api/wipe-signup-stats', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }
            const days = parseInt(req.query.days) || 30;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            const { data, error } = await supabase
                .from('wipe_signup_stats')
                .select('*')
                .gte('created_at', cutoffDate.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Подсчёт статистики
            const stats = {
                looking_total: 0,      // Всего ищут игроков
                looking_count: 0,      // Сколько всего слотов ищут
                ready_total: 0,        // Сколько готовы зайти
                not_coming_total: 0,   // Сколько не зайдут
                recent_signups: [],    // Последние 50 записей
                timeline: []           // По дням
            };

            const timelineMap = new Map();

            data.forEach((signup, index) => {
                const date = new Date(signup.created_at).toISOString().split('T')[0];
                
                // Инициализируем день если нет
                if (!timelineMap.has(date)) {
                    timelineMap.set(date, {
                        date,
                        looking: 0,
                        looking_count: 0,
                        ready: 0,
                        not_coming: 0
                    });
                }
                const dayStats = timelineMap.get(date);

                // Подсчёт по типам
                if (signup.signup_type === 'looking') {
                    stats.looking_total++;
                    const count = signup.player_count || 1;
                    stats.looking_count += count;
                    dayStats.looking++;
                    dayStats.looking_count += count;
                } else if (signup.signup_type === 'ready') {
                    stats.ready_total++;
                    dayStats.ready++;
                } else if (signup.signup_type === 'not_coming') {
                    stats.not_coming_total++;
                    dayStats.not_coming++;
                }

                // Последние 50 записей
                if (index < 50) {
                    stats.recent_signups.push({
                        type: signup.signup_type,
                        user_id: signup.user_id,
                        count: signup.player_count || 0,
                        message_content: signup.message_content,
                        created_at: signup.created_at
                    });
                }
            });

            stats.timeline = Array.from(timelineMap.values()).reverse();
            stats.total = data.length;

            res.json(stats);
        } catch (error) {
            console.error('Error fetching wipe signup stats:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить активные каналы для автоудаления
    app.get('/api/auto-delete-channels', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }
            const { data, error } = await supabase
                .from('auto_delete_channels')
                .select('*')
                .eq('status', 'active')
                .order('delete_at', { ascending: true });

            if (error) throw error;

            // Добавляем оставшееся время
            const now = new Date();
            const channels = data.map(ch => ({
                ...ch,
                time_left_seconds: Math.max(0, Math.floor((new Date(ch.delete_at) - now) / 1000))
            }));

            res.json(channels);
        } catch (error) {
            console.error('Error fetching auto-delete channels:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить список серверов
    app.get('/api/guilds', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const guilds = discordClient.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL(),
                memberCount: guild.memberCount
            }));

            res.json(guilds);
        } catch (error) {
            console.error('Error fetching guilds:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить каналы сервера
    app.get('/api/guilds/:guildId/channels', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const guild = discordClient.guilds.cache.get(req.params.guildId);
            if (!guild) {
                return res.status(404).json({ error: 'Guild not found' });
            }

            const channels = guild.channels.cache
                .filter(ch => ch.isTextBased())
                .map(ch => ({
                    id: ch.id,
                    name: ch.name,
                    type: ch.type
                }));

            res.json(channels);
        } catch (error) {
            console.error('Error fetching channels:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Получить сообщения из канала
    app.get('/api/channels/:channelId/messages', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const channel = await discordClient.channels.fetch(req.params.channelId);
            if (!channel || !channel.isTextBased()) {
                return res.status(404).json({ error: 'Channel not found or not text-based' });
            }

            const messages = await channel.messages.fetch({ limit: 50 });
            
            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                content: msg.content,
                author: msg.author.tag,
                authorId: msg.author.id,
                timestamp: msg.createdAt.toISOString(),
                attachments: msg.attachments.map(att => ({
                    url: att.url,
                    name: att.name
                }))
            })).reverse();

            res.json(formattedMessages);
        } catch (error) {
            console.error('Error fetching messages:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Отправить сообщение от имени бота
    app.post('/api/send-message', async (req, res) => {
        try {
            if (IS_SERVERLESS || !discordReady) {
                return res.status(503).json({ error: 'Discord bot not available' });
            }

            const { channelId, content, embed } = req.body;

            if (!channelId || (!content && !embed)) {
                return res.status(400).json({ error: 'channelId and content/embed are required' });
            }

            const channel = await discordClient.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                return res.status(404).json({ error: 'Channel not found or not text-based' });
            }

            const messageOptions = {};
            if (content) messageOptions.content = content;
            if (embed) messageOptions.embeds = [embed];

            const message = await channel.send(messageOptions);

            res.json({
                success: true,
                messageId: message.id,
                channelId: message.channelId
            });
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // MAPS HOSTING API (без базы данных, только Storage)
    // ============================================

    // Upload map file
    app.post('/api/maps/upload', upload.single('map'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Файл не загружен' });
            }

            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            const mapId = uuidv4();
            const fileExt = path.extname(req.file.originalname);
            const originalName = req.file.originalname;
            const fileName = `${mapId}${fileExt}`;
            const storagePath = `maps/${fileName}`;

            // Upload to Supabase Storage with metadata
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('maps')
                .upload(storagePath, req.file.buffer, {
                    contentType: 'application/octet-stream',
                    upsert: false,
                    metadata: {
                        originalName: originalName,
                        uploadedAt: new Date().toISOString(),
                        fileSize: req.file.size.toString()
                    }
                });

            if (uploadError) {
                console.error('Supabase upload error:', uploadError);
                return res.status(500).json({ error: uploadError.message || 'Ошибка загрузки файла' });
            }

            // Save to maps_metadata table with user_id
            try {
                const { error: metaError } = await supabase
                    .from('maps_metadata')
                    .insert({
                        map_id: mapId,
                        user_id: currentUser.id,
                        original_name: originalName,
                        file_size: req.file.size,
                        storage_path: storagePath,
                        short_code: generateShortCodeForMap(mapId)
                    });
                
                if (metaError) {
                    console.error('❌ Failed to save metadata:', metaError);
                    console.error('Data attempted:', { mapId, userId: currentUser.id, originalName, storagePath });
                } else {
                    console.log('✅ Metadata saved successfully for map:', mapId);
                }
            } catch (metaErr) {
                console.error('❌ Metadata insert error:', metaErr);
            }

            // Log action
            await logUserAction(currentUser.id, 'map_upload', {
                map_id: mapId,
                original_name: originalName,
                file_size: req.file.size
            });

            // Return map data
            const mapData = {
                id: mapId,
                original_name: originalName,
                storage_path: storagePath,
                file_size: req.file.size,
                uploaded_at: new Date().toISOString(),
                owner_id: currentUser.id,
                owner_name: currentUser.username
            };

            res.json({
                success: true,
                map: mapData
            });
        } catch (error) {
            console.error('Error uploading map:', error);
            res.status(500).json({ error: error.message || 'Ошибка загрузки файла' });
        }
    });

    // Helper: generate short code from UUID
    function generateShortCodeForMap(uuid) {
        const cleaned = uuid.replace(/-/g, '');
        const hash = cleaned.split('').reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
        return Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
    }

    // Get maps: only own maps for regular users, all for admin
    app.get('/api/maps', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Try to identify current user (optional for backward-compat). If auth header present, enforce auth.
            let currentUser = null;
            const authHeader = req.headers.authorization;
            if (authHeader) {
                await requireAuth(req, res, async () => {
                    currentUser = req.user;
                }, supabase);
                if (!currentUser) return; // requireAuth already responded
            }

            // List all files from Storage bucket (root of bucket)
            const { data: files, error } = await supabase.storage
                .from('maps')
                .list('maps', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) {
                console.error('Supabase storage list error:', error);
                // Если папка не существует, попробуем корень
                const { data: rootFiles, error: rootError } = await supabase.storage
                    .from('maps')
                    .list('', {
                        limit: 100,
                        offset: 0,
                        sortBy: { column: 'created_at', order: 'desc' }
                    });
                
                if (rootError) {
                    console.error('Root list error:', rootError);
                    return res.json([]);
                }
                
                files = rootFiles;
            }

            console.log('📁 Files in storage:', files);
            console.log('📊 Total files found:', files?.length || 0);

            // Фильтруем только файлы (не папки) и с расширением .map
            const mapFiles = (files || []).filter(file => {
                const isFolder = file.id === null;
                const hasMapExtension = file.name && path.extname(file.name).toLowerCase() === '.map';
                console.log(`  - ${file.name}: isFolder=${isFolder}, hasMapExt=${hasMapExtension}`);
                return !isFolder && hasMapExtension;
            });

            // Get metadata from database
            let metaMap = {};
            try {
                const { data: metaRows, error: metaError } = await supabase
                    .from('maps_metadata')
                    .select('map_id, user_id, users(username)');
                
                if (metaError) {
                    console.error('❌ Error fetching metadata:', metaError);
                } else {
                    console.log('✅ Fetched metadata for', metaRows?.length || 0, 'maps');
                }
                
                if (Array.isArray(metaRows)) {
                    metaRows.forEach(meta => {
                        metaMap[meta.map_id] = {
                            user_id: meta.user_id,
                            owner_name: meta.users?.username || 'Unknown'
                        };
                    });
                }
            } catch (e) {
                console.error('❌ Metadata fetch error:', e.message);
            }

            // Transform files to map format
            let maps = mapFiles.map(file => {
                const fileExt = path.extname(file.name);
                const fileName = path.basename(file.name, fileExt);
                // Убираем префикс 'maps/' если он есть
                const mapId = fileName.replace('maps/', '');
                const metadata = file.metadata || {};
                const meta = metaMap[mapId] || {};
                
                return {
                    id: mapId,
                    original_name: metadata.originalName || file.name,
                    storage_path: file.name,
                    file_size: parseInt(metadata.fileSize || file.metadata?.size || '0'),
                    uploaded_at: metadata.uploadedAt || file.created_at || new Date().toISOString(),
                    owner_id: meta.user_id,
                    owner_name: meta.owner_name
                };
            });

            // If user is not admin, filter to own maps only
            if (currentUser && currentUser.role !== 'admin') {
                maps = maps.filter(m => m.owner_id === currentUser.id);
            }

            console.log(`Found ${maps.length} maps in storage`);
            res.json(maps);
        } catch (error) {
            console.error('Error fetching maps:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Download map file (only owner or admin)
    app.get('/api/maps/download/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Enforce auth for download
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            console.log('📥 Download request for ID:', req.params.id);

            // Try both paths
            let files = null;
            let error = null;
            
            // First try maps/ folder
            const result1 = await supabase.storage.from('maps').list('maps');
            if (!result1.error && result1.data) {
                files = result1.data;
            } else {
                // Fallback to root
                const result2 = await supabase.storage.from('maps').list('');
                files = result2.data;
                error = result2.error;
            }

            if (error) throw error;

            console.log('📁 Looking in files:', files?.map(f => f.name));

            // Find file by ID (ID is filename without extension)
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                console.log(`  Comparing: ${fileId} === ${req.params.id}`);
                return fileId === req.params.id;
            });

            if (!file) {
                console.error('❌ File not found for ID:', req.params.id);
                return res.status(404).json({ error: 'Карта не найдена' });
            }

            console.log('✅ Found file:', file.name);
            const storagePath = file.name.startsWith('maps/') ? file.name : `maps/${file.name}`;

            // Ownership check via metadata table if possible
            try {
                const { data: metaRow } = await supabase
                    .from('maps_metadata')
                    .select('id, user_id')
                    .eq('id', req.params.id)
                    .single();
                if (metaRow && currentUser.role !== 'admin' && metaRow.user_id !== currentUser.id) {
                    return res.status(403).json({ error: 'Нет доступа к этой карте' });
                }
            } catch (e) {
                console.warn('Ownership check skipped:', e.message);
            }

            // Get file from Supabase Storage
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('maps')
                .download(storagePath);

            if (downloadError || !fileData) {
                return res.status(404).json({ error: 'Файл не найден' });
            }

            // Get original name from metadata
            const metadata = file.metadata || {};
            const originalName = metadata.originalName || file.name;

            // Convert blob to buffer for streaming
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Log download action
            await logUserAction(currentUser.id, 'map_download', {
                map_id: req.params.id,
                original_name: originalName,
                file_size: buffer.length
            });

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error('Error downloading map:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete map (only owner or admin)
    app.delete('/api/maps/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Enforce auth for delete
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            console.log('🗑️ Delete request for ID:', req.params.id);

            // Try both paths
            let files = null;
            
            // First try maps/ folder
            const result1 = await supabase.storage.from('maps').list('maps');
            if (!result1.error && result1.data) {
                files = result1.data;
            } else {
                // Fallback to root
                const result2 = await supabase.storage.from('maps').list('');
                files = result2.data;
            }

            console.log('📁 Looking in files for delete:', files?.map(f => f.name));

            // Find file by ID
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                console.log(`  Delete comparing: ${fileId} === ${req.params.id}`);
                return fileId === req.params.id;
            });

            if (!file) {
                console.error('❌ File not found for delete:', req.params.id);
                return res.status(404).json({ error: 'Карта не найдена' });
            }

            // Ownership check via metadata table
            try {
                const { data: metaRow } = await supabase
                    .from('maps_metadata')
                    .select('id, user_id')
                    .eq('id', req.params.id)
                    .single();
                if (metaRow && currentUser.role !== 'admin' && metaRow.user_id !== currentUser.id) {
                    return res.status(403).json({ error: 'Нет доступа к этой карте' });
                }
            } catch (e) {
                console.warn('Ownership check skipped:', e.message);
            }

            console.log('✅ Deleting file:', file.name);
            const storagePath = file.name.startsWith('maps/') ? file.name : `maps/${file.name}`;

            // Delete file from storage
            const { error: storageError } = await supabase.storage
                .from('maps')
                .remove([storagePath]);

            if (storageError) throw storageError;

            // Log delete action
            await logUserAction(currentUser.id, 'map_delete', {
                map_id: req.params.id,
                original_name: file.name
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting map:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // CHANGELOG API
    // ============================================

    // Get all changelog entries
    app.get('/api/changelog', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            // Return array with 120 entries (3 rows × 40 columns)
            // Fill missing entries with null
            const result = Array(120).fill(null).map((_, index) => {
                return data[index] || null;
            });
            res.json(result);
        } catch (error) {
            console.error('Error fetching changelog:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Increment views for changelog entry
    app.post('/api/changelog/:id/view', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;

            // Get current views
            const { data: entry, error: fetchError } = await supabase
                .from('changelog')
                .select('views')
                .eq('id', id)
                .single();

            if (fetchError || !entry) {
                return res.status(404).json({ error: 'Changelog entry not found' });
            }

            // Increment views
            const { data, error } = await supabase
                .from('changelog')
                .update({ views: (entry.views || 0) + 1 })
                .eq('id', id)
                .select('views')
                .single();

            if (error) throw error;

            res.json({ success: true, views: data.views });
        } catch (error) {
            console.error('Error incrementing views:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // CHANGELOG ADMIN API
    // ============================================

    // Test endpoint to verify routing works
    app.get('/api/admin/test', (req, res) => {
        res.json({ message: 'Admin API works!', timestamp: new Date().toISOString() });
    });

    // Get all changelog entries (admin - with full data)
    app.get('/api/admin/changelog', async (req, res) => {
        try {
            console.log('Admin changelog endpoint called');
            if (!supabase) {
                console.error('Supabase not configured');
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .order('date', { ascending: false });

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log(`Found ${data?.length || 0} changelog entries`);
            res.json(data || []);
        } catch (error) {
            console.error('Error fetching changelog (admin):', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get single changelog entry
    app.get('/api/admin/changelog/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;

            const { data, error } = await supabase
                .from('changelog')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) {
                return res.status(404).json({ error: 'Changelog entry not found' });
            }

            res.json(data);
        } catch (error) {
            console.error('Error fetching changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Create new changelog entry
    app.post('/api/admin/changelog', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { build, subtitle, date, added, fixed, changed } = req.body;

            if (!build) {
                return res.status(400).json({ error: 'Build number is required' });
            }

            const { data, error } = await supabase
                .from('changelog')
                .insert({
                    build,
                    subtitle: subtitle || '',
                    date: date || new Date().toISOString(),
                    added: added || [],
                    fixed: fixed || [],
                    changed: changed || [],
                    views: 0
                })
                .select()
                .single();

            if (error) throw error;

            res.json({ success: true, data });
        } catch (error) {
            console.error('Error creating changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Update changelog entry
    app.put('/api/admin/changelog/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;
            const { build, subtitle, date, added, fixed, changed } = req.body;

            const updateData = {};
            if (build !== undefined) updateData.build = build;
            if (subtitle !== undefined) updateData.subtitle = subtitle;
            if (date !== undefined) updateData.date = date;
            if (added !== undefined) updateData.added = added;
            if (fixed !== undefined) updateData.fixed = fixed;
            if (changed !== undefined) updateData.changed = changed;

            const { data, error } = await supabase
                .from('changelog')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            if (!data) {
                return res.status(404).json({ error: 'Changelog entry not found' });
            }

            res.json({ success: true, data });
        } catch (error) {
            console.error('Error updating changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete changelog entry
    app.delete('/api/admin/changelog/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const { id } = req.params;

            const { error } = await supabase
                .from('changelog')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting changelog entry:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // USER ACTIVITY API
    // ============================================

    // Get user activity
    app.get('/api/user/activity', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // Require auth
            let currentUser = null;
            await requireAuth(req, res, async () => {
                currentUser = req.user;
            }, supabase);
            if (!currentUser) return;

            // Get user actions from database
            const { data, error } = await supabase
                .from('user_actions')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            res.json({
                success: true,
                actions: data || []
            });
        } catch (error) {
            console.error('Error fetching user activity:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Log user action (internal helper)
    async function logUserAction(userId, actionType, actionDetails = {}) {
        if (!supabase) return;
        try {
            await supabase
                .from('user_actions')
                .insert({
                    user_id: userId,
                    action_type: actionType,
                    action_details: actionDetails
                });
            console.log(`✅ Logged action: ${actionType} for user ${userId}`);
        } catch (error) {
            console.error('❌ Failed to log action:', error);
        }
    }

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            discord: !IS_SERVERLESS && discordReady,
            supabase: !!supabase,
            changelog: true,
            timestamp: new Date().toISOString()
        });
    });

    // Short URL handler for map downloads (e.g., /ABC1234)
    app.get('/:shortCode([A-Z0-9]{7})', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            const shortCode = req.params.shortCode;
            console.log('🔗 Short URL request:', shortCode);
            
            // Try both paths
            let files = null;
            
            // First try maps/ folder
            const result1 = await supabase.storage.from('maps').list('maps');
            if (!result1.error && result1.data) {
                files = result1.data;
            } else {
                // Fallback to root
                const result2 = await supabase.storage.from('maps').list('');
                files = result2.data;
            }

            console.log('📁 Files for short URL:', files?.map(f => f.name));

            // Generate short codes and find match
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                
                // Generate same short code as frontend
                const cleaned = fileId.replace(/-/g, '');
                const hash = cleaned.split('').reduce((acc, char) => {
                    return ((acc << 5) - acc) + char.charCodeAt(0);
                }, 0);
                const code = Math.abs(hash).toString(36).substring(0, 7).toUpperCase().padEnd(7, '0');
                
                return code === shortCode;
            });

            if (!file) {
                return res.status(404).send(`
                    <!DOCTYPE html>
                    <html><head><meta charset="UTF-8"><title>Карта не найдена</title></head>
                    <body style="font-family:sans-serif;text-align:center;padding:50px;">
                        <h1>❌ Карта не найдена</h1>
                        <p>Код: ${shortCode}</p>
                        <a href="/">← Вернуться на главную</a>
                    </body></html>
                `);
            }

            const storagePath = file.name.startsWith('maps/') ? file.name : `maps/${file.name}`;
            console.log('✅ Short URL matched file:', file.name, '-> path:', storagePath);

            // Download file from storage
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('maps')
                .download(storagePath);

            if (downloadError || !fileData) {
                return res.status(404).json({ error: 'Файл не найден' });
            }

            // Get original name from metadata
            const metadata = file.metadata || {};
            const originalName = metadata.originalName || file.name;

            // Convert blob to buffer
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error('Error downloading map via short code:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Serve static files (after all API routes)
    // Skip /api routes to avoid conflicts
    const staticMiddleware = express.static('public');
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next(); // Skip static files for API routes
        }
        return staticMiddleware(req, res, next);
    });

    // Hidden gallery page (not linked anywhere)
    app.get(GALLERY_PATH, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'images-gallery.html'));
    });

    return app;
}

// Start server in non-serverless environments
if (!IS_SERVERLESS && require.main === module) {
    const app = createApp();
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
        console.log(`🚀 Dashboard server running on http://${HOST}:${PORT}`);
        console.log(`📊 Visit http://localhost:${PORT} to view analytics`);
        if (HOST === '0.0.0.0') {
            console.log(`🌐 External access: http://ваш_домен:${PORT}`);
        }
    });
}

module.exports = { createApp };

