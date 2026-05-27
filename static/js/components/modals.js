/**
 * Компонент управления модальными окнами и формами
 */
import { getCategoryName, getFrequencyName } from '../utils.js';

export class ModalManager {
    constructor(parent) {
        this.parent = parent;
        this.setupModalCloseHandlers();
    }

    setupModalCloseHandlers() {
        // Закрытие модалок по клику на оверлей
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                    document.body.classList.remove('modal-open');
                }
            });
        });
    }

    // --- МОДАЛКА ПРИВЫЧКИ ---

    openHabitModal(editMode = false, habit = null) {
        const modal = document.getElementById('habitModal');
        if (!modal) return;

        modal.classList.add('show');
        document.body.classList.add('modal-open');

        const form = document.getElementById('habitForm');
        if (form) form.reset();

        // Скрываем дополнительные группы по умолчанию
        ['habitTypeGroup', 'customCategoryGroup', 'customHabitGroup', 'customDaysGroup'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        if (editMode && habit) {
            document.getElementById('modalTitle').textContent = 'Редактировать привычку';
            document.getElementById('saveHabitBtn').textContent = 'Сохранить изменения';

            document.getElementById('habitCategory').value = habit.category || 'other';
            document.getElementById('habitDescription').value = habit.description || '';
            document.getElementById('habitFrequency').value = habit.frequency || 'daily';
            document.getElementById('habitTarget').value = habit.target || '';
            
            // Заполнение единицы измерения
            const unitValue = habit.unit || '';
            const unitSelect = document.getElementById('habitUnitSelect');
            const unitInput = document.getElementById('habitUnit');
            
            if (unitSelect && unitInput) {
                const exists = [...unitSelect.options].some(opt => opt.value === unitValue);
                if (exists && unitValue !== '') {
                    unitSelect.value = unitValue;
                    unitInput.style.display = 'none';
                    unitInput.value = '';
                } else if (unitValue === '') {
                    unitSelect.value = '';
                    unitInput.style.display = 'none';
                    unitInput.value = '';
                } else {
                    unitSelect.value = 'other';
                    unitInput.style.display = 'block';
                    unitInput.value = unitValue;
                }
            } else {
                if (unitInput) unitInput.value = unitValue;
            }

            // Триггерим событие изменения категории, чтобы подгрузить шаблоны
            document.getElementById('habitCategory').dispatchEvent(new Event('change'));

            // Заполняем название привычки (через таймаут, чтобы шаблоны успели подгрузиться)
            setTimeout(() => {
                const habitTypeSelect = document.getElementById('habitType');
                if (habitTypeSelect) {
                    const exists = [...habitTypeSelect.options].some(opt => opt.value === habit.name);
                    if (exists) {
                        habitTypeSelect.value = habit.name;
                        document.getElementById('customHabitGroup').style.display = 'none';
                    } else {
                        habitTypeSelect.value = "custom";
                        document.getElementById('customHabitName').value = habit.name;
                        document.getElementById('customHabitGroup').style.display = 'block';
                    }
                }
            }, 50);

            // Обработка кастомных дней
            const customDaysGroup = document.getElementById('customDaysGroup');
            if (habit.frequency === 'custom' && customDaysGroup) {
                customDaysGroup.style.display = 'block';
                const savedDays = habit.customDays || habit.custom_days;
                if (savedDays && Array.isArray(savedDays)) {
                    savedDays.forEach(day => {
                        const cb = document.querySelector(`#customDaysGroup input[type="checkbox"][value="${day}"]`);
                        if (cb) cb.checked = true;
                    });
                }
            }

            // Добавляем ID редактируемой привычки в скрытое поле
            let hiddenId = document.getElementById('editHabitId');
            if (!hiddenId) {
                hiddenId = document.createElement('input');
                hiddenId.type = 'hidden';
                hiddenId.id = 'editHabitId';
                form.appendChild(hiddenId);
            }
            hiddenId.value = habit.id;
        } else {
            document.getElementById('modalTitle').textContent = 'Добавить новую привычку';
            document.getElementById('saveHabitBtn').textContent = 'Сохранить привычку';

            const habitTypeSelect = document.getElementById('habitType');
            if (habitTypeSelect) {
                habitTypeSelect.innerHTML = '<option value="">Сначала выберите категорию</option>';
            }

            const unitSelect = document.getElementById('habitUnitSelect');
            const unitInput = document.getElementById('habitUnit');
            if (unitSelect && unitInput) {
                unitSelect.value = '';
                unitInput.style.display = 'none';
                unitInput.value = '';
            }
        }
    }

    closeHabitModal() {
        const modal = document.getElementById('habitModal');
        if (!modal) return;
        modal.classList.remove('show');
        document.body.classList.remove('modal-open');
        
        const editId = document.getElementById('editHabitId');
        if (editId) editId.remove();
    }

    setupCategoryListeners() {
        const categorySelect = document.getElementById('habitCategory');
        const habitTypeGroup = document.getElementById('habitTypeGroup');
        const customCategoryGroup = document.getElementById('customCategoryGroup');
        const customHabitGroup = document.getElementById('customHabitGroup');
        const habitTypeSelect = document.getElementById('habitType');

        if (!categorySelect) return;

        categorySelect.addEventListener('change', () => {
            const selected = categorySelect.value;
            habitTypeGroup.style.display = 'none';
            customCategoryGroup.style.display = 'none';
            customHabitGroup.style.display = 'none';

            if (!selected) return;

            if (selected === "other") {
                customCategoryGroup.style.display = 'block';
                customHabitGroup.style.display = 'block';
            } else {
                habitTypeGroup.style.display = 'block';
                habitTypeSelect.innerHTML = '<option value="">Выберите привычку</option>';

                const template = this.parent.habitTemplates[selected];
                if (template && template.habits.length > 0) {
                    template.habits.forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        habitTypeSelect.appendChild(opt);
                    });
                    const customOpt = document.createElement('option');
                    customOpt.value = "custom";
                    customOpt.textContent = "Своя привычка";
                    habitTypeSelect.appendChild(customOpt);
                }
            }
        });

        if (habitTypeSelect) {
            habitTypeSelect.addEventListener('change', () => {
                customHabitGroup.style.display = habitTypeSelect.value === "custom" ? 'block' : 'none';
            });
        }

        const frequencySelect = document.getElementById('habitFrequency');
        const customDaysGroup = document.getElementById('customDaysGroup');
        if (frequencySelect && customDaysGroup) {
            frequencySelect.addEventListener('change', () => {
                customDaysGroup.style.display = frequencySelect.value === 'custom' ? 'block' : 'none';
            });
        }

        const unitSelect = document.getElementById('habitUnitSelect');
        const unitInput = document.getElementById('habitUnit');
        if (unitSelect && unitInput) {
            unitSelect.addEventListener('change', () => {
                if (unitSelect.value === 'other') {
                    unitInput.style.display = 'block';
                    unitInput.focus();
                } else {
                    unitInput.style.display = 'none';
                    unitInput.value = '';
                }
            });
        }
    }

    // --- МОДАЛКА УДАЛЕНИЯ ---

    openDeleteModal(habitId) {
        this.parent.deletingHabitId = habitId;
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.add('show');
    }

    closeDeleteModal() {
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.classList.remove('show');
        this.parent.deletingHabitId = null;
    }

    // --- МОДАЛКИ ЗАМЕТОК ---

    openNoteModal(habitId) {
        const modal = document.getElementById('noteModal');
        if (!modal) return;
        
        modal.dataset.habitId = habitId;
        const textarea = modal.querySelector('textarea');
        if (textarea) textarea.value = '';
        
        // Сброс выбора настроения
        this.selectedMood = null;
        modal.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('active'));
        
        modal.classList.add('show');
        
        // Добавляем обработчики для кнопок настроения, если их еще нет
        if (!modal.dataset.moodHandlersAdded) {
            modal.querySelectorAll('.mood-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const mood = btn.dataset.mood;
                    if (this.selectedMood === mood) {
                        this.selectedMood = null;
                        btn.classList.remove('active');
                    } else {
                        modal.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
                        this.selectedMood = mood;
                        btn.classList.add('active');
                    }
                });
            });
            modal.dataset.moodHandlersAdded = "true";
        }
    }

    openViewNotesModal(habitId) {
        this.parent._viewNotesHabitId = habitId;
        const habit = this.parent.habits.find(h => h.id === habitId);
        this.renderNotes(habitId, habit);
        const modal = document.getElementById('viewNotesModal');
        if (modal) modal.classList.add('show');
    }

    async renderNotes(habitId, habit = null) {
        const container = document.getElementById('notesListContainer');
        if (!container) return;

        container.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';

        try {
            const notes = await this.parent.API.getNotes(habitId);

            if (notes.length === 0) {
                container.innerHTML = '<p style="color:#888;text-align:center;padding:20px 0;">Заметок пока нет</p>';
            } else {
                const byDate = {};
                notes.forEach(n => {
                    if (!byDate[n.date]) byDate[n.date] = [];
                    byDate[n.date].push(n);
                });

                const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

                const moodEmojis = {
                    'excellent': '😍',
                    'good': '😊',
                    'neutral': '😐',
                    'bad': '☹️',
                    'terrible': '😡'
                };

                const moodLabelsText = {
                    'excellent': 'Отлично',
                    'good': 'Хорошо',
                    'neutral': 'Нормально',
                    'bad': 'Плохо',
                    'terrible': 'Ужасно'
                };

                const habitColor = habit ? habit.color : '#667eea';

                container.innerHTML = Object.entries(byDate)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([dateStr, dayNotes]) => {
                        const d = new Date(dateStr);
                        const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
                        const dateLabel = `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;

                        const notesHtml = dayNotes.map(n => {
                            const time = n.created_at.split(' ')[1]?.substring(0, 5) || '';
                            const safeText = n.text.replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '&quot;');
                            const moodEmoji = n.mood ? moodEmojis[n.mood] : null;
                            const moodText = n.mood ? moodLabelsText[n.mood] : '';

                            return `
                                <div class="note-item" id="note-item-${n.id}" style="border-left-color: ${habitColor}">
                                    <div class="note-item-header">
                                        <span class="note-time">${time}</span>
                                        <div class="note-actions" id="note-actions-${n.id}">
                                            <button onclick="habitTracker.modalManager.enterEditMode(${n.id}, \`${safeText}\` )" 
                                                    class="note-edit-btn">
                                                <i class="fas fa-pencil-alt"></i>
                                            </button>
                                            <button onclick="habitTracker.modalManager.deleteNoteConfirm(${n.id})" 
                                                    class="note-delete-btn">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="note-body" id="note-text-${n.id}">${n.text}</div>
                                    
                                    ${moodEmoji ? `
                                        <div class="note-mood-badge">
                                            <span class="mood-badge-emoji">${moodEmoji}</span>
                                            <span>${moodText}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('');

                        return `
                            <div class="note-date-group">
                                <div class="note-date-header">${dateLabel}</div>
                                ${notesHtml}
                            </div>
                        `;
                    }).join('');
            }
        } catch (error) {
            console.error('Error loading notes:', error);
            container.innerHTML = '<p style="color:#ef4444;text-align:center;padding:20px;">Ошибка загрузки заметок</p>';
        }
    }

    enterEditMode(noteId, currentText) {
        const textContainer = document.getElementById(`note-text-${noteId}`);
        const actionsContainer = document.getElementById(`note-actions-${noteId}`);
        if (!textContainer || !actionsContainer) return;

        textContainer.innerHTML = `
            <textarea id="note-edit-area-${noteId}" 
                      style="width:100%; border:1px solid #667eea; border-radius:6px; padding:8px; font-family:inherit; font-size:inherit; line-height:inherit; min-height:80px; resize:vertical; outline:none; background:white;"
            >${currentText}</textarea>
        `;

        actionsContainer.innerHTML = `
            <button onclick="habitTracker.modalManager.saveEditedNote(${noteId})" 
                    title="Сохранить" 
                    style="background:none;border:none;color:#4caf50;cursor:pointer;padding:4px;font-size:0.85rem;">
                <i class="fas fa-check"></i>
            </button>
            <button onclick="habitTracker.modalManager.exitEditMode(${noteId})" 
                    title="Отменить" 
                    style="background:none;border:none;color:#999;cursor:pointer;padding:4px;font-size:0.85rem;">
                <i class="fas fa-times"></i>
            </button>
        `;
    }

    exitEditMode(noteId) {
        if (this._refreshDayDetailsIfOpen()) return;
        if (this.parent._viewNotesHabitId) {
            this.renderNotes(this.parent._viewNotesHabitId);
        }
    }

    _refreshDayDetailsIfOpen() {
        const dayModal = document.getElementById('dayDetailsModal');
        if (dayModal && dayModal.classList.contains('show') && this.parent.calendarManager?._openDateISO) {
            this.parent.calendarManager.openDayDetailsModal(this.parent.calendarManager._openDateISO);
            return true;
        }
        return false;
    }

    deleteNoteConfirm(noteId) {
        const modal = document.getElementById('deleteNoteConfirmModal');
        if (modal) {
            modal.classList.add('show');
            const confirmBtn = document.getElementById('confirmDeleteNoteBtn');
            if (confirmBtn) {
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                newConfirmBtn.addEventListener('click', () => this.deleteNote(noteId));
            }
        }
    }

    async saveHabit() {
        const form = document.getElementById('habitForm');
        if (!form) return;

        const formData = new FormData(form);
        const editId = document.getElementById('editHabitId')?.value;

        const categorySelect = document.getElementById('habitCategory').value;
        const habitTypeSelect = document.getElementById('habitType').value;
        const frequencySelect = document.getElementById('habitFrequency').value;

        if (!categorySelect) {
            this.parent.showToast('Пожалуйста, выберите категорию', true);
            return;
        }

        let finalHabitName = "";
        if (categorySelect === "other") {
            finalHabitName = document.getElementById('customHabitName').value.trim();
        } else {
            if (!habitTypeSelect) {
                this.parent.showToast('Пожалуйста, выберите привычку из списка', true);
                return;
            }
            finalHabitName = habitTypeSelect === "custom" ? document.getElementById('customHabitName').value.trim() : habitTypeSelect;
        }

        if (!finalHabitName) {
            this.parent.showToast('Название привычки не может быть пустым', true);
            return;
        }

        if (frequencySelect === "custom") {
            const checkedDays = form.querySelectorAll('input[name="customDays"]:checked');
            if (checkedDays.length === 0) {
                this.parent.showToast('Выберите хотя бы один день для своего графика', true);
                return;
            }
        }

        const targetValue = document.getElementById('habitTarget').value;
        if (targetValue && parseFloat(targetValue) <= 0) {
            this.parent.showToast('Цель должна быть больше нуля', true);
            return;
        }

        formData.set('habitName', finalHabitName);

        // Обработка единицы измерения
        let finalUnit = "";
        const unitSelectVal = document.getElementById('habitUnitSelect')?.value;
        if (unitSelectVal === "other") {
            finalUnit = document.getElementById('habitUnit')?.value.trim() || "";
        } else {
            finalUnit = unitSelectVal || "";
        }

        if (finalUnit && !targetValue) {
            this.parent.showToast('Пожалуйста, укажите цель для выбранной единицы измерения', true);
            return;
        }

        formData.set('habitUnit', finalUnit);

        try {
            const response = editId 
                ? await this.parent.API.updateHabit(editId, formData)
                : await this.parent.API.saveHabit(formData);

            if (response.ok) {
                this.closeHabitModal();
                this.parent.showToast(editId ? 'Привычка обновлена!' : 'Привычка добавлена!', false);
                await this.parent.loadHabitsList();
            } else {
                this.parent.showToast('Ошибка сохранения', true);
            }
        } catch (error) {
            this.parent.showToast('Ошибка сети', true);
            console.error(error);
        }
    }

    async saveNote() {
        const modal = document.getElementById('noteModal');
        const habitId = modal.dataset.habitId;
        const text = modal.querySelector('textarea').value.trim();
        const date = new Date().toISOString().split('T')[0];

        if (!text) {
            this.parent.showToast('Текст заметки пуст', true);
            return;
        }

        try {
            const result = await this.parent.API.saveNote(habitId, text, date, this.selectedMood);
            if (result.success) {
                modal.classList.remove('show');
                this.parent.showToast('Заметка сохранена!');
                this.selectedMood = null;
            } else {
                this.parent.showToast('Ошибка сохранения заметки', true);
            }
        } catch (error) {
            console.error('Error saving note:', error);
            this.parent.showToast('Ошибка сети', true);
        }
    }

    async saveEditedNote(noteId, text = null) {
        if (text === null) {
            const textarea = document.getElementById(`note-edit-area-${noteId}`);
            text = textarea?.value?.trim();
        }
        
        if (!text) {
            this.parent.showToast('Текст заметки не может быть пустым', true);
            return;
        }

        try {
            const result = await this.parent.API.editNote(noteId, text);
            if (result.success) {
                this.parent.showToast('Заметка обновлена!');
                if (!this._refreshDayDetailsIfOpen()) {
                    if (this.parent._viewNotesHabitId) {
                        this.renderNotes(this.parent._viewNotesHabitId);
                    }
                }
            } else {
                this.parent.showToast('Ошибка при обновлении', true);
            }
        } catch (error) {
            console.error('Error saving edited note:', error);
            this.parent.showToast('Ошибка сети', true);
        }
    }

    async deleteNote(noteId) {
        try {
            const result = await this.parent.API.deleteNote(noteId);
            if (result.success) {
                this.parent.showToast('Заметка удалена');
                const modal = document.getElementById('deleteNoteConfirmModal');
                if (modal) modal.classList.remove('show');
                if (!this._refreshDayDetailsIfOpen()) {
                    if (this.parent._viewNotesHabitId) {
                        this.renderNotes(this.parent._viewNotesHabitId);
                    }
                }
            } else {
                this.parent.showToast('Ошибка при удалении', true);
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            this.parent.showToast('Ошибка сети', true);
        }
    }
}

