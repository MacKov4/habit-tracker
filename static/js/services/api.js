/**
 * Сервис для работы с API (Fetch запросы)
 */

export const API = {
    async getHabits() {
        const res = await fetch('/api/habits');
        if (!res.ok) throw new Error('Ошибка загрузки привычек');
        return res.json();
    },

    async getLogs() {
        const res = await fetch('/api/logs');
        if (!res.ok) throw new Error('Ошибка загрузки логов');
        return res.json();
    },

    async saveLog(habitId, date, completed, progress, skipped = undefined) {
        const payload = { habit_id: habitId, date, completed, progress };
        if (skipped !== undefined) payload.skipped = skipped;

        const res = await fetch('/api/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Ошибка сохранения лога');
        return res.json();
    },

    async saveHabit(formData) {
        const res = await fetch('/add_habit', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Ошибка добавления привычки');
        return res; // Returning response because script.js checks response.ok
    },

    async updateHabit(habitId, formData) {
        const res = await fetch(`/edit_habit/${habitId}`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Ошибка обновления привычки');
        return res;
    },

    async getHabit(habitId) {
        const res = await fetch(`/api/habit/${habitId}`);
        if (!res.ok) throw new Error('Ошибка загрузки привычки');
        return res.json();
    },

    async deleteHabit(habitId) {
        const res = await fetch(`/delete_habit/${habitId}`, { method: 'POST' });
        if (!res.ok) throw new Error('Ошибка удаления привычки');
        return res.json();
    },

    async getNotes(habitId) {
        const res = await fetch(`/api/notes/${habitId}`);
        if (!res.ok) throw new Error('Ошибка загрузки заметок');
        return res.json();
    },

    async saveNote(habitId, text, date, mood = null) {
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habit_id: habitId, text, date, mood })
        });
        if (!res.ok) throw new Error('Ошибка сохранения заметки');
        return res.json();
    },

    async editNote(noteId, text) {
        const res = await fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error('Ошибка обновления заметки');
        return res.json();
    },

    async deleteNote(noteId) {
        const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Ошибка удаления заметки');
        return res.json();
    },

    async getLists() {
        const response = await fetch('/api/lists');
        return await response.json();
    },

    async saveList(name, habitIds) {
        const response = await fetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, habit_ids: habitIds })
        });
        return await response.json();
    },

    async deleteList(name) {
        const response = await fetch(`/api/lists/${name}`, { method: 'DELETE' });
        return await response.json();
    },

    async updateSettings(settings) {
        const res = await fetch('/api/update_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        return res.json();
    },

    async changePassword(oldPassword, newPassword) {
        const res = await fetch('/api/change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });
        return res.json();
    },
    async sendVerificationCode() {
        const res = await fetch('/api/send_verification_code', { method: 'POST' });
        return res.json();
    },
    async verifyEmail(code) {
        const res = await fetch('/api/verify_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        return res.json();
    },
    async sendReminderEmail(count) {
        const res = await fetch('/api/send_reminder_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count })
        });
        return res.json();
    },
    async importData(data) {
        const res = await fetch('/api/import_data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    }
};
