/* money/ui.js — the money layer's user interface, as a self-contained module.
   It never reads game state on its own. The economy (wired into hub.js later) pushes numbers in
   through window.ZMMoney, and the dialogs hand decisions back through Promises.
   All amounts are in ₹ crore (1 crore = 100 lakh). See money/CONTRACT.md.
   Open the game with ?moneymock in the URL to see every component driven by fake data. */
(function(){
'use strict';
if(window.ZMMoney)return;
const M=window.ZMMoney={version:1};
/* names live in one place, so renaming the airport is one call: ZMMoney.config({...}) */
M.cfg={airportName:'Vikram Sarabhai International Airport',airportShort:'VSI',spvName:'Vikram Sarabhai International Airport Limited',spvShort:'VSIAL',years:60,
  coinvestor:{name:'L5 Capital: Lagrange Point Infrastructure Fund',blurb:'Patient money. Like a body parked at the L5 point, it stays put for decades.'},
  rivals:[{name:'Kármán Line Ventures',blurb:'Aggressive. Always reaching for the edge of space. Bids high and overreaches.'},
          {name:'QNH Infragenesis',blurb:'Pension money. Sets its altimeter before every approach: never bids above what it can fund.'},
          {name:'Thakral–Wainganga Airports',blurb:'A Nagpur developer named for Sarla Thakral, India\'s first woman pilot (1936), with a European operator.'}]};
/* the people who sign for the other parties: fictional officials, each with a hand of their own (see signSvg).
   'aai', 'state' and 'coinvestor' counter-sign the concession; 'dgca' signs the aerodrome licence;
   'aai60' and 'state60' are their successors who receive the airport back in year 60.
   hand: {font (a script face loaded by loadDeskFonts), size, adv (average glyph width / size), slant (deg), rot (deg),
          ink, weight (extra stroke), flourish:'under'|'dash'|'loop'|'paraph'|'dot'} */
M.cfg.signatories={
  aai:{name:'Meenakshi Raghavan',sign:'M. Raghavan',title:'Regional Executive Director, Western Region',org:'the Airports Authority of India',
    hand:{font:'Mrs Saint Delafield',size:46,adv:.3,slant:6,rot:-5,ink:'#1d1f22',weight:.35,flourish:'under'}},
  state:{name:'Shirish V. Bhonsle',sign:'S.V. Bhonsle',title:'Vice-Chairman and Managing Director, MADC',org:'the State of Maharashtra, through MADC',
    hand:{font:'Homemade Apple',size:21,adv:.6,slant:-2,rot:-2,ink:'#1f3a8a',weight:.1,flourish:'dash'}},
  coinvestor:{name:'Naomi Fernandes',sign:'Naomi Fernandes',title:'Managing Partner, L5 Capital',org:'L5 Capital: Lagrange Point Infrastructure Fund',
    hand:{font:'Monsieur La Doulaise',size:38,adv:.34,slant:0,rot:-3,ink:'#23305e',weight:.2,flourish:'loop'}},
  dgca:{name:'Rajeshwari Natarajan',sign:'R. Natarajan',title:'Joint Director General (Aerodromes)',org:'the Director General of Civil Aviation',
    hand:{font:'La Belle Aurore',size:30,adv:.46,slant:4,rot:-6,ink:'#1d1f22',weight:.15,flourish:'paraph'}},
  aai60:{name:'Kabir Sethna',sign:'K. Sethna',title:'Regional Executive Director, Western Region',org:'the Airports Authority of India',
    hand:{font:'Herr Von Muellerhoff',size:50,adv:.27,slant:3,rot:-8,ink:'#14161a',weight:.35,flourish:'under'}},
  state60:{name:'Tanvi Patwardhan',sign:'Tanvi Patwardhan',title:'Managing Director, MADC',org:'the State of Maharashtra, through MADC',
    hand:{font:'Allura',size:36,adv:.36,slant:0,rot:-2,ink:'#1f3a8a',weight:.15,flourish:'dot'}}};
M.config=function(o){o=Object.assign({},o||{});if(o.signatories){const sg=o.signatories;delete o.signatories;
    for(const k in sg)M.cfg.signatories[k]=Object.assign({},M.cfg.signatories[k]||{},sg[k],{hand:Object.assign({},(M.cfg.signatories[k]||{}).hand||{},sg[k].hand||{})});}
  Object.assign(M.cfg,o);return M.cfg;};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- number formatting: crore above ₹1 cr, lakh below ---------- */
function fmt(v,opt){opt=opt||{};if(v==null||isNaN(v))return '—';const s=v<0?'−':opt.sign&&v>0?'+':'';const a=Math.abs(v);
  if(a>=1000)return s+'₹'+Math.round(a).toLocaleString('en-IN')+' cr';
  if(a>=1)return s+'₹'+(a>=10?Math.round(a):a.toFixed(1))+' cr';
  const l=a*100;return s+'₹'+(l>=10?Math.round(l):l.toFixed(1))+' L';}
M.fmt=fmt;

/* ---------- styles ---------- */
const CSS=`
.zmm-chip{position:relative;min-width:118px;padding:3px 8px 4px;border-left:1px solid var(--panel-edge);cursor:help}
.zmm-chip .k{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:10.5px;color:var(--ink-3);white-space:nowrap;display:flex;gap:6px;align-items:center}
.zmm-chip .v{font-family:var(--f-mono);font-size:17px;font-weight:500;line-height:1.15;white-space:nowrap}
.zmm-chip .r{font-family:var(--f-mono);font-size:10px;color:var(--ink-3);white-space:nowrap}
.zmm-chip.up .v{color:var(--go)}.zmm-chip.dn .v{color:var(--stop)}
.zmm-chip canvas{display:block;width:100%;height:14px;margin-top:2px}
.zmm-chip .tick{position:absolute;right:6px;top:2px;font-family:var(--f-mono);font-size:10px;opacity:0;transition:opacity .25s}
.zmm-chip .tick.show{opacity:1}
#zmmFloat{position:absolute;inset:0;pointer-events:none;z-index:4;overflow:hidden}
.zmm-f{position:absolute;font-family:var(--f-mono);font-weight:700;font-size:12px;padding:1px 6px;border-radius:3px;white-space:nowrap;transform:translate(-50%,-100%);animation:zmmUp 1.8s ease-out forwards;text-shadow:0 1px 2px rgba(0,0,0,.8)}
.zmm-f.rev{color:#7dffb4;background:rgba(10,40,24,.72);border:1px solid rgba(58,208,127,.45)}
.zmm-f.cost{color:#ffb1a8;background:rgba(48,12,10,.75);border:1px solid rgba(255,77,63,.5)}
.zmm-f.big{font-size:15px}
@keyframes zmmUp{0%{opacity:0;transform:translate(-50%,-80%)}12%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-260%)}}
@media (prefers-reduced-motion:reduce){.zmm-f{animation:none;opacity:1}}
#zmmPL{padding:0 0 8px}
#zmmPL table{width:100%;border-collapse:collapse;font-size:12px}
#zmmPL th{position:sticky;top:0;background:#0d1114;text-align:left;font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:10.5px;color:var(--ink-3);padding:5px 8px;border-bottom:1px solid var(--panel-edge)}
#zmmPL td{padding:4px 8px;border-bottom:1px solid #151c21}
#zmmPL td.a{text-align:right;font-family:var(--f-mono);white-space:nowrap}
#zmmPL tr.rev td.a{color:#9de8bd}#zmmPL tr.cost td.a{color:#ffb7ae}
#zmmPL tr.sum td{font-weight:600;border-top:1px solid var(--panel-edge);background:#0f1518}
#zmmPL .why{color:var(--ink-3);font-size:11px;display:block}
#zmmPL .bar{height:3px;border-radius:2px;margin-top:2px}
#zmmPL .note{padding:8px;color:var(--ink-3);font-size:11.5px}
#zmmOv{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:18px 16px;background:linear-gradient(180deg,rgba(3,5,7,.7),rgba(3,5,7,.92))}
#zmmOv[hidden]{display:none!important}
.zmm-sheet{background:#0a0e11;border:1px solid var(--panel-edge);border-radius:8px;max-width:980px;width:100%;max-height:100%;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.7)}
.zmm-sheet .band{background:var(--sign);color:var(--sign-ink,#121212);padding:8px 20px;font-family:var(--f-sign);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:14px;display:flex;justify-content:space-between;gap:12px}
.zmm-sheet .in{padding:20px 24px 22px}
.zmm-sheet h1{font-family:var(--f-sign);font-weight:700;font-size:44px;line-height:.98;margin:0 0 8px;text-wrap:balance}
.zmm-sheet h2{font-family:var(--f-sign);font-weight:600;font-size:21px;margin:18px 0 6px}
.zmm-sheet p{color:var(--ink-2);max-width:72ch;margin:0 0 9px;font-size:14.5px}
.zmm-sheet .steps{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap}
.zmm-sheet .steps span{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:11.5px;color:var(--ink-3);border:1px solid var(--panel-edge);border-radius:3px;padding:2px 8px}
.zmm-sheet .steps span.on{color:var(--sign-ink,#121212);background:var(--sign);border-color:var(--sign)}
.zmm-sheet .steps span.done{color:var(--go);border-color:rgba(58,208,127,.4)}
.zmm-in{font:inherit;font-family:var(--f-sign);font-weight:600;font-size:30px;letter-spacing:.02em;background:#0e1316;color:var(--ink);border:1px solid var(--panel-edge);border-radius:5px;padding:8px 12px;width:min(520px,100%)}
.zmm-in:focus{outline:2px solid var(--sign);outline-offset:1px}
.zmm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0 4px}
.zmm-go{background:var(--sign);color:var(--sign-ink,#121212);font-family:var(--f-sign);font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:17px;padding:10px 20px;border-radius:4px}
.zmm-go:disabled{opacity:.4;cursor:not-allowed}
.zmm-ghost{border:1px solid var(--panel-edge);color:var(--ink);font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:15px;padding:9px 16px;border-radius:4px}
.zmm-ghost:hover,.zmm-opt:hover{border-color:var(--sign)}
.zmm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:9px;margin:10px 0}
.zmm-box{border:1px solid var(--panel-edge);border-radius:6px;padding:10px 12px;background:#0d1215}
.zmm-box .k{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:11px;color:var(--ink-3)}
.zmm-box .v{font-family:var(--f-mono);font-size:21px;margin-top:2px}
.zmm-box .s{font-size:12px;color:var(--ink-3);margin-top:3px}
.zmm-opt{display:flex;flex-direction:column;gap:4px;text-align:left;border:1px solid var(--panel-edge);border-radius:6px;padding:10px 12px;background:#0d1215}
.zmm-opt.on{border-color:var(--sign);box-shadow:inset 0 0 0 1px var(--sign)}
.zmm-opt b{font-family:var(--f-sign);font-weight:600;font-size:18px}
.zmm-opt span{font-size:12.5px;color:var(--ink-2)}
.zmm-own{display:flex;height:26px;border-radius:4px;overflow:hidden;margin:8px 0 4px;font-family:var(--f-sign);font-weight:700;font-size:13px;letter-spacing:.03em}
.zmm-own div{display:flex;align-items:center;justify-content:center;color:#0b0b0b;white-space:nowrap;overflow:hidden}
.zmm-range{width:min(520px,100%);accent-color:var(--sign)}
.zmm-big{font-family:var(--f-mono);font-size:30px}
.zmm-rivals{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:8px 0}
.zmm-rivals div{border:1px dashed var(--panel-edge);border-radius:5px;padding:8px 10px;font-size:12.5px;color:var(--ink-2)}
.zmm-rivals b{display:block;font-family:var(--f-sign);font-weight:600;font-size:16px;color:var(--ink)}
.zmm-meter{height:8px;background:#1b2329;border-radius:4px;overflow:hidden;margin:4px 0}
.zmm-meter i{display:block;height:100%}
.zmm-card{display:grid;grid-template-columns:1fr auto;gap:2px 10px;text-align:left;border:1px solid var(--panel-edge);border-radius:6px;padding:10px 12px;background:#0d1215}
.zmm-card.on{border-color:var(--go);box-shadow:inset 0 0 0 1px var(--go)}
.zmm-card.own{opacity:.55;cursor:default}
.zmm-card:disabled{opacity:.35;cursor:not-allowed}
.zmm-card b{font-family:var(--f-sign);font-weight:600;font-size:17px}
.zmm-card .c{font-family:var(--f-mono);font-size:13px;color:var(--sign);text-align:right}
.zmm-card .e{grid-column:1/3;font-size:12.5px;color:var(--ink-2)}
.zmm-card .w{grid-column:1/3;font-size:11.5px;color:var(--ink-3)}
.zmm-order{border:1px solid #3b3220;border-radius:6px;background:#100e08;padding:12px 14px;margin:10px 0}
.zmm-order .h{font-family:var(--f-sign);font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:12px;color:var(--sign)}
.zmm-order .t{font-size:14px;color:var(--ink);margin-top:4px}
.zmm-is{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}
.zmm-is td{padding:6px 8px;border-bottom:1px solid #182027}
.zmm-is td.a{text-align:right;font-family:var(--f-mono)}
.zmm-is tr.h td{font-family:var(--f-sign);font-weight:600;letter-spacing:.05em;text-transform:uppercase;font-size:12px;color:var(--ink-3);padding-top:14px}
.zmm-is tr.t td{font-weight:600;border-top:1px solid var(--panel-edge)}
.zmm-is tr.g td{color:var(--go);font-size:16px}
.zmm-is tr.b td{color:var(--stop)}
.zmm-hero{font-family:var(--f-sign);font-weight:700;font-size:28px;line-height:1.15;margin:14px 0 4px}
.zmm-hero em{font-style:normal;color:var(--sign)}
.zmm-cmp{display:grid;grid-template-columns:150px 1fr 60px;gap:4px 10px;align-items:center;font-size:13px;margin:6px 0}
.zmm-cmp .bar{height:10px;border-radius:3px;background:#2a3238}
.zmm-cmp .bar i{display:block;height:100%;border-radius:3px;background:var(--cool,#6aa3ff)}
.zmm-cmp.me .bar i{background:var(--sign)}.zmm-cmp.me span{color:var(--sign);font-weight:600}
.zmm-err{color:var(--stop);font-size:12.5px;min-height:18px}
@media (max-width:700px){.zmm-sheet h1{font-size:32px}.zmm-in{font-size:22px}}
/*@ob onboarding: the deal desk. Paper, drafting ink, blue ballpoint, red rubber stamps. Laptop only. */
#zmmOv.ob{padding:0;background:none}
.zmm-sheet.zmm-ob{max-width:none;width:100%;height:100%;max-height:none;border:0;border-radius:0;background:none;box-shadow:none;overflow:hidden}
.zdk{--zs:#e4e8e5;--zp:#fcfcf9;--zt:#1d2024;--zi:#1f3a8a;--zr:#c22a2e;--zw:#b06d12;--zg:#2b7a4b;--zpe:#676c71;
  --ft:'Courier Prime','Courier New',monospace;--fd:'Libre Caslon Text',Georgia,serif;--fh:'Kalam','Segoe Print',cursive;--fhi:'Tiro Devanagari Hindi',serif;
  position:relative;height:100%;overflow:hidden;color:var(--zt);background-color:var(--zs);
  background-image:linear-gradient(rgba(40,100,140,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(40,100,140,.13) 1px,transparent 1px),linear-gradient(rgba(40,100,140,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(40,100,140,.06) 1px,transparent 1px);
  background-size:120px 120px,120px 120px,24px 24px,24px 24px}
.zdk-defs{position:absolute}
/* the drawing on the desk, plotted in once, inked darker as the deal comes together */
.zdk-sheet{position:absolute;inset:0;pointer-events:none}
.zdk-plan{--ink:0;position:absolute;inset:-4% -10% -8% 6%;filter:invert(1) grayscale(1) contrast(1.6);mix-blend-mode:multiply;opacity:calc(.34 + var(--ink)*.07);transition:opacity 1.2s;animation:zdkPlot 2.6s cubic-bezier(.45,0,.3,1) both}
.zdk-plan svg{width:100%;height:100%}.zdk-plan svg text{display:none}
.zdk-plotter{position:absolute;top:0;bottom:0;left:14%;width:2px;background:var(--zr);opacity:0;animation:zdkPlotter 2.6s cubic-bezier(.45,0,.3,1) both;box-shadow:0 0 0 4px rgba(194,42,46,.08)}
.zdk-main{z-index:1}.zdk-tb{position:absolute;right:24px;bottom:20px;border-collapse:collapse;font-family:var(--ft);font-size:11px;color:#3a3f44;background:rgba(252,252,249,.75)}
.zdk-tb td{border:1.2px solid #4a4f54;padding:4px 10px;white-space:nowrap}
.zdk-tb tr:first-child td{font-weight:700;font-size:12px}
.zdk-top{position:absolute;left:0;right:0;top:0;height:64px;display:flex;align-items:center;padding:0 32px;z-index:2}
.zdk-mark{display:flex;align-items:center;gap:12px;font-family:var(--fd);font-size:17px;color:var(--zt)}
.zdk-exit{margin-left:auto;font-family:var(--ft);font-size:13.5px;color:var(--zt);text-decoration:underline;text-underline-offset:3px;padding:8px 4px}
.zdk-exit:hover{color:var(--zr)}
.zdk :focus-visible{outline:2px solid var(--zi);outline-offset:3px}
/* the stack of completed documents */
.zdk-pile{position:absolute;left:clamp(28px,3vw,56px);top:120px;width:200px;height:400px;z-index:1}
.zdk-card{position:absolute;left:calc(var(--i)*8px);top:calc(var(--i)*48px);width:178px;height:226px;padding:16px 16px;background:var(--zp);transform:rotate(var(--r));box-shadow:0 10px 24px rgba(30,40,50,.16),0 1px 3px rgba(30,40,50,.1);animation:zdkFile .55s cubic-bezier(.3,.7,.2,1) both}
.zdk-card span{display:block;font-family:var(--fd);font-weight:700;font-size:14px;margin-bottom:12px}
.zdk-card i{display:block;height:2px;margin:9px 0;background:#e1e2dd}.zdk-card i.s{width:55%}
/* the current document */
.zdk-main{position:absolute;inset:64px 0 0 0;display:grid;grid-template-columns:minmax(250px,1fr) minmax(560px,640px) minmax(250px,1fr);padding:4px 28px 22px}
.zdk-col{grid-column:2;display:flex;flex-direction:column;min-height:0}
.zdk-doc{position:relative;flex:1 1 auto;min-height:0;overflow:auto;background:var(--zp);padding:38px 46px 34px;box-shadow:0 22px 48px rgba(30,40,50,.2),0 2px 6px rgba(30,40,50,.1);scrollbar-width:thin}
.zdk-doc.arrive{animation:zdkArrive .55s cubic-bezier(.2,.7,.2,1) both}
.zdk-doc.leave{animation:zdkLeave .45s cubic-bezier(.5,0,.8,.4) forwards}
.zdk-doc.thud{animation:zdkThud .22s ease-out}
.zdk-dh .dt{margin-left:auto}
.zdk-dh{display:flex;align-items:center;gap:10px;font-family:var(--ft);font-size:12px;color:var(--zpe);padding-bottom:12px;margin-bottom:22px;border-bottom:1px solid #d9dad5}
.zdk-logo{flex:none;color:var(--zt)}
.zdk-doc h2{font-family:var(--fd);font-weight:700;font-size:30px;line-height:1.1;margin:0 0 14px;color:var(--zt)}
.zdk-doc .t{font-family:var(--ft);font-size:14.5px;line-height:1.6;margin:0 0 14px;color:var(--zt)}
.zdk .h{font-family:var(--fh);font-weight:400;font-size:1.2em;line-height:1;color:var(--zi);padding:0 1px}
.zdk-f{display:block;margin:20px 0 2px}
.zdk-f span{display:block;font-family:var(--ft);font-size:12.5px;color:var(--zpe)}
.zdk-f input{display:block;width:100%;box-sizing:border-box;font-family:var(--fh);font-size:30px;line-height:1.3;color:var(--zi);background:none;border:0;border-bottom:1.5px dotted #7d8287;border-radius:0;padding:2px 0 3px;caret-color:var(--zi)}
.zdk-f input::placeholder{color:rgba(31,58,138,.22)}
.zdk-f input:focus{outline:none;border-bottom:1.5px solid var(--zi)}
.zdk-err{min-height:20px;margin:8px 0 6px;font-family:var(--ft);font-size:12.5px;color:var(--zr)}
.zdk-tab{width:100%;border-collapse:collapse;font-family:var(--ft);font-size:14px;margin:4px 0 8px}
.zdk-tab td{border-top:1px solid #dcddd7;padding:8px 0;vertical-align:baseline}
.zdk-tab tr:last-child td{border-bottom:1px solid #dcddd7}
.zdk-tab small{display:block;font-size:11.5px;color:var(--zpe);margin-top:2px}
.zdk-tab .n{text-align:right;white-space:nowrap}
.zdk-tab.kv td:first-child{width:42%;padding-right:14px;font-size:13px;color:var(--zpe)}
.zdk-tab .h{font-size:22px}.zdk-tab small.zdk-cap{display:block;font-family:var(--fh);font-size:14px;line-height:1.3;color:var(--zw);margin-top:4px}.zdk-tab small.zdk-cap[hidden]{display:none}.zdk-tab .h.big{font-size:32px}
.zdk-tab td.rl{padding:0 0 4px;border-top:0}
.zdk-ticks{display:flex;flex-direction:column;gap:4px;margin:10px 0 6px}
.zdk-ticks button{display:grid;grid-template-columns:17px 1fr;column-gap:12px;align-items:baseline;text-align:left;font-family:var(--ft);font-size:14.5px;color:var(--zt);padding:5px 0}
.zdk-ticks button i{position:relative;flex:none;width:17px;height:17px;border:1.5px solid var(--zt);transform:translateY(3px)}
.zdk-ticks button[aria-checked="true"] i::after{content:'✓';position:absolute;left:0;top:-19px;font-family:var(--fh);font-weight:700;font-size:30px;color:var(--zi)}
.zdk-ticks small{grid-column:2;font-size:12px;color:var(--zpe)}
.zdk-tab .zdk-ticks{margin:0}.zdk-tab .zdk-ticks button{font-size:13.5px;padding:3px 0}
.zdk-amt{display:flex;align-items:baseline;gap:12px;margin:16px 0 0}
.zdk-amt .h{font-weight:700;font-size:54px}
.zdk-amt .t{margin:0}
/* the drafting ruler */
.zdk-ruler{position:relative;margin:2px 0 18px;padding-top:40px}.zdk-ruler.bare{padding-top:8px}
.zdk-ruler .mk{position:absolute;left:12px;right:12px;top:0;height:40px}
.zdk-ruler .mk span{position:absolute;bottom:3px;transform:translateX(-50%);font-family:var(--fh);font-size:14.5px;line-height:1;color:var(--zpe);white-space:nowrap}
.zdk-ruler .mk span::after{content:'';position:absolute;left:50%;top:100%;width:1px;height:7px;background:var(--zpe)}
.zdk-ruler .mk span.lo{bottom:21px}.zdk-ruler .mk span.lo::after{height:25px}
.zdk-ruler .mk span.r{transform:translateX(calc(-100% + 8px))}.zdk-ruler .mk span.r::after{left:auto;right:8px}
.zdk-ruler .strip{position:relative;height:46px;border:1px solid #aeb2ad;border-radius:2px;background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(232,236,230,.9));box-shadow:0 2px 4px rgba(30,40,50,.08)}
.zdk-ruler .in{position:absolute;left:12px;right:12px;top:0;bottom:0}
.zdk-ruler svg.g{position:absolute;left:0;top:0;width:100%;height:14px;overflow:visible}
.zdk-ruler svg.g line{stroke:#3d4247;stroke-width:1}
.zdk-ruler .nums{position:absolute;left:0;right:0;top:18px}
.zdk-ruler .nums span{position:absolute;transform:translateX(-50%);font-family:var(--ft);font-size:10.5px;color:#3d4247}
.zdk-ruler input{--p:50%;position:absolute;left:-9px;width:calc(100% + 18px);top:0;height:100%;margin:0;-webkit-appearance:none;appearance:none;background:none;cursor:ew-resize}
.zdk-ruler input::-webkit-slider-runnable-track{height:46px;background:none}
.zdk-ruler input::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:46px;border:0;background:radial-gradient(circle at 50% 5px,var(--zr) 4.5px,transparent 5px),linear-gradient(90deg,transparent 8px,var(--zr) 8px,var(--zr) 10px,transparent 10px)}
.zdk-ruler input::-moz-range-track{height:46px;background:none}
.zdk-ruler input::-moz-range-thumb{width:18px;height:46px;border:0;border-radius:0;background:radial-gradient(circle at 50% 5px,var(--zr) 4.5px,transparent 5px),linear-gradient(90deg,transparent 8px,var(--zr) 8px,var(--zr) 10px,transparent 10px)}
.zdk-ruler input:focus-visible{outline:2px solid var(--zi);outline-offset:2px}
.zdk-sigl{display:inline-flex;flex-direction:column;margin-top:22px;min-width:260px}
.zdk-sigl .h{font-size:26px;padding:0 0 2px 6px}
.zdk-sigl span:last-child{border-top:1px solid var(--zt);padding-top:4px;font-family:var(--ft);font-size:12px;color:var(--zpe)}
/* the actions sit on the desk, under the document */
.zdk-acts{display:flex;align-items:center;gap:4px;padding-top:16px}
.zdk-go{background:var(--zt);color:#fcfcf9;font-family:var(--f-sign);font-weight:700;font-size:19px;letter-spacing:.01em;padding:13px 26px;border-radius:2px;margin-right:8px;transition:background .15s}
.zdk-go:hover:not(:disabled){background:#000}
.zdk-go:disabled{background:#b4b9b5;color:#eef0ec;cursor:not-allowed}
.zdk-q{font-family:var(--ft);font-size:13.5px;color:var(--zt);text-decoration:underline;text-underline-offset:3px;padding:10px 10px}
.zdk-q:hover:not(:disabled){color:var(--zr)}
.zdk-q:disabled{opacity:.35;cursor:default}
/* the adviser's slip, clipped beside the document */
.zdk-note{grid-column:3;align-self:start;justify-self:start;position:relative;width:min(270px,calc(100% - 34px));margin:70px 0 0 34px;padding:26px 22px 20px;background:#fbf5d3;color:#26292c;transform:rotate(1.3deg);box-shadow:0 12px 26px rgba(30,40,50,.16),0 1px 2px rgba(30,40,50,.12);font-family:var(--fh);font-size:16.5px;line-height:1.4}
.zdk-note[hidden]{display:none}
.zdk-note.arrive{animation:zdkSlip .5s .15s cubic-bezier(.2,.7,.2,1) both}
.zdk-note::before{content:'';position:absolute;left:22px;top:-14px;width:12px;height:38px;border:2px solid #868b90;border-radius:7px;transform:rotate(-6deg)}
.zdk-note h3{font-family:var(--fh);font-weight:700;font-size:20px;line-height:1.15;margin:0 0 6px;color:var(--zt)}
.zdk-note h3+p{margin-top:0}
.zdk-note p{margin:8px 0 0}
.zdk-note h3:not(:first-child){margin-top:18px}
.zdk-odds{display:flex;align-items:center;gap:12px;margin:4px 0}
.zdk-odds b{font-family:var(--fh);font-weight:700;font-size:38px;line-height:1}
.zdk-odds .bar{flex:1;height:9px;border:1.5px solid #4a4e52;border-radius:1px;position:relative}
.zdk-odds .bar i{position:absolute;left:0;top:0;bottom:0;transition:width .3s,background .3s}
.zdk-rv{list-style:none;margin:4px 0 0;padding:0;font-size:14.5px}
.zdk-rv li{margin:0 0 8px}.zdk-rv b{display:block;font-weight:700;color:var(--zt)}
.zdk-dscr{margin:12px 0 4px}.zdk-dscr[hidden]{display:none}
.zdk-dscr>b{display:block;font-family:var(--fh);font-weight:700;font-size:40px;line-height:1;margin-bottom:10px}.zdk-dscr>b small{font-size:16px;font-weight:400;color:#26292c}
.zdk-dscr .sc{position:relative;display:flex;height:10px;border:1.5px solid #4a4e52}
.zdk-dscr .sc i{display:block;height:100%}
.zdk-dscr .sc .a{flex:.2;background:repeating-linear-gradient(45deg,rgba(194,42,46,.55) 0 2px,transparent 2px 5px)}
.zdk-dscr .sc .b{flex:.2;background:repeating-linear-gradient(45deg,rgba(176,109,18,.5) 0 2px,transparent 2px 6px);border-left:1.5px solid #4a4e52;border-right:1.5px solid #4a4e52}
.zdk-dscr .sc .c{flex:.6}
.zdk-dscr .sc span{position:absolute;top:-8px;width:3px;height:22px;background:var(--zt);transform:translateX(-50%);transition:left .3s}
.zdk-dscr .lb{position:relative;height:20px;margin-top:4px;font-size:13.5px}
.zdk-dscr .lb span{position:absolute;white-space:nowrap}
/* duty paper */
.zdk-doc.duty{--guil:none;border:13px solid transparent;background:linear-gradient(#eff4ed,#eff4ed) padding-box,var(--guil) border-box;padding:24px 38px 30px}
.zdk-duty{display:grid;grid-template-columns:auto 1fr auto;gap:18px;align-items:center;border:1.5px solid #2e7a57;padding:10px 16px;margin-bottom:20px;color:#21533c;background:rgba(255,255,255,.5)}
.zdk-duty .den b{display:block;font-family:var(--fd);font-weight:700;font-size:30px;line-height:1}
.zdk-duty .den span,.zdk-duty .ser span{display:block;font-family:var(--ft);font-size:10.5px;margin-top:3px}
.zdk-duty .dc{display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--ft);font-weight:700;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase}
.zdk-duty .ser{text-align:right}.zdk-duty .ser b{font-family:var(--ft);font-weight:700;font-size:15px;color:var(--zr)}
.zdk-cah{display:flex;align-items:center;gap:16px;margin:0 0 16px}
.zdk-cah h2{margin:0}
.zdk-cah .hi{font-family:var(--fhi);font-size:20px;margin:2px 0 0;color:#3a3f44}
.zdk-parties,.zdk-cl{margin:0 0 14px;padding-left:24px;font-family:var(--ft);font-size:14px;line-height:1.6}
.zdk-parties li,.zdk-cl li{margin:0 0 3px;padding-left:4px}
.zdk-parties .h,.zdk-cl .h{font-size:17.5px}
.zdk-sigs{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 24px;margin-top:20px}
.zdk-sigs .s{position:relative;display:flex;flex-direction:column}
.zdk-sigs .ink{height:52px;display:flex;align-items:flex-end}
.zdk-sigs .ink svg{height:48px;max-width:100%}
.zdk-sigs .s>span{border-top:1px solid var(--zt);padding-top:5px;font-family:var(--ft);font-size:12px;line-height:1.35}
.zdk-sigs .s>small{font-family:var(--ft);font-size:11px;color:var(--zpe);margin-top:2px}
.zdk-sigs .s.me{grid-column:1/-1;margin-top:6px}
.zdk-flag{position:absolute;left:-30px;top:50px;z-index:2;padding:7px 22px 7px 10px;background:#f2c230;color:#1d2024;font-family:var(--f-sign);font-weight:700;font-size:14px;letter-spacing:.08em;text-transform:uppercase;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%);box-shadow:0 2px 4px rgba(0,0,0,.2);pointer-events:none;transition:opacity .25s,transform .25s}
.zdk-flag.gone{opacity:0;transform:translateX(-12px)}
.zdk[data-stage="3"] .zdk-main{grid-template-columns:minmax(230px,1fr) minmax(640px,760px) minmax(100px,.5fr)}
.zdk-sigs .s.me>span .h{font-size:19px}
.zdk-pad{position:relative;height:118px;cursor:crosshair;background:linear-gradient(90deg,rgba(31,58,138,.04),rgba(31,58,138,0) 70%)}
.zdk-pad canvas{display:block;width:100%;height:100%}
.zdk-pad .hint{position:absolute;left:12px;bottom:10px;font-family:var(--fh);font-size:20px;color:rgba(31,58,138,.38);pointer-events:none;transition:opacity .2s}

.zdk-pad .hint.gone{opacity:0}
/* rubber stamps and the seal */
.zdk-stamp{--tf:rotate(-9deg);position:absolute;right:44px;top:118px;z-index:3;padding:7px 16px 6px;border:3px solid var(--zr);outline:1.5px solid var(--zr);outline-offset:3px;color:var(--zr);text-align:center;pointer-events:none;mix-blend-mode:multiply;filter:url(#zdkInk);transform:var(--tf);opacity:.9}
.zdk-stamp b{display:block;font-family:var(--f-sign);font-weight:700;font-size:34px;line-height:1;letter-spacing:.07em;text-transform:uppercase}
.zdk-stamp small{display:block;margin-top:3px;font-family:var(--f-sign);font-weight:600;font-size:12px;letter-spacing:.14em}
.zdk-stamp.down{animation:zdkStamp .3s cubic-bezier(.3,1.5,.5,1) both}
.zdk-stamp.big{--tf:translate(50%,-50%) rotate(-11deg);right:42%;top:38%}
.zdk-stamp.big b{font-size:66px}.zdk-stamp.big small{font-size:15px}
.zdk-stamp.mini{--tf:rotate(-9deg) scale(.42);right:10px;top:auto;bottom:16px;transform-origin:right bottom;filter:none;animation:none}
.zdk-seal{--tf:rotate(14deg);position:absolute;right:7%;bottom:-8px;width:116px;height:116px;color:var(--zr);opacity:0;pointer-events:none;mix-blend-mode:multiply;filter:url(#zdkInk);transform:var(--tf)}
.zdk-seal svg{display:block;width:100%;height:100%}
.zdk-seal.down{animation:zdkStamp .3s cubic-bezier(.3,1.5,.5,1) both}
/* the finale: the paperwork clears and the camera pushes into the plan */
.zdk.finale .zdk-main,.zdk.finale .zdk-pile,.zdk.finale .zdk-top,.zdk.finale .zdk-tb{animation:zdkAway .6s ease-in forwards}
.zdk.finale .zdk-plan{transition:transform 1.5s cubic-bezier(.5,0,.2,1),opacity 1.5s;transform:scale(1.9);transform-origin:44% 46%;opacity:.55}
.zdk.finale{animation:zdkFade .7s .75s ease-in forwards}
@keyframes zdkPlot{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes zdkPlotter{0%{opacity:.9;transform:translateX(0)}92%{opacity:.9}100%{opacity:0;transform:translateX(calc(86vw))}}
@keyframes zdkArrive{from{opacity:0;transform:translateY(70px) rotate(1.4deg)}to{opacity:1;transform:none}}
@keyframes zdkLeave{to{opacity:0;transform:translate(-34vw,40px) rotate(-7deg) scale(.36)}}
@keyframes zdkThud{0%{transform:none}35%{transform:translateY(3px) scale(.997)}100%{transform:none}}
@keyframes zdkFile{from{opacity:0;transform:translate(26vw,30px) rotate(0) scale(1.9)}to{opacity:1;transform:rotate(var(--r))}}
@keyframes zdkSlip{from{opacity:0;transform:translateX(40px) rotate(4deg)}to{opacity:1;transform:rotate(1.3deg)}}
@keyframes zdkStamp{0%{opacity:0;transform:var(--tf) scale(2.3)}100%{opacity:.9;transform:var(--tf) scale(1)}}
@keyframes zdkAway{to{opacity:0;transform:translateY(24px)}}
@keyframes zdkFade{to{opacity:0}}
@media (prefers-reduced-motion:reduce){.zdk-plan,.zdk-plotter,.zdk-doc.arrive,.zdk-doc.leave,.zdk-doc.thud,.zdk-card,.zdk-note.arrive{animation:none}.zdk-plotter{display:none}.zdk-stamp.down,.zdk-seal.down{animation:none;opacity:.9}.zdk.finale{animation:none}}
@media (max-width:1280px){.zdk-tb{right:12px;bottom:10px;font-size:9.5px}.zdk-tb td{padding:3px 7px}.zdk-main{grid-template-columns:minmax(200px,1fr) minmax(540px,600px) minmax(220px,1fr);padding:0 20px 18px}.zdk-doc{padding:30px 38px 28px}.zdk-pile{width:170px}.zdk-card{width:150px;height:196px}.zdk-note{margin-left:24px;width:min(240px,calc(100% - 24px))}}
/*@ob-end*/
/*@bm board meeting: the board minutes on white bond, AERA's order clipped on top on duty paper */
.zbm .zdk-plan{animation:none;opacity:.5}
.zbm .zdk-main{grid-template-columns:minmax(230px,1fr) minmax(600px,680px) minmax(250px,1fr)}
.zbm .zdk-doc{padding:36px 54px 40px 46px}
.zbm-att{margin:2px 0 18px}.zbm-att td{padding:5px 0}.zbm-att td.lb{font-size:12.5px;color:var(--zpe);border-top:0;padding:6px 0 2px}
.zbm-att tr:last-child td{border-bottom:0;padding-top:8px}
.zbm-min{position:relative;display:grid;grid-template-columns:40px 1fr;margin:20px 0 0}
.zbm-no{font-family:var(--ft);font-weight:700;font-size:14.5px;line-height:1.5;padding-top:1px}
.zbm-b h3{font-family:var(--ft);font-weight:700;font-size:14.5px;line-height:1.5;margin:0 0 6px;text-decoration:underline;text-underline-offset:3px}
.zbm-ini{position:absolute;right:-46px;top:0;width:36px;height:26px;border-bottom:1px dotted #9a9fa3;text-align:center}
.zbm-ini .h{font-size:17px;line-height:26px}
/* the regulator's order, on duty paper, clipped to the minutes */
.zbm-order{--guil:none;position:relative;margin:8px -14px 6px 26px;padding:16px 22px 14px;border:10px solid transparent;background:linear-gradient(#eff4ed,#eff4ed) padding-box,var(--guil) border-box;transform:rotate(-1.1deg);box-shadow:0 10px 22px rgba(30,40,50,.18),0 1px 3px rgba(30,40,50,.12)}
.zbm-clip{position:absolute;left:34px;top:-26px;width:14px;height:50px;border:2.2px solid #81878c;border-radius:8px;transform:rotate(-8deg);z-index:2}
.zbm-clip::after{content:'';position:absolute;left:2px;right:2px;top:6px;bottom:12px;border:2px solid #81878c;border-top:0;border-radius:0 0 6px 6px}
.zbm-ol{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border:1.5px solid #2e7a57;padding:7px 12px;margin-bottom:12px;color:#21533c;background:rgba(255,255,255,.5)}
.zbm-ol>b{font-family:var(--fd);font-weight:700;font-size:22px;line-height:1}
.zbm-ol .dc{display:flex;flex-direction:column;gap:1px;text-align:center;text-wrap:balance;font-family:var(--ft);font-weight:700;font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1.35}
.zbm-ol .dc span[lang]{font-family:var(--fhi);font-weight:400;font-size:12px;letter-spacing:0;text-transform:none}
.zbm-ol .ser{text-align:right;font-family:var(--ft);font-size:10px}.zbm-ol .ser span{display:block}.zbm-ol .ser b{font-size:12.5px;color:var(--zr)}
.zbm-order h4{font-family:var(--fd);font-weight:700;font-size:19px;line-height:1.2;margin:0 0 8px}
.zbm-order .t{font-size:14px;margin:0 0 8px}.zbm-order .zbm-ask{margin:10px 0 0}
.zbm-order .zdk-ticks{margin:4px 0 0}
/* the capital budget */
.zbm-cb thead td,.zbm-cb thead td.n{border-top:0;padding:0 0 4px;font-size:12px;color:var(--zpe);vertical-align:bottom}
.zbm-cb td{padding:4px 0}.zbm-cb td.n{padding-left:12px;width:1%;vertical-align:top;padding-top:10px}
.zbm-cb .zdk-ticks{margin:0}.zbm-cb .zdk-ticks button{width:100%;font-size:14px;padding:5px 0 3px}
.zbm-cb .zdk-ticks b{font-weight:700}
.zbm-cb .zdk-ticks small{font-size:12px;line-height:1.45;margin-top:1px}
.zbm-cb small.zdk-cap{font-family:var(--fh);font-size:14px;color:var(--zw);grid-column:2}
.zbm-cb tr.off button{cursor:not-allowed}.zbm-cb tr.off b,.zbm-cb tr.off td.n{color:var(--zpe)}.zbm-cb tr.off i{border-color:#b4b8bb}
.zbm-cb tr.own b{text-decoration:line-through;text-decoration-color:var(--zpe)}.zbm-cb tr.own button{cursor:default}.zbm-cb tr.own i::after{color:var(--zpe)!important}
.zbm-cb tr.tot td{padding:8px 0;font-weight:700}.zbm-cb tr.tot .h{font-size:28px;font-weight:700}
/* dividend and early repayment */
.zbm-amt{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 12px;margin:14px 0 0}
.zbm-amt>.h{font-weight:700;font-size:38px;min-width:2.2em}
.zbm-amt .t{margin:0;font-size:14px}
.zbm .zbm-pen{font-family:var(--fh);font-size:15px;line-height:1.35;color:var(--zpe);margin:-8px 0 10px}.zbm .zbm-pen.warn{color:var(--zw)}
.zbm .zdk-err{color:var(--zr);font-size:12.5px;margin:6px 0 0}
.zbm .zdk-card{top:calc(var(--i)*60px)}.zbm .zdk-card span{font-size:13.5px;line-height:1.2}
.zdk-ruler.off{opacity:.45}.zdk-ruler.off input{cursor:not-allowed}
.zbm-res{position:relative}.zbm-res .zdk-sigl{margin-top:14px}.zbm-res .zdk-sigl .h{font-size:30px;min-height:34px}
.zdk-stamp.zbm-st{--tf:rotate(-8deg);right:-6px;top:auto;bottom:-6px}
.zdk-stamp.zbm-st b{font-size:46px}
/* the adviser's slip: three numbers */
.zbm .zdk-note{margin-top:46px;padding:24px 22px 18px}
.zbm .zdk-note h3{font-size:17px;margin:0 0 2px}.zbm .zdk-note h3:not(:first-child){margin-top:14px}
.zbm-big{display:block;font-family:var(--fh);font-weight:700;font-size:34px;line-height:1.1;color:var(--zt)}
.zbm-mood{display:block;font-family:var(--fh);font-weight:700;font-size:25px;line-height:1.15}
.zbm .zdk-note p{margin:2px 0 0;max-width:none;font-size:15px;line-height:1.35;color:#26292c}
.zbm .zdk-doc p{max-width:none}
.zbm .zdk-doc:focus{outline:none}
#zbmLeft.neg{color:var(--zr)}
@media (max-width:1280px){.zbm .zdk-main{grid-template-columns:minmax(190px,1fr) minmax(580px,620px) minmax(220px,1fr)}.zbm .zdk-doc{padding:28px 50px 32px 38px}.zbm .zdk-note{margin-top:30px}}
@media (prefers-reduced-motion:reduce){.zbm .zdk-doc.arrive{animation:none}}
/*@bm-end*/
/*@hb handback (year 60): the handover certificate, on duty paper */
.zdk-hb .zdk-main{grid-template-columns:minmax(230px,.8fr) minmax(600px,740px) minmax(330px,1fr)}
.zdk-hb .zdk-note p{color:#26292c;font-size:16px;max-width:none}
.zdk-hb #zhbDoc:focus{outline:none}
.zdk-sigs.hb .zdk-stamp.big{top:24%;right:50%;white-space:nowrap}
.zdk-hb .zdk-ticks.insp button{cursor:default}
.zdk-hb .zdk-ticks.insp button[aria-checked="true"] i::after{color:var(--zt)}
.zdk-hb .zdk-tab .h.big{font-size:30px}
.zhb-own{display:flex;justify-content:space-between;gap:12px;padding:1px 0}.zhb-own .h{font-size:19px}
.zdk-sigs.hb{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 30px}
.zdk-sigs.hb .s.then .ink{height:118px;align-items:center}
.zdk-sigs.hb .s.then img{display:block;max-height:96px;max-width:100%;width:auto}
.zdk-sigs.hb .s.then em{font-family:var(--fh);font-style:normal;font-size:16px;color:var(--zpe)}
.zdk-sigs.hb .s>span .h{font-size:19px}
.zdk-sigs.hb .zdk-flag{left:-18px}
.zdk-sigs.hb .zdk-seal{right:-4%;width:104px;height:104px}
/*@hb-end*/
/*@cs construction (years 1-4): the site progress register on drafting paper, then the DGCA aerodrome licence */
.zdk-sigs .ink{height:62px}.zdk-sigs .ink svg.zsg{height:62px;max-width:100%;overflow:visible;margin-bottom:-10px}
.zdk-sigs .s>span b{font-weight:700}
.zcs .zdk-main{grid-template-columns:minmax(200px,.75fr) minmax(660px,800px) minmax(250px,1fr)}
.zcs .zdk-card{top:calc(var(--i)*52px)}.zcs .zdk-card span{font-size:13px;line-height:1.2}
.zcs-doc{background-color:#fcfcf9;background-image:linear-gradient(rgba(40,100,140,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(40,100,140,.07) 1px,transparent 1px);background-size:12px 12px;padding:30px 40px 34px}
.zcs-doc h2{margin-bottom:10px}
.zcs-doc .t{font-size:14px}
.zcs-g{--nw:228px;position:relative;display:grid;grid-template-columns:var(--nw) 1fr;margin:14px 0 6px;border-top:1.5px solid var(--zt);border-bottom:1.5px solid var(--zt)}
.zcs-n{font-family:var(--ft);font-size:12.5px;line-height:1.2;padding:5px 10px 4px 0;border-bottom:1px dotted #c3c6c1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zcs-n small{display:block;font-family:var(--fh);font-size:12.5px;color:var(--zpe);line-height:1.1}
.zcs-t{position:relative;border-bottom:1px dotted #c3c6c1;border-left:1px solid #9a9fa3;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(100%/var(--a,6) - 1px),rgba(29,32,36,.16) calc(100%/var(--a,6) - 1px),rgba(29,32,36,.16) calc(100%/var(--a,6)))}
.zcs-h{font-weight:700;font-size:12px;color:var(--zpe);padding-top:6px}
.zcs-ax{height:36px}.zcs-ax span{position:absolute;top:4px;text-align:center;font-family:var(--ft);font-size:11.5px;font-weight:700;line-height:1.1}
.zcs-ax small{display:block;font-weight:400;font-size:10.5px;color:var(--zpe)}
.zcs-t .bar{position:absolute;top:5px;bottom:5px;border:1.3px solid #4a4f54;background:repeating-linear-gradient(-45deg,rgba(74,79,84,.22) 0 1px,transparent 1px 5px)}
.zcs-t .bar b{position:absolute;left:0;top:0;bottom:0;background:repeating-linear-gradient(-45deg,rgba(31,58,138,.75) 0 2px,rgba(31,58,138,.18) 2px 4px);transition:width .7s cubic-bezier(.4,0,.2,1)}
.zcs-t .late{position:absolute;top:5px;bottom:5px;border:1.3px dashed var(--zw);border-left:0;background:repeating-linear-gradient(45deg,rgba(176,109,18,.35) 0 2px,transparent 2px 6px)}
.zcs-t em{position:absolute;top:1px;margin-left:6px;font-family:var(--fh);font-style:normal;font-size:13.5px;color:var(--zw);white-space:nowrap}
.zcs-lg{font-weight:700;padding-top:8px}
.zcs-led{height:38px}.zcs-led span{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center}
.zcs-led span .h{font-size:22px;font-weight:700}.zcs-led em{font-family:var(--fh);font-style:normal;font-size:15px;color:#a9adb0}
.zcs .zdk-doc:focus{outline:none}
.zcs-cum{height:36px;display:flex;align-items:center}.zcs-cum i{flex:none;height:24px;display:flex;align-items:center;justify-content:flex-end;box-sizing:border-box;background:rgba(31,58,138,.82);transition:width .7s}
.zcs-cum span{padding:0 10px;font-family:var(--ft);font-size:12.5px;line-height:1;white-space:nowrap}.zcs-cum .h{font-size:19px}.zcs-cum i span,.zcs-cum i span .h{color:#fcfcf9}
.zcs-ph,.zcs-op{position:absolute;top:0;bottom:-6px;left:calc(var(--nw) + (100% - var(--nw)) * var(--ph));width:2px;margin-left:-1px;background:var(--zr);transition:left .7s cubic-bezier(.4,0,.2,1);z-index:2}
.zcs-ph::before{content:'';position:absolute;left:-5px;top:-6px;width:12px;height:12px;border-radius:50%;background:var(--zr)}
.zcs-ph span{position:absolute;bottom:-20px;left:6px;font-family:var(--fh);font-size:13.5px;color:var(--zr);white-space:nowrap}
.zcs-op{left:calc(var(--nw) + (100% - var(--nw)) * var(--op));background:none;border-left:2px dashed var(--zt);width:0;z-index:1}
.zcs-op span{position:absolute;top:-38px;left:-2px;padding:2px 7px;background:var(--zt);color:#fcfcf9;font-family:var(--f-sign);font-weight:700;font-size:12.5px;letter-spacing:.04em;line-height:1.1;white-space:nowrap}
.zcs-op.late{border-left-color:var(--zw)}.zcs-op.late span{background:var(--zw)}
.zcs-g{margin-top:46px}
.zcs-ent{display:grid;grid-template-columns:70px 1fr;gap:6px;margin:30px 0 0;padding-top:4px}
.zcs-ent .t{margin:0}.zcs-ent.turn{animation:zcsTurn .5s cubic-bezier(.2,.7,.2,1) both;transform-origin:left center}
.zcs-let{position:relative;margin:22px -10px 6px 30px;padding:16px 22px 12px;background:#fffefa;transform:rotate(-.8deg);box-shadow:0 10px 22px rgba(30,40,50,.18),0 1px 3px rgba(30,40,50,.12);border-top:5px solid var(--zt)}
.zcs-let.arrive{animation:zcsLet .55s .2s cubic-bezier(.2,.7,.2,1) both}
.zcs-let header{padding-left:26px;display:flex;justify-content:space-between;gap:12px;font-family:var(--ft);font-size:11.5px;color:var(--zpe);margin-bottom:8px}
.zcs-let h4{font-family:var(--fd);font-weight:700;font-size:20px;line-height:1.2;margin:0 0 6px}
.zcs-let .t{font-size:13.5px;margin:0 0 6px}.zcs-let .zdk-ticks{margin:2px 0 0}.zcs-let .zdk-ticks small{font-size:12.5px}
.zcs-pen{font-family:var(--fh);font-size:15px;color:var(--zw);min-height:20px;margin:4px 0 0}
.zcs .zdk-note{margin-top:46px;padding:24px 22px 18px}
.zcs .zdk-note h3{font-size:17px;margin:0 0 2px}.zcs .zdk-note h3:not(:first-child){margin-top:14px}
.zcs .zdk-note p{margin:2px 0 0;font-size:15px;line-height:1.35;color:#26292c}
.zcs-lic{padding:22px 38px 30px}
.zcs-lic .zdk-duty .den b{font-size:26px}.zcs-lic .zdk-duty .dc .hi{font-family:var(--fhi);font-weight:400;letter-spacing:0;text-transform:none;font-size:14px}
.zcs-rec{margin:0;padding-left:18px;font-size:13px}
.zcs-sigs{grid-template-columns:repeat(2,minmax(0,1fr));align-items:end}
.zcs-st{min-height:100px}.zcs-st .zdk-stamp.zcs-lst{right:auto;left:10px;top:auto;bottom:6px}
.zcs-open{font-size:24px;padding:16px 36px;letter-spacing:.03em}
.zcs-day{position:absolute;left:50%;top:44%;z-index:5;transform:translate(-50%,-50%) rotate(-6deg);padding:14px 40px 12px;border:5px solid var(--zr);outline:2px solid var(--zr);outline-offset:5px;color:var(--zr);text-align:center;background:rgba(252,252,249,.55);mix-blend-mode:multiply;filter:url(#zdkInk);pointer-events:none;--tf:translate(-50%,-50%) rotate(-6deg)}
.zcs-day b{display:block;font-family:var(--f-sign);font-weight:700;font-size:112px;line-height:.95;letter-spacing:.06em;text-transform:uppercase}
.zcs-day span{display:block;margin-top:6px;font-family:var(--f-sign);font-weight:600;font-size:20px;letter-spacing:.16em;text-transform:uppercase}
.zcs-day.down{animation:zdkStamp .38s cubic-bezier(.3,1.5,.5,1) both}
.zdk.finale .zcs-day{animation:none;opacity:.9}
@keyframes zcsTurn{from{opacity:0;transform:perspective(600px) rotateY(-24deg) translateX(-12px)}to{opacity:1;transform:none}}
@keyframes zcsLet{from{opacity:0;transform:translate(40px,30px) rotate(3deg)}to{opacity:1;transform:rotate(-.8deg)}}
@media (max-width:1280px){.zcs .zdk-main{grid-template-columns:minmax(170px,.6fr) minmax(640px,700px) minmax(230px,1fr)}.zcs-g{--nw:200px}.zcs-n{font-size:11.5px}.zcs-doc{padding:26px 32px 30px}.zcs-day b{font-size:90px}}
@media (prefers-reduced-motion:reduce){.zcs-ent.turn,.zcs-let.arrive,.zcs-day.down{animation:none}.zcs-ph,.zcs-t .bar b,.zcs-cum i{transition:none}}
/*@cs-end*/
`;

/* ---------- mount ---------- */
let mounted=false;
M.mount=function(){
  if(mounted)return;const app=$('#app');if(!app)return;mounted=true;
  const st=document.createElement('style');st.id='zmmCss';st.textContent=CSS;document.head.appendChild(st);
  // floater layer sits above the map canvas, under the HUD panels
  const fl=document.createElement('div');fl.id='zmmFloat';const map=$('#map');if(map&&map.nextSibling)app.insertBefore(fl,map.nextSibling);else app.appendChild(fl);
  // overlay for the money dialogs (separate from the game's own #overlay)
  const ov=document.createElement('div');ov.id='zmmOv';ov.hidden=true;ov.innerHTML='<div class="zmm-sheet" id="zmmSheet" role="dialog" aria-modal="true"></div>';app.appendChild(ov);
  // keys typed in a money dialog belong to it: the game's window shortcuts (Space pauses, 1-3 set speed) must not see them
  ov.addEventListener('keydown',e=>e.stopPropagation());
  // P&L tab in the right rail
  const bar=document.querySelector('#tabs .tabbar'),tabs=$('#tabs');
  if(bar&&tabs){const b=document.createElement('button');b.dataset.tab='pl';b.id='zmmPLBtn';b.textContent='P&L';b.hidden=true;bar.appendChild(b);
    const body=document.createElement('div');body.className='tabbody';body.id='zmmPLTab';body.hidden=true;body.innerHTML='<div id="zmmPL"><p class="note">The day\'s money appears here once a shift is running.</p></div>';tabs.appendChild(body);
    bar.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const mine=t===b;body.hidden=!mine;b.classList.toggle('on',mine);
      if(mine){bar.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));tabs.querySelectorAll('.tabbody').forEach(x=>{if(x!==body)x.hidden=true;});}},true);}
};
M.enable=function(on){M.mount();const c=$('#zmmChip');if(on&&!c)buildChip();if(!on&&c)c.remove();const b=$('#zmmPLBtn');if(b)b.hidden=!on;if(!on){const t=$('#zmmPLTab');if(t&&!t.hidden){t.hidden=true;const first=document.querySelector('#tabs .tabbar button');if(first)first.click();}}};

/* ---------- top-strip chip ---------- */
let hist=[],lastTotal=null;
function buildChip(){const k=$('#kpis');if(!k)return;const d=document.createElement('div');d.className='zmm-chip';d.id='zmmChip';
  d.title='Profit so far this shift: everything the airport earned minus everything it spent. The small number is the current rate per hour.';
  d.innerHTML='<div class="k">Today <span class="tick"></span></div><div class="v">₹0.0 cr</div><div class="r">—</div><canvas width="200" height="28" aria-hidden="true"></canvas>';
  k.insertBefore(d,k.firstChild);}
M.setDay=function(o){M.mount();let c=$('#zmmChip');if(!c){buildChip();c=$('#zmmChip');if(!c)return;}
  const v=+o.total||0;c.querySelector('.v').textContent=fmt(v);c.classList.toggle('up',v>0);c.classList.toggle('dn',v<0);
  c.querySelector('.r').textContent=o.ratePerHr==null?'—':fmt(o.ratePerHr,{sign:true})+' an hour';
  if(lastTotal!=null&&Math.abs(v-lastTotal)>=0.005){const t=c.querySelector('.tick');const d=v-lastTotal;t.textContent=fmt(d,{sign:true});t.style.color=d>=0?'var(--go)':'var(--stop)';t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),900);}
  lastTotal=v;hist=o.history?o.history.slice(-60):hist.concat([v]).slice(-60);drawSpark(c.querySelector('canvas'));};
function drawSpark(cv){const g=cv.getContext('2d');const W=cv.width,H=cv.height;g.clearRect(0,0,W,H);if(hist.length<2)return;
  const mn=Math.min(0,...hist),mx=Math.max(0,...hist),sp=(mx-mn)||1;const X=i=>i/(hist.length-1)*(W-2)+1,Y=v=>H-2-(v-mn)/sp*(H-4);
  g.strokeStyle='rgba(255,255,255,.18)';g.beginPath();g.moveTo(0,Y(0));g.lineTo(W,Y(0));g.stroke();
  g.lineWidth=2;g.strokeStyle=hist[hist.length-1]>=0?'#3ad07f':'#ff4d3f';g.beginPath();hist.forEach((v,i)=>i?g.lineTo(X(i),Y(v)):g.moveTo(X(i),Y(v)));g.stroke();}

/* ---------- floaters on the map ---------- */
const live=[];
M.float=function(sx,sy,amount,opt){M.mount();opt=opt||{};const fl=$('#zmmFloat');if(!fl||!isFinite(sx)||!isFinite(sy))return;
  const now=performance.now();for(let i=live.length-1;i>=0;i--)if(now-live[i].t>1700)live.splice(i,1);
  const near=live.find(o=>Math.abs(o.x-sx)<44&&Math.abs(o.y-sy)<28&&(o.amt>=0)===(amount>=0)&&now-o.t<900);
  if(near){near.amt+=amount;near.el.textContent=(opt.label?opt.label+' ':'')+fmt(near.amt,{sign:true});return;}
  if(live.length>=(opt.max||6)){const o=live.shift();o.el.remove();}
  const e=document.createElement('div');e.className='zmm-f '+(amount>=0?'rev':'cost')+(Math.abs(amount)>=(opt.bigAt||1)?' big':'');
  e.textContent=(opt.label?opt.label+' ':'')+fmt(amount,{sign:true});e.style.left=sx+'px';e.style.top=sy+'px';fl.appendChild(e);
  live.push({x:sx,y:sy,amt:amount,el:e,t:now});setTimeout(()=>e.remove(),1850);};

/* ---------- P&L tab ---------- */
M.setPL=function(lines,opt){M.mount();opt=opt||{};const box=$('#zmmPL');if(!box)return;
  const rev=lines.filter(l=>l.kind==='rev'),cost=lines.filter(l=>l.kind==='cost');const sum=a=>a.reduce((s,l)=>s+(+l.amount||0),0);
  const R=sum(rev),C=sum(cost),mx=Math.max(1e-9,...lines.map(l=>Math.abs(+l.amount||0)));
  const row=l=>`<tr class="${l.kind}" title="${esc(l.why||'')}"><td>${l.term?`<span class="term" tabindex="0" data-k="${esc(l.term)}">${esc(l.label)}</span>`:esc(l.label)}${l.sub?`<span class="why">${esc(l.sub)}</span>`:''}<div class="bar" style="width:${Math.abs(l.amount)/mx*100}%;background:${l.kind==='rev'?'#3ad07f':'#ff4d3f'}"></div></td><td class="a">${fmt(l.kind==='cost'?-Math.abs(l.amount):l.amount)}</td></tr>`;
  box.innerHTML=`<table><thead><tr><th>${esc(opt.title||'This shift')}</th><th style="text-align:right">₹</th></tr></thead><tbody>`+
   rev.map(row).join('')+`<tr class="sum"><td>Revenue</td><td class="a">${fmt(R)}</td></tr>`+
   cost.map(row).join('')+`<tr class="sum"><td>Costs</td><td class="a">${fmt(-Math.abs(C))}</td></tr>`+
   `<tr class="sum"><td>Profit before interest</td><td class="a" style="color:${R-C>=0?'var(--go)':'var(--stop)'}">${fmt(R-C)}</td></tr></tbody></table>`+(opt.note?`<p class="note">${esc(opt.note)}</p>`:'');};

/* ---------- dialog plumbing ---------- */
function open(html,cls){M.mount();const ov=$('#zmmOv'),sh=$('#zmmSheet');sh.className='zmm-sheet'+(cls?' '+cls:'');ov.classList.toggle('ob',/zmm-ob/.test(cls||''));sh.onkeydown=null;sh.innerHTML=html;ov.hidden=false;sh.scrollTop=0;const f=sh.querySelector('[autofocus]')||sh.querySelector('button,input');if(f)setTimeout(()=>{f.focus({preventScroll:true});sh.scrollTop=0;},30);return sh;}
function close(){const ov=$('#zmmOv');if(ov)ov.hidden=true;}
M.close=close;
const stepper=(names,i)=>`<div class="steps">${names.map((n,k)=>`<span class="${k===i?'on':k<i?'done':''}">${k+1} · ${esc(n)}</span>`).join('')}</div>`;

/* ---------- shared paper helpers: the deal desk, the board meeting and later paper screens use these ---------- */
const H=s=>`<span class="h">${esc(s)}</span>`;               // a handwritten fill-in
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const stampDate=d=>{d=d||new Date();return `${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()].slice(0,3).toUpperCase()} ${d.getFullYear()}`;};
/* a red rubber stamp, dated (today unless a date is passed), with the SPV's short name */
function stampHtml(word,cls,d){return `<div class="zdk-stamp ${cls||''}" aria-label="Stamped: ${esc(word)}"><b>${esc(word)}</b><small>${stampDate(d)} · ${esc(M.cfg.spvShort)}</small></div>`;}
/* a drafting ruler over a range input: graduations, pencilled benchmarks, a red cursor */
function ruler(id,min,max,step,val,label,marks,fmtv){
  const span=(max-min)||1,ticks=[];const major=span/5;
  for(let k=0;k<=50;k++){const x=k*2;ticks.push(`<line x1="${x}%" x2="${x}%" y1="0" y2="${k%10===0?13:k%5===0?9:5}"/>`);}
  const nums=[0,1,2,3,4,5].map(k=>`<span style="left:${k*20}%">${fmtv(min+major*k)}</span>`).join('');
  let last=-99,lane=0;
  const mk=(marks||[]).slice().sort((a,b)=>a.val-b.val).map(m=>{const p=(m.val-min)/span*100;lane=p-last<24?1-lane:0;last=p;
    return `<span class="m${lane?' lo':''}${p>80?' r':''}" style="left:${p}%">${esc(m.name)} ${fmtv(m.val)}</span>`;}).join('');
  return `<div class="zdk-ruler${mk?'':' bare'}"><div class="mk" aria-hidden="true">${mk}</div><div class="strip"><div class="in"><svg class="g" aria-hidden="true">${ticks.join('')}</svg><div class="nums" aria-hidden="true">${nums}</div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${esc(label)}"></div></div></div>`;}
/* the duty-paper security border, as a CSS url() tile */
const guilTile=()=>'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 44 44"><rect width="44" height="44" fill="#dfeadf"/>'+rosette(22,22,19)+'</svg>')+'")';
/* the grainy rubber-ink filter that stamps and seals use */
const INK_DEFS=`<svg class="zdk-defs" width="0" height="0" aria-hidden="true"><defs>
  <filter id="zdkInk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.55" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter></defs></svg>`;

/* ---------- onboarding: the deal desk ----------
   A full-screen desk for a laptop. The desk is an engineering drawing sheet with VSI's masterplan plotted on it.
   Four documents cross it one at a time, and only the current one is shown: incorporation, the financial bid,
   the lenders' term sheet, and the Concession Agreement on duty paper. Each is filled in by hand and stamped,
   then joins the stack on the left. The player signs the agreement with the trackpad, after AAI, the state and
   L5 Capital, and the game begins.
   opts: {defaultName, founderName, capexCr, partners:[{name,pct,color,role}], rivals:[{name,blurb}],
          bidTypes:{share|ppf:{min,max,step,def,benchmarks:[{name,val}]}}, gearing:{min,max,def},
          previewBid(bid)->{winPct,note}, previewClose({gearing,repayment,bid})->{equityCr,debtCr,parentCr,minDscr,note}}
   resolves {parent, founder, bid:{type,value}, gearing, repayment, signature (PNG data URL), signedOn, endsOn (YYYY-MM-DD), quick?}
   or null for "Not now". The agreement is dated the day the player signs; the concession ends the day before its 60th anniversary.
   partners[0] is the player's company; its pct drives every "you own" line. */
M.onboarding=function(opts){opts=opts||{};
  loadDeskFonts();
  const T=opts.bidTypes||{share:{min:10,max:50,step:0.5,def:30},ppf:{min:100,max:450,step:5,def:250}};
  const G=opts.gearing||{min:60,max:75,def:70};
  const PH=opts.phase1||null,SL=opts.stateLoan||null,LN=opts.lenders||null;   // LN: who lends, if the economy offers a choice   // optional close choices: phase-1 size, and the State's interest-free loan
  const capexNow=()=>{const o=PH&&PH.options.find(x=>x.id===st.phase1);return o&&o.capexCr||opts.capexCr||60000;};
  const coName=M.cfg.coinvestor.name.split(':')[0];
  const P=(opts.partners||[{name:'',pct:64,role:'Promoter. Builds, finances and runs the airport.'},
    {name:coName,pct:16,role:'Co-investor. Sells you its stake at board meetings, up to 80% in all.'},
    {name:'Airports Authority of India',pct:10,role:'State partner'},
    {name:'State of Maharashtra, through MADC',pct:10,role:'Gives the land on a nominal lease'}]).map(p=>Object.assign({},p));
  const pp=P[0].pct;
  const st={parent:opts.defaultName||'',founder:opts.founderName||'',bid:{type:'share',value:T.share.def},gearing:G.def,repayment:'sculpted',sig:null,quick:false,phase1:PH?(PH.def||PH.options[0].id):null,stateLoan:SL?SL.def!==false:null,lender:LN?(LN.def||LN.options[0].id):null};
  const bidTxt=b=>b.type==='share'?(+b.value).toFixed(b.value%1?1:0)+'%':'₹'+b.value;
  const bidLong=b=>b.type==='share'?bidTxt(b)+' of everything the airport earns':bidTxt(b)+' for every passenger';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now=new Date(),MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
  const dateLong=`${ord(now.getDate())} day of ${MON[now.getMonth()]} ${now.getFullYear()}`;
  const dShort=d=>`${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
  const endDate=new Date(now.getFullYear()+M.cfg.years,now.getMonth(),now.getDate()-1);   // the concession runs to the day before the anniversary
  const today=dShort(now),ends=dShort(endDate);
  const pvClose=()=>{const c=capexNow(),loan=st.stateLoan?c*(SL.pct||14.17)/100:0;
    const q=opts.previewClose?opts.previewClose({gearing:st.gearing,repayment:st.repayment,bid:st.bid,phase1:st.phase1,stateLoan:st.stateLoan,lender:st.lender}):
      {debtCr:(c-loan)*st.gearing/100,equityCr:(c-loan)*(1-st.gearing/100),parentCr:(c-loan)*(1-st.gearing/100)*pp/100,minDscr:null,note:''};
    if(q.stateLoanCr==null)q.stateLoanCr=loan;q.capexCr=c;q.askedCr=(c-q.stateLoanCr)*st.gearing/100;return q;};

  return new Promise(res=>{
  let finished=false;
  const done=v=>{if(finished)return;finished=true;close();res(v);};
  const plan=document.getElementById('planTpl');
  const sh=open(`<div class="zdk" data-stage="0">
    <svg class="zdk-defs" width="0" height="0" aria-hidden="true"><defs>
      <filter id="zdkInk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.55" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
</defs></svg>
    <div class="zdk-sheet" aria-hidden="true">
      <div class="zdk-plan" id="zdkPlan">${plan?plan.innerHTML:''}</div><i class="zdk-plotter"></i>
      <table class="zdk-tb"><tr><td colspan="2">${esc(M.cfg.airportName)}, Nagpur</td></tr><tr><td>Master plan, phase 1</td><td>Sheet MP-01</td></tr><tr><td>Scale 1 : 25,000</td><td>Rev. C</td></tr></table>
    </div>
    <header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div><button class="zdk-exit" id="zdkX">Not now</button></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents completed"></div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc" id="zdkDoc"></article><div class="zdk-acts" id="zdkActs"></div></div>
      <aside class="zdk-note" id="zdkNote" aria-live="polite"></aside></main>
  </div>`,'zmm-ob');
  const desk=sh.querySelector('.zdk');
  const GUIL='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 44 44"><rect width="44" height="44" fill="#dfeadf"/>'+rosette(22,22,19)+'</svg>')+'")';
  sh.querySelector('#zdkX').onclick=()=>done(null);
  sh.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&e.target.tagName==='INPUT'&&e.target.type!=='range'){const g=sh.querySelector('.zdk-go');if(g&&!g.disabled){e.preventDefault();g.click();}}};

  const docEl=sh.querySelector('#zdkDoc'),actsEl=sh.querySelector('#zdkActs'),noteEl=sh.querySelector('#zdkNote');
  function show(stage,doc,acts,note){desk.dataset.stage=stage;
    docEl.className='zdk-doc'+(stage===3?' duty':'');if(stage===3)docEl.style.setProperty('--guil',GUIL);docEl.innerHTML=doc;actsEl.innerHTML=acts;
    noteEl.innerHTML=note||'';noteEl.hidden=!note;
    if(!reduce){docEl.classList.remove('arrive');void docEl.offsetWidth;docEl.classList.add('arrive');noteEl.classList.remove('arrive');void noteEl.offsetWidth;noteEl.classList.add('arrive');}
    docEl.scrollTop=0;}
  /* stamp the current document, then file it on the stack */
  function stampAndFile(word,title,next){
    actsEl.querySelectorAll('button').forEach(b=>b.disabled=true);
    docEl.insertAdjacentHTML('beforeend',stampHtml(word,'down'));
    const pile=sh.querySelector('#zdkPile'),n=pile.children.length;
    const card=document.createElement('div');card.className='zdk-card';card.style.setProperty('--r',[-4,3,-2,5][n%4]+'deg');card.style.setProperty('--i',n);
    card.innerHTML=`<span>${esc(title)}</span><i></i><i></i><i class="s"></i>${stampHtml(word,'mini')}`;
    if(reduce){pile.appendChild(card);next();return;}
    setTimeout(()=>{docEl.classList.add('leave');},560);
    setTimeout(()=>{pile.appendChild(card);next();},980);}
  const inkUp=n=>sh.querySelector('#zdkPlan').style.setProperty('--ink',n);

  /* 1 · incorporation */
  function docInc(){inkUp(0);
    show(0,`<header class="zdk-dh">${vsiLogo(26)}<span>Form INC-1 · Concession company</span><span class="dt">${today}</span></header>
      <h2>Formation of the concession company</h2>
      <p class="t">We, the undersigned promoter, apply to form a special purpose company to hold the concession for ${esc(M.cfg.airportName)}, Nagpur, for ${M.cfg.years} years: from ${today} to ${ends}.</p>
      <label class="zdk-f"><span>Name of the promoter company</span><input id="zdkCo" maxlength="40" value="${esc(st.parent)}" placeholder="Your company" autocomplete="off" spellcheck="false"></label>
      <label class="zdk-f"><span>Name of the director who signs for it</span><input id="zdkMe" maxlength="40" value="${esc(st.founder)}" placeholder="Your name" autocomplete="off" spellcheck="false"></label>
      <p class="zdk-err" id="zdkErr" role="alert"></p>
      <p class="t">Name of the concession company: ${H(M.cfg.spvName)} (${esc(M.cfg.spvShort)}). Its shares are to be held as follows.</p>
      <table class="zdk-tab"><tbody>${P.map((p,k)=>`<tr><td>${k===0?`<span class="h" id="zdkCoT">${esc(st.parent||'')}</span>`:esc(p.name)}<small>${esc(p.role||'')}</small></td><td class="n">${p.pct}%</td></tr>`).join('')}</tbody></table>`,
      `<button class="zdk-go" id="zdkN">File for incorporation</button><button class="zdk-q" id="zdkQ">Skip to signing, on standard terms</button>`,
      `<h3>How ${esc(M.cfg.spvShort)} is owned</h3><p>Bengaluru's airport was built this way: a private majority, with AAI and the state as minority partners.</p><p>${esc(coName)} puts in money beside you. At board meetings you can buy its stake, up to 80% in all.</p>`);
    const co=sh.querySelector('#zdkCo'),me=sh.querySelector('#zdkMe'),coT=sh.querySelector('#zdkCoT'),err=sh.querySelector('#zdkErr');
    setTimeout(()=>(st.parent?me:co).focus({preventScroll:true}),60);
    co.oninput=()=>{coT.textContent=co.value;err.textContent='';};me.oninput=()=>{err.textContent='';};
    const ok=()=>{const a=co.value.trim(),b=me.value.trim();
      if(a.length<2){err.textContent='Write the company name, at least two characters.';co.focus();return false;}
      if(b.length<2){err.textContent='Write your name as the director who signs.';me.focus();return false;}
      st.parent=a;st.founder=b;P[0].name=a;return true;};
    sh.querySelector('#zdkN').onclick=()=>{if(ok())stampAndFile('Incorporated','Incorporation',docBid);};
    sh.querySelector('#zdkQ').onclick=()=>{if(!ok())return;st.quick=true;st.bid={type:'share',value:T.share.def};st.gearing=G.def;st.repayment='sculpted';
      stampAndFile('Incorporated','Incorporation',docCA);};}

  /* 2 · the financial bid */
  function docBid(){inkUp(1);
    const draw=()=>{const t=st.bid.type,c=T[t];if(st.bid.value<c.min||st.bid.value>c.max)st.bid.value=c.def;
      const fv=v=>t==='share'?(+v).toFixed(v%1?1:0)+'%':'₹'+Math.round(v);
      const rivals=opts.rivals||M.cfg.rivals;
      show(1,`<header class="zdk-dh">${vsiLogo(26)}<span>Form F · Financial bid · sealed</span><span class="dt">${today}</span></header>
        <h2>Financial bid</h2>
        <p class="t">To the Airports Authority of India. For the concession of ${esc(M.cfg.airportName)}, ${H(st.parent)} offers to pay the Authority, every year for ${M.cfg.years} years:</p>
        <div class="zdk-ticks" role="radiogroup" aria-label="Type of payment">
          <button role="radio" data-t="share" aria-checked="${t==='share'}"><i></i>a share of everything the airport earns <small>as Delhi and Mumbai pay</small></button>
          <button role="radio" data-t="ppf" aria-checked="${t==='ppf'}"><i></i>a fee for every passenger <small>as Adani's six airports pay</small></button></div>
        <div class="zdk-amt"><span class="h" id="zdkBV">${bidTxt(st.bid)}</span><span class="t">${t==='share'?'of everything the airport earns':'per passenger'}</span></div>
        ${ruler('zdkBR',c.min,c.max,c.step,st.bid.value,'Your offer',c.benchmarks,fv)}
        <p class="t">This offer is unconditional and holds for the whole term.</p>
        <div class="zdk-sigl"><span class="h">${esc(st.founder)}</span><span>for ${esc(st.parent)}</span></div>`,
        `<button class="zdk-go" id="zdkN">Seal and submit the bid</button><button class="zdk-q" id="zdkB">Back</button>`,
        `<h3>Your odds</h3><div class="zdk-odds"><b id="zdkWP"></b><span class="bar"><i id="zdkW"></i></span></div><p id="zdkWT"></p>
         <h3>Also bidding</h3><ul class="zdk-rv">${rivals.map(r=>`<li><b>${esc(r.name)}</b>${esc(r.blurb)}</li>`).join('')}</ul>`);
      const r=sh.querySelector('#zdkBR');
      const upd=()=>{st.bid.value=+r.value;r.style.setProperty('--p',(st.bid.value-c.min)/(c.max-c.min)*100+'%');sh.querySelector('#zdkBV').textContent=bidTxt(st.bid);
        const p=opts.previewBid?opts.previewBid({type:t,value:st.bid.value}):{winPct:50,note:''};
        const col=p.winPct>66?'var(--zg)':p.winPct>33?'var(--zw)':'var(--zr)';
        const w=sh.querySelector('#zdkW');w.style.width=Math.max(2,p.winPct)+'%';w.style.background=col;
        const wp=sh.querySelector('#zdkWP');wp.textContent=Math.round(p.winPct)+'%';wp.style.color=col;sh.querySelector('#zdkWT').textContent=p.note||'';};
      r.oninput=upd;upd();
      sh.querySelectorAll('.zdk-ticks button').forEach(b=>b.onclick=()=>{if(b.dataset.t===st.bid.type)return;st.bid={type:b.dataset.t,value:T[b.dataset.t].def};draw();
        if(!reduce)docEl.classList.remove('arrive');sh.querySelector(`.zdk-ticks [data-t="${b.dataset.t}"]`).focus();});
      sh.querySelector('#zdkN').onclick=()=>stampAndFile('Bid received','Financial bid',docDebt);
      sh.querySelector('#zdkB').onclick=docIncBack;};
    draw();}
  function docIncBack(){sh.querySelector('#zdkPile').lastElementChild?.remove();docInc();}

  /* 3 · the lenders' term sheet */
  function docDebt(){inkUp(2);
    show(2,`<header class="zdk-dh">${vsiLogo(26)}<span>Indicative term sheet</span><span class="dt">${today}</span></header>
      <h2>Loan offer from the banks</h2>
      <p class="t">From a group of Indian banks, to ${esc(M.cfg.spvName)}, to build phase 1 of the airport. The rest comes from the shareholders' own money.</p>
      <table class="zdk-tab kv"><tbody>
        ${PH?`<tr><td>Size of phase 1</td><td><div class="zdk-ticks" role="radiogroup" aria-label="Size of phase 1">${PH.options.map(o=>`<button role="radio" data-p="${esc(o.id)}" aria-checked="${st.phase1===o.id}"><i></i>${esc(o.label)} <small>${esc(o.small||'')}</small></button>`).join('')}</div></td></tr>`:''}
        <tr><td>Project cost</td><td><span id="zdkCap"></span></td></tr>
        ${SL?`<tr><td>Loan from the State</td><td><div class="zdk-ticks" role="radiogroup" aria-label="Loan from the State"><button role="radio" data-s="1" aria-checked="${!!st.stateLoan}"><i></i><span>accept a loan of <span class="h" id="zdkSL"></span></span> <small>${esc(SL.text||'interest-free, repaid from year 11')}</small></button><button role="radio" data-s="0" aria-checked="${!st.stateLoan}"><i></i>decline <small>borrow more from the banks instead</small></button></div></td></tr>`:''}
        ${LN?`<tr><td>Who lends</td><td><div class="zdk-ticks" role="radiogroup" aria-label="Who lends">${LN.options.map(o=>`<button role="radio" data-l="${esc(o.id)}" aria-checked="${st.lender===o.id}"><i></i>${esc(o.label)} <small>${esc(o.small||'')}</small></button>`).join('')}</div></td></tr>`:''}
        <tr><td>Share borrowed</td><td><span class="h big" id="zdkGV"></span></td></tr>
        <tr><td colspan="2" class="rl">${ruler('zdkGR',G.min,G.max,1,st.gearing,'Share borrowed',[],v=>Math.round(v)+'%')}</td></tr>
        <tr><td>Bank loan</td><td><span class="h" id="zdkD"></span><small class="zdk-cap" id="zdkDC" hidden></small></td></tr>
        <tr><td>Shareholders' own money</td><td><span class="h" id="zdkE"></span></td></tr>
        <tr><td>Of which ${esc(st.parent)} (${pp}%)</td><td><span class="h" id="zdkP"></span></td></tr>
        <tr><td>Repayment</td><td><div class="zdk-ticks" role="radiogroup" aria-label="Repayment">
          <button role="radio" data-r="sculpted" aria-checked="${st.repayment==='sculpted'}"><i></i>sculpted to traffic <small>small at first, larger later</small></button>
          <button role="radio" data-r="equal" aria-checked="${st.repayment==='equal'}"><i></i>equal instalments <small>less interest, tight early years</small></button></div></td></tr>
        <tr><td>The banks' condition</td><td>Every year, the airport must earn at least ₹110 for each ₹100 of loan repayment due. Below ₹120 the banks warn you. Below ₹100 they take control.</td></tr>
      </tbody></table>`,
      `<button class="zdk-go" id="zdkN">Accept the term sheet</button><button class="zdk-q" id="zdkB">Back</button>`,
      `<h3>Can ${esc(M.cfg.spvShort)} pay the banks?</h3><p>In its hardest year, the airport earns:</p>
       <div class="zdk-dscr" id="zdkDS"><b id="zdkMV"></b><div class="sc"><i class="a"></i><i class="b"></i><i class="c"></i><span id="zdkMK"></span></div>
       <div class="lb"><span style="left:0">banks take over</span><span style="left:50%">safe</span></div></div>
       <p id="zdkCN"></p><p>Borrowing more means you put in less of your own money, so you earn more on it. But there is less room if passengers come slower than planned.</p>`);
    const r=sh.querySelector('#zdkGR');
    const upd=()=>{st.gearing=+r.value;r.style.setProperty('--p',(st.gearing-G.min)/(G.max-G.min)*100+'%');const q=pvClose();
      sh.querySelector('#zdkCap').textContent=fmt(q.capexCr);const sl=sh.querySelector('#zdkSL');if(sl)sl.textContent=fmt(SL&&(SL.amountCr||q.capexCr*(SL.pct||14.17)/100));
      const dc=sh.querySelector('#zdkDC'),capped=q.debtCr<q.askedCr-0.5;dc.hidden=!capped;if(capped)dc.textContent=`You asked for ${fmt(q.askedCr)}. The banks will lend only what the forecast can repay; shareholders put in the rest.`;
      sh.querySelector('#zdkGV').textContent=st.gearing+'%';sh.querySelector('#zdkD').textContent=fmt(q.debtCr);sh.querySelector('#zdkE').textContent=fmt(q.equityCr);sh.querySelector('#zdkP').textContent=fmt(q.parentCr);
      const ds=sh.querySelector('#zdkDS');ds.hidden=q.minDscr==null;
      if(q.minDscr!=null){const v=q.minDscr,col=v<1?'var(--zr)':v<1.2?'var(--zw)':'var(--zg)';const mv=sh.querySelector('#zdkMV');mv.innerHTML=`₹${Math.round(v*100)} <small>for every ₹100 due</small>`;mv.style.color=col;
        const k=sh.querySelector('#zdkMK');k.style.left=Math.max(0,Math.min(100,(v-.8)*100))+'%';}
      sh.querySelector('#zdkCN').textContent=q.note||'';};
    r.oninput=upd;upd();
    sh.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{st.repayment=b.dataset.r;sh.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-checked',x===b));upd();});
    sh.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{st.lender=b.dataset.l;sh.querySelectorAll('[data-l]').forEach(x=>x.setAttribute('aria-checked',x===b));upd();});
    sh.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{st.phase1=b.dataset.p;sh.querySelectorAll('[data-p]').forEach(x=>x.setAttribute('aria-checked',x===b));upd();});
    sh.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{st.stateLoan=b.dataset.s==='1';sh.querySelectorAll('[data-s]').forEach(x=>x.setAttribute('aria-checked',x===b));upd();});
    sh.querySelector('#zdkN').onclick=()=>stampAndFile('Sanctioned','Term sheet',docCA);
    sh.querySelector('#zdkB').onclick=()=>{sh.querySelector('#zdkPile').lastElementChild?.remove();docBid();};}

  /* 4 · the Concession Agreement, on duty paper */
  function docCA(){inkUp(3);
    const q=pvClose();
    const SG=M.cfg.signatories,others=[{p:SG.aai,as:'the Authority'},{p:SG.state,as:'the State'},{p:SG.coinvestor,as:'the Co-investor'}];
    show(3,`<div class="zdk-duty"><div class="den"><b>₹ 500</b><span>Five hundred rupees</span></div>
        <div class="dc"><span>Stamp duty paid</span><span>Concession instrument</span></div>
        <div class="ser"><span>Serial</span><b>VSI ${String(127+Math.floor(now.getTime()/8.64e7)%800).padStart(6,'0')}</b></div></div>
      <header class="zdk-cah">${vsiLogo(44)}<div><h2>Concession Agreement</h2><p class="hi" lang="hi">रियायत करार</p></div></header>
      <p class="t">This agreement is made at Nagpur on the ${dateLong}, between:</p>
      <ol class="zdk-parties">
        <li>the <b>Airports Authority of India</b> ("the Authority");</li>
        <li>the <b>State of Maharashtra</b>, through the Maharashtra Airport Development Company ("the State");</li>
        <li>${H(M.cfg.spvName)} ("the Concessionaire");</li>
        <li>${H(st.parent)}, represented by its director ${H(st.founder)} ("the Promoter"); and</li>
        <li>${H(M.cfg.coinvestor.name)} ("the Co-investor").</li></ol>
      <p class="t">It is agreed that:</p>
      <ol class="zdk-cl">
        <li>The Concessionaire will design, build, finance and operate the airport for ${M.cfg.years} years, from ${H(today)} to ${H(ends)}, and then hand it back to the State.</li>
        <li>The Concessionaire will pay the Authority ${H(bidLong(st.bid))}, every year of the concession.</li>
        <li>Phase 1${PH?` (${esc((PH.options.find(o=>o.id===st.phase1)||{}).label||'')})`:''} costs ${fmt(q.capexCr)}: ${H(fmt(q.debtCr))} from ${esc(LN&&(LN.options.find(o=>o.id===st.lender)||{}).who||'the banks')}, repaid ${st.repayment==='sculpted'?'in instalments that grow with traffic':'in equal instalments'}${q.stateLoanCr>0.5?`, ${H(fmt(q.stateLoanCr))} as an interest-free loan from the State`:''}, and ${H(fmt(q.equityCr))} from shareholders, of which the Promoter provides ${H(fmt(q.parentCr))}.</li>
        <li>The Concessionaire's shares are held ${((a)=>a.slice(0,-1).join('; ')+'; and '+a[a.length-1])(P.map(p=>`${p.pct}% by ${k0(p)}`))}.</li>
        <li>Charges to airlines and passengers are set by AERA, every five years.</li></ol>
      <p class="t">Signed by the parties on the date above.</p>
      <div class="zdk-sigs">
        ${others.map(o=>sigBlock(o.p,o.as)).join('')}
        <div class="s me"><span class="zdk-flag" id="zdkFlag" aria-hidden="true">Sign here</span><div class="zdk-pad"><canvas id="zdkSig" aria-label="Sign here with your trackpad or mouse"></canvas><span class="hint" id="zdkHint">✕</span></div>
          <span>${H(st.founder)}</span><small>Director, for ${esc(st.parent)} and for ${esc(M.cfg.spvName)}</small>
          <div class="zdk-seal" id="zdkSeal" aria-hidden="true">${sealSvg()}</div></div>
      </div>`,
      `<button class="zdk-go" id="zdkN" disabled>Sign the concession</button><button class="zdk-q" id="zdkC" disabled>Clear</button><button class="zdk-q" id="zdkB">Back</button>`,'');
    const cv=sh.querySelector('#zdkSig');
    const pad=sigPad(cv,ok=>{sh.querySelector('#zdkN').disabled=!ok;sh.querySelector('#zdkC').disabled=pad.empty();sh.querySelector('#zdkHint').classList.toggle('gone',!pad.empty());sh.querySelector('#zdkFlag').classList.toggle('gone',!pad.empty());});
    // walk the reader down the agreement to the signature line, as a clerk would
    setTimeout(()=>{const t=sh.querySelector('.zdk-sigs');if(t&&!finished)docEl.scrollTo({top:Math.max(0,t.offsetTop-160),behavior:reduce?'auto':'smooth'});},reduce?0:900);
    sh.querySelector('#zdkC').onclick=()=>pad.clear();
    sh.querySelector('#zdkB').onclick=()=>{sh.querySelector('#zdkPile').lastElementChild?.remove();if(st.quick){st.quick=false;docInc();}else docDebt();};
    sh.querySelector('#zdkN').onclick=()=>execute(pad);}
  function k0(p){return p===P[0]?esc(st.parent):esc(p.name);}

  function execute(pad){
    st.sig=pad.png();pad.lock();actsEl.querySelectorAll('button').forEach(b=>b.disabled=true);
    const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const result={lender:st.lender,phase1:st.phase1,stateLoan:st.stateLoan,parent:st.parent,founder:st.founder,bid:Object.assign({},st.bid),gearing:st.gearing,repayment:st.repayment,signature:st.sig,signedOn:iso(now),endsOn:iso(endDate)};if(st.quick)result.quick=true;
    sh.querySelector('#zdkSeal').classList.add('down');
    const sigs=sh.querySelector('.zdk-sigs');
    if(reduce){sigs.insertAdjacentHTML('beforeend',stampHtml('Executed','down big'));setTimeout(()=>done(result),1200);return;}
    setTimeout(()=>sigs.insertAdjacentHTML('beforeend',stampHtml('Executed','down big')),520);
    setTimeout(()=>{docEl.classList.add('thud');},560);
    setTimeout(()=>{desk.classList.add('finale');},1900);
    setTimeout(()=>done(result),3300);}

  docInc();});
};

/* the document fonts: typed legal text, Indian handwriting, the title serif and Devanagari. Added once, beside the game's own. */
function loadDeskFonts(){if(document.getElementById('zdkFonts'))return;const l=document.createElement('link');l.id='zdkFonts';l.rel='stylesheet';
  l.href='https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Kalam:wght@400;700&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Tiro+Devanagari+Hindi&display=swap';document.head.appendChild(l);
  // the signatories' hands: one script face per person. display=block, so a signature never flashes in a fallback face
  const s=document.createElement('link');s.id='zdkSigFonts';s.rel='stylesheet';
  s.href='https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&family=Homemade+Apple&family=Monsieur+La+Doulaise&family=La+Belle+Aurore&family=Herr+Von+Muellerhoff&family=Allura&display=block';document.head.appendChild(s);}

/* VSI's mark: a ring, an orbit and a satellite, for the man who launched India into space */
function vsiLogo(s){return `<svg class="zdk-logo" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="15" fill="none" stroke="currentColor" stroke-width="2.4"/>
  <ellipse cx="24" cy="24" rx="22" ry="8" fill="none" stroke="currentColor" stroke-width="1.6" transform="rotate(-28 24 24)"/><circle cx="41.6" cy="14.2" r="3" fill="currentColor"/>
  <path d="M17 18 L24 32 L31 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}

/* the security pattern on duty paper: a hypotrochoid rosette, tiled */
function rosette(cx,cy,R0){const pts=[],R=10,r=3,d=7.2,k=R0/(R-r+d);for(let i=0;i<=600;i++){const t=i/600*Math.PI*6;pts.push(((R-r)*Math.cos(t)+d*Math.cos((R-r)/r*t))*k+cx,((R-r)*Math.sin(t)-d*Math.sin((R-r)/r*t))*k+cy);}
  let p='M'+pts[0].toFixed(1)+','+pts[1].toFixed(1);for(let i=2;i<pts.length;i+=2)p+='L'+pts[i].toFixed(1)+','+pts[i+1].toFixed(1);
  return `<path d="${p}" fill="none" stroke="#2e7a57" stroke-width=".55" opacity=".55"/><circle cx="${cx}" cy="${cy}" r="${R0*.32}" fill="none" stroke="#b23b6b" stroke-width=".5" opacity=".45"/>`;}

/* a countersignature that has already been made: seeded, so each party's hand is different but always the same */
function scribble(seed,ink){let q=seed*7919%233280;const rnd=()=>((q=(q*9301+49297)%233280)/233280);
  const f=n=>n.toFixed(1);let x=6,base=40,d='';
  // the capital: a tall stroke with a loop
  const capH=24+rnd()*10;d+=`M${f(x)},${f(base)} C${f(x+2)},${f(base-capH*.6)} ${f(x+6)},${f(base-capH)} ${f(x+9)},${f(base-capH)} S${f(x+14)},${f(base-capH*.5)} ${f(x+4)},${f(base-capH*.35)} `;
  x+=10;d+=`Q${f(x+3)},${f(base-6)} ${f(x+6)},${f(base)} `;x+=6;
  // the small letters: humps of varying width and height, a few loops
  const n=4+Math.floor(rnd()*4);
  for(let i=0;i<n;i++){const w=6+rnd()*7,h=6+rnd()*9,loop=rnd()<.3;
    if(loop){d+=`C${f(x+w*.2)},${f(base-h*1.6)} ${f(x+w)},${f(base-h*1.6)} ${f(x+w*.4)},${f(base-h*.3)} `;}
    d+=`C${f(x+w*.3)},${f(base-h)} ${f(x+w*.8)},${f(base-h)} ${f(x+w)},${f(base-(rnd()*2))} `;x+=w;}
  // a trailing stroke and an underline flourish
  d+=`q8,-6 14,-3 M${f(4+rnd()*6)},${f(base+6+rnd()*3)} C${f(x*.3)},${f(base+2)} ${f(x*.7)},${f(base+10)} ${f(x+18)},${f(base+1)}`;
  return `<svg viewBox="0 0 ${Math.ceil(x+26)} 54" preserveAspectRatio="xMinYMax meet"><path d="${d}" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}

/* a named person's signature, drawn in their own hand: their signing name set in a script face, slanted, tilted and
   weighted per person, then a flourish seeded from the name. Deterministic: the same person always signs the same way.
   p: a M.cfg.signatories entry, {name, sign?, hand:{...}}. Returns an SVG string. */
function signSvg(p){p=p||{};const h=Object.assign({font:'Kalam',size:32,adv:.5,slant:0,rot:-3,ink:'#1d1f22',weight:.2,flourish:'under'},p.hand||{});
  const txt=String(p.sign||p.name||'');let q=0;for(const c of String(p.name||txt))q=(q*31+c.charCodeAt(0))%233280;q=q||7;
  const rnd=()=>((q=(q*9301+49297)%233280)/233280),f=n=>n.toFixed(1);
  const tl=Math.max(30,Math.round(txt.length*h.size*h.adv)),x0=10,base=48;
  const rise=Math.max(0,Math.sin(-h.rot*Math.PI/180)*(tl+40));
  let fl='';const a=rnd(),b=rnd(),c=rnd();
  if(h.flourish==='under')fl=`M${f(-4+a*8)},${f(9+b*4)} C${f(tl*.25)},${f(4+c*6)} ${f(tl*.7)},${f(16+a*4)} ${f(tl+26+b*14)},${f(-2-c*6)}`;
  else if(h.flourish==='dash')fl=`M${f(tl*.06)},${f(10+a*3)} l${f(tl*.86)},${f(-3-b*3)} M${f(tl*.22)},${f(16+c*3)} l${f(tl*.5)},${f(-2-a*2)}`;
  else if(h.flourish==='loop')fl=`M${f(tl-4)},${f(-6)} c${f(16+a*6)},${f(-14-b*6)} ${f(26+c*6)},${f(10)} ${f(6)},${f(16)} c${f(-20)},${f(6)} ${f(-tl*.55)},${f(2+a*3)} ${f(-tl*.95)},${f(-2)}`;
  else if(h.flourish==='paraph')fl=`M${f(tl+2)},${f(-4)} l${f(7+a*3)},${f(10)} l${f(5)},${f(-15-b*4)} l${f(5)},${f(16)} l${f(9+c*4)},${f(-9)} M${f(-2)},${f(12+a*3)} q${f(tl*.5)},${f(-6)} ${f(tl+30)},${f(-2)}`;
  else if(h.flourish==='dot')fl=`M${f(tl+7)},${f(-1)} m-1.6,0 a1.6,1.6 0 1,0 3.2,0 a1.6,1.6 0 1,0 -3.2,0 M${f(tl*.1)},${f(11+a*3)} q${f(tl*.35)},${f(5)} ${f(tl*.7)},${f(-1-b*3)}`;
  const W=Math.ceil(x0+tl+52),top=-Math.ceil(10+rise);
  return `<svg class="zsg" viewBox="0 ${top} ${W} ${66-top}" preserveAspectRatio="xMinYMax meet" role="img" aria-label="Signed: ${esc(p.name||txt)}"><g transform="rotate(${h.rot} ${x0} ${base}) translate(${x0} ${base}) skewX(${-h.slant})">
    <text x="0" y="0" font-family="'${esc(h.font)}',cursive" font-size="${h.size}" textLength="${tl}" lengthAdjust="spacingAndGlyphs" fill="${h.ink}" stroke="${h.ink}" stroke-width="${h.weight}" stroke-linejoin="round">${esc(txt)}</text>
    ${fl?`<path d="${fl}" fill="none" stroke="${h.ink}" stroke-width="${1.3+h.weight}" stroke-linecap="round" stroke-linejoin="round"/>`:''}</g></svg>`;}
/* one signature block for a named signatory: their hand, their name, their title and whom they sign for */
function sigBlock(p,forWhom,cls){p=p||{};return `<div class="s${cls?' '+cls:''}"><div class="ink">${signSvg(p)}</div><span><b>${esc(p.name||'')}</b><br>${esc(p.title||'Authorised signatory')}</span><small>for ${esc(forWhom||p.org||'')}</small></div>`;}
M.signSvg=signSvg;

/* the concession company's seal, pressed in red beside the director's signature */
function sealSvg(){const t=(M.cfg.spvName+' · Common seal · ').toUpperCase();
  return `<svg viewBox="0 0 120 120"><defs><path id="zdkArc" d="M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0"/></defs>
  <circle cx="60" cy="60" r="57" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="60" cy="60" r="35" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <text font-size="8" letter-spacing=".9" fill="currentColor" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="700"><textPath href="#zdkArc">${esc(t)}</textPath></text>
  <g transform="translate(36 36)" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="15" stroke-width="2.4"/><ellipse cx="24" cy="24" rx="22" ry="8" stroke-width="1.6" transform="rotate(-28 24 24)"/><circle cx="41.6" cy="14.2" r="3" fill="currentColor" stroke="none"/><path d="M17 18 L24 32 L31 18" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/></g></svg>`;}

/* signature pad: pointer events (trackpad, mouse, pen, touch), ballpoint ink that thins as the hand speeds up */
function sigPad(cv,onChange){
  const g=cv.getContext('2d');let strokes=[],cur=null,locked=false,ink=0,w=2.4;const INK='#1f3a8a';
  function fit(){const r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;cv.width=Math.max(1,Math.round(r.width*d));cv.height=Math.max(1,Math.round(r.height*d));g.setTransform(d,0,0,d,0,0);redraw();}
  function pt(e){const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,t:e.timeStamp||performance.now()};}
  function seg(a,b,c,width){g.strokeStyle=INK;g.lineCap='round';g.lineJoin='round';g.lineWidth=width;g.beginPath();g.moveTo((a.x+b.x)/2,(a.y+b.y)/2);g.quadraticCurveTo(b.x,b.y,(b.x+c.x)/2,(b.y+c.y)/2);g.stroke();}
  function redraw(){const r=cv.getBoundingClientRect();g.clearRect(0,0,r.width,r.height);
    for(const s of strokes){if(s.length===1){g.fillStyle=INK;g.beginPath();g.arc(s[0].x,s[0].y,1.3,0,7);g.fill();continue;}
      for(let i=1;i<s.length;i++)seg(s[Math.max(0,i-2)],s[i-1],s[i],s[i].w||2.2);}}
  const changed=()=>onChange(ink>=60);
  cv.addEventListener('pointerdown',e=>{if(locked)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}const p=pt(e);p.w=w;cur=[p];strokes.push(cur);redraw();changed();});
  cv.addEventListener('pointermove',e=>{if(!cur||locked)return;const evs=e.getCoalescedEvents?e.getCoalescedEvents():[e];
    for(const ev of (evs.length?evs:[e])){const p=pt(ev),l=cur[cur.length-1],d=Math.hypot(p.x-l.x,p.y-l.y);if(d<0.7)continue;
      const v=d/Math.max(1,p.t-l.t),target=Math.max(1.05,Math.min(3,3.2-v*1.15));w=w*.72+target*.28;p.w=w;cur.push(p);ink+=d;seg(cur[Math.max(0,cur.length-3)],cur[cur.length-2],p,w);}
    changed();});
  const end=()=>{cur=null;changed();};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  cv.style.touchAction='none';requestAnimationFrame(fit);
  return {clear(){strokes=[];ink=0;redraw();changed();},empty:()=>strokes.length===0,png:()=>cv.toDataURL('image/png'),lock(){locked=true;}};}

/* ---------- board meeting (between eras): the board minutes ----------
   The page is the minutes of a VSIAL board meeting on white bond. AERA's tariff order, if there is one, is clipped on
   top on duty paper with a tick: accept it or appeal it. The investments are a capital budget with tick boxes; the
   dividend and the early repayment to the banks are set on drafting rulers. The adviser's slip shows three numbers
   only: today's money, the banks' mood in words, and the player's stake. Approving initials each minute and brings
   down a red APPROVED stamp; then the minutes join the stack and the decision resolves.
   opts: {era, years, year?, parent, parentPct?, founder?, partners?:[{name,pct}], cashCr, debtCr?, stakeValueCr?,
          dscr:{value, warn:1.2, covenant:1.1},
          aera:{title, text, canAppeal, appealText, acceptText?, orderNo?},
          investments:[{id, name, costCr, effect, why, payback, owned, disabled, reason, opens?, land?:{earnCr, aeraCr}}],
          dividend:{maxCr, lastCr?, blocked?, reason?}, prepay:{maxCr, savesPct?}, pile?:[{title, stamp}]}
   resolves {bought:[ids], appeal:bool, dividendCr, prepayCr, approvedOn:'YYYY-MM-DD'} */
M.boardMeeting=function(o){o=o||{};loadDeskFonts();return new Promise(res=>{
  const inv=o.investments||[],now=new Date(),era=o.era!=null?o.era:1;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coName=M.cfg.coinvestor.name.split(':')[0];
  const P=(o.partners||[{name:o.parent||'Your company',pct:o.parentPct!=null?o.parentPct:64},{name:coName,pct:16},
    {name:'Airports Authority of India',pct:10},{name:'State of Maharashtra, through MADC',pct:10}]).map(p=>Object.assign({},p));
  if(!o.partners&&o.parent)P[0].name=o.parent;
  const pp=P[0].pct;
  const chair=o.founder||'';
  const ini=(chair||P[0].name).split(/\s+/).filter(w=>/^[A-Za-z]/.test(w)).slice(0,3).map(w=>w[0].toUpperCase()+'.').join('');
  const today=`${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const D=o.dscr,warn=D&&D.warn||1.2,cov=D&&D.covenant||1.1;
  const mood=!D?null:D.value<1?{w:'Ready to take control',c:'var(--zr)'}:D.value<cov?{w:'Their condition is broken',c:'var(--zr)'}:D.value<warn?{w:'Warning you',c:'var(--zw)'}:{w:'Relaxed',c:'var(--zg)'};
  const divBlocked=o.dividend&&(o.dividend.blocked||(D&&D.value<cov));
  const fz=v=>v<0.5?'₹0':fmt(v),fr=v=>'₹'+Math.round(v).toLocaleString('en-IN');   // fr: the short figures printed on a ruler
  const nice=m=>{const r=m/100,p=Math.pow(10,Math.floor(Math.log10(Math.max(1,r))));return Math.max(1,[1,2,5,10].map(k=>k*p).find(x=>x>=r)||p*10);};
  const opens=i=>i.opens==null?'':typeof i.opens==='number'?'year '+i.opens:String(i.opens);
  const effect=i=>(i.effect||'')+(i.land?(i.effect?' ':'')+`Your land earns ${fmt(i.land.earnCr)} a year; AERA counts ${fmt(i.land.aeraCr)} of it against your airline charges.`:'');
  const sel=new Set();let appeal=false,div=0,pre=0,finished=false;
  const spendInv=()=>[...sel].reduce((s,id)=>s+(+(inv.find(i=>i.id===id)||{}).costCr||0),0);
  const pile=o.pile||[{title:'Concession Agreement',stamp:'Executed'}].concat(Array.from({length:Math.max(0,Math.min(3,era-1))},(_,k)=>({title:'Board minutes, era '+(era-Math.min(3,era-1)+k),stamp:'Approved'})));
  let no=0;const minute=(title,body)=>`<section class="zbm-min"><div class="zbm-no">${era}.${++no}</div><div class="zbm-b"><h3>${esc(title)}</h3>${body}</div><div class="zbm-ini" aria-hidden="true"></div></section>`;
  const plan=document.getElementById('planTpl');

  const order=o.aera?`<div class="zbm-order" id="zbmOrder"><span class="zbm-clip" aria-hidden="true"></span>
      <div class="zbm-ol"><b>AERA</b><div class="dc"><span>Airports Economic Regulatory Authority of India</span><span lang="hi">भारतीय विमानपत्तन आर्थिक विनियामक प्राधिकरण</span></div><div class="ser"><span>Tariff order</span><b>${esc(o.aera.orderNo||('No. '+String(era*7+3).padStart(2,'0')+'/'+String(o.years||'').replace(/[–-].*/,'')))}</b></div></div>
      <h4>${esc(o.aera.title||'Tariff order')}</h4><p class="t">${esc(o.aera.text||'')}</p>
      ${o.aera.canAppeal?`<p class="t zbm-ask">The board resolves to:</p><div class="zdk-ticks" role="radiogroup" aria-label="The regulator's order">
        <button role="radio" data-a="0" aria-checked="true"><i></i>accept the order <small>${esc(o.aera.acceptText||'Your charges are fixed for the five years. No quarrel with the airlines.')}</small></button>
        <button role="radio" data-a="1" aria-checked="false"><i></i>appeal it <small>${esc(o.aera.appealText||'')}</small></button></div>`:`<p class="t zbm-ask">The order is final. The board takes note of it.</p>`}</div>`:'';

  const budget=inv.length?`<table class="zdk-tab zbm-cb"><thead><tr><td>Item</td><td class="n">₹ cr</td><td class="n">Opens</td></tr></thead><tbody>
      ${inv.map(i=>`<tr class="${i.owned?'own':i.disabled?'off':''}"><td><div class="zdk-ticks"><button role="checkbox" data-id="${esc(i.id)}" aria-checked="${i.owned?'true':'false'}" ${i.owned||i.disabled?'disabled':''}><i></i><span><b>${esc(i.name)}</b></span>
        <small>${esc(i.owned?'Already built.':effect(i))}${!i.owned&&i.payback?` Pays for itself in about ${esc(i.payback)}.`:''}</small>${i.disabled&&i.reason?`<small class="zdk-cap">${esc(i.reason)}</small>`:''}</button></div></td>
        <td class="n">${i.owned?'—':esc(fmt(i.costCr).replace(/ cr$/,'').replace('₹',''))}</td><td class="n">${esc(i.owned?'built':opens(i))}</td></tr>`).join('')}
      <tr class="tot"><td>Total approved</td><td class="n" colspan="2"><span class="h" id="zbmTot">₹0</span></td></tr></tbody></table>`:'';

  const cash=o.dividend||o.prepay?`
      ${o.dividend?`<div class="zbm-amt"><span class="h" id="zbmDv">₹0</span><span class="t">paid to shareholders${pp!=null?`, of which ${esc(P[0].name)} gets <span class="h" id="zbmDvP">₹0</span>`:''}</span></div>
        ${ruler('zbmDR',0,o.dividend.maxCr,nice(o.dividend.maxCr),0,'Dividend to shareholders',o.dividend.lastCr?[{name:'last era',val:o.dividend.lastCr}]:[],fr)}
        ${divBlocked?`<p class="zbm-pen warn">${esc(o.dividend.reason||`The banks allow no dividend while the airport earns less than ₹${Math.round(cov*100)} for every ₹100 due.`)}</p>`:''}`:''}
      ${o.prepay?`<div class="zbm-amt"><span class="h" id="zbmPv">₹0</span><span class="t">repaid to the banks early</span></div>
        ${ruler('zbmPR',0,o.prepay.maxCr,nice(o.prepay.maxCr),0,'Repay the banks early',[],fr)}
        <p class="zbm-pen" id="zbmPN">Less interest from now on, and more room before the banks warn you.</p>`:''}`:'';

  const sh=open(`<div class="zdk zbm" data-stage="b">${INK_DEFS}
    <div class="zdk-sheet" aria-hidden="true"><div class="zdk-plan" id="zdkPlan" style="--ink:4">${plan?plan.innerHTML:''}</div>
      <table class="zdk-tb"><tr><td colspan="2">${esc(M.cfg.airportName)}, Nagpur</td></tr><tr><td>Minutes book</td><td>Era ${esc(era)}</td></tr><tr><td>${esc(o.years||'')}</td><td>${esc(M.cfg.spvShort)}</td></tr></table></div>
    <header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pile.slice(-4).map((p,n)=>`<div class="zdk-card" style="--r:${[-4,3,-2,5][n%4]}deg;--i:${n};animation:none"><span>${esc(p.title)}</span><i></i><i></i><i class="s"></i>${p.stamp?stampHtml(p.stamp,'mini'):''}</div>`).join('')}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc" id="zdkDoc" tabindex="-1" autofocus aria-label="Minutes of the board meeting">
      <header class="zdk-dh">${vsiLogo(26)}<span>Minutes book · ${esc(M.cfg.spvShort)}</span><span class="dt">${today}</span></header>
      <h2>Minutes of the board meeting</h2>
      <p class="t">Of ${esc(M.cfg.spvName)}, held at Zero Mile Tower, Nagpur, on ${H(today)}${o.years?`, before era ${esc(era)} (${esc(o.years)})`:''}${o.year?`, in year ${esc(o.year)} of the concession`:''}.</p>
      <table class="zdk-tab zbm-att"><tbody><tr><td colspan="2" class="lb">Present, for the shareholders</td></tr>
        ${P.map((p,k)=>`<tr><td>${k===0?H(p.name):esc(p.name)}${k===0&&chair?`<small>represented by ${esc(chair)}, in the chair</small>`:k===0?'<small>in the chair</small>':''}</td><td class="n">${esc(p.pct)}%</td></tr>`).join('')}
        <tr><td colspan="2" class="lb">In attendance: the company secretary, the chief financial officer, and the banks' observer.</td></tr></tbody></table>
      ${o.aera?minute('Tariff order',`<p class="t">The regulator's order for ${esc(o.years||'the next five years')}, clipped to these minutes, was tabled. The board resolved as ticked on it.</p>`)+order:''}
      ${inv.length?minute('Capital budget',`<p class="t">The board considered the following works. Those ticked are approved, to be paid from the company's money.</p>`+budget+`<p class="zdk-err" id="zbmErr" role="alert"></p>`):''}
      ${cash?minute('Dividend and early repayment',`<p class="t">Of the money left this era, the board resolved to pay:</p>`+cash):''}
      <div class="zbm-res" id="zbmRes">${minute('Resolution',`<p class="t">Resolved that the decisions above be approved, and that the directors carry them out.</p>
        <div class="zdk-sigl"><span class="h" id="zbmChair">&nbsp;</span><span>Chair${chair?', '+esc(chair):''}, for ${esc(P[0].name)}</span></div>`)}</div>
    </article><div class="zdk-acts" id="zdkActs"><button class="zdk-go" id="zbmGo">Approve the minutes</button></div></div>
    <aside class="zdk-note arrive" id="zdkNote" aria-live="polite">
      <h3>Today's money</h3><b class="zbm-big" id="zbmCash">${fmt(o.cashCr||0)}</b><p id="zbmLeft"></p>
      ${mood?`<h3>The banks</h3><b class="zbm-mood" style="color:${mood.c}">${mood.w}</b><p>The airport earns ₹${Math.round(D.value*100)} for every ₹100 due. They warn you below ₹${Math.round(warn*100)} and take control below ₹100.</p>`:''}
      <h3>Your stake</h3><b class="zbm-big">${esc(pp)}%</b><p>of ${esc(M.cfg.spvShort)}${o.stakeValueCr!=null?`, worth about ${fmt(o.stakeValueCr)}`:''}.</p>
    </aside></main></div>`,'zmm-ob');
  const $s=q=>sh.querySelector(q),docEl=$s('#zdkDoc');
  const ord=$s('#zbmOrder');if(ord)ord.style.setProperty('--guil',guilTile());
  if(!reduce){docEl.classList.add('arrive');}
  const upd=()=>{const inv$=spendInv(),left=(o.cashCr||0)-inv$-div-pre;
    const t=$s('#zbmTot');if(t)t.textContent=fz(inv$);
    const l=$s('#zbmLeft');l.textContent=`After these decisions: ${left<0?'−':''}${fmt(Math.abs(left))}`;l.classList.toggle('neg',left<0);
    const e=$s('#zbmErr');if(e)e.textContent=left<0?`That spends ${fmt(-left)} more than ${M.cfg.spvShort} has. Untick something, or pay out less.`:'';
    $s('#zbmGo').disabled=left<0;};
  sh.querySelectorAll('.zbm-cb button[data-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(sel.has(id))sel.delete(id);else sel.add(id);b.setAttribute('aria-checked',sel.has(id));upd();});
  sh.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{appeal=b.dataset.a==='1';sh.querySelectorAll('[data-a]').forEach(x=>x.setAttribute('aria-checked',x===b));});
  const rul=(id,max,set,out)=>{const r=$s(id);if(!r)return;const f=()=>{set(+r.value);r.style.setProperty('--p',(+r.value)/(max||1)*100+'%');out();upd();};r.oninput=f;f();return r;};
  if(o.dividend){const r=rul('#zbmDR',o.dividend.maxCr,v=>div=v,()=>{$s('#zbmDv').textContent=fz(div);const q=$s('#zbmDvP');if(q)q.textContent=fz(div*pp/100);});if(r&&divBlocked){r.disabled=true;r.closest('.zdk-ruler').classList.add('off');}}
  if(o.prepay)rul('#zbmPR',o.prepay.maxCr,v=>pre=v,()=>{$s('#zbmPv').textContent=fz(pre);const n=$s('#zbmPN');if(n&&o.prepay.savesPct&&pre>0.5)n.textContent=`Saves about ${fmt(pre*o.prepay.savesPct/100)} of interest a year, and gives more room before the banks warn you.`;});
  upd();
  $s('#zbmGo').onclick=()=>{if(finished)return;finished=true;
    sh.querySelectorAll('#zdkDoc button,#zdkDoc input,#zdkActs button').forEach(b=>b.disabled=true);
    const result={bought:[...sel],appeal,dividendCr:div,prepayCr:pre,approvedOn:iso(now)};
    const boxes=[...sh.querySelectorAll('.zbm-ini')],step=reduce?0:140;
    boxes.forEach((b,k)=>setTimeout(()=>{b.innerHTML=H(ini);},k*step));
    setTimeout(()=>{$s('#zbmChair').textContent=ini;const res$=$s('#zbmRes');
      docEl.scrollTo({top:docEl.scrollHeight,behavior:reduce?'auto':'smooth'});
      res$.insertAdjacentHTML('beforeend',stampHtml('Approved','down zbm-st'));if(!reduce)setTimeout(()=>docEl.classList.add('thud'),40);},boxes.length*step+120);
    const t0=boxes.length*step+120;
    if(reduce){setTimeout(()=>{close();res(result);},t0+900);return;}
    setTimeout(()=>docEl.classList.add('leave'),t0+1500);
    setTimeout(()=>{const pl=$s('#zdkPile'),n=pl.children.length;const c=document.createElement('div');c.className='zdk-card';c.style.setProperty('--r',[-4,3,-2,5][n%4]+'deg');c.style.setProperty('--i',Math.min(n,4));
      c.innerHTML=`<span>Board minutes, era ${esc(era)}</span><i></i><i></i><i class="s"></i>${stampHtml('Approved','mini')}`;pl.appendChild(c);},t0+1900);
    setTimeout(()=>{close();res(result);},t0+2700);};
  });};

/* ---------- income statement (end of a shift, an era, or the concession) ---------- */
/* opts: {band, title, sections:[{title, rows:[{label, amount, kind:'rev'|'cost'|'total'|'good'|'bad'}]}],
          hero, compare:[{name, value, me}], compareLabel, moments:[text], cta, cta2}
   resolves 'cta' or 'cta2' */
M.incomeStatement=function(o){o=o||{};return new Promise(res=>{
  const secs=(o.sections||[]).map(s=>`<tr class="h"><td colspan="2">${esc(s.title)}</td></tr>`+s.rows.map(r=>`<tr class="${r.kind==='total'?'t':r.kind==='good'?'g t':r.kind==='bad'?'b t':''}"><td>${esc(r.label)}</td><td class="a">${typeof r.amount==='string'?esc(r.amount):fmt(r.kind==='cost'?-Math.abs(r.amount):r.amount)}</td></tr>`).join('')).join('');
  const mx=Math.max(1,...(o.compare||[]).map(c=>c.value));
  const sh=open(`<div class="band"><span>${esc(o.band||'Income statement')}</span><span>${esc(M.cfg.spvShort)}</span></div><div class="in"><h1>${esc(o.title||'The numbers')}</h1>
   ${o.hero?`<div class="zmm-hero">${o.hero}</div>`:''}
   <table class="zmm-is">${secs}</table>
   ${o.compare&&o.compare.length?`<h2>${esc(o.compareLabel||'How much of each rupee each airport keeps')}</h2>${o.compare.map(c=>`<div class="zmm-cmp ${c.me?'me':''}"><span>${esc(c.name)}</span><div class="bar"><i style="width:${c.value/mx*100}%"></i></div><span class="mono">${c.value}%</span></div>`).join('')}`:''}
   ${o.moments&&o.moments.length?`<h2>The most expensive moments</h2><ul style="color:var(--ink-2);padding-left:18px">${o.moments.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}
   <div class="zmm-row"><button class="zmm-go" id="zmmI1">${esc(o.cta||'Continue')}</button>${o.cta2?`<button class="zmm-ghost" id="zmmI2">${esc(o.cta2)}</button>`:''}</div></div>`);
  sh.querySelector('#zmmI1').onclick=()=>{close();res('cta');};const b2=sh.querySelector('#zmmI2');if(b2)b2.onclick=()=>{close();res('cta2');};});};

/* ---------- handback (year 60): the handover certificate, on duty paper ----------
   The concession ends. VSIAL hands the airport back to AAI and the State. The certificate records sixty years in plain
   words; the player's day-one signature (from the Concession Agreement) sits beside an empty pad, and they sign again.
   opts: {founder, parent, signature (PNG data URL from onboarding), signedOn, endsOn (YYYY-MM-DD), stakePct, stakeValueCr,
          returnPct, paxTotalM, paidToStateCr, condition:'excellent'|'good'|'poor', assets:[text], owners:[{name,pct}], lines:[text]}
   resolves {signature (PNG data URL), signedOn (YYYY-MM-DD, the real day the player signed), handedBackOn (= endsOn)}, or null for "Close". */
M.handback=function(o){o=o||{};
  loadDeskFonts();
  const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parse=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null;};
  const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
  const now=new Date(),d0=parse(o.signedOn)||now,d1=parse(o.endsOn)||new Date(d0.getFullYear()+M.cfg.years,d0.getMonth(),d0.getDate()-1);
  const dLong=d=>`${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`,dDay=d=>`${ord(d.getDate())} day of ${MON[d.getMonth()]} ${d.getFullYear()}`;
  const dStamp=d=>`${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()].slice(0,3).toUpperCase()} ${d.getFullYear()}`;
  const stamp=(word,small,cls)=>`<div class="zdk-stamp ${cls||''}" aria-label="Stamped: ${esc(word)}"><b>${esc(word)}</b><small>${esc(small)} · ${esc(M.cfg.spvShort)}</small></div>`;
  const founder=o.founder||'The director',parent=o.parent||'Your company',yrs=M.cfg.years;
  const pax=v=>v==null?'—':v>=1000?(v/1000).toFixed(2).replace(/\.?0+$/,'')+' billion':Math.round(v).toLocaleString('en-IN')+' million';
  const pct=v=>v==null?'—':(+v).toFixed(1).replace(/\.0$/,'')+'%';
  const owners=(o.owners&&o.owners.length?o.owners:[{name:parent,pct:o.stakePct}]).filter(w=>w&&w.name);
  const cond=['excellent','good','poor'].indexOf(o.condition)<0?'good':o.condition;
  const COND=[['excellent','in excellent condition','nothing to repair'],['good','in good condition, with ordinary wear','repairs within the handover allowance'],['poor','in poor condition','repairs charged to '+M.cfg.spvShort]];
  const assets=(o.assets||[]).filter(Boolean),list=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GUIL='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 44 44"><rect width="44" height="44" fill="#dfeadf"/>'+rosette(22,22,19)+'</svg>')+'")';
  const plan=document.getElementById('planTpl');
  const late=new Date(d1.getFullYear()-5,d1.getMonth(),d1.getDate());
  const pile=[['Concession','Executed',dStamp(d0)],['Board minutes','Approved',dStamp(late)],['AERA orders','Filed',dStamp(late)]];
  return new Promise(res=>{
  let finished=false;const done=v=>{if(finished)return;finished=true;close();res(v);};
  const sh=open(`<div class="zdk zdk-hb" data-stage="hb">
    <svg class="zdk-defs" width="0" height="0" aria-hidden="true"><defs>
      <filter id="zdkInk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 1.55" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter></defs></svg>
    <div class="zdk-sheet" aria-hidden="true">
      <div class="zdk-plan" style="--ink:3;animation:none">${plan?plan.innerHTML:''}</div>
      <table class="zdk-tb"><tr><td colspan="2">${esc(M.cfg.airportName)}, Nagpur</td></tr><tr><td>Record drawing, as handed back</td><td>Sheet HB-60</td></tr><tr><td>Scale 1 : 25,000</td><td>Year ${yrs}</td></tr></table>
    </div>
    <header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div><button class="zdk-exit" id="zhbX">Close</button></header>
    <div class="zdk-pile" aria-label="Sixty years of paperwork">${pile.map((p,n)=>`<div class="zdk-card" style="--r:${[-4,3,-2][n]}deg;--i:${n};animation:none"><span>${esc(p[0])}</span><i></i><i></i><i class="s"></i>${stamp(p[1],p[2],'mini')}</div>`).join('')}</div>
    <main class="zdk-main"><div class="zdk-col">
      <article class="zdk-doc duty${reduce?'':' arrive'}" id="zhbDoc" tabindex="-1" autofocus aria-label="Handover Certificate" style="--guil:${GUIL.replace(/"/g,'&quot;')}">
        <div class="zdk-duty"><div class="den"><b>₹ 100</b><span>One hundred rupees</span></div>
          <div class="dc"><span>Stamp duty paid</span><span>Handover instrument</span></div>
          <div class="ser"><span>Serial</span><b>VSI ${String(127+Math.floor(d0.getTime()/8.64e7)%800).padStart(6,'0')}-H</b></div></div>
        <header class="zdk-cah">${vsiLogo(44)}<div><h2>Handover Certificate</h2><p class="hi" lang="hi">हस्तांतरण प्रमाणपत्र</p></div></header>
        <p class="t">This certifies that on the ${dDay(d1)}, at Nagpur, ${H(M.cfg.spvName)} handed ${esc(M.cfg.airportName)} back to the <b>Airports Authority of India</b> and the <b>State of Maharashtra</b>, at the end of the concession signed on ${H(dLong(d0))}: ${H(yrs+' years')}.</p>
        <table class="zdk-tab kv"><tbody>
          <tr><td>Term</td><td>${H(dLong(d0))} to ${H(dLong(d1))}</td></tr>
          <tr><td>Passengers served</td><td><span class="h big">${esc(pax(o.paxTotalM))}</span><small>over ${yrs} years</small></td></tr>
          ${assets.length?`<tr><td>Handed over in working order</td><td>${esc(list(assets))}</td></tr>`:''}
          <tr><td>Paid to the State and AAI</td><td><span class="h">${esc(fmt(o.paidToStateCr))}</span><small>over the whole concession</small></td></tr>
          <tr><td>Your return per year</td><td><span class="h">${esc(pct(o.returnPct))}</span><small>on the money ${esc(parent)} put in</small></td></tr>
          <tr><td>Condition at handback, as inspected by AAI</td><td><div class="zdk-ticks insp" role="radiogroup" aria-label="Condition at handback">${COND.map(c=>`<button role="radio" aria-checked="${c[0]===cond}" aria-disabled="true" tabindex="-1"><i></i>${esc(c[1])} <small>${esc(c[2])}</small></button>`).join('')}</div></td></tr>
          <tr><td>Owners of ${esc(M.cfg.spvShort)} at handback</td><td>${owners.map((w,k)=>`<div class="zhb-own">${k===0?H(w.name):esc(w.name)}<span>${esc(pct(w.pct))}</span></div>`).join('')}</td></tr>
        </tbody></table>
        ${o.lines&&o.lines.length?`<p class="t">The record also shows that:</p><ol class="zdk-cl">${o.lines.map(l=>`<li>${esc(l)}</li>`).join('')}</ol>`:''}
        <p class="t">Received by the parties below. The concession is closed.</p>
        <div class="zdk-sigs hb" id="zhbSigs">
          ${sigBlock(M.cfg.signatories.aai60,'the Airports Authority of India, receiving')}
          ${sigBlock(M.cfg.signatories.state60,'the State of Maharashtra, through MADC, receiving')}
          <div class="s then"><div class="ink" id="zhbThen">${o.signature?`<img alt="Your signature on the Concession Agreement" src="${esc(o.signature)}">`:`<em>on the Concession Agreement, in the stack</em>`}</div>
            <span>${H(founder)}</span><small>Day one · ${esc(dLong(d0))}</small></div>
          <div class="s now"><span class="zdk-flag" id="zhbFlag" aria-hidden="true">Sign here</span><div class="zdk-pad"><canvas id="zhbSig" aria-label="Sign again here with your trackpad or mouse"></canvas><span class="hint" id="zhbHint">✕</span></div>
            <span>${H(founder)}</span><small>Year ${yrs} · ${esc(dLong(d1))} · for ${esc(parent)} and ${esc(M.cfg.spvShort)}</small>
            <div class="zdk-seal" id="zhbSeal" aria-hidden="true">${sealSvg()}</div></div>
        </div>
      </article>
      <div class="zdk-acts"><button class="zdk-go" id="zhbN" disabled>Sign and hand back the airport</button><button class="zdk-q" id="zhbC" disabled>Clear</button></div></div>
      <aside class="zdk-note${reduce?'':' arrive'}" aria-live="polite">
        <h3>Sixty years, in one number</h3><div class="zdk-dscr"><b>${esc(pct(o.returnPct))} <small>a year</small></b></div>
        <p>Your return per year on everything ${esc(parent)} put in, counting every dividend that came back.</p>
        ${o.stakeValueCr!=null?`<h3>What you walk away with</h3><div class="zdk-dscr"><b>${esc(fmt(o.stakeValueCr))}</b></div><p>Your ${esc(pct(o.stakePct))} of ${esc(M.cfg.spvShort)} on the day you hand back. The airport itself now belongs to the State.</p>`:''}
      </aside></main>
  </div>`,'zmm-ob');
  const desk=sh.querySelector('.zdk'),docEl=sh.querySelector('#zhbDoc');
  sh.querySelector('#zhbX').onclick=()=>done(null);
  // trim the day-one signature to its ink, so the two hands sit at the same size
  const im=sh.querySelector('#zhbThen img');
  if(im)im.onload=()=>{im.onload=null;try{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;const g=c.getContext('2d');g.drawImage(im,0,0);
    const a=g.getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=-1,y1=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>16){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1<0)return;const p=6;x0=Math.max(0,x0-p);y0=Math.max(0,y0-p);x1=Math.min(c.width-1,x1+p);y1=Math.min(c.height-1,y1+p);
    const t=document.createElement('canvas');t.width=x1-x0+1;t.height=y1-y0+1;t.getContext('2d').drawImage(c,x0,y0,t.width,t.height,0,0,t.width,t.height);im.src=t.toDataURL('image/png');}catch(_){}};
  const go=sh.querySelector('#zhbN'),clr=sh.querySelector('#zhbC');
  const pad=sigPad(sh.querySelector('#zhbSig'),ok=>{go.disabled=!ok;clr.disabled=pad.empty();sh.querySelector('#zhbHint').classList.toggle('gone',!pad.empty());sh.querySelector('#zhbFlag').classList.toggle('gone',!pad.empty());});
  // walk the reader down to the two signatures, as a clerk would
  setTimeout(()=>{const t=sh.querySelector('#zhbSigs');if(t&&!finished)docEl.scrollTo({top:Math.max(0,t.offsetTop-150),behavior:reduce?'auto':'smooth'});},reduce?0:1100);
  clr.onclick=()=>pad.clear();
  go.onclick=()=>{
    const result={signature:pad.png(),signedOn:iso(new Date()),handedBackOn:iso(d1)};pad.lock();
    sh.querySelectorAll('.zdk-acts button,#zhbX').forEach(b=>b.disabled=true);
    sh.querySelector('#zhbSeal').classList.add('down');
    const sigs=sh.querySelector('#zhbSigs'),big=()=>sigs.insertAdjacentHTML('beforeend',stamp(yrs+' years','Handed over · '+dStamp(d1),'down big'));
    if(reduce){big();setTimeout(()=>done(result),1400);return;}
    setTimeout(big,520);setTimeout(()=>docEl.classList.add('thud'),560);
    setTimeout(()=>desk.classList.add('finale'),2400);setTimeout(()=>done(result),3800);};
  });
};
/* ?moneymock=handback, or window.__zmmHandbackDemo(): the certificate with sample numbers and a drawn day-one signature */
function hbSampleSig(){return new Promise(r=>{const svg=scribble(53,'#1f3a8a').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" ');
  const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=640;c.height=118;c.getContext('2d').drawImage(i,40,22,300,80);r(c.toDataURL('image/png'));};i.onerror=()=>r(null);
  i.src='data:image/svg+xml,'+encodeURIComponent(svg);});}
window.__zmmHandbackDemo=o=>hbSampleSig().then(sig=>M.handback(Object.assign({founder:'Asha Rao',parent:'Meridian Infra',signature:sig,signedOn:'2026-10-19',endsOn:'2086-10-18',
  stakePct:68,stakeValueCr:21400,returnPct:14.6,paxTotalM:4180,paidToStateCr:198000,condition:'good',
  assets:['four runways','Terminals 1 and 2','Satellites G and H','Zero Mile Tower','the APM train','the airport city'],
  owners:[{name:'Meridian Infra',pct:68},{name:'L5 Capital',pct:12},{name:'Airports Authority of India',pct:10},{name:'State of Maharashtra, through MADC',pct:10}],
  lines:['The banks were repaid in full in year 24.','The tightest year was year 31, when the airport earned ₹94 for every ₹100 due, and the banks let you keep it.','Penalties to airlines came to ₹3,900 cr over sixty years.']},o||{})));
(function(){const go=()=>{if(/[?&]moneymock=handback\b/.test(location.search))window.__zmmHandbackDemo().then(r=>{window.__zmmResult=r;});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else setTimeout(go,0);})();

/* ---------- construction (years 1–4, between signing and opening day): the site progress register ----------
   One page per year on drafting paper: a schedule of the works with a red playhead at the end of the year, the money
   drawn that year on a ledger strip, and the register entry for the year. A letter from the site, clipped on, asks for
   a decision; its tick boxes carry a one-sentence effect. "Turn to year N" moves the playhead and turns the page.
   After year 4 the register is stamped and filed, and the DGCA aerodrome licence arrives on duty paper, signed.
   "Open the airport" stamps it, brings down OPENING DAY, and resolves.
   opts: {founder?, parent?, signedOn, opensOn (YYYY-MM-DD), capexCr, debtCr, equityCr, stateLoanCr?, lenderName,
          works:[{id, name, start, end (years after signing), note?}], years:[{year, drawnCr, cumDrawnCr, line}],
          events:[{id, year, title, text, from?, options:[{id, label, effect, slipMonths?, numbers?}]}],
          numbers:{todayCr, light:'green'|'amber'|'red', coverWords, stakePct, stakeValueCr}, atYear?, choices?}
   resolves {choices:{[eventId]:optionId}, finishedOn (YYYY-MM-DD: opening day, after any slip), slipMonths}, or null for "Not now". */
M.construction=function(o){o=o||{};loadDeskFonts();
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parse=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]):null;};
  const d0=parse(o.signedOn)||new Date(),open0=parse(o.opensOn)||new Date(d0.getFullYear()+4,d0.getMonth()+1,1);
  const addM=(d,m)=>new Date(d.getFullYear(),d.getMonth()+Math.round(m),d.getDate());
  const yrOf=d=>(d-d0)/(365.25*864e5);
  const dLong=d=>`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,dMon=d=>`${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const works=(o.works||[]).map(w=>Object.assign({},w)),years=o.years||[],events=o.events||[],N=Object.assign({},o.numbers||{});
  const lastY=Math.max(4,...years.map(y=>y.year));
  const maxSlip=events.reduce((s,e)=>s+Math.max(0,...e.options.map(x=>+x.slipMonths||0)),0);
  const A=Math.max(lastY+2,Math.ceil(yrOf(open0)+maxSlip/12+.35));          // the axis, in years after signing: room for every possible slip
  const X=v=>Math.max(0,Math.min(100,v/A*100));
  const choices=Object.assign({},o.choices||{});
  const optOf=e=>e.options.find(x=>x.id===choices[e.id]);
  const slipBefore=y=>events.filter(e=>e.year<=y).reduce((s,e)=>s+(+((optOf(e)||{}).slipMonths)||0),0);   // months lost to decisions up to year y
  const slipAll=()=>slipBefore(1e9);
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SG=M.cfg.signatories,plan=document.getElementById('planTpl');
  let page=Math.max(1,Math.min(lastY,o.atYear||1)),finished=false;
  const GUIL=guilTile();
  const LIGHT={green:['Relaxed','var(--zg)'],amber:['Watching closely','var(--zw)'],red:['Warning you','var(--zr)']};
  return new Promise(res=>{
  const done=v=>{if(finished)return;finished=true;close();res(v);};
  const pile=[['Incorporation','Incorporated'],['Term sheet','Sanctioned'],['Concession Agreement','Executed']];
  const sh=open(`<div class="zdk zcs" data-stage="cs">${INK_DEFS}
    <div class="zdk-sheet" aria-hidden="true"><div class="zdk-plan" id="zdkPlan" style="--ink:3;animation:none">${plan?plan.innerHTML:''}</div>
      <table class="zdk-tb"><tr><td colspan="2">${esc(M.cfg.airportName)}, Nagpur</td></tr><tr><td>Construction programme, phase 1</td><td>Sheet CP-01</td></tr><tr><td>Years 1 to ${lastY}</td><td>${esc(M.cfg.spvShort)}</td></tr></table></div>
    <header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div><button class="zdk-exit" id="zcsX">Not now</button></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pile.map((p,n)=>`<div class="zdk-card" style="--r:${[-4,3,-2,5][n%4]}deg;--i:${n};animation:none"><span>${esc(p[0])}</span><i></i><i></i><i class="s"></i>${stampHtml(p[1],'mini',d0)}</div>`).join('')}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc zcs-doc" id="zdkDoc" tabindex="-1" autofocus aria-label="Site progress register"></article><div class="zdk-acts" id="zdkActs"></div></div>
      <aside class="zdk-note" id="zdkNote" aria-live="polite"></aside></main></div>`,'zmm-ob');
  const $s=q=>sh.querySelector(q),docEl=$s('#zdkDoc'),actsEl=$s('#zdkActs'),noteEl=$s('#zdkNote'),desk=$s('.zdk');
  $s('#zcsX').onclick=()=>done(null);

  /* the adviser's slip: three numbers, in words */
  function slip(){const n=Object.assign({},N);for(const e of events){const x=optOf(e);if(x&&x.numbers&&e.year<=page)Object.assign(n,x.numbers);}
    const L=LIGHT[n.light]||LIGHT.green;
    noteEl.innerHTML=`<h3>Today's money</h3><b class="zbm-big">${fmt(n.todayCr||0)}</b><p>in ${esc(M.cfg.spvShort)}'s account, for the works</p>
      <h3>The banks</h3><b class="zbm-mood" style="color:${L[1]}">${L[0]}</b><p>${esc(n.coverWords||'')}</p>
      <h3>Your stake</h3><b class="zbm-big">${esc(n.stakePct!=null?n.stakePct:64)}%</b><p>of ${esc(M.cfg.spvShort)}${n.stakeValueCr!=null?`, worth about ${fmt(n.stakeValueCr)}`:''}</p>`;}

  /* the schedule: one row per work, bars shifted by any slip decided before they finish */
  function shifted(w){let s=w.start,e=w.end;for(const ev of events){const x=optOf(ev);const m=x&&+x.slipMonths||0;if(!m||ev.year>page)continue;
      if(e>ev.year-1){e+=m/12;if(s>=ev.year-1)s+=m/12;}}return [s,e];}
  function gantt(){const ph=page,openD=addM(open0,slipBefore(page)),oy=yrOf(openD);
    const axis=Array.from({length:A},(_,k)=>`<span style="left:${X(k)}%;width:${X(1)}%">Year ${k+1}<small>${d0.getFullYear()+k}–${String((d0.getFullYear()+k+1)%100).padStart(2,'0')}</small></span>`).join('');
    const rows=works.map(w=>{const [s,e]=shifted(w),late=e-w.end>.01,fr=Math.max(0,Math.min(1,(ph-s)/((e-s)||1)));
      return `<div class="zcs-n" title="${esc(w.note||'')}">${esc(w.name)}</div><div class="zcs-t"><i class="bar${fr>=1?' done':''}" style="left:${X(s)}%;width:${X(e-s)}%"><b style="width:${fr*100}%"></b></i>${late?`<i class="late" style="left:${X(w.end)}%;width:${X(e-w.end)}%"></i>`:''}</div>`;}).join('');
    const led=years.map(y=>{const on=y.year<=ph;return `<span class="${on?'on':''}" style="left:${X(y.year-1)}%;width:${X(1)}%">${on?H(fmt(y.drawnCr).replace(/ cr$/,'').replace('₹','')):`<em>${esc(fmt(y.drawnCr).replace(/ cr$/,'').replace('₹',''))}</em>`}</span>`;}).join('');
    const cy=years.filter(y=>y.year<=ph).slice(-1)[0],cum=cy?cy.cumDrawnCr:0,cap=o.capexCr||cum||1;
    return `<div class="zcs-g" style="--a:${A};--ph:${X(ph)/100};--op:${X(oy)/100}">
      <div class="zcs-n zcs-h">Works</div><div class="zcs-t zcs-ax">${axis}</div>${rows}
      <div class="zcs-n zcs-lg">Money drawn, ₹ cr</div><div class="zcs-t zcs-led">${led}</div>
      <div class="zcs-n zcs-lg">Drawn so far</div><div class="zcs-t zcs-cum">${(fc=>{const lb=`<span>${H(fmt(cum))} of ${esc(fmt(cap))}</span>`;return `<i style="width:${fc}%">${fc>55?lb:''}</i>${fc>55?'':lb}`;})(Math.min(100,cum/cap*100))}</div>
      <i class="zcs-ph" aria-hidden="true"><span>end of year ${ph}</span></i><i class="zcs-op${slipBefore(page)>0?' late':''}" aria-hidden="true"><span>Opening day<br>${esc(dMon(openD))}${slipBefore(page)>0?` · ${slipBefore(page)} months late`:''}</span></i></div>`;}

  function letter(){const e=events.find(x=>x.year===page);if(!e)return '';
    return `<div class="zcs-let" id="zcsLet"><span class="zbm-clip" aria-hidden="true"></span>
      <header><span>${esc(e.from||'From the site')}</span><span>${esc(dLong(new Date(d0.getFullYear()+page-1,d0.getMonth()+7,3)))}</span></header>
      <h4>${esc(e.title)}</h4><p class="t">${esc(e.text||'')}</p><p class="t zbm-ask">${esc(M.cfg.spvShort)} instructs the site to:</p>
      <div class="zdk-ticks" role="radiogroup" aria-label="${esc(e.title)}">${e.options.map(x=>`<button role="radio" data-e="${esc(e.id)}" data-o="${esc(x.id)}" aria-checked="${choices[e.id]===x.id}"><i></i>${esc(x.label)} <small>${esc(x.effect||'')}</small></button>`).join('')}</div>
      <p class="zcs-pen" id="zcsPen">${choices[e.id]?'':'Tick one answer before you turn the page.'}</p></div>`;}

  function drawPage(turn){const y=years.find(v=>v.year===page)||{},pd=new Date(d0.getFullYear()+page,d0.getMonth(),d0.getDate());
    const openD=addM(open0,slipBefore(page)),late=slipBefore(page);
    docEl.className='zdk-doc zcs-doc';docEl.style.removeProperty('--guil');
    docEl.innerHTML=`<header class="zdk-dh">${vsiLogo(26)}<span>Site progress register · year ${page}</span><span class="dt">${esc(dLong(pd))}</span></header>
      <h2>Building the airport</h2>
      <p class="t">${esc(M.cfg.spvShort)} signed the concession on ${H(dLong(d0))}. It builds phase 1 for ${H(fmt(o.capexCr))}: ${H(fmt(o.equityCr))} from shareholders${o.stateLoanCr?`, ${H(fmt(o.stateLoanCr))} lent by the State`:''} and ${H(fmt(o.debtCr))} from ${esc(o.lenderName||'the banks')}. No passengers, so no income, until opening day on ${H(dLong(openD))}${late?`, ${late} months later than planned`:''}.</p>
      ${gantt()}
      <section class="zcs-ent${turn&&!reduce?' turn':''}"><div class="zbm-no">Year ${page}</div><p class="t">${esc(y.line||'')}</p></section>
      ${letter()}`;
    const ev=events.find(x=>x.year===page);
    actsEl.innerHTML=`<button class="zdk-go" id="zcsN"${ev&&!choices[ev.id]?' disabled':''}>${page<lastY?`Turn to year ${page+1}`:'Apply for the aerodrome licence'}</button>`;
    sh.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{choices[b.dataset.e]=b.dataset.o;
      sh.querySelectorAll(`[data-e="${b.dataset.e}"]`).forEach(x=>x.setAttribute('aria-checked',x===b));
      const g=docEl.querySelector('.zcs-g');g.outerHTML=gantt();$s('#zcsPen').textContent='';$s('#zcsN').disabled=false;slip();});
    $s('#zcsN').onclick=next;slip();
    const l=$s('#zcsLet');
    if(l){if(!reduce)l.classList.add('arrive');setTimeout(()=>{if(!finished)docEl.scrollTo({top:Math.max(0,l.offsetTop-90),behavior:reduce?'auto':'smooth'});},reduce?0:700);}
    else docEl.scrollTop=0;}

  function file(title,word,d){const pl=$s('#zdkPile'),n=pl.children.length;const c=document.createElement('div');c.className='zdk-card';
    c.style.setProperty('--r',[-4,3,-2,5][n%4]+'deg');c.style.setProperty('--i',Math.min(n,5));c.innerHTML=`<span>${esc(title)}</span><i></i><i></i><i class="s"></i>${stampHtml(word,'mini',d)}`;pl.appendChild(c);}
  function next(){const b=$s('#zcsN');if(!b||b.disabled)return;b.disabled=true;
    const ev=events.find(x=>x.year===page);if(ev)file('Site letter, year '+ev.year,'Answered',new Date(d0.getFullYear()+page-1,d0.getMonth()+7,10));
    if(page<lastY){page++;
      // the playhead runs to the end of the new year, then the page turns
      const g=docEl.querySelector('.zcs-g');if(g&&!reduce){g.style.setProperty('--ph',X(page)/100);setTimeout(()=>{if(!finished)drawPage(true);},720);}else drawPage(true);return;}
    docEl.insertAdjacentHTML('beforeend',stampHtml('Works complete','down',new Date(d0.getFullYear()+lastY,d0.getMonth(),d0.getDate())));
    const dW=new Date(d0.getFullYear()+lastY,d0.getMonth(),d0.getDate());
    if(reduce){file('Site progress register','Works complete',dW);licence();return;}
    setTimeout(()=>docEl.classList.add('leave'),600);setTimeout(()=>{file('Site progress register','Works complete',dW);docEl.classList.remove('leave');licence();},1050);}

  /* the DGCA aerodrome licence, on duty paper */
  function licence(){const openD=addM(open0,slipAll()),late=slipAll(),dg=SG.dgca||{};
    const rec=events.map(e=>{const x=optOf(e);return x?`<li>${esc(e.title)}: ${esc(x.label.replace(/^./,c=>c.toLowerCase()))}.</li>`:'';}).join('');
    docEl.className='zdk-doc duty zcs-lic'+(reduce?'':' arrive');docEl.style.setProperty('--guil',GUIL);
    docEl.innerHTML=`<div class="zdk-duty"><div class="den"><b>DGCA</b><span>Government of India</span></div>
        <div class="dc"><span>Directorate General of Civil Aviation</span><span lang="hi" class="hi">नागर विमानन महानिदेशालय</span></div>
        <div class="ser"><span>Licence no.</span><b>AL/NAG/${openD.getFullYear()}/01</b></div></div>
      <header class="zdk-cah">${vsiLogo(44)}<div><h2>Aerodrome Licence</h2><p class="hi" lang="hi">एयरोड्रोम लाइसेंस</p></div></header>
      <p class="t">The Director General of Civil Aviation licenses ${H(M.cfg.spvName)} to use ${esc(M.cfg.airportName)}, Nagpur, as an aerodrome for public use, by day and by night, in all weather, from ${H(dLong(openD))}.</p>
      <table class="zdk-tab kv"><tbody>
        <tr><td>Licensee</td><td>${esc(M.cfg.spvName)}${o.parent?`<small>promoted by ${esc(o.parent)}${o.founder?`, director ${esc(o.founder)}`:''}</small>`:''}</td></tr>
        <tr><td>Largest aircraft</td><td>Airbus A380 and Boeing 777-9</td></tr>
        <tr><td>Built for</td><td>${H(fmt(o.capexCr))}<small>${late?`opening ${late} months later than the concession planned`:'opening on the date the concession planned'}</small></td></tr>
        ${rec?`<tr><td>Recorded on the site register</td><td><ol class="zdk-cl zcs-rec">${rec}</ol></td></tr>`:''}
        <tr><td>Condition</td><td>Fire and rescue crews on duty at every hour the airport is open.</td></tr>
      </tbody></table>
      <div class="zdk-sigs zcs-sigs">${sigBlock(dg,dg.org||'the Director General of Civil Aviation')}<div class="s zcs-st" id="zcsSt"></div></div>`;
    actsEl.innerHTML=`<button class="zdk-go zcs-open" id="zcsO">Open the airport</button>`;
    noteEl.hidden=false;slip();docEl.scrollTop=0;
    setTimeout(()=>{const t=docEl.querySelector('.zcs-sigs');if(t&&!finished)docEl.scrollTo({top:Math.max(0,t.offsetTop-300),behavior:reduce?'auto':'smooth'});},reduce?0:800);
    $s('#zcsO').onclick=()=>{const b=$s('#zcsO');b.disabled=true;
      const result={choices:Object.assign({},choices),finishedOn:iso(openD),slipMonths:slipAll()};
      $s('#zcsSt').innerHTML=stampHtml('Licensed','down zcs-lst',openD);
      docEl.scrollTo({top:docEl.scrollHeight,behavior:reduce?'auto':'smooth'});
      const big=()=>desk.insertAdjacentHTML('beforeend',`<div class="zcs-day${reduce?'':' down'}" aria-live="assertive"><b>Opening day</b><span>${esc(dLong(openD))} · ${esc(M.cfg.airportShort||'VSI')}, Nagpur</span></div>`);
      if(reduce){big();setTimeout(()=>done(result),1600);return;}
      setTimeout(()=>docEl.classList.add('thud'),60);setTimeout(big,700);setTimeout(()=>desk.classList.add('finale'),2600);setTimeout(()=>done(result),4000);};}

  if(!reduce){docEl.classList.add('arrive');noteEl.classList.add('arrive');}
  drawPage(false);
  });};
/* ?moneymock=construction, or window.__zmmConstructionDemo(over): phase 1 at ₹60,000 cr (lean, 45 million a year), opening in year 5 */
window.__zmmConstructionDemo=over=>M.construction(Object.assign({founder:'Asha Rao',parent:'Meridian Infra',signedOn:'2026-10-19',opensOn:'2030-11-01',
  capexCr:60000,debtCr:36049,equityCr:15449,stateLoanCr:8502,lenderName:'Indian banks',
  works:[{id:'land',name:'Land and resettlement',start:0,end:.9,note:'families rehoused before work starts'},
    {id:'earth',name:'Earthworks and drainage',start:.4,end:1.8},
    {id:'rwy',name:'Two runways and taxiways',start:1.1,end:3.2},
    {id:'term',name:'Terminal and Zero Mile Hall',start:1.4,end:3.7,note:'Zero Mile Hall'},
    {id:'conc',name:'Concourses A and B',start:2,end:3.8},
    {id:'apm',name:'People mover',start:2.3,end:3.85},
    {id:'twr',name:'Zero Mile Tower and radar',start:1.7,end:3.4,note:'Zero Mile Tower'},
    {id:'pwr',name:'Power, water and fuel farm',start:1.3,end:3.3},
    {id:'trial',name:'Trials with the airlines',start:3.55,end:4},
    {id:'lic',name:'DGCA aerodrome licence',start:3.85,end:4.04}],
  years:[{year:1,drawnCr:9600,cumDrawnCr:9600,line:'Shareholders\' money goes in first: ₹9,600 cr for the land, the families\' new homes and the earthworks. The banks lend nothing yet.'},
    {year:2,drawnCr:16800,cumDrawnCr:26400,line:'The last ₹5,849 cr of shareholders\' money and the State\'s ₹8,502 cr loan go in, then the banks\' first ₹2,449 cr. The runways take shape.'},
    {year:3,drawnCr:18400,cumDrawnCr:44800,line:'₹18,400 cr from the banks for the terminal, the Hall roof and the concourses. Interest builds up on every rupee drawn.'},
    {year:4,drawnCr:15200,cumDrawnCr:60000,line:'The banks\' last ₹15,200 cr: the people mover, the tower, power and fuel. Then the airlines rehearse a full day of flights.'}],
  events:[{id:'monsoon',year:2,from:'From the resident engineer',title:'Monsoon flooding on the runway site',text:'Nagpur had 40% more rain than normal in July. Water stands on three kilometres of the runway bed, and the earthworks have stopped.',
      options:[{id:'pay',label:'Pay for pumps and night shifts',effect:'₹420 cr more from shareholders now, and the runways stay on time.',numbers:{todayCr:220}},
        {id:'slip',label:'Let it slip',effect:'No cost now, but the runways finish 4 months late and opening day moves to March 2031.',slipMonths:4,numbers:{light:'green',coverWords:'₹124 earned for every ₹100 due, in their forecast.'}}]},
    {id:'overrun',year:3,from:'From Satpura Structural Works, roof contractor',title:'The roof contractor asks for more',text:'Steel for the Hall roof costs 22% more than the contract allowed. The contractor will stop work unless the price goes up. Bengaluru\'s terminal 2 opened 21 months late.',
      options:[{id:'pay',label:'Pay ₹2,100 cr more now',effect:'Shareholders put in ₹2,100 cr more this year, and opening day holds.',numbers:{stakeValueCr:11230}},
        {id:'slip',label:'Refuse, and tender the roof again',effect:'No cost now, but the terminal opens 8 months late, and about ₹1,250 cr of interest falls due with no passengers to pay it.',slipMonths:8,numbers:{light:'amber',coverWords:'₹112 earned for every ₹100 due, in their forecast. They warn you below ₹120.'}}]},
    {id:'trials',year:4,from:'From the operations director',title:'Trials with the airlines',text:'Before the first passenger, airlines, ground handlers and 6,000 volunteers can rehearse full days of flights: check-in, bags, gates and boarding.',
      options:[{id:'full',label:'Full trials, six months',effect:'₹180 cr, already in the schedule; opening day runs on time and calm.'},
        {id:'short',label:'Short trials, six weeks',effect:'Saves ₹120 cr, but expect lost bags and gate mix-ups in the first month after opening.'}]}],
  numbers:{todayCr:640,light:'green',coverWords:'₹130 earned for every ₹100 due, in their forecast.',stakePct:64,stakeValueCr:9890}},over||{}));
(function(){const go=()=>{if(/[?&]moneymock=construction\b/.test(location.search))window.__zmmConstructionDemo().then(r=>{window.__zmmResult=r;});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',go);else setTimeout(go,0);})();

/* ---------- glossary terms the economy introduces (merge into hub.js GL) ---------- */
M.terms={
  aero:{t:'Fees from airlines and passengers',d:'Money from flying: landing fees by aircraft weight, parking fees per hour on a stand, and the user development fee each departing passenger pays. India\'s regulator AERA caps it.'},
  nonaero:{t:'Shops, food, parking and property',d:'Money from everything else: shops, duty-free, food, car parks, the hotel, advertising, cargo. AERA does not cap it, which is why airports make their real profit here.'},
  mtow:{t:'Aircraft weight',d:'The heaviest an aircraft may be at take-off. Landing fees are charged per tonne of it, so an A380 (575 t) pays many times an A320 (79 t).'},
  udf:{t:'Passenger fee',d:'A charge on every departing passenger\'s ticket that goes to the airport, set by AERA. New airports get higher UDFs because they still have to pay back the cost of building.'},
  aera:{t:'AERA',d:'The Airports Economic Regulatory Authority of India. Every five years it sets how much a major airport may charge airlines and passengers, from the airport\'s asset base, costs and a fair return.'},
  rab:{t:'What AERA counts as invested',d:'What the regulator counts as invested in the airport. Charges are set so the airport earns a fair return on it. Build more and the RAB grows; it shrinks as assets depreciate.'},
  till:{t:'AERA\'s share of your shop income',d:'Under AERA\'s rules, 30% of an airport\'s non-aeronautical revenue is used to lower what airlines and passengers pay. The other 70% the airport keeps.'},
  trueup:{t:'Money AERA owes you, or you owe it',d:'If AERA lets an airport charge less than it was owed in one five-year period, the shortfall is carried into the next, with interest. Early squeezes can be recovered later.'},
  dscr:{t:'Loan cover',d:'How much the airport earns for every ₹100 of loan repayment due that year. At ₹100 it can only just pay. Below ₹120 the banks warn you. Below ₹110 you break their condition. Below ₹100 they can take control.'},
  stepin:{t:'Banks take control',d:'If the airport cannot pay its loans, the lenders can take control of the concession company and replace its management. In the game that ends your concession.'},
  sla:{t:'Promises to airlines',d:'The promises the airport makes to its airlines, such as how long they wait for a stand. Breaking them costs penalties.'},
  ebitda:{t:'Operating profit',d:'What the airport earns from running itself, before paying its loans and before wear on its buildings. Bengaluru keeps about 72 paise of every rupee, Delhi about 37.'},
  irr:{t:'Your yearly return',d:'The yearly return on the money your company put in, counting every rupee out and every dividend back, over the whole concession.'},
  spv:{t:'Concession company',d:'A company set up for this one airport. Its loans stay with it, so if the airport fails, your parent company is not on the hook.'},
  concession:{t:'Concession',d:'The state\'s permission to build and run the airport for a fixed term, here 60 years, after which it is handed back.'}
};

/* ---------- auto-mount, and a mock driver for screenshots: ?moneymock ---------- */
function boot(){M.mount();if(!/[?&]moneymock\b/.test(location.search))return;
  M.enable(true);let total=0;const hs=[];
  setInterval(()=>{const d=(Math.random()-0.28)*0.9;total+=d;hs.push(total);M.setDay({total,ratePerHr:total/Math.max(1,hs.length)*60,history:hs});
    const map=$('#map');if(map){const r=map.getBoundingClientRect();M.float(r.width*(0.3+Math.random()*0.4),r.height*(0.3+Math.random()*0.4),d,{label:d>=0?'Landing':'Penalty'});}},700);
  M.setPL([{label:'Landing fees',kind:'rev',amount:3.4,term:'aero',sub:'134 landings'},{label:'Parking',kind:'rev',amount:0.6,term:'aero'},{label:'Passenger fee',kind:'rev',amount:7.9,term:'udf',sub:'12,880 departing passengers'},{label:'Shops and food',kind:'rev',amount:4.1,term:'nonaero'},{label:'Transfer incentive',kind:'rev',amount:0.8},
    {label:'Runways open',kind:'cost',amount:1.3,sub:'6 runways × 1.5 h'},{label:'Ops teams',kind:'cost',amount:0.7},{label:'Penalties to airlines',kind:'cost',amount:0.9,term:'sla'},{label:'Passenger care',kind:'cost',amount:0.4},{label:'Incidents and fuel claims',kind:'cost',amount:0.6}],{note:'Mock data: open the game without ?moneymock to see the real economy.'});
  window.__zmmDemo={
    onboarding:()=>M.onboarding({capexCr:60000,
      phase1:{def:'lean',options:[{id:'lean',label:'45 million passengers a year',small:'build more when Mumbai’s widebodies and Delhi’s banks arrive',capexCr:60000},{id:'big',label:'70 million passengers a year',small:'build it all now: more of your money up front',capexCr:85000}]},
      lenders:{def:'banks',options:[{id:'banks',who:'Indian banks',label:'Indian banks, in rupees',small:'the usual way, repaid over 14 years'},{id:'dollar',who:'bondholders abroad',label:'dollar bonds sold abroad',small:'less interest, but if the rupee falls every repayment grows'},{id:'infra',who:'the infrastructure bank',label:'India\'s infrastructure bank',small:'lends for longer, so each year\'s repayment is smaller'}]},
      stateLoan:{pct:14.17,def:true,text:'interest-free, repaid from year 11'},
      previewBid:b=>{const p=b.type==='share'?Math.min(98,Math.max(3,(b.value-18)*3.2)):Math.min(98,Math.max(3,(b.value-110)*0.35));return{winPct:p,note:p>66?'You probably win, but you pay this share of everything for 60 years.':p>33?'A coin toss against Kármán Line Ventures.':'Too low. A rival will outbid you.'};},
      previewClose:c=>{const cap=c.phase1==='big'?85000:60000,loan=c.stateLoan?cap*0.1417:0,ask=(cap-loan)*c.gearing/100,max=(cap-loan)*(c.phase1==='big'?0.62:0.72),debt=Math.min(ask,max),eq=cap-loan-debt;
        return{debtCr:debt,equityCr:eq,parentCr:eq*0.64,stateLoanCr:loan,minDscr:(c.repayment==='sculpted'?1.32:1.08)-(c.gearing-60)*0.012-(c.stateLoan?0:0.06)+(c.lender==='infra'?0.08:c.lender==='dollar'?0.04:0),note:c.repayment==='equal'?'Equal instalments are heavy in the first years. Expect a warning from the banks before Mumbai’s widebodies arrive.':'Repayments grow with the passengers. Money gets tight when Mumbai’s widebodies and Delhi’s banks arrive and you have to build more.'};},
      bidTypes:{share:{min:10,max:50,step:0.5,def:30,benchmarks:[{name:'Navi Mumbai',val:12.6},{name:'Mumbai',val:38.7},{name:'Delhi',val:45.99}]},ppf:{min:100,max:450,step:5,def:250,benchmarks:[{name:'lowest Adani bid',val:115},{name:'highest recent bid',val:401}]}}}),
    board:()=>M.boardMeeting({era:3,years:'2041–46',year:16,parent:'Meridian Infra',founder:'Asha Rao',parentPct:64,cashCr:14800,debtCr:31400,stakeValueCr:23600,dscr:{value:1.16,warn:1.2,covenant:1.1},
      aera:{title:'Charges to airlines and passengers, 2041–46',text:'AERA lets you charge ₹1,040 per passenger on average. Last period you earned ₹1,820 cr less than it allowed, so you get that back over these five years.',canAppeal:true,
        acceptText:'Your charges are fixed for five years. No quarrel with the airlines.',appealText:'Win and your charges rise 6%. Lose and the airlines stay angry with you for the whole period.'},
      investments:[{id:'city',name:'Airport City — a property district on VSI land',costCr:9600,opens:'year 19',land:{earnCr:1450,aeraCr:435},effect:'Offices, hotels and shops, built in three phases; rents climb for six years after it opens.'},
        {id:'cdm',name:'Departure planning system',costCr:420,opens:'year 17',effect:'Aircraft leave the gate only when the runway can take them. Shorter taxi queues.',payback:'4 years'},
        {id:'radar',name:'Bird radar',costCr:180,opens:'year 17',effect:'Fewer bird strikes and no surprise runway closures.',payback:'3 years'},
        {id:'ret',name:'Extra rapid-exit taxiway',costCr:240,opens:'year 18',effect:'Arrivals clear 27R faster, so they can land a little closer together.',payback:'3 years'},
        {id:'retail',name:'Retail upgrade in the Mall',costCr:650,opens:'year 17',effect:'Passengers spend 12% more in the shops.',payback:'3 years'},
        {id:'g',name:'Satellite G (phase 1B)',costCr:18500,opens:'year 21',effect:'40 more stands, for when Mumbai’s widebodies arrive.',disabled:true,reason:'Needs more than the company has: ask the banks for a bigger loan first.'},
        {id:'sweep',name:'Second sweeper truck',costCr:12,effect:'Runway sweeps fit into smaller gaps.',owned:true}],
      dividend:{maxCr:2400,lastCr:900},prepay:{maxCr:4000,savesPct:9.1}}).then(d=>{window.__zmmLast=d;console.log('board',JSON.stringify(d));}),
    income:()=>M.incomeStatement({band:'Concession complete · year 60',title:'Handback',hero:'<em>Meridian Infra</em> ran Vikram Sarabhai International for 60 years. <em>₹1,42,800 cr</em> returned on <em>₹13,440 cr</em> invested.',
      sections:[{title:'Over 60 years',rows:[{label:'Fees from airlines and passengers',amount:612000,kind:'rev'},{label:'Shops, food, parking and property',amount:488000,kind:'rev'},{label:'Paid to AAI',amount:198000,kind:'cost'},{label:'Running costs',amount:301000,kind:'cost'},{label:'Operating profit',amount:601000,kind:'total'}]},{title:'For your company',rows:[{label:'Your return, per year',amount:'16.8%',kind:'good'},{label:'Bank loans repaid',amount:'Yes, in year 24',kind:'total'},{label:'Tightest year with the banks',amount:'₹112 per ₹100 due (year 11)',kind:'total'}]}],
      compare:[{name:'Bengaluru (BIAL)',value:72},{name:'Mumbai (MIAL)',value:40},{name:'Delhi (DIAL)',value:37},{name:'Your VSIAL',value:55,me:true}],moments:['Year 11: Mumbai’s widebodies arrived before Satellite G opened. 19 aircraft a day waited for stands, and the airlines charged you ₹410 cr in penalties.','Year 31: the pandemic year. Passengers fell 62% and the airport earned only ₹94 for every ₹100 it owed. You put in more of your own money, and the banks let you keep the airport.'],cta:'Start a new concession',cta2:'Back to the menu'})
  };
  if(/moneymock=onboarding/.test(location.search))window.__zmmDemo.onboarding();
  if(/moneymock=board/.test(location.search))window.__zmmDemo.board();
  if(/moneymock=income/.test(location.search))window.__zmmDemo.income();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
