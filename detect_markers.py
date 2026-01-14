import cv2
import numpy as np
import json
import os

# --- Configuration ---
image_path = "/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768318587492.png"

def detect_markers():
    # 1. Load Image
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    image = cv2.imread(image_path)
    if image is None:
        print("Error: Could not read image.")
        return
    
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, w = image.shape[:2]
    print(f"Image Dimensions: {w}x{h}")
    
    # 2. Define Masks
    
    # BLACK DOTS (Foreground)
    # Very low value. The dots looked quite black.
    lower_black = np.array([0, 0, 0])
    upper_black = np.array([180, 255, 60]) # Increased V slightly to catch edges, but <50 was the analysis pivot
    mask_black = cv2.inRange(hsv, lower_black, upper_black)
    
    # CYAN (Regular Background)
    # Analysis said H ~ 80-100 (OpenCV scale)
    # Lower saturation to 20 to catch pastel/light cyan
    lower_cyan = np.array([75, 20, 50])
    upper_cyan = np.array([105, 255, 255])
    mask_cyan = cv2.inRange(hsv, lower_cyan, upper_cyan)
    
    # MAGENTA (Disability Background)
    # Analysis said H ~ 140-160
    lower_magenta = np.array([135, 20, 50])
    upper_magenta = np.array([165, 255, 255])
    mask_magenta = cv2.inRange(hsv, lower_magenta, upper_magenta)
    
    # 3. Find Dot Contours
    contours, _ = cv2.findContours(mask_black, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    print(f"Total Black Contours found: {len(contours)}")
    
    debug_img = image.copy()
    valid_spots = []
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 5: continue # Ignore single pixel noise
        
        # Get purely the center point
        M = cv2.moments(cnt)
        if M["m00"] == 0: continue
        cx = int(M["m10"] / M["m00"])
        cy = int(M["m01"] / M["m00"])
        
        # 4. Context Check (What color is UNDER/AROUND the dot?)
        # We check a small radius around the dot in the background masks
        # because the dot itself is black.
        
        check_radius = 6 # Look slightly outside the dot center
        
        # ROI for check
        x1 = max(0, cx - check_radius)
        y1 = max(0, cy - check_radius)
        # Check a ring around the dot to ensure it is surrounded by the correct color
        # Inner radius should clear the dot itself, outer radius checks the surroundings
        inner_radius = 6
        outer_radius = 12
        
        mask = np.zeros(mask_black.shape, dtype=np.uint8) # Use the shape of one of the existing masks
        cv2.circle(mask, (cx, cy), outer_radius, 255, -1)
        cv2.circle(mask, (cx, cy), inner_radius, 0, -1)

        # verify that a significant portion of the ring is the expected color
        cyan_pixels = cv2.countNonZero(cv2.bitwise_and(mask_cyan, mask_cyan, mask=mask))
        magenta_pixels = cv2.countNonZero(cv2.bitwise_and(mask_magenta, mask_magenta, mask=mask))
        
        # Calculate the total area of the ring
        ring_area = np.pi * (outer_radius**2 - inner_radius**2)
        match_threshold = 0.4 * ring_area  # Require 40% of the ring to match

        is_cyan = cyan_pixels > match_threshold
        is_magenta = magenta_pixels > match_threshold
        
        spot_type = None
        if is_magenta:
            spot_type = 'disability'
        elif is_cyan:
            # If both (unlikely), allow magenta to override (safety) or prioritized check logic
            spot_type = 'regular'
            
        if spot_type:
            valid_spots.append({
                "cx": cx,
                "cy": cy,
                "type": spot_type
            })
            
            # Debug Drawing
            color = (0, 255, 0) if spot_type == 'regular' else (255, 0, 0) # Green for reg, Blue for dis
            cv2.circle(debug_img, (cx, cy), 3, color, -1)
            # Draw ring to confirm "found"
            cv2.circle(debug_img, (cx, cy), 6, (0,0,255), 1)
        else:
            print(f"Rejected Dot at ({cx}, {cy}) - No Cyan/Magenta in radius")
            cv2.circle(debug_img, (cx, cy), 5, (0, 0, 255), -1) # Red dot for rejected

    # 5. Sorting and Naming
    # Same logic: Sort by Y (rows), then X
    if not valid_spots:
        print("No valid spots found sitting on parking colors.")
        cv2.imwrite('debug_dot_markers.png', debug_img)
        return

    valid_spots.sort(key=lambda s: s['cy'])
    
    rows = []
    current_row = []
    last_y = valid_spots[0]['cy']
    
    for spot in valid_spots:
        if abs(spot['cy'] - last_y) > 20: # Row break threshold
            if current_row:
                # Sort row strictly by X
                current_row.sort(key=lambda s: s['cx'])
                rows.append(current_row)
            current_row = []
            last_y = spot['cy']
        current_row.append(spot)
    
    # Append last row
    if current_row:
        current_row.sort(key=lambda s: s['cx'])
        rows.append(current_row)
        
    final_spot_definitions = []
    row_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    
    for r_idx, row in enumerate(rows):
        label = row_labels[r_idx] if r_idx < len(row_labels) else f"R{r_idx}"
        for s_idx, spot in enumerate(row):
            spot_id = f"{label}{s_idx+1}"
            
            # Percentages
            left = (spot['cx'] / w) * 100
            top = (spot['cy'] / h) * 100
            
            # Assuming standard small dot size for now since we aren't detecting box borders
            # But the app might need width/height params to avoid breaking?
            # We'll set generic ones.
            
            final_spot_definitions.append({
                "id": spot_id,
                "left": round(left, 2),
                "top": round(top, 2),
                "width": 2.0, # Generic placeholder
                "height": 3.0, # Generic placeholder
                "type": spot['type']
            })
            
            cv2.putText(debug_img, spot_id, (spot['cx']-10, spot['cy']-10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1)

    print(f"Detected {len(final_spot_definitions)} validated spots.")
    
    # Output JS
    js_content = "const spotDefinitions = " + json.dumps(final_spot_definitions, indent=4) + ";"
    with open('detected_spots_box.js', 'w') as f:
        f.write(js_content)
        
    cv2.imwrite('debug_dot_markers.png', debug_img)
    print("Saved detected_spots_box.js and debug_dot_markers.png")

if __name__ == "__main__":
    detect_markers()
