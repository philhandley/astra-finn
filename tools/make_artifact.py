"""Build artifact.html: the same app shell as index.html, without the document skeleton
(the Artifact host adds <!doctype>, <head> and <body> itself)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / 'index.html').read_text(encoding='utf-8')
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', src, re.S).group(1)
keep = []
for line in head.splitlines():
    s = line.strip()
    if s.startswith('<meta charset') or s.startswith('<meta name="viewport"'):
        continue
    if 'rel="manifest"' in s or 'apple-touch-icon' in s or 'rel="icon"' in s or 'mobile-web-app' in s or 'apple-mobile' in s:
        continue
    keep.append(line)
out = '\n'.join(keep).strip() + '\n' + body.strip() + '\n'
(ROOT / 'artifact.html').write_text(out, encoding='utf-8')
print('artifact.html written,', len(out), 'bytes')
