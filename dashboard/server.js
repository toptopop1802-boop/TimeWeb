const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { Client, GatewayIntentBits } = require('discord.js');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const IS_SERVERLESS = !!process.env.VERCEL;

function createApp() {
    const app = express();

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
                        member_count: 0
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

            stats.timeline = Array.from(timelineMap.values());
            stats.total = data.length;

            res.json(stats);
        } catch (error) {
            console.error('Error fetching stats:', error);
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

            // Return map data (no database needed)
            const mapData = {
                id: mapId,
                original_name: originalName,
                storage_path: storagePath,
                file_size: req.file.size,
                uploaded_at: new Date().toISOString()
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

    // Get all maps (from Storage, no database)
    app.get('/api/maps', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // List all files from Storage bucket
            const { data: files, error } = await supabase.storage
                .from('maps')
                .list('', {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'created_at', order: 'desc' }
                });

            if (error) throw error;

            // Transform files to map format
            const maps = (files || []).map(file => {
                const fileExt = path.extname(file.name);
                const mapId = path.basename(file.name, fileExt);
                const metadata = file.metadata || {};
                
                return {
                    id: mapId,
                    original_name: metadata.originalName || file.name,
                    storage_path: file.name,
                    file_size: parseInt(metadata.fileSize || file.metadata?.size || '0'),
                    uploaded_at: metadata.uploadedAt || file.created_at || new Date().toISOString()
                };
            });

            res.json(maps);
        } catch (error) {
            console.error('Error fetching maps:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Download map file
    app.get('/api/maps/download/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // List files to find the one with matching ID
            const { data: files, error: listError } = await supabase.storage
                .from('maps')
                .list('');

            if (listError) throw listError;

            // Find file by ID (ID is filename without extension)
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                return fileId === req.params.id;
            });

            if (!file) {
                return res.status(404).json({ error: 'Карта не найдена' });
            }

            const storagePath = file.name;

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

            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Length', buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error('Error downloading map:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete map
    app.delete('/api/maps/:id', async (req, res) => {
        try {
            if (!supabase) {
                return res.status(503).json({ error: 'Supabase not configured' });
            }

            // List files to find the one with matching ID
            const { data: files, error: listError } = await supabase.storage
                .from('maps')
                .list('');

            if (listError) throw listError;

            // Find file by ID
            const file = files?.find(f => {
                const fileExt = path.extname(f.name);
                const fileId = path.basename(f.name, fileExt);
                return fileId === req.params.id;
            });

            if (!file) {
                return res.status(404).json({ error: 'Карта не найдена' });
            }

            const storagePath = file.name;

            // Delete file from storage
            const { error: storageError } = await supabase.storage
                .from('maps')
                .remove([storagePath]);

            if (storageError) throw storageError;

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

    // Serve static files (after all API routes)
    // Skip /api routes to avoid conflicts
    const staticMiddleware = express.static('public');
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next(); // Skip static files for API routes
        }
        return staticMiddleware(req, res, next);
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

