# utils.py

import face_recognition
import cv2
import os
from models_tools import Snapshot, Blacklist, db
from datetime import datetime, timedelta
from flask import current_app
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import threading
import time

def extract_faces(frame):
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    face_locations = face_recognition.face_locations(rgb_frame)
    return face_locations

def compare_faces(known_encodings, face_encoding, threshold):
    results = face_recognition.compare_faces(known_encodings, face_encoding, tolerance=threshold)
    return results

def save_snapshot(face_image):
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    filename = f'static/snapshots/{timestamp}.jpg'
    cv2.imwrite(filename, face_image)
    snapshot = Snapshot(image_path=filename, timestamp=datetime.now())
    db.session.add(snapshot)
    db.session.commit()
    return snapshot

def send_email_notification(image_path, recipient_email, smtp_settings):
    msg = MIMEMultipart()
    msg['Subject'] = 'Blacklisted Face Detected'
    msg['From'] = smtp_settings['username']
    msg['To'] = recipient_email

    with open(image_path, 'rb') as fp:
        img = MIMEImage(fp.read())
        img.add_header('Content-Disposition', 'attachment', filename=os.path.basename(image_path))
        msg.attach(img)

    with smtplib.SMTP(smtp_settings['server'], smtp_settings['port']) as server:
        server.starttls()
        server.login(smtp_settings['username'], smtp_settings['password'])
        server.sendmail(msg['From'], [msg['To']], msg.as_string())

def cleanup_old_snapshots(retention_days):
    cutoff = datetime.now() - timedelta(days=retention_days)
    old_snapshots = Snapshot.query.filter(Snapshot.timestamp < cutoff).all()
    for snapshot in old_snapshots:
        try:
            if os.path.exists(snapshot.image_path):
                os.remove(snapshot.image_path)
        except Exception as e:
            current_app.logger.error(f"Error deleting snapshot file {snapshot.image_path}: {e}")
        db.session.delete(snapshot)
    db.session.commit()

def start_cleanup_thread(retention_days):
    def cleanup_thread(snapshot_retention_days):
        """
        Background thread to clean up old snapshots periodically.
        """
        import time
        from datetime import datetime, timedelta
        import os

        while True:
            try:
                # Explicitly push an app context
                with current_app.app_context():
                    from models import Snapshot, db
                    
                    # Calculate the cutoff time for deletion
                    cutoff_time = datetime.utcnow() - timedelta(days=snapshot_retention_days)
                    old_snapshots = Snapshot.query.filter(Snapshot.timestamp < cutoff_time).all()

                    for snapshot in old_snapshots:
                        # Delete the file from the file system
                        if os.path.exists(snapshot.image_path):
                            os.remove(snapshot.image_path)
                        
                        # Remove the snapshot entry from the database
                        db.session.delete(snapshot)
                    
                    db.session.commit()
                    print(f"Cleaned up {len(old_snapshots)} old snapshots.")
            except Exception as e:
                print(f"Error in cleanup thread: {e}")
            
            # Sleep for a defined interval (e.g., 1 hour)
            time.sleep(3600)
