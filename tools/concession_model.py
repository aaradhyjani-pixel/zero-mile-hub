#!/usr/bin/env python3
"""concession_model.py: ZMI's money model, calibrated on BIAL (Bengaluru, Kempegowda).

Pure Python, reads ../money.json and never writes it.

One mechanism, used in two modes:
  backtest  Run the mechanism on BIAL's real inputs (RAB anchors and capex incl. T2, close
            terms, the state loan, the AERA calendar, actual traffic) and compare the model's
            aero yield, EBITDA, margin and DSCR with BIAL's actual path, FY2009-FY2026.
  zmi       ZMI = BIAL scaled (x5 on traffic and full-build capex): EXPERT, BAD and LAZY
            scenarios, the lever sensitivities, and the Delhi-card and Navi-Mumbai-card rows.
  all       Both (default), plus the BIAL-vs-ZMI side-by-side table.

The mechanism, in one place (see Engine.plan_cp, Engine.true_up and Engine.run):
  ARR    = WACC x avg aero RAB + depreciation + allowed aero O&M + tax + concession fee
           - till x non-aero revenue                         (AERA building block, hybrid till)
  yield  = solved once per 5-year control period so that PV(yield x forecast pax)
           = (1 - carry) x (PV(ARR) + true-up brought forward)      (smoothing)
  true-up at the end of each control period: (actual ARR - collections), carried at the WACC
  debt   = per tranche: IDC capitalised, moratorium after COD, repayment sculpted on forecast
           traffic (or equal), a DSRA of two quarters, refinancing after stable years
  DSCR   = CFADS / senior debt service, CFADS = EBITDA - cash tax - renewals (lender basis)
           DSCR_pre = EBITDA / senior debt service (the basis of BIAL's published path)

Every number is either a money.json key (cited by its path) or an entry in PARAMS below,
which has the money.json entry format (value, unit, source, period, estimate, note) so the
money.json owner can move it across unchanged. Calibrated values are computed at run time
from BIAL data (CALIB) and printed with their fit error. There is no revenue multiplier.

usage: python3 tools/concession_model.py [backtest|zmi|all]     (output is markdown)
"""
import json, math, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MJ = json.load(open(os.path.join(ROOT, 'money.json'), encoding='utf-8'))


def J(path):
    """Value of a money.json key, e.g. J('bial.path.pax_m')."""
    node = MJ
    for p in path.split('.'):
        node = node[p]
    return node['value'] if isinstance(node, dict) and 'value' in node else node


def E(value, unit, source, period, estimate, note=''):
    return {'value': value, 'unit': unit, 'source': source, 'period': period, 'estimate': estimate, 'note': note}


# ---------------------------------------------------------------------------------------------
# PARAMS: numbers this model uses that are not (yet) in money.json. Same entry format.
# ---------------------------------------------------------------------------------------------
PARAMS = {
    'cpi_india_fy': E(
        {2009: 9.1, 2010: 12.4, 2011: 10.4, 2012: 8.4, 2013: 10.2, 2014: 9.4, 2015: 5.9, 2016: 4.9,
         2017: 4.5, 2018: 3.6, 2019: 3.4, 2020: 4.8, 2021: 6.2, 2022: 5.5, 2023: 6.7, 2024: 5.4,
         2025: 4.6, 2026: 2.5},
        '% y/y consumer inflation by fiscal year', 'https://www.mospi.gov.in/ (CPI-IW to FY2013, CPI-Combined after); RBI Handbook of Statistics on the Indian Economy, Table "Consumer Price Index"',
        'FY2009-FY2026', True, 'Recalled, not fetched; used only to put BIAL opex and non-aero per pax in FY2026 rupees.'),
    'cpi_forward': E(0.04, 'fraction per year', 'https://rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx (RBI Act s.45ZA inflation target 4% +/-2)',
                     'game years', True, 'Same as design/eras.md game.cpi. ZMI is modelled in nominal rupees, game year 1 = FY2026 prices.'),
    'tax_rate': E(0.2517, 'fraction of PBT', 'https://incometaxindia.gov.in/ (Income Tax Act s.115BAA: 22% + 10% surcharge + 4% cess)',
                  '2019-', False),
    'aero_asset_share': E(J('bial.t2.t2p1_capitalised')['aero_share'], 'fraction of capex that enters the aero RAB',
                          'money.json bial.t2.t2p1_capitalised (AERA Order 11/2021-22 Table 100)', 'FY2023', False,
                          'T2 Ph1 87.66% aero. Applied to every ZMI stage.'),
    'idc_constr_rate': E(J('finance.loan_rate_construction'), '% p.a.', 'money.json finance.loan_rate_construction', 'game', True),
    'demand_elasticity': E(0.8, '-(% change in traffic) / (% change in average fare)',
                           'https://www.iata.org/en/iata-repository/publications/economic-reports/estimating-air-travel-demand-elasticities---by-intervistas/ (InterVISTAS for IATA 2007: national-level price elasticity about -0.8)',
                           '2007', False, 'Applied to the aero charge above the market norm, as a share of the fare. Caps demand at the premise; never raises it.'),
    'avg_fare': E(5200, 'INR per one-way passenger (FY2026 prices)',
                  'https://www.goindigo.in/information/investor-relations.html (IndiGo FY2025 yield ~Rs 4.96 per RPK x ~1,050 km average stage)',
                  'FY2025', True, 'Derived: yield x stage length.'),
    'yield_market_norm': E(606, 'INR aero revenue per passenger (FY2026 prices)', 'money.json bial.path.aero_yield_per_pax (FY2026)',
                           'FY2026', True, "What travellers pay at a mature Indian hub today; the elasticity's reference point."),
    'airline_relations_drag': E(-0.01, 'traffic growth per year (fraction) in a control period where the tariff is pushed hard',
                                'design estimate; precedent: IATA, FIA and BAR objections to BIAL CP3/CP4 (https://www.aera.gov.in/uploads/stack_holder/17841244347199.pdf)',
                                'game', True, 'Airlines add capacity elsewhere when the hub fights for a front-loaded tariff.'),
    'renewal_share': E(0.25, 'renewal capex as a share of depreciation', 'design/eras.md game.renewal_share', 'game', True,
                       'Deducted from CFADS and capitalised into RAB. Not applied in the back-test (BIAL RAB anchors already include it).'),
    'state_loan_terms': E({'cost': 0.0, 'instalments': 20, 'first_year_after_close': 11, 'deferral_years': 10},
                          'BIAL SSA loan terms', 'money.json bial.ssa.state_loan_repayment, bial.ssa.state_loan_deferral, bial.ssa.state_loan_in_wacc',
                          '2005-2028', False, 'Subordinated: paid after senior debt service; not in the senior DSCR. AERA counts it at 0% in the WACC.'),
    'notional_debt_share_wacc': E(J('bial.aera.cp4_wacc')['debt_share'], 'fraction debt in AERA WACC', 'money.json bial.aera.cp4_wacc',
                                  'CP3-CP4', False, 'AERA 48:52 D:E for BIAL CP3 and CP4 (and DIAL CP4).'),
    'coe': E(J('bial.aera.cp4_wacc')['coe'], '% cost of equity', 'money.json bial.aera.cp4_wacc (IIM Bangalore CAPM)', 'CP3-CP4', False),
    'dsra_quarters': E(J('bial.debt.dsra'), 'quarters of senior debt service', 'money.json bial.debt.dsra', 'FY2026', False),
    'refi': E({'rate': J('finance.refi_rate_after_stability'), 'moratorium': J('bial.debt.refi_2025_ncd')['moratorium_years'],
               'tenor': J('bial.debt.refi_2025_ncd')['tenor_years'], 'stable_years': 3, 'stable_dscr': 1.20},
              'refinancing terms', 'money.json finance.refi_rate_after_stability, bial.debt.refi_2025_ncd', 'FY2026', True,
              "BIAL's 2025 AAA NCD: 15 years, 2-year moratorium. Trigger: 3 years after the last mandatory COD with no lender warning (DSCR >= 1.20), as BIAL refinanced 2 years after T2."),
    'ops_profiles': E({
        # Q = Mall realised / potential; dis = disruption cost per pax (2025 Rs); sq = service-quality rebate (share of aero);
        # star = traffic growth bonus per year; opex = O&M efficiency factor (excess over the benchmark is not allowed in ARR).
        'base':   {'Q': 0.95, 'dis': 60, 'sq': 0.01, 'star': 0.0, 'opex': 1.00},
        'expert': {'Q': 0.95, 'dis': 60, 'sq': 0.01, 'star': 0.015, 'opex': 1.00},
        'poor':   {'Q': 0.75, 'dis': 200, 'sq': 0.04, 'star': -0.01, 'opex': 1.06},
        'lazy':   {'Q': 0.80, 'dis': 150, 'sq': 0.05, 'star': -0.03, 'opex': 1.05}},
        'per-era shift outcomes', 'design/eras.md (game.lender_base_case, game.star_growth_bonus); money.json till.sq_rebate_max_of_arr',
        'game', True, 'Stand-ins for what the sample-day shifts report; poor/lazy Q, dis and opex are design estimates.'),
    'zmi_stages': E({
        # base cost in FY2026 crore; spend {game year: share}; cod game year; cap = mppa after COD
        '1A_lean': {'cost': 36000, 'spend': {1: .25, 2: .25, 3: .25, 4: .25}, 'cod': 5, 'cap': 45},
        '1A_big': {'cost': J('capex.zmi_phase1_capex_cr'), 'spend': {1: .25, 2: .25, 3: .25, 4: .25}, 'cod': 5, 'cap': 70},
        '1A+_lean': {'cost': 20000, 'spend': {6: .5, 7: .5}, 'cod': 8, 'cap': 95},
        '1A+_big': {'cost': 25 * J('capex.brownfield_cr_per_added_mppa'), 'spend': {6: .5, 7: .5}, 'cod': 8, 'cap': 95},
        '1B_BOM': {'cost': 24000, 'spend': {9: .5, 10: .5}, 'cod': 11, 'cap': 150},
        '1B_DEL': {'cost': 24000, 'spend': {11: 1 / 3, 12: 1 / 3, 13: 1 / 3}, 'cod': 14, 'cap': 209},
        'P2': {'cost': J('world.game_capacity')['phase2_cost_cr'], 'spend': {19: .5, 20: .5}, 'cod': 21, 'cap': 260}},
        'INR crore (FY2026 prices) / mppa', 'design/eras.md capex.stages; money.json capex.zmi_phase1_capex_cr, capex.brownfield_cr_per_added_mppa, world.game_capacity',
        'game', True,
        '1A = BIAL phase 1; 1A+ = BIAL T1 expansion (FY2014, op year 6); 1B = BIAL T2 (one close, 80:20, 1-yr moratorium after completion, 10-yr repayment) for BOM and DEL.'),
    'zmi_loan_terms': E({
        '1A': {'rate': J('finance.loan_rate_base'), 'mor': 2, 'years': 14},
        '1A+': {'rate': J('finance.loan_rate_base'), 'mor': 1, 'years': 15},
        '1B': {'rate': J('finance.loan_rate_base'), 'debt_share': 0.80, 'rep_start': 16, 'years': 10},
        'P2': {'rate': J('finance.loan_rate_base'), 'debt_share': 0.80, 'mor': 1, 'years': 10}},
        'rate % / years', 'money.json finance.loan_rate_base; bial.close.moratorium_after_cod_years (2, inferred); bial.t2.financial_close (80:20, 1 + 10 years)',
        'game', True, '1A: 4 years building + 2 moratorium + 14 repaying = 20 years door to door.'),
    'bial_cp1_order': E({'return': 1107.45, 'opex': 1399.60, 'wc_interest': 19.41, 'depreciation': 789.23, 'tax': 32.64,
                         'nar_40pct': -367.40, 'arr': 2980.94, 'pax_m': [12.7, 12.0, 12.9, 14.4, 16.0],
                         'aero_rev_planned': [475.23, 463.11, 488.19, 698.87, 824.22]},
                        'INR crore over CP1 FY2012-16 / m pax', 'https://aera.gov.in/uploads/airports/5b1f90079005ao081415.pdf (Order 08/2014-15, Table 101, p.505)',
                        'CP1 FY2012-FY2016', False,
                        "40% shared revenue till. O&M is the whole airport's (the till deducts 40% of non-regulated revenue), unlike CP3's aero-allocated O&M."),
    'aera_useful_life_2018': E('assets commissioned from FY2018 depreciate over longer AERA useful lives', 'rule',
                               'AERA Order 35/2017-18 (determination of useful life of airport assets), https://aera.gov.in/',
                               'FY2018-', True, 'Order number recalled, not re-fetched. The model fits one life to pre-FY2018 assets (CP1 depreciation) and one to later assets (CP3 depreciation).'),
}
P = {k: v['value'] for k, v in PARAMS.items()}

CALIB = {}   # filled by calibrate(): dep_life, opex_fixed_per_mppa, opex_per_pax, aero_opex_share, tax_share


# ---------------------------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------------------------
def irr(flows):
    def npv(r):
        return sum(f / (1 + r) ** i for i, f in enumerate(flows))
    lo, hi = -0.5, 1.0
    if npv(lo) * npv(hi) > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(lo) * npv(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def bial_price_index():
    """CPI index by FY with FY2026 = 1.0."""
    cpi = P['cpi_india_fy']
    idx = {2026: 1.0}
    for fy in range(2025, 2004, -1):
        idx[fy] = idx[fy + 1] / (1 + cpi.get(fy + 1, 5.0) / 100)
    return idx


class Tranche:
    """A senior loan. Interest before cap_until is funded by the draws (IDC), not debt service."""

    def __init__(self, name, rate, draws=None, out=0.0, cap_until=0, cap_frac=None, rep_start=None,
                 rep_years=10, profile='sculpt', weights=None):
        self.name, self.rate, self.draws, self.out = name, rate, draws or {}, out
        self.cap_until, self.cap_frac = cap_until, cap_frac or {}
        self.rep_start, self.rep_years, self.profile, self.weights = rep_start, rep_years, profile, weights
        self.sched = None

    def r(self, t):
        return self.rate(t) if callable(self.rate) else self.rate

    def build_schedule(self, t0):
        n, r, D = self.rep_years, self.r(t0) / 100, self.out
        if D <= 0:
            self.sched = {}
            return
        if self.profile == 'equal':
            a = D * r / (1 - (1 + r) ** -n)
            o, s = D, {}
            for k in range(n):
                p = a - o * r if k < n - 1 else o
                s[t0 + k] = p
                o -= p
            self.sched = s
            return
        w = [max(1e-9, self.weights(t0 + k)) for k in range(n)]

        def run(c):
            o, s = D, {}
            for k in range(n):
                p = max(0.0, c * w[k] - o * r)
                p = min(p, o)
                s[t0 + k] = p
                o -= p
            return o, s
        lo, hi = 0.0, 10 * D / sum(w)
        for _ in range(100):
            mid = (lo + hi) / 2
            if run(mid)[0] > 0:
                lo = mid
            else:
                hi = mid
        o, s = run(hi)
        s[t0 + n - 1] += o
        self.sched = s

    def step(self, t):
        """Returns (interest expensed, principal)."""
        d = self.draws.get(t, 0.0)
        cap = 1.0 if t < self.cap_until else self.cap_frac.get(t, 0.0)
        interest = self.r(t) / 100 * (self.out + d / 2)
        self.out += d
        if self.rep_start is not None and t == self.rep_start and self.sched is None:
            self.build_schedule(t)
        prin = min(self.out, self.sched.get(t, 0.0)) if self.sched else 0.0
        self.out -= prin
        return interest * (1 - cap), prin

    def prepay(self, amt):
        amt = min(amt, self.out)
        if amt <= 0:
            return 0.0
        if self.sched:
            rest = sum(v for v in self.sched.values())
            f = (self.out - amt) / self.out if self.out else 0
            self.sched = {k: v * f for k, v in self.sched.items()}
        self.out -= amt
        return amt


class Vintage:
    """An asset vintage: gross amount (total and aero), COD year, in-service fraction in the COD year, life.
    plans = {cp_start: (cod, frac, aero)}: how the regulator saw this asset when it planned that control period."""

    def __init__(self, gross, aero, cod, frac=1.0, life=None, plans=None):
        self.gross, self.aero, self.cod, self.frac, self.life = gross, aero, cod, frac, life
        self.plans = plans or {}

    def path(self, t, life, plan=None, aero=True):
        """(avg net value, depreciation) in year t; plan = start year of the control period being planned."""
        life = self.life or life
        c, f, a = self.plans.get(plan, (self.cod, self.frac, self.aero)) if plan is not None else (self.cod, self.frac, self.aero)
        g = a if aero else self.gross * (a / self.aero if self.aero else 1.0)
        if t < c or g <= 0:
            return 0.0, 0.0
        d = g / life
        if t == c:
            dep = d * f
            return g * f - dep / 2, dep
        opened = g - d * f - d * (t - c - 1)
        if opened <= 0:
            return 0.0, 0.0
        dep = min(opened, d)
        return opened - dep / 2, dep


# ---------------------------------------------------------------------------------------------
# The engine: one year at a time
# ---------------------------------------------------------------------------------------------
class Engine:
    """cfg keys: T, label(t), price(t), cps [ {start, n, wacc(t) or float, till, carry, esc, lag[], fc_factor,
    tu_wacc, tu_till} ], vintages, tranches, demand(t), fc_pax(t), cap(t), nar_pp(t) nominal Rs, opex(t, cap, pax),
    opex_bench(t, cap, pax), fee, levers{...}, events{t: crore}, yield0, card(t) (fixed tariff, no building block),
    era(t), state_loan{...}, stages (zmi), equity_calls{t: cr}"""

    def __init__(self, cfg):
        self.c = cfg
        self.L = CALIB['dep_life']
        self.rows = []
        self.bal = 0.0           # true-up brought forward (+ = under-recovery owed to the airport)
        self.yields = {}
        self.plans = []
        self.trueups = []
        self.cash = 0.0
        self.dsra = 0.0
        self.losses = 0.0
        self.step_in = None
        self.refi_done = 0
        self.eq_flows = {}
        self.cures = 0.0
        self.divs = 0.0
        self.sl_out = (cfg.get('state_loan') or {}).get('amount', 0.0)
        self.sl_paid_t = {}
        self.bad_eras = 0
        self.dsra_target_next = 0.0

    # --- regulator ---------------------------------------------------------------------------
    def rab(self, t, plan=None):
        avg = dep = 0.0
        for v in self.c['vintages']:
            a, d = v.path(t, self.L, plan)
            avg += a
            dep += d
        return avg, dep

    def dep_total(self, t):
        return sum(v.path(t, self.L, None, aero=False)[1] for v in self.c['vintages'])

    def wacc(self, cp, t):
        w = cp['wacc']
        return w(t) if callable(w) else w

    def building_block(self, t, wacc, till, pax, nar, opex_allowed, plan, parts=None):
        avg, dep = self.rab(t, plan)
        ret = wacc / 100 * avg
        bb = ret * (1 + CALIB['tax_share']) + dep + opex_allowed - till * nar
        fee = self.c['fee'] if self.c.get('fee_in_arr', True) else 0.0
        if parts is not None:
            for k, v in (('rab', avg), ('return', ret), ('tax', ret * CALIB['tax_share']), ('dep', dep),
                         ('opex', opex_allowed), ('nar_ded', -till * nar), ('fee', bb / (1 - fee) * fee)):
                parts[k] = parts.get(k, 0.0) + v
        return bb / (1 - fee), avg, dep

    def plan_cp(self, cp, t0):
        n, wacc = cp['n'], self.wacc(cp, t0)
        v = 1 / (1 + wacc / 100)
        arr, paxf, parts = [], [], {}
        for k in range(n):
            t = t0 + k
            pf = cp['fc_list'][k] if 'fc_list' in cp else self.c['fc_pax'](t) * cp.get('fc_factor', 1.0)
            paxf.append(pf)
            cap = self.c['cap'](t)
            opex_allow = cp.get('opex_share', CALIB['aero_opex_share']) * self.c['opex_bench'](t, cap, pf)
            nar = self.c['nar_bench'](t) * pf / 10
            a, _, _ = self.building_block(t, wacc, cp['till'], pf, nar, opex_allow, plan=t0, parts=parts)
            arr.append(a)
        pv_arr = sum(a * v ** k for k, a in enumerate(arr))
        target = (1 - cp['carry']) * pv_arr + self.bal     # carry part of this period's ARR; recover the whole true-up
        lag = cp.get('lag', [0] * n)
        # before the order takes effect the old tariff runs on: the previous order, or (BIAL) the tariff actually charged
        old = self.c.get('old_yield') or (lambda t: self.yields.get(t0 - 1, 0.0))
        y_old = [old(t0 + k) for k in range(n)]
        known = sum(lag[k] * y_old[k] * paxf[k] / 10 * v ** k for k in range(n))
        unit = sum((1 - lag[k]) * (1 + cp['esc']) ** k * paxf[k] / 10 * v ** k for k in range(n))
        y0 = max(0.0, (target - known) / unit) if unit > 0 else 0.0
        for k in range(n):
            new = y0 * (1 + cp['esc']) ** k
            self.yields[t0 + k] = lag[k] * y_old[k] + (1 - lag[k]) * new
        self.plans.append({'t0': t0, 'label': self.c['label'](t0), 'wacc': wacc, 'arr': arr, 'pv_arr': pv_arr, 'parts': parts,
                           'pax_f': sum(paxf), 'target': target,
                           'bal_in': self.bal, 'y0': y0, 'yields': [self.yields[t0 + k] for k in range(n)],
                           'ypp': sum(arr) / sum(paxf) * 10})
        cp['_acc'] = []

    def true_up(self, cp, t_end):
        wacc = cp.get('tu_wacc', self.wacc(cp, t_end))
        till = cp.get('tu_till', cp['till'])
        v = 1 / (1 + wacc / 100)
        pv = self.bal
        parts, arr_tot, coll_tot = {}, 0.0, 0.0
        for k, (t, pax, nar, opex_allow, coll) in enumerate(cp['_acc']):
            a, _, _ = self.building_block(t, wacc, till, pax, nar, opex_allow, plan=None, parts=parts)
            pv += (a - coll) * v ** k
            arr_tot += a
            coll_tot += coll
        self.bal = pv * (1 + wacc / 100) ** cp['n']
        self.trueups.append({'label': self.c['label'](t_end), 'value': self.bal, 'parts': parts, 'arr': arr_tot, 'coll': coll_tot})

    # --- the year -----------------------------------------------------------------------------
    def run(self):
        c, lv = self.c, self.c.get('levers', {})
        cps = {cp['start']: cp for cp in c.get('cps', [])}
        active = None
        for t in range(c['T']):
            if self.step_in is not None:
                break
            if t in cps:
                active = cps[t]
                if not c.get('card'):
                    self.plan_cp(active, t)
            pr = c['price'](t)
            cap = c['cap'](t)
            # traffic
            y = c['card'](t) if c.get('card') else self.yields.get(t, 0.0)
            demand = c['demand'](t)
            if demand > 0 and lv.get('elasticity', True) and y > 0:
                norm, fare = P['yield_market_norm'] * pr, P['avg_fare'] * pr
                f = min(1.0, (1 + (y - norm) / fare) ** -P['demand_elasticity'])
            else:
                f = 1.0
            pax = min(demand * f, c.get('headroom', 1.1) * cap) if demand > 0 else 0.0
            if c.get('pax_actual'):
                pax = c['pax_actual'](t)
            ops = lv.get('ops', {'Q': 1, 'dis': 0, 'sq': 0, 'opex': 1})
            # revenue
            billed = y * pax / 10
            aero = billed * (1 - ops['sq']) + c.get('events', {}).get(t, 0.0)
            nar = c['nar'](t) * pax / 10
            opex_b = c['opex_bench'](t, cap, pax)
            opex = opex_b * ops['opex'] + ops['dis'] * pr * pax / 10 if pax > 0 else 0.0
            fee = c['fee'] * (aero + nar)
            oi = aero + nar
            ebitda = oi - opex - fee
            if active is not None and not c.get('card') and pax > 0:
                active['_acc'].append((t, pax, nar, active.get('opex_share', CALIB['aero_opex_share']) * min(opex, opex_b),
                                       billed + c.get('events', {}).get(t, 0.0)))
            # debt
            interest = prin = 0.0
            for tr in c['tranches']:
                i, p = tr.step(t)
                interest += i
                prin += p
            ds = interest + prin
            dep = self.dep_total(t)
            renew = P['renewal_share'] * dep if c.get('renewals') else 0.0
            if renew:
                c['vintages'].append(Vintage(renew, renew * P['aero_asset_share'], t + 1))
            pbt = ebitda - dep - interest
            if pbt < 0:
                self.losses += -pbt
                tax = 0.0
            else:
                use = min(self.losses, pbt)
                self.losses -= use
                tax = P['tax_rate'] * (pbt - use)
            cfads = ebitda - tax - renew
            dscr = cfads / ds if ds > 1e-6 else None
            dscr_pre = ebitda / ds if ds > 1e-6 else None
            row = {'t': t, 'label': c['label'](t), 'pax': pax, 'demand': demand, 'cap': cap, 'yield': y,
                   'aero': aero, 'nar': nar, 'oi': oi, 'opex': opex, 'fee': fee, 'ebitda': ebitda,
                   'margin': ebitda / oi if oi > 0 else None, 'interest': interest, 'principal': prin, 'ds': ds,
                   'dep': dep, 'tax': tax, 'cfads': cfads, 'dscr': dscr, 'dscr_pre': dscr_pre,
                   'debt': sum(tr.out for tr in c['tranches']), 'bal': self.bal}
            if c.get('waterfall'):
                self.waterfall(t, row)
            self.rows.append(row)
            if active is not None and t == active['start'] + active['n'] - 1 and not c.get('card'):
                self.true_up(active, t)
            if c.get('refi_rule'):
                c['refi_rule'](self, t)
        return self

    # --- cash: DSRA, state loan, equity, lock-up, cure, step-in (ZMI only) -----------------------
    def waterfall(self, t, row):
        c, lv = self.c, self.c['levers']
        eq = c['equity_need'].get(t, 0.0)            # equity share of capex this year (after the state loan)
        dsra_target = P['dsra_quarters'] / 4 * self.next_ds(t)
        cash = self.cash + row['cfads'] - row['ds']
        cure = 0.0
        # DSRA: draw if short, else top up
        if cash < 0:
            draw = min(self.dsra, -cash)
            self.dsra -= draw
            cash += draw
        if cash < 0:
            if lv.get('cure'):
                cure += -cash
                cash = 0.0
            else:
                self.step_in = (t, 'unfunded debt service')
        top = max(0.0, min(cash, dsra_target - self.dsra))
        self.dsra += top
        cash -= top
        # state loan instalment (subordinated)
        sl = c.get('state_loan')
        if sl and self.sl_out > 0 and t >= sl['first_t'] + (sl['defer'] if lv.get('defer_state_loan') and t >= sl['defer_from'] else 0):
            inst = min(self.sl_out, sl['amount'] / sl['n'], max(0.0, cash))
            self.sl_out -= inst
            cash -= inst
        # capex equity: from retained cash first, the rest is called
        from_cash = min(max(0.0, cash), eq) if lv.get('fund_from_cash', True) else 0.0
        cash -= from_cash
        call = eq - from_cash
        # distributions under the lock-up
        div = prep = 0.0
        d = row['dscr']
        if d is not None and cash > 0 and t >= lv.get('retain_until', 0) and not self.in_build(t):
            lk = J('finance.distribution_lockup')
            share = 0.0 if d < lk['nil_below'] else 0.5 if d < lk['half_below'] else 0.75 if d < lk['three_quarters_below'] else 1.0
            if d < J('finance.dscr_covenant_min'):
                prep = cash                                   # cash sweep below the covenant
            else:
                out = cash * share
                prep = out * lv.get('prepay_share', 0.0)
                div = out - prep
            for tr in sorted(self.c['tranches'], key=lambda x: -x.out):
                prep_left = prep
                if prep_left <= 0:
                    break
                prep -= tr.prepay(prep_left)
            prep_done = (cash * share if d >= J('finance.dscr_covenant_min') else cash) - div - prep
            cash -= div + prep_done
        self.cash = cash
        # era test: DSCR < 1.0 in two consecutive eras -> cure or step-in
        e = c['era'](t)
        if e is not None and (t + 1 >= c['T'] or c['era'](t + 1) != e):
            cf = sum(r['cfads'] for r in self.rows if c['era'](r['t']) == e) + row['cfads']
            dsum = sum(r['ds'] for r in self.rows if c['era'](r['t']) == e) + row['ds']
            ed = cf / dsum if dsum > 0 else None
            if ed is not None and ed < J('finance.dscr_default'):
                if lv.get('cure'):
                    cure += dsum * 1.0 - cf
                    self.bad_eras = 0
                else:
                    self.bad_eras += 1
                    if self.bad_eras >= J('game.dscr_thresholds')['step_in_eras'] and self.step_in is None:
                        self.step_in = (t, 'era DSCR below 1.0 for two eras')
            else:
                self.bad_eras = 0
        if cure > 0:
            for tr in sorted(self.c['tranches'], key=lambda x: -x.out):
                if cure <= 0:
                    break
            self.cures += cure
        flow = -call - cure + div
        if self.step_in is not None:
            flow = -call - cure
        self.eq_flows[t] = self.eq_flows.get(t, 0.0) + flow
        self.divs += div
        row.update({'cash': self.cash, 'dsra': self.dsra, 'div': div, 'cure': cure, 'call': call, 'sl_out': self.sl_out})

    def next_ds(self, t):
        tot = 0.0
        for tr in self.c['tranches']:
            if tr.sched and (t + 1) in tr.sched:
                tot += tr.sched[t + 1] + tr.out * tr.r(t + 1) / 100
            elif t + 1 >= tr.cap_until and tr.out > 0:
                tot += tr.out * tr.r(t + 1) / 100
        return tot

    def in_build(self, t):
        return any(t in s['spend_t'] for s in self.c.get('stage_list', []))


# ---------------------------------------------------------------------------------------------
# BIAL: data, calibration, back-test
# ---------------------------------------------------------------------------------------------
FY0 = 2009
FYS = J('bial.path.fy')
PI = bial_price_index()


def bial_series(key):
    return dict(zip(FYS, J('bial.path.' + key)))


PAX = bial_series('pax_m')
AERO = bial_series('aero_rev_cr')
OI = bial_series('op_income_cr')
EBITDA = bial_series('ebitda_cr')
MARGIN = bial_series('ebitda_margin')
DSCR = bial_series('dscr')
NONAERO = bial_series('nonaero_cr')
FEE = J('bial.ca.concession_fee')
FY2009_DAYS = 312


def bial_capacity(fy):
    """Terminal capacity in mppa: 11.4 at opening, 20 after T1 (FY2014), 26.5 after debottlenecking (FY2019),
    51.5 after T2 (domestic from 15 Jan 2023: 2.5 of 12 months in FY2023)."""
    if fy <= 2013:
        return 11.4   # bial.close.project_cost_redesign: 4.5 -> 11.4 mppa
    if fy <= 2018:
        return J('bial.debt.t1_expansion')['capacity_mppa']
    if fy <= 2022:
        return J('bial.t2.capex_actual')['capacity_from_mppa']
    if fy == 2023:
        return 26.5 + 25 * 2.5 / 12
    return J('bial.t2.capex_actual')['capacity_to_mppa']


def bial_opex_actual():
    """Opex excluding the 4% concession fee = OI - EBITDA - fee, for years where both are published."""
    out = {}
    for fy in FYS:
        if OI[fy] and EBITDA[fy]:
            out[fy] = OI[fy] - EBITDA[fy] - FEE * OI[fy]
    return out


def bial_nar():
    """Non-aero revenue, nominal crore. Gaps filled: FY2010-13 by interpolating real NAR/pax; FY2017-21 by
    interpolating real NAR/pax then scaling so that OI - NAR sums to the CP2 aero total (4,263.12)."""
    nar = {fy: NONAERO[fy] for fy in FYS if NONAERO[fy] is not None}
    real = {fy: nar[fy] / PI[fy] / PAX[fy] for fy in nar}

    def interp(a, b, fy):
        return real[a] + (real[b] - real[a]) * (fy - a) / (b - a)
    for fy in range(2010, 2014):
        nar[fy] = interp(2009, 2014, fy) * PI[fy] * PAX[fy]
    cp2 = list(range(2017, 2022))
    guess = {fy: interp(2016, 2023, fy) * PI[fy] * PAX[fy] for fy in cp2}
    cp2_aero = J('bial.aera.control_periods')[2]['collections_cr']
    need = sum(OI[fy] for fy in cp2) - cp2_aero
    k = need / sum(guess.values())
    for fy in cp2:
        nar[fy] = guess[fy] * k
    return nar, k


NAR, NAR_CP2_SCALE = bial_nar()
AERO_D = dict(AERO)
for _fy in range(2017, 2022):
    AERO_D[_fy] = OI[_fy] - NAR[_fy]      # derived CP2 aero by year (sums to the reported CP2 total)


def fit_opex():
    """Least squares: real opex (FY2026 Rs) = a x capacity (mppa) + b x pax (m), no intercept.
    FY2009 is a 312-day year: its capacity term is scaled by 312/365."""
    ox = bial_opex_actual()
    X, Y = [], []
    for fy, o in ox.items():
        days = FY2009_DAYS / 365 if fy == 2009 else 1.0
        X.append((bial_capacity(fy) * days, PAX[fy]))
        Y.append(o / PI[fy])
    s11 = sum(x[0] * x[0] for x in X); s12 = sum(x[0] * x[1] for x in X); s22 = sum(x[1] * x[1] for x in X)
    t1 = sum(x[0] * y for x, y in zip(X, Y)); t2 = sum(x[1] * y for x, y in zip(X, Y))
    det = s11 * s22 - s12 * s12
    a = (t1 * s22 - t2 * s12) / det
    b = (s11 * t2 - s12 * t1) / det
    resid = {fy: (a * x[0] + b * x[1]) / y - 1 for (fy, _), x, y in zip(ox.items(), X, Y)}
    return a, b * 10, resid      # a: crore per mppa; b: Rs per pax


def bial_vintages(L_old, L_new):
    """Aero RAB vintages that reproduce AERA's RAB anchors. Assets commissioned before FY2018 depreciate over L_old,
    later ones over L_new (AERA's useful-life order of 2017-18 moved airport assets to longer lives).
    Anchors used to solve the additions: opening RAB 1 Apr 2011 (1,359.39); average RAB FY2014 and FY2015 (CP1 order);
    opening FY2022 (4,427.38). CP3 additions are AERA Table 102, with T2 in service from 15 Jan 2023.
    Returns (vintages, error on the anchors not used to solve)."""
    cp1 = J('bial.aera.control_periods')[1]['avg_rab_cr']
    rab3 = J('bial.aera.cp3_rab_t2_step')
    sh = P['aero_asset_share']
    life = lambda fy: L_old if fy < 2018 else L_new
    f0 = FY2009_DAYS / 365
    x0 = 1359.39 / (1 - (f0 + 2) / L_old)
    vs = [Vintage(x0 / sh, x0, 0, f0, L_old)]
    avg = lambda t, vl: sum(v.path(t, 0)[0] for v in vl)
    for fy in (2014, 2015):
        t = fy - FY0
        add = max(0.0, (cp1[fy - 2012] - avg(t, vs)) / (0.5 - 0.125 / L_old))
        vs.append(Vintage(add / sh, add, t, 0.5, L_old))
    shares = {2017: .1, 2018: .15, 2019: .15, 2020: .45, 2021: .15}   # 45% in FY2020: south runway (first landing 19 Mar 2020)
    t22 = 2022 - FY0

    def opening(t, vl):
        return sum(v.path(t, 0)[0] + v.path(t, 0)[1] / 2 for v in vl if t > v.cod)
    probe = [Vintage(k / sh, k, fy - FY0, 0.5, life(fy)) for fy, k in shares.items()]
    tot = (rab3['opening_fy22'] - opening(t22, vs)) / opening(t22, probe)
    vs += [Vintage(tot * k / sh, tot * k, fy - FY0, 0.5, life(fy)) for fy, k in shares.items()]
    for k, a in enumerate(rab3['additions']):
        fy = 2022 + k
        if fy == 2023:   # T2: CP2 planned it in service all of FY2021; CP3 planned it mid-FY2023; it opened 15 Jan 2023
            vs.append(Vintage(a / sh, a, fy - FY0, 2.5 / 12, L_new, plans={2017 - FY0: (2021 - FY0, 1.0, a), 2022 - FY0: (fy - FY0, 0.5, a)}))
        else:
            vs.append(Vintage(a / sh, a, fy - FY0, 0.5, L_new))
    act = {2012: cp1[0], 2013: cp1[1], 2016: cp1[4]}
    act.update(dict(zip(range(2022, 2027), rab3['avg_actual'])))
    err = {fy: avg(fy - FY0, vs) / a - 1 for fy, a in act.items()}
    return vs, err


def cp_dep(vs, fys, plan=None):
    return sum(v.path(fy - FY0, 0, plan)[1] for v in vs for fy in fys)


def calibrate():
    a, b, resid = fit_opex()
    CALIB['opex_fixed_per_mppa'] = a
    CALIB['opex_per_pax'] = b
    CALIB['opex_resid'] = resid
    cp1o = P['bial_cp1_order']
    cp3 = J('bial.aera.cp3_arr_and_shortfall')
    L_old, L_new = 15.0, 25.0
    for _ in range(4):   # alternate: L_old to CP1 depreciation, L_new to CP3 depreciation
        L_old = min((abs(cp_dep(bial_vintages(x / 10, L_new)[0], range(2012, 2017)) - cp1o['depreciation']), x / 10) for x in range(80, 401))[1]
        L_new = min((abs(cp_dep(bial_vintages(L_old, x / 10)[0], range(2022, 2027), 2022 - FY0) - cp3['depreciation']), x / 10) for x in range(80, 601))[1]
    vs, err = bial_vintages(L_old, L_new)
    CALIB.update({'dep_life_old': L_old, 'dep_life': L_new, 'rab_err': err,
                  'dep_cp1': cp_dep(vs, range(2012, 2017)), 'dep_cp3': cp_dep(vs, range(2022, 2027), 2022 - FY0)})
    cp4 = J('bial.aera.cp4_baseline_arr')
    CALIB['tax_share'] = (cp3['tax'] + cp4['tax']) / (cp3['return'] + cp4['return'])
    # O&M in the ARR. Shared-revenue till (pre-control, CP1): whole-airport O&M (AERA Table 101 vs modelled O&M).
    # Hybrid till (CP2 on): aero-allocated O&M, calibrated on CP3's allowed O&M.
    CALIB['opex_share_srt'] = cp1o['opex'] / sum(opex_model_bial(fy) for fy in range(2012, 2017))
    CALIB['aero_opex_share'] = cp3['opex'] / sum(opex_model_bial(fy) for fy in range(2022, 2027))


def opex_model_bial(fy, pax=None):
    pax = PAX[fy] if pax is None else pax
    days = FY2009_DAYS / 365 if fy == 2009 else 1.0
    return PI[fy] * (CALIB['opex_fixed_per_mppa'] * bial_capacity(fy) * days + CALIB['opex_per_pax'] * pax / 10)


def bial_engine():
    cps_raw = J('bial.aera.control_periods')
    vint, _ = bial_vintages(CALIB['dep_life_old'], CALIB['dep_life'])
    T = len(FYS)
    lbl = lambda t: f'FY{FY0 + t}'
    cp3 = cps_raw[3]
    cp3_planned_pax = sum(cp3['aero_rev_planned_cr']) / cp3['ypp'] * 10
    cp1_planned_pax = cps_raw[1]['arr_cr'] / cps_raw[1]['ypp'] * 10
    cps = [
        # pre-control (MoCA ad hoc tariff at opening, trued up later at 10.97% / 30% till)
        {'start': 0, 'n': 3, 'wacc': cps_raw[0]['return'], 'till': 0.30, 'carry': 0.0, 'esc': 0.0, 'lag': [1, 1, 1], 'tu_wacc': 10.97,
         'opex_share': CALIB['opex_share_srt']},
        # CP1: ordered 10 Jun 2014, effective Jul 2014 -> FY2012-14 at the old tariff, FY2015 a quarter
        {'start': 3, 'n': 5, 'wacc': cps_raw[1]['return'], 'till': cps_raw[1]['till_nar_share'], 'carry': 0.0, 'esc': 0.0,
         'lag': [1, 1, 1, .25, 0], 'fc_list': P['bial_cp1_order']['pax_m'], 'opex_share': CALIB['opex_share_srt'],
         'tu_wacc': 10.97, 'tu_till': 0.30},
        # CP2: ordered 31 Aug 2018, effective 16 Sep 2018; tariff escalates (UDF 100 -> 139 -> 179)
        {'start': 8, 'n': 5, 'wacc': cps_raw[2]['return'], 'till': 0.30, 'carry': 0.0, 'esc': (179 / 100) ** 0.5 - 1,
         'lag': [1, 1, 5.5 / 12, 0, 0], 'tu_wacc': cps_raw[2]['trueup_wacc']},
        # CP3: ordered 28 Aug 2021 (effective Oct 2021); 13.9% of PV ARR carried by design; back-loaded
        {'start': 13, 'n': 5, 'wacc': cps_raw[3]['return'], 'till': 0.30,
         'carry': J('bial.aera.cp3_arr_and_shortfall')['shortfall_share_of_pv_arr'],
         # yield ramp of AERA's CP3 plan: planned aero revenue / pax, FY2023 -> FY2026 (pax at the plan's total, actual shape)
         'esc': ((cp3['aero_rev_planned_cr'][4] / PAX[2026]) / (cp3['aero_rev_planned_cr'][1] / PAX[2023])) ** (1 / 3) - 1,
         'lag': [0.5, 0, 0, 0, 0], 'fc_factor': cp3_planned_pax / sum(PAX[fy] for fy in range(2022, 2027)),
         'tu_wacc': cps_raw[3]['trueup_wacc']},
    ]
    # debt (nominal crore)
    bs = J('bial.close.balance_sheet_fy2010_fy2011')
    t1 = J('bial.debt.t1_expansion')
    refi16 = J('bial.debt.refi_2016')
    t2 = J('bial.t2.financial_close')
    ncd = J('bial.debt.ncd_2021_22')
    w = lambda t: PAX.get(FY0 + t, PAX[2026] * 1.08 ** (FY0 + t - 2026)) * bial_price_index().get(FY0 + t, 1.04 ** (FY0 + t - 2026))
    p1 = Tranche('phase 1 (ICICI)', J('bial.aera.control_periods')[1]['cod'], out=bs['secured_loans'][0],
                 rep_start=2, rep_years=12 - 3, weights=w)
    # T1 expansion: 1,547 cr at the 70:30 expansion norm (finance.gearing_debt_share), drawn FY2013-14
    t1d = t1['capex_cr'] * J('finance.gearing_debt_share')
    t1l = Tranche('T1 expansion', J('bial.aera.control_periods')[1]['cod'], draws={4: t1d / 2, 5: t1d / 2},
                  cap_until=5, rep_start=7, rep_years=10, weights=w)
    tr = [p1, t1l]

    def r2016(t):
        fy = FY0 + t
        return refi16['rate'] if fy <= 2019 else refi16['rate_2019'] if fy <= 2020 else refi16['rate_from_2020_08_21']
    # 2016 refinancing (Q3 FY2017): all senior debt into one loan to Sep 2033, repaying from FY2019
    def refi_rule(eng, t):
        if FY0 + t == 2016:
            amt = sum(x.out for x in eng.c['tranches'] if x.name in ('phase 1 (ICICI)', 'T1 expansion'))
            for x in eng.c['tranches']:
                if x.name in ('phase 1 (ICICI)', 'T1 expansion'):
                    x.out, x.sched, x.rep_start = 0.0, {}, None
            eng.c['tranches'].append(Tranche('2016 refi', r2016, out=amt, rep_start=2019 - FY0, rep_years=2034 - 2019, weights=w))
    # T2 loan: 10,206 cr drawn FY2020-23, IDC capitalised to COD (15 Jan 2023), repayment from FY2024 to Sep 2034
    t2r = lambda t: t2['rate_2020'] if FY0 + t <= 2023 else J('bial.aera.cp4_wacc')['cod']
    draws = {2020 - FY0: .2 * t2['debt_cr'], 2021 - FY0: .3 * t2['debt_cr'], 2022 - FY0: .3 * t2['debt_cr'], 2023 - FY0: .2 * t2['debt_cr']}
    tr.append(Tranche('T2 (SBI/Axis)', t2r, draws=draws, cap_until=2023 - FY0, cap_frac={2023 - FY0: 9.5 / 12},
                      rep_start=2024 - FY0, rep_years=11, weights=w))
    tr.append(Tranche('NCDs 2021-22 (bullets 2027-32)', ncd['coupon'], draws={2022 - FY0: 1000, 2023 - FY0: 653.5},
                      rep_start=None))
    # Before AERA's first order (MoCA ad hoc tariff, FY2009-14) and in each order's lag, BIAL charged the old card:
    # that tariff is an input (actual aero revenue / pax). FY2009 includes the domestic UDF that started 7 months late.
    old_yield = lambda t: AERO_D[FY0 + t] / PAX[FY0 + t] * 10
    cfg = {
        'T': T, 'label': lbl, 'price': lambda t: PI[FY0 + t], 'cps': cps, 'vintages': vint, 'tranches': tr,
        'demand': lambda t: PAX[FY0 + t], 'pax_actual': lambda t: PAX[FY0 + t], 'fc_pax': lambda t: PAX[FY0 + t] if FY0 + t != 2021 else 34.0,
        'cap': lambda t: bial_capacity(FY0 + t), 'nar': lambda t: NAR[FY0 + t] / PAX[FY0 + t] * 10,
        'nar_bench': lambda t: NAR[FY0 + t] / PAX[FY0 + t] * 10,
        'opex': lambda t, cap, pax: opex_model_bial(FY0 + t, pax), 'opex_bench': lambda t, cap, pax: opex_model_bial(FY0 + t, pax),
        'fee': FEE, 'levers': {'elasticity': False}, 'old_yield': old_yield, 'refi_rule': refi_rule,
    }
    return Engine(cfg).run()


def backtest():
    eng = bial_engine()
    out = []
    for r in eng.rows:
        fy = int(r['label'][2:])
        a_y = AERO_D[fy] / PAX[fy] * 10 if AERO_D.get(fy) else None
        out.append({'fy': fy, 'op_year': fy - FY0 + 1, 'pax': PAX[fy],
                    'yield_act': a_y, 'yield_mod': r['yield'] * (r['aero'] / (r['yield'] * r['pax'] / 10)) if r['yield'] else None,
                    'ebitda_act': EBITDA[fy], 'ebitda_mod': r['ebitda'], 'margin_act': MARGIN[fy], 'margin_mod': r['margin'],
                    'dscr_act': DSCR[fy], 'dscr_mod': r['dscr_pre'], 'interest_mod': r['interest'], 'principal_mod': r['principal'],
                    'interest_act': J('bial.path.interest_cr')[fy - FY0], 'principal_act': J('bial.path.principal_cr')[fy - FY0],
                    'yield_basis': 'R' if AERO[fy] else ('D' if AERO_D.get(fy) else None)})
    return eng, out


# ---------------------------------------------------------------------------------------------
# ZMI = BIAL scaled
# ---------------------------------------------------------------------------------------------
ERAS = [(1, 5, 7), (2, 8, 10), (3, 11, 13), (4, 14, 18)] + [(e, 19 + 5 * (e - 5), 23 + 5 * (e - 5)) for e in range(5, 12)] + [(12, 54, 60)]


def era_of(year):
    for e, a, b in ERAS:
        if a <= year <= b:
            return e
    return None


def zmi_level(year):
    return 1 if year < 8 else 2 if year < 11 else 3 if year < 14 else 4


def zmi_demand_fn(star, drag_by_year=None):
    """Annual demand (m pax) from the design-day premise: the level's design day on its move-in date, then
    market growth (world.game_traffic_growth) plus the ops star bonus. Same as design/eras.md section 3."""
    dd = J('game.design_day_movements_by_level')
    move = {1: 5, 2: 8, 3: 11, 4: 14}
    ppm = {1: 160.6, 2: 165.7, 3: 175.9, 4: 178.4}
    g = J('world.game_traffic_growth')['cagr_by_era']
    p2a = J('game.peak_day_to_annual')
    cache = {}

    def D(year):
        if year < 5:
            return 0.0
        if year in cache:
            return cache[year]
        L = zmi_level(year)
        base = dd[str(L)] * ppm[L] * p2a / 1e6
        for t in range(move[L] + 1, year + 1):
            base *= 1 + g[min(11, (t - 1) // 5)] + star + (drag_by_year(t) if drag_by_year else 0.0)
        cache[year] = base
        return base
    return D


SCEN = {
    'EXPERT': {'gearing': 0.70, 'phase1': 'lean', 'state_loan': 0.25, 'defer_state_loan': True, 'push': 'normal',
               'profile': 'sculpt', 'refi': True, 'cure': True, 'retain_until': 15, 'prepay_share': 0.0,
               'phase2': True, 'ops': 'expert', 'fee': None, 'card': None},
    'BAD': {'gearing': 0.75, 'phase1': 'lean', 'state_loan': 0.0, 'defer_state_loan': False, 'push': 'hard',
            'profile': 'sculpt', 'refi': False, 'cure': False, 'retain_until': 0, 'prepay_share': 0.0,
            'phase2': False, 'ops': 'poor', 'fee': None, 'card': None},
    'LAZY': {'gearing': 0.70, 'phase1': 'lean', 'state_loan': 0.0, 'defer_state_loan': False, 'push': 'normal',
             'profile': 'sculpt', 'refi': False, 'cure': False, 'retain_until': 0, 'prepay_share': 0.0,
             'phase2': False, 'ops': 'lazy', 'fee': None, 'card': None},
}
PUSH = {'soft': {'carry': 0.25, 'esc': None}, 'normal': {'carry': J('bial.aera.cp3_arr_and_shortfall')['shortfall_share_of_pv_arr'], 'esc': None},
        'hard': {'carry': 0.0, 'esc': 0.0}}


def zmi_engine(s, label='?', base_cfads=None):
    cpi = P['cpi_forward']
    pr = lambda t: (1 + cpi) ** t          # t = game year - 1
    st = P['zmi_stages']
    lt = P['zmi_loan_terms']
    names = ['1A_' + s['phase1'], '1A+_' + s['phase1'], '1B_BOM', '1B_DEL'] + (['P2'] if s['phase2'] else [])
    ops = P['ops_profiles'][s['ops']]
    base_ops = P['ops_profiles']['base']
    push = PUSH[s['push']]
    drag = (lambda y: P['airline_relations_drag'] if y >= 5 else 0.0) if s['push'] == 'hard' else None
    D = zmi_demand_fn(ops['star'], drag)
    Dbase = zmi_demand_fn(0.0)

    def cap_year(year, with_p2=s['phase2']):
        c = 0.0
        for n in names:
            if n == 'P2' and not with_p2:
                continue
            if year >= st[n]['cod']:
                if n == 'P2':
                    ramp = J('world.game_capacity')['ramp']
                    k = min(2, year - st[n]['cod'])
                    c = 209 + (260 - 209) * ramp[k]
                else:
                    c = st[n]['cap']
        return c
    cap = lambda t: cap_year(t + 1)
    head = 1.1   # design/eras.md game.capacity_headroom
    fc_pax = lambda t: min(Dbase(t + 1), head * cap_year(t + 1))
    # Lenders sculpt on their base-case CFADS (a first pass with base-case ops and the scenario's levers);
    # inside that first pass, on forecast traffic x prices.
    if base_cfads is None:
        weights = lambda t: fc_pax(t) * pr(t) + 1e-6
    else:
        weights = lambda t: max(base_cfads.get(t, 0.0), 0.05 * fc_pax(t) * pr(t) * 10) + 1e-6
    # stage financing with IDC (closed form per year) and the state loan on 1A
    vintages, tranches, equity_need, stage_list = [], [], {}, []
    sl_amt = 0.0
    for n in names:
        sd = st[n]
        g = s['gearing'] if n.startswith('1A') else lt['1B' if n.startswith('1B') else 'P2']['debt_share']
        rc = P['idc_constr_rate'] / 100
        out, total, draws, idc_tot = 0.0, 0.0, {}, 0.0
        sl_share = s['state_loan'] if n.startswith('1A_') else 0.0
        for y, sh in sorted(sd['spend'].items()):
            t = y - 1
            spend = sd['cost'] * sh * pr(t)
            sl = spend * sl_share
            sl_amt += sl
            senior_base = (spend - sl) * g
            idc = rc * (out + senior_base / 2) / (1 - rc * g / 2)
            d = senior_base + g * idc
            out += d
            idc_tot += idc
            total += spend + idc
            draws[t] = d
            equity_need[t] = equity_need.get(t, 0.0) + (spend - sl + idc) * (1 - g)
        cod_t = sd['cod'] - 1
        vintages.append(Vintage(total, total * P['aero_asset_share'], cod_t, 1.0))
        stage_list.append({'name': n, 'spend_t': [y - 1 for y in sd['spend']], 'cost_nominal': total, 'idc': idc_tot})
        key = '1A' if n.startswith('1A_') else '1A+' if n.startswith('1A+') else '1B' if n.startswith('1B') else 'P2'
        terms = lt[key]
        rep_start = terms['rep_start'] - 1 if 'rep_start' in terms else cod_t + terms['mor']
        tranches.append(Tranche(n, terms['rate'], draws=draws, cap_until=cod_t, rep_start=rep_start,
                                rep_years=terms['years'], profile=s['profile'], weights=weights))
        tranches[-1].out_planned = out
    # DSRA funded at financial close, inside the 1A financing: two quarters of the first operating year's interest
    t1a = tranches[0]
    g1a = s['gearing']
    dsra0 = P['dsra_quarters'] / 4 * t1a.out_planned * t1a.rate / 100
    last = max(t1a.draws)
    t1a.draws[last] += g1a * dsra0
    equity_need[last] = equity_need.get(last, 0.0) + (1 - g1a) * dsra0
    slt = P['state_loan_terms']
    state_loan = {'amount': sl_amt, 'n': slt['instalments'], 'first_t': slt['first_year_after_close'] - 1,
                  'defer': slt['deferral_years'], 'defer_from': 9 - 1} if sl_amt > 0 else None
    total_capex_to = lambda t: sum(sg['cost_nominal'] for sg, n in zip(stage_list, names) if st[n]['cod'] - 1 <= t)

    def wacc(t):
        e = self_ref['eng']
        cod = 0.0
        rates = [(tr.out, tr.r(t)) for tr in e.c['tranches'] if tr.out > 0]
        cod = sum(o * r for o, r in rates) / sum(o for o, r in rates) if rates else J('finance.loan_rate_base')
        nd = P['notional_debt_share_wacc']
        w = (1 - nd) * P['coe'] + nd * cod
        ws = e.sl_out / total_capex_to(t) if total_capex_to(t) > 0 else 0.0
        return (1 - ws) * w
    cps = []
    for k in range(12):
        start = 4 + 5 * k
        if start >= 60:
            break
        n = min(5, 60 - start)
        cps.append({'start': start, 'n': n, 'wacc': wacc, 'till': J('till.hybrid_till_nar_share'),
                    'carry': push['carry'] if start + n < 60 else 0.0, 'esc': cpi if push['esc'] is None else push['esc']})
    nar0, nar1 = J('nonaero.zmi_per_pax_start'), J('nonaero.zmi_per_pax_mature')

    def nar_pp_real(year, Q):
        v = nar0
        for e in range(1, max(1, era_of(year) or 1)):
            v += (nar1 - v) * 0.3 * Q
        return v
    fee = J('bial.ca.concession_fee') if s['fee'] is None else s['fee']
    opx = lambda t, c, pax: pr(t) * (CALIB['opex_fixed_per_mppa'] * c + CALIB['opex_per_pax'] * pax / 10) if c > 0 and t >= 4 else 0.0
    card = None
    if s['card'] == 'DEL':
        dial = J('aero.dial_aero_revenue_fy26_cr')
        card = lambda t: dial['total'] / J('benchmarks.dial_revenue_fy26_cr')['pax_m'] * 10 * pr(t) if t >= 4 else 0.0
    elif s['card'] == 'NMIA':
        u = J('aero.udf_greenfield_opening_nmia')
        intl = J('world.game_traffic_growth')['intl_share_start']
        udf_share = J('aero.dial_aero_revenue_fy26_cr')['udf'] / J('aero.dial_aero_revenue_fy26_cr')['total']
        card = lambda t: (0.5 * ((1 - intl) * u['dom_dep'] + intl * u['intl_dep'])) / udf_share * pr(t) if t >= 4 else 0.0

    def refi_rule(eng, t):
        rf = P['refi']
        if s.get('_base'):
            return
        last_cod = max(st[n]['cod'] for n in names if n != 'P2') - 1
        if not s['refi'] or eng.refi_done or t < last_cod + rf['stable_years'] - 1:
            return
        last = [r['dscr'] for r in eng.rows[-rf['stable_years']:]]
        if len(last) < rf['stable_years'] or any(d is None or d < rf['stable_dscr'] for d in last):
            return
        old = [x for x in eng.c['tranches'] if x.out > 0 and t >= x.cap_until]
        amt = sum(x.out for x in old)
        for x in old:
            x.out, x.sched, x.rep_start = 0.0, {}, None
        eng.c['tranches'].append(Tranche('refi', rf['rate'], out=amt, rep_start=t + 1 + rf['moratorium'],
                                         rep_years=rf['tenor'], profile='sculpt', weights=weights))
        eng.refi_done = t + 1
    cfg = {
        'T': 60, 'label': lambda t: f'Y{t + 1}', 'price': pr, 'cps': cps, 'vintages': vintages, 'tranches': tranches,
        'demand': lambda t: D(t + 1), 'fc_pax': fc_pax, 'cap': cap,
        'nar': lambda t: nar_pp_real(t + 1, ops['Q']) * ops['Q'] * pr(t),
        'nar_bench': lambda t: nar_pp_real(t + 1, base_ops['Q']) * base_ops['Q'] * pr(t),
        'opex_bench': opx, 'fee': fee, 'fee_in_arr': True, 'card': card,
        'levers': {'elasticity': True, 'ops': ops, 'cure': s['cure'], 'retain_until': s['retain_until'] - 1,
                   'prepay_share': s['prepay_share'], 'defer_state_loan': s['defer_state_loan']},
        'waterfall': True, 'equity_need': equity_need, 'era': lambda t: era_of(t + 1), 'state_loan': state_loan,
        'stage_list': stage_list, 'renewals': True, 'refi_rule': refi_rule,
    }
    if base_cfads is None and not s.get('_base'):
        lb = dict(s, ops='base', cure=True, _base=True)
        b = zmi_engine(lb, 'lender base case')
        return zmi_engine(s, label, {r['t']: r['cfads'] for r in b.rows})
    self_ref = {}
    eng = Engine(cfg)
    self_ref['eng'] = eng
    eng.dsra = dsra0
    eng.dsra0 = dsra0
    eng.run()
    eng.label = label
    eng.scen = s
    eng.stage_list = stage_list
    eng.sl_amt = sl_amt
    # equity IRR (100% of equity; cures are equity): add the final cash and DSRA net of remaining debt at year 60
    flows = [eng.eq_flows.get(t, 0.0) for t in range(60)]
    if eng.step_in is None and eng.rows:
        last = eng.rows[-1]
        flows[-1] += max(0.0, eng.cash + eng.dsra - last['debt'] - eng.sl_out)
    eng.flows = flows
    eng.irr = irr(flows)
    return eng


def era_table(eng):
    out = {}
    for e, a, b in ERAS:
        rows = [r for r in eng.rows if a <= r['t'] + 1 <= b]
        if not rows:
            out[e] = None
            continue
        cf = sum(r['cfads'] for r in rows)
        ds = sum(r['ds'] for r in rows)
        mins = [r['dscr'] for r in rows if r['dscr'] is not None]
        eb = sum(r['ebitda'] for r in rows)
        out[e] = {'dscr': cf / ds if ds > 0 else None, 'min': min(mins) if mins else None,
                  'partial': rows[-1]['t'] + 1 < b, 'repaid': ds < 0.02 * max(eb, 1)}
    return out


# ---------------------------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------------------------
def f(x, d=0, pct=False):
    if x is None:
        return '—'
    if pct:
        return f'{x * 100:.{d}f}%'
    return f'{x:,.{d}f}'


def err(m, a):
    if m is None or a is None or a == 0:
        return '—'
    return f'{(m / a - 1) * 100:+.0f}%'


def print_calibration():
    print('### Calibrated mechanism parameters (from BIAL data, no fudge factors)\n')
    print('| Parameter | Value | How |')
    print('|---|---|---|')
    print(f"| Asset life, assets before FY2018 | {CALIB['dep_life_old']:.1f} years | fitted to AERA CP1 depreciation ₹789.23 cr (model {CALIB['dep_cp1']:,.0f}) |")
    print(f"| Asset life, assets from FY2018 (used for ZMI) | {CALIB['dep_life']:.1f} years | fitted to AERA CP3 depreciation ₹2,427.57 cr (model {CALIB['dep_cp3']:,.0f}) |")
    print(f"| RAB anchors not used in the fit | {', '.join(f'FY{k % 100:02d} {v * 100:+.0f}%' for k, v in CALIB['rab_err'].items())} | model average RAB vs AERA |")
    print(f"| O&M fixed cost | ₹{CALIB['opex_fixed_per_mppa']:.2f} cr per mppa of capacity per year (FY2026 ₹) | least squares on BIAL opex (OI − EBITDA − 4% fee), {len(CALIB['opex_resid'])} years |")
    print(f"| O&M variable cost | ₹{CALIB['opex_per_pax']:.0f} per passenger (FY2026 ₹) | same fit; residuals {', '.join(f'FY{k % 100:02d} {v * 100:+.0f}%' for k, v in CALIB['opex_resid'].items())} |")
    print(f"| O&M in the ARR, shared-revenue till (pre-control, CP1) | {CALIB['opex_share_srt']:.2f} × modelled O&M | AERA CP1 allowed O&M ₹1,399.60 cr ÷ modelled FY2012-16 |")
    print(f"| O&M in the ARR, hybrid till (CP2 on; used for ZMI) | {CALIB['aero_opex_share']:.2f} × modelled O&M | AERA CP3 allowed O&M ₹2,669.89 cr ÷ modelled FY2022-26 |")
    print(f"| Tax in the ARR | {CALIB['tax_share'] * 100:.1f}% of the return | AERA CP3 + CP4 tax ÷ return |")
    print(f"| Non-aero FY2017-21 scale | ×{NAR_CP2_SCALE:.2f} | interpolated NAR scaled so OI − NAR = CP2 aero total ₹4,263 cr |")
    print()


def print_backtest(eng, out):
    print('### Back-test: BIAL actual vs the mechanism on BIAL inputs\n')
    print('Actual: `bial.path` (R reported, D derived, E estimate). DSCR on both sides = EBITDA ÷ (interest + scheduled principal). Nominal ₹ crore.\n')
    print('| FY | Op yr | Pax (m) | Yield act | Yield model | err | EBITDA act | EBITDA model | err | Margin act | Margin model | DSCR act | DSCR model | Int model | Prin model |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for o in out:
        ya = f(o['yield_act']) + (' D' if o['yield_basis'] == 'D' else '')
        print(f"| {o['fy']} | {o['op_year']} | {o['pax']:.1f} | {ya} | {f(o['yield_mod'])} | {err(o['yield_mod'], o['yield_act'])} | {f(o['ebitda_act'])} | {f(o['ebitda_mod'])} | {err(o['ebitda_mod'], o['ebitda_act'])} | {f(o['margin_act'], 0, True)} | {f(o['margin_mod'], 0, True)} | {f(o['dscr_act'], 2)} | {f(o['dscr_mod'], 2)} | {f(o['interest_mod'])} | {f(o['principal_mod'])} |")
    ys = [abs(o['yield_mod'] / o['yield_act'] - 1) for o in out if o['yield_act'] and o['yield_mod']]
    es = [abs(o['ebitda_mod'] / o['ebitda_act'] - 1) for o in out if o['ebitda_act']]
    print(f"\nMean absolute error: yield {sum(ys) / len(ys) * 100:.0f}% ({len(ys)} years), EBITDA {sum(es) / len(es) * 100:.0f}% ({len(es)} years).\n")
    print('Control-period plans and true-ups (model vs AERA):\n')
    print('| CP start | WACC | Model YPP (ARR ÷ forecast pax) | True-up carried out of the CP (model) | AERA true-up |')
    print('|---|---|---|---|---|')
    real = ['+54.87 at Mar 2011 (→ +179.76 by 2022)', '−313.62 at Mar 2016', '−974.14 at Mar 2022', '+603.38 at Mar 2027']
    for k, p in enumerate(eng.plans):
        tu = eng.trueups[k]['value'] if k < len(eng.trueups) else None
        print(f"| {p['label']} | {p['wacc']:.2f}% | ₹{p['ypp']:.0f} | {f(tu, 1)} | {real[k]} |")
    print()
    print('Building block over the control period, model vs AERA (₹ cr, 5 years):\n')
    print('| CP | Basis | Avg RAB (sum) | Return | Depreciation | O&M | Tax | NAR deduction | ARR | Collections |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    cp1, cp3 = J('bial.aera.control_periods')[1], J('bial.aera.cp3_arr_and_shortfall')
    for k, name in ((1, 'CP1'), (2, 'CP2'), (3, 'CP3')):
        p, tu = eng.plans[k], eng.trueups[k]
        pp, tp = p['parts'], tu['parts']
        print(f"| {name} | model plan | {f(pp['rab'])} | {f(pp['return'])} | {f(pp['dep'])} | {f(pp['opex'])} | {f(pp['tax'])} | {f(pp['nar_ded'])} | {f(sum(p['arr']))} | |")
        print(f"| {name} | model true-up | {f(tp['rab'])} | {f(tp['return'])} | {f(tp['dep'])} | {f(tp['opex'])} | {f(tp['tax'])} | {f(tp['nar_ded'])} | {f(tu['arr'])} | {f(tu['coll'])} |")
        if k == 1:
            o = P['bial_cp1_order']
            print(f"| CP1 | AERA order | {f(sum(cp1['avg_rab_cr']))} | {f(o['return'])} | {f(o['depreciation'])} | {f(o['opex'] + o['wc_interest'])} | {f(o['tax'])} | {f(o['nar_40pct'])} | {f(o['arr'])} | {f(sum(o['aero_rev_planned']))} (planned) |")
        if k == 2:
            c2 = J('bial.aera.control_periods')[2]
            print(f"| CP2 | AERA order / true-up | | | | | | | {f(c2['arr_cr'])} / {f(c2['arr_trued_up_cr'])} | {f(c2['collections_cr'])} |")
        if k == 3:
            print(f"| CP3 | AERA order | {f(sum(J('bial.aera.cp3_rab_t2_step')['avg_ordered']))} | {f(cp3['return'])} | {f(cp3['depreciation'])} | {f(cp3['opex'])} | {f(cp3['tax'])} | {f(cp3['nar_30pct'])} | {f(cp3['gross_arr'] + cp3['nar_30pct'] + cp3['concession_fee'])} | {f(sum(J('bial.aera.control_periods')[3]['aero_rev_actual_cr']))} |")
    print()


def side_by_side(bt, ex):
    print('### BIAL actual vs ZMI modelled (EXPERT), by year since opening\n')
    print('BIAL operating year n = FY(2008+n); ZMI operating year n = game year n+4. Yields in FY2026 rupees (BIAL deflated by CPI, ZMI by the 4% game CPI); EBITDA nominal, with the ratio in FY2026 rupees. DSCR (EBITDA basis) = EBITDA ÷ (interest + scheduled principal), the basis of BIAL\'s path; the ZMI lender DSCR = CFADS ÷ debt service (after tax and renewals) is the one the game tests.\n')
    print('| Op yr | BIAL FY | BIAL pax m | ZMI yr | ZMI pax m | ×pax | BIAL yield ₹ (FY26) | ZMI yield ₹ (FY26) | BIAL EBITDA ₹cr | ZMI EBITDA ₹cr | ×EBITDA (real) | BIAL margin | ZMI margin | BIAL DSCR | ZMI DSCR (EBITDA) | ZMI lender DSCR | ZMI event |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    ev = {5: 'opening; BLR moves in (L1)', 8: 'AMD+HYD move in (L2); 1A+ opens', 9: '1B (T2 analog) financial close', 11: 'BOM moves in (L3); 1B part 1 opens',
          14: 'DEL moves in (L4); 1B complete', 16: '1B repayment starts (T2 analog: FY2024)', 19: 'phase 2 build', 20: 'CP4 reset', 21: 'phase 2 opens', 23: 'refinanced (15-yr, 2-yr moratorium)'}
    pr = lambda t: (1 + P['cpi_forward']) ** t
    for o in bt:
        n = o['op_year']
        if n + 3 >= len(ex.rows):
            continue
        r = ex.rows[n + 3]
        fy = o['fy']
        by = o['yield_act'] / PI[fy] if o['yield_act'] else None
        zy = r['yield'] * (1 - ex.c['levers']['ops']['sq']) / pr(r['t'])
        xr = (r['ebitda'] / pr(r['t'])) / (o['ebitda_act'] / PI[fy]) if o['ebitda_act'] else None
        print(f"| {n} | {fy} | {o['pax']:.1f} | {n + 4} | {r['pax']:.1f} | {r['pax'] / o['pax']:.1f} | {f(by)} | {f(zy)} | {f(o['ebitda_act'])} | {f(r['ebitda'])} | {f(xr, 1)} | {f(o['margin_act'], 0, True)} | {f(r['margin'], 0, True)} | {f(o['dscr_act'], 2)} | {f(r['dscr_pre'], 2)} | {f(r['dscr'], 2)} | {ev.get(n + 4, '')} |")
    print()


def print_eras(engs):
    print('### Lender DSCR by era (CFADS ÷ senior debt service, era aggregate; min annual in brackets)\n')
    print('Era tags: W = warning (< 1.20), C = covenant breach (< 1.10), D = below 1.0 (two such eras in a row, or an unfunded payment, = step-in). Lower-case w = a warning year inside the era. Values floored to 2 decimals. Eras as in money-design.md. "repaid" = debt service under 2% of EBITDA.\n')
    head = '| Scenario | ' + ' | '.join(f'E{e} ({a}-{b})' for e, a, b in ERAS) + ' | Step-in | Equity IRR | Cures ₹cr | Dividends ₹cr |'
    print(head)
    print('|' + '---|' * (len(ERAS) + 5))
    for eng in engs:
        et = era_table(eng)
        cells = []
        for e, a, b in ERAS:
            x = et[e]
            if x is None:
                cells.append('—')
                continue
            if x.get('repaid') or x['dscr'] is None:
                cells.append('repaid')
                continue
            d = x['dscr']
            tag = ' D' if d < 1.0 else ' C' if d < 1.10 else ' W' if d < 1.20 else ''
            fl = lambda v: f'{math.floor(v * 100) / 100:.2f}'      # floored, so 0.997 never prints as 1.00
            wm = ' W' if not tag and x['min'] < 1.20 else ''
            cells.append(f"{fl(d)}{tag} ({fl(x['min'])}{wm.strip() and ' w'}){'*' if x['partial'] else ''}")
        si = f"Y{eng.step_in[0] + 1}: {eng.step_in[1]}" if eng.step_in else 'no'
        ir = f(eng.irr, 1, True) if eng.irr is not None else ('equity lost' if eng.step_in else '—')
        print(f"| {eng.label} | " + ' | '.join(cells) + f" | {si} | {ir} | {f(eng.cures)} | {f(eng.divs)} |")
    print('\n\\* era cut short by step-in.\n')


def print_zmi_years(eng, years=range(1, 31)):
    print(f'### {eng.label}: year by year (nominal ₹ crore)\n')
    print('| Yr | Era | Pax m | Cap | Yield ₹ | Aero | NAR | EBITDA | Margin | Interest | Principal | Lender DSCR | Debt | True-up bal | Cash | Div |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for r in eng.rows:
        y = r['t'] + 1
        if y not in years:
            continue
        print(f"| {y} | {era_of(y) or 0} | {r['pax']:.1f} | {r['cap']:.0f} | {f(r['yield'])} | {f(r['aero'])} | {f(r['nar'])} | {f(r['ebitda'])} | {f(r['margin'], 0, True)} | {f(r['interest'])} | {f(r['principal'])} | {f(r['dscr'], 2)} | {f(r['debt'])} | {f(r['bal'])} | {f(r.get('cash'))} | {f(r.get('div'))} |")
    print()


def print_levers():
    print('### Levers per scenario\n')
    print('| Scenario | Gearing at close | Phase 1 | State support (0% loan, share of 1A) | Defer state loan at 1B | AERA push (carry of PV ARR / escalation) | Repayment | Refinance | Equity cure | Retain cash to | Phase 2 | Ops (Q / disruption ₹/pax / SQ rebate / growth / O&M) | Concession fee |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for n, s in SCEN.items():
        o = P['ops_profiles'][s['ops']]
        pu = PUSH[s['push']]
        print(f"| {n} | {s['gearing']:.0%} (1B at 80%) | {s['phase1']} | {s['state_loan']:.0%} | {'yes' if s['defer_state_loan'] else 'no'} | {s['push']} ({pu['carry']:.1%} / {'CPI' if pu['esc'] is None else 'flat nominal'}) | {s['profile']} | {'yes' if s['refi'] else 'no'} | {'yes' if s['cure'] else 'no'} | {('year ' + str(s['retain_until'])) if s['retain_until'] else 'no'} | {'year 19-20' if s['phase2'] else 'no'} | {o['Q']} / {o['dis']} / {o['sq']:.0%} / {o['star'] * 100:+.1f} pp / ×{o['opex']} | {J('bial.ca.concession_fee') if s['fee'] is None else s['fee']:.0%} |")
    print()


def scenario_set():
    base = dict(SCEN)
    runs = [('EXPERT', base['EXPERT']), ('BAD', base['BAD']), ('LAZY', base['LAZY'])]
    sens = [
        ('EXPERT, big phase 1 (70 mppa)', dict(base['EXPERT'], phase1='big')),
        ('EXPERT, no state loan', dict(base['EXPERT'], state_loan=0.0, defer_state_loan=False)),
        ('EXPERT, 75% gearing', dict(base['EXPERT'], gearing=0.75)),
        ('EXPERT, 60% gearing', dict(base['EXPERT'], gearing=0.60)),
        ('EXPERT, push AERA hard', dict(base['EXPERT'], push='hard')),
        ('EXPERT, soft (25% carried)', dict(base['EXPERT'], push='soft')),
        ('EXPERT, equal instalments', dict(base['EXPERT'], profile='equal')),
        ('EXPERT, no refinancing', dict(base['EXPERT'], refi=False)),
        ('EXPERT, Nagpur-level fee 14.49%', dict(base['EXPERT'], fee=J('ppp.rev_share_nagpur'))),
        ('Comparison: Delhi card (DIAL yield, 45.99% share)', dict(base['EXPERT'], card='DEL', fee=J('ppp.rev_share_dial'))),
        ('Comparison: Navi Mumbai card (opening UDF, 12.6% share)', dict(base['EXPERT'], card='NMIA', fee=J('ppp.rev_share_nmia'))),
    ]
    return runs, sens


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'all'
    calibrate()
    if mode in ('backtest', 'all'):
        print_calibration()
        beng, bt = backtest()
        print_backtest(beng, bt)
    if mode in ('zmi', 'all'):
        runs, sens = scenario_set()
        engs = [zmi_engine(s, n) for n, s in runs]
        if mode == 'all':
            side_by_side(bt, engs[0])
        print_levers()
        print_eras(engs + [zmi_engine(s, n) for n, s in sens])
        for e in engs:
            last = e.step_in[0] + 1 if e.step_in else 30
            print_zmi_years(e, range(1, last + 1))
        ex = engs[0]
        print('### Scale factor\n')
        b26 = PAX[2026]
        z22 = ex.rows[21]['pax']
        capex = sum(s['cost'] for k, s in P['zmi_stages'].items() if k in ('1A_lean', '1A+_lean', '1B_BOM', '1B_DEL'))
        print(f"Traffic, op year 18: ZMI {z22:.0f} m vs BIAL {b26:.1f} m = ×{z22 / b26:.1f}. Full-build capex (FY2026 ₹): ZMI ₹{capex:,.0f} cr vs BIAL ~₹{J('bial.scale.capex_factor_real')['bial_full_build_2025_cr']:,} cr = ×{capex / J('bial.scale.capex_factor_real')['bial_full_build_2025_cr']:.1f}.\n")


if __name__ == '__main__':
    main()
