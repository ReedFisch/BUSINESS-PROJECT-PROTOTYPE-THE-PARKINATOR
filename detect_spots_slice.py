import cv2
import numpy as np
import json
import os
import traceback

def check_and_create_spot(cx, cy, w_px, h_px, img_w, img_h, mask_pink):
    left_pct = round((cx / img_w) * 100, 2)
    top_pct = round((cy / img_h) * 100, 2)
    width_pct = round((w_px / img_w) * 100, 2)
    height_pct = round((h_px / img_h) * 100, 2)
    
    cy_int = int(min(max(cy, 0), img_h-1))
    cx_int = int(min(max(cx, 0), img_w-1))
    is_pink = mask_pink[cy_int, cx_int] > 0
    spot_type = "disability" if is_pink else "regular"
    
    return {
        "cx": cx, "cy": cy, 
        "left": left_pct, "top": top_pct, 
        "width": width_pct, "height": height_pct,
        "type": spot_type
    }

def detect_spots_by_slicing():
    image_path = '/Users/reedfisch/.gemini/antigravity/brain/c757bc7b-f778-44ff-b2bc-52a8552e32b2/uploaded_image_1768234066250.jpg'
    image = cv2.imread(image_path)
    if image is None:
        print(f"Error: Could not load image at {image_path}")
        return

    h, w = image.shape[:2]
    
    # HSV Conversion & Masking
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Broad ranges
    lower_cyan = np.array([40, 40, 40])
    upper_cyan = np.array([120, 255, 255]) 
    lower_pink = np.array([125, 40, 40])
    upper_pink = np.array([179, 255, 255])
    
    mask_cyan = cv2.inRange(hsv, lower_cyan, upper_cyan)
    mask_pink = cv2.inRange(hsv, lower_pink, upper_pink)
    
    # Combine
    mask_all = cv2.bitwise_or(mask_cyan, mask_pink)
    
    # Clean up
    kernel = np.ones((3,3), np.uint8)
    mask_all = cv2.morphologyEx(mask_all, cv2.MORPH_OPEN, kernel, iterations=1)
    mask_all = cv2.morphologyEx(mask_all, cv2.MORPH_CLOSE, kernel, iterations=1)
    
    contours, _ = cv2.findContours(mask_all, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    raw_spots = [] # New collection
    debug_image = image.copy()
    
    avg_spot_width = 23 # Tuned previous value
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 50: continue
            
        x, y, bw, bh = cv2.boundingRect(cnt)
        
        # Check if wide row
        if bw > 35: 
            # Slice it!
            num_spots = round(bw / avg_spot_width)
            if num_spots < 1: num_spots = 1
            step = bw / num_spots
            
            # Simple slicing based on bounding rect
            for i in range(num_spots):
                # Define slice boundaries in global coords
                slice_x_start = int(x + (step * i))
                slice_x_end = int(slice_x_start + step)
                
                # Center of this slice
                cx = slice_x_start + step/2
                cy = y + bh/2
                
                # Refine with moments if needed, but bounding box center is often safer for slices
                # Let's use mask moments inside the slice for precision
                slice_mask = mask_all[y:y+bh, slice_x_start:slice_x_end]
                M = cv2.moments(slice_mask)
                if M["m00"] != 0:
                    cx_local = M["m10"] / M["m00"]
                    cy_local = M["m01"] / M["m00"]
                    cx = slice_x_start + cx_local
                    cy = y + cy_local
                
                raw_spots.append({
                    "cx": cx, "cy": cy, "x": slice_x_start, "y": y, "w": step, "h": bh
                })
        
        else:
            # Single spot
            M = cv2.moments(cnt)
            if M["m00"] == 0:
                cx = x + bw/2
                cy = y + bh/2
            else:
                cx = M["m10"] / M["m00"]
                cy = M["m01"] / M["m00"]
            
            raw_spots.append({
                "cx": cx, "cy": cy, "x": x, "y": y, "w": bw, "h": bh
            })

    # Analyze Heights
    estimated_single_h = 50
    final_spots_list = []
    
    print(f"Total raw spots processed: {len(raw_spots)}")

    for s in raw_spots:
        h = s['h']
        
        # Filter false positives (large vertical strips)
        if h > 200:
            print(f"Ignored large spot: h={h} at x={s['x']}, y={s['y']}")
            continue

        num_v = round(h / estimated_single_h)
        
        if num_v > 1:
            # Split Vertically
            step_y = h / num_v
            
            for i in range(num_v):
                # Calculate center for this vertical segment
                # y is the top of the bounding box/slice
                cy_segment = s['y'] + (step_y * i) + (step_y / 2)
                
                # Check type at this specific center
                spot = check_and_create_spot(s['cx'], cy_segment, s['w'], step_y, w, image.shape[0], mask_pink)
                final_spots_list.append(spot)
                
                # Debug
                cv2.circle(debug_image, (int(s['cx']), int(cy_segment)), 3, (0, 0, 255), -1)
        else:
            # Single
            spot = check_and_create_spot(s['cx'], s['cy'], s['w'], s['h'], w, image.shape[0], mask_pink)
            final_spots_list.append(spot)
            cv2.circle(debug_image, (int(s['cx']), int(s['cy'])), 3, (0, 255, 0), -1)

        # DEBUG VISUALIZATION
        # Draw the raw bounding box
        cv2.rectangle(debug_image, (int(s['x']), int(s['y'])), (int(s['x'] + s['w']), int(s['y'] + s['h'])), (255, 0, 0), 1)
        # Label with num_v
        cv2.putText(debug_image, f"v:{num_v}", (int(s['x']), int(s['y'])-5), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 255), 1)

    spots = final_spots_list
    print(f"Total final spots: {len(spots)}")
    
    # Sort & Save
    try:
        spots.sort(key=lambda s: s['cy'])
        
        rows = []
        if spots:
            current_row = [spots[0]]
            for spot in spots[1:]:
                # Tweak row sensitivity if needed
                if abs(spot['cy'] - current_row[-1]['cy']) < 25: 
                    current_row.append(spot)
                else:
                    rows.append(current_row)
                    current_row = [spot]
            rows.append(current_row)
        
        final_spots = []
        row_labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        
        for i, row in enumerate(rows):
            label = row_labels[i] if i < len(row_labels) else f"R{i}"
            row.sort(key=lambda s: s['cx'])
            for j, spot in enumerate(row):
                # Filter out right-side false positives
                if spot['left'] > 80.0: continue
                
                # Filter out ALL bottom row false positives
                if spot['top'] > 60.0: continue

                # Filter out top row false positives (ONLY top row) - REVERTED
                # if spot['top'] < 12.0: continue

                spot_id = f"{label}{j+1}"
                final_spots.append({
                    "id": spot_id,
                    "left": spot['left'],
                    "top": spot['top'],
                    "width": spot['width'],
                    "height": spot['height'],
                    "type": spot['type']
                })
                # VISUALIZATION
                cv2.putText(debug_image, spot_id, (int(spot['cx']), int(spot['cy'])), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        cv2.imwrite('debug_sliced_detection.png', debug_image)
        
        with open('detected_spots_box.js', 'w') as f:
            f.write("const spotDefinitions = " + json.dumps(final_spots, indent=4) + ";")
            
        print(f"Detected {len(final_spots)} spots.")

    except Exception as e:
        print(f"CRASH: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    detect_spots_by_slicing()
