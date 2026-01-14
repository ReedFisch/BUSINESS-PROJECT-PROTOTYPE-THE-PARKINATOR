import cv2
import numpy as np
from collections import Counter

def analyze_colors(image_path):
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        print("Error: Could not load image.")
        return

    # Convert to RGB (OpenCV is BGR)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Flatten to list of pixels
    pixels = img_rgb.reshape(-1, 3)
    
    # Define hsv_pixels (needed for masks)
    hsv_pixels = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).reshape(-1, 3)

    # 1. FIND BLACK DOTS
    # Filter for very dark pixels (V < 50)
    mask_black = hsv_pixels[:, 2] < 50
    black_pixels = pixels[mask_black]
    print(f"Black/Dark Pixels found: {len(black_pixels)}")
    
    # 2. FIND CYAN (Regular) - H ~ 90-100 (in OpenCV 0-179)? No, Cyan is 180 degrees -> 90 in OpenCV.
    # Actually Cyan #00FFFF is H=90.
    mask_cyan = (hsv_pixels[:, 0] > 80) & (hsv_pixels[:, 0] < 100) & (hsv_pixels[:, 1] > 50)
    cyan_pixels = pixels[mask_cyan]
    print(f"Cyan-ish Pixels found: {len(cyan_pixels)}")
    if len(cyan_pixels) > 0:
        print(f"Top Cyan: {Counter([f'#{p[0]:02x}{p[1]:02x}{p[2]:02x}' for p in cyan_pixels]).most_common(3)}")

    # 3. FIND MAGENTA (Disability) - H ~ 150 (300 degrees)
    mask_magenta = (hsv_pixels[:, 0] > 140) & (hsv_pixels[:, 0] < 160) & (hsv_pixels[:, 1] > 50)
    magenta_pixels = pixels[mask_magenta]
    print(f"Magenta-ish Pixels found: {len(magenta_pixels)}")
    if len(magenta_pixels) > 0:
        print(f"Top Magenta: {Counter([f'#{p[0]:02x}{p[1]:02x}{p[2]:02x}' for p in magenta_pixels]).most_common(3)}")

if __name__ == "__main__":
    # Use the new uploaded image path (latest)
    image_path = "/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768318587492.png"
    analyze_colors(image_path)
