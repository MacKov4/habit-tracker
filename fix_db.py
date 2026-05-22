import sqlite3
import os

db_path = 'instance/database.db'

if not os.path.exists(db_path):
    print(f"База данных не найдена по пути: {db_path}")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Список новых колонок
        new_columns = [
            ('character_name', 'VARCHAR(100)'),
            ('coins', 'INTEGER DEFAULT 0'),
            ('xp', 'INTEGER DEFAULT 0'),
            ('level', 'INTEGER DEFAULT 1'),
            ('inventory', 'TEXT DEFAULT "[]"'),
            ('equipped_items', 'TEXT DEFAULT "{}"')
        ]
        
        for col_name, col_type in new_columns:
            try:
                cursor.execute(f"ALTER TABLE user ADD COLUMN {col_name} {col_type}")
                print(f"Колонка {col_name} успешно добавлена.")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"Колонка {col_name} уже существует.")
                else:
                    print(f"Ошибка при добавлении {col_name}: {e}")
        
        conn.commit()
        conn.close()
        print("\nМиграция базы данных успешно завершена!")
    except Exception as e:
        print(f"Произошла ошибка: {e}")
