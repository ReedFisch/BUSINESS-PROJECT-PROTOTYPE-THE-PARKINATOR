import cv2
import numpy as np
import json
import os

def find_orange_spots():
    # Path to the guide image with orange dots
    image_path = '/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768234066250.jpg'
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    img = cv2.imread(image_path)
    if img is None:
        print("Error: Could not read image")
        return

    h, w = img.shape[:2]

    # Convert to HSV
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Define Orange color range
    # Orange is roughly 10-25 Hue in OpenCV (0-180 scale)
    lower_orange = np.array([5, 150, 150])
    upper_orange = np.array([25, 255, 255])
    
    mask = cv2.inRange(hsv, lower_orange, upper_orange)

    # Morphological operations to clean up spots
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.erode(mask, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    spots = []
    
    for c in contours:
        area = cv2.contourArea(c)
        if area < 20: # Filter noise
            continue
            
        M = cv2.moments(c)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            
            # Convert to percentages
            nx = (cx / w) * 100
            ny = (cy / h) * 100
            
            # Determine type based on row or location if needed, 
            # but for now we'll defaults to 'regular' and let JS handle overrides if any.
            # Actually, the guide image has pink rectangles for disability, but the dots are all orange?
            # Let's assume the user wants the dots to define location. 
            # We can detect spot type by checking the color of the *map* at that location if needed,
            # but for simplicity, let's stick to the dots.
            
            spots.append({
                'cx': cx,
                'cy': cy,
                'left': round(nx, 2),
                'top': round(ny, 2),
                'type': 'regular' # Default, logic can interpret or we can refine
            })

    # Sort spots into rows
    spots.sort(key=lambda s: s['cy'])
    
    rows = []
    current_row = []
    last_y = -100

    for s in spots:
        if not current_row:
            current_row.append(s)
            last_y = s['cy']
        else:
            if abs(s['cy'] - last_y) < (h * 0.05): # Same row threshold
                current_row.append(s)
            else:
                rows.append(current_row)
                current_row = [s]
                last_y = s['cy']
    if current_row:
        rows.append(current_row)

    final_definitions = []
    row_labels = ['A', 'B', 'D', 'C', 'E'] # Visually, top is A, B, then maybe D? 
    # Wait, previous was A, B, C (bottom left), D (middle right), E (bottom right)?
    # Let's look at the image.
    # Top block: 2 rows (A, B)
    # Middle block: 2 rows (C, D?) 
    # Bottom block: Left is Cyan, Right is Pink.
    
    # Actually, simpler labeling:
    # Row 1 (Top)
    # Row 2
    # Row 3 (Middle Top)
    # Row 4 (Middle Bottom)
    # Row 5 (Bottom) - This one is mixed.
    
    # Renaming strategy: Just sequential A-E for the visual rows.
    # Let's clean up the sorting.
    
    label_idx = 0
    possible_labels = 'ABCDEFGH'
    
    for row in rows:
        row.sort(key=lambda s: s['cx'])
        
        # Determine label. 
        # If we have 5 visual rows, we assign A, B, C, D, E.
        
        label = possible_labels[label_idx]
        
        for i, s in enumerate(row):
            # Check for disability spots (Pink background check in original image?)
            # Or just hardcode the logic for Row E (User said "orange spots" for locating).
            # The bottom row has pink spots. 
            # We can check the color at (cx, cy) in the guide image?
            # The guide image has colored rectangles.
            
            # Sample color at spot center to check for Pink (Disability)
            # Magenta Hue is around 150.
            
            spot_color = hsv[s['cy'], s['cx']]
            # Hue is spot_color[0]
            if 140 < spot_color[0] < 170:
                s_type = 'disability'
            else:
                s_type = 'regular'

            def_obj = {
                'id': f"{label}{i + 1}",
                'left': s['left'],
                'top': s['top'],
                'type': s_type
            }
            final_definitions.append(def_obj)
        
        label_idx += 1

    print(json.dumps(final_definitions, indent=4))

if __name__ == "__main__":
    find_orange_spots()
