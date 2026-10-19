/* money/era.js: the era engine for the Concession mode of Vikram Sarabhai International (VSI).
   window.VSIEra in the browser, module.exports in node. Pure functions: no DOM, no Math.random, no game state.
   A port of tools/concession_model.py (the BIAL-calibrated model) in annual steps:
     AERA building block on VSI's own asset base (incl. interest during construction), hybrid till (30% of non-aero),
     a yield smoothed over each 5-year control period, the true-up carried at the period's allowed return,
     the 13.9% hold-back in the period in which the 1C/1D terminals open (AERA did this in BIAL's CP3),
     BIAL-style debt per stage (interest during construction, moratorium, sculpted repayment sized by the banks
     on their own base case at 1.30, two quarters of debt service in reserve), the 0% state loan, refinancing after
     3 stable years, the parent's top-up (cure), and the banks taking control after two eras below 1.0 in the
     worst single year.
   The shift drives the era: what the sample day reports (stars, on-time, connections, safety, penalties) sets the
   era's traffic growth, Mall spend, disruption cost and service rebate, as the model's ops profiles do.
   State is plain JSON (inputs + decisions); each call re-runs the years from close, so history is deterministic.
   Every string a player sees is in plain words: no finance jargon (see money/CONTRACT.md). */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------------------------
  // Data: money.json (window.MONEY_DATA or VSIEra.data(md)); fallbacks are the model's resolved values.
  // ---------------------------------------------------------------------------------------------
  var MD = null;
  function J(path, fb) {
    var n = MD;
    var ps = path.split('.');
    for (var i = 0; i < ps.length; i++) {
      if (!n || typeof n !== 'object' || !(ps[i] in n)) return fb;
      n = n[ps[i]];
    }
    return (n && typeof n === 'object' && 'value' in n) ? n.value : n;
  }
  // Fitted at run time by tools/concession_model.py calibrate() on BIAL's FY2009-26 path (python3 tools/concession_model.py vsi).
  var CAL = {opex_fixed_per_mppa: 9.444550191956685, opex_per_pax: 134.21063291652203, open_k_greenfield: 1.6656841982117774,
    open_k_expansion: 1.6656841982117774, dep_life: 29.3, tax_share: 0.040170560075339416, aero_opex_share: 0.6569614218431498};
  var DEF = {"cpi_forward": 0.04, "tax_rate": 0.2517, "loss_carry_years": 8, "demand_elasticity": 0.8, "avg_fare": 5200, "yield_market_norm": 606, "airline_relations_drag": -0.01, "push_hard_disallowance": 0.1352, "tariff_shock_carry": 0.139, "soft_push_carry": 0.25, "aera_order_lag": 0.458, "renewal_share": {"start": 0.25, "full": 1.0}, "state_loan_terms": {"share_of_built_cost": 0.1417, "cost": 0.0, "instalments": 20, "first_year_after_close": 11, "deferral_years": 10, "defer_from_year": 9}, "notional_debt_share_wacc": 0.48, "coe": 15.05, "dsra_quarters": 2, "lbc_dscr_target": 1.3, "lbc_moratorium_cover": 1.2, "refi": {"rate": 8.15, "moratorium": 2, "tenor": 15, "stable_years": 3, "stable_dscr": 1.2}, "opening_cost": {"greenfield_year2_share": 0.5}, "ops_profiles": {"base": {"Q": [0.95, 0.95, 0.95, 0.95, 0.95], "dis": [60, 60, 60, 60, 60], "sq": [0.01, 0.01, 0.01, 0.01, 0.01], "star": [0.0, 0.0, 0.0, 0.0, 0.0], "opex": [1.0, 1.0, 1.0, 1.0, 1.0]}, "expert": {"Q": [0.95, 0.95, 0.95, 0.95, 0.95], "dis": [60, 60, 60, 60, 60], "sq": [-0.0125, -0.0125, -0.0125, -0.0125, -0.0125], "star": [0.015, 0.015, 0.015, 0.015, 0.015], "opex": [1.0, 1.0, 1.0, 1.0, 1.0]}, "poor": {"Q": [0.92, 0.86, 0.85, 0.8, 0.78], "dis": [70, 115, 120, 150, 160], "sq": [0.01, 0.02, 0.03, 0.04, 0.04], "star": [0.0, -0.005, -0.01, -0.01, -0.01], "opex": [1.0, 1.02, 1.04, 1.06, 1.06]}, "lazy": {"Q": [0.85, 0.82, 0.8, 0.78, 0.78], "dis": [150, 150, 160, 180, 180], "sq": [0.03, 0.04, 0.05, 0.05, 0.05], "star": [-0.01, -0.03, -0.03, -0.03, -0.03], "opex": [1.04, 1.05, 1.05, 1.06, 1.06]}}, "vsi_ppm": {"1": 160.6, "2": 165.7, "3": 175.9, "4": 178.4}, "vsi_move_years": {"1": 5, "2": 8, "3": 11, "4": 14}, "capacity_headroom": 1.1, "nar_convergence": 0.3, "vsi_stages": {"1A_lean": {"cost": 60000, "spend": {"1": 0.1, "2": 0.2, "3": 0.3, "4": 0.4}, "cod": 5, "cap": 45}, "1A_big": {"cost": 85000, "spend": {"1": 0.1, "2": 0.2, "3": 0.3, "4": 0.4}, "cod": 5, "cap": 70}, "1B_lean": {"cost": 32000, "spend": {"6": 0.4, "7": 0.6}, "cod": 8, "cap": 95}, "1B_big": {"cost": 16000, "spend": {"6": 0.4, "7": 0.6}, "cod": 8, "cap": 95}, "1C": {"cost": 38000, "spend": {"9": 0.4, "10": 0.6}, "cod": 11, "cap": 150}, "1D": {"cost": 38000, "spend": {"11": 0.2, "12": 0.3, "13": 0.5}, "cod": 14, "cap": 209}, "P2": {"cost": 32000, "spend": {"15": 0.4, "16": 0.6}, "cod": 17, "cap": 260}}, "vsi_loan_terms": {"1A": {"mor": 2, "years": 14, "rate": 9.5}, "1B": {"mor": 1, "years": 15, "rate": 9.5}, "T2": {"debt_share": 0.8, "rep_start": 15, "years": 10, "rate": 9.5}, "P2": {"debt_share": 0.8, "mor": 1, "years": 10, "rate": 9.5}}, "idc_constr_rate": 10.5, "aero_asset_share": 0.8766, "cash_yield": 5.5};
  var P = null;   // resolved parameters

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load(md) {
    MD = md || MD || (typeof window !== 'undefined' && window.MONEY_DATA) || null;
    P = clone(DEF);
    var mv = {cpi_forward: 'game.cpi', tax_rate: 'finance.tax_rate', loss_carry_years: 'finance.loss_carry_years',
      demand_elasticity: 'game.demand_elasticity', avg_fare: 'game.avg_fare', airline_relations_drag: 'game.airline_relations_drag',
      soft_push_carry: 'game.soft_push_carry', renewal_share: 'game.renewal_share', lbc_dscr_target: 'game.lbc_dscr_target',
      lbc_moratorium_cover: 'game.lbc_interest_only_cover', ops_profiles: 'game.ops_profiles', vsi_ppm: 'game.pax_per_movement_by_level',
      vsi_move_years: 'game.move_in_years', capacity_headroom: 'game.capacity_headroom', nar_convergence: 'game.nar_convergence',
      vsi_stages: 'capex.stages'};
    Object.keys(mv).forEach(function (k) { var v = J(mv[k]); if (v !== undefined && v !== null) P[k] = clone(v); });
    var oc = J('bial.opening_cost_fit'); if (oc && oc.greenfield_year2_share != null) P.opening_cost.greenfield_year2_share = oc.greenfield_year2_share;
    var rate = J('finance.loan_rate_base', 9.5);
    var slt = J('finance.stage_loan_terms');
    if (slt) { P.vsi_loan_terms = {}; Object.keys(slt).forEach(function (n) { P.vsi_loan_terms[n] = Object.assign(clone(slt[n]), {rate: rate}); }); }
    else Object.keys(P.vsi_loan_terms).forEach(function (n) { P.vsi_loan_terms[n].rate = rate; });
    var dfy = J('game.state_loan_defer_from_year'); if (dfy != null) P.state_loan_terms.defer_from_year = dfy;
    var rt = J('game.refi_trigger'); if (rt) Object.assign(P.refi, rt);
    var lag = J('bial.aera.order_lag_months');
    if (lag) { var s = 0, n = 0; Object.keys(lag).forEach(function (k) { s += lag[k]; n++; }); P.aera_order_lag = Math.round(s / n / 12 * 1000) / 1000; }
    var ay = J('bial.path.aero_yield_per_pax'); if (Array.isArray(ay)) P.yield_market_norm = ay[ay.length - 1];
    var ic = J('finance.loan_rate_construction'); if (ic != null) P.idc_constr_rate = ic;
    var w = J('bial.aera.cp4_wacc'); if (w) { if (w.debt_share != null) P.notional_debt_share_wacc = w.debt_share; if (w.coe != null) P.coe = w.coe; }
    var ds = J('bial.debt.dsra'); if (typeof ds === 'number') P.dsra_quarters = ds;
    var t2 = J('bial.t2.t2p1_capitalised'); if (t2 && t2.aero_share) P.aero_asset_share = t2.aero_share;
    var rr = J('world.rbi_repo'); if (rr && rr.jun2025) P.cash_yield = rr.jun2025;
    var sc = J('bial.t2.zmi_1b_template'); if (sc && sc.planned_shortfall_share_of_pv_arr != null) P.tariff_shock_carry = sc.planned_shortfall_share_of_pv_arr;
    P.dd = J('game.design_day_movements_by_level', {1: 837, 2: 1744, 3: 2780, 4: 4194});
    P.growth = J('world.game_traffic_growth', {cagr_by_era: [0.07, 0.065, 0.06, 0.055, 0.05, 0.045, 0.04, 0.035, 0.03, 0.0275, 0.025, 0.025], intl_share_start: 0.19, intl_share_step_per_era: 0.02, intl_share_cap: 0.35});
    P.p2a = J('game.peak_day_to_annual', 311);
    P.gcap = J('world.game_capacity', {full_mppa: 209, phase2_mppa: 260, phase2_cost_cr: 32000, ramp: [0.55, 0.85, 1.0]});
    P.till = J('till.hybrid_till_nar_share', 0.3);
    P.nar0 = J('nonaero.zmi_per_pax_start', 250); P.nar1 = J('nonaero.zmi_per_pax_mature', 450);
    P.fee_base = J('bial.ca.concession_fee', 0.04);
    P.cov_min = J('finance.dscr_covenant_min', 1.1); P.dscr_default = J('finance.dscr_default', 1.0);
    P.thr = J('game.dscr_thresholds', {warning: 1.2, covenant: 1.1, step_in: 1.0, step_in_eras: 2});
    P.lockup = J('finance.distribution_lockup', {nil_below: 1.2, half_below: 1.4, three_quarters_below: 1.55});
    P.rate = rate;
    P.sp = J('world.game_stake_pricing') || {};
    P.ev_multiple = P.sp.base_multiple || 12;
    P.star_bonus = J('game.star_growth_bonus', {0: -0.03, 1: -0.01, 2: 0.005, 3: 0.015});
    P.rev_share = J('ppp.rev_share_bid_range', {low: 0.126, high: 0.4599});
    P.ppf = J('ppp.ppf_bid_range', {low: 115, high: 400.97});
    P.ppf_aai = J('ppp.ppf_aai_2019', {AMD: 177});
    P.ppf_noida = J('ppp.ppf_noida', 400.97);
    // Airport City (money.json airport_city; tools/concession_model.py vsi_build): plots on 5% of the site, paid with equity
    P.ac = {phases: J('airport_city.phases', [{name: 'AC1', build: [14, 15], opens: 16, acres: 292}, {name: 'AC2', build: [19, 20], opens: 21, acres: 292}, {name: 'AC3', build: [24, 25], opens: 26, acres: 293}]),
      infra: J('airport_city.infra_cost_cr_per_acre', 4.0), lic: J('airport_city.licence_cr_per_acre_year', 3.0), ramp: J('airport_city.ramp_years', 5),
      opex_share: J('airport_city.opex_share', 0.25), first_board_era: 3};
    // who lends at close (phase 1: stages 1A and 1B). money.json finance.lenders, else these (est.)
    P.lenders = J('finance.lenders', {
      banks: {rate_delta: 0, years_add: 0},
      dollar: {rate_delta: -2.0, years_add: 0, fx: {year: 12, fall: 0.15}},
      infra: {rate_delta: 0.5, years_add: 6, spread: true}});   // spread: repaid over the whole tenor, not as fast as the forecast allows
    // construction years (design/onboarding.md S5, re-priced for the ₹60,000 cr phase 1); game.construction_events, else these (est.)
    P.con = J('game.construction_events', {
      monsoon: {year: 2, pay_cr: 600, slip_months: 4},
      overrun: {year: 3, pay_cr: 3000, slip_months: 8},
      trials: {year: 4, full_cr: 400, short_dis: 200}});
    return P;
  }
  function ensure() { if (!P) load(); }

  // ---------------------------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------------------------
  var ERAS = [[1, 5, 7], [2, 8, 10], [3, 11, 13], [4, 14, 18]];
  for (var _e = 5; _e < 12; _e++) ERAS.push([_e, 19 + 5 * (_e - 5), 23 + 5 * (_e - 5)]);
  ERAS.push([12, 54, 60]);
  function eraOf(year) { for (var i = 0; i < ERAS.length; i++) if (year >= ERAS[i][1] && year <= ERAS[i][2]) return ERAS[i][0]; return null; }
  function eraYears(e) { return ERAS[e - 1]; }
  function vsiLevel(year) { var mv = P.vsi_move_years; return year < mv[2] ? 1 : year < mv[3] ? 2 : year < mv[4] ? 3 : 4; }
  function profIdx(year) { return year >= 19 ? 4 : vsiLevel(year) - 1; }
  function opsProfile(name, year) { var o = P.ops_profiles[name], i = profIdx(year), r = {}; Object.keys(o).forEach(function (k) { r[k] = o[k][i]; }); return r; }
  function maxKey(o) { var m = -Infinity; for (var k in o) if (+k > m) m = +k; return m; }
  function irr(flows) {
    function npv(r) { var s = 0; for (var i = 0; i < flows.length; i++) s += flows[i] / Math.pow(1 + r, i); return s; }
    var lo = -0.5, hi = 1.0;
    if (npv(lo) * npv(hi) > 0) return null;
    for (var i = 0; i < 200; i++) { var mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }
  function cr(v) {   // ₹ crore in words-friendly form
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e5) return s + '₹' + (a / 1e5).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '') + ' lakh cr';
    return s + '₹' + Math.round(a).toLocaleString('en-IN') + ' cr';
  }
  function coverWords(d) { return d == null ? 'No loan payments due' : '₹' + Math.floor(d * 100 + 1e-9) + ' earned for every ₹100 due'; }
  function lightOf(d) { var t = P.thr; return d == null ? 'green' : d < t.step_in ? 'red' : d < t.warning ? 'amber' : 'green'; }

  // ---------------------------------------------------------------------------------------------
  // Loans and assets (Tranche, Vintage in the model)
  // ---------------------------------------------------------------------------------------------
  function Tranche(o) {
    this.name = o.name; this.rate = o.rate; this.draws = o.draws || {}; this.out = o.out || 0;
    this.cap_until = o.cap_until || 0; this.rep_start = o.rep_start; this.rep_years = o.rep_years || 10;
    this.profile = o.profile || 'sculpt'; this.weights = o.weights; this.sched = o.sched ? Object.assign({}, o.sched) : null;
    this.target_mode = !!o.target_mode; this.k = null; this.ds_hist = {}; this.int_hist = {};
    this.open_hist = {};   // outstanding after the year's draw, before its principal
  }
  // debt service in year t: actual if the year has run, else projected on the schedule already built (null if none yet).
  // Lets a later stage be sculpted on what an earlier stage really pays in its last, part-sized year (model: Tranche.ds_at).
  Tranche.prototype.dsAt = function (t) {
    if (t in this.ds_hist) return this.ds_hist[t];
    var ks = Object.keys(this.open_hist);
    if (this.sched == null || !ks.length) return null;
    var o = this.out, k0 = Math.max.apply(null, ks.map(Number));
    for (var k = k0 + 1; k < t; k++) o -= Math.min(o, this.sched[k] || 0);
    if (o <= 0) return 0;
    var p = (Object.keys(this.sched).length && t === maxKey(this.sched)) ? o : Math.min(o, this.sched[t] || 0);
    return this.rate / 100 * o + p;
  };
  Tranche.prototype.build = function (t0) {
    var n = this.rep_years, r = this.rate / 100, D = this.out, k, o, s;
    if (D <= 0) { this.sched = {}; return; }
    if (this.profile === 'equal') {
      var a = D * r / (1 - Math.pow(1 + r, -n)); o = D; s = {};
      for (k = 0; k < n; k++) { var p = k < n - 1 ? a - o * r : o; s[t0 + k] = p; o -= p; }
      this.sched = s; this.k = null; return;
    }
    var w = [], sw = 0;
    for (k = 0; k < n; k++) { w.push(Math.max(1e-9, this.weights(t0 + k))); sw += w[k]; }
    function run(c) {
      var o = D, s = {};
      for (var k = 0; k < n; k++) { var p = Math.max(0, c * w[k] - o * r); p = Math.min(p, o); s[t0 + k] = p; o -= p; }
      return [o, s];
    }
    var lo = 0, hi = 10 * D / sw + 10;
    for (k = 0; k < 100; k++) { var mid = (lo + hi) / 2; if (run(mid)[0] > 0) lo = mid; else hi = mid; }
    this.k = hi;
    var res = (this.target_mode && hi < 1.0) ? run(1.0) : run(hi);
    res[1][t0 + n - 1] += res[0];
    this.sched = res[1];
  };
  Tranche.prototype.step = function (t) {
    var d = this.draws[t] || 0;
    var cap = t < this.cap_until ? 1 : 0;
    var interest = this.rate / 100 * (this.out + d / 2);
    this.out += d;
    this.open_hist[t] = this.out;
    if (this.rep_start != null && t === this.rep_start && this.sched == null) this.build(t);
    var prin = this.sched ? Math.min(this.out, this.sched[t] || 0) : 0;
    if (this.sched && Object.keys(this.sched).length && t === maxKey(this.sched)) prin = this.out;
    this.out -= prin;
    var ie = interest * (1 - cap);
    this.ds_hist[t] = ie + prin; this.int_hist[t] = ie;
    return [ie, prin];
  };
  Tranche.prototype.prepay = function (amt) {
    amt = Math.min(amt, this.out);
    if (amt <= 0) return 0;
    if (this.sched) { var f = (this.out - amt) / this.out, s = this.sched; Object.keys(s).forEach(function (k) { s[k] *= f; }); }
    this.out -= amt;
    return amt;
  };
  function Vintage(gross, aero, cod, life, stage) { this.gross = gross; this.aero = aero; this.cod = cod; this.life = life; this.stage = stage; }
  Vintage.prototype.path = function (t, L, aeroOnly) {
    var life = this.life || L, g = aeroOnly ? this.aero : this.gross, c = this.cod;
    if (t < c || g <= 0) return [0, 0];
    var d = g / life;
    if (t === c) return [g - d / 2, d];
    var opened = g - d - d * (t - c - 1);
    if (opened <= 0) return [0, 0];
    var dep = Math.min(opened, d);
    return [opened - dep / 2, dep];
  };

  // ---------------------------------------------------------------------------------------------
  // The engine: one year at a time (Engine in the model)
  // ---------------------------------------------------------------------------------------------
  function Engine(c) {
    this.c = c; this.L = CAL.dep_life; this.rows = []; this.bal = 0; this.yields = {}; this.plans = []; this.trueups = [];
    this.cash = 0; this.dsra = 0; this.loss_dep = 0; this.loss_bus = []; this.step_in = null; this.refi_done = 0;
    this.eq_flows = {}; this.cures = 0; this.divs = 0; this.calls = 0; this.prepaid = 0;
    this.sl_out = c.state_loan ? c.state_loan.amount : 0; this.bad_eras = 0; this.era_mins = {};
    this.tax_ratio = CAL.tax_share; this.prov = []; this.events = [];
  }
  Engine.prototype.rab = function (t, plan) {
    var avg = 0, dep = 0, vs = this.c.vintages.concat(plan ? this.prov : []);
    for (var i = 0; i < vs.length; i++) { var p = vs[i].path(t, this.L, true); avg += p[0]; dep += p[1]; }
    return [avg, dep];
  };
  Engine.prototype.dep_total = function (t) { var s = 0, vs = this.c.vintages; for (var i = 0; i < vs.length; i++) s += vs[i].path(t, this.L, false)[1]; return s; };
  Engine.prototype.renewal_capex = function (t) {
    var pr = this.c.price, L = this.L, tot = 0, vs = this.c.vintages;
    for (var i = 0; i < vs.length; i++) { var v = vs[i]; if (v.stage != null && v.cod <= t) tot += v.gross / L * pr(t) / pr(Math.max(0, v.cod)); }
    return this.c.renewal_share(t) * tot;
  };
  Engine.prototype.building_block = function (t, wacc, till, pax, nar, opex_allowed, plan, parts, tax_amt) {
    var r = this.rab(t, plan), avg = r[0], dep = r[1];
    var ret = wacc / 100 * avg;
    var tx = tax_amt != null ? tax_amt : ret * this.tax_ratio;
    var bb = ret + tx + dep + opex_allowed - till * nar;
    var fee = this.c.feeShare(t), ppf = this.c.feePpf(t, pax);
    var a = bb / (1 - fee) + ppf;
    if (parts) {
      parts.rab = (parts.rab || 0) + avg; parts['return'] = (parts['return'] || 0) + ret; parts.tax = (parts.tax || 0) + tx;
      parts.dep = (parts.dep || 0) + dep; parts.opex = (parts.opex || 0) + opex_allowed; parts.fee = (parts.fee || 0) + a - bb;
    }
    return a;
  };
  Engine.prototype.plan_cp = function (cp, t0) {
    var c = this.c, n = cp.n, wacc = c.wacc(this, t0), k, t;
    cp._wacc_plan = wacc;
    this.prov = [];
    for (k = 0; k < n - 1; k++) {
      t = t0 + k;
      var amt = this.renewal_capex(t);
      if (amt > 0) this.prov.push(new Vintage(amt, amt * P.aero_asset_share, t + 1, null));
    }
    var v = 1 / (1 + wacc / 100), arr = [], paxf = [], nars = [], parts = {};
    for (k = 0; k < n; k++) { t = t0 + k; var pf = c.fc_pax(t); paxf.push(pf); nars.push(c.nar_bench(t) * pf / 10 + (c.nar_extra ? c.nar_extra(t) : 0)); }
    for (k = 0; k < n; k++) {
      t = t0 + k;
      var opex_allow = CAL.aero_opex_share * c.opex_bench(t, c.cap(t), paxf[k]);
      arr.push(this.building_block(t, wacc, cp.till, paxf[k], nars[k], opex_allow, true, parts));
    }
    var pv_arr = 0; for (k = 0; k < n; k++) pv_arr += arr[k] * Math.pow(v, k);
    var carry = cp.carry(this);
    var esc = cp.esc(this);
    var target = (1 - carry) * pv_arr + this.bal;
    var lag = cp.lag, y_old = [], known = 0, unit = 0;
    for (k = 0; k < n; k++) y_old.push(this.yields[t0 - 1] || 0);
    for (k = 0; k < n; k++) {
      known += lag[k] * y_old[k] * paxf[k] / 10 * Math.pow(v, k);
      unit += (1 - lag[k]) * Math.pow(1 + esc, k) * paxf[k] / 10 * Math.pow(v, k);
    }
    var y0 = unit > 0 ? Math.max(0, (target - known) / unit) : 0;
    for (k = 0; k < n; k++) this.yields[t0 + k] = lag[k] * y_old[k] + (1 - lag[k]) * y0 * Math.pow(1 + esc, k);
    var plan = {t0: t0, n: n, wacc: wacc, pv_arr: pv_arr, carry: carry, carried: carry * pv_arr, bal_in: this.bal, y0: y0, hard: cp.hard(this), parts: parts};
    this.plans.push(plan);
    cp._acc = []; cp._plan = plan;
    this.prov = [];
  };
  Engine.prototype.true_up = function (cp, t_end) {
    var w = cp._wacc_plan, v = 1 / (1 + w / 100), pv = this.bal, parts = {}, arr_tot = 0, coll_tot = 0, bal_in = this.bal;
    for (var k = 0; k < cp._acc.length; k++) {
      var a0 = cp._acc[k];   // [t, pax, nar, opex_allow, coll, w_t, tax_aero]
      var a = this.building_block(a0[0], a0[5], cp.till, a0[1], a0[2], a0[3], false, parts, a0[6]);
      pv += (a - a0[4]) * Math.pow(v, k); arr_tot += a; coll_tot += a0[4];
    }
    this.bal = pv * Math.pow(1 + w / 100, cp.n);
    if ((parts['return'] || 0) > 0) this.tax_ratio = parts.tax / parts['return'];
    this.trueups.push({t: t_end, value: this.bal, bal_in: bal_in, arr: arr_tot, coll: coll_tot});
  };
  Engine.prototype.tax = function (t, pbt, dep) {
    if (pbt < 0) {
      var loss = -pbt, d = Math.min(dep, loss);
      this.loss_dep += d;
      if (loss - d > 0) this.loss_bus.push([t, loss - d]);
      return 0;
    }
    var lcy = P.loss_carry_years;
    this.loss_bus = this.loss_bus.filter(function (x) { return t - x[0] <= lcy; });
    var inc = pbt, nb = [];
    for (var i = 0; i < this.loss_bus.length; i++) {
      var y = this.loss_bus[i][0], a = this.loss_bus[i][1], use = Math.min(a, inc);
      inc -= use; if (a - use > 1e-9) nb.push([y, a - use]);
    }
    this.loss_bus = nb;
    var u2 = Math.min(this.loss_dep, inc); this.loss_dep -= u2; inc -= u2;
    return P.tax_rate * inc;
  };
  Engine.prototype.run = function (T) {
    var c = this.c, cps = {}, active = null;
    c.cps.forEach(function (cp) { cps[cp.start] = cp; });
    T = Math.min(T || c.T, c.T);
    for (var t = 0; t < T; t++) {
      if (this.step_in) break;
      if (cps[t]) { active = cps[t]; this.plan_cp(active, t); }
      var pr = c.price(t), cap = c.cap(t), ops = c.ops(t);
      var y = this.yields[t] || 0, demand = c.demand(t) * (c.pax_adj ? c.pax_adj(t) : 1), f = 1;
      if (demand > 0 && y > 0) { var norm = P.yield_market_norm * pr, fare = P.avg_fare * pr; f = Math.min(1, Math.pow(1 + (y - norm) / fare, -P.demand_elasticity)); }
      var pax = demand > 0 ? Math.min(demand * f, P.capacity_headroom * cap) : 0;
      if (c.pax_factor) pax *= c.pax_factor(t);   // a part-year opening (construction slip of under 12 months)
      if (c.pax_cut) pax *= c.pax_cut(t);         // Chapters 3, 6, 7: a late move, a crisis, a rival hub
      var acI = c.nar_extra ? c.nar_extra(t) : 0;   // Airport City income (non-aero)
      var hubI = c.hub_inc ? c.hub_inc(t) : 0, hubC = c.hub_cost ? c.hub_cost(t) : 0;   // Chapter 5: connections income and its costs
      // Chapter 4's charge cut is the airport's own discount, below what AERA allows: billed (and trued up) at the full charge
      var billed = y * pax / 10, aero = billed * (1 - ops.sq) * (1 - (c.charge_cut ? c.charge_cut(t) : 0)), nar = c.nar(t) * pax / 10 + acI + hubI;
      var opex_b = c.opex_bench(t, cap, pax);
      var dis = Math.max(0, ops.dis - c.dis_in_opex);
      var opening = c.opening_cost(t);
      var opex = pax > 0 ? opex_b * ops.opex + dis * pr * pax / 10 + opening + P.ac.opex_share * acI + hubC : 0;
      // dollar bonds: the rupee falls, so what is owed (in rupees) grows by the fall
      [c.fx, c.fx2].forEach(function (fx) {   // fx2: Chapter 6's rupee crisis (s.shock)
        if (!fx || t !== fx.t) return;
        var hit = 0;
        c.tranches.forEach(function (tr) {
          if (fx.names.indexOf(tr.name) < 0 || tr.out <= 0) return;
          var add = tr.out * fx.fall; tr.out += add; hit += add;
          if (tr.sched) Object.keys(tr.sched).forEach(function (k) { if (+k >= t) tr.sched[k] *= 1 + fx.fall; });
        });
        if (hit > 0) this.events.push({t: t, k: 'fx', amt: hit, fall: fx.fall});
      }, this);
      var oi = aero + nar;
      var fee = c.feeShare(t) * oi + c.feePpf(t, pax);
      var ebitda = oi - opex - fee;
      var interest = 0, prin = 0, i;
      for (i = 0; i < c.tranches.length; i++) { var ip = c.tranches[i].step(t); interest += ip[0]; prin += ip[1]; }
      var ds = interest + prin, dep = this.dep_total(t);
      var renew = this.renewal_capex(t);
      if (renew) c.vintages.push(new Vintage(renew, renew * P.aero_asset_share, t + 1, null));
      var tax = this.tax(t, ebitda - dep - interest, dep);
      if (active && pax > 0) active._acc.push([t, pax, nar, CAL.aero_opex_share * Math.min(opex, opex_b), billed, c.wacc(this, t), oi > 0 ? tax * aero / oi : 0]);
      var cfads = ebitda - tax - renew;
      var row = {t: t, year: t + 1, pax: pax, demand: demand, cap: cap, yield: y, aero: aero, nar: nar, oi: oi, opex: opex, opening: opening,
        dis: dis * pr * pax / 10, hubInc: hubI, hubCost: hubC, fee: fee, ebitda: ebitda, interest: interest, principal: prin, ds: ds, dep: dep, tax: tax, renew: renew,
        cfads: cfads, dscr: ds > 1e-6 ? cfads / ds : null, debt: 0, bal: this.bal, sq: ops.sq};
      row.debt = c.tranches.reduce(function (s, x) { return s + x.out; }, 0);
      this.waterfall(t, row);
      if (c.step_in_year != null && t + 1 >= c.step_in_year && !this.step_in) this.step_in = {t: t, why: 'you refused their letter asking for fresh money'};
      this.rows.push(row);
      if (active && t === active.start + active.n - 1) this.true_up(active, t);
      if (c.refi_rule) c.refi_rule(this, t);
    }
    return this;
  };
  Engine.prototype.prepay = function (amt) {
    var trs = this.c.tranches, tot = 0, done = 0, i;
    for (i = 0; i < trs.length; i++) if (trs[i].out > 0) tot += trs[i].out;
    if (tot <= 0 || amt <= 0) return 0;
    for (i = 0; i < trs.length; i++) if (trs[i].out > 0) done += trs[i].prepay(amt * trs[i].out / tot);
    return done;
  };
  Engine.prototype.next_ds = function (t) {
    var tot = 0, trs = this.c.tranches;
    for (var i = 0; i < trs.length; i++) {
      var tr = trs[i];
      if (tr.out <= 0) continue;
      if (tr.sched && tr.sched[t + 1] != null) tot += tr.sched[t + 1] + tr.out * tr.rate / 100;
      else if (t + 1 >= tr.cap_until) tot += tr.out * tr.rate / 100;
    }
    return tot;
  };
  Engine.prototype.waterfall = function (t, row) {
    var c = this.c, lv = c.lever, eq = c.equity_need[t] || 0;
    var cash_int = (Math.max(this.cash, 0) + this.dsra) * P.cash_yield / 100 * (1 - P.tax_rate);
    var inj = c.inject ? c.inject[t] || 0 : 0;   // Chapter 6: fresh money from the shareholders (or L5) when the banks ask
    var free = row.cfads - row.ds + cash_int, cure = 0, cash = this.cash + inj, unfunded = false;
    var cureOn = lv(t, 'cure');
    if (free < 0) {
      var draw = Math.min(this.dsra, -free); this.dsra -= draw; free += draw;
      var use = Math.min(Math.max(cash, 0), -free); cash -= use; free += use;
      if (free < -1e-6) {
        if (cureOn) { cure += -free; free = 0; this.events.push({t: t, k: 'cure_ds', amt: cure}); }
        else if (!c.no_step_in) unfunded = true;
      }
    }
    var target = P.dsra_quarters / 4 * this.next_ds(t);
    if (t < c.first_cod_t) { /* funded at close; held through construction */ }
    else if (this.dsra < target) { var top = Math.min(Math.max(free, 0), target - this.dsra); this.dsra += top; free -= top; }
    else { free += this.dsra - target; this.dsra = target; }
    var d = row.dscr, swept = 0;
    if (d != null && d < P.cov_min && free > 0 && !c.forecast) { swept = this.prepay(free); free -= swept; }
    cash += free;
    var sl = c.state_loan;
    if (sl && this.sl_out > 0 && !swept && t >= sl.first_t + ((lv(t, 'defer_state_loan') && t >= sl.defer_from) ? sl.defer : 0)) {
      var inst = Math.min(this.sl_out, sl.amount / sl.n, Math.max(0, cash)); this.sl_out -= inst; cash -= inst;
    }
    var from_cash = Math.min(Math.max(0, cash), eq); cash -= from_cash;
    var call = eq - from_cash;
    var div = 0, prep = 0;
    var e = c.era(t);
    if (e != null && (t + 1 >= c.T || c.era(t + 1) !== e)) {
      var ds_rows = [];
      for (var i = 0; i < this.rows.length; i++) if (c.era(this.rows[i].t) === e && this.rows[i].dscr != null) ds_rows.push(this.rows[i].dscr);
      if (d != null) ds_rows.push(d);
      var dmin = ds_rows.length ? Math.min.apply(null, ds_rows) : null;
      this.era_mins[e] = dmin;
      if (dmin != null && dmin < P.dscr_default && !c.forecast) {
        this.bad_eras += 1;
        if (this.bad_eras >= P.thr.step_in_eras && !this.step_in) {
          if (cureOn) {
            var debt = c.tranches.reduce(function (s, x) { return s + x.out; }, 0);
            var x = debt * (1 - Math.max(dmin, 0) / P.cov_min);
            var cp = this.prepay(x); cure += cp; this.bad_eras = 0;
            this.events.push({t: t, k: 'cure_era', amt: cp});
          } else if (!c.no_step_in) {
            this.step_in = {t: t, why: 'two eras running below ₹100 earned for every ₹100 due'};
          }
        }
      } else this.bad_eras = 0;
      var share = dmin == null ? 1 : dmin < P.lockup.nil_below ? 0 : dmin < P.lockup.half_below ? 0.5 : dmin < P.lockup.three_quarters_below ? 0.75 : 1;
      this.lockShare = share;
      if (!this.step_in && cash > 0) {
        var dec = c.board(e);    // null: the board has not met yet (the run stops here) or the base case
        if (dec === 'auto') { div = cash * share; cash -= div; }
        else if (dec) {
          div = Math.min(Math.max(0, dec.dividendCr || 0), cash * share); cash -= div;
          prep = this.prepay(Math.min(Math.max(0, dec.prepayCr || 0), cash)); cash -= prep; this.prepaid += prep;
        }
      }
    }
    if (unfunded && !this.step_in) this.step_in = {t: t, why: 'a loan payment it could not make'};
    this.cash = cash; this.cures += cure; this.calls += call;
    var flow = -call - cure - inj + (this.step_in ? 0 : div);
    this.eq_flows[t] = (this.eq_flows[t] || 0) + flow;
    this.divs += div;
    row.cash = this.cash; row.dsra = this.dsra; row.div = div; row.cure = cure; row.call = call; row.sl_out = this.sl_out; row.swept = swept; row.prepay = prep;
  };

  // ---------------------------------------------------------------------------------------------
  // VSI on its own premise (vsi_build): stages, capacity, demand, AERA periods, debt
  // ---------------------------------------------------------------------------------------------
  function stageNames(s, withP2) { return ['1A_' + s.phase1, '1B_' + s.phase1, '1C', '1D'].concat(withP2 ? ['P2'] : []); }
  function stageKey(n) { return n.indexOf('1A') === 0 ? '1A' : n.indexOf('1B') === 0 ? '1B' : (n === '1C' || n === '1D') ? 'T2' : 'P2'; }
  function p2Start() { return Math.min.apply(null, Object.keys(P.vsi_stages.P2.spend).map(Number)); }
  // phase 2 is on the board's agenda once the next era reaches its planned first year of building
  function p2Offer(e) { var nx = eraYears(e + 1), ye = nx ? nx[2] : eraYears(e)[2] + 5; return ye >= p2Start() && eraYears(e)[2] <= 43; }
  function stagesFor(s) {
    var st = clone(P.vsi_stages);
    if (s.p2year) {   // ordered at the board after year p2year: built on money.json's plan, never before its planned first year
      var y0 = p2Start(), start = Math.max(y0, s.p2year + 1), sp = st.P2.spend;
      st.P2.spend = {}; Object.keys(sp).forEach(function (k) { st.P2.spend[start + (+k - y0)] = sp[k]; });
      st.P2.cod = start + (P.vsi_stages.P2.cod - y0);
    }
    return st;
  }
  // ops for a game year: base (the banks' forecast), a named profile, or the shift of the era containing that year
  function opsFn(s, base) {
    return function (year) {
      if (base) return opsProfile('base', year);
      var e = eraOf(year);
      var o = e && s.eraOps && s.eraOps[e];
      if (o) return o;
      if (s.profile_ops) return opsProfile(s.profile_ops, year);
      return opsProfile('base', year);
    };
  }
  function demandFn(opsAt, dragAt) {
    var dd = P.dd, mv = P.vsi_move_years, ppm = P.vsi_ppm, g = P.growth.cagr_by_era, cache = {};
    return function D(year) {
      if (year < 5) return 0;
      if (cache[year] != null) return cache[year];
      var L = vsiLevel(year), base = dd[L] * ppm[L] * P.p2a / 1e6;
      for (var t = mv[L] + 1; t <= year; t++) base *= 1 + g[Math.min(11, Math.floor((t - 1) / 5))] + opsAt(t).star + (dragAt ? dragAt(t) : 0);
      cache[year] = base;
      return base;
    };
  }
  // AERA stance by game year: 'normal' or 'hard' (the player appealed the order at the board before that period)
  function stanceAt(s, year) {
    var st = s.stance0 || 'normal';
    (s.appeals || []).forEach(function (a) { if (a.from <= year) st = a.hard ? 'hard' : 'normal'; });
    return st;
  }
  function build(s, gear, scheds, base, withP2, sizingW) {
    var cpi = P.cpi_forward, pr = function (t) { return Math.pow(1 + cpi, t); };
    var st = stagesFor(s), names = stageNames(s, withP2);
    // construction years (not in the bank's base case, which it sized on time): a slip moves 1A's opening; interest
    // still falls due from the planned opening (model: delay). Under 12 months the first year runs for part of the year.
    var con = (!base && s.construction) || null, slipM = con ? (con.slipMonths || 0) : 0;
    var delay = Math.floor(slipM / 12 + 1e-9), frac = (slipM - 12 * delay) / 12;
    var planned1 = st[names[0]].cod;
    if (delay) st[names[0]].cod += delay;
    var yOpen = st[names[0]].cod;
    var opsYear0 = opsFn(s, base), opsYear = opsYear0;
    if (con && con.trials === 'short') opsYear = function (year) {   // short trials: a rough first year (penalties and passenger care)
      var o = opsYear0(year); if (year !== yOpen) return o; o = Object.assign({}, o); o.dis += P.con.trials.short_dis; return o; };
    var ops = function (t) { return opsYear(t + 1); };
    var hardAt = function (year) { return !base && stanceAt(s, year) === 'hard'; };
    var D = demandFn(opsYear, function (y) { return y >= 5 && hardAt(y) ? P.airline_relations_drag : 0; });
    var Dbase = demandFn(function (y) { return opsProfile('base', y); }, null);
    function capYear(year) {
      var cc = 0;
      names.forEach(function (n) {
        if (year >= st[n].cod) {
          if (n === 'P2') { var k = Math.min(2, year - st[n].cod); cc = st['1D'].cap + (st.P2.cap - st['1D'].cap) * P.gcap.ramp[k]; }
          else cc = st[n].cap;
        }
      });
      return cc;
    }
    var cap = function (t) { return capYear(t + 1); };
    var fc_pax = function (t) { return Math.min(Dbase(t + 1), P.capacity_headroom * capYear(t + 1)); };
    var a_fix = CAL.opex_fixed_per_mppa, b_var = CAL.opex_per_pax;
    function opx(t, cc, pax) { if (cc <= 0 || t < 4) return 0; return pr(t) * (a_fix * cc + b_var * pax / 10); }
    function opening(t) {
      var y = t + 1;
      if (y < yOpen) return 0;
      var new_g = y === yOpen ? capYear(yOpen) : y === yOpen + 1 ? capYear(yOpen) * P.opening_cost.greenfield_year2_share : 0, new_e = 0;
      for (var k = 0; k < 2; k++) if (y - k > yOpen) new_e += Math.max(0, capYear(y - k) - capYear(y - k - 1));
      return pr(t) * a_fix * (CAL.open_k_greenfield * new_g + CAL.open_k_expansion * new_e);
    }
    var vintages = [], tranches = [], equity_need = {}, stage_list = [], sl_amt = 0, slt = P.state_loan_terms;
    names.forEach(function (n) {
      var terms = termsFor(s, n);
      var sd = st[n], g = gear[n], rc = (P.idc_constr_rate + terms.idc_delta) / 100, out = 0, total = 0, draws = {}, idc_tot = 0;
      var sl_share = (s.state_loan && n.indexOf('1A_') === 0) ? slt.share_of_built_cost : 0;
      Object.keys(sd.spend).map(Number).sort(function (a, b) { return a - b; }).forEach(function (y) {
        var t = y - 1, spend = sd.cost * sd.spend[y] * pr(t), sl = spend * sl_share;
        sl_amt += sl;
        var senior_base = (spend - sl) * g, idc = rc * (out + senior_base / 2) / (1 - rc * g / 2), d = senior_base + g * idc;
        out += d; idc_tot += idc; total += spend + idc; draws[t] = d;
        equity_need[t] = (equity_need[t] || 0) + (spend - sl + idc) * (1 - g);
      });
      var cod_t = sd.cod - 1;
      var hardCod = hardAt(sd.cod);
      vintages.push(new Vintage(total, total * P.aero_asset_share * (1 - (hardCod ? P.push_hard_disallowance : 0)), cod_t, Math.min(CAL.dep_life, 60 - cod_t), n));
      stage_list.push({name: n, cost: total, idc: idc_tot, debt: out, gearing: g, cod: sd.cod});
      var late = delay && n === names[0];   // late: interest falls due, and repayment starts, from the planned opening
      var rep_start = terms.rep_start != null ? terms.rep_start - 1 : (late ? planned1 - 1 : cod_t) + terms.mor;
      var cap_t = late ? planned1 - 1 : cod_t;
      var tr;
      if (scheds && scheds[n]) tr = new Tranche({name: n, rate: terms.rate, draws: draws, cap_until: cap_t, rep_start: rep_start, rep_years: terms.years, profile: 'fixed', sched: scheds[n]});
      else tr = new Tranche({name: n, rate: terms.rate, draws: draws, cap_until: cap_t, rep_start: rep_start, rep_years: terms.years,
        profile: s.profile, weights: (sizingW && sizingW[n]) || function () { return 1; }, target_mode: !!(sizingW && sizingW[n] && n !== 'P2' && !terms.spread)});
      tr.out_planned = out; tr.cod_t = cod_t;
      tranches.push(tr);
    });
    var t1a = tranches[0], g1a = gear[names[0]];
    var dsra0 = P.dsra_quarters / 4 * t1a.out_planned * t1a.rate / 100;
    var last = maxKey(t1a.draws);
    t1a.draws[last] += g1a * dsra0;
    equity_need[last] = (equity_need[last] || 0) + (1 - g1a) * dsra0;
    // what the shareholders paid during construction (pumps, the steel overrun, full trials): equity, in 1A's asset base
    if (con && con.pay && con.pay.length) {
      var gx = 0;
      con.pay.forEach(function (p) { var t = p.year - 1, a = p.cr * pr(t); equity_need[t] = (equity_need[t] || 0) + a; gx += a; });
      vintages.push(new Vintage(gx, gx * P.aero_asset_share, yOpen - 1, Math.min(CAL.dep_life, 60 - yOpen + 1), names[0] + '+'));
    }
    // one-off spends the shareholders paid after opening (the bird radar in a capital budget): equity, in the asset base
    var xpay = (!base && s.extraBy) ? [].concat.apply([], vals(s.extraBy)) : [];   // Chapter 7's dated plan, keyed like the stake
    if (!base && ((s.extra_pay && s.extra_pay.length) || xpay.length)) (s.extra_pay || []).concat(xpay).forEach(function (p) {
      var t = p.year - 1, a = p.cr * pr(t); equity_need[t] = (equity_need[t] || 0) + a;
      vintages.push(new Vintage(a, a * P.aero_asset_share, t + 1, Math.min(CAL.dep_life, 60 - t - 1), null));
    });
    // Chapter 5: the partner's international banks (s.hub, set by VSIEra.ch5.applyShift). Income from connections made grows
    // each year by the route growth the shift earned (new routes when connections hold, Doha wins them when they miss),
    // through the era; after it, it rises with prices. Counted as non-aero, so AERA counts part of it (hybrid till).
    var hubInc = null, hubCost = null;
    if (!base && s.hub && s.hub.incCr != null) {
      var H = s.hub, hk = function (y) { return Math.min(y, H.until) - H.from; };
      hubInc = function (t) { var y = t + 1; return y < H.from ? 0 : H.incCr * Math.pow(1 + H.growth, hk(y)) * pr(t) / pr(H.from - 1); };
      hubCost = function (t) { var y = t + 1; return y < H.from ? 0 : H.costCr * pr(t) / pr(H.from - 1); };
    }
    // Chapters 3-7: connection streams (s.streams, keyed by what made them: Akasa Air's bank, Chapter 4's network, Chapter
    // 7's dated plan), priced like s.hub; GMR's Hyderabad hub can take a share of them (s.rivalTake)
    var streams = (!base && s.streams) ? Object.keys(s.streams).map(function (k) { return s.streams[k]; }).filter(Boolean) : [], rt = !base && s.rivalTake;
    if (streams.length || rt) {
      var hubInc0 = hubInc, hubCost0 = hubCost;
      var dipAt = function (S, y) { var f = 1; (S.dip || []).forEach(function (d) { if (y >= d.from && y <= d.until) f *= d.f; }); return f; };
      hubInc = function (t) {
        var y = t + 1, v = hubInc0 ? hubInc0(t) : 0;
        streams.forEach(function (S) { if (y >= S.from && (!S.stop || y < S.stop)) v += (S.incCr || 0) * Math.pow(1 + (S.growth || 0), Math.min(y, S.until || 60) - S.from) * dipAt(S, y) * pr(t) / pr(S.from - 1); });
        return rt && y >= rt.from ? v * (1 - rt.share) : v;
      };
      hubCost = function (t) {
        var y = t + 1, v = hubCost0 ? hubCost0(t) : 0;
        streams.forEach(function (S) { if (y >= S.from && (!S.stop || y < S.stop) && y <= (S.costUntil || 60)) v += (S.costCr || 0) * pr(t) / pr(S.from - 1); });
        return v;
      };
    }
    var adj = !base && s.paxAdj ? Object.keys(s.paxAdj).map(function (k) { return s.paxAdj[k]; }).filter(Boolean) : [];
    // more traffic (f > 1) raises demand, still capped by the terminals; a shock (f < 1) takes passengers away even from a full airport
    var adjAt = function (t, up) { var y = t + 1, f = 1; adj.forEach(function (a) { a.forEach(function (d) { if (y >= d.from && y <= d.until && (d.f > 1) === up) f *= d.f; }); }); return f; };
    var paxAdj = adj.length ? function (t) { return adjAt(t, true); } : null, paxCut = adj.length ? function (t) { return adjAt(t, false); } : null;
    var cc = !base && s.chargeCut, chargeCut = cc ? function (t) { var y = t + 1; return y >= cc.from && y <= cc.until ? cc.cut * cc.airlineShare : 0; } : null;
    var inject = null;
    if (!base && s.injectBy) { inject = {}; vals(s.injectBy).forEach(function (x) { inject[x.year - 1] = (inject[x.year - 1] || 0) + x.cr; }); }
    // Airport City: ordered at a board (s.ac_year), built on money.json's plan, never before its planned first year
    var acInc = null, acPhases = [];
    if (!base && s.ac_year) {
      var AC = P.ac, sh = Math.max(0, s.ac_year + 1 - AC.phases[0].build[0]);
      acPhases = AC.phases.map(function (ph) { return {build: ph.build.map(function (y) { return y + sh; }), opens: ph.opens + sh, acres: ph.acres}; });
      acPhases.forEach(function (ph) {
        var gross = 0;
        ph.build.forEach(function (y) { var t = y - 1, sp = ph.acres * AC.infra / ph.build.length * pr(t); equity_need[t] = (equity_need[t] || 0) + sp; gross += sp; });
        vintages.push(new Vintage(gross, 0, ph.opens - 1, Math.min(CAL.dep_life, 60 - ph.opens + 1)));   // taxed, not in AERA's asset base
      });
      acInc = function (t) {
        var y = t + 1, v = 0;
        acPhases.forEach(function (ph) { if (y >= ph.opens) v += ph.acres * AC.lic * Math.min(1, (y - ph.opens + 1) / AC.ramp) * pr(t); });
        return v;
      };
    }
    var state_loan = sl_amt > 0 ? {amount: sl_amt, n: slt.instalments, first_t: slt.first_year_after_close - 1, defer: slt.deferral_years, defer_from: slt.defer_from_year - 1} : null;
    function capexTo(t) { var s2 = 0; stage_list.forEach(function (sg) { if (sg.cod - 1 <= t) s2 += sg.cost; }); return s2; }
    function wacc(eng, t) {
      var so = 0, sr = 0;
      eng.c.tranches.forEach(function (tr) { if (tr.out > 0) { so += tr.out; sr += tr.out * tr.rate; } });
      var cod = so > 0 ? sr / so : P.rate, nd = P.notional_debt_share_wacc, w = (1 - nd) * P.coe + nd * cod;
      var tc = capexTo(t), ws = tc > 0 ? eng.sl_out / tc : 0;
      return (1 - ws) * w;
    }
    var cps = [];
    for (var k = 0; k < 12; k++) {
      var start = 4 + 5 * k;
      if (start >= 60 || (cps.length && cps[cps.length - 1].start + cps[cps.length - 1].n >= 60)) break;
      var n = 60 - start < 10 ? 60 - start : 5;
      var b_in = names.some(function (x) { return (x === '1C' || x === '1D') && start <= st[x].cod - 1 && st[x].cod - 1 < start + n; });
      (function (start, n, b_in, k) {
        var hard = function () { return hardAt(start + 1); };
        cps.push({start: start, n: n, till: P.till, idx: k + 1, b_in: b_in, hard: hard,
          lag: k === 0 ? zeros(n) : [P.aera_order_lag].concat(zeros(n - 1)),
          carry: function () { if (!b_in || base || start + n >= 60) return 0; return hard() ? 0 : (s.no_carry ? 0 : P.tariff_shock_carry); },
          esc: function () { return hard() ? 0 : cpi; }});
      })(start, n, b_in, k);
    }
    function narReal(year, opsAt) {
      var v = P.nar0, e1 = Math.max(1, eraOf(year) || 1);
      for (var e = 1; e < e1; e++) v += (P.nar1 - v) * P.nar_convergence * opsAt(ERAS[e - 1][1]).Q;
      return v;
    }
    var bid = s.bid || {type: 'share', value: P.fee_base * 100};
    var intlShare = function (t) { var e = eraOf(t + 1) || 1, gg = P.growth; return Math.min(gg.intl_share_cap || 0.35, (gg.intl_share_start || 0.19) + (gg.intl_share_step_per_era || 0.02) * (e - 1)); };
    var feeShare = function () { return bid.type === 'share' ? bid.value / 100 : 0; };
    var feePpf = function (t, pax) { return bid.type === 'ppf' && t >= 4 ? bid.value * pr(t) * pax * (1 + intlShare(t)) / 10 : 0; };
    var rs = P.renewal_share, life = CAL.dep_life;
    var renewal = function (t) { return t < 4 ? 0 : Math.min(rs.full, rs.start + (rs.full - rs.start) * (t - 4) / life); };
    var c = {
      T: 60, price: pr, cps: cps, vintages: vintages, tranches: tranches, demand: function (t) { return D(t + 1); }, fc_pax: fc_pax, cap: cap, ops: ops,
      nar: function (t) { return narReal(t + 1, opsYear) * ops(t).Q * pr(t); },
      nar_bench: function (t) { return narReal(t + 1, function (y) { return opsProfile('base', y); }) * opsProfile('base', t + 1).Q * pr(t); },
      opex_bench: opx, opening_cost: opening, feeShare: feeShare, feePpf: feePpf, wacc: wacc,
      equity_need: equity_need, era: function (t) { return eraOf(t + 1); }, state_loan: state_loan, stage_list: stage_list,
      renewal_share: renewal, first_cod_t: st[names[0]].cod - 1, dis_in_opex: P.ops_profiles.base.dis[0], forecast: !!base,
      nar_extra: acInc, hub_inc: hubInc, hub_cost: hubCost, hub_growth: (!base && s.hub && s.hub.growth) || 0, pax_factor: frac > 0 ? function (t) { return t + 1 === yOpen ? 1 - frac : 1; } : null,
      fx: (!base && lenderOf(s).fx) ? {t: lenderOf(s).fx.year - 1, fall: lenderOf(s).fx.fall, names: names.filter(function (n) { var k = stageKey(n); return k === '1A' || k === '1B'; })} : null,
      fx2: (!base && s.shock && s.shock.kind === 'rupee' && s.lender === 'dollar') ? {t: s.shock.year - 1, fall: s.shock.fall, names: names.filter(function (n) { var k = stageKey(n); return k === '1A' || k === '1B'; })} : null,
      pax_adj: paxAdj, pax_cut: paxCut, charge_cut: chargeCut, inject: inject, step_in_year: (!base && s.stepInYear) || null, no_step_in: !base && !!s.noStepIn,
      lever: function (t, key) {
        if (base) return key === 'cure' || (key === 'defer_state_loan' && !!s.defer_state_loan);
        if (key === 'cure') return (slipM > 0 && t + 1 <= yOpen) || leverAt(s.cure, t + 1);   // a late opening: the shareholders pay the interest
        if (key === 'defer_state_loan') return !!s.defer_state_loan;
        if (key === 'refi') return leverAt(s.refi, t + 1);
        return false;
      },
      board: function (e) { if (base) return 'auto'; return (s.boards && s.boards[e]) || null; }
    };
    c.refi_rule = function (eng, t) {
      var rf = P.refi;
      if (base || eng.refi_done || !c.lever(t, 'refi')) return;
      var lastCod = -1; names.forEach(function (n) { if (n !== 'P2') lastCod = Math.max(lastCod, st[n].cod - 1); });
      if (t < lastCod + rf.stable_years - 1) return;
      var lastRows = eng.rows.slice(-rf.stable_years);
      if (lastRows.length < rf.stable_years || lastRows.some(function (r) { return r.dscr == null || r.dscr < rf.stable_dscr; })) return;
      var old = eng.c.tranches.filter(function (x) { return x.out > 0 && t >= x.cap_until; }), amt = 0;
      old.forEach(function (x) { amt += x.out; x.out = 0; x.sched = {}; x.rep_start = null; });
      var bw = c.refi_weights;
      eng.c.tranches.push(new Tranche({name: 'refi', rate: rf.rate, out: amt, rep_start: t + 1 + rf.moratorium, rep_years: rf.tenor, profile: 'sculpt', weights: bw}));
      eng.refi_done = t + 1;
      eng.events.push({t: t, k: 'refi', amt: amt});
    };
    c.refi_weights = function () { return 1; };
    var eng = new Engine(c);
    eng.dsra = dsra0; eng.dsra0 = dsra0; eng.names = names; eng.stage_list = stage_list; eng.sl_amt = sl_amt; eng.gear = gear;
    eng.yOpen = yOpen; eng.acInc = acInc || function () { return 0; }; eng.acPhases = acPhases;
    return eng;
  }
  function lenderOf(s) { return P.lenders[s.lender] || P.lenders.banks; }
  // loan terms for a stage: the close lender's rate and tenor on phase 1 (1A, 1B); later closes are with Indian banks
  function termsFor(s, n) {
    var k = stageKey(n), t = clone(P.vsi_loan_terms[k]); t.idc_delta = 0;
    if (k === '1A' || k === '1B') { var L = lenderOf(s); t.rate += L.rate_delta || 0; t.idc_delta = L.rate_delta || 0; t.years += L.years_add || 0; t.spread = !!L.spread; }
    return t;
  }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function leverAt(v, year) {   // a lever is a boolean or a list of {from, on}
    if (Array.isArray(v)) { var on = false; v.forEach(function (x) { if (x.from <= year) on = !!x.on; }); return on; }
    return !!v;
  }

  // The bank (size_debt): sculpt each stage on its base-case capacity at 1.30, cap at the asked gearing, iterate.
  function sizeDebt(s) {
    var tgt = P.lbc_dscr_target, mc = P.lbc_moratorium_cover, lt = P.vsi_loan_terms;
    function defGear(n) { var k = stageKey(n); return (k === '1A' || k === '1B') ? s.gearing : lt[k].debt_share; }
    function solve(names, fixed, withP2, fixedGear) {
      var gear = {}, capG = {}, prev = null, prevGear = null, holder = {};
      names.forEach(function (n) { gear[n] = (fixedGear && fixedGear[n] != null) ? fixedGear[n] : defGear(n); capG[n] = gear[n]; });
      for (var it = 0; it < 30; it++) {
        var sizingW = {};
        if (prev) {
          var cf = {}; prev.rows.forEach(function (r) { cf[r.t] = r.cfads; });
          var order = prev.c.tranches.filter(function (x) { return names.indexOf(x.name) >= 0 && !fixed[x.name]; }).sort(function (a, b) { return a.rep_start - b.rep_start; });
          var fixedDs = {};
          prev.c.tranches.forEach(function (x) { if (fixed[x.name]) Object.keys(x.ds_hist).forEach(function (t) { fixedDs[t] = (fixedDs[t] || 0) + x.ds_hist[t]; }); });
          order.forEach(function (tr, i) {
            var earlier = order.slice(0, i), later = order.slice(i + 1);
            sizingW[tr.name] = function (t) {
              var used = (fixedDs[t] || 0);
              // earlier stages: what they pay in this pass (their schedules are already built), so the year one stage
              // finishes and the next takes over is sculpted on the real remainder
              var cur = {}; if (holder.eng) holder.eng.c.tranches.forEach(function (x) { cur[x.name] = x; });
              earlier.forEach(function (e) { var v = cur[e.name] ? cur[e.name].dsAt(t) : null; used += v == null ? (e.ds_hist[t] || 0) : v; });
              later.forEach(function (l) { used += l.int_hist[t] || 0; });
              return Math.max(1e-6, (cf[t] || 0) / tgt - used);
            };
          });
        } else names.forEach(function (n) { sizingW[n] = function (t) { return Math.max(1, t + 1); }; });
        var used = Object.assign({}, gear);
        holder.eng = null;
        var eng = build(s, used, Object.assign({}, fixed), true, withP2, sizingW);
        holder.eng = eng; eng.run(60);
        var change = 0;
        if (prev) {
          eng.c.tranches.forEach(function (tr) {
            if (gear[tr.name] == null || fixed[tr.name]) return;
            var room = tr.k ? 1 / tr.k : 1;
            for (var t = tr.cod_t; t < tr.rep_start; t++) {
              var r = eng.rows[t], own = tr.ds_hist[t] || 0;
              if (own > 1e-6) room = Math.min(room, (r.cfads / (mc + 1e-3) - (r.ds - own)) / own);   // just inside the test, so solver error never shows as 1.19
            }
            room = Math.min(1.5, Math.max(0.3, room));
            var ng = Math.min(capG[tr.name], gear[tr.name] * Math.pow(room, 0.7));
            change = Math.max(change, Math.abs(ng - gear[tr.name]));
            gear[tr.name] = ng;
          });
        }
        var dsChange = 1e9;
        if (prev) { dsChange = 0; for (var q = 0; q < eng.rows.length; q++) dsChange = Math.max(dsChange, Math.abs(eng.rows[q].ds - prev.rows[q].ds)); }
        prev = eng; prevGear = used;
        if (it > 2 && change < 1e-4 && dsChange < 1.0) break;
      }
      var scheds = {};
      prev.c.tranches.forEach(function (tr) { if (names.indexOf(tr.name) >= 0) scheds[tr.name] = Object.assign({}, tr.sched || {}); });
      return {gear: prevGear, scheds: scheds, eng: prev};
    }
    var mand = stageNames(s, false);
    var r = solve(mand, {}, false);
    var out = {gear: r.gear, scheds: r.scheds, eng: r.eng};
    if (s.p2year) {
      var fixed = {}; mand.forEach(function (n) { fixed[n] = r.scheds[n]; });
      var fg = {}; mand.forEach(function (n) { fg[n] = r.gear[n]; });
      var r2 = solve(stageNames(s, true), fixed, true, fg);
      out.gear.P2 = r2.gear.P2; out.scheds.P2 = r2.scheds.P2; out.eng = r2.eng;
    }
    if (s.profile === 'equal') {   // equal instalments: the bank lends only what the annuity covers at 1.30 on its base case
      var ge = Object.assign({}, out.gear), b;
      for (var i = 0; i < 20; i++) {
        b = build(s, ge, {}, true, !!s.p2year, null).run(60);
        var worst = 2;
        b.rows.forEach(function (rw) { if (rw.ds > 0 && rw.t >= 4 && rw.t <= 40) worst = Math.min(worst, rw.cfads / rw.ds); });
        var f = Math.min(1, worst / tgt);
        if (f > 0.999) break;
        Object.keys(ge).forEach(function (n) { ge[n] *= Math.pow(f, 0.7); });
      }
      out = {gear: ge, scheds: {}, eng: b};
    }
    var p2ds = {};
    out.eng.c.tranches.forEach(function (tr) { if (tr.name === 'P2') p2ds = tr.ds_hist; });
    var baseCf = [], p2 = [];
    for (var t = 0; t < 60; t++) { var rw = out.eng.rows[t]; baseCf.push(rw ? rw.cfads : 0); p2.push(p2ds[t] || 0); }
    var minBase = null;
    out.eng.rows.forEach(function (rw) { if (rw.dscr != null && rw.t >= 4) minBase = minBase == null ? rw.dscr : Math.min(minBase, rw.dscr); });
    return {gear: out.gear, scheds: out.scheds, baseCf: baseCf, p2ds: p2, minBase: minBase, debt: out.eng.stage_list.reduce(function (a, sg) { return a + sg.debt; }, 0)};
  }

  // Run the player's concession from close through game year Tyears (inclusive).
  function simulate(s, Tyears) {
    var sz = s.sizing;
    var eng = build(s, sz.gear, s.profile === 'equal' ? {} : sz.scheds, false, !!s.p2year, null);
    eng.c.refi_weights = function (t) { return Math.max(1e-6, (sz.baseCf[t] || 0) / P.lbc_dscr_target - (sz.p2ds[t] || 0)); };
    eng.run(Tyears);
    return eng;
  }

  // ---------------------------------------------------------------------------------------------
  // The shift → the era's operating profile (design/eras.md §3, §4, §6, §8)
  // ---------------------------------------------------------------------------------------------
  function shiftOps(shift, year) {
    shift = shift || {};
    if (shift.ops) return Object.assign(opsProfile('base', year), shift.ops);   // explicit (bots and tests)
    var stars = Math.max(0, Math.min(3, Math.round(shift.stars || 0)));
    var otp = shift.otp != null ? shift.otp : 0.85, cx = shift.cx != null ? shift.cx : 0.9, safety = shift.safety != null ? shift.safety : 100;
    if (otp > 1.5) otp /= 100; if (cx > 1.5) cx /= 100;
    var star = P.star_bonus[stars] != null ? P.star_bonus[stars] : 0;
    // Mall: stressed passengers spend less (delays and missed connections)
    var Q = shift.Q != null ? shift.Q : Math.max(0.7, Math.min(0.95, 0.95 - 0.6 * Math.max(0, 0.9 - cx) - 0.4 * Math.max(0, 0.8 - otp)));
    // disruption cost per passenger (2025 ₹): penalties to airlines, passenger care and fuel claims from the shift's ledger
    var dis = null;
    var m = shift.money, pax = shift.pax;
    if (m && m.lines && pax > 0) {
      var c = 0;
      m.lines.forEach(function (l) { if (/penalty|sla|care|fuel/.test(l.key || '')) c += Math.abs(l.amount || 0); });
      dis = c * 1e7 / pax;
    }
    if (dis == null || !isFinite(dis)) dis = 60 + 400 * Math.max(0, 0.85 - otp) + 300 * Math.max(0, 0.9 - cx);
    dis = Math.max(40, Math.min(250, dis));
    // service quality: four groups at 1% each, 1.25% bonus when everything is at the 3-star line (design/eras.md §6)
    var sq;
    if (stars >= 3 && safety >= 90) sq = -0.0125;
    else {
      var fails = (otp < 0.8 ? 2 : otp < 0.85 ? 1 : 0) + (cx < 0.85 ? 1 : 0) + (safety < 90 ? 1 : 0) + (stars < 2 ? 1 : 0);
      sq = Math.min(0.05, Math.max(0.01, 0.01 * fails));
    }
    var opex = stars >= 3 ? 1.0 : stars === 2 ? 1.02 : stars === 1 ? 1.05 : 1.06;
    return {Q: Q, dis: dis, sq: sq, star: star, opex: opex};
  }

  // ---------------------------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------------------------
  function partners() {
    var cfg = (typeof window !== 'undefined' && window.ZMMoney && window.ZMMoney.cfg) || {};
    var co = (cfg.coinvestor && cfg.coinvestor.name) || 'NIIF: National Investment and Infrastructure Fund';
    return [
      {name: 'Your company', pct: 64, color: '#c8a46a', role: 'Promoter. Builds, finances and runs the airport.'},
      {name: co, pct: 16, color: '#23305e', role: 'Co-investor. Puts in money beside you.'},
      {name: 'Airports Authority of India', pct: 10, color: '#1d1f22', role: 'State partner'},
      {name: 'State of Maharashtra, through MADC', pct: 10, color: '#1f3a8a', role: 'Gives the land on a nominal lease'}];
  }
  function bidTypes() {
    ensure();
    var aai = P.ppf_aai || {};
    return {
      share: {min: 10, max: 50, step: 0.1, def: 15, benchmarks: [{name: 'Navi Mumbai', val: +(P.rev_share.low * 100).toFixed(1)}, {name: 'Mumbai', val: 38.7}, {name: 'Delhi', val: +(P.rev_share.high * 100).toFixed(2)}]},
      ppf: {min: 100, max: 450, step: 1, def: 180, benchmarks: [{name: 'Bhubaneswar (lowest 2019 bid)', val: aai.IXE || 115}, {name: 'Ahmedabad', val: aai.AMD || 177}, {name: 'Noida (Jewar)', val: Math.round(P.ppf_noida || 401)}]}};
  }
  function scenarioFrom(o) {
    o = o || {};
    var bid = o.bid || {type: 'share', value: 15};
    var g = o.gearing != null ? o.gearing : 70; if (g > 1) g /= 100;
    g = Math.min(0.75, Math.max(0.60, g));   // the player borrows 60–75%; the banks' own sizing for 1C/1D and phase 2 is separate
    var sl = o.state_loan != null ? o.state_loan : o.stateLoan;   // onboarding hands back stateLoan
    return {gearing: g, phase1: o.phase1 === 'big' ? 'big' : 'lean', state_loan: sl !== false, defer_state_loan: o.defer_state_loan !== false,
      lender: (housesReady(), P.lenders[o.lender]) ? o.lender : 'banks', construction: null, ac_year: null,
      profile: (o.repayment === 'equal' || o.profile === 'equal') ? 'equal' : 'sculpt', bid: {type: bid.type === 'ppf' ? 'ppf' : 'share', value: +bid.value},
      stance0: o.aera === 'hard' ? 'hard' : 'normal', refi: o.refi !== false, cure: !!o.cure, p2year: o.p2year || null, eraOps: {}, boards: {}, appeals: []};
  }
  // phase 1's cost in today's money (FY2026 prices): lean 45 or big 70 million passengers a year (money.json capex.stages)
  function capexCr(phase1) { ensure(); return P.vsi_stages['1A_' + (phase1 === 'big' ? 'big' : 'lean')].cost; }
  function phase1Options() {
    ensure();
    var L = P.vsi_stages['1A_lean'], B = P.vsi_stages['1A_big'];
    return {def: 'lean', options: [
      {id: 'lean', label: L.cap + ' million passengers a year', small: 'build more when Mumbai’s widebodies and Delhi’s banks arrive', capexCr: L.cost},
      {id: 'big', label: B.cap + ' million passengers a year', small: 'build more now: ' + cr(B.cost - L.cost) + ' more up front', capexCr: B.cost}]};
  }
  function stateLoanOpt() {
    ensure();
    var t = P.state_loan_terms;
    return {pct: Math.round(t.share_of_built_cost * 10000) / 100, def: true, text: 'interest-free, repaid in ' + t.instalments + ' yearly parts from year ' + t.first_year_after_close};
  }
  function lenderOptions() {
    ensure();
    var r = P.rate, a = P.vsi_loan_terms['1A'], d = P.lenders.dollar || {}, n = P.lenders.infra || {};
    return {def: 'banks', options: [
      {id: 'banks', who: 'Indian banks', label: 'Indian banks, in rupees', small: r + '% interest, repaid over ' + a.years + ' years'},
      {id: 'dollar', who: 'bondholders abroad', label: 'dollar bonds sold abroad', small: (r + (d.rate_delta || 0)) + '% interest, but if the rupee falls, every repayment grows'},
      {id: 'infra', who: 'India\'s infrastructure bank', label: 'India\'s infrastructure bank', small: 'about ' + (r + (n.rate_delta || 0)) + '%, repaid over ' + (a.years + (n.years_add || 0)) + ' years, so each payment is smaller'},
      {id: 'private', who: 'private capital', label: 'private capital, from a family network', small: 'four family lenders; pitch one, and the terms depend on the pitch'}]};
  }
  // share-equivalent of a bid: the fee over base-case gross revenue (per-passenger bids converted at the base case)
  function shareEquiv(bid) {
    if (bid.type === 'share') return bid.value / 100;
    // base-case CP1-ish revenue per passenger ~ ₹1,150 (design/onboarding.md S3); international pays 2×, ~19% international
    return bid.value * 1.19 / 1150;
  }
  function previewBid(bid) {
    ensure();
    var se = shareEquiv(bid) * 100;
    // rivals cluster 12–21% (design/onboarding.md S3): a smooth win chance over that band
    var winPct = Math.round(winChance(Math.round(se * 10) / 10) * 100);   // the tender simulated 1,500 times
    winPct = Math.max(1, Math.min(99, winPct));
    var note = se < 13 ? 'Below what the rivals are likely to offer: you would probably lose the tender.' :
      se < 16 ? 'Close to the rivals. A fair chance, and the airport keeps a healthy share of what it earns.' :
      se < 22 ? 'Likely to win. AAI takes this share of every rupee for 60 years, so the margin is thinner.' :
      'Almost certain to win, but this much to AAI for 60 years leaves little for the loans and for you.';
    if (bid.type === 'ppf') note = 'About ' + se.toFixed(1) + '% of what the airport earns. ' + note;
    return {winPct: winPct, note: note};
  }
  // THE TENDER, simulated. Each rival values the whole project its own way: the largest share of the airport's income it
  // could pay AAI and still earn its cost of capital on the whole project (debt and equity together, 7.5 to 8.5%), given its view of traffic (the base case's income, running and opening
  // costs, renewals and the phase-1-to-phase-2 construction spend, discounted at the hurdle). It then shades that ceiling
  // by its strategy, and each tender adds forecast noise. The desk's odds are the same simulation, run 1,500 times.
  var BIDDERS = [
    {name: 'Adani Airport Holdings', hurdle: 0.075, traffic: 1.08, shade: 0.62, sd: 0.07, style: 'Bids for growth: an optimistic traffic view and a lower hurdle.'},
    {name: 'GMR Airports', hurdle: 0.080, traffic: 1.00, shade: 0.86, sd: 0.07, style: 'Protects its Hyderabad hub: bids the base case, and a little hungrier when the centre of India is at stake.'},
    {name: 'Zurich Airport International', hurdle: 0.085, traffic: 0.96, shade: 0.95, sd: 0.06, style: 'Disciplined: a cautious traffic view and a high hurdle.'}];
  var _ceil = null;
  function rivalCeilings() {
    if (_ceil) return _ceil;
    ensure();
    var base = newCampaign({parent: 'Base case', founder: 'Base case', signature: 'data:,', signedOn: '2026-04-01', bid: {type: 'share', value: 0.01}, gearing: 70}, 1);
    var sim = simulate(base.s, 60), rows = sim.rows || sim, cpi = P.cpi_forward || 0.04;
    var capex = {}; Object.keys(P.vsi_stages || {}).forEach(function (k) {
      if (k === '1A_big') return; var st = P.vsi_stages[k], sp = st.spend || {}, tot = 0; Object.keys(sp).forEach(function (y) { tot += sp[y]; });
      Object.keys(sp).forEach(function (y) { var yy = +y; capex[yy] = (capex[yy] || 0) + st.cost * sp[y] / (tot || 1) * Math.pow(1 + cpi, yy); }); });
    _ceil = BIDDERS.map(function (b) {
      var pvIn = 0, pvNet = 0;
      for (var y = 1; y <= 60; y++) {
        var r = rows[y - 1] || {}, d = Math.pow(1 + b.hurdle, -y), oi = (r.oi || 0) * b.traffic, op = (r.opex || 0) * (0.5 + 0.5 * b.traffic);
        pvIn += oi * d; pvNet += (oi - op - (r.opening || 0) - (r.renew || 0) - (capex[y] || 0)) * d;
      }
      return Math.max(0.05, Math.min(0.40, pvNet / (pvIn || 1)));
    });
    return _ceil;
  }
  function rng(seed) {   // mulberry32, seeded through a splitmix-style mix so nearby seeds don't give correlated draws
    var x = (Math.abs(Math.floor(+seed || 1)) ^ 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; var a = (x ^ (x >>> 16)) >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function normal(r) { var u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function rivalOffers(seed) {
    var c = rivalCeilings(), r = rng(seed);
    return BIDDERS.map(function (b, i) { var pct = c[i] * b.shade * Math.exp(b.sd * normal(r)) * 100;
      return {name: b.name, pct: Math.round(Math.min(40, Math.max(10, pct)) * 10) / 10, style: b.style}; });
  }
  function winChance(se) { var w = 0, N = 1500; for (var i = 1; i <= N; i++) { var o = rivalOffers(i * 7919 + 13), m = 0; o.forEach(function (x) { if (x.pct > m) m = x.pct; }); if (se > m) w++; } return w / N; }
  function bidRivals() {   // the market study: each rival's likely range (10th to 90th percentile of its offers)
    var all = BIDDERS.map(function () { return []; });
    for (var i = 1; i <= 800; i++) rivalOffers(i * 104729 + 7).forEach(function (o, k) { all[k].push(o.pct); });
    return BIDDERS.map(function (b, k) { var a = all[k].sort(function (x, y) { return x - y; });
      return {name: b.name, low: a[Math.floor(a.length * 0.1)], high: a[Math.floor(a.length * 0.9)], style: b.style}; });
  }
  function bidOpening(bid, seed) {
    ensure();
    var se = Math.round(shareEquiv(bid) * 1000) / 10, rivals = rivalOffers(seed).sort(function (x, y) { return y.pct - x.pct; });
    var best = rivals[0].pct, won = se > best, top = rivals[0];
    return {won: won, yours: se, best: best, winner: won ? null : top.name, rivals: rivals, margin: Math.round((se - best) * 10) / 10,
      line: won ? 'Your offer is the highest. The Authority awards the concession to you.' :
        top.name + ' offered ' + best + '% of everything the airport earns, more than your ' + se + '%. The concession goes to them.'};
  }
  // PRIVATE CAPITAL: four family lenders outside the banks (the user's copy, 20 Oct 2026). Each is written as a business paper
  // would describe a respected lender: about the deal only. Terms move the loan's rate (percentage points) and tenor (years).
  // The pitch: three angles. Preferred angle: better offer or accept (never a rejection). Neutral: accept or harder terms.
  // Worst: harder terms or a rejection. The roll is seeded from the deal (company, director, house, angle), so it never changes.
  var HOUSES = [
    {id: 'chettiar', name: 'Devakottai Chettiar Capital Network', sub: 'the Nagarathar Ledger House', home: 'Devakottai, Tamil Nadu',
      rate: -0.25, years: 4, better: {rate: -0.6, years: 11}, likes: 'long', worst: 'idea',
      bio: 'A network of family lenders from Devakottai with roots in the Nattukottai Chettiar banking houses that financed trade across Burma, Ceylon and Malaya in the early twentieth century. It lends for long periods against steady, predictable cash flows and keeps unusually detailed accounts of every loan it holds.',
      opening: 'Show us the passenger-fee account. Not the forecast. The actual collection mechanism. Our grandfathers lent against teak that never left Rangoon. We still expect the money to arrive on the date written. If one instalment slips, the charge is enforced.',
      who: 'Family lenders who lend for decades against steady fees.', want: 'Show us a repayment schedule you can keep.', face: {skin: '#b77a4f', hair: '#e8e4dc', hairStyle: 'bald', glasses: true, moustache: true, shirt: '#f4efe3'},
      lines: {done: {t: 'Adhu kanakku pramanam.', m: 'That is the rule of the ledger.'}, harder: {t: 'Late aana, kaasu varadhu.', m: 'If it is late, the money does not come.'}, no: {t: 'Late aana, kaasu varadhu.', m: 'If it is late, the money does not come.'}},
      pitch: 'Bring audited accounts and a repayment schedule you can keep. Explain how the passenger fee is collected and when it arrives. Expect a question on every line.',
      accept: 'Long, steady repayment schedules; first claim on the passenger-fee account; conservative traffic forecasts.',
      refuse: 'Repayments that depend on raising more money later; large final payments; any late instalment.',
      invest: 'Infrastructure that earns a regulated or contracted fee: toll roads, ports, power lines and airports.',
      out: {accept: {stamp: 'APPROVED', reply: 'The schedule holds and the collection account is real. We will expect the first instalment on the date written, not the day after.'},
        better: {stamp: 'BETTER OFFER', reply: 'You came with a ledger, not a story. We will go longer than you asked.', extra: 'First claim on the passenger-fee account, and our partner sits on your audit committee for the life of the loan.'},
        harder: {stamp: 'HARDER TERMS', reply: 'You brought us a forecast. We lend against collections. We will lend, but for less time and at a higher rate.', extra: 'A shorter term until the passenger-fee account shows two clean years of collections.'},
        reject: {stamp: 'DECLINED', reply: 'A loan repaid by the next loan is not a loan we make. Come back when the schedule stands on its own.', extra: 'Repayment depends on money you have not raised yet.'}},
      flow: {bounds: [70, 108, -2, 26], nodes: {dev: {label: 'Devakottai', x: 290, y: 245}, che: {label: 'Chennai', x: 430, y: 165}, sin: {label: 'Singapore', x: 560, y: 285}, vsi: {label: 'VSI, Nagpur', x: 290, y: 55}},
        beats: [{caption: 'The Devakottai partners open the ledger: the accounts and the schedule.', add: ['dev'], edges: [], mark: {at: 'dev', kind: 'ledger'}},
          {caption: 'Partner families in Chennai and Singapore each send their share to the pool.', add: ['che', 'sin'], edges: [{from: 'che', to: 'dev', share: 0.4, kind: 'money'}, {from: 'sin', to: 'dev', share: 0.25, kind: 'money'}]},
          {caption: 'A charge over VSI\'s passenger-fee account is drawn as a line back to Devakottai.', add: ['vsi'], edges: [{from: 'vsi', to: 'dev', kind: 'charge', label: 'charge over the passenger-fee account'}]},
          {caption: 'The credit committee signs line by line, and the loan moves to VSIAL\'s account.', add: [], edges: [{from: 'dev', to: 'vsi', share: 1, kind: 'money'}], mark: {at: 'dev', kind: 'sign'}}]}},
    {id: 'sanchore', name: 'Sanchori Jain Samaj Capital', home: 'Sanchore, Rajasthan, with offices in Chennai and Mumbai',
      rate: 0.25, years: -2, better: {rate: -0.5, years: 2}, likes: 'numbers', worst: 'long',
      bio: 'A capital pool of family businesses from Sanchore, many of them established names in India\'s steel and construction-materials trade. It lends quickly and prices for that speed, and it prefers projects whose construction it understands in detail.',
      opening: 'Quantities. Suppliers. Drawdown dates. We did not build steel mills by waiting for committees. If the first milestone is clean, the money moves the same afternoon.',
      who: 'Builders\' money: quick to decide, a little more expensive.', want: 'Bring quantities, suppliers and dates.', face: {skin: '#c08a5e', hair: '#2b2622', hairStyle: 'short', moustache: true, shirt: '#e9d7b0'},
      lines: {done: {t: 'Saudo pakko. Kaam suru karo.', m: 'The deal is firm. Start the work.'}, harder: {t: 'Paisa ri keemat bhi badlasi.', m: 'The price of the money changes too.'}, no: {t: 'Scope badlyo to nayo saudo.', m: 'Change the scope and it becomes a new deal.'}},
      pitch: 'Bring the construction programme: quantities, suppliers and dates. Show how the loan is drawn as the works progress. Be ready to decide in the meeting.',
      accept: 'Loans drawn against construction milestones; fast decisions; clear material and supplier plans.',
      refuse: 'Open-ended drawdowns; repeated changes of scope; long approval chains.',
      invest: 'Construction, logistics parks, warehousing and industrial infrastructure.',
      out: {accept: {stamp: 'APPROVED', reply: 'Quantities are clear and the suppliers are named. The first draw moves the afternoon the first milestone is signed.'},
        better: {stamp: 'BETTER OFFER', reply: 'You decided in the room. We like that. We will lend for longer than you asked.', extra: 'First right to lease the cargo terminal for 15 years, and phase-1 steel supplied by our members at an audited market price.'},
        harder: {stamp: 'HARDER TERMS', reply: 'Too much vision, not enough quantities. We will lend, but milestone by milestone, at a higher rate.', extra: 'Each draw waits for an engineer\'s certificate on the previous milestone.'},
        reject: {stamp: 'DECLINED', reply: 'Thirty years is a long time to wait for an answer you could give us today. We do not lend into a committee.', extra: 'No dates, no milestones, and a decision that needs another meeting.'}},
      flow: {bounds: [66, 86, 8, 30], nodes: {san: {label: 'Sanchore', x: 120, y: 70}, mum: {label: 'Mumbai', x: 150, y: 220}, che: {label: 'Chennai', x: 420, y: 285}, vsi: {label: 'VSI, Nagpur', x: 440, y: 120}},
        beats: [{caption: 'Sanchore and Chennai member firms check the construction programme.', add: ['san', 'che'], edges: [{from: 'che', to: 'san', kind: 'ink', label: 'programme checked'}]},
          {caption: 'The Mumbai offices commit the same day.', add: ['mum'], edges: [{from: 'mum', to: 'san', share: 0.45, kind: 'money'}]},
          {caption: 'The members\' guarantees pool into one.', add: [], edges: [{from: 'che', to: 'san', share: 0.3, kind: 'money'}], mark: {at: 'san', kind: 'pool'}},
          {caption: 'The money is released to the first construction milestone.', add: ['vsi'], edges: [{from: 'san', to: 'vsi', share: 1, kind: 'money'}], mark: {at: 'vsi', kind: 'milestone'}}]}},
    {id: 'palanpuri', name: 'Palanpuri Jain Samaj Capital', home: 'Palanpur, Mumbai and Antwerp',
      rate: -0.5, years: 2, better: {rate: -0.75, years: 3}, likes: 'long', worst: 'idea',
      bio: 'A capital pool of family firms from Palanpur, many of them long established in the diamond trade between Mumbai and Antwerp. It is known for lending on the strength of long relationships and for keeping commitments made in a single meeting.',
      opening: 'We have already met the management team. The numbers are acceptable. What we need is the understanding that the people sitting across from us will still be the people running it in year seven.',
      who: 'Family firms who lend on trust and long relationships.', want: 'Bring honest numbers, and the team that will stay.', face: {skin: '#c99670', hair: '#3a302a', hairStyle: 'bun', glasses: true, shirt: '#dfe6ee'},
      lines: {done: {t: 'Aa haath malavyo chhe, aanu mol raakhjo.', m: 'This is a handshake. Keep its value.'}, harder: {t: 'Vishvas todsho to dhandho bandh.', m: 'Break the trust and the business ends.'}, no: {t: 'Vishvas todsho to dhandho bandh.', m: 'Break the trust and the business ends.'}},
      pitch: 'Bring clean, conservative numbers and the people who will run the airport. They judge the management team as closely as the model; an overstated forecast ends the conversation.',
      accept: 'Conservative forecasts; experienced management; long relationships and repeat business.',
      refuse: 'Debt stacked on debt; aggressive forecasts; replacing the management team after the loan is made.',
      invest: 'Real estate, retail, logistics and long-term infrastructure.',
      out: {accept: {stamp: 'APPROVED', reply: 'The numbers are honest and the team will stay. The documents follow the handshake.'},
        better: {stamp: 'BETTER OFFER', reply: 'You did not inflate a single number. That is rare. We will give you better than you asked.', extra: 'The families approve your chief executive for ten years, and the airside luxury retail is leased to us for 15 years at a fixed rent.'},
        harder: {stamp: 'HARDER TERMS', reply: 'The forecast is louder than the people behind it. We will lend, but for a shorter term.', extra: 'A shorter term, and a review of the management team in year three.'},
        reject: {stamp: 'DECLINED', reply: 'Ten times bigger is a promise, not a plan. We lend to people and their records, and today we have only the promise.', extra: 'An aggressive forecast with no track record behind it.'}},
      flow: {bounds: [-2, 88, 10, 56], nodes: {ant: {label: 'Antwerp', x: 70, y: 55}, pal: {label: 'Palanpur', x: 300, y: 85}, sur: {label: 'Surat', x: 250, y: 180}, mum: {label: 'Mumbai', x: 300, y: 270}, vsi: {label: 'VSI, Nagpur', x: 520, y: 190}},
        beats: [{caption: 'The Mumbai partners meet your management team.', add: ['mum', 'vsi'], edges: [{from: 'vsi', to: 'mum', kind: 'ink', label: 'the management team'}], mark: {at: 'mum', kind: 'table'}},
          {caption: 'Members in Antwerp and Surat commit their shares on one call.', add: ['ant', 'sur'], edges: [{from: 'ant', to: 'mum', share: 0.35, kind: 'money'}, {from: 'sur', to: 'mum', share: 0.3, kind: 'money'}]},
          {caption: 'The Palanpur partners approve the family guarantee.', add: ['pal'], edges: [{from: 'pal', to: 'mum', kind: 'ink', label: 'family guarantee'}]},
          {caption: 'A handshake. The money moves to VSIAL, and the documents follow.', add: [], edges: [{from: 'mum', to: 'vsi', share: 1, kind: 'money'}, {from: 'mum', to: 'vsi', kind: 'docs', label: 'documents follow'}], mark: {at: 'mum', kind: 'handshake'}}]}},
    {id: 'negev', name: 'Negev Runway Partners', home: 'Tel Aviv and Herzliya',
      rate: 0, years: 3, better: {rate: -0.5, years: 4}, likes: 'idea', worst: 'long',
      bio: 'Former air-force engineers turned founders. They taught a desert to grow tomatoes and to recycle nine-tenths of its water, and they think your airport is a startup with a sixty-year runway. They will interrupt your pitch in the first minute, and that means they like you.',
      opening: 'Why is the terminal only this size? We turned a desert into an export industry. You are building an airport with a sixty-year life. Give us a live test strip on the apron for the tugs and the drones.',
      who: 'Engineers turned investors who back bold technology.', want: 'Bring a working pilot, not a slide deck.', face: {skin: '#d9a982', hair: '#4a2f22', hairStyle: 'curly', shirt: '#cfe0d6'},
      lines: {done: {t: 'Yalla, bonim.', m: 'Come on, let us build.'}, harder: {t: 'Tachles: ten times, or nothing.', m: 'Bottom line: ten times, or nothing.'}, no: {t: 'Im zeh lo gadol, anachnu lo kan.', m: 'If it is not big, we are not here.'}},
      pitch: 'Be blunt. Bring a demo, not a deck. When they ask "yes, but why not ten times bigger?", have an answer.',
      accept: 'Bold technology, fast pilots, being told no and arguing back.',
      refuse: 'Hierarchy, slow committees, a plan that has never been tested.',
      invest: 'Water recycling, drones, cyber security, and airport technology they can sell to fifty other airports.',
      out: {accept: {stamp: 'APPROVED', reply: 'Good. A real pilot and a real number. We want the first data from your apron within six months.'},
        better: {stamp: 'BETTER OFFER', reply: 'Finally, someone who asked why not bigger before we did. We will beat your ask.', extra: 'A live test strip on your apron for our driverless tugs and drone inspections, and the right to sell what we learn to other airports.'},
        harder: {stamp: 'HARDER TERMS', reply: 'Nice numbers. No pilot. We will lend, but shorter, until something on your apron proves it.', extra: 'The term is extended only after the first pilot has run live for a year.'},
        reject: {stamp: 'DECLINED', reply: 'Sixty years of patience is not a pitch. Show us something running and call us again.', extra: 'No pilot, no test, and nothing we could sell to a second airport.'}},
      flow: {bounds: [-80, 90, 8, 48], nodes: {ny: {label: 'New York', x: 60, y: 100}, her: {label: 'Herzliya', x: 300, y: 70}, tlv: {label: 'Tel Aviv', x: 290, y: 175}, vsi: {label: 'VSI, Nagpur', x: 540, y: 245}},
        beats: [{caption: 'The Herzliya partners review the pilot plan.', add: ['her'], edges: [], mark: {at: 'her', kind: 'ledger'}},
          {caption: 'A water-technology fund in Tel Aviv joins.', add: ['tlv'], edges: [{from: 'tlv', to: 'her', share: 0.35, kind: 'money'}]},
          {caption: 'Two co-investors in New York commit.', add: ['ny'], edges: [{from: 'ny', to: 'her', share: 0.4, kind: 'money'}]},
          {caption: 'The term sheet travels to Nagpur, with a test strip drawn on the apron.', add: ['vsi'], edges: [{from: 'her', to: 'vsi', share: 1, kind: 'money'}, {from: 'her', to: 'vsi', kind: 'docs', label: 'term sheet'}], mark: {at: 'vsi', kind: 'strip'}}]}}];
  var ANGLES = {long: 'The long view: trust, family and decades', numbers: 'The numbers: cash, tonnes and dates', idea: 'The big idea: technology, scale and ten times more'};
  function housesReady() {
    ensure();
    HOUSES.forEach(function (h) {
      P.lenders[h.id] = {rate_delta: h.rate, years_add: h.years};
      P.lenders[h.id + '+'] = {rate_delta: h.better.rate, years_add: h.better.years};
      P.lenders[h.id + '-'] = {rate_delta: h.rate + 0.5, years_add: h.years - 3};
    });
  }
  function privateHouses() { housesReady(); return {angles: ANGLES, houses: HOUSES.map(function (h) { return JSON.parse(JSON.stringify(h)); })}; }
  function pitchPrivate(id, angle, seed) {
    housesReady();
    var h = HOUSES.filter(function (x) { return x.id === id; })[0]; if (!h) return null;
    var r = rng(seed || 1)(), kind = angle === h.likes ? 'preferred' : angle === h.worst ? 'worst' : 'neutral';
    var outcome = kind === 'preferred' ? (r < 0.5 ? 'better' : 'approved') : kind === 'worst' ? (r < 0.5 ? 'negotiated' : 'rejected') : (r < 0.5 ? 'approved' : 'negotiated');
    var base = P.rate, terms = function (k) { var l = P.lenders[k]; return {lender: k, rate: Math.round((base + l.rate_delta) * 100) / 100, years: (P.vsi_loan_terms['1A'].years || 14) + l.years_add}; };
    var o = h.out[{better: 'better', approved: 'accept', negotiated: 'harder', rejected: 'reject'}[outcome]];
    return {id: h.id, house: h.name, angle: angle, fit: kind, outcome: outcome, stamp: o.stamp, reply: o.reply, extra: o.extra || null,
      approved: outcome === 'rejected' ? null : terms(h.id), better: outcome === 'better' ? terms(h.id + '+') : null,
      negotiated: outcome === 'negotiated' ? terms(h.id + '-') : null, rejected: outcome === 'rejected',
      ask: outcome === 'better' ? o.extra : null, line: o.reply};
  }
  var _closeCache = {};
  function closeFigures(s, sz) {   // phase 1's split, in today's money so it adds up to the price on the agreement
    var eng = build(s, sz.gear, s.profile === 'equal' ? {} : sz.scheds, true, false, null);
    var sg = eng.stage_list[0], today = capexCr(s.phase1), f = today / sg.cost;
    var debt = Math.round(sg.debt * f), sl = Math.round(eng.sl_amt * f), equity = today - debt - sl;   // rounded first, so the three add up exactly
    return {today: today, nominal: sg.cost, debtCr: debt, stateLoanCr: sl, equityCr: equity, parentCr: Math.round(equity * 0.64),
      debtNomCr: Math.round(sg.debt), eng: eng};
  }
  function sized(s) {
    var key = JSON.stringify([s.gearing, s.profile, s.bid, s.phase1, s.state_loan, s.lender]);
    if (!_closeCache[key]) _closeCache[key] = sizeDebt(s);
    return _closeCache[key];
  }
  function previewClose(o) {
    ensure();
    var s = scenarioFrom(o), sz = sized(s), q = closeFigures(s, sz);
    var asked = s.gearing, got = sz.gear[stageNames(s, false)[0]];
    var note = got < asked - 0.005 ? 'The banks will lend only ' + Math.round(got * 100) + '% of the cost on these numbers, not the ' + Math.round(asked * 100) + '% you asked for: the rest is your money.' :
      'The banks lend ' + Math.round(got * 100) + '% of the cost. More borrowing means a bigger return on your money, and less room in a bad year.';
    if (s.profile === 'equal') note += ' Equal payments are heaviest in the early years, so the banks lend less.';
    if (s.lender === 'dollar') note += ' Dollar bonds cost less interest, but if the rupee falls, every repayment grows.';
    if (s.lender === 'infra') note += ' The infrastructure bank gives you longer to repay, so each year\'s payment is smaller.';
    note += ' Paid as it is spent, with rising prices and interest while it is built, the bill comes to about ' + cr(q.nominal) + '.';
    return {debtCr: q.debtCr, equityCr: q.equityCr, parentCr: q.parentCr, stateLoanCr: q.stateLoanCr, capexCr: q.today,
      minDscr: sz.minBase != null ? Math.round(sz.minBase * 100) / 100 : null, note: note};
  }
  function newCampaign(ob, seed) {
    ensure();
    ob = ob || {};
    var s = scenarioFrom(ob);
    s.sizing = clone(sized(s));
    var st = {version: SAVE_VERSION, building: true, phase1: s.phase1, lender: s.lender, stateLoan: s.state_loan, parent: ob.parent || 'Meridian Infra', founder: ob.founder || '', signature: ob.signature || null,
      signedOn: ob.signedOn || null, endsOn: ob.endsOn || null, quick: !!ob.quick, seed: seed == null ? 1 : seed,
      bid: s.bid, gearing: s.gearing, repayment: s.profile === 'equal' ? 'equal' : 'sculpted',
      era: 1, year: 5, cash: 0, debt: [], stake: 64, history: [], over: false, s: s};
    if (ob.privateLoan && ob.privateLoan.house) {   // the private-capital pitch, logged (the finance group already credits the lender)
      st.privateLoan = ob.privateLoan; s.privateLoan = {house: ob.privateLoan.house, outcome: ob.privateLoan.outcome, condition: ob.privateLoan.ask || null};
      s.decisions = [{id: 'ch1-private', chapter: 1, group: 'finance', year: 0, chosen: ob.privateLoan.outcome, 'default': ob.privateLoan.outcome,
        label: 'Private capital: ' + ob.privateLoan.house + ' (' + ob.privateLoan.outcome + ')'}];
    }
    var eng = simulate(s, 4);
    st.debt = eng.c.tranches.map(function (tr) { return {name: tr.name, outCr: Math.round(tr.out)}; });
    st.cash = Math.round(eng.cash);
    return st;
  }
  function levelFor(state) { var e = state.era || 1; return e <= 4 ? e : 4; /* TODO Ship B: eras 5-12 play Level 5 */ }

  // What the airport is worth to its owners (money.json world.game_stake_pricing): EV = EBITDA × multiple × (1 − 1.075^−years
  // left), and a regulated airport never trades above ev_rab_check[1] × its asset base (AERA caps what the assets can earn).
  // Connections income (Chapter 5) is valued on top of that cap, at the multiple plus the growth premium for a network that
  // is still adding routes: the network is what an airport is worth beyond its regulated assets. Equity = EV − net debt.
  function stakeValue(eng, row) {
    var debt = eng.c.tranches.reduce(function (a, x) { return a + x.out; }, 0), sp = P.sp || {};
    var ev = 0;
    if (row) {
      var life = 1 - Math.pow(1 + (sp.life_rate || 0.075), -Math.max(0, 60 - row.year));
      var hubNet = Math.max(0, (row.hubInc || 0) - (row.hubCost || 0));
      // the asset base a buyer pays for: what is in service, or (if larger) what is in service next year, so a terminal
      // finished but opening next year counts at once; without this the stake looks to jump the year it opens (F5)
      var core = P.ev_multiple * Math.max(0, row.ebitda - hubNet) * life, rab = Math.max(eng.rab(row.t, false)[0], eng.rab(row.t + 1, false)[0]);
      if (rab > 0 && sp.ev_rab_check) core = Math.min(core, sp.ev_rab_check[1] * rab);
      var g = eng.c.hub_growth || 0, gBase = P.growth.cagr_by_era[Math.min(11, Math.floor((row.year - 1) / 5))];
      var prem = Math.min(sp.growth_prem_cap || 6, (sp.growth_prem_per_pp_over || 3) * Math.max(0, (g - gBase) * 100));
      ev = core + (P.ev_multiple + prem) * hubNet * life;
    }
    return Math.max(0, ev - debt - eng.sl_out + eng.cash + eng.dsra);
  }
  function eraReport(state, eng, e) {
    var ys = eraYears(e), rows = eng.rows.filter(function (r) { return r.year >= ys[1] && r.year <= ys[2]; });
    var s = state.s, worst = null, worstRow = null;
    rows.forEach(function (r) { if (r.dscr != null && (worst == null || r.dscr < worst)) { worst = r.dscr; worstRow = r; } });
    var repaid = rows.length > 0 && rows.reduce(function (a, r) { return a + r.ds; }, 0) < 0.02 * Math.max(1, rows.reduce(function (a, r) { return a + r.ebitda; }, 0));
    if (repaid) worst = null;
    var last = rows[rows.length - 1] || eng.rows[eng.rows.length - 1];
    var light = lightOf(worst);
    var sentences = [];
    var sum = function (k) { return rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0); };
    // AERA consequences in one plain sentence each
    eng.plans.forEach(function (p) {
      var y = p.t0 + 1;
      if (y < ys[1] || y > ys[2]) return;
      if (p.carried > 1) sentences.push('AERA held back ' + cr(p.carried) + ' of your passenger fees until after ' + (2025 + y + p.n) + ', because the new terminals came into its books all at once. The banks are watching.');
      if (p.bal_in > 1) sentences.push('AERA let you recover ' + cr(p.bal_in) + ' you were owed, spread over the next five years of fees.');
      if (p.bal_in < -1) sentences.push('AERA took back ' + cr(-p.bal_in) + ' you had over-collected, through lower fees for five years.');
      if (p.hard) sentences.push('Your appeal kept AERA from holding fees back, but fees stay flat for five years and airlines add fewer flights.');
    });
    var cn = s.construction;
    if (e === 1 && cn && cn.slipMonths) sentences.unshift('The airport opened ' + cn.slipMonths + ' months late, in ' + monthName(state.opensOn || addMonths(state.signedOn, 48 + cn.slipMonths)) + ', so its first year earned less while the loan interest fell due.');
    if (e === 1 && cn && cn.trials === 'short') sentences.push('Short trials before opening meant a rough first year: more penalties to airlines and more passenger care.');
    var opsE = s.eraOps[e] || {}, base = opsProfile('base', ys[1]);
    var disX = sum('dis'), opening = sum('opening');
    if (worst != null && worst < P.thr.warning) {
      var why = [];
      if (eng.plans.some(function (p) { return p.carried > 1 && p.t0 + 1 <= ys[2] && p.t0 + p.n >= ys[1]; })) why.push('AERA is holding back part of your fees while the new terminals for the Mumbai and Delhi flights open');
      if (opening > 1) why.push('opening new capacity cost ' + cr(opening) + ' before its passengers arrived');
      if (disX > 1 && opsE.dis > base.dis) why.push('delays and missed connections cost ' + cr(disX) + ' in penalties to airlines and passenger care');
      if (opsE.star < 0) why.push('airlines are adding flights elsewhere because yours leave late');
      if (eng.plans.some(function (p) { return p.hard && p.t0 + 1 <= ys[2] && p.t0 + p.n >= ys[1]; })) why.push('your appeal against AERA kept fees flat');
      if (s.gearing >= 0.72) why.push('you borrowed ' + Math.round(s.gearing * 100) + '% of the cost, so the loan payments are heavy');
      var head = worst < P.thr.step_in ? 'The banks warn you: in ' + (2025 + worstRow.year) + ' the airport could not cover its loan payments (' + coverWords(worst) + ').' :
        'The banks warn you: in ' + (2025 + worstRow.year) + ' the airport earned only ' + coverWords(worst).replace(' earned', '') + ', so no dividends this era.';
      sentences.push(head + (why.length ? ' Why: ' + why.slice(0, 2).join('; ') + '.' : ''));
    }
    eng.events.forEach(function (ev) {
      var y = ev.t + 1; if (y < ys[1] || y > ys[2]) return;
      if (ev.k === 'fx') sentences.push('The rupee fell ' + Math.round(ev.fall * 100) + '% against the dollar in ' + (2025 + y) + ', so every repayment on your dollar bonds grew by as much: ' + cr(ev.amt) + ' more to repay.');
      if (ev.k === 'refi') sentences.push('A stable record let you refinance ' + cr(ev.amt) + ' of loans at ' + P.refi.rate + '%, with two years before repayments start.');
      if (ev.k === 'cure_era' || ev.k === 'cure_ds') sentences.push('Your company put in ' + cr(ev.amt) + ' of fresh money to keep the banks from taking control.');
    });
    var spill = rows.reduce(function (a, r) { return a + Math.max(0, r.demand - r.pax); }, 0) / Math.max(1, rows.length);
    var served = rows.reduce(function (a, r) { return a + r.pax; }, 0) / Math.max(1, rows.length);
    if (spill > 0.03 * served) sentences.push('The terminals were full: about ' + Math.round(spill) + ' million passengers a year wanted to fly from VSI and could not.' + (!s.p2year && p2Offer(e) ? ' Phase 2 would make room.' : ''));
    if (repaid) sentences.push('The bank loans are fully repaid.');
    var bt = !!eng.step_in && eng.step_in.t + 1 <= ys[2];
    if (bt) sentences.push('The banks take control: ' + eng.step_in.why + '. Your company\'s stake is lost.');
    var sv = bt ? 0 : stakeValue(eng, last) * state.stake / 100;
    var flows = []; for (var t = 0; t <= (last ? last.t : 0); t++) flows.push(eng.eq_flows[t] || 0);
    if (flows.length && !bt) flows[flows.length - 1] += stakeValue(eng, last);
    var r = irr(flows);
    var chk = bt || !last ? null : stakeCheck(flows.map(function (f, t) { return t === flows.length - 1 ? (eng.eq_flows[t] || 0) : f; }), last.t, state.stake / 100, sv, r);
    var lockShare = eng.lockShare != null ? eng.lockShare : 0;
    var rev = sum('oi'), opexS = sum('opex'), feeS = sum('fee'), ebitda = sum('ebitda'), intS = sum('interest'), prinS = sum('principal'), taxS = sum('tax');
    var label = 'Era ' + e + ' · ' + (2025 + ys[1]) + '–' + (2025 + ys[2]);
    var inc = {band: label, title: state.parent + ': ' + (ys[2] - ys[1] + 1) + ' years of the airport',
      hero: '<b>' + coverWords(worst) + '</b> in the hardest year · your ' + state.stake + '% is worth ' + cr(sv),
      sections: [
        {title: 'What the airport earned', rows: [
          {label: 'Fees from airlines and passengers', amount: Math.round(rows.reduce(function (a, r) { return a + r.aero; }, 0)), kind: 'rev'},
          {label: 'Shops, food, parking and the hotel', amount: Math.round(rows.reduce(function (a, r) { return a + r.nar; }, 0)), kind: 'rev'}]},
        {title: 'What it cost', rows: [
          {label: 'Running the airport', amount: Math.round(opexS - disX - opening), kind: 'cost'},
          {label: 'Penalties to airlines and passenger care', amount: Math.round(disX), kind: 'cost'},
          {label: 'Opening new terminals', amount: Math.round(opening), kind: 'cost'},
          {label: 'Fee to AAI and the government', amount: Math.round(feeS), kind: 'cost'},
          {label: 'Operating profit', amount: Math.round(ebitda), kind: ebitda >= 0 ? 'good' : 'bad'}]},
        {title: 'The banks', rows: [
          {label: 'Interest', amount: Math.round(intS), kind: 'cost'},
          {label: 'Loan repaid', amount: Math.round(prinS), kind: 'cost'},
          {label: 'Tax', amount: Math.round(taxS), kind: 'cost'},
          {label: 'Loan cover in the hardest year', amount: coverWords(worst), kind: light === 'green' ? 'good' : 'bad'},
          {label: 'Cash in hand', amount: Math.round(eng.cash), kind: 'total'}]}],
      moments: sentences.slice(0, 3), cta: bt ? 'See the end' : 'To the board meeting'};
    // a line that is zero this era (no tax yet, no penalties) is left out rather than printed as ₹0.0 L
    inc.sections.forEach(function (sec) { sec.rows = sec.rows.filter(function (r) { return !((r.kind === 'cost' || r.kind === 'rev') && typeof r.amount === 'number' && Math.abs(r.amount) < 1); }); });
    // F1/F4: the same page as ZMMoney.bill, every figure in one labelled period (the era), balances at its end
    var per = cal(ys[1]) + '–' + String(cal(ys[2])).slice(2), endW = 'at the end of ' + cal(ys[2]);
    var earnedS = rows.reduce(function (a, r) { return a + r.aero + r.nar; }, 0);
    var para = 'Over ' + per + ' the airport earned ' + cr(earnedS) + ' from fees and shops, and ' + cr(ebitda) + ' after running costs and the fee to AAI. ' +
      (worst == null ? 'No loan payments fell due. ' : 'Its hardest year, ' + cal(worstRow.year) + ', ' + coverWords(worst).replace('₹', 'earned ₹').replace(' earned for', ' for') + ' to the banks. ') +
      (bt ? 'The banks took control, and your company\'s stake is lost.' : stakeSentence(state.parent, state.stake, sv, chk, endW));
    var bill = asBill(inc, {per: per, at: endW, date: ch5Date(state, ys[2]).iso, paragraph: para,
      cover: {ratio: worst == null ? null : Math.floor(worst * 100 + 1e-9) / 100, words: coverWords(worst), light: light, year: worstRow ? cal(worstRow.year) : null},
      stake: {pct: state.stake, valueCr: Math.round(sv), year: cal(ys[2]), returnPct: r == null ? null : Math.round(r * 1000) / 10, check: chk}});
    return {eraLabel: label, era: e, years: [ys[1], ys[2]], calendar: [2025 + ys[1], 2025 + ys[2]], light: light,
      coverWorst: worst == null ? null : Math.round(worst * 100) / 100, coverWorstExact: worst, coverWords: coverWords(worst), worstYear: worstRow ? worstRow.year : null,
      todayCr: Math.round(eng.cash), cashCr: Math.round(eng.cash), stakePct: state.stake, stakeValueCr: Math.round(sv),
      debtCr: Math.round(eng.c.tranches.reduce(function (a, x) { return a + x.out; }, 0)), returnPerYear: r == null ? null : Math.round(r * 1000) / 10,
      payoutShare: lockShare, sentences: sentences, banksTookControl: bt, incomeStatement: inc, bill: bill, stakeCheck: chk,
      rows: rows.map(function (r) { return {year: r.year, paxM: Math.round(r.pax * 10) / 10, cover: r.dscr == null ? null : Math.round(r.dscr * 100) / 100, ebitdaCr: Math.round(r.ebitda)}; })};
  }

  function applyShift(state, shift) {
    ensure();
    state = clone(state);
    if (state.over) return {state: state, report: null};
    var e = state.era, ys = eraYears(e);
    state.s.eraOps[e] = shiftOps(shift, ys[1]);
    var eng = simulate(state.s, ys[2]);
    var rep = eraReport(state, eng, e);
    state.cash = rep.cashCr;
    state.debt = eng.c.tranches.filter(function (x) { return x.out > 0.5; }).map(function (x) { return {name: x.name, outCr: Math.round(x.out)}; });
    state.history.push({era: e, level: shift && shift.level, stars: shift && shift.stars, otp: shift && shift.otp, cx: shift && shift.cx, safety: shift && shift.safety,
      light: rep.light, cover: rep.coverWorst, cashCr: rep.cashCr, stakeValueCr: rep.stakeValueCr, debtCr: rep.debtCr, sentences: rep.sentences});
    state.year = ys[2];
    var so = 0, sr = 0; eng.c.tranches.forEach(function (x) { if (x.out > 0.5) { so += x.out; sr += x.out * x.rate; } });
    state.lastReport = {light: rep.light, cover: rep.coverWorst, payoutShare: rep.payoutShare, debtCr: rep.debtCr, worstYear: rep.worstYear,
      stakeValueCr: rep.stakeValueCr, returnPerYear: rep.returnPerYear, ratePct: so > 0 ? Math.round(sr / so * 10) / 10 : null};
    if (rep.banksTookControl || ys[2] >= 60) {
      state.over = rep.banksTookControl ? {reason: 'banks', year: eng.step_in.t + 1} : {reason: 'handback', year: 60};
      state.final = finalOf(state, eng);
    }
    return {state: state, report: rep};
  }
  // the player's own share of the company's money in and out, year by year (Chapters 6-7 can change the stake: L5 putting in
  // the cure money, the player buying L5 out). Each keyed by the chapter that made it, so the debrief can swap one out:
  // s.stakeBy {key: {from, pct}}; s.injectBy {key: {year, cr, by: 'player'|'l5'}} (fresh money into the company, nominal ₹ cr,
  // all of it from one party); s.paysBy {key: {year, cr}} (paid by the player to another owner, not into the company)
  function vals(o) { return o ? Object.keys(o).map(function (k) { return o[k]; }).filter(Boolean) : []; }
  function stakeDef(state) { return state.s && state.s.stake0 != null ? state.s.stake0 : state.stake; }
  function pctAt(s, year, def) { var p = def, at = -1; vals(s.stakeBy).forEach(function (x) { if (x.from <= year && x.from >= at) { p = x.pct; at = x.from; } }); return p; }
  function playerFlows(s, flows, def) {
    var injAll = {}, injP = {}, pay = {};
    vals(s.injectBy).forEach(function (x) { injAll[x.year - 1] = (injAll[x.year - 1] || 0) + x.cr; if (x.by === 'player') injP[x.year - 1] = (injP[x.year - 1] || 0) + x.cr; });
    vals(s.paysBy).forEach(function (x) { pay[x.year - 1] = (pay[x.year - 1] || 0) + x.cr; });
    return flows.map(function (f, t) { return (f + (injAll[t] || 0)) * pctAt(s, t + 1, def) / 100 - (injP[t] || 0) - (pay[t] || 0); });
  }
  function companyFlows(eng) {
    var flows = []; for (var t = 0; t < 60; t++) flows.push(eng.eq_flows[t] || 0);
    var lastRow = eng.rows[eng.rows.length - 1];
    if (!eng.step_in && lastRow) flows[flows.length - 1] += Math.max(0, eng.cash + eng.dsra - lastRow.debt - eng.sl_out);
    return flows;
  }
  function finalOf(state, eng) {
    var lastRow = eng.rows[eng.rows.length - 1], s = state.s || {}, def = stakeDef(state);
    var pf = playerFlows(s, companyFlows(eng), def);
    var inv = 0, ret = 0; pf.forEach(function (f) { if (f < 0) inv -= f; else ret += f; });
    var r = eng.step_in ? null : irr(pf);
    var paxM = 0, fees = 0, repaidYear = null, divs = 0;
    eng.rows.forEach(function (rw) { paxM += rw.pax; fees += rw.fee; divs += (rw.div || 0) * pctAt(s, rw.year, def) / 100; if (repaidYear == null && rw.t >= 4 && rw.debt < 1) repaidYear = rw.year; });
    var residual = eng.step_in || !lastRow ? 0 : Math.max(0, eng.cash + eng.dsra - lastRow.debt - eng.sl_out);
    return {irr: r, investedCr: Math.round(inv), returnedCr: Math.round(ret), dividendsCr: Math.round(divs), stakePct: pctAt(s, 60, def),
      debtRepaid: !eng.step_in && lastRow && lastRow.debt < 1, banks: !!eng.step_in,
      paxTotalM: Math.round(paxM), paidToStateCr: Math.round(fees), residualCr: Math.round(residual * pctAt(s, 60, def) / 100), repaidYear: repaidYear,
      p2: !!state.s.p2year, ac: !!state.s.ac_year};
  }

  function boardOptions(state) {
    ensure();
    var e = state.era, ys = eraYears(e), lr = state.lastReport || {}, s = state.s;
    var nextStart = ys[2] + 1;
    var invest = [];
    if (!s.p2year && p2Offer(e)) {
      var p2b = Math.max(p2Start(), nextStart), p2open = p2b + (P.vsi_stages.P2.cod - p2Start());
      var cost = Math.round((P.vsi_stages.P2.cost || P.gcap.phase2_cost_cr) * Math.pow(1 + P.cpi_forward, p2b - 1));
      invest.push({id: 'phase2', name: 'Build phase 2 (satellites G and H)', costCr: 0, opens: p2open, effect: 'Room for ' + (P.gcap.phase2_mppa - P.gcap.full_mppa) + ' million more passengers a year, open from ' + (2025 + p2open) + '.',
        why: 'Costs about ' + cr(cost) + ', 80% lent by the banks; the rest comes from cash, then from the shareholders. Full terminals turn passengers away; it pays back as the new piers fill.', payback: ''});
    }
    if (!s.ac_year && e >= P.ac.first_board_era && nextStart + (P.ac.phases[P.ac.phases.length - 1].opens - P.ac.phases[0].build[0]) + P.ac.ramp <= 60) {
      var ac = acPlan(nextStart - 1), till = P.till;
      invest.push({id: 'airport_city', name: 'Build Zero Mile District: hotels, offices and shops on airport land', costCr: 0, opens: ac.opens,
        effect: 'Developers build and pay rent; the first plots open in ' + (2025 + ac.opens) + ', the last in ' + (2025 + ac.lastOpens) + '.',
        why: 'Roads, power and water for the plots cost about ' + cr(ac.costCr) + ' over the years, paid by the shareholders, not the banks.', payback: '',
        land: {earnCr: Math.round(ac.earnCr), aeraCr: Math.round(till * ac.earnCr), year: ac.fullYear}});
    }
    var cureOn = leverAt(s.cure, nextStart);
    invest.push({id: cureOn ? 'cure_off' : 'cure_on', name: cureOn ? 'Stop promising the banks fresh money' : 'Promise the banks fresh money if the airport falls short',
      costCr: 0, effect: cureOn ? 'Keeps your company\'s money safe, but the banks take control after two short eras.' : 'If loan cover falls below ₹100 for every ₹100 due, your company tops it up and keeps control.',
      why: 'Fresh money lowers your return per year, but losing the airport loses everything.', payback: ''});
    var refiOn = leverAt(s.refi, nextStart);
    if (!refiOn) invest.push({id: 'refi_on', name: 'Accept a cheaper loan once the airport is stable', costCr: 0, effect: 'After three steady years the banks offer ' + P.refi.rate + '% over ' + P.refi.tenor + ' years.', why: 'Lower interest, longer to repay, from the first year.', payback: ''});
    var cpNext = Math.floor((nextStart - 5) / 5) * 5 + 5;
    var stance = stanceAt(s, nextStart);
    var hold = (nextStart <= 14 && nextStart + 5 > 10);
    var aera = {title: 'AERA tariff order, ' + (2025 + Math.max(cpNext, nextStart)) + ' onward',
      text: hold ? 'AERA plans to hold back part of your passenger fees while the new terminals for the Mumbai and Delhi flights open, and pay it back later with interest. It is fair over time, but the banks see thinner years now.' :
        'AERA sets your passenger fees for the next five years from what you have built and a fair return. Anything it under-pays now comes back later with interest.',
      canAppeal: true,
      appealText: 'Fight for fees now. AERA may then disallow part of your building costs, freeze fees for five years, and airlines will grow more slowly.'};
    aera.acceptText = hold ? 'AERA pays the held-back fees later, with interest; until then the banks see thinner years.' : 'Your fees are set for five years, and the airlines stay on your side.';
    aera.orderNo = 'AERA/VSI/' + (2025 + Math.max(cpNext, nextStart));
    var cash = Math.max(0, state.cash || 0);
    var payout = lr.payoutShare != null ? lr.payoutShare : 0;
    var nx = eraYears(e + 1) || [e + 1, nextStart, Math.min(60, nextStart + 4)];
    var lastDiv = s.boards[e - 1] ? s.boards[e - 1].dividendCr || 0 : 0;
    var div = {maxCr: Math.floor(cash * payout), lastCr: lastDiv || undefined};
    if (cash >= 1 && payout <= 0) { div.blocked = true; div.reason = 'The banks hold back dividends while the airport earns under ₹' + Math.round(P.lockup.nil_below * 100) + ' for every ₹100 due.'; }
    var pr = partners(); pr[0] = Object.assign({}, pr[0], {name: state.parent || pr[0].name, pct: state.stake});
    // dated in the game: the meeting sits on the last day of the era just run, on the signing day's month and day
    var md = String(state.signedOn || '2026-04-01').slice(4), meet = cal(ys[2]) + md, con = (state.history || []).filter(function (h) { return h.construction; })[0];
    var pile = [{title: 'Concession Agreement', stamp: 'Executed', date: state.signedOn || undefined}];
    if (state.construction) pile.push({title: 'Construction record', stamp: 'Filed', date: (con && con.construction.finishedOn) || state.opensOn || undefined});
    for (var k = 2; k <= e; k++) pile.push({title: 'Board minutes, ' + cal(eraYears(k - 1)[2]), stamp: 'Approved', date: cal(eraYears(k - 1)[2]) + md});
    return {era: e + 1, years: (2025 + nx[1]) + '–' + (2025 + nx[2]), year: nextStart, date: meet, parent: state.parent, parentPct: state.stake, founder: state.founder || undefined,
      partners: pr.map(function (x) { return {name: x.name, pct: x.pct}; }), stakeValueCr: lr.stakeValueCr, cashCr: cash, debtCr: lr.debtCr || 0,
      dscr: lr.cover != null ? {value: lr.cover, warn: P.thr.warning, covenant: P.thr.covenant} : null,
      aera: aera, appealNow: stance === 'hard', investments: invest,
      dividend: div, prepay: {maxCr: Math.floor(cash), savesPct: lr.ratePct || undefined}, pile: pile};
  }
  function applyBoard(state, d) {
    ensure();
    state = clone(state); d = d || {};
    var e = state.era, ys = eraYears(e), s = state.s, from = ys[2] + 1;
    var bought = d.bought || [];
    s.boards[e] = {dividendCr: Math.max(0, +d.dividendCr || 0), prepayCr: Math.max(0, +d.prepayCr || 0)};
    s.appeals.push({from: from, hard: !!d.appeal});
    if (bought.indexOf('cure_on') >= 0 || bought.indexOf('cure_off') >= 0) {
      if (!Array.isArray(s.cure)) s.cure = [{from: 1, on: !!s.cure}];
      s.cure.push({from: from, on: bought.indexOf('cure_on') >= 0});
    }
    if (bought.indexOf('refi_on') >= 0) { if (!Array.isArray(s.refi)) s.refi = [{from: 1, on: !!s.refi}]; s.refi.push({from: from, on: true}); }
    if (bought.indexOf('phase2') >= 0 && !s.p2year) { s.p2year = ys[2]; s.sizing = sizeDebt(s); }
    if (bought.indexOf('airport_city') >= 0 && !s.ac_year) s.ac_year = ys[2];   // not lent on by the banks: no re-sizing
    state.history.push({era: e, board: {dividendCr: s.boards[e].dividendCr, prepayCr: s.boards[e].prepayCr, appeal: !!d.appeal, bought: bought}});
    state.era = e + 1; state.year = from;
    return state;
  }
  function isOver(state) { return state.over || false; }
  // the closing page as ZMMoney.bill (VSIEra.endBill), so the old income statement never has to draw it
  function endBill(state) {
    ensure();
    var is = endOpts(state), o = state.over || {}, endY = o.reason === 'banks' ? cal(o.year || state.year || 1) : cal(60);
    var f = state.final || {};
    return asBill(is, {state: state, per: cal(1) + '–' + String(endY).slice(2), at: 'at the end', date: o.reason === 'banks' ? ch5Date(state, o.year || state.year || 1).iso : (state.endsOn || ch5Date(state, 60).iso),
      stake: {pct: state.stake, valueCr: o.reason === 'banks' ? 0 : Math.round(f.residualCr || 0), returnPct: f.irr == null ? null : Math.round(f.irr * 1000) / 10}});
  }
  function endOpts(state) {   // the closing statement (income statement format): the banks' ending, or before the certificate
    var f = state.final || {}, o = state.over || {};
    var banks = o.reason === 'banks';
    var line = banks ? state.parent + ' lost Vikram Sarabhai International to its banks in ' + (2025 + (o.year || 0)) + '. ₹' + Math.round(f.investedCr || 0).toLocaleString('en-IN') + ' crore invested.' :
      state.parent + ' ran Vikram Sarabhai International for 60 years. ₹' + Math.round(f.returnedCr || 0).toLocaleString('en-IN') + ' crore returned on ₹' + Math.round(f.investedCr || 0).toLocaleString('en-IN') + ' crore invested.';
    return {band: banks ? 'The banks took control' : 'Handback · ' + (state.endsOn ? fmtDate(state.endsOn) : '2085'), title: banks ? 'The concession ends early' : 'Sixty years, handed back',
      hero: line, sections: [{title: 'Your company\'s ' + state.stake + '%', rows: [
        {label: 'Money put in', amount: f.investedCr || 0, kind: 'cost'},
        {label: 'Dividends received', amount: f.dividendsCr || 0, kind: 'rev'},
        {label: 'Your return per year', amount: f.irr == null ? 'none' : (f.irr * 100).toFixed(1) + '%', kind: f.irr != null && f.irr > 0.12 ? 'good' : 'bad'},
        {label: 'Bank loans fully repaid', amount: f.debtRepaid ? 'Yes' : 'No', kind: f.debtRepaid ? 'good' : 'bad'}]}],
      moments: [], cta: 'Back to the menu'};
  }


  // F1: an income-statement-shaped page ({band, title, hero, sections, moments}) as one page of the annual report for
  // ZMMoney.bill ({title, year, paragraph, table, margin, cover, stake}); text rows (a return, "Yes") go into the note.
  // o: {per (the period every figure is in, e.g. '2034–38'), state (for the cover and the stake)}
  function asBill(is, o) {
    is = is || {}; o = o || {};
    var st = o.state || {}, lr = st.lastReport || {}, table = [], notes = [];
    (is.sections || []).forEach(function (sec) {
      (sec.rows || []).forEach(function (r) {
        // a flow (earned, spent) is labelled with its period; a balance (cash) with the moment it is counted
        var lab = r.label + (/^Cash in hand|^Money still owed/.test(r.label) ? (o.at ? ', ' + o.at : '') : (r.per || o.per) ? ', ' + (r.per || o.per) : '');
        if (typeof r.amount === 'number') table.push({label: lab, cr: Math.round(r.amount)});
        else if (r.amount != null && r.amount !== '') notes.push(r.label + ': ' + r.amount + '.');
      });
    });
    var strip = function (h) { return String(h || '').replace(/<[^>]*>/g, ''); };
    var cov = o.cover || {ratio: lr.cover != null ? lr.cover : null, words: coverWords(lr.cover != null ? lr.cover : null), light: lr.light || 'green'};
    return {title: strip(is.title), year: is.band || '', paragraph: o.paragraph || strip(is.hero), table: table,
      margin: notes.concat(is.moments || []).join(' '), per: o.per || '', at: o.at || '', date: o.date || '', dateWords: o.date ? fmtDate(o.date) : '',
      cover: cov, stake: o.stake || {pct: st.stake || 0, valueCr: lr.stakeValueCr != null ? lr.stakeValueCr : 0}, cta: is.cta};
  }
  // F5: the stake and the return per year tell one story. The return per year is the rate r at which the shareholders'
  // money in, less what they took out, grows to exactly what the stake is worth now:
  //   stake now = Σ (money in − dividends) in year t × (1 + r)^(years from t to now)
  // flows: the whole company's money in (−) and out (+) a year from t = 0 (game year 1, the signing year); T: now
  function stakeCheck(flows, T, share, valueCr, r) {
    if (r == null || !(valueCr > 0)) return null;
    var inn = 0, out = 0, implied = 0, rr = r;   // the unrounded rate: the identity is exact, so a gap means the stake and the return came from different books
    for (var t = 0; t <= T; t++) {
      var f = (flows[t] || 0) * share;
      if (f < 0) inn -= f; else out += f;
      implied += -f * Math.pow(1 + rr, T - t);
    }
    return {moneyInCr: Math.round(inn), dividendsCr: Math.round(out), fromYear: cal(1), toYear: cal(T + 1), years: T + 1,
      returnPct: Math.round(r * 1000) / 10, impliedCr: Math.round(implied), shownCr: Math.round(valueCr),
      diffPct: Math.round((implied - valueCr) / valueCr * 1000) / 10};
  }
  function stakeSentence(company, pct, valueCr, chk, when) {   // the stake line every bill uses, with its reconciliation
    var w = poss(company || 'Your company') + ' ' + pct + '% is worth about ' + stakeWords(valueCr) + (when ? ' ' + when : '') + '.';
    if (!chk) return w;
    return w + ' ' + (company ? 'It has' : 'You have') + ' put in ' + stakeWords(chk.moneyInCr) + ' since ' + chk.fromYear +
      (chk.dividendsCr >= 1 ? ' and taken out ' + stakeWords(chk.dividendsCr) + ' in dividends' : '') +
      (chk.returnPct >= 0.5 ? ': about ' + chk.returnPct + '% a year.' : ': so far the stake is worth less than the money put in, as an airport is in its first years.');
  }
  // Airport City ordered at the board after game year y: its plan, cost and what the land earns once full (model: print_airport_city)
  function acPlan(y) {
    ensure();
    var AC = P.ac, sh = Math.max(0, y + 1 - AC.phases[0].build[0]), cost = 0, pr = function (t) { return Math.pow(1 + P.cpi_forward, t); };
    var ph = AC.phases.map(function (p) { return {build: p.build.map(function (b) { return b + sh; }), opens: p.opens + sh, acres: p.acres}; });
    ph.forEach(function (p) { p.build.forEach(function (b) { cost += p.acres * AC.infra / p.build.length * pr(b - 1); }); });
    var last = ph[ph.length - 1].opens, full = Math.min(60, last + AC.ramp - 1), earn = 0;
    ph.forEach(function (p) { if (full >= p.opens) earn += p.acres * AC.lic * Math.min(1, (full - p.opens + 1) / AC.ramp) * pr(full - 1); });
    return {opens: ph[0].opens, lastOpens: last, fullYear: full, costCr: cost, earnCr: earn};
  }

  // ---------------------------------------------------------------------------------------------
  // The construction years (E0, years 1-4): ZMMoney.construction(opts) → {choices:{eventId: optionId}, finishedOn}
  // ---------------------------------------------------------------------------------------------
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  // dates as people write them: '2039-04-01' → '1 April 2039' (the stamps keep '01 APR 2039')
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : String(iso || '');
  }
  // the documents signed so far in a concession, for the file card and the pile: {id, title, date, stamp, summary}
  function campaignDocs(state) {
    ensure();
    if (!state) return [];
    var on = state.signedOn || '2026-04-01', md = on.slice(4), at = function (y) { return cal(y) + md; };
    var docs = [{id: 'concession', title: 'Concession Agreement', date: on, stamp: 'EXECUTED',
      summary: 'Sixty years to build and run Vikram Sarabhai International, signed by ' + (state.founder || 'the director') + ' for ' + (state.parent || 'Your company') + '.'}];
    (state.history || []).forEach(function (h) {
      if (h.construction) docs.push({id: 'construction', title: 'Construction record', date: (h.construction && h.construction.finishedOn) || at(4), stamp: 'FILED',
        summary: 'The airport was built and opened.'});
      else if (h.board) { var ys = eraYears(h.era); docs.push({id: 'board-' + h.era, title: 'Board minutes, ' + cal(ys[2]), date: at(ys[2]), stamp: 'APPROVED',
        summary: 'Dividend ' + cr(h.board.dividendCr || 0) + (h.board.prepayCr ? ', loans prepaid ' + cr(h.board.prepayCr) : '') + ((h.board.bought || []).length ? ', approved: ' + h.board.bought.length + ' investment' + (h.board.bought.length > 1 ? 's' : '') : '') + '.'}); }
      else if (h.era) { var y2 = eraYears(h.era); docs.push({id: 'report-' + h.era, title: 'Annual report, ' + cal(y2[1]) + '–' + String(cal(y2[2])).slice(2), date: at(y2[2]), stamp: 'FILED',
        summary: (h.cover != null ? coverWords(h.cover) + ' in the hardest year' : 'No loan payments due') + '; your ' + (state.stake || 0) + '% worth ' + cr((h.stakeValueCr) || 0) + '.'}); }
    });
    return docs.map(dw);
  }
  // the whole pile: the era papers (campaignDocs) and the chapter papers the player signed (state.docs), oldest first
  function allDocs(state) {
    var out = campaignDocs(state), ids = {};
    out.forEach(function (d) { ids[d.id] = true; });
    (state.docs || []).forEach(function (d) { if (d && d.id && !ids[d.id]) { ids[d.id] = true; out.push(dw(Object.assign({}, d))); } });
    return out.sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
  }
  // the seven chapters of the flight (design/chapters.md §1) and which one a concession is in: VSIEra.chapter(state) →
  // {n (1-7, 8 = the Black Box), name, title, act, years: [first, last] game years}
  var CHAPTERS = [null,
    {name: 'Clearance', title: 'Win the concession', act: 1, years: [0, 0]}, {name: 'Pushback', title: 'Build the airport', act: 1, years: [1, 4]},
    {name: 'Takeoff', title: 'Open the doors', act: 1, years: [5, 7]}, {name: 'Climb', title: 'Wire the country', act: 2, years: [8, 13]},
    {name: 'Cruise', title: 'Take on the Gulf', act: 2, years: [14, 18]}, {name: 'Turbulence', title: 'The crisis', act: 3, years: [19, 33]},
    {name: 'Landing', title: 'Hand it back', act: 3, years: [34, 60]}, {name: 'The Black Box', title: 'What really happened', act: 3, years: [60, 60]}];
  function chapter(state) {
    var n = !state || !state.s ? 1 : state.over ? 8 : state.building ? 2 : state.era <= 1 ? 3 : state.era <= 3 ? 4 : state.era === 4 ? 5 : state.era <= 7 ? 6 : 7;
    // between chapters (the last era's report filed, its board pending) the player is at the next chapter
    var h = state && state.history && state.history[state.history.length - 1];
    if (n >= 3 && n <= 6 && h && h.era === state.era && !h.board && !h.construction && state.era === [0, 0, 0, 1, 3, 4, 7][n]) n++;
    var c = CHAPTERS[n];
    return {n: n, name: c.name, title: c.title, act: c.act, years: c.years.slice()};
  }
  // the Concession tab's file card: the three plain numbers and where the concession has got to (ZMMoney.concessionFile)
  function fileCard(state, flight) {
    ensure();
    if (!state) return null;
    var lr = state.lastReport || {}, h = (state.history || []).filter(function (x) { return x.cashCr != null; }).pop() || {};
    var cov = lr.cover != null ? lr.cover : null;
    var ch = chapter(state), yr = state.building ? 1 : (state.year || 1);
    if (flight && CHAPTERS[flight.n]) { var fc = CHAPTERS[flight.n]; ch = {n: flight.n, name: fc.name, title: fc.title, act: fc.act, years: fc.years.slice()}; }
    return {company: state.parent || 'Your company', founder: state.founder || '', signature: state.signature || null, signedOn: state.signedOn || null,
      director: (state.founder || 'The founder') + ', director', chapter: ch, resumable: resumable(state).ok,
      line: 'Signed ' + fmtDate(state.signedOn || '2026-04-01') + ' · now year ' + yr + ' of 60 · ' + (ch.n <= 7 ? 'Chapter ' + ch.n + ', ' : '') + ch.name,
      year: state.year || 1, calYear: cal(state.year || 1), era: state.era || 1, building: !!state.building,
      stake: {pct: state.stake || 0, valueCr: lr.stakeValueCr != null ? lr.stakeValueCr : null, inCr: lr.stakeValueCr != null ? null : putIn(state)},
      cover: {words: state.building ? 'No loan payments due until the airport opens' : coverWords(cov), light: lr.light || 'green'},
      cashCr: h.cashCr != null ? h.cashCr : Math.round(state.cash || 0), docs: allDocs(state)};
  }
  // the player's share of what the shareholders have put in so far (the file card's stake before the first books close)
  function putIn(state) {
    try { var q = closeFigures(state.s, state.s.sizing); return Math.round(q.equityCr * (state.stake || 64) / 100); } catch (e) { return null; }
  }
  // The save (zm_campaign). A concession is resumable only if it is the player's own: signed (signature, founder and
  // signing day), from this version of the game, not the sample company, and not over. VSIEra.resumable(save) → {ok, why}
  var SAVE_VERSION = 2;
  function resumable(save) {
    if (!save || typeof save !== 'object' || !save.s) return {ok: false, why: 'none'};
    if (save.sample || save.test) return {ok: false, why: 'sample'};
    if (!(save.version >= SAVE_VERSION)) return {ok: false, why: 'old'};
    if (!save.signature) return {ok: false, why: 'unsigned'};
    if (!save.founder) return {ok: false, why: 'no founder'};
    if (!save.signedOn || !/^\d{4}-\d{2}-\d{2}$/.test(save.signedOn)) return {ok: false, why: 'no signing day'};
    if (save.over) return {ok: false, why: 'over'};
    return {ok: true, why: ''};
  }
  // one line of zm_record, for a concession torn up or finished: VSIEra.recordOf(state, how) with how 'torn-up',
  // 'banks' or 'handback' (default: from state.over) → {company, founder, signature, signedOn, yearsRun, how, howWords,
  // finalReturnPct (null when the banks took it, or torn up before a return), stakeValueCr, endedOn}
  function recordOf(state, how) {
    ensure();
    if (!state) return null;
    var o = state.over || {}, lr = state.lastReport || {}, f = state.final || {};
    how = how || (o.reason === 'banks' ? 'banks' : o.reason === 'handback' ? 'handback' : 'torn-up');
    var yearsRun = how === 'handback' ? 60 : Math.max(0, Math.min(60, (o.year || state.year || 1) - (state.building ? 1 : 0)));
    var ret = how === 'handback' ? (f.irr != null ? Math.round(f.irr * 1000) / 10 : null) : how === 'banks' ? null : (lr.returnPerYear != null ? lr.returnPerYear : null);
    return {company: state.parent || 'Your company', founder: state.founder || '', signature: state.signature || null, signedOn: state.signedOn || null,
      yearsRun: yearsRun, how: how,
      howWords: how === 'handback' ? 'Handed back after 60 years' : how === 'banks' ? 'The banks took control in ' + cal(o.year || state.year || 1) : 'Torn up in year ' + (state.year || 1),
      finalReturnPct: ret, stakeValueCr: how === 'banks' ? 0 : (lr.stakeValueCr != null ? lr.stakeValueCr : null),
      endedOn: how === 'handback' ? (state.endsOn || null) : cal(o.year || state.year || 1) + String(state.signedOn || '2026-04-01').slice(4)};
  }
  function addMonths(iso, m) {
    var d = iso ? new Date(iso + 'T12:00:00Z') : new Date(Date.UTC(2026, 3, 1, 12));
    if (isNaN(d)) d = new Date(Date.UTC(2026, 3, 1, 12));
    d.setUTCMonth(d.getUTCMonth() + m);
    return d.toISOString().slice(0, 10);
  }
  function monthName(iso) { var d = new Date(iso + 'T12:00:00Z'); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  // the roof-steel crisis: with Sanchori Jain Samaj Capital as the lender, its members supply the Hall roof steel at the
  // audited market price (its better-offer condition), so the steel overrun costs half
  function roofSteelFactor(sc) { return sc && /^sanchore/.test(sc.lender || '') ? 0.5 : 1; }
  function conFrom(ch, sc) {
    var C = P.con, con = {monsoon: ch.monsoon || null, overrun: ch.overrun || null, trials: ch.trials || null, slipMonths: 0, pay: []};
    if (con.monsoon === 'slip') con.slipMonths += C.monsoon.slip_months; else if (con.monsoon === 'pay') con.pay.push({year: C.monsoon.year, cr: C.monsoon.pay_cr});
    if (con.overrun === 'slip') con.slipMonths += C.overrun.slip_months; else if (con.overrun === 'pay') con.pay.push({year: C.overrun.year, cr: C.overrun.pay_cr * roofSteelFactor(sc)});
    if (con.trials === 'full') con.pay.push({year: C.trials.year, cr: C.trials.full_cr});
    return con;
  }
  function conRun(state, ch) {   // era 1 on the bank's forecast, with these construction choices
    var s = clone(state.s); s.construction = ch ? conFrom(ch, state.s) : null;
    var eng = simulate(s, 7), put = 0, earned = 0, first = null;
    for (var t = 0; t < 7; t++) put -= Math.min(0, eng.eq_flows[t] || 0);
    eng.rows.forEach(function (r) { if (r.year >= 5) { earned += r.ebitda; if (first == null && r.dscr != null) first = r; } });
    return {put: put, earned: earned, first: first, dis: eng.rows.reduce(function (a, r) { return a + r.dis; }, 0)};
  }
  function constructionOpts(state) {
    ensure();
    var s = state.s, q = closeFigures(s, s.sizing), C = P.con, stake = state.stake || 64;
    var signedOn = state.signedOn || addMonths(null, 0), opensOn = addMonths(signedOn, 48);
    var pr = function (t) { return Math.pow(1 + P.cpi_forward, t); };
    // money drawn each year: the banks (with interest while building), the shareholders, the State's loan
    var b = simulate(Object.assign(clone(s), {construction: null}), 4), years = [], cum = 0, sd = P.vsi_stages['1A_' + s.phase1];
    var slTot = b.sl_amt, spW = 0; Object.keys(sd.spend).forEach(function (y) { spW += sd.spend[y] * pr(+y - 1); });
    for (var y = 1; y <= 4; y++) {
      var t = y - 1, bank = 0;
      b.c.tranches.forEach(function (tr) { bank += tr.draws[t] || 0; });
      var eq = b.c.equity_need[t] || 0, st = slTot * (sd.spend[y] || 0) * pr(t) / (spW || 1), d = bank + eq + st;
      cum += d;
      years.push({year: y, drawnCr: Math.round(d), cumDrawnCr: Math.round(cum),
        line: (2025 + y) + ': ' + cr(d) + ' spent: ' + cr(bank) + ' from ' + (lenderName(s)) + ', ' + cr(eq) + ' from the shareholders' + (st >= 1 ? ', ' + cr(st) + ' from the State' : '') + '.'});
    }
    // the decisions, each priced on the bank's forecast for era 1 (model: delay sensitivity)
    var base = conRun(state, {}), share = function (v) { return cr(v * stake / 100); };
    function slipEffect(id, months) {
      var ch = {}; ch[id] = 'slip';
      var r = conRun(state, ch), lost = base.earned - r.earned, extra = r.put - base.put;
      return 'The airport opens ' + months + ' months late, in ' + monthName(addMonths(opensOn, months)) + ': about ' + cr(lost) + ' less earned in its first three years' +
        (extra >= 5 ? ', and the shareholders put in about ' + cr(extra) + ' more (your share ' + share(extra) + ') to pay the loan interest while it is shut.' : '.');
    }
    function slipNumbers(id) {   // the adviser's light once a slip is ticked: the first open year's cover on the bank's forecast
      var ch = {}; ch[id] = 'slip';
      var f = conRun(state, ch).first;
      return f ? {light: lightOf(f.dscr), coverWords: coverWords(f.dscr) + ' in the first year open, in the banks\' forecast'} : undefined;
    }
    var mp = C.monsoon.pay_cr * pr(C.monsoon.year - 1), op = C.overrun.pay_cr * roofSteelFactor(state.s) * pr(C.overrun.year - 1), opFull = C.overrun.pay_cr * pr(C.overrun.year - 1), tp = C.trials.full_cr * pr(C.trials.year - 1);
    var sh = conRun(state, {trials: 'short'}), shortCost = sh.dis - base.dis;
    var events = [
      {id: 'monsoon', year: C.monsoon.year, title: 'The monsoon floods the runway site',
        text: 'Three weeks of rain have filled the earthworks for runway 2. The contractor can pump it dry and work nights, or wait for the dry season.',
        options: [{id: 'pay', label: 'Pay for pumps and night shifts', effect: 'The shareholders put in ' + cr(mp) + ' now (your share ' + share(mp) + '), and the airport opens on time.'},
          {id: 'slip', label: 'Wait for the dry season', effect: slipEffect('monsoon', C.monsoon.slip_months), slipMonths: C.monsoon.slip_months, numbers: slipNumbers('monsoon')}]},
      {id: 'overrun', year: C.overrun.year, title: 'The Hall roof steel costs more than the contract',
        text: 'Steel prices have risen and the roof contractor wants more money to keep its crews on site. If you also waited out the monsoon, the two delays add up to ' + (C.monsoon.slip_months + C.overrun.slip_months) + ' months.' +
          (roofSteelFactor(state.s) < 1 ? ' Your lenders, Sanchori Jain Samaj Capital, supply the roof steel through their members at the audited market price: the extra cost falls from ' + cr(opFull) + ' to ' + cr(op) + '.' : ''),
        options: [{id: 'pay', label: 'Pay the contractor now', effect: 'The shareholders put in ' + cr(op) + ' now (your share ' + share(op) + '); the airport opens on time and earns it back through its fees over the years.'},
          {id: 'slip', label: 'Renegotiate and slip', effect: slipEffect('overrun', C.overrun.slip_months), slipMonths: C.overrun.slip_months, numbers: slipNumbers('overrun')}]},
      {id: 'trials', year: C.trials.year, title: 'Trial operations before opening day',
        text: 'Before the licence, airlines, ground staff and volunteers rehearse check-in, baggage, gates and emergencies with real aircraft.',
        options: [{id: 'full', label: 'Full trials, three months', effect: 'Costs ' + cr(tp) + ' (your share ' + share(tp) + '), and opening day runs as rehearsed.'},
          {id: 'short', label: 'Short trials, three weeks', effect: 'Saves ' + cr(tp) + ', but the first year costs about ' + cr(shortCost) + ' in penalties to airlines and passenger care as teething problems hit.'}]}];
    var o = {signedOn: signedOn, opensOn: opensOn, capexCr: q.today, debtCr: q.debtCr, equityCr: q.equityCr, stateLoanCr: q.stateLoanCr || undefined, lenderName: lenderName(s),
      works: [
        {id: 'land', name: 'Land and resettlement', start: 0, end: 0.75, note: 'Villages moved to new homes with MADC, before the first digger arrives.'},
        {id: 'earth', name: 'Earthworks and drainage', start: 0.25, end: 1.75, note: 'The site levelled and drained for the monsoon.'},
        {id: 'runways', name: 'Runways 1 and 2', start: 1, end: 3, note: 'Two parallel runways, so one can close without closing the airport.'},
        {id: 'hall', name: 'Terminal and the Hall roof', start: 1, end: 3.5, note: 'The one roof that cannot be built in stages.'},
        {id: 'concourses', name: 'Concourses A and B', start: 1.5, end: 3.5, note: 'The first two piers of gates.'},
        {id: 'mover', name: 'People mover', start: 2, end: 3.5, note: 'The train under the Hall to the piers.'},
        {id: 'tower', name: 'Zero Mile Tower and radar', start: 1.5, end: 3, note: 'Air traffic control, commissioned with the Airports Authority.'},
        {id: 'power', name: 'Power and the fuel farm', start: 1, end: 3, note: 'Two grid feeds and the fuel tanks and pipes to the stands.'},
        {id: 'trials', name: 'Trial operations with the airlines', start: 3.25, end: 3.9, note: 'Rehearsals with real aircraft and volunteer passengers.'},
        {id: 'licence', name: 'Aerodrome licence from DGCA', start: 3.75, end: 4, note: 'The regulator inspects and licenses the airport to open.'}],
      years: years, events: events,
      numbers: {todayCr: 0, light: 'green', coverWords: 'No loan payments due until the airport opens', stakePct: stake, stakeValueCr: Math.round(q.equityCr * stake / 100)}};
    if (state.founder) o.founder = state.founder;
    if (state.parent) o.parent = state.parent;
    return o;
  }
  function lenderName(s) { var o = lenderOptions().options.filter(function (x) { return x.id === s.lender; })[0]; return o ? o.who : 'Indian banks'; }
  function applyConstruction(state, result) {
    ensure();
    state = clone(state);
    var ch = (result && result.choices) || {}, con = conFrom(ch, state.s);
    state.s.construction = con;
    state.construction = {overrun: con.overrun, monsoon: con.monsoon, trials: con.trials, slipMonths: con.slipMonths, finishedOn: (result && result.finishedOn) || null};
    state.building = false;
    state.opensOn = addMonths(state.signedOn, 48 + con.slipMonths);
    var eng = simulate(state.s, 4);
    state.debt = eng.c.tranches.map(function (tr) { return {name: tr.name, outCr: Math.round(tr.out)}; });
    state.cash = Math.round(eng.cash);
    state.history.push({era: 0, construction: state.construction});
    return state;
  }
  function needsConstruction(state) { return !!(state && state.building && !state.over); }

  // ---------------------------------------------------------------------------------------------
  // Year 60: ZMMoney.handback(opts), the certificate
  // ---------------------------------------------------------------------------------------------
  function handbackOpts(state) {
    ensure();
    var f = state.final || {}, s = state.s || {}, h = state.history || [];
    var stars = h.filter(function (x) { return x.stars != null; }).map(function (x) { return x.stars; });
    var avg = stars.length ? stars.reduce(function (a, b) { return a + b; }, 0) / stars.length : 2;
    var assets = ['six runways', 'the Hall under one roof', 'concourses A to F', 'the people mover', 'Zero Mile Tower'];
    if (f.p2) assets.splice(3, 0, 'satellites G and H');
    if (f.ac) assets.push('Zero Mile District');
    var pr = partners(); pr[0] = Object.assign({}, pr[0], {name: state.parent || pr[0].name, pct: state.stake});
    var lines = [];
    if (f.paxTotalM) lines.push('Over sixty years the airport served ' + (f.paxTotalM >= 1000 ? (f.paxTotalM / 1000).toFixed(1) + ' billion' : f.paxTotalM.toLocaleString('en-IN') + ' million') + ' passengers.');
    if (f.repaidYear) lines.push('The bank loans were fully repaid in ' + (2025 + f.repaidYear) + '.');
    lines.push('Your company put in ' + cr(f.investedCr || 0) + ' and received ' + cr(f.dividendsCr || 0) + ' in dividends.');
    if (state.construction && state.construction.slipMonths) lines.push('It opened ' + state.construction.slipMonths + ' months late, in ' + monthName(state.opensOn || addMonths(state.signedOn, 48)) + '.');
    var o = {signature: state.signature || undefined, signedOn: state.signedOn || undefined, endsOn: state.endsOn || undefined,
      stakePct: state.stake, stakeValueCr: f.residualCr != null ? f.residualCr : undefined, returnPct: f.irr == null ? undefined : Math.round(f.irr * 1000) / 10,
      paxTotalM: f.paxTotalM, paidToStateCr: f.paidToStateCr, condition: avg >= 2.5 ? 'excellent' : avg >= 1.5 ? 'good' : 'poor',
      assets: assets, owners: pr.map(function (x) { return {name: x.name, pct: x.pct}; }), lines: lines};
    if (state.founder) o.founder = state.founder;
    if (state.parent) o.parent = state.parent;
    return o;
  }

  // ---------------------------------------------------------------------------------------------
  // Chapter 5, "Take on the Gulf" (prompt-campaign.md §9): years 14-18 (era 4). VSIEra.ch5.*
  //   fixture → frontPage → decision → applyDecision → briefing → shiftPlan → (the shift) → applyShift → {bill, card}
  // Money comes from connections made, never from movements: each connection earns the international passenger fee,
  // the widebody landing fee per seat and transfer shopping (money.json rates at the year's prices); a missed one costs
  // passenger care and, through route growth, the next year's flights. Rates marked (est.) are game assumptions.
  // ---------------------------------------------------------------------------------------------
  var CH5 = {
    year: 14, banksFrom: 15, banksPerDay: 2, lateDaysPerYear: 30, birdDaysPerYear: 20, holdSlotInr: 500000 /* (est.) */,
    careInr: 1900, radarCr: 45 /* (est.) a bird-detection radar, in the 2034 budget */, radarYear: 9,
    feederAirline: 'IndiGo', rival: 'Doha', partner: 'Air India',   // design/chapters.md §0
    signatory: {name: 'Elena Marsh', title: 'Network planning, Air India'},
    // fictional callsigns for hub.js (plan.feeder.code/radio, plan.partnerCode/partnerRadio): three letters, radio name
    feederCode: '6E', feederRadio: 'IFLY', partnerCode: 'AI', partnerRadio: 'AIR INDIA', docId: 'partner-',
    feeders: [['Lucknow', 'LKO'], ['Indore', 'IDR'], ['Patna', 'PAT'], ['Raipur', 'RPR'], ['Bhubaneswar', 'BBI'], ['Varanasi', 'VNS'], ['Jaipur', 'JAI'],
      ['Guwahati', 'GAU'], ['Coimbatore', 'CJB'], ['Visakhapatnam', 'VTZ'], ['Chandigarh', 'IXC'], ['Kochi', 'COK']],
    feederFlights: 16, feederPaxEach: 180, feederFrom: '12:40', feederTo: '13:40',
    intl: {
      London: {code: 'LHR', std: '14:10', aircraft: 'A388', connecting: 520, seats: 517, mtow: 575},
      Singapore: {code: 'SIN', std: '14:25', aircraft: 'A359', connecting: 300, seats: 325, mtow: 280},
      Nairobi: {code: 'NBO', std: '14:50', aircraft: 'B789', connecting: 220, seats: 290, mtow: 254}},
    hub: {from: 'Lucknow', code: 'LKO', lateMin: 25, pax: 380, holdMin: 20, dest: 'London'},
    stands: {need: 6, lean: 4},
    mctMin: 40, rivalMctMin: 60 /* (est.) the domestic-to-international connection at VSI (hub.js CH5_LEVEL.xIntMin) and at Doha */,
    letGoGrowthHit: 0.08   // (est.) route growth lost a year when London leaves the Lucknow passengers behind; the partner also
                           // drops one of its two daily London flights for the era
  };
  function ch5Rates(year) {
    ensure();
    var pr = Math.pow(1 + P.cpi_forward, year - 1);
    var udf = J('aero.udf_greenfield_opening_nmia', {dom_dep: 620, intl_dep: 1225}), land = J('aero.landing_intl_wide_per_t', 785);
    var landDom = J('aero.landing_dom_narrow_per_t', 347), xfer = J('nonaero.transfer_vs_od_spend', 0.75), shop = P.nar0 + (P.nar1 - P.nar0) * 0.5;
    var hold = (J('fuel.hold_cost_per_min', {A380: 20000}) || {}).A380 || 20000, care = CH5.careInr;   // meals and rebooking, as the shift ledger
    var L = CH5.intl.London;
    // one connection: the domestic leg's landing fee per seat, the international passenger fee, the widebody landing fee per seat, shopping in transfer
    var perConn = (landDom * 79 / 180 + udf.intl_dep + land * L.mtow / L.seats + shop * xfer) * pr;
    var holdCost = (hold * CH5.hub.holdMin + CH5.holdSlotInr) * pr;
    return {pr: pr, perConnInr: perConn, careInr: care * pr, holdInr: holdCost, perConnectionCr: perConn / 1e7, missedCostCr: care * pr / 1e7, holdCostCr: holdCost / 1e7,
      standMinInr: ((J('fuel.hold_cost_per_min', {}) || {}).B777_300ER || 12500) * pr};
  }
  function ch5Opt(choice) { return CH5_SCRIPT.options.filter(function (o) { return o.id === choice; })[0] || CH5_SCRIPT.options[2]; }
  function ch5Dests(choice) { return ch5Opt(choice).dests.slice(); }
  function ch5PerBank(choice) { return ch5Dests(choice).reduce(function (a, d) { return a + CH5.intl[d].connecting; }, 0); }
  function cal(y) { return 2025 + y; }
  function crs(v) { return Math.abs(v) >= 1 ? cr(v) : '₹' + Math.max(1, Math.round(v * 100)) + ' lakh'; }   // small sums in lakh
  function stakeWords(v) {   // the stake, rounded the same way on every screen
    var a = Math.abs(v || 0);
    return a >= 1e5 ? '₹' + (a / 1e5).toFixed(2) + ' lakh cr' : '₹' + (Math.round(a / 100) * 100).toLocaleString('en-IN') + ' cr';
  }
  function poss(n) { return /s$/.test(n) ? n + '\'' : n + '\'s'; }   // Air India' (not Airways's)
  function andList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function ch5Date(state, year) {   // the player's signing day, in the given game year (the chapter's one date set)
    var md = (state.signedOn || '2026-04-01').slice(5);
    var d = new Date(cal(year) + '-' + md + 'T12:00:00Z');
    if (isNaN(d)) d = new Date(Date.UTC(cal(year), 3, 1, 12));
    var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {iso: d.toISOString().slice(0, 10), words: days[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear()};
  }
  function ch5Short(state, id) {   // a document's short name, for the small tags and the handover's links
    var d = ch5Doc(state, id);
    return {'feeders-2033': 'Feeder agreement, ' + cal(8), phase1: 'Phase 1 choice, ' + cal(1), 'budget-2034': 'Capital budget, ' + cal(CH5.radarYear)}[id] ||
      (/^(partner|skyward)-/.test(id) ? CH5.partner + ' agreement, ' + cal(CH5.year) : d ? d.title : id);
  }
  function dw(doc) { if (doc && doc.date) doc.dateWords = fmtDate(doc.date); return doc; }   // F6: '1 April 2039' beside the ISO date
  function ch5Doc(state, id) { return (state.docs || []).filter(function (d) { return d.id === id; })[0] || null; }
  var GULF_SRC = {label: 'AP, "Dubai International Airport, busiest for world travel, sees record 92.3 million passengers in 2024"', url: 'https://www.yahoo.com/news/dubai-international-airport-busiest-world-081648847.html'};
  // VSIEra.ch5.script: the chapter as plain data. Text templates fill {name} from the state and the engine;
  // every history card is research/history-cards.md as written (card 5: research/dubai.md), with its source.
  var CH5_SCRIPT = {
    frontPage: {masthead: 'The Zero Mile Times', price: '₹12',
      lead: 'DUBAI, DOHA OR NAGPUR? THE RACE FOR INDIA\'S TRAVELLERS',
      deck: '{partner} wants an Indian hub for its long-haul flights. Vikram Sarabhai International has the feeder flights. Dubai and Doha want them too.',
      sub: {head: 'Lucknow to London, one stop, on Indian soil',
        body: '{feeder} now flies {cities} cities into VSI in one afternoon bank. {company} says the same passengers could walk across the pier to London, Singapore or Nairobi instead of changing in the Gulf. VSI handled {paxM} million passengers in {lastYear}.'},
      columns: [
        {head: 'Where India changes planes', body: 'Dubai\'s airport alone handled about 12 million passengers to and from India in 2024, more than any other country. Doha\'s airport wants {partnerPoss} flights too.', sources: [GULF_SRC]},
        {head: 'The banks are watching', body: '{coverLine} Its owners hold {stake}%, worth about {stakeValue} on paper.'}],
      photo: {kind: 'intl-pier', caption: 'The international pier at VSI: {stands} stands built for the biggest aircraft.'}},
    // the three options and what each does to the shift (distinct, visible: 3 departures / 1 / none)
    options: [
      {id: 'three', label: 'Sign for banks to London, Singapore and Nairobi', dests: ['London', 'Singapore', 'Nairobi'], stamp: 'SIGNED',
        terms: 'Three departures per bank, two banks a day, from {from}: {cities} cities × 3 destinations = {pairs} new one-stop routes.',
        line: 'If the connections hold. Every passenger who misses one costs you passenger care, and the next flight may go to {rival}.',
        effects: {departures: 3, lucknowCall: true, trailPossible: true}},
      {id: 'london', label: 'Sign for London only', dests: ['London'], stamp: 'SIGNED',
        terms: 'One London departure per bank, two banks a day, from {from}: {cities} new one-stop routes.',
        line: 'One route, less to go wrong. Singapore and Nairobi go to {rival}.',
        effects: {departures: 1, lucknowCall: true, trailPossible: true}},
      {id: 'decline', label: 'Decline', dests: [], stamp: 'DECLINED',
        terms: '{partner} takes its flights to {rival}.',
        line: '{partner} signs with {rival} instead. No risk to you, and Indian travellers keep changing planes in the Gulf.',
        effects: {departures: 0, lucknowCall: false, trailPossible: true}}],
    // the incident: two Lucknow feeders land late, 380 passengers for London; hold or go
    incident: {trigger: {from: 'Lucknow', code: 'LKO', flights: 2, lateMin: 25, dest: 'London', pax: 380, holdMin: 20, needs: 'a signed London bank'},
      hold: 'Hold London {holdMin} minutes: about {holdCost} today in fuel and the Heathrow slot ({holdYear} a year over the {lateDays} or so late days). The {pax} make it.',
      go: 'Let it go: the {pax} rebook through {rival}, about {lostCost} today ({lostYear} a year), and {partner} drops one of its two daily London flights: {freqYear} a year.'},
    // the paper trail: a past choice resurfacing in this shift (first that applies)
    trails: [
      {kind: 'stands', when: 'phase 1 built lean and a partner bank signed', doc: 'phase1', line: 'Built lean: {lean} widebody stands for {need}.'},
      {kind: 'birds', when: 'the bird radar skipped in the {radarYear} capital budget', doc: 'budget-2034', line: 'You skipped the bird radar.'}],
    // the bill: margin-note lines, cause then effect
    bill: {
      held: 'You held London for the {from} passengers. On the {lateDays} or so late days a year that costs {holdYear} in fuel and Heathrow slots and keeps {kept} passengers off {rival}.',
      letGo: 'You let London go without the {from} passengers. On the {lateDays} or so late days a year, {kept} people miss it and {rival} wins them, and {partner} dropped one of its two daily London flights: {freqYear} a year.',
      missed: '{missed} connecting passengers a year miss their flight, at {careCost} in passenger care.',
      stands: 'Widebodies waiting for a stand cost {trailCost} a year in penalties.',
      birds: 'The birds off the lakes cost {trailCost} a year in delays.',
      growThree: '{partner} is adding a Frankfurt flight.',
      growLondon: '{partner} wants to add Singapore.',
      furious: '{partner} is furious, and is adding its next flight at {rival}.',
      shrink: '{partner} is moving a flight to {rival}, and {feeder} says it will move its afternoon bank to Delhi if its passengers keep missing flights.',
      declined: 'You declined {partner}. {rival} flies its passengers now, and an Indian city that wants London still changes planes in the Gulf.'},
    // "What really happened", one per chapter (research/history-cards.md as written; 5 from research/dubai.md)
    cards: {
      1: {title: 'What really happened', text: 'Delhi\'s airport operator pays the Airports Authority of India 45.99% of its revenue, and Mumbai\'s pays 38.7%. Those bids won the concessions, and they are paid on every rupee for the whole term.',
        sources: [{label: 'AERA consultation paper on DIAL, Table 6', url: 'https://www.aera.gov.in/uploads/consultations/17383225584994.pdf'},
          {label: 'CRISIL rating rationale for MIAL, 20 Aug 2025', url: 'https://www.crisilratings.com/mnt/winshare/Ratings/RatingList/RatingDocs/MumbaiInternationalAirportLimited_August%2020_%202025_RR_371019.html'}]},
      2: {title: 'What really happened', text: 'Bengaluru\'s airport, the third greenfield airport in India built as a public-private partnership, was finished 32 months after construction began in July 2005. It took nearly a decade before that to acquire the land. Its second terminal was due in March 2021. The domestic side opened in January 2023, and AERA\'s order traces part of the delay to the glass panels, the bamboo ceiling and the boarding bridges arriving late.',
        sources: [{label: 'Kempegowda International Airport, Wikipedia', url: 'https://en.wikipedia.org/wiki/BIAL'},
          {label: 'AERA order on BIAL, paras 5.2.12–5.2.15', url: 'https://aera.gov.in/uploads/airports/16466592165337.pdf'}]},
      3: {title: 'What really happened', text: 'Bengaluru\'s new airport opened in May 2008: the first commercial flight landed on 23 May, and it launched officially the next day. It replaced the congested HAL airport overnight, so a whole city\'s flights moved in a single night.',
        sources: [{label: 'Kempegowda International Airport, Wikipedia', url: 'https://en.wikipedia.org/wiki/BIAL'}]},
      4: {title: 'What really happened', text: 'Since 1998, Atlanta has been the world\'s busiest airport by passengers, every year except 2020. It is Delta\'s main hub: Delta and its regional partners carry about 80% of its passengers, on just over 1,000 flights a day to 225 destinations. Atlanta is not a giant city. Its airport is busy because it is the place where the network connects.',
        sources: [{label: 'Hartsfield–Jackson Atlanta International Airport, Wikipedia', url: 'https://en.wikipedia.org/wiki/Hartsfield%E2%80%93Jackson_Atlanta_International_Airport'}]},
      5: {title: 'What really happened', text: 'In 1985 Dubai\'s government gave a new airline, Emirates, US$10 million and two leased aircraft; its first flight left Dubai for Karachi on 25 October that year. By 2024 Dubai International handled a record 92.3 million passengers, and India was its biggest market, at about 12 million. It has been the world\'s busiest airport for international travel for a decade, ahead of London Heathrow. Like Atlanta, it is busy because it is where the network connects, not because of the city around it.',
        sources: [{label: 'Gulf News, "40 years of UAE: the launch of Emirates Airline"', url: 'https://gulfnews.com/news/uae/government/40-years-of-uae-the-launch-of-emirates-airline-1.920215'}, GULF_SRC]},
      6: {title: 'What really happened', variants: {
        airline: {text: '"On 17 April 2019, Jet Airways suspended all flight operations after lenders spurned an emergency funding request." Indian Oil had already stopped its fuel over unpaid dues.',
          sources: [{label: 'Jet Airways, Wikipedia', url: 'https://en.wikipedia.org/wiki/Jet_Airways'}]},
        airline2: {text: 'Go First filed for insolvency on 2 May 2023 and stopped flying the next day. It blamed engine supply problems: 28 of its aircraft were grounded.',
          sources: [{label: 'Go First, Wikipedia', url: 'https://en.wikipedia.org/wiki/Go_First'}]},
        pandemic: {text: 'After a 2023 arbitration award, which the Delhi High Court upheld in March 2025, Mumbai\'s airport was excused its fee to AAI from 13 March 2020 to 28 February 2022 (23.5 months), and its concession was extended by the same period.',
          sources: [{label: 'Delhi High Court judgment OMP(COMM) 185/2024', url: 'https://delhihighcourt.nic.in/app/showFileJudgment/DIS07032025OMPCOMM1852024_184404.pdf'}]}}},
      7: {title: 'What really happened', text: 'In FY2026, Delhi\'s airport earned more from shops, duty-free, property and parking (₹3,607 crore) than from airlines and passengers\' airport charges (₹3,011 crore). Under AERA\'s rules, 30% of that non-airline income is used to lower what airlines and passengers pay.',
        sources: [{label: 'ICRA rating rationale for DIAL', url: 'https://www.icra.in/Rating/ShowRationalReportFilePdfViewer/145648'},
          {label: 'AERA consultation paper, paras 3.1–3.5', url: 'https://www.aera.gov.in/uploads/consultations/59a940532d01fFinalCPNagurAirport1stSept17.pdf'}]}}
  };
  function fill(t, v) { return String(t).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }); }
  function ch5Card(ch, variant) {   // a chapter's card, {title, text, sources}
    var c = CH5_SCRIPT.cards[ch]; if (!c) return null;
    if (c.variants) { var v = c.variants[variant] || c.variants.airline; return {title: c.title, text: v.text, sources: v.sources}; }
    return {title: c.title, text: c.text, sources: c.sources};
  }
  // the expert's shift summary for an era the engine plays on its own (a stub chapter, or the years between chapters)
  var AUTO_SHIFT = {1: {stars: 3, otp: 0.88, cx: 0.93, safety: 100}, 2: {stars: 3, otp: 0.94, cx: 0.95, safety: 100}, 3: {stars: 3, otp: 0.82, cx: 0.9, safety: 100}};
  function autoShift(e) { return Object.assign({level: Math.min(4, e), moves: 700, sched: 720}, AUTO_SHIFT[e] || {stars: 2, otp: 0.86, cx: 0.91, safety: 100}); }
  // VSIEra.advance(state, era, opts): the engine plays the player's own concession forward to the start of era `era`
  // (state.era === era, before its shift), using the player's own choices where they exist and the defaults below where
  // they don't: construction paid and fully trialled; each era's shift an expert's (opts.shift(e) to override); each
  // board pays the most dividend allowed and orders phase 2 when offered (opts.board(state, options) to override).
  // Never touches a concession that is over. Pure: returns a new state.
  function advance(state, era, opts) {
    ensure();
    opts = opts || {};
    var st = clone(state);
    if (!st || st.over) return st;
    if (st.building) st = applyConstruction(st, {choices: opts.construction || {monsoon: 'pay', overrun: 'pay', trials: 'full'},
      finishedOn: addMonths(st.signedOn, 48)});
    for (var guard = 0; guard < 16 && !st.over && st.era < era; guard++) {
      var h = st.history[st.history.length - 1] || {};
      // the era's shift is already played if the last entry is this era's report (waiting for its board)
      if (!(h.era === st.era && !h.board && !h.construction)) { autoDecide(st); st = applyShift(st, opts.shift ? opts.shift(st.era) : autoShift(st.era)).state; }
      if (st.over) break;
      var bo = boardOptions(st);
      st = applyBoard(st, opts.board ? opts.board(st, bo) : {appeal: false, prepayCr: 0, dividendCr: bo.dividend.maxCr,
        bought: bo.investments.filter(function (i) { return i.id === 'phase2'; }).map(function (i) { return i.id; })});
    }
    return st;
  }
  // the pile Chapter 5 reads from (the decisions its tags point at), added to whatever the save already holds
  function ch5BaseDocs(st) {
    var phase1 = st.phase1 === 'big' ? 'big' : 'lean', radar = st.radar === 'bought' ? 'bought' : 'skipped', ph = P.vsi_stages['1A_' + phase1];
    var base = [
      {id: 'concession', title: 'Concession Agreement', year: 0, date: st.signedOn || ch5Date(st, 1).iso, kind: 'agreement', stamp: 'EXECUTED',
        summary: 'Sixty years to build and run Vikram Sarabhai International, signed by ' + (st.founder || 'the director') + ' for ' + st.parent + ', with AAI, the State through MADC and NIIF.'},
      {id: 'phase1', title: 'Phase 1 choice, ' + cal(1), year: 1, date: ch5Date(st, 1).iso, kind: 'phase1', stamp: 'APPROVED',
        summary: phase1 === 'lean' ? 'You built phase 1 lean: ' + ph.cap + ' million passengers a year and ' + CH5.stands.lean + ' widebody stands at the international pier, for ' + cr(ph.cost) + '.' :
          'You built phase 1 big: ' + ph.cap + ' million passengers a year and ' + CH5.stands.need + ' widebody stands at the international pier, for ' + cr(ph.cost) + '.'},
      {id: 'budget-2034', title: 'Capital budget, ' + cal(CH5.radarYear), year: CH5.radarYear, date: ch5Date(st, CH5.radarYear).iso, kind: 'budget', stamp: 'APPROVED',
        summary: radar === 'bought' ? 'You bought the bird radar for ' + cr(CH5.radarCr * Math.pow(1 + P.cpi_forward, CH5.radarYear - 1)) + '. It watches the lakes east of runway 3.' :
          'You skipped the bird radar and saved ' + cr(CH5.radarCr * Math.pow(1 + P.cpi_forward, CH5.radarYear - 1)) + '. Nobody watches the lakes east of runway 3.'},
      {id: 'feeders-2033', title: 'Feeder agreement with ' + CH5.feederAirline + ', ' + cal(8), year: 8, date: ch5Date(st, 8).iso, kind: 'route-agreement', stamp: 'SIGNED',
        summary: CH5.feederAirline + ' flies ' + CH5.feeders.length + ' Indian cities into VSI in one bank each afternoon, timed so its passengers can change planes here.'}];
    var have = (st.docs || []).filter(function (d) { return d && d.id; }), ids = {};
    have.forEach(function (d) { ids[d.id] = true; });
    return base.filter(function (d) { return !ids[d.id]; }).concat(have).map(dw);
  }
  function ch5Ready(st) {   // the chapter's own fields on a state at the start of year 14
    var r = ch5Rates(CH5.year);
    st.radar = st.radar === 'bought' ? 'bought' : 'skipped';
    if (st.radar === 'bought' && !(st.s.extra_pay || []).some(function (x) { return x.year === CH5.radarYear; })) st.s.extra_pay = (st.s.extra_pay || []).concat([{year: CH5.radarYear, cr: CH5.radarCr}]);
    st.ch5 = {rates: {perConnectionCr: r.perConnectionCr, missedCostCr: r.missedCostCr, holdCostCr: r.holdCostCr}};
    st.docs = ch5BaseDocs(st);
    return st;
  }
  // VSIEra.ch5.start(save, opts): Chapter 5 from the player's OWN concession (zm_campaign). A save still short of year 14
  // is played forward by the engine (advance); one already in Chapter 5 starts from where it is. Returns null for a save
  // that is not resumable (no signature, founder or signing day; an older version; the sample company): the chapter
  // never falls back to the sample. opts.radar: the bird-radar call, if the player's save does not hold one yet.
  function ch5Start(save, opts) {
    ensure();
    opts = opts || {};
    if (!resumable(save).ok) return null;
    var st = advance(save, 4, opts);
    if (!st || st.over || st.era !== 4) return null;
    if (opts.radar && !st.radar) st.radar = opts.radar;
    st.sample = false;
    return ch5Ready(ensureDocs(st));
  }
  // VSIEra.ch5.fixture(opts): the SAMPLE concession (Meridian Infra, Asha Rao), for the ?chapter5= test URL and the tests
  // only. It is marked sample: true and test: true, so resumable() refuses it and it can never be saved as zm_campaign.
  // opts.from (a player's save) is the same as ch5.start(opts.from).
  function ch5Fixture(opts) {
    ensure();
    opts = opts || {};
    if (opts.from) return ch5Start(opts.from, opts);
    var phase1 = opts.phase1 === 'big' ? 'big' : 'lean';
    var st = newCampaign({parent: opts.parent || 'Meridian Infra', founder: opts.founder || 'Asha Rao', phase1: phase1, bid: {type: 'share', value: 15},
      gearing: 70, repayment: 'sculpted', cure: true, signedOn: opts.signedOn || '2026-04-01', endsOn: opts.endsOn || '2086-03-31'}, 1);
    st.sample = true; st.test = true;
    st = applyConstruction(st, {choices: {monsoon: 'pay', overrun: 'pay', trials: 'full'}, finishedOn: '2030-04-01'});
    st.radar = opts.radar === 'bought' ? 'bought' : 'skipped';
    if (st.radar === 'bought') st.s.extra_pay = [{year: CH5.radarYear, cr: CH5.radarCr}];
    st = advance(st, 4);
    st.docs = [];
    return ch5Ready(st);
  }
  function ch5Choices(state) {   // each line's banks a year at the first partner year's prices, if every connection holds
    var r = ch5Rates(CH5.banksFrom), days = P.p2a;
    return ['three', 'london', 'decline'].map(function (id) {
      var day = ch5PerBank(id) * CH5.banksPerDay, yr = day * days * r.perConnInr / 1e7;
      return {id: id, day: day, yearCr: yr};
    });
  }
  // the player's stake at the end of the era (eraYears(4)[2]) with the given partner banks (null: none), for the
  // counterfactuals on the slip and the bill
  function ch5StakeAt(state, hub) {
    var s = clone(state.s); delete s.hub; if (hub) s.hub = hub;
    var eng = simulate(s, eraYears(4)[2]), row = eng.rows[eng.rows.length - 1];
    return eng.step_in ? 0 : stakeValue(eng, row) * state.stake / 100;
  }
  function ch5Hub(yearCr, costCr, growth) { return {from: CH5.banksFrom, until: eraYears(4)[2], incCr: yearCr, costCr: costCr || 0, growth: growth || 0}; }
  function ch5FrontPage(state) {
    ensure();
    var eng = simulate(state.s, CH5.year - 1), last = eng.rows[eng.rows.length - 1], d = ch5Date(state, CH5.year);
    var paxM = last ? Math.round(last.pax) : 0, lr = state.lastReport || {}, F = CH5_SCRIPT.frontPage;
    var v = {feeder: CH5.feederAirline, partner: CH5.partner, partnerPoss: poss(CH5.partner), cities: CH5.feeders.length, company: state.parent, paxM: paxM, lastYear: cal(CH5.year - 1),
      coverLine: lr.cover != null ? 'In its hardest recent year VSI earned ' + coverWords(lr.cover).replace(' earned', '') + ' to its banks.' : 'VSI has no loan payments due.',
      stake: state.stake, stakeValue: stakeWords(lr.stakeValueCr || 0), stands: state.phase1 === 'big' ? CH5.stands.need : CH5.stands.lean};
    return {masthead: F.masthead, dateLine: d.words + ' · Nagpur', price: F.price, lead: F.lead, deck: fill(F.deck, v),
      sub: {head: F.sub.head, body: fill(F.sub.body, v)},
      columns: F.columns.map(function (c, i) { return i === 0 && state.s.chargeCut ? {head: 'Dubai matches VSI\'s cut', body: 'Dubai matched VSI\'s 30% cut in airline charges within a year. The flights it pulled from the Gulf mostly fly past each other.'} : {head: c.head, body: fill(c.body, v)}; }),
      photo: {kind: F.photo.kind, caption: fill(F.photo.caption, v)},
      company: state.parent, founder: state.founder || 'Asha Rao', signature: state.signature || state.founder || 'Asha Rao',
      sources: [GULF_SRC]};
  }
  function ch5Decision(state) {
    ensure();
    var cs = ch5Choices(state), by = {}; cs.forEach(function (c) { by[c.id] = c; });
    var lean = state.phase1 !== 'big', d = ch5Date(state, CH5.year), y1 = eraYears(4)[2];
    var standLine = lean ? poss(CH5.partner) + ' afternoon bank needs ' + CH5.stands.need + ' widebody stands at the international pier. Your phase 1 built ' + CH5.stands.lean + '; the other widebodies will wait on the taxiways.' :
      poss(CH5.partner) + ' afternoon bank needs ' + CH5.stands.need + ' widebody stands at the international pier. Your phase 1 built ' + CH5.stands.need + '.';
    var vv = {rival: CH5.rival, partner: CH5.partner, from: cal(CH5.banksFrom), cities: CH5.feeders.length, pairs: CH5.feeders.length * 3};
    var base = ch5StakeAt(state, null);
    function slip(id) {
      var c = by[id], o = ch5Opt(id);
      if (id === 'decline') return {big: 'No new connections', money: '₹0 a year', stake: 'your ' + state.stake + '%: no change', line: fill(o.line, vv)};
      var gain = ch5StakeAt(state, ch5Hub(c.yearCr)) - base;
      return {big: '+' + c.day.toLocaleString('en-IN') + ' connections a day', money: cr(c.yearCr) + ' a year',
        stake: 'your ' + state.stake + '%: +' + stakeWords(gain) + ' by ' + cal(y1), line: fill(o.line, vv)};
    }
    return {docType: 'route-agreement', docId: CH5.docId + cal(CH5.year), title: 'Route agreement: ' + CH5.partner + ' at Vikram Sarabhai International', date: d.iso, dateWords: d.words,
      parties: {airport: 'Vikram Sarabhai International Airport Limited (VSIAL)', airline: CH5.partner, signatory: CH5.signatory},
      body: [
        CH5.partner + ' will base long-haul flights at VSI from ' + cal(CH5.banksFrom) + ', timed to leave after ' + CH5.feederAirline + '\'s afternoon feeder bank, so passengers from ' + CH5.feeders.length + ' Indian cities can change planes here.',
        CH5.rival + ' has offered ' + CH5.partner + ' the same banks, with a ' + CH5.rivalMctMin + '-minute connection. At VSI the connection is ' + CH5.mctMin + ' minutes, on one pier, on Indian soil.',
        'VSIAL undertakes that connecting passengers make their flights. When a feeder bank runs late, the duty manager may hold a departure, at VSIAL\'s cost.',
        standLine],
      choices: CH5_SCRIPT.options.map(function (o) { return {id: o.id, label: o.label, terms: fill(o.terms, vv), slip: slip(o.id), effects: o.effects}; }),
      stamps: {three: 'SIGNED', london: 'SIGNED', decline: 'DECLINED'}};
  }
  function ch5ApplyDecision(state, choiceId) {
    ensure();
    state = clone(state);
    var id = ['three', 'london', 'decline'].indexOf(choiceId) >= 0 ? choiceId : 'decline';
    state.ch5 = state.ch5 || {};
    state.ch5.choice = id;
    var c = ch5Choices(state).filter(function (x) { return x.id === id; })[0];
    var doc = {id: CH5.docId + cal(CH5.year), title: 'Route agreement with ' + CH5.partner + ', ' + cal(CH5.year), year: CH5.year, date: ch5Date(state, CH5.year).iso, kind: 'route-agreement',
      stamp: id === 'decline' ? 'DECLINED' : 'SIGNED',
      summary: id === 'three' ? 'You signed ' + CH5.partner + ' for banks to London, Singapore and Nairobi from ' + cal(CH5.banksFrom) + ': ' + c.day.toLocaleString('en-IN') + ' connections a day, worth about ' + cr(c.yearCr) + ' a year if they hold.' :
        id === 'london' ? 'You signed ' + CH5.partner + ' for London only from ' + cal(CH5.banksFrom) + ': ' + c.day.toLocaleString('en-IN') + ' connections a day, worth about ' + cr(c.yearCr) + ' a year if they hold.' :
        'You declined ' + CH5.partner + '. Its long-haul flights went to ' + CH5.rival + '.'};
    dw(doc);
    state.docs = (state.docs || []).filter(function (x) { return x.id !== doc.id; }).concat([doc]);
    addPaper(state, 5, ch5FrontPage(state),  state.s.network === 'anchor' || state.s.network === 'two' ? 'Because your afternoon bank fed ' + CH5.feeders.length + ' cities' : 'Because ' + CH5.partner + ' wanted an Indian hub', CH5.year);
    logDecision(state, {id: 'ch5-partner', group: 'partner', chapter: 5, year: CH5.year, label: CH5.partner, chosen: id,
      chosenLabel: {three: 'Signing ' + CH5.partner + ' for three routes', london: 'Signing ' + CH5.partner + ' for London', decline: 'Declining ' + CH5.partner}[id], 'default': 'decline', alt: {hub: null}});
    return state;
  }
  function ch5Trail(state) {
    var c = state.ch5 && state.ch5.choice;
    // the stand shortage needs the partner's widebodies
    if (state.phase1 !== 'big' && c && c !== 'decline') { var p = ch5Doc(state, 'phase1'); var sl = fill(CH5_SCRIPT.trails[0].line, {lean: CH5.stands.lean, need: CH5.stands.need}), sd = p ? p.title : 'Phase 1 choice'; return {kind: 'stands', doc: sd, line: sl, id: 'stands', docId: 'phase1', tag: {doc: sd, line: sl}}; }
    if (state.radar !== 'bought') { var b = ch5Doc(state, 'budget-2034'); var bl = CH5_SCRIPT.trails[1].line, bdt = b ? b.title : 'Capital budget'; return {kind: 'birds', doc: bdt, line: bl, id: 'birds', docId: 'budget-2034', tag: {doc: bdt, line: bl}}; }
    return null;
  }
  // the hold call's stakes, today and over a year, from the same rates the bill uses (the shift is in the first partner year)
  function ch5HoldMoney(r) {
    var H = CH5.hub, days = P.p2a, L = CH5.intl[H.dest];
    return {holdCr: r.holdInr / 1e7, holdYearCr: r.holdInr * CH5.lateDaysPerYear / 1e7,
      lostCr: H.pax * (r.perConnInr + r.careInr) / 1e7, lostYearCr: H.pax * (r.perConnInr + r.careInr) * CH5.lateDaysPerYear / 1e7,
      freqYearCr: L.connecting * days * r.perConnInr / 1e7};
  }
  function ch5ShiftPlan(state) {
    ensure();
    var choice = (state.ch5 && state.ch5.choice) || 'decline', r = ch5Rates(CH5.banksFrom), dests = ch5Dests(choice);
    var intl = dests.map(function (d) { var x = CH5.intl[d]; return {id: 'SKW-' + x.code, dest: d, code: x.code, std: x.std, aircraft: x.aircraft, connecting: x.connecting}; });
    var tr = ch5Trail(state), sky = CH5.docId + cal(CH5.year);
    // tags are small (§4: about 120px): a short name of the document and one line; clicking opens the full document
    var tags = [{docId: 'feeders-2033', doc: 'Feeder agreement, ' + cal(8), line: CH5.feeders.length + ' cities, ' + CH5.feederFrom + '–' + CH5.feederTo + '.', anchor: 'transfer'}];
    if (dests.length) tags.push({docId: sky, doc: CH5.partner + ' agreement, ' + cal(CH5.year), line: ch5PerBank(choice).toLocaleString('en-IN') + ' connecting a bank, ' + dests.length + (dests.length > 1 ? ' departures.' : ' departure.'), anchor: 'intl-pier'});
    else tags.push({docId: sky, doc: CH5.partner + ' agreement, ' + cal(CH5.year), line: 'Declined: ' + CH5.partner + ' flies from ' + CH5.rival + '.', anchor: 'intl-pier'});
    if (tr) tags.push({docId: tr.docId, doc: tr.tag.doc, line: tr.tag.line, anchor: tr.id === 'stands' ? 'stands' : 'runway'});
    var H = CH5.hub, m = ch5HoldMoney(r), hv = {holdMin: H.holdMin, pax: H.pax, rival: CH5.rival, partner: CH5.partner, lateDays: CH5.lateDaysPerYear,
      holdCost: crs(m.holdCr), holdYear: crs(m.holdYearCr), lostCost: crs(m.lostCr), lostYear: crs(m.lostYearCr), freqYear: crs(m.freqYearCr)};
    var hub = dests.indexOf(H.dest) < 0 ? null : {id: 'feeder-late', from: H.from, code: H.code, flights: 2, lateMin: H.lateMin, dest: H.dest, pax: H.pax, holdMin: H.holdMin,
      holdCostCr: m.holdCr, letGoLostCr: m.lostCr,
      holdLine: fill(CH5_SCRIPT.incident.hold, hv), letGoLine: fill(CH5_SCRIPT.incident.go, hv)};
    return {level: 3, year: CH5.banksFrom,
      partner: CH5.partner, partnerCode: CH5.partnerCode, partnerRadio: CH5.partnerRadio,
      feeder: {airline: CH5.feederAirline, code: CH5.feederCode, radio: CH5.feederRadio, cities: CH5.feeders.map(function (c) { return {code: c[1], name: c[0]}; }), from: CH5.feederFrom, to: state.s.network === 'two' ? '14:10' : CH5.feederTo, flights: CH5.feederFlights, paxEach: CH5.feederPaxEach},
      intl: intl,
      rates: {perConnectionCr: r.perConnectionCr, missedCostCr: r.missedCostCr, rival: CH5.rival},
      hub: hub, trail: tr, tags: tags,
      stands: {need: CH5.stands.need, have: state.phase1 === 'big' ? CH5.stands.need : CH5.stands.lean},
      network: state.s.network || null, second: state.s.network === 'two' ? {airline: NM.plateau, code: 'BLR', name: 'Bengaluru'} : null};
  }
  function ch5Briefing(state) {
    var plan = ch5ShiftPlan(state), d = ch5Date(state, CH5.banksFrom), sky = CH5.docId + cal(CH5.year), lines = [];
    var lon = plan.intl.filter(function (x) { return x.dest === 'London'; })[0];
    lines.push(lon ? {text: poss(CH5.partner) + ' London bank departs ' + lon.std + ' · ' + lon.connecting + ' connecting', docId: sky} :
      {text: 'No ' + CH5.partner + ' bank today: it flies from ' + CH5.rival, docId: sky});
    lines.push({text: CH5.feederAirline + '\'s feeder bank lands ' + CH5.feederFrom + '–' + CH5.feederTo + ' from ' + CH5.feeders.length + ' cities', docId: 'feeders-2033'});
    var tr = plan.trail;
    lines.push(tr && tr.id === 'stands' ? {text: CH5.stands.lean + ' widebody stands at the international pier for ' + CH5.stands.need + ' widebodies', docId: 'phase1'} :
      tr && tr.id === 'birds' ? {text: 'No bird radar: the lakes east of runway 3 are unwatched', docId: 'budget-2034'} :
      {text: 'Bird radar on, and a stand for every widebody', docId: 'budget-2034'});
    lines.forEach(function (l) { var x = ch5Doc(state, l.docId); l.doc = x ? x.title : l.docId; l.ref = ch5Short(state, l.docId); });
    return {title: 'Duty manager\'s handover', date: d.words, lines: lines,
      watch: plan.hub ? 'The ' + CH5.hub.from + ' flights. If they run late, ' + CH5.hub.pax + ' people miss London.' : 'The feeder bank: get every domestic connection made.',
      autoStartSec: 6};
  }
  function ch5ApplyShift(state, result) {
    ensure();
    state = clone(state);
    result = result || {};
    state.ch5 = state.ch5 || {};
    var choice = state.ch5.choice || 'decline', plan = ch5ShiftPlan(state), r = ch5Rates(CH5.banksFrom), days = P.p2a, perDay = CH5.banksPerDay;
    var made = 0, missed = 0, bd = result.byDest || {};
    var dests = Object.keys(bd);
    // money comes from partner connections only: the international departures hub.js reports in byDest
    // (the domestic transfers move passenger satisfaction below, not this income). Declined: none.
    if (choice === 'decline') { made = 0; missed = 0; }
    else if (dests.length) dests.forEach(function (k) { made += bd[k].made || 0; missed += bd[k].missed || 0; });
    else { made = result.made || 0; missed = result.missed || 0; }
    var dom = result.domestic || {}, domMadeYr = Math.round((dom.made || 0) * perDay * days), domMissYr = Math.round((dom.missed || 0) * perDay * days);
    var H = plan.hub, held = !!(H && result.held && result.held[H.dest]), letGo = !!(H && !held), hm = ch5HoldMoney(r);
    // a normal day: the Lucknow flights are on time, so their passengers connect without a hold. On the late days the
    // 380 make London (held, at a slot cost) or miss it (let go); let go, and the partner drops one of its two daily London
    // flights for the era, with its connections
    var incMiss = letGo ? Math.min(missed, H.pax) : 0;
    var normMade = made + incMiss, normMiss = missed - incMiss;
    var freqLost = letGo ? CH5.intl[H.dest].connecting * days : 0;
    var madeYr = Math.max(0, normMade * perDay * days - incMiss * CH5.lateDaysPerYear - freqLost);
    var missYr = normMiss * perDay * days + incMiss * CH5.lateDaysPerYear;
    var holdsYr = H && held ? CH5.lateDaysPerYear : 0;
    var tr = plan.trail, trailMin = tr && result.trail && result.trail.happened ? Math.max(0, result.trail.minutesLost || 0) : 0;
    var trailDays = tr && tr.id === 'birds' ? CH5.birdDaysPerYear : days;
    var earnedCr = madeYr * r.perConnInr / 1e7;
    var careCr = missYr * r.careInr / 1e7, holdCr = holdsYr * r.holdInr / 1e7, trailCr = trailMin * r.standMinInr * trailDays / 1e7;
    var spentCr = careCr + holdCr + trailCr;
    var share = made + missed > 0 ? made / (made + missed) : null;
    var normShare = normMade + normMiss > 0 ? normMade / (normMade + normMiss) : null;
    var yrShare = madeYr + missYr > 0 ? madeYr / (madeYr + missYr) : null;
    // route growth (est.), a year through the era: connections that hold bring new flights, misses send them to Doha;
    // a partner whose flagship left without 380 of its passengers is slow to add more (after the cap, so it always shows)
    var growth = yrShare == null ? 0 : Math.max(-0.12, Math.min(0.12, (yrShare - 0.9) * 2.4)) - (letGo ? CH5.letGoGrowthHit : 0);
    state.s.hub = choice === 'decline' ? null : ch5Hub(earnedCr, spentCr, growth);
    if (!state.s.hub) delete state.s.hub;
    else state.s.hub.perDay = Math.round(madeYr / days);
    if (H) {   // the decision log: had London gone without the Lucknow passengers (design/debrief.md §2)
      var altLost = (CH5.intl[H.dest].connecting * days + H.pax * CH5.lateDaysPerYear) * r.perConnInr / 1e7, altCare = H.pax * CH5.lateDaysPerYear * r.careInr / 1e7;
      var altHub = held ? ch5Hub(Math.max(0, earnedCr - altLost), Math.max(0, spentCr - holdCr + altCare), Math.max(-0.12, growth - CH5.letGoGrowthHit)) : clone(state.s.hub);
      altHub.perDay = Math.round(Math.max(0, madeYr - CH5.intl[H.dest].connecting * days - (held ? H.pax * CH5.lateDaysPerYear : 0)) / days);
      logDecision(state, {id: 'ch5-hold', group: 'hold', chapter: 5, year: CH5.banksFrom, label: 'Holding London for Lucknow', chosen: held ? 'hold' : 'letgo',
        chosenLabel: held ? 'Holding London for Lucknow' : 'Letting London go', 'default': 'letgo', alt: {hub: altHub}});
    }
    logShift(state, 5, result);
    var otp = result.otp != null ? result.otp : 0.85;
    // the whole shift's connections (domestic too) move the Mall and passenger care for the era; one bank of the day, so a quarter weight
    var allShare = result.made != null && result.made + (result.missed || 0) > 0 ? result.made / (result.made + (result.missed || 0)) : normShare;
    var cx = allShare == null ? 0.9 : Math.max(0.6, Math.min(0.97, 0.9 + (allShare - 0.9) * 0.25));
    var shift = {level: plan.level, stars: result.stars != null ? result.stars : 2, otp: otp, cx: cx, safety: 100};
    var out = applyShift(state, shift), st = out.state, rep = out.report;
    var eng = simulate(st.s, eraYears(4)[2]);
    var hubRows = eng.rows.filter(function (x) { return x.year >= CH5.banksFrom && x.year <= eraYears(4)[2]; });
    // the era's figures are the partner's banks only: the Chapter 4 bank (s.streams) is taken out
    var sNo = clone(st.s); delete sNo.streams; delete sNo.rivalTake;
    var hubOnly = simulate(sNo, eraYears(4)[2]).rows.filter(function (x) { return x.year >= CH5.banksFrom && x.year <= eraYears(4)[2]; });
    var hubEarned = hubOnly.reduce(function (a, x) { return a + x.hubInc; }, 0), hubSpent = hubOnly.reduce(function (a, x) { return a + x.hubCost; }, 0);
    // the banks' number for the years the partner flies (the era's worst year is 2039, before the first bank)
    var cov = null; hubRows.forEach(function (x) { if (x.dscr != null && (cov == null || x.dscr < cov)) cov = x.dscr; });
    var y1 = cal(eraYears(4)[2]);
    // what the decision did to the player's stake: with and without the partner, the same year
    var stakeNow = rep.stakeValueCr, stakeThen = (state.lastReport || {}).stakeValueCr;
    var alt = choice === 'decline' ? ch5StakeAt(st, ch5Hub(ch5Choices(st)[0].yearCr)) : ch5StakeAt(st, null), delta = choice === 'decline' ? alt - stakeNow : stakeNow - alt;
    var pct = st.stake + '%', who = st.parent || 'Your company';
    var lead = choice === 'decline' ?
      'Declining ' + CH5.partner + ' kept the risk off your books, and passed up about ' + stakeWords(delta) + ' on your ' + pct + ' by ' + y1 + ', had the three banks held.' :
      'Signing ' + CH5.partner + (delta >= 0 ? ' added about ' + stakeWords(delta) + ' to ' : ' cost about ' + stakeWords(-delta) + ' off ') + 'your ' + pct + ' of VSIAL by ' + y1 + '.';
    var thenY = cal(eraYears(Math.max(1, (state.era || 4) - 1))[2]), retPct = rep.returnPerYear;
    var stakeLine = who + ' owns ' + pct + ' of VSIAL, worth about ' + stakeWords(stakeNow) + ' in ' + y1 + (stakeThen != null ? ', up from ' + stakeWords(stakeThen) + ' in ' + thenY + ' as the airport grew and paid down its loans' : '') + '. ' +
      (rep.stakeCheck ? 'It has put in ' + stakeWords(rep.stakeCheck.moneyInCr) + ' since ' + rep.stakeCheck.fromYear + (rep.stakeCheck.dividendsCr >= 1 ? ' and taken out ' + stakeWords(rep.stakeCheck.dividendsCr) + ' in dividends' : '') + ': about ' + retPct + '% a year. ' : '') +
      (choice === 'decline' ? 'With ' + poss(CH5.partner) + ' three banks: about ' + stakeWords(alt) + '.' : 'Without ' + CH5.partner + ': about ' + stakeWords(alt) + '.');
    // the margin note: cause and effect, in the adviser's hand
    var margin, routes = [];
    var BL = CH5_SCRIPT.bill, mv = {from: H ? H.from : '', lateDays: CH5.lateDaysPerYear, holdYear: cr(holdCr), kept: H ? (H.pax * CH5.lateDaysPerYear).toLocaleString('en-IN') : '',
      rival: CH5.rival, partner: CH5.partner, feeder: CH5.feederAirline, freqYear: cr(freqLost * r.perConnInr / 1e7),
      missed: Math.round(normMiss * perDay * days).toLocaleString('en-IN'), careCost: cr(normMiss * perDay * days * r.careInr / 1e7), trailCost: cr(trailCr)};
    if (choice === 'decline') margin = fill(BL.declined, mv);
    else {
      var bits = [];
      if (H) bits.push(fill(held ? BL.held : BL.letGo, mv));
      if (normMiss * perDay * days * r.careInr / 1e7 >= 1) bits.push(fill(BL.missed, mv));
      if (trailCr >= 1) bits.push(fill(tr.kind === 'stands' ? BL.stands : BL.birds, mv));
      if (letGo) bits.push(fill(BL.furious, mv));
      else if (growth >= 0.05 && choice === 'three') { routes.push('Frankfurt'); bits.push(fill(BL.growThree, mv)); }
      else if (growth >= 0.05) { routes.push('Singapore'); bits.push(fill(BL.growLondon, mv)); }
      else if (growth < 0) bits.push(fill(BL.shrink, mv));
      margin = bits.join(' ');
    }
    var paragraph = choice === 'decline' ?
      'In ' + y1 + ' Vikram Sarabhai International ran its domestic banks only: ' + domMadeYr.toLocaleString('en-IN') + ' passengers a year changed between ' + CH5.feederAirline + '\'s flights here' + (domMissYr ? ', and ' + domMissYr.toLocaleString('en-IN') + ' missed theirs' : '') + '. ' + CH5.partner + ' built its Indian traffic through ' + CH5.rival + '.' :
      'From ' + cal(CH5.banksFrom) + ', ' + CH5.partner + ' flew ' + andList(ch5Dests(choice)) + ' out of VSI twice a day. ' +
      Math.round(madeYr).toLocaleString('en-IN') + ' passengers a year changed planes here instead of in the Gulf' + (missYr >= 1 ? ', and ' + Math.round(missYr).toLocaleString('en-IN') + ' missed their flight' : '') + '.';
    // F4: every figure on the page in one period, a year (from the first partner year), and labelled so
    var table = choice === 'decline' ? [] : [{label: 'Earned a year', cr: Math.round(earnedCr)}, {label: 'Spent a year', cr: Math.round(spentCr)}, {label: 'Connections to ' + CH5.partner + ', a year', made: Math.round(madeYr), missed: Math.round(missYr)}];
    table.push({label: 'Domestic connections, a year', made: domMadeYr, missed: domMissYr});
    var bill = {title: 'Annual report, ' + y1, year: y1, lead: lead, paragraph: paragraph, per: 'a year, from ' + cal(CH5.banksFrom),
      table: table, margin: margin, routes: routes,
      cover: {ratio: cov == null ? null : Math.floor(cov * 100 + 1e-9) / 100, words: coverWords(cov), light: lightOf(cov), years: cal(CH5.banksFrom) + '–' + y1},
      stake: {pct: rep.stakePct, valueCr: stakeNow, year: y1, thenCr: stakeThen != null ? stakeThen : null, thenYear: thenY, returnPct: retPct, check: rep.stakeCheck, withoutCr: choice === 'decline' ? null : Math.round(alt), passedUpCr: choice === 'decline' ? Math.round(delta) : null, deltaCr: Math.round(delta), words: stakeLine},
      signed: {name: st.founder || 'Asha Rao', title: 'Director, for ' + (st.parent || 'Meridian Infra')},
      era: {earnedCr: Math.round(hubEarned), spentCr: Math.round(hubSpent), growthPct: Math.round(growth * 1000) / 10, years: cal(CH5.banksFrom) + '–' + String(y1).slice(2)}};
    var card = ch5Card(5);
    st.ch5.result = {made: made, missed: missed, held: held, share: share, growth: growth};
    st.ch5.bill = bill;
    st.docs = (st.docs || []).concat([dw({id: 'report-' + y1, title: 'Annual report, ' + y1, year: eraYears(4)[2], date: ch5Date(st, eraYears(4)[2]).iso, kind: 'report', stamp: 'FILED', summary: margin || paragraph})]);
    return {state: st, bill: bill, card: card, report: rep};
  }
  var ch5 = {script: CH5_SCRIPT, card: ch5Card, fixture: ch5Fixture, start: ch5Start, frontPage: ch5FrontPage, decision: ch5Decision, applyDecision: ch5ApplyDecision, briefing: ch5Briefing,
    shiftPlan: ch5ShiftPlan, applyShift: ch5ApplyShift, rates: function (y) { var r = ch5Rates(y || CH5.year); return {perConnectionCr: r.perConnectionCr, missedCostCr: r.missedCostCr, holdCostCr: r.holdCostCr}; }};

  // =============================================================================================
  // Stage 0 (design/build-plan.md §2): Chapters 3, 4, 6 and 7 in the Chapter 5 shape, the bridges between chapters, the
  // decision log (s.decisions) and the Black Box (VSIEra.debrief). Each chapter:
  //   start(save) | fixture(opts) → frontPage → decision → applyDecision → briefing → shiftPlan → (the shift) → applyShift
  //   → {state, bill, card}
  // The shifts are stubs in Stage 0: shiftPlan(state).auto is an expert's result that hub.js (or a bot) can hand straight to
  // applyShift. Money still comes from connections, routes, land and shops (s.streams, s.hub, s.ac_year), never from movements.
  // Numbers marked (est.) are game assumptions; every history card is research/history-cards.md as written.
  // =============================================================================================
  var NM = {plateau: 'Akasa Air', feeder: CH5.feederAirline, partner: CH5.partner, rival: 'GMR Airports', district: 'Zero Mile District', l5: 'NIIF'};
  var CH_ERAS = {3: [1], 4: [2, 3], 5: [4], 6: [5, 6, 7], 7: [8, 9, 10, 11, 12]};
  function firstEra(n) { return CH_ERAS[n][0]; }
  function chYears(n) { var e = CH_ERAS[n]; return [eraYears(e[0])[1], eraYears(e[e.length - 1])[2]]; }
  function prAt(year) { return Math.pow(1 + P.cpi_forward, year - 1); }
  // one domestic connection at VSI (the year's prices): the inbound leg's landing fee per seat, the onward passenger fee and
  // shopping in transfer (money.json, the same rates Chapter 5 uses for its domestic leg)
  function domConnInr(year) {
    var udf = J('aero.udf_greenfield_opening_nmia', {dom_dep: 620, intl_dep: 1225}), landDom = J('aero.landing_dom_narrow_per_t', 347);
    var xfer = J('nonaero.transfer_vs_od_spend', 0.75), shop = P.nar0 + (P.nar1 - P.nar0) * 0.5;
    return (landDom * 79 / 180 + udf.dom_dep + shop * xfer) * prAt(year);
  }
  // a stream of connections (s.streams[key]): perDay connections from year `from`, growing through `until`, priced at the
  // year's prices (o.perConnInr overrides the domestic rate; o.made the share that connect)
  function streamOf(perDay, from, o) {
    o = o || {};
    var per = o.perConnInr || domConnInr(from), made = o.made == null ? 1 : o.made, inc = perDay * made * P.p2a * per / 1e7;
    var S = {perDay: Math.round(perDay * made), from: from, until: o.until || 60, incCr: inc, costCr: (o.costShare || 0) * inc, growth: o.growth || 0};
    if (o.costUntil) S.costUntil = o.costUntil;
    if (o.dip) S.dip = o.dip;
    return S;
  }
  function perDayAt(S, y) {
    if (!S || y < S.from || (S.stop && y >= S.stop)) return 0;
    var f = 1; (S.dip || []).forEach(function (d) { if (y >= d.from && y <= d.until) f *= d.f; });
    return (S.perDay || 0) * Math.pow(1 + (S.growth || 0), Math.min(y, S.until || 60) - S.from) * f;
  }
  function networkPerDay(st, y) {   // connections a day through VSI in year y, from every stream and the partner's banks
    var s = st.s, n = 0;
    vals(s.streams).forEach(function (S) { n += perDayAt(S, y); });
    if (s.hub && s.hub.perDay) n += s.hub.perDay * Math.pow(1 + (s.hub.growth || 0), Math.min(y, s.hub.until) - s.hub.from) * (y >= s.hub.from ? 1 : 0);
    if (s.rivalTake && y >= s.rivalTake.from) n *= 1 - s.rivalTake.share;
    return Math.round(n);
  }
  // patches: what a decision wrote into s, keyed one level deep ('streams.network'), so the debrief can swap in what a
  // passive player would have done (design/debrief.md §2). null removes the key.
  function applyPatch(s, patch) {
    Object.keys(patch || {}).forEach(function (k) {
      var v = patch[k] == null ? null : clone(patch[k]), i = k.indexOf('.');
      if (i < 0) { if (v == null) delete s[k]; else s[k] = v; return; }
      var a = k.slice(0, i), b = k.slice(i + 1);
      s[a] = s[a] || {};
      if (v == null) delete s[a][b]; else s[a][b] = v;
    });
    return s;
  }
  function logDecision(st, d) { st.s.decisions = (st.s.decisions || []).filter(function (x) { return x.id !== d.id; }).concat([d]); return d; }
  function logShift(st, n, r) {
    r = r || {};
    st.s.shiftLog = (st.s.shiftLog || []).filter(function (x) { return x.chapter !== n; }).concat([{chapter: n, stars: r.stars != null ? r.stars : 2, otp: r.otp != null ? r.otp : 0.85,
      made: r.made || 0, missed: r.missed || 0, auto: !!r.auto}]);
    pressSettle(st, n);   // a press conference from an earlier chapter: the airline has now seen whether the answers held
  }
  function addPaper(st, n, fp, cause, year) {
    year = year || st.year;
    st.papers = (st.papers || []).filter(function (x) { return x.chapter !== n; }).concat([{chapter: n, year: year, calYear: cal(year), masthead: fp.masthead,
      lead: fp.lead, dateLine: fp.dateLine, light: (st.lastReport || {}).light || 'green', cause: cause || ''}]);
  }
  function addDoc(st, doc) { dw(doc); st.docs = (st.docs || []).filter(function (x) { return x.id !== doc.id; }).concat([doc]); return doc; }
  function docTitle(st, id, fb) { var d = ch5Doc(st, id); return d ? d.title : fb || id; }
  function paperOf(st, year, o) {
    var d = ch5Date(st, year);
    return {masthead: 'The Zero Mile Times', dateLine: d.words + ' · Nagpur', price: o.price || '₹12', lead: o.lead, deck: o.deck, sub: o.sub,
      columns: o.columns, photo: o.photo, company: st.parent, founder: st.founder || 'Asha Rao', signature: st.signature || st.founder || 'Asha Rao', sources: o.sources || []};
  }
  function stakeColumn(st) {
    var lr = st.lastReport || {};
    return {head: 'The owners', body: (st.parent || 'Your company') + ' holds ' + st.stake + '% of VSIAL, worth about ' + stakeWords(lr.stakeValueCr || 0) + ' on paper' +
      (lr.cover != null ? '. In its hardest recent year VSI earned ' + coverWords(lr.cover).replace(' earned', '') + ' to its banks.' : '.')};
  }
  // the stake at the end of `year` with a patch applied (the slips' "your 64%: +₹X by 2032", and the bills' counterfactual)
  function stakeWith(st, patch, year) {
    var s2 = applyPatch(clone(st.s), patch || {});
    if (patch && 'p2year' in patch) s2.sizing = sizeMemo(s2);
    var eng = simulate(s2, year), row = eng.rows[eng.rows.length - 1];
    return eng.step_in ? 0 : stakeValue(eng, row) * st.stake / 100;
  }
  function leadDelta(what, d, st, year, against) {   // 'X added about ₹Y to your 64% by 2032, against Z.'
    if (Math.abs(d) < 50) return what + ' made little difference to your ' + st.stake + '% by ' + cal(year) + ', against ' + against + '.';
    return what + (d >= 0 ? ' added about ' + stakeWords(d) + ' to ' : ' cost about ' + stakeWords(-d) + ' off ') + 'your ' + st.stake + '% by ' + cal(year) + ', against ' + against + '.';
  }
  function deltaWords(st, d, year) { return 'your ' + st.stake + '%: ' + (d >= 0 ? '+' : '−') + stakeWords(Math.abs(d)) + ' by ' + cal(year); }
  function autoOf(e, extra) { var a = autoShift(e); return Object.assign({stars: a.stars, otp: a.otp, cx: a.cx, safety: a.safety, auto: true}, extra || {}); }
  function chBoard(st, noBuild) {
    var bo = boardOptions(st);
    return {appeal: false, prepayCr: 0, dividendCr: bo.dividend.maxCr,
      bought: noBuild ? [] : bo.investments.filter(function (i) { return i.id === 'phase2'; }).map(function (i) { return i.id; })};
  }
  // the chapter's eras: the first with the player's shift, the rest with the same shift summary (the engine plays them), boards
  // between at the defaults (Chapter 7's do not build: phase 2 and the district are its own resolutions). The last era's board
  // is left for the player (or VSIEra.advance).
  function playEras(st, eras, shift, noBuild) {
    var reps = [];
    for (var i = 0; i < eras.length; i++) {
      if (st.over || st.era !== eras[i]) break;
      var out = applyShift(st, shift);
      st = out.state; reps.push(out.report);
      if (st.over || i === eras.length - 1) break;
      st = applyBoard(st, chBoard(st, noBuild));
    }
    return {state: st, reports: reps};
  }
  function eraSums(st, y0, y1) {
    var eng = simulate(st.s, y1), earned = 0, spent = 0, conn = 0;
    eng.rows.forEach(function (r) { if (r.year >= y0 && r.year <= y1) { earned += r.aero + r.nar; spent += r.opex + r.fee; } });
    return {earnedCr: Math.round(earned), spentCr: Math.round(spent), eng: eng};
  }
  // a chapter's bill (ZMMoney.bill), from the era reports the engine made for it
  function chBill(prev, st, reps, o) {
    if (!reps.length) return null;
    var y0 = eraYears(reps[0].era)[1], y1 = eraYears(reps[reps.length - 1].era)[2], last = reps[reps.length - 1];
    var worst = null, wy = null;
    reps.forEach(function (r) { if (r.coverWorstExact != null && (worst == null || r.coverWorstExact < worst)) { worst = r.coverWorstExact; wy = r.worstYear; } });
    var per = cal(y0) + '–' + String(cal(y1)).slice(2), sums = eraSums(st, y0, y1), thenCr = (prev.lastReport || {}).stakeValueCr;
    var bt = reps.some(function (r) { return r.banksTookControl; }), who = st.parent || 'Your company';
    var table = [{label: 'Earned, ' + per, cr: sums.earnedCr}, {label: 'Spent, ' + per, cr: sums.spentCr}].concat(o.table || []);
    var stakeLine = bt ? 'The banks took control, and ' + poss(who) + ' stake is lost.' :
      who + ' owns ' + st.stake + '% of VSIAL, worth about ' + stakeWords(last.stakeValueCr) + ' in ' + cal(y1) + (thenCr != null ? ', up from ' + stakeWords(thenCr) + ' when the chapter began' : '') + '.' +
      (last.stakeCheck ? ' It has put in ' + stakeWords(last.stakeCheck.moneyInCr) + ' since ' + last.stakeCheck.fromYear + (last.stakeCheck.dividendsCr >= 1 ? ' and taken out ' + stakeWords(last.stakeCheck.dividendsCr) + ' in dividends' : '') + ': about ' + last.returnPerYear + '% a year.' : '');
    if (thenCr != null && last.stakeValueCr < thenCr && !bt) stakeLine = stakeLine.replace(', up from ', ', down from ');
    return {title: 'Annual report, ' + cal(y1), year: cal(y1), lead: o.lead, paragraph: o.paragraph, per: per, table: table, margin: o.margin, routes: o.routes || [],
      cover: {ratio: worst == null ? null : Math.floor(worst * 100 + 1e-9) / 100, words: coverWords(worst), light: lightOf(worst), years: cal(y0) + '–' + cal(y1), year: wy ? cal(wy) : null},
      stake: {pct: st.stake, valueCr: bt ? 0 : last.stakeValueCr, year: cal(y1), thenCr: thenCr != null ? thenCr : null, returnPct: last.returnPerYear, check: last.stakeCheck,
        deltaCr: o.deltaCr != null ? Math.round(o.deltaCr) : null, words: stakeLine},
      signed: {name: st.founder || 'Asha Rao', title: 'Director, for ' + who}, banksTookControl: bt,
      moments: [].concat.apply([], reps.map(function (r) { return r.sentences; })).slice(0, 3)};
  }
  function fileReport(st, bill, y1) { addDoc(st, {id: 'report-' + bill.year, title: 'Annual report, ' + bill.year, year: y1, date: ch5Date(st, y1).iso, kind: 'report', stamp: 'FILED', summary: bill.margin || bill.paragraph}); }
  // the start of chapter n from the player's own save; null for a save that is not the player's own (resumable), or over
  function chStart(n, save, opts) {
    ensure();
    opts = opts || {};
    if (!resumable(save).ok) return null;
    var st = advance(save, firstEra(n), opts);
    if (!st || st.over || st.era !== firstEra(n)) return null;
    st.sample = false;
    return ensureDocs(st);
  }
  // the SAMPLE concession (Meridian Infra, Asha Rao) at the start of chapter n: tests and the ?chapterN= URLs only
  function chFixture(n, opts) {
    ensure();
    opts = opts || {};
    if (opts.from) return chStart(n, opts.from, opts);
    var st = newCampaign(Object.assign({parent: 'Meridian Infra', founder: 'Asha Rao', phase1: 'lean', bid: {type: 'share', value: 15}, gearing: 70, repayment: 'sculpted', cure: true,
      signedOn: '2026-04-01', endsOn: '2086-03-31'}, opts.terms || {}), 1);
    st.sample = true; st.test = true;
    st = applyConstruction(st, {choices: opts.construction || {monsoon: 'pay', overrun: 'pay', trials: 'full'}, finishedOn: '2030-04-01'});
    return ensureDocs(advance(st, firstEra(n)));
  }
  function choiceDoc(st, o) {   // the paper the player signs: {docType, docId, title, date, dateWords, parties, body[], choices[], stamps}
    var d = ch5Date(st, o.year);
    return {docType: o.docType, docId: o.docId, title: o.title, date: d.iso, dateWords: d.words, parties: o.parties, body: o.body, choices: o.choices, stamps: o.stamps};
  }
  var VSIAL = 'Vikram Sarabhai International Airport Limited (VSIAL)';
  function conTitle(st) { var f = st.construction && st.construction.finishedOn; return 'Construction register, ' + (f ? f.slice(0, 4) : cal(5)); }
  // the papers every chapter's tags may point at, added to whatever the save already holds
  function ensureDocs(st) {
    var have = {}; (st.docs || []).forEach(function (d) { if (d && d.id) have[d.id] = true; });
    var s = st.s, on = st.signedOn || ch5Date(st, 1).iso, add = [];
    if (!have.concession) add.push({id: 'concession', title: 'Concession Agreement', year: 0, date: on, kind: 'agreement', stamp: 'EXECUTED',
      summary: 'Sixty years to build and run Vikram Sarabhai International, signed by ' + (st.founder || 'the director') + ' for ' + (st.parent || 'your company') + ', with AAI, the State through MADC and ' + NM.l5 + '.'});
    if (!have['loan-offer']) add.push({id: 'loan-offer', title: 'Loan offer, ' + cal(1), year: 1, date: on, kind: 'loan', stamp: 'ACCEPTED',
      summary: 'You borrowed ' + Math.round(s.gearing * 100) + '% of phase 1 from ' + lenderName(s) + (s.lender === 'dollar' ? ', in dollars' : '') + (s.state_loan ? ', with the State\'s interest-free loan' : '') + '.'});
    if (!have.construction && st.construction) add.push({id: 'construction', title: conTitle(st), year: 4, date: st.construction.finishedOn || ch5Date(st, 5).iso, kind: 'register', stamp: 'FILED',
      summary: (st.construction.slipMonths ? 'The airport opened ' + st.construction.slipMonths + ' months late' : 'The airport opened on time') + (st.construction.trials === 'short' ? ', after short trials.' : ', after full trials.')});
    st.docs = (st.docs || []).concat(add.map(dw));
    return st;
  }

  // ---------------------------------------------------------------------------------------------
  // Chapter 3 · Takeoff: open the doors (years 5-7, era 1). design/chapters.md §2
  // ---------------------------------------------------------------------------------------------
  var CH3 = {year: 5, perDay: 600 /* (est.) Akasa Air's Bengaluru connecting bank, connections a day */, growth: 0.02, until: 18, trustLine: 0.7,
    plans: {
      bigbang: {label: 'Big bang: every flight moves in on day one', volume: 1, adj: null, from: 5, delayMin: 14,
        terms: 'Every Akasa Air flight moves to VSI overnight, as Bengaluru\'s did in May 2008.', line: 'The fullest first bank. Every system is tested on the day, for real.'},
      phased: {label: 'Phased: half the flights in week 1, the rest in week 3', volume: 0.6, adj: [{from: 5, until: 5, f: 0.97}], from: 5, delayMin: 6,
        terms: 'Half of Akasa Air\'s flights move in week 1, the rest in week 3.', line: 'A lighter day one. Akasa Air pays its crews twice while it runs two airports.'},
      soft: {label: 'Soft open: one airline\'s flights first', volume: 0.3, adj: [{from: 5, until: 5, f: 0.8}], from: 6, delayMin: 2, lag: 0.2,
        terms: 'Only Akasa Air\'s first wave flies from VSI; its full move waits a year.', line: 'A quiet day one, but Akasa Air delays its full move by a year.'}},
    shortTrialsMin: 8, beltCarryCr: 4, beltHoldCr: 1.5, towCr: 0.6, taxiCr: 0.3 /* (est.) */};
  function ch3Plan(id) { return CH3.plans[id] ? id : 'phased'; }
  function ch3Stream(id, made, growth) { var p = CH3.plans[ch3Plan(id)]; return streamOf(CH3.perDay, p.from, {made: made, growth: growth, until: CH3.until}); }
  function ch3Patch(id, made, growth) { var p = CH3.plans[ch3Plan(id)]; return {'paxAdj.ch3': p.adj, 'streams.plateau': ch3Stream(id, made, growth), ch3TrafficLag: p.lag || null}; }
  function ch3Late(st) { var sl = st.construction && st.construction.slipMonths; return sl ? sl + ' months late, in ' + monthName(st.opensOn || addMonths(st.signedOn, 48 + sl)) : ''; }
  function ch3FrontPage(st) {
    ensure();
    var late = ch3Late(st), eng = simulate(st.s, 5), tr = eng.c.tranches[0], rep = tr ? tr.rep_start + 1 : 7, debt = eng.c.tranches.reduce(function (a, x) { return a + x.out; }, 0);
    return paperOf(st, CH3.year, {lead: 'VSI OPENS: A CITY\'S FLIGHTS MOVE IN OVERNIGHT',
      deck: 'Vikram Sarabhai International opens its doors' + (late ? ', ' + late : ' on time') + '. ' + NM.plateau + ' is moving its Bengaluru connecting bank here.',
      sub: {head: NM.plateau + ' moves in', body: NM.plateau + ' will connect its Bengaluru passengers at VSI instead of at Delhi. ' + (late ? 'The airport opened ' + late + ', so the airline has waited.' : 'The airport opened on the day it promised.') +
        ' How the first morning goes will decide how much more it brings.'},
      columns: [{head: 'The banks', body: 'VSIAL owes its banks about ' + cr(debt) + '. Repayments begin in ' + cal(rep) + ', paid from what the airport earns.'}, stakeColumn(st)],
      photo: {kind: 'opening-day', caption: 'The Hall at dawn on opening day.'}});
  }
  function ch3Decision(st) {
    ensure();
    var short = st.construction && st.construction.trials === 'short', y1 = chYears(3)[1], base = stakeWith(st, ch3Patch('phased', 0.95, CH3.growth), y1);
    return choiceDoc(st, {year: CH3.year, docType: 'opening-plan', docId: 'opening-' + cal(CH3.year), title: 'Opening plan: ' + NM.plateau + ' at Vikram Sarabhai International',
      parties: {airport: VSIAL, airline: NM.plateau, signatory: {name: 'The Chief Operating Officer', title: NM.plateau}},
      body: [NM.plateau + ' will move its Bengaluru connecting bank to VSI. This plan sets how fast its flights move in.',
        short ? 'You ran short trials before opening, so the belts and gates have never run full: add about ' + CH3.shortTrialsMin + ' minutes of delay on the first morning.' : 'You ran full trials before opening: the belts and gates have been rehearsed with real aircraft.',
        'The first morning happens once. Its record stays on every front page that follows.'],
      choices: ['bigbang', 'phased', 'soft'].map(function (id) {
        var p = CH3.plans[id], d = id === 'phased' ? stakeWith(st, ch3Patch('bigbang', 0.95, CH3.growth), y1) - base : stakeWith(st, ch3Patch(id, 0.95, CH3.growth), y1) - base;
        return {id: id, label: p.label, terms: p.terms, slip: {big: '≈ ' + (p.delayMin + (short ? CH3.shortTrialsMin : 0)) + ' minutes late on day one', money: Math.round(p.volume * 100) + '% of the flights on day one',
          stake: id === 'phased' ? 'against a big bang: ' + deltaWords(st, -d, y1).replace('your ' + st.stake + '%: ', '') : deltaWords(st, d, y1), line: p.line}, effects: {volume: p.volume}};
      }),
      stamps: {bigbang: 'SIGNED', phased: 'SIGNED', soft: 'SIGNED'}});
  }
  function ch3ApplyDecision(st, id) {
    ensure();
    st = clone(st); id = ch3Plan(id);
    var fp = ch3FrontPage(st);
    st.ch3 = {plan: id};
    applyPatch(st.s, ch3Patch(id, 0.95, CH3.growth));
    addPaper(st, 3, fp, ch3Late(st) ? 'Because the airport opened ' + ch3Late(st) : 'Because the airport opened on time', CH3.year);
    addDoc(st, {id: 'opening-' + cal(CH3.year), title: 'Opening plan, ' + cal(CH3.year), year: CH3.year, date: ch5Date(st, CH3.year).iso, kind: 'opening-plan', stamp: 'SIGNED',
      summary: 'You signed ' + NM.plateau + ' to a ' + {bigbang: 'big-bang opening: every flight on day one', phased: 'phased opening: half the flights in week 1, the rest in week 3', soft: 'soft opening: its first wave only, the full move a year later'}[id] + '.'});
    logDecision(st, {id: 'ch3-plan', group: 'opening', chapter: 3, year: CH3.year, label: 'The opening plan', chosen: id, chosenLabel: CH3.plans[id].label.split(':')[0], 'default': 'phased', alt: ch3Patch('phased', 0.95, CH3.growth)});
    return st;
  }
  function ch3Incidents(st) {
    var id = (st.ch3 && st.ch3.plan) || 'phased', out = [];
    if (st.construction && st.construction.trials === 'short') out.push({id: 'belt', cause: 'short-trials', docId: 'construction', at: '06:40', title: 'Belt 3 stops with 900 bags',
      text: 'Belt 3 stops at 06:40 with 900 bags on it. The belts never ran full in trials.',
      options: [{id: 'carry', label: 'Send ground staff to carry the bags', effect: 'About ' + crs(CH3.beltCarryCr * prAt(5)) + ' in overtime, and slower turns.'},
        {id: 'hold', label: 'Hold three departures until the belt runs', effect: 'About ' + crs(CH3.beltHoldCr * prAt(5)) + ' in passenger care, and three late flights.'}]});
    if (id === 'bigbang') out.push({id: 'stands', cause: 'big-bang', docId: 'opening-' + cal(CH3.year), at: '07:15', title: 'Two jets, one stand',
      text: 'Two ' + NM.plateau + ' jets have been given the same stand in the overnight move.',
      options: [{id: 'tow', label: 'Tow one to a remote stand and bus its passengers', effect: 'About ' + crs(CH3.towCr * prAt(5)) + ', and its connections may miss.'},
        {id: 'taxi', label: 'Hold it on the taxiway until the stand clears', effect: 'About ' + crs(CH3.taxiCr * prAt(5)) + ' in fuel, and a late departure.'}]});
    return out;
  }
  function ch3ShiftPlan(st) {
    ensure();
    var id = (st.ch3 && st.ch3.plan) || 'phased', p = CH3.plans[id], inc = ch3Incidents(st);
    var tags = [{docId: 'opening-' + cal(CH3.year), doc: 'Opening plan, ' + cal(CH3.year), line: {bigbang: 'Every flight on day one.', phased: 'Half the flights in week 1.', soft: 'One wave first; the rest next year.'}[id], anchor: 'apron'}];
    if (st.construction && st.construction.trials === 'short') tags.push({docId: 'construction', doc: conTitle(st), line: 'Short trials: belts never ran full.', anchor: 'baggage'});
    else if (st.construction && st.construction.slipMonths) tags.push({docId: 'construction', doc: conTitle(st), line: 'Opened ' + st.construction.slipMonths + ' months late.', anchor: 'terminal'});
    var auto = autoOf(1, {made: Math.round(CH3.perDay / 2 * p.volume * 0.95), missed: Math.round(CH3.perDay / 2 * p.volume * 0.05), incidents: {belt: 'carry', stands: 'tow'}});
    return {level: 1, chapter: 3, year: CH3.year, window: {from: '06:00', to: '09:00'}, volume: p.volume,
      banks: [{airline: NM.plateau, from: '06:00', to: '08:30', connecting: Math.round(CH3.perDay / 2 * p.volume)}],
      incidents: inc, tags: tags, rates: {perConnectionCr: domConnInr(CH3.year) / 1e7, missedCostCr: CH5.careInr * prAt(CH3.year) / 1e7}, auto: auto};
  }
  function ch3Briefing(st) {
    var plan = ch3ShiftPlan(st), d = ch5Date(st, CH3.year), id = (st.ch3 && st.ch3.plan) || 'phased';
    var lines = [{text: 'Opening day: ' + Math.round(plan.volume * 100) + '% of ' + poss(NM.plateau) + ' flights, 06:00–09:00', docId: 'opening-' + cal(CH3.year)},
      {text: poss(NM.plateau) + ' Bengaluru bank: ' + plan.banks[0].connecting + ' passengers connecting', docId: 'opening-' + cal(CH3.year)},
      {text: st.construction && st.construction.trials === 'short' ? 'Short trials: the belts have never run full' : 'Full trials: every belt and gate rehearsed', docId: 'construction'}];
    lines.forEach(function (l) { l.doc = docTitle(st, l.docId, 'Construction record'); l.ref = l.doc; });
    return {title: 'Duty manager\'s handover', date: d.words, lines: lines, watch: id === 'bigbang' ? 'The stand plan: every flight moved overnight.' : 'The first wave: on time, and every connection made.', autoStartSec: 6};
  }
  function ch3Trust(id, r) {
    var inc = r.incidents || {};
    var t = 0.2 + 0.15 * (r.stars != null ? r.stars : 2) + 2 * ((r.otp != null ? r.otp : 0.85) - 0.82) + (id === 'bigbang' && r.stars >= 3 ? 0.05 : 0) + (id === 'soft' ? -0.1 : 0) +
      (inc.belt === 'ignored' ? -0.1 : 0) + (inc.stands === 'taxi' ? -0.03 : 0);
    return Math.round(Math.max(0, Math.min(1, t)) * 100) / 100;
  }
  function ch3ApplyShift(st, result) {
    ensure();
    if (st.over) return {state: st, bill: null, card: null};
    if (!st.ch3) st = ch3ApplyDecision(st, 'phased');
    var prev = clone(st); st = clone(st); result = result || ch3ShiftPlan(st).auto;
    var id = (st.ch3 && st.ch3.plan) || 'phased', made = result.made, missed = result.missed || 0, share = made != null && made + missed > 0 ? made / (made + missed) : 0.95;
    var trust = ch3Trust(id, result), growth = trust >= CH3.trustLine ? CH3.growth : trust >= 0.4 ? 0 : -0.04, inc = result.incidents || {};
    st.s.plateauTrust = trust;
    applyPatch(st.s, ch3Patch(id, share, growth));
    var incCr = (inc.belt === 'carry' ? CH3.beltCarryCr : inc.belt ? CH3.beltHoldCr : 0) + (inc.stands === 'tow' ? CH3.towCr : inc.stands ? CH3.taxiCr : 0);
    if (incCr > 0) st.s.streams.ch3incidents = {perDay: 0, from: 5, until: 5, incCr: 0, costCr: incCr * prAt(5), stop: 6};   // a one-off, in 2030's prices
    // the decision log: the counterfactual opening plan with the same morning's record
    var dlog = (st.s.decisions || []).filter(function (x) { return x.id === 'ch3-plan'; })[0];
    if (dlog) dlog.alt = ch3Patch('phased', share, growth);
    logShift(st, 3, result);
    var out = playEras(st, CH_ERAS[3], result), y1 = chYears(3)[1]; st = out.state;
    var otherId = id === 'phased' ? 'bigbang' : 'phased', alt = stakeWith(st, ch3Patch(otherId, share, growth), y1), now = (st.lastReport || {}).stakeValueCr || 0, delta = now - alt;
    var otp = Math.round((result.otp != null ? result.otp : 0.85) * 100), quote = trust >= CH3.trustLine ? poss(NM.plateau) + ' chief told the paper VSI "opened like an airport that had been open for years".' :
      trust >= 0.4 ? poss(NM.plateau) + ' chief said the first morning "had its moments".' : poss(NM.plateau) + ' chief told the paper the airline will "think hard" before moving more flights here.';
    var bits = ['Day one ran at ' + otp + '% on time.', quote];
    if (inc.belt === 'carry') bits.push('Belt 3 cost ' + crs(CH3.beltCarryCr * prAt(5)) + ' in hand-carried bags.');
    else if (inc.belt === 'hold') bits.push('Holding three flights for belt 3 cost ' + crs(CH3.beltHoldCr * prAt(5)) + ' in passenger care.');
    else if (inc.belt === 'ignored') bits.push('Belt 3 stopped with 900 bags, and nobody moved them for an hour.');
    if (trust >= CH3.trustLine && id === 'bigbang' && result.stars >= 3) bits.push(NM.plateau + ' now wants to feed your afternoon bank too.');
    if (CH3.plans[id].lag) bits.push(NM.plateau + ' moves the rest of its flights in ' + cal(6) + '.');
    var bill = chBill(prev, st, out.reports, {lead: leadDelta('The ' + {bigbang: 'big-bang', phased: 'phased', soft: 'soft'}[id] + ' opening', delta, st, y1, 'a ' + {bigbang: 'big bang', phased: 'phased opening'}[otherId]),
      paragraph: 'Vikram Sarabhai International opened on ' + ch5Date(st, CH3.year).words + '. ' + Math.round(((made || 0) + missed)).toLocaleString('en-IN') + ' ' + NM.plateau + ' passengers changed planes here on the first morning' + (missed ? ', and ' + missed.toLocaleString('en-IN') + ' missed their flight' : '') + '. Then the engine ran ' + cal(chYears(3)[0]) + '–' + cal(y1) + '.',
      margin: bits.join(' '), deltaCr: delta,
      table: [{label: 'Connections on opening morning', made: made || 0, missed: missed}]});
    bill.trust = {value: trust, words: trust >= CH3.trustLine ? NM.plateau + ' trusts VSI' : trust >= 0.4 ? NM.plateau + ' is unsure of VSI' : NM.plateau + ' has lost faith in VSI'};
    st.ch3.result = {trust: trust, otp: result.otp, stars: result.stars, share: share};
    st.ch3.bill = bill;
    fileReport(st, bill, y1);
    return {state: st, bill: bill, card: ch5Card(3), report: out.reports[out.reports.length - 1]};
  }

  // ---------------------------------------------------------------------------------------------
  // Chapter 4 · Climb: wire the country (years 8-13, eras 2-3)
  // ---------------------------------------------------------------------------------------------
  var CH4 = {year: 8, from: 9, until: 18, cities: CH5.feeders.length,
    nets: {
      anchor: {perDay: 2900, growth: 0.045, share: 0.74, costShare: 0.08 /* (est.) ten years of lower charges for Sutradhar */, stamp: 'SIGNED',
        label: 'Anchor ' + NM.feeder + ': an exclusive afternoon bank', terms: NM.feeder + ' times ' + CH5.feeders.length + ' cities into one afternoon bank, with 40-minute connections, for ten years of lower charges.',
        line: 'The network grows fastest. One airline carries the bank: if it fails, the bank fails.'},
      cut: {perDay: 300, growth: 0, share: 0.3, costShare: 0, stamp: 'APPROVED',
        label: 'Cut airlines\' charges 30% for every airline', terms: 'Landing and parking charges fall 30% for every airline for ten years, to pull flights from the Gulf.',
        line: 'Flights come. Whether they connect is another matter, and Dubai can cut too.'},
      two: {perDay: 2100, growth: 0.035, share: 0.52, costShare: 0, stamp: 'SIGNED',
        label: 'Two feeders share the bank: ' + NM.feeder + ' and ' + NM.plateau, terms: NM.feeder + '\'s twelve cities and ' + poss(NM.plateau) + ' Bengaluru flights share a looser afternoon bank.',
        line: 'Slower, but no single airline can take the bank down with it.'}},
    cut: {cut: 0.30, airlineShare: 0.35 /* (est.) landing and parking as a share of the airport's charges */, flightsUp: 18, adj: [{from: 9, until: 9, f: 1.05}, {from: 10, until: 18, f: 1.02}]},
    radarYear: CH5.radarYear, tightPax: 140, tightHoldCr: 0.4, rampCr: 0.8 /* (est.) */};
  function ch4Two(st) { return (st.s.plateauTrust == null ? 0.75 : st.s.plateauTrust) >= CH3.trustLine; }
  function ch4Def(st) { return ch4Two(st) ? 'two' : 'anchor'; }
  function ch4Patch(id, made) {
    var N = CH4.nets[id] || CH4.nets.two, S = streamOf(N.perDay, CH4.from, {made: made == null ? 1 : made, growth: N.growth, until: CH4.until, costShare: N.costShare, costUntil: N.costShare ? CH4.until : null});
    return {network: id, anchorShare: N.share, chargeCut: id === 'cut' ? {from: CH4.from, until: CH4.until, cut: CH4.cut.cut, airlineShare: CH4.cut.airlineShare} : null,
      'paxAdj.ch4': id === 'cut' ? CH4.cut.adj : null, 'streams.network': S};
  }
  function ch4FrontPage(st) {
    ensure();
    var t = st.s.ch3TrafficLag;
    return paperOf(st, CH4.year, {lead: 'TWELVE CITIES, ONE AFTERNOON: VSI BIDS TO BE INDIA\'S CONNECTING HUB',
      deck: NM.feeder + ' offers to time ' + CH4.cities + ' Indian cities into one afternoon bank at Vikram Sarabhai International.',
      sub: {head: 'Lucknow to Kochi, one change, in Nagpur', body: 'Today a passenger from Lucknow to Kochi changes planes in Delhi or Mumbai, if a flight exists at all. A bank at VSI would connect ' + CH4.cities + ' cities to each other: ' + (CH4.cities * (CH4.cities - 1)) + ' one-stop journeys from one afternoon.' +
        (t ? ' ' + NM.plateau + ' moved in a year late after the soft opening, so VSI starts the race behind.' : '')},
      columns: [{head: 'The Gulf cuts again', body: 'Doha and Dubai have cut their transfer charges again to keep India\'s connecting passengers.'}, stakeColumn(st)],
      photo: {kind: 'feeder-bank', caption: 'The domestic pier at 13:00: the afternoon bank VSI wants to fill.'}});
  }
  function ch4Decision(st) {
    ensure();
    var y1 = chYears(4)[1], def = ch4Def(st), base = stakeWith(st, ch4Patch(def), y1), two = ch4Two(st);
    return choiceDoc(st, {year: CH4.year, docType: 'network-agreement', docId: 'feeders-' + cal(CH4.year), title: 'Network agreement: the afternoon bank at Vikram Sarabhai International',
      parties: {airport: VSIAL, airline: NM.feeder, signatory: {name: 'The Network Planning Director', title: NM.feeder}},
      body: ['Money comes from connections: every passenger who changes planes at VSI pays its fees and shops here. A bank is a set of flights timed to land together and leave together, so they connect.',
        NM.feeder + ' offers ' + CH4.cities + ' cities into one afternoon bank from ' + cal(CH4.from) + '.',
        two ? NM.plateau + ' would share the bank: its first morning at VSI went well.' : NM.plateau + ' declined to share the bank: day one went badly.'],
      choices: ['anchor', 'cut', 'two'].map(function (id) {
        var N = CH4.nets[id], P1 = ch4Patch(id), S = P1['streams.network'], d = id === def ? 0 : stakeWith(st, P1, y1) - base;
        var c = {id: id, label: N.label, terms: N.terms,
          slip: {big: id === 'cut' ? '+' + CH4.cut.flightsUp + '% flights next year' : '+' + N.perDay.toLocaleString('en-IN') + ' connections a day', money: cr(S.incCr) + ' a year from connections' + (id === 'cut' ? ', and charges 30% lower for ten years' : ''),
            stake: id === def ? 'your ' + st.stake + '%: the usual path' : deltaWords(st, d, y1), line: N.line}, effects: {network: id}};
        if (id === 'two' && !two) { c.disabled = true; c.label = NM.plateau + ' declined: day one went badly'; c.slip.line = 'Two feeders needs ' + NM.plateau + ', and it has lost faith in VSI.'; }
        return c;
      }),
      stamps: {anchor: 'SIGNED', cut: 'APPROVED', two: 'SIGNED'}});
  }
  function ch4ApplyDecision(st, id) {
    ensure();
    st = clone(st);
    if (!CH4.nets[id] || (id === 'two' && !ch4Two(st))) id = ch4Def(st);
    var fp = ch4FrontPage(st), N = CH4.nets[id];
    st.ch4 = {network: id};
    applyPatch(st.s, ch4Patch(id));
    addPaper(st, 4, fp, (st.s.ch3TrafficLag ? 'Because the soft opening put ' + NM.plateau + ' a year behind' : 'Because ' + NM.feeder + ' saw ' + (st.s.plateauTrust >= CH3.trustLine ? 'a good first morning' : 'a hub still to prove')), CH4.year);
    addDoc(st, {id: 'feeders-' + cal(CH4.year), title: 'Network agreement, ' + cal(CH4.year), year: CH4.year, date: ch5Date(st, CH4.year).iso, kind: 'route-agreement', stamp: N.stamp,
      summary: id === 'anchor' ? NM.feeder + ' flies ' + CH4.cities + ' Indian cities into VSI in one afternoon bank, with 40-minute connections, for ten years of lower charges. It carries ' + Math.round(N.share * 100) + '% of your connecting passengers.' :
        id === 'two' ? NM.feeder + ' and ' + NM.plateau + ' share VSI\'s afternoon bank: ' + CH4.cities + ' cities and Bengaluru, timed so their passengers can change planes here.' :
        'Landing and parking charges cut 30% for every airline for ten years, from ' + cal(CH4.from) + '. ' + NM.feeder + ' flies its own timetable; there is no bank.'});
    logDecision(st, {id: 'ch4-network', group: 'network', chapter: 4, year: CH4.year, label: 'The network', chosen: id, chosenLabel: {anchor: 'Anchoring ' + NM.feeder, cut: 'Cutting charges 30%', two: 'Two feeders'}[id],
      'default': ch4Def(st), alt: ch4Patch(ch4Def(st))});
    return st;
  }
  // the 2034 capital budget, one tick on the Chapter 4 bill page: the bird radar (Chapter 5's paper trail)
  function ch4Budget(st) {
    ensure();
    var c = CH5.radarCr * prAt(CH5.radarYear);
    return {id: 'budget-' + cal(CH5.radarYear), title: 'Capital budget, ' + cal(CH5.radarYear), line: 'Approve the ' + cal(CH5.radarYear) + ' capital budget: a bird radar, ' + cr(c),
      text: 'The lakes east of runway 3 draw birds at dawn and dusk. A radar watches them; without it, the tower relies on the eyes of its staff.', costCr: Math.round(c), bought: st.radar === 'bought'};
  }
  function ch4ApplyBudget(st, bought) {
    ensure();
    st = clone(st);
    st.radar = bought ? 'bought' : 'skipped';
    var others = (st.s.extra_pay || []).filter(function (x) { return x.year !== CH5.radarYear; });
    st.s.extra_pay = bought ? others.concat([{year: CH5.radarYear, cr: CH5.radarCr}]) : others;
    var c = CH5.radarCr * prAt(CH5.radarYear);
    addDoc(st, {id: 'budget-2034', title: 'Capital budget, ' + cal(CH5.radarYear), year: CH5.radarYear, date: ch5Date(st, CH5.radarYear).iso, kind: 'budget', stamp: 'APPROVED',
      summary: bought ? 'You bought the bird radar for ' + cr(c) + '. It watches the lakes east of runway 3.' : 'You skipped the bird radar and saved ' + cr(c) + '. Nobody watches the lakes east of runway 3.'});
    logDecision(st, {id: 'ch4-radar', group: 'radar', chapter: 4, year: CH5.radarYear, label: 'The bird radar', chosen: st.radar, chosenLabel: bought ? 'Buying the bird radar' : 'Skipping the bird radar',
      'default': 'bought', alt: {extra_pay: others.concat([{year: CH5.radarYear, cr: CH5.radarCr}])}});
    // ticked on the bill page, after Climb's reports were filed: file them again with the radar in (the engine replays from the start)
    var eng = null;
    (st.history || []).forEach(function (h, i) {
      if (h.board || h.construction || (h.era !== 2 && h.era !== 3)) return;
      eng = eng || simulate(st.s, eraYears(3)[2]);
      var rep = eraReport(st, eng, h.era);
      Object.assign(h, {light: rep.light, cover: rep.coverWorst, cashCr: rep.cashCr, stakeValueCr: rep.stakeValueCr, debtCr: rep.debtCr, sentences: rep.sentences});
      if (i === st.history.length - 1) { st.cash = rep.cashCr; Object.assign(st.lastReport || (st.lastReport = {}), {light: rep.light, cover: rep.coverWorst, payoutShare: rep.payoutShare, debtCr: rep.debtCr, worstYear: rep.worstYear, stakeValueCr: rep.stakeValueCr, returnPerYear: rep.returnPerYear}); }
    });
    return st;
  }
  function ch4Incidents(st) {
    var id = st.s.network, out = [];
    if (id === 'anchor') out.push({id: 'tight', cause: 'anchor-40min', docId: 'feeders-' + cal(CH4.year), at: '13:25', title: 'Indore is 15 minutes late',
      text: 'The Indore flight is 15 minutes late: ' + CH4.tightPax + ' of its passengers connect to Kochi and Guwahati. You promised 40-minute connections.',
      options: [{id: 'hold', label: 'Hold Kochi and Guwahati 15 minutes', effect: 'About ' + crs(CH4.tightHoldCr * prAt(9)) + ' in fuel and crew time.'},
        {id: 'go', label: 'Let them go on time', effect: 'The ' + CH4.tightPax + ' miss their flights: passenger care, and ' + NM.feeder + ' notices.'}]});
    if (id === 'cut') out.push({id: 'ramp', cause: 'charge-cut', docId: 'feeders-' + cal(CH4.year), at: '14:05', title: 'Eleven departures queued for push-back',
      text: 'Cheaper charges brought flights at every hour, timed for no one. Eleven departures are waiting to push back.',
      options: [{id: 'remote', label: 'Open the remote stands and bus passengers', effect: 'About ' + crs(CH4.rampCr * prAt(9)) + ' in buses and staff.'},
        {id: 'meter', label: 'Meter the queue, one push-back at a time', effect: 'Late departures, and airlines claim penalties.'}]});
    return out;
  }
  function ch4ShiftPlan(st) {
    ensure();
    var id = st.s.network || ch4Def(st), N = CH4.nets[id];
    var banks = id === 'cut' ? [] : [{airline: NM.feeder, from: '12:40', to: id === 'two' ? '14:10' : '13:40', cities: CH5.feeders.map(function (c) { return {code: c[1], name: c[0]}; }), onward: {from: '14:20', to: '15:10'}}];
    if (id === 'two') banks.push({airline: NM.plateau, from: '12:50', to: '14:10', cities: [{code: 'BLR', name: 'Bengaluru'}]});
    var tags = [{docId: 'feeders-' + cal(CH4.year), doc: 'Network agreement, ' + cal(CH4.year), line: id === 'anchor' ? NM.feeder + ' carries ' + Math.round(N.share * 100) + '% of connections.' : id === 'cut' ? 'Charges cut 30% for 10 years.' : 'Two feeders share the bank.', anchor: 'transfer'}];
    if (id === 'anchor') tags.push({docId: 'feeders-' + cal(CH4.year), doc: 'Network agreement, ' + cal(CH4.year), line: '40-minute connections promised.', anchor: 'domestic-pier'});
    var perBank = Math.round(N.perDay / 2);
    return {level: 2, chapter: 4, year: CH4.from, window: {from: '12:30', to: '15:15'}, volume: id === 'cut' ? 1 + CH4.cut.flightsUp / 100 : 1, network: id, banks: banks,
      incidents: ch4Incidents(st), tags: tags, rates: {perConnectionCr: domConnInr(CH4.from) / 1e7, missedCostCr: CH5.careInr * prAt(CH4.from) / 1e7},
      auto: autoOf(2, {made: Math.round(perBank * 0.94), missed: Math.round(perBank * 0.06), incidents: {tight: 'hold', ramp: 'remote'}})};
  }
  function ch4Briefing(st) {
    var plan = ch4ShiftPlan(st), d = ch5Date(st, CH4.from), id = plan.network;
    var lines = [{text: id === 'cut' ? 'No bank: airlines fly at every hour on the cheaper charges' : poss(NM.feeder) + ' bank lands ' + plan.banks[0].from + '–' + plan.banks[0].to + ' from ' + CH4.cities + ' cities', docId: 'feeders-' + cal(CH4.year)},
      {text: id === 'two' ? NM.plateau + ' adds Bengaluru to the bank' : id === 'anchor' ? 'Connections promised in 40 minutes' : 'Flights up ' + CH4.cut.flightsUp + '% on last year', docId: 'feeders-' + cal(CH4.year)},
      {text: 'Onward flights leave 14:20–15:10', docId: 'opening-' + cal(CH3.year)}];
    lines.forEach(function (l) { l.doc = docTitle(st, l.docId); l.ref = l.doc; });
    return {title: 'Duty manager\'s handover', date: d.words, lines: lines, watch: id === 'cut' ? 'The push-back queue.' : 'The connections: every passenger onto the next flight.', autoStartSec: 6};
  }
  function ch4ApplyShift(st, result) {
    ensure();
    if (st.over) return {state: st, bill: null, card: null};
    if (!st.ch4) st = ch4ApplyDecision(st, ch4Def(st));
    if (result && result.radar != null) st = ch4ApplyBudget(st, result.radar === true || result.radar === 'bought');   // the 2034 budget, decided before the shift
    var prev = clone(st); st = clone(st); result = result || ch4ShiftPlan(st).auto;
    var id = st.s.network || ch4Def(st), made = result.made, missed = result.missed || 0, share = made != null && made + missed > 0 ? made / (made + missed) : 0.94, inc = result.incidents || {};
    applyPatch(st.s, {'streams.network': ch4Patch(id, share)['streams.network']});
    var incCr = (inc.tight === 'hold' ? CH4.tightHoldCr : 0) + (inc.ramp === 'remote' ? CH4.rampCr : 0);
    if (incCr > 0) st.s.streams.ch4incidents = {perDay: 0, from: 9, until: 9, incCr: 0, costCr: incCr * prAt(9) * 30 /* (est.) about 30 such days a year */, stop: 10};
    var dlog = (st.s.decisions || []).filter(function (x) { return x.id === 'ch4-network'; })[0];
    if (dlog) dlog.alt = ch4Patch(dlog['default'], share);
    logShift(st, 4, result);
    var out = playEras(st, CH_ERAS[4], result), y1 = chYears(4)[1]; st = out.state;
    var def = ch4Def(st), other = id === def ? (id === 'anchor' ? 'cut' : 'anchor') : def;
    var alt = stakeWith(st, ch4Patch(other, share), y1), now = (st.lastReport || {}).stakeValueCr || 0, delta = now - alt;
    var conns = networkPerDay(st, y1), N = CH4.nets[id];
    var margin = id === 'anchor' ? 'Twelve cities now reach each other through VSI in one afternoon. ' + NM.feeder + ' carries ' + Math.round(N.share * 100) + '% of your connecting passengers: if it stumbles, so do you.' :
      id === 'cut' ? 'Flights up ' + CH4.cut.flightsUp + '%. Connections up 2%. Dubai matched your cut in March. You are now paying airlines to fly past each other.' :
      'Twelve cities and ' + poss(NM.plateau) + ' Bengaluru flights feed one afternoon bank. No single airline carries more than half of it.';
    var bill = chBill(prev, st, out.reports, {lead: leadDelta({anchor: 'Anchoring ' + NM.feeder, cut: 'Cutting charges 30%', two: 'Two feeders'}[id], delta, st, y1, {anchor: 'anchoring ' + NM.feeder, cut: 'cutting charges', two: 'two feeders'}[other]),
      paragraph: 'By ' + cal(y1) + ' about ' + conns.toLocaleString('en-IN') + ' passengers a day changed planes at VSI' + (id === 'cut' ? ', on flights that were not timed to meet.' : ', in one afternoon bank.'),
      margin: margin, deltaCr: delta, table: [{label: 'Connections a day, ' + cal(y1), made: conns, missed: Math.round(conns * (1 - share) / Math.max(share, 0.01))}]});
    bill.budget = ch4Budget(st);
    st.ch4.result = {share: share, connectionsPerDay: conns};
    st.ch4.bill = bill;
    fileReport(st, bill, y1);
    return {state: st, bill: bill, card: ch5Card(4), report: out.reports[out.reports.length - 1]};
  }

  // ---------------------------------------------------------------------------------------------
  // Chapter 6 · Turbulence: the crisis, chosen by the player's past (years 19-33, eras 5-7)
  // ---------------------------------------------------------------------------------------------
  var CH6 = {year: 21, fall: 0.25, cover: 1.10, reserveShare: 0.5 /* (est.) half a year's loan payments, if the crisis leaves cover above ₹110 */,
    kinds: {
      rupee: {adj: [{from: 21, until: 21, f: 0.85}, {from: 22, until: 22, f: 0.93}]},
      airline: {adj: [{from: 21, until: 21, f: 0.80}, {from: 22, until: 22, f: 0.88}, {from: 23, until: 23, f: 0.95}], dip: [{from: 21, until: 22, f: 0}, {from: 23, until: 60, f: 0.6}]},
      pandemic: {adj: [{from: 21, until: 21, f: 0.38}, {from: 22, until: 22, f: 0.65}, {from: 23, until: 23, f: 0.88}]}},
    jets: 30, towCr: 2, hallCr: 30, discountShare: 0.2 /* (est.) */};
  function ch6Pick(st) { var s = st.s || {}; return s.lender === 'dollar' ? 'rupee' : s.network === 'anchor' ? 'airline' : 'pandemic'; }
  function ch6Ready(st) {
    var k = ch6Pick(st), K = CH6.kinds[k];
    st.s.shock = {kind: k, year: CH6.year, fall: CH6.fall};
    st.s.paxAdj = st.s.paxAdj || {}; st.s.paxAdj.ch6 = K.adj;
    if (k === 'airline' && st.s.streams && st.s.streams.network) st.s.streams.network.dip = K.dip;
    st.ch6 = {kind: k};
    return st;
  }
  function ch6Start(save, opts) { var st = chStart(6, save, opts); return st ? ch6Ready(st) : null; }
  function ch6Fixture(opts) { opts = opts || {}; var st = opts.from ? chStart(6, opts.from, opts) : chFixture(6, opts); if (opts.network) applyPatch(st.s, ch4Patch(opts.network)); return st ? ch6Ready(st) : null; }
  function cureList(s, from) { var c = Array.isArray(s.cure) ? s.cure.slice() : [{from: 1, on: !!s.cure}]; return c.filter(function (x) { return x.from < from; }).concat([{from: from, on: true}]); }
  function ch6Need(st) {   // what the crisis does with no fresh money, and what the banks ask for
    var s1 = clone(st.s); s1.noStepIn = true; s1.cure = false;
    var eng = simulate(s1, CH6.year + 2), short = 0, worst = null, fx = 0;
    eng.rows.forEach(function (r) { if (r.year >= CH6.year && r.year <= CH6.year + 2 && r.ds > 0) { short += Math.max(0, CH6.cover * r.ds - r.cfads); if (!worst || r.dscr < worst.dscr) worst = r; } });
    eng.events.forEach(function (e) { if (e.k === 'fx' && e.t + 1 === CH6.year) fx += e.amt; });
    var x = Math.max(short, worst ? CH6.reserveShare * worst.ds : 100);
    // L5 buys new shares at a price that earns it the Fairfax low-end rate: what the company's money from here is worth at it
    var s2 = clone(st.s); s2.cure = cureList(st.s, CH6.year); for (var e = 1; e <= 12; e++) if (!s2.boards[e]) s2.boards[e] = 'auto';
    var fl = companyFlows(simulate(s2, 60)), rr = npvRate(), V = 0;
    for (var t = CH6.year - 1; t < 60; t++) V += (fl[t] || 0) / Math.pow(1 + rr, t - CH6.year + 2);
    return {cr: Math.max(100, Math.ceil(x / 10) * 10), worst: worst ? worst.dscr : null, worstYear: worst ? worst.year : null, fxCr: Math.round(fx), equityCr: V,
      paxDrop: Math.round((1 - CH6.kinds[st.ch6 ? st.ch6.kind : 'pandemic'].adj[0].f) * 100)};
  }
  function ch6Patch(st, id, need) {
    var X = need.cr, m = Math.max(1, Math.round(st.stake * need.equityCr / Math.max(1, need.equityCr + X)));
    if (id === 'refuse') return {stepInYear: CH6.year, 'injectBy.ch6': null, 'stakeBy.ch6': null};
    if (id === 'own') return {cure: cureList(st.s, CH6.year), 'injectBy.ch6': {year: CH6.year, cr: X, by: 'player'}, 'stakeBy.ch6': null, stepInYear: null};
    return {cure: cureList(st.s, CH6.year), 'injectBy.ch6': {year: CH6.year, cr: X, by: 'l5'}, 'stakeBy.ch6': {from: CH6.year, pct: m}, stake0: stakeDef(st), stepInYear: null};
  }
  function projectReturn(st, patch) {   // the player's return per year to the handback, the rest of the game at the defaults
    var s2 = applyPatch(clone(st.s), patch || {});
    for (var e = 1; e <= 12; e++) if (!s2.boards[e]) s2.boards[e] = 'auto';
    if (patch && 'p2year' in patch) s2.sizing = sizeMemo(s2);
    var eng = simulate(s2, 60), r = eng.step_in ? null : irr(playerFlows(s2, companyFlows(eng), s2.stake0 != null ? s2.stake0 : st.stake));
    return r == null ? null : Math.round(r * 1000) / 10;
  }
  function ch6FrontPage(st) {
    ensure();
    var k = (st.ch6 && st.ch6.kind) || ch6Pick(st), need = ch6Need(st);
    var lead = k === 'rupee' ? (need.fxCr > 0 ? 'RUPEE AT RECORD LOW: VSI\'S DOLLAR DEBT JUMPS ' + cr(need.fxCr).toUpperCase() + ' OVERNIGHT' : 'RUPEE AT RECORD LOW: AIRLINES CUT FLIGHTS AT VSI') :
      k === 'airline' ? NM.feeder.toUpperCase() + ' GROUNDED: ' + CH6.jets + ' JETS PARKED AT VSI' : 'PASSENGERS DOWN ' + need.paxDrop + '%: AIRPORTS ASK FOR RELIEF';
    var deck = k === 'rupee' ? 'The rupee has fallen ' + Math.round(CH6.fall * 100) + '% in a year. Fuel and aircraft leases are priced in dollars, so airlines are cutting flights.' :
      k === 'airline' ? NM.feeder + ' has stopped flying. It carried ' + Math.round((st.s.anchorShare || 0.74) * 100) + '% of the passengers who change planes at VSI.' :
      'A new virus has emptied the world\'s airports. VSI\'s terminals are quiet and its banks are counting.';
    return paperOf(st, CH6.year, {lead: lead, deck: deck,
      sub: {head: 'The banks write to VSIAL', body: 'With less coming in, the airport will earn ' + (need.worst != null ? coverWords(need.worst).replace(' earned', '') : 'too little') + ' in its hardest year. Its banks want fresh money from the owners.'},
      columns: [{head: 'What it means', body: k === 'airline' ? 'One airline carried the bank, and the bank has gone with it.' : k === 'rupee' ? 'Borrowing in dollars was cheaper, until the rupee fell.' : 'No airport planned for this. Every one of them is asking for help.'}, stakeColumn(st)],
      photo: {kind: k === 'airline' ? 'parked-jets' : 'empty-hall', caption: k === 'airline' ? poss(NM.feeder) + ' jets parked on the international pier.' : 'The Hall at noon, nearly empty.'}});
  }
  function ch6Decision(st) {
    ensure();
    var need = ch6Need(st), X = need.cr, pOwn = ch6Patch(st, 'own', need), pL5 = ch6Patch(st, 'l5', need), m = pL5['stakeBy.ch6'].pct;
    var before = projectReturn(st, {stepInYear: null, 'paxAdj.ch6': null, shock: null, cure: cureList(st.s, CH6.year)}), rOwn = projectReturn(st, pOwn), rL5 = projectReturn(st, pL5), who = st.parent || 'Your company';
    var l5Now = 100 - st.stake - 20, l5After = l5Now + (st.stake - m);
    return choiceDoc(st, {year: CH6.year, docType: 'banks-letter', docId: 'banks-letter-' + cal(CH6.year), title: 'Letter from the banks to ' + VSIAL,
      parties: {from: lenderName(st.s) + ' and the State Bank consortium', to: VSIAL + ', for ' + who, signatory: {name: 'The lenders\' agent', title: 'For the banks'}},
      body: ['The crisis means the airport will earn ' + (need.worst != null ? coverWords(need.worst).replace(' earned', '') : 'too little for its loan payments') + ' in ' + cal(need.worstYear || CH6.year) + '.',
        'The banks ask the owners to put in ' + cr(X) + ' of fresh money this year, enough to bring the hardest year back to ₹110 earned for every ₹100 due.',
        'If no money comes, the banks will take control of the airport and its owners\' shares will be lost.'],
      choices: [
        {id: 'own', label: 'Put in your own money: ' + cr(X) + ' from ' + who, terms: who + ' puts in all of it.',
          slip: {big: cr(X), money: 'your stake stays ' + st.stake + '%', stake: 'your return: about ' + rOwn + '% a year' + (before != null && rOwn != null ? ', ' + Math.abs(Math.round((before - rOwn) * 10) / 10) + ' points ' + (rOwn <= before ? 'lower' : 'higher') + ' than before the crisis' : ''), line: 'You keep the airport and all of your share of it.'}, effects: {}},
        {id: 'l5', label: 'Ask ' + NM.l5 + ' to put it in', terms: NM.l5 + ' puts in ' + cr(X) + ' for new shares, priced so it earns about ' + Math.round(npvRate() * 1000) / 10 + '% a year.',
          slip: {big: 'your stake falls to ' + m + '%', money: NM.l5 + ' rises to ' + l5After + '%', stake: 'your return: about ' + rL5 + '% a year', line: 'No money from you, but a smaller share of everything that follows.'}, effects: {}},
        {id: 'refuse', label: 'Refuse', terms: 'No fresh money from the owners.', slip: {big: 'The banks take control', money: 'your ' + st.stake + '% is lost', stake: 'the concession ends in ' + cal(CH6.year), line: 'The game ends with the banks\' notice.'}, effects: {ends: true}}],
      stamps: {own: 'CURED', l5: 'AGREED', refuse: 'REFUSED'}});
  }
  function ch6ApplyDecision(st, id) {
    ensure();
    st = clone(st); if (!st.ch6) ch6Ready(st);
    id = ['own', 'l5', 'refuse'].indexOf(id) >= 0 ? id : 'own';
    var fp = ch6FrontPage(st), need = ch6Need(st), patch = ch6Patch(st, id, need), k = st.ch6.kind;
    addPaper(st, 6, fp, (k === 'rupee' ? 'Because you borrowed in dollars' : k === 'airline' ? 'Because you anchored ' + NM.feeder : 'Because no airport can plan for a pandemic'), CH6.year);
    applyPatch(st.s, patch);
    if (id === 'l5') { st.stake = patch['stakeBy.ch6'].pct; st.s.l5Pct = (100 - stakeDef(st) - 20) + (stakeDef(st) - st.stake); }
    st.ch6.choice = id; st.ch6.needCr = need.cr; st.ch6.equityCr = need.equityCr;
    addDoc(st, {id: 'banks-letter-' + cal(CH6.year), title: 'Banks\' letter, ' + cal(CH6.year), year: CH6.year, date: ch5Date(st, CH6.year).iso, kind: 'letter', stamp: {own: 'CURED', l5: 'AGREED', refuse: 'REFUSED'}[id],
      summary: id === 'own' ? 'You put in ' + cr(need.cr) + ' of your own when the banks asked.' : id === 'l5' ? NM.l5 + ' put in the ' + cr(need.cr) + ': you own ' + st.stake + '%.' : 'You refused the banks\' letter.'});
    var def = id === 'refuse' ? 'own' : 'l5';
    logDecision(st, {id: 'ch6-cure', group: 'cure', chapter: 6, year: CH6.year, label: 'The crisis cure', chosen: id, chosenLabel: {own: 'Putting in your own money', l5: 'Asking ' + NM.l5, refuse: 'Refusing the banks'}[id],
      'default': def, alt: ch6Patch(st, def, need)});
    if (id === 'refuse') {   // the banks take control: the era runs to the notice, and the game goes to the Black Box
      var r = applyShift(st, autoOf(5)); st = r.state;
      st.ch6.notice = ch6Notice(st);
    }
    return st;
  }
  function ch6Notice(st) {
    var d = ch5Date(st, CH6.year);
    return {title: 'Notice from the banks', date: d.iso, dateWords: d.words, stamp: 'TAKEN OVER',
      text: ['The owners of ' + VSIAL + ' have refused the banks\' request for fresh money.', 'Under the loan agreements, the banks take control of the airport from today. They will run it, or sell it to an operator of their choosing.',
        poss(st.parent || 'Your company') + ' shares in VSIAL are lost.'],
      signed: {name: 'The lenders\' agent', title: 'For the banks'}};
  }
  function ch6Incidents(st) {
    var k = (st.ch6 && st.ch6.kind) || ch6Pick(st);
    if (k === 'airline') return [{id: 'pier', cause: 'anchor-collapse', docId: 'feeders-' + cal(CH4.year), at: '14:00', title: NM.feeder + ' jets block the pier',
      text: poss(NM.feeder) + ' crews have not been paid; 4 of its jets sit on the international pier where ' + CH5.partner + ' needs them.',
      options: [{id: 'tow', label: 'Tow them to the remote apron', effect: 'About ' + crs(CH6.towCr * prAt(CH6.year)) + ' in tugs and crews.'}, {id: 'leave', label: 'Leave them', effect: CH5.partner + ' waits on the taxiway.'}]}];
    if (k === 'rupee') return [{id: 'london', cause: 'rupee-fall', docId: 'loan-offer', at: '15:00', title: CH5.partner + ' wants London once a day',
      text: 'With fuel priced in dollars, ' + CH5.partner + ' asks to cut London to once a day.',
      options: [{id: 'discount', label: 'Offer a year\'s discount on its charges', effect: 'About ' + Math.round(CH6.discountShare * 100) + '% off its charges for a year.'}, {id: 'accept', label: 'Accept the cut', effect: 'One London flight a day, and its connections.'}]}];
    return [{id: 'screening', cause: 'pandemic', docId: 'banks-letter-' + cal(CH6.year), at: '09:30', title: 'The screening queue at arrivals', priceOn: 'hall',
      text: 'Health screening at arrivals is backing up into the pier. Every passenger is screened; the question is how many halls.',
      options: [{id: 'hall', label: 'Open a second screening hall', effect: 'The hall costs about ' + crs(CH6.hallCr * prAt(CH6.year)) + '.'}, {id: 'one', label: 'Keep one hall', effect: 'Longer queues at arrivals.'}]}];
  }
  function ch6ShiftPlan(st) {
    ensure();
    var k = (st.ch6 && st.ch6.kind) || ch6Pick(st), tags = [];
    if (k === 'airline') tags.push({docId: 'feeders-' + cal(CH4.year), doc: 'Network agreement, ' + cal(CH4.year), line: NM.feeder + ' carried ' + Math.round((st.s.anchorShare || 0.74) * 100) + '% of connections.', anchor: 'transfer'});
    if (k === 'rupee') tags.push({docId: 'loan-offer', doc: 'Loan offer, ' + cal(1), line: 'Borrowed in dollars.', anchor: 'margin'});
    if (st.ch6 && st.ch6.choice) tags.push({docId: 'banks-letter-' + cal(CH6.year), doc: 'Banks\' letter, ' + cal(CH6.year), line: st.ch6.choice === 'l5' ? NM.l5 + ' put in the cure: you own ' + st.stake + '%.' : 'You put in ' + cr(st.ch6.needCr) + '.', anchor: 'margin'});
    return {level: 3, chapter: 6, year: CH6.year, window: {from: '13:00', to: '16:00'}, volume: 0.5, crisis: k, standsBlocked: k === 'airline' ? 4 : 0, banks: [],
      incidents: ch6Incidents(st), tags: tags, rates: {perConnectionCr: domConnInr(CH6.year) / 1e7, missedCostCr: CH5.careInr * prAt(CH6.year) / 1e7},
      auto: autoOf(5, {incidents: {pier: 'tow', london: 'discount', screening: 'hall'}})};
  }
  function ch6Briefing(st) {
    var plan = ch6ShiftPlan(st), d = ch5Date(st, CH6.year), k = plan.crisis;
    var lines = [{text: 'Half the usual traffic today', docId: 'banks-letter-' + cal(CH6.year)},
      {text: k === 'airline' ? 'Four ' + NM.feeder + ' jets parked on the international pier' : k === 'rupee' ? CH5.partner + ' is reviewing its London flights' : 'Health screening for every arriving passenger', docId: k === 'airline' ? 'feeders-' + cal(CH4.year) : 'banks-letter-' + cal(CH6.year)},
      {text: 'The banks are watching every rupee', docId: 'banks-letter-' + cal(CH6.year)}];
    lines.forEach(function (l) { l.doc = docTitle(st, l.docId); l.ref = l.doc; });
    return {title: 'Duty manager\'s handover', date: d.words, lines: lines, watch: 'Keep the airport safe and open, at half the usual traffic.', autoStartSec: 6};
  }
  function ch6ApplyShift(st, result) {
    ensure();
    if (st.over) return {state: st, bill: null, card: null};
    if (!st.ch6 || !st.ch6.choice) st = ch6ApplyDecision(st, 'own');
    if (st.over) return {state: st, bill: null, card: null};
    var prev = clone(st); st = clone(st); result = result || ch6ShiftPlan(st).auto;
    var inc = result.incidents || {}, k = st.ch6.kind, incCr = (inc.pier === 'tow' ? CH6.towCr : 0) + (inc.screening === 'hall' ? CH6.hallCr : 0);
    if (incCr > 0) st.s.streams = Object.assign(st.s.streams || {}, {ch6incidents: {perDay: 0, from: CH6.year, until: CH6.year, incCr: 0, costCr: incCr * prAt(CH6.year), stop: CH6.year + 1}});
    if (k === 'rupee' && st.s.hub) st.s.hub = Object.assign({}, st.s.hub, inc.london === 'discount' ? {costCr: (st.s.hub.costCr || 0) + CH6.discountShare * st.s.hub.incCr / 5} : {growth: (st.s.hub.growth || 0) - 0.02});
    logShift(st, 6, result);
    var out = playEras(st, CH_ERAS[6], result), y1 = chYears(6)[1]; st = out.state;
    var id = st.ch6.choice || 'own', X = st.ch6.needCr || 0;
    var rNow = projectReturn(st, {}), rAlt = projectReturn(st, id === 'l5' ? ch6Patch(st, 'own', {cr: X, equityCr: st.ch6.equityCr}) : ch6Patch(st, 'l5', {cr: X, equityCr: st.ch6.equityCr}));
    var margin = id === 'own' ? 'You put in ' + cr(X) + ' of your own when the banks asked. ' + (rNow != null && rAlt != null ? 'Against asking ' + NM.l5 + ', it ' + (rNow >= rAlt ? 'adds ' : 'costs you ') + Math.abs(Math.round((rNow - rAlt) * 10) / 10) + ' points of return a year. ' : '') + 'Without it, the banks would own the airport today.' :
      NM.l5 + ' put in the ' + cr(X) + '. You own ' + st.stake + '% of VSIAL now, and kept your own money. Without it, the banks would own the airport today.';
    var bill = chBill(prev, st, out.reports, {lead: 'The airport came through the crisis' + (st.over ? '' : ', and you still own ' + st.stake + '% of it') + '.',
      paragraph: {rupee: 'The rupee fell ' + Math.round(CH6.fall * 100) + '% in ' + cal(CH6.year) + '. Airlines cut flights while fuel cost more, and came back as it settled.', airline: NM.feeder + ' stopped flying in ' + cal(CH6.year) + '. Other airlines took over some of its routes, but the afternoon bank came back at about 60%.', pandemic: 'Passengers fell ' + Math.round((1 - CH6.kinds.pandemic.adj[0].f) * 100) + '% in ' + cal(CH6.year) + ' and took three years to come back.'}[k] + ' The engine then ran ' + cal(CH6.year + 3) + '–' + cal(y1) + '.',
      margin: margin});
    st.ch6.bill = bill;
    fileReport(st, bill, y1);
    return {state: st, bill: bill, card: ch6Card(k), report: out.reports[out.reports.length - 1]};
  }
  function ch6Card(k) { return k === 'airline' ? ch5Card(6, 'airline') : k === 'pandemic' ? ch5Card(6, 'pandemic') : null; }   // no card for the rupee until one is sourced

  // ---------------------------------------------------------------------------------------------
  // Chapter 7 · Landing: hand it back (years 34-60, eras 8-12)
  // ---------------------------------------------------------------------------------------------
  var CH7 = {year: 34, scoreYear: 33, threshold: 3000 /* (est.) connections a day at year 33 that keep a rival hub from taking your banks */,
    rivalFrom: 36, rivalShare: 0.3, rivalPaxF: 0.92 /* (est.) Hyderabad takes a bank of domestic flights: about 8% of passengers */,
    plan: {routes: 6, perDay: 3600 /* (est.) 6 new long-haul routes, 300 connecting a bank, two banks a day */, capexCr: 1000 /* (est.) today's money: fitting out 20 widebody gates on the satellites */, from: 37, until: 50, growth: 0.02}};
  function ch7Ready(st) {
    var score = networkPerDay(st, CH7.scoreYear), won = score < CH7.threshold;
    if (won) { st.s.rivalTake = {from: CH7.rivalFrom, share: CH7.rivalShare}; st.s.paxAdj = st.s.paxAdj || {}; st.s.paxAdj.ch7rival = [{from: CH7.rivalFrom, until: 60, f: CH7.rivalPaxF}]; }
    else { delete st.s.rivalTake; if (st.s.paxAdj) delete st.s.paxAdj.ch7rival; }
    st.ch7 = {score: score, rivalWon: won};
    return st;
  }
  // L5's price: what its share of the company's money from here to the handback is worth to a fund at the low end of the
  // Fairfax range (the rate the debrief values everything at), on the board's plan as it stands
  function l5Price(st, buy) {
    var s2 = clone(st.s); for (var e = 1; e <= 12; e++) if (!s2.boards[e]) s2.boards[e] = 'auto';
    var eng = simulate(s2, 60), fl = companyFlows(eng), r = npvRate(), pv = 0;
    for (var t = CH7.year; t < 60; t++) pv += (fl[t] || 0) / Math.pow(1 + r, t - CH7.year + 1);
    return Math.max(0, pv * buy / 100);
  }
  function ch7Start(save, opts) { var st = chStart(7, save, opts); return st ? ch7Ready(st) : null; }
  function ch7Fixture(opts) { opts = opts || {}; var st = opts.from ? chStart(7, opts.from, opts) : chFixture(7, opts); return st ? ch7Ready(st) : null; }
  function ch7Res(st) {   // the resolutions on the table: {district, phase2, l5}, each {offered, patch, ...}
    var s = st.s, r = {};
    if (!s.ac_year) { var ac = acPlan(CH7.year - 1); r.district = {patch: {ac_year: CH7.year - 1}, plan: ac}; }
    if (!s.p2year) r.phase2 = {kind: 'build', patch: {p2year: CH7.year - 1}};
    else r.phase2 = {kind: 'dated', patch: {'extraBy.ch7plan': [{year: CH7.year + 1, cr: CH7.plan.capexCr}],
      'streams.plan30': streamOf(CH7.plan.perDay, CH7.plan.from, {perConnInr: ch5Rates(CH7.plan.from).perConnInr, growth: CH7.plan.growth, until: CH7.plan.until})}};
    var l5 = s.l5Pct != null ? s.l5Pct : 16, buy = Math.max(0, Math.min(l5, 80 - st.stake));
    if (buy > 0) {
      var price = l5Price(st, buy);
      r.l5 = {buy: buy, priceCr: Math.round(price), patch: {'stakeBy.ch7': {from: CH7.year, pct: st.stake + buy}, 'paysBy.ch7': {year: CH7.year, cr: Math.round(price)}, stake0: stakeDef(st), l5Pct: l5 - buy}};
    }
    return r;
  }
  function ch7FrontPage(st) {
    ensure();
    var conns = networkPerDay(st, CH7.scoreYear), lr = st.lastReport || {}, who = st.parent || 'Your company', won = st.ch7 ? st.ch7.rivalWon : networkPerDay(st, CH7.scoreYear) < CH7.threshold;
    return paperOf(st, CH7.year, {lead: 'THIRTY YEARS ON: ' + who.toUpperCase() + ' RUNS INDIA\'S CONNECTING HUB',
      deck: 'Vikram Sarabhai International connects about ' + conns.toLocaleString('en-IN') + ' passengers a day. ' + who + '\'s ' + st.stake + '% is worth about ' + stakeWords(lr.stakeValueCr || 0) + '.',
      sub: {head: NM.rival + ' opens a rival hub at Hyderabad', body: 'The bidder VSI beat for the concession is back, with a hub of its own. ' +
        (won ? 'Its first move: ' + poss(NM.feeder) + ' evening bank. VSI\'s network was thin enough to take.' : 'It is struggling to fill its banks: VSI\'s network already connects the cities it wanted.')},
      columns: [{head: 'The last twenty-six years', body: 'The board meets to decide what VSI will be when it is handed back to the State in ' + cal(60) + '.'}, stakeColumn(st)],
      photo: {kind: 'aerial', caption: 'VSI from the air, thirty years after the first digger.'}});
  }
  function ch7Decision(st) {
    ensure();
    var R = ch7Res(st), res = [], y = 50;
    if (R.district) res.push({id: 'district', label: 'Build ' + NM.district + ': hotels, offices and shops on airport land', terms: 'Developers build and pay rent; VSIAL builds the roads, power and water for about ' + cr(R.district.plan.costCr) + '. AERA counts 30% of the income against airline charges.',
      slip: {big: cr(R.district.plan.earnCr) + ' a year by ' + cal(R.district.plan.fullYear), money: 'about ' + cr(R.district.plan.costCr) + ' from the shareholders', stake: 'the first plots open in ' + cal(R.district.plan.opens), line: 'Land and shops, earning while the airport runs.'}});
    if (R.phase2) {
      var S = R.phase2.patch['streams.plan30'];
      res.push(R.phase2.kind === 'build' ? {id: 'phase2', label: 'Commit phase 2, satellites G and H, now', terms: 'Satellites G and H, with the airlines\' letters signed for a date.', slip: {big: '+' + (P.gcap.phase2_mppa - P.gcap.full_mppa) + ' million passengers a year', money: 'about ' + cr(P.vsi_stages.P2.cost * prAt(CH7.year)) + ', 80% lent by the banks', stake: 'open from ' + cal(CH7.year + 3), line: 'A dated plan the airlines can sell.'}} :
        {id: 'phase2', label: 'Commit the last widebody gates for ' + cal(CH7.plan.from) + ', with the airlines\' letters signed', terms: '20 more widebody gates on the satellites, on a date the airlines can sell tickets for. Or wait and see.',
          slip: {big: '+' + CH7.plan.routes + ' long-haul routes from ' + cal(CH7.plan.from), money: cr(S.incCr) + ' a year from their connections', stake: 'costs about ' + cr(CH7.plan.capexCr * prAt(CH7.year + 1)) + ' from the shareholders', line: 'Airlines add routes to a date, not to a maybe.'}});
    }
    if (R.l5) res.push({id: 'l5', label: 'Buy ' + poss(NM.l5) + ' ' + R.l5.buy + '%, taking you to ' + (st.stake + R.l5.buy) + '%', terms: 'Priced on what the airport is worth today.',
      slip: {big: cr(R.l5.priceCr), money: 'you own ' + (st.stake + R.l5.buy) + '% of the handback', stake: 'paid by ' + (st.parent || 'your company') + ', not the airport', line: 'More of the next twenty-six years is yours.'}});
    var d = ch5Date(st, CH7.year);
    return {docType: 'board-minutes', docId: 'minutes-' + cal(CH7.year), title: 'Minutes of the board of ' + VSIAL, date: d.iso, dateWords: d.words,
      parties: {company: VSIAL, present: [st.founder || 'Asha Rao', NM.l5, 'Airports Authority of India', 'State of Maharashtra, through MADC']},
      body: ['The board meets in ' + cal(CH7.year) + ' to set the plan for the last ' + (60 - CH7.year + 1) + ' years of the concession.', 'Each resolution is adopted or rejected.'],
      resolutions: res, choices: res, stamps: {adopted: 'APPROVED', rejected: 'REJECTED'}};
  }
  function ch7ApplyDecision(st, picks) {
    ensure();
    st = clone(st); if (!st.ch7) ch7Ready(st);
    picks = picks || {};
    var R = ch7Res(st), fp = ch7FrontPage(st), adopted = [];
    addPaper(st, 7, fp, st.ch7.rivalWon ? 'Because your network was thin when ' + NM.rival + ' came back' : 'Because your network was already there when ' + NM.rival + ' came back', CH7.year);
    ['district', 'phase2', 'l5'].forEach(function (k) {
      if (!R[k]) return;
      var on = !!picks[k], empty = {};
      Object.keys(R[k].patch).forEach(function (x) { empty[x] = x === 'stake0' ? R[k].patch[x] : null; });
      if (on) { applyPatch(st.s, R[k].patch); adopted.push(k); if (k === 'phase2' && R.phase2.kind === 'build') st.s.sizing = sizeMemo(st.s); if (k === 'l5') st.stake = R.l5.patch['stakeBy.ch7'].pct; }
      logDecision(st, {id: 'ch7-' + k, group: 'plan30', chapter: 7, year: CH7.year, label: {district: 'Building ' + NM.district, phase2: R.phase2 && R.phase2.kind === 'build' ? 'Committing phase 2' : 'Committing the last gates to a date', l5: 'Buying ' + poss(NM.l5) + ' stake'}[k],
        chosen: on ? 'adopt' : 'reject', 'default': 'reject', alt: empty, sizing: k === 'phase2' && R.phase2.kind === 'build'});
    });
    st.ch7.adopted = adopted;
    addDoc(st, {id: 'minutes-' + cal(CH7.year), title: 'Board minutes, ' + cal(CH7.year), year: CH7.year, date: ch5Date(st, CH7.year).iso, kind: 'minutes', stamp: 'APPROVED',
      summary: adopted.length ? 'The board adopted: ' + andList(adopted.map(function (k) { return {district: 'building ' + NM.district, phase2: 'the dated plan for the last gates', l5: 'buying ' + poss(NM.l5) + ' stake'}[k]; })) + '.' : 'The board rejected all three resolutions.'});
    return st;
  }
  function ch7ShiftPlan(st) {
    ensure();
    var district = !!st.s.ac_year && st.s.ac_year >= CH7.year - 1, inc = [];
    if (district) inc.push({id: 'road', cause: 'district', docId: 'minutes-' + cal(CH7.year), at: '20:20', title: 'Evening jam on the access road',
      text: NM.district + '\'s offices empty onto the access road: 40 crew are stuck for the 21:00 bank.',
      options: [{id: 'buses', label: 'Run buses from the city for the crews', effect: 'About ' + crs(0.5 * prAt(CH7.year)) + '.'}, {id: 'delay', label: 'Delay the bank 20 minutes', effect: 'Late departures and missed connections.'}]});
    var tags = [{docId: 'minutes-' + cal(CH7.year), doc: 'Board minutes, ' + cal(CH7.year), line: district ? NM.district + ' built.' : 'The board has met.', anchor: 'margin'}];
    var hv = (st.docs || []).filter(function (d) { return /^(partner|skyward)-/.test(d.id); })[0];
    if (hv) tags.push({docId: hv.id, doc: CH5.partner + ' agreement, ' + cal(CH5.year), line: hv.stamp === 'DECLINED' ? 'Declined ' + CH5.partner + '.' : 'Signed ' + CH5.partner + '.', anchor: 'intl-pier'});
    return {level: 4, chapter: 7, year: CH7.year, window: {from: '20:55', to: '21:00'}, volume: 1, banks: [{airline: CH5.partner, from: '20:30', to: '21:30', international: true}],
      incidents: inc, tags: tags, rates: {perConnectionCr: ch5Rates(CH7.year).perConnectionCr, missedCostCr: CH5.careInr * prAt(CH7.year) / 1e7},
      auto: autoOf(8, {incidents: {road: 'buses'}})};
  }
  function ch7Briefing(st) {
    var plan = ch7ShiftPlan(st), d = ch5Date(st, CH7.year);
    var lines = [{text: 'The evening international bank leaves at 21:00', docId: 'minutes-' + cal(CH7.year)},
      {text: st.ch7 && st.ch7.rivalWon ? NM.rival + ' has taken ' + poss(NM.feeder) + ' evening bank to Hyderabad' : poss(NM.rival) + ' Hyderabad hub is half empty tonight', docId: 'minutes-' + cal(CH7.year)},
      {text: plan.incidents.length ? NM.district + '\'s rush hour meets the crews\' shift change' : 'The access road is clear', docId: 'minutes-' + cal(CH7.year)}];
    lines.forEach(function (l) { l.doc = docTitle(st, l.docId); l.ref = l.doc; });
    return {title: 'Duty manager\'s handover', date: d.words, lines: lines, watch: 'The last bank of the evening.', autoStartSec: 6};
  }
  function ch7ApplyShift(st, result) {
    ensure();
    if (st.over) return {state: st, bill: null, card: null};
    if (!st.ch7 || !st.ch7.adopted) st = ch7ApplyDecision(st, {});
    var prev = clone(st); st = clone(st); result = result || ch7ShiftPlan(st).auto;
    var inc = result.incidents || {};
    if (inc.road === 'buses') st.s.streams = Object.assign(st.s.streams || {}, {ch7incidents: {perDay: 0, from: CH7.year, until: 60, incCr: 0, costCr: 0.5 * prAt(CH7.year) * 60 /* (est.) about 60 jam evenings a year */, stop: 61}});
    logShift(st, 7, result);
    var out = playEras(st, CH_ERAS[7], result, true); st = out.state;
    var f = st.final || {}, adopted = (st.ch7 && st.ch7.adopted) || [], y1 = 60;
    var margin = (adopted.indexOf('district') >= 0 ? NM.district + ' paid its rent every year from ' + cal(acPlan(CH7.year - 1).opens) + '. ' : '') +
      (st.ch7 && st.ch7.rivalWon ? NM.rival + ' took some of your banks to Hyderabad: your network was too thin to hold them. ' : poss(NM.rival) + ' Hyderabad hub never filled its banks: your network got there first. ') +
      (adopted.indexOf('l5') >= 0 ? 'Buying ' + poss(NM.l5) + ' stake made ' + st.stake + '% of the last ' + (60 - CH7.year + 1) + ' years yours.' : '');
    var bill = chBill(prev, st, out.reports, {lead: (st.parent || 'Your company') + ' handed Vikram Sarabhai International back to the State' + (f.returnedCr != null ? ', having received ' + cr(f.returnedCr) + ' on ' + cr(f.investedCr) + ' put in' : '') + '.',
      paragraph: 'From ' + cal(CH7.year) + ' to ' + cal(60) + ' the engine ran the airport on the board\'s plan. ' + (f.paxTotalM ? 'Over sixty years it served about ' + (f.paxTotalM / 1000).toFixed(1) + ' billion passengers.' : ''),
      margin: margin.trim()});
    st.ch7.bill = bill;
    fileReport(st, bill, y1);
    return {state: st, bill: bill, card: ch5Card(7), report: out.reports[out.reports.length - 1]};
  }

  // ---------------------------------------------------------------------------------------------
  // The press conference after a bad day (design/ideas/press-conference.md, design/fun.md idea #6). PAPER.
  // VSIEra.press.offer(state, n) → true when chapter n's shift (s.shiftLog) was bad and the press has not met yet;
  // .conference(state, n) → the notepad: three questions, each naming the shift's own bad numbers, three answers each;
  // .apply(state, answers, n) → the state with the answers on file: Akasa Air's trust (s.plateauTrust, the number Takeoff
  // sets) moves a little now, and again when the next chapter's shift is flown (logShift → pressSettle); the next front
  // page carries the headline. Deterministic: the same save and the same answers give the same state.
  // ---------------------------------------------------------------------------------------------
  var PRESS = {stars: 1, otp: 0.70, missed: 20, missedShare: 0.15,
    // (est.) points of airline trust (0-1): owning it is warm now and pays when the fix shows; deflecting looks as good
    // tomorrow and costs more once the numbers come out; blaming others changes nothing now and costs later
    fx: {own: {now: 0.02, later: 0.02}, blame: {now: 0, later: -0.04}, deflect: {now: 0.02, later: -0.06}},
    when: {3: 'morning', 4: 'afternoon', 5: 'day', 6: 'day', 7: 'evening'},
    fix: {3: 'Every belt, gate and stand gets a full rehearsal before the next big day', 4: 'The afternoon bank gets more staff at the transfer desk, from next week',
      5: 'Late feeder flights get a plan before they land: we hold the onward flight, or we rebook every passenger', 6: 'We are keeping the full duty team on through the quiet months',
      7: 'The evening crews start an hour earlier, before the district\'s rush hour'}};
  function pressAirline(st, n) { return n === 3 ? NM.plateau : n === 5 && st.ch5 && st.ch5.choice && st.ch5.choice !== 'decline' ? CH5.partner : n === 4 || n === 5 ? NM.feeder : NM.plateau; }
  function pressShift(st, n) { return ((st.s && st.s.shiftLog) || []).filter(function (x) { return x.chapter === n; })[0] || null; }
  function pressLast(st) { var l = (st.s && st.s.shiftLog) || []; return l.length ? l.reduce(function (a, x) { return x.chapter > a ? x.chapter : a; }, 0) : null; }
  function pressLog(st) { return (st.s && st.s.press && st.s.press.log) || []; }
  function pressBad(r) {
    if (!r) return false;
    var tot = (r.made || 0) + (r.missed || 0), share = tot ? (r.missed || 0) / tot : 0;
    return r.stars <= PRESS.stars || r.otp < PRESS.otp || ((r.missed || 0) >= PRESS.missed && share >= PRESS.missedShare);
  }
  function pressOffer(st, n) {
    if (!st || !st.s || st.over) return false;
    n = n == null ? pressLast(st) : n;
    if (!n || n < 3 || n > 7) return false;
    if (pressLog(st).some(function (x) { return x.chapter === n; })) return false;
    return pressBad(pressShift(st, n));
  }
  // the shift's bad numbers, worst first: [{k, sev, text (a sentence), short (a phrase)}]
  function pressNumbers(st, n) {
    var r = pressShift(st, n) || {}, when = PRESS.when[n] || 'day', made = r.made || 0, missed = r.missed || 0, tot = made + missed, share = tot ? missed / tot : 0;
    var air = pressAirline(st, n), out = [], otp = Math.round((r.otp != null ? r.otp : 0.85) * 100), stars = r.stars != null ? r.stars : 2;
    var hold = (st.s.decisions || []).filter(function (d) { return d.id === 'ch5-hold'; })[0], london = n === 5 && hold && hold.chosen === 'letgo';
    if (missed >= PRESS.missed && (share >= 0.08 || london)) {
      var N = missed.toLocaleString('en-IN'), txt = n === 3 ? N + ' passengers missed their ' + air + ' connections on opening morning' :
        n === 4 ? N + ' passengers missed their onward flights this afternoon' :
        london ? CH5.hub.pax.toLocaleString('en-IN') + ' passengers from ' + CH5.hub.from + ' missed ' + CH5.hub.dest + ' today' :
        N + ' passengers missed their connections today';
      out.push({k: 'missed', sev: london ? 9 : share / PRESS.missedShare, text: txt, short: london ? CH5.hub.pax + ' passengers left behind by ' + CH5.hub.dest : N + ' missed connections',
        again: (london ? CH5.hub.pax.toLocaleString('en-IN') : N) + ' people missed their flights at your airport'});
    }
    if (otp < 80) out.push({k: 'otp', sev: (85 - otp) / 15, text: 'Only ' + otp + '% of flights left on time this ' + when + ': ' + Math.round((100 - otp) / 10) + ' in 10 were late', short: otp + '% on time',
      again: Math.round((100 - otp) / 10) + ' in 10 flights were late at your airport'});
    if (stars <= PRESS.stars) out.push({k: 'stars', sev: 0.9, text: 'The airport\'s own report gives this ' + when + ' ' + stars + ' star' + (stars === 1 ? '' : 's') + ' of 3: safe, and nothing more', short: 'a ' + stars + '-star ' + when,
      again: 'Your airport ran a ' + stars + '-star ' + when});
    out.sort(function (a, b) { return b.sev - a.sev; });
    return out;
  }
  function pressHeadline(st, n, answers) {
    var when = (PRESS.when[n] || 'day').toUpperCase(), c = {own: 0, blame: 0, deflect: 0}, firstBlame = null, Q = pressQuestions(st, n);
    Q.forEach(function (q) { var a = answers[q.id]; c[a]++; if (a === 'blame' && !firstBlame) firstBlame = q.blames; });
    if (c.own >= 2) return {kind: 'own', lead: 'VSI\'S CHIEF OWNS THE BAD ' + when};
    if (c.blame >= 2) return {kind: 'blame', lead: 'VSI BLAMES ' + firstBlame.toUpperCase()};
    if (c.deflect >= 2) return {kind: 'deflect', lead: 'VSI POINTS TO A RECORD YEAR'};
    return {kind: 'mixed', lead: 'VSI\'S CHIEF ANSWERS FOR A BAD ' + when};
  }
  function pressQuestions(st, n) {
    var nums = pressNumbers(st, n), w = nums[0] || {text: 'The shift went badly', short: 'a bad ' + (PRESS.when[n] || 'day')}, w2 = nums[1] || {k: w.k, text: w.again || w.text}, air = pressAirline(st, n), fix = PRESS.fix[n] || PRESS.fix[3];
    var ans = function (own, blame, deflect, blames) {
      return [{id: 'own', label: 'Own it, and name the fix', says: own, slip: {paper: 'The chief owns it', airline: air + ': a little warmer'}},
        {id: 'blame', label: 'Blame ' + blames, says: blame, slip: {paper: 'VSI blames ' + blames, airline: air + ': no change'}},
        {id: 'deflect', label: 'Point to the good news', says: deflect, slip: {paper: 'VSI points to a record year', airline: air + ': a little warmer'}}];
    };
    return [
      {id: 'q1', number: w.k, ask: w.text + '. What went wrong?', blames: 'the weather',
        answers: ans('"We got it wrong. ' + fix + '."', '"The weather turned, and the whole region ran late."', '"Look at the year: more passengers than ever came through VSI."', 'the weather')},
      {id: 'q2', number: w2.k, ask: w2.text + '. Whose fault is that?', blames: 'the airlines',
        answers: ans('"Ours. The airport sets the plan, so the airport answers for it."', '"The airlines\' flights came in late, and we cannot turn a plane around faster than its crew."', '"It was one day. The year has been the best VSI has had."', 'the airlines')},
      {id: 'q3', number: w.k, ask: air + ' is deciding whether to bring more flights to VSI. After ' + w.short + ', why should it?', blames: poss(air) + ' timetable',
        answers: ans('"Because we will fix it, and we will show ' + air + ' the fix before the next ' + (PRESS.when[n] || 'day') + '."', '"' + poss(air) + ' own timetable left too little time to change planes."', '"' + air + ' has never had a better year here."', poss(air) + ' timetable')}];
  }
  function pressConference(st, n) {
    ensure();
    n = n == null ? pressLast(st) : n;
    var y = SHIFT_YEAR[n] || st.year, d = ch5Date(st, y), prev = pressLog(st).slice(-1)[0], air = pressAirline(st, n);
    var recall = prev ? 'In ' + prev.calYear + ' you ' + {own: 'owned the bad ' + (PRESS.when[prev.chapter] || 'day') + ' and promised a fix.', blame: 'blamed ' + prev.blamed + '.', deflect: 'pointed to a record year.', mixed: 'answered for a bad ' + (PRESS.when[prev.chapter] || 'day') + '.'}[prev.kind] : null;
    return {chapter: n, year: y, calYear: cal(y), date: d.iso, dateWords: d.words, paper: 'The Zero Mile Times', reporter: 'Our aviation reporter', room: 'The press room, Zero Mile Hall',
      title: 'The Zero Mile Times asks', airline: air, founder: st.founder || 'Asha Rao', company: st.parent || 'Your company', role: 'Director, VSIAL',
      intro: 'The ' + (PRESS.when[n] || 'day') + ' went badly, and the paper wants answers before it goes to print.', recall: recall,
      numbers: pressNumbers(st, n).map(function (x) { return {k: x.k, text: x.text}; }), questions: pressQuestions(st, n),
      slipQuestion: 'What tomorrow\'s paper says', slipNote: 'Airlines read the paper too.', cta: 'Give the answer', done: 'On to the year\'s results'};
  }
  // tomorrow's headline and column for a set of answers ({q1, q2, q3}: own | blame | deflect)
  function pressStory(st, n, a) {
    n = n == null ? pressLast(st) : n; a = a || {};
    var Q = pressQuestions(st, n), h = pressHeadline(st, n, a), nums = pressNumbers(st, n), w = nums[0] ? nums[0].short : 'a bad ' + (PRESS.when[n] || 'day');
    var who = st.founder || 'VSI\'s chief', air = pressAirline(st, n), blamed = (Q.filter(function (q) { return a[q.id] === 'blame'; })[0] || {}).blames || null;
    var body = h.kind === 'own' ? 'Asked about ' + w + ', ' + who + ' said: "We got it wrong. ' + (PRESS.fix[n] || PRESS.fix[3]) + '." The paper will check on the fix.' :
      h.kind === 'blame' ? who + ' blamed ' + blamed + ' for ' + w + '. ' + air + ' did not comment.' :
      h.kind === 'deflect' ? 'Asked about ' + w + ', ' + who + ' pointed to a record year for VSI. ' + air + ' did not comment.' :
      who + ' answered three questions about ' + w + '. ' + air + ' did not comment.';
    return {kind: h.kind, lead: h.lead, blamed: blamed, column: {head: h.lead, body: body}};
  }
  function pressClamp(v) { return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100; }
  function pressApply(st, answers, n) {
    ensure();
    n = n == null ? pressLast(st) : n;
    if (!pressShift(st, n) || pressLog(st).some(function (x) { return x.chapter === n; })) return st;
    st = clone(st);
    var Q = pressQuestions(st, n), a = {}, now = 0, later = 0;
    if (Array.isArray(answers)) answers = {q1: answers[0], q2: answers[1], q3: answers[2]};
    Q.forEach(function (q) { var x = answers && answers[q.id]; a[q.id] = PRESS.fx[x] ? x : 'deflect'; now += PRESS.fx[a[q.id]].now; later += PRESS.fx[a[q.id]].later; });
    now = Math.round(now * 100) / 100; later = Math.round(later * 100) / 100;
    var y = SHIFT_YEAR[n] || st.year, h = pressStory(st, n, a), blamed = h.blamed, body = h.column.body;
    st.s.press = st.s.press || {log: []};
    st.s.press.log = (st.s.press.log || []).concat([{chapter: n, year: y, calYear: cal(y), answers: a, kind: h.kind, lead: h.lead, blamed: blamed, column: h.column,
      now: now, later: later, settled: false}]);
    if (st.s.plateauTrust != null) st.s.plateauTrust = pressClamp(st.s.plateauTrust + now);
    st.s.pressTrust = Math.round(((st.s.pressTrust || 0) + now) * 100) / 100;
    addDoc(st, {id: 'press-' + cal(y), title: 'Press notes, ' + cal(y), year: y, date: ch5Date(st, y).iso, kind: 'press', stamp: 'FILED', summary: 'The Zero Mile Times ran "' + h.lead + '". ' + body});
    return st;
  }
  // the later half: when a later chapter's shift is flown, the airline has seen whether the answers held
  function pressSettle(st, n) {
    if (!st || !st.s || !st.s.press) return st;
    (st.s.press.log || []).forEach(function (x) {
      if (x.settled || x.chapter >= n) return;
      x.settled = true;
      if (st.s.plateauTrust != null) st.s.plateauTrust = pressClamp(st.s.plateauTrust + x.later);
      st.s.pressTrust = Math.round(((st.s.pressTrust || 0) + x.later) * 100) / 100;
    });
    return st;
  }
  // the next front page after the press met: the cliffhanger after Takeoff (3) and Cruise (5), else the next chapter's
  function pressColumn(st, n) { var x = pressLog(st).filter(function (r) { return r.chapter === n; })[0]; return x ? clone(x.column) : null; }
  function pressFront(fp, col) { if (fp && col) fp.columns = [col].concat(fp.columns || []); return fp; }
  var press = {offer: pressOffer, bad: pressBad, conference: pressConference, story: function (st, a, n) { ensure(); return pressStory(st, n, a); }, apply: pressApply, settle: pressSettle, column: pressColumn, rules: PRESS};

  // ---------------------------------------------------------------------------------------------
  // VSIEra.bridge(state, n): the years between the end of one chapter and the start of chapter n, played by the engine
  // (pending boards at the defaults), with the facts for the "years later" split-flap: {state, from, to, years[], lines[]}
  // ---------------------------------------------------------------------------------------------
  // a chapter the engine plays over without its decision (advance, the fixtures) takes what a passive player would have chosen
  // (design/debrief.md §2), so its network, crisis and shocks exist; no front page goes into the player's papers
  function autoDecide(st) {
    var e = st.era, s = st.s;
    var log = function (id, group, n, year, label, chosen, alt) { logDecision(st, {id: id, group: group, chapter: n, year: year, label: label, chosen: chosen, chosenLabel: chosen, 'default': chosen, alt: alt, auto: true}); };
    if (e === firstEra(3) && !st.ch3) { applyPatch(s, ch3Patch('phased', 0.95, CH3.growth)); st.ch3 = {plan: 'phased', auto: true}; log('ch3-plan', 'opening', 3, CH3.year, 'The opening plan', 'phased', ch3Patch('phased', 0.95, CH3.growth)); }
    if (e === firstEra(4) && !st.ch4) { var id = ch4Def(st); applyPatch(s, ch4Patch(id)); st.ch4 = {network: id, auto: true}; log('ch4-network', 'network', 4, CH4.year, 'The network', id, ch4Patch(id)); }
    if (e === firstEra(6) && !st.ch6) {
      ch6Ready(st);
      var need = ch6Need(st), pt = ch6Patch(st, 'l5', need);
      applyPatch(s, pt); st.stake = pt['stakeBy.ch6'].pct; s.l5Pct = (100 - stakeDef(st) - 20) + (stakeDef(st) - st.stake);
      st.ch6.choice = 'l5'; st.ch6.needCr = need.cr; st.ch6.equityCr = need.equityCr; st.ch6.auto = true;
      log('ch6-cure', 'cure', 6, CH6.year, 'The crisis cure', 'l5', pt);
    }
    if (e === firstEra(7) && !st.ch7) { ch7Ready(st); st.ch7.adopted = []; st.ch7.auto = true; }
    return st;
  }
  // the year each chapter's shift is played: the years-later pages run from it to the next chapter's first year
  var SHIFT_YEAR = {3: 5, 4: 9, 5: 15, 6: 21, 7: 34};
  var FRONT_YEAR = {3: 5, 4: 8, 5: 14, 6: 21, 7: 34};   // the year each chapter's front page is dated (the flaps land there)
  var CLIFF_YEAR = {1: 7, 2: 18};                      // the cliffhanger: the last year of its act (Takeoff ends 2032, Cruise 2043)
  function bridge(state, n) {
    ensure();
    // from the last page the player saw: the cliffhanger after an act break, otherwise the previous chapter's shift
    var y0 = n === 4 ? CLIFF_YEAR[1] : n === 6 ? CLIFF_YEAR[2] : SHIFT_YEAR[n - 1] || state.year || 1, st = advance(state, firstEra(n));
    if (n === 6 && st && !st.over && st.era === firstEra(6) && !st.ch6) ch6Ready(st);
    if (n === 7 && st && !st.over && st.era === firstEra(7) && !st.ch7) ch7Ready(st);
    var y1 = st.over ? (st.over.year || st.year) : FRONT_YEAR[n] || (eraYears(firstEra(n)) || [0, st.year])[1], eng = simulate(st.s, Math.max(1, y1)), years = [];
    var ev = {}; eng.events.forEach(function (e) { (ev[e.t + 1] = ev[e.t + 1] || []).push(e); });
    eng.rows.forEach(function (r, i) {
      if (r.year <= y0 || r.year >= y1) return;
      var p = eng.rows[i - 1], line = '';
      (ev[r.year] || []).forEach(function (e) {
        if (!line && e.k === 'fx') line = 'The rupee falls ' + Math.round(e.fall * 100) + '%: the dollar bonds grow by ' + cr(e.amt) + '.';
        if (!line && e.k === 'refi') line = 'A steady record: the banks refinance ' + cr(e.amt) + ' more cheaply.';
        if (!line && (e.k === 'cure_ds' || e.k === 'cure_era')) line = 'The owners put in ' + cr(e.amt) + ' to keep the banks paid.';
      });
      if (!line && p && r.cap > p.cap + 1) line = 'New terminal space opens: room for ' + Math.round(r.cap) + ' million passengers a year.';
      if (!line && p && p.debt > 1 && r.debt < 1) line = 'The last bank loan is repaid.';
      years.push({year: r.year, calYear: cal(r.year), paxM: Math.round(r.pax * 10) / 10, light: lightOf(r.dscr), connectionsPerDay: networkPerDay(st, r.year), line: line});
    });
    var last = years[years.length - 1], lr = st.lastReport || {};
    var lines = [];
    if (last) lines.push(cal(last.year) + ': ' + last.paxM + ' million passengers a year, ' + last.connectionsPerDay.toLocaleString('en-IN') + ' changing planes here each day.');
    lines.push('Your ' + st.stake + '% is worth about ' + stakeWords(lr.stakeValueCr || 0) + '.');
    if (lr.cover != null) lines.push('The banks: ' + coverWords(lr.cover) + ' in the hardest recent year.');
    // the split-flap: one headline per year, oldest first (the year's event, or its passengers and connections)
    var headlines = years.map(function (y) { return y.calYear + ': ' + (y.line || y.paxM + ' million passengers, ' + y.connectionsPerDay.toLocaleString('en-IN') + ' changing planes here each day.'); });
    return {state: st, from: cal(y0), to: cal(y1), fromYear: cal(y0), toYear: cal(y1), years: years, lines: headlines, headlines: headlines, summary: lines, chapter: n};
  }

  // ---------------------------------------------------------------------------------------------
  // The cliffhanger (money/DESIGN.md §14.4): the act's last front page, the Late City edition, folded with the next act's name
  // in pencil. VSIEra.actBreak(state) → the act just finished (1 after Chapter 3's shift, 2 after Chapter 5's) or 0;
  // VSIEra.cliffhanger(state, act) → the front page. Act II's is written from what is coming for this player (Chapter 6's pick).
  // ---------------------------------------------------------------------------------------------
  var ACTS = {1: {name: 'The Deal', next: 'Act II · The Network', last: 3}, 2: {name: 'The Network', next: 'Act III · The Long Game', last: 5}, 3: {name: 'The Long Game', next: 'The Black Box', last: 7}};
  function actBreak(state) {
    if (!state || !state.s || state.over) return 0;
    if (state.ch3 && state.ch3.bill && state.era === 1) return 1;
    if (state.ch5 && state.ch5.bill && state.era === 4) return 2;
    return 0;
  }
  function cliffhanger(state, act) {
    ensure();
    act = act || actBreak(state) || 1;
    var st = state, lr = st.lastReport || {}, who = st.parent || 'Your company', A = ACTS[act] || ACTS[1], o;
    if (act === 1) {
      var tr = st.s.plateauTrust, otp = st.ch3 && st.ch3.result && st.ch3.result.otp;
      o = {year: CLIFF_YEAR[1], lead: 'AIRLINES ASK: WILL VSI BECOME INDIA\'S CONNECTING HUB?',
        deck: 'Two years after opening day, ' + NM.feeder + ' is drawing up a plan to time twelve cities into one afternoon at Vikram Sarabhai International.',
        sub: {head: 'Opening day, remembered', body: otp != null ? 'VSI ran its first morning at ' + Math.round(otp * 100) + '% on time. ' + (tr != null && tr >= CH3.trustLine ? NM.plateau + ' wants a bigger part in what comes next.' : NM.plateau + ' is keeping its distance.') : 'The airport has found its feet.'}};
    } else {
      var k = ch6Pick(st);
      o = {year: CLIFF_YEAR[2], lead: k === 'rupee' ? 'A STORM IS COMING: RUPEE AT RECORD LOW' : k === 'airline' ? NM.feeder.toUpperCase() + ' MISSES ITS FUEL PAYMENTS' : 'A NEW VIRUS SPREADS: AIRLINES WATCH THEIR BOOKINGS',
        deck: k === 'rupee' ? 'Traders expect the rupee to fall further. Every airline that pays for fuel in dollars is nervous.' :
          k === 'airline' ? 'Oil companies say ' + NM.feeder + ' is behind on its bills. It carries ' + Math.round((st.s.anchorShare || 0.74) * 100) + '% of the passengers who change planes at VSI.' :
          'Health officials are tracking a new virus. Airports are drawing up plans for empty terminals.',
        sub: {head: 'Where VSI stands', body: who + '\'s ' + st.stake + '% is worth about ' + stakeWords(lr.stakeValueCr || 0) + '. ' + (lr.cover != null ? 'In its hardest recent year the airport earned ' + coverWords(lr.cover).replace(' earned', '') + ' to its banks.' : '')}};
    }
    var fp = paperOf(st, o.year, {lead: o.lead, deck: o.deck, sub: o.sub, columns: [stakeColumn(st)], photo: {kind: act === 1 ? 'dusk-apron' : 'storm', caption: act === 1 ? 'The apron at dusk.' : 'Clouds over the lakes east of runway 3.'}});
    fp.edition = 'Late City'; fp.act = act; fp.actName = A.name; fp.fold = A.next;
    return fp;
  }

  // ---------------------------------------------------------------------------------------------
  // The Black Box (design/debrief.md): VSIEra.debrief.*
  // ---------------------------------------------------------------------------------------------
  var GROUPS = ['finance', 'bid', 'build', 'opening', 'network', 'radar', 'partner', 'hold', 'cure', 'plan30', 'shifts'];
  var GROUP_LABEL = {finance: 'How you financed it', bid: 'Your bid', build: 'How you built it', opening: 'The opening plan', network: 'The network', radar: 'The bird radar',
    partner: CH5.partner, hold: 'Holding London for Lucknow', cure: 'The crisis cure', plan30: 'The thirty-year plan', shifts: 'Your shifts'};
  var MEDIAN_BID = 16.5;   // previewBid's 50% chance of winning (the rivals cluster 12-21%)
  var _sizeMemo = {};
  function sizeKey(s) { return JSON.stringify([s.gearing, s.phase1, s.lender, s.state_loan, s.defer_state_loan, s.profile, s.bid, s.p2year]); }
  function sizeMemo(s) { var k = sizeKey(s); if (!_sizeMemo[k]) _sizeMemo[k] = clone(sizeDebt(s)); return clone(_sizeMemo[k]); }
  function benchmarks() {
    ensure();
    var dcf = J('bial.owners.dcf_inputs', {}) || {}, roe = J('till.fair_return_on_equity', null), cod = J('till.efficient_cost_of_debt', null);
    var src = function (p) { var n = MD; p.split('.').forEach(function (k) { n = n && n[k]; }); return n && n.source ? n.source.split(' ; ')[0] : null; };
    var out = [];
    if (dcf.discount_rate) out.push({id: 'fairfax', label: 'What Fairfax\'s own valuation of Bengaluru\'s airport assumes it earns', lowPct: dcf.discount_rate[0] * 100, highPct: dcf.discount_rate[1] * 100, pct: [Math.round(dcf.discount_rate[0] * 1000) / 10, Math.round(dcf.discount_rate[1] * 1000) / 10], year: 2025, source: src('bial.owners.dcf_inputs'), key: 'bial.owners.dcf_inputs'});
    if (roe != null) out.push({id: 'aera', label: 'What AERA allows Delhi\'s airport on its shareholders\' money', pct: roe, source: src('till.fair_return_on_equity'), key: 'till.fair_return_on_equity'});
    if (cod != null) out.push({id: 'banks', label: 'What the banks charged', pct: cod, source: src('till.efficient_cost_of_debt'), key: 'till.efficient_cost_of_debt'});
    var CITE = {fairfax: 'Fairfax India Holdings, Annual Report 2025: the discount rates in its valuation of Bangalore International Airport.',
      aera: 'AERA consultation paper on Delhi airport (aera.gov.in), para 7.2.3 and Table 238: the fair return on shareholders\' money.',
      banks: 'AERA, the same consultation paper, paras 7.2.7 to 7.2.10: the efficient cost of Delhi airport\'s debt.'};
    out.forEach(function (b) { b.cite = CITE[b.id] || b.label; });   // readable citations: the browser build strips money.json's source fields
    return out;
  }
  function npvRate() { var b = benchmarks().filter(function (x) { return x.id === 'fairfax'; })[0]; return b ? b.lowPct / 100 : 0.122; }
  // every decision with what a passive player would have done (design/debrief.md §2): Chapters 1-2 read from the scenario,
  // Chapters 3-7 from s.decisions, the shifts from s.eraOps
  function groupPatches(state) {
    var s = state.s, g = {};
    if (s.gearing !== 0.7 || s.lender !== 'banks' || s.profile !== 'sculpt' || s.state_loan !== true || s.defer_state_loan !== true || s.phase1 !== 'lean')
      g.finance = {patch: {gearing: 0.7, lender: 'banks', profile: 'sculpt', state_loan: true, defer_state_loan: true, phase1: 'lean'}, sizing: true,
        chosen: (s.lender === 'dollar' ? 'dollar bonds' : s.lender === 'infra' ? 'the infrastructure bank' : s.privateLoan ? s.privateLoan.house : 'Indian banks') + ', ' + Math.round(s.gearing * 100) + '% borrowed, phase 1 ' + s.phase1};
    if (!(s.bid.type === 'share' && Math.abs(s.bid.value - MEDIAN_BID) < 1e-9)) g.bid = {patch: {bid: {type: 'share', value: MEDIAN_BID}}, sizing: true, chosen: s.bid.type === 'share' ? 'a bid of ' + s.bid.value + '%' : 'a bid of ₹' + s.bid.value + ' a passenger'};
    var payAll = conFrom({monsoon: 'pay', overrun: 'pay', trials: 'full'}, s), cn = s.construction;
    if (cn && (cn.monsoon !== 'pay' || cn.overrun !== 'pay' || cn.trials !== 'full')) g.build = {patch: {construction: Object.assign({}, cn, payAll)}, chosen: [cn.monsoon === 'slip' ? 'waited out the monsoon' : '', cn.overrun === 'slip' ? 'slipped the roof' : '', cn.trials === 'short' ? 'short trials' : ''].filter(Boolean).join(', ') || 'paid to open on time'};
    (s.decisions || []).forEach(function (d) {
      if (d.chosen === d['default']) return;
      var x = g[d.group] = g[d.group] || {patch: {}, chosen: [], sizing: false};
      Object.assign(x.patch, d.alt || {}); x.sizing = x.sizing || !!d.sizing;
      x.chosen = [].concat(x.chosen, [d.group === 'plan30' ? d.label.charAt(0).toLowerCase() + d.label.slice(1) : d.chosenLabel || d.chosen]);
    });
    // the shifts the player played (not the engine's stubs), against an expert's (ops_profiles.expert) in the same eras
    var played = (s.shiftLog || []).filter(function (x) { return !x.auto; }), ex = clone(s.eraOps || {}), nEra = 0;
    played.forEach(function (x) { (CH_ERAS[x.chapter] || []).forEach(function (e) { if (s.eraOps && s.eraOps[e]) { ex[e] = opsProfile('expert', eraYears(e)[1]); nEra++; } }); });
    if (nEra) g.shifts = {patch: {eraOps: ex}, chosen: played.length + (played.length > 1 ? ' shifts' : ' shift') + ' you played'};
    Object.keys(g).forEach(function (k) { if (Array.isArray(g[k].chosen)) g[k].chosen = andList(g[k].chosen); });
    return g;
  }
  function valueOf(state, G, keep) {   // v(S): the player's net present value with the groups in keep as played, the rest passive
    var s = clone(state.s), resize = false;
    delete s.decisions;
    Object.keys(G).forEach(function (k) { if (!keep[k]) { applyPatch(s, G[k].patch); resize = resize || !!G[k].sizing; } });
    if (resize) s.sizing = sizeMemo(s);
    for (var e = 1; e <= 12; e++) s.boards[e] = 'auto';
    var eng = simulate(s, 60), pf = playerFlows(s, companyFlows(eng), s.stake0 != null ? s.stake0 : state.stake), r = npvRate(), v = 0;
    pf.forEach(function (f, t) { v += f / Math.pow(1 + r, t); });
    return v;
  }
  // design/debrief.md §2: exact Shapley values over the decision groups (opts.exact, 2^n runs), or leave-one-out (n + 2 runs,
  // "a quick estimate"). Shares are of the difference between the player's run and the all-passive run; "everything else"
  // is what the method leaves (interactions, for leave-one-out), so the shares and it add up to that difference exactly.
  function attribution(state, opts) {
    ensure();
    opts = opts || {};
    var G = groupPatches(state), ids = GROUPS.filter(function (k) { return G[k]; }), n = ids.length, all = {}, none = {}, phi = {};
    ids.forEach(function (k) { all[k] = true; });
    var vN = valueOf(state, G, all), v0 = valueOf(state, G, none), total = vN - v0, method = opts.exact ? 'shapley' : 'leave-one-out';
    if (opts.exact && n) {
      var memo = {}, fact = [1]; for (var i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;
      var V = function (mask) { if (memo[mask] == null) { var keep = {}; ids.forEach(function (k, j) { if (mask & (1 << j)) keep[k] = true; }); memo[mask] = valueOf(state, G, keep); } return memo[mask]; };
      memo[(1 << n) - 1] = vN; memo[0] = v0;
      ids.forEach(function (k, j) {
        var sum = 0;
        for (var m = 0; m < (1 << n); m++) {
          if (m & (1 << j)) continue;
          var size = 0; for (var b = m; b; b >>= 1) size += b & 1;
          sum += fact[size] * fact[n - size - 1] / fact[n] * (V(m | (1 << j)) - V(m));
        }
        phi[k] = sum;
      });
    } else ids.forEach(function (k) { var keep = Object.assign({}, all); delete keep[k]; phi[k] = vN - valueOf(state, G, keep); });
    // percentages are of everything the decisions moved (each share's size, and what is left), so they stay readable when the
    // player's run and the passive one end close together; the crore figures add up to the difference exactly
    var sumPhi = ids.reduce(function (a, k) { return a + phi[k]; }, 0), rest = total - sumPhi, den = ids.reduce(function (a, k) { return a + Math.abs(phi[k]); }, 0) + Math.abs(rest) || 1;
    var groups = ids.map(function (k) { return {group: k, label: GROUP_LABEL[k], chosen: G[k].chosen, npvCr: Math.round(phi[k]), sharePct: Math.round(phi[k] / den * 1000) / 10}; })
      .sort(function (a, b) { return Math.abs(b.npvCr) - Math.abs(a.npvCr); });
    // the page: shares under 3% pooled into "everything else", at most 5 bars, the two largest as sentences
    var bars = groups.filter(function (x) { return Math.abs(x.sharePct) >= 3; }).slice(0, 5);
    var pooled = rest + groups.filter(function (x) { return bars.indexOf(x) < 0; }).reduce(function (a, x) { return a + phi[x.group]; }, 0);
    var sentence = function (x) {
      var w = x.group === 'shifts' ? 'Your shifts, against an expert\'s,' : x.group === 'finance' || x.group === 'bid' || x.group === 'build' || x.group === 'plan30' ? x.label + ' (' + x.chosen + ')' : x.chosen ? x.chosen.charAt(0).toUpperCase() + x.chosen.slice(1) : x.label;
      return w + (x.npvCr >= 0 ? ' made ' : ' cost you ') + Math.abs(Math.round(x.sharePct)) + '% of your return.';
    };
    var absSum = groups.reduce(function (a, x) { return a + Math.abs(phi[x.group]); }, 0) + Math.abs(rest), top2 = groups.slice(0, 2).reduce(function (a, x) { return a + Math.abs(phi[x.group]); }, 0);
    return {method: method, words: method === 'leave-one-out' ? 'A quick estimate: each decision undone on its own.' : '', rate: npvRate(), playerNpvCr: Math.round(vN), passiveNpvCr: Math.round(v0), totalCr: Math.round(total),
      groups: groups, everythingElse: {npvCr: Math.round(pooled), sharePct: Math.round(pooled / den * 1000) / 10}, restCr: Math.round(rest), bars: bars,
      sentences: bars.slice(0, 2).map(sentence), barSentences: bars.map(sentence),
      barsWithWords: bars.map(function (x) { return Object.assign({sentence: sentence(x)}, x); }), powerLaw: absSum > 0 && top2 / absSum >= 0.5 ? 'Two decisions made most of your sixty years. Most decisions barely mattered. That is how big returns work.' : 'No single decision made your sixty years: it was many small ones.',
      top2Share: absSum > 0 ? Math.round(top2 / absSum * 1000) / 10 : 0, checkSum: Math.abs(sumPhi + rest - total) / (Math.abs(total) || 1), runs: method === 'shapley' ? Math.pow(2, n) : n + 2};
  }
  // page 1: the return against the sourced benchmarks
  function returnPage(state) {
    ensure();
    var f = state.final || {}, o = state.over || {}, banks = o.reason === 'banks', ret = f.irr == null ? null : Math.round(f.irr * 1000) / 10;
    return {returnPct: banks ? null : ret, words: banks ? 'Lost' : ret == null ? 'No return yet' : ret + '% a year, for 60 years', banks: banks,
      investedCr: f.investedCr || 0, returnedCr: f.returnedCr || 0, company: state.parent || 'Your company',
      line: (state.parent || 'Your company') + ' put in ' + cr(f.investedCr || 0) + '; ' + cr(f.returnedCr || 0) + ' came back' + (banks ? ' before the banks took control.' : ' over 60 years.'),
      ending: banks ? 'The banks took control in ' + cal(o.year || state.year || 1) + '.' : 'Handed back in ' + cal(60) + '.', benchmarks: benchmarks()};
  }
  // page 3: the player's own front pages, each with the decision that caused it
  function papers(state) {
    return (state.papers || []).slice().sort(function (a, b) { return a.chapter - b.chapter; }).map(function (p) {
      return {chapter: p.chapter, name: CHAPTERS[p.chapter] ? CHAPTERS[p.chapter].name : '', calYear: p.calYear, lead: p.lead, dateLine: p.dateLine, light: p.light, line: p.cause + ', ' + p.calYear + '.'};
    });
  }
  // page 4a, the first three lines (design/debrief.md §4a): each shown only when its evidence is there, with the evidence
  function profile(state, attr) {
    ensure();
    attr = attr || attribution(state);
    var s = state.s, by = {}; attr.groups.forEach(function (g) { by[g.group] = g; });
    var share = function (k) { return by[k] ? by[k].sharePct : 0; }, out = [];
    var eng = simulate(Object.assign(clone(s), {}), 60), firstDiv = null;
    eng.rows.forEach(function (r) { if (firstDiv == null && (r.div || 0) > 1) firstDiv = r.year; });
    var built = (s.decisions || []).filter(function (d) { return d.group === 'plan30' && d.chosen === 'adopt' && d.id !== 'ch7-l5'; });
    if (built.length && share('plan30') > 0 && (firstDiv == null || firstDiv > 20))
      out.push({id: 'allocator', line: 'A capital allocator. You put money where it compounded.', evidence: andList(built.map(function (d, i) { return i ? d.label.charAt(0).toLowerCase() + d.label.slice(1) : d.label; })) + ' in ' + cal(CH7.year) + ' (+' + Math.round(share('plan30')) + '%); ' + (firstDiv ? 'took no dividends before ' + cal(firstDiv) : 'took no dividends') + '.'});
    var played = (s.shiftLog || []).filter(function (x) { return !x.auto; }), all = s.shiftLog || [];
    var otp = all.length ? all.reduce(function (a, x) { return a + x.otp; }, 0) / all.length : 0;
    if (all.length && share('shifts') >= 0 && otp >= 0.85)
      out.push({id: 'operator', line: 'An operator. Your shifts made money.', evidence: '3★ in ' + all.filter(function (x) { return x.stars >= 3; }).length + ' of ' + all.length + ' shifts' + (played.length < all.length ? ' (' + (all.length - played.length) + ' played by the engine)' : '') + '; ' + Math.round(otp * 100) + '% on time.'});
    var risky = [];
    if (s.bid.type === 'share' && s.bid.value > MEDIAN_BID) risky.push('bid ' + s.bid.value + '% when ' + MEDIAN_BID + '% had an even chance');
    if (s.gearing >= 0.72) risky.push('borrowed ' + Math.round(s.gearing * 100) + '%');
    if (s.lender === 'dollar') risky.push('borrowed in dollars');
    if (risky.length) {
      var rs = share('finance') + share('bid');
      if (rs > 0) out.push({id: 'risk-right', line: 'A risk-taker, and right about it.', evidence: risky.join('; ').replace(/^./, function (c) { return c.toUpperCase(); }) + ': it still made ' + Math.round(rs) + '%.'});
      else if (rs < 0) out.push({id: 'risk-cost', line: 'A risk-taker, and it cost you.', evidence: risky.join('; ').replace(/^./, function (c) { return c.toUpperCase(); }) + ': it cost ' + Math.abs(Math.round(rs)) + '%.'});
    }
    if (!out.length) out.push({id: 'defaults', line: 'The airport mostly ran on its defaults. Next time, try a decision that scares you.', evidence: ''});
    out.forEach(function (l) { var i = l.line.indexOf('. '); l.title = i > 0 ? l.line.slice(0, i + 1) : l.line; l.text = i > 0 ? l.line.slice(i + 2) : ''; });
    return out;
  }
  // page 4b: Peter Thiel's seven questions (Zero to One, ch. 13 "Seeing Green"), each answered in one line from the concession
  var POOL = 20000;   // (est.) the game's India-to-world connecting passengers a day at year 30, the market a hub can win
  function thiel(state) {
    ensure();
    var s = state.s || {}, dec = {}; (s.decisions || []).forEach(function (d) { dec[d.id] = d.chosen; });
    var net = s.network, partner = dec['ch5-partner'], dests = partner === 'three' ? 3 : partner === 'london' ? 1 : 0, cities = net === 'anchor' || net === 'two' ? CH5.feeders.length : 0;
    var conns30 = networkPerDay(state, 30), share = Math.round(conns30 / POOL * 100), slip = (state.construction && state.construction.slipMonths) || 0;
    var lean = state.phase1 !== 'big' && dests > 0, collapsed = s.shock && s.shock.kind === 'airline', rivalWon = state.ch7 ? state.ch7.rivalWon : null;
    var mk = function (ok) { return ok ? '✓' : '✗'; }, out = [];
    out.push({q: 'Engineering: is your hub ten times better than the alternative?', mark: mk(cities && dests),
      answer: cities && dests ? 'A ' + CH5.mctMin + '-minute connection against ' + CH5.rival + '\'s ' + CH5.rivalMctMin + ', and ' + (cities * dests) + ' one-stop routes to the world that did not exist.' : cities ? cities + ' cities connected to each other, but no long-haul routes: the world still changes planes in the Gulf.' : 'No bank: flights came, but they were not timed to connect.'});
    out.push({q: 'Timing: did you build when the traffic came?', mark: mk(!slip && !lean),
      answer: (slip ? 'Opened ' + slip + ' months late. ' : 'Opened on time. ') + (lean ? 'Built lean: widebodies waited for stands when ' + CH5.partner + ' came.' : 'There was a stand for every widebody.')});
    out.push({q: 'Monopoly: do you own a big share of a small market first?', mark: mk(share >= 25),
      answer: 'About ' + conns30.toLocaleString('en-IN') + ' connections a day in ' + cal(30) + ': ' + share + '% of the India-to-world connecting market in this game.'});
    var people = [];
    if (partner && partner !== 'decline') people.push(CH5.partner + (dec['ch5-hold'] === 'letgo' ? ' stayed, but cut a London flight' : ' stayed'));
    if (net && net !== 'cut') people.push(collapsed ? NM.feeder + ' stopped flying in ' + cal(CH6.year) : NM.feeder + ' kept feeding the bank');
    if (s.plateauTrust != null) people.push(NM.plateau + (s.plateauTrust >= CH3.trustLine ? ' trusted you' : ' kept its distance'));
    out.push({q: 'People: did your partners stay?', mark: mk(people.length >= 2 && !collapsed && s.plateauTrust >= CH3.trustLine), answer: (people.join('; ') || 'You signed no partners') + '.'});
    out.push({q: 'Distribution: how many cities feed you?', mark: mk(cities >= CH5.feeders.length && !collapsed),
      answer: cities ? cities + ' cities signed in ' + cal(CH4.year) + (collapsed ? '; the bank came back at about 60% after ' + NM.feeder + ' stopped.' : ', still feeding at the handback.') : 'None signed: every airline flew its own timetable.'});
    out.push({q: 'Durability: will this still be your market in year 60?', mark: mk(rivalWon === false),
      answer: rivalWon == null ? 'Not tested: the concession ended first.' : rivalWon ? poss(NM.rival) + ' Hyderabad hub took some of your banks: your network was thin.' : poss(NM.rival) + ' Hyderabad hub never filled its banks.'});
    out.push({q: 'Secret: did you act on something few believed?', mark: mk(cities && dests && dec['ch5-hold'] === 'hold'),
      answer: net === 'cut' ? 'You cut charges, the obvious move, and Dubai matched it within a year.' : cities && dests && dec['ch5-hold'] === 'hold' ? 'You built banks and paid to hold connections when cutting charges was the obvious move.' : 'You built a bank, but stopped short of holding it together.'});
    return out;
  }
  // the four pages as ZMMoney.debrief takes them: {return, attribution, papers, profile, thiel} (design/debrief.md §6)
  function pages(state, opts) {
    ensure();
    var a = attribution(state, opts), rp = returnPage(state), pa = papers(state), pr = profile(state, a), th = thiel(state), f = state.final || {}, mo = onceLine(state);
    rp.valueCr = f.banks ? 0 : (f.residualCr != null ? f.residualCr : 0);   // what the player's stake was worth at the handback (the cash left, its share)
    var o = state.over || {}, banks = o.reason === 'banks';
    // the Black Box screen's names (money/CONTRACT.md on s0b-ui)
    var p1 = {returnPct: rp.returnPct, words: rp.words, moneyInCr: rp.investedCr, moneyOutCr: rp.returnedCr, valueCr: rp.valueCr, line: rp.line, company: rp.company,
      ended: banks ? 'banks' : 'handback', endedYear: banks ? cal(o.year || state.year || 1) : cal(60),
      endedOn: banks ? cal(o.year || state.year || 1) + String(state.signedOn || '2026-04-01').slice(4) : (state.endsOn || null), endedWords: rp.ending,
      benchmarks: rp.benchmarks.map(function (b) { return {id: b.id, label: b.label, pct: b.pct, year: b.year, source: b.source, url: b.source, cite: b.cite, key: b.key}; })};
    a.bars = a.barsWithWords;
    var p2 = {method: a.method, words: a.words, bars: a.bars.map(function (b) { return {decision: b.group, label: b.label, chosen: b.chosen, npvCr: b.npvCr, sharePct: b.sharePct, sentence: b.sentence}; }),
      everythingElsePct: a.everythingElse.sharePct, everythingElseCr: a.everythingElse.npvCr, closing: a.powerLaw, sentences: a.sentences, totalCr: a.totalCr, checkSum: a.checkSum, groups: a.groups};
    var p3 = {frontPages: pa.map(function (x) { return {chapter: x.chapter, name: x.name, year: x.calYear, lead: x.lead, dateLine: x.dateLine, line: x.line, light: x.light}; }), once: mo};
    var p4 = {lines: pr.map(function (l) { return {id: l.id, title: l.title, line: l.text, evidence: l.evidence}; }), thiel: th};
    return {p1: p1, p2: p2, p3: p3, p4: p4,
      'return': rp, attribution: a, papers: pa, profile: pr, thiel: th, moment: mo,
      company: state.parent || 'Your company', founder: state.founder || '', signature: state.signature || null, signedOn: state.signedOn || null, endsOn: state.endsOn || null};
  }
  // page 3's last line: "Every moment happens once" (Zero to One, ch. 1), about the one shift that happens once per concession
  function onceLine(state) {
    var r = state.ch3 && state.ch3.result;
    return r && r.otp != null ? 'Opening day happened once. You ran it at ' + Math.round(r.otp * 100) + '% on time.' : 'Every moment in business happens only once.';
  }
  function debriefAll(state, opts) { var a = attribution(state, opts); return {returnPage: returnPage(state), attribution: a, papers: papers(state), profile: profile(state, a)}; }
  var debrief = {benchmarks: benchmarks, attribution: attribution, returnPage: returnPage, papers: papers, profile: profile, thiel: thiel, pages: pages, all: debriefAll, groups: function (st) { ensure(); return groupPatches(st); }};

  function chApi(n, o) {
    return Object.assign({chapter: n, eras: CH_ERAS[n].slice(), start: function (save, opts) { return chStart(n, save, opts); }, fixture: function (opts) { return chFixture(n, opts); },
      card: function (v) { return ch5Card(n, v); }}, o);
  }
  var ch3 = chApi(3, {frontPage: ch3FrontPage, decision: ch3Decision, applyDecision: ch3ApplyDecision, briefing: ch3Briefing, shiftPlan: ch3ShiftPlan, applyShift: ch3ApplyShift,
    script: {plans: CH3.plans, trustLine: CH3.trustLine}});
  var ch4 = chApi(4, {frontPage: ch4FrontPage, decision: ch4Decision, applyDecision: ch4ApplyDecision, briefing: ch4Briefing, shiftPlan: ch4ShiftPlan, applyShift: ch4ApplyShift,
    budget: ch4Budget, applyBudget: ch4ApplyBudget, script: {nets: CH4.nets}});
  var ch6 = chApi(6, {start: ch6Start, fixture: ch6Fixture, pick: ch6Pick, frontPage: ch6FrontPage, decision: ch6Decision, applyDecision: ch6ApplyDecision, briefing: ch6Briefing,
    shiftPlan: ch6ShiftPlan, applyShift: ch6ApplyShift, notice: ch6Notice, card: function (v) { return ch6Card(v); }, script: {kinds: Object.keys(CH6.kinds)}});
  var ch7 = chApi(7, {start: ch7Start, fixture: ch7Fixture, frontPage: ch7FrontPage, decision: ch7Decision, applyDecision: ch7ApplyDecision, briefing: ch7Briefing,
    shiftPlan: ch7ShiftPlan, applyShift: ch7ApplyShift, script: {threshold: CH7.threshold}});

  ch5.chapter = 5; ch5.eras = CH_ERAS[5].slice();
  // the press conference's headline goes on the next front page: Chapter 5's after Climb's, Chapter 7's after Turbulence's
  // (Takeoff's and Cruise's go on the cliffhanger)
  [ch5, ch7].forEach(function (C) { var f0 = C.frontPage; C.frontPage = function (st) { return pressFront(f0.apply(null, arguments), st && pressColumn(st, C.chapter - 1)); }; });
  var cliffhanger0 = cliffhanger;
  cliffhanger = function (st, act) { act = act || actBreak(st) || 1; return pressFront(cliffhanger0(st, act), st && pressColumn(st, act === 1 ? 3 : 5)); };
  var API = {
    ch3: ch3, ch4: ch4, ch5: ch5, ch6: ch6, ch7: ch7, chapters: {3: ch3, 4: ch4, 5: ch5, 6: ch6, 7: ch7}, bridge: bridge, debrief: debrief, cliffhanger: cliffhanger, actBreak: actBreak,
    press: press,
    data: function (md) { load(md); _closeCache = {}; return API; },
    capexCr: capexCr, phase1Options: phase1Options, stateLoanOpt: stateLoanOpt, lenders: lenderOptions, partners: partners, bidTypes: bidTypes,
    previewBid: previewBid, previewClose: previewClose, bidOpening: bidOpening, bidRivals: bidRivals, privateHouses: privateHouses, pitchPrivate: pitchPrivate, _tender: {BIDDERS: BIDDERS, reset: function () { _ceil = null; }, ceilings: function () { return rivalCeilings(); }},
    newCampaign: newCampaign, needsConstruction: needsConstruction, constructionOpts: constructionOpts, applyConstruction: applyConstruction,
    levelFor: levelFor, applyShift: applyShift, boardOptions: boardOptions, applyBoard: applyBoard,
    isOver: isOver, endOpts: endOpts, handbackOpts: handbackOpts, acPlan: acPlan,
    fmtDate: function (iso) { ensure(); return fmtDate(iso); }, campaignDocs: campaignDocs, fileCard: fileCard, asBill: asBill,
    resumable: resumable, recordOf: recordOf, chapter: chapter, endBill: endBill, advance: advance, SAVE_VERSION: SAVE_VERSION,
    // for tests and bots
    _internal: {simulate: simulate, sizeDebt: sizeDebt, shiftOps: shiftOps, opsProfile: function (n, y) { ensure(); return opsProfile(n, y); }, eraYears: eraYears, irr: irr, P: function () { ensure(); return P; },
      playerFlows: playerFlows, companyFlows: companyFlows, networkPerDay: networkPerDay, applyPatch: applyPatch, sizeMemo: sizeMemo}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.VSIEra = API;
})(this);
