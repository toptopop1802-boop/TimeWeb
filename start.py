#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Универсальный скрипт запуска Discord Bot + Dashboard
Работает на Windows, Linux и macOS
"""

import os
import sys
import subprocess
import platform
import time
import signal
from pathlib import Path

# Цвета для консоли
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    CYAN = '\033[0;36m'
    MAGENTA = '\033[0;35m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color
    
    @staticmethod
    def disable_on_windows():
        """Отключить цвета на Windows если не поддерживаются"""
        if platform.system() == 'Windows':
            try:
                import colorama
                colorama.init()
            except ImportError:
                # Отключаем цвета если colorama не установлена
                Colors.RED = ''
                Colors.GREEN = ''
                Colors.YELLOW = ''
                Colors.CYAN = ''
                Colors.MAGENTA = ''
                Colors.BLUE = ''
                Colors.NC = ''

Colors.disable_on_windows()

class Launcher:
    def __init__(self):
        self.project_root = Path(__file__).parent.absolute()
        self.is_windows = platform.system() == 'Windows'
        self.venv_path = self.project_root / 'botenv'
        self.dashboard_path = self.project_root / 'dashboard'
        self.processes = []
        
    def print_header(self):
        """Вывести заголовок"""
        print(f"{Colors.CYAN}========================================{Colors.NC}")
        print(f"{Colors.CYAN}  Discord Bot + Dashboard Launcher{Colors.NC}")
        print(f"{Colors.CYAN}========================================{Colors.NC}")
        print()
        
    def print_step(self, step, total, message):
        """Вывести шаг установки"""
        print(f"{Colors.YELLOW}[{step}/{total}] {message}...{Colors.NC}")
        
    def print_success(self, message):
        """Вывести успешное сообщение"""
        print(f"{Colors.GREEN}✅ {message}{Colors.NC}")
        
    def print_error(self, message):
        """Вывести сообщение об ошибке"""
        print(f"{Colors.RED}❌ {message}{Colors.NC}")
        
    def print_warning(self, message):
        """Вывести предупреждение"""
        print(f"{Colors.YELLOW}⚠️  {message}{Colors.NC}")
        
    def print_info(self, message):
        """Вывести информацию"""
        print(f"{Colors.CYAN}{message}{Colors.NC}")
        
    def check_python(self):
        """Проверить наличие Python"""
        self.print_step(1, 5, "Проверка Python")
        try:
            version = sys.version.split()[0]
            major, minor = map(int, version.split('.')[:2])
            if major < 3 or (major == 3 and minor < 8):
                self.print_error(f"Требуется Python 3.8+, установлена версия {version}")
                return False
            self.print_success(f"Python найден: {version}")
            return True
        except Exception as e:
            self.print_error(f"Ошибка проверки Python: {e}")
            return False
            
    def check_nodejs(self):
        """Проверить наличие Node.js"""
        self.print_step(2, 5, "Проверка Node.js")
        try:
            result = subprocess.run(['node', '--version'], 
                                  capture_output=True, text=True, check=True)
            version = result.stdout.strip()
            self.print_success(f"Node.js найден: {version}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.print_error("Node.js не найден! Установите Node.js 16+")
            return False
            
    def setup_python_venv(self):
        """Настроить виртуальное окружение Python"""
        self.print_step(3, 5, "Проверка виртуального окружения")
        
        if not self.venv_path.exists():
            self.print_warning("Виртуальное окружение не найдено. Создаю...")
            try:
                subprocess.run([sys.executable, '-m', 'venv', str(self.venv_path)], 
                             check=True)
                self.print_success("Виртуальное окружение создано")
                
                # Установка зависимостей
                self.print_info("📦 Установка Python зависимостей...")
                pip_path = self.get_venv_python_path('pip')
                subprocess.run([pip_path, 'install', '-r', 'requirements.txt'], 
                             check=True, cwd=str(self.project_root))
                self.print_success("Python зависимости установлены")
            except subprocess.CalledProcessError as e:
                self.print_error(f"Ошибка создания виртуального окружения: {e}")
                return False
        else:
            self.print_success("Виртуальное окружение найдено")
        return True
        
    def setup_node_modules(self):
        """Установить Node.js зависимости"""
        self.print_step(4, 5, "Проверка Node.js зависимостей")
        
        node_modules = self.dashboard_path / 'node_modules'
        if not node_modules.exists():
            self.print_warning("Node modules не найдены. Устанавливаю...")
            try:
                subprocess.run(['npm', 'install'], 
                             check=True, cwd=str(self.dashboard_path))
                self.print_success("Node modules установлены")
            except subprocess.CalledProcessError as e:
                self.print_error(f"Ошибка установки зависимостей: {e}")
                return False
        else:
            self.print_success("Node modules найдены")
        return True
        
    def check_env_files(self):
        """Проверить наличие .env файлов"""
        self.print_step(5, 5, "Проверка конфигурации")
        
        env_missing = False
        root_env = self.project_root / '.env'
        dashboard_env = self.dashboard_path / '.env'
        
        if not root_env.exists():
            self.print_warning("Файл .env не найден в корне проекта!")
            env_missing = True
            
        if not dashboard_env.exists():
            self.print_warning("Файл .env не найден в dashboard!")
            env_missing = True
            
        if env_missing:
            self.print_warning("Создайте .env файлы на основе env.example")
            self.print_warning("Продолжаю запуск...")
        else:
            self.print_success("Конфигурация найдена")
        return True
        
    def get_venv_python_path(self, executable='python'):
        """Получить путь к Python в виртуальном окружении"""
        if self.is_windows:
            scripts_dir = self.venv_path / 'Scripts'
            if executable == 'python':
                return str(scripts_dir / 'python.exe')
            elif executable == 'pip':
                return str(scripts_dir / 'pip.exe')
        else:
            bin_dir = self.venv_path / 'bin'
            return str(bin_dir / executable)
            
    def start_bot(self):
        """Запустить Discord бота"""
        self.print_info("🚀 Запуск Discord Bot...")
        
        # Загружаем переменные окружения из .env файла
        env = os.environ.copy()
        env_file = self.project_root / '.env'
        if env_file.exists():
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env[key.strip()] = value.strip()
        else:
            self.print_warning("Файл .env не найден в корне проекта. Бот может не запуститься без DISCORD_BOT_TOKEN!")
        
        python_path = self.get_venv_python_path('python')
        bot_script = self.project_root / 'broadcast_bot.py'
        
        try:
            # Запускаем без перехвата stdout/stderr, чтобы видеть все логи и команды
            process = subprocess.Popen(
                [python_path, str(bot_script)],
                cwd=str(self.project_root),
                env=env
            )
            self.processes.append(('bot', process))
            return process
        except Exception as e:
            self.print_error(f"Ошибка запуска бота: {e}")
            return None
            
    def start_dashboard(self):
        """Запустить Dashboard"""
        self.print_info("🚀 Запуск Dashboard...")
        
        # Загружаем переменные окружения из .env файла
        env = os.environ.copy()
        env_file = self.dashboard_path / '.env'
        if env_file.exists():
            with open(env_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env[key.strip()] = value.strip()
        
        try:
            # Запускаем без перехвата stdout/stderr
            process = subprocess.Popen(
                ['node', 'server.js'],
                cwd=str(self.dashboard_path),
                env=env
            )
            self.processes.append(('dashboard', process))
            return process
        except Exception as e:
            self.print_error(f"Ошибка запуска дашборда: {e}")
            return None
            
    def monitor_processes(self):
        """Мониторить процессы"""
        print()
        self.print_success("Сервисы запущены!")
        print()
        self.print_info("📊 Dashboard: http://localhost:3000")
        self.print_info("🤖 Discord Bot: Смотрите логи выше")
        print()
        print(f"{Colors.CYAN}========================================{Colors.NC}")
        self.print_warning("Нажмите Ctrl+C для остановки всех сервисов")
        print(f"{Colors.CYAN}========================================{Colors.NC}")
        print()
        
        try:
            while True:
                # Проверяем, живы ли процессы
                all_dead = True
                for name, process in self.processes:
                    if process.poll() is None:
                        all_dead = False
                        break
                
                if all_dead:
                    print()
                    self.print_error("Все сервисы остановлены")
                    break
                    
                time.sleep(1)
                
        except KeyboardInterrupt:
            print()
            self.print_warning("⏹️  Остановка сервисов...")
            self.cleanup()
            
    def cleanup(self):
        """Остановить все процессы"""
        for name, process in self.processes:
            if process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                except:
                    pass
        self.print_success("Все сервисы остановлены")
        
    def run(self):
        """Главная функция запуска"""
        self.print_header()
        
        # Проверки
        if not self.check_python():
            return 1
        if not self.check_nodejs():
            return 1
        if not self.setup_python_venv():
            return 1
        if not self.setup_node_modules():
            return 1
        if not self.check_env_files():
            return 1
            
        print()
        print(f"{Colors.CYAN}========================================{Colors.NC}")
        print(f"{Colors.CYAN}  Запуск сервисов...{Colors.NC}")
        print(f"{Colors.CYAN}========================================{Colors.NC}")
        print()
        
        # Запуск сервисов
        bot_process = self.start_bot()
        if not bot_process:
            return 1
            
        # Небольшая задержка
        time.sleep(2)
        
        dashboard_process = self.start_dashboard()
        if not dashboard_process:
            self.cleanup()
            return 1
            
        # Мониторинг
        self.monitor_processes()
        
        return 0


def main():
    """Точка входа"""
    launcher = Launcher()
    
    # Обработчик сигналов
    def signal_handler(signum, frame):
        print()
        launcher.cleanup()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)
    
    sys.exit(launcher.run())


if __name__ == '__main__':
    main()

