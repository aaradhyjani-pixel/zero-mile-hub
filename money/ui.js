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
M.config=function(o){Object.assign(M.cfg,o||{});return M.cfg;};
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
.zdk-tab .h{font-size:22px}.zdk-tab .h.big{font-size:32px}
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
  const capex=opts.capexCr||56000;
  const coName=M.cfg.coinvestor.name.split(':')[0];
  const P=(opts.partners||[{name:'',pct:64,role:'Promoter. Builds, finances and runs the airport.'},
    {name:coName,pct:16,role:'Co-investor. Sells you its stake at board meetings, up to 80% in all.'},
    {name:'Airports Authority of India',pct:10,role:'State partner'},
    {name:'State of Maharashtra, through MADC',pct:10,role:'Gives the land on a nominal lease'}]).map(p=>Object.assign({},p));
  const pp=P[0].pct;
  const st={parent:opts.defaultName||'',founder:opts.founderName||'',bid:{type:'share',value:T.share.def},gearing:G.def,repayment:'sculpted',sig:null,quick:false};
  const bidTxt=b=>b.type==='share'?(+b.value).toFixed(b.value%1?1:0)+'%':'₹'+b.value;
  const bidLong=b=>b.type==='share'?bidTxt(b)+' of everything the airport earns':bidTxt(b)+' for every passenger';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now=new Date(),MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
  const dateLong=`${ord(now.getDate())} day of ${MON[now.getMonth()]} ${now.getFullYear()}`;
  const dateStamp=`${String(now.getDate()).padStart(2,'0')} ${MON[now.getMonth()].slice(0,3).toUpperCase()} ${now.getFullYear()}`;
  const dShort=d=>`${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
  const endDate=new Date(now.getFullYear()+M.cfg.years,now.getMonth(),now.getDate()-1);   // the concession runs to the day before the anniversary
  const today=dShort(now),ends=dShort(endDate);
  const H=s=>`<span class="h">${esc(s)}</span>`;               // a handwritten fill-in
  const pvClose=()=>opts.previewClose?opts.previewClose({gearing:st.gearing,repayment:st.repayment,bid:st.bid}):
    {debtCr:capex*st.gearing/100,equityCr:capex*(1-st.gearing/100),parentCr:capex*(1-st.gearing/100)*pp/100,minDscr:null,note:''};

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
  const stampHtml=(word,cls)=>`<div class="zdk-stamp ${cls||''}" aria-label="Stamped: ${esc(word)}"><b>${esc(word)}</b><small>${dateStamp} · ${esc(M.cfg.spvShort)}</small></div>`;
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

  /* a drafting ruler over a range input: graduations, pencilled benchmarks, a red cursor */
  function ruler(id,min,max,step,val,label,marks,fmtv){
    const span=max-min,ticks=[];const major=span/5;
    for(let k=0;k<=50;k++){const v=min+span*k/50,x=k*2;ticks.push(`<line x1="${x}%" x2="${x}%" y1="0" y2="${k%10===0?13:k%5===0?9:5}"/>`);}
    const nums=[0,1,2,3,4,5].map(k=>`<span style="left:${k*20}%">${fmtv(min+major*k)}</span>`).join('');
    let last=-99,lane=0;
    const mk=(marks||[]).slice().sort((a,b)=>a.val-b.val).map(m=>{const p=(m.val-min)/span*100;lane=p-last<24?1-lane:0;last=p;
      return `<span class="m${lane?' lo':''}${p>80?' r':''}" style="left:${p}%">${esc(m.name)} ${fmtv(m.val)}</span>`;}).join('');
    return `<div class="zdk-ruler${mk?'':' bare'}"><div class="mk" aria-hidden="true">${mk}</div><div class="strip"><div class="in"><svg class="g" aria-hidden="true">${ticks.join('')}</svg><div class="nums" aria-hidden="true">${nums}</div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${esc(label)}"></div></div></div>`;}

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
        <tr><td>Project cost</td><td>${fmt(capex)}</td></tr>
        <tr><td>Share borrowed</td><td><span class="h big" id="zdkGV"></span></td></tr>
        <tr><td colspan="2" class="rl">${ruler('zdkGR',G.min,G.max,1,st.gearing,'Share borrowed',[],v=>Math.round(v)+'%')}</td></tr>
        <tr><td>Bank loan</td><td><span class="h" id="zdkD"></span></td></tr>
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
      sh.querySelector('#zdkGV').textContent=st.gearing+'%';sh.querySelector('#zdkD').textContent=fmt(q.debtCr);sh.querySelector('#zdkE').textContent=fmt(q.equityCr);sh.querySelector('#zdkP').textContent=fmt(q.parentCr);
      const ds=sh.querySelector('#zdkDS');ds.hidden=q.minDscr==null;
      if(q.minDscr!=null){const v=q.minDscr,col=v<1?'var(--zr)':v<1.2?'var(--zw)':'var(--zg)';const mv=sh.querySelector('#zdkMV');mv.innerHTML=`₹${Math.round(v*100)} <small>for every ₹100 due</small>`;mv.style.color=col;
        const k=sh.querySelector('#zdkMK');k.style.left=Math.max(0,Math.min(100,(v-.8)*100))+'%';}
      sh.querySelector('#zdkCN').textContent=q.note||'';};
    r.oninput=upd;upd();
    sh.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{st.repayment=b.dataset.r;sh.querySelectorAll('[data-r]').forEach(x=>x.setAttribute('aria-checked',x===b));upd();});
    sh.querySelector('#zdkN').onclick=()=>stampAndFile('Sanctioned','Term sheet',docCA);
    sh.querySelector('#zdkB').onclick=()=>{sh.querySelector('#zdkPile').lastElementChild?.remove();docBid();};}

  /* 4 · the Concession Agreement, on duty paper */
  function docCA(){inkUp(3);
    const q=pvClose();
    const others=[{who:'Airports Authority of India',as:'the Authority',seed:11,ink:'#1d1f22'},{who:'State of Maharashtra, through MADC',as:'the State',seed:23,ink:'#1f3a8a'},{who:esc(M.cfg.coinvestor.name),as:'the Co-investor',seed:37,ink:'#23305e'}];
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
        <li>Phase 1 costs ${fmt(capex)}: ${H(fmt(q.debtCr))} from lenders, repaid ${st.repayment==='sculpted'?'in instalments sculpted to traffic':'in equal instalments'}, and ${H(fmt(q.equityCr))} from shareholders, of which the Promoter provides ${H(fmt(q.parentCr))}.</li>
        <li>The Concessionaire's shares are held ${P.map(p=>`${p.pct}% by ${k0(p)}`).join(', ').replace(/, ([^,]*)$/,' and $1')}.</li>
        <li>Charges to airlines and passengers are set by AERA, every five years.</li></ol>
      <p class="t">Signed by the parties on the date above.</p>
      <div class="zdk-sigs">
        ${others.map(o=>`<div class="s"><div class="ink">${scribble(o.seed,o.ink)}</div><span>For ${o.who}</span><small>Authorised signatory, ${o.as}</small></div>`).join('')}
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
    const result={parent:st.parent,founder:st.founder,bid:Object.assign({},st.bid),gearing:st.gearing,repayment:st.repayment,signature:st.sig,signedOn:iso(now),endsOn:iso(endDate)};if(st.quick)result.quick=true;
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
  l.href='https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Kalam:wght@400;700&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Tiro+Devanagari+Hindi&display=swap';document.head.appendChild(l);}

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

/* ---------- board meeting (between eras) ---------- */
/* opts: {era, years, parent, treasuryCr, cashCr, aera:{title,text,canAppeal,appealText}, dscr:{value,warn:1.2,covenant:1.1},
          investments:[{id,name,costCr,effect,why,payback,owned,disabled,reason}],
          dividend:{maxCr}, prepay:{maxCr}, debtCr}
   resolves {bought:[ids], appeal:bool, dividendCr, prepayCr} */
M.boardMeeting=function(o){o=o||{};return new Promise(res=>{
  const sel=new Set();let appeal=false,div=0,pre=0;
  const spend=()=>[...sel].reduce((s,id)=>s+((o.investments||[]).find(i=>i.id===id)||{}).costCr||0,0)+div+pre;
  const sh=open(`<div class="band"><span>Board meeting · era ${esc(o.era)} · ${esc(o.years||'')}</span><span>${esc(o.parent||'')} · ${esc(M.cfg.spvShort)}</span></div><div class="in">
   <h1>Board meeting</h1>
   <div class="zmm-grid">
    <div class="zmm-box"><div class="k">Cash available</div><div class="v" id="zmmCash">${fmt(o.cashCr)}</div><div class="s" id="zmmLeft"></div></div>
    <div class="zmm-box"><div class="k">Bank loan left</div><div class="v">${fmt(o.debtCr)}</div><div class="s">${o.dscr?`Last era the airport earned ₹${Math.round(o.dscr.value*100)} for every ₹100 it owed the banks`:''}</div></div>
    <div class="zmm-box"><div class="k">What the banks think</div><div class="v" style="font-size:17px;color:${!o.dscr?'inherit':o.dscr.value<(o.dscr.covenant||1.1)?'var(--stop)':o.dscr.value<(o.dscr.warn||1.2)?'var(--warn)':'var(--go)'}">${!o.dscr?'—':o.dscr.value<1?'Ready to take control':o.dscr.value<(o.dscr.covenant||1.1)?'You broke their condition':o.dscr.value<(o.dscr.warn||1.2)?'Watching you closely':'Relaxed'}</div><div class="s">They warn you below ₹${Math.round((o.dscr&&o.dscr.warn||1.2)*100)} and can take control below ₹100</div></div></div>
   ${o.aera?`<div class="zmm-order"><div class="h">${esc(o.aera.title||'AERA tariff order')}</div><div class="t">${esc(o.aera.text)}</div>${o.aera.canAppeal?`<div class="zmm-row"><label style="font-size:13px;color:var(--ink-2)"><input type="checkbox" id="zmmAp"> Appeal the order. ${esc(o.aera.appealText||'')}</label></div>`:''}</div>`:''}
   <h2>Invest</h2><div class="zmm-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">${(o.investments||[]).map(i=>`<button class="zmm-card ${i.owned?'own':''}" data-id="${esc(i.id)}" ${i.owned||i.disabled?'disabled':''} aria-pressed="false"><b>${esc(i.name)}</b><span class="c">${i.owned?'Owned':fmt(i.costCr)}</span><span class="e">${esc(i.effect)}</span><span class="w">${esc(i.disabled&&i.reason?i.reason:(i.why||'')+(i.payback?' Payback about '+i.payback+'.':''))}</span></button>`).join('')}</div>
   ${o.dividend||o.prepay?`<h2>Cash</h2><div class="zmm-grid" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
     ${o.dividend?`<div class="zmm-box"><div class="k">Dividend to shareholders</div><div class="v" id="zmmDv">${fmt(0)}</div><input type="range" class="zmm-range" id="zmmDR" min="0" max="${o.dividend.maxCr}" step="${Math.max(1,o.dividend.maxCr/100)}" value="0" aria-label="Dividend"><div class="s">${o.parentPct!=null?o.parentPct+'% goes to your company':'Your company gets its share'}. Lenders block dividends while the DSCR is below the covenant.</div></div>`:''}
     ${o.prepay?`<div class="zmm-box"><div class="k">Prepay debt</div><div class="v" id="zmmPv">${fmt(0)}</div><input type="range" class="zmm-range" id="zmmPR" min="0" max="${o.prepay.maxCr}" step="${Math.max(1,o.prepay.maxCr/100)}" value="0" aria-label="Prepay debt"><div class="s">Less interest from now on, and a safer DSCR.</div></div>`:''}</div>`:''}
   <div class="zmm-err" id="zmmBErr"></div>
   <div class="zmm-row"><button class="zmm-go" id="zmmBGo">Approve and play the next shift</button></div></div>`);
  const upd=()=>{const left=(o.cashCr||0)-spend();sh.querySelector('#zmmLeft').textContent='After these decisions: '+fmt(left);sh.querySelector('#zmmLeft').style.color=left<0?'var(--stop)':'';sh.querySelector('#zmmBGo').disabled=left<0;sh.querySelector('#zmmBErr').textContent=left<0?'That spends more cash than ZMIAL has. Drop something.':'';};
  sh.querySelectorAll('.zmm-card[data-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.id;if(sel.has(id))sel.delete(id);else sel.add(id);b.classList.toggle('on',sel.has(id));b.setAttribute('aria-pressed',sel.has(id));upd();});
  const dr=sh.querySelector('#zmmDR');if(dr)dr.oninput=()=>{div=+dr.value;sh.querySelector('#zmmDv').textContent=fmt(div);upd();};
  const pr=sh.querySelector('#zmmPR');if(pr)pr.oninput=()=>{pre=+pr.value;sh.querySelector('#zmmPv').textContent=fmt(pre);upd();};
  const ap=sh.querySelector('#zmmAp');if(ap)ap.onchange=()=>{appeal=ap.checked;};
  sh.querySelector('#zmmBGo').onclick=()=>{close();res({bought:[...sel],appeal,dividendCr:div,prepayCr:pre});};upd();});};

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
   ${o.compare&&o.compare.length?`<h2>${esc(o.compareLabel||'EBITDA margin compared')}</h2>${o.compare.map(c=>`<div class="zmm-cmp ${c.me?'me':''}"><span>${esc(c.name)}</span><div class="bar"><i style="width:${c.value/mx*100}%"></i></div><span class="mono">${c.value}%</span></div>`).join('')}`:''}
   ${o.moments&&o.moments.length?`<h2>The most expensive moments</h2><ul style="color:var(--ink-2);padding-left:18px">${o.moments.map(m=>`<li>${esc(m)}</li>`).join('')}</ul>`:''}
   <div class="zmm-row"><button class="zmm-go" id="zmmI1">${esc(o.cta||'Continue')}</button>${o.cta2?`<button class="zmm-ghost" id="zmmI2">${esc(o.cta2)}</button>`:''}</div></div>`);
  sh.querySelector('#zmmI1').onclick=()=>{close();res('cta');};const b2=sh.querySelector('#zmmI2');if(b2)b2.onclick=()=>{close();res('cta2');};});};

/* ---------- glossary terms the economy introduces (merge into hub.js GL) ---------- */
M.terms={
  aero:{t:'Aeronautical revenue',d:'Money from flying: landing fees by aircraft weight, parking fees per hour on a stand, and the user development fee each departing passenger pays. India\'s regulator AERA caps it.'},
  nonaero:{t:'Non-aeronautical revenue',d:'Money from everything else: shops, duty-free, food, car parks, the hotel, advertising, cargo. AERA does not cap it, which is why airports make their real profit here.'},
  mtow:{t:'MTOW',d:'Maximum take-off weight. Landing fees are charged per tonne of it, so an A380 (575 t) pays many times an A320 (79 t).'},
  udf:{t:'User development fee (UDF)',d:'A charge on every departing passenger\'s ticket that goes to the airport, set by AERA. New airports get higher UDFs because they still have to pay back the cost of building.'},
  aera:{t:'AERA',d:'The Airports Economic Regulatory Authority of India. Every five years it sets how much a major airport may charge airlines and passengers, from the airport\'s asset base, costs and a fair return.'},
  rab:{t:'Regulated asset base (RAB)',d:'What the regulator counts as invested in the airport. Charges are set so the airport earns a fair return on it. Build more and the RAB grows; it shrinks as assets depreciate.'},
  till:{t:'Hybrid till',d:'Under AERA\'s hybrid till, 30% of an airport\'s non-aeronautical revenue is used to lower what airlines and passengers pay. The other 70% the airport keeps.'},
  trueup:{t:'True-up',d:'If AERA lets an airport charge less than it was owed in one five-year period, the shortfall is carried into the next, with interest. Early squeezes can be recovered later.'},
  dscr:{t:'Loan cover',d:'How much the airport earns for every ₹100 of loan repayment due that year. At ₹100 it can only just pay. Below ₹120 the banks warn you. Below ₹110 you break their condition. Below ₹100 they can take control.'},
  stepin:{t:'Banks take control',d:'If the airport cannot pay its loans, the lenders can take control of the concession company and replace its management. In the game that ends your concession.'},
  sla:{t:'SLA',d:'Service level agreement: the promises the airport makes to its airlines, such as how long they wait for a stand. Breaking them costs penalties.'},
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
    onboarding:()=>M.onboarding({capexCr:56000,previewBid:b=>{const p=b.type==='share'?Math.min(98,Math.max(3,(b.value-18)*3.2)):Math.min(98,Math.max(3,(b.value-110)*0.35));return{winPct:p,note:p>66?'You probably win, but every rupee of revenue carries this share for 60 years.':p>33?'A coin toss against Kármán Line Ventures.':'Too low. A rival will outbid you.'};},previewClose:c=>({debtCr:56000*c.gearing/100,equityCr:56000*(1-c.gearing/100),parentCr:56000*(1-c.gearing/100)*0.64,minDscr:(c.repayment==='sculpted'?1.32:1.08)-(c.gearing-60)*0.012,note:c.repayment==='equal'?'Equal instalments are heavy in the first years. Expect a warning from the banks before Mumbai moves in.':'Repayments grow with the passengers. Money gets tight when Mumbai and Delhi move in and you have to build more.'}),
      bidTypes:{share:{min:10,max:50,step:0.5,def:30,benchmarks:[{name:'Navi Mumbai',val:12.6},{name:'Mumbai',val:38.7},{name:'Delhi',val:45.99}]},ppf:{min:100,max:450,step:5,def:250,benchmarks:[{name:'lowest Adani bid',val:115},{name:'highest recent bid',val:401}]}}}),
    board:()=>M.boardMeeting({era:3,years:'2041–46',parent:'Meridian Infra',parentPct:64,cashCr:3120,debtCr:31400,dscr:{value:1.16,warn:1.2,covenant:1.1},aera:{title:'The regulator\'s decision for 2041–46',text:'AERA lets you charge ₹1,040 per passenger on average. Last period you earned ₹1,820 cr less than it allowed, so you get that back over these five years.',canAppeal:true,appealText:'Win and your charges rise 6%. Lose and the airlines stay angry with you for the whole period.'},
      investments:[{id:'cdm',name:'A-CDM system',costCr:420,effect:'Departures leave the gate only when the runway can take them. Shorter taxi queues.',why:'Airport collaborative decision making.',payback:'4 years'},{id:'drill',name:'Faster changeover drills',costCr:60,effect:'Runway mode changes take 75 s instead of 120 s.',payback:'1 year'},{id:'radar',name:'Bird radar',costCr:180,effect:'Fewer bird events and no closure surprises.',payback:'3 years'},{id:'ret',name:'Extra rapid-exit taxiway',costCr:240,effect:'Arrivals clear 27R faster; arrival spacing shrinks a little.',payback:'3 years'},{id:'apm',name:'APM train upgrade',costCr:900,effect:'Transfers 15% faster, so more connections are made.',payback:'6 years'},{id:'retail',name:'Retail upgrade in the Mall',costCr:650,effect:'+12% spend per passenger.',payback:'3 years'},{id:'g',name:'Satellite G (phase 1B)',costCr:7800,effect:'+40 stands for when Mumbai moves in.',disabled:true,reason:'Not enough cash: needs a debt top-up from the lenders.'},{id:'sweep',name:'Second sweeper truck',costCr:12,effect:'FOD sweeps fit into smaller gaps.',owned:true}],
      dividend:{maxCr:800},prepay:{maxCr:2000}}),
    income:()=>M.incomeStatement({band:'Concession complete · year 60',title:'Handback',hero:'<em>Meridian Infra</em> ran Vikram Sarabhai International for 60 years. <em>₹1,42,800 cr</em> returned on <em>₹13,440 cr</em> invested.',
      sections:[{title:'Over 60 years',rows:[{label:'Fees from airlines and passengers',amount:612000,kind:'rev'},{label:'Shops, food, parking and property',amount:488000,kind:'rev'},{label:'Paid to AAI',amount:198000,kind:'cost'},{label:'Running costs',amount:301000,kind:'cost'},{label:'Operating profit',amount:601000,kind:'total'}]},{title:'For your company',rows:[{label:'Your return, per year',amount:'16.8%',kind:'good'},{label:'Bank loans repaid',amount:'Yes, in year 24',kind:'total'},{label:'Tightest year with the banks',amount:'₹112 per ₹100 due (year 11)',kind:'total'}]}],
      compare:[{name:'Bengaluru (BIAL)',value:72},{name:'Mumbai (MIAL)',value:40},{name:'Delhi (DIAL)',value:37},{name:'Your VSIAL',value:55,me:true}],moments:['Year 11: Mumbai moved in before Satellite G opened. 19 aircraft a day waited for stands, and the airlines charged you ₹410 cr in penalties.','Year 31: the pandemic year. Passengers fell 62% and the airport earned only ₹94 for every ₹100 it owed. You put in more of your own money, and the banks let you keep the airport.'],cta:'Start a new concession',cta2:'Back to the menu'})
  };
  if(/moneymock=onboarding/.test(location.search))window.__zmmDemo.onboarding();
  if(/moneymock=board/.test(location.search))window.__zmmDemo.board();
  if(/moneymock=income/.test(location.search))window.__zmmDemo.income();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
