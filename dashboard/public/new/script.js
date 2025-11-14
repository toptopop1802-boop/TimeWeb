// Прелоадер
window.addEventListener('load', () => {
    const preloader = document.querySelector('.preloader');
    setTimeout(() => {
        preloader.classList.add('hidden');
    }, 1000);
});

// Скролл эффект для хедера
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Эффект свечения карточек при наведении на кнопку "НАЧАТЬ ИГРАТЬ"
const btnPlay = document.querySelector('.btn-play');
const heroCards = document.querySelectorAll('.hero-card');
const cardsGlow = document.querySelector('.cards-glow');
const cardsBackground = document.querySelector('.cards-background');

btnPlay.addEventListener('mouseenter', () => {
    heroCards.forEach(card => {
        card.classList.add('glow-active');
    });
    cardsGlow.style.opacity = '0.41';
    cardsBackground.style.filter = 'grayscale(0)';
});

btnPlay.addEventListener('mouseleave', () => {
    heroCards.forEach(card => {
        card.classList.remove('glow-active');
    });
    cardsGlow.style.opacity = '0';
    cardsBackground.style.filter = 'grayscale(1)';
});

// Копирование IP при клике на карточку игры
document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('card-play-btn') || 
            e.target.closest('.card-play-btn')) {
            return;
        }
        
        const ip = card.dataset.ip || 'play.aimacademy.ru';
        
        navigator.clipboard.writeText(ip).then(() => {
            showNotification('IP адрес скопирован!');
        }).catch(() => {
            showNotification('Не удалось скопировать IP');
        });
    });
});

// Показ уведомления
function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(117, 153, 104, 0.95);
        color: #E6FFDD;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 18px;
        font-weight: 700;
        z-index: 10000;
        animation: fadeInOut 2s ease;
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

// Анимация при скролле
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.mode-card, .news-card, .social-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Плавный скролл к секции при клике на "НАЧАТЬ ИГРАТЬ"
btnPlay.addEventListener('click', (e) => {
    e.preventDefault();
    const startSection = document.querySelector('.start-playing-section');
    if (startSection) {
        startSection.scrollIntoView({ behavior: 'smooth' });
    }
});

// Плавная прокрутка для ссылок навигации
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Анимация для fadeInOut
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    }
`;
document.head.appendChild(style);





// Фильтрация категорий по тегам
const filterTags = document.querySelectorAll('.mode-tag-badge');
const categories = document.querySelectorAll('.modes-category');

let activeFilter = 'all';

filterTags.forEach(tag => {
    tag.addEventListener('click', () => {
        const filter = tag.dataset.filter;
        
        // Обновляем активный тег
        filterTags.forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        
        activeFilter = filter;
        
        // Фильтруем категории
        categories.forEach(category => {
            const categoryType = category.dataset.category;
            
            if (filter === 'all' || categoryType === filter) {
                category.style.display = 'flex';
            } else {
                category.style.display = 'none';
            }
        });
        

    });
});

// Устанавливаем "ВСЕ" как активный по умолчанию
const allTag = document.querySelector('.mode-tag-badge[data-filter="all"]');
if (allTag) {
    allTag.classList.add('active');
}
