/**
 * Компонент управления фильтрами и пользовательскими списками
 */
import { getCategoryName } from '../utils.js';

export class FilterManager {
    constructor(parent) {
        this.parent = parent;
    }

    setFilter(filterValue) {
        this.parent.activeFilter = filterValue;
        
        // Обновляем UI кнопок фильтров
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === filterValue);
        });

        this.parent.updateTodayHabits();
    }

    updateHabitFilters() {
        const container = document.getElementById('habitFilters');
        if (!container) return;

        // Базовые фильтры
        let html = `
            <button class="filter-chip ${this.parent.activeFilter === 'all' ? 'active' : ''}" 
                    data-filter="all" onclick="habitTracker.filterManager.setFilter('all')">Все</button>
        `;

        // Фильтры по категориям (динамически из имеющихся привычек)
        const categories = [...new Set(this.parent.habits.map(h => h.category))];
        categories.forEach(cat => {
            const filterVal = `cat:${cat}`;
            html += `
                <button class="filter-chip ${this.parent.activeFilter === filterVal ? 'active' : ''}" 
                        data-filter="${filterVal}" onclick="habitTracker.filterManager.setFilter('${filterVal}')">
                    ${getCategoryName(cat)}
                </button>
            `;
        });

        // Пользовательские списки
        Object.keys(this.parent.customLists).forEach(name => {
            const filterVal = `list:${name}`;
            html += `
                <div class="filter-chip-wrapper" style="position:relative; display:inline-block;">
                    <button class="filter-chip ${this.parent.activeFilter === filterVal ? 'active' : ''}" 
                            data-filter="${filterVal}" onclick="habitTracker.filterManager.setFilter('${filterVal}')">
                        <i class="fas fa-list-ul" style="font-size:0.7rem;margin-right:4px;opacity:0.7;"></i>
                        ${name}
                    </button>
                    <button class="filter-chip-delete" onclick="habitTracker.deleteCustomList('${name}')" 
                            style="position:absolute; top:-5px; right:-5px; width:16px; height:16px; border-radius:50%; 
                                   background:#ef4444; color:white; border:none; font-size:10px; cursor:pointer; 
                                   display:flex; align-items:center; justify-content:center; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    }
}
