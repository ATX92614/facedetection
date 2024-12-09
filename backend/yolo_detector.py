import torch
import cv2
import numpy as np
from torchvision.ops import nms
import time

def letterbox(img, new_shape=640, color=(114, 114, 114)):
    # Resize and pad image while keeping aspect ratio
    shape = img.shape[:2]  # current shape [height, width]
    if isinstance(new_shape, int):
        new_shape = (new_shape, new_shape)
    # Scale ratio (new / old)
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    # Compute padding
    ratio = (r, r)  # width, height ratios
    new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]  # width, height
    dw /= 2  # divide padding into 2 sides
    dh /= 2
    # Resize image
    img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
    # Pad image
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return img, ratio, (dw, dh)

class YOLOv9FaceDetector:
    def __init__(self, weights_path, device="cpu", conf_threshold=0.5, nms_threshold=0.4, face_class_id=0, input_size=640):
        self.device = torch.device(device if torch.cuda.is_available() else "cpu")
        try:
            self.model = torch.load(weights_path, map_location=self.device)["model"].float()
        except KeyError:
            self.model = torch.load(weights_path, map_location=self.device).float()
        self.model.to(self.device).eval()
        if self.device.type == 'cuda':
            self.model.half()
            print("Model converted to half precision.")

        self.conf_threshold = conf_threshold
        self.nms_threshold = nms_threshold
        self.face_class_id = face_class_id
        self.input_size = input_size  # Now an integer
        self.last_time = time.time()



    def warm_up(self):
        start_time = time.time()
        dummy_input = torch.zeros((1, 3, self.input_size, self.input_size), device=self.device)
        if self.device.type == 'cuda':
            dummy_input = dummy_input.half()
        with torch.no_grad():
            _ = self.model(dummy_input)
        elapsed_time = time.time() - start_time
        print(f"Model warm-up completed in {elapsed_time:.4f} seconds.")


    def detect_faces(self, frame):
        start_time = time.time()
        if frame is None or not isinstance(frame, np.ndarray):
            raise ValueError("Invalid frame: Ensure the input is a valid NumPy array.")

        # Preprocess frame
        preprocess_start = time.time()
        height0, width0 = frame.shape[:2]  # Original image dimensions
        img, ratio, (dw, dh) = letterbox(frame, self.input_size)
        # Convert to RGB
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = img.transpose(2, 0, 1)  # Change shape to [C, H, W]
        img = np.ascontiguousarray(img)
        img = torch.from_numpy(img).to(self.device)
        img = img.float() / 255.0  # Normalize to [0, 1]

        if self.device.type == 'cuda':
            img = img.half()  # Convert to half precision if model is half

        img = img.unsqueeze(0)  # Add batch dimension
        preprocess_end = time.time()
        preprocess_time = preprocess_end - preprocess_start

        # Run model inference
        inference_start = time.time()
        with torch.no_grad():
            predictions = self.model(img)
        inference_end = time.time()
        inference_time = inference_end - inference_start

        # Post-processing
        postprocess_start = time.time()
        # Extract the output tensor from predictions
        output_tensor = predictions[0][0]  # Adjust based on your model's output structure

        # Remove batch dimension
        output_tensor = output_tensor.squeeze(0)  # Shape: [5, N]

        # Transpose to get predictions in [N, 5]
        output_tensor = output_tensor.T  # Shape: [N, 5]

        boxes = []
        confidences = []

        for pred in output_tensor:
            x_center, y_center, width_box, height_box, confidence = pred[:5]
            if confidence > self.conf_threshold:
                x1 = x_center - width_box / 2
                y1 = y_center - height_box / 2
                x2 = x_center + width_box / 2
                y2 = y_center + height_box / 2

                # Undo the letterbox and scaling
                x1 = (x1 - dw) / ratio[0]
                y1 = (y1 - dh) / ratio[1]
                x2 = (x2 - dw) / ratio[0]
                y2 = (y2 - dh) / ratio[1]

                boxes.append([x1.item(), y1.item(), x2.item(), y2.item()])
                confidences.append(confidence.item())

        # Perform Non-Max Suppression (NMS)
        if len(boxes) > 0:
            boxes = torch.tensor(boxes, dtype=torch.float32)
            confidences = torch.tensor(confidences, dtype=torch.float32)
            indices = nms(boxes, confidences, self.nms_threshold)
            boxes = boxes[indices].tolist()
            confidences = confidences[indices].tolist()
        else:
            print("No detections above confidence threshold.")

        postprocess_end = time.time()
        postprocess_time = postprocess_end - postprocess_start

        total_time = time.time() - start_time

        fps = 1 / total_time
        print(f"Preprocessing time: {preprocess_time:.4f}s")
        print(f"Inference time: {inference_time:.4f}s")
        print(f"Post-processing time: {postprocess_time:.4f}s")
        print(f"Total detection time: {total_time:.4f}s")
        print(f"Calculated FPS: {fps:.2f}")

        return boxes, confidences, fps

    def draw_bounding_boxes(self, frame, boxes, scores):
        # Make a copy of the frame to draw overlays
        frame_with_overlays = frame.copy()
        height, width, _ = frame_with_overlays.shape

        for i, (x1, y1, x2, y2) in enumerate(boxes):
            # Ensure bounding boxes are within frame dimensions
            x1 = max(0, min(int(x1), width - 1))
            y1 = max(0, min(int(y1), height - 1))
            x2 = max(0, min(int(x2), width - 1))
            y2 = max(0, min(int(y2), height - 1))

            # Draw the bounding box
            cv2.rectangle(frame_with_overlays, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame_with_overlays, f"Score: {scores[i]:.2f}", (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        return frame_with_overlays
