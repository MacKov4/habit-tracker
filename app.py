from flask import Flask, render_template, redirect, url_for, request, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from cryptography.fernet import Fernet
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

from werkzeug.security import generate_password_hash, check_password_hash
from flask import jsonify
from flask_mail import Mail, Message
import random
import string
from datetime import datetime, timedelta
from authlib.integrations.flask_client import OAuth


# =====================
# НАСТРОЙКИ ШИФРОВАНИЯ
# =====================
KEY_FILE = 'secret.key'
if not os.path.exists(KEY_FILE):
    key = Fernet.generate_key()
    with open(KEY_FILE, 'wb') as key_file:
        key_file.write(key)
else:
    with open(KEY_FILE, 'rb') as key_file:
        key = key_file.read()

cipher = Fernet(key)

def encrypt_data(text):
    if not text: return text
    return cipher.encrypt(text.encode()).decode()

def decrypt_data(text):
    if not text: return text
    try:
        return cipher.decrypt(text.encode()).decode()
    except Exception:
        return text # Если данные не зашифрованы (старые), возвращаем как есть





app = Flask(__name__)

# =====================
# НАСТРОЙКИ ЛОГИРОВАНИЯ
# =====================
import logging
from logging.handlers import RotatingFileHandler
import os

if not os.path.exists('logs'):
    os.mkdir('logs')

file_handler = RotatingFileHandler('logs/habit_tracker.log', maxBytes=102400, backupCount=3)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
))
file_handler.setLevel(logging.INFO)
app.logger.addHandler(file_handler)
app.logger.setLevel(logging.INFO)
app.logger.info('Habit Tracker startup')
app.config['SECRET_KEY'] = 'supersecretkey'  # лучше хранить в .env или переменных окружения

# Настройка подключения к базе данных (PostgreSQL на Render / SQLite локально)
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    # SQLAlchemy 1.4+ требует, чтобы ссылка начиналась с postgresql:// вместо postgres://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # убирает предупреждение

db = SQLAlchemy(app)

# Автоматически создаем таблицы в базе данных при запуске приложения
with app.app_context():
    db.create_all()

oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# =====================
# НАСТРОЙКИ ПОЧТЫ
# =====================
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', os.getenv('MAIL_USERNAME'))

mail = Mail(app)
# Словари для перевода и оформления (категория: (Иконка + Название, Цвет))
HABIT_CONFIG = {
    'health': ('🏃 Здоровье', '#ff6b6b'),
    'sport': ('💪 Спорт', '#ff9800'),
    'learning': ('📚 Учёба и саморазвитие', '#2196f3'),
    'productivity': ('💻 Продуктивность', '#4caf50'),
    'mental': ('🧘 Ментальное здоровье', '#9c27b0'),
    'household': ('🧹 Быт и порядок', '#607d8b'),
    'finance': ('💰 Финансы', '#ffc107'),
    'social': ('🧑‍🤝‍🧑 Социальные связи', '#e91e63'),
    'creativity': ('🎨 Творчество', '#ff5722'),
    'digital': ('📱 Цифровая гигиена', '#00bcd4'),
    'morning': ('🌅 Утренние привычки', '#ff9800'),
    'evening': ('🌙 Вечерние привычки', '#3f51b5'),
    'other': ('📝 Другое', '#9e9e9e')
}

FREQ_NAMES = {
    'daily': 'Ежедневно',
    'custom': 'Свой график'
}
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = None

# =====================
# МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ
# =====================

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    theme_color = db.Column(db.String(50), default='#667eea')
    
    # Настройки уведомлений
    daily_reminders = db.Column(db.Boolean, default=False)
    reminder_time = db.Column(db.String(5), default='09:00')
    internet_reminders = db.Column(db.Boolean, default=False)
    email_notifications = db.Column(db.Boolean, default=False)

    

    habits = db.relationship('Habit', backref='user', lazy=True)

    @property
    def display_username(self):
        return decrypt_data(self.username)

    @property
    def display_email(self):
        return decrypt_data(self.email)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

class Habit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(500))
    category = db.Column(db.String(50))                # health, productivity и т.д.
    frequency = db.Column(db.String(50))               # daily, weekly, custom
    custom_days = db.Column(db.String(100))            # например "1,3,5" для Пн,Ср,Пт
    target = db.Column(db.Integer)                     # например 8 стаканов
    unit = db.Column(db.String(50))                    # стаканов, минут и т.д.
    created_at = db.Column(db.DateTime, default=db.func.now())

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)


class HabitLog(db.Model):
    """Хранит выполнение и прогресс привычек по дням"""
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.String(10), nullable=False)   # формат "2026-04-21"
    completed = db.Column(db.Boolean, default=False)
    progress = db.Column(db.Integer, default=0)       # текущий прогресс (для количественных)
    skipped = db.Column(db.Boolean, default=False)    # отмечено как пропущено
    action_time = db.Column(db.String(5), nullable=True)  # время действия "HH:MM"

    __table_args__ = (db.UniqueConstraint('habit_id', 'date', name='uq_habit_date'),)


class MissedHabit(db.Model):
    """Хранит пропущенные привычки по дням"""
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    date = db.Column(db.String(10), nullable=False)   # формат "2026-04-21"

    __table_args__ = (db.UniqueConstraint('habit_id', 'date', name='uq_missed_habit_date'),)


class HabitNote(db.Model):
    """Заметки к привычкам"""
    id = db.Column(db.Integer, primary_key=True)
    habit_id = db.Column(db.Integer, db.ForeignKey('habit.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    mood = db.Column(db.String(20), nullable=True) # excellent, good, neutral, bad, terrible
    date = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.now())

class HabitList(db.Model):
    """Пользовательские списки привычек"""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    habit_ids = db.Column(db.Text) # Храним как JSON-строку со списком ID
    
    __table_args__ = (db.UniqueConstraint('user_id', 'name', name='uq_user_list_name'),)

class VerificationCode(db.Model):
    """Коды подтверждения для сброса пароля"""
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# =====================
# РОУТЫ
# =====================

@app.route("/api/habits", methods=["GET"])
@login_required
def api_get_habits():
    habits = Habit.query.filter_by(user_id=current_user.id).order_by(Habit.created_at.desc()).all()
    habits_list = []
    for habit in habits:
        habits_list.append({
            'id': habit.id,
            'name': decrypt_data(habit.name), # РАСШИФРОВЫВАЕМ
            'description': decrypt_data(habit.description), # РАСШИФРОВЫВАЕМ
            'category': habit.category,
            'frequency': habit.frequency,
            'customDays': [int(d) for d in habit.custom_days.split(',') if d.strip()] if habit.custom_days else [],
            'target': habit.target,
            'unit': habit.unit,
            'createdAt': habit.created_at.isoformat()
        })
    return jsonify(habits_list)



@app.route("/add_habit", methods=["POST"])
@login_required
def add_habit():
    try:
        name = request.form.get("habitName")
        if not name:
            return redirect(url_for("index"))

        description = request.form.get("habitDescription", "")
        category = request.form.get("habitCategory")
        frequency = request.form.get("habitFrequency")
        target_str = request.form.get("habitTarget")
        unit = request.form.get("habitUnit")

        target = None
        if target_str and target_str.strip():
            try:
                target = int(target_str)
            except ValueError:
                return redirect(url_for("index"))

        custom_days = None
        if frequency == 'custom':
            custom_days_list = request.form.getlist("customDays")
            custom_days = ','.join(custom_days_list) if custom_days_list else None

        new_habit = Habit(
            name=encrypt_data(name), # ШИФРУЕМ
            description=encrypt_data(description), # ШИФРУЕМ
            category=category,
            frequency=frequency,
            custom_days=custom_days,
            target=target,
            unit=unit,
            user_id=current_user.id
        )

        db.session.add(new_habit)
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        print(f"Ошибка сохранения: {str(e)}")
    
    return redirect(url_for("index"))

 
@app.route("/edit_habit/<int:habit_id>", methods=["POST"])
@login_required
def edit_habit(habit_id):
    habit = Habit.query.get_or_404(habit_id)
    
    if habit.user_id != current_user.id:
        return jsonify({"error": "Это не ваша привычка"}), 403

    try:
        name = request.form.get("habitName")
        if not name:
            return jsonify({"error": "Название привычки обязательно"}), 400

        description = request.form.get("habitDescription", "")
        category = request.form.get("habitCategory")
        frequency = request.form.get("habitFrequency")
        target_str = request.form.get("habitTarget")
        unit = request.form.get("habitUnit")

        target = None
        if target_str and target_str.strip():
            try:
                target = int(target_str)
            except ValueError:
                return jsonify({"error": "Цель должна быть числом"}), 400

        custom_days = None
        if frequency == 'custom':
            custom_days_list = request.form.getlist("customDays")
            custom_days = ','.join(custom_days_list) if custom_days_list else None

        habit.name = encrypt_data(name) # ШИФРУЕМ
        habit.description = encrypt_data(description) # ШИФРУЕМ
        habit.category = category
        habit.frequency = frequency
        habit.custom_days = custom_days
        habit.target = target
        habit.unit = unit

        db.session.commit()
        return jsonify({"success": True, "message": "Привычка обновлена"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    

@app.route("/api/habit/<int:habit_id>", methods=["GET"])
@login_required
def api_get_habit(habit_id):
    habit = Habit.query.get_or_404(habit_id)
    
    if habit.user_id != current_user.id:
        return jsonify({"error": "Это не ваша привычка"}), 403
    
    return jsonify({
        'id': habit.id,
        'name': decrypt_data(habit.name), # РАСШИФРОВЫВАЕМ
        'description': decrypt_data(habit.description), # РАСШИФРОВЫВАЕМ
        'category': habit.category,
        'frequency': habit.frequency,
        'customDays': [int(d) for d in habit.custom_days.split(',') if d.strip()] if habit.custom_days else [],
        'target': habit.target,
        'unit': habit.unit
    })


@app.route("/api/insights", methods=["GET"])
@login_required
def api_get_insights():
    insights = []
    
    # Инсайт 1: Время выполнения (Жаворонок/Сова)
    logs_with_time = HabitLog.query.filter(
        HabitLog.user_id == current_user.id, 
        HabitLog.action_time != None,
        HabitLog.completed == True
    ).all()
    
    if logs_with_time:
        morning_count = sum(1 for log in logs_with_time if int(log.action_time.split(':')[0]) < 12)
        total_timed = len(logs_with_time)
        if total_timed > 3:
            morning_ratio = morning_count / total_timed
            if morning_ratio > 0.6:
                insights.append({
                    "icon": "🌅",
                    "title": "Вы — жаворонок!",
                    "text": f"{int(morning_ratio*100)}% своих привычек вы выполняете до полудня. Отличное время для самых важных задач!"
                })
            elif morning_ratio < 0.3:
                insights.append({
                    "icon": "🌙",
                    "title": "Ночная продуктивность",
                    "text": f"{int((1-morning_ratio)*100)}% привычек вы делаете после обеда и вечером."
                })

    # Инсайт 2: Зависимость от настроения
    notes = HabitNote.query.filter_by(user_id=current_user.id).all()
    if len(notes) > 3:
        mood_completions = {'good': [], 'bad': []}
        all_logs = HabitLog.query.filter_by(user_id=current_user.id).all()
        logs_by_date = {}
        for l in all_logs:
            if l.date not in logs_by_date:
                logs_by_date[l.date] = []
            logs_by_date[l.date].append(l.completed)
            
        for n in notes:
            if n.date in logs_by_date:
                daily_completion = sum(1 for completed in logs_by_date[n.date] if completed) / len(logs_by_date[n.date]) if logs_by_date[n.date] else 0
                if n.mood in ['excellent', 'good']:
                    mood_completions['good'].append(daily_completion)
                elif n.mood in ['bad', 'terrible']:
                    mood_completions['bad'].append(daily_completion)
                    
        if mood_completions['good'] and mood_completions['bad']:
            avg_good = sum(mood_completions['good']) / len(mood_completions['good'])
            avg_bad = sum(mood_completions['bad']) / len(mood_completions['bad'])
            if avg_good > avg_bad + 0.2:
                insights.append({
                    "icon": "😊",
                    "title": "Настроение решает",
                    "text": f"В дни с хорошим настроением вы выполняете на {int((avg_good - avg_bad)*100)}% больше задач. Радуйте себя чаще!"
                })
                
    if not insights:
        insights.append({
            "icon": "📊",
            "title": "Сбор данных",
            "text": "Продолжайте отмечать привычки и настроение, и скоро здесь появятся персональные инсайты."
        })

    return jsonify(insights)


@app.route("/api/logs", methods=["GET"])
@login_required
def api_get_logs():
    """Возвращает все логи пользователя (выполнение + прогресс)"""
    logs = HabitLog.query.filter_by(user_id=current_user.id).all()
    result = {}
    for log in logs:
        if log.date not in result:
            result[log.date] = {}
        result[log.date][str(log.habit_id)] = {
            'completed': log.completed,
            'progress': log.progress,
            'skipped': log.skipped or False,
            'action_time': log.action_time or None
        }
    return jsonify(result)


@app.route("/api/log", methods=["POST"])
@login_required
def api_save_log():
    """Сохраняет выполнение и/или прогресс привычки за день"""
    data = request.get_json()
    habit_id = data.get('habit_id')
    date = data.get('date')           # "2026-04-21"
    completed = data.get('completed', None)
    progress = data.get('progress', None)
    skipped = data.get('skipped', None)

    if not habit_id or not date:
        return jsonify({'error': 'habit_id и date обязательны'}), 400

    # Проверяем что привычка принадлежит пользователю
    habit = Habit.query.get_or_404(habit_id)
    if habit.user_id != current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    log = HabitLog.query.filter_by(habit_id=habit_id, date=date).first()
    if not log:
        log = HabitLog(habit_id=habit_id, user_id=current_user.id, date=date)
        db.session.add(log)

    from datetime import datetime as _dt
    if completed is not None:
        log.completed = completed
    if progress is not None:
        log.progress = progress
    if skipped is not None:
        log.skipped = skipped

    # Логика обновления времени действия (action_time)
    # Если привычка выполнена или пропущена - нам нужно время.
    # Если мы только что установили completed или skipped в True, обновляем время на текущее.
    # Если оба флага сняты - обнуляем время.
    from datetime import datetime as _dt
    if log.completed or log.skipped:
        if log.action_time is None or completed is True or skipped is True:
            log.action_time = _dt.now().strftime('%H:%M')
    else:
        log.action_time = None

    try:
        db.session.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500




@app.route("/api/missed", methods=["GET"])
@login_required
def api_get_missed():
    """Возвращает все пропущенные привычки пользователя"""
    missed = MissedHabit.query.filter_by(user_id=current_user.id).all()
    result = {}
    for m in missed:
        if m.date not in result:
            result[m.date] = []
        result[m.date].append(str(m.habit_id))
    return jsonify(result)


@app.route("/api/missed", methods=["POST"])
@login_required
def api_save_missed():
    """Добавляет привычку в список пропущенных за день"""
    data = request.get_json()
    habit_id = data.get('habit_id')
    date = data.get('date')  # "2026-04-21"
    action = data.get('action')  # 'add' или 'remove'

    if not habit_id or not date:
        return jsonify({'error': 'habit_id и date обязательны'}), 400

    habit = Habit.query.get_or_404(habit_id)
    if habit.user_id != current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    if action == 'add':
        # Проверяем что уже не добавлена
        missed = MissedHabit.query.filter_by(habit_id=habit_id, date=date).first()
        if not missed:
            missed = MissedHabit(habit_id=habit_id, user_id=current_user.id, date=date)
            db.session.add(missed)
    elif action == 'remove':
        missed = MissedHabit.query.filter_by(habit_id=habit_id, date=date).first()
        if missed:
            db.session.delete(missed)

    try:
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route("/api/notes/<int:habit_id>", methods=["GET"])
@login_required
def api_get_notes(habit_id):
    """Возвращает все заметки к привычке"""
    habit = Habit.query.get_or_404(habit_id)
    if habit.user_id != current_user.id:
        return jsonify({"error": "Нет доступа"}), 403
    
    notes = HabitNote.query.filter_by(habit_id=habit_id, user_id=current_user.id)\
        .order_by(HabitNote.created_at.desc()).all()
        
    return jsonify([{
        'id': n.id,
        'date': n.date,
        'text': decrypt_data(n.text), # РАСШИФРОВЫВАЕМ
        'mood': n.mood,
        'created_at': n.created_at.strftime('%d.%m.%Y %H:%M')
    } for n in notes])


@app.route("/api/notes", methods=["POST"])
@login_required
def api_add_note():
    """Добавляет заметку к привычке"""
    data = request.get_json()
    habit_id = data.get('habit_id')
    text = data.get('text', '').strip()
    date = data.get('date')
    mood = data.get('mood') # необязательно
    
    if not habit_id or not text or not date:
        return jsonify({'error': 'habit_id, text и date обязательны'}), 400

    habit = Habit.query.get_or_404(habit_id)
    if habit.user_id != current_user.id:
        return jsonify({'error': 'Нет доступа'}), 403

    # ШИФРУЕМ текст заметки
    encrypted_text = encrypt_data(text)

    note = HabitNote(habit_id=habit_id, user_id=current_user.id, date=date, text=encrypted_text, mood=mood)
    db.session.add(note)
    try:
        db.session.commit()
        return jsonify({'success': True, 'id': note.id, 'created_at': note.created_at.strftime('%d.%m.%Y %H:%M')})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route("/api/notes/<int:note_id>", methods=["PUT"])
@login_required
def api_edit_note(note_id):
    """Редактирует текст заметки"""
    note = HabitNote.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        return jsonify({"error": "Нет доступа"}), 403
    
    data = request.get_json()
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': 'Текст заметки обязателен'}), 400
        
    note.text = encrypt_data(text) # ШИФРУЕМ
    try:
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route("/api/notes/<int:note_id>", methods=["DELETE"])
@login_required
def api_delete_note(note_id):
    """Удаляет заметку"""
    note = HabitNote.query.get_or_404(note_id)
    if note.user_id != current_user.id:
        return jsonify({"error": "Нет доступа"}), 403
    
    try:
        db.session.delete(note)
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route("/")
@login_required
def index():
    habits = Habit.query.filter_by(user_id=current_user.id).order_by(Habit.created_at.desc()).all()
    day_names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    
    for habit in habits:
        # РАСШИФРОВЫВАЕМ для показа на странице
        habit.name = decrypt_data(habit.name)
        habit.description = decrypt_data(habit.description)

        # Настройка категории
        cat_key = habit.category.lower() if habit.category else 'other'
        config = HABIT_CONFIG.get(cat_key, HABIT_CONFIG['other'])
        habit.display_category = config[0].split(' ', 1)[1] # Имя категории
        habit.display_icon = config[0].split(' ')[0]       # Иконка
        habit.display_color = config[1]
        
        # Логика частоты
        if habit.frequency == 'daily':
            habit.display_frequency = "Ежедневно"
        elif habit.frequency == 'custom' and habit.custom_days:
            # Превращаем "0,2,4" в "Пн, Ср, Пт"
            try:
                indices = [int(d) for d in habit.custom_days.split(',')]
                habit.display_frequency = ", ".join([day_names[i] for i in indices])
            except:
                habit.display_frequency = "Свой график"
        else:
            habit.display_frequency = habit.frequency
            
    return render_template("index.html", habits=habits)


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form.get("username")
        email = request.form.get("email")
        password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")

        if password != confirm_password:
            flash("Пароли не совпадают", "error")
            return redirect(url_for("register"))

        # Проверка существующих (нужно расшифровывать для сравнения)
        all_users = User.query.all()
        if any(decrypt_data(u.email) == email for u in all_users):
            flash("Этот email уже зарегистрирован", "error")
            return redirect(url_for("register"))
        


        hashed_password = generate_password_hash(password)
        # ШИФРУЕМ персональные данные
        new_user = User(
            username=encrypt_data(username), 
            email=encrypt_data(email), 
            password=hashed_password
        )
        db.session.add(new_user)
        db.session.commit()

        # Автоматическая авторизация сразу после регистрации
        login_user(new_user)

        flash("Регистрация успешна! Войдите в аккаунт.", "success")
        return redirect(url_for("index"))

    return render_template("register.html")

@app.route("/api/check_email", methods=["POST"])
def check_email():
    data = request.get_json()
    email = data.get("email")
    if not email:
        return jsonify({"available": True})
    
    all_users = User.query.all()
    exists = any(decrypt_data(u.email) == email for u in all_users)
    return jsonify({"available": not exists})

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        # Ищем пользователя по зашифрованной почте
        all_users = User.query.all()
        user = next((u for u in all_users if decrypt_data(u.email) == email), None)

        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for("index"))
        else:
            flash("Неверный email или пароль", "error")

    return render_template("login.html")

@app.route("/google_login")
def google_login():
    redirect_uri = url_for('google_auth', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route("/google/callback")
def google_auth():
    try:
        token = google.authorize_access_token()
        user_info = token.get('userinfo')
        
        if not user_info:
            flash("Ошибка авторизации Google.", "error")
            return redirect(url_for('login'))
            
        email = user_info.get('email')
        name = user_info.get('name')
        
        all_users = User.query.all()
        user = next((u for u in all_users if decrypt_data(u.email) == email), None)
        
        if not user:
            random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
            hashed_password = generate_password_hash(random_password)
            user = User(
                username=encrypt_data(name),
                email=encrypt_data(email),
                password=hashed_password
            )
            db.session.add(user)
            db.session.commit()
            
        login_user(user)
        flash("Вход через Google выполнен успешно!", "success")
        return redirect(url_for("index"))
        
    except Exception as e:
        app.logger.error(f"Google login error: {e}")
        flash("Произошла ошибка при входе через Google.", "error")
        return redirect(url_for("login"))

@app.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email")
        
        # Ищем пользователя
        all_users = User.query.all()
        user = next((u for u in all_users if decrypt_data(u.email) == email), None)
        
        if user:
            # Генерируем 6-значный код
            code = ''.join(random.choices(string.digits, k=6))
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            
            # Сохраняем в БД (удаляем старые коды для этого email)
            VerificationCode.query.filter_by(email=email).delete()
            new_code = VerificationCode(email=email, code=code, expires_at=expires_at)
            db.session.add(new_code)
            db.session.commit()
            
            # Отправляем письмо
            try:
                msg = Message("Код восстановления пароля",
                            recipients=[email])
                msg.body = f"Ваш код для сброса пароля: {code}. Код действует 10 минут."
                mail.send(msg)
                flash("Код отправлен на вашу почту", "success")
            except Exception as e:
                print(f"Ошибка отправки почты: {e}")
                flash(f"Ошибка отправки письма. Ваш код (для теста): {code}", "info")
            
            return redirect(url_for("reset_password", email=email))
        else:
            flash("Пользователь с таким email не найден", "error")
            
    return render_template("forgot_password.html")

@app.route("/reset_password", methods=["GET", "POST"])
def reset_password():
    email = request.args.get("email") or request.form.get("email")
    if not email:
        return redirect(url_for("forgot_password"))
        
    if request.method == "POST":
        code = request.form.get("code")
        new_password = request.form.get("password")
        confirm_password = request.form.get("confirm_password")
        
        if new_password != confirm_password:
            flash("Пароли не совпадают", "error")
            return render_template("reset_password.html", email=email)
            
        # Проверяем код
        verify = VerificationCode.query.filter_by(email=email, code=code).first()
        
        if verify and verify.expires_at > datetime.utcnow():
            # Код верный, ищем пользователя
            all_users = User.query.all()
            user = next((u for u in all_users if decrypt_data(u.email) == email), None)
            
            if user:
                user.password = generate_password_hash(new_password)
                db.session.delete(verify)
                db.session.commit()
                flash("Пароль успешно изменен! Теперь вы можете войти.", "success")
                return redirect(url_for("login"))
        else:
            flash("Неверный или просроченный код", "error")
            
    return render_template("reset_password.html", email=email)



@app.route("/delete_habit/<int:habit_id>", methods=["POST"])
@login_required
def delete_habit(habit_id):
    habit = Habit.query.get_or_404(habit_id)
    
    if habit.user_id != current_user.id:
        return jsonify({"error": "Это не ваша привычка"}), 403

    try:
        db.session.delete(habit)
        db.session.commit()
        return jsonify({"success": True, "message": "Привычка удалена"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
    
    
@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))

# --- CUSTOM LISTS API ---

@app.route('/api/lists', methods=['GET'])
@login_required
def get_habit_lists():
    lists = HabitList.query.filter_by(user_id=current_user.id).all()
    import json
    return jsonify({l.name: json.loads(l.habit_ids or '[]') for l in lists})

@app.route('/api/lists', methods=['POST'])
@login_required
def save_habit_list():
    data = request.json
    name = data.get('name')
    habit_ids = data.get('habit_ids', [])
    
    import json
    h_list = HabitList.query.filter_by(user_id=current_user.id, name=name).first()
    
    if h_list:
        h_list.habit_ids = json.dumps(habit_ids)
    else:
        h_list = HabitList(user_id=current_user.id, name=name, habit_ids=json.dumps(habit_ids))
        db.session.add(h_list)
        
    db.session.commit()
    return jsonify({"success": True})

@app.route('/api/lists/<name>', methods=['DELETE'])
@login_required
def delete_habit_list(name):
    h_list = HabitList.query.filter_by(user_id=current_user.id, name=name).first()
    if h_list:
        db.session.delete(h_list)
        db.session.commit()
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "List not found"}), 404


@app.route("/api/send_reminder_email", methods=["POST"])
@login_required
def api_send_reminder_email():
    
    data = request.get_json()
    count = data.get("count", 0)
    email = decrypt_data(current_user.email)
    
    try:
        msg = Message("Напоминание о привычках", recipients=[email])
        msg.body = f"Привет! Напоминаем, что у вас осталось {count} невыполненных привычек на сегодня. Не забывайте отмечать свой прогресс!"
        mail.send(msg)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка отправки напоминания: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/change_password", methods=["POST"])
@login_required
def change_password():
    data = request.get_json()
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"success": False, "error": "Все поля обязательны"}), 400

    if not check_password_hash(current_user.password, old_password):
        return jsonify({"success": False, "error": "Неверный текущий пароль"}), 400

    current_user.password = generate_password_hash(new_password)
    try:
        db.session.commit()
        return jsonify({"success": True, "message": "Пароль успешно изменен"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/clear_data', methods=['POST'])
@login_required
def api_clear_data():
    try:
        # Очищаем текущие данные пользователя
        HabitLog.query.filter_by(user_id=current_user.id).delete()
        MissedHabit.query.filter_by(user_id=current_user.id).delete()
        HabitNote.query.filter_by(user_id=current_user.id).delete()
        Habit.query.filter_by(user_id=current_user.id).delete()
        HabitList.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/import_data', methods=['POST'])
@login_required
def api_import_data():
    data = request.json
    if not data or 'habits' not in data:
        return jsonify({"success": False, "error": "Invalid format"}), 400
        
    try:
        # Очищаем текущие данные пользователя
        HabitLog.query.filter_by(user_id=current_user.id).delete()
        MissedHabit.query.filter_by(user_id=current_user.id).delete()
        HabitNote.query.filter_by(user_id=current_user.id).delete()
        Habit.query.filter_by(user_id=current_user.id).delete()
        db.session.commit()
        
        id_map = {}
        # Импортируем привычки
        for h in data.get('habits', []):
            new_habit = Habit(
                name=encrypt_data(h.get('name', '')),
                description=encrypt_data(h.get('description', '')),
                category=h.get('category', 'other'),
                frequency=h.get('frequency', 'daily'),
                custom_days=','.join(map(str, h.get('customDays', []))) if h.get('customDays') else None,
                target=h.get('target'),
                unit=h.get('unit'),
                user_id=current_user.id
            )
            db.session.add(new_habit)
            db.session.flush() # Получаем новый ID
            id_map[str(h.get('id'))] = new_habit.id
            
        # Импортируем выполнения (completions)
        completions = data.get('completions', {})
        for date, acts in completions.items():
            for old_id, is_completed in acts.items():
                if is_completed and str(old_id) in id_map:
                    log = HabitLog.query.filter_by(habit_id=id_map[str(old_id)], date=date).first()
                    if not log:
                        log = HabitLog(habit_id=id_map[str(old_id)], user_id=current_user.id, date=date)
                        db.session.add(log)
                    log.completed = True
                    
        # Если есть progress, тоже импортируем
        progress_data = data.get('progress', {})
        for date, acts in progress_data.items():
            for old_id, prog in acts.items():
                if str(old_id) in id_map:
                    log = HabitLog.query.filter_by(habit_id=id_map[str(old_id)], date=date).first()
                    if not log:
                        log = HabitLog(habit_id=id_map[str(old_id)], user_id=current_user.id, date=date)
                        db.session.add(log)
                    log.progress = prog

        db.session.commit()
        return jsonify({"success": True})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/update_settings', methods=['POST'])
@login_required
def update_settings():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Нет данных"}), 400
    
    # Массив полей для обновления
    fields = ['theme_color', 'daily_reminders', 'reminder_time', 'internet_reminders', 'email_notifications']
    for field in fields:
        if field in data:
            setattr(current_user, field, data[field])
    
    db.session.commit()
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)