import cv2
import numpy as np

def analyze_road_network():
    # Load the map image
    img = cv2.imread('new_parking_map.png')
    if img is None:
        print("Error: Could not load new_parking_map.png")
        return

    h, w = img.shape[:2]
    print(f"Image Dimensions: {w}x{h}")

    # Convert to HSV to find 'grey' areas (low saturation, medium-to-high value)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Grey/White Road Definition based on samples:
    # Sample 1: H=66, S=47, V=241 (Feeder)
    # Sample 2: H=65, S=6,  V=248 (Aisle)
    
    # We want High Value (Brightness) and Low-to-Mid Saturation
    lower_grey = np.array([0, 0, 180])   # Allow any hue, low saturation, high brightness
    upper_grey = np.array([180, 60, 255]) # Saturation up to 60 to catch that light green feeder
    
    mask = cv2.inRange(hsv, lower_grey, upper_grey)
    
    # Morphological Clean Up (Close gaps)
    kernel = np.ones((5,5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    
    cv2.imwrite('debug_road_mask.png', mask)
    print("Saved 'debug_road_mask.png'. Check this to verify we found the road.")

    # 1. FIND HORIZONTAL AISLES (Scan Y-axis)
    # We sum the mask along the X-axis (rows)
    # Rows with HIGH sum are roads. Low sum are parking blocks/grass.
    row_sums = np.sum(mask, axis=1)
    
    # Aisle Threshold: A row must be at least 60% road to be considered a 'driving aisle'
    # (Avoiding short grey patches)
    width_threshold = w * 255 * 0.6 
    
    val_rows = np.where(row_sums > width_threshold)[0]
    
    # Group consecutive rows into "Aisles"
    aisles = []
    if len(val_rows) > 0:
        current_start = val_rows[0]
        prev = val_rows[0]
        
        for r in val_rows[1:]:
            if r > prev + 5: # Gap detected (new aisle)
                center = (current_start + prev) // 2
                aisles.append(center)
                current_start = r
            prev = r
        # Add last
        center = (current_start + prev) // 2
        aisles.append(center)
    
    print("\n--- Horizontal Aisles (Y-Coordinates) ---")
    valid_y_percents = []
    for y in aisles:
        pct = (y / h) * 100
        valid_y_percents.append(round(pct, 2))
        print(f"Y Pixel: {y}  ->  {pct:.2f}%")
        
        # Sample color at this center
        b, g, r = img[y, w//2] # Sample middle of image
        print(f"  Color at center: RGB({r},{g},{b}) Hex: #{r:02x}{g:02x}{b:02x}")

    # 2. FIND VERTICAL FEEDER ROAD (Scan X-axis)
    # We look specifically on the RIGHT side (e.g., last 20% of width)
    # Sum mask along Y-axis (cols)
    right_side_mask = mask[:, int(w*0.8):]
    col_sums = np.sum(right_side_mask, axis=0) # Sum down columns
    
    # Feeder Threshold: Column must be > 80% road height
    height_threshold = h * 255 * 0.8
    val_cols = np.where(col_sums > height_threshold)[0]
    
    feeder_x_pct = None
    if len(val_cols) > 0:
        # These cols are relative to the 0.8 crop
        global_cols = val_cols + int(w*0.8)
        
        # Find center of this vertical band
        center_col = int(np.mean(global_cols))
        feeder_x_pct = (center_col / w) * 100
        print(f"\n--- Vertical Feeder Road (X-Coordinate) ---")
        print(f"X Pixel: {center_col} -> {feeder_x_pct:.2f}%")
    else:
        print("\nCould not detect main vertical feeder road on the right.")

if __name__ == "__main__":
    analyze_road_network()
