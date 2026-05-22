/**
 * Компонент управления лентой активности
 */
import { getCategoryColor, getCategoryIcon, formatDate } from '../utils.js';

export class ActivityManager {
    constructor(parent) {
        this.parent = parent;
    }

    updateRecentActivity() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        activityList.innerHTML = '';
        const logs = [];

        const todayFormatted = formatDate(new Date());
        const now = new Date();
        const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Выполненные за сегодня
        if (this.parent.completions && this.parent.completions[todayFormatted]) {
            Object.keys(this.parent.completions[todayFormatted]).forEach(habitId => {
                if (this.parent.completions[todayFormatted][habitId]) {
                    // Пробуем взять из actionTimes (для текущей сессии) или из dayActionTimes (после перезагрузки)
                    const time = (this.parent.actionTimes && this.parent.actionTimes[habitId + '_completed']) || 
                                 (this.parent.dayActionTimes && this.parent.dayActionTimes[todayISO] && this.parent.dayActionTimes[todayISO][habitId]?.completed) || null;
                    logs.push({ habitId, type: 'completed', time });
                }
            });
        }

        // Пропущенные за сегодня
        if (this.parent.skipped && this.parent.skipped[todayISO]) {
            Object.keys(this.parent.skipped[todayISO]).forEach(habitId => {
                if (this.parent.skipped[todayISO][habitId]) {
                    const time = (this.parent.actionTimes && this.parent.actionTimes[habitId + '_skipped']) || 
                                 (this.parent.dayActionTimes && this.parent.dayActionTimes[todayISO] && this.parent.dayActionTimes[todayISO][habitId]?.skipped) || null;
                    logs.push({ habitId, type: 'skipped', time });
                }
            });
        }

        // Сортируем по времени (новые сверху)
        logs.sort((a, b) => {
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return b.time.localeCompare(a.time);
        });

        const recentLogs = logs.slice(0, 10);

        if (recentLogs.length === 0) {
            activityList.innerHTML = `
                <div style="text-align:center;padding:30px;color:#94a3b8;">
                    <i class="fas fa-history" style="font-size:2rem;margin-bottom:10px;opacity:0.3;display:block;"></i>
                    <p style="font-size:0.9rem;">Сегодня пока не было активности</p>
                </div>
            `;
            return;
        }

        recentLogs.forEach(log => {
            const habit = this.parent.habits.find(h => String(h.id) === String(log.habitId));
            if (!habit) return;

            const categoryColor = log.type === 'skipped' ? '#ef4444' : getCategoryColor(habit.category);
            const icon = log.type === 'skipped' ? '🚫' : getCategoryIcon(habit.category);
            const label = log.type === 'skipped' ? 'Пропущено' : 'Выполнено';
            const labelColor = log.type === 'skipped' ? '#dc2626' : '#4caf50';
            const timeDisplay = log.time || '—';

            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-icon-wrapper" style="background: ${categoryColor}15; color: ${categoryColor}; font-size:1.1rem;">
                    ${icon}
                </div>
                <div class="activity-body">
                    <div class="activity-header">
                        <span class="activity-label" style="color:${labelColor}">${label}</span>
                        <span class="activity-time-stamp">${timeDisplay}</span>
                    </div>
                    <div class="activity-habit-name">${habit.name}</div>
                </div>
            `;
            activityList.appendChild(activityItem);
        });
    }
}
