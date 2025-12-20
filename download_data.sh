#!/bin/bash
echo "Downloading full LADOT Parking Meter Inventory..."
# Socrata API limit=50000 to ensure we get everything (approx 35-40k total)
curl "https://data.lacity.org/resource/s49e-q6j2.json?\$limit=50000" -o parking_database.json

echo "Download complete. Check parking_database.json size:"
ls -lh parking_database.json
