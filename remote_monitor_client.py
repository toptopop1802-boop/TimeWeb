#!/usr/bin/env python3
"""
Remote Monitor Client
Отправляет скриншоты экрана и выполняет команды с удаленного сервера
"""

import requests
import time
import platform
import getpass
import io
import sys
from threading import Thread
import json

try:
    from PIL import ImageGrab
    import pyautogui
    import pynput
    from pynput import mouse, keyboard
except ImportError:
    print("Установите необходимые библиотеки:")
    print("pip install pillow pyautogui pynput requests")
    sys.exit(1)

class RemoteMonitorClient:
    def __init__(self, server_url, session_id=None):
        self.server_url = server_url.rstrip('/')
        self.session_id = session_id
        self.running = False
        self.mouse_listener = None
        self.keyboard_listener = None
        
        # Настройки PyAutoGUI
        pyautogui.FAILSAFE = False
        pyautogui.PAUSE = 0.01
        
    def register_session(self):
        """Регистрирует новую сессию на сервере"""
        try:
            system_info = {
                'computerName': platform.node(),
                'userName': getpass.getuser(),
                'osInfo': f"{platform.system()} {platform.release()}",
                'resolution': self.get_screen_resolution()
            }
            
            response = requests.post(
                f"{self.server_url}/api/remote-monitor/register",
                json=system_info,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                self.session_id = data['sessionId']
                print(f"✓ Сессия зарегистрирована: {self.session_id}")
                print(f"✓ Ссылка для просмотра: {data['url']}")
                return True
            else:
                print(f"✗ Ошибка регистрации: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"✗ Ошибка при регистрации сессии: {e}")
            return False
    
    def get_screen_resolution(self):
        """Получает разрешение экрана"""
        try:
            screenshot = ImageGrab.grab()
            return f"{screenshot.width}x{screenshot.height}"
        except:
            return "Unknown"
    
    def capture_screen(self):
        """Делает скриншот экрана"""
        try:
            screenshot = ImageGrab.grab()
            img_bytes = io.BytesIO()
            screenshot.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            return img_bytes.getvalue()
        except Exception as e:
            print(f"Ошибка захвата экрана: {e}")
            return None
    
    def upload_screen(self):
        """Отправляет скриншот на сервер"""
        if not self.session_id:
            return False
            
        try:
            screen_data = self.capture_screen()
            if not screen_data:
                return False
            
            response = requests.post(
                f"{self.server_url}/api/remote-monitor/screen/{self.session_id}",
                data=screen_data,
                headers={'Content-Type': 'image/png'},
                timeout=5
            )
            
            return response.status_code == 200
            
        except Exception as e:
            print(f"Ошибка отправки скриншота: {e}")
            return False
    
    def update_system_info(self):
        """Обновляет системную информацию"""
        if not self.session_id:
            return False
            
        try:
            system_info = {
                'computerName': platform.node(),
                'userName': getpass.getuser(),
                'osInfo': f"{platform.system()} {platform.release()}",
                'resolution': self.get_screen_resolution()
            }
            
            response = requests.post(
                f"{self.server_url}/api/remote-monitor/info/{self.session_id}",
                json=system_info,
                timeout=5
            )
            
            return response.status_code == 200
            
        except Exception as e:
            print(f"Ошибка обновления информации: {e}")
            return False
    
    def get_commands(self, last_command_id=0):
        """Получает команды с сервера"""
        if not self.session_id:
            return []
            
        try:
            response = requests.get(
                f"{self.server_url}/api/remote-monitor/commands/{self.session_id}",
                params={'lastId': last_command_id},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                return data.get('commands', [])
            return []
            
        except Exception as e:
            print(f"Ошибка получения команд: {e}")
            return []
    
    def execute_command(self, command):
        """Выполняет команду"""
        action = command.get('action')
        param = command.get('param')
        text = command.get('text')
        
        try:
            if action == 'click':
                if param == 'left':
                    pyautogui.click(button='left')
                elif param == 'right':
                    pyautogui.click(button='right')
                elif param == 'middle':
                    pyautogui.click(button='middle')
                    
            elif action == 'key':
                if param:
                    pyautogui.press(param.lower())
                    
            elif action == 'type':
                if text:
                    pyautogui.write(text, interval=0.01)
                    
            return True
            
        except Exception as e:
            print(f"Ошибка выполнения команды: {e}")
            return False
    
    def screen_loop(self):
        """Основной цикл отправки скриншотов"""
        while self.running:
            self.upload_screen()
            time.sleep(0.5)  # 2 FPS
    
    def command_loop(self):
        """Основной цикл получения и выполнения команд"""
        last_command_id = 0
        
        while self.running:
            commands = self.get_commands(last_command_id)
            
            for cmd in commands:
                self.execute_command(cmd)
                last_command_id = max(last_command_id, cmd.get('timestamp', 0))
            
            time.sleep(0.1)  # Проверка каждые 100ms
    
    def start(self):
        """Запускает клиент"""
        if not self.session_id:
            if not self.register_session():
                return False
        
        self.running = True
        
        # Обновить системную информацию
        self.update_system_info()
        
        # Запустить потоки
        screen_thread = Thread(target=self.screen_loop, daemon=True)
        command_thread = Thread(target=self.command_loop, daemon=True)
        
        screen_thread.start()
        command_thread.start()
        
        print(f"✓ Клиент запущен. Сессия: {self.session_id}")
        print("Нажмите Ctrl+C для остановки")
        
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nОстановка клиента...")
            self.stop()
        
        return True
    
    def stop(self):
        """Останавливает клиент"""
        self.running = False
        print("Клиент остановлен")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Remote Monitor Client')
    parser.add_argument('--server', '-s', default='http://localhost:3000',
                       help='URL сервера (по умолчанию: http://localhost:3000)')
    parser.add_argument('--session', '-id', default=None,
                       help='ID существующей сессии (если не указан, создается новая)')
    
    args = parser.parse_args()
    
    # Проверка на placeholder URL
    if 'ваш-сервер' in args.server.lower():
        print("⚠️  ОШИБКА: Замените 'http://ваш-сервер.com' на реальный URL вашего сервера!")
        print("")
        print("Примеры:")
        print("  python remote_monitor_client.py --server http://localhost:3000")
        print("  python remote_monitor_client.py --server https://yourdomain.com")
        print("")
        sys.exit(1)
    
    client = RemoteMonitorClient(args.server, args.session)
    client.start()


if __name__ == '__main__':
    main()

