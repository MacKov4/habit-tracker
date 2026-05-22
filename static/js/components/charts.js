/**
 * Компонент управления графиками и аналитикой
 * Desktop: Chart.js графики
 * Mobile (≤768px): кастомные scrollable Canvas-графики из mobile-charts.js
 */
import { animateCounter, getCategoryName, getCategoryColor } from '../utils.js';
import { MonthlyProgressMobileChart, SkipMobileChart } from './mobile-charts.js';

export class ChartsManager {
    constructor(parent) {
        this.parent = parent;
        this.charts = {};
        this._mobile = null;   // { monthly, skip } — мобильные экземпляры
        this._isMobile = window.innerWidth <= 768;

        // Переключаем режим при ресайзе (поворот экрана)
        window.addEventListener('resize', this._onResize.bind(this));
    }

    _onResize() {
        const wasMobile = this._isMobile;
        this._isMobile = window.innerWidth <= 768;
        if (wasMobile !== this._isMobile) {
            this._applyMode();
            this.updateCharts();
        }
    }

    /* ── Показываем / скрываем desktop vs mobile элементы ── */
    _applyMode() {
        const desktopEls = document.querySelectorAll('.desktop-chart-body');
        const mobileEls = document.querySelectorAll('.mobile-scroll-chart');

        desktopEls.forEach(el => el.style.display = this._isMobile ? 'none' : 'block');
        mobileEls.forEach(el => el.style.display = this._isMobile ? 'block' : 'none');
    }

    /* ════════════════════════════════════════════════════════
       setupCharts
    ════════════════════════════════════════════════════════ */
    setupCharts() {
        this._applyMode();

        // Всегда создаём Chart.js для desktop-графиков
        this._setupWeekly();
        this._setupTodayProgress();
        this._setupMonthlyDesktop();
        this._setupSkipDesktop();
        this._setupDistribution();

        // Инициализируем мобильные объекты (Canvas рисуется только при update)
        if (this._isMobile) {
            this._mobile = {
                monthly: new MonthlyProgressMobileChart(),
                skip: new SkipMobileChart(),
            };
        }
    }

    /* ── 1. Текущая неделя ───────────────────────────────── */
    _setupWeekly() {
        const canvas = document.getElementById('weeklyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba266');

        this.charts.weekly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Выполнено',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: gradient,
                    hoverBackgroundColor: '#667eea',
                    borderRadius: 12,
                    borderSkipped: false,
                    maxBarThickness: 45,
                    minBarLength: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1,
                animation: { duration: 1000, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.97)',
                        titleColor: '#1e293b',
                        bodyColor: '#64748b',
                        borderColor: 'rgba(0,0,0,0.05)',
                        borderWidth: 1,
                        padding: 14,
                        cornerRadius: 12,
                        displayColors: false,
                        callbacks: {
                            label: ctx => {
                                const wd = this.parent.getWeeklyData();
                                const i = ctx.dataIndex;
                                return ` Прогресс: ${wd.completed[i]} / ${wd.total[i]}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: {
                            color: '#94a3b8',
                            font: { family: "'Poppins', sans-serif", size: 12, weight: '500' }
                        }
                    },
                    y: { beginAtZero: true, display: false, grid: { display: false } }
                }
            }
        });
    }

    /* ── 2. Прогресс сегодня ─────────────────────────────── */
    _setupTodayProgress() {
        const ctx = document.getElementById('todayProgressChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.todayProgress = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [0, 100],
                    backgroundColor: ['#667eea', 'rgba(0,0,0,0.05)'],
                    borderWidth: 0,
                    circumference: 360,
                    rotation: 0,
                    cutout: '85%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: { tooltip: { enabled: false }, legend: { display: false } },
                animation: { duration: 700, easing: 'easeInOutCubic' }
            }
        });
    }

    /* ── 3. Прогресс за месяц (desktop) ─────────────────── */
    _setupMonthlyDesktop() {
        const ctx = document.getElementById('monthlyChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '% выполнения за день',
                    data: [],
                    backgroundColor: [],
                    borderRadius: 8,
                    borderSkipped: false,
                    maxBarThickness: 32,
                    minBarLength: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { left: 10, right: 45 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.97)',
                        titleColor: '#1f2937',
                        bodyColor: '#4b5563',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#9ca3af', font: { size: 10, weight: '500' }, maxTicksLimit: 12 }
                    },
                    y: {
                        min: 0, max: 100,
                        afterFit: s => { s.width = 50; },
                        grid: { color: 'rgba(0,0,0,0.04)', drawTicks: false },
                        border: { display: false, dash: [4, 4] },
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 10, weight: '500' },
                            stepSize: 25,
                            callback: v => v + '%'
                        }
                    }
                }
            }
        });
    }

    /* ── 4. Пропуски за месяц (desktop) ──────────────────── */
    _setupSkipDesktop() {
        const ctx = document.getElementById('monthlySkipChart')?.getContext('2d');
        if (!ctx) return;

        const grad = ctx.createLinearGradient(0, 0, 0, 400);
        grad.addColorStop(0, 'rgba(99,102,241,0.4)');
        grad.addColorStop(1, 'rgba(99,102,241,0.0)');

        this.charts.streak = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Пропущено',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: grad,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { left: 10, right: 20, top: 20, bottom: 10 } },
                animation: { duration: 1000, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.97)',
                        titleColor: '#1f2937',
                        bodyColor: '#4b5563',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10,
                        displayColors: false,
                        callbacks: {
                            label: ctx => {
                                const sd = this._lastSkipData;
                                if (!sd) return '';
                                return ` Пропущено: ${sd.skippedCounts[ctx.dataIndex]} из ${sd.totalCounts[ctx.dataIndex]}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { color: '#9ca3af', font: { size: 10 }, maxTicksLimit: 10 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.04)', drawTicks: false },
                        border: { display: false, dash: [4, 4] },
                        ticks: {
                            color: '#9ca3af', font: { size: 10, weight: '500' },
                            maxTicksLimit: 5, precision: 0,
                            callback: v => Number.isInteger(v) ? v : ''
                        }
                    }
                }
            }
        });
    }

    /* ── 5. Распределение по категориям ──────────────────── */
    _setupDistribution() {
        const ctx = document.getElementById('habitDistributionChart')?.getContext('2d');
        if (!ctx) return;

        this.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6',
                        '#06b6d4', '#ec4899', '#3b82f6', '#14b8a6', '#f97316'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: { size: 11, weight: '500' },
                            color: '#4b5563'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255,255,255,0.97)',
                        titleColor: '#1f2937',
                        bodyColor: '#4b5563',
                        borderColor: 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 10
                    }
                }
            }
        });
    }

    /* ════════════════════════════════════════════════════════
       updateDashboard / updateCharts
    ════════════════════════════════════════════════════════ */
    updateDashboard() {
        const habits = this.parent.getTodayHabits();
        const completed = habits.filter(h => this.parent.isHabitCompletedToday(h.id)).length;
        const pct = habits.length > 0 ? Math.round((completed / habits.length) * 100) : 0;

        const pctEl = document.getElementById('todayPercentage');
        if (pctEl) animateCounter(pctEl, pct);

        this.animateTodayProgressChart(pct);
        this.updateCharts();
    }

    updateCharts() {
        this._updateWeekly();
        this._updateMonthly();
        this._updateSkip();
        this._updateDistribution();
    }

    _updateWeekly() {
        if (!this.charts.weekly) return;
        const wd = this.parent.getWeeklyData();
        const c = this.charts.weekly;
        c.data.datasets[0].data = wd.completed;
        c.options.scales.y.max = Math.max(...wd.total, 1);
        c.options.plugins.tooltip.callbacks.label = ctx => {
            const i = ctx.dataIndex;
            return ` Выполнено: ${wd.completed[i]} / ${wd.total[i]}`;
        };
        c.update();
    }

    _updateMonthly() {
        const md = this.parent.getMonthlyData();

        // Desktop
        if (this.charts.monthly) {
            const colors = md.data.map(v =>
                v >= 80 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444'
            );
            this.charts.monthly.data.labels = md.labels;
            this.charts.monthly.data.datasets[0].data = md.data;
            this.charts.monthly.data.datasets[0].backgroundColor = colors;
            this.charts.monthly.options.plugins.tooltip.callbacks = {
                label: ctx => {
                    const pct = Math.round(ctx.parsed.y);
                    const done = md.completedCounts[ctx.dataIndex];
                    const total = md.totalCounts[ctx.dataIndex];
                    return ` ${pct}% (${done} / ${total})`;
                }
            };
            this.charts.monthly.update();
        }

        // Mobile
        if (this._isMobile) {
            if (!this._mobile) {
                this._mobile = {
                    monthly: new MonthlyProgressMobileChart(),
                    skip: new SkipMobileChart(),
                };
            }
            this._mobile.monthly.update(md);
        }
    }

    _updateSkip() {
        const sd = this.parent.getMonthlySkipData();
        this._lastSkipData = sd;

        // Desktop
        if (this.charts.streak) {
            this.charts.streak.data.labels = sd.labels;
            this.charts.streak.data.datasets[0].data = sd.skippedCounts;
            delete this.charts.streak.options.scales.y.max;
            this.charts.streak.update();
        }

        // Mobile
        if (this._isMobile && this._mobile) {
            this._mobile.skip.update(sd);
        }
    }

    _updateDistribution() {
        if (!this.charts.distribution) return;
        const dist = this.parent.getHabitDistributionData();
        this.charts.distribution.data.labels = dist.labels;
        this.charts.distribution.data.datasets[0].data = dist.data;
        this.charts.distribution.update();
    }

    animateTodayProgressChart(pct) {
        const c = this.charts.todayProgress;
        if (!c) return;
        c.data.datasets[0].data = [pct, 100 - pct];
        c.update();
    }

    updateAnalyticsStats() {
        const longestEl = document.getElementById('longestStreak');
        const overallEl = document.getElementById('overallCompletion');
        const daysEl = document.getElementById('totalDays');

        if (longestEl) longestEl.textContent = this.parent.getLongestCurrentStreak();
        if (overallEl) overallEl.textContent = `${this.parent.getOverallCompletionRate()}%`;
        if (daysEl) daysEl.textContent = this.parent.getTotalTrackingDays();
    }
}