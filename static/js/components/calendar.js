/**
 * Компонент управления календарем активности
 */
import { isSameDay, formatDate } from '../utils.js';

export class CalendarManager {
    constructor(parent) {
        this.parent = parent;
        this.currentDate = new Date();
    }

    setupCalendar() {
        this.updateCalendar();
    }

    updateCalendar() {
        const container = document.getElementById('calendarGrid');
        const monthHeader = document.getElementById('currentMonth');

        if (!container || !monthHeader) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        monthHeader.textContent = new Intl.DateTimeFormat('ru-RU', {
            month: 'long',
            year: 'numeric'
        }).format(this.currentDate);

        container.innerHTML = '';
        
        const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayHeaders.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day-header';
            dayElement.textContent = day;
            container.appendChild(dayElement);
        });

        const firstDay = new Date(year, month, 1);
        let firstDayIndex = firstDay.getDay() - 1;
        if (firstDayIndex < 0) firstDayIndex = 6;

        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDayIndex);

        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';

            if (currentDate.getMonth() !== month) {
                dayElement.classList.add('other-month');
            }

            const y = currentDate.getFullYear();
            const m = String(currentDate.getMonth() + 1).padStart(2, '0');
            const d = String(currentDate.getDate()).padStart(2, '0');
            const dateISO = `${y}-${m}-${d}`;
            dayElement.onclick = () => this.openDayDetailsModal(dateISO);

            const today = new Date();
            const todayStatus = isSameDay(currentDate, today);
            if (todayStatus) {
                dayElement.classList.add('today');
            }

            const dateStr = formatDate(currentDate);
            const dayHabits = this.parent.getHabitsForDate(currentDate);
            const completedHabits = dayHabits.filter(habit =>
                this.parent.completions[dateStr] && this.parent.completions[dateStr][String(habit.id)]
            ).length;

            const pct = dayHabits.length > 0 ? (completedHabits / dayHabits.length) * 100 : 0;

            if (pct > 0 && !todayStatus && currentDate.getMonth() === month) {
                const opacity = 0.05 + (pct / 100) * 0.45;
                dayElement.style.backgroundColor = `rgba(102, 126, 234, ${opacity})`;
                dayElement.classList.add('has-activity');
            }

            dayElement.innerHTML = `
                <span class="day-num">${currentDate.getDate()}</span>
                ${pct > 0 ? `<div class="day-dot" style="background: ${pct === 100 ? '#10b981' : '#667eea'}"></div>` : ''}
            `;

            container.appendChild(dayElement);
        }
    }

    openDayDetailsModal(dateISO) {
        const modal = document.getElementById('dayDetailsModal');
        const body = document.getElementById('dayDetailsBody');
        const title = document.getElementById('dayDetailsTitle');
        const subtitle = document.getElementById('dayDetailsSubtitle');
        if (!modal || !body) return;

        const parts = dateISO.split('-');
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        const dateDisplay = formatDate(date);
        const habits = this.parent.getHabitsForDate(date);

        title.textContent = "Детали дня";
        subtitle.textContent = new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            weekday: 'long'
        }).format(date);

        body.innerHTML = '';

        if (habits.length === 0) {
            body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">На этот день не было запланировано привычек.</div>';
        } else {
            habits.forEach(habit => {
                const isCompleted = this.parent.completions[dateDisplay] && this.parent.completions[dateDisplay][String(habit.id)];
                const isSkipped = this.parent.skipped[dateISO] && this.parent.skipped[dateISO][String(habit.id)];
                
                let status = "Не выполнено";
                let statusClass = "status-not-done";
                let icon = "fa-circle";
                let time = "";

                if (isCompleted) {
                    status = "Выполнено";
                    statusClass = "status-done";
                    icon = "fa-check-circle";
                    time = this.parent.dayActionTimes?.[dateISO]?.[habit.id]?.completed || "";
                } else if (isSkipped) {
                    status = "Пропущено";
                    statusClass = "status-skipped";
                    icon = "fa-forward";
                    time = this.parent.dayActionTimes?.[dateISO]?.[habit.id]?.skipped || "";
                }

                const habitEl = document.createElement('div');
                habitEl.className = 'day-habit-item';
                habitEl.innerHTML = `
                    <div class="day-habit-main">
                        <div class="day-habit-icon ${statusClass}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="day-habit-info">
                            <div class="day-habit-name">${habit.name}</div>
                            <div class="day-habit-status-row">
                                <span class="day-habit-status-text ${statusClass}">${status}</span>
                                ${time ? `<span class="day-habit-time">${time}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <button class="day-habit-notes-btn" onclick="habitTracker.openViewNotesModal('${habit.id}')">
                        <i class="fas fa-sticky-note"></i> Заметки
                    </button>
                `;
                body.appendChild(habitEl);
            });
        }

        modal.classList.add('show');
    }

    closeDayDetailsModal() {
        const modal = document.getElementById('dayDetailsModal');
        if (modal) modal.classList.remove('show');
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.updateCalendar();
    }
}
