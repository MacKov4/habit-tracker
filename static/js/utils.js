/**
 * Вспомогательные функции для работы с датами, текстом и UI
 */

export const formatDate = (dateVal) => {
    if (!dateVal) return 'Неизвестно';
    const date = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    if (isNaN(date.getTime())) return 'Неизвестно';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
};

export const formatDateFromISO = (isoStr) => {
    const [y, m, d] = isoStr.split('-');
    return `${d}.${m}.${y}`;
};

export const formatActivityDate = (dateInput) => {
    if (!dateInput) return 'Только что';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
        return new Date().toLocaleDateString('ru-RU', {
            month: 'long',
            day: 'numeric'
        }) + ' • ' + new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    const months = [
        "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
        "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const timeDisplay = (hours === '00' && minutes === '00')
        ? new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : `${hours}:${minutes}`;

    return `${month} ${day} • ${timeDisplay}`;
};

export const getCategoryIcon = (category) => {
    const icons = {
        'health': '🏃',
        'sport': '💪',
        'learning': '📚',
        'productivity': '💻',
        'mental': '🧘',
        'household': '🧹',
        'finance': '💰',
        'social': '🧑‍🤝‍🧑',
        'creativity': '🎨',
        'digital': '📱',
        'morning': '🌅',
        'evening': '🌙',
        'other': '📝'
    };
    return icons[category] || icons['other'];
};

export const getCategoryName = (category) => {
    const names = {
        health: 'Здоровье',
        sport: 'Спорт',
        learning: 'Учёба и саморазвитие',
        productivity: 'Продуктивность',
        mental: 'Ментальное здоровье',
        household: 'Быт и порядок',
        finance: 'Финансы',
        social: 'Социальные связи',
        creativity: 'Творчество',
        digital: 'Цифровая гигиена',
        morning: 'Утренние привычки',
        evening: 'Вечерние привычки',
        other: 'Другое'
    };
    return names[category] || category || 'Другое';
};

export const getCategoryColor = (category) => {
    const colors = {
        health: '#ff6b6b',
        sport: '#ff9800',
        learning: '#2196f3',
        productivity: '#4caf50',
        mental: '#9c27b0',
        household: '#607d8b',
        finance: '#ffc107',
        social: '#e91e63',
        creativity: '#ff5722',
        digital: '#00bcd4',
        morning: '#ff9800',
        evening: '#3f51b5',
        other: '#9e9e9e'
    };
    return colors[category] || '#9e9e9e';
};

export const animateCounter = (element, targetValue) => {
    const start = parseInt(element.textContent) || 0;
    const end = targetValue;
    const duration = 600;
    const startTime = performance.now();

    const step = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (end - start) * eased);
        element.textContent = current + '%';
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
};

export const isSameDay = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

export const getFrequencyName = (frequency, customDays) => {
    if (frequency === 'custom') {
        if (!customDays || (Array.isArray(customDays) && customDays.length === 0)) {
            return 'Свой график';
        }
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        let daysArray = Array.isArray(customDays) ? customDays : String(customDays).split(',').map(d => parseInt(d.trim(), 10));
        try {
            return daysArray
                .filter(day => !isNaN(day) && day >= 0 && day <= 6)
                .map(day => dayNames[day])
                .join(', ') || 'Свой график';
        } catch (e) {
            return 'Свой график';
        }
    }
    const types = { daily: 'Ежедневно', weekly: 'Еженедельно' };
    return types[frequency] || frequency;
};
