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
   'aai60' and 'state60' are their successors who receive the airport back in year 60; 'lenders' is the banks' agent (Ch6).
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
    hand:{font:'Allura',size:36,adv:.36,slant:0,rot:-2,ink:'#1f3a8a',weight:.15,flourish:'dot'}},
  lenders:{name:'Prakash Venugopal',sign:'P. Venugopal',title:'Agent for the lenders',org:'the lenders to VSIAL',
    hand:{font:'Homemade Apple',size:19,adv:.6,slant:6,rot:-4,ink:'#14161a',weight:.15,flourish:'under'}}};
M.config=function(o){o=Object.assign({},o||{});if(o.signatories){const sg=o.signatories;delete o.signatories;
    for(const k in sg)M.cfg.signatories[k]=Object.assign({},M.cfg.signatories[k]||{},sg[k],{hand:Object.assign({},(M.cfg.signatories[k]||{}).hand||{},sg[k].hand||{})});}
  Object.assign(M.cfg,o);return M.cfg;};
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- number formatting: crore above ₹1 cr, lakh below ---------- */
function fmt(v,opt){opt=opt||{};if(v==null||isNaN(v))return '—';if(Math.abs(v)<0.0005)return '₹0';const s=v<0?'−':opt.sign&&v>0?'+':'';const a=Math.abs(v);
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
.zdk :focus-visible{outline:2px solid var(--zi);outline-offset:3px}.zdk .zpf:focus-visible{outline:none}
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
  if(!c.classList.contains('cx'))c.querySelector('.r').textContent=o.ratePerHr==null?'—':fmt(o.ratePerHr,{sign:true})+' an hour';
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
function open(html,cls){M.mount();const ov=$('#zmmOv'),sh=$('#zmmSheet');sh.className='zmm-sheet'+(cls?' '+cls:'');ov.classList.toggle('ob',/zmm-ob/.test(cls||''));sh.onkeydown=null;sh.innerHTML=html;ov.hidden=false;sh.scrollTop=0;const f=sh.querySelector('[autofocus]')||sh.querySelector('button,input');if(f)setTimeout(()=>{quietFocus(f);sh.scrollTop=0;},30);return sh;}
/* focus put there by the screen, not by the player: no ring until the player presses a key (keyboard users still get it) */
function quietFocus(el){if(!el)return;el.classList.add('zpf');el.focus({preventScroll:true});
  if(!quietFocus.on){quietFocus.on=true;const clr=()=>document.querySelectorAll('.zpf').forEach(e=>e.classList.remove('zpf'));document.addEventListener('keydown',clr,true);document.addEventListener('pointerdown',clr,true);}}
function close(){const ov=$('#zmmOv');if(ov)ov.hidden=true;}
M.close=close;
const stepper=(names,i)=>`<div class="steps">${names.map((n,k)=>`<span class="${k===i?'on':k<i?'done':''}">${k+1} · ${esc(n)}</span>`).join('')}</div>`;

/* ---------- shared paper helpers: the deal desk, the board meeting and later paper screens use these ---------- */
const H=s=>`<span class="h">${esc(s)}</span>`;               // a handwritten fill-in
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
/* ZMMoney.fmtDate('2039-04-01') → "1 April 2039": dates as people write them (stamps keep "01 APR 2039"). Anything else passes through. */
M.fmtDate=function(v){if(v==null||v==='')return '';if(v instanceof Date)return isFinite(v)?`${v.getDate()} ${MONTHS[v.getMonth()]} ${v.getFullYear()}`:'';
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));return m?`${+m[3]} ${MONTHS[+m[2]-1]} ${m[1]}`:String(v);};
// any ISO day inside a sentence, rewritten the same way
const hd=v=>typeof v==='string'?v.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g,(_,y,mo,d)=>`${+d} ${MONTHS[+mo-1]} ${y}`):v;
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
  const inv=o.investments||[],now=dayOf(o.date)||new Date(),era=o.era!=null?o.era:1;   // the meeting's day in the game (era.js), not today
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
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pile.slice(-4).map((p,n)=>`<div class="zdk-card" style="--r:${[-4,3,-2,5][n%4]}deg;--i:${n};animation:none"><span>${esc(p.title)}</span><i></i><i></i><i class="s"></i>${p.stamp?stampHtml(p.stamp,'mini',dayOf(p.date)||now):''}</div>`).join('')}</div>
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
      res$.insertAdjacentHTML('beforeend',stampHtml('Approved','down zbm-st',now));if(!reduce)setTimeout(()=>docEl.classList.add('thud'),40);},boxes.length*step+120);
    const t0=boxes.length*step+120;
    if(reduce){setTimeout(()=>{close();res(result);},t0+900);return;}
    setTimeout(()=>docEl.classList.add('leave'),t0+1500);
    setTimeout(()=>{const pl=$s('#zdkPile'),n=pl.children.length;const c=document.createElement('div');c.className='zdk-card';c.style.setProperty('--r',[-4,3,-2,5][n%4]+'deg');c.style.setProperty('--i',Math.min(n,4));
      c.innerHTML=`<span>Board minutes, era ${esc(era)}</span><i></i><i></i><i class="s"></i>${stampHtml('Approved','mini',now)}`;pl.appendChild(c);},t0+1900);
    setTimeout(()=>{close();res(result);},t0+2700);};
  });};

/* ---------- income statement (end of a shift, an era, or the concession) ---------- */
/* ZMMoney.incomeStatement(opts) → Promise<'cta'|'cta2'>: kept for old callers. It is a wrapper around ZMMoney.bill, so the
   old dark yellow-banded sheet can never appear again. opts: {band, title, hero (HTML; its text becomes the lead),
   sections:[{title, rows:[{label, amount (number or string), kind:'rev'|'cost'|'total'|'good'|'bad', period?}]}],
   compare:[{name, value, me}], compareLabel, moments:[text], cta, cta2}, plus any bill() field (paragraph, cover, stake, margin, year). */
M.incomeStatement=function(o){o=o||{};const txt=h=>{const d=document.createElement('div');d.innerHTML=String(h||'');return d.textContent.replace(/\s+/g,' ').trim();};
  const table=[];for(const sc of o.sections||[]){if(sc.title)table.push({head:sc.title});
    for(const r of sc.rows||[])table.push(typeof r.amount==='string'?{label:r.label,text:r.amount,kind:r.kind,period:r.period}:{label:r.label,cr:+r.amount,kind:r.kind,period:r.period});}
  if(o.compare&&o.compare.length){table.push({head:o.compareLabel||'How much of each rupee each airport keeps'});for(const c of o.compare)table.push({label:c.name,text:c.value+'%',me:c.me});}
  const B={head:o.band,title:o.title,lead:o.hero?txt(o.hero):undefined,table,list:o.moments&&o.moments.length?{title:'The most expensive moments',items:o.moments}:null,cta:o.cta||'Continue',cta2:o.cta2};
  for(const k of ['paragraph','cover','stake','margin','adviser','year','page','pile'])if(o[k]!=null)B[k]=o[k];
  return M.bill(Object.assign(B,o.bill||{})).then(r=>r||'cta');};

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
  rab:{t:'What AERA counts as invested',d:'What the regulator counts as invested in the airport. Charges are set so the airport earns a fair return on it. Build more and it grows; it shrinks as the buildings and runways wear out.'},
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

/* ---------- Chapter 5 "Take on the Gulf": the four paper screen types (prompt-campaign.md §7) ----------
   frontPage (The Zero Mile Times), decision (a route agreement), briefing (a torn notepad sheet pinned over the live
   ops view), bill (one page of the annual report), plus the paper tags of the paper trail, the doc viewer for the
   pile, connection floaters and the connections line under the money chip. Every figure arrives in opts from
   money/era.js (VSIEra.ch5); nothing here invents a number. */
const CSS5=`
/* tokens for paper that sits over the live game (briefing, tags, doc viewer), the same as .zdk without the desk */
.z5v{--zp:#fcfcf9;--zt:#1d2024;--zi:#1f3a8a;--zr:#c22a2e;--zw:#b06d12;--zg:#2b7a4b;--zpe:#676c71;
  --ft:'Courier Prime','Courier New',monospace;--fd:'Libre Caslon Text',Georgia,serif;--fh:'Kalam','Segoe Print',cursive;color:var(--zt)}
.z5 .zdk-plan{animation:none;opacity:.3}
.z5-stage{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 24px 18px;z-index:1}
.z5-acts{display:flex;align-items:center;gap:4px;padding-top:16px}
/* 7.1 the front page: newsprint, dropped on the desk */
.z5-np{--s:1;position:relative;width:860px;box-sizing:border-box;padding:22px 34px 26px;background:#efeee8;color:#16181a;
  transform:rotate(-.7deg) scale(var(--s));transform-origin:50% 0;box-shadow:0 24px 50px rgba(30,40,50,.24),0 2px 5px rgba(30,40,50,.14)}
.z5-np::after{content:'';position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(0,0,0,.045);box-shadow:0 1px 0 rgba(255,255,255,.55);pointer-events:none}
.z5-np.drop{animation:z5Drop .62s cubic-bezier(.2,.75,.25,1) both}
.z5-np.away{animation:z5Away .42s cubic-bezier(.5,0,.8,.4) forwards}
.z5-mast{display:grid;grid-template-columns:120px 1fr 120px;align-items:end;gap:12px;border-bottom:1px solid #16181a;padding-bottom:8px}
.z5-mast h1{margin:0;text-align:center;font-family:var(--fd);font-weight:700;font-size:50px;line-height:1;letter-spacing:-.01em;white-space:nowrap}
.z5-ear{font-family:var(--fd);font-size:11px;line-height:1.35;color:#3b3f44}.z5-ear.r{text-align:right}
.z5-dl{display:flex;justify-content:space-between;gap:12px;border-bottom:3px double #16181a;padding:4px 0 5px;font-family:var(--fd);font-size:11.5px;letter-spacing:.02em}
.z5 .z5-lead{margin:14px 0 6px;font-family:var(--fd);font-weight:700;font-size:44px;line-height:1.02;letter-spacing:-.015em;text-wrap:balance}
.z5 .z5-deck{margin:0 0 12px;font-family:var(--fd);font-style:italic;font-size:17px;line-height:1.35;color:#2b2f33;max-width:62ch}
.z5-body{display:grid;grid-template-columns:1fr 1fr 214px;column-gap:20px;border-top:1px solid #16181a;padding-top:12px}
.z5-photo{grid-column:1/3;margin:0}
.z5-photo .ph{position:relative;height:218px;overflow:hidden;background:#f6f5f0;border:1px solid #16181a}
.z5-photo .ph svg{position:absolute;inset:0;width:100%;height:100%;filter:invert(1) grayscale(1) contrast(1.9);mix-blend-mode:multiply}
.z5-photo .ph svg text{display:none}
.z5-photo figcaption{margin-top:5px;font-family:var(--fd);font-style:italic;font-size:12px;line-height:1.35;color:#3b3f44}
.z5-sub{grid-column:1/3;margin-top:10px}
.z5 .z5-sub h3{text-wrap:balance;margin:0 0 5px;font-family:var(--fd);font-weight:700;font-size:20px;line-height:1.12}
.z5 .z5-txt{font-family:var(--fd);font-size:13px;line-height:1.48;color:#16181a;text-align:justify;hyphens:auto;-webkit-hyphens:auto;margin:0;max-width:none}
.z5 .z5-txt+.z5-txt{text-indent:1.2em}
.z5-cc{column-count:2;column-gap:20px}
.z5-sg{grid-column:1/3;margin:8px 0 0;display:flex;align-items:center;gap:14px;border-top:1px solid rgba(0,0,0,.25);padding-top:6px}
.z5-sg .ink{height:38px;width:170px;display:flex;align-items:center;color:#16181a}.z5-sg .ink *{color:#16181a!important}.z5-sg .ink img,.z5-sg .ink svg{max-height:38px;max-width:170px;filter:grayscale(1) contrast(1.2)}
.z5-sg figcaption{font:italic 11px/1.3 var(--fd);color:#3b3f44}
.z5-cols{grid-column:3;grid-row:1/3;border-left:1px solid #16181a;padding-left:18px}
.z5-cols section+section{border-top:1px solid #16181a;margin-top:12px;padding-top:10px}
.z5-cols h4{margin:0 0 5px;font-family:var(--fd);font-weight:700;font-size:16px;line-height:1.15}
.z5 .zdk-go{white-space:nowrap}
@keyframes z5Drop{0%{opacity:0;transform:translateY(-46px) rotate(-5deg) scale(calc(var(--s)*1.1));box-shadow:0 60px 90px rgba(30,40,50,.12)}
  62%{opacity:1;transform:translateY(5px) rotate(-.2deg) scale(var(--s))}80%{transform:translateY(-2px) rotate(-.8deg) scale(var(--s))}100%{opacity:1;transform:rotate(-.7deg) scale(var(--s))}}
@keyframes z5Away{to{opacity:0;transform:translate(-30vw,60px) rotate(-9deg) scale(calc(var(--s)*.5))}}
/* 7.2 the decision: a route agreement on white bond */
.z5-dec .zdk-main{grid-template-columns:minmax(230px,1fr) minmax(600px,680px) minmax(250px,1fr)}
.z5-dec .zdk-doc{padding:30px 50px 28px}
.z5-dec .zdk-doc .t{line-height:1.5;margin:0 0 10px}
.z5-dec .zdk-doc h2{margin-bottom:10px}
.z5-dec .zdk-ticks button{padding:4px 0}
.z5-dec .zdk-sigs .zdk-stamp{top:-6px;right:6px}
.z5-dec .zdk-ticks small{font-size:12.5px;line-height:1.45}
.z5-dec .zdk-sigs{grid-template-columns:repeat(2,minmax(0,1fr))}
.z5-dec .zdk-sigs .ink img{height:50px;max-width:100%;object-fit:contain;object-position:left bottom}
.z5-dec .zdk-sigs .ink .h{font-size:30px}
.z5-dec .zdk-note .big{display:block;font-family:var(--fh);font-weight:700;font-size:34px;line-height:1.05;margin:6px 0 4px;color:var(--zt)}
.z5-dec .zdk-note .mon{display:block;font-family:var(--fh);font-size:21px;line-height:1.2}
.z5-dec .zdk-note .dim{color:var(--zpe)}
.z5-dec .zdk-note{width:min(300px,calc(100% - 30px))}
.z5-sl{margin:10px 0 0;padding:0 0 0 10px;border-left:3px solid transparent;color:#55595e;font-size:15px;line-height:1.3}
.z5-sl b{display:block;font-weight:700;font-size:15.5px;color:#3b3f44}.z5-sl span{display:block}
.z5-sl.on{border-left-color:var(--zi);color:#1d2024}.z5-sl.on b{color:var(--zt);font-size:17px}
.zdk-card.z5c{cursor:pointer;pointer-events:auto}.zdk-card.z5c:hover span{color:var(--zr)}
.z5 .zdk-pile{pointer-events:auto}
/* 7.3 the briefing: a torn notepad sheet pinned top-left over the live ops view (not a modal) */
.z5-brief{position:absolute;left:16px;top:158px;z-index:28;width:338px;filter:drop-shadow(0 12px 18px rgba(0,0,0,.45)) drop-shadow(0 1px 2px rgba(0,0,0,.4));transform:rotate(-1.4deg);transform-origin:50% 0}
.z5-brief.away{transition:transform .38s cubic-bezier(.5,0,.8,.4),opacity .38s;transform:translate(-40px,-30px) rotate(-8deg);opacity:0}
.z5-pad{position:relative;padding:30px 22px 14px 44px;background-color:#fdfdf8;cursor:pointer;
  background-image:linear-gradient(90deg,transparent 33px,rgba(194,42,46,.45) 33px,rgba(194,42,46,.45) 34.5px,transparent 34.5px),repeating-linear-gradient(180deg,transparent 0 25px,rgba(40,100,160,.2) 25px 26px);background-position:0 0,0 9px}
.z5-pin{position:absolute;left:50%;top:-2px;z-index:2;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#c22a2e;box-shadow:inset -3px -3px 0 rgba(0,0,0,.22),0 3px 4px rgba(0,0,0,.4)}
.z5-pad header{display:flex;flex-direction:column;gap:2px;margin:0 0 6px}
.z5-pad header b{font-family:var(--fd);font-weight:700;font-size:17px;line-height:1.2}
.z5-pad header span{font-family:var(--ft);font-size:11.5px;color:var(--zpe);white-space:nowrap}
.z5-pad ol{list-style:none;margin:0;padding:0}
.z5-pad li{position:relative;margin:0 0 6px}
.z5-pad li::before{content:counter(list-item) '.';position:absolute;left:-22px;top:1px;font-family:var(--fh);font-size:16px;color:#3b3f44}
.z5-pad li .h{display:block;font-family:var(--fh);font-size:16.5px;line-height:1.52;color:#22262b}
.z5-ref{display:block;width:fit-content;margin-left:auto;text-align:right;font-family:var(--ft);font-size:11.5px;color:var(--zpe);text-decoration:underline;text-underline-offset:2px;padding:0;cursor:pointer}
.z5-ref:hover{color:var(--zr)}
.z5-watch{margin:8px 0 4px}
.z5-watch small{display:block;font-family:var(--ft);font-size:11.5px;color:var(--zpe)}
.z5-watch span{font-family:var(--fh);font-weight:700;font-size:19px;line-height:1.35;color:#1d2024;text-decoration:underline wavy rgba(194,42,46,.8);text-decoration-thickness:1.5px;text-underline-offset:5px}
.z5-pad footer{display:flex;align-items:center;gap:10px;margin-top:10px}
.z5-pad footer button{background:var(--zt);color:#fcfcf9;font-family:var(--f-sign);font-weight:700;font-size:16px;padding:7px 14px;border-radius:2px}
.z5-pad footer span{font-family:var(--ft);font-size:11.5px;color:var(--zpe)}
/* the paper trail: margin pins. A 12px pushpin off the airfield, a dashed leader to the spot, and (open) two short lines */
#z5Tags{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
.z5-tag{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;--cx:24px;--cy:-40px;--px:6px;--py:6px}
.z5-tag[hidden],.z5-tag.nowhere{display:none}
.z5-tag .sp{position:absolute;left:-3px;top:-3px;width:6px;height:6px;border-radius:50%;box-sizing:border-box;border:1.5px solid #fcfcf9;box-shadow:0 0 2px rgba(0,0,0,.7)}
.z5-tag .ld{position:absolute;left:0;top:0;width:var(--tl,0);height:0;border-top:1px dashed rgba(226,228,224,.92);transform:rotate(var(--ta,0rad));transform-origin:0 0;filter:drop-shadow(0 0 1px rgba(0,0,0,.8))}
.z5-tag .mp{position:absolute;left:0;top:0;width:var(--bw,127px);height:var(--bh,32px);transform:translate(var(--cx),var(--cy))}
.z5-tag .pp{position:absolute;left:0;top:3px;width:12px;height:12px;padding:0;pointer-events:auto;cursor:pointer;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.7))}
.z5-tag .pp svg{display:block;width:12px;height:12px}
.z5-tag.flip .pp{left:auto;right:0}
.z5-tag .lb{position:absolute;left:17px;top:0;width:calc(var(--bw,127px) - 17px);box-sizing:border-box;padding:3px 6px 3px 7px;text-align:left;background:#fcfcf9;color:#1d2024;pointer-events:auto;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,.4),0 1px 2px rgba(0,0,0,.4);transform:rotate(-.8deg);opacity:0;visibility:hidden;transition:opacity .18s,visibility 0s .18s}
.z5-tag.flip .lb{left:0}
.z5-tag .lb b,.z5-tag .lb small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.z5-tag .lb b{font-family:var(--ft);font-weight:700;font-size:10px;line-height:13px}
.z5-tag .lb small{font-family:var(--ft);font-size:10px;line-height:13px;color:#2f3337}
.z5-tag.open .lb{opacity:1;visibility:visible;transition:opacity .18s}
.z5-tag .lb:hover b,.z5-tag .lb:hover small{color:var(--zr)}
.z5-tag.pinonly .lb{display:none}
.z5-tag.flash .pp{animation:z5Flash .5s ease-in-out 3}
@keyframes z5Flash{50%{transform:scale(1.7);filter:drop-shadow(0 0 5px rgba(194,42,46,.95))}}
.z5-tag.pin .pp{animation:z5Pin .25s cubic-bezier(.3,1.5,.5,1) both}
@keyframes z5Pin{from{opacity:0;transform:translateY(-8px) scale(1.4)}to{opacity:1;transform:none}}
/* a document from the pile, read-only */
#z5Doc{position:absolute;inset:0;z-index:34;display:flex;align-items:center;justify-content:center;background:rgba(6,9,11,.5)}
#z5Doc[hidden]{display:none}
.z5-rd{position:relative;width:min(500px,calc(100% - 48px));box-sizing:border-box;padding:28px 34px 22px;background:var(--zp);transform:rotate(.6deg);box-shadow:0 22px 48px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.2);overflow:hidden}
.z5-rd h2{font-family:var(--fd);font-weight:700;font-size:26px;line-height:1.12;margin:0 0 10px}
.z5-rd p{font-family:var(--ft);font-size:14px;line-height:1.6;margin:0 0 12px}
.z5-rd .zdk-stamp{top:auto;bottom:16px;right:24px;--tf:rotate(-9deg) scale(.62);transform-origin:right bottom}
.z5-rd .zdk-q{padding-left:0}
/* connection floaters and the connections line under the money chip (the game's night look) */
.zmm-f.cx{color:#7dffb4;background:rgba(10,40,24,.78);border:1px solid rgba(58,208,127,.5);font-size:12.5px}
.zmm-f.mx{color:#ffb1a8;background:rgba(48,12,10,.8);border:1px solid rgba(255,77,63,.55);font-size:12.5px}
.zmm-chip.cx .r b{font-weight:500;color:var(--go)}.zmm-chip.cx .r i{font-style:normal;color:var(--stop)}
.zmm-cxs{font-family:var(--f-mono);font-size:10px;line-height:1.2;color:var(--ink-3);white-space:nowrap}.zmm-cxs b{font-weight:500;color:var(--go)}.zmm-cxs i{font-style:normal;color:var(--stop)}
/* 7.4 the bill: one page of the annual report on white bond, with the adviser's margin note */
.z5-bill .zdk-main{grid-template-columns:minmax(200px,1fr) minmax(720px,800px) minmax(120px,.6fr)}
.z5-bill .zdk-doc{display:grid;grid-template-columns:1fr 210px;column-gap:30px;padding:34px 34px 30px 50px}
.z5-bill .zdk-doc>*{grid-column:1}
.z5-bill .zdk-dh{grid-column:1/3}
.z5-bill .zdk-tab td{padding:9px 0}
.z5-bill .zdk-tab .n{font-weight:700}
.z5-bill .zdk-tab .n i{font-style:normal;font-weight:400;color:var(--zr)}
.z5-hl{margin:18px 0 0}
.z5-hl small{display:block;font-family:var(--ft);font-size:12.5px;color:var(--zpe)}
.z5-hl b{display:block;font-family:var(--ft);font-weight:700;font-size:19px;margin:2px 0 10px}
.z5-hl .zdk-dscr{margin:0 0 4px;max-width:420px}
.z5-hl .zdk-dscr .lb{font-family:var(--fh);color:#3b3f44}
.z5-bill .zdk-tab tr.z5-th td{padding:16px 0 4px;border-top:0;font-family:var(--fd);font-weight:700;font-size:15px}
.z5-bill .zdk-tab small.z5-per{display:inline;font-size:11.5px;color:var(--zpe)}
.z5-bill .z5-pd{margin:-4px 0 10px;font-family:var(--ft);font-size:12.5px;color:var(--zpe)}
.z5-bill .zdk-tab tr.z5-kcost .n{color:#5a2b2b}.z5-bill .zdk-tab tr.z5-ktotal td{font-weight:700}.z5-bill .zdk-tab tr.z5-kgood .n{color:var(--zg)}.z5-bill .zdk-tab tr.z5-kbad .n{color:var(--zr)}
.z5-bill .zdk-tab tr.z5-me td{font-weight:700;color:var(--zi)}
.z5 .z5-lh{font-family:var(--fd);font-weight:700;font-size:15px;margin:18px 0 4px}.z5 .z5-ul{margin:0;padding-left:18px;font-family:var(--ft);font-size:13.5px;line-height:1.55}
.z5 .z5-stake{font-family:var(--ft);font-size:14px;line-height:1.55;margin:16px 0 0;color:#1d2024}
.z5 .z5-ld{font-weight:700;font-size:15.5px;color:#1d2024}
.z5-sgn{margin:14px 0 0;display:flex;align-items:flex-end;gap:14px;font-family:var(--ft);font-size:12.5px;color:#3b3f44}.z5-sgn .ink .h{font-size:26px;color:#1d3a8a}
.z5-mn{grid-column:2!important;grid-row:2/9;align-self:start;position:relative;margin-top:96px;padding-left:20px;font-family:var(--fh);font-weight:700;font-size:20px;line-height:1.32;color:#2c3036;transform:rotate(-2.2deg)}
.z5-mn svg{position:absolute;left:-6px;top:-8px;width:20px;height:calc(100% + 16px);overflow:visible}
.z5-mn small{display:block;margin-top:8px;font-weight:400;font-size:15px;color:var(--zpe)}
/* what really happened: a small index card */
.z5-card{position:relative;width:480px;box-sizing:border-box;padding:26px 32px 20px;background-color:#fcfcf9;transform:rotate(-.6deg);box-shadow:0 20px 44px rgba(30,40,50,.22),0 2px 5px rgba(30,40,50,.12);
  background-image:linear-gradient(180deg,transparent 64px,rgba(194,42,46,.5) 64px,rgba(194,42,46,.5) 65.5px,transparent 65.5px),repeating-linear-gradient(180deg,transparent 0 25px,rgba(40,100,160,.14) 25px 26px);background-position:0 0,0 13px}
.z5 .z5-card h2{margin:0 0 22px;font-family:var(--fd);font-weight:700;font-size:25px;line-height:1.1}
.z5 .z5-card p{margin:0;font-family:var(--fd);font-size:15.5px;line-height:26px;color:#1d2024;max-width:none}
.z5 .z5-card p sup{font-family:var(--ft);font-size:10px;color:var(--zr)}
.z5-card ol{margin:16px 0 0;padding:10px 0 0 18px;border-top:1px solid #9aa0a5;font-family:var(--ft);font-size:11.5px;line-height:1.5;color:#3b3f44}
.z5-card ol a{color:inherit;text-underline-offset:2px}
.z5-card ol a:hover{color:var(--zr)}
@media (max-width:1280px){.z5-dec .zdk-main{grid-template-columns:minmax(190px,1fr) minmax(560px,620px) minmax(230px,1fr)}.z5-dec .zdk-doc{padding:28px 40px 28px}
  .z5-bill .zdk-main{grid-template-columns:minmax(170px,1fr) minmax(700px,760px) minmax(40px,.4fr)}.z5-bill .zdk-doc{grid-template-columns:1fr 190px;padding:28px 28px 26px 40px}.z5-mn{font-size:18.5px}}
@media (prefers-reduced-motion:reduce){.z5-np.drop,.z5-np.away,.z5-tag.pin .pp,.z5-tag.flash .pp{animation:none}.z5-tag .lb{transition:none}.z5-brief.away{transition:none}}
`;
let css5=false;
function mount5(){M.mount();if(css5)return;css5=true;const st=document.createElement('style');st.id='zmmCss5';st.textContent=CSS5;document.head.appendChild(st);loadDeskFonts();}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const dayOf=v=>{if(!v)return undefined;const d=new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?v+'T12:00:00':v);return isFinite(d)?d:undefined;};
const isoDay=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const longDay=d=>`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const paras=t=>(Array.isArray(t)?t:String(t||'').split(/\n\n+/)).filter(Boolean).map(hd);

/* the pile: documents the player has already signed, so tags and briefing lines can open them.
   ZMMoney.setPile(state.docs) once per chapter; each doc {id, title, year, kind, summary, stamp?} */
let PILE=[];
M.setPile=function(docs){PILE=(docs||[]).slice();return PILE;};
const findDoc=id=>PILE.find(d=>d.id===id)||PILE.find(d=>d.title===id);
const stampFor=d=>d.stamp||({agreement:'Executed',concession:'Executed',budget:'Approved',minutes:'Approved','route-agreement':'Signed',route:'Signed',declined:'Declined',choice:'Approved',order:'Filed',letter:'Filed'}[d.kind])||'Filed';

/* a desk for the paper screens: grid paper with the masterplan in faint drafting ink */
function desk5(cls,inner){mount5();const plan=document.getElementById('planTpl');const sp=typeof stripDesk==='function'?stripDesk():'';   // the flight strip, top right, once ZMMoney.setStrip has been called
  const bay=(sp.match(/class="zfs-e/g)||[]).length;
  return open(`<div class="zdk z5 ${cls||''}${sp?' has-strip':''}" style="--bay:${bay}">${INK_DEFS}<div class="zdk-sheet" aria-hidden="true"><div class="zdk-plan">${plan?plan.innerHTML:''}</div></div>${sp}${inner}</div>`,'zmm-ob');}
function pileCards(docs){return (docs||[]).slice(-5).map((d,n)=>`<div class="zdk-card z5c" style="--i:${n};--r:${[-4,3,-2,5,-3][n%5]}deg;animation:none" data-doc="${esc(d.id)}" title="Open: ${esc(d.title)}"><span>${esc(d.title)}</span><i></i><i></i><i class="s"></i>${stampHtml(stampFor(d),'mini',dayOf(d.date))}</div>`).join('');}
function wirePile(root,docs){root.querySelectorAll('.zdk-card.z5c').forEach(c=>c.onclick=()=>{const d=(docs||[]).find(x=>x.id===c.dataset.doc)||findDoc(c.dataset.doc);if(d)M.openDoc(d);});}

/* the photo box: the masterplan, cropped to the detail that matters, in pen and ink */
const CROPS={'intl-pier':'-1300 -1120 1500 760','pier':'-1300 -1120 1500 760','runway':'-2600 -3300 5200 2200','hall':'-3300 -1500 2500 1900','transfer':'-1900 -400 2300 1500'};
function photoSvg(kind){const t=document.getElementById('planTpl'),vb=CROPS[kind]||CROPS['intl-pier'];
  if(t&&t.innerHTML.indexOf('<svg')>=0)return t.innerHTML.replace(/<svg([^>]*?)viewBox="[^"]*"/,`<svg$1viewBox="${vb}" preserveAspectRatio="xMidYMid slice"`);
  // no masterplan on the page: a plain ink drawing of a pier with widebodies on its stands (drawn dark-on-light, then inverted like the plan)
  let s='';for(let i=0;i<7;i++){const x=70+i*78;s+=`<path d="M${x} 118 v-46 M${x-20} 70 h40 M${x} 52 v-18" stroke="#fff" stroke-width="3"/><path d="M${x} 150 v46 M${x-20} 198 h40 M${x} 216 v18" stroke="#fff" stroke-width="3"/>`;}
  return `<svg viewBox="0 0 640 260" preserveAspectRatio="xMidYMid slice"><rect width="640" height="260" fill="#0f1417"/><rect x="20" y="118" width="600" height="32" fill="none" stroke="#fff" stroke-width="3"/>${s}</svg>`;}
/* a paper slap: a short filtered noise burst. Silent if audio is not allowed yet. */
/* hub.js keeps its AudioContext private, so this has its own; it follows the game's Sound on/off button (#snd). */
function noise(dur,cut,gain,at,pow){try{const sb=document.getElementById('snd');if(sb&&!sb.classList.contains('on'))return;
  const A=window.AudioContext||window.webkitAudioContext;if(!A)return;const a=M._ac||(M._ac=new A());if(a.state==='suspended')a.resume();if(a.state==='closed')return;
  const n=Math.floor(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,pow);
  const s=a.createBufferSource();s.buffer=b;const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;const g=a.createGain();g.gain.value=gain;s.connect(f);f.connect(g);g.connect(a.destination);s.start(a.currentTime+at);}catch(e){}}
const slap=()=>noise(.16,1600,.5,.36,5);
/* the stamp: a short low thud, timed to the stamp's landing */
const thud=()=>noise(.11,320,.9,.12,3);

/* ZMMoney.frontPage(opts) → Promise<void>. opts = VSIEra.ch5.frontPage(state):
   {masthead, dateLine, price, lead, deck, sub:{head, body}, columns:[{head, body} ×2], photo:{kind, caption}}
   optional: edition (left ear), cta (default "Turn it over"). The paper drops on the desk and settles; "Turn it over" resolves. */
/* the newsprint itself, shared by the front page and the cliffhanger (the Late City edition) */
function npInner(o){const cols=(o.columns||[]).slice(0,2),ph=o.photo||{};
  return `<header class="z5-mast"><div class="z5-ear">${o.late?'':esc(o.edition||'Nagpur edition')}</div><h1>${esc(o.masthead||'The Zero Mile Times')}</h1><div class="z5-ear r">${esc(o.price||'')}<br>Weather: clear</div>${o.late?`<div class="zcl-late" aria-label="Late City edition">${stampHtml('Late City','zcl-ls',dayOf(o.date))}</div>`:''}</header>
    <div class="z5-dl"><span>${esc(hd(o.dateLine||''))}</span><span>${esc(M.cfg.airportName)} and the world</span></div>
    <h2 class="z5-lead">${esc(o.lead||'')}</h2>${o.deck?`<p class="z5-deck">${esc(o.deck)}</p>`:''}
    <div class="z5-body"><figure class="z5-photo"><div class="ph">${photoSvg(ph.kind)}</div>${ph.caption?`<figcaption>${esc(ph.caption)}</figcaption>`:''}</figure>
      ${o.sub?`<section class="z5-sub"><h3>${esc(o.sub.head)}</h3><div class="z5-cc">${paras(o.sub.body).map(p=>`<p class="z5-txt">${esc(p)}</p>`).join('')}</div></section>`:''}
      ${o.company||o.founder?`<figure class="z5-sg"><div class="ink">${o.signature?`<img src="${esc(o.signature)}" alt="">`:H(o.founder||o.company)}</div><figcaption>From our files: the signature on the concession${o.founder?', '+esc(o.founder):''}${o.company?', for '+esc(o.company):''}.</figcaption></figure>`:''}
      <aside class="z5-cols">${cols.map(c=>`<section><h4>${esc(c.head)}</h4>${paras(c.body).map(p=>`<p class="z5-txt">${esc(p)}</p>`).join('')}</section>`).join('')}</aside></div>`;}
M.frontPage=function(o){o=o||{};return new Promise(res=>{
  const sh=desk5('z5-fp',`<div class="z5-stage"><article class="z5-np" id="z5Np" aria-label="${esc(o.masthead||'The Zero Mile Times')}">${npInner(o)}
  </article><div class="z5-acts"><button class="zdk-go" id="z5Turn">${esc(o.cta||'Turn it over')}</button></div></div>`);
  const np=sh.querySelector('#z5Np');
  const fit=()=>{np.style.setProperty('--s',1);const h=np.offsetHeight,w=np.offsetWidth,av=sh.clientHeight-96-(sh.querySelector('.has-strip')?(parseFloat(getComputedStyle(sh.querySelector('.z5-stage')).paddingTop)||98)-20:0),aw=sh.clientWidth-60;const s=Math.min(1,av/h,aw/w);np.style.setProperty('--s',s.toFixed(3));np.style.marginBottom=(-(1-s)*h)+'px';};
  fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);
  if(!reduced()){np.classList.add('drop');slap();}
  let gone=false;sh.querySelector('#z5Turn').onclick=()=>{if(gone)return;gone=true;
    if(reduced()){close();res();return;}np.classList.remove('drop');void np.offsetWidth;np.classList.add('away');setTimeout(()=>{close();res();},430);};
});};

/* ZMMoney.decision(opts) → Promise<{choice, signedOn}>. opts = VSIEra.ch5.decision(state):
   {docType, docId, title, parties:{airport, airline, signatory:{name, title, hand?}}, body:[typed paragraphs],
    choices:[{id, label, terms, slip:{big, money, line}, act?}], stamps:{[id]: word}}
   optional: date (shown on the document), founder, parent, signature (PNG data URL from onboarding), pile:[docs], slipQuestion.
   One document; the adviser's slip shows the ticked choice's one big number; signing brings down the red stamp. */
M.decision=function(o){o=o||{};return new Promise(res=>{
  const ch=o.choices||[],pa=o.parties||{},sg=Object.assign({hand:{font:'La Belle Aurore',size:30,adv:.46,slant:2,rot:-4,ink:'#14161a',weight:.2,flourish:'under'}},pa.signatory||{});
  const pile=o.pile||PILE,now=new Date(),sd=dayOf(o.date),dateTxt=sd?longDay(sd):(hd(o.date)||longDay(now));
  const docName={'route-agreement':'Route agreement','capital-budget':'Capital budget','order':'Regulator\'s order','letter':'Letter'}[o.docType]||'Agreement';
  let pick=null,done=false;
  const sh=desk5('z5-dec',`<header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pileCards(pile)}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc arrive" id="zdkDoc">
      <div class="zdk-dh">${vsiLogo(22)}<span>${esc(docName)} · ${esc(o.docId||'')}</span><span class="dt">${esc(dateTxt)}</span></div>
      <h2>${esc(o.title||docName)}</h2>
      ${paras(o.body).map(p=>`<p class="t">${esc(p)}</p>`).join('')}
      <p class="t">The parties agree to the line ticked below.</p>
      <div class="zdk-ticks" role="radiogroup" aria-label="The terms">${ch.map(c=>`<button role="radio" aria-checked="false" data-id="${esc(c.id)}"><i></i><span>${esc(c.label)}</span>${c.terms?`<small>${esc(c.terms)}</small>`:''}</button>`).join('')}</div>
      <div class="zdk-sigs"><div class="s"><div class="ink">${signSvg(sg)}</div><span><b>${esc(sg.name||'')}</b><br>${esc(sg.title||'Authorised signatory')}</span><small>for ${esc(pa.airline||'Haversine Airways')}</small></div>
        <div class="s" id="z5Me"><div class="ink"></div><span><b>${esc(o.founder||'Director')}</b><br>Director${o.parent?', for '+esc(o.parent):''}</span><small>for ${esc(M.cfg.spvShort)}</small></div></div>
    </article><div class="zdk-acts"><button class="zdk-go" id="z5Sign" disabled>Tick one line first</button></div></div>
    <aside class="zdk-note arrive" id="zdkNote" aria-live="polite"></aside></main>`);
  wirePile(sh,pile);
  const doc=sh.querySelector('#zdkDoc'),note=sh.querySelector('#zdkNote'),go=sh.querySelector('#z5Sign');
  const actOf=c=>c.act||(c.id==='decline'?'Decline the agreement':'Sign the agreement');
  // every line's connections, money and stake at once, so the three can be compared; the ticked one gets its warning
  const slipNow=()=>{const c=ch.find(x=>x.id===pick);
    note.innerHTML=`<h3>${esc(o.slipQuestion||'What each line does for VSI')}</h3>${ch.map(x=>{const s=x.slip||{};return `<div class="z5-sl${x.id===pick?' on':''}"><b>${esc(x.label)}</b><span>${esc([s.big,s.money].filter(Boolean).join(' · '))}</span>${s.stake?`<span>${esc(s.stake)}</span>`:''}</div>`;}).join('')}${c&&c.slip&&c.slip.line?`<p>${esc(c.slip.line)}</p>`:''}`;};
  slipNow();
  sh.querySelectorAll('.zdk-ticks button').forEach(b=>b.onclick=()=>{if(done)return;pick=b.dataset.id;sh.querySelectorAll('.zdk-ticks button').forEach(x=>x.setAttribute('aria-checked',x===b?'true':'false'));
    const c=ch.find(x=>x.id===pick);go.disabled=false;go.textContent=actOf(c);slipNow();});
  go.onclick=()=>{if(done||!pick)return;done=true;go.disabled=true;
    const me=sh.querySelector('#z5Me .ink');const sgs=sh.querySelector('.zdk-sigs');if(sgs&&doc.scrollHeight>doc.clientHeight)doc.scrollTo({top:doc.scrollHeight,behavior:reduced()?'auto':'smooth'});me.innerHTML=o.signature?`<img src="${esc(o.signature)}" alt="Your signature">`:H(o.founder||M.cfg.spvShort);
    const word=(o.stamps||{})[pick]||(pick==='decline'?'Declined':'Signed');
    (sgs||doc).insertAdjacentHTML('beforeend',stampHtml(word,'down',sd));doc.classList.remove('arrive');if(!reduced())thud();
    const fin=()=>{close();res({choice:pick,signedOn:isoDay(sd||now)});};
    if(reduced()){setTimeout(fin,700);return;}
    setTimeout(()=>{const p=sh.querySelector('#zdkPile'),n=Math.min(5,p.children.length),cd=document.createElement('div');cd.className='zdk-card';cd.style.setProperty('--i',n);cd.style.setProperty('--r','-3deg');
      cd.innerHTML=`<span>${esc(o.title||docName)}</span><i></i><i></i><i class="s"></i>${stampHtml(word,'mini',sd)}`;doc.classList.add('leave');note.style.opacity='0';setTimeout(()=>p.appendChild(cd),380);},900);
    setTimeout(fin,2100);};
});};

/* ZMMoney.briefing(opts) → Promise<void>. opts = VSIEra.ch5.briefing(state):
   {title, date, lines:[{text, docId}] (3), watch, autoStartSec}. optional: docs (else the pile from setPile).
   A torn notepad sheet pinned top-left over the live ops view. It is not a modal: the game stays visible.
   It resolves after autoStartSec (the countdown waits while a document is open), or on a click on the sheet. */
M.briefing=function(o){o=o||{};mount5();return new Promise(res=>{
  const app=$('#app');if(!app){res();return;}
  const old=$('#z5Brief');if(old)old.remove();
  const docs=o.docs||PILE,dOf=id=>id==null?null:(docs.find(d=>d.id===id||d.title===id)||findDoc(id)||{title:id});
  const ref=(id,short)=>{const d=dOf(id);return d?`<button class="z5-ref" data-doc="${esc(id)}">${esc(short||d.title)}${!short&&d.year!=null&&!/\d{4}/.test(d.title)?', '+esc(d.year):''}</button>`:'';};
  // a torn top edge: a seeded zigzag, so the same sheet always tears the same way
  let q=17;const rnd=()=>((q=(q*9301+49297)%233280)/233280);const pts=['0% 100%','100% 100%'];for(let x=100;x>=0;x-=2.5)pts.push(`${x}% ${(rnd()*7).toFixed(1)}px`);
  const el=document.createElement('aside');el.className='z5v z5-brief';el.id='z5Brief';el.setAttribute('role','note');el.setAttribute('aria-label',o.title||'Handover');
  const sec=Math.max(0,+(o.autoStartSec==null?6:o.autoStartSec));
  el.innerHTML=`<i class="z5-pin" aria-hidden="true"></i><div class="z5-pad" style="clip-path:polygon(${pts.join(',')})">
    <header><b>${esc(o.title||'Duty manager’s handover')}</b><span>${esc(hd(o.date||''))}</span></header>
    <ol>${(o.lines||[]).slice(0,3).map(l=>`<li><span class="h">${esc(l.text)}</span>${ref(l.docId!=null?l.docId:l.doc,l.ref)}</li>`).join('')}</ol>
    ${o.watch?`<div class="z5-watch"><small>The one thing to watch</small><span>${esc(o.watch)}</span></div>`:''}
    <footer><button id="z5Go">Start the shift</button><span id="z5Cd"></span></footer></div>`;
  el.addEventListener('keydown',e=>e.stopPropagation());
  app.appendChild(el);
  let left=sec,reading=false,over=false;const cd=el.querySelector('#z5Cd');
  const show=()=>{cd.textContent=sec?`or it starts in ${left} s`:'';};show();
  const go=()=>{if(over)return;over=true;clearInterval(t);el.classList.add('away');setTimeout(()=>el.remove(),reduced()?0:400);res();};
  const t=sec?setInterval(()=>{if(reading)return;left--;show();if(left<=0)go();},1000):0;
  el.querySelectorAll('.z5-ref').forEach(b=>b.onclick=e=>{e.stopPropagation();const d=dOf(b.dataset.doc);if(!d)return;reading=true;M.openDoc(d).then(()=>{reading=false;});});
  el.querySelector('.z5-pad').onclick=go;
});};

/* ZMMoney.openDoc(doc) → Promise<void>: a read-only page from the pile: title, year, summary, stamp.
   doc may be an id from setPile. Fires window 'zmm-doc' {detail:{open:true|false, doc}} so the game can pause while it reads. */
M.openDoc=function(doc){mount5();if(typeof doc==='string')doc=findDoc(doc)||{title:doc};doc=doc||{};return new Promise(res=>{
  const app=$('#app');if(!app){res();return;}
  let v=$('#z5Doc');if(!v){v=document.createElement('div');v.id='z5Doc';v.className='z5v';app.appendChild(v);v.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape')v._close&&v._close();});}
  const yr=doc.year!=null?(doc.year>1900?String(doc.year):'Year '+doc.year+' of the concession'):'';
  v.innerHTML=`<article class="z5-rd" role="dialog" aria-modal="true" aria-label="${esc(doc.title||'Document')}" tabindex="-1"><div class="zdk-dh">${vsiLogo(20)}<span>From the pile${yr?' · '+esc(yr):''}</span></div>
    <h2>${esc(doc.title||'')}</h2>${paras(doc.summary).map(p=>`<p>${esc(p)}</p>`).join('')}${stampHtml(stampFor(doc),'',dayOf(doc.stampedOn||doc.date))}
    <button class="zdk-q" id="z5DocX">Put it back on the pile</button></article>`;
  v.hidden=false;
  const fin=()=>{v.hidden=true;v._close=null;window.dispatchEvent(new CustomEvent('zmm-doc',{detail:{open:false,doc}}));res();};
  v._close=fin;v.onclick=e=>{if(e.target===v)fin();};v.querySelector('#z5DocX').onclick=fin;
  setTimeout(()=>{const a=v.querySelector('#z5DocX');a&&a.focus({preventScroll:true});},30);
  window.dispatchEvent(new CustomEvent('zmm-doc',{detail:{open:true,doc}}));
});};

/* margin pins (the paper trail on the map): ZMMoney.tag(id, {doc, line, docId}) creates one; ZMMoney.tagAt(id, sx, sy) sets its
   spot, a screen point relative to #app (call every frame); ZMMoney.tagRemove(id). The pin itself never sits on the spot: a 12px
   pushpin in the margin, joined to the spot by a dashed leader. Open, it shows at most two short lines (the line, then the
   document's title); clicking the open lines opens the document. At most two are open at once; each folds 6 s after it opened.
   The pin and its lines (sized as if open) stay outside every shape from ZMMoney.tagAvoid(shapes) (runways, taxiways, the
   terminal), the HUD panels and the other pins; if there is room only for the pin, the lines never open on the map (a click opens
   the document); if there is no room at all, the tag hides until there is. */
/* DESIGN.md §14.5: a 12px pushpin; a slip of at most two lines in Courier 10px (the document's short name in bold, then the line),
   110px wide and growing with its text up to 232px (see the decision in DESIGN.md §21); a 1px dashed leader. */
const TAGS=new Map(),TAG_W=127,TAG_H=32,TAG_SLIP_MIN=110,TAG_SLIP_MAX=232,TAG_OPEN_MS=6000,TAG_MAX_OPEN=2;
let tagCv=null;
function tagWidth(a,b){const f=(t,bold)=>{t=String(t||'');try{tagCv=tagCv||document.createElement('canvas').getContext('2d');tagCv.font=(bold?'700 ':'400 ')+"10px 'Courier Prime','Courier New',monospace";return tagCv.measureText(t).width;}catch(e){return t.length*6.1;}};
  return 17+Math.round(Math.max(TAG_SLIP_MIN,Math.min(TAG_SLIP_MAX,Math.ceil(Math.max(f(a,true),f(b,false)))+15)));}
/* the slip's bold line is the document's short name: o.short if given, else the title, with "X with Y" read as "X, Y" and
   words dropped from the end of Y until it fits the widest slip ("Route agreement with Haversine Airways" → "Route agreement, Haversine") */
function tagShort(t){t=String(t||'');const fits=x=>{tagWidth('','');try{return tagCv.measureText(x).width;}catch(e){return x.length*6.1;}},max=TAG_SLIP_MAX-17-15;
  try{tagCv.font="700 10px 'Courier Prime','Courier New',monospace";}catch(e){}
  if(fits(t)<=max)return t;let s=t.replace(/^(.+?) (?:with|for|from|to) (.+)$/,'$1, $2');
  const m=/^(.*?, )(.+)$/.exec(s);if(m){let w=m[2].split(' ');while(w.length>1&&fits(m[1]+w.join(' '))>max)w.pop();s=m[1]+w.join(' ');}
  return s;}
const PUSHPIN='<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 7.2 L5.1 11.6 L6.9 11.6 Z" fill="#5b5f63" transform="rotate(18 6 7)"/><circle cx="6" cy="4.6" r="4.2" fill="#c22a2e"/><circle cx="4.7" cy="3.3" r="1.3" fill="#f08a8c"/></svg>';
function tagLayer(){mount5();let l=$('#z5Tags');if(!l){const app=$('#app');if(!app)return null;l=document.createElement('div');l.id='z5Tags';l.className='z5v';
  const fl=$('#zmmFloat');if(fl)app.insertBefore(l,fl);else app.appendChild(l);}return l;}   // under the floaters
function tagOpen(t,ms){if(t.classList.contains('pinonly')||t.classList.contains('nowhere'))return;
  if(!t.classList.contains('open')){const open=[...TAGS.values()].filter(o=>o!==t&&o.classList.contains('open')).sort((u,v)=>u._openAt-v._openAt);
    while(open.length>=TAG_MAX_OPEN)tagFold(open.shift());   // at most two open: the oldest folds
    t._openAt=performance.now();t.classList.add('open');}
  clearTimeout(t._fold);if(ms)t._fold=setTimeout(()=>{if(t.matches(':hover'))return;tagFold(t);},ms);}
function tagFold(t){clearTimeout(t._fold);t.classList.remove('open');}
/* the shapes to keep clear, relative to #app. A rectangle: {l,t,r,b} | {left,top,right,bottom} | {x,y,w,h} | {x0,y0,x1,y1} | [x,y,w,h].
   A polygon: [[x,y],...] | [{x,y},...] | {pts|points|poly:[...], kind}. kind:'region' (or opt.region) is the free map area. */
const nrect=q=>{if(!q)return null;
  const ln=!Array.isArray(q)&&(q.line||q.path);   // a polyline: a moving aircraft's next 60 s, {line|path:[[x,y],...]}
  if(ln&&ln.length>1){const pts=ln.map(p=>Array.isArray(p)?[+p[0],+p[1]]:[+p.x,+p.y]).filter(p=>isFinite(p[0])&&isFinite(p[1]));if(pts.length<2)return null;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return{l:Math.min(...xs),t:Math.min(...ys),r:Math.max(...xs),b:Math.max(...ys),kind:q.kind||'path',pts,open:true};}
  const pl=Array.isArray(q)&&q.length&&typeof q[0]==='object'?q:!Array.isArray(q)&&(q.pts||q.points||q.poly);
  if(pl){const pts=pl.map(p=>Array.isArray(p)?[+p[0],+p[1]]:[+p.x,+p.y]).filter(p=>isFinite(p[0])&&isFinite(p[1]));if(pts.length<3)return null;
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);return{l:Math.min(...xs),t:Math.min(...ys),r:Math.max(...xs),b:Math.max(...ys),kind:q.kind,pts};}
  if(Array.isArray(q))q={x:q[0],y:q[1],w:q[2],h:q[3]};
  const l=q.l??q.left??q.x0??q.x,t=q.t??q.top??q.y0??q.y,r=q.r??q.right??q.x1??(q.w!=null&&l!=null?l+q.w:q.width!=null?l+q.width:null),b=q.b??q.bottom??q.y1??(q.h!=null&&t!=null?t+q.h:q.height!=null?t+q.height:null);
  return [l,t,r,b].every(v=>isFinite(v))?{l:Math.min(l,r),t:Math.min(t,b),r:Math.max(l,r),b:Math.max(t,b),kind:q.kind}:null;};
let AVOID=[],FREE=null,HUDC={at:-1e9,rs:[],W:0,H:0};
M.tagAvoid=function(shapes,opt){const rs=(shapes||[]).map(nrect).filter(Boolean);FREE=nrect(opt&&opt.region)||(rs.find(r=>r.kind==='region')||null);
  const key=rs.map(r=>`${r.l|0},${r.t|0},${r.r|0},${r.b|0}`).join(';');AVOID=rs.filter(r=>r.kind!=='region');
  if(key!==M._avoidKey){M._avoidKey=key;for(const [,t] of TAGS)t._box=null;}   // the shapes moved (a view change): place every pin again
  return AVOID.length;};
M.tagShapes=()=>AVOID.map(r=>Object.assign({},r));
// the HUD's own panels, read from the page (at most every 200 ms)
const HUD_SEL=['#top','#rail','#wave','#zoomBox','#toast','#vipBanner.on','#guard.on','#fogTag','#stopBtn','#kiteChip','#wedChip','#delegChip','#delegLT.on','#camLbl','#pop','#z5Brief','#zmmChip'];
function hudRects(){const now=performance.now();if(now-HUDC.at<200)return HUDC;const app=$('#app');if(!app)return HUDC;const a=app.getBoundingClientRect(),rs=[];
  for(const s of HUD_SEL){const e=document.querySelector(s);if(!e||e.hidden)continue;const r=e.getBoundingClientRect();if(r.width<2||r.height<2)continue;const cs=getComputedStyle(e);if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.05)continue;
    rs.push({l:r.left-a.left,t:r.top-a.top,r:r.right-a.left,b:r.bottom-a.top});}
  HUDC={at:now,rs,W:a.width,H:a.height};return HUDC;}
const hitR=(a,b,p)=>a.l<b.r+p&&a.r>b.l-p&&a.t<b.b+p&&a.b>b.t-p;
const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [xi,yi]=P[i],[xj,yj]=P[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;};
const segX=(a,b,c,d)=>{const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)!==o(a,b,d)&&o(c,d,a)!==o(c,d,b);};
// does box a (padded by p) touch shape q (a rectangle or a polygon)?
function hitS(a,q,p){if(!hitR(a,q,p))return false;if(!q.pts)return true;
  const L=a.l-p,T=a.t-p,R=a.r+p,B=a.b+p,P=q.pts,C=[[L,T],[R,T],[R,B],[L,B]];
  if(P.some(([x,y])=>x>L&&x<R&&y>T&&y<B))return true;if(!q.open&&C.some(([x,y])=>inPoly(x,y,P)))return true;
  for(let i=q.open?1:0,j=q.open?0:P.length-1;i<P.length;j=i++)for(let k=0;k<4;k++)if(segX(P[j],P[i],C[k],C[(k+1)%4]))return true;return false;}
function tagSize(t){return t.classList.contains('pinonly')?{w:12,h:12}:{w:t._w||TAG_W,h:TAG_H};}
function tagPlace(t,sx,sy,cx,cy,w,h){const hc=hudRects(),M4=4;
  const R=FREE||{l:0,t:0,r:hc.W,b:hc.H};
  const others=[];for(const [,o] of TAGS){if(o===t||o.hidden||!o._box)continue;others.push(o._box);}
  const ok=bx=>bx.l>=R.l+M4&&bx.r<=R.r-M4&&bx.t>=R.t+M4&&bx.b<=R.b-M4&&!AVOID.some(q=>hitS(bx,q,8))&&!hc.rs.some(q=>hitR(bx,q,6))&&!others.some(q=>hitR(bx,q,6))&&!(sx>bx.l-12&&sx<bx.r+12&&sy>bx.t-12&&sy<bx.b+12);
  const box=(l,tp)=>({l,t:tp,r:l+w,b:tp+h});
  // keep the pin where it is while that place is still clear and the spot is not far off: a pin that jumps is unreadable
  const pv=t._box&&box(t._box.l,t._box.t);if(pv&&ok(pv)&&Math.hypot((pv.l+pv.r)/2-sx,(pv.t+pv.b)/2-sy)<520)return pv;
  const cands=[];if(isFinite(cx)&&isFinite(cy))cands.push(box(sx+cx,sy+cy));
  const G=16,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(AVOID.length){const F={l:Math.min(...AVOID.map(q=>q.l)),t:Math.min(...AVOID.map(q=>q.t)),r:Math.max(...AVOID.map(q=>q.r)),b:Math.max(...AVOID.map(q=>q.b))};
    const yc=cl(sy-h/2,R.t+M4,R.b-h-M4),xc=cl(sx-w/2,R.l+M4,R.r-w-M4),side=[box(F.r+G,yc),box(F.l-G-w,yc),box(xc,F.t-G-h),box(xc,F.b+G)];
    side.sort((u,v)=>Math.hypot((u.l+u.r)/2-sx,(u.t+u.b)/2-sy)-Math.hypot((v.l+v.r)/2-sx,(v.t+v.b)/2-sy));
    for(const c of side){cands.push(c);for(let k=1;k<6;k++){cands.push(box(c.l,c.t+k*(h+8)));cands.push(box(c.l,c.t-k*(h+8)));}}}
  for(let rad=30;rad<=760;rad+=30)for(let k=0;k<16;k++){const an=k/16*Math.PI*2-Math.PI/4,x=sx+Math.cos(an)*rad,y=sy+Math.sin(an)*rad;cands.push(box(x-(Math.cos(an)<0?w:0),y-(Math.sin(an)<0?h:0)));}
  for(const c of cands)if(ok(c))return c;
  return null;}
let tagN=0;
M.tag=function(id,o){
  if(typeof id==='number'){const x=id,y=o,title=arguments[2],line=arguments[3],docId=arguments[4],k='t'+(++tagN);
    const el=M.tag(k,{doc:title,line,docId:docId||title});M.tagAt(k,x,y);
    return {el,move:(sx,sy,cx,cy)=>M.tagAt(k,sx,sy,cx,cy),remove:()=>M.tagRemove(k),flash:()=>M.tagFlash(k),
      size:()=>{const w=el&&el._w||TAG_W;return{w,h:TAG_H};}};}
  o=o||{};const l=tagLayer();if(!l)return null;let t=TAGS.get(id);const fresh=!t;
  if(!t){t=document.createElement('div');t.className='z5-tag'+(reduced()?'':' pin');t.hidden=true;l.appendChild(t);TAGS.set(id,t);
    t.addEventListener('mouseenter',()=>tagOpen(t,0));
    t.addEventListener('mouseleave',()=>{if(t.classList.contains('open'))tagOpen(t,Math.max(1500,TAG_OPEN_MS-(performance.now()-(t._openAt||0))));});}
  const line=hd(o.line||''),doc=o.short||tagShort(o.doc||''),full=o.doc||doc;
  // two lines: the document's short name in bold, then the line (DESIGN.md §14.5)
  const w=tagWidth(doc||line,doc?line:'');if(t._w!==w){t._w=w;t._box=null;}
  t.dataset.id=id;t.innerHTML=`<i class="ld" aria-hidden="true"></i><i class="sp" aria-hidden="true"></i><div class="mp"><button class="pp" aria-label="${esc(full)}: ${esc(line)}" title="${esc(full)}">${PUSHPIN}</button><button class="lb" tabindex="-1" title="${esc(full)}: ${esc(line)}"><b>${esc(doc||line)}</b>${line&&doc?`<small>${esc(line)}</small>`:''}</button></div>`;
  const openDoc=()=>{const d=(o.docId&&findDoc(o.docId))||findDoc(o.doc)||{title:o.doc,summary:o.line};M.openDoc(d);};
  // the pin: folded, a click opens the two lines; open (or no room for the lines), a click opens the document. The lines open the document.
  t.querySelector('.pp').onclick=()=>{if(t.classList.contains('pinonly')||t.classList.contains('open')){openDoc();return;}tagOpen(t,TAG_OPEN_MS);};
  t.querySelector('.lb').onclick=openDoc;
  if(fresh)t._new=true;   // opens for 6 s the first time it finds a place
  return t;};
M.tagAt=function(id,sx,sy,cx,cy){const t=TAGS.get(id);if(!t)return;if(!isFinite(sx)||!isFinite(sy)){t.hidden=true;t._pin=null;t._box=null;return;}t.hidden=false;
  t.style.transform=`translate(${Math.round(sx)}px,${Math.round(sy)}px)`;t._pin={x:sx,y:sy};
  // room for the pin and its two lines; else room for the pin alone; else hide until there is
  const TW=t._w||TAG_W;let bx=tagPlace(t,sx,sy,cx,cy,TW,TAG_H),only=false;
  if(!bx){bx=tagPlace(t,sx,sy,NaN,NaN,12,12);only=!!bx;}
  t._box=bx;t.classList.toggle('nowhere',!bx);t.classList.toggle('pinonly',only);if(only)tagFold(t);if(!bx){tagFold(t);return;}
  const rx=Math.round(bx.l-sx),ry=Math.round(bx.t-sy),flip=!only&&bx.r<sx;   // a pin left of its spot puts its lines on the left
  if(t._cx!==rx||t._cy!==ry||t._fl!==flip){t._cx=rx;t._cy=ry;t._fl=flip;t.style.setProperty('--cx',rx+'px');t.style.setProperty('--cy',ry+'px');t.classList.toggle('flip',flip);
    t.style.setProperty('--bw',(only?12:TW)+'px');t.style.setProperty('--bh',(only?12:TAG_H)+'px');}
  // the dashed leader runs from the spot to the pin's needle
  const ex=rx+(flip?(only?12:TW)-6:6),ey=ry+(only?11:14);
  t.style.setProperty('--tl',Math.hypot(ex,ey).toFixed(1)+'px');t.style.setProperty('--ta',Math.atan2(ey,ex).toFixed(3)+'rad');
  if(t._new){t._new=false;if(!only)tagOpen(t,TAG_OPEN_MS);}};
M.tagFlash=function(id){const t=TAGS.get(id);if(!t)return;t.classList.remove('flash');void t.offsetWidth;t.classList.add('flash');tagOpen(t,TAG_OPEN_MS);};
M.tagOpen=function(id,on){const t=TAGS.get(id);if(!t)return false;if(on===true)tagOpen(t,TAG_OPEN_MS);else if(on===false)tagFold(t);return t.classList.contains('open');};
M.tagBox=function(id){const t=TAGS.get(id);return t&&!t.hidden&&t._box?Object.assign({},t._box,{open:t.classList.contains('open'),pinOnly:t.classList.contains('pinonly')}):null;};
// every visible pin's box and its open state, for tests: [{id, l, t, r, b, open, pinOnly}]
M.tagBoxes=()=>[...TAGS.keys()].map(id=>{const b=M.tagBox(id);return b&&Object.assign({id},b);}).filter(Boolean);
// does any visible pin touch a tagAvoid shape? (for tests) → [{id, kind}]
M.tagClashes=()=>{const out=[];for(const b of M.tagBoxes())for(const q of AVOID)if(hitS(b,q,0))out.push({id:b.id,kind:q.kind||''});return out;};
M.tagRemove=function(id){const t=TAGS.get(id);if(t){clearTimeout(t._fold);t.remove();TAGS.delete(id);}};
M.tagClear=function(){for(const id of [...TAGS.keys()])M.tagRemove(id);};

/* connection floaters: ZMMoney.connFloat(sx, sy, {made, cr}) → "+46 connections · ₹0.4 cr" in green;
   ZMMoney.connFloat(sx, sy, {missed, rival}) → "−18 missed · Doha wins them" in red. Same-kind floaters close together merge. */
const clive=[];const nIN=n=>Math.round(n).toLocaleString('en-IN');
M.connFloat=function(sx,sy,d){M.mount();d=d||{};const fl=$('#zmmFloat');if(!fl||!isFinite(sx)||!isFinite(sy))return;
  const miss=d.missed!=null&&!(d.made>0),now=performance.now();for(let i=clive.length-1;i>=0;i--)if(now-clive[i].t>1700)clive.splice(i,1);
  const txt=o=>miss?`−${nIN(o.n)} missed · ${o.rival||'Doha'} wins them`:`+${nIN(o.n)} connection${o.n===1?'':'s'}${o.cr!=null?' · '+fmt(o.cr):''}`;
  const near=clive.find(o=>o.miss===miss&&(!miss||o.rival===d.rival)&&Math.abs(o.x-sx)<60&&Math.abs(o.y-sy)<36&&now-o.t<900);
  if(near){near.n+=miss?+d.missed||0:+d.made||0;if(d.cr!=null)near.cr=(near.cr||0)+ +d.cr;near.el.textContent=txt(near);return;}
  if(clive.length>=6){const o=clive.shift();o.el.remove();}
  const o={x:sx,y:sy,t:now,miss,n:miss?+d.missed||0:+d.made||0,cr:d.cr!=null?+d.cr:null,rival:d.rival};
  const e=document.createElement('div');e.className='zmm-f '+(miss?'mx':'cx');e.style.left=sx+'px';e.style.top=sy+'px';e.textContent=txt(o);fl.appendChild(e);o.el=e;clive.push(o);setTimeout(()=>e.remove(),1850);};
/* ZMMoney.setConnections({made, missed}): the live count, written in two places at once: the one line under the money chip
   (from then on it replaces the rate line) and a line under the top strip's CONNECTIONS box (#kCnx). Call it every time a
   passenger makes or misses a connection; null clears both when the shift is over. */
M.setConnections=function(o){M.mount();let c=$('#zmmChip');const box=$('#kCnx');
  if(o==null){if(c&&c.classList.contains('cx')){c.classList.remove('cx');c.querySelector('.r').textContent='';c.title='';}const l=box&&box.querySelector('.zmm-cxs');if(l)l.remove();return;}   // the shift is over: the rate line comes back on the next setDay
  if(!c){buildChip();c=$('#zmmChip');}
  const made=nIN(+o.made||0),missed=nIN(+o.missed||0);
  if(c){c.classList.add('cx');const r=c.querySelector('.r'),h=`<b>${made}</b> connections · <i>${missed}</i> missed`;if(r.innerHTML!==h)r.innerHTML=h;
    c.title='Money made so far this shift. Under it: passengers who made their onward flight, and those who missed it.';}
  if(box){let l=box.querySelector('.zmm-cxs');if(!l){l=document.createElement('div');l.className='zmm-cxs';box.appendChild(l);}
    const h=`<b>${made}</b> made · <i>${missed}</i> missed`;if(l.innerHTML!==h)l.innerHTML=h;}
  M._conn={made:+o.made||0,missed:+o.missed||0};};

/* ZMMoney.bill(opts) → Promise<void>. opts = the bill from VSIEra.ch5.applyShift:
   {title, year, period, paragraph, table:[{label:'Earned', cr}, {label:'Spent', cr}, {label:'Connections', made, missed}],
    margin, cover:{ratio, words, light}, stake:{pct, valueCr}}. optional: page, adviser (signs the note), cta, pile.
   One page of the annual report on white bond with one handwritten margin note. A reading moment: no stamp. */
M.bill=function(o){o=o||{};return new Promise(res=>{
  const cv=o.cover||{},r=+cv.ratio,stk=o.stake||{},pile=o.pile||PILE;
  const yr=o.year!=null?String(o.year):'';
  // rows: {label, cr, kind?:'cost'|'total'|'good'|'bad', period?} | {label, made, missed, period?} | {label, text} | {head}. period: "this afternoon", "a year", "2040–43"
  const lab=t=>`<td>${esc(t.label)}${t.period?` <small class="z5-per">${esc(hd(t.period))}</small>`:''}</td>`;
  const row=t=>t.head!=null?`<tr class="z5-th"><td colspan="2">${esc(t.head)}</td></tr>`:t.made!=null||t.missed!=null?`<tr>${lab(t)}<td class="n">${nIN(+t.made||0)} made · <i>${nIN(+t.missed||0)} missed</i></td></tr>`
    :`<tr class="${t.kind?'z5-k'+esc(t.kind):''}${t.me?' z5-me':''}">${lab(t)}<td class="n">${t.text!=null?esc(hd(t.text)):fmt(t.kind==='cost'?-Math.abs(+t.cr):+t.cr)}</td></tr>`;
  // the banks' scale: ₹90 to ₹190 earned per ₹100 due; the banks take control under ₹110 and warn under ₹130 (pencil hatching)
  const pos=isFinite(r)?Math.max(1,Math.min(99,(r-0.9)/1.0*100)):null;
  const lt=cv.light||(isFinite(r)?(r<1.1?'red':r<1.3?'amber':'green'):'');const mood={green:'The banks are relaxed',amber:'The banks are watching closely',red:'The banks are warning you'}[lt]||'';
  const sh=desk5('z5-bill',`<header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pileCards(pile)}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc arrive" id="zdkDoc">
      <div class="zdk-dh">${vsiLogo(22)}<span>${o.head?esc(o.head):esc(M.cfg.spvShort)+' · Annual report'+(yr?' '+esc(yr):'')}</span><span class="dt">page ${esc(o.page||7)}</span></div>
      <h2>${esc(o.title||'The year in one page')}</h2>
      ${o.period||o.per?`<p class="z5-pd">${esc(hd(o.period||('Every figure: '+o.per)))}</p>`:''}
      ${o.lead?`<p class="t z5-ld">${esc(hd(o.lead))}</p>`:''}
      ${paras(o.paragraph).map(p=>`<p class="t">${esc(p)}</p>`).join('')}
      <table class="zdk-tab">${(o.table||[]).map(row).join('')}</table>
      ${o.list&&o.list.items&&o.list.items.length?`<h3 class="z5-lh">${esc(o.list.title||'')}</h3><ul class="z5-ul">${o.list.items.map(x=>`<li>${esc(hd(x))}</li>`).join('')}</ul>`:''}
      ${cv.words?`<div class="z5-hl"><small>Can the airport pay the banks?${cv.years?` Hardest year, ${esc(cv.years)}`:''}</small><b>${esc(cv.words)}</b>${pos!=null?`<div class="zdk-dscr"><div class="sc"><i class="a"></i><i class="b"></i><i class="c"></i><span style="left:${pos}%"></span></div><div class="lb"><span style="left:0">the banks take control</span><span style="right:0">${esc(mood)}</span></div></div>`:''}</div>`:''}
      ${stk.words?`<p class="z5-stake">${esc(stk.words)}</p>`:stk.pct!=null?`<p class="z5-stake">Your company owns ${esc(stk.pct)}% of ${esc(M.cfg.spvShort)}${stk.valueCr!=null?`, worth about ${fmt(+stk.valueCr)}`:''}.</p>`:''}
      ${o.signed?`<div class="z5-sgn"><div class="ink">${H(o.signed.name)}</div><span><b>${esc(o.signed.name)}</b>, ${esc(o.signed.title||'')}</span></div>`:''}
      ${o.margin?`<aside class="z5-mn"><svg viewBox="0 0 20 100" preserveAspectRatio="none" aria-hidden="true"><path d="M14 2 C4 4 10 40 2 50 C10 60 4 96 14 98" fill="none" stroke="#3b3f44" stroke-width="1.6" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>${esc(hd(o.margin))}<small>${esc(o.adviser||'your adviser')}</small></aside>`:''}
    </article><div class="zdk-acts"><button class="zdk-go" id="z5Close">${esc(o.cta||'Close the books')}</button>${o.cta2?`<button class="zdk-q" id="z5Close2">${esc(o.cta2)}</button>`:''}</div></div></main>`);
  wirePile(sh,pile);
  sh.querySelector('#z5Close').onclick=()=>{close();res('cta');};const c2=sh.querySelector('#z5Close2');if(c2)c2.onclick=()=>{close();res('cta2');};
});};

/* ZMMoney.whatHappened(opts) → Promise<void>. opts = the card from VSIEra.ch5.applyShift:
   {title:'What really happened', text (2–3 sentences), sources:[{label, url}]}. optional: cta.
   A small index card on the desk; each source is a numbered footnote. */
M.whatHappened=function(o){o=o||{};return new Promise(res=>{
  const src=o.sources||[];const sup=src.map((_,i)=>i+1).join(',');
  const sh=desk5('z5-wh',`<div class="z5-stage"><article class="z5-card" aria-label="${esc(o.title||'What really happened')}"><h2>${esc(o.title||'What really happened')}</h2>
    ${paras(o.text).map((p,i,a)=>`<p>${esc(p)}${i===a.length-1&&sup?`<sup>${sup}</sup>`:''}</p>`).join('')}
    ${src.length?`<ol>${src.map(s=>`<li>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`:esc(s.label)}</li>`).join('')}</ol>`:''}
  </article><div class="z5-acts"><button class="zdk-go" id="z5Back">${esc(o.cta||'Back to the airport')}</button></div></div>`);
  sh.querySelector('#z5Back').onclick=()=>{close();res();};
});};

/* ============ the concession file: the Concession tab's saved game, tearing it up, and the record of earlier concessions ============
   ZMMoney.concessionFile(container, opts) renders into the tab (no modal). opts = {company, founder, signature (PNG data URL),
   signedOn ('YYYY-MM-DD'), year, era, stake:{pct, valueCr}, cover:{words, light}, cashCr, docs:[{id, title, date, stamp, summary}],
   record:[{company, founder, signature, years, ended:'handback'|'banks'|'torn', returnPct, endedOn}], onContinue(), onNew(), onOpenDoc(doc)}.
   opts null (or without company): only "Start the concession", which calls opts.onNew({confirmed:false}); pass {onNew, record}
   to also list the earlier concessions under it. "Start a new concession" asks once (ZMMoney.confirmTear) and calls
   onNew({confirmed:true}) only after "Tear it up and start again". Returns the root element. */
const CSSF=`
.zdk.zcf{height:auto;overflow:visible;margin:8px 0 6px;padding:24px 26px 22px;display:grid;grid-template-columns:minmax(0,1fr) 236px;gap:22px 30px;align-items:start;font-size:14px;line-height:1.45}
.zcf .zcf-doc{position:relative;background:var(--zp);padding:20px 30px 18px;box-shadow:0 14px 30px rgba(30,40,50,.2),0 1px 3px rgba(30,40,50,.12);transform:rotate(-.25deg)}
.zcf .zdk-dh{margin-bottom:14px}
.zcf-who{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:18px;align-items:end}
.zcf h2{font-family:var(--fd);font-weight:700;font-size:30px;line-height:1.08;margin:0 0 4px;color:var(--zt)}
.zcf .zcf-dir{margin:0;font-family:var(--ft);font-size:14px;color:var(--zt);max-width:none}
.zcf-sig{height:70px;border-bottom:1px solid var(--zt);display:flex;align-items:flex-end;justify-content:center;position:relative}
.zcf-sig img{max-width:100%;max-height:78px;margin-bottom:-6px}
.zcf-sig .h{font-size:28px}
.zcf-sig small{position:absolute;left:0;right:0;top:100%;padding-top:3px;font-family:var(--ft);font-size:11px;color:var(--zpe);text-align:center}
.zcf .zcf-ln{margin:26px 0 14px;font-family:var(--ft);font-size:13.5px;color:var(--zt);max-width:none}
.zcf-n3{display:grid;grid-template-columns:1fr 1.35fr 1fr;border-top:1px solid #d9dad5;border-bottom:1px solid #d9dad5}
.zcf-n3>div{padding:10px 14px 11px 0}.zcf-n3>div+div{padding-left:14px;border-left:1px solid #e3e4df}
.zcf-n3 small{display:block;font-family:var(--ft);font-size:11.5px;color:var(--zpe)}
.zcf-n3 b{display:block;font-family:var(--fh);font-weight:700;font-size:30px;line-height:1.15;color:var(--zi)}
.zcf-n3 .cv b{font-size:21px;line-height:1.25;padding-top:4px}
.zcf-n3 span{display:block;font-family:var(--ft);font-size:12.5px;color:var(--zt)}
.zcf-n3 .cv.amber span{color:var(--zw)}.zcf-n3 .cv.red span{color:var(--zr)}.zcf-n3 .cv.green span{color:var(--zg)}
.zcf .zdk-acts{padding-top:16px}
.zcf .zcf-st{position:absolute;right:18px;top:64px;--tf:rotate(-8deg) scale(.5);transform-origin:right top;filter:url(#zdkInk)}
.zcf-pile h3,.zcf-rec h3{margin:2px 0 10px;font-family:var(--fd);font-weight:700;font-size:16px;color:var(--zt)}
.zcf-pile p{margin:0;font-family:var(--ft);font-size:12px;color:var(--zpe);max-width:none}
.zcf-cards{position:relative}
.zcf-cards button{position:relative;display:block;width:100%;height:58px;margin:0 0 6px;padding:8px 12px 0;text-align:left;background:var(--zp);color:var(--zt);box-shadow:0 6px 14px rgba(30,40,50,.16),0 1px 2px rgba(30,40,50,.12);transform:rotate(var(--r));transition:transform .15s}
.zcf-cards button:hover{transform:rotate(0) translateX(-6px);z-index:2}
.zcf-cards button small{padding-right:70px}.zcf-cards button b{display:block;font-family:var(--fd);font-weight:700;font-size:13px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zcf-cards button small{display:block;font-family:var(--ft);font-size:11px;color:var(--zpe)}
.zcf-cards .zdk-stamp.mini{--tf:rotate(-7deg) scale(.32);right:8px;bottom:5px;top:auto;transform-origin:right bottom}
.zcf-more{margin-top:16px!important}
.zcf-rec{grid-column:1/-1;border-top:1px solid #b9bfbb;padding-top:12px}
.zcf-rec ol{list-style:none;margin:0;padding:0}
.zcf-rec li{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;align-items:center;padding:5px 0;border-bottom:1px dashed #c6cbc7;font-family:var(--ft);font-size:13px;color:var(--zt)}
.zcf-rec li .sg{height:34px;display:flex;align-items:center}.zcf-rec li .sg img{max-height:36px;max-width:110px}.zcf-rec li .sg .h{font-size:18px}
.zcf-rec li b{font-family:var(--fd);font-size:14px}.zcf-rec li .end-banks,.zcf-rec li .end-torn{color:var(--zpe)}
.zdk.zcf0{grid-template-columns:1fr}
.zcf0 .zcf-nil{display:flex;align-items:center;gap:18px}.zcf0 .zcf-nil .zdk-go{margin:0}
.zcf0 .zcf-nil span{font-family:var(--ft);font-size:13px;color:var(--zpe)}
/* tearing it up: a memo on the desk, over the menu */
#zcfTear{position:absolute;inset:0;z-index:36;display:flex;align-items:center;justify-content:center;background:rgba(6,9,11,.62)}
#zcfTear[hidden]{display:none}
.zcf-memo{position:relative;width:520px;box-sizing:border-box;padding:24px 36px 22px;background:#fcfcf9;color:#1d2024;box-shadow:0 22px 48px rgba(0,0,0,.45),0 2px 6px rgba(0,0,0,.3);transform:rotate(-.6deg)}
.zcf-memo h2{font-family:var(--fd);font-weight:700;font-size:25px;line-height:1.2;margin:0 0 12px}
.zcf-memo p{font-family:var(--ft);font-size:13.5px;line-height:1.6;margin:0 0 6px;color:#1d2024}
.zcf-memo .zdk-acts{padding-top:16px}
.zcf-memo.half{position:absolute;left:50%;top:50%;margin:0;pointer-events:none;transition:transform .55s cubic-bezier(.4,0,.6,1),opacity .55s}
@media (prefers-reduced-motion:reduce){.zcf-cards button,.zcf-memo.half{transition:none}}
`;
let cssF=false;
function mountF(){mount5();if(cssF)return;cssF=true;const st=document.createElement('style');st.id='zmmCssF';st.textContent=CSSF;document.head.appendChild(st);}
const possN=n=>/s$/i.test(n)?n+'’':n+'’s';   // Kestrel Airports’ (not Airports’s)
const ENDED={handback:'handed back',banks:'the banks took control',torn:'torn up'};
const sigOf=(img,name,cls)=>img?`<img src="${esc(img)}" alt="${esc(name?'Signature of '+name:'Signature')}"${cls?` class="${cls}"`:''}>`:H(name||'');
const pctTxt=v=>v==null||!isFinite(v)?'':(v<0?'−':'')+Math.abs(+v).toFixed(1).replace(/\.0$/,'')+'%';
function recordHtml(rec){rec=(rec||[]).filter(r=>r&&r.company).slice(-4).reverse();if(!rec.length)return '';
  return `<section class="zcf-rec" aria-label="Earlier concessions"><h3>Earlier concessions</h3><ol>${rec.map(r=>{const yrs=+r.years;
    const bits=[`<b>${esc(r.company)}</b>`,esc(r.founder||''),isFinite(yrs)&&yrs>0?`${Math.round(yrs)} year${Math.round(yrs)===1?'':'s'}`:'',`<span class="end-${esc(r.ended||'')}" title="${esc(r.endedOn?M.fmtDate(r.endedOn):'')}">${esc(ENDED[r.ended]||r.ended||'')}${r.endedOn&&/^\d{4}/.test(r.endedOn)?' in '+esc(String(r.endedOn).slice(0,4)):''}</span>`,
      r.returnPct!=null&&isFinite(r.returnPct)?`returned ${pctTxt(r.returnPct)} a year`:''].filter(Boolean);
    const word=typeof ENDSTAMP!=='undefined'&&ENDSTAMP[r.ended];
    return `<li><span class="sg">${sigOf(r.signature,r.founder)}</span><span>${bits.join(' · ')}</span><span class="zcf-end">${word?stampHtml(word,'',dayOf(r.endedOn)):''}</span></li>`;}).join('')}</ol></section>`;}
/* §14.3: with a file on the desk, earlier concessions are thinner files beneath it: a 15px edge each, with the company and its
   ending stamped. Hover or focus raises one to read it. */
function edgesHtml(rec){rec=(rec||[]).filter(r=>r&&r.company).slice(-4).reverse();if(!rec.length)return {n:0,html:''};
  return {n:rec.length,html:`<ol class="zcf-edges" aria-label="Earlier concessions">${rec.map((r,k)=>{const yrs=+r.years,word=ENDSTAMP[r.ended]||'';
    const bits=[esc(r.company),esc(r.founder||''),isFinite(yrs)&&yrs>0?`${Math.round(yrs)} year${Math.round(yrs)===1?'':'s'}`:'',
      r.endedOn&&/^\d{4}/.test(r.endedOn)?`to ${esc(String(r.endedOn).slice(0,4))}`:'',
      r.returnPct!=null&&isFinite(r.returnPct)?`returned ${pctTxt(r.returnPct)} a year`:''].filter(Boolean);
    return `<li tabindex="0" style="--k:${k};--r:${[.5,-.4,.3,-.6][k%4]}deg" title="${bits.join(' · ')}"><span><b>${bits[0]}</b> · ${bits.slice(1).join(' · ')}</span>${word?`<i>${esc(word)}</i>`:''}</li>`;}).join('')}</ol>`};}
/* the seven chapters of the flight (design/chapters.md); ZMMoney.chapterName(5) → "Chapter 5 · Cruise" */
M.CHAPTERS=['Clearance','Pushback','Takeoff','Climb','Cruise','Turbulence','Landing'];
M.chapterName=function(c){if(c==null||c==='')return '';if(typeof c==='object')c=c.n!=null?c.n:c.name;
  if(isFinite(c)&&+c>=1&&+c<=7)return `Chapter ${+c} · ${M.CHAPTERS[+c-1]}`;if(/^black ?box$/i.test(String(c)))return 'The Black Box';return String(c);};
/* ZMMoney.fileResumable(save) → true only for a save that can be continued: company, founder, signature and signedOn present,
   and not marked old (save.resumable === false, which hub.js sets for an older save version). */
M.fileResumable=o=>!!(o&&o.company&&o.founder&&o.signature&&o.signedOn&&o.resumable!==false);
M.concessionFile=function(el,o){mountS();if(typeof el==='string')el=document.querySelector(el);if(!el)return null;
  const has=M.fileResumable(o);
  if(!has){const rec=o&&o.record;
    el.innerHTML=`<div class="zdk z5v zcf zcf0">${INK_DEFS}<div class="zcf-nil"><button class="zdk-go" id="zcfStart">Start the concession</button>${o&&o.company?`<span>${esc(possN(o.company))} file ${o.why&&o.why!=='old'?'was never fully signed':'is from an older version of the game'} and can’t be continued.</span>`:rec&&rec.length?'<span>No concession on file now.</span>':''}</div>${recordHtml(rec)}</div>`;
    el.querySelector('#zcfStart').onclick=()=>{if(o&&o.onNew)o.onNew({confirmed:false});};return el.firstElementChild;}
  const yrs=M.cfg.years,st=o.stake||{},cv=o.cover||{},lt=cv.light||'';
  const mood={green:'The banks are relaxed',amber:'The banks are watching closely',red:'The banks are warning you'}[lt]||'';
  const docs=(o.docs||[]).filter(Boolean),show=docs.slice(-6),more=docs.length-show.length;
  // §14.3: the save is a buff office file tied with red tape; three plain numbers on a slip pasted to its cover
  const n3=`<div class="zcf-n3">
      <div><small>Your stake</small><b>${st.pct!=null?esc(pctTxt(st.pct)):'—'}</b><span>${st.valueCr!=null?'worth about '+fmt(+st.valueCr):st.inCr!=null?fmt(+st.inCr)+' put in':''}</span></div>
      <div class="cv ${esc(lt)}"><small>The banks</small><b>${esc(cv.words||'—')}</b><span>${esc(mood)}</span></div>
      <div><small>Cash in hand</small><b>${o.cashCr!=null?esc(fmt(+o.cashCr)).replace(/ ((?:lakh )?cr)$/,'<small>$1</small>'):'—'}</b><span></span></div></div>`;
  const where=[o.chapter!=null?M.chapterName(o.chapter):o.era!=null?`era ${o.era}`:''].filter(Boolean).join('');
  const edges=edgesHtml(o.record);
  el.innerHTML=`<div class="zdk z5v zcf">${INK_DEFS}<div class="zcf-main"><div class="zcf-stack" style="--n:${edges.n}">${edges.html}${coverHtml(o,n3)}</div>
    <div class="zdk-acts"><button class="zdk-go" id="zcfGo">Continue as ${esc(o.company)}</button><button class="zdk-q" id="zcfNew">Start a new concession</button>${where?`<span class="zcf-where">${esc(where)}</span>`:''}</div></div>
  <aside class="zcf-pile" aria-label="Documents signed so far"><h3>Signed so far</h3>${show.length?`<div class="zcf-cards">${show.map((d,n)=>`<button data-i="${n}" style="--r:${[-1.6,1.2,-.8,1.8,-1.2,.9][n%6]}deg" title="Open: ${esc(d.title||'')}"><b>${esc(d.title||'')}</b><small>${esc(d.date?M.fmtDate(d.date):d.year!=null?String(d.year):'')}</small>${stampHtml(stampFor(d),'mini',dayOf(d.date))}</button>`).join('')}</div>${more>0?`<p class="zcf-more">and ${more} earlier document${more===1?'':'s'}</p>`:''}`:'<p>Nothing signed yet.</p>'}</aside>
  </div>`;
  const root=el.firstElementChild;
  root.querySelectorAll('.zcf-cards button').forEach(b=>b.onclick=()=>{const d=show[+b.dataset.i];if(o.onOpenDoc)o.onOpenDoc(d);else M.openDoc(d);});
  // untie: the tape slides off (0.4 s), the cover opens, then the game opens the desk at the right document
  let going=false;root.querySelector('#zcfGo').onclick=()=>{if(going)return;going=true;const c=root.querySelector('.zcf-cover');
    const go=()=>{going=false;if(o.onContinue)o.onContinue();setTimeout(()=>c&&c.classList.remove('untie','open'),1500);};
    if(reduced()||!c){go();return;}c.classList.add('untie');noise(.25,700,.08,0,1.5);setTimeout(()=>{c.classList.add('open');setTimeout(go,300);},400);};
  root.querySelector('#zcfNew').onclick=()=>{M.confirmTear(o.company).then(ok=>{if(ok&&o.onNew)o.onNew({confirmed:true});});};
  return root;};
/* ZMMoney.confirmTear(company) → Promise<boolean>. Asks once, on paper. A second call for the same company within 4 s of a
   "Tear it up" resolves true without asking again (so a caller that confirms again in onNew never shows it twice). */
let tearP=null,torn=null;
M.confirmTear=function(company){mountF();company=company||'Your company';
  if(torn&&torn.company===company&&performance.now()-torn.at<4000)return Promise.resolve(true);
  if(tearP)return tearP;
  tearP=new Promise(res=>{const host=$('#app')||document.body;let v=$('#zcfTear');if(!v){v=document.createElement('div');v.id='zcfTear';v.className='z5v';host.appendChild(v);}
    v.innerHTML=`<article class="zcf-memo" role="alertdialog" aria-modal="true" aria-labelledby="zcfTq"><div class="zdk-dh">${vsiLogo(20)}<span>${esc(M.cfg.spvShort)} · Concession file</span><span class="dt">${esc(M.fmtDate(new Date()))}</span></div>
      <h2 id="zcfTq">This tears up ${esc(possN(company))} concession. Start again?</h2>
      <p>The file goes to the record of earlier concessions. The deal desk opens with a blank incorporation form.</p>
      <div class="zdk-acts"><button class="zdk-go" id="zcfTy">Tear it up and start again</button><button class="zdk-q" id="zcfTn">Keep it</button></div></article>`;
    v.hidden=false;const memo=v.querySelector('.zcf-memo');
    const fin=ok=>{document.removeEventListener('keydown',key,true);tearP=null;if(ok)torn={company,at:performance.now()};res(ok);};
    const keep=()=>{v.hidden=true;v.innerHTML='';fin(false);};
    const key=e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();keep();}};document.addEventListener('keydown',key,true);
    v.querySelector('#zcfTn').onclick=keep;v.onclick=e=>{if(e.target===v)keep();};
    v.querySelector('#zcfTy').onclick=()=>{
      if(reduced()){v.hidden=true;v.innerHTML='';fin(true);return;}
      // the memo tears in two along a ragged line, and the halves fall apart
      const r=memo.getBoundingClientRect();let q=29;const rnd=()=>((q=(q*9301+49297)%233280)/233280);const pts=[];for(let y=0;y<=100;y+=5)pts.push([46+rnd()*8,y]);
      const L=`polygon(0 0,${pts.map(p=>p[0]+'% '+p[1]+'%').join(',')},0 100%)`,R=`polygon(100% 0,${pts.map(p=>p[0]+'% '+p[1]+'%').join(',')},100% 100%)`;
      const halves=[L,R].map((cp,i)=>{const h=memo.cloneNode(true);h.classList.add('half');h.removeAttribute('role');h.style.width=r.width+'px';h.style.clipPath=cp;h.style.transform='translate(-50%,-50%) rotate(-.6deg)';v.appendChild(h);return h;});
      memo.style.visibility='hidden';thud();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{halves[0].style.transform='translate(calc(-50% - 70px),calc(-50% + 40px)) rotate(-9deg)';halves[1].style.transform='translate(calc(-50% + 70px),calc(-50% + 60px)) rotate(8deg)';halves.forEach(h=>h.style.opacity='0');}));
      setTimeout(()=>{v.hidden=true;v.innerHTML='';fin(true);},620);};
    setTimeout(()=>{const k=v.querySelector('#zcfTn');k&&k.focus({preventScroll:true});},30);});
  return tearP;};

/* sample saved concessions for ?moneymock=file|file0|tear (a sample company: the real file comes from zm_campaign via hub.js) */
function sampleSig(seed,ink){return new Promise(r=>{const svg=scribble(seed,ink||'#1f3a8a').replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80" ');
  const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=600;c.height=160;const g=c.getContext('2d');g.drawImage(im,0,0,600,160);r(c.toDataURL('image/png'));};im.onerror=()=>r('');
  im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});}
function fileMock(kind){return Promise.all([sampleSig(53),sampleSig(71,'#14161a'),sampleSig(97)]).then(([s0,s1,s2])=>{
  const record=[{company:'Kestrel Airport Holdings',founder:'Vikram Shah',signature:s1,years:60,ended:'handback',returnPct:14.2,endedOn:'2086-10-18'},
    {company:'Sahyadri Gateway',founder:'Asha Rao',signature:s2,years:23,ended:'banks',returnPct:-3.4,endedOn:'2049-06-30'}];
  const docs=[{id:'ca',title:'Concession Agreement',date:'2026-04-01',kind:'agreement',summary:'Signed by AAI, the State through MADC, L5 Capital and your company. Sixty years to build and run VSI, then hand it back.'},
    {id:'lic',title:'Aerodrome licence',date:'2030-11-01',stamp:'Licensed',summary:'DGCA licensed VSI on 1 November 2030. The airport opened the same morning.'},
    {id:'bm2041',title:'Board minutes, 2041',date:'2041-04-01',kind:'minutes',summary:'Approved: the departure planning system and the retail upgrade. Dividend: ₹900 cr.'}];
  const host=()=>{let h=document.getElementById('tConc');if(h)return h;h=document.getElementById('zcfHost');if(h)return h;
    h=document.createElement('div');h.id='zcfHost';(document.getElementById('zcfMount')||document.body).appendChild(h);return h;};
  M.setPile(docs);
  const draw=k=>{const h=host();
    if(k==='file0')return M.concessionFile(h,null);
    return M.concessionFile(h,{company:'Meridian Infra',founder:'Asha Rao',signature:s0,signedOn:'2026-04-01',year:17,chapter:5,stake:{pct:64,valueCr:23600},
      cover:{words:'₹118 earned for every ₹100 due',light:'green'},cashCr:14800,docs,record:kind==='file'||k==='file'?record:record.slice(0,1),
      onContinue:()=>{window.__zmmResult='continue';},onNew:a=>{window.__zmmResult={onNew:a};
        // as hub.js does: the torn concession joins the record, then the deal desk opens
        if(a&&a.confirmed){record.push({company:'Meridian Infra',founder:'Asha Rao',signature:s0,years:17,ended:'torn',returnPct:9.6,endedOn:isoDay(new Date())});
          M.concessionFile(h,{record,onNew:()=>{}});if(window.__zmmDemo&&window.__zmmDemo.onboarding)window.__zmmDemo.onboarding();}}});};
  const root=draw(kind);
  if(kind==='tear')setTimeout(()=>{const b=document.getElementById('zcfNew');if(b)b.click();},300);
  return root;});}
M._fileMock=fileMock;

/* sample Chapter 5 data for ?moneymock=frontpage|decision|briefing|tags|pins|bill|card. The real figures come from VSIEra.ch5. */
const CH5={
  docs:[{id:'ca',title:'Concession Agreement',year:2026,kind:'agreement',summary:'Signed by AAI, the State through MADC, L5 Capital and your company. Sixty years to build and run VSI, then hand it back.'},
    {id:'p1',title:'Phase 1: the lean build',year:2027,kind:'choice',summary:'You built phase 1 for 45 million passengers a year: ₹60,000 cr. Piers A to D only. No widebody stands on the international side until phase 1B.'},
    {id:'cb2034',title:'Capital budget, 2034',year:2034,kind:'budget',summary:'Approved: the departure planning system and the retail upgrade. Not approved: the bird radar (₹180 cr). The lakes south of the field stay unwatched.'},
    {id:'ra2040',title:'Route agreement with Haversine Airways',year:2040,kind:'route-agreement',summary:'Haversine Airways flies a daily evening bank from VSI to London, Singapore and Nairobi, fed by the domestic bank from Lucknow, Indore, Patna and Bhopal.'}],
  front:{masthead:'The Zero Mile Times',dateLine:'Nagpur, Monday 15 October 2040',price:'₹12',edition:'Nagpur edition',
    lead:'DUBAI, DOHA OR NAGPUR? THE RACE FOR INDIA\'S TRAVELLERS',
    deck:'A long-haul airline wants to make VSI its Indian hub. The Gulf airports want India\'s travellers to keep changing planes with them.',
    sub:{head:'Haversine Airways puts London, Singapore and Nairobi on the table',body:'Haversine\'s commercial chief flew in on Saturday to offer VSIAL a daily evening bank of long-haul flights. Each would be filled by the domestic flights that land at VSI in the hour before.\n\nThe airline wants stands, a quick transfer and a promise that the feeders will not run late. VSIAL\'s board meets this week.'},
    columns:[{head:'Feeders fill up',body:'Fourteen Indian cities now send a morning and an evening bank to VSI. Lucknow and Indore are full most days.'},
      {head:'AERA holds charges',body:'The regulator kept airline charges where they were for five more years. VSIAL said it would live with the order.'}],
    photo:{kind:'intl-pier',caption:'The international pier at VSI, where a London flight would board. Drawn by our staff artist.'}},
  decision:{docType:'route-agreement',docId:'RA-2040-07',title:'Route agreement: Haversine Airways',
    parties:{airport:'Vikram Sarabhai International Airport Limited',airline:'Haversine Airways',signatory:{name:'Daniel Okafor',title:'Chief Commercial Officer, Haversine Airways'}},
    body:['The Airline will base long-haul aircraft at the Airport and fly one bank of international departures each evening.','The Airport will give the Airline\'s flights stands on the international pier, and a transfer from the domestic bank in under an hour.','If a feeder lands late, the Airport may hold the departure. The slot it misses at the other end is the Airport\'s cost.'],
    choices:[{id:'three',label:'London, Singapore and Nairobi, every evening',terms:'Three widebodies. Haversine Airways wants three stands on the international pier.',act:'Sign for three routes',slip:{big:'+2,400 connections a day',money:'₹1,850 cr a year',line:'If the feeder bank holds. Every missed connection books via Doha next time.'}},
      {id:'london',label:'London only, every evening',terms:'One widebody, one stand. Haversine Airways may add routes later.',act:'Sign for London',slip:{big:'+900 connections a day',money:'₹690 cr a year',line:'Safer on stands. Singapore and Nairobi stay with Dubai and Doha.'}},
      {id:'decline',label:'Decline the agreement',terms:'No international bank this chapter.',slip:{big:'0 new connections',money:'₹0 a year',line:'Nothing can go wrong tonight. Doha keeps India\'s travellers.'}}],
    stamps:{three:'Signed',london:'Signed',decline:'Declined'}},
  brief:{title:'Duty manager’s handover',date:'15 Oct 2040, 13:40',
    lines:[{text:'Haversine’s London bank departs 14:10 · 380 connecting',doc:'Route agreement with Haversine Airways'},{text:'Only two widebody stands on the international side',doc:'Phase 1: the lean build'},{text:'No bird radar: watch the lakes south of 28L',doc:'Capital budget, 2034'}],
    watch:'Lucknow’s feeder. If it’s late, London has to wait or go.',autoStartSec:6},
  tags:[{id:'stands',doc:'Phase 1: the lean build',line:'No widebody stand free for Haversine 12.',docId:'p1'},{id:'birds',doc:'Capital budget, 2034',line:'You skipped the bird radar.',docId:'cb2034'}],
  bill:{title:'The first year of the Gulf race',year:2040,page:7,period:'This page covers one year: 1 April 2040 to 31 March 2041.',
    paragraph:'Haversine\'s evening bank to London, Singapore and Nairobi ran all year. Most feeders landed on time; when Lucknow ran late you held London. Two widebodies a night waited on taxiways for a stand.',
    table:[{label:'Earned',cr:2140},{label:'Spent',cr:1610},{label:'Connections',made:612000,missed:41000}],
    margin:'You held London twice. It cost ₹38 cr in slots and kept 760 passengers off Doha. Haversine Airways is adding a Frankfurt flight.',
    cover:{ratio:1.18,words:'₹118 earned for every ₹100 due'},stake:{pct:64,valueCr:23600}},
  card:{title:'What really happened',text:'Emirates first flew on 25 October 1985, from Dubai to Karachi, with two leased aircraft and US$10 million from Dubai\'s government. In 2024 Dubai International handled a record 92.3 million passengers, and India was its biggest market.',
    sources:[{label:'Gulf News, “40 years of UAE: the launch of Emirates Airline”',url:'https://gulfnews.com/news/uae/government/40-years-of-uae-the-launch-of-emirates-airline-1.920215'},{label:'AP, “Dubai International Airport, busiest for world travel, sees record 92.3 million passengers in 2024”',url:'https://www.yahoo.com/news/dubai-international-airport-busiest-world-081648847.html'}]}};
M._ch5Sample=CH5;
function ch5Mock(kind){M.setPile(CH5.docs);const H5=window.HUB;
  const live=()=>{if(H5&&H5.startLevel){try{H5.view&&H5.view('2d');H5.startLevel(3);H5.ff&&H5.ff(kind==='tags'||kind==='pins'?420:2);H5.pause&&H5.pause();}catch(e){console.warn(e);}}};
  if(kind==='frontpage')return M.frontPage(Object.assign({company:'Meridian Infra',founder:'Asha Rao'},CH5.front));
  if(kind==='decision')return M.decision(Object.assign({founder:'Asha Rao',parent:'Meridian Infra',date:'15 October 2040'},CH5.decision));
  if(kind==='bill')return M.bill(CH5.bill);
  if(kind==='card')return M.whatHappened(CH5.card);
  if(kind==='briefing'){live();return M.briefing(Object.assign({},CH5.brief,{autoStartSec:600}));}
  if(kind==='tags'||kind==='pins'){live();M.enable(true);M.setDay({total:142.6,ratePerHr:61});const cn={made:1840,missed:380};M.setConnections(cn);
    const extra=kind==='pins'?[{doc:'Route agreement with Haversine Airways',line:'London waits for the Lucknow feeder.',docId:'ra2040'},{doc:'Concession Agreement',line:'Sixty years, then hand it back.',docId:'ca'}]:[];
    const hs=CH5.tags.concat(extra).map(t=>M.tag(0,0,t.doc,t.line,t.docId));
    // the live count, as hub.js sends it: every time a bank settles
    setInterval(()=>{cn.made+=Math.round(20+Math.random()*30);if(Math.random()<.3)cn.missed+=Math.round(3+Math.random()*9);M.setConnections(cn);},900);
    // pin each tag to a real aircraft on the map: a widebody at a stand, and one on final approach
    const pickF=(want)=>{const fs=H5&&H5.flights?H5.flights():[];return fs.find(f=>f.sx!=null&&want(f));};
    // what hub.js does every frame: ZMMoney.tagAvoid(the screen rectangles of every runway and the terminal). Here the 2D map's
    // scale and offset are read back from two aircraft (world x, y and screen sx, sy), and the shapes come from the page's spec.
    let spec={};try{spec=JSON.parse(document.getElementById('specData').textContent);}catch(e){}
    const nums=o=>(String(o||'').match(/-?\d+(\.\d+)?/g)||[]).map(Number);
    const term=(()=>{let l=1e9,t=1e9,r=-1e9,b=-1e9;for(const c of spec.concourses||[]){const n=nums(c.outline);for(let i=0;i+1<n.length;i+=2){l=Math.min(l,n[i]);r=Math.max(r,n[i]);t=Math.min(t,n[i+1]);b=Math.max(b,n[i+1]);}}return r>l?{l,t,r,b}:null;})();
    const avoid=()=>{const fs=(H5&&H5.flights?H5.flights():[]).filter(f=>f.sx!=null&&isFinite(f.x));let a=null,bb=null,dx=0;
      for(const f of fs)for(const g of fs){const d=Math.abs(f.x-g.x);if(d>dx){dx=d;a=f;bb=g;}}if(!a||dx<500)return;
      const k=(a.sx-bb.sx)/(a.x-bb.x),ox=a.sx-a.x*k,oy=a.sy-a.y*k,R=(x0,y0,x1,y1)=>({l:ox+x0*k,t:oy+y0*k,r:ox+x1*k,b:oy+y1*k});
      const rs=(H5.RW||[]).map(r=>{const q=R(r.x0,r.y-(r.width||60)/2,r.x1,r.y+(r.width||60)/2);const m=Math.max(0,5-(q.b-q.t)/2);q.t-=m;q.b+=m;q.kind='runway';return q;});
      if(kind==='pins'){   // the real shapes: runways, every taxiway segment as a thin strip, each concourse and the main hall as polygons
        const P=(x,y)=>[ox+x*k,oy+y*k];
        for(const t of spec.taxiways||[])for(let i=0;i+1<(t.pts||[]).length;i++){const [x0,y0]=t.pts[i],[x1,y1]=t.pts[i+1],L=Math.hypot(x1-x0,y1-y0)||1,nx=-(y1-y0)/L*30,ny=(x1-x0)/L*30;
          rs.push({pts:[P(x0+nx,y0+ny),P(x1+nx,y1+ny),P(x1-nx,y1-ny),P(x0-nx,y0-ny)],kind:'taxiway'});}
        for(const c of (spec.concourses||[]).concat((spec.buildings||[]).filter(b=>b.kind==='processor'))){const n=nums(c.outline),pts=[];for(let i=0;i+1<n.length;i+=2)pts.push(P(n[i],n[i+1]));if(pts.length>2)rs.push({pts,kind:'terminal'});}}
      else if(term){const q=R(term.l,term.t,term.r,term.b);q.kind='terminal';rs.push(q);}window.__zmmAvoid=rs;M.tagAvoid(rs);window.__zmmClash=M.tagClashes();};
    let fA=null,fB=null,fC=null,fD=null;const step=()=>{if(!fA||fA.sx==null)fA=pickF(f=>f.state==='at_gate');if(!fB||fB.sx==null)fB=pickF(f=>f.state==='approach'||f.state==='holding');
      avoid();const app=$('#app').getBoundingClientRect();
      hs[0].move(fA?fA.sx:app.width*.42,fA?fA.sy:app.height*.5);hs[1].move(fB?fB.sx:app.width*.3,fB?fB.sy:app.height*.25);
      if(hs[2]){if(!fC||fC.sx==null)fC=pickF(f=>f!==fA&&f.state==='at_gate');hs[2].move(fC?fC.sx:app.width*.5,fC?fC.sy:app.height*.6);}
      if(hs[3]){if(!fD||fD.sx==null)fD=pickF(f=>f!==fB&&(f.state==='taxi_out'||f.state==='taxi_in'||f.state==='lineup'));hs[3].move(fD?fD.sx:app.width*.55,fD?fD.sy:app.height*.4);}
      requestAnimationFrame(step);};
    step();
    const fire=()=>{const r=$('#app').getBoundingClientRect();M.connFloat(r.width*.44,r.height*.56,{made:46,cr:0.4});M.connFloat(r.width*.56,r.height*.36,{missed:18,rival:'Doha'});};
    fire();setInterval(fire,1600);return Promise.resolve();}
  return Promise.resolve();}
M._ch5Mock=ch5Mock;

/* ============ Stage 0 · The Flight (DESIGN.md Part II §12–§20) ============
   The strip (§14.1), the split-flap years (§14.2), the concession file's cover and closing it for tonight (§14.3), the
   cliffhanger (§14.4), the Chapter 7 board minutes, the Chapter 6 letter from the banks and the notice that the banks take
   control, and the Black Box (§14.7, design/debrief.md). Every figure arrives from money/era.js; nothing here invents one. */
const CSSS=`
/* the game's own dark sheet greys every <p>; paper screens print in typewriter black */
.zbx p,.zfl p,.zcl p,.zs-min p,.zs-let p,.zs-step p{color:var(--zt);max-width:none}
/* ---- the flight progress strip (§14.1): a paper strip in its holder; past strips stack beneath as 6px edges ---- */
.zfs-h{--strip:#efe6c8;--edge:#c9b98a;position:relative;display:inline-block;vertical-align:top;color:#1d2024;pointer-events:auto;text-align:left}
.zdk>.zfs-h{position:absolute;top:10px;right:28px;z-index:4}
.zdk.has-strip{--stop:max(98px,calc(66px + var(--bay,0) * 10px))}
.zdk.has-strip .zdk-main{top:var(--stop)}.zdk.has-strip .zdk-pile{top:calc(var(--stop) + 36px)}.zdk.has-strip .z5-stage{padding-top:var(--stop)}
.zfs{position:relative;display:grid;grid-template-columns:84px 128px 100px minmax(160px,212px) 60px;height:40px;box-sizing:border-box;background:var(--strip);border-left:7px solid var(--edge);
  box-shadow:0 3px 8px rgba(30,40,50,.18),0 1px 1px rgba(30,40,50,.22);font-family:'Courier Prime','Courier New',monospace}
.zfs>span{display:flex;flex-direction:column;justify-content:center;gap:2px;padding:0 9px;border-left:1px solid rgba(120,100,60,.42);min-width:0}
.zfs>span:first-child{border-left:0}
.zfs b{font-family:var(--f-sign,'Barlow Condensed'),sans-serif;font-weight:700;font-size:16px;line-height:1;letter-spacing:.06em;white-space:nowrap;color:#1d2024}
.zfs small{font-size:10.5px;line-height:1.15;color:#575449;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.zfs .yr b{font-family:'Courier Prime','Courier New',monospace;font-size:12.5px;letter-spacing:0}
.zfs .dc{flex-direction:row;align-items:center;gap:6px}
.zfs .dc em{flex:1;min-width:0;font-style:normal;font-size:11.5px;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.zfs .dc .st{flex:none;padding:1px 4px 0;border:1.5px solid #c22a2e;color:#c22a2e;font-family:var(--f-sign,'Barlow Condensed'),sans-serif;font-weight:700;font-size:10.5px;line-height:1.1;letter-spacing:.08em;text-transform:uppercase;transform:rotate(-6deg);mix-blend-mode:multiply;filter:url(#zdkInk)}
.zfs .dc .op{flex:none;font-family:'Kalam',cursive;font-size:12px;color:#676c71}
.zfs .sk b{font-family:'Kalam',cursive;font-weight:700;font-size:19px;letter-spacing:0;color:#1f3a8a}
.zfs.slide{animation:zfsIn .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes zfsIn{from{opacity:0;transform:translateX(80px)}}
.zfs-bay{position:relative}
.zfs-e{position:relative;height:6px;margin-top:4px;background:var(--strip);border-left:7px solid var(--edge);box-shadow:0 1px 2px rgba(30,40,50,.25);outline:none;cursor:default}
.zfs-e>em{position:absolute;right:calc(100% + 12px);top:-2px;font-style:normal;font-family:var(--f-sign,'Barlow Condensed'),sans-serif;font-weight:700;font-size:9.5px;line-height:10px;letter-spacing:.08em;color:#4a4f54;white-space:nowrap}
.zfs-e .zfs{position:absolute;left:-7px;top:9px;width:calc(100% + 7px);z-index:5;opacity:0;visibility:hidden;transition:opacity .15s,visibility 0s .15s;box-shadow:0 8px 18px rgba(30,40,50,.3)}
.zfs-e:hover .zfs,.zfs-e:focus-visible .zfs,.zfs-e.peek .zfs{opacity:1;visibility:visible;transition:opacity .15s}
.zfs-e.dropin{animation:zfsDrop .5s cubic-bezier(.3,.7,.2,1) both}
@keyframes zfsDrop{from{height:40px;margin-top:-36px;opacity:.3}}
.zfs-h.night{padding:3px 3px 4px;background:rgba(10,14,17,.86);border:1px solid #2b353c;border-radius:3px;box-shadow:0 8px 20px rgba(0,0,0,.5)}
.zfs-h.night .zfs-e>em{right:auto;left:calc(100% + 10px);color:#c9cfd3}
#app>.zfs-h.night{position:absolute;left:12px;top:8px;z-index:7}
@media (max-width:1280px){.zfs{grid-template-columns:78px 120px 96px minmax(150px,186px) 56px}.zdk>.zfs-h{right:20px}}
@media (prefers-reduced-motion:reduce){.zfs.slide,.zfs-e.dropin{animation:none}}

/* ---- the split-flap years (§14.2) ---- */
.zfl-stage{cursor:pointer;user-select:none}
.zfl-wrap{position:relative;width:840px;height:540px;flex:none}
.zfl-np,.zfl-wrap::before,.zfl-wrap::after{position:absolute;left:40px;right:40px;top:6px;height:400px;box-sizing:border-box;background:#efeee8}
.zfl-wrap::before,.zfl-wrap::after{content:'';box-shadow:0 10px 24px rgba(30,40,50,.16)}
.zfl-wrap::before{transform:rotate(2.4deg) translate(10px,6px);background:#e9e7df}.zfl-wrap::after{transform:rotate(-2deg) translate(-8px,3px);background:#ecebe4}
.zfl-np{z-index:1;padding:20px 34px 0;transform:rotate(-.6deg);box-shadow:0 18px 40px rgba(30,40,50,.22),0 2px 5px rgba(30,40,50,.12);color:#16181a;transform-origin:50% 0}
.zfl-np .ms{color:#16181a!important;margin:0;text-align:center;font-family:var(--fd);font-weight:700;font-size:34px;line-height:1;border-bottom:1px solid #16181a;padding-bottom:8px}
.zfl-np .dl{display:flex;justify-content:space-between;border-bottom:3px double #16181a;padding:4px 0 5px;font-family:var(--fd);font-size:11.5px}
.zfl-np h2{margin:16px 0 0;font-family:var(--fd);font-weight:700;font-size:34px;line-height:1.06;letter-spacing:-.01em;text-wrap:balance;min-height:108px}
.zfl-np .rl{margin-top:14px;height:120px;background:repeating-linear-gradient(180deg,rgba(22,24,26,.13) 0 1px,transparent 1px 9px);opacity:.8}
.zfl-np.riff{animation:zflRiff .2s ease-out}
@keyframes zflRiff{from{transform:rotate(-.6deg) translateY(-10px) perspective(900px) rotateX(16deg);opacity:.35}}
.zfl-board{position:absolute;left:50%;bottom:0;z-index:2;transform:translateX(-50%);padding:16px 20px 13px;background:#16191c;border-radius:4px;box-shadow:0 26px 54px rgba(10,14,18,.42),0 2px 4px rgba(0,0,0,.4);color:#ece7da;font-family:var(--f-mono,'JetBrains Mono'),monospace}
.zfl-yr{display:flex;gap:8px}
.zfl-yr .c{position:relative;width:94px;height:128px;background:#23282c;border-radius:3px;display:flex;align-items:center;justify-content:center;overflow:hidden;perspective:320px;
  font-family:'JetBrains Mono',monospace;font-weight:500;font-size:100px;line-height:1;color:#ece7da;box-shadow:inset 0 -2px 0 rgba(0,0,0,.35)}
.zfl-yr .c::after{content:'';position:absolute;left:0;right:0;top:calc(50% - 1px);height:2px;background:#0d0f11;z-index:3}
.zfl-yr .c b{font-weight:500}
.zfl-yr .c::after{z-index:5}
/* a flap: the old top leaf falls (top half, 0 → -90°), then the new bottom leaf lands (bottom half, 90° → 0); the old bottom
   half stays put until it is covered. Each glyph is a full cell, clipped to its half. */
.zfl-yr .c i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;background:#23282c;transform-origin:50% 50%}
.zfl-yr .c i.ob{z-index:1;clip-path:inset(50% 0 0 0)}
.zfl-yr .c i.tl{z-index:3;clip-path:inset(0 0 50% 0);animation:zflTop var(--d,60ms) cubic-bezier(.55,0,1,.6) forwards}
.zfl-yr .c i.bl{z-index:4;clip-path:inset(50% 0 0 0);transform:rotateX(90deg);animation:zflBot var(--d,60ms) cubic-bezier(0,.4,.45,1) var(--d,60ms) forwards}
@keyframes zflTop{to{transform:rotateX(-90deg);filter:brightness(.5)}}
@keyframes zflBot{from{transform:rotateX(90deg);filter:brightness(.6)}to{transform:rotateX(0);filter:brightness(1)}}
.zfl-sub{display:flex;justify-content:space-between;gap:20px;margin-top:10px;font-size:13px;letter-spacing:.04em;color:#bdb7a8}
.zfl-sub b{font-weight:500;color:#ece7da}
.zfl .zfl-skip{margin:22px 0 0;font-family:var(--ft);font-size:12.5px;color:#4a4f54}
@media (max-width:1280px){.zfl-wrap{width:780px;height:500px}.zfl-np,.zfl-wrap::before,.zfl-wrap::after{height:370px}.zfl-np h2{font-size:31px}.zfl-yr .c{width:84px;height:116px;font-size:90px}}
@media (prefers-reduced-motion:reduce){.zfl-np.riff,.zfl-yr .c i{animation:none;display:none}}

/* ---- the cliffhanger (§14.4): the Late City edition folds in half ---- */
.zcl-stage{justify-content:flex-start;padding-top:34px}
.zcl-fold{--s:1;position:relative;flex:none;transform:rotate(-.7deg) scale(var(--s));transform-origin:50% 0}
.zcl-fold.drop{animation:z5Drop .62s cubic-bezier(.2,.75,.25,1) both}
.zcl-fold .z5-np{transform:none;cursor:pointer}
.zcl-fold .z5-np{position:relative;z-index:1}
.zcl-fold .z5-np.top{clip-path:inset(0 0 var(--fb,50%) 0)}
/* the falling half: its own element hinged at the crease, folding back and away; the top half (z 1) hides it past 90°.
   Two faces, swapped at the half-way point, so no browser has to honour backface-visibility on a clipped clone. */
.zcl-flap{position:absolute;left:0;width:100%;z-index:0;transform-origin:50% 0;animation:zclFold .8s cubic-bezier(.55,0,.35,1) forwards;pointer-events:none}
.zcl-flap>div{position:absolute;inset:0;overflow:hidden;background:#efeee8}
.zcl-flap .f{animation:zclFront .8s linear forwards}
.zcl-flap .f .z5-np{position:absolute;left:0;width:100%;margin:0;box-shadow:none;clip-path:none}
.zcl-flap .f::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,24,28,.0),rgba(20,24,28,.28));opacity:0;animation:zclShade .8s cubic-bezier(.55,0,.35,1) forwards}
.zcl-flap .b{opacity:0;background-image:repeating-linear-gradient(180deg,rgba(22,24,26,.1) 0 1px,transparent 1px 9px);background-color:#e6e5de;animation:zclBack .8s linear forwards}
@keyframes zclFold{0%{transform:perspective(1800px) rotateX(0)}100%{transform:perspective(1800px) rotateX(-180deg)}}
@keyframes zclShade{to{opacity:1}}
@keyframes zclBack{0%,49.9%{opacity:0}50%,80%{opacity:1}100%{opacity:0}}
@keyframes zclFront{0%,49.9%{opacity:1}50%,100%{opacity:0}}
.zcl-fold.folded{box-shadow:0 12px 18px -8px rgba(30,40,50,.34)}
.zcl-fold.folded .z5-np{box-shadow:none;background-image:linear-gradient(180deg,transparent calc(var(--fy,50%) - 16px),rgba(0,0,0,.1) calc(var(--fy,50%) - 1px),transparent var(--fy,50%))}
/* the crease: a hard line where the paper turns under, with a lighter lip just above it */
.zcl-crease{position:absolute;left:0;right:0;bottom:-1px;height:3px;z-index:2;opacity:0;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.55) 0 1px,rgba(30,34,38,.55) 1px 2px,rgba(30,34,38,.18) 2px 3px)}
.zcl-fold.folded .zcl-crease{opacity:1}
/* folded, a soft band of desk under the paper keeps the masterplan's dark blocks out from under the pencil */
.zcl-fold::after{content:'';position:absolute;left:-40px;right:-40px;top:calc(100% + 8px);height:120px;z-index:0;pointer-events:none;opacity:0;transition:opacity .45s;
  background:linear-gradient(180deg,rgba(228,232,229,.97),rgba(228,232,229,.9) 45%,rgba(228,232,229,0))}
.zcl-fold.folded::after{opacity:1}
/* the pencil sits across the crease; under its lower half a soft wash of desk keeps the masterplan's dark blocks from showing through */
.zcl-pen{position:absolute;left:0;right:0;bottom:-30px;z-index:3;text-align:center;font-family:var(--fh);font-weight:400;font-size:38px;line-height:1;color:#3d4146;transform:rotate(-2.2deg);opacity:0;transition:opacity .45s .05s;pointer-events:none}
.zcl-pen span{position:relative;display:inline-block;padding:4px 30px}
.zcl-pen span::before{content:'';position:absolute;left:0;right:0;top:46%;bottom:-14px;z-index:-1;background:radial-gradient(closest-side,rgba(228,232,229,.97) 55%,rgba(228,232,229,0));}
.zcl-fold.folded .zcl-pen{opacity:.95}
.zcl-late{position:absolute;left:-8px;top:-14px}
.zcl-late .zdk-stamp{position:relative;right:auto;top:auto;display:inline-block;--tf:rotate(-7deg) scale(.5);transform-origin:left top;padding:6px 14px 5px}
.z5-mast{position:relative}
.zcl-acts{position:relative;z-index:2;transition:margin .3s}.zcl-fold.folded+.zcl-acts{margin-top:44px}
@media (prefers-reduced-motion:reduce){.zcl-fold.drop{animation:none}.zcl-pen{transition:none}}

/* ---- the concession file (§14.3): a buff Indian office file, tied with red tape ---- */
.zcf-cover{--buff:#d8c393;--tape:#b8232f;position:relative;box-sizing:border-box;padding:20px 28px 22px;color:#3b2d17;border-radius:2px 7px 7px 2px;transform:rotate(-.3deg);
  background-color:var(--buff);background-image:repeating-linear-gradient(112deg,rgba(110,80,30,.045) 0 2px,transparent 2px 9px),repeating-linear-gradient(23deg,rgba(255,255,240,.06) 0 1px,transparent 1px 6px),linear-gradient(90deg,rgba(90,65,25,.18),transparent 22px);
  box-shadow:0 16px 30px rgba(30,40,50,.26),0 1px 2px rgba(30,40,50,.2),inset 0 0 0 1px rgba(110,85,40,.4);transition:transform .3s cubic-bezier(.5,0,.6,1),opacity .3s;transform-origin:0 50%}
.zcf-print{display:flex;align-items:center;gap:10px;border-bottom:1.5px solid #6e5a35;padding-bottom:7px;margin:0 0 6px;font-family:var(--ft);font-size:12px;color:#5a4626}
.zcf-print .zdk-logo{color:#5a4626}
.zcf-print b{margin-left:auto;font-family:var(--fd);font-weight:700;font-size:16px;color:#3b2d17}
.zcf-rows{width:66%}
.zcf-row{display:grid;grid-template-columns:76px minmax(0,1fr);align-items:end;column-gap:10px;border-bottom:1px dotted #806b44;padding:5px 0 2px;min-height:30px}
.zcf-row>small{font-family:var(--ft);font-size:11.5px;color:#6b5733;padding-bottom:5px}
.zcf-row .h{font-size:21px;line-height:1.2;color:#1f3a8a;padding:0}
.zcf-row .h.big{font-size:31px;line-height:1.08}
.zcf-row .dir{display:flex;align-items:flex-end;gap:12px;min-width:0}
.zcf-row .dir .sg{height:46px;display:flex;align-items:flex-end}.zcf-row .dir .sg img{max-height:58px;max-width:190px;margin-bottom:-8px}.zcf-row .dir .sg .h{font-size:24px}
.zcf-row .dir span:last-child{font-family:var(--ft);font-size:13px;color:#3b2d17;padding-bottom:4px;white-space:nowrap}
.zcf-slip{position:relative;width:66%;box-sizing:border-box;margin-top:16px;padding:0 14px;background:#fcfcf9;transform:rotate(.5deg);box-shadow:0 1px 2px rgba(60,40,10,.3),0 0 0 1px rgba(60,40,10,.06)}
.zcf-slip::before{content:'';position:absolute;inset:-3px -3px auto -3px;height:7px;background:rgba(240,228,190,.6)}
.zcf-slip .zcf-n3{border:0;grid-template-columns:1fr 1.45fr 1fr}.zcf-slip .zcf-n3>div{padding:8px 12px 9px 0}.zcf-slip .zcf-n3>div+div{padding-left:12px}
.zcf-slip .zcf-n3 b{font-size:25px;line-height:1.15;white-space:nowrap}.zcf-slip .zcf-n3 b small{display:inline;font-family:inherit;font-size:15px;font-weight:700;color:inherit;margin-left:.15em}
.zcf-slip .zcf-n3 .cv b{font-size:17px;line-height:1.2;white-space:normal;padding-top:2px}
.zcf-tape{position:absolute;top:-7px;bottom:-7px;left:73%;width:15px;z-index:2;background:var(--tape);background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.08) 0 1px,transparent 1px 3px);box-shadow:1px 0 2px rgba(0,0,0,.3),-1px 0 1px rgba(0,0,0,.15);transition:transform .4s cubic-bezier(.5,0,.7,.4),opacity .4s;transform-origin:50% 0}
.zcf-tape svg{position:absolute;left:-23px;top:40%;width:62px;height:58px;overflow:visible;filter:drop-shadow(0 2px 2px rgba(0,0,0,.3))}
.zcf-side{position:absolute;left:calc(73% + 46px);right:12px;top:66px;font-family:var(--ft);font-size:11.5px;line-height:1.5;color:#5a4626;white-space:nowrap}
.zcf-side .zdk-stamp{position:relative;right:auto;top:auto;display:block;width:max-content;margin-top:10px;--tf:rotate(-8deg) scale(.56);transform-origin:left top;filter:url(#zdkInk)}
.zcf-cover.untie .zcf-tape{transform:translate(70px,-20px) rotate(14deg);opacity:0}
.zcf-cover.open{transform:perspective(1600px) rotateY(-28deg) translateX(-10px);opacity:.0}
.zcf-main .zdk-acts{padding-top:18px}.zcf-where{margin-left:auto;font-family:var(--ft);font-size:12px;color:var(--zpe)}
.zcf-rec li{position:relative;grid-template-columns:110px minmax(0,1fr) 150px;min-height:38px;margin:0 0 4px;padding:3px 12px 3px 14px;border:0;background:#d8c393;border-left:6px solid #b39d68;box-shadow:0 2px 4px rgba(30,40,50,.18);color:#3b2d17}
.zcf-rec li:nth-child(even){background:#d3bd8b}
.zcf-rec li b{color:#3b2d17}
.zcf-rec li .zcf-end{position:relative;height:30px}
.zcf-rec li .zcf-end .zdk-stamp{right:0;top:50%;bottom:auto;--tf:translateY(-50%) rotate(-5deg) scale(.42);transform-origin:right center;filter:url(#zdkInk);white-space:nowrap}
/* earlier concessions: thinner files beneath the cover, 15px edges peeking out below it */
.zcf-stack{position:relative;margin-bottom:calc(var(--n,0) * 17px)}
.zcf-stack>.zcf-cover{z-index:2}
.zcf-edges{list-style:none;margin:0;padding:0;position:absolute;inset:0;z-index:1}
.zcf-edges li{position:absolute;left:calc(6px + var(--k) * 5px);right:calc(18px - var(--k) * 4px);top:0;bottom:calc(-17px * (var(--k) + 1));z-index:calc(5 - var(--k));display:flex;align-items:flex-end;justify-content:space-between;gap:12px;
  padding:0 12px 2px 16px;box-sizing:border-box;border-radius:1px 5px 5px 1px;background:#cfba88;background-image:linear-gradient(180deg,transparent calc(100% - 17px),rgba(255,250,230,.16) calc(100% - 17px),transparent calc(100% - 15px));
  box-shadow:0 3px 6px rgba(30,40,50,.22),inset 0 0 0 1px rgba(110,85,40,.38);transform:rotate(var(--r));transition:transform .15s;outline:none;cursor:default}
.zcf-edges li:nth-child(even){background-color:#c8b07c}
.zcf-edges li span{font-family:var(--ft);font-size:10px;line-height:13px;color:#3b2d17;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.zcf-edges li span b{font-weight:700}
.zcf-edges li i{flex:none;padding:1px 4px 0;border:1.2px solid var(--zr);font-style:normal;font-family:var(--f-sign,'Barlow Condensed'),sans-serif;font-weight:700;font-size:9.5px;line-height:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--zr);mix-blend-mode:multiply;filter:url(#zdkInk)}
.zcf-edges li:hover,.zcf-edges li:focus-visible{transform:rotate(0) translateY(5px)}
.zcf-edges li:focus-visible{box-shadow:0 3px 6px rgba(30,40,50,.22),inset 0 0 0 1px rgba(110,85,40,.38),0 0 0 2px var(--zi)}
@media (prefers-reduced-motion:reduce){.zcf-cover,.zcf-tape,.zcf-edges li{transition:none}}
/* closing the file for tonight: the papers slide back in, the tape ties, the desk dims */
.zcf-tie{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px}
.zcf-tie .zcf-hold{position:relative;width:700px;margin-top:70px}
.zcf-tie .zcf-pp{position:absolute;left:6%;right:10%;top:-64px;height:200px;background:#fcfcf9;box-shadow:0 6px 14px rgba(30,40,50,.18);transform:rotate(var(--r));transition:transform .55s cubic-bezier(.4,0,.6,1)}
.zcf-tie .zcf-pp i{display:block;height:2px;margin:14px 30px 0;background:#dfe0db}.zcf-tie .zcf-pp i:first-child{margin-top:22px;width:40%;height:4px;background:#c9cac4}
.zcf-tie.filing .zcf-pp{transform:translateY(78px) rotate(var(--r))}
.zcf-tie .zcf-cover{z-index:1}
.zcf-tie .zcf-tape{transform:scaleY(0);transition:transform .6s cubic-bezier(.3,.6,.3,1)}
.zcf-tie .zcf-tape svg{opacity:0;transition:opacity .25s .45s}
.zcf-tie.tied .zcf-tape{transform:none}.zcf-tie.tied .zcf-tape svg{opacity:1}
.zcf-dim{position:absolute;inset:0;z-index:1;background:#0b1013;opacity:0;transition:opacity .9s;pointer-events:none}
.zdk.dim .zcf-dim{opacity:.42}
.zcf-tie .zcf-msg{margin:34px 0 0;max-width:560px;padding:9px 18px 10px;background:#fcfcf9;box-shadow:0 6px 14px rgba(0,0,0,.25),0 1px 2px rgba(0,0,0,.25);transform:rotate(-.4deg);font-family:var(--ft);font-size:13.5px;line-height:1.5;color:#1d2024;opacity:0;transition:opacity .4s .3s;text-align:center}
.zdk.dim .zcf-tie .zcf-msg{opacity:1}
.zcf-tie .zdk-acts{opacity:0;transition:opacity .4s .5s}.zdk.dim .zcf-tie .zdk-acts{opacity:1}
.zcf-tie .zdk-acts{padding-top:18px}
@media (prefers-reduced-motion:reduce){.zcf-tie .zcf-pp,.zcf-tie .zcf-tape,.zcf-tie .zcf-tape svg,.zcf-dim,.zcf-tie .zcf-msg,.zcf-tie .zdk-acts{transition:none}}

/* ---- the board minutes (Ch7) and the letter from the banks (Ch6) ---- */
.zs-res{list-style:none;margin:6px 0 12px;padding:0}
.zs-pres{font-size:13px!important;line-height:1.55!important}.zs-pres span{color:var(--zpe)}
@media (max-width:1280px){.zs-min .zdk-note,.zs-let .zdk-note{width:min(255px,calc(100% - 44px));margin-left:26px}}
.zs-res li{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 64px;column-gap:12px;align-items:start;border-top:1px solid #dcddd7;padding:8px 0 6px}
.zs-res li:last-child{border-bottom:1px solid #dcddd7}
.zs-res .zdk-ticks{margin:0}
.zs-res .zdk-ticks button{padding:2px 0}
.zs-res .zdk-ticks button>span b{display:block;font-family:var(--ft);font-weight:700;font-size:12px;color:var(--zpe);margin-bottom:1px}
.zs-res .ini{align-self:center;text-align:center;font-family:var(--fh);font-weight:700;font-size:22px;line-height:1;color:var(--zi);opacity:0;transform:rotate(-6deg)}
.zs-res .ini small{display:block;margin-top:3px;font-family:var(--ft);font-weight:400;font-size:10.5px;color:var(--zt);transform:rotate(6deg)}
.zs-res .ini.on{opacity:1;transition:opacity .15s calc(var(--k)*.22s)}
.zs-min .z5-sl span.no{color:var(--zpe)}
.zs-lh{display:grid;grid-template-columns:1fr auto;align-items:end;gap:14px;border-bottom:2px solid var(--zt);padding-bottom:8px;margin-bottom:16px}
.zs-lh b{display:block;font-family:var(--fd);font-weight:700;font-size:21px;line-height:1.15}
.zs-lh span{display:block;font-family:var(--ft);font-size:11.5px;color:var(--zpe)}
.zs-lh .r{text-align:right}
.zs-let .zdk-doc .t.sub{font-weight:700}
.zs-circ{position:relative;display:inline-block;padding:0 2px;line-height:1.25;font-weight:700;color:var(--zw)}
.zs-circ svg{position:absolute;left:50%;top:50%;width:calc(100% + 18px);height:calc(100% + 8px);transform:translate(-50%,-50%) rotate(-3deg);overflow:visible;pointer-events:none}
.zs-circ+.zs-pnote{display:none}
.zs-agrow{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.zs-pn{display:block;margin:-6px 0 0;max-width:240px;text-align:right;font-family:var(--fh);font-size:15.5px;line-height:1.2;color:#5d6166;transform:rotate(-1.5deg)}
.zs-cut{position:relative;margin:18px -46px 12px;border-top:1.5px dashed #9aa0a5}
.zs-cut span{position:absolute;left:46px;top:-10px;padding:0 8px;background:var(--zp);font-family:var(--ft);font-size:11.5px;color:var(--zpe)}
.zs-let .zdk-sigs{margin-top:10px}
.zs-agent{margin:2px 0 4px;max-width:250px}
.zs-agent .ink{height:46px;display:flex;align-items:flex-end}.zs-agent .ink svg{height:44px}
.zs-agent span{display:block;border-top:1px solid var(--zt);padding-top:4px;font-family:var(--ft);font-size:12px;line-height:1.35}
/* the pile on these desks: each card's title shows above the next card */
.zs-min .zdk-card.z5c,.zs-let .zdk-card.z5c,.zs-step .zdk-card.z5c{top:calc(var(--i)*58px)}
.zs-min .zdk-card span,.zs-let .zdk-card span,.zs-step .zdk-card span{font-size:13.5px;line-height:1.2}
/* a document that scrolls says so: "more below", pencilled at its foot until the end is in view */
.zs-more{position:sticky;bottom:0;z-index:3;display:block;margin:0 -46px -34px;padding:22px 46px 8px;text-align:right;pointer-events:none;background:linear-gradient(180deg,rgba(252,252,249,0),var(--zp) 55%);font-family:var(--fh);font-size:15px;color:#5d6166;transition:opacity .2s}
.zs-more.gone{opacity:0}
@media (max-height:820px){
  .zs-min .zdk-doc,.zs-let .zdk-doc{padding:22px 40px 20px}
  .zs-min .zdk-doc .t,.zs-let .zdk-doc .t{font-size:13.5px;line-height:1.42;margin-bottom:7px}
  .zs-min .zdk-doc h2{font-size:24px;margin:0 0 4px}
  .zs-min .zdk-dh{margin-bottom:10px}
  .zs-pres{font-size:12.5px!important;line-height:1.45!important}
  .zs-res{margin:4px 0 8px}.zs-res li{padding:5px 0 4px}
  .zs-res .zdk-ticks button{font-size:13.5px;line-height:1.35}.zs-res .zdk-ticks button small{font-size:11.5px;line-height:1.35}
  .zs-lh{margin-bottom:10px;padding-bottom:6px}.zs-lh b{font-size:19px}
  .zs-agent .ink{height:32px}.zs-agent .ink svg{height:32px}.zs-agent span{font-size:11.5px;line-height:1.3}
  .zs-cut{margin:10px -40px 9px}.zs-cut span{left:40px}
  .zs-let .zdk-ticks button{padding:2px 0;font-size:13.5px;line-height:1.35}.zs-let .zdk-ticks button small{font-size:11.5px}
  .zs-more{margin:0 -40px -34px;padding:20px 40px 6px}
}
/* the banks take control: the desk goes grey, the pile slides off, the notice is on duty paper */
.zs-grey{filter:grayscale(1);transition:filter 1.2s}
.zs-grey .zdk-plan{opacity:.18}
.zs-step .zdk-card.z5c{animation:zsOff .9s cubic-bezier(.5,0,.75,.3) calc(.4s + var(--i)*.09s) forwards!important}
@keyframes zsOff{to{opacity:0;transform:translate(-40px,70vh) rotate(calc(var(--r) * -6))}}
.zs-step .zdk-doc.duty .t{font-size:14px}
.zs-step .zdk-duty .den b{font-size:21px;white-space:nowrap}.zs-step .zdk-duty span,.zs-step .zdk-duty .ser b{white-space:nowrap}
@media (max-height:820px){.zs-step .zdk-duty{margin-bottom:14px}.zs-step .zdk-cah h2{font-size:27px;margin-bottom:2px}.zs-step .zdk-doc.duty .t{font-size:13.5px;line-height:1.45;margin-bottom:8px}}
.zs-step .zdk-cah .hi{font-size:19px}
@media (prefers-reduced-motion:reduce){.zs-step .zdk-card.z5c{animation:none!important;opacity:0}.zs-grey{transition:none}}

/* ---- the Black Box (§14.7, design/debrief.md): an orange flight-recorder casing; readouts on graph paper ---- */
.zbx{--rec:#ff5a1f;--trace:#c22a2e}
.zbx .zdk-plan{opacity:.16}
.zbx-case{position:absolute;left:44px;top:120px;bottom:44px;width:250px;z-index:2;box-sizing:border-box;border-radius:16px;background:var(--rec);color:#121314;
  background-image:linear-gradient(180deg,rgba(255,255,255,.18),transparent 30%,transparent 70%,rgba(0,0,0,.12)),repeating-linear-gradient(90deg,transparent 0 3px,rgba(0,0,0,.025) 3px 4px);
  box-shadow:0 22px 46px rgba(30,40,50,.35),inset 0 0 0 3px rgba(0,0,0,.18),inset 0 -6px 0 rgba(0,0,0,.12);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;transition:left .5s cubic-bezier(.3,.7,.2,1),width .5s,top .5s,bottom .5s}
.zbx-case::before,.zbx-case::after{content:'';position:absolute;left:0;right:0;height:16px;background:repeating-linear-gradient(90deg,#f4f4f0 0 14px,transparent 14px 24px);opacity:.9}
.zbx-case::before{top:28px}.zbx-case::after{bottom:28px}
.zbx-case .sten{font-family:var(--f-sign,'Barlow Condensed'),sans-serif;font-weight:700;font-size:30px;line-height:1.02;letter-spacing:.1em;text-align:center;text-transform:uppercase}
.zbx-case .sten.s{font-size:19px;letter-spacing:.14em;margin-top:6px}
.zbx-case .op{margin-top:10px;padding:2px 6px;font-family:var(--fh);font-size:20px;color:#121314;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px;background:none;cursor:pointer}
.zbx-case .op:hover{color:#fff}.zbx-case .op:focus-visible{outline:none;text-decoration-thickness:3px}.zbx-case .op.zpf:focus-visible{text-decoration-thickness:1px}
.zbx-case .slot{position:absolute;right:-1px;top:16%;bottom:16%;width:9px;border-radius:0 3px 3px 0;background:#2a1d14;box-shadow:inset 2px 0 3px rgba(0,0,0,.6)}
.zbx.shut .zbx-case{left:calc(50% - 170px);width:340px;top:150px;bottom:110px}
.zbx.shut .zbx-pg,.zbx.shut .zbx-acts{display:none}
.zbx-pg{position:absolute;left:300px;right:44px;top:104px;bottom:96px;z-index:1;box-sizing:border-box;padding:24px 40px 22px;overflow:auto;scrollbar-width:thin;
  background-color:#eef1ee;background-image:linear-gradient(rgba(194,42,46,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(194,42,46,.12) 1px,transparent 1px),linear-gradient(rgba(194,42,46,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(194,42,46,.05) 1px,transparent 1px);
  background-size:50px 50px,50px 50px,10px 10px,10px 10px;box-shadow:0 18px 40px rgba(30,40,50,.25),0 1px 3px rgba(30,40,50,.15)}
.zbx-pg.pull{animation:zbxPull .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes zbxPull{from{opacity:0;transform:translateX(-160px) scaleX(.9);transform-origin:left center}}
.zbx-ph{display:flex;align-items:baseline;gap:14px;border-bottom:1.5px solid var(--zt);padding-bottom:8px;margin-bottom:16px;font-family:var(--ft);font-size:12.5px;color:var(--zpe)}
.zbx-ph b{font-family:var(--fd);font-weight:700;font-size:25px;color:var(--zt)}
.zbx-ph .r{margin-left:auto;text-align:right}
.zbx-big{margin:6px 0 4px;font-family:var(--fh);font-weight:700;font-size:58px;line-height:1.05;color:var(--zt)}
.zbx-big u{text-decoration:none;background:linear-gradient(transparent 82%,rgba(194,42,46,.75) 82%,rgba(194,42,46,.75) 88%,transparent 88%)}
.zbx-lost{margin:0 0 6px;font-family:var(--f-sign,'Barlow Condensed'),sans-serif;font-weight:700;font-size:24px;letter-spacing:.04em;color:var(--trace);mix-blend-mode:multiply}
.zbx-rd{position:relative;margin:58px 0 12px}
.zbx-rd .strip{position:relative;height:40px;border:1px solid #aeb2ad;background:rgba(252,252,249,.9)}
.zbx-rd .in{position:absolute;left:14px;right:14px;top:0;bottom:0}
.zbx-rd svg.g{position:absolute;left:0;top:0;width:100%;height:13px;overflow:visible}.zbx-rd svg.g line{stroke:#3d4247;stroke-width:1}
.zbx-rd .nums span{position:absolute;top:18px;transform:translateX(-50%);font-family:var(--ft);font-size:10.5px;color:#3d4247}
.zbx-rd .band{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,rgba(80,84,90,.32) 0 1.5px,transparent 1.5px 5px)}
.zbx-rd .mk{position:absolute;bottom:calc(100% + 4px);transform:translateX(-50%);font-family:var(--fh);font-size:14.5px;line-height:1.05;color:#4a4e53;white-space:nowrap;text-align:center}
.zbx-rd .mk::after{content:'';position:absolute;left:50%;top:100%;width:1px;height:8px;background:#676c71}
.zbx-rd .mk.lo{bottom:calc(100% + 26px)}.zbx-rd .mk.lo::after{height:30px}
.zbx-rd .mk.r{transform:translateX(calc(-100% + 10px))}.zbx-rd .mk.r::after{left:auto;right:10px}
.zbx-rd .mk.l{transform:translateX(-10px)}.zbx-rd .mk.l::after{left:10px}
.zbx-rd .mk sup{font-family:var(--ft);font-size:9.5px;color:var(--trace)}
.zbx-rd .cur{position:absolute;top:-8px;bottom:-8px;width:3px;margin-left:-1.5px;background:var(--trace)}
.zbx-rd .cur b{position:absolute;top:calc(100% + 2px);left:50%;transform:translateX(-50%);font-family:var(--fh);font-weight:700;font-size:16px;color:var(--trace);white-space:nowrap}
.zbx-ln{margin:30px 0 0;display:grid;grid-template-columns:290px minmax(0,1fr);gap:8px 20px;font-family:var(--ft);font-size:14px;line-height:1.5}
.zbx-ln dt{color:var(--zpe);font-size:12.5px;padding-top:2px}.zbx-ln dd{margin:0;color:var(--zt)}
.zbx-src{margin:20px 0 0;padding:10px 0 0 18px;border-top:1px solid #b9bdb8;font-family:var(--ft);font-size:11px;line-height:1.5;color:#4a4e53}
.zbx .zbx-m{margin:-6px 0 14px;font-family:var(--ft);font-size:12.5px;color:var(--zpe)}
.zbx-led{width:100%;border-collapse:collapse;font-family:var(--ft);font-size:13.5px}
.zbx-led td{padding:7px 0 0;vertical-align:middle}
.zbx-led td.lb{width:250px;padding-right:16px}
.zbx-led .bar{position:relative;height:22px}
.zbx-led .bar i{position:absolute;left:0;top:3px;bottom:3px;border:1.5px solid var(--zt);background:repeating-linear-gradient(45deg,var(--zt) 0 1.6px,transparent 1.6px 5px)}
.zbx-led .bar i.pen{border:1px solid #6d7176;background:repeating-linear-gradient(45deg,rgba(90,94,100,.6) 0 1px,transparent 1px 6px)}
.zbx-led .bar i.neg{border-color:var(--trace);background:repeating-linear-gradient(-45deg,rgba(194,42,46,.75) 0 1.4px,transparent 1.4px 5px)}
.zbx-led .bar span{position:absolute;top:2px;font-weight:700;white-space:nowrap}
.zbx-led tr.sn td{padding:1px 0 8px;font-family:var(--fh);font-size:16.5px;line-height:1.25;color:#2c3036;border-bottom:1px dotted #b9bdb8}
.zbx-led tr.ee td{color:var(--zpe)}
.zbx .zbx-pl{margin:18px 0 0;font-family:var(--fh);font-weight:700;font-size:21px;line-height:1.3;color:#2c3036;transform:rotate(-.8deg)}
.zbx-papers{position:relative;height:288px;margin:8px 0 0}
.zbx-pp{position:absolute;top:calc(var(--y)*1px);left:calc(var(--i)*var(--step));width:var(--pw,190px);height:236px;box-sizing:border-box;padding:9px 10px;text-align:left;background:#efeee8;color:#16181a;transform:rotate(var(--r));
  box-shadow:0 8px 18px rgba(30,40,50,.22),0 1px 2px rgba(30,40,50,.18);transition:transform .25s,box-shadow .25s;z-index:var(--z);cursor:zoom-in}
.zbx-pp:hover,.zbx-pp:focus-visible{z-index:20;transform:rotate(0) translateY(-8px)}
.zbx-pp.open{z-index:30;transform:rotate(0) translateY(-10px) scale(1.55);transform-origin:50% 20%;cursor:zoom-out;box-shadow:0 26px 50px rgba(30,40,50,.35)}
.zbx-pp:not(:last-child){padding-right:26px}
.zbx-pp .ms{display:block;text-align:center;font-family:var(--fd);font-weight:700;font-size:11px;white-space:nowrap;border-bottom:1px solid #16181a;padding-bottom:4px}
.zbx-pp .dy{display:flex;justify-content:space-between;gap:4px;border-bottom:2px double #16181a;padding:2px 0;font-family:var(--fd);font-size:9px;white-space:nowrap}
.zbx-pp b{display:block;margin-top:7px;font-family:var(--fd);font-weight:700;font-size:13.5px;line-height:1.13;text-wrap:balance;overflow-wrap:break-word;hyphens:manual}
.zbx-pp .rl{display:block;margin-top:8px;height:60px;background:repeating-linear-gradient(180deg,rgba(22,24,26,.15) 0 1px,transparent 1px 7px)}
.zbx-cls{position:relative;height:96px}
.zbx .zbx-cl{position:absolute;top:0;left:calc(var(--i)*var(--step));width:calc(var(--step) - 6px);margin:0;font-family:var(--fh);font-size:14.5px;line-height:1.22;color:#2c3036}
.zbx-cl small{display:block;font-family:var(--ft);font-size:10.5px;color:var(--zpe);margin-top:2px}
.zbx .zbx-once{margin:10px 0 0;font-family:var(--fh);font-weight:700;font-size:19px;color:#2c3036}
.zbx-hw{list-style:none;margin:6px 0 0;padding:0;counter-reset:f}
.zbx-hw li{counter-increment:f;position:relative;padding:14px 0 14px 40px;border-bottom:1px dotted #b9bdb8;font-family:var(--ft);font-size:15px;line-height:1.5;color:var(--zt)}
.zbx-hw li::before{content:counter(f) '.';position:absolute;left:0;top:14px;font-family:var(--ft);font-weight:700;color:var(--zpe)}
.zbx-hw li b{font-weight:700}
.zbx-hw li small{display:block;margin-top:5px;font-family:var(--fh);font-size:17px;line-height:1.3;color:#5d6166}
.zbx-th{list-style:none;margin:18px 0 0;padding:0}
.zbx-th li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;padding:5px 0;font-family:var(--ft);font-size:13.5px}
.zbx-th li i{font-style:normal;font-family:var(--fh);font-weight:700;font-size:22px;line-height:1}.zbx-th li i.y{color:var(--zi)}.zbx-th li i.n{color:var(--trace)}
.zbx-acts{position:absolute;left:300px;right:44px;bottom:26px;z-index:2;display:flex;align-items:center;gap:4px}
.zbx-acts .zdk-go{margin-right:8px}
@media (max-width:1280px){.zbx-case{left:28px;width:200px;top:110px}.zbx-case .sten{font-size:25px}.zbx-case .sten.s{font-size:16px}.zbx-pg{left:246px;right:24px;top:100px;bottom:88px;padding:20px 30px}.zbx-acts{left:246px;right:24px;bottom:22px}.zbx-big{font-size:50px}.zbx-papers{height:270px}.zbx-pp{height:218px}.zbx-led td.lb{width:220px}}
@media (prefers-reduced-motion:reduce){.zbx-pg.pull{animation:none}.zbx-case{transition:none}}
`;
let cssS=false;
function mountS(){mountF();if(cssS)return;cssS=true;const st=document.createElement('style');st.id='zmmCssS';st.textContent=CSSS;document.head.appendChild(st);}
const ROMAN=['','I','II','III'];
M.ACTS=['','The Deal','The Network','The Long Game'];
const CH_SUB=['','win the concession','build the airport','open the doors','wire the country','take on the Gulf','the crisis','hand it back','the record'];
const actOf=n=>n<=3?1:n<=5?2:3;
const nIn=v=>Math.round(+v||0).toLocaleString('en-IN');
const quiet=()=>noise(.22,900,.12,0,2);   // a very quiet paper slide

/* ---------- the strip (§14.1) ----------
   ZMMoney.setStrip(o) sets where the player is in the flight, or clears it (null). Every desk screen shows it at the top
   right; ZMMoney.strip(container, mode) mounts a holder anywhere else (mode 'night' for the ops HUD). A new chapter slides its
   strip into the holder and drops the last one into the bay. Past strips only: the bay never shows a phase after this one.
   o = {chapter:{n, id, name, act} (VSIEra.chapter(state)), years:[first, last] game years, cal?:[from, to] calendar years,
        doc?:{title, stamp?} (the deciding document; the stamp once signed), stakePct?, callsign? (default "VSI 60Y"),
        past:[{n, name?, years, cal?, doc, stakePct}]} */
let STRIP=null,STRIP_ANIM=false;
function stripOne(o,cls){o=o||{};const c=o.chapter||o,n=+c.n||0,name=String(c.name||M.CHAPTERS[n-1]||(n===8?'Black Box':'')).toUpperCase();
  const ys=o.years||c.years,cal=o.cal||(ys?ys.map(y=>2025+Math.max(1,+y)):null);
  const yt=cal?(cal[0]===cal[1]?String(cal[0]):`${cal[0]} → ${cal[1]}`):'',gt=ys?(+ys[1]<=0?'signing':ys[0]===ys[1]?'year '+ys[0]:`year ${ys[0]}–${ys[1]}`):'';
  const d=o.doc||{},cs=o.callsign||STRIP&&STRIP.callsign||`${M.cfg.airportShort} ${M.cfg.years}Y`;
  return `<div class="zfs${cls?' '+cls:''}" data-n="${n}"><span class="cs"><b>${esc(cs)}</b><small>${esc(M.cfg.spvShort)}</small></span>
    <span class="ph"><b>${esc(name)}</b><small>${esc(c.sub||CH_SUB[n]||'')}</small></span>
    <span class="yr"><b>${esc(yt)}</b><small>${esc(gt)}</small></span>
    <span class="dc"><em>${esc(d.title||'')}</em>${d.title?(d.stamp?`<i class="st">${esc(d.stamp)}</i>`:'<i class="op">open</i>'):''}</span>
    <span class="sk"><b>${o.stakePct!=null?esc(pctTxt(o.stakePct)):''}</b><small>${o.stakePct!=null?'stake':''}</small></span></div>`;}
function stripHolder(mode){const o=STRIP;if(!o)return '';const n=+((o.chapter||{}).n)||0;
  const past=(o.past||[]).filter(p=>(+((p.chapter||p).n)||0)<n).sort((a,b)=>(+((b.chapter||b).n))-(+((a.chapter||a).n)));   // newest first; never a later phase
  const moved=STRIP_ANIM&&!reduced();STRIP_ANIM=false;   // the first holder drawn after a chapter change slides the new strip in
  return `<div class="zfs-h z5v ${mode||'day'}" aria-label="${esc(M.chapterName(n)||'')}">${stripOne(o,moved?'cur slide':'cur')}<div class="zfs-bay">${past.map((p,k)=>{const c=p.chapter||p;
    return `<div class="zfs-e${moved&&k===0?' dropin':''}" tabindex="0" aria-label="${esc(M.chapterName(+c.n))}"><em>${esc(String(c.name||M.CHAPTERS[c.n-1]||'').toUpperCase())}</em>${stripOne(p,'pk')}</div>`;}).join('')}</div></div>`;}
function stripDesk(){return STRIP?stripHolder('day'):'';}
M.setStrip=function(o){mountS();const was=STRIP&&STRIP.chapter?+STRIP.chapter.n:null;STRIP=o||null;const now=STRIP&&STRIP.chapter?+STRIP.chapter.n:null;if(was!=null&&now!=null&&was!==now)STRIP_ANIM=true;
  document.querySelectorAll('.zfs-h').forEach(h=>{const mode=h.classList.contains('night')?'night':'day';if(!STRIP){h.remove();return;}const t=document.createElement('div');t.innerHTML=stripHolder(mode);h.replaceWith(t.firstElementChild);});
  return STRIP;};
M.getStrip=()=>STRIP;
M.strip=function(el,mode){mountS();if(typeof el==='string')el=document.querySelector(el);mode=mode||(el?'day':'night');const host=el||$('#app');if(!host||!STRIP)return null;
  const old=host.querySelector(':scope>.zfs-h');if(old)old.remove();const t=document.createElement('div');t.innerHTML=stripHolder(mode);const h=t.firstElementChild;host.appendChild(h);return h;};

/* ---------- the split-flap years (§14.2) ----------
   ZMMoney.flaps(bridge, opts?) → Promise. bridge = VSIEra.bridge(state, n): {fromYear, toYear, lines[] (one headline per year,
   oldest first: a string or {lead}), frontPage}. Each year, every changed digit clatters through the blank flap onto its new digit (each leaf a falling top half and a landing
   bottom half), the period's headlines
   riffle behind it (at most one every 250 ms), the whole thing takes about 3 s, then it lands on bridge.frontPage
   (ZMMoney.frontPage) and resolves when that is turned over. One click skips to the end. Reduced motion: the final year and
   the first headline only. opts: {land:false} resolves after the flip without the front page; {strip} is the next chapter's
   ZMMoney.setStrip data, set as the flip lands so the new strip slides in over the front page. */
M.flaps=function(b,opt){mountS();b=b||{};opt=opt||{};return new Promise(res=>{
  const y0=Math.round(+b.fromYear||2026),y1=Math.round(+b.toYear||y0),n=Math.max(1,Math.abs(y1-y0)),dir=y1>=y0?1:-1;
  const lines=(b.lines||[]).map(l=>typeof l==='string'?l:l&&(l.lead||l.text)||'').filter(Boolean);
  const head=k=>lines.length?lines[Math.min(lines.length-1,Math.floor(k*lines.length/n))]:'';
  const STEP=Math.max(80,Math.min(320,2500/n));   // ms a year: about 2.5 s of flipping, then the landing
  // each changed digit runs a short clatter every year: through the blank flap, then onto the new digit (two leaves, each a
  // falling top half and a landing bottom half); with little time a year, one leaf
  const LEAVES=STEP>=200?2:1,HALF=Math.max(28,Math.min(70,Math.floor(STEP/(LEAVES*2)-6)));
  const digits=y=>String(y).padStart(4,'0').split('');const game=y=>y-2025;
  const sh=desk5('zfl',`<div class="z5-stage zfl-stage" id="zflStage" title="Click to skip"><div class="zfl-wrap">
    <article class="zfl-np" id="zflNp" aria-live="off"><p class="ms">${esc(b.masthead||'The Zero Mile Times')}</p><div class="dl"><span id="zflDl">Nagpur, ${y0}</span><span>${esc(M.cfg.airportName)} and the world</span></div><h2 id="zflLead">${esc(head(0))}</h2><div class="rl"></div></article>
    <div class="zfl-board" role="timer" aria-label="The years pass: ${y0} to ${y1}"><div class="zfl-yr">${digits(y0).map(d=>`<span class="c"><b>${d}</b></span>`).join('')}</div>
      <div class="zfl-sub"><span id="zflGy">year <b>${game(y0)}</b> of ${M.cfg.years}</span><span>${y0} → ${y1}</span></div></div></div>
    <p class="zfl-skip">${reduced()?'Click to go on':'Click to skip'}</p></div>`);
  const cells=[...sh.querySelectorAll('.zfl-yr .c')],np=sh.querySelector('#zflNp'),lead=sh.querySelector('#zflLead'),dl=sh.querySelector('#zflDl'),gy=sh.querySelector('#zflGy b');
  let cur=y0,k=0,lastHead=-1e9,lastLine=head(0),done=false,timer=0;const t0=performance.now();
  const leaf=(c,a,b)=>{const b0=c.querySelector('b');b0.textContent=b;   // the new top half shows as the old top leaf falls
    const mk=(cls,t)=>{const e=document.createElement('i');e.className=cls;e.textContent=t;e.style.setProperty('--d',HALF+'ms');c.appendChild(e);return e;};
    const es=[mk('ob',a),mk('tl',a),mk('bl',b)];setTimeout(()=>es.forEach(e=>e.remove()),HALF*2+20);};
  const setYear=y=>{const ds=digits(y);cells.forEach((c,i)=>{const b0=c.querySelector('b'),a=b0.textContent,b=ds[i];if(a===b)return;
      if(c._seq)c._seq.forEach(clearTimeout);c.querySelectorAll('i').forEach(e=>e.remove());
      if(reduced()){b0.textContent=b;return;}
      const seq=LEAVES>1?[a,'\u00a0',b]:[a,b];c._seq=[];for(let k=1;k<seq.length;k++)c._seq.push(setTimeout(()=>leaf(c,seq[k-1],seq[k]),(k-1)*(HALF*2+4)));});
    dl.textContent='Nagpur, '+y;gy.textContent=game(y);};
  const setHead=(t,force)=>{const now=performance.now();if(!t||t===lastLine||(!force&&now-lastHead<250))return;lastLine=t;lastHead=now;lead.textContent=t;if(!reduced()){np.classList.remove('riff');void np.offsetWidth;np.classList.add('riff');}};
  const land=()=>{window.__zmmFlapMs=Math.round(performance.now()-t0);
    // the next chapter's strip slides into the holder as its front page arrives (set after the page opens, so the slide plays there)
    if(b.frontPage&&opt.land!==false){const pr=M.frontPage(b.frontPage);if(opt.strip)M.setStrip(opt.strip);pr.then(()=>res());}else{if(opt.strip)M.setStrip(opt.strip);close();res();}};
  const finish=()=>{if(done)return;done=true;clearTimeout(timer);setYear(y1);setHead(lines.length?lines[lines.length-1]:'',true);setTimeout(land,reduced()?0:380);};
  const tick=()=>{if(done)return;k++;cur+=dir;setYear(cur);setHead(head(k));noise(.035,2600,.05+.16*(1-k/n),0,6);if(k>=n){finish();return;}timer=setTimeout(tick,STEP);};
  sh.querySelector('#zflStage').onclick=()=>{if(reduced()&&!done){done=true;land();return;}finish();};
  if(reduced()){setYear(y1);lead.textContent=head(0);return;}   // the final year and the first headline; a click goes on
  timer=setTimeout(tick,260);
});};

/* ---------- the cliffhanger (§14.4) ----------
   ZMMoney.cliffhanger(frontPage, opts?) → Promise<'turn'|'close'>. frontPage = VSIEra.cliffhanger(state, act) in the frontPage
   shape. The act's last page is the Late City edition. A click on the paper (or either choice) folds it in half, leaving the
   lead above the fold, with "Act II · The Network" pencilled across it. "Turn the page" resolves 'turn'; "Close the file for
   tonight" closes the file (ZMMoney.closeFile(opts.file)) and resolves 'close'. opts: {act (the next act: 2 or 3),
   actName?, file?}. Reduced motion: the page arrives folded. */
M.cliffhanger=function(o,opt){mountS();o=o||{};opt=opt||{};return new Promise(res=>{
  const next=+(opt.act||o.nextAct||2),name=opt.actName||M.ACTS[next]||'';
  const sh=desk5('z5-fp zcl',`<div class="z5-stage zcl-stage"><div class="zcl-fold" id="zclFold"><article class="z5-np" id="z5Np" aria-label="${esc(o.masthead||'The Zero Mile Times')}, Late City edition">${npInner(Object.assign({},o,{late:true}))}</article>
      <i class="zcl-crease" aria-hidden="true"></i><div class="zcl-pen" aria-hidden="true"><span>Act ${ROMAN[next]||next} · ${esc(name)}</span></div></div>
    <div class="z5-acts zcl-acts"><button class="zdk-go" id="zclTurn">Turn the page</button><button class="zdk-q" id="zclClose">Close the file for tonight</button></div></div>`);
  const wrap=sh.querySelector('#zclFold'),np=sh.querySelector('#z5Np');let folded=false,busy=false,H=0,S=1,F=0;
  // the crease runs just under the rule below the deck (the lead and its deck stay above it), or at half the page if the page is
  // laid out otherwise; the pencil across it then sits on clean paper, not on the photograph
  const fit=()=>{wrap.style.setProperty('--s',1);H=np.offsetHeight;const w=np.offsetWidth,stg=wrap.parentElement,pt=parseFloat(getComputedStyle(stg).paddingTop)||0;
    const bd=np.querySelector('.z5-body');F=bd?bd.offsetTop+5:H/2;if(!(F>=H*.35&&F<=H*.62))F=H/2;F=Math.round(F);
    np.style.setProperty('--fb',(H-F)+'px');np.style.setProperty('--fy',F+'px');
    const av=stg.clientHeight-pt-84,aw=stg.clientWidth-60;S=Math.min(1,av/H,aw/w);wrap.style.setProperty('--s',S.toFixed(3));wrap.style.marginBottom=(-(1-S)*(folded?F:H))+'px';};
  const settle=()=>{folded=true;np.classList.add('top');wrap.style.height=F+'px';wrap.classList.add('folded');wrap.style.marginBottom=(-(1-S)*F)+'px';};
  const fold=()=>new Promise(r=>{if(folded){r();return;}fit();
    if(reduced()){settle();r();return;}
    wrap.style.height=H+'px';const h2=F,flap=document.createElement('div');flap.className='zcl-flap';flap.style.top=h2+'px';flap.style.height=(H-h2)+'px';
    const face=document.createElement('div');face.className='f';const c=np.cloneNode(true);c.removeAttribute('id');c.removeAttribute('aria-label');c.style.top=(-h2)+'px';c.style.height=H+'px';face.appendChild(c);
    const back=document.createElement('div');back.className='b';flap.append(face,back);wrap.insertBefore(flap,np);np.classList.add('top');quiet();
    setTimeout(()=>{flap.remove();settle();r();},800);});
  fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(!folded)fit();});
  if(reduced())settle();else{wrap.classList.add('drop');slap();}
  np.onclick=()=>{if(!busy)fold();};
  sh.querySelector('#zclTurn').onclick=()=>{if(busy)return;busy=true;fold().then(()=>setTimeout(()=>{close();res('turn');},folded&&!reduced()?260:0));};
  sh.querySelector('#zclClose').onclick=()=>{if(busy)return;busy=true;fold().then(()=>M.closeFile(Object.assign({act:next-1},opt.file||{}))).then(()=>res('close'));};
});};

/* ---------- the concession file's cover (§14.3), shared by the Concession tab and closing the file ---------- */
const ENDSTAMP={handback:'Handed back',banks:'Taken by the banks',torn:'Torn up'};
const KNOT='<svg viewBox="0 0 62 58" aria-hidden="true"><path d="M31 27 C18 8 2 10 4 22 C6 33 20 33 31 27 Z M31 27 C44 8 60 10 58 22 C56 33 42 33 31 27 Z" fill="#b8232f" stroke="#7d1620" stroke-width="1.2"/><path d="M29 30 L18 56 L25 54 L31 34 L37 54 L44 56 L33 30 Z" fill="#a51f2a" stroke="#7d1620" stroke-width="1"/><rect x="26" y="22" width="10" height="11" rx="3" fill="#c5303a" stroke="#7d1620" stroke-width="1.2"/></svg>';
function fileNo(o){if(o.fileNo)return o.fileNo;const y=/^(\d{4})/.exec(o.signedOn||'');return `${M.cfg.spvShort}/${y?y[1]:new Date().getFullYear()}/${String(((o.record||[]).length||0)+1).padStart(3,'0')}`;}
function fileAct(o){if(o.act)return +o.act;const c=o.chapter;const n=c&&typeof c==='object'?+c.n:+c;return isFinite(n)&&n>0?actOf(n):null;}
function coverHtml(o,n3){const yrs=M.cfg.years,act=fileAct(o);
  const status=[o.year!=null?`Year ${o.year} of ${yrs}`:'',act?`Act ${ROMAN[act]}`:''].filter(Boolean).join(' · ');
  return `<article class="zcf-cover" aria-label="Concession file: ${esc(o.company||'')}">
    <div class="zcf-print">${vsiLogo(18)}<span>${esc(M.cfg.spvName)}</span><b>Concession file</b></div>
    <div class="zcf-rows"><div class="zcf-row"><small>File no.</small>${H(fileNo(o))}</div>
      <div class="zcf-row"><small>Subject</small><span class="h big">${esc(o.company||'')}</span></div>
      <div class="zcf-row"><small>Director</small><span class="dir"><span class="sg">${sigOf(o.signature,o.founder)}</span><span>${esc(o.founder||'')}, director</span></span></div>
      <div class="zcf-row"><small>Status</small>${status?H(status):''}</div></div>
    ${n3?`<div class="zcf-slip">${n3}</div>`:''}
    <div class="zcf-side">${esc(M.cfg.airportShort)} · Nagpur<br>${o.signedOn?'Opened<br>'+esc(M.fmtDate(o.signedOn)):''}${o.signedOn?stampHtml('Executed','',dayOf(o.signedOn)):''}</div>
    <i class="zcf-tape" aria-hidden="true">${KNOT}</i></article>`;}

/* ZMMoney.closeFile(o) → Promise. The act break (§14.3 "Close the file for tonight"): the papers slide back into the file, the
   red tape ties (0.6 s), the desk dims; "Back to the menu" resolves. o = the concessionFile opts (company, founder, signature,
   signedOn, year, act or chapter, record?), plus cta?. Reduced motion: it appears tied. */
M.closeFile=function(o){mountS();o=o||{};return new Promise(res=>{
  const sh=desk5('zcf-close',`<i class="zcf-dim"></i><div class="zcf-tie" id="zcfTie"><div class="zcf-hold">${[-2.2,1.4,-.6].map(r=>`<div class="zcf-pp" style="--r:${r}deg"><i></i><i></i><i></i><i></i></div>`).join('')}${coverHtml(o,'')}</div>
    <p class="zcf-msg">${esc(o.company||'Your company')}’s file is closed for tonight. It waits in the Concession tab${o.year!=null?`, at year ${esc(o.year)}`:''}.</p>
    <div class="zdk-acts"><button class="zdk-go" id="zcfBack">${esc(o.cta||'Back to the menu')}</button></div></div>`);
  const tie=sh.querySelector('#zcfTie'),desk=sh.querySelector('.zdk');
  sh.querySelector('#zcfBack').onclick=()=>{close();res();};
  if(reduced()){tie.classList.add('filing','tied');desk.classList.add('dim');return;}
  quiet();requestAnimationFrame(()=>requestAnimationFrame(()=>tie.classList.add('filing')));
  setTimeout(()=>{tie.classList.add('tied');noise(.3,700,.1,0,1.5);},620);setTimeout(()=>desk.classList.add('dim'),1150);
});};

function moreCue(doc){const m=document.createElement('i');m.className='zs-more';m.setAttribute('aria-hidden','true');m.textContent='more below ↓';doc.appendChild(m);
  const upd=()=>m.classList.toggle('gone',doc.scrollTop+doc.clientHeight>=doc.scrollHeight-6);doc.addEventListener('scroll',upd,{passive:true});
  upd();setTimeout(upd,700);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(upd);return upd;}
/* ---------- the board minutes (Chapter 7) ----------
   ZMMoney.minutes(o) → Promise<{adopted:{[id]:boolean}, ids:[adopted ids], approvedOn}>. Three resolutions, one tick box each:
   ticked is adopted, left blank is rejected. "Approve the minutes" initials each resolution, the chair signs, APPROVED comes down.
   o = {docId, date (YYYY-MM-DD), year, founder, parent, signature?, present?:[{name, role}], intro?,
        resolutions:[{id, title, text, slip:{yes, no, line?}, def?}] (or VSIEra.ch7.decision's choices), stamp?, pile?, slipQuestion?} */
M.minutes=function(o){mountS();o=o||{};return new Promise(res=>{
  const R=(o.resolutions||(o.choices||[]).map(c=>({id:c.id,title:c.label,text:c.terms,def:c.def,slip:{yes:(c.slip||{}).big||(c.slip||{}).yes,no:(c.slip||{}).no,line:(c.slip||{}).line}}))).slice(0,3);
  const sel=new Set(R.filter(r=>r.def).map(r=>r.id)),pile=o.pile||PILE,sd=dayOf(o.date),now=new Date(),dt=sd?longDay(sd):longDay(now);
  const coName=M.cfg.coinvestor.name.split(':')[0];
  const ini=(o.founder||o.parent||'').split(/\s+/).filter(w=>/^[A-Za-z]/.test(w)).slice(0,3).map(w=>w[0].toUpperCase()+'.').join('');
  const presentTxt=o.present?o.present.map(p=>`${esc(p.name)}${p.role?', '+esc(p.role):''}`).join('; ')+'.':
    `${esc(o.founder||'The chair')} in the chair (${esc(o.parent||'your company')}), ${esc((M.cfg.signatories.coinvestor||{}).name||coName)} (${esc(coName)}), and the nominees of the Airports Authority and the State.`;
  let done=false;
  const sh=desk5('z5-dec zs-min',`<header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pileCards(pile)}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc arrive" id="zdkDoc">
      <div class="zdk-dh">${vsiLogo(22)}<span>Board minutes · ${esc(o.docId||'')}</span><span class="dt">${esc(dt)}</span></div>
      <h2>${esc(o.title||'Minutes of the board of '+M.cfg.spvShort)}</h2>
      <p class="t">Held at Zero Mile Tower, Nagpur, on ${esc(dt)}${o.year!=null?`, in year ${esc(o.year)} of the concession`:''}.</p>
      <p class="t zs-pres"><span>Present:</span> ${presentTxt}</p>
      ${paras(o.intro||'A ticked resolution is adopted; one left blank is rejected.').map(p=>`<p class="t">${esc(p)}</p>`).join('')}
      <ol class="zs-res">${R.map((r,k)=>`<li><div class="zdk-ticks"><button role="checkbox" aria-checked="${sel.has(r.id)}" data-id="${esc(r.id)}"><i></i><span><b>Resolution ${k+1}</b>${esc(r.title)}</span>${r.text?`<small>${esc(r.text)}</small>`:''}</button></div><span class="ini" style="--k:${k}" aria-hidden="true">${esc(ini)}<small></small></span></li>`).join('')}</ol>
      <div class="zdk-sigs"><div class="s" id="zsChair"><div class="ink"></div><span><b>${esc(o.founder||'The chair')}</b><br>Chair${o.parent?', for '+esc(o.parent):''}</span><small>for the board of ${esc(M.cfg.spvShort)}</small></div></div>
    </article><div class="zdk-acts"><button class="zdk-go" id="zsGo"></button></div></div>
    <aside class="zdk-note arrive" id="zdkNote" aria-live="polite"></aside></main>`);
  wirePile(sh,pile);
  const doc=sh.querySelector('#zdkDoc'),note=sh.querySelector('#zdkNote'),go=sh.querySelector('#zsGo');moreCue(doc);
  const upd=()=>{note.innerHTML=`<h3>${esc(o.slipQuestion||'What each resolution does')}</h3>${R.map(r=>{const s=r.slip||{},on=sel.has(r.id);
      return `<div class="z5-sl${on?' on':''}"><b>${esc(r.title)}</b><span${on?'':' class="no"'}>${esc(on?(s.yes||'Adopted'):(s.no||'Rejected'))}</span></div>`;}).join('')}${(()=>{const l=R.filter(r=>sel.has(r.id)&&r.slip&&r.slip.line).pop();return l?`<p>${esc(l.slip.line)}</p>`:'';})()}`;
    const a=sel.size;go.textContent=`Approve the minutes: ${a} adopted, ${R.length-a} rejected`;};
  upd();
  sh.querySelectorAll('.zs-res button').forEach(b=>b.onclick=()=>{if(done)return;const id=b.dataset.id;if(sel.has(id))sel.delete(id);else sel.add(id);b.setAttribute('aria-checked',sel.has(id)?'true':'false');upd();});
  go.onclick=()=>{if(done)return;done=true;go.disabled=true;
    sh.querySelectorAll('.zs-res li').forEach((li,k)=>{const r=R[k],x=li.querySelector('.ini');x.querySelector('small').textContent=sel.has(r.id)?'Adopted':'Rejected';x.classList.add('on');});
    const me=sh.querySelector('#zsChair .ink');const sgs=sh.querySelector('.zdk-sigs');
    if(doc.scrollHeight>doc.clientHeight)doc.scrollTo({top:doc.scrollHeight,behavior:reduced()?'auto':'smooth'});
    const word=o.stamp||'Approved';
    setTimeout(()=>{me.innerHTML=o.signature?`<img src="${esc(o.signature)}" alt="Your signature">`:H(o.founder||M.cfg.spvShort);sgs.insertAdjacentHTML('beforeend',stampHtml(word,'down',sd));if(!reduced())thud();},reduced()?0:R.length*220+200);
    const adopted={};R.forEach(r=>adopted[r.id]=sel.has(r.id));
    const fin=()=>{close();res({adopted,ids:R.filter(r=>sel.has(r.id)).map(r=>r.id),approvedOn:isoDay(sd||now)});};
    if(reduced()){setTimeout(fin,900);return;}
    setTimeout(()=>{const p=sh.querySelector('#zdkPile'),n=Math.min(5,p.children.length),cd=document.createElement('div');cd.className='zdk-card';cd.style.setProperty('--i',n);cd.style.setProperty('--r','3deg');
      cd.innerHTML=`<span>${esc(o.title||'Board minutes')}</span><i></i><i></i><i class="s"></i>${stampHtml(word,'mini',sd)}`;doc.classList.add('leave');note.style.opacity='0';setTimeout(()=>p.appendChild(cd),380);},R.length*220+1300);
    setTimeout(fin,R.length*220+2500);};
});};

/* ---------- the letter from the banks (Chapter 6) ----------
   ZMMoney.letter(o) → Promise<{choice, signedOn}>. One cold paragraph from the lenders' agent, the worst number circled in
   pencil, and a reply slip below the cut with three replies (own money / L5 Capital / refuse). Signing brings down the reply's
   stamp (CURED / AGREED / REFUSED). Refusing then shows the notice that the banks take control (ZMMoney.stepIn(o.stepIn))
   before it resolves. o = {docId, date, from?:{name, address}, signatory?, subject, body (one paragraph), circle (the text in
   the body to circle, e.g. "₹96"), circleNote?, replies:[{id:'own'|'l5'|'refuse', label, terms, slip:{big, money, line}, act?}]
   (or VSIEra.ch6.decision's choices), stamps?:{[id]:word}, founder, parent, signature?, pile?, stepIn?} */
M.letter=function(o){mountS();o=o||{};return new Promise(res=>{
  const ch=(o.replies||o.choices||[]).slice(0,3),fr=o.from||{},pile=o.pile||PILE,sd=dayOf(o.date),now=new Date(),dt=sd?longDay(sd):longDay(now);
  const ag=Object.assign({},M.cfg.signatories.lenders||{},o.signatory||{});
  const STAMP={own:'Cured',l5:'Agreed',refuse:'Refused'};
  let body=paras(o.body).map(p=>esc(p));
  if(o.circle){const c=esc(o.circle);const i=body.findIndex(p=>p.indexOf(c)>=0);
    if(i>=0)body[i]=body[i].replace(c,`<span class="zs-circ">${c}<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M62 3 C84 3 99 10 98 20 C97 31 78 38 50 38 C22 38 2 31 2 20 C2 9 22 2 48 2 C58 2 66 4 72 6" fill="none" stroke="#5b5f63" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg></span>`);}
  let pick=null,done=false;
  const sh=desk5('z5-dec zs-let',`<header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header>
    <div class="zdk-pile" id="zdkPile" aria-label="Documents on file">${pileCards(pile)}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc arrive" id="zdkDoc">
      <div class="zs-lh"><div><b>${esc(fr.name||'The lenders to '+M.cfg.spvShort)}</b><span>${esc(fr.address||'Through their agent · Nariman Point, Mumbai 400 021')}</span></div><div class="r"><span>Ref. ${esc(o.docId||'')}</span><span>${esc(dt)}</span></div></div>
      <p class="t">To the board of ${esc(M.cfg.spvName)}${o.founder?`, for the attention of ${esc(o.founder)}, director`:''}.</p>
      ${o.subject?`<p class="t sub">${esc(o.subject)}</p>`:''}
      ${body.map(p=>`<p class="t">${p}</p>`).join('')}
      <div class="zs-agrow"><div class="zs-agent"><div class="ink">${signSvg(ag)}</div><span><b>${esc(ag.name||'')}</b><br>${esc(ag.title||'Agent for the lenders')}</span></div>${o.circleNote?`<span class="zs-pn">${esc(o.circleNote)}</span>`:''}</div>
      <div class="zs-cut"><span>Reply · tear here and return</span></div>
      <p class="t">${esc(M.cfg.spvShort)}'s owners reply as ticked below.</p>
      <div class="zdk-ticks" role="radiogroup" aria-label="Your reply">${ch.map(c=>`<button role="radio" aria-checked="false" data-id="${esc(c.id)}"><i></i><span>${esc(c.label)}</span>${c.terms?`<small>${esc(c.terms)}</small>`:''}</button>`).join('')}</div>
      <div class="zdk-sigs"><div class="s" id="zsMe"><div class="ink"></div><span><b>${esc(o.founder||'Director')}</b><br>Director${o.parent?', for '+esc(o.parent):''}</span><small>for ${esc(M.cfg.spvShort)}'s owners</small></div></div>
    </article><div class="zdk-acts"><button class="zdk-go" id="zsSign" disabled>Tick one reply first</button></div></div>
    <aside class="zdk-note arrive" id="zdkNote" aria-live="polite"></aside></main>`);
  wirePile(sh,pile);
  const doc=sh.querySelector('#zdkDoc'),note=sh.querySelector('#zdkNote'),go=sh.querySelector('#zsSign');moreCue(doc);
  const actOfC=c=>c.act||({own:'Sign: we put the money in',l5:'Sign: ask L5 Capital',refuse:'Sign the refusal'}[c.id])||'Sign the reply';
  const slip=()=>{const c=ch.find(x=>x.id===pick);
    note.innerHTML=`<h3>${esc(o.slipQuestion||'What each reply does')}</h3>${ch.map(x=>{const s=x.slip||{};return `<div class="z5-sl${x.id===pick?' on':''}"><b>${esc(x.label)}</b><span>${esc([s.big,s.money].filter(Boolean).join(' · '))}</span></div>`;}).join('')}${c&&c.slip&&c.slip.line?`<p>${esc(c.slip.line)}</p>`:''}`;};
  slip();
  sh.querySelectorAll('.zdk-ticks button').forEach(b=>b.onclick=()=>{if(done)return;pick=b.dataset.id;sh.querySelectorAll('.zdk-ticks button').forEach(x=>x.setAttribute('aria-checked',x===b?'true':'false'));
    go.disabled=false;go.textContent=actOfC(ch.find(x=>x.id===pick));slip();
    if(doc.scrollHeight>doc.clientHeight+4)doc.scrollTo({top:doc.scrollHeight,behavior:reduced()?'auto':'smooth'});});
  go.onclick=()=>{if(done||!pick)return;done=true;go.disabled=true;
    const me=sh.querySelector('#zsMe .ink'),sgs=sh.querySelector('.zdk-sigs');if(doc.scrollHeight>doc.clientHeight)doc.scrollTo({top:doc.scrollHeight,behavior:reduced()?'auto':'smooth'});
    me.innerHTML=o.signature?`<img src="${esc(o.signature)}" alt="Your signature">`:H(o.founder||M.cfg.spvShort);
    const word=(o.stamps||{})[pick]||STAMP[pick]||'Filed';sgs.insertAdjacentHTML('beforeend',stampHtml(word,'down',sd));if(!reduced())thud();
    const out={choice:pick,signedOn:isoDay(sd||now)};
    if(pick==='refuse'){setTimeout(()=>M.stepIn(Object.assign({founder:o.founder,company:o.parent,date:o.date},o.stepIn||{})).then(()=>res(out)),reduced()?600:1500);return;}
    const fin=()=>{close();res(out);};
    if(reduced()){setTimeout(fin,700);return;}
    setTimeout(()=>{const p=sh.querySelector('#zdkPile'),n=Math.min(5,p.children.length),cd=document.createElement('div');cd.className='zdk-card';cd.style.setProperty('--i',n);cd.style.setProperty('--r','-3deg');
      cd.innerHTML=`<span>${esc(o.title||'Letter from the banks')}</span><i></i><i></i><i class="s"></i>${stampHtml(word,'mini',sd)}`;doc.classList.add('leave');note.style.opacity='0';setTimeout(()=>p.appendChild(cd),380);},900);
    setTimeout(fin,2100);};
});};

/* ZMMoney.stepIn(o) → Promise. The banks take control (DESIGN.md §10, §18): the notice on duty paper, in plain words; the pile
   slides off the desk and the whole desk goes grey. No stamp. "Open the Black Box" resolves.
   o = {date, company, founder, stakePct?, docId?, lines?:[sentences] (replaces the default text), cta?} */
M.stepIn=function(o){mountS();o=o||{};return new Promise(res=>{
  const sd=dayOf(o.date),dt=sd?longDay(sd):longDay(new Date()),co=o.company||'Your company',ag=M.cfg.signatories.lenders||{};
  const lines=o.lines||[`To ${co}, and to ${o.founder||'its director'}, director of ${M.cfg.spvShort}.`,
    `${M.cfg.spvShort}'s owners have refused to put in the money the banks asked for. Under the Concession Agreement, the banks now take control of the airport.`,
    `From ${dt}, a manager chosen by the banks runs ${M.cfg.airportName}. ${co}'s ${o.stakePct!=null?pctTxt(o.stakePct)+' ':''}share is held for the banks until their loans are repaid or a new owner is found.`,
    `${o.founder||'The director'} is no longer a director of ${M.cfg.spvShort}. The airport keeps flying.`];
  const sh=desk5('z5-dec zs-step',`<header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header>
    <div class="zdk-pile" id="zdkPile" aria-hidden="true">${pileCards(o.pile||PILE)}</div>
    <main class="zdk-main"><div class="zdk-col"><article class="zdk-doc duty arrive" id="zdkDoc">
      <div class="zdk-duty"><div class="den"><b>${esc('The lenders to '+M.cfg.spvShort)}</b><span>Through their agent · Nariman Point, Mumbai</span></div><div class="dc"><span>Notice</span><span style="font-family:var(--fhi);letter-spacing:0;text-transform:none;font-weight:400;font-size:14px">सूचना</span></div><div class="ser"><b>${esc(o.docId||'N-'+(sd?sd.getFullYear():'')+'-01')}</b><span>${esc(dt)}</span></div></div>
      <div class="zdk-cah"><div><h2>The banks take control of ${esc(M.cfg.spvShort)}</h2><p class="hi">नियंत्रण की सूचना</p></div></div>
      ${lines.map(p=>`<p class="t">${esc(hd(p))}</p>`).join('')}
      <div class="zdk-sigs" style="grid-template-columns:minmax(0,300px)">${sigBlock(ag,'the lenders to '+M.cfg.spvShort)}</div>
    </article><div class="zdk-acts"><button class="zdk-go" id="zsBox">${esc(o.cta||'Open the Black Box')}</button></div></div></main>`);
  const desk=sh.querySelector('.zdk'),doc=sh.querySelector('#zdkDoc');doc.style.setProperty('--guil',guilTile());
  requestAnimationFrame(()=>desk.classList.add('zs-grey'));
  sh.querySelector('#zsBox').onclick=()=>{close();res();};
});};

/* ---------- the Black Box (§14.7, design/debrief.md) ----------
   ZMMoney.debrief(pages, opts?) → Promise. pages = VSIEra.debrief.pages(state):
   {p1:{returnPct, moneyInCr, moneyOutCr, valueCr, benchmarks:[{label, pct (a number, or [low, high]), source}], ended?, endedYear?, endedOn?},
    p2:{method:'leave-one-out'|'shapley', bars:[{decision, label, sharePct, sentence}], everythingElsePct, closing?},
    p3:{frontPages:[{year, chapter, lead, line?}], once?},
    p4:{lines:[{title, line, evidence}], thiel?:[{q, answer, mark}]}}
   opts: {company, founder, start (1–4: open at that page, skipping the casing)}. The casing opens on "open it"; each page pulls out
   of it; "Close the Black Box" resolves. --rec orange appears here and nowhere else. */
const BX_TITLES=['','The return','What made the return','What happened','How you work'];
function bxRuler(p){const bs=(p.benchmarks||[]).map(b=>({label:b.label,source:b.source,lo:Array.isArray(b.pct)?+b.pct[0]:+b.pct,hi:Array.isArray(b.pct)?+b.pct[1]:b.pctHi!=null?+b.pctHi:+b.pct})).filter(b=>isFinite(b.lo));
  const r=+p.returnPct,vals=bs.flatMap(b=>[b.lo,b.hi]).concat(isFinite(r)?[r]:[]);
  const mn=Math.min(0,Math.floor(Math.min(...vals)/5)*5),mx=Math.max(20,Math.ceil((Math.max(...vals)+1)/5)*5),sp=mx-mn,X=v=>(v-mn)/sp*100;
  const ticks=[];for(let k=0;k<=sp;k++)ticks.push(`<line x1="${k/sp*100}%" x2="${k/sp*100}%" y1="0" y2="${k%5===0?13:6}"/>`);
  const nums=[];for(let v=mn;v<=mx;v+=5)nums.push(`<span style="left:${X(v)}%">${v}%</span>`);
  let last=-99,lane=0;const f=v=>(+v).toFixed(v%1?2:0).replace(/\.?0+$/,'')+'%';
  const mk=bs.map((b,i)=>({b,i,c:X((b.lo+b.hi)/2)})).sort((a,c)=>a.c-c.c).map(({b,i,c})=>{lane=c-last<26?1-lane:0;last=c;
    return `<span class="mk${lane?' lo':''}${c>78?' r':c<12?' l':''}" style="left:${c}%">${esc(b.label)}, ${b.lo===b.hi?f(b.lo):f(b.lo)+'–'+f(b.hi)}<sup>${i+1}</sup></span>`;}).join('');
  const bands=bs.filter(b=>b.hi>b.lo).map(b=>`<i class="band" style="left:${X(b.lo)}%;width:${X(b.hi)-X(b.lo)}%"></i>`).join('');
  return {bs,html:`<div class="zbx-rd"><div class="strip"><div class="in">${bands}<svg class="g" aria-hidden="true">${ticks.join('')}</svg><div class="nums">${nums.join('')}</div>${mk}${isFinite(r)&&!p.lost?`<i class="cur" style="left:${X(r)}%"><b>you, ${f(r)}</b></i>`:''}</div></div></div>`};}
/* after layout: a benchmark label that the red cursor runs through is hung from the other side of its tick */
function bxClear(pg){const cur=pg.querySelector('.zbx-rd .cur');if(!cur)return;const run=()=>{const c=cur.getBoundingClientRect();
  pg.querySelectorAll('.zbx-rd .mk').forEach(m=>{const r=m.getBoundingClientRect();if(r.bottom<c.top||r.left>c.right+6||r.right<c.left-6)return;
    const tick=m.classList.contains('r')?r.right-10:m.classList.contains('l')?r.left+10:(r.left+r.right)/2;m.classList.remove('l','r');m.classList.add(c.left<tick?'l':'r');});};
  run();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(run);}
function bxPage(n,P,o){const yrs=M.cfg.years,co=o.company||'your company';
  const head=`<header class="zbx-ph"><span>Findings</span><b>${n} · ${esc(BX_TITLES[n])}</b><span class="r">${esc(M.cfg.airportName)}${o.company?' · '+esc(o.company):''}</span></header>`;
  if(n===1){const p=P.p1||{},banks=p.ended==='banks',r=+p.returnPct;const ru=bxRuler(Object.assign({},p,{lost:banks}));
    const how=banks?`The banks took control${p.endedYear?` in year ${esc(p.endedYear)}`:''}${p.endedOn?`, on ${esc(M.fmtDate(p.endedOn))}`:''}.`:`Handed back${p.endedOn?` on ${esc(M.fmtDate(p.endedOn))}`:''}, in year ${yrs}.`;
    return head+`${banks?`<p class="zbx-lost">The banks took control${p.endedYear?' in year '+esc(p.endedYear):''}. Your return: lost.</p>`:''}
      <div class="zbx-big">${banks?'Lost.':isFinite(r)?`<u>${esc(pctTxt(r))} a year</u>, for ${yrs} years.`:''}</div>${ru.html}
      <dl class="zbx-ln"><dt>What you put in, what came back</dt><dd>${p.moneyInCr!=null?`${fmt(+p.moneyInCr)} put in by ${esc(co)}`:''}${p.moneyOutCr!=null?`; ${fmt(+p.moneyOutCr)} came back${banks?'':` over ${yrs} years`}.`:''}</dd>
      ${p.valueCr!=null?`<dt>What your share was worth at the end</dt><dd>${fmt(+p.valueCr)}</dd>`:''}<dt>How it ended</dt><dd>${how}</dd></dl>
      ${ru.bs.length?`<ol class="zbx-src">${ru.bs.map(b=>`<li>${esc(b.source||'')}</li>`).join('')}</ol>`:''}`;}
  if(n===2){const p=P.p2||{};let bars=(p.bars||[]).slice().sort((a,b)=>Math.abs(b.sharePct)-Math.abs(a.sharePct));let ee=+p.everythingElsePct||0;
    const small=bars.filter(b=>Math.abs(b.sharePct)<3);ee+=small.reduce((s,b)=>s+(+b.sharePct||0),0);bars=bars.filter(b=>Math.abs(b.sharePct)>=3);ee+=bars.slice(5).reduce((s,b)=>s+(+b.sharePct||0),0);bars=bars.slice(0,5);
    const mx=Math.max(1,...bars.map(b=>Math.abs(b.sharePct)),Math.abs(ee));const tot=bars.reduce((s,b)=>s+Math.abs(b.sharePct),0)+Math.abs(ee);
    const top2=bars.slice(0,2).reduce((s,b)=>s+Math.abs(b.sharePct),0);
    const pc=v=>Math.round(Math.abs(v))+'%';
    const row=(b,k)=>{const neg=b.sharePct<0,w=Math.abs(b.sharePct)/mx*72;return `<tr><td class="lb">${esc(b.label)}</td><td><div class="bar"><i class="${k<2&&!neg?'ink':'pen'}${neg?' neg':''}" style="width:${w}%"></i><span style="left:calc(${w}% + 10px)">${neg?'cost you '+pc(b.sharePct):'+'+pc(b.sharePct)}</span></div></td></tr>${b.sentence?`<tr class="sn"><td></td><td>${esc(b.sentence)}</td></tr>`:'<tr class="sn"><td></td><td></td></tr>'}`;};
    const closing=p.closing||(top2>=tot*.5&&bars.length>=3?`Two decisions made most of your ${yrs} years. Most decisions barely mattered. That is how big returns work.`:'');
    return head+`<p class="zbx-m">${p.method==='leave-one-out'?`A quick estimate: each decision was undone on its own, and the ${yrs} years were run again.`:'Each decision was weighed against every other, in every order.'}</p>
      <table class="zbx-led">${bars.map(row).join('')}${Math.abs(ee)>=.5?`<tr class="ee"><td class="lb">Everything else</td><td><div class="bar"><i class="pen" style="width:${Math.abs(ee)/mx*72}%"></i><span style="left:calc(${Math.abs(ee)/mx*72}% + 10px)">${ee<0?'cost you ':'+'}${pc(ee)}</span></div></td></tr>`:''}</table>
      ${closing?`<p class="zbx-pl">${esc(closing)}</p>`:''}`;}
  if(n===3){const p=P.p3||{},fp=(p.frontPages||[]).slice(0,8),k=Math.max(1,fp.length);
    const pw=`min(196px, calc((100% + ${(k-1)*18}px) / ${k}))`,step=`calc(${pw} - 18px)`;   // papers overlap by 18px at most
    return head+`<div class="zbx-papers" style="--pw:${pw};--step:${step}">${fp.map((f,i)=>`<button class="zbx-pp" style="--i:${i};--r:${[-3,2,-1.5,3,-2.5,1.5,-1,2.5][i%8]}deg;--y:${[10,26,4,20,12,30,6,18][i%8]};--z:${i+1}" aria-label="${esc(f.year)}: ${esc(f.lead)}"><span class="ms">The Zero Mile Times</span><span class="dy"><span>Nagpur, ${esc(f.year)}</span><span>${f.chapter?'Chapter '+esc(f.chapter):''}</span></span><b>${esc(f.lead)}</b><span class="rl"></span></button>`).join('')}</div>
      <div class="zbx-cls" style="--step:${step}">${fp.map((f,i)=>`<p class="zbx-cl" style="--i:${i}">${esc(f.line||'')}<small>${esc(f.year)}${f.light?' · the banks '+esc(f.light):''}</small></p>`).join('')}</div>
      ${p.once?`<p class="zbx-once">${esc(p.once)}</p>`:''}`;}
  const p=P.p4||{},ls=(p.lines||[]).slice(0,7);
  // §20: no personality labels and no grades. The finding leads, its evidence in pencil under it; the engine's title is not shown.
  return head+(ls.length?`<ol class="zbx-hw">${ls.map(l=>`<li>${esc(l.line||l.title||'')}<small>${esc(l.evidence||'')}</small></li>`).join('')}</ol>`:`<p class="t" style="font-family:var(--ft);font-size:15px">The airport mostly ran on its defaults. Next time, try a decision that scares you.</p>`)
    +(p.thiel&&p.thiel.length?`<ul class="zbx-th">${p.thiel.map(t=>`<li><i class="${t.mark?'y':'n'}">${t.mark?'✓':'✗'}</i><span><b>${esc(t.q)}</b> ${esc(t.answer||'')}</span></li>`).join('')}</ul>`:'');}
M.debrief=function(P,opt){mountS();P=P||{};opt=opt||{};return new Promise(res=>{
  let n=Math.max(0,Math.min(4,+opt.start||0));
  const sh=desk5('zbx'+(n?'':' shut'),`<div class="zbx-case" id="zbxCase"><span class="slot"></span><span class="sten">Flight<br>recorder</span><span class="sten s">Do not open</span><button class="op" id="zbxOpen">open it</button></div>
    <section class="zbx-pg" id="zbxPg" aria-live="polite"></section>
    <div class="zbx-acts"><button class="zdk-go" id="zbxNext"></button><button class="zdk-q" id="zbxBack">Back</button></div>`);
  const desk=sh.querySelector('.zdk'),pg=sh.querySelector('#zbxPg'),nx=sh.querySelector('#zbxNext'),bk=sh.querySelector('#zbxBack'),op=sh.querySelector('#zbxOpen');
  const show=k=>{n=k;desk.classList.remove('shut');pg.innerHTML=bxPage(k,P,opt);pg.scrollTop=0;pg.classList.remove('pull');if(!reduced()){void pg.offsetWidth;pg.classList.add('pull');quiet();}
    nx.textContent=k<4?'Pull the next page':'Close the Black Box';bk.disabled=k<=1;op.hidden=true;window.__zmmBoxPage=k;
    if(k===1)bxClear(pg);
    pg.querySelectorAll('.zbx-pp').forEach(b=>b.onclick=()=>{const was=b.classList.contains('open');pg.querySelectorAll('.zbx-pp.open').forEach(x=>x.classList.remove('open'));if(!was)b.classList.add('open');});};
  op.onclick=()=>show(1);sh.querySelector('#zbxCase').onclick=e=>{if(desk.classList.contains('shut')&&e.target!==op)show(1);};
  nx.onclick=()=>{if(n<4)show(n+1);else{close();res();}};bk.onclick=()=>{if(n>1)show(n-1);};
  if(n)show(n);else setTimeout(()=>quietFocus(op),40);
});};

/* ---------- sample data for ?moneymock=strip|flaps|cliff|tie|minutes|letter|stepin|debrief[1-4] (the real figures come from VSIEra) ---------- */
const S0={
  strip:{chapter:{n:5,id:'cruise',name:'Cruise',act:2},years:[14,18],doc:{title:'Route agreement, Haversine Airways',stamp:'Signed'},stakePct:64,
    past:[{chapter:{n:1,name:'Clearance'},years:[0,0],doc:{title:'Concession Agreement',stamp:'Executed'},stakePct:64},{chapter:{n:2,name:'Pushback'},years:[1,4],doc:{title:'Construction register',stamp:'Licensed'},stakePct:64},
      {chapter:{n:3,name:'Takeoff'},years:[5,7],doc:{title:'Opening plan, Plateau Air',stamp:'Signed'},stakePct:64},{chapter:{n:4,name:'Climb'},years:[8,13],doc:{title:'Network agreement',stamp:'Signed'},stakePct:64}]},
  bridge:{fromYear:2033,toYear:2039,lines:['SUTRADHAR AIR’S AFTERNOON BANK FILLS: 12 CITIES IN ONE HOUR','DUBAI CUTS ITS TRANSFER CHARGES AGAIN; VSI HOLDS ITS OWN','VSI PASSES 50 MILLION PASSENGERS IN A YEAR',
    'LUCKNOW AND INDORE ASK FOR A SECOND DAILY BANK','AERA HOLDS AIRLINE CHARGES FOR FIVE MORE YEARS','A LONG-HAUL AIRLINE GOES LOOKING FOR AN INDIAN HUB']},
  cliff:{masthead:'The Zero Mile Times',dateLine:'Nagpur, Friday 22 November 2032',price:'₹10',date:'2032-11-22',
    lead:'AIRLINES ASK: WILL VSI BECOME INDIA’S CONNECTING HUB?',deck:'Three years after opening day, the airport is full in the mornings and quiet after lunch. Sutradhar Air says it can fill the afternoon, if VSI will build around it.',
    sub:{head:'Plateau Air stays, and wants more',body:'Plateau Air moved its Bengaluru connecting bank to VSI on opening day and kept it. Its chief told this paper the airport "opened like an airport that had been open for years".\n\nSutradhar Air, which flies to twelve smaller Indian cities, is talking to VSIAL about timing all twelve into one afternoon bank.'},
    columns:[{head:'The banks',body:'VSIAL made its first loan repayment in October, on time. The airport earned ₹121 for every ₹100 it owed.'},{head:'The Gulf',body:'Dubai and Doha cut their transfer charges again this month. Most Indians who change planes still do it there.'}],
    photo:{kind:'transfer',caption:'The transfer hall at VSI, empty at three in the afternoon. Drawn by our staff artist.'}},
  minutes:{docId:'BM-2059-04',title:'Board minutes, 2059',date:'2059-04-01',year:34,founder:'Asha Rao',parent:'Meridian Infra',
    intro:'The chair put three resolutions to the board. A ticked resolution is adopted; one left blank is rejected.',
    resolutions:[{id:'district',title:'Build Zero Mile District: offices, hotels and shops on VSI land',text:'₹9,600 cr over three phases from 2060. AERA counts 30% of its income against airline charges.',slip:{yes:'₹1,450 cr a year by year 50',no:'Nothing from the land',line:'Land is the one income that keeps growing after the runways are full.'}},
      {id:'phase2',title:'Commit to satellites G and H, opening in 2064, with the airlines’ letters signed now',text:'₹18,500 cr. Sutradhar Air, Plateau Air and Haversine Airways have signed for 41 new routes if the date is fixed today.',slip:{yes:'+41 routes the airlines can sell now',no:'Routes only once the satellites open',line:'A date the airlines can sell is worth more than a plan they can only hope for.'}},
      {id:'l5',title:'Buy L5 Capital’s stake, taking Meridian Infra to 80%',text:'L5 Capital sells 16% at today’s value of the airport: ₹11,900 cr.',slip:{yes:'₹11,900 cr now; you would get 80% of the handover value instead of 64%',no:'You would get 64% of the handover value, not 80%',line:'You pay today’s price for a share of the next 26 years.'}}]},
  letter:{docId:'LA/VSIAL/2046/09',title:'Letter from the banks, 2046',date:'2046-07-14',founder:'Asha Rao',parent:'Meridian Infra',
    subject:'Sutradhar Air has stopped flying, and VSIAL cannot pay us in full.',
    body:'Since Sutradhar Air stopped flying in May, VSIAL’s earnings have fallen by a third. In the year to 31 March 2047 it will earn about ₹96 for every ₹100 it owes us; our agreement asks for at least ₹110. Unless VSIAL’s owners put in ₹2,400 cr by 30 September 2046, the banks will take control of the airport.',
    circle:'₹96',circleNote:'the worst year since opening day',
    replies:[{id:'own',label:'Meridian Infra will put in ₹2,400 cr of its own money',terms:'Paid in by 30 September 2046.',slip:{big:'Your stake stays 64%',money:'your return falls from 14.6% to 13.5% a year',line:'You keep the airport. The money comes from Meridian Infra, not from the airport.'}},
      {id:'l5',label:'VSIAL will ask L5 Capital to put the money in',terms:'L5 Capital pays ₹2,400 cr for new shares.',slip:{big:'Your stake falls to 52%',money:'L5 Capital rises to 28%',line:'You keep running the airport, with less of it.'}},
      {id:'refuse',label:'VSIAL’s owners will not put in more money',terms:'The banks take control of the airport.',slip:{big:'The banks take control',money:'your concession ends',line:'The airport keeps flying. It is no longer yours.'}}],
    stepIn:{date:'2046-10-01',company:'Meridian Infra',founder:'Asha Rao',stakePct:64,docId:'N-2046-01'}},
  debrief:{p1:{returnPct:14.6,moneyInCr:13440,moneyOutCr:142800,valueCr:23600,ended:'handback',endedOn:'2086-03-31',
      benchmarks:[{label:'Bengaluru’s owners expect',pct:[12.2,17.5],source:'Fairfax India Holdings, annual report 2025: the discount rates in its valuation of Bangalore International Airport.'},
        {label:'AERA allows Delhi',pct:15.41,source:'AERA, consultation paper on Delhi airport’s fourth control period: the fair return on shareholders’ money.'},
        {label:'the banks charged',pct:10.15,source:'AERA, the same paper: the efficient cost of Delhi airport’s debt.'}]},
    p2:{method:'leave-one-out',everythingElsePct:31,bars:[{decision:'ch5',label:'Haversine Airways, three routes',sharePct:41,sentence:'Signing Haversine Airways for three routes made 41% of your return.'},
      {decision:'ch4',label:'Anchoring Sutradhar Air',sharePct:23,sentence:'Anchoring Sutradhar Air’s afternoon bank made 23%.'},{decision:'phase1',label:'Phase 1 built lean',sharePct:-9,sentence:'Building phase 1 lean cost you 9%.'},
      {decision:'london',label:'Holding London for Lucknow',sharePct:7,sentence:'Holding London for Lucknow made 7%.'},{decision:'shifts',label:'Your shifts',sharePct:5,sentence:'Your shifts made 5% more than an expert’s would have.'},{decision:'radar',label:'The bird radar',sharePct:2}]},
    p3:{frontPages:[{year:2027,chapter:2,lead:'FOUR YEARS TO BUILD AN AIRPORT THE SIZE OF ISTANBUL’S',line:'Because you paid to keep the earthworks dry'},{year:2030,chapter:3,lead:'VSI OPENS: A CITY’S FLIGHTS MOVE IN OVERNIGHT',line:'Because you phased the opening',light:'relaxed'},
      {year:2032,chapter:3,lead:'AIRLINES ASK: WILL VSI BECOME INDIA’S CONNECTING HUB?',line:'Because day one ran at 88% on time'},{year:2033,chapter:4,lead:'TWELVE CITIES, ONE AFTERNOON: VSI BIDS TO BE INDIA’S HUB',line:'Because you anchored Sutradhar Air',light:'relaxed'},
      {year:2039,chapter:5,lead:'DUBAI, DOHA OR NAGPUR? THE RACE FOR INDIA’S TRAVELLERS',line:'Because the feeder bank held',light:'watching closely'},{year:2046,chapter:6,lead:'SUTRADHAR AIR GROUNDED: 30 JETS PARKED AT VSI',line:'Because one airline carried 74% of your connections',light:'warning you'},
      {year:2059,chapter:7,lead:'THIRTY YEARS ON: MERIDIAN INFRA RUNS INDIA’S CONNECTING HUB',line:'Because you put your own money in',light:'relaxed'}],once:'Opening day happened once. You ran it at 88% on time.'},
    p4:{lines:[{title:'feeders',line:'You signed the feeders before you set prices.',evidence:'12 cities × 3 destinations; 6.2 lakh connections a year by 2045.'},
      {title:'later',line:'You paid now for flights that would come later.',evidence:'Held London twice at ₹10 cr; kept 11,400 passengers a year off Doha.'},
      {title:'crisis',line:'You put money in when the banks asked.',evidence:'Put in ₹2,400 cr in 2046; the crisis shift ran 81% on time.'}]}}};
M._s0Sample=S0;
function s0Mock(kind){mountS();
  const pileDocs=[{id:'ca',title:'Concession Agreement',date:'2026-04-01',kind:'agreement',summary:'Signed by AAI, the State through MADC, L5 Capital and your company.'},{id:'lic',title:'Aerodrome licence',date:'2030-11-01',stamp:'Licensed',summary:'DGCA licensed VSI on 1 November 2030.'},
    {id:'na',title:'Network agreement',date:'2033-06-01',kind:'route-agreement',summary:'Sutradhar Air anchors the afternoon bank: 12 cities, 40-minute connections.'},{id:'ra',title:'Route agreement, Haversine Airways',date:'2039-10-15',kind:'route-agreement',summary:'London, Singapore and Nairobi every evening.'}];
  M.setPile(pileDocs);
  const at=(n,doc,ys)=>Object.assign({},S0.strip,{chapter:{n,name:M.CHAPTERS[n-1],act:actOf(n)},years:ys,doc,past:S0.strip.past.concat(n>5?[{chapter:{n:5,name:'Cruise'},years:[14,18],doc:{title:'Route agreement, Haversine Airways',stamp:'Signed'},stakePct:64}]:[],
      n>6?[{chapter:{n:6,name:'Turbulence'},years:[19,33],doc:{title:'Letter from the banks',stamp:'Cured'},stakePct:64}]:[]).filter(p=>p.chapter.n<n)});
  const file={company:'Meridian Infra',founder:'Asha Rao',signedOn:'2026-04-01',year:7,act:1};
  return sampleSig(53).then(sig=>{file.signature=sig;
    if(kind==='strip'){M.setStrip(at(4,{title:'Network agreement',stamp:null},[8,13]));
      const sh=desk5('zfs-demo',`<header class="zdk-top"><div class="zdk-mark">${vsiLogo(30)}<span>${esc(M.cfg.airportName)}</span></div></header><div class="z5-stage"><div id="zfsNight" style="position:relative;width:760px;height:220px;background:#0b1013;border:1px solid #26313a;box-shadow:0 20px 40px rgba(0,0,0,.35)"></div></div>`);
      setTimeout(()=>{M.setStrip(S0.strip);const h=M.strip('#zfsNight','night');if(h){h.style.position='absolute';h.style.left='14px';h.style.top='12px';const e=h.querySelectorAll('.zfs-e')[1];if(e)e.classList.add('peek');}},300);
      return new Promise(()=>{});}
    if(kind==='flaps'){M.setStrip(at(4,{title:'Network agreement',stamp:'Signed'},[8,13]));const fp=Object.assign({},M._ch5Sample.front,{dateLine:'Nagpur, Monday 3 October 2039'});
      return M.flaps(Object.assign({},S0.bridge,{frontPage:fp}),{strip:at(5,{title:'Route agreement, Haversine Airways',stamp:null},[14,18])});}
    if(kind==='cliff'){M.setStrip(at(3,{title:'Opening plan, Plateau Air',stamp:'Signed'},[5,7]));return M.cliffhanger(S0.cliff,{act:2,file});}
    if(kind==='tie')return M.closeFile(file);
    if(kind==='minutes'){M.setStrip(at(7,{title:'Board minutes, 2059',stamp:null},[34,60]));return M.minutes(Object.assign({signature:sig},S0.minutes));}
    if(kind==='letter'){M.setStrip(at(6,{title:'Letter from the banks',stamp:null},[19,33]));return M.letter(Object.assign({signature:sig},S0.letter));}
    if(kind==='stepin'){M.setStrip(at(6,{title:'Letter from the banks',stamp:'Refused'},[19,33]));return M.stepIn(S0.letter.stepIn);}
    const m=/^debrief([1-4])?$/.exec(kind);if(m){M.setStrip(null);return M.debrief(S0.debrief,{company:'Meridian Infra',founder:'Asha Rao',start:m[1]?+m[1]:0});}
    return Promise.resolve();});}
M._s0Mock=s0Mock;

/* ---------- auto-mount, and a mock driver for screenshots: ?moneymock ---------- */
function boot(){M.mount();if(!/[?&]moneymock\b/.test(location.search))return;
  {const k=(location.search.match(/[?&]moneymock=(frontpage|decision|briefing|tags|pins|bill|card)\b/)||[])[1];if(k){ch5Mock(k).then(r=>{window.__zmmResult=r;});return;}}
  {const k=(location.search.match(/[?&]moneymock=(file0|file|tear)\b/)||[])[1];if(k){fileMock(k);}}
  {const k=(location.search.match(/[?&]moneymock=(strip|flaps|cliff|tie|minutes|letter|stepin|debrief[1-4]?)(?![\w-])/)||[])[1];if(k){s0Mock(k).then(r=>{window.__zmmResult=r===undefined?'done':r;});return;}}
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
      investments:[{id:'city',name:'Zero Mile District: offices, hotels and shops on VSI land',costCr:9600,opens:'year 19',land:{earnCr:1450,aeraCr:435},effect:'Offices, hotels and shops, built in three phases; rents climb for six years after it opens.'},
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
