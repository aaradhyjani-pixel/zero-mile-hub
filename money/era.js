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
    P.ev_multiple = (J('world.game_stake_pricing') || {}).base_multiple || 12;
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
      var y = this.yields[t] || 0, demand = c.demand(t), f = 1;
      if (demand > 0 && y > 0) { var norm = P.yield_market_norm * pr, fare = P.avg_fare * pr; f = Math.min(1, Math.pow(1 + (y - norm) / fare, -P.demand_elasticity)); }
      var pax = demand > 0 ? Math.min(demand * f, P.capacity_headroom * cap) : 0;
      if (c.pax_factor) pax *= c.pax_factor(t);   // a part-year opening (construction slip of under 12 months)
      var acI = c.nar_extra ? c.nar_extra(t) : 0;   // Airport City income (non-aero)
      var billed = y * pax / 10, aero = billed * (1 - ops.sq), nar = c.nar(t) * pax / 10 + acI;
      var opex_b = c.opex_bench(t, cap, pax);
      var dis = Math.max(0, ops.dis - c.dis_in_opex);
      var opening = c.opening_cost(t);
      var opex = pax > 0 ? opex_b * ops.opex + dis * pr * pax / 10 + opening + P.ac.opex_share * acI : 0;
      // dollar bonds: the rupee falls, so what is owed (in rupees) grows by the fall
      if (c.fx && t === c.fx.t) {
        var hit = 0;
        c.tranches.forEach(function (tr) {
          if (c.fx.names.indexOf(tr.name) < 0 || tr.out <= 0) return;
          var add = tr.out * c.fx.fall; tr.out += add; hit += add;
          if (tr.sched) Object.keys(tr.sched).forEach(function (k) { if (+k >= t) tr.sched[k] *= 1 + c.fx.fall; });
        });
        if (hit > 0) this.events.push({t: t, k: 'fx', amt: hit, fall: c.fx.fall});
      }
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
        dis: dis * pr * pax / 10, fee: fee, ebitda: ebitda, interest: interest, principal: prin, ds: ds, dep: dep, tax: tax, renew: renew,
        cfads: cfads, dscr: ds > 1e-6 ? cfads / ds : null, debt: 0, bal: this.bal, sq: ops.sq};
      row.debt = c.tranches.reduce(function (s, x) { return s + x.out; }, 0);
      this.waterfall(t, row);
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
    var free = row.cfads - row.ds + cash_int, cure = 0, cash = this.cash, unfunded = false;
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
    var flow = -call - cure + (this.step_in ? 0 : div);
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
      nar_extra: acInc, pax_factor: frac > 0 ? function (t) { return t + 1 === yOpen ? 1 - frac : 1; } : null,
      fx: (!base && lenderOf(s).fx) ? {t: lenderOf(s).fx.year - 1, fall: lenderOf(s).fx.fall, names: names.filter(function (n) { var k = stageKey(n); return k === '1A' || k === '1B'; })} : null,
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
      m.lines.forEach(function (l) { if (/sla|care|fuel/.test(l.key || '')) c += Math.abs(l.amount || 0); });
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
    var co = (cfg.coinvestor && cfg.coinvestor.name) || 'L5 Capital: Lagrange Point Infrastructure Fund';
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
    var sl = o.state_loan != null ? o.state_loan : o.stateLoan;   // onboarding hands back stateLoan
    return {gearing: g, phase1: o.phase1 === 'big' ? 'big' : 'lean', state_loan: sl !== false, defer_state_loan: o.defer_state_loan !== false,
      lender: P.lenders[o.lender] ? o.lender : 'banks', construction: null, ac_year: null,
      profile: (o.repayment === 'equal' || o.profile === 'equal') ? 'equal' : 'sculpt', bid: {type: bid.type === 'ppf' ? 'ppf' : 'share', value: +bid.value},
      stance0: o.aera === 'hard' ? 'hard' : 'normal', refi: o.refi !== false, cure: !!o.cure, p2year: o.p2year || null, eraOps: {}, boards: {}, appeals: []};
  }
  // phase 1's cost in today's money (FY2026 prices): lean 45 or big 70 million passengers a year (money.json capex.stages)
  function capexCr(phase1) { ensure(); return P.vsi_stages['1A_' + (phase1 === 'big' ? 'big' : 'lean')].cost; }
  function phase1Options() {
    ensure();
    var L = P.vsi_stages['1A_lean'], B = P.vsi_stages['1A_big'];
    return {def: 'lean', options: [
      {id: 'lean', label: L.cap + ' million passengers a year', small: 'build more when Mumbai and Delhi move in', capexCr: L.cost},
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
      {id: 'infra', who: 'India\'s infrastructure bank', label: 'India\'s infrastructure bank', small: 'about ' + (r + (n.rate_delta || 0)) + '%, repaid over ' + (a.years + (n.years_add || 0)) + ' years, so each payment is smaller'}]};
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
    var winPct = Math.round(100 / (1 + Math.exp(-(se - 16.5) / 1.2)));
    winPct = Math.max(1, Math.min(99, winPct));
    var note = se < 13 ? 'Below what the rivals are likely to offer: you would probably lose the tender.' :
      se < 16 ? 'Close to the rivals. A fair chance, and the airport keeps a healthy share of what it earns.' :
      se < 22 ? 'Likely to win. AAI takes this share of every rupee for 60 years, so the margin is thinner.' :
      'Almost certain to win, but this much to AAI for 60 years leaves little for the loans and for you.';
    if (bid.type === 'ppf') note = 'About ' + se.toFixed(1) + '% of what the airport earns. ' + note;
    return {winPct: winPct, note: note};
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
    var st = {version: 1, building: true, phase1: s.phase1, lender: s.lender, stateLoan: s.state_loan, parent: ob.parent || 'Meridian Infra', founder: ob.founder || '', signature: ob.signature || null,
      signedOn: ob.signedOn || null, endsOn: ob.endsOn || null, quick: !!ob.quick, seed: seed == null ? 1 : seed,
      bid: s.bid, gearing: s.gearing, repayment: s.profile === 'equal' ? 'equal' : 'sculpted',
      era: 1, year: 5, cash: 0, debt: [], stake: 64, history: [], over: false, s: s};
    var eng = simulate(s, 4);
    st.debt = eng.c.tranches.map(function (tr) { return {name: tr.name, outCr: Math.round(tr.out)}; });
    st.cash = Math.round(eng.cash);
    return st;
  }
  function levelFor(state) { var e = state.era || 1; return e <= 4 ? e : 4; /* TODO Ship B: eras 5-12 play Level 5 */ }

  function stakeValue(eng, row) {
    var debt = eng.c.tranches.reduce(function (a, x) { return a + x.out; }, 0);
    var ev = P.ev_multiple * Math.max(0, row ? row.ebitda : 0);
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
      if (eng.plans.some(function (p) { return p.carried > 1 && p.t0 + 1 <= ys[2] && p.t0 + p.n >= ys[1]; })) why.push('AERA is holding back part of your fees while your new Mumbai and Delhi terminals open');
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
    return {eraLabel: label, era: e, years: [ys[1], ys[2]], calendar: [2025 + ys[1], 2025 + ys[2]], light: light,
      coverWorst: worst == null ? null : Math.round(worst * 100) / 100, coverWorstExact: worst, coverWords: coverWords(worst), worstYear: worstRow ? worstRow.year : null,
      todayCr: Math.round(eng.cash), cashCr: Math.round(eng.cash), stakePct: state.stake, stakeValueCr: Math.round(sv),
      debtCr: Math.round(eng.c.tranches.reduce(function (a, x) { return a + x.out; }, 0)), returnPerYear: r == null ? null : Math.round(r * 1000) / 10,
      payoutShare: lockShare, sentences: sentences, banksTookControl: bt, incomeStatement: inc,
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
      stakeValueCr: rep.stakeValueCr, ratePct: so > 0 ? Math.round(sr / so * 10) / 10 : null};
    if (rep.banksTookControl || ys[2] >= 60) {
      state.over = rep.banksTookControl ? {reason: 'banks', year: eng.step_in.t + 1} : {reason: 'handback', year: 60};
      state.final = finalOf(state, eng);
    }
    return {state: state, report: rep};
  }
  function finalOf(state, eng) {
    var flows = []; for (var t = 0; t < 60; t++) flows.push(eng.eq_flows[t] || 0);
    var lastRow = eng.rows[eng.rows.length - 1];
    if (!eng.step_in && lastRow) flows[flows.length - 1] += Math.max(0, eng.cash + eng.dsra - lastRow.debt - eng.sl_out);
    var inv = 0, ret = 0; flows.forEach(function (f) { if (f < 0) inv -= f; else ret += f; });
    var r = eng.step_in ? null : irr(flows);
    var paxM = 0, fees = 0, repaidYear = null;
    eng.rows.forEach(function (rw) { paxM += rw.pax; fees += rw.fee; if (repaidYear == null && rw.t >= 4 && rw.debt < 1) repaidYear = rw.year; });
    var residual = eng.step_in || !lastRow ? 0 : Math.max(0, eng.cash + eng.dsra - lastRow.debt - eng.sl_out);
    return {irr: r, investedCr: Math.round(inv * state.stake / 100), returnedCr: Math.round(ret * state.stake / 100), dividendsCr: Math.round(eng.divs * state.stake / 100),
      debtRepaid: !eng.step_in && lastRow && lastRow.debt < 1, banks: !!eng.step_in,
      paxTotalM: Math.round(paxM), paidToStateCr: Math.round(fees), residualCr: Math.round(residual * state.stake / 100), repaidYear: repaidYear,
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
      invest.push({id: 'airport_city', name: 'Build Airport City: hotels, offices and shops on airport land', costCr: 0, opens: ac.opens,
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
      text: hold ? 'AERA plans to hold back part of your passenger fees while the Mumbai and Delhi terminals open, and pay it back later with interest. It is fair over time, but the banks see thinner years now.' :
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
    var pile = [{title: 'Concession Agreement', stamp: 'Executed'}];
    if (state.construction) pile.push({title: 'Construction record', stamp: 'Filed'});
    for (var k = 2; k <= e; k++) pile.push({title: 'Board minutes, era ' + k, stamp: 'Approved'});
    return {era: e + 1, years: (2025 + nx[1]) + '–' + (2025 + nx[2]), year: nextStart, parent: state.parent, parentPct: state.stake, founder: state.founder || undefined,
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
  function endOpts(state) {   // the closing statement (income statement format): the banks' ending, or before the certificate
    var f = state.final || {}, o = state.over || {};
    var banks = o.reason === 'banks';
    var line = banks ? state.parent + ' lost Vikram Sarabhai International to its banks in ' + (2025 + (o.year || 0)) + '. ₹' + Math.round(f.investedCr || 0).toLocaleString('en-IN') + ' crore invested.' :
      state.parent + ' ran Vikram Sarabhai International for 60 years. ₹' + Math.round(f.returnedCr || 0).toLocaleString('en-IN') + ' crore returned on ₹' + Math.round(f.investedCr || 0).toLocaleString('en-IN') + ' crore invested.';
    return {band: banks ? 'The banks took control' : 'Handback · ' + (state.endsOn || '2085'), title: banks ? 'The concession ends early' : 'Sixty years, handed back',
      hero: line, sections: [{title: 'Your company\'s ' + state.stake + '%', rows: [
        {label: 'Money put in', amount: f.investedCr || 0, kind: 'cost'},
        {label: 'Dividends received', amount: f.dividendsCr || 0, kind: 'rev'},
        {label: 'Your return per year', amount: f.irr == null ? 'none' : (f.irr * 100).toFixed(1) + '%', kind: f.irr != null && f.irr > 0.12 ? 'good' : 'bad'},
        {label: 'Bank loans fully repaid', amount: f.debtRepaid ? 'Yes' : 'No', kind: f.debtRepaid ? 'good' : 'bad'}]}],
      moments: [], cta: 'Back to the menu'};
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
  function addMonths(iso, m) {
    var d = iso ? new Date(iso + 'T12:00:00Z') : new Date(Date.UTC(2026, 3, 1, 12));
    if (isNaN(d)) d = new Date(Date.UTC(2026, 3, 1, 12));
    d.setUTCMonth(d.getUTCMonth() + m);
    return d.toISOString().slice(0, 10);
  }
  function monthName(iso) { var d = new Date(iso + 'T12:00:00Z'); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function conFrom(ch) {
    var C = P.con, con = {monsoon: ch.monsoon || null, overrun: ch.overrun || null, trials: ch.trials || null, slipMonths: 0, pay: []};
    if (con.monsoon === 'slip') con.slipMonths += C.monsoon.slip_months; else if (con.monsoon === 'pay') con.pay.push({year: C.monsoon.year, cr: C.monsoon.pay_cr});
    if (con.overrun === 'slip') con.slipMonths += C.overrun.slip_months; else if (con.overrun === 'pay') con.pay.push({year: C.overrun.year, cr: C.overrun.pay_cr});
    if (con.trials === 'full') con.pay.push({year: C.trials.year, cr: C.trials.full_cr});
    return con;
  }
  function conRun(state, ch) {   // era 1 on the bank's forecast, with these construction choices
    var s = clone(state.s); s.construction = ch ? conFrom(ch) : null;
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
    var mp = C.monsoon.pay_cr * pr(C.monsoon.year - 1), op = C.overrun.pay_cr * pr(C.overrun.year - 1), tp = C.trials.full_cr * pr(C.trials.year - 1);
    var sh = conRun(state, {trials: 'short'}), shortCost = sh.dis - base.dis;
    var events = [
      {id: 'monsoon', year: C.monsoon.year, title: 'The monsoon floods the runway site',
        text: 'Three weeks of rain have filled the earthworks for runway 2. The contractor can pump it dry and work nights, or wait for the dry season.',
        options: [{id: 'pay', label: 'Pay for pumps and night shifts', effect: 'The shareholders put in ' + cr(mp) + ' now (your share ' + share(mp) + '), and the airport opens on time.'},
          {id: 'slip', label: 'Wait for the dry season', effect: slipEffect('monsoon', C.monsoon.slip_months)}]},
      {id: 'overrun', year: C.overrun.year, title: 'The Hall roof steel costs more than the contract',
        text: 'Steel prices have risen and the roof contractor wants more money to keep its crews on site. If you also waited out the monsoon, the two delays add up to ' + (C.monsoon.slip_months + C.overrun.slip_months) + ' months.',
        options: [{id: 'pay', label: 'Pay the contractor now', effect: 'The shareholders put in ' + cr(op) + ' now (your share ' + share(op) + '); the airport opens on time and earns it back through its fees over the years.'},
          {id: 'slip', label: 'Renegotiate and slip', effect: slipEffect('overrun', C.overrun.slip_months)}]},
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
    var ch = (result && result.choices) || {}, con = conFrom(ch);
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
    if (f.ac) assets.push('Airport City');
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

  var API = {
    data: function (md) { load(md); _closeCache = {}; return API; },
    capexCr: capexCr, phase1Options: phase1Options, stateLoanOpt: stateLoanOpt, lenders: lenderOptions, partners: partners, bidTypes: bidTypes,
    previewBid: previewBid, previewClose: previewClose,
    newCampaign: newCampaign, needsConstruction: needsConstruction, constructionOpts: constructionOpts, applyConstruction: applyConstruction,
    levelFor: levelFor, applyShift: applyShift, boardOptions: boardOptions, applyBoard: applyBoard,
    isOver: isOver, endOpts: endOpts, handbackOpts: handbackOpts, acPlan: acPlan,
    // for tests and bots
    _internal: {simulate: simulate, sizeDebt: sizeDebt, shiftOps: shiftOps, opsProfile: function (n, y) { ensure(); return opsProfile(n, y); }, eraYears: eraYears, irr: irr, P: function () { ensure(); return P; }}
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.VSIEra = API;
})(this);
