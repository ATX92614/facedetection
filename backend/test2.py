from config import Config
import sqlite3
import os

def inspect_database():
    try:
        # Resolve database path
        database_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')
        absolute_path = os.path.abspath(database_path)
        print(f"Resolved Database Path: {absolute_path}")

        # Check if database file exists
        if not os.path.exists(database_path):
            print(f"Error: Database file does not exist at path: {absolute_path}")
            return

        # Connect to the SQLite database
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()
        print("Successfully connected to the database.")

        # Get all tables in the database
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        if not tables:
            print(f"No tables found in the database at path: {absolute_path}")
            return

        print("Tables and their details:")

        for table in tables:
            table_name = table[0]
            print(f"\nTable: {table_name}")

            # Get columns for the table
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            print("  Columns:")
            for column in columns:
                col_id, name, data_type, not_null, default_value, pk = column
                print(f"    - Name: {name}, Type: {data_type}, Not Null: {bool(not_null)}, Primary Key: {bool(pk)}")

            # Count the number of entries in the table
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"  Total Entries: {count}")

        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    inspect_database()
