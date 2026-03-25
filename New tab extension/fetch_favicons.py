"""
Downloads favicons for bookmarks that don't have a Viral icon match,
upscales them to 128x128, and saves them to Viral icon pack/favicon/.
Then updates converted_backup.json to point to the local files.

Run: python fetch_favicons.py
Requires: pip install Pillow requests
"""

import json
import os
import requests
from urllib.parse import urlparse
from PIL import Image
from io import BytesIO

BASE_DIR = r"e:\0- Projects\New tab extension"
BACKUP_PATH = os.path.join(BASE_DIR, "converted_backup.json")
FAVICON_DIR = os.path.join(BASE_DIR, "Viral icon pack", "favicon")
TARGET_SIZE = 128
# Based on discovery, DDG placeholder is ~1478 bytes
PLACEHOLDER_THRESHOLD = 1500

# Ensure favicon output folder exists
os.makedirs(FAVICON_DIR, exist_ok=True)

def download_and_upscale(url, save_path):
    """Download a favicon, upscale to 128x128, save as PNG."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        if not hostname:
            return False
        
        ddg_url = f"https://icons.duckduckgo.com/ip3/{hostname}.ico"
        r = requests.get(ddg_url, timeout=10)
        if r.status_code != 200:
            return False
        
        # Check if it's DDG's default placeholder
        if len(r.content) < PLACEHOLDER_THRESHOLD:
            return False
        
        img = Image.open(BytesIO(r.content))
        img = img.convert("RGBA")
        
        # If ICO has multiple sizes, pick the largest
        if hasattr(img, 'n_frames') and img.n_frames > 1:
            best = img
            for i in range(img.n_frames):
                img.seek(i)
                if img.size[0] > best.size[0]:
                    best = img.copy()
            img = best

        # "Smart Scaling" logic:
        # If it's small, don't fill or stretch - just center it.
        w, h = img.size
        max_dim = max(w, h)
        
        # Create target 128x128 transparent canvas
        final_img = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), (0, 0, 0, 0))

        if max_dim < TARGET_SIZE:
            # Small icon: center at natural size without stretching
            left = (TARGET_SIZE - w) // 2
            top = (TARGET_SIZE - h) // 2
            final_img.paste(img, (left, top), img)
        else:
            # Large icon: fill 128x128 using "cover" logic
            aspect = w / h
            if aspect > 1: # Wide
                new_h = TARGET_SIZE
                new_w = int(TARGET_SIZE * aspect)
                left = (new_w - TARGET_SIZE) // 2
                top = 0
                right = left + TARGET_SIZE
                bottom = TARGET_SIZE
            else: # Tall or Square
                new_w = TARGET_SIZE
                new_h = int(TARGET_SIZE / aspect)
                left = 0
                top = (new_h - TARGET_SIZE) // 2
                right = TARGET_SIZE
                bottom = top + TARGET_SIZE

            img = img.resize((new_w, new_h), Image.LANCZOS)
            img = img.crop((left, top, right, bottom))
            final_img.paste(img, (0, 0), img)
        
        final_img.save(save_path, "PNG")
        return True
    except Exception as e:
        print(f"  ⚠ Failed to process {url}: {e}")
        return False

def main():
    if not os.path.exists(BACKUP_PATH):
        print(f"Error: {BACKUP_PATH} not found.")
        return

    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        backup = json.load(f)
    
    updated = 0
    skipped = 0
    failed = 0
    transparent_pixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    
    print("Starting automated favicon processing...")
    
    for folder_id, cards in backup["cards"].items():
        for card in cards:
            icon = card.get("icon", "")
            
            # Skip cards that already have a Viral icon pack icon
            if icon.startswith("Viral icon pack/") and not icon.startswith("Viral icon pack/favicon/"):
                continue
            
            # If it's already a local favicon, no need to re-fetch unless requested
            if icon.startswith("Viral icon pack/favicon/"):
                continue

            # Need to fetch favicon for this card
            url = card.get("url", "")
            if not url:
                continue
            
            try:
                parsed = urlparse(url)
                hostname = parsed.hostname or ""
                if not hostname:
                    continue
                
                # Clean hostname for filename
                clean_name = hostname.replace("www.", "").replace(".", "_")
                save_filename = f"{clean_name}.png"
                save_path = os.path.join(FAVICON_DIR, save_filename)
                
                # Check if already downloaded
                if os.path.exists(save_path):
                    card["icon"] = f"Viral icon pack/favicon/{save_filename}"
                    updated += 1
                    continue
                
                print(f"  Checking: {hostname}...", end=" ")
                if download_and_upscale(url, save_path):
                    card["icon"] = f"Viral icon pack/favicon/{save_filename}"
                    updated += 1
                    print("✅ Downloaded & Upscaled")
                else:
                    # Use transparent pixel if it looks like a placeholder
                    card["icon"] = transparent_pixel
                    skipped += 1
                    print("→ Transparent (placeholder detected)")
                    
            except Exception as e:
                card["icon"] = transparent_pixel
                failed += 1
                print(f"  ✗ Error: {e}")
    
    # Save updated backup
    with open(BACKUP_PATH, 'w', encoding='utf-8') as f:
        json.dump(backup, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'='*40}")
    print(f"  Processed & Updated:   {updated}")
    print(f"  Placeholders Filtered: {skipped}")
    print(f"  Failed:                {failed}")
    print(f"{'='*40}")

if __name__ == '__main__':
    main()
