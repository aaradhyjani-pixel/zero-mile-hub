#!/usr/bin/env node
/* tools/era_test.js: money/era.js against the Python model (tools/concession_model.py vsi).

   node tools/era_test.js            (exit code 1 on any failure)

   Part A, the port: EXPERT, BAD, LAZY and the expert at a Nagpur-level 14.49% bid are played through the
   public API (newCampaign → applyShift → boardOptions → applyBoard, 12 eras, the state JSON round-tripped
   between calls), each shift carrying the model's own ops profile for its level. The worst single year of
   loan cover per era and the equity return must match the Python tables:
     cover within TOL_A (0.02; the Python cells are floored to 2 decimals), return within 0.3 pp,
     same ending (debt repaid, or the banks take control in the same year).
   Part B, the shift mapping: EXPERT-like and BAD-like shift summaries (stars, on-time, connections, safety)
   go through VSIEra's own shift → era mapping instead of the hand-set profiles. Cover within TOL_B (0.10)
   of the Python EXPERT/BAD rows and the same ending.
   Part C: a plain-words scan of every string the engine hands the UI, determinism, and stable history. */
'use strict';
const path = require('path');
const {execFileSync} = require('child_process');
const ROOT = path.join(__dirname, '..');
const E = require(path.join(ROOT, 'money', 'era.js'));
E.data(require(path.join(ROOT, 'money.json')));
const I = E._internal;

const TOL_A = 0.02, TOL_A_IRR = 0.3, TOL_B = 0.10, TOL_B_IRR = 1.5;
let fails = 0;
const fail = m => { fails++; console.log('FAIL: ' + m); };

// ---- the Python tables ----
const py = execFileSync('python3', [path.join(ROOT, 'tools', 'concession_model.py'), 'vsi'], {encoding: 'utf8', maxBuffer: 1 << 24});
function pyRow(label) {
  const lines = py.split('\n'), from = lines.findIndex(l => l.startsWith('### Lender DSCR by era'));   // the era tables, not the levers table
  const line = lines.slice(from).find(l => l.startsWith('| ' + label + ' |'));
  if (!line) throw new Error('row not in python output: ' + label);
  const c = line.split('|').slice(1, -1).map(x => x.trim());
  const eras = c.slice(1, 13).map(x => x === '—' ? null : x === 'repaid' ? 'repaid' : parseFloat(x));
  const irr = /%$/.test(c[15]) ? parseFloat(c[15]) : null;
  const m = /step-in, year (\d+)/.exec(c[14]);
  return {eras, outcome: m ? 'banks ' + m[1] : c[14], irr};
}

// ---- playing a concession through the public API ----
const fl = v => Math.floor(v * 100 + 1e-9) / 100;
function play(ob, shiftFor, boardFor, conChoices) {
  let st = E.newCampaign(ob, 1);
  const cells = [], reports = [], texts = [];
  if (E.needsConstruction(st)) {
    const co = E.constructionOpts(st);
    texts.push(...co.years.map(y => y.line), ...co.works.map(w => w.name + ' ' + w.note), ...co.events.map(e => e.title + ' ' + e.text + ' ' + e.options.map(o => o.label + ' ' + o.effect).join(' ')), co.numbers.coverWords);
    st = E.applyConstruction(JSON.parse(JSON.stringify(st)), conChoices ? {choices: conChoices, finishedOn: '2030-01-01'} : null);
  }
  for (let k = 0; k < 12; k++) {
    st = JSON.parse(JSON.stringify(st));              // the save is plain JSON
    const e = st.era, L = E.levelFor(st);
    const r = E.applyShift(st, shiftFor(e, L));
    st = r.state;
    const rep = r.report;
    reports.push(rep);
    texts.push(rep.coverWords, ...rep.sentences, JSON.stringify(rep.incomeStatement));
    cells.push(rep.coverWorst == null ? 'repaid' : rep.coverWorstExact);
    if (E.isOver(st)) break;
    const bo = E.boardOptions(st);
    texts.push(bo.aera.title, bo.aera.text, bo.aera.appealText, bo.aera.acceptText, bo.dividend.reason || '', ...bo.investments.map(i => i.name + ' ' + i.effect + ' ' + i.why));
    st = E.applyBoard(st, boardFor(e, bo));
  }
  while (cells.length < 12) cells.push(null);
  texts.push(JSON.stringify(E.endOpts(st)), JSON.stringify(E.handbackOpts(st)));
  const over = E.isOver(st), f = st.final || {};
  return {cells, reports, texts, st, outcome: over.reason === 'banks' ? 'banks ' + over.year : (f.debtRepaid ? 'debt repaid' : 'debt left'),
    irr: over.reason === 'banks' || f.irr == null ? null : f.irr * 100};
}
const profileShift = prof => (e, L) => ({level: L, stars: 3, ops: I.opsProfile(prof, I.eraYears(e)[1])});
const board = ({appeal = false, phase2 = false, city = false} = {}) => (e, bo) => ({
  appeal, dividendCr: bo.dividend.maxCr, prepayCr: 0,
  bought: bo.investments.filter(i => (phase2 && i.id === 'phase2') || (city && i.id === 'airport_city')).map(i => i.id)});
const TERMS = {
  EXPERT: {bid: {type: 'share', value: 4}, gearing: 75, repayment: 'sculpted', cure: true},
  BAD: {bid: {type: 'share', value: 4}, gearing: 75, repayment: 'sculpted', state_loan: false, defer_state_loan: false, aera: 'hard', refi: false, cure: false},
  LAZY: {bid: {type: 'share', value: 4}, gearing: 70, repayment: 'sculpted', state_loan: false, defer_state_loan: false, refi: false, cure: false}};
const ob = (k, extra) => Object.assign({parent: 'Meridian Infra', founder: 'Asha Rao'}, TERMS[k], extra || {});

// ---- table printing ----
const cellTxt = c => c == null ? '—' : c === 'repaid' ? 'repaid' : fl(c).toFixed(2);
function compare(title, js, p, tol, tolIrr) {
  const rows = [], bad = [];
  for (let i = 0; i < 12; i++) {
    const a = js.cells[i], b = p.eras[i];
    let ok;
    if (b == null) ok = a == null;
    else if (b === 'repaid') ok = a === 'repaid';
    else ok = typeof a === 'number' && Math.abs(fl(a) - b) <= tol + 1e-9;
    rows.push(ok);
    if (!ok) bad.push('E' + (i + 1) + ' js ' + cellTxt(a) + ' vs py ' + (b == null ? '—' : b === 'repaid' ? 'repaid' : b.toFixed(2)));
  }
  const irrOk = (js.irr == null && p.irr == null) || (js.irr != null && p.irr != null && Math.abs(js.irr - p.irr) <= tolIrr);
  const outOk = js.outcome === p.outcome;
  console.log('| ' + title + ' (era.js) | ' + js.cells.map(cellTxt).join(' | ') + ' | ' + js.outcome + ' | ' + (js.irr == null ? 'equity lost' : js.irr.toFixed(1) + '%') + ' |');
  console.log('| ' + title + ' (python) | ' + p.eras.map(x => x == null ? '—' : x === 'repaid' ? 'repaid' : x.toFixed(2)).join(' | ') + ' | ' + p.outcome + ' | ' + (p.irr == null ? 'equity lost' : p.irr.toFixed(1) + '%') + ' |');
  if (bad.length) fail(title + ': cover off by more than ' + tol + ': ' + bad.join('; '));
  if (!irrOk) fail(title + ': return ' + (js.irr == null ? 'none' : js.irr.toFixed(2)) + ' vs ' + (p.irr == null ? 'none' : p.irr.toFixed(2)) + ' (tolerance ' + tolIrr + ' pp)');
  if (!outOk) fail(title + ': ending ' + js.outcome + ' vs ' + p.outcome);
}
const HEAD = '| Run | ' + Array.from({length: 12}, (_, i) => 'E' + (i + 1)).join(' | ') + ' | Ending | Equity return |\n|' + '---|'.repeat(15);

// ---- Part A ----
console.log('## Part A: the port (model ops profiles through the public API)\n');
console.log('Worst single year of loan cover per era (cash for debt ÷ debt due), floored to 2 decimals. Tolerance ' + TOL_A + ', return ' + TOL_A_IRR + ' pp.\n');
console.log(HEAD);
const t0 = Date.now();
const A = {
  EXPERT: play(ob('EXPERT'), profileShift('expert'), board({phase2: true})),
  BAD: play(ob('BAD'), profileShift('poor'), board({appeal: true})),
  LAZY: play(ob('LAZY'), profileShift('lazy'), board()),
  NAGPUR: play(ob('EXPERT', {bid: {type: 'share', value: 14.49}}), profileShift('expert'), board({phase2: true}))};
const msA = Date.now() - t0;
compare('EXPERT', A.EXPERT, pyRow('EXPERT'), TOL_A, TOL_A_IRR);
compare('BAD', A.BAD, pyRow('BAD'), TOL_A, TOL_A_IRR);
compare('LAZY', A.LAZY, pyRow('LAZY'), TOL_A, TOL_A_IRR);
compare('EXPERT at a 14.49% bid', A.NAGPUR, pyRow('EXPERT, Nagpur-level fee 14.49%'), TOL_A, TOL_A_IRR);
console.log('\n(' + msA + ' ms for four 12-era concessions, bank sizing included)\n');

// ---- Part A2: Airport City (ordered at the first board that offers it, after era 3) ----
console.log('## Part A2: Airport City, bought at the era-3 board\n');
console.log(HEAD);
const AC = {
  EXPERT: play(ob('EXPERT'), profileShift('expert'), board({phase2: true, city: true})),
  BAD: play(ob('BAD'), profileShift('poor'), board({appeal: true, city: true})),
  LAZY: play(ob('LAZY'), profileShift('lazy'), board({city: true}))};
compare('EXPERT, builds Airport City', AC.EXPERT, pyRow('EXPERT, builds Airport City'), TOL_A, TOL_A_IRR);
compare('BAD, builds Airport City', AC.BAD, pyRow('BAD, builds Airport City'), TOL_A, TOL_A_IRR);
compare('LAZY, builds Airport City', AC.LAZY, pyRow('LAZY, builds Airport City'), TOL_A, TOL_A_IRR);
const acHist = AC.EXPERT.st.history.find(h => h.board && h.board.bought.indexOf('airport_city') >= 0);
if (!acHist || acHist.era !== 3) fail('Airport City was not bought at the era-3 board (got ' + (acHist ? acHist.era : 'none') + ')');
const ac30 = E.acPlan(13);
console.log('\n- board line: "Your land earns ' + Math.round(ac30.earnCr).toLocaleString('en-IN') + ' cr a year; AERA counts ' + Math.round(0.3 * ac30.earnCr).toLocaleString('en-IN') + ' of it" (year ' + ac30.fullYear + ')');
const pyAc = /Your land earns ₹([\d,]+) cr a year/.exec(py);
if (pyAc && Math.abs(+pyAc[1].replace(/,/g, '') - ac30.earnCr) > 2) fail('Airport City income ' + Math.round(ac30.earnCr) + ' vs python ' + pyAc[1]);

// ---- Part A3: construction years, a 12-month slip (monsoon 4 + steel 8) against the model's delay row ----
console.log('\n## Part A3: construction slip, 12 months (python: "EXPERT, phase 1 opens 12 months late")\n');
function pyDelay(label) {
  const line = py.split('\n').find(l => l.startsWith('| ' + label + ' |'));
  const c = line.split('|').slice(1, -1).map(x => x.trim());
  return {eras: c.slice(1, 5).map(x => parseFloat(x)), cure: +c[5].replace(/,/g, ''), irr: parseFloat(c[7])};
}
const SL = play(ob('EXPERT'), profileShift('expert'), board({phase2: true}), {monsoon: 'slip', overrun: 'slip'});
const pd = pyDelay('EXPERT, phase 1 opens 12 months late');
const slEng = I.simulate(SL.st.s, 60);
const slCells = SL.cells.slice(0, 4).map(c => c === 'repaid' ? c : fl(c));
console.log('| Run | E1 | E2 | E3 | E4 | Shareholders top up ₹ cr | Return |\n|---|---|---|---|---|---|---|');
console.log('| 12 months late (era.js) | ' + slCells.map(c => c.toFixed(2)).join(' | ') + ' | ' + Math.round(slEng.cures).toLocaleString('en-IN') + ' | ' + SL.irr.toFixed(1) + '% |');
console.log('| 12 months late (python) | ' + pd.eras.map(c => c.toFixed(2)).join(' | ') + ' | ' + pd.cure.toLocaleString('en-IN') + ' | ' + pd.irr.toFixed(1) + '% |');
slCells.forEach((c, i) => { if (Math.abs(c - pd.eras[i]) > TOL_A + 1e-9) fail('slip E' + (i + 1) + ' ' + c + ' vs ' + pd.eras[i]); });
if (Math.abs(slEng.cures - pd.cure) > 25) fail('slip top-up ' + Math.round(slEng.cures) + ' vs ' + pd.cure);
if (Math.abs(SL.irr - pd.irr) > TOL_A_IRR) fail('slip return ' + SL.irr.toFixed(2) + ' vs ' + pd.irr);
if (SL.st.construction.slipMonths !== 12) fail('slip months ' + SL.st.construction.slipMonths);


// ---- Part B ----
console.log('## Part B: the shift mapping (shift summaries, not profiles)\n');
const EXPERT_SHIFTS = {1: {stars: 3, otp: 0.88, cx: 0.93, safety: 100}, 2: {stars: 3, otp: 0.94, cx: 0.95, safety: 100},
  3: {stars: 3, otp: 0.82, cx: 0.9, safety: 100}, 4: {stars: 3, otp: 0.85, cx: 0.92, safety: 100}};
const BAD_SHIFTS = {1: {stars: 2, otp: 0.84, cx: 0.88, safety: 95}, 2: {stars: 1, otp: 0.79, cx: 0.84, safety: 92},
  3: {stars: 1, otp: 0.76, cx: 0.82, safety: 90}, 4: {stars: 1, otp: 0.72, cx: 0.78, safety: 88}};
const summaryShift = tab => (e, L) => Object.assign({level: L, moves: 700, sched: 720}, tab[Math.min(4, e)]);
const B = {
  EXPERT: play(ob('EXPERT'), summaryShift(EXPERT_SHIFTS), board({phase2: true})),
  BAD: play(ob('BAD'), summaryShift(BAD_SHIFTS), board({appeal: true}))};
console.log('What the mapping makes of each shift, against the model\'s hand-set profile for that level:\n');
console.log('| Shift | Mall spend kept | Disruption ₹/pax | Service rebate | Growth bonus | Cost factor |\n|---|---|---|---|---|---|');
for (const [name, tab, prof] of [['EXPERT', EXPERT_SHIFTS, 'expert'], ['BAD', BAD_SHIFTS, 'poor']]) {
  for (const L of [1, 2, 3, 4]) {
    const y = I.eraYears(L)[1], m = I.shiftOps(tab[L], y), p = I.opsProfile(prof, y), f = (a, b, d) => a.toFixed(d) + ' (' + b.toFixed(d) + ')';
    console.log('| ' + name + ' L' + L + ' | ' + f(m.Q, p.Q, 2) + ' | ' + f(m.dis, p.dis, 0) + ' | ' + f(m.sq, p.sq, 4) + ' | ' + f(m.star, p.star, 3) + ' | ' + f(m.opex, p.opex, 2) + ' |');
  }
}
console.log('\nTolerance ' + TOL_B + ' on cover, ' + TOL_B_IRR + ' pp on return, same ending.\n');
console.log(HEAD);
compare('EXPERT-like shifts', B.EXPERT, pyRow('EXPERT'), TOL_B, TOL_B_IRR);
compare('BAD-like shifts', B.BAD, pyRow('BAD'), TOL_B, TOL_B_IRR);

// ---- Part C ----
console.log('\n## Part C: plain words, determinism, stable history\n');
const BANNED = /\b(DSCR|RAB|WACC|true-?ups?|EBITDA|IRR|SLA|UDF|covenants?|step-?in)\b/i;
const texts = [].concat(...Object.values(A).map(r => r.texts), ...Object.values(B).map(r => r.texts), ...Object.values(AC).map(r => r.texts), SL.texts);
['banks', 'dollar', 'infra'].forEach(l => texts.push(E.previewClose({gearing: 70, repayment: 'sculpted', bid: {type: 'share', value: 15}, lender: l, phase1: 'big', stateLoan: false}).note));
texts.push(JSON.stringify(E.lenders()), JSON.stringify(E.phase1Options()), JSON.stringify(E.stateLoanOpt()));
texts.push(E.previewBid({type: 'share', value: 15}).note, E.previewBid({type: 'ppf', value: 180}).note,
  E.previewClose({gearing: 75, repayment: 'equal', bid: {type: 'share', value: 15}}).note,
  E.previewClose({gearing: 70, repayment: 'sculpted', bid: {type: 'share', value: 15}}).note);
const hits = texts.filter(t => BANNED.test(t || ''));
if (hits.length) fail('jargon on screen: ' + hits.slice(0, 3).map(t => (t.match(BANNED) || [])[0] + ' in "' + t.slice(0, 120) + '"').join(' | '));
console.log('- plain-words scan: ' + texts.length + ' strings, ' + hits.length + ' with jargon');
const again = play(ob('EXPERT'), profileShift('expert'), board({phase2: true}));
const same = JSON.stringify(again.st) === JSON.stringify(A.EXPERT.st);
if (!same) fail('two identical runs gave different saves');
console.log('- determinism: identical saves on a second run: ' + (same ? 'yes' : 'NO'));
// history: the cover reported at the end of each era must equal what the final 60-year re-run says about that era
const eng = I.simulate(A.EXPERT.st.s, 60);
const drift = A.EXPERT.reports.filter(r => r.coverWorstExact != null && Math.abs(eng.era_mins[r.era] - r.coverWorstExact) > 1e-9).map(r => 'E' + r.era);
if (drift.length) fail('history changed after later decisions: ' + drift.join(', '));
console.log('- stable history: era reports match the final re-run: ' + (drift.length ? 'NO (' + drift.join(', ') + ')' : 'yes'));
const warn = A.EXPERT.reports.filter(r => r.light !== 'green');
console.log('- expert warnings: ' + (warn.map(r => r.eraLabel + ' (' + r.coverWords + ')').join('; ') || 'none'));
warn.forEach(r => r.sentences.filter(s => /banks warn/.test(s)).forEach(s => console.log('    "' + s + '"')));
const bt = A.BAD.reports.find(r => r.banksTookControl);
console.log('- bad ending: ' + (bt ? bt.eraLabel + ': "' + bt.sentences.filter(s => /take control/.test(s)).join(' ') + '"' : 'none'));

// ---- Chapter 5: Take on the Gulf (VSIEra.ch5) ----
console.log('\n## Chapter 5: hub-smart vs hub-blind from the year-14 fixture\n');
const C5 = E.ch5, rt = o => JSON.parse(JSON.stringify(o));
const fx = rt(C5.fixture());
if (fx.era !== 4 || fx.year !== 14) fail('ch5 fixture at era ' + fx.era + ', year ' + fx.year + ' (want era 4, year 14)');
['concession', 'phase1', 'budget-2034', 'feeders-2033'].forEach(id => { if (!(fx.docs || []).some(d => d.id === id)) fail('ch5 fixture missing doc ' + id); });
const fp = C5.frontPage(fx), dc = C5.decision(fx);
if (fp.lead !== 'DUBAI, DOHA OR NAGPUR? THE RACE FOR INDIA\'S TRAVELLERS' || fp.masthead !== 'The Zero Mile Times') fail('ch5 front page masthead or lead');
if (dc.choices.map(c => c.id).join() !== 'three,london,decline') fail('ch5 decision choices ' + dc.choices.map(c => c.id).join());
// a shift as hub.js would report it: each international departure misses a few, plus London's 380 if let go
function c5shift(plan, held, slack) {
  const byDest = {};
  plan.intl.forEach(x => { let miss = Math.round(x.connecting * slack); if (plan.hub && x.dest === plan.hub.dest && !held) miss += plan.hub.pax; byDest[x.dest] = {made: x.connecting - miss, missed: miss}; });
  const dom = 900, domMiss = Math.round(dom * slack);
  const made = Object.values(byDest).reduce((a, b) => a + b.made, 0) + dom - domMiss, missed = Object.values(byDest).reduce((a, b) => a + b.missed, 0) + domMiss;
  return {made, missed, byDest, domestic: {made: dom - domMiss, missed: domMiss}, held: plan.hub ? {[plan.hub.dest]: !!held} : {}, holdMin: held ? 20 : 0,
    trail: {happened: !!plan.trail, minutesLost: plan.trail ? 12 : 0}, money: {lines: []}, stars: 3, otp: 0.86};
}
const PLAYERS = [
  ['hub-smart', 'three', true, 0.03, 'signs three banks, holds London for the 380'],
  ['hub-letgo', 'three', false, 0.03, 'signs three banks, lets London go'],
  ['hub-blind', 'decline', false, 0.03, 'declines Skyward']];
const c5 = {}, c5texts = [JSON.stringify(fp), JSON.stringify(dc)];
console.log('| Player | Plan | Earned ₹ cr a year | Spent ₹ cr a year | Connections made / missed a year | Earned / spent 2040-43 | Loan cover, hardest year | Your stake |\n|---|---|---|---|---|---|---|---|');
for (const [name, choice, held, slack, what] of PLAYERS) {
  let st = rt(C5.applyDecision(fx, choice));
  const br = C5.briefing(st), plan = C5.shiftPlan(rt(st));
  if (br.lines.length !== 3 || br.lines.some(l => !(st.docs || []).some(d => d.id === l.docId))) fail('ch5 briefing for ' + name + ': 3 lines, each linked to a doc');
  if (plan.intl.length !== {three: 3, london: 1, decline: 0}[choice]) fail('ch5 plan for ' + choice + ' has ' + plan.intl.length + ' departures');
  plan.tags.forEach(t => { if (!(st.docs || []).some(d => d.id === t.docId)) fail('ch5 tag without a doc: ' + t.docId); });
  const r = C5.applyShift(st, c5shift(plan, held, slack));
  rt(r.state);
  const b = r.bill, row = l => b.table.find(t => t.label === l) || {cr: 0, made: 0, missed: 0}, tb = [row('Earned'), row('Spent'), row('Connections to Skyward')];
  c5[name] = b;
  c5texts.push(JSON.stringify(br), JSON.stringify(plan), JSON.stringify(b), JSON.stringify(r.card));
  console.log('| ' + name + ' | ' + what + ' | ' + tb[0].cr + ' | ' + tb[1].cr + ' | ' + tb[2].made.toLocaleString('en-IN') + ' / ' + tb[2].missed.toLocaleString('en-IN') + ' | ' +
    b.era.earnedCr + ' / ' + b.era.spentCr + ' | ' + b.cover.words + ' | ' + b.stake.pct + '%, ₹' + b.stake.valueCr.toLocaleString('en-IN') + ' cr (Skyward: ' + (b.stake.deltaCr >= 0 ? '+' : '') + b.stake.deltaCr.toLocaleString('en-IN') + ') |');
  console.log('|  | lead: "' + b.lead + '" | | | | | | |');
  console.log('|  | margin: "' + b.margin + '" | | | | | | |');
  if (!b.margin) fail('ch5 bill for ' + name + ' has no margin note');
  if (!r.card.sources || r.card.sources.length < 1) fail('ch5 card without sources');
}
const net = n => c5[n].era.earnedCr - c5[n].era.spentCr;
if (!(c5['hub-smart'].stake.valueCr > c5['hub-blind'].stake.valueCr && net('hub-smart') > net('hub-blind') + 500)) fail('ch5: the hub-smart player does not clearly beat the hub-blind one');
if (!/held London/.test(c5['hub-smart'].margin)) fail('ch5: the margin note does not read the London call');
if (!(c5['hub-smart'].stake.valueCr - c5['hub-letgo'].stake.valueCr > 1000)) fail('ch5: holding London is not clearly worth more than letting it go');
if (/Frankfurt/.test(c5['hub-letgo'].margin)) fail('ch5: the let-go margin still promises a new flight');
if (!c5['hub-blind'].table.some(t => t.label === 'Domestic connections' && t.made > 0)) fail('ch5: the decline bill does not report the domestic connections');
const nDep = ['three', 'london', 'decline'].map(id => C5.shiftPlan(C5.applyDecision(fx, id)).intl.length).join();
if (nDep !== '3,1,0') fail('ch5: the three options should give 3, 1 and 0 departures, got ' + nDep);
if ([1, 2, 3, 4, 5, 6, 7].some(n => { const c = C5.card(n); return !c || !c.text || !c.sources.length || !c.sources.every(x => x.url); })) fail('ch5: a chapter card without text or a source');
console.log('\n- hub-smart over hub-blind: ₹' + (net('hub-smart') - net('hub-blind')).toLocaleString('en-IN') + ' cr more from connections over 2040-43, stake ₹' + (c5['hub-smart'].stake.valueCr - c5['hub-blind'].stake.valueCr).toLocaleString('en-IN') + ' cr higher');
const big = C5.shiftPlan(C5.applyDecision(rt(C5.fixture({phase1: 'big', radar: 'skipped'})), 'three'));
const rad = C5.shiftPlan(C5.applyDecision(rt(C5.fixture({phase1: 'big', radar: 'bought'})), 'three'));
if (!big.trail || big.trail.id !== 'birds') fail('ch5: big phase 1 with the radar skipped should give the bird trail');
if (rad.trail !== null) fail('ch5: big phase 1 with the radar bought should have no trail incident');
console.log('- paper trail: lean → ' + C5.shiftPlan(C5.applyDecision(fx, 'three')).trail.id + ', big + radar skipped → ' + big.trail.id + ', big + radar bought → none');
const c5hits = c5texts.filter(t => BANNED.test(t));
if (c5hits.length) fail('ch5 jargon: ' + c5hits.map(t => (t.match(BANNED) || [])[0]).join(', '));
if (JSON.stringify(C5.fixture()) !== JSON.stringify(fx)) fail('ch5 fixture is not deterministic');
console.log('- plain words: ' + c5texts.length + ' Chapter 5 payloads, ' + c5hits.length + ' with jargon; fixture deterministic');
console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASS'));
process.exit(fails ? 1 : 0);
