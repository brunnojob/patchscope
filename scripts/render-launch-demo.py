"""Render an illustrated walkthrough from real CLI output. Requires Pillow and FFmpeg."""
import json
from pathlib import Path
import subprocess
import tempfile
import textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'docs' / 'launch'
report = json.loads(subprocess.check_output(['node', 'scripts/cli.mjs', 'docs/example.diff', '--format', 'json'], cwd=ROOT))
(DEST / 'example-report.json').write_text(json.dumps(report, indent=2) + '\n')
font_dir = Path('/usr/share/fonts/truetype/dejavu')
def font(size, bold=False):
    return ImageFont.truetype(str(font_dir / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')), size)
def render(stage):
    im = Image.new('RGB', (1280, 720), '#101320')
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((40, 38, 1240, 682), radius=25, fill='#191e30', outline='#45415f', width=2)
    d.text((75, 65), 'PATCHSCOPE', font=font(23, True), fill='#b8a5ff')
    d.text((900, 70), 'DIFF  /  REVIEW  /  CI', font=font(18), fill='#b9bdd0')
    titles = ['1. Start with the Git diff', '2. Follow the review checklist', '3. Keep evidence in GitHub Actions']
    d.text((75, 120), titles[stage], font=font(38, True), fill='#eef0fa')
    if stage == 0:
        rows = [('+ pull_request_target:', '#ffa890'), ('+ permissions: write-all', '#ffa890'), ('+ DROP TABLE legacy_sessions;', '#ffa890'), ('- tests/session.test.js', '#ffa890'), ('  package.json: dependency 1.0.0 -> 2.0.0', '#b8a5ff')]
        d.text((75, 195), 'Synthetic fixture / docs/example.diff', font=font(22), fill='#b9bdd0')
        for i, (line, color) in enumerate(rows):
            d.text((90, 265+i*55), line, font=font(25), fill=color)
        footer = 'Analyze locally. No account or AI key.'
    elif stage == 1:
        d.text((75, 190), f"{report['summary']['files']} files / {report['summary']['findings']} review prompts / actual CLI output", font=font(23), fill='#b9bdd0')
        for i, finding in enumerate(report['findings']):
            severity = finding['severity'].upper()
            y = 255 + i * 60
            d.text((85, y), severity, font=font(20, True), fill='#ffa890' if severity == 'HIGH' else '#f0d784')
            title = finding['title']
            d.text((230, y), title, font=font(23), fill='#eef0fa')
        footer = 'Each prompt explains what matched and what to inspect.'
    else:
        d.text((75, 195), 'Illustrated integration / not a GitHub screen recording', font=font(21), fill='#b9bdd0')
        lines = ['uses: brunnojob/patchscope@v2.0.1', 'Job summary: human review checklist', 'Report files: Markdown + JSON + SARIF', 'Upload-artifact step: retain the reports', 'Read-only permissions / advisory findings']
        for i, line in enumerate(lines):
            d.text((85, 255+i*55), line, font=font(25), fill='#b8a5ff' if i==0 else '#eef0fa')
        footer = 'Install: github.com/marketplace/actions/patchscope-diff-review'
    d.text((75, 590), footer, font=font(21), fill='#a8e1c0')
    d.text((75, 640), 'Heuristic prompts for human review. Not proof of vulnerability or safety.', font=font(17), fill='#b9bdd0')
    return im
with tempfile.TemporaryDirectory() as temp:
    tmp = Path(temp)
    for i in range(3):
        render(i).save(tmp / f'{i}.png')
    render(1).save(DEST / 'demo-poster.png')
    args = ['ffmpeg', '-y', '-loglevel', 'error']
    for i in range(3):
        args += ['-loop', '1', '-t', '6', '-i', str(tmp / f'{i}.png')]
    args += ['-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]', '-map', '[v]', '-r', '24', '-c:v', 'libx264', '-crf', '26', '-movflags', '+faststart', str(DEST / 'patchscope-demo.mp4')]
    subprocess.run(args, check=True)
print('Rendered 18-second illustrated walkthrough from real fixture output.')
