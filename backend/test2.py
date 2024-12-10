from config import Config
import sqlite3
import os
from datetime import datetime

def delete_today_entries():
    try:
        # Resolve database path
        database_path = Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', '')

        # Adjust the path to point to 'instance/face_recognition.db'
        script_dir = os.path.dirname(os.path.abspath(__file__))  # Current script directory
        if os.path.basename(database_path) == 'face_recognition.db':
            database_path = os.path.join(script_dir, "instance", "face_recognition.db")

        absolute_path = os.path.abspath(database_path)
        print(f"Resolved Database Path: {absolute_path}")

        # Check if database file exists
        if not os.path.exists(absolute_path):
            print(f"Error: Database file does not exist at path: {absolute_path}")
            return

        # Connect to the SQLite database
        conn = sqlite3.connect(absolute_path)
        cursor = conn.cursor()
        print("Successfully connected to the database.")

        # Get today's date in the format stored in the database
        today = datetime.now().date()

        # SQL query to delete entries with today's timestamp
        query = """
        DELETE FROM snapshots
        WHERE DATE(timestamp) = ?
        """
        
        # Execute the query
        cursor.execute(query, (today,))
        rows_deleted = cursor.rowcount

        # Commit the changes and close the connection
        conn.commit()
        conn.close()

        print(f"Deleted {rows_deleted} entries from the blacklist table for today's date: {today}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    delete_today_entries()
