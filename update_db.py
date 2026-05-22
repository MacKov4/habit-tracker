import sqlite3

conn = sqlite3.connect('instance/database.db')
cursor = conn.cursor()

def add_column(table, column, definition):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
        print(f"Added {column} to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print(f"Column {column} already exists in {table}")
        else:
            print(f"Error adding {column} to {table}: {e}")

add_column("habit", "sort_order", "INTEGER DEFAULT 0")
add_column("habit", "subtasks", "TEXT")
add_column("habit_log", "subtask_state", "TEXT")

conn.commit()
conn.close()
