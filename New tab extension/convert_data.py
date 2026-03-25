import json
import random
import string
import re
from urllib.parse import urlparse
import os

def generate_id(prefix=''):
    return prefix + ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))

# Auto-categorization keyword map
CATEGORY_KEYWORDS = {
    "Social Media": ["facebook", "instagram", "twitter", "tiktok", "snapchat", "whatsapp", "telegram", "discord", "reddit", "linkedin", "messenger", "wechat", "signal", "viber", "threads"],
    "Entertainment": ["youtube", "netflix", "spotify", "hulu", "disney", "hbo", "twitch", "crunchyroll", "prime video", "music", "movie", "anime", "gaming", "game", "steam", "epic", "roblox", "minecraft", "kick"],
    "Development": ["github", "gitlab", "stackoverflow", "codepen", "replit", "vscode", "npm", "docker", "aws", "azure", "firebase", "vercel", "netlify", "heroku", "code", "dev", "programming", "api"],
    "Productivity": ["notion", "trello", "asana", "slack", "jira", "monday", "clickup", "todoist", "evernote", "docs", "sheets", "drive", "calendar", "office", "teams", "zoom", "meet"],
    "Shopping": ["amazon", "ebay", "aliexpress", "etsy", "walmart", "shopify", "wish", "shein", "shop", "store", "buy", "deal"],
    "Education": ["coursera", "udemy", "khan", "duolingo", "edx", "skillshare", "brilliant", "academic", "learn", "study", "school", "university", "college"],
    "News & Media": ["cnn", "bbc", "espn", "reuters", "nytimes", "medium", "blog", "news", "press", "article"],
    "Finance": ["paypal", "venmo", "coinbase", "binance", "robinhood", "bank", "crypto", "finance", "money", "budget", "invest", "trading"],
    "Design": ["figma", "canva", "adobe", "dribbble", "behance", "sketch", "photoshop", "illustrator", "design", "creative"],
    "Travel": ["airbnb", "booking", "expedia", "tripadvisor", "uber", "lyft", "maps", "flight", "hotel", "travel"],
    "Cloud & Storage": ["dropbox", "onedrive", "gdrive", "icloud", "mega", "box", "cloud", "backup", "storage"],
    "AI & Tools": ["chatgpt", "openai", "gemini", "claude", "copilot", "midjourney", "ai", "tool", "utility"],
}

def categorize_folder(folder_name):
    """Auto-categorize a folder based on its name."""
    name_lower = folder_name.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in name_lower:
                return category
    return "Other"

def main():
    base_dir = r"e:\0- Projects\New tab extension"
    data_path = os.path.join(base_dir, "data.json")
    icon_dir = os.path.join(base_dir, "Viral icon pack")
    output_path = os.path.join(base_dir, "converted_backup.json")

    # Read data.json
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Read icons DIRECTLY from disk — dynamic, always up to date
    if os.path.isdir(icon_dir):
        viral_icons = [f for f in os.listdir(icon_dir) if f.lower().endswith('.png')]
    else:
        viral_icons = []
    
    print(f"Loaded {len(viral_icons)} icons from disk")
        
    backup_state = {
        "cards": {},
        "folders": [],
        "settings": {
            "bgUrl": "wallpaper.png",
            "searchEngine": "google"
        }
    }

    folders_data = data.get("bookmarks", [])
    
    # Auto-organize folders alphabetically by name
    folders_data.sort(key=lambda x: x.get("name", "").lower())
    
    for folder_data in folders_data:
        folder_id = generate_id('f_')
        folder_name = folder_data.get("name", "Unnamed Folder")
        category = categorize_folder(folder_name)
        
        backup_state["folders"].append({
            "icon": "📁",
            "id": folder_id,
            "name": folder_name,
            "category": category
        })
        
        cards = []
        
        # Sort items inside folders alphabetically for better organization
        items_data = folder_data.get("items", [])
        items_data.sort(key=lambda x: x.get("name", "").lower())
        
        for item in items_data:
            url = item.get("url", "")
            if not url:
                continue
            name = item.get("name", "Shortcut")
            
            # Icon priority: 1) Viral exact match → 2) Viral partial match → 3) Google favicon → 4) empty (browser handles it)
            icon_url = ""
            try:
                parsed_url = urlparse(url)
                hostname = parsed_url.hostname or ""
                full_hostname = hostname.replace("www.", "").lower()
                short_hostname = full_hostname.split(".")[0]
                
                # 1. Try exact match with short hostname
                exact_match = next((i for i in viral_icons if i.lower() == f"{short_hostname}.png"), None)
                if exact_match:
                    icon_url = f"Viral icon pack/{exact_match}"
                else:
                    # 2. Try partial match
                    partial_match = next((i for i in viral_icons if short_hostname and short_hostname in i.lower()), None)
                    if partial_match:
                        icon_url = f"Viral icon pack/{partial_match}"
                    else:
                        # 3. DuckDuckGo favicon (returns 1x1 for unknowns, unlike Google's globe)
                        icon_url = f"https://icons.duckduckgo.com/ip3/{full_hostname}.ico"
            except Exception:
                icon_url = ""  # Let the browser error handler deal with it
                
            cards.append({
                "icon": icon_url,
                "id": generate_id('c_'),
                "subtitle": "",
                "title": name,
                "url": url
            })
            
        backup_state["cards"][folder_id] = cards

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(backup_state, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully converted {len(backup_state['folders'])} folders to {output_path}")

if __name__ == '__main__':
    main()
