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
except ImportError:
    print("Установите необходимые библиотеки:")
    print("pip install pillow requests")
    sys.exit(1)

# Опциональные библиотеки для управления (требуют GUI)
HAS_GUI_CONTROL = False
try:
    import pyautogui
    import pynput
    from pynput import mouse, keyboard
    HAS_GUI_CONTROL = True
except ImportError:
    print("⚠️  Предупреждение: pyautogui/pynput не установлены. Управление отключено.")
    print("   Для управления установите: pip install pyautogui pynput")
    print("   Для сервера без GUI используйте Xvfb или запускайте только в режиме просмотра.")

# Проверка наличия DISPLAY для GUI
HAS_DISPLAY = False
if HAS_GUI_CONTROL:
    try:
        import os
        if 'DISPLAY' in os.environ or os.path.exists('/tmp/.X11-unix'):
            HAS_DISPLAY = True
        else:
            # Попробовать установить виртуальный дисплей
            try:
                os.environ['DISPLAY'] = ':0'
                # Проверить доступность
                import subprocess
                result = subprocess.run(['xdpyinfo'], capture_output=True, timeout=1)
                if result.returncode == 0:
                    HAS_DISPLAY = True
            except:
                pass
    except:
        pass

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
            # Попробовать через ImageGrab (работает на Windows и Linux с X11)
            screenshot = ImageGrab.grab()
            img_bytes = io.BytesIO()
            screenshot.save(img_bytes, format='PNG')
            img_bytes.seek(0)
            return img_bytes.getvalue()
        except Exception as e:
            # Альтернативный метод для Linux без X11
            try:
                import subprocess
                # Попробовать через framebuffer или xvfb
                if platform.system() == 'Linux':
                    # Попробовать через importlib для xvfb
                    try:
                        result = subprocess.run(
                            ['xwd', '-root', '-out', '/tmp/screenshot.xwd'],
                            capture_output=True,
                            timeout=2
                        )
                        if result.returncode == 0:
                            # Конвертировать xwd в PNG
                            result = subprocess.run(
                                ['convert', '/tmp/screenshot.xwd', 'png:-'],
                                capture_output=True,
                                timeout=2
                            )
                            if result.returncode == 0:
                                return result.stdout
                    except:
                        pass
                    
                    # Попробовать через scrot
                    try:
                        result = subprocess.run(
                            ['scrot', '-o', '/tmp/screenshot.png'],
                            capture_output=True,
                            timeout=2
                        )
                        if result.returncode == 0:
                            with open('/tmp/screenshot.png', 'rb') as f:
                                return f.read()
                    except:
                        pass
                
                print(f"⚠️  Ошибка захвата экрана: {e}")
                print("   Для сервера без GUI установите Xvfb:")
                print("   apt-get install xvfb scrot imagemagick")
                print("   Xvfb :99 -screen 0 1024x768x24 &")
                print("   export DISPLAY=:99")
                return None
            except Exception as e2:
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
        if not HAS_GUI_CONTROL or not HAS_DISPLAY:
            print("⚠️  Управление недоступно: требуется графический интерфейс")
            print("   Команда получена, но не выполнена:", command)
            return False
            
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
        
        # Информация о режиме работы
        if not HAS_GUI_CONTROL or not HAS_DISPLAY:
            print("⚠️  Режим: Только просмотр (без управления)")
            print("   Скриншоты будут отправляться, но команды управления недоступны")
            print("   Для включения управления установите Xvfb:")
            print("   apt-get install xvfb")
            print("   Xvfb :99 -screen 0 1024x768x24 &")
            print("   export DISPLAY=:99")
        else:
            print("✓ Режим: Полный (просмотр + управление)")
        
        # Запустить потоки
        screen_thread = Thread(target=self.screen_loop, daemon=True)
        screen_thread.start()
        
        # Запустить поток команд только если есть GUI
        if HAS_GUI_CONTROL and HAS_DISPLAY:
            command_thread = Thread(target=self.command_loop, daemon=True)
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
        print("  python remote_monitor_client.py --server https://bublickrust.ru")
        print("  python remote_monitor_client.py --server http://localhost:3000")
        print("")
        sys.exit(1)
    
    client = RemoteMonitorClient(args.server, args.session)
    client.start()


if __name__ == '__main__':
    main()

