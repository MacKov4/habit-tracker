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

    async openDayDetailsModal(dateISO) {
        const modal = document.getElementById('dayDetailsModal');
        const body = document.getElementById('dayDetailsBody');
        const title = document.getElementById('dayDetailsTitle');
        const subtitle = document.getElementById('dayDetailsSubtitle');
        const summaryEl = document.getElementById('dayDetailsSummary');
        if (!modal || !body) return;

        this._openDateISO = dateISO;

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

        if (summaryEl) {
            summaryEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка сводки дня...';
        }

        body.innerHTML = '';

        if (habits.length === 0) {
            body.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;">На этот день не было запланировано привычек.</div>';
            if (summaryEl) {
                summaryEl.innerHTML = 'В этот день не было запланировано привычек.';
            }
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
                habitEl.style.marginBottom = '6px';
                habitEl.style.paddingBottom = '10px';
                habitEl.innerHTML = `
                    <div class="day-habit-main" style="width: 100%;">
                        <div class="day-habit-icon ${statusClass}">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="day-habit-info" style="width: 100%;">
                            <div class="day-habit-name">${habit.name}</div>
                            <div class="day-habit-status-row">
                                <span class="day-habit-status-text ${statusClass}">${status}</span>
                                ${time ? `<span class="day-habit-time">${time}</span>` : ''}
                            </div>
                            <div class="day-habit-notes-container" id="day-habit-notes-container-${habit.id}"></div>
                        </div>
                    </div>
                `;
                body.appendChild(habitEl);
            });

            modal.classList.add('show');

            const moodEmojis = {
                'excellent': '😍',
                'good': '😊',
                'neutral': '😐',
                'bad': '☹️',
                'terrible': '😡'
            };
            const moodLabels = {
                'excellent': 'Отлично',
                'good': 'Хорошо',
                'neutral': 'Нормально',
                'bad': 'Плохо',
                'terrible': 'Ужасно'
            };

            try {
                const notesPromises = habits.map(habit => this.parent.API.getNotes(habit.id).catch(() => []));
                const allNotesArrays = await Promise.all(notesPromises);
                
                const dayNotes = [];
                allNotesArrays.forEach((notesList, idx) => {
                    const habit = habits[idx];
                    notesList.forEach(note => {
                        if (note.date === dateISO) {
                            dayNotes.push({
                                ...note,
                                habitId: habit.id,
                                habitName: habit.name
                            });
                        }
                    });
                });

                const moodScores = {
                    'excellent': 5,
                    'good': 4,
                    'neutral': 3,
                    'bad': 2,
                    'terrible': 1
                };
                const scoreToMoodStr = {
                    5: 'Отличным 😍',
                    4: 'Хорошим 😊',
                    3: 'Нормальным 😐',
                    2: 'Плохим ☹️',
                    1: 'Ужасным 😡'
                };

                const moodsWithScores = dayNotes
                    .filter(n => n.mood && moodScores[n.mood] !== undefined)
                    .map(n => moodScores[n.mood]);

                let moodHtml = "";
                if (moodsWithScores.length > 0) {
                    const avgScore = Math.round(moodsWithScores.reduce((a, b) => a + b, 0) / moodsWithScores.length);
                    const moodText = scoreToMoodStr[avgScore] || "не указано";
                    moodHtml = `<br>Ваше настроение было <strong>${moodText}</strong>.`;
                }

                const completedHabits = habits.filter(habit =>
                    this.parent.completions[dateDisplay] && this.parent.completions[dateDisplay][String(habit.id)]
                ).length;

                if (summaryEl) {
                    summaryEl.innerHTML = `В этот день вы выполнили <strong>${completedHabits}/${habits.length}</strong> привычек.${moodHtml}`;
                }

                habits.forEach(habit => {
                    const habitNotesForDay = dayNotes.filter(n => String(n.habitId) === String(habit.id));
                    const notesContainer = document.getElementById(`day-habit-notes-container-${habit.id}`);
                    if (notesContainer && habitNotesForDay.length > 0) {
                        notesContainer.innerHTML = habitNotesForDay.map(n => {
                            const noteTime = n.created_at.split(' ')[1]?.substring(0, 5) || '';
                            const moodEmoji = n.mood ? moodEmojis[n.mood] : null;
                            const moodLabel = n.mood ? moodLabels[n.mood] : '';
                            const safeText = n.text.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '&quot;');

                            return `
                                <div class="day-note-card" id="note-item-${n.id}" style="margin-top: 6px; padding: 8px 12px; background: var(--card-bg, #f8fafc); border: 1px solid var(--border-color, #edf2f7); border-radius: 10px; font-size: 0.88rem; color: var(--text-main); text-align: left;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="font-size: 0.78rem; color: var(--text-muted, #94a3b8);"><i class="fas fa-clock" style="margin-right: 4px;"></i>${noteTime}</span>
                                        <div class="note-actions" id="note-actions-${n.id}" style="display: flex; gap: 6px;">
                                            <button onclick="habitTracker.modalManager.enterEditMode(${n.id}, \`${safeText}\`)" class="note-edit-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted, #94a3b8); font-size: 0.82rem; padding: 2px 4px;" title="Редактировать"><i class="fas fa-pencil-alt"></i></button>
                                            <button onclick="habitTracker.modalManager.deleteNoteConfirm(${n.id})" class="note-delete-btn" style="background: none; border: none; cursor: pointer; color: var(--text-muted, #94a3b8); font-size: 0.82rem; padding: 2px 4px;" title="Удалить"><i class="fas fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <div class="note-body" id="note-text-${n.id}" style="line-height: 1.4; text-align: left;">${n.text}</div>
                                    ${moodEmoji ? `<div style="margin-top: 4px; font-size: 0.82rem; color: var(--text-muted, #64748b); text-align: left;"><span style="font-size: 1rem;">${moodEmoji}</span> ${moodLabel}</div>` : ''}
                                </div>
                            `;
                        }).join('');
                    }
                });

            } catch (err) {
                console.error("Ошибка загрузки сводки:", err);
                if (summaryEl) {
                    summaryEl.innerHTML = `Ошибка при загрузке деталей заметок.`;
                }
            }
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
