import json
import time

# Load your raw MONKNOW data
with open('data.json', 'r', encoding='utf-8') as f:
    raw_data = json.load(f)

bookmarks = []
data = raw_data.get("data", {})
group_dict = data.get("groupDict", {})
icon_dict = data.get("iconDict", {})
groups = data.get("groups", [])

# Convert MONKNOW folders into nightTab categories
for group_id in groups:
    group = group_dict.get(group_id)
    if group and group.get("data"):
        group_label = group.get("label", "Folder")
        
        nt_group = {
            "name": {"text": group_label, "show": True},
            "collapse": False,
            "toolbar": {"openAll": {"show": True}, "collapse": {"show": True}},
            "items": []
        }
        
        # Convert MONKNOW links into nightTab visual tiles
        for icon_id in group.get("data", []):
            icon = icon_dict.get(icon_id)
            if icon and icon.get("url"):
                icon_label = icon.get("label", "Link")
                
                # Auto-generate a 1-2 letter abbreviation for the tile icon
                words = icon_label.split()
                if len(words) >= 2:
                    letter_text = (words[0][0] + words[1][0]).upper()
                elif len(words) == 1 and len(words[0]) >= 2:
                    letter_text = words[0][:2].upper()
                else:
                    letter_text = icon_label[:1].upper() if icon_label else "LK"
                    
                nt_item = {
                    "url": icon.get("url"),
                    "display": {
                        "alignment": "center-center",
                        "direction": "vertical",
                        "order": "visual-name",
                        "rotate": 0,
                        "translate": {"x": 0, "y": 0},
                        "gutter": 25,
                        "name": {"show": True, "text": icon_label, "size": 7},
                        "visual": {
                            "show": True,
                            "type": "letter",
                            "size": 25,
                            "letter": {"text": letter_text},
                            "icon": {"name": "link", "prefix": "fas", "label": "Link"},
                            "image": {"url": ""},
                            "shadow": {"size": 0}
                        }
                    },
                    "accent": {"by": "theme", "hsl": {"h": 0, "s": 0, "l": 0}, "rgb": {"r": 0, "g": 0, "b": 0}},
                    "color": {"by": "theme", "hsl": {"h": 0, "s": 0, "l": 0}, "rgb": {"r": 0, "g": 0, "b": 0}, "opacity": 100},
                    "background": {"show": False, "type": "image", "opacity": 100, "image": {"url": ""}, "video": {"url": ""}},
                    "border": 0,
                    "shape": {"wide": False, "tall": False},
                    "timestamp": int(time.time() * 1000)
                }
                nt_group["items"].append(nt_item)
                
        if nt_group["items"]:
            bookmarks.append(nt_group)

# Wrap it in the required nightTab header
export_data = {
    "nightTab": True,
    "version": "7.5.0",
    "bookmark": bookmarks
}

# Export the final file
with open('nightTab_ready.json', 'w', encoding='utf-8') as f:
    json.dump(export_data, f, indent=2, ensure_ascii=False)

print("Success! nightTab_ready.json has been created.")