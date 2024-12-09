import sys
import os
import time
# Ensure yolov9 directory is in sys.path
yolov9_path = os.path.join(os.path.dirname(__file__), "yolov9")
if yolov9_path not in sys.path:
    sys.path.append(yolov9_path)

print(f"Current sys.path: {sys.path}")  # Debug print

from flask import Flask, jsonify, request, send_from_directory, Response
from models_tools import db, Snapshot, Blacklist,Settings
from camera import Camera
from utilsTool import save_snapshot, start_cleanup_thread
from config import Config
import threading
import face_recognition
import cv2
import datetime
import pytz  # Optional: Use pytz for timezone handling
import logging
from flask_cors import CORS
from sqlalchemy import inspect,text
from flask_socketio import SocketIO, emit
from yolo_detector import YOLOv9FaceDetector
import torch
import shutil
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

# Configure logging
logging.basicConfig(
    filename='face_detection.log',
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def log_event(message):
    logging.info(message)
    print(message)

# YOLOv9 configuration
YOLOV9_CONFIG = {
    "weights_path": "C:/Bosch/backend/yolov9-c.pt",
    "device": "cuda" if torch.cuda.is_available() else "cpu",
    "confidence_threshold": 0.5,
    "nms_threshold": 0.4,
    "face_class_id": 0,
    "frame_skip_interval": 15,  # Increased to skip more frames
    "input_size": 320  # Single integer to allow dynamic aspect ratio
}


# Initialize YOLOv9FaceDetector
yolo_detector = YOLOv9FaceDetector(
    weights_path=YOLOV9_CONFIG["weights_path"],
    device=YOLOV9_CONFIG["device"],
    conf_threshold=YOLOV9_CONFIG["confidence_threshold"],
    nms_threshold=YOLOV9_CONFIG["nms_threshold"],
    face_class_id=YOLOV9_CONFIG["face_class_id"],
    input_size=YOLOV9_CONFIG["input_size"]
)

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "https://111d-2600-8802-2107-d800-f5d9-4994-b3f6-1dfe.ngrok-free.app",
            "https://5142-2600-8802-2107-d800-f5d9-4994-b3f6-1dfe.ngrok-free.app"
        ]
    },
    r"/static/*": {
        "origins": [
            "http://localhost:3000",
            "https://111d-2600-8802-2107-d800-f5d9-4994-b3f6-1dfe.ngrok-free.app",
            "https://5142-2600-8802-2107-d800-f5d9-4994-b3f6-1dfe.ngrok-free.app"
        ]
    }
})


app.config.from_object(Config)
db.init_app(app)
print(f"Database URI: {app.config['SQLALCHEMY_DATABASE_URI']}")
import os

print(f"Backend Database Path: {os.path.abspath(Config.SQLALCHEMY_DATABASE_URI.replace('sqlite:///', ''))}")

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")


# Global settings (to be persisted in a real application)
def load_settings():
    with app.app_context():
        global settings
        settings = {s.key: s.value for s in Settings.query.all()}





def setup_database():
    """
    Function to ensure the database and required directories exist,
    and to display details of existing tables (columns and entry counts),
    along with contents of the blacklist table.
    """
    with app.app_context():
        # Inspect existing tables
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        print(f"Existing tables: {tables}")

        # Display table details
        for table in tables:
            print(f"\nTable: {table}")

            # List columns for the table
            columns = inspector.get_columns(table)
            print("  Columns:")
            for column in columns:
                print(f"    - Name: {column['name']}, Type: {column['type']}, Nullable: {column['nullable']}")

            # Count number of entries in the table
            try:
                result = db.session.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"  Total Entries: {count}")
            except Exception as e:
                print(f"  Could not fetch entry count for table {table}: {e}")

            # If the table is 'blacklist', display its contents
            if table == 'blacklist':
                try:
                    result = db.session.execute(text(f"SELECT * FROM {table}"))
                    rows = result.fetchall()

                    # Fetch column names for the table
                    column_names = [column['name'] for column in inspector.get_columns(table)]

                    print("\n  Blacklist Table Contents:")
                    for row in rows:
                        # Convert row into a dictionary
                        row_dict = dict(zip(column_names, row))
                        print(f"    {row_dict}")
                except Exception as e:
                    print(f"  Could not fetch contents of table {table}: {e}")

        # Ensure all required tables exist
        required_tables = {'snapshots', 'blacklist', 'settings'}  # Include 'settings'
        missing_tables = required_tables - set(tables)

        if missing_tables:
            print(f"Creating missing tables: {missing_tables}")
            db.create_all()  # Create any missing tables

        # Ensure directories exist
        os.makedirs('static/snapshots', exist_ok=True)
        os.makedirs('static/blacklist', exist_ok=True)

        # Initialize default settings if not present
        initialize_default_settings()


def camera_processing_thread():
    global yolo_detector, camera  # Ensure camera can be dynamically updated
    retry_count = 0
    frame_count = 0
    frame_skip_interval = YOLOV9_CONFIG["frame_skip_interval"]

    # Warm-up the model
    yolo_detector.warm_up()

    while True:
        try:
            log_event("Attempting to retrieve a frame from the camera...")

            # Fetch a frame from the camera
            frame = camera.get_frame()
            if frame is not None:
                print(f"Original frame dimensions: width={frame.shape[1]}, height={frame.shape[0]}")
            else:
                log_event("Received None frame from camera.")
                retry_count += 1
                if retry_count > 5:
                    log_event("Camera reconnection failed. Exiting thread.")
                    break
                time.sleep(2 ** retry_count)  # Exponential backoff
                continue

            retry_count = 0  # Reset retry count if a valid frame is received
            frame_count += 1

            # Skip frames based on the configured interval
            if frame_count % frame_skip_interval != 0:
                log_event(f"Skipping frame {frame_count} (not a target frame for analysis).")
                continue

            log_event("Processing frame for face detection...")
            try:
                # Detect faces
                detection_start = time.time()
                boxes, scores, fps = yolo_detector.detect_faces(frame)
                detection_end = time.time()
                detection_time = detection_end - detection_start
                log_event(f"Calculated FPS: {fps:.2f}")
                log_event(f"Detection time: {detection_time:.4f}s")

                # Save snapshot with overlays if faces are detected
                if boxes and scores:
                    log_event(f"Detected faces: {boxes}")
                    for box in boxes:
                        log_event(f"Bounding box coordinates: {box}")

                    frame_with_overlays = yolo_detector.draw_bounding_boxes(frame, boxes, scores)

                    # Save snapshot to the database using app context
                    with app.app_context():
                        save_snapshot(frame_with_overlays)
                else:
                    log_event("No bounding boxes detected.")
                    # Optionally save the frame without overlays
                    # with app.app_context():
                    #     save_snapshot(frame)

            except Exception as e:
                log_event(f"Error during face detection: {e}")
                continue

        except Exception as e:
            log_event(f"Error in camera processing thread: {e}")
            time.sleep(5)



def save_snapshot(frame_with_overlays):
    try:
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
        filename = f"static/snapshots/{timestamp}.jpg"
        cv2.imwrite(filename, frame_with_overlays)
        print(f"Snapshot successfully saved with overlays at {filename}")

        # Save to database within application context
        snapshot = Snapshot(image_path=filename, timestamp=datetime.datetime.utcnow())
        db.session.add(snapshot)
        db.session.commit()
    except Exception as e:
        print(f"Error saving snapshot: {e}")
        raise

def initialize_default_settings():
    defaults = {
        'camera_ip': '192.168.0.168',
        'camera_password': 'Bosch123!',
        'email_notifications': True,
        'match_threshold': 0.6,
        'snapshot_retention_days': 7,
        'smtp_server': 'smtp.example.com',
        'smtp_port': 587,
        'smtp_username': 'user@example.com',
        'smtp_password': 'securepassword'
    }
    for key, value in defaults.items():
        if not Settings.query.filter_by(key=key).first():
            db.session.add(Settings(key=key, value=str(value)))
    db.session.commit()


@app.route('/api/stream')
def video_feed():
    def generate():
        while True:
            frame = camera.get_frame()  # Assume this retrieves a frame from the camera
            _, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    """
    Dashboard data route: Collects status and metrics from the application.
    """
    try:
        camera_status = camera.cap.isOpened() if camera.cap else False
        last_snapshot = Snapshot.query.order_by(Snapshot.timestamp.desc()).first()
        blacklist_size = Blacklist.query.count()
        total_snapshots = Snapshot.query.count()
        data = {
            'camera_status': camera_status,
            'camera_ip': settings['camera_ip'],
            'last_snapshot_time': last_snapshot.timestamp.strftime('%Y-%m-%d %H:%M:%S') if last_snapshot else None,
            'last_snapshot_image': last_snapshot.image_path if last_snapshot else None,
            'last_notification_time': None,  # Placeholder for actual implementation
            'blacklist_size': blacklist_size,
            'total_snapshots': total_snapshots
        }
        return jsonify(data)
    except Exception as e:
        print(f"Error in /api/dashboard: {e}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    global settings, camera  # Access the global Camera instance

    if request.method == 'POST':
        data = request.json
        settings_updated = False

        for key, value in data.items():
            setting = Settings.query.filter_by(key=key).first()
            if setting:
                setting.value = value
            else:
                new_setting = Settings(key=key, value=value)
                db.session.add(new_setting)

            # Check if critical camera settings have changed
            if key in ['camera_ip', 'camera_password'] and settings.get(key) != value:
                settings_updated = True

        db.session.commit()

        # Reload settings into the global variable
        load_settings()

        # If camera settings changed, reconnect asynchronously
        if settings_updated:
            log_event("Reinitializing Camera in a separate thread...")
            def reconnect_camera():
                global camera
                try:
                    camera = Camera(settings['camera_ip'], settings['camera_password'])
                    camera.connect()  # Attempt to reconnect
                    log_event("Camera reconnected successfully.")
                except Exception as e:
                    log_event(f"Failed to reconnect camera: {e}")

            threading.Thread(target=reconnect_camera, daemon=True).start()

        return jsonify({'message': 'Settings updated'})

    else:
        return jsonify({s.key: s.value for s in Settings.query.all()})

@app.route('/api/<string:item_type>/paginated', methods=['GET'])
def get_paginated_items(item_type):
    """
    Unified route for fetching paginated snapshots or blacklist items.
    """
    if item_type not in ['snapshot', 'blacklist']:
        return jsonify({"error": "Invalid type"}), 400

    model = Snapshot if item_type == 'snapshot' else Blacklist

    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        sort_order = request.args.get('sort', 'desc')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = model.query

        # Handle date filters
        if start_date and end_date:
            start = datetime.datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.datetime.strptime(end_date, '%Y-%m-%d') + datetime.timedelta(days=1)
            query = query.filter(model.timestamp >= start, model.timestamp < end)

        # If no dates provided (All Time)
        if not start_date and not end_date:
            pass  # No filtering on dates for "All Time"

        # Sort order
        if sort_order == 'asc':
            query = query.order_by(model.timestamp.asc())
        else:
            query = query.order_by(model.timestamp.desc())

        # Pagination
        total_items = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()

        # Generate the response
        response_items = []
        for item in items:
            item_data = {
                'id': item.id,
                'image_path': item.image_path,
                'timestamp': item.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            }
            # Add 'name' field for blacklist items
            if item_type == 'blacklist':
                item_data['name'] = item.name
            response_items.append(item_data)

        return jsonify({
            'items': response_items,
            'total': total_items,
            'page': page,
            'pages': (total_items + limit - 1) // limit,
        })

    except Exception as e:
        print(f"Error in /api/{item_type}/paginated: {e}")
        return jsonify({"error": "An error occurred while processing the request."}), 500



@app.route('/api/<string:item_type>/<int:item_id>/download', methods=['GET'])
def download_item(item_type, item_id):
    """
    Unified route for downloading a snapshot or blacklist item.
    """
    if item_type not in ['snapshot', 'blacklist']:
        return jsonify({'message': 'Invalid type'}), 400

    model = Snapshot if item_type == 'snapshot' else Blacklist
    item = model.query.get(item_id)

    if not item:
        return jsonify({'message': f'{item_type.capitalize()} not found'}), 404

    directory = os.path.dirname(item.image_path)
    filename = os.path.basename(item.image_path)

    # Add download_name for better handling
    return send_from_directory(
        directory, filename, as_attachment=True, download_name=filename
    )





@app.route('/api/snapshots/stats', methods=['GET'])
def get_snapshot_stats():
    """
    Get snapshot statistics grouped by hour for a date range or all time.
    """
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # Query base
        query = db.session.query(
            db.func.strftime("%Y-%m-%d %H", Snapshot.timestamp).label("hour"),
            db.func.count(Snapshot.id).label("count")
        )

        # Handle date filters
        if start_date and end_date:
            start = datetime.datetime.strptime(start_date, '%Y-%m-%d')
            end = datetime.datetime.strptime(end_date, '%Y-%m-%d') + datetime.timedelta(days=1)
            query = query.filter(Snapshot.timestamp >= start, Snapshot.timestamp < end)
        elif start_date or end_date:
            # If only one date is provided, return an error
            return jsonify({"error": "Both start_date and end_date must be provided"}), 400
        # No date filtering for "All Time"

        # Group by hour
        stats = query.group_by("hour").all()

        # Format results
        stats_list = [{"hour": s[0], "count": s[1]} for s in stats]
        return jsonify(stats_list)

    except Exception as e:
        print(f"Error in /api/snapshots/stats: {e}")
        return jsonify({"error": "An error occurred while processing the request."}), 500




@app.route('/api/snapshot/<int:snapshot_id>/add_to_blacklist', methods=['POST'])
def add_to_blacklist(snapshot_id):
    """
    Adds a snapshot to the blacklist.
    """
    snapshot = Snapshot.query.get(snapshot_id)
    if not snapshot:
        return jsonify({'message': 'Snapshot not found'}), 404

    name = request.json.get('name', '')
    image_path = snapshot.image_path

    try:
        blacklist_dir = os.path.join(app.root_path, 'static', 'blacklist')
        os.makedirs(blacklist_dir, exist_ok=True)

        filename = os.path.basename(image_path)
        new_path = os.path.join(blacklist_dir, filename)
        shutil.copy(os.path.join(app.root_path, image_path), new_path)

        web_path = f"static/blacklist/{filename}"
        blacklist_entry = Blacklist(name=name, image_path=web_path, timestamp=snapshot.timestamp)
        db.session.add(blacklist_entry)
        db.session.commit()

        return jsonify({'message': 'Snapshot added to blacklist', 'blacklist_path': web_path})
    except Exception as e:
        print(f"Error in add_to_blacklist: {e}")
        return jsonify({'message': 'Internal Server Error'}), 500




@app.route('/api/<string:item_type>/<int:item_id>/remove', methods=['POST'])
def remove_item(item_type, item_id):
    """
    Unified route for removing blacklist items.
    """
    if item_type != 'blacklist':
        return jsonify({'message': 'Invalid type for removal'}), 400

    item = Blacklist.query.get(item_id)
    if not item:
        return jsonify({'message': 'Blacklist entry not found'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': f'{item_type.capitalize()} entry removed successfully.'})






@app.route('/static/<path:filename>')
def static_files(filename):
    # Serve the static file
    response = make_response(send_from_directory('static', filename))

    # Add the Ngrok-Skip-Browser-Warning header to bypass the interstitial
    response.headers['Ngrok-Skip-Browser-Warning'] = 'true'

    return response


@socketio.on('connect')
def handle_connect():
    print("Client connected")

def notify_snapshot_update(snapshot):
    """Notify clients of a new snapshot."""
    socketio.emit('snapshot_update', {
        'id': snapshot.id,
        'image_path': snapshot.image_path,
        'timestamp': snapshot.timestamp.strftime('%Y-%m-%d %H:%M:%S')
    })

@app.route('/api/<string:item_type>/<int:item_id>/email', methods=['POST'])
def email_item(item_type, item_id):
    """
    Unified route for emailing a snapshot or blacklist item.
    """
    if item_type not in ['snapshot', 'blacklist']:
        return jsonify({'message': 'Invalid type'}), 400

    model = Snapshot if item_type == 'snapshot' else Blacklist
    item = model.query.get(item_id)

    if not item:
        return jsonify({'message': f'{item_type.capitalize()} not found'}), 404

    try:
        # Fetch email settings
        settings = {s.key: s.value for s in Settings.query.all()}
        smtp_server = settings.get('smtp_server')
        smtp_port = settings.get('smtp_port')
        smtp_username = settings.get('smtp_username')
        smtp_password = settings.get('smtp_password')

        # Ensure SMTP settings are configured
        if not (smtp_server and smtp_port and smtp_username and smtp_password):
            return jsonify({'message': 'SMTP settings are not configured properly.'}), 500

        # Extract recipient email from the request
        data = request.json
        recipient_email = data.get('email')
        if not recipient_email:
            return jsonify({'message': 'Recipient email is required.'}), 400

        # Prepare the email
        subject = f"{item_type.capitalize()} Item"
        body = f"Please find the attached {item_type} item."
        msg = MIMEMultipart()
        msg['From'] = smtp_username
        msg['To'] = recipient_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        # Attach the item file
        attachment_path = os.path.join(app.root_path, item.image_path)
        if os.path.exists(attachment_path):
            with open(attachment_path, 'rb') as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
                encoders.encode_base64(part)
                part.add_header(
                    'Content-Disposition',
                    f'attachment; filename={os.path.basename(attachment_path)}'
                )
                msg.attach(part)
        else:
            return jsonify({'message': f'{item_type.capitalize()} file not found on server.'}), 404

        # Send the email
        with smtplib.SMTP(smtp_server, int(smtp_port)) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_username, recipient_email, msg.as_string())

        return jsonify({'message': f'Email sent to {recipient_email} successfully.'})

    except Exception as e:
        print(f"Error in /email_item: {e}")
        return jsonify({'message': 'Failed to send email.', 'error': str(e)}), 500



# Confirm thread starts in __main__
if __name__ == '__main__':
    setup_database()

    # Load settings into global variable
    load_settings()

    # Initialize the camera after loading settings
    global camera
    camera = Camera(settings['camera_ip'], settings['camera_password'])

    # Print all registered routes
    print("Registered routes:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.endpoint}: {rule}")

    # Create threads with app context
    with app.app_context():
        print("Starting cleanup thread...")
        threading.Thread(target=start_cleanup_thread, args=(settings['snapshot_retention_days'],), daemon=True).start()

        print("Starting camera processing thread...")
        threading.Thread(target=camera_processing_thread, daemon=True).start()

    app.run(debug=True, use_reloader=False)


