/**
 * mobile-charts.js
 * Кастомные scrollable/interactive графики для мобильных (≤768px).
 * Рисуются на нативном Canvas без Chart.js — полный контроль над UX.
 *
 * Поведение:
 *  - Горизонтальная прокрутка (свайп) — видны ~10 дней, остальные скроллятся
 *  - Tap / нажатие на бар → крупный тултип в стиле как на скриншоте
 *  - Красивый градиент баров (зелёный/жёлтый/красный)
 *  - Плавная анимация появления при загрузке
 */

/* ─── Константы внешнего вида ─────────────────────────────── */
const BAR_W          = 36;   // ширина бара, px
const BAR_GAP        = 14;   // отступ между барами
const LABEL_H        = 36;   // высота зоны подписей по X
const AXIS_W         = 46;   // ширина оси Y (слева, фиксирована в viewport)
const CANVAS_H       = 220;  // высота canvas, px
const BAR_RADIUS     = 10;   // скругление баров

/* ─── Цветовые схемы ──────────────────────────────────────── */
function progressColor(pct) {
    if (pct >= 80) return { top: '#10b981', bot: '#34d399' };
    if (pct >= 50) return { top: '#f59e0b', bot: '#fbbf24' };
    return { top: '#ef4444', bot: '#f87171' };
}

function skipColor(ratio) {
    if (ratio === 0)  return { top: '#10b981', bot: '#34d399' };
    if (ratio <= 0.33) return { top: '#10b981', bot: '#34d399' };
    if (ratio <= 0.66) return { top: '#f59e0b', bot: '#fbbf24' };
    return { top: '#ef4444', bot: '#f87171' };
}

/* ─── Вспомогательные ─────────────────────────────────────── */
function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    r = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/* ══════════════════════════════════════════════════════════════
   MobileScrollChart — базовый класс
══════════════════════════════════════════════════════════════ */
class MobileScrollChart {
    /**
     * @param {object} opts
     *   scrollWrapperId  — id div-обёртки с overflow:hidden (viewport)
     *   innerId          — id прокручиваемого div внутри
     *   canvasId         — id canvas внутри inner
     *   tooltipId        — id div тултипа (абсолютно позиционированного внутри wrapper)
     *   axisCanvasId     — id canvas для фиксированной оси Y (в wrapper)
     */
    constructor(opts) {
        this.wrapper   = document.getElementById(opts.scrollWrapperId);
        this.inner     = document.getElementById(opts.innerId);
        this.canvas    = document.getElementById(opts.canvasId);
        this.tooltipEl = document.getElementById(opts.tooltipId);
        if (!this.wrapper || !this.inner || !this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;

        // Фиксированная ось Y поверх прокрутки
        this._buildAxisCanvas();
        // Слушатели касания
        this._bindTouch();
        // Слушатель скролла (скрываем тултип)
        this.inner.addEventListener('scroll', () => this._hideTooltip(), { passive: true });

        this.data       = null;
        this.animFrame  = 0;  // прогресс анимации 0→1
        this._selectedBar = null;
    }

    /* ── Ось Y (фиксированная поверх прокручиваемой области) ── */
    _buildAxisCanvas() {
        this.axisCanvas = document.createElement('canvas');
        this.axisCanvas.style.cssText = `
            position:absolute; left:0; top:0;
            width:${AXIS_W}px; height:${CANVAS_H}px;
            pointer-events:none; z-index:2;
            background: transparent;
        `;
        this.wrapper.style.position = 'relative';
        this.wrapper.appendChild(this.axisCanvas);
        this.axisCtx = this.axisCanvas.getContext('2d');
    }

    /* ── Touch / click ── */
    _bindTouch() {
        let startX = 0, hasMoved = false;

        this.inner.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
            hasMoved = false;
        }, { passive: true });

        this.inner.addEventListener('touchmove', e => {
            if (Math.abs(e.touches[0].clientX - startX) > 5) hasMoved = true;
        }, { passive: true });

        this.inner.addEventListener('touchend', e => {
            if (!hasMoved) this._onTap(e.changedTouches[0]);
        }, { passive: true });

        // На desktop — обычный click для тестирования
        this.inner.addEventListener('click', e => this._onTap(e));
    }

    _onTap(touch) {
        if (!this.data) return;
        
        const wr = this.wrapper.getBoundingClientRect();
        const tapX = touch.clientX - wr.left;
        
        // Ignore taps on the fixed Y-axis area
        if (tapX < AXIS_W) {
            this._hideTooltip();
            return;
        }

        const rect   = this.canvas.getBoundingClientRect();
        // X внутри canvas (с учётом скролла inner)
        const canvasX = touch.clientX - rect.left;
        const idx = this._barIndexAtX(canvasX);
        if (idx !== null) {
            this._selectedBar = idx;
            this._showTooltip(idx, touch.clientX);
            this._draw(1);
        } else {
            this._hideTooltip();
        }
    }

    _barIndexAtX(x) {
        if (!this.data) return null;
        const n = this.data.labels.length;
        for (let i = 0; i < n; i++) {
            const bx = AXIS_W + i * (BAR_W + BAR_GAP);
            if (x >= bx - 4 && x <= bx + BAR_W + 4) return i;
        }
        return null;
    }

    /* ── Тултип ── */
    _showTooltip(idx, clientX) {
        if (!this.tooltipEl) return;
        const text = this._tooltipText(idx);
        this.tooltipEl.innerHTML = text;
        this.tooltipEl.style.display = 'block';
        this.tooltipEl.style.opacity = '1';

        // Позиционируем строго по центру через CSS
        this.tooltipEl.style.left = '50%';
        this.tooltipEl.style.transform = 'translateX(-50%)';
        this.tooltipEl.style.top  = '12px';
    }

    _hideTooltip() {
        if (this.tooltipEl) {
            this.tooltipEl.style.opacity = '0';
            setTimeout(() => {
                if (this.tooltipEl) this.tooltipEl.style.display = 'none';
            }, 180);
        }
        this._selectedBar = null;
        if (this.data) this._draw(1);
    }

    /** Переопределяется в подклассах */
    _tooltipText(idx) { return ''; }

    /* ── Resize canvas ── */
    _resizeCanvas(n) {
        const totalW = AXIS_W + n * (BAR_W + BAR_GAP) + BAR_GAP;
        const viewW  = this.wrapper.clientWidth;
        const cssW   = Math.max(totalW, viewW);

        this.canvas.style.width  = cssW + 'px';
        this.canvas.style.height = CANVAS_H + 'px';
        this.canvas.width  = cssW * this.dpr;
        this.canvas.height = CANVAS_H * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
        // Container must be 100% width with overflow to allow native scrolling
        this.inner.style.width  = '100%';
        this.inner.style.overflowX = 'auto';
        this.inner.style.overflowY = 'hidden';


        // Ось Y
        const ax = this.axisCanvas;
        ax.style.height = CANVAS_H + 'px';
        ax.width  = AXIS_W * this.dpr;
        ax.height = CANVAS_H * this.dpr;
        this.axisCtx.scale(this.dpr, this.dpr);
    }

    /* ── Анимация появления ── */
    animate(data) {
        this.data = data;
        this._selectedBar = null;
        this._hideTooltip();
        this._resizeCanvas(data.labels.length);
        const startTime = performance.now();
        const duration  = 700;

        const step = (now) => {
            const t = Math.min((now - startTime) / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            this._draw(ease);
            if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);

        // Прокрутить до последних дней сразу
        setTimeout(() => {
            const n   = data.labels.length;
            const totalW = AXIS_W + n * (BAR_W + BAR_GAP);
            this.inner.scrollLeft = Math.max(0, totalW - this.wrapper.clientWidth);
        }, 50);
    }

    /** Переопределяется */
    _draw(progress) {}
}

/* ══════════════════════════════════════════════════════════════
   MonthlyProgressMobileChart — «Прогресс за месяц»
══════════════════════════════════════════════════════════════ */
export class MonthlyProgressMobileChart extends MobileScrollChart {
    constructor() {
        super({
            scrollWrapperId: 'monthlyScrollChart',
            innerId:         'monthlyScrollInner',
            canvasId:        'monthlyMobileCanvas',
            tooltipId:       'monthlyTooltip',
        });
        this._monthlyData = null;
    }

    update(monthlyData) {
        this._monthlyData = monthlyData;
        this.animate(monthlyData);
    }

    _tooltipText(idx) {
        const d    = this._monthlyData;
        if (!d) return '';
        const label = d.labels[idx];
        const pct   = d.data[idx];
        const done  = d.completedCounts[idx];
        const total = d.totalCounts[idx];
        const emoji = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
        return `<div class="mct-date">${label}</div>
                <div class="mct-main">${emoji} ${pct}%</div>
                <div class="mct-sub">Выполнено ${done} из ${total}</div>`;
    }

    _draw(progress) {
        const d = this._monthlyData;
        if (!d) return;

        const ctx  = this.ctx;
        const n    = d.labels.length;
        const cW   = this.canvas.width  / this.dpr;
        const cH   = this.canvas.height / this.dpr;
        const chartH = cH - LABEL_H;
        const maxVal = 100;

        ctx.clearRect(0, 0, cW, cH);

        // ── Сетка ──────────────────────────────────────────
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        [0, 25, 50, 75, 100].forEach(v => {
            const y = chartH - (v / maxVal) * (chartH - 10) - 2;
            ctx.beginPath();
            ctx.moveTo(AXIS_W, y);
            ctx.lineTo(cW, y);
            ctx.stroke();
        });
        ctx.setLineDash([]);

        // ── Бары ──────────────────────────────────────────
        d.data.forEach((val, i) => {
            const pct    = val;
            const colors = progressColor(pct);
            const barH   = Math.max(4, ((pct / maxVal) * (chartH - 12)) * progress);
            const bx     = AXIS_W + i * (BAR_W + BAR_GAP) + BAR_GAP / 2;
            const by     = chartH - barH - 2;

            // Подсветка выбранного
            const isSelected = this._selectedBar === i;
            if (isSelected) {
                ctx.fillStyle = 'rgba(102,126,234,0.08)';
                roundRect(ctx, bx - 4, 0, BAR_W + 8, chartH, 6);
                ctx.fill();
            }

            // Градиент
            const grad = ctx.createLinearGradient(0, by, 0, by + barH);
            grad.addColorStop(0, colors.top);
            grad.addColorStop(1, colors.bot);
            ctx.fillStyle = grad;
            roundRect(ctx, bx, by, BAR_W, barH, BAR_RADIUS);
            ctx.fill();

            // Значение над баром (если > 0)
            if (pct > 0 && progress > 0.8) {
                ctx.fillStyle = isSelected ? colors.top : '#6b7280';
                ctx.font = `bold ${isSelected ? 11 : 9}px 'Poppins', sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(pct + '%', bx + BAR_W / 2, by - 4);
            }

            // Метка даты
            ctx.fillStyle = isSelected ? '#374151' : '#9ca3af';
            ctx.font = `${isSelected ? 600 : 400} 10px 'Poppins', sans-serif`;
            ctx.textAlign = 'center';
            const lbl = d.labels[i];
            // Показываем только число + первые 3 буквы месяца
            ctx.fillText(lbl, bx + BAR_W / 2, cH - 6);
        });

        // ── Фиксированная ось Y ───────────────────────────
        const ax  = this.axisCtx;
        ax.clearRect(0, 0, AXIS_W, cH);
        ax.fillStyle = 'rgba(255,255,255,0.92)';
        ax.fillRect(0, 0, AXIS_W, cH);

        [0, 25, 50, 75, 100].forEach(v => {
            const y = chartH - (v / maxVal) * (chartH - 10) - 2;
            ax.fillStyle = '#9ca3af';
            ax.font = "10px 'Poppins', sans-serif";
            ax.textAlign = 'right';
            ax.fillText(v + '%', AXIS_W - 6, y + 4);
        });
    }
}

/* ══════════════════════════════════════════════════════════════
   SkipMobileChart — «Пропуски за месяц»
══════════════════════════════════════════════════════════════ */
export class SkipMobileChart extends MobileScrollChart {
    constructor() {
        super({
            scrollWrapperId: 'skipScrollChart',
            innerId:         'skipScrollInner',
            canvasId:        'skipMobileCanvas',
            tooltipId:       'skipTooltip',
        });
        this._skipData = null;
        this._maxSkip  = 1;
    }

    update(skipData) {
        this._skipData = skipData;
        this._maxSkip  = Math.max(...skipData.skippedCounts, 1);
        this.animate(skipData);
    }

    _tooltipText(idx) {
        const d = this._skipData;
        if (!d) return '';
        const label   = d.labels[idx];
        const skipped = d.skippedCounts[idx];
        const total   = d.totalCounts[idx];
        const ratio   = total > 0 ? skipped / total : 0;
        const emoji   = ratio === 0 ? '✅' : ratio <= 0.33 ? '🟡' : '🔴';
        return `<div class="mct-date">${label}</div>
                <div class="mct-main">${emoji} ${skipped} пропуск${_plural(skipped)}</div>
                <div class="mct-sub">из ${total} привычек</div>`;
    }

    _draw(progress) {
        const d = this._skipData;
        if (!d) return;

        const ctx     = this.ctx;
        const n       = d.labels.length;
        const cW      = this.canvas.width  / this.dpr;
        const cH      = this.canvas.height / this.dpr;
        const chartH  = cH - LABEL_H;
        const maxVal  = this._maxSkip + 1;

        ctx.clearRect(0, 0, cW, cH);

        // ── Сетка ──────────────────────────────────────────
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth   = 1;
        ctx.setLineDash([4, 4]);
        for (let v = 0; v <= maxVal; v++) {
            const y = chartH - (v / maxVal) * (chartH - 10) - 2;
            ctx.beginPath();
            ctx.moveTo(AXIS_W, y);
            ctx.lineTo(cW, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // ── Бары ──────────────────────────────────────────
        d.skippedCounts.forEach((val, i) => {
            const total   = d.totalCounts[i];
            const ratio   = total > 0 ? val / total : 0;
            const colors  = skipColor(ratio);
            const barH    = val === 0
                ? 4   // минимальная черта для дней без пропусков
                : Math.max(6, ((val / maxVal) * (chartH - 12)) * progress);
            const bx      = AXIS_W + i * (BAR_W + BAR_GAP) + BAR_GAP / 2;
            const by      = chartH - barH - 2;

            const isSelected = this._selectedBar === i;

            // Подсветка
            if (isSelected) {
                ctx.fillStyle = 'rgba(99,102,241,0.08)';
                roundRect(ctx, bx - 4, 0, BAR_W + 8, chartH, 6);
                ctx.fill();
            }

            // Бар — нулевой = тонкая зелёная черта
            if (val === 0) {
                ctx.fillStyle = 'rgba(16,185,129,0.25)';
                roundRect(ctx, bx, chartH - 4, BAR_W, 4, 2);
                ctx.fill();
            } else {
                const grad = ctx.createLinearGradient(0, by, 0, by + barH);
                grad.addColorStop(0, colors.top);
                grad.addColorStop(1, colors.bot);
                ctx.fillStyle = grad;
                roundRect(ctx, bx, by, BAR_W, barH, BAR_RADIUS);
                ctx.fill();

                // Цифры над барами убраны по запросу

            }

            // Метка
            ctx.fillStyle = isSelected ? '#374151' : '#9ca3af';
            ctx.font = `${isSelected ? 600 : 400} 10px 'Poppins', sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(d.labels[i], bx + BAR_W / 2, cH - 6);
        });

        // ── Ось Y ─────────────────────────────────────────
        const ax = this.axisCtx;
        ax.clearRect(0, 0, AXIS_W, cH);
        ax.fillStyle = 'rgba(255,255,255,0.92)';
        ax.fillRect(0, 0, AXIS_W, cH);
        
        // Цифры по Y для графика пропусков убраны по запросу
    }
}

/* ─── Утилита: склонение слова «пропуск» ─── */
function _plural(n) {
    const abs = Math.abs(n) % 100;
    const mod = abs % 10;
    if (abs > 10 && abs < 20) return 'ов';
    if (mod === 1) return '';
    if (mod >= 2 && mod <= 4) return 'а';
    return 'ов';
}
