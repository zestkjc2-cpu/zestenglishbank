import os

file_path = r"c:\Users\zestk\study0314\downloaded_main.html"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_content = content.replace('font-color:', 'color:')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replacement complete.")
