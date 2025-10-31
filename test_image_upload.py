#!/usr/bin/env python3
"""
Тест загрузки изображений через API
Использование: python test_image_upload.py <path_to_image> <auth_token>
"""

import sys
import requests
import os
from pathlib import Path

# Цвета для вывода
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.RESET}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.RESET}")

def print_info(msg):
    print(f"{Colors.CYAN}ℹ️  {msg}{Colors.RESET}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.RESET}")

def print_header(msg):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{msg}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def format_size(size_bytes):
    """Форматирует размер файла"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"

def test_upload_image(image_path, token, api_url="https://bublickrust.ru/api/images/upload"):
    """
    Тестирует загрузку изображения через API
    """
    print_header("🖼️  Тест загрузки изображений через API")
    
    # Проверка файла
    if not os.path.exists(image_path):
        print_error(f"Файл не найден: {image_path}")
        return False
    
    file_path = Path(image_path)
    file_size = os.path.getsize(image_path)
    
    print_info(f"Файл: {file_path.name}")
    print_info(f"Размер: {format_size(file_size)}")
    print_info(f"Тип: {file_path.suffix}")
    
    # Проверка расширения
    allowed_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    if file_path.suffix.lower() not in allowed_extensions:
        print_warning(f"Файл может быть отклонен. Разрешенные форматы: {', '.join(allowed_extensions)}")
    
    # Проверка размера
    max_size = 15 * 1024 * 1024  # 15 MB
    if file_size > max_size:
        print_error(f"Файл слишком большой! Максимум: {format_size(max_size)}")
        return False
    
    print_info(f"API URL: {api_url}")
    print_info(f"Token: {token[:20]}...")
    
    try:
        print("\n🚀 Начинаю загрузку...\n")
        
        # Подготовка файла
        with open(image_path, 'rb') as f:
            files = {
                'image': (file_path.name, f, f'image/{file_path.suffix[1:]}')
            }
            
            headers = {
                'Authorization': f'Bearer {token}'
            }
            
            # Отправка запроса
            print_info("📤 Отправка POST запроса...")
            response = requests.post(
                api_url,
                files=files,
                headers=headers,
                timeout=30
            )
        
        print_info(f"📥 Статус: {response.status_code} {response.reason}")
        print_info(f"📄 Content-Type: {response.headers.get('content-type', 'unknown')}")
        
        # Логируем полный ответ для отладки
        print_info(f"📄 Тело ответа ({len(response.text)} символов):")
        print(f"{Colors.CYAN}{response.text[:500]}{Colors.RESET}")
        
        # Парсинг ответа
        try:
            data = response.json()
        except ValueError as e:
            print_error(f"Ошибка парсинга JSON: {e}")
            print_error(f"Полный ответ: {response.text}")
            return False
        
        # Проверка результата
        if response.status_code == 200 and data.get('success'):
            print_success("Изображение успешно загружено!")
            print("\n" + "="*60)
            print(f"{Colors.BOLD}📊 Результат:{Colors.RESET}")
            print("="*60)
            print(f"  {Colors.BOLD}ID:{Colors.RESET} {data.get('id')}")
            print(f"  {Colors.BOLD}Short Code:{Colors.RESET} {data.get('shortCode')}")
            print(f"  {Colors.BOLD}Прямая ссылка:{Colors.RESET}")
            print(f"    {Colors.GREEN}{data.get('directUrl')}{Colors.RESET}")
            print("="*60 + "\n")
            return True
        else:
            error_msg = data.get('error', 'Неизвестная ошибка')
            print_error(f"Ошибка API: {error_msg}")
            return False
            
    except requests.exceptions.Timeout:
        print_error("Превышено время ожидания (timeout)")
        return False
    except requests.exceptions.ConnectionError as e:
        print_error(f"Ошибка соединения: {e}")
        return False
    except requests.exceptions.RequestException as e:
        print_error(f"Ошибка запроса: {e}")
        return False
    except Exception as e:
        print_error(f"Неожиданная ошибка: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print_header("🧪 Image Upload API Tester")
    
    if len(sys.argv) < 3:
        print_error("Недостаточно аргументов!")
        print(f"\n{Colors.BOLD}Использование:{Colors.RESET}")
        print(f"  python {sys.argv[0]} <путь_к_изображению> <auth_token>\n")
        print(f"{Colors.BOLD}Пример:{Colors.RESET}")
        print(f"  python {sys.argv[0]} photo.jpg 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'\n")
        sys.exit(1)
    
    image_path = sys.argv[1]
    token = sys.argv[2]
    
    # Опциональный третий аргумент - URL API
    api_url = sys.argv[3] if len(sys.argv) > 3 else "https://bublickrust.ru/api/images/upload"
    
    success = test_upload_image(image_path, token, api_url)
    
    if success:
        print_success("Тест пройден успешно! 🎉")
        sys.exit(0)
    else:
        print_error("Тест провален ❌")
        sys.exit(1)

if __name__ == "__main__":
    main()

