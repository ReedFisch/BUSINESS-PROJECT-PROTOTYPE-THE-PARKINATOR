import cv2
import numpy as np

def sample_road_color():
    img = cv2.imread('new_parking_map.png')
    h, w = img.shape[:2]
    
    # Coordinates of expected road locations
    # 1. Top Aisle (Expected ~ Y=20)
    # 2. Feeder Road (Expected ~ X=980)
    
    samples = [
        (int(w*0.95), int(h*0.5)), # Feeder Road center-ish
        (int(w*0.5), int(h*0.03))  # Top Aisle center
    ]
    
    print("--- Sampling Colors ---")
    for x, y in samples:
        if x < w and y < h:
            b, g, r = img[y, x]
            print(f"Pixel ({x}, {y}): RGB({r}, {g}, {b}) Hex: #{r:02x}{g:02x}{b:02x}")
            
            # Convert to HSV
            pixel = np.uint8([[[b,g,r]]])
            hsv = cv2.cvtColor(pixel, cv2.COLOR_BGR2HSV)[0][0]
            print(f"  HSV: {hsv}")

if __name__ == "__main__":
    sample_road_color()
