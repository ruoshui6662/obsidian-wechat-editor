import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const python = process.env.PYTHON || 'python3';
const root=fileURLToPath(new URL('../fixtures/vault/',import.meta.url));
const result=spawnSync(python,['-c',String.raw`
from pathlib import Path
from PIL import Image, ImageDraw
import sys
root=Path(sys.argv[1]); (root/'图片 空格').mkdir(parents=True,exist_ok=True)
for folder in ['一','二']: (root/folder).mkdir(exist_ok=True)
im=Image.new('RGB',(720,420),'#f0f5ff'); d=ImageDraw.Draw(im)
d.rounded_rectangle((45,40,675,380),radius=26,fill='#173b65')
d.text((85,85),'LOCAL IMAGE / WECHAT LAYOUT',fill='white')
for i,h in enumerate([75,130,180,110]):d.rectangle((95+i*130,330-h,160+i*130,330),fill=['#57c7b6','#69a4ff','#e8b46a','#ba99ed'][i])
im.save(root/'图片 空格'/'配图.png'); im.save(root/'照片.jpg'); im.save(root/'静态.webp')
im.save(root/'一'/'同名.png'); im.save(root/'二'/'同名.png')
emoji=Image.new('RGBA',(40,40),(0,0,0,0)); ed=ImageDraw.Draw(emoji);ed.ellipse((2,2,38,38),fill='#ffd36b');ed.ellipse((11,12,14,16),fill='#333333');ed.ellipse((26,12,29,16),fill='#333333');ed.arc((11,16,29,29),0,180,fill='#333333',width=2)
emoji.save(root/'表情.png')
frames=[Image.new('RGB',(80,60),c) for c in ['#69a4ff','#57c7b6']]
frames[0].save(root/'动画.gif',save_all=True,append_images=frames[1:],duration=350,loop=0)
`,root],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
