import json,re,html,os
d=os.path.dirname(os.path.abspath(__file__))
spec=json.load(open(os.path.join(d,'spec.json'),encoding='utf-8'))
head=open(os.path.join(d,'hub-head.html'),encoding='utf-8').read().replace('<title>Zero Mile Hub</title>','<title>%s</title>'%html.escape(spec.get('short_title') or spec['name']))
body=open(os.path.join(d,'hub-body.html'),encoding='utf-8').read()
plan=open(os.path.join(d,'masterplan.svg'),encoding='utf-8').read()
plan=re.sub(r'<\?xml[^>]*\?>','',plan)
design=open(os.path.join(d,'design-section.html'),encoding='utf-8').read() if os.path.exists(os.path.join(d,'design-section.html')) else ''
design=design.replace('ROOF_SVG',open(os.path.join(d,'roof.svg'),encoding='utf-8').read())
js=open(os.path.join(d,'hub.js'),encoding='utf-8').read()
out=head+body+'\n<template id="planTpl">'+plan+'</template>\n<script type="application/json" id="specData">'+json.dumps(spec,separators=(',',':')).replace('</','<\\/')+'</script>\n<script>window.__DESIGN={html:'+json.dumps(design).replace('</','<\\/')+'};</script>\n<script>\n'+js+'\n</script>\n'
open(os.path.join(d,'hub.html'),'w',encoding='utf-8').write(out)
os.makedirs(os.path.join(d,'site'),exist_ok=True);open(os.path.join(d,'site','index.html'),'w',encoding='utf-8').write(out)
print(len(out))
