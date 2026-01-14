import cv2
import numpy as np
import json
import os

def detect_spots_by_box():
    # Path to the guide image
    image_path = '/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768234066250.jpg'
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    # Load image
    image = cv2.imread(image_path)
    h, w = image.shape[:2]
    
    # Convert to HSV
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Define ranges based on analysis - CRITICALLY WIDENED
    # Cyan: Realized it might be green-cyan (around 80?) or blue-cyan.
    # Widen massively: 40 (Green) to 110 (Blue).
    lower_cyan = np.array([40, 40, 40])
    upper_cyan = np.array([120, 255, 255]) # Overlap slightly safe
    
    # Pink: Widen to 120-175.
    lower_pink = np.array([125, 40, 40])
    upper_pink = np.array([179, 255, 255]) # Go to max hue
    
    # Create masks
    mask_cyan = cv2.inRange(hsv, lower_cyan, upper_cyan)
    mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)
    
    cv2.imwrite('debug_mask_cyan.png', mask_cyan)
    cv2.imwrite('debug_mask_pink.png', mask_pink)
    
    # Combine masks to find all spots
    mask_all = cv2.bitwise_or(mask_cyan, mask_pink)
    cv2.imwrite('debug_mask_all.png', mask_all)
    
    # Strategy: Erode aggressively until we have distinct spots.
    # We expect roughly 135 spots.
    # Let's try iterating erosion until we hit a good number? 
    # Or just pick a high number.
    
    kernel = np.ones((3,3), np.uint8)
    
    # Try successive erosion
    current_mask = mask_all.copy()
    spots_found = []
    
    # Erode until we get a good count or it disappears
    for i in range(15): # Try up to 15 iterations
        # Check current contours
        contours, _ = cv2.findContours(current_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter tiny noise
        valid_contours = [c for c in contours if cv2.contourArea(c) > 5]
        count = len(valid_contours)
        print(f"Iteration {i}: {count} spots")
        
        if count >= 135:
            # We separated them enough!
            break
            
        current_mask = cv2.erode(current_mask, kernel, iterations=1)
    else:
        print("Warning: Could not separate into 135 spots. Using last result.")

    # Now use these eroded centroids as the true centers
    # But wait, erosion shrinks the spot. The center *should* remain roughly the same if shape is symmetric.
    # However, if we eroded too much, we might have lost some.
    # Let's verify we didn't lose too many.
    
    # Process valid contours
    contours, _ = cv2.findContours(current_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    spots = []
    debug_image = image.copy()
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 5: continue
            
        # Get moments for centroid
        M = cv2.moments(cnt)
        if M["m00"] == 0: continue
        
        cx = M["m10"] / M["m00"]
        cy = M["m01"] / M["m00"]
        
        # Calculate percentages
        left_pct = round((cx / w) * 100, 2)
        top_pct = round((cy / h) * 100, 2)
        
        # Determine Color from original mask at this location
        cx_int = int(min(max(cx, 0), w-1))
        cy_int = int(min(max(cy, 0), h-1))
        
        # Check original masks to determine type (since current_mask is just shape)
        is_pink = mask_pink[cy_int, cx_int] > 0
        spot_type = "disability" if is_pink else "regular"
        
        # Since we are using eroded shape, the bounding box size 'w' and 'h' are useless for the final spot size.
        # But we don't need them for the app coordinates? Currently app uses just left/top.
        # Wait, previous script saved 'w' and 'h' in spots, but app looks like it ignores it?
        # App uses CSS width: 12px; height: 12px;
        # So we just need center.
        
        spots.append({
            "left": left_pct,
            "top": top_pct,
            "type": spot_type,
            "cx": cx,
            "cy": cy
        })
        
        color = (0, 0, 255) if spot_type == "regular" else (255, 0, 255)
        # Draw small circle at center
        cv2.circle(debug_image, (int(cx), int(cy)), 3, (0, 255, 0), -1)

    # Sort spots to assign IDs
    # Sort by Y first (rows) then X
    # We need robust row detection
    spots.sort(key=lambda s: s['cy'])
    
    rows = []
    if spots:
        current_row = [spots[0]]
        for spot in spots[1:]:
            if abs(spot['cy'] - current_row[-1]['cy']) < 25: # Row threshold
                current_row.append(spot)
            else:
                rows.append(current_row)
                current_row = [spot]
        rows.append(current_row)
    
    final_spots = []
    # Row naming logic
    # Looking at the map, there are specific block names A, B, C, D, E
    # My simple A, B, C... might not match the user's specific IDs (A1...A20 etc)
    # But previously I just assigned them sequentially.
    # The user didn't complain about IDs, just alignment.
    
    row_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    
    for i, row in enumerate(rows):
        label = row_labels[i] if i < len(row_labels) else f"R{i}"
        row.sort(key=lambda s: s['cx'])
        for j, spot in enumerate(row):
            spot_id = f"{label}{j+1}"
            final_spots.append({
                "id": spot_id,
                "left": spot['left'],
                "top": spot['top'],
                "type": spot['type']
            })
            cv2.putText(debug_image, spot_id, (int(spot['cx'])-10, int(spot['cy'])), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
    # Sort by Y first (with tolerance for rows), then X
    # Group into rows
    rows = []
    sorted_by_y = sorted(spots, key=lambda s: s['cy'])
    
    if not sorted_by_y:
        print("No spots found!")
        return

    current_row = [sorted_by_y[0]]
    row_y_threshold = 30 # px tolerance for same row
    
    for spot in sorted_by_y[1:]:
        if abs(spot['cy'] - current_row[-1]['cy']) < row_y_threshold:
            current_row.append(spot)
        else:
            rows.append(current_row)
            current_row = [spot]
    rows.append(current_row)
    
    final_spots = []
    row_labels = ['A', 'B', 'C', 'D', 'E', 'F']
    
    print(f"Detected {len(rows)} rows.")
    
    for i, row in enumerate(rows):
        if i >= len(row_labels): break
        label = row_labels[i]
        
        # Sort row by X
        row.sort(key=lambda s: s['cx'])
        
        for j, spot in enumerate(row):
            spot_id = f"{label}{j+1}"
            final_spots.append({
                "id": spot_id,
                "left": spot['left'],
                "top": spot['top'],
                "type": spot['type']
            })
            
            # Label on debug image
            cv2.putText(debug_image, spot_id, (int(spot['cx'])-10, int(spot['cy'])), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

    # Save output
    cv2.imwrite('debug_box_detection.png', debug_image)
    
    with open('detected_spots_box.js', 'w') as f:
        f.write("const spotDefinitions = " + json.dumps(final_spots, indent=4) + ";")
        
    print(f"Successfully detected {len(final_spots)} spots.")

detect_spots_by_box()
