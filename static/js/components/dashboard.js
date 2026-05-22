/**
 * Компонент управления главной панелью (Dashboard)
 */
import { getCategoryIcon, getCategoryColor, animateCounter, formatDate } from '../utils.js';

export class DashboardManager {
    constructor(parent) {
        this.parent = parent;
    }

    updateTodayHabits() {
        const grid = document.getElementById('todayHabitsGrid');
        if (!grid) return;

        let todayHabits = this.parent.getTodayHabits();

        // Фильтрация
        if (this.parent.activeFilter.startsWith('cat:')) {
            const cat = this.parent.activeFilter.split(':')[1];
            todayHabits = todayHabits.filter(h => h.category === cat);
        } else if (this.parent.activeFilter.startsWith('list:')) {
            const listName = this.parent.activeFilter.split(':')[1];
            const allowedIds = this.parent.customLists[listName] || [];
            todayHabits = todayHabits.filter(h => allowedIds.includes(String(h.id)));
        }

        grid.innerHTML = '';

        if (todayHabits.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                    <div style="font-size: 4rem; margin-bottom: 20px; opacity: 0.2;">🎯</div>
                    <h3 style="color: #1e293b; margin-bottom: 10px;">
                        ${this.parent.activeFilter === 'all' ? 'На сегодня привычек нет' : 'В этом фильтре нет привычек'}
                    </h3>
                    <p style="color: #64748b;">
                        ${this.parent.activeFilter === 'all' ? 'Добавьте привычки, чтобы начать отслеживать прогресс!' : 'Попробуйте сменить фильтр или добавить привычки.'}
                    </p>
                </div>
            `;
            return;
        }

        todayHabits.forEach(habit => {
            const card = this.renderHabitRow(habit);
            grid.appendChild(card);
        });
    }

    renderHabitRow(habit) {
        const isCompleted = this.parent.isHabitCompletedToday(habit.id);
        const isSkipped = this.parent.isHabitSkippedToday(habit.id);
        const streak = this.parent.getHabitStreak(habit.id);
        const color = getCategoryColor(habit.category);
        const icon = getCategoryIcon(habit.category);

        const hasCounter = !!(habit.target || habit.unit);
        const targetLabel = habit.target ? ` / ${habit.target}` : '';
        const unitLabel = habit.unit ? ` ${habit.unit}` : '';
        const currentVal = this.getHabitProgress(habit.id) || 0;

        const row = document.createElement('div');
        row.className =
            'habit-row' +
            (isCompleted ? ' habit-row--done' : '') +
            (isSkipped ? ' habit-row--skipped' : '');
        row.dataset.habitId = habit.id;

        const streakMarkup = streak > 0 ? `<span class="habit-row__streak"><i class="fas fa-fire"></i> ${streak}</span>` : '';
        const rightBlock = hasCounter ? `
            ${streakMarkup}
            <div class="habit-row__counter">
                <div class="habit-row__counter-controls">
                    ${!isCompleted && !isSkipped ? `
                        <input
                            class="habit-row__counter-input"
                            type="number"
                            min="1"
                            ${habit.target ? `max="${habit.target - currentVal}"` : ''}
                            value="1"
                            id="counter-${habit.id}"
                            oninput="habitTracker.validateCounterInput(this, ${habit.target}, ${currentVal})"
                        />
                        <button
                            class="habit-row__add-btn"
                            onclick="habitTracker.addProgress('${habit.id}')"
                            title="Добавить"
                        >
                            <i class="fas fa-plus"></i>
                        </button>
                    ` : ''}
                    ${!isSkipped ? `
                    <button
                        class="habit-row__check${isCompleted ? ' habit-row__check--done' : ''}"
                        onclick="habitTracker.toggleHabitCompletion('${habit.id}')"
                        title="${isCompleted ? 'Отменить' : 'Выполнено'}"
                    >
                        <i class="fas ${isCompleted ? 'fa-times' : 'fa-check'}"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
        ` : `
            <div class="habit-row__right">
                ${streakMarkup}
                ${!isSkipped ? `
                <button
                    class="habit-row__check${isCompleted ? ' habit-row__check--done' : ''}"
                    onclick="habitTracker.toggleHabitCompletion('${habit.id}')"
                    title="${isCompleted ? 'Отменить' : 'Выполнено'}"
                >
                    <i class="fas ${isCompleted ? 'fa-times' : 'fa-check'}"></i>
                </button>
                ` : ''}
            </div>
        `;

        row.innerHTML = `
            <div
                class="habit-row__icon"
                style="background:${color}22; color:${color};"
                title="${habit.name}"
            >
                ${icon}
            </div>

            <div class="habit-row__body">
                <div class="habit-row__name">${habit.name}</div>
                <div class="habit-row__info">
                    ${hasCounter
                        ? `<span class="habit-row__sub habit-row__target">
                            ${currentVal}${targetLabel}${unitLabel}
                          </span>`
                        : ''
                    }
                </div>
            </div>

            ${isSkipped
                ? `<span class="habit-row--skipped-badge">
                    <i
                        class="fas fa-ban"
                        style="margin-right:4px;font-size:0.6rem;"
                    ></i>
                    пропущено
                </span>`
                : ''
            }

            ${rightBlock}

            <button
                class="habit-row__menu-btn"
                onclick="habitTracker.openHabitMenu(event, '${habit.id}')"
                title="Меню действий"
            >
                <i class="fas fa-ellipsis-v"></i>
            </button>
        `;

        return row;
    }

    getHabitProgress(habitId) {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return this.parent.progress && this.parent.progress[todayStr] && this.parent.progress[todayStr][String(habitId)] || 0;
    }

    addProgress(habitId) {
        const input = document.getElementById('counter-' + habitId);
        const amount = parseFloat(input ? input.value : 1) || 1;
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayFormatted = formatDate(new Date());

        if (!this.parent.progress) this.parent.progress = {};
        if (!this.parent.progress[todayStr]) this.parent.progress[todayStr] = {};
        const hid = String(habitId);

        const habit = this.parent.habits.find(h => String(h.id) == hid);
        const currentProgress = this.parent.progress[todayStr][hid] || 0;

        let newProgress = currentProgress + amount;
        if (habit && habit.target && newProgress > habit.target) {
            newProgress = habit.target;
        }

        this.parent.progress[todayStr][hid] = newProgress;

        if (habit && habit.target && newProgress >= habit.target) {
            if (!this.parent.completions[todayFormatted]) this.parent.completions[todayFormatted] = {};
            this.parent.completions[todayFormatted][hid] = true;
            this.parent.saveLog(parseInt(hid), todayStr, true, newProgress);
            this.parent.showToast(`${habit.name} — цель достигнута! 🎉`);
            this.parent.updateDashboard();
            this.parent.updateHeaderStats();
        } else {
            const subEl = document.querySelector(`.habit-row[data-habit-id="${hid}"] .habit-row__target`);
            if (subEl && habit) {
                subEl.textContent = `${newProgress} / ${habit.target} ${habit.unit || ''}`;
            }
            this.parent.saveLog(parseInt(hid), todayStr, false, newProgress);
            if (habit) this.parent.showToast(`${habit.name}: +${amount} ${habit.unit || ''}`);
            this.parent.updateDashboard();
        }
    }

    validateCounterInput(input, target, current) {
        let val = parseFloat(input.value);
        const maxAllowed = target - current;

        if (val > maxAllowed) {
            input.value = maxAllowed;
            this.parent.showToast(`Максимум для добавления: ${maxAllowed}`, 'warning');
        }
        if (val < 1 && input.value !== "") {
            input.value = 1;
        }
    }

    updateHeaderStats() {
        const habits = this.parent.getTodayHabits();
        const completed = habits.filter(h => this.parent.isHabitCompletedToday(h.id)).length;

        const totalEl = document.getElementById('totalHabitsCount');
        const completedEl = document.getElementById('completedHabitsCount');
        const progressEl = document.getElementById('todayTotalProgress');
        const streakEl = document.getElementById('totalStreak');
        const todayEl = document.getElementById('completedToday');

        if (totalEl) totalEl.textContent = habits.length;
        if (completedEl) animateCounter(completedEl, completed);
        if (todayEl) todayEl.textContent = completed;
        if (streakEl) streakEl.textContent = this.parent.getLongestCurrentStreak();

        if (progressEl) {
            const pct = habits.length > 0 ? Math.round((completed / habits.length) * 100) : 0;
            progressEl.style.width = `${pct}%`;
        }
    }
}
