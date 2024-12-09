import cv2
import threading
import logging
import time

# Configure logging
logging.basicConfig(
    filename='camera_debug.log',
    level=logging.DEBUG,  # Use DEBUG level for detailed logs
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

class Camera:
    def __init__(self, ip, password):
        self.ip = ip
        self.password = password
        self.cap = None
        self.lock = threading.Lock()

    def log_event(self, message, level="info"):
        """Log messages at the appropriate level."""
        if level == "debug":
            logging.debug(message)
        elif level == "warning":
            logging.warning(message)
        elif level == "error":
            logging.error(message)
        else:
            logging.info(message)
        print(message)

    def connect(self):
        """Connect to the camera stream."""
        stream_url = f"rtsp://service:{self.password}@{self.ip}/?inst=1"
        self.log_event(f"Attempting to connect to camera: {stream_url}", "debug")
        self.cap = cv2.VideoCapture(stream_url)

        # Check connection status
        if self.cap.isOpened():
            self.log_event("Camera connected successfully.", "info")
        else:
            self.log_event("Failed to connect to camera. Retrying...", "warning")

    def get_frame(self):
        """Retrieve a single frame from the camera."""
        with self.lock:
            # Ensure the camera is connected
            if self.cap is None or not self.cap.isOpened():
                self.log_event("Camera is not connected or stream is closed. Reconnecting...", "warning")
                self.connect()
            
            # Attempt to read a frame
            start_time = time.time()
            ret, frame = self.cap.read()
            elapsed_time = time.time() - start_time

            if not ret:
                self.log_event(f"Failed to capture frame. Elapsed time: {elapsed_time:.2f}s", "error")
                self.cap.release()
                self.connect()
                return None
            else:
                self.log_event(f"Frame captured successfully. Elapsed time: {elapsed_time:.2f}s", "debug")
                self.log_event(f"Frame dimensions: {frame.shape[1]}x{frame.shape[0]}", "debug")
            
            return frame

    def release(self):
        """Release the camera resource."""
        if self.cap is not None:
            self.log_event("Releasing camera resource...", "info")
            self.cap.release()

