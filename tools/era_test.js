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
function play(ob, shiftFor, boardFor) {
  let st = E.newCampaign(ob, 1);
  const cells = [], reports = [], texts = [];
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
    texts.push(bo.aera.title, bo.aera.text, bo.aera.appealText, ...bo.investments.map(i => i.name + ' ' + i.effect + ' ' + i.why));
    st = E.applyBoard(st, boardFor(e, bo));
  }
  while (cells.length < 12) cells.push(null);
  texts.push(JSON.stringify(E.handbackOpts(st)));
  const over = E.isOver(st), f = st.final || {};
  return {cells, reports, texts, st, outcome: over.reason === 'banks' ? 'banks ' + over.year : (f.debtRepaid ? 'debt repaid' : 'debt left'),
    irr: over.reason === 'banks' || f.irr == null ? null : f.irr * 100};
}
const profileShift = prof => (e, L) => ({level: L, stars: 3, ops: I.opsProfile(prof, I.eraYears(e)[1])});
const board = ({appeal = false, phase2 = false} = {}) => (e, bo) => ({
  appeal, dividendCr: bo.dividend.maxCr, prepayCr: 0,
  bought: bo.investments.filter(i => phase2 && i.id === 'phase2').map(i => i.id)});
const TERMS = {
  EXPERT: {bid: {type: 'share', value: 4}, gearing: 70, repayment: 'sculpted', cure: true},
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
const texts = [].concat(...Object.values(A).map(r => r.texts), ...Object.values(B).map(r => r.texts));
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
console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASS'));
process.exit(fails ? 1 : 0);
