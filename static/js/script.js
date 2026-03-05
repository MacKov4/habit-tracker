// Habit Tracker Pro - Main JavaScript File

class HabitTracker {
    constructor() {
        this.habits = [];  // теперь пусто, загружаем с сервера
        this.completions = {};
        this.currentDate = new Date();
        this.activeTab = 'dashboard';
        this.charts = {};
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadActiveTab();
        // this.updateDashboard();     // закомментировать временно, если ломает
        // this.loadHabitsList();      // закомментировать, т.к. список теперь рендерится Jinja
        this.updateHeaderStats();
        // this.setupCalendar();       // закомментировать, если календарь ломается
    }

    setupEventListeners() { 

    /* HABITS LIST (правильное делегирование) */
const habitsList = document.getElementById('habitsList');
if (habitsList && !habitsList.dataset.listenerAdded) {
    habitsList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            const habitItem = editBtn.closest('.habit-item');
            const habitId = habitItem?.dataset.habitId;
            console.log("EDIT CLICKED - Habit ID:", habitId);
            if (habitId && this.editHabit) {
                this.editHabit(habitId);
            }
            return;
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const habitItem = deleteBtn.closest('.habit-item');
            const habitId = habitItem?.dataset.habitId;
            console.log("DELETE CLICKED - Habit ID:", habitId);
            if (habitId && this.deleteHabit) {
                this.deleteHabit(habitId);
            }
            return;
        }
    });

    habitsList.dataset.listenerAdded = "true";
}
    
    
        /* =========================
           TAB NAVIGATION
        ========================== */
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
    
    
        /* =========================
           MODAL CONTROLS
        ========================== */
        const modal = document.getElementById('habitModal');
        const addHabitBtn = document.getElementById('addHabitBtn');
        const addNewHabitBtn = document.getElementById('addNewHabitBtn');
        const closeModal = document.getElementById('closeModal');
        const cancelBtn = document.getElementById('cancelBtn');
    
        [addHabitBtn, addNewHabitBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => this.openHabitModal());
            }
        });
    
        [closeModal, cancelBtn].forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => this.closeHabitModal());
            }
        });
    
    
        /* =========================
           FORM SUBMIT
        ========================== */
        const habitForm = document.getElementById('habitForm');
    
        if (habitForm && !habitForm.dataset.listenerAdded) {
            habitForm.addEventListener('submit', (e) => {
                e.preventDefault();
                window.habitTracker.saveHabit();
            });
    
            habitForm.dataset.listenerAdded = "true";
        }
    
    
        /* =========================
           FREQUENCY SELECTOR
        ========================== */
        const frequencySelect = document.getElementById('habitFrequency');
        if (frequencySelect) {
            frequencySelect.addEventListener('change', (e) => {
                const customDaysGroup = document.getElementById('customDaysGroup');
                if (customDaysGroup) {
                    customDaysGroup.style.display =
                        e.target.value === 'custom' ? 'block' : 'none';
                }
            });
        }
    
    
        /* =========================
           QUICK ACTIONS
        ========================== */
        const markAllBtn = document.getElementById('markAllBtn');
        const exportBtn = document.getElementById('exportBtn');
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');
    
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllComplete());
        }
    
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
    
        if (importBtn && importFile) {
            importBtn.addEventListener('click', () => importFile.click());
        }
    
        if (importFile) {
            importFile.addEventListener('change', (e) => this.importData(e));
        }
    
    
        /* =========================
           CALENDAR NAVIGATION
        ========================== */
        const prevMonth = document.getElementById('prevMonth');
        const nextMonth = document.getElementById('nextMonth');
    
        if (prevMonth) {
            prevMonth.addEventListener('click', () => this.navigateMonth(-1));
        }
    
        if (nextMonth) {
            nextMonth.addEventListener('click', () => this.navigateMonth(1));
        }
    
    
        /* =========================
           CLOSE MODAL ON OUTSIDE CLICK
        ========================== */
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeHabitModal();
                }
            });
        }
    }

    switchTab(tabName) {
        // Update active tab
        this.activeTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Load tab-specific content
        this.loadActiveTab();
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
        }
    }

    updateDashboard() {
        this.updateTodayProgress();
        this.updateTodayHabits();
        this.updateRecentActivity();
        this.createWeeklyChart();
    }

    updateTodayProgress() {
        const today = this.formatDate(new Date());
        const todayHabits = this.getTodayHabits();
        const completedCount = todayHabits.filter(habit => 
            this.isHabitCompletedToday(habit.id)
        ).length;
        
        const percentage = todayHabits.length > 0 ? 
            Math.round((completedCount / todayHabits.length) * 100) : 0;

        // Update progress chart
        this.createTodayProgressChart(percentage);

        // Update percentage display
        const percentageElement = document.getElementById('todayPercentage');
        if (percentageElement) {
            percentageElement.textContent = `${percentage}%`;
        }
    }

    updateTodayHabits() {
        const todayHabits = this.getTodayHabits();
        const container = document.getElementById('todayHabitsGrid');
        
        if (!container) return;

        container.innerHTML = '';

        if (todayHabits.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-plus-circle"></i>
                    <h3>No habits for today</h3>
                    <p>Add some habits to start tracking your progress!</p>
                    <button class="btn-primary" onclick="habitTracker.openHabitModal()">
                        <i class="fas fa-plus"></i> Add Your First Habit
                    </button>
                </div>
            `;
            return;
        }

        todayHabits.forEach(habit => {
            const isCompleted = this.isHabitCompletedToday(habit.id);
            const streak = this.getHabitStreak(habit.id);
            
            const habitCard = document.createElement('div');
            habitCard.className = `habit-card ${isCompleted ? 'completed' : 'incomplete'}`;
            habitCard.dataset.category = habit.category;
            
            habitCard.innerHTML = `
                <div class="habit-header">
                    <div>
                        <div class="habit-title">${habit.name}</div>
                        <div class="habit-category">${this.getCategoryIcon(habit.category)} ${this.getCategoryName(habit.category)}</div>
                    </div>
                    <div class="habit-status ${isCompleted ? 'completed' : ''}" onclick="habitTracker.toggleHabitCompletion('${habit.id}')">
                        ${isCompleted ? '<i class="fas fa-check"></i>' : ''}
                    </div>
                </div>
                <div class="habit-progress">
                    <div class="habit-progress-bar" style="width: ${isCompleted ? 100 : 0}%"></div>
                </div>
                <div class="habit-streak">
                    <i class="fas fa-fire"></i>
                    <span>${streak} day${streak !== 1 ? 's' : ''} streak</span>
                </div>
            `;
            
            container.appendChild(habitCard);
        });
    }

    updateRecentActivity() {
        const container = document.getElementById('activityList');
        if (!container) return;

        const activities = this.getRecentActivities();
        
        container.innerHTML = '';

        if (activities.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No recent activity</p>';
            return;
        }

        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            
            activityItem.innerHTML = `
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.type === 'completed' ? 'fa-check' : 'fa-times'}"></i>
                </div>
                <div class="activity-text">
                    <h4>${activity.habitName}</h4>
                    <p>${activity.date} • ${activity.time}</p>
                </div>
            `;
            
            container.appendChild(activityItem);
        });
    }

    updateHeaderStats() {
        const totalStreakElement = document.getElementById('totalStreak');
        const completedTodayElement = document.getElementById('completedToday');
        
        if (totalStreakElement) {
            const longestStreak = this.getLongestCurrentStreak();
            totalStreakElement.textContent = longestStreak;
        }
        
        if (completedTodayElement) {
            const todayHabits = this.getTodayHabits();
            const completedCount = todayHabits.filter(habit => 
                this.isHabitCompletedToday(habit.id)
            ).length;
            completedTodayElement.textContent = completedCount;
        }
    }

    async loadHabitsList() {
        try {
            const response = await fetch('/api/habits');
            if (!response.ok) throw new Error('Failed to load habits');

            this.habits = await response.json();
    
            const list = document.getElementById('habitsList');
            list.innerHTML = '';
    
            if (!this.habits.length) {
                list.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-plus-circle" style="font-size: 3rem; color: #667eea;"></i>
                        <h3>Нет привычек</h3>
                        <p>Добавьте свою первую привычку и начните отслеживать прогресс!</p>
                        <button class="btn-primary" onclick="habitTracker.openHabitModal()">
                            <i class="fas fa-plus"></i> Добавить привычку
                        </button>
                    </div>
                `;
                return;
            }
    
            this.habits.forEach(habit => {
                const habitItem = document.createElement('div');
                habitItem.className = `habit-item habit-${habit.category || 'other'}`;
                habitItem.setAttribute('data-habit-id', habit.id);
                habitItem.innerHTML = `
                    <div class="habit-info">
                        <h4>${habit.name}</h4>
                        ${habit.description ? `<p class="habit-desc">${habit.description}</p>` : ''}
                        
                        <div class="habit-meta">
                            <span><i class="fas fa-tag"></i> ${this.getCategoryName(habit.category)}</span>
                            <span><i class="fas fa-calendar"></i> ${habit.frequency}</span>
                            ${
                                habit.target
                                    ? `<span><i class="fas fa-bullseye"></i> Цель: ${habit.target} ${habit.unit || ''}</span>`
                                    : ''
                            }
                        </div>
                    </div>
    
                    <div class="habit-actions" data-habit-id="${habit.id}">
                        <button class="btn-small btn-edit">
                            <i class="fas fa-edit"></i> Изменить
                        </button>
                        <button class="btn-small btn-delete">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </div>
                `;
    
                list.appendChild(habitItem);
            });
    
        } catch (error) {
            this.showToast('Ошибка загрузки привычек', true);
            console.error(error);
        }
        
    

/*
        this.habits.forEach(habit => {
            const streak = this.getHabitStreak(habit.id);
            const completionRate = this.getHabitCompletionRate(habit.id);
            
            const habitItem = document.createElement('div');
            habitItem.className = 'habit-actions';
            habitItem.style.borderLeftColor = this.getCategoryColor(habit.category);
            
            habitItem.innerHTML = `
                <div class="habit-info">
                    <h4>${habit.name}</h4>
                    <p>${habit.description || 'No description provided'}</p>
                    <div class="habit-meta">
                        <span><i class="fas fa-calendar"></i> ${habit.frequency}</span>
                        <span><i class="fas fa-fire"></i> ${streak} day streak</span>
                        <span><i class="fas fa-percentage"></i> ${completionRate}% completion</span>
                        <span><i class="fas fa-tag"></i> ${this.getCategoryName(habit.category)}</span>
                    </div>
                </div>
                <div class="habit-actions">
                    <button class="btn-small btn-edit" onclick="habitTracker.editHabit('${habit.id}')">
                        <i class="fas fa-edit"></i> Изменить
                    </button>
                    <button class="btn-small btn-delete" onclick="habitTracker.deleteHabit('${habit.id}')">
                        <i class="fas fa-trash"></i> Удалить
                    </button>
                </div>
            `;
            
            container.appendChild(habitItem);
        });
    } */
}


    loadAnalytics() {
        this.createMonthlyChart();
        this.createHabitDistributionChart();
        this.createStreakChart();
        this.updateAnalyticsStats();
    }

    // Chart Creation Methods
    createTodayProgressChart(percentage) {
        const canvas = document.getElementById('todayProgressChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.todayProgress) {
            this.charts.todayProgress.destroy();
        }

        this.charts.todayProgress = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [percentage, 100 - percentage],
                    backgroundColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(240, 240, 240, 1)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '75%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            }
        });
    }

    createWeeklyChart() {
        const canvas = document.getElementById('weeklyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }

        const weekData = this.getWeeklyData();

        this.charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Completed Habits',
                    data: weekData,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    createMonthlyChart() {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        const monthlyData = this.getMonthlyData();

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [{
                    label: 'Daily Completion %',
                    data: monthlyData.data,
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    createHabitDistributionChart() {
        const canvas = document.getElementById('habitDistributionChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.distribution) {
            this.charts.distribution.destroy();
        }

        const distributionData = this.getHabitDistributionData();

        this.charts.distribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: distributionData.labels,
                datasets: [{
                    data: distributionData.data,
                    backgroundColor: [
                        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
                        '#feca57', '#ff9ff3', '#54a0ff'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createStreakChart() {
        const canvas = document.getElementById('streakChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        if (this.charts.streak) {
            this.charts.streak.destroy();
        }

        const streakData = this.getStreakData();

        this.charts.streak = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: streakData.labels,
                datasets: [{
                    label: 'Current Streak (days)',
                    data: streakData.data,
                    backgroundColor: 'rgba(17, 153, 142, 0.8)',
                    borderColor: 'rgba(17, 153, 142, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    // Calendar Methods
    setupCalendar() {
        this.updateCalendar();
    }

    updateCalendar() {
        const container = document.getElementById('calendarGrid');
        const monthHeader = document.getElementById('currentMonth');
        
        if (!container || !monthHeader) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        monthHeader.textContent = new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric'
        }).format(this.currentDate);

        // Clear existing calendar
        container.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day header';
            dayElement.textContent = day;
            container.appendChild(dayElement);
        });

        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Generate calendar days
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            
            // Check if it's current month
            if (currentDate.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }
            
            // Check if it's today
            const today = new Date();
            if (this.isSameDay(currentDate, today)) {
                dayElement.classList.add('today');
            }
            
            // Get completion percentage for this day
            const dateStr = this.formatDate(currentDate);
            const dayHabits = this.getHabitsForDate(currentDate);
            const completedHabits = dayHabits.filter(habit => 
                this.completions[dateStr] && this.completions[dateStr][habit.id]
            ).length;
            
            const completionPercentage = dayHabits.length > 0 ? 
                (completedHabits / dayHabits.length) * 100 : 0;
            
            dayElement.innerHTML = `
                <div class="calendar-day-number">${currentDate.getDate()}</div>
                <div class="calendar-progress">
                    <div class="calendar-progress-bar" style="width: ${completionPercentage}%"></div>
                </div>
            `;
            
            if (completionPercentage > 0) {
                dayElement.classList.add('has-progress');
            }
            
            container.appendChild(dayElement);
        }
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.updateCalendar();
    }

    // Modal Methods
    openHabitModal() {
        const modal = document.getElementById('habitModal');
        modal.classList.add('show');
        document.body.classList.add('modal-open');
    }

    closeHabitModal() {
        const modal = document.getElementById('habitModal');
        // Очищаем форму
        document.getElementById('habitForm').reset();
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        // Сбрасываем заголовок и кнопку
        console.log("MODAL CLOSE CALLED");
        document.getElementById('modalTitle').textContent = 'Добавить новую привычку';
        document.getElementById('saveHabitBtn').textContent = 'Сохранить привычку';
    
        // Удаляем скрытое поле editHabitId
        const editId = document.getElementById('editHabitId');
        if (editId) editId.remove();
    
        // Скрываем custom days
        document.getElementById('customDaysGroup').style.display = 'none';  
    } 

    async editHabit(habitId) {
        try {
            console.log("editHabit called with ID:", habitId);  // ← добавь для отладки
            const response = await fetch(`/api/habit/${habitId}`);
            if (!response.ok) throw new Error('Не удалось загрузить привычку');
            const habit = await response.json();
    
            console.log("Loaded habit data:", habit);  // ← проверим, что пришло
    
            document.getElementById('habitName').value = habit.name || '';
            document.getElementById('habitDescription').value = habit.description || '';
            document.getElementById('habitCategory').value = habit.category || 'other';
            document.getElementById('habitFrequency').value = habit.frequency || 'daily';
    
            const customDaysGroup = document.getElementById('customDaysGroup');
            customDaysGroup.style.display = habit.frequency === 'custom' ? 'block' : 'none';
    
            const checkboxes = document.querySelectorAll('#customDaysGroup input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.checked = habit.customDays.includes(parseInt(cb.value));
            });
    
            document.getElementById('habitTarget').value = habit.target || '';
            document.getElementById('habitUnit').value = habit.unit || '';
    
            document.getElementById('modalTitle').textContent = 'Редактировать привычку';
            document.getElementById('saveHabitBtn').textContent = 'Сохранить изменения';
    
            let hiddenId = document.getElementById('editHabitId');
            if (!hiddenId) {
                hiddenId = document.createElement('input');
                hiddenId.type = 'hidden';
                hiddenId.id = 'editHabitId';
                document.getElementById('habitForm').appendChild(hiddenId);
            }
            hiddenId.value = habit.id;
    
            this.openHabitModal();
        } catch (error) {
            this.showToast('Ошибка загрузки привычки', true);
            console.error(error);
        }
    }
       
    async saveHabit() {
        const form = document.getElementById('habitForm');
        const formData = new FormData(form);
        const editId = document.getElementById('editHabitId')?.value;
    
        const url = editId ? `/edit_habit/${editId}` : '/add_habit';
    
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
    
            if (response.ok) {
                this.closeHabitModal();
                this.showToast(editId ? 'Привычка обновлена!' : 'Привычка добавлена!', false);
                await this.loadHabitsList();  // обновляем список
            } else {
                this.showToast('Ошибка сохранения', true);
            }
        } catch (error) {
            this.showToast('Ошибка сети', true);
        }
    }

    async deleteHabit(habitId) {
        // Подтверждение удаления
        if (!confirm('Вы уверены, что хотите удалить эту привычку?')) {
            return;
        }
    
        try {
            const response = await fetch(`/delete_habit/${habitId}`, {
                method: 'POST'
            });
    
            if (response.ok) {
                this.showToast('Привычка удалена!', false);
                await this.loadHabitsList();  // обновляем список без перезагрузки
            } else {
                const errorData = await response.json();
                this.showToast(errorData.error || 'Ошибка удаления', true);
            }
        } catch (error) {
            this.showToast('Ошибка сети', true);
            console.error(error);
        }
    }

    // Habit Completion Methods
    toggleHabitCompletion(habitId) {
        const today = this.formatDate(new Date());
        
        if (!this.completions[today]) {
            this.completions[today] = {};
        }
        
        this.completions[today][habitId] = !this.completions[today][habitId];
        
       // this.saveToStorage();
        this.updateDashboard();
        this.updateHeaderStats();
        
        const isCompleted = this.completions[today][habitId];
        const habit = this.habits.find(h => h.id === habitId);
        this.showToast(`${habit.name} marked as ${isCompleted ? 'completed' : 'incomplete'}!`);
    }

    markAllComplete() {
        const today = this.formatDate(new Date());
        const todayHabits = this.getTodayHabits();
        
        if (!this.completions[today]) {
            this.completions[today] = {};
        }
        
        todayHabits.forEach(habit => {
            this.completions[today][habit.id] = true;
        });
        
       // this.saveToStorage();
        this.updateDashboard();
        this.updateHeaderStats();
        this.showToast('All habits marked as completed!');
    }

    // Data Analysis Methods
    getTodayHabits() {
        const today = new Date();
        return this.getHabitsForDate(today);
    }

    getHabitsForDate(date) {
        const dayOfWeek = date.getDay();
        
        return this.habits.filter(habit => {
            if (habit.frequency === 'daily') return true;
            if (habit.frequency === 'weekly') return dayOfWeek === 1; // Monday
            if (habit.frequency === 'custom') {
                return habit.customDays && habit.customDays.includes(dayOfWeek);
            }
            return false;
        });
    }

    isHabitCompletedToday(habitId) {
        const today = this.formatDate(new Date());
        return this.completions[today] && this.completions[today][habitId];
    }

    getHabitStreak(habitId) {
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            
            const dateStr = this.formatDate(checkDate);
            const dayHabits = this.getHabitsForDate(checkDate);
            const habitShouldBeTracked = dayHabits.some(h => h.id === habitId);
            
            if (habitShouldBeTracked) {
                if (this.completions[dateStr] && this.completions[dateStr][habitId]) {
                    streak++;
                } else {
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
                const dateStr = this.formatDate(date);
                if (this.completions[dateStr] && this.completions[dateStr][habitId]) {
                    completedDays++;
                }
            }
        }
        
        return totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
    }

    getLongestCurrentStreak() {
        let longestStreak = 0;
        
        this.habits.forEach(habit => {
            const streak = this.getHabitStreak(habit.id);
            longestStreak = Math.max(longestStreak, streak);
        });
        
        return longestStreak;
    }

    getRecentActivities() {
        const activities = [];
        const today = new Date();
        
        // Get last 7 days of activities
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = this.formatDate(checkDate);
            
            if (this.completions[dateStr]) {
                const dayHabits = this.getHabitsForDate(checkDate);
                
                dayHabits.forEach(habit => {
                    const isCompleted = this.completions[dateStr][habit.id];
                    
                    activities.push({
                        habitName: habit.name,
                        type: isCompleted ? 'completed' : 'missed',
                        date: this.formatDateForDisplay(checkDate),
                        time: checkDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                    });
                });
            }
        }
        
        return activities.slice(0, 10); // Limit to 10 most recent
    }

    getWeeklyData() {
        const data = [];
        const today = new Date();
        
        // Get Monday of this week
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1);
        
        for (let i = 0; i < 7; i++) {
            const checkDate = new Date(monday);
            checkDate.setDate(monday.getDate() + i);
            const dateStr = this.formatDate(checkDate);
            
            const dayHabits = this.getHabitsForDate(checkDate);
            const completedCount = dayHabits.filter(habit => 
                this.completions[dateStr] && this.completions[dateStr][habit.id]
            ).length;
            
            data.push(completedCount);
        }
        
        return data;
    }

    getMonthlyData() {
        const labels = [];
        const data = [];
        const today = new Date();
        
        // Get last 30 days
        for (let i = 29; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            
            labels.push(checkDate.getDate().toString());
            
            const dateStr = this.formatDate(checkDate);
            const dayHabits = this.getHabitsForDate(checkDate);
            const completedCount = dayHabits.filter(habit => 
                this.completions[dateStr] && this.completions[dateStr][habit.id]
            ).length;
            
            const percentage = dayHabits.length > 0 ? 
                Math.round((completedCount / dayHabits.length) * 100) : 0;
            
            data.push(percentage);
        }
        
        return { labels, data };
    }

    getHabitDistributionData() {
        const categories = {};
        
        this.habits.forEach(habit => {
            categories[habit.category] = (categories[habit.category] || 0) + 1;
        });
        
        return {
            labels: Object.keys(categories).map(cat => this.getCategoryName(cat)),
            data: Object.values(categories)
        };
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

    updateAnalyticsStats() {
        const longestStreakElement = document.getElementById('longestStreak');
        const overallCompletionElement = document.getElementById('overallCompletion');
        const totalDaysElement = document.getElementById('totalDays');
        
        if (longestStreakElement) {
            longestStreakElement.textContent = this.getLongestCurrentStreak();
        }
        
        if (overallCompletionElement) {
            const overallCompletion = this.getOverallCompletionRate();
            overallCompletionElement.textContent = `${overallCompletion}%`;
        }
        
        if (totalDaysElement) {
            const totalDays = this.getTotalTrackingDays();
            totalDaysElement.textContent = totalDays;
        }
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

    // Export functionality
    exportData() {
        const exportData = {
            habits: this.habits,
            completions: this.completions,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `habit-tracker-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showToast('Data exported successfully!');
    }

    // Import functionality
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            this.showToast('Please select a valid JSON file!', true);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Validate the imported data structure
                if (!importedData.habits || !importedData.completions) {
                    this.showToast('Invalid file format! Please select a valid habit tracker backup.', true);
                    return;
                }

                // Confirm before overwriting existing data
                const hasExistingData = this.habits.length > 0;
                const message = hasExistingData 
                    ? 'This will replace all your current habits and progress. Are you sure?' 
                    : 'Import habit data from backup file?';

                if (confirm(message)) {
                    // Import the data
                    this.habits = importedData.habits;
                    this.completions = importedData.completions;
                    
                    // Save to localStorage
                   // this.saveToStorage();
                    
                    // Refresh the UI
                    this.loadActiveTab();
                    this.updateHeaderStats();
                    
                    // Clear the file input
                    event.target.value = '';
                    
                    this.showToast(`Successfully imported ${this.habits.length} habits and their progress!`);
                }
            } catch (error) {
                console.error('Import error:', error);
                this.showToast('Error reading file! Please check the file format.', true);
            }
        };
        
        reader.readAsText(file);
    }

    // Utility Methods
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    formatDateForDisplay(date) {
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    isSameDay(date1, date2) {
        return this.formatDate(date1) === this.formatDate(date2);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getCategoryIcon(category) {
        const icons = {
            health: '🏃',
            productivity: '📈',
            learning: '📚',
            mindfulness: '🧘',
            social: '👥',
            creativity: '🎨',
            other: '📝'
        };
        return icons[category] || '📝';
    }

    getCategoryName(category) {
        const names = {
            health: 'Health & Fitness',
            productivity: 'Productivity',
            learning: 'Learning',
            mindfulness: 'Mindfulness',
            social: 'Social',
            creativity: 'Creativity',
            other: 'Other'
        };
        return names[category] || 'Other';
    }

    getCategoryColor(category) {
        const colors = {
            health: '#ff6b6b',
            productivity: '#4ecdc4',
            learning: '#45b7d1',
            mindfulness: '#96ceb4',
            social: '#feca57',
            creativity: '#ff9ff3',
            other: '#54a0ff'
        };
        return colors[category] || '#54a0ff';
    }

 //   saveToStorage() {
       // localStorage.setItem('habits', JSON.stringify(this.habits));
      //  localStorage.setItem('completions', JSON.stringify(this.completions));
    //}

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

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {

    window.habitTracker = new HabitTracker();

    const addHabitBtn = document.getElementById('addHabitBtn');
    const addNewHabitBtn = document.getElementById('addNewHabitBtn');

    [addHabitBtn, addNewHabitBtn].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                window.habitTracker.openHabitModal();
            });
        }
    });

});

// Add some sample data for demo purposes (remove this in production)
if (!localStorage.getItem('habits')) {
    const sampleHabits = [
        {
            id: 'sample1',
            name: 'Drink 8 glasses of water',
            description: 'Stay hydrated throughout the day',
            category: 'health',
            frequency: 'daily',
            target: 8,
            unit: 'glasses',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'sample2',
            name: 'Read for 30 minutes',
            description: 'Read books to expand knowledge',
            category: 'learning',
            frequency: 'daily',
            target: 30,
            unit: 'minutes',
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: 'sample3',
            name: 'Exercise',
            description: 'Physical workout or activity',
            category: 'health',
            frequency: 'custom',
            customDays: [1, 3, 5], // Monday, Wednesday, Friday
            target: 45,
            unit: 'minutes',
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
    
    // Add some sample completion data
    const sampleCompletions = {};
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        sampleCompletions[dateStr] = {
            'sample1': Math.random() > 0.3,
            'sample2': Math.random() > 0.4,
            'sample3': [1, 3, 5].includes(date.getDay()) ? Math.random() > 0.2 : false
        };
    }
    
    
    // Form submission — привязываем кнопку "Сохранить" к функции saveHabit

  //  localStorage.setItem('habits', JSON.stringify(sampleHabits));
    //localStorage.setItem('completions', JSON.stringify(sampleCompletions));
}

