"""Fix corrupted CSS file by removing null-byte lines and broken rules."""
import re

with open('static/css/styles.css', 'rb') as f:
    raw = f.read()

# Split into lines preserving line endings
lines = raw.split(b'\n')

print(f"Total lines before: {len(lines)}")

# Find lines with null bytes
null_lines = []
for i, line in enumerate(lines):
    if b'\x00' in line:
        null_lines.append(i + 1)  # 1-indexed

print(f"Lines with null bytes: {null_lines}")

# Filter out null-byte lines
clean_lines = [line for line in lines if b'\x00' not in line]

print(f"Total lines after removing null-byte lines: {len(clean_lines)}")

# Join back
clean_content = b'\n'.join(clean_lines)

# Now fix the broken .settings-sidebar rule (missing closing brace + missing properties)
# Pattern: .settings-sidebar { ... border-right: 1px solid var(--border-color); \n.profile-avatar-large
# Should be: .settings-sidebar { ... } \n.profile-avatar-large
broken = b""".settings-sidebar { 
    width: 260px; 
    background: var(--sidebar-bg); 
    border-right: 1px solid var(--border-color); 
.profile-avatar-large {"""

fixed = b""".settings-sidebar { 
    width: 260px; 
    background: var(--sidebar-bg); 
    border-right: 1px solid var(--border-color); 
    padding: 30px 15px; 
    display: flex; 
    flex-direction: column; 
    gap: 25px; 
}
.sidebar-group { display: flex; flex-direction: column; gap: 8px; }
.sidebar-item { 
    display: flex; 
    align-items: center; 
    gap: 14px; 
    padding: 12px 18px; 
    border: none; 
    background: none; 
    color: var(--text-muted); 
    font-size: 0.95rem; 
    font-weight: 500; 
    cursor: pointer; 
    border-radius: 14px; 
    transition: all 0.25s ease; 
    text-align: left; 
    width: 100%; 
}
.sidebar-item i { width: 22px; text-align: center; font-size: 1.1rem; }
.sidebar-item:hover { background: var(--hover-bg); color: var(--primary-color); }
.sidebar-item.active { background: var(--primary-color); color: white; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
.settings-main { flex: 1; padding: 45px 50px; overflow-y: auto; }
.settings-pane { display: none; }
.settings-pane.active { display: block; animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.profile-header-tick { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 50px; }
.profile-avatar-large {"""

if broken in clean_content:
    clean_content = clean_content.replace(broken, fixed)
    print("Fixed .settings-sidebar missing closing brace and added missing sidebar rules.")
else:
    print("WARNING: Could not find broken .settings-sidebar pattern.")

# Write back as UTF-8
with open('static/css/styles.css', 'wb') as f:
    f.write(clean_content)

print("Done! File saved.")
