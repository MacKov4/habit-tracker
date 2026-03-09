from flask import Flask, render_template, redirect, url_for, request, flash
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from flask import jsonify
import os




app = Flask(__name__)
app.config['SECRET_KEY'] = 'supersecretkey'  # лучше хранить в .env или переменных окружения
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False  # убирает предупреждение

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = "Пожалуйста, войдите в аккаунт, чтобы открыть эту страницу."

# =====================
# МОДЕЛЬ ПОЛЬЗОВАТЕЛЯ
# =====================

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

    habits = db.relationship('Habit', backref='user', lazy=True)

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
            'name': habit.name,
            'description': habit.description,
            'category': habit.category,
            'frequency': habit.frequency,
            'customDays': habit.custom_days.split(',') if habit.custom_days else [],  # если custom_days как строка "1,3,5"
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
            flash("Название привычки обязательно", "error")
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
                flash("Цель должна быть числом", "error")
                return redirect(url_for("index"))

        custom_days = None
        if frequency == 'custom':
            custom_days_list = request.form.getlist("customDays")
            custom_days = ','.join(custom_days_list) if custom_days_list else None

        new_habit = Habit(
            name=name,
            description=description,
            category=category,
            frequency=frequency,
            custom_days=custom_days,
            target=target,
            unit=unit,
            user_id=current_user.id
        )

        db.session.add(new_habit)
        db.session.commit()

        flash("Привычка успешно добавлена!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Ошибка сохранения: {str(e)}", "error")
    
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

        habit.name = name
        habit.description = description 
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
        'name': habit.name,
        'description': habit.description,
        'category': habit.category,
        'frequency': habit.frequency,
        'customDays': habit.custom_days.split(',') if habit.custom_days else [],
        'target': habit.target,
        'unit': habit.unit
    })


@app.route("/")
@login_required
def index():
    # Получаем все привычки текущего пользователя
    habits = Habit.query.filter_by(user_id=current_user.id).order_by(Habit.created_at.desc()).all()
    return render_template("index.html", user=current_user, habits=habits)


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

        if User.query.filter_by(email=email).first():
            flash("Этот email уже зарегистрирован", "error")
            return redirect(url_for("register"))

        if User.query.filter_by(username=username).first():
            flash("Это имя пользователя уже занято", "error")
            return redirect(url_for("register"))

        hashed_password = generate_password_hash(password)
        new_user = User(username=username, email=email, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()

        flash("Регистрация успешна! Войдите в аккаунт.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        user = User.query.filter_by(email=email).first()

        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(url_for("index"))
        else:
            flash("Неверный email или пароль", "error")

    return render_template("login.html")

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

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)


    