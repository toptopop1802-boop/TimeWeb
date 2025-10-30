import asyncio
import datetime
import logging
import os
import re
import socket
import struct
from typing import Any, Callable, Iterable, Optional

import discord
from discord import app_commands
from discord.ext import commands, tasks

# Импортируем базу данных (если файл .env настроен)
try:
    from database import get_database, Database
    DATABASE_ENABLED = True
except Exception as db_exc:
    logging.warning(f"Database module not loaded: {db_exc}. Analytics and auto-delete features will be disabled.")
    DATABASE_ENABLED = False
    Database = None
    get_database = None

# Required environment variables:
#   DISCORD_TOKEN       - bot token from https://discord.com/developers/applications
# Optional environment variables:
#   DISCORD_GUILD_ID    - lock commands to a specific guild (defaults to all)
#   DISCORD_PREFIX      - override the default command prefix ("!")


def chunk_members(members: Iterable[discord.Member], size: int) -> Iterable[list[discord.Member]]:
    """Yield members in fixed-size batches to reduce rate-limit pressure."""
    batch: list[discord.Member] = []
    for member in members:
        batch.append(member)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch


def main() -> None:
    token = os.getenv("DISCORD_BOT_TOKEN")
    if not token:
        raise RuntimeError("Environment variable DISCORD_BOT_TOKEN must be set.")

    guild_id_raw = os.getenv("DISCORD_GUILD_ID")
    guild_id = int(guild_id_raw) if guild_id_raw else None

    prefix = os.getenv("DISCORD_PREFIX", "!")

    intents = discord.Intents.default()
    intents.members = True
    intents.message_content = True

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    )
    
    # Отключаем спам-логи от httpx (Supabase)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    VERIFICATION_ROLE_ID = 1_359_572_335_635_464_303
    ANNOUNCE_CHANNEL_ID = 1_426_314_731_903_258_764
    MEMBER_EVENTS_CHANNEL_ID = 1_427_334_027_114_975_275
    LOG_CHANNEL_ID = 1_427_335_159_291_838_616
    COMMAND_LIST_CHANNEL_ID = 1_427_339_269_738_856_530
    CONTENT_GUARD_EXEMPT_USER_ID = 663_045_468_871_196_709
    ROLE_POSITION_REFERENCE_ID = 1_380_215_358_685_839_461
    TICKET_SYSTEM_CHANNEL_ID = 1_430_092_137_583_870_092
    RUST_SERVER_HOST = os.getenv("RUST_SERVER_HOST", "185.189.255.110")
    RUST_SERVER_PORT = int(os.getenv("RUST_SERVER_PORT", "35200"))
    RUST_QUERY_PORT = (
        int(os.getenv("RUST_QUERY_PORT"))
        if os.getenv("RUST_QUERY_PORT")
        else None
    )
    RUST_STATUS_INTERVAL = 60
    COMMAND_LIST_HEADER = "ℹ️ **Команды бота**"
    AUTO_DELETE_DELAY_SECONDS = int(os.getenv("BOT_MESSAGE_TTL", "600"))
    RULE_CATEGORIES = [
        {
            "value": "verifications",
            "label": "Проверки",
            "description": "Правила категории Проверки",
            "title": "Правила проверок:",
            "body": """• 0.1
При игре на наших серверах на вашем компьютере должен быть установлен Discord. Он нужен в случае если вас вызовут на проверку.
Наказание: Бан.

• 0.2
В случае проверки у вас есть не более 2 минут, чтобы связаться с модераторами/админами в программе Discord.
Наказание: Бан.

• 0.3
Запрещено покидать сервер во время проверки без разрешения Модератора/Администратора.
Наказание: Бан.

• 0.4
При отказе выполнить требования Модератора/Администратора мы вправе забанить вас по причине отказа.

• 0.5
Проверка происходит «один на один» (Проверяемый/Администратор/Модератор/Стажёр). По необходимости могут присутствовать другие модераторы/администраторы проекта.

• 0.6
При неадекватном поведении на проверке мы можем наказать вас в соответствие с тяжестью вашего поведения.

• 0.7
Если при проверке у игрока были найдены следы удаленных файлов макросов/читов, модерация/администрация имеет право выдать вам бан на нашем проекте.
Наказание: По усмотрению администрации.

Примечание:
Проходя проверку по требованию Модерации/Администрации проекта, вы соглашаетесь предоставить доступ к своему PC и его данным (история браузера, папки и файлы, личные переписки и т.д.), а также разрешаете устанавливать сторонние программы, нужные администрации для проверки вашего PC.""",
        },
        {
            "value": "chat",
            "label": "Чат",
            "description": "Правила категории Чат",
            "title": "Правила чата:",
            "body": """• 1.1
Запрещено выдавать себя за Администратора/Модератора, если вы на самом деле им не являетесь.
Наказание: Мут/Бан.

• 1.2
Продвижение любых проектов, не связанных с BUBLICK RUST, запрещено.
Наказание: Мут/Бан.

• 1.3
Запрещен флуд — несколько одинаковых сообщений, отправляемых последовательно.
Наказание: Мут от 30 минут.

• 1.4
Запрещены любые проявления нацизма и шовинизма.
Наказание: Мут от 7 дней.

• 1.5
Запрещена продажа ресурсов и шкафов за реальные деньги (запрещена передача личных реквизитов в этом плане).
Наказание: Бан от 7 дней.

• 1.6
Запрещены любые оскорбления в сторону Администрации проекта.
Наказание: Мут.""",
        },
        {
            "value": "accounts",
            "label": "Аккаунты",
            "description": "Правила категории Аккаунты",
            "title": "Правила аккаунтов:",
            "body": """• 2.1
Передача аккаунта другому лицу не снимает с вас ответственности за содеянное на вашем аккаунте, при покупке аккаунта с баном на нашем проекте.
Наказание: Разблокировки не будет.

• 2.2
Получив БАН на старом аккаунте, вы автоматически получаете его и на новом.

• 2.3
Аккаунты, заблокированные с причиной "m-a"/"cheat", не подлежат разбану.

• 2.4
Баны за макросы могут быть апеллированы через 90 дней с момента бана.

• 2.5
Запрещается передача аккаунта, если у человека есть блокировка!

• 2.6
Запрещено использование/хранение/распространение/наличие подписки стороннего ПО или любые другие средства (читы или макросы), позволяющие получить преимущество над другими игроками. За нарушение этого правила вы получите бан на нашем проекте.
Наказание: Бан от 30 дней, зависит от ситуации. (Исключение: покупка была совершена более 3 месяцев назад.)

• 2.7
Если с момента последнего VAC бана прошло менее 180 дней и при наличии прямых доказательств вашей вины, вы можете получить блокировку на новый аккаунт.""",
        },
        {
            "value": "building",
            "label": "Строительство",
            "description": "Правила категории Строительство",
            "title": "Правила строительства:",
            "body": """• 3.1
Расположение лутовой должно быть в мейне/на крыше мейна с прямым проходом к этой лутовой. К шкафу тоже должен быть проход или из дверей, или за ОДНОЙ буферкой в лутовой. ЗАПРЕЩЕНО ставить шкаф в юбке, а также строить соединённку.
Наказание: Предупреждение, на второй раз - рем меина.

• 3.2
Запрещено строить усы от шкафов. Также запрещены большие и круглые шкафы, осминожки и мвк шкафы (Более 8 ракет и шкаф должен быть не более чем за одной стенкой и потолком).
Наказание: Удаление усов/шкафа/пред клану.

• 3.3
При занятии места под титаник/кибитку вы имеет право поставить шкаф с 10 фундаментами и на фундаментах должны быть стенки.
Наказание: Удаление лишних усов/удаление шкафа.

• 3.4
Запрещен любой абуз установленных лимитов.
Наказание: Предупреждение, при отказе исправить — рем мейна без предупреждений.

• 3.5
Возле меина вы не можете строить вышки и различные постройки, также ставить турели, пво, гантрапы на шкафы.
Наказание: Удаление объект(а/ов)/Пред.

• 3.6
Запрещено располагать два турнирных дома на расстоянии менее 3 квадратов друг от друга. В случае нарушения данного правила, клан, зарегистрировавшийся позже первого, будет снят с турнира.
Наказание: Снятие клана с турнира.

• 3.7
Запрещено строить соединенные/пиларные дома.
Наказание: Рем дома.

• 3.8
Шкаф должен находится за 1 дверцей в мейне от лута около лута должна быть 3 маленьких ящика.
Наказание: 2/3 преда + перенос.""",
        },
        {
            "value": "raids",
            "label": "Рейды",
            "description": "Правила категории Рейды",
            "title": "Правила рейдов:",
            "body": """• 4.1
При рейде мейна хотя бы один человек из атакующего клана обязан вести полную видеозапись, начинающуюся за 5-10 секунд до начала рейда и заканчивающуюся только после полного уничтожения турнирного шкафа.
Наказание: Пред + снятие рейда без разбирательств.

• 4.2
Запрещается рейдить мейн клана, если данный клан уже подвергся рейду от другого клана. Нельзя начинать рейд до окончания предыдущего. Запрещено ломать и байтить турели и ПВО, залетать на мейн, лутать ящики на юбке/мейне и строить титаник/кибитку на мейн.
Наказание: Пред/снятие клана + удаление объектов, поставленных на тот момент (в зависимости от ситуации).

• 4.3
Запрещено незарегистрированным игрокам приходить и создавать помеху в зоне турнирного дома, который подвергся рейду.
Наказание: Кик с сервера/бан до конца вайпа.

• 4.4
Запрещено во время стоп рейда рейдить/убивать/строить/ремать.
Наказание: Пред + удаление объектов, которые были поставлены на тот момент.

• 4.5
Если на момент начала рейд-блока зарегистрированный клан отсутствует на сервере (что подтверждается видеозаписью первых 10-20 секунд после объявления РБ), правила 1х1 рейдов на него не распространяются, и любой клан получает право атаковать его без ограничений.

• 4.6
Запрещено застраивать высокими стенами турнирный дом в рейд-блоке (должен быть проход не меньше 50%).
Наказание: Удаление стен/пред.

• 4.7
В случае просвета дома без вмешательства читеров игровыми путями необходимо иметь откат, на котором будет запечатлен просвет. Если отката не будет, рейд будет аннулирован.
Наказание: Пред.

Примечание:
«СТОП РЕЙД» — правило, при котором все игроки в его радиусе должны стоять AFK (запрещено рейдить, лутать сет, застраиваться, ходить по карте). При нарушении будет наказание.""",
        },
        {
            "value": "gameplay",
            "label": "Игровой процесс",
            "description": "Правила категории Игровой процесс",
            "title": "Правила игрового процесса:",
            "body": """• 5.1
В случае обнаружения в клане хотя бы одного игрока, использующего читы или просвет, клан подлежит немедленной дисквалификации. Если у игрока подтверждается использование макросов, клан получает предупреждение.
Наказание: Бан от 7 дней.

• 5.3
Запрещено ломать/отдавать свой турнирный шкаф, если вы отмечены на карте.
Наказание: Бан от 7 дней.

• 5.4
Запрещен фарм очков/КД (откидывать всем подряд спалки под предлогом раздачи ресурсов и не только и убивать их).
Наказание: Пред/бан игрока от 14 дней.

• 5.5
Запрещены прозрачные/полупрозрачные сеты.
Наказание: Словесное предупреждение/пред/бан.

• 5.6
Запрещены союзы между кланами.
Наказание: Снятие/бан.

• 5.8
Запрещено кидалово в любом виде.
Наказание: Бан от 7 дней.

• 5.9
Запрещен DDoS сервера.
Наказание: Бан навсегда.""",
        },
        {
            "value": "trade",
            "label": "Товары и услуги",
            "description": "Правила категории Товары и услуги",
            "title": "Политика товаров и услуг:",
            "body": """• 6.1
При покупке товара/услуги на один аккаунт, при блокировке аккаунта товар/услуги не переносятся.

• 6.2
При утере данных от аккаунта с товаром/услугой, возврата на новый аккаунт не будет без весомых доказательств.""",
        },
        {
            "value": "limits",
            "label": "Лимиты объектов",
            "description": "Правила категории Лимиты объектов",
            "title": "Лимиты объектов:",
            "body": """**Пресеты лимитов для вайпов:**

• **m1** — Объекты: 800, Турели: 15, ПВО: 1, Игроки: 1
• **m2** — Объекты: 1700, Турели: 21, ПВО: 2, Игроки: 2  
• **m3** — Объекты: 2300, Турели: 26, ПВО: 3, Игроки: 3
• **m4** — Объекты: 3000, Турели: 30, ПВО: 3, Игроки: 4
• **m5** — Объекты: 3500, Турели: 35, ПВО: 3, Игроки: 5""",
        },
    ]
    URL_PATTERN = re.compile(r"https?://\S+")
    WIPE_TZ_OFFSET_HOURS = int(os.getenv("WIPE_TZ_OFFSET_HOURS", "3"))
    # Отображаемый лимит игроков в команде (если не задан в пресете)
    WIPE_TEAM_SIZE_DEFAULT = int(os.getenv("WIPE_TEAM_SIZE_DEFAULT", "5"))
    WIPE_PRESETS: list[dict[str, object]] = [
        {"key": "team4", "label": "Командный лимит: 4 игрока", "players": 4},
        {"key": "team5", "label": "Командный лимит: 5 игроков", "players": 5},
        {"key": "team6", "label": "Командный лимит: 6 игроков", "players": 6},
        {"key": "team8", "label": "Командный лимит: 8 игроков", "players": 8},
    ]
    WIPE_LIMITS_PRESETS: dict[str, dict[str, int]] = {
        "m1": {"objects": 800, "turrets": 15, "sam": 1, "players": 1},
        "m2": {"objects": 1700, "turrets": 21, "sam": 2, "players": 2},
        "m3": {"objects": 2300, "turrets": 26, "sam": 3, "players": 3},
        "m4": {"objects": 3000, "turrets": 30, "sam": 3, "players": 4},
        "m5": {"objects": 3500, "turrets": 35, "sam": 3, "players": 5},
    }

    bot = commands.Bot(command_prefix=prefix, intents=intents)
    bot.remove_command("help")
    bot.invite_cache: dict[int, dict[str, int]] = {}
    bot.member_inviters: dict[int, int] = {}
    bot.automod_deleted_messages: dict[int, str] = {}
    bot.tree_synced = False
    bot.rust_status_task: asyncio.Task | None = None
    bot.members_scan_task: asyncio.Task | None = None
    bot.wipe_announcement_count: dict[int, int] = {}  # user_id -> count
    bot.rules_usage_stats: dict[int, dict[str, int]] = {}  # user_id -> {category: count}
    
    # База данных (если включена)
    bot.db: Optional[Database] = None
    if DATABASE_ENABLED:
        try:
            bot.db = get_database()
            logging.info("Database connection established successfully")
        except Exception as db_init_exc:
            logging.error(f"Failed to initialize database: {db_init_exc}")
            bot.db = None

    def iter_target_members(ctx: commands.Context) -> list[discord.Member]:
        if guild_id and ctx.guild and ctx.guild.id != guild_id:
            raise commands.CheckFailure("This command is not available in this server.")
        assert ctx.guild is not None
        return [member for member in ctx.guild.members if not member.bot]

    # Фоновая задача для автоудаления каналов с обратным отсчетом
    @tasks.loop(seconds=1.0)
    async def auto_delete_channels_task():
        """Проверяет каналы на автоудаление каждую секунду и обновляет обратный отсчет"""
        if not bot.db:
            return
        
        try:
            # Получаем все каналы для проверки
            channels_to_check = await bot.db.get_channels_to_delete()
            
            for channel_data in channels_to_check:
                channel_id = channel_data["channel_id"]
                guild_id_db = channel_data["guild_id"]
                delete_at_str = channel_data["delete_at"]
                
                # Парсим время удаления
                from datetime import datetime
                delete_at = datetime.fromisoformat(delete_at_str.replace('Z', '+00:00'))
                now = datetime.now(delete_at.tzinfo)
                
                time_left_seconds = int((delete_at - now).total_seconds())
                
                # Получаем канал
                guild = bot.get_guild(guild_id_db)
                if not guild:
                    await bot.db.mark_channel_as_deleted(channel_id)
                    continue
                
                channel = guild.get_channel(channel_id)
                if not channel or not isinstance(channel, discord.TextChannel):
                    await bot.db.mark_channel_as_deleted(channel_id)
                    continue
                
                # Если время вышло - удаляем канал
                if time_left_seconds <= 0:
                    try:
                        await channel.delete(reason="Автоудаление: время истекло, активности не было")
                        await bot.db.mark_channel_as_deleted(channel_id)
                        logging.info(f"Auto-deleted channel {channel_id} ({channel.name})")
                        
                        # Логируем событие в аналитику
                        if bot.db:
                            await bot.db.log_event(
                                guild_id=guild_id_db,
                                event_type="channel_deleted",
                                event_data={"channel_id": channel_id, "channel_name": channel.name}
                            )
                    except (discord.Forbidden, discord.HTTPException) as exc:
                        logging.error(f"Failed to delete channel {channel_id}: {exc}")
                        await bot.db.mark_channel_as_deleted(channel_id)
                    continue
                
                # Обновляем сообщение с обратным отсчетом (каждые 5 секунд чтобы не спамить)
                if time_left_seconds % 5 == 0 or time_left_seconds <= 10:
                    minutes = time_left_seconds // 60
                    seconds = time_left_seconds % 60
                    
                    countdown_message = f"⏰ **Этот канал будет автоматически удален через {minutes}м {seconds}с**\n"
                    countdown_message += f"Если продолжается обсуждение, отправьте любое сообщение, чтобы сбросить таймер."
                    
                    # Ищем или создаем пинованное сообщение с таймером
                    try:
                        pins = await channel.pins()
                        timer_msg = None
                        for pin in pins:
                            if pin.author == bot.user and "⏰" in pin.content:
                                timer_msg = pin
                                break
                        
                        if timer_msg:
                            await timer_msg.edit(content=countdown_message)
                        elif time_left_seconds == 3600 or time_left_seconds % 300 == 0:  # Пинуем каждые 5 минут или при старте
                            msg = await channel.send(countdown_message)
                            try:
                                await msg.pin(reason="Таймер автоудаления")
                            except discord.HTTPException:
                                pass  # Не критично если не удалось запинить
                    except (discord.Forbidden, discord.HTTPException) as exc:
                        logging.debug(f"Could not update countdown in channel {channel_id}: {exc}")
        
        except Exception as exc:
            logging.error(f"Error in auto_delete_channels_task: {exc}")
    
    @auto_delete_channels_task.before_loop
    async def before_auto_delete_task():
        """Ждем пока бот полностью загрузится"""
        await bot.wait_until_ready()
    
    async def restore_persistent_views():
        """Восстанавливает Views для существующих каналов после перезапуска бота"""
        logging.info("Restoring persistent views for existing channels...")
        
        for guild in bot.guilds:
            if guild_id and guild.id != guild_id:
                continue
            
            # Ищем каналы с заявками (разные типы)
            for channel in guild.text_channels:
                try:
                    async for message in channel.history(limit=50):
                        if message.author != bot.user or not message.embeds:
                            continue
                        embed = message.embeds[0]

                        # Восстановление: турнирная роль
                        if embed.title and "Заявка на роль за турнир" in embed.title:
                            status_field = next((f.value for f in embed.fields if f.name == "Статус"), None)
                            if status_field and "Ожидание" in status_field:
                                role_name = next((f.value for f in embed.fields if f.name == "Название роли"), "")
                                role_color = next((f.value for f in embed.fields if f.name == "Цвет роли"), "").replace('#','')
                                tournament_info = next((f.value for f in embed.fields if f.name == "Информация о турнире"), "")
                                applicant_id = None
                                if embed.description:
                                    import re
                                    m = re.search(r"<@!?(\d+)>", embed.description)
                                    if m:
                                        applicant_id = int(m.group(1))
                                if applicant_id and role_name and role_color:
                                    await message.edit(view=TournamentRoleApprovalView(
                                        applicant_id=applicant_id,
                                        role_name=role_name,
                                        role_color=role_color,
                                        channel_id=channel.id,
                                        tournament_info=tournament_info
                                    ))
                                    logging.info("Restored TournamentRoleApprovalView in %s", channel.id)
                            break

                        # Восстановление: заявки помощи/модератора/админа/разбана
                        titles_map = {
                            "Заявка на помощь": "помощь",
                            "Заявка на модератора": "модератора",
                            "Заявка на администратора": "администратора",
                            "Заявка на разбан": "разбан",
                        }
                        for t, app_type in titles_map.items():
                            if embed.title and t in embed.title:
                                # Если есть поле Статус и оно не финальное — восстановим View
                                status_field = next((f.value for f in embed.fields if f.name == "Статус"), None)
                                if status_field and ("Ожидание" in status_field or "Одобрено" not in status_field and "Отказ" not in status_field):
                                    applicant_id = None
                                    if embed.description:
                                        import re
                                        m = re.search(r"<@!?(\d+)>", embed.description)
                                        if m:
                                            applicant_id = int(m.group(1))
                                    if applicant_id:
                                        await message.edit(view=ApplicationStatusView(applicant_id, app_type))
                                        logging.info("Restored ApplicationStatusView (%s) in %s", app_type, channel.id)
                                break
                except discord.HTTPException as exc:
                    logging.error("Failed to restore view for channel %s: %s", channel.id, exc)
        
        logging.info("Persistent views restoration completed")

    @bot.event
    async def on_ready() -> None:
        logging.info("Logged in as %s (ID: %s)", bot.user, bot.user.id if bot.user else "unknown")
        
        # Выводим информацию о доступных командах при запуске
        print("=" * 50)
        print("БОТ ЗАПУЩЕН УСПЕШНО!")
        print("=" * 50)
        print("ДОСТУПНЫЕ КОМАНДЫ:")
        print()
        
        # Префикс-команды
        prefix_commands = []
        for command in sorted(bot.commands, key=lambda c: c.name):
            if command.hidden:
                continue
            description = command.help or command.brief or command.short_doc or "Без описания"
            if description.strip().lower() == "no help available.":
                description = "Без описания"
            description = description.replace("`", "")
            prefix_commands.append(f"  {prefix}{command.name} — {description}")
        
        if prefix_commands:
            print("ПРЕФИКС-КОМАНДЫ:")
            for cmd in prefix_commands:
                print(cmd)
            print()
        
        # Slash-команды
        slash_commands = []
        for command in sorted(bot.tree.get_commands(), key=lambda c: c.qualified_name):
            description = command.description or "Без описания"
            description = description.replace("`", "")
            note = ""
            if command.name == "clear":
                note = " (доступно владельцу сервера)"
            slash_commands.append(f"  /{command.qualified_name} — {description}{note}")
        
        if slash_commands:
            print("SLASH-КОМАНДЫ:")
            for cmd in slash_commands:
                try:
                    print(cmd)
                except UnicodeEncodeError:
                    # Удаляем эмодзи для Windows консоли
                    import re
                    clean_cmd = re.sub(r'[^\x00-\x7F]+', '', cmd)
                    print(clean_cmd)
            print()
        
        print("=" * 50)
        print("Бот готов к работе!")
        print("=" * 50)
        
        if guild_id:
            guild = bot.get_guild(guild_id)
            if guild:
                logging.info("Connected to guild: %s (%s)", guild.name, guild.id)
            else:
                logging.warning("Guild with ID %s not found in bot cache.", guild_id)
        for ready_guild in bot.guilds:
            if guild_id and ready_guild.id != guild_id:
                continue
            try:
                invites = await ready_guild.invites()
            except discord.Forbidden:
                logging.warning(
                    "Missing permissions to read invites for guild %s (%s)",
                    ready_guild.name,
                    ready_guild.id,
                )
                bot.invite_cache[ready_guild.id] = {}
            except discord.HTTPException as exc:
                logging.error(
                    "Failed to fetch invites for guild %s (%s): %s",
                    ready_guild.name,
                    ready_guild.id,
                    exc,
                )
            else:
                bot.invite_cache[ready_guild.id] = {
                    invite.code: invite.uses or 0 for invite in invites
                }

            await ensure_command_reference(ready_guild)

        if not bot.tree_synced:
            try:
                if guild_id:
                    await bot.tree.sync(guild=discord.Object(id=guild_id))
                else:
                    await bot.tree.sync()
            except discord.HTTPException as exc:
                logging.error("Failed to sync application commands: %s", exc)
            else:
                bot.tree_synced = True
                logging.info("Application commands synced successfully.")
                for ready_guild in bot.guilds:
                    if guild_id and ready_guild.id != guild_id:
                        continue
                    await ensure_command_reference(ready_guild)
        
        # Запускаем фоновую задачу автоудаления каналов
        if bot.db and not auto_delete_channels_task.is_running():
            auto_delete_channels_task.start()
        
        # Восстанавливаем persistent views для существующих каналов
        await restore_persistent_views()

    def get_log_channel(guild: discord.Guild) -> discord.TextChannel | None:
        channel = guild.get_channel(LOG_CHANNEL_ID)
        return channel if isinstance(channel, discord.TextChannel) else None

    async def send_dm(
        member: discord.Member,
        *,
        content: str | None = None,
        embed: discord.Embed | None = None,
        embed_factory: Callable[[], discord.Embed] | None = None,
        view_factory: Callable[[], discord.ui.View] | None = None,
    ) -> bool:
        built_embed = embed_factory() if embed_factory else embed
        view = view_factory() if view_factory else None
        if content is None and built_embed is None:
            raise ValueError("Either content or embed must be provided for DM.")
        try:
            await member.send(content=content, embed=built_embed, view=view)
            return True
        except discord.Forbidden:
            logging.warning("Cannot message %s (%s) - DMs disabled.", member.display_name, member.id)
            return False
        except discord.HTTPException as exc:
            logging.error("Failed to message %s (%s): %s", member.display_name, member.id, exc)
            return False

    async def send_log_embed(
        guild: discord.Guild,
        *,
        title: str,
        description: str,
        color: discord.Color,
        fields: Iterable[tuple[str, str, bool]] | None = None,
    ) -> None:
        channel = get_log_channel(guild)
        if channel is None:
            logging.warning(
                "Log channel %s not found or inaccessible in guild %s",
                LOG_CHANNEL_ID,
                guild.id,
            )
            return

        embed = discord.Embed(
            title=title,
            description=description,
            color=color,
            timestamp=discord.utils.utcnow(),
        )
        if fields:
            for name, value, inline in fields:
                embed.add_field(
                    name=name,
                    value=value if value else "—",
                    inline=inline,
                )
        await channel.send(embed=embed)

    async def publish_member_event(
        *,
        guild: discord.Guild,
        title: str,
        description: str,
        inviter_text: str,
        member: discord.abc.User,
        color: discord.Color,
    ) -> None:
        channel = guild.get_channel(MEMBER_EVENTS_CHANNEL_ID)
        if not isinstance(channel, discord.TextChannel):
            logging.warning(
                "Member events channel %s not found or not a text channel in guild %s",
                MEMBER_EVENTS_CHANNEL_ID,
                guild.id,
            )
            return

        embed = discord.Embed(title=title, description=description, color=color)
        embed.add_field(name="Пригласил", value=inviter_text, inline=True)
        embed.add_field(name="Участников сейчас", value=str(guild.member_count), inline=True)

        if isinstance(member, discord.Member):
            avatar = member.display_avatar
            embed.set_footer(text=f"ID: {member.id} • Аккаунт создан {member.created_at:%d.%m.%Y}")
        else:
            avatar = member.display_avatar
            embed.set_footer(text=f"ID: {member.id}")

        if avatar:
            embed.set_thumbnail(url=avatar.url)

        await channel.send(embed=embed)

    def trim_field(value: str, limit: int = 1024) -> str:
        return value if len(value) <= limit else f"{value[:limit-3]}..."

    def message_has_restricted_content(message: discord.Message) -> bool:
        if message.attachments or message.stickers:
            return True
        if URL_PATTERN.search(message.content or ""):
            return True
        # Some embeds appear immediately (e.g., when bots post links)
        if message.embeds:
            return True
        return False

    def prefix_command_lines() -> list[str]:
        lines: list[str] = []
        for command in sorted(bot.commands, key=lambda c: c.name):
            if command.hidden:
                continue
            description = command.help or command.brief or command.short_doc or "Без описания"
            if description.strip().lower() == "no help available.":
                description = "Без описания"
            description = description.replace("`", "")
            lines.append(f"`{prefix}{command.name}` — {description}")
        return lines

    def slash_command_lines() -> list[str]:
        lines: list[str] = []
        for command in sorted(bot.tree.get_commands(), key=lambda c: c.qualified_name):
            description = command.description or "Без описания"
            description = description.replace("`", "")
            note = ""
            if command.name == "clear":
                note = " (доступно владельцу сервера)"
            lines.append(f"`/{command.qualified_name}` — {description}{note}")
        return lines

    async def build_command_message() -> tuple[str, discord.Embed]:
        now = discord.utils.utcnow()
        content = f"{COMMAND_LIST_HEADER}\nОбновлено: <t:{int(now.timestamp())}:R>"

        embed = discord.Embed(
            title="Список команд",
            description="Все актуальные команды бота.",
            color=discord.Color.gold(),
            timestamp=now,
        )

        prefix_lines = prefix_command_lines()
        slash_lines = slash_command_lines()

        if prefix_lines:
            embed.add_field(
                name="Префикс-команды",
                value="\n".join(prefix_lines),
                inline=False,
            )
        if slash_lines:
            embed.add_field(
                name="Slash-команды",
                value="\n".join(slash_lines),
                inline=False,
            )

        embed.set_footer(text="Сообщение обновляется автоматически.")
        return content, embed

    async def ensure_command_reference(guild: discord.Guild) -> None:
        channel: discord.abc.GuildChannel | None = guild.get_channel(COMMAND_LIST_CHANNEL_ID)
        if channel is None:
            channel = bot.get_channel(COMMAND_LIST_CHANNEL_ID)
        if channel is None:
            try:
                channel = await guild.fetch_channel(COMMAND_LIST_CHANNEL_ID)
            except discord.Forbidden:
                logging.warning(
                    "Command list channel %s exists but бот не имеет доступа в guild %s",
                    COMMAND_LIST_CHANNEL_ID,
                    guild.id,
                )
                return
            except discord.HTTPException as exc:
                logging.error(
                    "Failed to fetch command list channel %s in guild %s: %s",
                    COMMAND_LIST_CHANNEL_ID,
                    guild.id,
                    exc,
                )
                return

        if not isinstance(channel, discord.TextChannel):
            logging.warning(
                "Command list channel %s not found or not a text channel in guild %s",
                COMMAND_LIST_CHANNEL_ID,
                guild.id,
            )
            return

        content, embed = await build_command_message()

        pins: list[discord.Message] = []
        try:
            async for message in channel.pins():
                pins.append(message)
        except discord.HTTPException as exc:
            logging.error("Failed to iterate pins in channel %s: %s", channel.id, exc)
            return

        target_message: discord.Message | None = None
        duplicates: list[discord.Message] = []
        for message in pins:
            if message.author == bot.user and COMMAND_LIST_HEADER in (message.content or ""):
                if target_message is None:
                    target_message = message
                else:
                    duplicates.append(message)

        for duplicate in duplicates:
            try:
                await duplicate.unpin()
            except discord.HTTPException as exc:
                logging.warning("Failed to unpin duplicate command message %s: %s", duplicate.id, exc)

        if target_message:
            existing_embed = target_message.embeds[0].to_dict() if target_message.embeds else None
            needs_update = (target_message.content != content) or (existing_embed != embed.to_dict())
            if needs_update:
                try:
                    await target_message.edit(content=content, embed=embed)
                except discord.HTTPException as exc:
                    logging.error("Failed to edit command list message %s: %s", target_message.id, exc)
        else:
            try:
                message = await channel.send(content=content, embed=embed)
            except discord.HTTPException as exc:
                logging.error("Failed to send command list message in channel %s: %s", channel.id, exc)
                return
            try:
                await message.pin()
            except discord.HTTPException as exc:
                logging.warning("Failed to pin command list message %s: %s", message.id, exc)

    _A2S_INFO_REQUEST = b"\xFF\xFF\xFF\xFFTSource Engine Query\x00"

    def _query_source_info_blocking(host: str, port: int, *, timeout: float) -> bytes:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(timeout)
            sock.sendto(_A2S_INFO_REQUEST, (host, port))
            data, _ = sock.recvfrom(4096)
            if len(data) >= 5 and data[4] == 0x41:  # Challenge
                challenge = data[5:9]
                sock.sendto(_A2S_INFO_REQUEST + challenge, (host, port))
                data, _ = sock.recvfrom(4096)
            return data

    def _parse_source_info(payload: bytes) -> dict[str, object]:
        if len(payload) < 5 or payload[4:5] != b"I":
            raise ValueError("Unexpected A2S_INFO response.")

        offset = 5

        def read_uint8() -> int:
            nonlocal offset
            if offset >= len(payload):
                raise ValueError("Unexpected end of payload.")
            value = payload[offset]
            offset += 1
            return value

        def read_uint16() -> int:
            nonlocal offset
            if offset + 2 > len(payload):
                raise ValueError("Unexpected end of payload.")
            value = struct.unpack_from("<H", payload, offset)[0]
            offset += 2
            return value

        def read_string() -> str:
            nonlocal offset
            end = payload.find(b"\x00", offset)
            if end == -1:
                raise ValueError("String terminator not found.")
            value = payload[offset:end].decode("utf-8", errors="replace")
            offset = end + 1
            return value

        _protocol = read_uint8()
        name = read_string()
        _map_name = read_string()
        _folder = read_string()
        game = read_string()
        _app_id = read_uint16()
        players = read_uint8()
        max_players = read_uint8()
        _bots = read_uint8()
        _server_type = read_uint8()
        _environment = read_uint8()
        _visibility = read_uint8()
        _vac = read_uint8()
        version = read_string()

        return {
            "name": name,
            "game": game,
            "players": players,
            "max_players": max_players,
            "version": version,
        }

    async def query_rust_server(host: str, port: int) -> dict[str, object]:
        attempts = []
        if RUST_QUERY_PORT is not None:
            attempts.append(RUST_QUERY_PORT)
        attempts.append(port)
        if port < 65535 and (RUST_QUERY_PORT is None or RUST_QUERY_PORT != port + 1):
            attempts.append(port + 1)
        errors: list[str] = []

        for attempt_port in attempts:
            try:
                payload = await asyncio.to_thread(
                    _query_source_info_blocking,
                    host,
                    attempt_port,
                    timeout=3.0,
                )
                info = _parse_source_info(payload)
                info["query_port"] = attempt_port
                return info
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{attempt_port}: {exc}")

        raise RuntimeError(f"Rust server query failed ({'; '.join(errors)})")

    async def rust_presence_worker() -> None:
        await bot.wait_until_ready()
        while not bot.is_closed():
            try:
                info = await query_rust_server(RUST_SERVER_HOST, RUST_SERVER_PORT)
            except RuntimeError as exc:
                # logging.warning("%s", exc)  # Отключено по запросу пользователя
                await bot.change_presence(
                    status=discord.Status.idle,
                    activity=discord.Activity(
                        type=discord.ActivityType.watching,
                        name="Rust сервер оффлайн",
                    ),
                )
            else:
                name = info.get("name") or "Rust сервер"
                players = info.get("players") or 0
                max_players = info.get("max_players") or 0
                query_port = info.get("query_port")
                logging.info(
                    "Rust server status OK via port %s: %s/%s players (%s)",
                    query_port,
                    players,
                    max_players,
                    name,
                )
                activity_text = f"Rust {players}/{max_players} • {name}"
                if len(activity_text) > 128:
                    activity_text = activity_text[:125] + "..."
                await bot.change_presence(
                    status=discord.Status.online,
                    activity=discord.Game(activity_text),
                )
            try:
                await asyncio.sleep(RUST_STATUS_INTERVAL)
            except asyncio.CancelledError:
                break

    @bot.event
    async def setup_hook() -> None:
        if bot.rust_status_task is None:
            bot.rust_status_task = asyncio.create_task(rust_presence_worker())
        if DATABASE_ENABLED and bot.members_scan_task is None:
            bot.members_scan_task = asyncio.create_task(members_scan_worker())

    async def members_scan_worker() -> None:
        """Периодически сканирует участников гильдии и логирует их количество."""
        await bot.wait_until_ready()
        interval = 300  # 5 минут
        while not bot.is_closed():
            try:
                for g in bot.guilds:
                    if guild_id and g.id != guild_id:
                        continue
                    if not bot.db:
                        continue
                    # собираем членов
                    members_payload: list[dict[str, object]] = []
                    async for member in g.fetch_members(limit=None):
                        members_payload.append({
                            "member_id": member.id,
                            "username": str(member.name),
                            "display_name": str(member.display_name),
                            "is_bot": bool(member.bot),
                            "joined_at": (member.joined_at.isoformat() if member.joined_at else None),
                        })
                    await bot.db.upsert_guild_members(g.id, members_payload)
                    await bot.db.log_member_count(g.id, g.member_count or len(members_payload))
            except Exception as exc:  # noqa: BLE001
                logging.error("members_scan_worker error: %s", exc)
            try:
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break

    def schedule_auto_delete(message: discord.Message, *, delay: int | None = AUTO_DELETE_DELAY_SECONDS) -> None:
        if not delay or delay <= 0:
            return

        async def _delete_later() -> None:
            try:
                await asyncio.sleep(delay)
                await message.delete()
            except asyncio.CancelledError:
                return
            except discord.NotFound:
                pass
            except discord.HTTPException as exc:
                logging.debug("Failed to auto-delete message %s: %s", message.id, exc)

        asyncio.create_task(_delete_later())

    class DismissView(discord.ui.View):
        def __init__(self, *, author_id: int, timeout: float | None = 120) -> None:
            super().__init__(timeout=timeout)
            self.author_id = author_id

        @discord.ui.button(
            label="Скрыть сообщение",
            style=discord.ButtonStyle.danger,
            emoji="🗑️",
            custom_id="dismiss_button",
        )
        async def dismiss(
            self,
            interaction: discord.Interaction,
            button: discord.ui.Button,
        ) -> None:
            if interaction.user.id != self.author_id and not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message(
                    "Только автор или модератор может скрыть это сообщение.",
                    ephemeral=True,
                )
                return

            await interaction.response.send_message("Сообщение скрыто.", ephemeral=True)
            try:
                await interaction.message.delete()
            except discord.HTTPException as exc:
                logging.warning("Failed to delete help message %s: %s", interaction.message.id, exc)

    class LimitsPresetSelect(discord.ui.Select):
        def __init__(self, *, author_id: int) -> None:
            options = [
                discord.SelectOption(label="m1", value="m1", description="a=800 t=15 p=1"),
                discord.SelectOption(label="m2", value="m2", description="a=1700 t=21 p=2"),
                discord.SelectOption(label="m3", value="m3", description="a=2300 t=26 p=3"),
                discord.SelectOption(label="m4", value="m4", description="a=3000 t=30 p=3"),
                discord.SelectOption(label="m5", value="m5", description="a=3500 t=35 p=3"),
            ]
            super().__init__(
                placeholder="Выберите пресет лимитов (m1–m5)",
                min_values=1,
                max_values=1,
                options=options,
                custom_id="wipe_limits_preset_select",
            )
            self.author_id = author_id

        async def callback(self, interaction: discord.Interaction) -> None:
            if interaction.user.id != self.author_id and not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message(
                    "Только автор или модератор может использовать это меню.",
                    ephemeral=True,
                )
                return

            key = self.values[0]
            if key not in WIPE_LIMITS_PRESETS:
                await interaction.response.send_message("Пресет лимитов не найден.", ephemeral=True)
                return
            view = self.view
            if isinstance(view, WipeView):
                view.selected_limits_key = key
            await interaction.response.send_message(
                f"Выбран пресет лимитов: {key}.",
                ephemeral=True,
            )

    class ProceedButton(discord.ui.Button):
        def __init__(self, *, author_id: int) -> None:
            super().__init__(
                label="Далее",
                style=discord.ButtonStyle.primary,
                emoji="➡️",
                custom_id="wipe_proceed_button",
            )
            self.author_id = author_id

        async def callback(self, interaction: discord.Interaction) -> None:
            if interaction.user.id != self.author_id and not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message(
                    "Только автор или модератор может продолжить.",
                    ephemeral=True,
                )
                return

            view = self.view
            if not isinstance(view, WipeView):
                await interaction.response.send_message("Внутренняя ошибка: view не найден.", ephemeral=True)
                return

            if view.selected_limits_key is None:
                await interaction.response.send_message(
                    "Выберите пресет m1–m5, затем нажмите 'Далее'.",
                    ephemeral=True,
                )
                return

            try:
                await interaction.response.send_modal(
                    WipeTimeModal(author_id=self.author_id, limits_key=view.selected_limits_key)
                )
            except Exception as exc:  # noqa: BLE001
                logging.error("Failed to open WipeTimeModal: %s", exc)
                await interaction.followup.send(
                    "Не удалось открыть окно ввода времени. Попробуйте ещё раз.",
                    ephemeral=True,
                )

    class WipeView(discord.ui.View):
        def __init__(self, *, author_id: int, timeout: float | None = 300) -> None:
            super().__init__(timeout=timeout)
            self.author_id = author_id
            self.selected_limits_key: str | None = None
            self.add_item(LimitsPresetSelect(author_id=author_id))
            self.add_item(ProceedButton(author_id=author_id))

    class WipeTimeModal(discord.ui.Modal, title="Время вайпа"):
        def __init__(self, *, author_id: int, limits_key: str) -> None:
            super().__init__()
            self.author_id = author_id
            self.limits_key = limits_key

            self.time_input = discord.ui.TextInput(
                label="Время (ЧЧ:ММ, МСК)",
                placeholder="Например: 19:00",
                style=discord.TextStyle.short,
                required=True,
            )

            self.add_item(self.time_input)

        async def on_submit(self, interaction: discord.Interaction) -> None:
            if interaction.user.id != self.author_id and not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message(
                    "Только автор или модератор может отправить объявление.",
                    ephemeral=True,
                )
                return

            if interaction.guild is None:
                await interaction.response.send_message("Команда доступна только на сервере.", ephemeral=True)
                return

            raw = (self.time_input.value or "").strip()
            try:
                hhmm = datetime.datetime.strptime(raw, "%H:%M")
            except ValueError:
                await interaction.response.send_message(
                    "Не удалось распознать время. Используй формат ЧЧ:ММ (МСК).",
                    ephemeral=True,
                )
                return

            now_local = datetime.datetime.now()
            parsed_local = now_local.replace(hour=hhmm.hour, minute=hhmm.minute, second=0, microsecond=0)

            # Переведём локальное (МСК) время в UTC для правильных таймстампов в Discord
            wipe_dt_utc = parsed_local - datetime.timedelta(hours=WIPE_TZ_OFFSET_HOURS)
            wipe_dt_utc = wipe_dt_utc.replace(tzinfo=datetime.timezone.utc)

            limits = WIPE_LIMITS_PRESETS.get(self.limits_key)
            if limits is None:
                await interaction.response.send_message("Выбранный пресет лимитов не найден.", ephemeral=True)
                return

            try:
                await interaction.response.defer(ephemeral=True, thinking=True)
                message = await send_wipe_message(
                    interaction.guild,
                    wipe_time=wipe_dt_utc,
                    limits=limits,
                    user_id=interaction.user.id,
                )
            except discord.HTTPException as exc:
                logging.error("Failed to send wipe announcement: %s", exc)
                await interaction.followup.send(
                    "Не удалось отправить объявление из-за ошибки Discord.",
                    ephemeral=True,
                )
                return

            await interaction.followup.send(
                f"Готово. Объявление отправлено в {message.channel.mention}.",
                ephemeral=True,
            )
            # Запланируем напоминания
            asyncio.create_task(
                schedule_wipe_reminders(
                    interaction.guild,
                    wipe_dt_utc,
                    limits=limits,
                )
            )
            
            # Логируем создание вайпа в аналитику
            if bot.db:
                await bot.db.log_event(
                    guild_id=interaction.guild.id,
                    event_type="wipe_created",
                    event_data={
                        "wipe_time": wipe_dt_utc.isoformat(),
                        "limits": limits,
                        "author_id": interaction.user.id
                    }
                )

    def _emoji_or_text(guild: discord.Guild | None, name: str, fallback: str) -> str:
        if guild is None:
            return fallback
        emoji = discord.utils.get(guild.emojis, name=name)
        return str(emoji) if emoji else fallback

    def build_wipe_announce_embed(
        *,
        guild: discord.Guild | None,
        limits: dict[str, int],
        wipe_time: datetime.datetime,
    ) -> discord.Embed:
        title_emoji = _emoji_or_text(guild, "wipe", ":wipe:")
        embed = discord.Embed(
            title=f"{title_emoji} Объявление о вайпе",
            description=(
                "Вайп сервера. Ниже указаны выбранные лимиты."
            ),
            color=discord.Color.orange(),
            timestamp=discord.utils.utcnow(),
        )
        # Время вайпа — абсолютный и относительный формат
        when_abs = discord.utils.format_dt(wipe_time, style="F")
        when_rel = discord.utils.format_dt(wipe_time, style="R")
        msk_time = (wipe_time + datetime.timedelta(hours=WIPE_TZ_OFFSET_HOURS)).strftime("%H:%M")
        embed.add_field(name="Время вайпа", value=f"{when_abs} ({when_rel})\nМСК: {msk_time}", inline=False)

        # Поля: Объекты, Турели, ПВО с эмодзи при наличии
        building_emoji = _emoji_or_text(guild, "building", ":building:")
        autoturret_emoji = _emoji_or_text(guild, "autoturret", ":autoturret:")
        samsite_emoji = _emoji_or_text(guild, "samsite", ":samsite:")
        players_emoji = _emoji_or_text(guild, "players", ":players:")
        team_size = int(limits.get("players", WIPE_TEAM_SIZE_DEFAULT))

        embed.add_field(name=f"{building_emoji} Объекты", value=str(limits.get("objects", "—")), inline=True)
        embed.add_field(name=f"{autoturret_emoji} Турели", value=str(limits.get("turrets", "—")), inline=True)
        embed.add_field(name=f"{samsite_emoji} ПВО", value=str(limits.get("sam", "—")), inline=True)
        embed.add_field(name=f"{players_emoji} Игроки", value=str(team_size), inline=True)

        # Добавляем детальный раздел лимитов
        limits_description = "**Лимиты объектов:**\n"
        limits_description += f"• Объекты: {limits.get('objects', '—')}\n"
        limits_description += f"• Турели: {limits.get('turrets', '—')}\n"
        limits_description += f"• ПВО: {limits.get('sam', '—')}\n"
        limits_description += f"• Игроков в команде: {team_size}\n\n"
        limits_description += "**Важно:**\n"
        limits_description += "• Соблюдайте лимиты объектов при строительстве\n"
        limits_description += "• Не превышайте количество турелей и ПВО\n"
        limits_description += "• Команда не должна превышать указанное количество игроков"
        
        embed.add_field(name="📋 Детальные лимиты", value=limits_description, inline=False)

        embed.set_footer(text="Нажми кнопку, чтобы скрыть сообщение.")
        return embed

    async def send_wipe_message(
        guild: discord.Guild,
        *,
        wipe_time: datetime.datetime,
        limits: dict[str, int],
        user_id: int,
    ) -> discord.Message:
        channel = guild.get_channel(ANNOUNCE_CHANNEL_ID)
        if not isinstance(channel, discord.TextChannel):
            logging.warning("Announcement channel %s not found in guild %s", ANNOUNCE_CHANNEL_ID, guild.id)
            raise discord.HTTPException(response=None, message="Announcement channel not found")

        embed = build_wipe_announce_embed(
            guild=guild,
            limits=limits,
            wipe_time=wipe_time,
        )

        message = await channel.send(content="@everyone", embed=embed, view=DismissView(author_id=guild.owner_id or 0))
        try:
            await message.pin()
        except discord.HTTPException as exc:
            logging.warning("Failed to pin wipe announcement %s: %s", message.id, exc)

        # Автоудаление объявления через час после времени вайпа
        now = discord.utils.utcnow().replace(tzinfo=datetime.timezone.utc)
        delete_at = wipe_time + datetime.timedelta(hours=1)
        delay = (delete_at - now).total_seconds()
        if delay > 0:
            async def _delete_later(msg: discord.Message, wait: float) -> None:
                try:
                    await asyncio.sleep(wait)
                    await msg.delete()
                except Exception as exc:
                    logging.warning("Failed to auto-delete wipe announcement %s: %s", msg.id, exc)
            asyncio.create_task(_delete_later(message, delay))

        # Обновляем счетчик объявлений вайпов
        if hasattr(bot, 'wipe_announcement_count'):
            bot.wipe_announcement_count[user_id] = bot.wipe_announcement_count.get(user_id, 0) + 1
            total_wipes = bot.wipe_announcement_count[user_id]
        else:
            total_wipes = 1

        user_mention = f"<@{user_id}>"
        await send_log_embed(
            guild,
            title="📣 Объявление о вайпе",
            description=f"Создано {user_mention} в {channel.mention}.\n🔢 Всего объявлений вайпов этим пользователем: **{total_wipes}**",
            color=discord.Color.orange(),
            fields=[
                ("Объекты", str(limits.get("objects", "—")), True),
                ("Турели", str(limits.get("turrets", "—")), True),
                ("ПВО", str(limits.get("sam", "—")), True),
                ("Время", discord.utils.format_dt(wipe_time, style="F"), True),
                ("Игроки", str(int(limits.get("players", WIPE_TEAM_SIZE_DEFAULT))), True),
            ],
        )

        return message

    async def schedule_wipe_reminders(
        guild: discord.Guild,
        wipe_time: datetime.datetime,
        limits: dict[str, int],
    ) -> None:
        channel = guild.get_channel(ANNOUNCE_CHANNEL_ID)
        if not isinstance(channel, discord.TextChannel):
            logging.warning("Announcement channel %s not found in guild %s", ANNOUNCE_CHANNEL_ID, guild.id)
            return

        now = discord.utils.utcnow().replace(tzinfo=datetime.timezone.utc)
        offsets = [datetime.timedelta(hours=6), datetime.timedelta(hours=1)]

        async def _sleep_and_remind(delay: float, label: str) -> None:
            try:
                await asyncio.sleep(delay)
            except asyncio.CancelledError:
                return
            embed = discord.Embed(
                title="⏰ Напоминание о вайпе",
                description="Подготовьтесь, скоро вайп!",
                color=discord.Color.orange(),
                timestamp=discord.utils.utcnow(),
            )
            when_abs = discord.utils.format_dt(wipe_time, style="F")
            when_rel = discord.utils.format_dt(wipe_time, style="R")
            msk_time = (wipe_time + datetime.timedelta(hours=WIPE_TZ_OFFSET_HOURS)).strftime("%H:%M")
            embed.add_field(name="Время вайпа", value=f"{when_abs} ({when_rel})\nМСК: {msk_time}", inline=False)
            embed.add_field(name="Объекты", value=str(limits.get("objects", "—")), inline=True)
            embed.add_field(name="Турели", value=str(limits.get("turrets", "—")), inline=True)
            embed.add_field(name="ПВО", value=str(limits.get("sam", "—")), inline=True)
            players_emoji = _emoji_or_text(guild, "players", ":players:")
            team_size = int(limits.get("players", WIPE_TEAM_SIZE_DEFAULT))
            embed.add_field(name=f"{players_emoji} Игроки", value=str(team_size), inline=True)
            
            # Добавляем детальный раздел лимитов в напоминание
            limits_description = "**Лимиты объектов:**\n"
            limits_description += f"• Объекты: {limits.get('objects', '—')}\n"
            limits_description += f"• Турели: {limits.get('turrets', '—')}\n"
            limits_description += f"• ПВО: {limits.get('sam', '—')}\n"
            limits_description += f"• Игроков в команде: {team_size}\n\n"
            limits_description += "**Важно:**\n"
            limits_description += "• Соблюдайте лимиты объектов при строительстве\n"
            limits_description += "• Не превышайте количество турелей и ПВО\n"
            limits_description += "• Команда не должна превышать указанное количество игроков"
            
            embed.add_field(name="📋 Детальные лимиты", value=limits_description, inline=False)
            msg = await channel.send(content="@everyone", embed=embed)
            # Автоудаление напоминания через час после времени вайпа
            delete_at = wipe_time + datetime.timedelta(hours=1)
            delay_del = (delete_at - discord.utils.utcnow().replace(tzinfo=datetime.timezone.utc)).total_seconds()
            if delay_del > 0:
                async def _delete_reminder_later(m: discord.Message, wait: float) -> None:
                    try:
                        await asyncio.sleep(wait)
                        await m.delete()
                    except Exception as exc:
                        logging.warning("Failed to auto-delete reminder %s: %s", m.id, exc)
                asyncio.create_task(_delete_reminder_later(msg, delay_del))

        for offset in offsets:
            remind_at = wipe_time - offset
            delay = (remind_at - now).total_seconds()
            if delay > 0:
                asyncio.create_task(_sleep_and_remind(delay, f"за {int(offset.total_seconds()//3600)} ч"))

    class RulesSelect(discord.ui.Select):
        def __init__(self, *, author_id: int) -> None:
            options = [
                discord.SelectOption(
                    label=data["label"],
                    value=data["value"],
                    description=data["description"],
                )
                for data in RULE_CATEGORIES
            ]
            super().__init__(
                placeholder="Выберите категорию правил",
                min_values=1,
                max_values=1,
                options=options,
                custom_id="rules_select",
            )
            self.author_id = author_id
            self.category_map = {data["value"]: data for data in RULE_CATEGORIES}

        async def callback(self, interaction: discord.Interaction) -> None:
            if interaction.user.id != self.author_id and not interaction.user.guild_permissions.manage_messages:
                await interaction.response.send_message(
                    "Только автор или модератор может использовать это меню.",
                    ephemeral=True,
                )
                return

            selected = self.category_map.get(self.values[0])
            if selected is None:
                await interaction.response.send_message("Категория не найдена.", ephemeral=True)
                return

            # Отслеживаем использование
            user_id = interaction.user.id
            category = selected["value"]
            
            if user_id not in bot.rules_usage_stats:
                bot.rules_usage_stats[user_id] = {}
            
            if category not in bot.rules_usage_stats[user_id]:
                bot.rules_usage_stats[user_id][category] = 0
            
            bot.rules_usage_stats[user_id][category] += 1

            embed = discord.Embed(
                title=selected["title"],
                description=selected["body"],
                color=discord.Color.orange(),
                timestamp=discord.utils.utcnow(),
            )

            await interaction.response.send_message(
                content=None,
                embed=embed,
                ephemeral=True,
            )

    class RulesView(discord.ui.View):
        def __init__(self, *, author_id: int, timeout: float | None = 300) -> None:
            super().__init__(timeout=timeout)
            self.author_id = author_id
            self.add_item(RulesSelect(author_id=author_id))

    class TournamentRoleRequestModal(discord.ui.Modal, title="Заявка на роль за турнир"):
        def __init__(self) -> None:
            super().__init__()
            self.role_name = discord.ui.TextInput(
                label="Название роли",
                placeholder="Например: Победители турнира",
                style=discord.TextStyle.short,
                required=True,
                max_length=100
            )
            self.role_color = discord.ui.TextInput(
                label="Цвет роли (HEX)",
                placeholder="Например: #FF5733 или FF5733",
                style=discord.TextStyle.short,
                required=True,
                max_length=7
            )
            self.team_members = discord.ui.TextInput(
                label="Участники команды",
                placeholder="@user1 @user2 или ники через запятую",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=1000
            )
            self.tournament_info = discord.ui.TextInput(
                label="Информация о турнире",
                placeholder="Название турнира, дата, место",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=500
            )
            self.add_item(self.role_name)
            self.add_item(self.role_color)
            self.add_item(self.team_members)
            self.add_item(self.tournament_info)

        async def on_submit(self, interaction: discord.Interaction) -> None:
            if interaction.guild is None:
                await interaction.response.send_message("Команда доступна только на сервере.", ephemeral=True)
                return

            # Валидация цвета
            color_clean = self.role_color.value.strip().lstrip("#")
            if not re.fullmatch(r"[0-9a-fA-F]{6}", color_clean):
                await interaction.response.send_message(
                    "❌ Некорректный формат цвета. Используйте формат #RRGGBB (например: #FF5733)",
                    ephemeral=True
                )
                return

            await interaction.response.send_message(
                "✅ Ваша заявка на роль за турнир отправлена! Ожидайте рассмотрения администрацией.",
                ephemeral=True
            )

            # Создаем приватный канал для заявки
            try:
                guild = interaction.guild
                if guild:
                    # Создаем приватный канал
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(read_messages=False),
                        interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
                    }
                    
                    # Добавляем администраторов в канал
                    for member in guild.members:
                        if member.guild_permissions.administrator:
                            overwrites[member] = discord.PermissionOverwrite(read_messages=True, send_messages=True)
                    
                    channel = await guild.create_text_channel(
                        name=f"role-request-{interaction.user.display_name}",
                        overwrites=overwrites,
                        reason=f"Заявка на роль за турнир от {interaction.user}"
                    )
                    
                    # Отправляем информацию о заявке в приватный канал
                    color_value = int(color_clean, 16)
                    embed = discord.Embed(
                        title="🏆 Заявка на роль за турнир",
                        description=f"Заявка от {interaction.user.mention}",
                        color=discord.Color(color_value),
                        timestamp=discord.utils.utcnow()
                    )
                    embed.add_field(name="Статус", value="⏳ **Ожидание рассмотрения**", inline=False)
                    embed.add_field(name="Название роли", value=self.role_name.value, inline=True)
                    embed.add_field(name="Цвет роли", value=f"#{color_clean}", inline=True)
                    embed.add_field(name="Участники команды (указанные)", value=self.team_members.value, inline=False)
                    embed.add_field(name="Информация о турнире", value=self.tournament_info.value, inline=False)
                    
                    # Создаем превью цвета
                    embed.set_footer(text=f"Цвет роли: #{color_clean}")
                    
                    await channel.send(
                        embed=embed,
                        view=TournamentRoleApprovalView(
                            applicant_id=interaction.user.id,
                            role_name=self.role_name.value,
                            role_color=color_clean,
                            channel_id=channel.id,
                            tournament_info=self.tournament_info.value
                        )
                    )
                    # Пытаемся найти и отметить участников из указанных ников
                    member_mentions = []
                    members_text = self.team_members.value
                    
                    # Ищем упоминания формата @username или <@ID>
                    mention_ids = re.findall(r"<@!?(\d+)>", members_text)
                    for user_id in mention_ids:
                        try:
                            member = await guild.fetch_member(int(user_id))
                            if member and not member.bot:
                                member_mentions.append(member.mention)
                        except (discord.NotFound, discord.HTTPException):
                            pass
                    
                    # Ищем по никам (разделитель - запятая, пробел, перенос строки)
                    usernames = re.split(r'[,\n\s]+', members_text.replace('@', '').strip())
                    for username in usernames:
                        username = username.strip()
                        if username and not username.isdigit():  # Пропускаем ID
                            # Ищем по имени пользователя
                            found_member = None
                            for member in guild.members:
                                if not member.bot and (
                                    member.name.lower() == username.lower() or
                                    member.display_name.lower() == username.lower() or
                                    (member.global_name and member.global_name.lower() == username.lower())
                                ):
                                    found_member = member
                                    break
                            
                            if found_member and found_member.mention not in member_mentions:
                                member_mentions.append(found_member.mention)
                    
                    # Отправляем сообщения
                    await channel.send(
                        f"{interaction.user.mention}, ваша заявка создана. Ожидайте рассмотрения администрацией."
                    )
                    
                    if member_mentions:
                        # Добавляем найденных участников в канал (даем права на чтение/запись)
                        for mention in member_mentions:
                            # Извлекаем ID из упоминания
                            member_id_match = re.search(r'<@!?(\d+)>', mention)
                            if member_id_match:
                                member_id = int(member_id_match.group(1))
                                member = guild.get_member(member_id)
                                if member:
                                    try:
                                        await channel.set_permissions(
                                            member,
                                            read_messages=True,
                                            send_messages=True,
                                            reason="Участник турнирной команды"
                                        )
                                    except discord.HTTPException as exc:
                                        logging.warning("Failed to add permissions for member %s: %s", member_id, exc)
                        
                        await channel.send(
                            f"**🎯 Участники команды (найдены автоматически):**\n" + " ".join(member_mentions) +
                            f"\n\n*Все участники добавлены в канал и могут видеть обсуждение.*\n"
                            f"*Администрация может добавить или убрать участников, отметив их здесь.*"
                        )
                    else:
                        await channel.send(
                            f"**⚠️ Участники не найдены автоматически.**\n"
                            f"**Администрация:** Отметьте всех участников команды через @упоминание, "
                            f"чтобы им была выдана роль. Например: @user1 @user2 @user3"
                        )
                    
            except discord.Forbidden:
                logging.warning("Missing permissions to create channel for tournament role request")
            except discord.HTTPException as exc:
                logging.error("Failed to create channel for tournament role request: %s", exc)
            
            # Отправляем в лог
            await send_log_embed(
                interaction.guild,
                title="🏆 Заявка на роль за турнир",
                description=f"{interaction.user.mention} подал(а) заявку на создание роли за турнир",
                color=discord.Color(color_value),
                fields=[
                    ("Название роли", self.role_name.value, True),
                    ("Цвет роли", f"#{color_clean}", True),
                    ("Участники (указанные)", self.team_members.value, False),
                    ("Турнир", self.tournament_info.value, False),
                    ("Статус", "Ожидает одобрения администрацией", True),
                ],
            )
            
            # Логируем создание канала в аналитику
            if bot.db and 'channel' in locals():
                await bot.db.log_event(
                    guild_id=interaction.guild.id,
                    event_type="ticket_created",
                    event_data={
                        "ticket_type": "tournament_role",
                        "channel_id": channel.id,
                        "applicant_id": interaction.user.id
                    }
                )

    class TournamentRoleApprovalView(discord.ui.View):
        def __init__(
            self,
            applicant_id: int,
            role_name: str,
            role_color: str,
            channel_id: int,
            tournament_info: str
        ) -> None:
            super().__init__(timeout=None)
            self.applicant_id = applicant_id
            self.role_name = role_name
            self.role_color = role_color
            self.channel_id = channel_id
            self.tournament_info = tournament_info

        @discord.ui.button(
            label="Одобрить",
            style=discord.ButtonStyle.success,
            emoji="✅",
            custom_id="approve_tournament_role"
        )
        async def approve_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
            if not interaction.user.guild_permissions.administrator:
                await interaction.response.send_message(
                    "❌ У вас нет прав для одобрения заявок. Требуются права администратора.",
                    ephemeral=True
                )
                return

            # Отключаем кнопку сразу, чтобы не нажали дважды
            button.disabled = True
            self.stop()  # Останавливаем view
            try:
                await interaction.message.edit(view=self)
            except discord.HTTPException:
                pass

            await interaction.response.defer(ephemeral=True)

            try:
                guild = interaction.guild
                if not guild:
                    await interaction.followup.send("❌ Не удалось получить информацию о сервере.", ephemeral=True)
                    return

                # Собираем упоминания из сообщений в канале
                channel = interaction.channel
                member_ids = set()
                
                if isinstance(channel, discord.TextChannel):
                    async for message in channel.history(limit=50):
                        # Ищем упоминания в сообщениях
                        for mention in message.mentions:
                            if not mention.bot:
                                member_ids.add(mention.id)
                        # Также ищем упоминания в тексте
                        mention_pattern = re.findall(r"<@!?(\d+)>", message.content)
                        for match in mention_pattern:
                            member_ids.add(int(match))

                if not member_ids:
                    await interaction.followup.send(
                        "❌ Не найдено ни одного упоминания участника в канале! "
                        "Пожалуйста, отметьте участников команды через @упоминание в этом канале, "
                        "затем нажмите 'Одобрить' снова.",
                        ephemeral=True
                    )
                    return

                # Создаем роль
                color_value = int(self.role_color, 16)
                role = await guild.create_role(
                    name=self.role_name,
                    colour=discord.Color(color_value),
                    mentionable=False,
                    hoist=True,
                    reason=f"Турнирная роль. Одобрил: {interaction.user}"
                )
                
                # Небольшая задержка для синхронизации Discord
                await asyncio.sleep(0.5)

                # Позиционируем роль
                reference_role = guild.get_role(ROLE_POSITION_REFERENCE_ID)
                if reference_role:
                    try:
                        await role.edit(position=reference_role.position + 1)
                        await asyncio.sleep(0.3)  # Дополнительная задержка после изменения позиции
                    except (discord.Forbidden, discord.HTTPException) as exc:
                        logging.warning("Failed to reposition tournament role: %s", exc)

                # Выдаем роль участникам
                assigned_members = []
                failed_members = []
                
                for member_id in member_ids:
                    member = guild.get_member(member_id)
                    if member:
                        try:
                            await member.add_roles(role, reason=f"Турнирная роль. Одобрил: {interaction.user}")
                            assigned_members.append(member.mention)
                        except (discord.Forbidden, discord.HTTPException) as exc:
                            logging.error("Failed to assign tournament role to %s: %s", member_id, exc)
                            failed_members.append(f"<@{member_id}>")
                    else:
                        failed_members.append(f"<@{member_id}> (не найден)")

                # Обновляем embed
                embed = interaction.message.embeds[0].copy()
                embed.color = discord.Color.green()
                embed.set_field_at(0, name="Статус", value=f"✅ **Одобрено** {interaction.user.mention}", inline=False)
                embed.add_field(
                    name="Результат",
                    value=f"Роль {role.mention} создана и выдана {len(assigned_members)} участникам.",
                    inline=False
                )
                if failed_members:
                    embed.add_field(
                        name="⚠️ Не удалось выдать роль",
                        value=", ".join(failed_members),
                        inline=False
                    )
                
                await interaction.message.edit(embed=embed, view=None)
                
                # Изменяем название канала
                try:
                    await interaction.channel.edit(name=f"✅-{interaction.channel.name}")
                except (discord.Forbidden, discord.HTTPException) as exc:
                    logging.warning("Failed to rename channel: %s", exc)

                # Уведомляем заявителя
                applicant = guild.get_member(self.applicant_id)
                if applicant:
                    try:
                        await applicant.send(
                            f"🎉 **Поздравляем!** Ваша заявка на создание роли **{self.role_name}** была одобрена!\n"
                            f"Роль **{self.role_name}** (цвет #{self.role_color}) создана и выдана {len(assigned_members)} участникам команды."
                        )
                    except discord.Forbidden:
                        logging.warning("Cannot send DM to applicant %s", self.applicant_id)

                await interaction.followup.send(
                    f"✅ Роль {role.mention} успешно создана и выдана участникам!",
                    ephemeral=True
                )

                # Логируем
                await send_log_embed(
                    guild,
                    title="🏆 Турнирная роль одобрена",
                    description=f"{interaction.user.mention} одобрил(а) создание роли {role.mention}",
                    color=discord.Color.green(),
                    fields=[
                        ("Заявитель", f"<@{self.applicant_id}>", True),
                        ("Роль", role.mention, True),
                        ("Выдано участникам", str(len(assigned_members)), True),
                        ("Участники", ", ".join(assigned_members) if assigned_members else "—", False),
                    ],
                )
                
                # Логируем в аналитику и планируем автоудаление канала
                if bot.db and isinstance(channel, discord.TextChannel):
                    await bot.db.log_event(
                        guild_id=guild.id,
                        event_type="tournament_role_created",
                        event_data={
                            "role_name": self.role_name,
                            "role_id": role.id,
                            "members_count": len(assigned_members)
                        }
                    )
                    
                    # Планируем удаление канала через 1 час (3600 секунд)
                    await bot.db.schedule_channel_deletion(
                        channel_id=channel.id,
                        guild_id=guild.id,
                        channel_type="tournament_role",
                        delete_after_seconds=3600
                    )

            except discord.Forbidden:
                await interaction.followup.send(
                    "❌ У бота нет прав создавать роли или выдавать их участникам.",
                    ephemeral=True
                )
            except discord.HTTPException as exc:
                logging.error("Failed to create tournament role: %s", exc)
                await interaction.followup.send(
                    f"❌ Не удалось создать роль из-за ошибки Discord: {exc}",
                    ephemeral=True
                )

        @discord.ui.button(
            label="Отказать",
            style=discord.ButtonStyle.danger,
            emoji="❌",
            custom_id="reject_tournament_role"
        )
        async def reject_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
            if not interaction.user.guild_permissions.administrator:
                await interaction.response.send_message(
                    "❌ У вас нет прав для управления заявками. Требуются права администратора.",
                    ephemeral=True
                )
                return

            # Обновляем embed
            embed = interaction.message.embeds[0].copy()
            embed.color = discord.Color.red()
            embed.set_field_at(0, name="Статус", value=f"❌ **Отказ** {interaction.user.mention}", inline=False)
            
            await interaction.response.edit_message(embed=embed, view=None)
            
            # Изменяем название канала
            try:
                await interaction.channel.edit(name=f"❌-{interaction.channel.name}")
            except (discord.Forbidden, discord.HTTPException) as exc:
                logging.warning("Failed to rename channel: %s", exc)

            # Уведомляем заявителя
            try:
                guild = interaction.guild
                if guild:
                    applicant = guild.get_member(self.applicant_id)
                    if applicant:
                        await applicant.send(
                            f"😔 К сожалению, ваша заявка на создание роли **{self.role_name}** была отклонена.\n"
                            f"Вы можете обратиться к администрации для уточнения причин."
                        )
            except discord.Forbidden:
                logging.warning("Cannot send DM to applicant %s", self.applicant_id)

            # Логируем
            if interaction.guild:
                await send_log_embed(
                    interaction.guild,
                    title="🏆 Турнирная роль отклонена",
                    description=f"{interaction.user.mention} отклонил(а) заявку на создание роли",
                    color=discord.Color.red(),
                    fields=[
                        ("Заявитель", f"<@{self.applicant_id}>", True),
                        ("Название роли", self.role_name, True),
                    ],
                )
                
                # Планируем автоудаление канала через 1 час
                channel = interaction.channel
                if bot.db and isinstance(channel, discord.TextChannel):
                    await bot.db.schedule_channel_deletion(
                        channel_id=channel.id,
                        guild_id=interaction.guild.id,
                        channel_type="tournament_role",
                        delete_after_seconds=3600
                    )

    class TicketSelect(discord.ui.Select):
        def __init__(self) -> None:
            options = [
                discord.SelectOption(
                    label="Помощь",
                    value="help",
                    description="Получить помощь по общим вопросам",
                    emoji="❓"
                ),
                discord.SelectOption(
                    label="Роль за турнир",
                    value="tournament_role",
                    description="Подать заявку на роль за победу в турнире",
                    emoji="🏆"
                ),
                discord.SelectOption(
                    label="Модератор",
                    value="moderator",
                    description="Подать заявку на модератора",
                    emoji="🛡️"
                ),
                discord.SelectOption(
                    label="Администратор",
                    value="administrator",
                    description="Подать заявку на администратора",
                    emoji="👑"
                ),
                discord.SelectOption(
                    label="Разбан",
                    value="unban",
                    description="Подать заявку на разбан",
                    emoji="🔓"
                ),
            ]
            super().__init__(
                placeholder="Выберите тип заявки",
                min_values=1,
                max_values=1,
                options=options,
                custom_id="ticket_select",
            )

        async def callback(self, interaction: discord.Interaction) -> None:
            if interaction.guild is None:
                await interaction.response.send_message("Команда доступна только на сервере.", ephemeral=True)
                return

            ticket_type = self.values[0]
            
            if ticket_type == "help":
                await interaction.response.send_modal(HelpTicketModal())
            elif ticket_type == "tournament_role":
                await interaction.response.send_modal(TournamentRoleRequestModal())
            elif ticket_type == "moderator":
                await interaction.response.send_modal(ModeratorTicketModal())
            elif ticket_type == "administrator":
                await interaction.response.send_modal(AdministratorTicketModal())
            elif ticket_type == "unban":
                await interaction.response.send_modal(UnbanTicketModal())

    class TicketView(discord.ui.View):
        def __init__(self, timeout: float | None = None) -> None:
            super().__init__(timeout=timeout)
            self.add_item(TicketSelect())

    class ApplicationStatusView(discord.ui.View):
        def __init__(self, applicant_id: int, application_type: str) -> None:
            super().__init__(timeout=None)
            self.applicant_id = applicant_id
            self.application_type = application_type

        @discord.ui.button(
            label="Одобрено",
            style=discord.ButtonStyle.success,
            emoji="✅",
            custom_id="approve_application"
        )
        async def approve_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.response.send_message(
                    "❌ У вас нет прав для управления заявками.",
                    ephemeral=True
                )
                return

            # Обновляем embed с новым статусом
            embed = interaction.message.embeds[0].copy()
            embed.color = discord.Color.green()
            embed.set_field_at(0, name="Статус", value="✅ **Одобрено**", inline=True)
            
            await interaction.response.edit_message(embed=embed, view=None)
            
            # Изменяем название канала
            try:
                # Убираем предыдущие эмодзи статуса
                current_name = interaction.channel.name
                if current_name.startswith("✅-") or current_name.startswith("❌-") or current_name.startswith("⏳-"):
                    # Убираем префикс эмодзи
                    current_name = current_name.split("-", 1)[1] if "-" in current_name else current_name
                
                new_name = f"✅-{current_name}"
                await interaction.channel.edit(name=new_name)
            except discord.Forbidden:
                logging.warning("Cannot edit channel name for approved application")
            except discord.HTTPException as exc:
                logging.error("Failed to edit channel name: %s", exc)
            
            # Уведомляем заявителя
            try:
                applicant = interaction.guild.get_member(self.applicant_id)
                if applicant:
                    await applicant.send(
                        f"🎉 **Поздравляем!** Ваша заявка на {self.application_type} была **одобрена**! "
                        f"Ожидайте дальнейших инструкций от администрации."
                    )
            except discord.Forbidden:
                logging.warning("Cannot send DM to applicant %s", self.applicant_id)

        @discord.ui.button(
            label="Ожидание",
            style=discord.ButtonStyle.secondary,
            emoji="⏳",
            custom_id="pending_application"
        )
        async def pending_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.response.send_message(
                    "❌ У вас нет прав для управления заявками.",
                    ephemeral=True
                )
                return

            # Обновляем embed с новым статусом
            embed = interaction.message.embeds[0].copy()
            embed.color = discord.Color.orange()
            embed.set_field_at(0, name="Статус", value="⏳ **Ожидание**", inline=True)
            
            await interaction.response.edit_message(embed=embed, view=self)
            
            # Изменяем название канала
            try:
                # Убираем предыдущие эмодзи статуса
                current_name = interaction.channel.name
                if current_name.startswith("✅-") or current_name.startswith("❌-") or current_name.startswith("⏳-"):
                    # Убираем префикс эмодзи
                    current_name = current_name.split("-", 1)[1] if "-" in current_name else current_name
                
                new_name = f"⏳-{current_name}"
                await interaction.channel.edit(name=new_name)
            except discord.Forbidden:
                logging.warning("Cannot edit channel name for pending application")
            except discord.HTTPException as exc:
                logging.error("Failed to edit channel name: %s", exc)

        @discord.ui.button(
            label="Отказ",
            style=discord.ButtonStyle.danger,
            emoji="❌",
            custom_id="reject_application"
        )
        async def reject_button(self, interaction: discord.Interaction, button: discord.ui.Button) -> None:
            if not interaction.user.guild_permissions.manage_roles:
                await interaction.response.send_message(
                    "❌ У вас нет прав для управления заявками.",
                    ephemeral=True
                )
                return

            # Обновляем embed с новым статусом
            embed = interaction.message.embeds[0].copy()
            embed.color = discord.Color.red()
            embed.set_field_at(0, name="Статус", value="❌ **Отказ**", inline=True)
            
            await interaction.response.edit_message(embed=embed, view=None)
            
            # Изменяем название канала
            try:
                # Убираем предыдущие эмодзи статуса
                current_name = interaction.channel.name
                if current_name.startswith("✅-") or current_name.startswith("❌-") or current_name.startswith("⏳-"):
                    # Убираем префикс эмодзи
                    current_name = current_name.split("-", 1)[1] if "-" in current_name else current_name
                
                new_name = f"❌-{current_name}"
                await interaction.channel.edit(name=new_name)
            except discord.Forbidden:
                logging.warning("Cannot edit channel name for rejected application")
            except discord.HTTPException as exc:
                logging.error("Failed to edit channel name: %s", exc)
            
            # Уведомляем заявителя
            try:
                applicant = interaction.guild.get_member(self.applicant_id)
                if applicant:
                    await applicant.send(
                        f"😔 К сожалению, ваша заявка на {self.application_type} была **отклонена**. "
                        f"Вы можете подать новую заявку через некоторое время."
                    )
            except discord.Forbidden:
                logging.warning("Cannot send DM to applicant %s", self.applicant_id)

    class HelpTicketModal(discord.ui.Modal, title="Заявка на помощь"):
        def __init__(self) -> None:
            super().__init__()
            self.problem = discord.ui.TextInput(
                label="Опишите вашу проблему",
                placeholder="Подробно опишите проблему или вопрос",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=2000
            )
            self.add_item(self.problem)

        async def on_submit(self, interaction: discord.Interaction) -> None:
            await interaction.response.send_message(
                "✅ Ваша заявка на помощь отправлена! Ожидайте ответа от модераторов.",
                ephemeral=True
            )
            
            # Создаем приватный канал для заявки на помощь
            try:
                guild = interaction.guild
                if guild:
                    # Создаем приватный канал
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(read_messages=False),
                        interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
                    }
                    
                    channel = await guild.create_text_channel(
                        name=f"help-request-{interaction.user.display_name}",
                        overwrites=overwrites,
                        reason=f"Заявка на помощь от {interaction.user}"
                    )
                    
                    # Отправляем информацию о заявке в приватный канал
                    embed = discord.Embed(
                        title="❓ Заявка на помощь",
                        description=f"Заявка от {interaction.user.mention}",
                        color=discord.Color.blue(),
                        timestamp=discord.utils.utcnow()
                    )
                    embed.add_field(name="Статус", value="⏳ **Ожидание**", inline=True)
                    embed.add_field(name="Проблема", value=self.problem.value, inline=False)
                    
                    await channel.send(embed=embed, view=ApplicationStatusView(interaction.user.id, "помощь"))
                    await channel.send(f"{interaction.user.mention}, ваша заявка создана. Ожидайте рассмотрения.")
                    
            except discord.Forbidden:
                logging.warning("Missing permissions to create channel for help request")
            except discord.HTTPException as exc:
                logging.error("Failed to create channel for help request: %s", exc)
            
            # Отправляем в лог
            await send_log_embed(
                interaction.guild,
                title="❓ Заявка на помощь",
                description=f"{interaction.user.mention} подал(а) заявку на помощь",
                color=discord.Color.blue(),
                fields=[
                    ("Проблема", self.problem.value, False),
                ],
            )

    class ModeratorTicketModal(discord.ui.Modal, title="Заявка на модератора"):
        def __init__(self) -> None:
            super().__init__()
            self.steamid = discord.ui.TextInput(
                label="SteamID",
                placeholder="Введите ваш SteamID",
                style=discord.TextStyle.short,
                required=True,
                max_length=50
            )
            self.age = discord.ui.TextInput(
                label="Возраст",
                placeholder="Укажите ваш возраст (минимум 14 лет)",
                style=discord.TextStyle.short,
                required=True,
                max_length=3
            )
            self.timezone = discord.ui.TextInput(
                label="Часовой пояс",
                placeholder="Укажите ваш часовой пояс",
                style=discord.TextStyle.short,
                required=True,
                max_length=20
            )
            self.experience = discord.ui.TextInput(
                label="Опыт",
                placeholder="Опишите ваш опыт и причины ухода",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=1000
            )
            self.goals = discord.ui.TextInput(
                label="Цель",
                placeholder="Почему вы хотите стать модератором",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=1000
            )
            self.add_item(self.steamid)
            self.add_item(self.age)
            self.add_item(self.timezone)
            self.add_item(self.experience)
            self.add_item(self.goals)

        async def on_submit(self, interaction: discord.Interaction) -> None:
            try:
                age = int(self.age.value)
                if age < 14:
                    await interaction.response.send_message(
                        "❌ Минимальный возраст для модератора - 14 лет.",
                        ephemeral=True
                    )
                    return
            except ValueError:
                await interaction.response.send_message(
                    "❌ Пожалуйста, укажите корректный возраст.",
                    ephemeral=True
                )
                return

            await interaction.response.send_message(
                "✅ Ваша заявка на модератора отправлена! Рассматривается администрацией.",
                ephemeral=True
            )
            
            # Создаем приватный канал для заявки на модератора
            try:
                guild = interaction.guild
                if guild:
                    # Создаем приватный канал
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(read_messages=False),
                        interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
                    }
                    
                    channel = await guild.create_text_channel(
                        name=f"mod-application-{interaction.user.display_name}",
                        overwrites=overwrites,
                        reason=f"Заявка на модератора от {interaction.user}"
                    )
                    
                    # Отправляем информацию о заявке в приватный канал
                    embed = discord.Embed(
                        title="🛡️ Заявка на модератора",
                        description=f"Заявка от {interaction.user.mention}",
                        color=discord.Color.green(),
                        timestamp=discord.utils.utcnow()
                    )
                    embed.add_field(name="Статус", value="⏳ **Ожидание**", inline=True)
                    embed.add_field(name="SteamID", value=self.steamid.value, inline=True)
                    embed.add_field(name="Возраст", value=self.age.value, inline=True)
                    embed.add_field(name="Часовой пояс", value=self.timezone.value, inline=True)
                    embed.add_field(name="Опыт", value=self.experience.value, inline=False)
                    embed.add_field(name="Цель", value=self.goals.value, inline=False)
                    
                    await channel.send(embed=embed, view=ApplicationStatusView(interaction.user.id, "модератора"))
                    await channel.send(f"{interaction.user.mention}, ваша заявка создана. Ожидайте рассмотрения.")
                    
            except discord.Forbidden:
                logging.warning("Missing permissions to create channel for moderator application")
            except discord.HTTPException as exc:
                logging.error("Failed to create channel for moderator application: %s", exc)
            
            # Отправляем в лог
            await send_log_embed(
                interaction.guild,
                title="🛡️ Заявка на модератора",
                description=f"{interaction.user.mention} подал(а) заявку на модератора",
                color=discord.Color.green(),
                fields=[
                    ("SteamID", self.steamid.value, True),
                    ("Возраст", self.age.value, True),
                    ("Часовой пояс", self.timezone.value, True),
                    ("Опыт", self.experience.value, False),
                    ("Цель", self.goals.value, False),
                ],
            )

    class AdministratorTicketModal(discord.ui.Modal, title="Заявка на администратора"):
        def __init__(self) -> None:
            super().__init__()
            self.steamid = discord.ui.TextInput(
                label="SteamID",
                placeholder="Укажите ваш SteamID",
                style=discord.TextStyle.short,
                required=True,
                max_length=50
            )
            self.age = discord.ui.TextInput(
                label="Возраст",
                placeholder="Укажите ваш возраст",
                style=discord.TextStyle.short,
                required=True,
                max_length=3
            )
            self.timezone = discord.ui.TextInput(
                label="Часовой пояс",
                placeholder="Например: UTC+3 (МСК)",
                style=discord.TextStyle.short,
                required=True,
                max_length=20
            )
            self.experience = discord.ui.TextInput(
                label="Опыт",
                placeholder="Опишите ваш опыт в администрировании",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=1000
            )
            self.goals = discord.ui.TextInput(
                label="Цели",
                placeholder="Какие цели вы ставите как администратор?",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=1000
            )
            self.add_item(self.steamid)
            self.add_item(self.age)
            self.add_item(self.timezone)
            self.add_item(self.experience)
            self.add_item(self.goals)

        async def on_submit(self, interaction: discord.Interaction) -> None:
            try:
                age = int(self.age.value)
                if age < 16:
                    await interaction.response.send_message(
                        "❌ Минимальный возраст для администратора - 16 лет.",
                        ephemeral=True
                    )
                    return
            except ValueError:
                await interaction.response.send_message(
                    "❌ Пожалуйста, укажите корректный возраст.",
                    ephemeral=True
                )
                return

            await interaction.response.send_message(
                "✅ Ваша заявка на администратора отправлена! Рассматривается Главным администратором.",
                ephemeral=True
            )
            
            # Создаем приватный канал для заявки на администратора
            try:
                guild = interaction.guild
                if guild:
                    # Создаем приватный канал
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(read_messages=False),
                        interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
                    }
                    
                    channel = await guild.create_text_channel(
                        name=f"admin-application-{interaction.user.display_name}",
                        overwrites=overwrites,
                        reason=f"Заявка на администратора от {interaction.user}"
                    )
                    
                    # Отправляем информацию о заявке в приватный канал
                    embed = discord.Embed(
                        title="👑 Заявка на администратора",
                        description=f"Заявка от {interaction.user.mention}",
                        color=discord.Color.purple(),
                        timestamp=discord.utils.utcnow()
                    )
                    embed.add_field(name="Статус", value="⏳ **Ожидание**", inline=True)
                    embed.add_field(name="SteamID", value=self.steamid.value, inline=True)
                    embed.add_field(name="Возраст", value=self.age.value, inline=True)
                    embed.add_field(name="Часовой пояс", value=self.timezone.value, inline=True)
                    embed.add_field(name="Опыт", value=self.experience.value, inline=False)
                    embed.add_field(name="Цели", value=self.goals.value, inline=False)
                    
                    await channel.send(embed=embed, view=ApplicationStatusView(interaction.user.id, "администратора"))
                    await channel.send(f"{interaction.user.mention}, ваша заявка создана. Ожидайте рассмотрения.")
                    
            except discord.Forbidden:
                logging.warning("Missing permissions to create channel for admin application")
            except discord.HTTPException as exc:
                logging.error("Failed to create channel for admin application: %s", exc)
            
            # Отправляем в лог
            await send_log_embed(
                interaction.guild,
                title="👑 Заявка на администратора",
                description=f"{interaction.user.mention} подал(а) заявку на администратора",
                color=discord.Color.purple(),
                fields=[
                    ("SteamID", self.steamid.value, True),
                    ("Возраст", self.age.value, True),
                    ("Часовой пояс", self.timezone.value, True),
                    ("Опыт", self.experience.value, False),
                    ("Цели", self.goals.value, False),
                ],
            )

    class UnbanTicketModal(discord.ui.Modal, title="Заявка на разбан"):
        def __init__(self) -> None:
            super().__init__()
            self.steamid = discord.ui.TextInput(
                label="SteamID",
                placeholder="Введите ваш SteamID",
                style=discord.TextStyle.short,
                required=True,
                max_length=50
            )
            self.ban_date = discord.ui.TextInput(
                label="Дата блокировки",
                placeholder="Укажите дату блокировки",
                style=discord.TextStyle.short,
                required=True,
                max_length=50
            )
            self.reason = discord.ui.TextInput(
                label="Причина для разбана",
                placeholder="Опишите, почему вас следует разбанить",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=2000
            )
            self.add_item(self.steamid)
            self.add_item(self.ban_date)
            self.add_item(self.reason)

        async def on_submit(self, interaction: discord.Interaction) -> None:
            await interaction.response.send_message(
                "✅ Ваша заявка на разбан отправлена! Ожидайте рассмотрения.",
                ephemeral=True
            )
            
            # Создаем приватный канал для заявки на разбан
            try:
                guild = interaction.guild
                if guild:
                    # Создаем приватный канал
                    overwrites = {
                        guild.default_role: discord.PermissionOverwrite(read_messages=False),
                        interaction.user: discord.PermissionOverwrite(read_messages=True, send_messages=True),
                        guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True)
                    }
                    
                    channel = await guild.create_text_channel(
                        name=f"unban-request-{interaction.user.display_name}",
                        overwrites=overwrites,
                        reason=f"Заявка на разбан от {interaction.user}"
                    )
                    
                    # Отправляем информацию о заявке в приватный канал
                    embed = discord.Embed(
                        title="🔓 Заявка на разбан",
                        description=f"Заявка от {interaction.user.mention}",
                        color=discord.Color.orange(),
                        timestamp=discord.utils.utcnow()
                    )
                    embed.add_field(name="Статус", value="⏳ **Ожидание**", inline=True)
                    embed.add_field(name="SteamID", value=self.steamid.value, inline=True)
                    embed.add_field(name="Дата блокировки", value=self.ban_date.value, inline=True)
                    embed.add_field(name="Причина", value=self.reason.value, inline=False)
                    
                    await channel.send(embed=embed, view=ApplicationStatusView(interaction.user.id, "разбан"))
                    await channel.send(f"{interaction.user.mention}, ваша заявка создана. Ожидайте рассмотрения.")
                    
            except discord.Forbidden:
                logging.warning("Missing permissions to create channel for unban request")
            except discord.HTTPException as exc:
                logging.error("Failed to create channel for unban request: %s", exc)
            
            # Отправляем в лог
            await send_log_embed(
                interaction.guild,
                title="🔓 Заявка на разбан",
                description=f"{interaction.user.mention} подал(а) заявку на разбан",
                color=discord.Color.orange(),
                fields=[
                    ("SteamID", self.steamid.value, True),
                    ("Дата блокировки", self.ban_date.value, True),
                    ("Причина", self.reason.value, False),
                ],
            )

    @bot.tree.command(name="check", description="Проверить и выдать стартовую роль всем участникам.")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_roles=True)
    async def check_command(interaction: discord.Interaction) -> None:
        if interaction.guild is None:
            await interaction.response.send_message("Команда доступна только на сервере.", ephemeral=True)
            return

        role = interaction.guild.get_role(VERIFICATION_ROLE_ID)
        if role is None:
            await interaction.response.send_message(
                "Не удалось найти стартовую роль. Проверьте настройку `VERIFICATION_ROLE_ID`.",
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True, thinking=True)

        missing_members = [
            member
            for member in interaction.guild.members
            if not member.bot and role not in member.roles
        ]

        successes = 0
        failures: list[str] = []

        for member in missing_members:
            try:
                await member.add_roles(role, reason="Выдача стартовой роли через /check.")
            except discord.Forbidden:
                failures.append(member.mention)
            except discord.HTTPException as exc:
                logging.error("Failed to add start role to %s: %s", member.id, exc)
                failures.append(member.mention)
            else:
                successes += 1
                await asyncio.sleep(0.2)

        await interaction.followup.send(
            content=(
                f"Готово. Выдано ролей: {successes}."
                + (f" Не удалось: {', '.join(failures)}." if failures else "")
            ),
            ephemeral=True,
        )

        if successes or failures:
            await send_log_embed(
                interaction.guild,
                title="🛡️ Проверка стартовой роли",
                description=f"{interaction.user.mention} выполнил(а) `/check`.",
                color=discord.Color.teal(),
                fields=[
                    ("Роль", role.mention, True),
                    ("Выдано", str(successes), True),
                    ("Не удалось", ", ".join(failures) if failures else "—", False),
                ],
            )

    @bot.tree.command(name="clear", description="Очистить текущий канал от сообщений.")
    @app_commands.guild_only()
    async def clear_command(interaction: discord.Interaction) -> None:
        # Проверяем права до defer (чтобы не истек interaction)
        if interaction.user.id != CONTENT_GUARD_EXEMPT_USER_ID:
            await interaction.response.send_message(
                "У тебя нет прав использовать эту команду.",
                ephemeral=True,
            )
            return

        channel = interaction.channel
        if not isinstance(channel, discord.TextChannel):
            await interaction.response.send_message(
                "Эту команду можно использовать только в текстовых каналах.",
                ephemeral=True,
            )
            return

        # Делаем defer с обработкой ошибки истечения
        try:
            await interaction.response.defer(ephemeral=True, thinking=True)
        except discord.errors.NotFound:
            # Interaction истек, логируем и выходим
            logging.warning("Interaction expired for clear command from user %s", interaction.user.id)
            return

        total_deleted = 0

        while True:
            try:
                deleted = await channel.purge(limit=100, bulk=True)
            except discord.Forbidden:
                await interaction.followup.send(
                    "У бота нет прав удалять сообщения в этом канале.",
                    ephemeral=True,
                )
                return
            except discord.HTTPException as exc:
                logging.error("Failed to purge messages in %s: %s", channel.id, exc)
                await interaction.followup.send(
                    "Не удалось удалить сообщения из-за ошибки Discord.",
                    ephemeral=True,
                )
                return

            batch_count = len(deleted)
            total_deleted += batch_count

            if batch_count < 100:
                break

            await asyncio.sleep(1)

        await interaction.followup.send(
            f"Удалено сообщений: {total_deleted}.",
            ephemeral=True,
        )

        await send_log_embed(
            interaction.guild,
            title="🧹 Очистка канала",
            description=f"{interaction.user.mention} очистил(а) канал {channel.mention}.",
            color=discord.Color.blue(),
            fields=[
                ("Удалено сообщений", str(total_deleted), True),
            ],
        )

    @bot.tree.command(name="assignrole", description="Создать/обновить роль и выдать её участникам.")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_roles=True)
    @app_commands.describe(
        members="Перечисли участников через упоминания.",
        role_name="Название роли.",
        color_hex="Цвет роли в формате #RRGGBB.",
    )
    async def assign_role_command(
        interaction: discord.Interaction,
        members: str,
        role_name: str,
        color_hex: str,
    ) -> None:
        if interaction.guild is None:
            await interaction.response.send_message(
                "Команда доступна только на сервере.",
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True, thinking=True)

        mention_ids = {int(match) for match in re.findall(r"<@!?(\d+)>", members)}
        if not mention_ids:
            await interaction.followup.send(
                "Не удалось найти упоминания пользователей. Укажи хотя бы одного участника.",
                ephemeral=True,
            )
            return

        color_clean = color_hex.strip().lstrip("#")
        if not re.fullmatch(r"[0-9a-fA-F]{6}", color_clean):
            await interaction.followup.send(
                "Некорректный формат цвета. Используй #RRGGBB.",
                ephemeral=True,
            )
            return

        color_value = int(color_clean, 16)
        color = discord.Color(color_value)

        role = discord.utils.get(interaction.guild.roles, name=role_name)
        created = False
        try:
            if role is None:
                role = await interaction.guild.create_role(
                    name=role_name,
                    colour=color,
                    mentionable=False,
                    hoist=True,
                    reason=f"Создание роли через /assignrole ({interaction.user}).",
                )
                created = True
            else:
                await role.edit(
                    colour=color,
                    hoist=True,
                    mentionable=False,
                    reason=f"Изменение роли через /assignrole ({interaction.user}).",
                )
        except discord.Forbidden:
            await interaction.followup.send(
                "У бота нет прав создавать или изменять роли.",
                ephemeral=True,
            )
            return
        except discord.HTTPException as exc:
            logging.error("Failed to create/edit role %s: %s", role_name, exc)
            await interaction.followup.send(
                "Не удалось создать или изменить роль из-за ошибки Discord.",
                ephemeral=True,
            )
            return

        position_note = "—"
        reference_role = interaction.guild.get_role(ROLE_POSITION_REFERENCE_ID)
        if reference_role is None:
            position_note = f"Не найдена роль-ориентир с ID {ROLE_POSITION_REFERENCE_ID}."
        else:
            desired_position = reference_role.position + 1
            if role.position <= reference_role.position:
                try:
                    await role.edit(
                        position=desired_position,
                        reason=f"Изменение позиции через /assignrole ({interaction.user}).",
                    )
                except discord.Forbidden:
                    position_note = (
                        f"Нет прав переместить роль выше {reference_role.mention}."
                    )
                except discord.HTTPException as exc:
                    logging.error("Failed to update role position for %s: %s", role.id, exc)
                    position_note = "Не удалось изменить позицию роли из-за ошибки Discord."
                else:
                    position_note = f"Роль поднята выше {reference_role.mention}."
            else:
                position_note = f"Роль уже выше {reference_role.mention}."

        assigned = 0
        failures: list[str] = []

        for member_id in mention_ids:
            member = interaction.guild.get_member(member_id)
            if member is None:
                failures.append(f"<@{member_id}> (не найден)")
                continue
            try:
                await member.add_roles(role, reason=f"Выдача роли через /assignrole ({interaction.user}).")
            except discord.Forbidden:
                failures.append(member.mention)
            except discord.HTTPException as exc:
                logging.error("Failed to assign role %s to %s: %s", role.id, member.id, exc)
                failures.append(member.mention)
            else:
                assigned += 1
                await asyncio.sleep(0.2)

        await interaction.followup.send(
            (
                f"{'Создана' if created else 'Обновлена'} роль {role.mention}. "
                f"Выдано участникам: {assigned}."
                + (f" Не удалось: {', '.join(failures)}." if failures else "")
                + f" Позиция: {position_note}"
            ),
            ephemeral=True,
        )

        await send_log_embed(
            interaction.guild,
            title="🎨 Выдача новой роли",
            description=f"{interaction.user.mention} использовал(а) `/assignrole`.",
            color=color,
            fields=[
                ("Роль", role.mention, True),
                ("Создана заново", "Да" if created else "Нет", True),
                ("Выдано", str(assigned), True),
                ("Не удалось", ", ".join(failures) if failures else "—", False),
                ("Позиция", position_note, False),
            ],
        )

    @bot.tree.command(name="rules", description="Открыть меню правил по категориям.")
    @app_commands.guild_only()
    async def rules_command(interaction: discord.Interaction) -> None:
        await interaction.response.send_message(
            content="**Правила сервера**\nВыберите категорию правил из меню ниже:",
            view=RulesView(author_id=interaction.user.id),
            ephemeral=False,
        )

    @bot.tree.command(name="setup_tickets", description="Настроить систему тикетов в канале.")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_messages=True)
    async def setup_tickets_command(interaction: discord.Interaction) -> None:
        if interaction.guild is None:
            await interaction.response.send_message("Команда доступна только на сервере.", ephemeral=True)
            return

        try:
            await interaction.response.defer(ephemeral=True, thinking=True)
        except discord.errors.NotFound:
            # Взаимодействие устарело (вызвано дважды или слишком долго ждали)
            logging.warning("Interaction expired for setup_tickets from user %s", interaction.user.id)
            return

        channel = interaction.guild.get_channel(TICKET_SYSTEM_CHANNEL_ID)
        if not isinstance(channel, discord.TextChannel):
            await interaction.followup.send(
                f"Канал с ID {TICKET_SYSTEM_CHANNEL_ID} не найден или недоступен.",
                ephemeral=True
            )
            return

        # Создаем embed с информацией о системе тикетов
        embed = discord.Embed(
            title="🎫 Система тикетов",
            description="Добро пожаловать в систему подачи заявок!",
            color=discord.Color.blue(),
            timestamp=discord.utils.utcnow()
        )

        embed.add_field(
            name="❓ Помощь",
            value="• Получить помощь по общим вопросам\n• Задать вопрос модерации",
            inline=False
        )

        embed.add_field(
            name="🏆 Роль за турнир",
            value="• Подать заявку на создание роли за победу в турнире\n• Укажите название, цвет роли (HEX) и участников\n• Администрация отметит участников в канале заявки\n• После одобрения роль создается автоматически",
            inline=False
        )

        embed.add_field(
            name="🛡️ Заявка на модератора",
            value="• Минимальный возраст: 14 лет\n• Рассматривается администрацией",
            inline=False
        )

        embed.add_field(
            name="👑 Заявка на администратора",
            value="• Минимальный возраст: 16 лет\n• Рассматривается Главным администратором",
            inline=False
        )

        embed.add_field(
            name="🔓 Заявка на разбан",
            value="• Требуется указать SteamID и дату блокировки\n• Подробно опишите причину для разбана",
            inline=False
        )

        embed.add_field(
            name="⚠️ Важная информация",
            value="• Заполняйте все поля формы максимально подробно\n• Дождитесь ответа, прежде чем создавать новую заявку\n• Для турнирных ролей: цвет в HEX (#FF5733), участников можно просто перечислить",
            inline=False
        )

        embed.set_footer(text="Выберите тип заявки из меню ниже")

        try:
            # Очищаем канал от старых сообщений
            async for message in channel.history(limit=100):
                if message.author == bot.user and "🎫 Система тикетов" in message.content:
                    await message.delete()
                    break

            # Отправляем новое сообщение
            await channel.send(content="🎫 **Система тикетов**", embed=embed, view=TicketView())
            await interaction.followup.send(
                f"✅ Система тикетов настроена в канале {channel.mention}",
                ephemeral=True
            )

        except discord.Forbidden:
            await interaction.followup.send(
                "❌ У бота нет прав отправлять сообщения в этот канал.",
                ephemeral=True
            )
        except discord.HTTPException as exc:
            logging.error("Failed to setup ticket system: %s", exc)
            await interaction.followup.send(
                "❌ Не удалось настроить систему тикетов из-за ошибки Discord.",
                ephemeral=True
            )

    @bot.tree.command(name="rules_stats", description="Показать статистику использования правил.")
    @app_commands.guild_only()
    @app_commands.default_permissions(manage_messages=True)
    async def rules_stats_command(interaction: discord.Interaction) -> None:
        if interaction.guild is None:
            await interaction.response.send_message("Команда доступна только на сервере.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True, thinking=True)

        if not bot.rules_usage_stats:
            await interaction.followup.send("Статистика использования правил пуста.", ephemeral=True)
            return

        # Создаем embed со статистикой
        embed = discord.Embed(
            title="📊 Статистика использования правил",
            description="Количество просмотров каждой категории правил",
            color=discord.Color.blue(),
            timestamp=discord.utils.utcnow(),
        )

        # Группируем статистику по категориям
        category_stats = {}
        total_views = 0
        
        for user_id, categories in bot.rules_usage_stats.items():
            for category, count in categories.items():
                if category not in category_stats:
                    category_stats[category] = 0
                category_stats[category] += count
                total_views += count

        # Находим названия категорий
        category_names = {data["value"]: data["label"] for data in RULE_CATEGORIES}
        
        # Сортируем по количеству просмотров
        sorted_categories = sorted(category_stats.items(), key=lambda x: x[1], reverse=True)
        
        for category, count in sorted_categories:
            category_name = category_names.get(category, category)
            embed.add_field(
                name=category_name,
                value=f"👀 {count} просмотров",
                inline=True
            )

        embed.add_field(
            name="📈 Общая статистика",
            value=f"Всего просмотров: **{total_views}**\nУникальных пользователей: **{len(bot.rules_usage_stats)}**",
            inline=False
        )

        embed.set_footer(text="Статистика обновляется в реальном времени")
        await interaction.followup.send(embed=embed, ephemeral=True)

    @bot.command(
        name="wipe",
        help="Создать объявление о вайпе: выбрать пресет и задать время.",
        brief="Создать объявление о вайпе.",
    )
    @commands.has_permissions(manage_messages=True)
    async def wipe_command(ctx: commands.Context) -> None:
        if ctx.guild is None:
            await ctx.send("Команда доступна только на сервере.")
            return
        if guild_id and ctx.guild.id != guild_id:
            await ctx.send("Команда недоступна на этом сервере.")
            return

        message = await ctx.send(
            "Выберите пресет m1–m5, затем нажмите 'Далее' и укажите время по МСК:",
            view=WipeView(author_id=ctx.author.id),
        )
        schedule_auto_delete(message)

    @bot.command(
        name="help",
        help="Показать список команд и их описание.",
        brief="Показать помощь.",
    )
    async def help_command(ctx: commands.Context, *, command_name: str | None = None) -> None:
        def command_description(cmd: commands.Command[Any, Any, Any]) -> str:
            description = cmd.help or cmd.brief or cmd.short_doc or "Описание отсутствует."
            return description.strip()

        if command_name:
            target_name = command_name.strip().lstrip(prefix).lower()
            target_cmd = bot.get_command(target_name)
            if not target_cmd:
                message = await ctx.send(
                    f"Команда `{command_name}` не найдена. Проверь правильность написания.",
                    view=DismissView(author_id=ctx.author.id),
                )
                schedule_auto_delete(message)
                return

            embed = discord.Embed(
                title=f"Команда: {prefix}{target_cmd.qualified_name}",
                description=command_description(target_cmd),
                color=discord.Color.blurple(),
                timestamp=discord.utils.utcnow(),
            )

            signature = f"{prefix}{target_cmd.qualified_name}"
            if target_cmd.signature:
                signature = f"{signature} {target_cmd.signature}"
            embed.add_field(name="Использование", value=f"```\n{signature}\n```", inline=False)

            if target_cmd.aliases:
                embed.add_field(
                    name="Псевдонимы",
                    value=", ".join(f"`{alias}`" for alias in target_cmd.aliases),
                    inline=False,
                )

            if isinstance(target_cmd, commands.Group):
                subcommands = [
                    f"`{prefix}{sub.qualified_name}` — {command_description(sub)}"
                    for sub in target_cmd.commands
                ]
                if subcommands:
                    embed.add_field(
                        name="Подкоманды",
                        value="\n".join(subcommands),
                        inline=False,
                    )

            embed.set_footer(text="Нажми кнопку, чтобы скрыть сообщение.")
            message = await ctx.send(embed=embed, view=DismissView(author_id=ctx.author.id))
            schedule_auto_delete(message)
            return

        embed = discord.Embed(
            title="Справка по боту",
            description=(
                "Здесь собраны команды бота. Используй `!help <команда>`, чтобы получить подробности "
                "по конкретной команде. Slash-команды доступны через меню `/`."
            ),
            color=discord.Color.green(),
            timestamp=discord.utils.utcnow(),
        )

        prefix_lines = prefix_command_lines()
        slash_lines = slash_command_lines()

        embed.add_field(
            name="Префикс-команды",
            value="\n".join(prefix_lines) if prefix_lines else "Команды не найдены.",
            inline=False,
        )

        embed.add_field(
            name="Slash-команды",
            value="\n".join(slash_lines) if slash_lines else "Команды не найдены.",
            inline=False,
        )

        embed.set_footer(text="Нажми кнопку, чтобы скрыть сообщение.")
        message = await ctx.send(embed=embed, view=DismissView(author_id=ctx.author.id))
        schedule_auto_delete(message)

    class VerificationView(discord.ui.View):
        def __init__(self, *, guild_id: int, role_id: int) -> None:
            super().__init__(timeout=None)
            self.guild_id = guild_id
            self.role_id = role_id

        @discord.ui.button(
            label="Пройти проверку",
            style=discord.ButtonStyle.success,
            custom_id="verification_button",
        )
        async def verify_button(
            self,
            interaction: discord.Interaction,
            button: discord.ui.Button,
        ) -> None:
            guild = interaction.client.get_guild(self.guild_id)
            if guild is None:
                await interaction.response.send_message(
                    "Не удалось найти сервер для проверки. Обратитесь к администраторам.",
                    ephemeral=True,
                )
                return

            member = guild.get_member(interaction.user.id)
            if member is None:
                try:
                    member = await guild.fetch_member(interaction.user.id)
                except discord.HTTPException as exc:
                    logging.error("Could not fetch member %s in guild %s: %s", interaction.user.id, guild.id, exc)
                    await interaction.response.send_message(
                        "Не удалось найти вас на сервере. Попробуйте позже или свяжитесь с администрацией.",
                        ephemeral=True,
                    )
                    return

            role = guild.get_role(self.role_id)
            if role is None:
                logging.error("Verification role %s not found in guild %s", self.role_id, guild.id)
                await interaction.response.send_message(
                    "Роль для выдачи не найдена. Сообщите, пожалуйста, администрации.",
                    ephemeral=True,
                )
                return

            if role in member.roles:
                await interaction.response.send_message(
                    "Проверка уже пройдена — роль у тебя есть.",
                    ephemeral=True,
                )
                return

            try:
                await member.add_roles(role, reason="Verification completed via DM button.")
            except discord.Forbidden:
                logging.error("Missing permissions to assign role %s in guild %s", role.id, guild.id)
                await interaction.response.send_message(
                    "У бота нет прав выдать эту роль. Сообщите модераторам.",
                    ephemeral=True,
                )
                return
            except discord.HTTPException as exc:
                logging.error("Failed to assign role %s to %s: %s", role.id, member.id, exc)
                await interaction.response.send_message(
                    "Не удалось выдать роль из-за ошибки сервера. Попробуйте позже.",
                    ephemeral=True,
                )
                return

            await interaction.response.send_message(
                "Готово! Роль выдана, добро пожаловать на сервер.",
                ephemeral=True,
            )
            button.disabled = True
            try:
                await interaction.message.edit(view=self)
            except discord.HTTPException as exc:
                logging.warning("Failed to update verification message for %s: %s", member.id, exc)

    @bot.event
    async def on_member_join(member: discord.Member) -> None:
        if guild_id and member.guild.id != guild_id:
            return

        invite_cache = bot.invite_cache.get(member.guild.id, {})
        inviter_text = "Не удалось определить"

        try:
            invites = await member.guild.invites()
        except discord.Forbidden:
            logging.warning("Bot lacks permission to fetch invites in guild %s", member.guild.id)
        except discord.HTTPException as exc:
            logging.error("Failed to fetch invites for guild %s: %s", member.guild.id, exc)
        else:
            bot.invite_cache[member.guild.id] = {inv.code: inv.uses or 0 for inv in invites}
            used_invite = None
            for invite in invites:
                uses = invite.uses or 0
                if uses > invite_cache.get(invite.code, 0):
                    used_invite = invite
                    break

            if used_invite:
                inviter = used_invite.inviter
                if inviter:
                    inviter_text = inviter.mention
                    bot.member_inviters[member.id] = inviter.id
                elif used_invite.code:
                    inviter_text = f"Ссылка: {used_invite.code}"
                else:
                    inviter_text = "Приглашение найдено, но без данных об авторе"
            else:
                if member.guild.vanity_url_code:
                    inviter_text = f"Ванити ссылка: {member.guild.vanity_url_code}"
                else:
                    inviter_text = "Не удалось определить"

        dm_sent = await send_dm(
            member,
            content=(
                "Привет! Нажми кнопку ниже, чтобы пройти проверку и получить доступ к серверу."
            ),
            view_factory=lambda: VerificationView(
                guild_id=member.guild.id,
                role_id=VERIFICATION_ROLE_ID,
            ),
        )
        if dm_sent:
            logging.info("Sent verification DM to %s (%s)", member.display_name, member.id)
        else:
            logging.warning("Failed to send verification DM to %s (%s)", member.display_name, member.id)

        await publish_member_event(
            guild=member.guild,
            title="✨ Новый участник",
            description=f"{member.mention} присоединился к серверу!",
            inviter_text=inviter_text,
            member=member,
            color=discord.Color.green(),
        )

    @bot.event
    async def on_member_remove(member: discord.Member) -> None:
        if guild_id and member.guild.id != guild_id:
            return

        inviter_id = bot.member_inviters.pop(member.id, None)
        inviter_text = f"<@{inviter_id}>" if inviter_id else "Не удалось определить"

        await publish_member_event(
            guild=member.guild,
            title="👋 Участник ушёл",
            description=f"{member.mention} покинул сервер.",
            inviter_text=inviter_text,
            member=member,
            color=discord.Color.red(),
        )

    @bot.event
    async def on_invite_create(invite: discord.Invite) -> None:
        if invite.guild is None:
            return
        if guild_id and invite.guild.id != guild_id:
            return

        bot.invite_cache.setdefault(invite.guild.id, {})[invite.code] = invite.uses or 0

        inviter_text = invite.inviter.mention if invite.inviter else "Неизвестно"
        expires_in = (
            discord.utils.format_dt(invite.expires_at, style="R")
            if invite.expires_at
            else "Не истекает"
        )
        max_uses = "Без ограничений" if invite.max_uses == 0 else str(invite.max_uses or "—")

        await send_log_embed(
            invite.guild,
            title="🔗 Создано приглашение",
            description=f"{inviter_text} создал(а) приглашение.",
            color=discord.Color.blurple(),
            fields=[
                ("Код", invite.code or "Ванити", True),
                ("Канал", invite.channel.mention if invite.channel else "Неизвестно", True),
                ("Заканчивается", expires_in, True),
                ("Максимум использований", max_uses, True),
            ],
        )

    @bot.event
    async def on_message(message: discord.Message) -> None:
        if message.guild is None:
            await bot.process_commands(message)
            return
        if guild_id and message.guild.id != guild_id:
            await bot.process_commands(message)
            return
        if message.author.bot:
            await bot.process_commands(message)
            return
        
        # Проверяем, является ли канал каналом заявки на роль (role-request-*)
        if isinstance(message.channel, discord.TextChannel) and message.channel.name.startswith("role-request-"):
            # Если в сообщении есть упоминания, добавляем их в канал
            if message.mentions:
                for mentioned_member in message.mentions:
                    if not mentioned_member.bot:
                        try:
                            # Проверяем, есть ли уже права у участника
                            overwrites = message.channel.overwrites_for(mentioned_member)
                            if overwrites.read_messages != True:
                                await message.channel.set_permissions(
                                    mentioned_member,
                                    read_messages=True,
                                    send_messages=True,
                                    reason=f"Добавлен в команду турнира администратором {message.author}"
                                )
                                logging.info(
                                    "Added %s to tournament role channel %s",
                                    mentioned_member.id,
                                    message.channel.id
                                )
                        except discord.HTTPException as exc:
                            logging.warning("Failed to add permissions for member %s: %s", mentioned_member.id, exc)
            
            # Обновляем время последнего сообщения в БД (сбрасываем таймер автоудаления)
            if bot.db and not message.author.bot:
                deletion_info = await bot.db.get_channel_deletion_info(message.channel.id)
                if deletion_info:
                    # Сбрасываем таймер: планируем удаление заново через 1 час
                    await bot.db.cancel_channel_deletion(message.channel.id)
                    await bot.db.schedule_channel_deletion(
                        channel_id=message.channel.id,
                        guild_id=message.guild.id,
                        channel_type=deletion_info.get("channel_type", "unknown"),
                        delete_after_seconds=3600
                    )
                    logging.debug(f"Reset deletion timer for channel {message.channel.id} due to new message")
        
        if message.author.id == CONTENT_GUARD_EXEMPT_USER_ID:
            await bot.process_commands(message)
            return

        if message_has_restricted_content(message):
            bot.automod_deleted_messages[message.id] = "Автофильтр: ссылки или медиа."
            try:
                await message.delete()
            except discord.Forbidden:
                logging.warning("Missing permissions to delete message from %s", message.author.id)
                bot.automod_deleted_messages.pop(message.id, None)
            except discord.HTTPException as exc:
                logging.error("Failed to delete message from %s: %s", message.author.id, exc)
                bot.automod_deleted_messages.pop(message.id, None)
            else:
                attachments = ", ".join(att.filename for att in message.attachments) or "Нет"
                await send_log_embed(
                    message.guild,
                    title="🚫 Сообщение удалено фильтром",
                    description=f"{message.author.mention} отправил(а) запрещённый контент.",
                    color=discord.Color.dark_red(),
                    fields=[
                        ("Канал", message.channel.mention, True),
                        ("Удалил", f"{bot.user.mention} (фильтр)", True),
                        ("Текст", trim_field(message.content or "—"), False),
                        ("Вложения", attachments, True),
                        ("Причина", "Автофильтр: ссылки или медиа.", True),
                    ],
                )

        await bot.process_commands(message)

    @bot.event
    async def on_message_edit(before: discord.Message, after: discord.Message) -> None:
        if after.guild is None:
            return
        if guild_id and after.guild.id != guild_id:
            return
        if after.author.bot:
            return

        if (
            after.author.id != CONTENT_GUARD_EXEMPT_USER_ID
            and message_has_restricted_content(after)
        ):
            bot.automod_deleted_messages[after.id] = "Автофильтр: ссылки или медиа (после редактирования)."
            try:
                await after.delete()
            except discord.Forbidden:
                logging.warning("Missing permissions to delete edited message from %s", after.author.id)
                bot.automod_deleted_messages.pop(after.id, None)
            except discord.HTTPException as exc:
                logging.error("Failed to delete edited message from %s: %s", after.author.id, exc)
                bot.automod_deleted_messages.pop(after.id, None)
            else:
                attachments = ", ".join(att.filename for att in after.attachments) or "Нет"
                await send_log_embed(
                    after.guild,
                    title="🚫 Сообщение удалено фильтром",
                    description=f"{after.author.mention} попытался отредактировать сообщение с запрещённым контентом.",
                    color=discord.Color.dark_red(),
                    fields=[
                        ("Канал", after.channel.mention, True),
                        ("Удалил", f"{bot.user.mention} (фильтр)", True),
                        ("Новый текст", trim_field(after.content or "—"), False),
                        ("Вложения", attachments, True),
                        ("Причина", "Автофильтр: ссылки или медиа.", True),
                    ],
                )
            return

        if before.content == after.content:
            return

        await send_log_embed(
            after.guild,
            title="✏️ Сообщение изменено",
            description=f"{after.author.mention} изменил(а) сообщение.",
            color=discord.Color.orange(),
            fields=[
                ("Канал", after.channel.mention, True),
                ("До", trim_field(before.content or "—"), False),
                ("После", trim_field(after.content or "—"), False),
            ],
        )

    @bot.event
    async def on_message_delete(message: discord.Message) -> None:
        if message.guild is None:
            return
        if guild_id and message.guild.id != guild_id:
            return
        if message.author and message.author.bot and message.author != bot.user:
            return

        reason = bot.automod_deleted_messages.pop(message.id, None)

        if reason:
            return

        deleter_text = None
        if reason:
            deleter_text = f"{bot.user.mention} (автофильтр)"
        else:
            perms = message.guild.me.guild_permissions if message.guild.me else None
            if perms and perms.view_audit_log:
                try:
                    async for entry in message.guild.audit_logs(
                        limit=5,
                        action=discord.AuditLogAction.message_delete,
                    ):
                        if (
                            entry.target
                            and entry.target.id == (message.author.id if message.author else None)
                            and entry.extra
                            and entry.extra.channel
                            and entry.extra.channel.id == message.channel.id
                            and (discord.utils.utcnow() - entry.created_at).total_seconds() < 10
                        ):
                            deleter_text = entry.user.mention if entry.user else "Неизвестно"
                            break
                except discord.Forbidden:
                    logging.warning("Missing audit log permission in guild %s", message.guild.id)
                except discord.HTTPException as exc:
                    logging.error("Failed to read audit logs for guild %s: %s", message.guild.id, exc)

        if deleter_text is None:
            deleter_text = "Автор или модератор (не удалось определить)"

        attachments = ", ".join(att.filename for att in message.attachments) if message.attachments else "Нет"

        await send_log_embed(
            message.guild,
            title="🗑️ Сообщение удалено",
            description=(
                f"Сообщение от {message.author.mention if message.author else 'Неизвестно'} удалено."
            ),
            color=discord.Color.red(),
            fields=[
                ("Канал", message.channel.mention, True),
                ("Удалил", deleter_text, True),
                ("Текст", trim_field(message.content or "—"), False),
                ("Вложения", attachments, True),
                ("Причина", reason or "—", True),
            ],
        )

    @bot.command(name="broadcast")
    @commands.has_permissions(administrator=True)
    async def broadcast(ctx: commands.Context, *, message: str) -> None:
        members = iter_target_members(ctx)
        total = len(members)
        if total == 0:
            await ctx.send("No target members found.")
            return

        await ctx.send(f"Starting DM broadcast to {total} members. This may take a while.")

        # Создаём красиво оформленный embed
        broadcast_embed = discord.Embed(
            title="📢 Важное объявление",
            description=message,
            color=discord.Color.blue(),
            timestamp=discord.utils.utcnow(),
        )
        if ctx.guild and ctx.guild.icon:
            broadcast_embed.set_thumbnail(url=ctx.guild.icon.url)
        broadcast_embed.set_footer(
            text=f"Отправлено администрацией {ctx.guild.name if ctx.guild else 'сервера'}",
            icon_url=ctx.author.display_avatar.url if ctx.author else None,
        )

        successes = 0
        failures = 0

        for batch in chunk_members(members, size=10):
            send_tasks = [send_dm(member, embed=broadcast_embed) for member in batch]
            results = await asyncio.gather(*send_tasks)
            successes += sum(1 for ok in results if ok)
            failures += sum(1 for ok in results if not ok)
            await asyncio.sleep(2)

        await ctx.send(f"Broadcast finished. Sent to {successes} members, {failures} failed.")

    @broadcast.error
    async def broadcast_error(ctx: commands.Context, error: commands.CommandError) -> None:
        if isinstance(error, commands.CheckFailure):
            await ctx.send("You do not have permission to run this command here.")
        else:
            logging.exception("Broadcast command failed: %s", error)
            await ctx.send("Broadcast failed. Check logs for details.")

    poll_url = os.getenv(
        "DISCORD_POLL_URL",
        "https://discord.com/channels/1338592151293919354/1385741311830786078/1426988707319124141",
    )

    def build_wipe_embed() -> discord.Embed:
        embed = discord.Embed(
            title="🚨 Завтра вайп сервера!",
            description=(
                "Пожалуйста, уделите минуту и отметьтесь в форме."
                
            ),
            color=discord.Color.orange(),
        )
        embed.add_field(
            name="Что нужно сделать?",
            value="📝 Пройдите опрос для максимального количества человек в команде.",
            inline=False,
        )
        embed.set_footer(text="Спасибо, что помогаете нам готовиться!")
        return embed

    def build_poll_view() -> discord.ui.View:
        view = discord.ui.View()
        view.add_item(
            discord.ui.Button(
                style=discord.ButtonStyle.link,
                label="Пройти опрос",
                url=poll_url,
                emoji="📋",
            )
        )
        return view

    @bot.command(name="broadcast_wipe")
    @commands.has_permissions(administrator=True)
    async def broadcast_wipe(ctx: commands.Context) -> None:
        members = iter_target_members(ctx)
        total = len(members)
        if total == 0:
            await ctx.send("No target members found for wipe notice.")
            return

        await ctx.send(f"Начинаю рассылку вайп-уведомления {total} участникам.")

        successes = 0
        failures = 0

        for batch in chunk_members(members, size=10):
            send_tasks = [
                send_dm(
                    member,
                    content="Привет! Завтра запланирован вайп сервера, нужна твоя обратная связь.",
                    embed_factory=build_wipe_embed,
                    view_factory=build_poll_view,
                )
                for member in batch
            ]
            results = await asyncio.gather(*send_tasks)
            successes += sum(1 for ok in results if ok)
            failures += sum(1 for ok in results if not ok)
            await asyncio.sleep(2)

        await ctx.send(
            f"Рассылка завершена. Уведомления отправлены {successes} участникам, "
            f"{failures} не получили сообщение."
        )

    @bot.tree.command(
        name="stats",
        description="📊 Показать статистику сервера (вайпы, тикеты, роли)"
    )
    @app_commands.default_permissions(administrator=True)
    async def stats_command(interaction: discord.Interaction, days: int = 30) -> None:
        """Показывает статистику активности на сервере за последние N дней"""
        if not interaction.guild:
            await interaction.response.send_message("❌ Команда доступна только на сервере.", ephemeral=True)
            return
        
        if not bot.db:
            await interaction.response.send_message(
                "❌ База данных не подключена. Статистика недоступна.",
                ephemeral=True
            )
            return
        
        await interaction.response.defer(ephemeral=True, thinking=True)
        
        try:
            # Получаем суммарную статистику
            stats = await bot.db.get_stats_summary(interaction.guild.id, days=days)
            
            wipe_count = stats.get("wipe_created", 0)
            ticket_count = stats.get("ticket_created", 0)
            role_count = stats.get("tournament_role_created", 0)
            channel_deleted_count = stats.get("channel_deleted", 0)
            
            embed = discord.Embed(
                title="📊 Статистика сервера",
                description=f"Активность за последние **{days} дней**",
                color=discord.Color.blue(),
                timestamp=discord.utils.utcnow()
            )
            
            embed.add_field(
                name="🔄 Вайпы",
                value=f"Создано объявлений: **{wipe_count}**",
                inline=False
            )
            
            embed.add_field(
                name="🎫 Тикеты помощи",
                value=f"Создано каналов: **{ticket_count}**",
                inline=True
            )
            
            embed.add_field(
                name="🏆 Турнирные роли",
                value=f"Создано ролей: **{role_count}**",
                inline=True
            )
            
            embed.add_field(
                name="🗑️ Удаленные каналы",
                value=f"Автоудалено: **{channel_deleted_count}**",
                inline=True
            )
            
            # Общая активность
            total_events = sum(stats.values())
            embed.add_field(
                name="📈 Всего событий",
                value=f"**{total_events}** действий",
                inline=False
            )
            
            embed.set_footer(text=f"Запросил {interaction.user.display_name}")
            
            await interaction.followup.send(embed=embed, ephemeral=True)
        
        except Exception as exc:
            logging.error(f"Failed to get stats: {exc}")
            await interaction.followup.send(
                f"❌ Ошибка получения статистики: {exc}",
                ephemeral=True
            )

    bot.run(token)


if __name__ == "__main__":
    main()
