"""
Модуль для работы с Supabase базой данных
"""
import os
import logging
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

class Database:
    """Класс для работы с Supabase"""
    
    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL и SUPABASE_KEY должны быть установлены в .env файле")
        
        self.client: Client = create_client(url, key)
        logging.info("Supabase client initialized successfully")
    
    # ============================================
    # TOURNAMENT ROLE REQUESTS
    # ============================================
    
    async def save_tournament_request(
        self,
        message_id: int,
        channel_id: int,
        guild_id: int,
        applicant_id: int,
        role_name: str,
        role_color: str,
        tournament_info: str = ""
    ) -> bool:
        """Сохраняет заявку на турнирную роль"""
        try:
            data = {
                "message_id": message_id,
                "channel_id": channel_id,
                "guild_id": guild_id,
                "applicant_id": applicant_id,
                "role_name": role_name,
                "role_color": role_color,
                "tournament_info": tournament_info,
                "status": "pending"
            }
            
            self.client.table("tournament_role_requests").insert(data).execute()
            logging.info(f"Saved tournament request: message_id={message_id}")
            return True
        except Exception as exc:
            logging.error(f"Failed to save tournament request: {exc}")
            return False
    
    async def get_tournament_request(self, message_id: int) -> Optional[Dict[str, Any]]:
        """Получает заявку по ID сообщения"""
        try:
            response = self.client.table("tournament_role_requests").select("*").eq("message_id", message_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as exc:
            logging.error(f"Failed to get tournament request: {exc}")
            return None
    
    async def get_all_pending_tournament_requests(self, guild_id: int) -> List[Dict[str, Any]]:
        """Получает все активные заявки для гильдии"""
        try:
            response = self.client.table("tournament_role_requests").select("*").eq("guild_id", guild_id).eq("status", "pending").execute()
            return response.data or []
        except Exception as exc:
            logging.error(f"Failed to get pending tournament requests: {exc}")
            return []
    
    async def update_tournament_request_status(self, message_id: int, status: str) -> bool:
        """Обновляет статус заявки"""
        try:
            self.client.table("tournament_role_requests").update({"status": status}).eq("message_id", message_id).execute()
            logging.info(f"Updated tournament request status: message_id={message_id}, status={status}")
            return True
        except Exception as exc:
            logging.error(f"Failed to update tournament request status: {exc}")
            return False
    
    async def delete_tournament_request(self, message_id: int) -> bool:
        """Удаляет заявку"""
        try:
            self.client.table("tournament_role_requests").delete().eq("message_id", message_id).execute()
            logging.info(f"Deleted tournament request: message_id={message_id}")
            return True
        except Exception as exc:
            logging.error(f"Failed to delete tournament request: {exc}")
            return False
    
    # ============================================
    # TICKET REQUESTS
    # ============================================
    
    async def save_ticket_request(
        self,
        message_id: int,
        channel_id: int,
        guild_id: int,
        applicant_id: int,
        ticket_type: str,
        ticket_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Сохраняет тикет (помощь, модератор, админ, разбан)"""
        try:
            data = {
                "message_id": message_id,
                "channel_id": channel_id,
                "guild_id": guild_id,
                "applicant_id": applicant_id,
                "ticket_type": ticket_type,
                "ticket_data": ticket_data or {},
                "status": "pending"
            }
            
            self.client.table("ticket_requests").insert(data).execute()
            logging.info(f"Saved ticket request: message_id={message_id}, type={ticket_type}")
            return True
        except Exception as exc:
            logging.error(f"Failed to save ticket request: {exc}")
            return False
    
    async def get_ticket_request(self, message_id: int) -> Optional[Dict[str, Any]]:
        """Получает тикет по ID сообщения"""
        try:
            response = self.client.table("ticket_requests").select("*").eq("message_id", message_id).execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as exc:
            logging.error(f"Failed to get ticket request: {exc}")
            return None
    
    async def get_all_pending_tickets(self, guild_id: int) -> List[Dict[str, Any]]:
        """Получает все активные тикеты для гильдии"""
        try:
            response = self.client.table("ticket_requests").select("*").eq("guild_id", guild_id).eq("status", "pending").execute()
            return response.data or []
        except Exception as exc:
            logging.error(f"Failed to get pending tickets: {exc}")
            return []
    
    async def update_ticket_status(self, message_id: int, status: str) -> bool:
        """Обновляет статус тикета"""
        try:
            self.client.table("ticket_requests").update({"status": status}).eq("message_id", message_id).execute()
            logging.info(f"Updated ticket status: message_id={message_id}, status={status}")
            return True
        except Exception as exc:
            logging.error(f"Failed to update ticket status: {exc}")
            return False
    
    async def delete_ticket_request(self, message_id: int) -> bool:
        """Удаляет тикет"""
        try:
            self.client.table("ticket_requests").delete().eq("message_id", message_id).execute()
            logging.info(f"Deleted ticket request: message_id={message_id}")
            return True
        except Exception as exc:
            logging.error(f"Failed to delete ticket request: {exc}")
            return False
    
    # ============================================
    # ANALYTICS / СТАТИСТИКА
    # ============================================
    
    async def log_event(
        self,
        guild_id: int,
        event_type: str,
        event_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Логирует событие для аналитики"""
        try:
            data = {
                "guild_id": guild_id,
                "event_type": event_type,
                "event_data": event_data or {}
            }
            self.client.table("server_analytics").insert(data).execute()
            logging.info(f"Logged event: {event_type} for guild {guild_id}")
            return True
        except Exception as exc:
            logging.error(f"Failed to log event: {exc}")
            return False

    # ============================================
    # MEMBERS SNAPSHOTS
    # ============================================

    async def upsert_guild_members(self, guild_id: int, members: List[Dict[str, Any]]) -> bool:
        """Апсертом сохраняет список участников гильдии в таблицу guild_members."""
        try:
            rows = [
                {
                    "guild_id": guild_id,
                    "member_id": m.get("member_id"),
                    "username": m.get("username"),
                    "display_name": m.get("display_name"),
                    "is_bot": bool(m.get("is_bot", False)),
                    "joined_at": m.get("joined_at"),
                }
                for m in members
                if m.get("member_id")
            ]
            if not rows:
                return True
            # Supabase Python expects a comma-separated string for composite conflict targets
            self.client.table("guild_members").upsert(rows, on_conflict="guild_id,member_id").execute()
            return True
        except Exception as exc:
            logging.error(f"Failed to upsert guild members: {exc}")
            return False

    async def log_member_count(self, guild_id: int, count: int) -> bool:
        """Логирует количество участников (и в отдельную таблицу, и в server_analytics)."""
        try:
            self.client.table("member_counts").insert({
                "guild_id": guild_id,
                "count": int(count)
            }).execute()
            # дублируем в аналитику для фронтенда
            self.client.table("server_analytics").insert({
                "guild_id": guild_id,
                "event_type": "member_count",
                "event_data": {"count": int(count)}
            }).execute()
            return True
        except Exception as exc:
            logging.error(f"Failed to save member count: {exc}")
            return False
    
    async def get_analytics(
        self,
        guild_id: int,
        event_type: Optional[str] = None,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Получает аналитику за последние N дней"""
        try:
            from datetime import datetime, timedelta
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            query = self.client.table("server_analytics").select("*").eq("guild_id", guild_id).gte("created_at", cutoff_date)
            
            if event_type:
                query = query.eq("event_type", event_type)
            
            response = query.execute()
            return response.data or []
        except Exception as exc:
            logging.error(f"Failed to get analytics: {exc}")
            return []
    
    async def get_stats_summary(self, guild_id: int, days: int = 30) -> Dict[str, int]:
        """Получает суммарную статистику"""
        try:
            from datetime import datetime, timedelta
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            response = self.client.table("server_analytics").select("event_type").eq("guild_id", guild_id).gte("created_at", cutoff_date).execute()
            
            stats = {}
            for record in response.data or []:
                event_type = record["event_type"]
                stats[event_type] = stats.get(event_type, 0) + 1
            
            return stats
        except Exception as exc:
            logging.error(f"Failed to get stats summary: {exc}")
            return {}
    
    # ============================================
    # AUTO DELETE CHANNELS
    # ============================================
    
    async def schedule_channel_deletion(
        self,
        channel_id: int,
        guild_id: int,
        channel_type: str,
        delete_after_seconds: int = 3600
    ) -> bool:
        """Планирует удаление канала через N секунд"""
        try:
            from datetime import datetime, timedelta
            delete_at = (datetime.utcnow() + timedelta(seconds=delete_after_seconds)).isoformat()
            
            data = {
                "channel_id": channel_id,
                "guild_id": guild_id,
                "channel_type": channel_type,
                "delete_at": delete_at,
                "status": "active"
            }
            
            self.client.table("auto_delete_channels").insert(data).execute()
            logging.info(f"Scheduled channel {channel_id} for deletion in {delete_after_seconds}s")
            return True
        except Exception as exc:
            logging.error(f"Failed to schedule channel deletion: {exc}")
            return False
    
    async def update_channel_last_message(self, channel_id: int) -> bool:
        """Обновляет время последнего сообщения в канале"""
        try:
            from datetime import datetime
            now = datetime.utcnow().isoformat()
            
            self.client.table("auto_delete_channels").update({"last_message_at": now}).eq("channel_id", channel_id).execute()
            return True
        except Exception as exc:
            logging.error(f"Failed to update channel last message: {exc}")
            return False
    
    async def get_channels_to_delete(self) -> List[Dict[str, Any]]:
        """Получает каналы, которые нужно удалить"""
        try:
            from datetime import datetime
            now = datetime.utcnow().isoformat()
            
            response = self.client.table("auto_delete_channels").select("*").eq("status", "active").lte("delete_at", now).execute()
            return response.data or []
        except Exception as exc:
            logging.error(f"Failed to get channels to delete: {exc}")
            return []
    
    async def get_channel_deletion_info(self, channel_id: int) -> Optional[Dict[str, Any]]:
        """Получает информацию о планируемом удалении канала"""
        try:
            response = self.client.table("auto_delete_channels").select("*").eq("channel_id", channel_id).eq("status", "active").execute()
            if response.data:
                return response.data[0]
            return None
        except Exception as exc:
            logging.error(f"Failed to get channel deletion info: {exc}")
            return None
    
    async def cancel_channel_deletion(self, channel_id: int) -> bool:
        """Отменяет удаление канала"""
        try:
            self.client.table("auto_delete_channels").update({"status": "cancelled"}).eq("channel_id", channel_id).execute()
            logging.info(f"Cancelled deletion for channel {channel_id}")
            return True
        except Exception as exc:
            logging.error(f"Failed to cancel channel deletion: {exc}")
            return False
    
    async def mark_channel_as_deleted(self, channel_id: int) -> bool:
        """Помечает канал как удаленный"""
        try:
            self.client.table("auto_delete_channels").update({"status": "deleted"}).eq("channel_id", channel_id).execute()
            logging.info(f"Marked channel {channel_id} as deleted")
            return True
        except Exception as exc:
            logging.error(f"Failed to mark channel as deleted: {exc}")
            return False
    
    # ============================================
    # CLEANUP
    # ============================================
    
    async def cleanup_old_requests(self, days: int = 30) -> int:
        """Удаляет старые завершенные заявки"""
        try:
            # Удаляем записи старше N дней со статусом approved или rejected
            from datetime import datetime, timedelta
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            # Турнирные роли
            response1 = self.client.table("tournament_role_requests").delete().neq("status", "pending").lt("updated_at", cutoff_date).execute()
            count1 = len(response1.data) if response1.data else 0
            
            # Тикеты
            response2 = self.client.table("ticket_requests").delete().neq("status", "pending").lt("updated_at", cutoff_date).execute()
            count2 = len(response2.data) if response2.data else 0
            
            total = count1 + count2
            if total > 0:
                logging.info(f"Cleaned up {total} old requests")
            return total
        except Exception as exc:
            logging.error(f"Failed to cleanup old requests: {exc}")
            return 0


# Глобальный экземпляр базы данных
db: Optional[Database] = None

def get_database() -> Database:
    """Получить экземпляр базы данных"""
    global db
    if db is None:
        db = Database()
    return db

