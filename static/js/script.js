import {
    formatDate, formatDateFromISO, formatActivityDate,
    getCategoryIcon, getCategoryName, getCategoryColor,
    animateCounter, isSameDay, getFrequencyName
} from './utils.js';

import { API } from './services/api.js';
import { ChartsManager } from './components/charts.js';
import { CalendarManager } from './components/calendar.js';
import { ModalManager } from './components/modals.js';
import { ActivityManager } from './components/activity.js';
import { FilterManager } from './components/filters.js';
import { DashboardManager } from './components/dashboard.js';
import { HABIT_TEMPLATES } from './constants.js';

class HabitTracker {
    constructor() {
        this.habits = [];
        this.completions = {};
        this.skipped = {};
        this.actionTimes = {};
        this.dayActionTimes = {}; // { dateStr: { habitId: { completed: 'time', skipped: 'time' } } }
        this.notes = {};
        this.missedHabits = {};
        this.currentDate = new Date();
        this.activeTab = 'dashboard';
        this.deletingHabitId = null;
        this.activeFilter = 'all'; // 'all', 'cat:health', 'list:MyList'
        this.customLists = {};
        this.API = API;
        this.habitTemplates = HABIT_TEMPLATES;

        this.chartsManager = new ChartsManager(this);
        this.calendarManager = new CalendarManager(this);
        this.modalManager = new ModalManager(this);
        this.activityManager = new ActivityManager(this);
        this.filterManager = new FilterManager(this);
        this.dashboardManager = new DashboardManager(this);

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.chartsManager.setupCharts();
        this.calendarManager.setupCalendar();
        this.modalManager.setupCategoryListeners();
        await this.loadHabitsList();
        this.loadActiveTab();
        this.loadSettings();
        this.updateHeaderStats();
        this.setupMenuHandlers();
        this.initNotifications();
    }
    setupMenuHandlers() {

        document.getElementById('habitMenu').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            e.stopPropagation();
            const action = btn.dataset.action;
            const id = this._menuHabitId;
            if (!id) return;

            this.closeHabitMenu();

            if (action === 'skip') this.toggleHabitSkip(id);
            if (action === 'add-note') this.openNoteModal(id);
            if (action === 'view-notes') this.openViewNotesModal(id);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#habitMenu') && !e.target.closest('.habit-row__menu-btn')) {
                this.closeHabitMenu();
            }
        });
    }
    openHabitMenu(event, habitId) {
        event.stopPropagation();
        const menu = document.getElementById('habitMenu');
        if (!menu) return;

        // Если меню уже открыто для этой же привычки — закрываем его (тоггл)
        if (menu.style.display === 'block' && this._menuHabitId === String(habitId)) {
            this.closeHabitMenu();
            return;
        }

        this._menuHabitId = String(habitId);

        // Проверяем, выполнена ли привычка
        const isCompleted = this.isHabitCompletedToday(habitId);
        const divider = menu.querySelector('.habit-menu__divider');

        // Находим элемент текста внутри кнопки пропуска
        const skipBtn = menu.querySelector('[data-action="skip"]');
        if (skipBtn) {
            if (isCompleted) {
                // Если выполнено — скрываем кнопку пропуска и разделитель
                skipBtn.style.display = 'none';
                if (divider) divider.style.display = 'none';
            } else {
                // Если не выполнено — показываем и настраиваем текст
                skipBtn.style.display = 'flex';
                if (divider) divider.style.display = 'block';

                const isSkipped = this.isHabitSkippedToday(habitId);

                // Если пропущено, меняем текст и иконку
                if (isSkipped) {
                    skipBtn.innerHTML = `
                        <i class="fas fa-undo habit-menu__icon habit-menu__icon--orange"></i>
                        <span class="habit-menu__text">Отменить пропуск</span>
                    `;
                } else {
                    skipBtn.innerHTML = `
                        <i class="fas fa-forward habit-menu__icon habit-menu__icon--orange"></i>
                        <span class="habit-menu__text">Отметить как пропущено</span>
                    `;
                }
            }
        }

        const btn = event.currentTarget;
        const rect = btn.getBoundingClientRect();
        const menuW = 230;

        let left = rect.right - menuW;
        if (left < 8) left = 8;

        menu.style.visibility = 'hidden';
        menu.style.display = 'block';
        const menuH = menu.offsetHeight;
        menu.style.visibility = '';

        // Позиционирование меню над кнопкой
        const top = rect.top - menuH - 6;

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }

    closeHabitMenu() {
        const menu = document.getElementById('habitMenu');
        if (menu) menu.style.display = 'none';
    }



    getHabitsForDate(date) {
        const rawDay = date.getDay();
        const dayOfWeek = (rawDay === 0) ? 6 : rawDay - 1;

        return this.habits.filter(habit => {
            if (habit.frequency === 'daily') return true;
            if (habit.frequency === 'weekly') return dayOfWeek === 0;

            if (habit.frequency === 'custom') {
                const raw = habit.customDays ?? habit.custom_days;
                if (!raw) return false;

                let daysAsNumbers;
                if (Array.isArray(raw)) {
                    daysAsNumbers = raw.map(d => parseInt(d, 10));
                } else if (typeof raw === 'string') {
                    daysAsNumbers = raw.split(',').map(d => parseInt(d.trim(), 10));
                } else {
                    daysAsNumbers = [parseInt(raw, 10)];
                }

                const result = daysAsNumbers.includes(dayOfWeek);

                console.log(`[getHabitsForDate] habit="${habit.name}" | today=${dayOfWeek} (${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][dayOfWeek]}) | savedDays=${JSON.stringify(daysAsNumbers)} | result=${result}`);

                return result;
            }
            return false;
        });
    }

    setupEventListeners() {

        // Делегирование кликов по списку привычек

        const habitsList = document.getElementById('habitsList');
        if (habitsList && !habitsList.dataset.listenerAdded) {
            habitsList.addEventListener('click', (e) => {
                const editBtn = e.target.closest('.btn-edit');
                if (editBtn) {
                    const habitItem = editBtn.closest('.habit-item');
                    const habitId = habitItem?.dataset.habitId;
                    if (habitId) this.editHabit(habitId);
                    return;
                }

                const deleteBtn = e.target.closest('.btn-delete');
                if (deleteBtn) {
                    const habitItem = deleteBtn.closest('.habit-item');
                    const habitId = habitItem?.dataset.habitId;
                    if (habitId) this.deleteHabit(habitId);
                    return;
                }
            });
            habitsList.dataset.listenerAdded = "true";
        }


        // Переключение вкладок

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                if (tabName) this.switchTab(tabName);
            });
        });

        // Модалка добавления/редактирования привычки

        const addHabitBtn = document.getElementById('addHabitBtn');
        const addNewHabitBtn = document.getElementById('addNewHabitBtn');
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');

        if (addHabitBtn) addHabitBtn.addEventListener('click', () => this.openHabitModal());
        if (addNewHabitBtn) addNewHabitBtn.addEventListener('click', () => this.openHabitModal());

        if (closeModal) closeModal.addEventListener('click', () => this.closeHabitModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeHabitModal());

        // Закрытие по клику вне модалки редактирования
        const habitModal = document.getElementById('habitModal');
        if (habitModal) {
            habitModal.addEventListener('click', (e) => {
                if (e.target === habitModal) this.closeHabitModal();
            });
        }

        // Закрытие по клику вне модалки создания списка
        const customListModal = document.getElementById('customListModal');
        if (customListModal) {
            customListModal.addEventListener('click', (e) => {
                if (e.target === customListModal) this.closeCustomListModal();
            });
        }

        // Отправка формы
        const habitForm = document.getElementById('habitForm');
        if (habitForm && !habitForm.dataset.listenerAdded) {
            habitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveHabit();
            });
            habitForm.dataset.listenerAdded = "true";
        }

        // Частота 

        const frequencySelect = document.getElementById('habitFrequency');
        if (frequencySelect) {
            frequencySelect.addEventListener('change', (e) => {
                const group = document.getElementById('customDaysGroup');
                if (group) group.style.display = (e.target.value === 'custom') ? 'block' : 'none';
            });
        }

        // Модалка подтверждения УДАЛЕНИЯ 
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const closeDeleteModalBtn = document.getElementById('closeDeleteModal');

        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', async () => {
                if (!this.deletingHabitId) return;

                try {
                    const result = await API.deleteHabit(this.deletingHabitId);

                    if (result.success) {
                        this.closeDeleteModal();
                        this.showToast('Привычка успешно удалена!', false);
                        await this.loadHabitsList();
                    } else {
                        this.showToast('Ошибка при удалении', true);
                    }
                } catch (error) {
                    this.showToast('Ошибка сети', true);
                    console.error(error);
                }
            });
        }

        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());
        if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', () => this.closeDeleteModal());



        // Остальные обработчики (быстрые действия, календарь)

        const markAllBtn = document.getElementById('markAllBtn');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');

        if (markAllBtn) markAllBtn.addEventListener('click', () => this.markAllComplete());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
        if (importBtn && importFile) importBtn.addEventListener('click', () => importFile.click());
        if (importFile) importFile.addEventListener('change', (e) => this.importData(e));

        const prevMonth = document.getElementById('prevMonth');
        const nextMonth = document.getElementById('nextMonth');
        if (prevMonth) prevMonth.addEventListener('click', () => this.navigateMonth(-1));
        if (nextMonth) nextMonth.addEventListener('click', () => this.navigateMonth(1));

        // МОДАЛКА ПОДТВЕРЖДЕНИЯ ВЫХОДА

        const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
        const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
        const closeLogoutModalBtn = document.getElementById('closeLogoutModal');

        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener('click', () => {
                window.location.href = LOGOUT_URL;
            });
        }

        if (cancelLogoutBtn) {
            cancelLogoutBtn.addEventListener('click', () => {
                const modal = document.getElementById('logoutConfirmModal');
                if (modal) modal.classList.remove('show');
            });
        }

        if (closeLogoutModalBtn) {
            closeLogoutModalBtn.addEventListener('click', () => {
                const modal = document.getElementById('logoutConfirmModal');
                if (modal) modal.classList.remove('show');
            });
        }

        // Настройки TickTick
        const darkModeToggleTick = document.getElementById('darkModeToggleTick');
        if (darkModeToggleTick) {
            darkModeToggleTick.addEventListener('change', (e) => {
                document.body.classList.toggle('dark-mode', e.target.checked);
                localStorage.setItem('darkMode', e.target.checked);
            });
            const savedDark = localStorage.getItem('darkMode') === 'true';
            darkModeToggleTick.checked = savedDark;
            document.body.classList.toggle('dark-mode', savedDark);
        }

        const exportBtnTick = document.getElementById('exportBtnTick');
        if (exportBtnTick) exportBtnTick.addEventListener('click', () => this.exportData());

        const importBtnTick = document.getElementById('importBtnTick');
        const importFileTick = document.getElementById('importFileTick');
        if (importBtnTick && importFileTick) {
            importBtnTick.addEventListener('click', () => importFileTick.click());
            importFileTick.addEventListener('change', (e) => this.importData(e));
        }

        const clearDataBtnTick = document.getElementById('clearDataBtnTick');
        const clearDataConfirmModal = document.getElementById('clearDataConfirmModal');
        if (clearDataBtnTick && clearDataConfirmModal) {
            clearDataBtnTick.addEventListener('click', () => {
                clearDataConfirmModal.classList.add('show');
            });
            
            document.getElementById('closeClearDataModal').addEventListener('click', () => {
                clearDataConfirmModal.classList.remove('show');
            });
            
            document.getElementById('cancelClearDataBtn').addEventListener('click', () => {
                clearDataConfirmModal.classList.remove('show');
            });
            
            document.getElementById('confirmClearDataBtn').addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/clear_data', { method: 'POST' });
                    if (response.ok) {
                        this.showToast('Данные успешно очищены', false);
                        clearDataConfirmModal.classList.remove('show');
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        this.showToast('Ошибка при очистке данных', true);
                    }
                } catch (error) {
                    console.error('Clear data error:', error);
                    this.showToast('Ошибка при очистке данных', true);
                }
            });
        }

        // Внутренняя навигация настроек
        document.querySelectorAll('.sidebar-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const paneId = e.currentTarget.dataset.settingsTab;

                // Active class for sidebar
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                e.currentTarget.classList.add('active');

                // Active class for panes
                document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
                const targetPane = document.getElementById(`pane-${paneId}`);
                if (targetPane) targetPane.classList.add('active');
            });
        });

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', (e) => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const color = e.currentTarget.dataset.color;
                document.documentElement.style.setProperty('--primary-color', e.currentTarget.style.background);
                localStorage.setItem('primaryColor', color);
            });
        });
    }



    async toggleHabitCompletion(habitId) {
        const today = formatDate(new Date());
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const hid = String(habitId);
        const isCompleted = this.isHabitCompletedToday(hid);
        const newStatus = !isCompleted;

        try {
            const result = await API.saveLog(parseInt(hid), todayStr, newStatus, 0);

            if (result.success) {
                if (!this.completions[today]) this.completions[today] = {};
                this.completions[today][hid] = newStatus;

                if (newStatus) {
                    this.showToast('Привычка выполнена! 🌟');
                } else {
                    this.showToast('Выполнение отменено');
                }

                this.updateDashboard();
                this.updateHeaderStats();
            }
        } catch (error) {
            this.showToast('Ошибка сохранения', true);
        }
    }


    switchTab(tabName) {
        this.activeTab = tabName;
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
        this.loadActiveTab();

        // Scroll mobile charts to the end when the tab becomes visible
        if (tabName === 'analytics' && this.chartsManager && this.chartsManager._mobile) {
            setTimeout(() => {
                if (this.chartsManager._mobile.monthly && this.chartsManager._mobile.monthly.inner) {
                    this.chartsManager._mobile.monthly.inner.scrollLeft = 9999;
                }
                if (this.chartsManager._mobile.skip && this.chartsManager._mobile.skip.inner) {
                    this.chartsManager._mobile.skip.inner.scrollLeft = 9999;
                }
            }, 100);
        }
    }

    loadActiveTab() {
        switch (this.activeTab) {
            case 'dashboard':
                this.updateDashboard();
                break;
                //  case 'habits':
                //    this.loadHabitsList();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'calendar':
                this.updateCalendar();
                break;
            case 'profile':
                this.loadProfile();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    loadProfile() {
        const totalHabits = this.habits.length;
        let totalDone = 0;
        Object.values(this.completions).forEach(day => {
            Object.values(day).forEach(done => {
                if (done) totalDone++;
            });
        });

        const activeHabits = this.habits.length; // Можно усложнить логику "активности"
        const stats = this.chartsManager.updateAnalyticsStats(); // Используем существующую логику
        const bestStreak = stats?.longestStreak || 0;

        document.getElementById('totalHabitsDone').textContent = totalDone;
        document.getElementById('totalActiveHabits').textContent = activeHabits;
        document.getElementById('globalBestStreak').textContent = bestStreak;

        // Дата регистрации (заглушка или из БД)
        document.getElementById('joinDateText').textContent = new Date().toLocaleDateString();
    }

    loadSettings() {
        // Инициализация темы при загрузке
        const themeColor = document.getElementById('pane-appearance')?.dataset.currentTheme || '#667eea';
        this.applyThemeColor(themeColor);
    }

    setAccentColor(color) {
        this.applyThemeColor(color);
        
        // Визуально отмечаем активный кружочек
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.toggle('active', opt.style.background.includes(color));
        });

        // Сохраняем на сервер
        this.API.updateSettings({ theme_color: color }).catch(console.error);
    }

    async updateNotificationSetting(key, value) {
        // Если включаются уведомления, запрашиваем разрешение у браузера
        if (value === true && (key === 'daily_reminders' || key === 'internet_reminders')) {
            if ("Notification" in window) {
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    this.showToast('Для работы уведомлений нужно разрешение браузера', true);
                    // Визуально выключаем переключатель, если отказано
                    const toggle = document.getElementById(key === 'daily_reminders' ? 'dailyRemindersToggle' : 'internetRemindersToggle');
                    if (toggle) toggle.checked = false;
                    return;
                } else {
                    this.showToast('Уведомления успешно включены! 🔔');
                    // Тестовое уведомление
                    this.sendBrowserNotification('Трекер Привычек', 'Вы успешно включили уведомления!');
                }
            } else {
                this.showToast('Ваш браузер не поддерживает уведомления', true);
                return;
            }
        }

        try {
            const result = await this.API.updateSettings({ [key]: value });
            if (result.success) {
                this.showToast('Настройки обновлены');
                
                // Перезагружаем настройки (если изменилось время или тип)
                if (key === 'daily_reminders' || key === 'reminder_time' || key === 'internet_reminders') {
                    this.initNotifications();
                }
            } else {
                this.showToast('Ошибка при обновлении', true);
            }
        } catch (error) {
            console.error('Update setting error:', error);
            this.showToast('Ошибка сети', true);
        }
    }

    initNotifications() {
        // Очищаем старый интервал если есть
        if (this.notificationInterval) {
            clearInterval(this.notificationInterval);
        }

        // Проверяем настройки каждые 60 секунд
        this.notificationInterval = setInterval(() => {
            this.checkReminders();
        }, 60000);

        // Первый запуск сразу
        this.checkReminders();
    }

    async checkReminders() {
        if (!("Notification" in window) || Notification.permission !== "granted") return;

        const dailyToggle = document.getElementById('dailyRemindersToggle');
        const timeInput = document.getElementById('reminderTimeInput');
        const internetToggle = document.getElementById('internetRemindersToggle');

        if (!dailyToggle || !timeInput) return;

        const isDailyEnabled = dailyToggle.checked;
        const reminderTime = timeInput.value; // "HH:MM"
        const isInternetEnabled = internetToggle ? internetToggle.checked : false;

        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // 1. Ежедневное напоминание
        if (isDailyEnabled && currentTime === reminderTime) {
            const lastSent = localStorage.getItem('lastDailyReminderSent');
            const today = formatDate(now);
            
            if (lastSent !== today) {
                const todayHabits = this.getTodayHabits();
                const uncompletedCount = todayHabits.filter(h => !this.isHabitCompletedToday(h.id)).length;
                
                if (uncompletedCount > 0) {
                    this.sendBrowserNotification('Пора заняться привычками!', `У вас осталось ${uncompletedCount} невыполненных задач на сегодня.`);
                    
                    // Отправка EMAIL если включено
                    const emailToggle = document.getElementById('emailNotificationsToggle');
                    if (emailToggle && emailToggle.checked) {
                        this.API.sendReminderEmail(uncompletedCount).catch(err => console.error('Email error:', err));
                    }

                    localStorage.setItem('lastDailyReminderSent', today);
                }
            }
        }

        // 2. Интернет-напоминание
        if (isInternetEnabled) {
            const lastInternetSent = localStorage.getItem('lastInternetReminderSent');
            const nowTs = Date.now();
            const threeHours = 3 * 60 * 60 * 1000;

            if (!lastInternetSent || (nowTs - parseInt(lastInternetSent)) > threeHours) {
                const todayHabits = this.getTodayHabits();
                const uncompleted = todayHabits.filter(h => !this.isHabitCompletedToday(h.id));
                
                if (uncompleted.length > 0) {
                    const randomHabit = uncompleted[Math.floor(Math.random() * uncompleted.length)];
                    this.sendBrowserNotification('Не забудьте!', `Как насчет того, чтобы выполнить: ${randomHabit.name}?`);
                    localStorage.setItem('lastInternetReminderSent', nowTs.toString());
                }
            }
        }
    }

    sendBrowserNotification(title, body) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        
        try {
            new Notification(title, {
                body: body,
                icon: '/static/img/char_happy.png' // Используем счастливого персонажа
            });
        } catch (e) {
            console.error('Error sending notification:', e);
        }
    }


    applyThemeColor(color) {
        const root = document.documentElement;
        root.style.setProperty('--primary-color', color);
        
        // Генерируем градиент на основе цвета (упрощенно)
        // В будущем можно передавать полный набор цветов палитры
        const gradient = `linear-gradient(135deg, ${color}, ${this.adjustColor(color, -20)})`;
        root.style.setProperty('--primary-gradient', gradient);
        
        // Если мы не в темной теме, обновляем и фоновый градиент (опционально)
        if (!document.body.classList.contains('dark-mode')) {
            root.style.setProperty('--bg-gradient', gradient);
        }
    }

    // Утилита для затемнения цвета
    adjustColor(hex, percent) {
        const num = parseInt(hex.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
    }

    openChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) modal.classList.add('show');
    }

    closeChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.classList.remove('show');
            const form = document.getElementById('changePasswordForm');
            form.reset();
            // Сбрасываем стили ошибок
            form.querySelectorAll('input').forEach(i => i.style.borderColor = '');
        }
    }

    async saveNewPassword() {
        const oldPasswordInput = document.getElementById('oldPassword');
        const newPasswordInput = document.getElementById('newPassword');
        const confirmInput = document.getElementById('confirmNewPassword');
        const errorDiv = document.getElementById('passwordError');

        const oldPassword = oldPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmNewPassword = confirmInput.value.trim();

        const setError = (message, inputs = []) => {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            inputs.forEach(input => {
                input.style.borderColor = '#ef4444';
                setTimeout(() => {
                    input.style.borderColor = '';
                }, 2000);
            });
            // Скрыть текст ошибки через 3 секунды
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        };

        if (!oldPassword || !newPassword || !confirmNewPassword) {
            setError('Пожалуйста, заполните все поля', [oldPasswordInput, newPasswordInput, confirmInput]);
            return;
        }

        if (newPassword !== confirmNewPassword) {
            setError('Новые пароли не совпадают', [newPasswordInput, confirmInput]);
            return;
        }

        if (newPassword.length < 6) {
            setError('Пароль должен быть не менее 6 символов', [newPasswordInput]);
            return;
        }

        try {
            const result = await this.API.changePassword(oldPassword, newPassword);
            if (result.success) {
                this.showToast('Пароль успешно изменен!');
                this.closeChangePasswordModal();
            } else {
                setError(result.error || 'Ошибка при смене пароля', 
                    (result.error && result.error.toLowerCase().includes('текущий')) ? [oldPasswordInput] : [newPasswordInput]);
            }
        } catch (error) {
            setError('Ошибка сети. Проверьте соединение.', []);
            console.error('Password change error:', error);
        }
    }

    updateDashboard() {
        this.updateHabitFilters();
        this.updateTodayHabits();
        this.updateRecentActivity();
        this.chartsManager.updateDashboard();
    }

    updateHabitFilters() {
        const select = document.getElementById('habitFilterSelect');
        const deleteBtn = document.getElementById('deleteListBtn');
        if (!select) return;

        // Save current selection to restore if possible
        const currentSelection = select.value || this.activeFilter;

        select.innerHTML = '';

        // "Все" filter
        select.add(new Option('Все привычки', 'all'));

        // Category filters (dynamic based on today's habits)
        const todayHabits = this.getTodayHabits();
        const activeCategories = [...new Set(todayHabits.map(h => h.category))];

        if (activeCategories.length > 0) {
            const groupCats = document.createElement('optgroup');
            groupCats.label = "Категории";
            activeCategories.forEach(cat => {
                const catName = getCategoryName(cat);
                const icon = getCategoryIcon(cat);
                const optionText = (icon && typeof icon === 'string' && icon.length < 5) ? `${icon} ${catName}` : catName;
                groupCats.appendChild(new Option(optionText, `cat:${cat}`));
            });
            select.appendChild(groupCats);
        }

        // Custom lists
        const listNames = Object.keys(this.customLists);
        if (listNames.length > 0) {
            const groupLists = document.createElement('optgroup');
            groupLists.label = "Мои списки";
            listNames.forEach(listName => {
                groupLists.appendChild(new Option(`🔖 ${listName}`, `list:${listName}`));
            });
            select.appendChild(groupLists);
        }

        // Restore selection or default to 'all'
        let hasOption = Array.from(select.options).some(opt => opt.value === currentSelection);
        select.value = hasOption ? currentSelection : 'all';
        this.activeFilter = select.value;

        // Update delete button visibility
        if (deleteBtn) {
            if (this.activeFilter.startsWith('list:')) {
                deleteBtn.style.display = 'block';
                const currentListName = this.activeFilter.split(':')[1];
                deleteBtn.onclick = () => this.deleteCustomList(currentListName);
            } else {
                deleteBtn.style.display = 'none';
            }
        }

        // Add event listener if not already there
        if (!select.dataset.listenerAdded) {
            select.addEventListener('change', (e) => {
                this.setFilter(e.target.value);
            });
            select.dataset.listenerAdded = 'true';
        }
    }

    setFilter(filterId) {
        this.activeFilter = filterId;
        const select = document.getElementById('habitFilterSelect');
        if (select && select.value !== filterId) {
            select.value = filterId;
        }
        this.updateHabitFilters(); // Re-run to update delete button
        this.updateTodayHabits();
    }

    openCustomListModal() {
        const modal = document.getElementById('customListModal');
        const selectionGrid = document.getElementById('listHabitsSelection');
        if (!modal || !selectionGrid) return;

        selectionGrid.innerHTML = '';
        const allHabits = this.habits;

        if (allHabits.length === 0) {
            selectionGrid.innerHTML = '<p class="empty-state">У вас пока нет привычек для выбора</p>';
        } else {
            allHabits.forEach(habit => {
                const icon = getCategoryIcon(habit.category);
                const color = getCategoryColor(habit.category);

                const item = document.createElement('label');
                item.className = 'selection-item';
                item.innerHTML = `
                    <input type="checkbox" name="habit-select" value="${habit.id}">
                    <div class="habit-cat-icon" style="color:${color}; background:${color}15;">${icon}</div>
                    <span class="habit-name">${habit.name}</span>
                `;
                selectionGrid.appendChild(item);
            });
        }

        modal.classList.add('show');
    }

    closeCustomListModal() {
        const modal = document.getElementById('customListModal');
        if (modal) modal.classList.remove('show');
    }

    toggleSelectAllHabits(selected) {
        const checkboxes = document.querySelectorAll('input[name="habit-select"]');
        checkboxes.forEach(cb => cb.checked = selected);
    }

    async loadCustomLists() {
        try {
            this.customLists = await API.getLists();
            this.updateHabitFilters();
        } catch (error) {
            console.error('Ошибка загрузки списков:', error);
        }
    }

    async saveCustomList() {
        const name = document.getElementById('listName').value.trim();
        const selectedHabits = Array.from(document.querySelectorAll('input[name="habit-select"]:checked'))
            .map(cb => cb.value);

        if (!name) {
            this.showToast('Введите название списка', true);
            return;
        }
        if (selectedHabits.length === 0) {
            this.showToast('Выберите хотя бы одну привычку', true);
            return;
        }

        try {
            const result = await API.saveList(name, selectedHabits);
            if (result.success) {
                await this.loadCustomLists();
                this.closeCustomListModal();
                this.showToast(`Список "${name}" сохранен!`);
                this.setFilter(`list:${name}`);
            }
        } catch (error) {
            this.showToast('Ошибка сохранения списка', true);
            console.error(error);
        }
    }

    async deleteCustomList(name) {
        this.showConfirm({
            title: 'Удалить список?',
            message: `Вы уверены, что хотите удалить список "${name}"? Привычки в списке не будут удалены.`,
            confirmText: 'Удалить',
            onConfirm: async () => {
                try {
                    const result = await API.deleteList(name);
                    if (result.success) {
                        if (this.activeFilter === `list:${name}`) {
                            this.activeFilter = 'all';
                        }
                        await this.loadCustomLists();
                        this.updateTodayHabits();
                        this.showToast(`Список "${name}" удален`);
                    }
                } catch (error) {
                    this.showToast('Ошибка при удалении', true);
                    console.error(error);
                }
            }
        });
    }

    showConfirm({ title, message, confirmText, onConfirm }) {
        const modal = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmTitle');
        const msgEl = document.getElementById('confirmMessage');
        const actionBtn = document.getElementById('confirmActionBtn');
        const cancelBtn = document.getElementById('confirmCancelBtn');

        if (!modal || !titleEl || !msgEl || !actionBtn || !cancelBtn) return;

        titleEl.textContent = title || 'Удалить?';
        msgEl.textContent = message || 'Это действие нельзя будет отменить.';
        actionBtn.textContent = confirmText || 'Удалить';

        modal.classList.add('show');

        // Очистка предыдущих слушателей
        const newActionBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        const close = () => modal.classList.remove('show');

        newActionBtn.addEventListener('click', () => {
            onConfirm();
            close();
        });

        newCancelBtn.addEventListener('click', close);

        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    }

    updateRecentActivity() {
        this.activityManager.updateRecentActivity();
    }

    updateTodayHabits() {
        this.dashboardManager.updateTodayHabits();
    }

    getHabitProgress(habitId) {
        return this.dashboardManager.getHabitProgress(habitId);
    }

    addProgress(habitId) {
        this.dashboardManager.addProgress(habitId);
    }

    validateCounterInput(input, target, current) {
        this.dashboardManager.validateCounterInput(input, target, current);
    }



    updateHeaderStats() {
        this.dashboardManager.updateHeaderStats();
    }

    isHabitDueToday(habit) {
        if (!habit || !habit.frequency) return false;

        if (habit.frequency === 'daily') return true;
        if (habit.frequency === 'weekly') return true;

        if (habit.frequency === 'custom') {
            const today = new Date();
            const jsDay = today.getDay();
            const myDayIndex = (jsDay === 0) ? 6 : jsDay - 1;

            let customDaysRaw = habit.customDays || habit.custom_days || '';

            if (!customDaysRaw) return false;
            let scheduledDays = Array.isArray(customDaysRaw)
                ? customDaysRaw.map(d => parseInt(d, 10))
                : String(customDaysRaw).split(',').map(d => parseInt(d.trim(), 10));

            scheduledDays = scheduledDays.filter(d => !isNaN(d));

            const result = scheduledDays.includes(myDayIndex);

            console.log(`[isHabitDueToday] habit="${habit.name}" | today=${myDayIndex} (${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][myDayIndex]}) | savedDays=${JSON.stringify(scheduledDays)} | result=${result}`);
            return result;
        }

        return false;
    }

    // ПОЛУЧЕНИЕ ПРИВЫЧЕК НА СЕГОДНЯ

    getTodayHabits() {
        const habits = this.habits.filter(habit => this.isHabitDueToday(habit));

        console.log(`[getTodayHabits] Найдено ${habits.length} привычек на сегодня`);
        return habits;
    }
    isHabitCompletedToday(habitId) {
        const today = formatDate(new Date());
        return !!(this.completions && this.completions[today] && this.completions[today][String(habitId)]);
    }
    async loadHabitsList() {
        try {
            const [habitsData, logsData] = await Promise.all([
                API.getHabits(),
                API.getLogs()
            ]);

            this.habits = habitsData;
            this.completions = {};
            this.progress = {};
            this.skipped = {};
            this.actionTimes = {}; // ОЧИЩАЕМ перед загрузкой
            this.dayActionTimes = {};

            const now = new Date();
            const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            console.log("[Debug] Local Today ISO:", todayISO);

            for (const [date, habits] of Object.entries(logsData)) {
                const dateDisplay = formatDateFromISO(date);
                this.completions[dateDisplay] = {};
                if (!this.progress[date]) this.progress[date] = {};
                if (!this.skipped[date]) this.skipped[date] = {};
                if (!this.dayActionTimes[date]) this.dayActionTimes[date] = {};

                for (const [habitId, log] of Object.entries(habits)) {
                    this.completions[dateDisplay][habitId] = log.completed;
                    this.progress[date][habitId] = log.progress || 0;
                    if (log.skipped) this.skipped[date][habitId] = true;

                    if (log.action_time) {
                        this.dayActionTimes[date][habitId] = {
                            completed: log.completed ? log.action_time : null,
                            skipped: log.skipped ? log.action_time : null
                        };

                        // Совместимость со старым кодом для текущего дня
                        if (date === todayISO) {
                            if (log.completed) this.actionTimes[habitId + '_completed'] = log.action_time;
                            if (log.skipped) this.actionTimes[habitId + '_skipped'] = log.action_time;
                        }
                    }
                }
            }

            // Загружаем списки с сервера
            await this.loadCustomLists();

            const list = document.getElementById('habitsList');
            if (list) {
                list.innerHTML = '';
                if (!this.habits || this.habits.length === 0) {
                    list.innerHTML = `
                        <div class="empty-state">
                            <h3>Нет привычек</h3>
                            <p>Добавьте свою первую привычку и начните отслеживать прогресс!</p>
                        </div>
                    `;
                } else {
                    this.habits.forEach(habit => {
                        const habitItem = document.createElement('div');
                        habitItem.className = `habit-item`;
                        habitItem.style.borderLeftColor = getCategoryColor(habit.category);
                        habitItem.setAttribute('data-habit-id', habit.id);

                        const streak = this.getStreakData().data[this.habits.indexOf(habit)] || 0;
                        const categoryColor = getCategoryColor(habit.category);

                        habitItem.innerHTML = `
                            <div class="habit-info">
                                <h4>${habit.name}</h4>
                                ${habit.description ? `<p class="habit-desc">${habit.description}</p>` : ''}
                                <div class="habit-meta">
                                    <div class="meta-tag tag-category" style="color: ${categoryColor}; background: ${categoryColor}15; border-color: ${categoryColor}30;">
                                        ${getCategoryIcon(habit.category)}
                                        ${getCategoryName(habit.category)}
                                    </div>
                                    <div class="meta-tag">
                                        <i class="fas fa-calendar-alt"></i>
                                        ${getFrequencyName(habit.frequency, habit.customDays || habit.custom_days)}
                                    </div>
                                    ${streak > 0 ? `
                                    <div class="meta-tag tag-streak">
                                        <i class="fas fa-fire"></i>
                                        ${streak} ${streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней'}
                                    </div>` : ''}
                                    <div class="meta-tag">
                                        <i class="far fa-clock"></i>
                                        ${formatDate(habit.created_at || habit.createdAt)}
                                    </div>
                                    ${habit.target ? `
                                    <div class="meta-tag">
                                        <i class="fas fa-bullseye"></i>
                                        Цель: ${habit.target} ${habit.unit || ''}
                                    </div>` : ''}
                                </div>
                            </div>
                            <div class="habit-actions">
                                <button class="btn-icon btn-edit-new btn-edit" title="Изменить">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="btn-icon btn-delete-new btn-delete" title="Удалить">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        `;
                        list.appendChild(habitItem);
                    });
                }
            }
            this.updateDashboard();
            this.updateHeaderStats();
        } catch (error) {
            this.showToast('Ошибка загрузки привычек', true);
            console.error(error);
        }
    }


    async saveLog(habitId, date, completed, progress) {
        try {
            await API.saveLog(habitId, date, completed, progress);
        } catch (e) {
            console.error('Ошибка сохранения лога:', e);
        }
    }

    loadAnalytics() {
        this.chartsManager.updateCharts();
        this.chartsManager.updateAnalyticsStats();
        this.loadInsights();
    }

    async loadInsights() {
        const list = document.getElementById('insightsList');
        if (!list) return;
        
        try {
            const response = await fetch('/api/insights');
            const data = await response.json();
            
            list.innerHTML = '';
            
            data.forEach(insight => {
                const card = document.createElement('div');
                card.style.cssText = 'padding: 18px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02); display: flex; align-items: flex-start; gap: 12px;';
                
                card.innerHTML = `
                    <div style="font-size: 2.2rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${insight.icon}</div>
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <h4 style="margin: 0 0 6px 0; font-size: 1.15rem; color: var(--text-main); font-weight: 700; letter-spacing: 0.3px;">${insight.title}</h4>
                        <p style="margin: 0; font-size: 0.95rem; color: var(--text-main); font-weight: 500; line-height: 1.5; opacity: 0.9;">${insight.text}</p>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = `<div style="padding: 15px; text-align: center; color: #ef4444;">Ошибка загрузки инсайтов</div>`;
            console.error(e);
        }
    }

    createTodayProgressChart(percentage) {
        this.chartsManager.animateTodayProgressChart(percentage);
    }

    createWeeklyChart() {
        this.chartsManager.updateCharts();
    }

    updateWeeklyChart() {
        this.chartsManager.updateCharts();
    }

    createMonthlyChart() {
        this.chartsManager.updateCharts();
    }

    createHabitDistributionChart() {
        this.chartsManager.updateCharts();
    }

    createStreakChart() {
        this.chartsManager.updateCharts();
    }

    createSkipMonthlyChart() {
        this.chartsManager.updateCharts();
    }




    updateCalendar() {
        this.calendarManager.updateCalendar();
    }

    openDayDetailsModal(dateISO) {
        this.calendarManager.openDayDetailsModal(dateISO);
    }

    closeDayDetailsModal() {
        this.calendarManager.closeDayDetailsModal();
    }

    navigateMonth(direction) {
        this.calendarManager.navigateMonth(direction);
    }

    // МОДАЛЬНЫЕ ОКНА (Wrappers)

    openHabitModal(editMode = false) {
        this.modalManager.openHabitModal(editMode);
    }

    closeHabitModal() {
        this.modalManager.closeHabitModal();
    }

    openDeleteModal(habitId) {
        this.modalManager.openDeleteModal(habitId);
    }

    deleteHabit(habitId) {
        this.openDeleteModal(habitId);
    }

    closeDeleteModal() {
        this.modalManager.closeDeleteModal();
    }

    openNoteModal(habitId) {
        this.modalManager.openNoteModal(habitId);
    }

    openViewNotesModal(habitId) {
        this.modalManager.openViewNotesModal(habitId);
    }

    async editHabit(habitId) {
        try {
            const habit = await API.getHabit(habitId);
            this.modalManager.openHabitModal(true, habit);
        } catch (error) {
            console.error('Ошибка при загрузке привычки для редактирования:', error);
            this.showToast('Ошибка загрузки данных', true);
        }
    }

    async saveHabit() {
        await this.modalManager.saveHabit();
    }

    // Habit Completion Methods
    toggleHabitCompletion(habitId) {
        const today = formatDate(new Date());
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (!this.completions[today]) this.completions[today] = {};

        const hid = String(habitId);
        const nowCompleted = !this.completions[today][hid];
        this.completions[today][hid] = nowCompleted;

        const habit = this.habits.find(h => String(h.id) == hid);
        let newProgress = this.progress?.[todayStr]?.[hid] || 0;

        if (!this.progress) this.progress = {};
        if (!this.progress[todayStr]) this.progress[todayStr] = {};

        if (nowCompleted && habit && habit.target) {
            newProgress = habit.target;
            this.progress[todayStr][hid] = habit.target;
        } else if (!nowCompleted && habit && habit.target) {
            newProgress = 0;
            this.progress[todayStr][hid] = 0;
        }

        const nowTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (nowCompleted) {
            this.actionTimes[hid + '_completed'] = nowTime;
        } else {
            delete this.actionTimes[hid + '_completed'];
        }
        this.saveLog(parseInt(habitId), todayStr, nowCompleted, newProgress);

        this.updateDashboard();
        this.updateHeaderStats();
        this.showToast(`${habit.name} отмечена как ${nowCompleted ? 'выполненная' : 'невыполненная'}!`);
    }

    markAllComplete() {
        const today = formatDate(new Date());
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayHabits = this.getTodayHabits();
        const nowTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        if (!this.completions[today]) this.completions[today] = {};

        todayHabits.forEach(habit => {
            const hid = String(habit.id);
            if (!this.completions[today][hid]) {
                this.completions[today][hid] = true;
                this.actionTimes[hid + '_completed'] = nowTime;
                const progress = habit.target || 0;
                this.saveLog(parseInt(hid), todayStr, true, progress);
            }
        });

        this.updateDashboard();
        this.updateHeaderStats();
        this.showToast('Все привычки отмечены как выполненные!');
    }



    getHabitStreak(habitId) {
        let streak = 0;
        const today = new Date();

        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);

            const dateStr = formatDate(checkDate);
            const dayHabits = this.getHabitsForDate(checkDate);
            const habitShouldBeTracked = dayHabits.some(h => h.id === habitId);

            if (habitShouldBeTracked) {
                if (this.completions[dateStr] && this.completions[dateStr][habitId]) {
                    streak++;
                } else {
                    // Если сегодня (i=0) и привычка ещё не выполнена, стрик не прерывается.
                    // Мы просто продолжаем проверку со вчерашнего дня.
                    if (i === 0) continue;
                    break;
                }
            }
        }

        return streak;
    }

    getHabitCompletionRate(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return 0;

        const createdDate = new Date(habit.createdAt);
        const today = new Date();
        let totalDays = 0;
        let completedDays = 0;

        for (let date = new Date(createdDate); date <= today; date.setDate(date.getDate() + 1)) {
            const dayHabits = this.getHabitsForDate(date);
            const shouldTrack = dayHabits.some(h => h.id === habitId);

            if (shouldTrack) {
                totalDays++;
                const dateStr = formatDate(date);
                if (this.completions[dateStr] && this.completions[dateStr][habitId]) {
                    completedDays++;
                }
            }
        }

        return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    }

    getLongestCurrentStreak() {
        let absoluteMaxStreak = 0;
        const today = new Date();

        this.habits.forEach(habit => {
            let currentStreak = 0;
            let maxStreakForHabit = 0;

            for (let i = 0; i < 365; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(today.getDate() - i);

                const dateStr = formatDate(checkDate);
                const dayHabits = this.getHabitsForDate(checkDate);
                const habitShouldBeTracked = dayHabits.some(h => String(h.id) === String(habit.id));

                if (habitShouldBeTracked) {
                    if (this.completions[dateStr] && this.completions[dateStr][String(habit.id)]) {
                        currentStreak++;
                        maxStreakForHabit = Math.max(maxStreakForHabit, currentStreak);
                    } else {
                        if (i === 0) continue; // Не обнуляем из-за невыполнения сегодня
                        currentStreak = 0;
                    }
                }
            }
            absoluteMaxStreak = Math.max(absoluteMaxStreak, maxStreakForHabit);
        });

        return absoluteMaxStreak;
    }



    getWeeklyData() {
        const completed = [];
        const total = [];
        const today = new Date();

        // Находим понедельник текущей недели
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));

        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(monday);
            checkDate.setDate(monday.getDate() + i);
            const dateStr = formatDate(checkDate);

            const dayHabits = this.getHabitsForDate(checkDate);
            const completedCount = dayHabits.filter(habit =>
                this.completions[dateStr] && this.completions[dateStr][String(habit.id)]
            ).length;

            completed.push(completedCount);
            total.push(dayHabits.length);
        }

        return { completed, total };
    }

    saveSkipLog(habitId, date, skipped) {
        API.saveLog(habitId, date, false, 0, skipped).catch(err => console.error('Ошибка сохранения пропуска:', err));
    }

    getMonthlyData() {
        const labels = [];
        const data = [];
        const completedCounts = [];
        const totalCounts = [];
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);

            const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            labels.push(checkDate.getDate() + ' ' + months[checkDate.getMonth()]);

            const dateStr = formatDate(checkDate);
            const dayHabits = this.getHabitsForDate(checkDate);
            const completedCount = dayHabits.filter(habit =>
                this.completions[dateStr] && this.completions[dateStr][String(habit.id)]
            ).length;

            const percentage = dayHabits.length > 0 ?
                Math.round((completedCount / dayHabits.length) * 100) : 0;

            data.push(percentage);
            completedCounts.push(completedCount);
            totalCounts.push(dayHabits.length);
        }

        return { labels, data, completedCounts, totalCounts };
    }

    getMonthlySkipData() {
        const labels = [];
        const skippedCounts = [];
        const totalCounts = [];
        const today = new Date();

        for (let i = 29; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);

            const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
            labels.push(checkDate.getDate() + ' ' + months[checkDate.getMonth()]);

            const dateStr = formatDate(checkDate);
            const isoDate = checkDate.toISOString().split('T')[0];
            const dayHabits = this.getHabitsForDate(checkDate);

            const skippedCount = dayHabits.filter(habit =>
                (this.skipped[dateStr] && this.skipped[dateStr][String(habit.id)]) ||
                (this.skipped[isoDate] && this.skipped[isoDate][String(habit.id)])
            ).length;

            skippedCounts.push(skippedCount);
            totalCounts.push(dayHabits.length);
        }

        return { labels, skippedCounts, totalCounts };
    }

    getHabitDistributionData() {
        const categories = {};

        this.habits.forEach(habit => {
            categories[habit.category] = (categories[habit.category] || 0) + 1;
        });

        return {
            labels: Object.keys(categories).map(cat => getCategoryName(cat)),
            data: Object.values(categories)
        };
    }

    // ЗАМЕТКИ (Wrappers)


    async saveNote() {
        await this.modalManager.saveNote();
    }

    async openViewNotesModal(habitId) {
        this.modalManager.openViewNotesModal(habitId);
    }

    enterEditMode(noteId, text) {
        this.modalManager.enterEditMode(noteId, text);
    }

    exitEditMode(noteId) {
        this.modalManager.exitEditMode(noteId);
    }

    async saveEditedNote(noteId) {
        await this.modalManager.saveEditedNote(noteId);
    }

    deleteNote(noteId) {
        this.modalManager.deleteNoteConfirm(noteId);
    }

    isHabitSkippedToday(habitId) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!this.skipped) return false;
        return !!(this.skipped[todayStr] && this.skipped[todayStr][String(habitId)]);
    }

    toggleHabitSkip(habitId) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const today = formatDate(new Date());
        const hid = String(habitId);

        if (!this.skipped) this.skipped = {};
        if (!this.skipped[todayStr]) this.skipped[todayStr] = {};

        const nowSkipped = !this.skipped[todayStr][hid];
        this.skipped[todayStr][hid] = nowSkipped;

        if (nowSkipped) {
            if (!this.completions[today]) this.completions[today] = {};
            this.completions[today][hid] = false;
            if (this.progress && this.progress[todayStr]) {
                this.progress[todayStr][hid] = 0;
            }
            this.saveSkipLog(parseInt(hid), todayStr, true);
        } else {
            this.saveSkipLog(parseInt(hid), todayStr, false);
        }
        const skipTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (nowSkipped) {
            this.actionTimes[hid + '_skipped'] = skipTime;
        } else {
            delete this.actionTimes[hid + '_skipped'];
        }

        const habit = this.habits.find(h => String(h.id) === hid);
        if (habit) {
            this.showToast(nowSkipped
                ? habit.name + ' — отмечена как пропущенная'
                : habit.name + ' — пропуск отменён'
            );
        }
        this.updateTodayHabits();
        this.updateRecentActivity();
        this.updateHeaderStats();
    }

    getStreakData() {
        const labels = [];
        const data = [];

        this.habits.forEach(habit => {
            labels.push(habit.name.length > 15 ? habit.name.substring(0, 15) + '...' : habit.name);
            data.push(this.getHabitStreak(habit.id));
        });

        return { labels, data };
    }



    getOverallCompletionRate() {
        if (this.habits.length === 0) return 0;

        const rates = this.habits.map(habit => this.getHabitCompletionRate(habit.id));
        const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        return Math.round(average);
    }

    getTotalTrackingDays() {
        const dates = Object.keys(this.completions);
        return dates.length;
    }

    exportData() {
        const exportData = {
            habits: this.habits,
            completions: this.completions,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `habit-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        this.showToast('Data exported successfully!');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            this.showToast('Пожалуйста, выберите корректный JSON файл бэкапа!', true);
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                if (!importedData.habits || !importedData.completions) {
                    this.showToast('Неверный формат файла! Выберите файл бэкапа Habit Tracker.', true);
                    event.target.value = '';
                    return;
                }

                const modal = document.getElementById('importConfirmModal');
                const confirmBtn = document.getElementById('confirmImportBtn');
                
                if (modal && confirmBtn) {
                    modal.classList.add('show');
                    
                    // Удаляем старые обработчики, чтобы не было дублей
                    const newConfirmBtn = confirmBtn.cloneNode(true);
                    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                    
                    newConfirmBtn.addEventListener('click', async () => {
                        try {
                            modal.classList.remove('show');
                            const response = await this.API.importData(importedData);
                            
                            if (response.success) {
                                this.showToast('Данные успешно импортированы!');
                                setTimeout(() => window.location.reload(), 1500); // Перезагружаем страницу для применения всех данных
                            } else {
                                this.showToast('Ошибка при импорте данных: ' + response.error, true);
                            }
                        } catch (err) {
                            console.error('Import error:', err);
                            this.showToast('Ошибка связи с сервером при импорте.', true);
                        } finally {
                            event.target.value = '';
                        }
                    });
                } else {
                    event.target.value = '';
                }

            } catch (error) {
                console.error('Import parse error:', error);
                this.showToast('Ошибка чтения файла! Проверьте формат файла.', true);
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    }

    formatDateForDisplay(date) {
        return date.toLocaleDateString('ru-RU', {
            month: 'short',
            day: 'numeric'
        });
    }




    showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');

        toastMessage.textContent = message;
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.habitTracker = new HabitTracker();

    // Автоматическое скрытие уведомлений с бэкенда через 3 секунды
    setTimeout(() => {
        document.querySelectorAll('.toast.show').forEach(toast => {
            if (toast.id !== 'toast') {
                toast.classList.remove('show');
            }
        });
    }, 3000);
});

window.logoutUser = () => {
    const modal = document.getElementById('logoutConfirmModal');
    if (modal) {
        modal.classList.add('show');
    }
};

window.togglePassword = (inputId) => {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;
    const toggleIcon = passwordInput.nextElementSibling;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
};
