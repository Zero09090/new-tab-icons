@echo off
echo ========================================
echo   Viral Icon Pack - Rebuild Script
echo ========================================
echo.

echo [1/3] Scanning Viral icon pack folder...
node scan_icons.js
echo.

echo [2/3] Regenerating templates...
node generate_templates.js
echo.

echo [3/4] Converting bookmarks backup...
python convert_data.py
echo.

echo [4/4] Downloading and upscaling favicons...
python fetch_favicons.py
echo.

echo ========================================
echo   Done! You can now restore the new
echo   converted_backup.json in your extension.
echo ========================================
pause
