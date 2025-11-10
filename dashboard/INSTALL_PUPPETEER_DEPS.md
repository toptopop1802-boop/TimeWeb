# Установка зависимостей для Puppeteer

Для работы Puppeteer на Linux сервере необходимо установить системные библиотеки.

## Ubuntu/Debian

### Ubuntu 24.04 (Noble) и новее:

```bash
sudo apt-get update
sudo apt-get install -y \
  libatk-bridge2.0-0t64 \
  libatk1.0-0t64 \
  libcups2t64 \
  libdrm2 \
  libgtk-3-0t64 \
  libgbm1 \
  libasound2t64 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxss1 \
  libxshmfence1 \
  libnspr4 \
  libnss3 \
  libatspi2.0-0t64 \
  libdbus-1-3
```

### Ubuntu 22.04 и старше / Debian:

```bash
sudo apt-get update
sudo apt-get install -y \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgtk-3-0 \
  libgbm1 \
  libasound2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxss1 \
  libxshmfence1 \
  libnspr4 \
  libnss3 \
  libatspi2.0-0 \
  libdbus-1-3
```

## CentOS/RHEL

```bash
sudo yum install -y \
  atk \
  cups-libs \
  gtk3 \
  libdrm \
  libXcomposite \
  libXdamage \
  libXext \
  libXfixes \
  libXi \
  libXrandr \
  libXScrnSaver \
  libXtst \
  pango \
  xorg-x11-fonts-100dpi \
  xorg-x11-fonts-75dpi \
  xorg-x11-utils
```

## После установки зависимостей

Перезапустите Node.js приложение:

```bash
cd dashboard
npm restart
# или
pm2 restart dashboard
```

