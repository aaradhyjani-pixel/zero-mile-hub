import json,re,html,os
d=os.path.dirname(os.path.abspath(__file__))
spec=json.load(open(os.path.join(d,'spec.json'),encoding='utf-8'))
head=open(os.path.join(d,'hub-head.html'),encoding='utf-8').read().replace('<title>Vikram Sarabhai International</title>','<title>%s</title>'%html.escape(spec.get('short_title') or spec['name']))
body=open(os.path.join(d,'hub-body.html'),encoding='utf-8').read()
plan=open(os.path.join(d,'masterplan.svg'),encoding='utf-8').read()
plan=re.sub(r'<\?xml[^>]*\?>','',plan)
design=open(os.path.join(d,'design-section.html'),encoding='utf-8').read() if os.path.exists(os.path.join(d,'design-section.html')) else ''
design=design.replace('ROOF_SVG',open(os.path.join(d,'roof.svg'),encoding='utf-8').read())
js=open(os.path.join(d,'hub.js'),encoding='utf-8').read()
# 3D: the core (hub3d.js) and the modules (3d/*.js) go inside hub.js's closure, at the /*@@3D@@*/ marker.
# A module that fails a syntax check is left out with a warning, so one broken module never breaks the game.
import glob,subprocess,shutil
parts=[]
for f in [os.path.join(d,'hub3d.js')]+sorted(glob.glob(os.path.join(d,'3d','*.js'))):
    if not os.path.exists(f): continue
    src=open(f,encoding='utf-8').read()
    if shutil.which('node'):
        chk=subprocess.run(['node','--check',f],capture_output=True,text=True)
        if chk.returncode!=0:
            print('SKIPPED (syntax):',os.path.relpath(f,d),chk.stderr.strip().splitlines()[0] if chk.stderr else ''); continue
    parts.append('/* ---- '+os.path.relpath(f,d)+' ---- */\n'+src)
js=js.replace('/*@@3D@@*/','\n'.join(parts))
# the SPG's recorded voice lines (voice/make_voice.py)
vp=os.path.join(d,'voice','spg_audio.js')
js=js.replace('/*@@VOICE@@*/',open(vp,encoding='utf-8').read() if os.path.exists(vp) else '')
out=head+body+'\n<template id="planTpl">'+plan+'</template>\n<script type="application/json" id="specData">'+json.dumps(spec,separators=(',',':')).replace('</','<\\/')+'</script>\n<script>window.__DESIGN={html:'+json.dumps(design).replace('</','<\\/')+'};</script>\n<script>\n'+js+'\n</script>\n'
open(os.path.join(d,'hub.html'),'w',encoding='utf-8').write(out)
os.makedirs(os.path.join(d,'site'),exist_ok=True);open(os.path.join(d,'site','index.html'),'w',encoding='utf-8').write(out)
# set-piece music (music/*.mp3, played by music() in hub.js) ships next to the page
md=os.path.join(d,'music')
if os.path.isdir(md):
    shutil.rmtree(os.path.join(d,'site','music'),ignore_errors=True);shutil.copytree(md,os.path.join(d,'site','music'))
# the recorded voice clips (voice/clips/*.mp3, named in voice/spg_audio.js) ship next to the page too
vc=os.path.join(d,'voice','clips')
if os.path.isdir(vc):
    shutil.rmtree(os.path.join(d,'site','voice'),ignore_errors=True);shutil.copytree(vc,os.path.join(d,'site','voice','clips'))
print(len(out))
