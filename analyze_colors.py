import cv2
import numpy as np
from collections import Counter

def analyze_colors():
    image_path = '/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768234066250.jpg'
    image = cv2.imread(image_path)
    
    if image is None:
        print("Image not found")
        return

    # Convert to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Reshape to a list of pixels
    pixels = image_rgb.reshape(-1, 3)
    
    # Count unique colors (this might be too many, so maybe quantize first)
    # Let's try to find common colors in HSV space to handle slight variations
    hsv_image = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Define ranges to check what we see
    # Cyan usually around H=90 (OpenCV H is 0-180, so cyan is ~90/2 = 45? No, Cyan is 180 degrees -> 90 in opencv)
    # Magenta/Pink usually around H=150
    
    # Let's dump the unique H values with high saturation > 100
    pixels_hsv = hsv_image.reshape(-1, 3)
    
    # Filter for saturated pixels only to find the boxes
    saturated_mask = pixels_hsv[:, 1] > 100
    saturated_pixels = pixels_hsv[saturated_mask]
    
    if len(saturated_pixels) == 0:
        print("No saturated pixels found")
        return

    # Count Hue values
    h_counts = Counter(saturated_pixels[:, 0])
    
    print("Most common saturated Hues (Top 20):")
    for h, count in h_counts.most_common(20):
        print(f"Hue: {h}, Count: {count}")

    # Also check average stats for Cyan-ish and Pink-ish areas
    # Cyan approx Hue range: 85-95
    cyan_mask = cv2.inRange(hsv_image, np.array([80, 100, 100]), np.array([100, 255, 255]))
    cyan_pixels = image_rgb[cyan_mask > 0]
    if len(cyan_pixels) > 0:
        print(f"Cyan Pixel Count: {len(cyan_pixels)}")
        print(f"Avg Cyan RGB: {np.mean(cyan_pixels, axis=0)}")
    
    # Pink approx Hue range: 145-165
    pink_mask = cv2.inRange(hsv_image, np.array([140, 100, 100]), np.array([170, 255, 255]))
    pink_pixels = image_rgb[pink_mask > 0]
    if len(pink_pixels) > 0:
        print(f"Pink Pixel Count: {len(pink_pixels)}")
        print(f"Avg Pink RGB: {np.mean(pink_pixels, axis=0)}")

analyze_colors()
