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
# money.json, minified for the page: each entry keeps its value (and estimate:true where set); sources and notes stay in the
# repo. The page reads it as window.MONEY_DATA (hub.js's ledger, money/era.js). No money.json: no MONEY_DATA, and money stays off.
# The Black Box's three sourced marks keep their source (the first one), so page 1 can footnote them.
_KEEP_SRC={'bial.owners.dcf_inputs','till.fair_return_on_equity','till.efficient_cost_of_debt'}
def _strip(o,path=''):
    if isinstance(o,dict):
        if 'value' in o:
            r=dict({'value':o['value']},**({'estimate':True} if o.get('estimate') else {}))
            if path in _KEEP_SRC and o.get('source'): r['source']=o['source'].split(' ; ')[0]
            return r
        return {k:_strip(v,(path+'.'+k).lstrip('.')) for k,v in o.items() if k!='_meta'}
    return o
mp=os.path.join(d,'money.json')
money_data='\n<script>window.MONEY_DATA='+json.dumps(_strip(json.load(open(mp,encoding='utf-8'))),separators=(',',':'),ensure_ascii=False).replace('</','<\\/')+';</script>' if os.path.exists(mp) else ''
# money/*.js: the money layer's self-contained modules, loaded after the game as separate scripts (era.js, then ui.js).
# Like the 3D modules, a file that fails a syntax check is left out with a warning.
mfiles=[]
for f in sorted(glob.glob(os.path.join(d,'money','*.js'))):
    if shutil.which('node'):
        chk=subprocess.run(['node','--check',f],capture_output=True,text=True)
        if chk.returncode!=0:
            print('SKIPPED (syntax):',os.path.relpath(f,d),chk.stderr.strip().splitlines()[0] if chk.stderr else ''); continue
    mfiles.append(f)
money_js=''.join('\n<script>\n'+open(f,encoding='utf-8').read()+'\n</script>' for f in mfiles)
out=head+body+'\n<template id="planTpl">'+plan+'</template>\n<script type="application/json" id="specData">'+json.dumps(spec,separators=(',',':')).replace('</','<\\/')+'</script>'+money_data+'\n<script>window.__DESIGN={html:'+json.dumps(design).replace('</','<\\/')+'};</script>\n<script>\n'+js+'\n</script>'+money_js+'\n'
# THE UPDATE GUARD: every build has an ID (a hash of the page). The page checks site/version.json every 30 s; when a new build
# is live, saved concession games are cancelled and the page hard-reloads onto the new build. A saved concession from an older
# build is also cancelled on first load. Quick-play stars and settings (zm_stars, zm_cfg) are kept.
import hashlib
_bid=hashlib.sha1(out.encode('utf-8')).hexdigest()[:12]
_g=("<script>(function(){var B='%s',K=['zm_campaign','zm_ch5'];window.__BUILD=B;"
 "function cancel(){try{K.forEach(function(x){localStorage.removeItem(x);});sessionStorage.setItem('zm_updated','1');}catch(e){}}"
 "try{var o=localStorage.getItem('zm_build');if(o&&o!==B)cancel();localStorage.setItem('zm_build',B);}catch(e){}"
 "if(location.protocol.indexOf('http')===0)setInterval(function(){fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;})"
 ".then(function(v){if(v&&v.build&&v.build!==B){cancel();try{localStorage.setItem('zm_build',v.build);}catch(e){}location.reload();}}).catch(function(){});},30000);"
 "document.addEventListener('DOMContentLoaded',function(){try{if(sessionStorage.getItem('zm_updated')){sessionStorage.removeItem('zm_updated');"
 "var n=document.createElement('div');n.textContent='A new version of VSI is live. Games in progress were closed; start again from the menu.';"
 "n.style.cssText='position:fixed;top:14px;left:50%%;transform:translateX(-50%%);z-index:99999;background:#1d2024;color:#fff7ea;padding:10px 16px;font:14px Barlow Condensed,sans-serif;letter-spacing:.02em;border-radius:3px;box-shadow:0 6px 18px rgba(0,0,0,.4)';"
 "document.body.appendChild(n);setTimeout(function(){n.remove();},7000);}}catch(e){}});})();</script>") % _bid
out=out.replace(head,head+_g,1) if head and head in out else _g+out
open(os.path.join(d,'hub.html'),'w',encoding='utf-8').write(out)
os.makedirs(os.path.join(d,'site'),exist_ok=True);open(os.path.join(d,'site','index.html'),'w',encoding='utf-8').write(out)
open(os.path.join(d,'site','version.json'),'w').write(json.dumps({'build':_bid}))
# set-piece music (music/*.mp3, played by music() in hub.js) ships next to the page
md=os.path.join(d,'music')
if os.path.isdir(md):
    shutil.rmtree(os.path.join(d,'site','music'),ignore_errors=True);shutil.copytree(md,os.path.join(d,'site','music'))
# the recorded voice clips (voice/clips/*.mp3, named in voice/spg_audio.js) ship next to the page too
vc=os.path.join(d,'voice','clips')
if os.path.isdir(vc):
    shutil.rmtree(os.path.join(d,'site','voice'),ignore_errors=True);shutil.copytree(vc,os.path.join(d,'site','voice','clips'))
print(len(out))
