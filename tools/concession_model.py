#!/usr/bin/env python3
"""concession_model.py: the money model for Vikram Sarabhai International (VSI), "BIAL, scaled" (Bengaluru, Kempegowda).

Pure Python, reads ../money.json and never writes it.

One mechanism, used in two modes:
  backtest  Run the mechanism on BIAL's real inputs (RAB anchors and capex incl. T2, close
            terms, the state loan, the AERA calendar, actual traffic) and compare the model's
            aero yield, EBITDA, margin, DSCR and true-ups with BIAL's actual path, FY2009-FY2026.
  vsi       VSI on its own premise (design-day traffic, capex.stages) with BIAL's unit costs and
            mechanisms: EXPERT, BAD and LAZY, the lever sensitivities, and the Delhi-card and
            Navi-Mumbai-card comparison rows.
  all       Both (default), plus the BIAL-vs-VSI side-by-side tables.

The mechanism, in one place (Engine.plan_cp, Engine.true_up, Engine.run, size_debt):
  ARR    = WACC x avg aero RAB (incl. IDC) + depreciation + allowed aero O&M + tax + concession fee
           - 0.30 x non-aero revenue                                    (AERA building block, hybrid till)
  yield  = solved once per 5-year control period: PV(yield x forecast pax) = (1 - carry) x PV(ARR)
           + true-up brought forward                                     (smoothing)
  true-up at the end of each CP: actual ARR (each year at that year's WACC) - collections,
           discounted and carried at the CP's plan WACC                  (value-conserving)
  carry  = 13.9% of PV(ARR) in the CP in which the T2 analog (stages 1C/1D) enters the RAB, as AERA did
           in BIAL's CP3; 0 otherwise (the "normal" AERA push)
  tax    = in the first plan, BIAL's AERA ratio (tax ÷ return); after that AERA passes through the aero share
           of the tax actually paid (trued up), as it does for BIAL
  debt   = per stage: IDC capitalised to COD, moratorium after COD, repayment sculpted on the
           lender base case's CFADS / 1.30 (interest-only years at least 1.20), each stage sized on the
           capacity left by the earlier ones and capped at the player's gearing (the bank can only lower
           it), DSRA of two quarters, refinancing after 3 stable years (BIAL's 2025 AAA terms)
  costs  = BIAL-fitted O&M (fixed per mppa + per passenger) + one opening cost for new capacity (fitted on
           BIAL's FY2009 opening and FY2014-15 T1 expansion) + disruption above the lender base case;
           renewals = the yearly wear of the built stages at today's prices (ramping 25% -> 100%)
  DSCR   = CFADS / senior debt service, CFADS = EBITDA - cash tax - renewals (the lender basis
           the game tests). DSCR_pre = EBITDA / senior debt service (the basis of BIAL's path).
  tests  = on the worst single year of each era: < 1.20 dividends locked, < 1.10 cash sweep,
           < 1.0 in two eras running = cure board or step-in; an unpaid instalment = step-in at once

Every number is a money.json key (cited by its path). PARAMS below documents each one the model added:
MOVED maps it to its money.json key, which is authoritative (the literal in this file is only the
fallback); the few left in PARAMS are derived from other money.json keys. Calibrated values (CALIB) are
fitted at run time on BIAL data and printed with their fit, marked in-sample or out-of-sample. There is
no revenue multiplier.

usage: python3 tools/concession_model.py [backtest|vsi|all]     (output is markdown; `zmi` is an alias of `vsi`)
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


_T2FC = J('bial.t2.cp2_approved_capex')
_SSA_LOAN, _BIAL_BUILT = J('bial.ssa.state_loan'), J('bial.close.project_cost_final')
_CPS = J('bial.aera.control_periods')

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
                     'game years', True, 'Same as design/eras.md game.cpi. VSI is modelled in nominal rupees, game year 1 = FY2026 prices.'),
    'cash_yield': E(J('world.rbi_repo')['jun2025'], '% p.a. earned on retained cash and the DSRA (before tax)',
                    'money.json world.rbi_repo (Jun 2025 repo 5.5%); BIAL held Rs 3,603 cr unencumbered cash and its DSR in deposits (money.json bial.debt.dsra)',
                    '2025', True, 'Treasury deposits at about the repo rate. Taxed at the corporate rate; not counted in CFADS (lenders test operating cash).'),
    'tax_rate': E(0.2517, 'fraction of PBT', 'https://incometaxindia.gov.in/ (Income Tax Act s.115BAA: 22% + 10% surcharge + 4% cess)',
                  '2019-', False),
    'loss_carry_years': E(8, 'years a business loss can be carried forward (unabsorbed depreciation: no limit)',
                          'https://incometaxindia.gov.in/ (Income Tax Act s.72(3) business loss 8 years; s.32(2) unabsorbed depreciation, no limit)',
                          '2001-', False, 'Brought-forward business loss is set off before unabsorbed depreciation.'),
    'inr_usd_depreciation': E(0.036, 'fraction per year (INR weakening against USD)',
                              'https://www.rbi.org.in/scripts/ReferenceRateArchive.aspx (RBI reference rate ~65 INR/USD in 2017 to ~86 in 2025)',
                              '2017-2025', True, 'Recalled, not fetched. Converts Fairfax India\'s USD return on BIAL to rupees: (1.11 x 1.036) - 1 = 15.0%.'),
    'aero_asset_share': E(J('bial.t2.t2p1_capitalised')['aero_share'], 'fraction of capex that enters the aero RAB',
                          'money.json bial.t2.t2p1_capitalised (AERA Order 11/2021-22 Table 100)', 'FY2023', False,
                          'T2 Ph1 87.66% aero. Applied to every VSI stage.'),
    'idc_constr_rate': E(J('finance.loan_rate_construction'), '% p.a.', 'money.json finance.loan_rate_construction', 'game', True),
    'demand_elasticity': E(0.8, '-(% change in traffic) / (% change in average fare)',
                           'https://www.iata.org/en/iata-repository/publications/economic-reports/estimating-air-travel-demand-elasticities---by-intervistas/ (InterVISTAS for IATA 2007: national-level price elasticity about -0.8)',
                           '2007', False, 'Applied to the aero charge above the market norm, as a share of the fare. Caps demand at the premise; never raises it.'),
    'avg_fare': E(5200, 'INR per one-way passenger (FY2026 prices)',
                  'https://www.goindigo.in/information/investor-relations.html (IndiGo FY2025 yield ~Rs 4.96 per RPK x ~1,050 km average stage)',
                  'FY2025', True, 'Derived: yield x stage length.'),
    'yield_market_norm': E(606, 'INR aero revenue per passenger (FY2026 prices)', 'money.json bial.path.aero_yield_per_pax (FY2026)',
                           'FY2026', True, "What travellers pay at a mature Indian hub today; the elasticity's reference point."),
    'airline_relations_drag': E(-0.01, 'traffic growth per year (fraction) in every year of a control period where the tariff is pushed hard',
                                'design estimate; precedent: IATA, FIA and BAR objections to BIAL CP3/CP4 (https://www.aera.gov.in/uploads/stack_holder/17841244347199.pdf)',
                                'game', True, 'Airlines add capacity elsewhere when the hub fights for a front-loaded tariff. Compounds into the demand level.'),
    'push_hard_disallowance': E(round(_T2FC['gap_to_bial_cr'] / (_T2FC['approved_cr'] + _T2FC['gap_to_bial_cr']), 4),
                                'fraction of the capex commissioned in a hard-pushed CP that AERA leaves out of the RAB',
                                'money.json bial.t2.cp2_approved_capex (AERA approved Rs 10,342.4 cr of T2 against BIAL\'s claim, gap Rs 1,616.8 cr)',
                                'CP2 (2018)', True, 'The cost of pushing hard: scrutiny of the capex claim. The share is BIAL\'s T2 gap; tying it to the push is the design choice.'),
    'tariff_shock_carry': E(J('bial.t2.zmi_1b_template')['planned_shortfall_share_of_pv_arr'], 'fraction of PV(ARR) AERA carries into the next CP',
                            'money.json bial.aera.cp3_arr_and_shortfall.shortfall_share_of_pv_arr (AERA Order 11/2021-22: 13.9% of CP3 PV ARR left unrecovered by design when T2 entered the RAB)',
                            'CP3 FY2022-26', False, 'Applied in the CP in which a 1C/1D tranche (the T2 analog) is commissioned. Lenders do not bank it (BIAL\'s T2 close, Aug 2019, predates the CP3 order, Aug 2021).'),
    'soft_push_carry': E(0.25, 'fraction of PV(ARR) carried in the T2-analog CP when the player asks AERA for a gentle tariff',
                         'design estimate (between CP3\'s 13.9% and a full deferral)', 'game', True),
    'aera_order_lag': E(round((5.5 / 12 + 6 / 12 + 5 / 12) / 3, 3), 'fraction of the first CP year billed at the previous order\'s tariff',
                        'money.json bial.aera.control_periods: CP2 order 31 Aug 2018 effective 16 Sep 2018 (5.5 months); CP3 order 28 Aug 2021 effective Oct 2021 (6); CP4 order 20 Aug 2026 effective 1 Sep 2026 (5)',
                        'CP2-CP4', False, 'Mean of BIAL\'s three building-block orders. VSI CP1 is ordered before opening (Navi Mumbai precedent), so CP1 has no lag.'),
    'renewal_share': E({'start': 0.25, 'full': 1.0}, 'renewal capex as a share of depreciation; ramps linearly from start at opening to full after one asset life',
                       'design/eras.md game.renewal_share (0.25 at opening); full replacement once assets reach the end of their AERA life (handback standard: money.json world.residual_life_thresholds)',
                       'game', True, 'Deducted from CFADS and capitalised into RAB. Keeps the asset base from decaying in the late game. Not applied in the back-test (BIAL RAB anchors already include it).'),
    'state_loan_terms': E({'share_of_built_cost': round(_SSA_LOAN / _BIAL_BUILT, 4), 'cost': 0.0, 'instalments': 20, 'first_year_after_close': 11,
                           'deferral_years': 10, 'defer_from_year': 9},
                          'BIAL SSA loan terms', 'money.json bial.ssa.state_loan (350) / bial.close.project_cost_final (2,470.29); bial.ssa.state_loan_repayment, bial.ssa.state_loan_deferral (from 2018, during the T2 programme), bial.ssa.state_loan_in_wacc',
                          '2005-2028', False, 'Share = 14.17% of BIAL\'s built cost (the loan was fixed at close; cost growth went to senior debt). Subordinated: paid after senior debt service; not in the senior DSCR. AERA counts it at 0% in the WACC. defer_from_year 9 = VSI 1B financial close (est.).'),
    'notional_debt_share_wacc': E(J('bial.aera.cp4_wacc')['debt_share'], 'fraction debt in AERA WACC', 'money.json bial.aera.cp4_wacc',
                                  'CP3-CP4', False, 'AERA 48:52 D:E for BIAL CP3 and CP4 (and DIAL CP4).'),
    'coe': E(J('bial.aera.cp4_wacc')['coe'], '% cost of equity', 'money.json bial.aera.cp4_wacc (IIM Bangalore CAPM)', 'CP3-CP4', False),
    'dsra_quarters': E(J('bial.debt.dsra'), 'quarters of senior debt service', 'money.json bial.debt.dsra', 'FY2026', False),
    'lbc_dscr_target': E(1.30, 'x base-case CFADS / debt service the bank sculpts and sizes to',
                         'design/eras.md section 7 (game.lbc_dscr_target); BIAL covenant context: money.json bial.debt.covenants (1.40 cumulative downgrade trigger, 1.5 expected)',
                         'game', True),
    'lbc_moratorium_cover': E(1.20, 'x base-case CFADS / interest the bank requires in interest-only years after COD',
                              'money.json game.dscr_thresholds.warning (1.20): the bank does not close on a base case that sits in its own warning zone; BIAL\'s opening year ran at about 1.07 (money.json bial.path.dscr FY2009, est.), which its lenders had not foreseen',
                              'game', True, 'Below this the bank cuts the stage\'s gearing. Binds only in the opening year, so the expert\'s later warnings cannot come from the debt\'s shape.'),
    'refi': E({'rate': J('bial.debt.refi_2025_ncd')['coupon'], 'moratorium': J('bial.debt.refi_2025_ncd')['moratorium_years'],
               'tenor': J('bial.debt.refi_2025_ncd')['tenor_years'], 'stable_years': 3, 'stable_dscr': 1.20},
              'refinancing terms', 'money.json bial.debt.refi_2025_ncd', 'FY2026', True,
              "BIAL's 2025 AAA NCD: 8.15%, 15 years, 2-year moratorium (finance.refi_rate_after_stability 9.0% is the AA+ class; a project that has met its covenants for 3 years refinances as BIAL did). Trigger: 3 years after the last mandatory COD with no lender warning (DSCR >= 1.20), as BIAL refinanced 2 years after T2."),
    'opening_cost': E({'fit_years_greenfield': [2009], 'fit_years_expansion': [2014, 2015], 'expansion_new_mppa': 20 - 11.4,
                       'out_of_sample': [2023, 2024], 'greenfield_year2_share': 0.5},
                      'which BIAL years fit the opening-cost term', 'money.json bial.path (op_income_cr, ebitda_cr), bial.debt.t1_expansion (11.4 -> 20 mppa, FY2014)',
                      'FY2009-FY2024', True,
                      'Opening premium = k x the fixed O&M of newly commissioned capacity. Greenfield k fitted to FY2009 (one point; year 2 at half, est., FY2010 opex not published); expansion k fitted to FY2014-15 (T1, years 1 and 2). T2 (FY2023-24) is the out-of-sample check.'),
    'ops_profiles': E({
        # per level 1..5 (5 = Level 5, years 19+). Q = Mall realised / potential; dis = disruption cost per pax (2025 Rs;
        # the base-case level is inside BIAL's fitted O&M, only the excess is added); sq = service-quality rebate (share of
        # aero; negative = the 3-star bonus, money.json till.sq_incentive_max 1.25%); star = traffic growth bonus per year; opex = O&M efficiency factor
        # (excess over the benchmark is not allowed in ARR).
        'base':   {'Q': [.95] * 5, 'dis': [60] * 5, 'sq': [.01] * 5, 'star': [0.0] * 5, 'opex': [1.0] * 5},
        'expert': {'Q': [.95] * 5, 'dis': [60] * 5, 'sq': [-0.0125] * 5, 'star': [0.015] * 5, 'opex': [1.0] * 5},
        'poor':   {'Q': [.92, .86, .85, .80, .78], 'dis': [70, 115, 120, 150, 160], 'sq': [.01, .02, .03, .04, .04],
                   'star': [0.0, -0.005, -0.01, -0.01, -0.01], 'opex': [1.0, 1.02, 1.04, 1.06, 1.06]},
        'lazy':   {'Q': [.85, .82, .80, .78, .78], 'dis': [150, 150, 160, 180, 180], 'sq': [.03, .04, .05, .05, .05],
                   'star': [-0.01, -0.03, -0.03, -0.03, -0.03], 'opex': [1.04, 1.05, 1.05, 1.06, 1.06]}},
        'per-level shift outcomes', 'design/eras.md (game.lender_base_case, game.star_growth_bonus); money.json till.sq_rebate_max_of_arr',
        'game', True, 'Stand-ins for what the sample-day shifts report. Poor and lazy get worse as the levels get harder; their values are hand-set design estimates.'),
    'vsi_ppm': E({1: 160.6, 2: 165.7, 3: 175.9, 4: 178.4}, 'passengers per movement by level', 'design/eras.md section 3 (game.pax_per_movement x LV wide share)', 'game', True),
    'vsi_move_years': E({1: 5, 2: 8, 3: 11, 4: 14}, 'game year each level\'s traffic moves in', 'design/eras.md section 1', 'game', False),
    'capacity_headroom': E(1.1, 'x capacity that can be served', 'design/eras.md section 3 (game.capacity_headroom)', 'game', True),
    'nar_convergence': E(0.3, 'share of the gap to the mature Mall yield closed per era, x Q', 'design/eras.md section 8', 'game', True),
    'covid_shock': E({'years': {16: J('bial.path.pax_m')[12] / J('bial.path.pax_m')[11], 17: J('bial.path.pax_m')[13] / J('bial.path.pax_m')[11]},
                      'fee_waived': True},
                     'traffic multiplier by game year (sensitivity only)', 'money.json bial.path.pax_m (FY2021 / FY2020, FY2022 / FY2020); finance.covid_force_majeure (fee excused)',
                     'FY2021-22', False, 'BIAL\'s COVID years placed on VSI years 16-17. Sensitivity row only; the lenders\' base case does not foresee it.'),
    'vsi_stages': E({
        # base cost in FY2026 crore; spend {game year: share}; cod game year; cap = mppa after COD
        '1A_lean': {'cost': 36000, 'spend': {1: .25, 2: .25, 3: .25, 4: .25}, 'cod': 5, 'cap': 45},
        '1A_big': {'cost': J('capex.zmi_phase1_capex_cr'), 'spend': {1: .25, 2: .25, 3: .25, 4: .25}, 'cod': 5, 'cap': 70},
        '1B_lean': {'cost': 20000, 'spend': {6: .5, 7: .5}, 'cod': 8, 'cap': 95},
        '1B_big': {'cost': 25 * J('capex.brownfield_cr_per_added_mppa'), 'spend': {6: .5, 7: .5}, 'cod': 8, 'cap': 95},
        '1C': {'cost': 24000, 'spend': {9: .5, 10: .5}, 'cod': 11, 'cap': 150},
        '1D': {'cost': 24000, 'spend': {11: 1 / 3, 12: 1 / 3, 13: 1 / 3}, 'cod': 14, 'cap': J('world.game_capacity')['full_mppa']},
        'P2': {'cost': J('world.game_capacity')['phase2_cost_cr'], 'spend': {19: .5, 20: .5}, 'cod': 21, 'cap': J('world.game_capacity')['phase2_mppa']}},
        'INR crore (FY2026 prices) / mppa', 'design/eras.md capex.stages; money.json capex.zmi_phase1_capex_cr, capex.brownfield_cr_per_added_mppa, world.game_capacity',
        'game', True,
        'Names as money-design.md: 1A = BIAL phase 1; 1B (AMD+HYD) = BIAL T1 expansion (FY2014, op year 6); 1C (BOM) + 1D (DEL) = the T2 programme (one close in year 9, 80:20, 1-yr moratorium after completion, 10-yr repayment).'),
    'vsi_loan_terms': E({
        '1A': {'rate': J('finance.loan_rate_base'), 'mor': 2, 'years': 14},
        '1B': {'rate': J('finance.loan_rate_base'), 'mor': 1, 'years': 15},
        'T2': {'rate': J('finance.loan_rate_base'), 'debt_share': 0.80, 'rep_start': 15, 'years': 10},
        'P2': {'rate': J('finance.loan_rate_base'), 'debt_share': 0.80, 'mor': 1, 'years': 10}},
        'rate % / years', 'money.json finance.loan_rate_base; bial.close.moratorium_after_cod_years (2, inferred); bial.t2.financial_close (80:20, 1 + 10 years)',
        'game', True, '1A: 4 years building + 2 moratorium + 14 repaying = 20 years door to door. 1B repays from the year after the DEL COD, as T2 did (COD FY2023, first principal FY2024).'),
    'bial_cp1_order': E({'return': 1107.45, 'opex': 1399.60, 'wc_interest': 19.41, 'depreciation': 789.23, 'tax': 32.64,
                         'nar_40pct': -367.40, 'arr': 2980.94, 'pax_m': [12.7, 12.0, 12.9, 14.4, 16.0],
                         'aero_rev_planned': [475.23, 463.11, 488.19, 698.87, 824.22]},
                        'INR crore over CP1 FY2012-16 / m pax', 'https://aera.gov.in/uploads/airports/5b1f90079005ao081415.pdf (Order 08/2014-15, Table 101, p.505)',
                        'CP1 FY2012-FY2016', False,
                        "40% shared revenue till. O&M is the whole airport's (the till deducts 40% of non-regulated revenue), unlike CP3's aero-allocated O&M."),
    'aera_useful_life_2018': E('assets commissioned from FY2018 depreciate over longer AERA useful lives', 'rule',
                               'AERA Order 35/2017-18 (determination of useful life of airport assets), https://aera.gov.in/',
                               'FY2018-', True, 'Order number recalled, not re-fetched. The model fits one life to pre-FY2018 assets (CP1 depreciation) and one to later assets (CP3 depreciation).'),
    # --- back-test inputs that are not published BIAL figures (all flagged) ---
    'land_rent': E({'nominal': 0.0, 'bial_style_cr_per_year': round(J('bial.ssa.land_site_cost_cap') * J('bial.scale.traffic_factor') * 0.095 / (1 - 1.095 ** -30), 1)},
                   'INR crore a year (FY2026 prices) paid to the state for the land',
                   'money-design.md (the state leases the land at a nominal rent); money.json bial.ssa.land (BIAL: 4,008 acres; rent recovers the state\'s site cost, cap raised to Rs 302.15 cr in 2024)',
                   'game', True, 'Nominal = the design. BIAL-style = BIAL\'s site-cost cap x the traffic factor 5, recovered over 30 years at 9.5% (est.). Not in the ARR (BIAL\'s land rent is not an aero cost in the building block, est.).'),
    'bial_ebitda_basis': E({2009: 'E', 2014: 'R', 2015: 'R', 2016: 'R', 2017: 'R', 2018: 'D', 2019: 'D', 2023: 'D', 2024: 'D', 2025: 'D', 2026: 'D'},
                           'R reported / D derived from a reported margin x operating income / E estimate', 'research/bial.md section 3.1 (basis letters)', 'FY2009-26', False),
    'bt_t2_draw_shares': E({2020: .2, 2021: .3, 2022: .3, 2023: .2}, 'share of the T2 loan drawn by FY',
                           'design estimate; works FY2017-23 (money.json bial.t2.timeline), balance FY2020-23 (bial.t2.funding_split)', 'FY2020-23', True),
    'bt_vintage_shares_fy17_21': E({2017: .1, 2018: .15, 2019: .15, 2020: .45, 2021: .15}, 'share of FY2017-21 aero RAB additions by FY',
                                   'design estimate; 45% in FY2020 for the south runway (first landing 19 Mar 2020, money.json bial.t2.timeline)', 'FY2017-21', True,
                                   'The total is solved from AERA\'s opening FY2022 RAB; only the timing is assumed.'),
    'bt_fc_fy2021': E(34.0, 'm pax AERA would have forecast for FY2021 before COVID', 'design estimate: FY2020 actual 32.36 m x ~1.05', 'FY2021', True,
                      'Used only in the CP2 plan (ordered Aug 2018, before COVID).'),
    'bt_forward_growth': E(0.08, 'traffic growth per year after FY2026 in the back-test sculpt weights', 'design estimate', 'FY2027-', True),
    'bt_p1_repayment': E({'start_fy': 2011, 'years': 9}, 'phase-1 loan repayment', 'money.json bial.close.senior_debt (12-year rupee loan from close, FY2006), bial.path.principal_cr (first principal FY2011)',
                         'FY2011-19', True, '12-year tenor less 3 years of construction.'),
    'bt_cp1_trueup_wacc': E(_CPS[0]['return'], '% at which AERA trued up the pre-control period and CP1', 'money.json bial.aera.control_periods (CP1 trueup_note: "trued up on 30% till at 10.97%")', 'CP1', False),
    'bt_t2_capitalised_months': E(9.5, 'months of FY2023 before T2\'s COD (interest capitalised)', 'money.json bial.t2.timeline (t2_domestic 2023-01-15)', 'FY2023', False, '1 Apr 2022 to 15 Jan 2023.'),
    'bt_refi16_early_principal': E({2019: J('bial.path.principal_cr')[10], 2020: J('bial.path.principal_cr')[11]},
                                   'INR crore principal on the 2016 refinancing before the sculpted profile', 'money.json bial.path.principal_cr (FY2019 6, FY2020 37; estimate flag set)', 'FY2019-20', True),
}


def _ints(v):
    """money.json keys are strings: restore the integer keys (years, levels) the model indexes by."""
    if isinstance(v, dict):
        return {(int(k) if isinstance(k, str) and k.lstrip('-').isdigit() else k): _ints(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_ints(x) for x in v]
    return v


def _has(path):
    node = MJ
    for p_ in path.split('.'):
        if not isinstance(node, dict) or p_ not in node:
            return False
        node = node[p_]
    return True


# money.json is authoritative. These PARAMS entries live in money.json (written there with the same source, period,
# estimate flag and note); the literal above is only a fallback if a key is missing.
MOVED = {
    'cpi_india_fy': 'bial.cpi_india_fy', 'cpi_forward': 'game.cpi', 'tax_rate': 'finance.tax_rate',
    'loss_carry_years': 'finance.loss_carry_years', 'inr_usd_depreciation': 'world.inr_usd_depreciation',
    'demand_elasticity': 'game.demand_elasticity', 'avg_fare': 'game.avg_fare',
    'airline_relations_drag': 'game.airline_relations_drag', 'soft_push_carry': 'game.soft_push_carry',
    'renewal_share': 'game.renewal_share', 'lbc_dscr_target': 'game.lbc_dscr_target',
    'lbc_moratorium_cover': 'game.lbc_interest_only_cover', 'opening_cost': 'bial.opening_cost_fit',
    'ops_profiles': 'game.ops_profiles', 'vsi_ppm': 'game.pax_per_movement_by_level',
    'vsi_move_years': 'game.move_in_years', 'capacity_headroom': 'game.capacity_headroom',
    'nar_convergence': 'game.nar_convergence', 'vsi_stages': 'capex.stages',
    'bial_cp1_order': 'bial.aera.cp1_order_building_block', 'aera_useful_life_2018': 'bial.aera.useful_life_rule',
    'bial_ebitda_basis': 'bial.path.ebitda_basis', 'land_rent': 'game.land_rent',
}
MOVED.update({k: 'bial.backtest_inputs.' + k[3:] for k in PARAMS if k.startswith('bt_')})
for _k, _path in MOVED.items():
    if _has(_path):
        PARAMS[_k]['value'] = _ints(J(_path))
        PARAMS[_k]['json'] = _path
if _has('finance.stage_loan_terms'):
    PARAMS['vsi_loan_terms']['value'] = {n: dict(_ints(v), rate=J('finance.loan_rate_base')) for n, v in J('finance.stage_loan_terms').items()}
if _has('bial.aera.order_lag_months'):
    _m = J('bial.aera.order_lag_months')
    PARAMS['aera_order_lag']['value'] = round(sum(_m.values()) / len(_m) / 12, 3)
if _has('game.state_loan_defer_from_year'):
    PARAMS['state_loan_terms']['value']['defer_from_year'] = J('game.state_loan_defer_from_year')
if _has('game.refi_trigger'):
    PARAMS['refi']['value'].update(J('game.refi_trigger'))
if _has('game.covid_sensitivity_years'):
    _px = J('bial.path.pax_m')
    _y = J('game.covid_sensitivity_years')
    PARAMS['covid_shock']['value']['years'] = {_y[0]: _px[12] / _px[11], _y[1]: _px[13] / _px[11]}
P = {k: v['value'] for k, v in PARAMS.items()}

CALIB = {}


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
    """A senior loan. Interest before cap_until is funded by the draws (IDC), not debt service.
    profile: 'sculpt' (principal = c x weight - interest, c solved to amortise), 'equal' (annuity) or 'fixed'
    (sched given). fixed: {t: principal} paid before rep_start (BIAL's 2016 refinancing)."""

    def __init__(self, name, rate, draws=None, out=0.0, cap_until=0, cap_frac=None, rep_start=None,
                 rep_years=10, profile='sculpt', weights=None, sched=None, fixed=None, target_mode=False):
        self.name, self.rate, self.draws, self.out = name, rate, dict(draws or {}), out
        self.cap_until, self.cap_frac = cap_until, cap_frac or {}
        self.rep_start, self.rep_years, self.profile, self.weights = rep_start, rep_years, profile, weights
        self.sched = dict(sched) if sched is not None else None
        self.fixed = fixed or {}
        self.target_mode = target_mode    # True: debt service = the full weight (capacity) until repaid; tenor shortens
        self.k = None
        self.ds_hist = {}
        self.int_hist = {}

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
            self.k = None
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
        lo, hi = 0.0, 10 * D / sum(w) + 10
        for _ in range(100):
            mid = (lo + hi) / 2
            if run(mid)[0] > 0:
                lo = mid
            else:
                hi = mid
        self.k = hi        # > 1 means the loan needs more than the capacity it was sculpted on
        if self.target_mode and hi < 1.0:
            o, s = run(1.0)    # sculpted at the target DSCR: repaid early
        else:
            o, s = run(hi)
        s[t0 + n - 1] += o
        self.sched = s

    def step(self, t):
        """Returns (interest expensed, principal)."""
        d = self.draws.get(t, 0.0)
        cap = 1.0 if t < self.cap_until else self.cap_frac.get(t, 0.0)
        interest = self.r(t) / 100 * (self.out + d / 2)
        self.out += d
        if t in self.fixed:
            prin = min(self.out, self.fixed[t])
        else:
            if self.rep_start is not None and t == self.rep_start and self.sched is None:
                self.build_schedule(t)
            prin = min(self.out, self.sched.get(t, 0.0)) if self.sched else 0.0
            if self.sched and t == max(self.sched):
                prin = self.out          # whatever is left falls due at maturity
        self.out -= prin
        ie = interest * (1 - cap)
        self.ds_hist[t] = ie + prin
        self.int_hist[t] = ie
        return ie, prin

    def prepay(self, amt):
        amt = min(amt, self.out)
        if amt <= 0:
            return 0.0
        if self.sched:
            f = (self.out - amt) / self.out
            self.sched = {k: v * f for k, v in self.sched.items()}
        self.out -= amt
        return amt


class Vintage:
    """An asset vintage: gross amount (total and aero), COD year, in-service fraction in the COD year, life.
    plans = {cp_start: (cod, frac, aero)}: how the regulator saw this asset when it planned that control period."""

    def __init__(self, gross, aero, cod, frac=1.0, life=None, plans=None, stage=None):
        self.gross, self.aero, self.cod, self.frac, self.life = gross, aero, cod, frac, life
        self.plans = plans or {}
        self.stage = stage

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
    """cfg keys: T, label(t), price(t), cps [ {start, n, wacc(t) or float, till, carry, esc, lag[], fc_factor | fc_list,
    nar_plan_total, tu_wacc, tu_till, opex_share} ], vintages, tranches, demand(t), fc_pax(t), cap(t), nar(t), nar_bench(t),
    opex_bench(t, cap, pax), ops(t), fee, fee_waived(t), levers{...}, pax_shock{t: x}, card(t), era(t), state_loan{...},
    equity_need{t: cr}, renewals, refi_rule"""

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
        self.loss_dep = 0.0      # unabsorbed depreciation (no limit)
        self.loss_bus = []       # [(year, amount)] business losses (8 years)
        self.step_in = None
        self.refi_done = 0
        self.eq_flows = {}
        self.cures = 0.0
        self.divs = 0.0
        self.calls = 0.0
        self.sl_out = (cfg.get('state_loan') or {}).get('amount', 0.0)
        self.bad_eras = 0
        self.era_mins = {}
        self.tax_ratio = CALIB['tax_share']   # tax in the plan ARR as a share of the return; reset from each true-up
        self.prov = []                        # forecast capex (renewals) the regulator puts in the plan RAB

    # --- regulator ---------------------------------------------------------------------------
    def rab(self, t, plan=None):
        avg = dep = 0.0
        for v in self.c['vintages'] + (self.prov if plan is not None else []):
            a, d = v.path(t, self.L, plan)
            avg += a
            dep += d
        return avg, dep

    def dep_total(self, t):
        return sum(v.path(t, self.L, None, aero=False)[1] for v in self.c['vintages'])

    def renew_life(self, t):
        return None        # renewals depreciate over the normal asset life; what is left at year 60 is handed back for nothing

    def renewal_capex(self, t):
        """Renewals = share x the yearly wear on the built stages, at today's prices: each stage's gross cost,
        re-priced from its COD to year t, over the economic life (the fitted asset life). A renewed stage keeps
        needing renewal, so the real asset base holds at share 1.0 (renewal vintages are not counted again).
        Independent of the regulatory depreciation schedule."""
        pr, L = self.c['price'], self.L
        tot = 0.0
        for v in self.c['vintages']:
            if v.stage is not None and v.cod <= t:
                tot += v.gross / L * pr(t) / pr(max(0, v.cod))
        return self.c['renewal_share'](t) * tot

    def wacc(self, cp, t):
        w = cp['wacc']
        return w(t) if callable(w) else w

    def building_block(self, t, wacc, till, pax, nar, opex_allowed, plan, parts=None, tax_amt=None):
        """tax_amt: the aero share of the tax actually paid (true-up); None = forecast at self.tax_ratio x return."""
        avg, dep = self.rab(t, plan)
        ret = wacc / 100 * avg
        tx = tax_amt if tax_amt is not None else ret * self.tax_ratio
        bb = ret + tx + dep + opex_allowed - till * nar
        fee = self.c['fee'] if self.c.get('fee_in_arr', True) else 0.0
        if parts is not None:
            for k, v in (('rab', avg), ('return', ret), ('tax', tx), ('dep', dep),
                         ('opex', opex_allowed), ('nar_ded', -till * nar), ('fee', bb / (1 - fee) * fee)):
                parts[k] = parts.get(k, 0.0) + v
        return bb / (1 - fee), avg, dep

    def plan_cp(self, cp, t0):
        n, wacc = cp['n'], self.wacc(cp, t0)
        cp['_wacc_plan'] = wacc
        self.prov = []
        if self.c.get('renewal_share'):      # the regulator's capex forecast: renewals at this year's rule, entering the RAB next year
            for k in range(n - 1):
                t = t0 + k
                amt = self.renewal_capex(t)
                if amt > 0:
                    self.prov.append(Vintage(amt, amt * P['aero_asset_share'], t + 1, life=self.renew_life(t)))
        v = 1 / (1 + wacc / 100)
        arr, paxf, parts, nars = [], [], {}, []
        for k in range(n):
            t = t0 + k
            pf = cp['fc_list'][k] if 'fc_list' in cp else self.c['fc_pax'](t) * cp.get('fc_factor', 1.0)
            paxf.append(pf)
            nars.append(self.c['nar_bench'](t) * pf / 10)
        if cp.get('nar_plan_total'):                       # AERA's own planned non-aero (BIAL CP3)
            s = cp['nar_plan_total'] / sum(nars)
            nars = [x * s for x in nars]
        for k in range(n):
            t, pf = t0 + k, paxf[k]
            cap = self.c['cap'](t)
            opex_allow = cp.get('opex_share', CALIB['aero_opex_share']) * self.c['opex_bench'](t, cap, pf)
            a, _, _ = self.building_block(t, wacc, cp['till'], pf, nars[k], opex_allow, plan=t0, parts=parts)
            arr.append(a)
        pv_arr = sum(a * v ** k for k, a in enumerate(arr))
        target = (1 - cp['carry']) * pv_arr + self.bal     # carry part of this period's ARR; recover the whole true-up
        lag = cp.get('lag', [0] * n)
        old = self.c.get('old_yield') or (lambda t: self.yields.get(t0 - 1, 0.0))
        y_old = [old(t0 + k) for k in range(n)]
        known = sum(lag[k] * y_old[k] * paxf[k] / 10 * v ** k for k in range(n))
        unit = sum((1 - lag[k]) * (1 + cp['esc']) ** k * paxf[k] / 10 * v ** k for k in range(n))
        y0 = max(0.0, (target - known) / unit) if unit > 0 else 0.0
        for k in range(n):
            new = y0 * (1 + cp['esc']) ** k
            self.yields[t0 + k] = lag[k] * y_old[k] + (1 - lag[k]) * new
        self.plans.append({'t0': t0, 'label': self.c['label'](t0), 'wacc': wacc, 'arr': arr, 'pv_arr': pv_arr, 'parts': parts,
                           'pax_f': sum(paxf), 'target': target, 'carry': cp['carry'],
                           'bal_in': self.bal, 'y0': y0, 'yields': [self.yields[t0 + k] for k in range(n)],
                           'ypp': sum(arr) / sum(paxf) * 10})
        cp['_acc'] = []
        self.prov = []

    def true_up(self, cp, t_end):
        """Actual ARR (return at each year's own WACC, or AERA's trued-up WACC where given) less collections,
        discounted and carried at one rate: AERA's trued-up WACC (BIAL) or the CP's plan WACC (VSI)."""
        w_carry = cp.get('tu_wacc', cp['_wacc_plan'])
        till = cp.get('tu_till', cp['till'])
        v = 1 / (1 + w_carry / 100)
        pv = self.bal
        parts, arr_tot, coll_tot = {}, 0.0, 0.0
        for k, (t, pax, nar, opex_allow, coll, w_t, tax_aero) in enumerate(cp['_acc']):
            w_ret = cp.get('tu_wacc', w_t)
            a, _, _ = self.building_block(t, w_ret, till, pax, nar, opex_allow, plan=None, parts=parts, tax_amt=tax_aero)
            pv += (a - coll) * v ** k
            arr_tot += a
            coll_tot += coll
        self.bal = pv * (1 + w_carry / 100) ** cp['n']
        if parts.get('return', 0) > 0:
            self.tax_ratio = parts['tax'] / parts['return']     # AERA plans the next CP's tax on what was actually paid
        self.trueups.append({'label': self.c['label'](t_end), 'value': self.bal, 'parts': parts, 'arr': arr_tot, 'coll': coll_tot})

    # --- tax with Indian loss rules -------------------------------------------------------------
    def tax(self, t, pbt, dep):
        if pbt < 0:
            loss = -pbt
            d = min(dep, loss)
            self.loss_dep += d
            if loss - d > 0:
                self.loss_bus.append((t, loss - d))
            return 0.0
        self.loss_bus = [(y, a) for y, a in self.loss_bus if t - y <= P['loss_carry_years']]
        inc = pbt
        nb = []
        for y, a in self.loss_bus:
            use = min(a, inc)
            inc -= use
            if a - use > 1e-9:
                nb.append((y, a - use))
        self.loss_bus = nb
        use = min(self.loss_dep, inc)
        self.loss_dep -= use
        inc -= use
        return P['tax_rate'] * inc

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
            ops = c['ops'](t) if c.get('ops') else {'Q': 1, 'dis': 0, 'sq': 0, 'opex': 1}
            # traffic
            y = c['card'](t) if c.get('card') else self.yields.get(t, 0.0)
            demand = c['demand'](t)
            if demand > 0 and lv.get('elasticity', True) and y > 0:
                norm, fare = P['yield_market_norm'] * pr, P['avg_fare'] * pr
                f = min(1.0, (1 + (y - norm) / fare) ** -P['demand_elasticity'])
            else:
                f = 1.0
            pax = min(demand * f, P['capacity_headroom'] * cap) if demand > 0 else 0.0
            pax *= c.get('pax_shock', {}).get(t, 1.0)
            if c.get('pax_actual'):
                pax = c['pax_actual'](t)
            # revenue
            billed = y * pax / 10
            aero = billed * (1 - ops['sq'])
            nar = c['nar'](t) * pax / 10
            opex_b = c['opex_bench'](t, cap, pax)
            dis = max(0.0, ops['dis'] - c.get('dis_in_opex', 0.0))     # BIAL's fitted O&M already holds a normal level
            opex = opex_b * ops['opex'] + dis * pr * pax / 10 + c.get('opex_extra', lambda t: 0.0)(t) if pax > 0 else 0.0
            fee = 0.0 if c.get('fee_waived', lambda t: False)(t) else c['fee'] * (aero + nar)
            oi = aero + nar
            ebitda = oi - opex - fee
            # debt
            interest = prin = 0.0
            for tr in c['tranches']:
                i, p = tr.step(t)
                interest += i
                prin += p
            ds = interest + prin
            dep = self.dep_total(t)
            renew = self.renewal_capex(t) if c.get('renewal_share') else 0.0
            if renew:
                c['vintages'].append(Vintage(renew, renew * P['aero_asset_share'], t + 1, life=self.renew_life(t)))
            tax = self.tax(t, ebitda - dep - interest, dep)
            if active is not None and not c.get('card') and pax > 0:
                active['_acc'].append((t, pax, nar, active.get('opex_share', CALIB['aero_opex_share']) * min(opex, opex_b),
                                       billed, self.wacc(active, t),
                                       (tax * aero / oi if oi > 0 else 0.0) if c.get('tax_passthrough') else None))
            cfads = ebitda - tax - renew
            dscr = cfads / ds if ds > 1e-6 else None
            dscr_pre = ebitda / ds if ds > 1e-6 else None
            row = {'t': t, 'label': c['label'](t), 'pax': pax, 'demand': demand, 'cap': cap, 'yield': y,
                   'aero': aero, 'nar': nar, 'oi': oi, 'opex': opex, 'fee': fee, 'ebitda': ebitda,
                   'margin': ebitda / oi if oi > 0 else None, 'interest': interest, 'principal': prin, 'ds': ds,
                   'dep': dep, 'tax': tax, 'renew': renew, 'cfads': cfads, 'dscr': dscr, 'dscr_pre': dscr_pre,
                   'debt': sum(tr.out for tr in c['tranches']), 'bal': self.bal}
            if c.get('waterfall'):
                self.waterfall(t, row)
            self.rows.append(row)
            if active is not None and t == active['start'] + active['n'] - 1 and not c.get('card'):
                self.true_up(active, t)
            if c.get('refi_rule'):
                c['refi_rule'](self, t)
        return self

    # --- cash: DSRA, sweep, state loan, equity, era board (lock-up, cure, step-in) ----------------
    def prepay(self, amt):
        done = 0.0
        tot = sum(tr.out for tr in self.c['tranches'] if tr.out > 0)
        if tot <= 0 or amt <= 0:
            return 0.0
        for tr in self.c['tranches']:          # pro rata, as design/eras.md section 7
            if tr.out > 0:
                done += tr.prepay(amt * tr.out / tot)
        return done

    def waterfall(self, t, row):
        c, lv = self.c, self.c['levers']
        eq = c['equity_need'].get(t, 0.0)
        cash_int = (max(self.cash, 0.0) + self.dsra) * P['cash_yield'] / 100 * (1 - P['tax_rate'])
        free = row['cfads'] - row['ds'] + cash_int
        cure = 0.0
        cash = self.cash
        unfunded = False
        # 1. a debt-service shortfall is met from the DSRA, then retained cash, then a cure (or it is a default)
        if free < 0:
            draw = min(self.dsra, -free)
            self.dsra -= draw
            free += draw
            use = min(max(cash, 0.0), -free)
            cash -= use
            free += use
            unfunded = False
            if free < -1e-6:
                if lv.get('cure'):
                    cure += -free          # the parent funds the missed payment at once (an immediate cure board)
                    free = 0.0
                elif not c.get('no_step_in'):
                    unfunded = True
        # 2. DSRA to two quarters of next year's debt service: top up from this year's flow, release any excess
        target = P['dsra_quarters'] / 4 * self.next_ds(t)
        if t < c.get('first_cod_t', 0):
            pass                                             # funded at close; held through construction
        elif self.dsra < target:
            top = min(max(free, 0.0), target - self.dsra)
            self.dsra += top
            free -= top
        else:
            free += self.dsra - target
            self.dsra = target
        # 3. covenant sweep below 1.10, whatever the retain lever says
        d = row['dscr']
        swept = 0.0
        if d is not None and d < J('finance.dscr_covenant_min') and free > 0 and not lv.get('forecast'):
            swept = self.prepay(free)
            free -= swept
        cash += free
        # 4. state loan instalment (subordinated)
        sl = c.get('state_loan')
        if sl and self.sl_out > 0 and not swept and t >= sl['first_t'] + (sl['defer'] if lv.get('defer_state_loan') and t >= sl['defer_from'] else 0):
            inst = min(self.sl_out, sl['amount'] / sl['n'], max(0.0, cash))
            self.sl_out -= inst
            cash -= inst
        # 5. capex equity: from retained cash first, the rest is called
        from_cash = min(max(0.0, cash), eq) if lv.get('fund_from_cash', True) else 0.0
        cash -= from_cash
        call = eq - from_cash
        # 6. the era board: era test on the minimum annual DSCR, cure or step-in, then distributions under the lock-up
        div = 0.0
        e = c['era'](t)
        if e is not None and (t + 1 >= c['T'] or c['era'](t + 1) != e):
            ds_rows = [r['dscr'] for r in self.rows if c['era'](r['t']) == e and r['dscr'] is not None]
            if d is not None:
                ds_rows.append(d)
            dmin = min(ds_rows) if ds_rows else None
            self.era_mins[e] = dmin
            if dmin is not None and dmin < J('finance.dscr_default') and not lv.get('forecast'):
                self.bad_eras += 1
                if self.bad_eras >= J('game.dscr_thresholds')['step_in_eras'] and self.step_in is None:
                    if lv.get('cure'):
                        debt = sum(tr.out for tr in c['tranches'])
                        x = debt * (1 - max(dmin, 0.0) / J('finance.dscr_covenant_min'))   # restores the DSCR pattern to 1.10
                        cure += self.prepay(x)
                        self.bad_eras = 0
                    elif not c.get('no_step_in'):
                        self.step_in = (t, 'era DSCR below 1.0 for two eras' + (' (and a debt-service payment it could not fund)' if unfunded else ''))
            else:
                self.bad_eras = 0
            if self.step_in is None and dmin is not None and cash > 0 and t >= lv.get('retain_until', 0):
                lk = J('finance.distribution_lockup')
                share = 0.0 if dmin < lk['nil_below'] else 0.5 if dmin < lk['half_below'] else 0.75 if dmin < lk['three_quarters_below'] else 1.0
                out = cash * share
                prep = self.prepay(out * lv.get('prepay_share', 0.0))
                div = out - prep
                cash -= out
                if lv.get('prepay_locked') and t >= lv.get('retain_until', 0):
                    cash -= self.prepay(cash)                # trapped cash pays down debt instead of idling at 0%
            elif self.step_in is None and dmin is None and cash > 0 and t >= lv.get('retain_until', 0):
                div = cash                                   # debt repaid: no lock-up
                cash = 0.0
        if unfunded and self.step_in is None:
            self.step_in = (t, 'a debt-service payment it could not fund (DSRA and cash empty)')
        self.cash = cash
        self.cures += cure
        self.calls += call
        flow = -call - cure + (div if self.step_in is None else 0.0)
        self.eq_flows[t] = self.eq_flows.get(t, 0.0) + flow
        self.divs += div
        row.update({'cash': self.cash, 'dsra': self.dsra, 'cash_int': cash_int, 'div': div, 'cure': cure, 'call': call, 'sl_out': self.sl_out, 'swept': swept})

    def next_ds(self, t):
        tot = 0.0
        for tr in self.c['tranches']:
            if tr.out <= 0:
                continue
            if tr.sched and (t + 1) in tr.sched:
                tot += tr.sched[t + 1] + tr.out * tr.r(t + 1) / 100
            elif t + 1 >= tr.cap_until:
                tot += tr.out * tr.r(t + 1) / 100
        return tot


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
DSCR_BASIS = bial_series('dscr_basis')
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


def bial_new_capacity(fy):
    """(greenfield mppa, expansion mppa) in their first (1.0) or second (0.5 greenfield / 1.0 expansion) year."""
    oc = P['opening_cost']
    if fy == 2009:
        return 11.4 * FY2009_DAYS / 365, 0.0
    if fy == 2010:
        return 11.4 * oc['greenfield_year2_share'], 0.0
    if fy in (2014, 2015):
        return 0.0, oc['expansion_new_mppa']
    if fy == 2023:
        return 0.0, 25 * 2.5 / 12
    if fy == 2024:
        return 0.0, 25.0
    return 0.0, 0.0


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
    cp2_aero = _CPS[2]['collections_cr']
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
    """Least squares on BIAL opex in FY2026 rupees, years that are not openings:
         opex = a x capacity (mppa) + b x pax (m), no intercept.
    Then the opening term on the residuals: greenfield k_g (FY2009) and expansion k_e (FY2014-15) times the fixed
    O&M of the newly commissioned capacity (a x new mppa). FY2023-24 (T2) are out of sample."""
    ox = bial_opex_actual()
    oc = P['opening_cost']
    opening = set(oc['fit_years_greenfield']) | set(oc['fit_years_expansion'])
    X, Y = [], []
    for fy, o in ox.items():
        if fy in opening:
            continue
        X.append((bial_capacity(fy), PAX[fy]))
        Y.append(o / PI[fy])
    s11 = sum(x[0] * x[0] for x in X); s12 = sum(x[0] * x[1] for x in X); s22 = sum(x[1] * x[1] for x in X)
    t1 = sum(x[0] * y for x, y in zip(X, Y)); t2 = sum(x[1] * y for x, y in zip(X, Y))
    det = s11 * s22 - s12 * s12
    a = (t1 * s22 - t2 * s12) / det
    b = (s11 * t2 - s12 * t1) / det

    def base(fy):
        days = FY2009_DAYS / 365 if fy == 2009 else 1.0
        return a * bial_capacity(fy) * days + b * PAX[fy]

    # one opening term for all new capacity, greenfield or expansion: one parameter on three points (a separate
    # greenfield k would fit FY2009, itself an estimate, exactly)
    years = oc['fit_years_greenfield'] + oc['fit_years_expansion']
    xs = [a * sum(bial_new_capacity(fy)) for fy in years]
    rs = [ox[fy] / PI[fy] - base(fy) for fy in years]
    kg = ke = sum(x * r for x, r in zip(xs, rs)) / sum(x * x for x in xs)
    g0 = oc['fit_years_greenfield']            # the alternative: a greenfield term on FY2009 alone (one estimated point)
    kg_alone = sum(a * bial_new_capacity(fy)[0] * (ox[fy] / PI[fy] - base(fy)) for fy in g0) / sum((a * bial_new_capacity(fy)[0]) ** 2 for fy in g0)
    resid = {}
    for fy, o in ox.items():
        g, e = bial_new_capacity(fy)
        mod = base(fy) + a * (kg * g + ke * e)
        tag = 'in' if fy not in oc['out_of_sample'] else 'out'
        resid[fy] = (mod / (o / PI[fy]) - 1, tag)
    CALIB['open_k_greenfield_alone'] = kg_alone
    return a, b * 10, kg, ke, resid      # a: crore per mppa; b: Rs per pax


def bial_vintages(L_old, L_new):
    """Aero RAB vintages that reproduce AERA's RAB anchors. Assets commissioned before FY2018 depreciate over L_old,
    later ones over L_new (AERA's useful-life order of 2017-18 moved airport assets to longer lives).
    Anchors used to solve the additions: opening RAB 1 Apr 2011 (1,359.39); average RAB FY2014 and FY2015 (CP1 order);
    opening FY2022 (4,427.38). CP3 additions are AERA Table 102, with T2 in service from 15 Jan 2023.
    Returns (vintages, error on the anchors not used to solve)."""
    cp1 = _CPS[1]['avg_rab_cr']
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
    shares = P['bt_vintage_shares_fy17_21']
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
    a, b, kg, ke, resid = fit_opex()
    CALIB.update({'opex_fixed_per_mppa': a, 'opex_per_pax': b, 'open_k_greenfield': kg, 'open_k_expansion': ke, 'opex_resid': resid})
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
    CALIB['opex_share_srt'] = cp1o['opex'] / sum(opex_model_bial(fy) for fy in range(2012, 2017))
    CALIB['aero_opex_share'] = cp3['opex'] / sum(opex_model_bial(fy) for fy in range(2022, 2027))


def opex_model_bial(fy, pax=None):
    """Recurring O&M (what AERA benchmarks). The opening cost is separate: bial_opening_cost."""
    pax = PAX[fy] if pax is None else pax
    days = FY2009_DAYS / 365 if fy == 2009 else 1.0
    return PI[fy] * (CALIB['opex_fixed_per_mppa'] * bial_capacity(fy) * days + CALIB['opex_per_pax'] * pax / 10)


def bial_opening_cost(fy):
    """Opening cost of new capacity. Not in AERA's allowance: with it allowed, the model's pre-control true-up is
    +342 against AERA's +54.87; without it, about +70."""
    a = CALIB['opex_fixed_per_mppa']
    g, e = bial_new_capacity(fy)
    return PI[fy] * a * (CALIB['open_k_greenfield'] * g + CALIB['open_k_expansion'] * e)


def bial_engine():
    vint, _ = bial_vintages(CALIB['dep_life_old'], CALIB['dep_life'])
    T = len(FYS)
    lbl = lambda t: f'FY{FY0 + t}'
    cp3 = _CPS[3]
    cp3_planned_pax = sum(cp3['aero_rev_planned_cr']) / cp3['ypp'] * 10
    cp3s = J('bial.aera.cp3_arr_and_shortfall')
    tu1 = P['bt_cp1_trueup_wacc']
    cps = [
        # pre-control (MoCA ad hoc tariff at opening, trued up later at 10.97% / 30% till)
        {'start': 0, 'n': 3, 'wacc': _CPS[0]['return'], 'till': 0.30, 'carry': 0.0, 'esc': 0.0, 'lag': [1, 1, 1], 'tu_wacc': tu1,
         'opex_share': CALIB['opex_share_srt']},
        # CP1: ordered 10 Jun 2014, effective Jul 2014 -> FY2012-14 at the old tariff, FY2015 a quarter
        {'start': 3, 'n': 5, 'wacc': _CPS[1]['return'], 'till': _CPS[1]['till_nar_share'], 'carry': 0.0, 'esc': 0.0,
         'lag': [1, 1, 1, .25, 0], 'fc_list': P['bial_cp1_order']['pax_m'], 'opex_share': CALIB['opex_share_srt'],
         'nar_plan_total': -P['bial_cp1_order']['nar_40pct'] / _CPS[1]['till_nar_share'],
         'tu_wacc': tu1, 'tu_till': 0.30},
        # CP2: ordered 31 Aug 2018, effective 16 Sep 2018; tariff escalates (UDF 100 -> 139 -> 179)
        {'start': 8, 'n': 5, 'wacc': _CPS[2]['return'], 'till': 0.30, 'carry': 0.0, 'esc': (179 / 100) ** 0.5 - 1,
         'lag': [1, 1, 5.5 / 12, 0, 0], 'tu_wacc': _CPS[2]['trueup_wacc']},
        # CP3: ordered 28 Aug 2021 (effective Oct 2021); 13.9% of PV ARR carried by design; back-loaded
        {'start': 13, 'n': 5, 'wacc': _CPS[3]['return'], 'till': 0.30,
         'carry': cp3s['shortfall_share_of_pv_arr'],
         'esc': ((cp3['aero_rev_planned_cr'][4] / PAX[2026]) / (cp3['aero_rev_planned_cr'][1] / PAX[2023])) ** (1 / 3) - 1,
         'lag': [0.5, 0, 0, 0, 0], 'fc_factor': cp3_planned_pax / sum(PAX[fy] for fy in range(2022, 2027)),
         'nar_plan_total': -cp3s['nar_30pct'] / 0.30,
         'tu_wacc': _CPS[3]['trueup_wacc']},
    ]
    # debt (nominal crore)
    bs = J('bial.close.balance_sheet_fy2010_fy2011')
    refi16 = J('bial.debt.refi_2016')
    t2 = J('bial.t2.financial_close')
    ncd = J('bial.debt.ncd_2021_22')
    g = P['bt_forward_growth']
    w = lambda t: PAX.get(FY0 + t, PAX[2026] * (1 + g) ** (FY0 + t - 2026)) * PI.get(FY0 + t, 1.04 ** (FY0 + t - 2026))
    rp = P['bt_p1_repayment']
    cod1 = _CPS[1]['cod']
    mk_p1 = lambda: Tranche('phase 1 (ICICI)', cod1, out=bs['secured_loans'][0], rep_start=rp['start_fy'] - FY0, rep_years=rp['years'], weights=w)
    # T1 expansion debt (FY2013-14) is derived, not assumed: what makes total senior debt at the Nov 2016 refinancing
    # equal its actual size (bial.debt.refi_2016, 1,813.74), given the phase-1 loan's schedule. Interest-only until the refi (est.).
    probe = mk_p1()
    for t in range(0, 2016 - FY0 + 1):
        probe.step(t)
    t1d = refi16['amount_cr'] - probe.out
    CALIB['bt_t1_debt'] = t1d
    p1 = mk_p1()
    t1l = Tranche('T1 expansion', cod1, draws={4: t1d / 2, 5: t1d / 2}, cap_until=5, rep_start=None)
    tr = [p1, t1l]

    def r2016(t):
        fy = FY0 + t
        return refi16['rate'] if fy <= 2019 else refi16['rate_2019'] if fy <= 2020 else refi16['rate_from_2020_08_21']

    def refi_rule(eng, t):
        if FY0 + t == 2016:
            for x in eng.c['tranches']:
                if x.name in ('phase 1 (ICICI)', 'T1 expansion'):
                    x.out, x.sched, x.rep_start = 0.0, {}, None
            fixed = {fy - FY0: v for fy, v in P['bt_refi16_early_principal'].items()}
            eng.c['tranches'].append(Tranche('2016 refi', r2016, out=refi16['amount_cr'], rep_start=2021 - FY0, rep_years=2034 - 2021,
                                             weights=w, fixed=fixed))
    # T2 loan: 10,206 cr drawn FY2020-23, IDC capitalised to COD (15 Jan 2023), repayment from FY2024 to Sep 2034
    t2r = lambda t: t2['rate_2020'] if FY0 + t <= 2023 else J('bial.aera.cp4_wacc')['cod']
    draws = {fy - FY0: s * t2['debt_cr'] for fy, s in P['bt_t2_draw_shares'].items()}
    tr.append(Tranche('T2 (SBI/Axis)', t2r, draws=draws, cap_until=2023 - FY0, cap_frac={2023 - FY0: P['bt_t2_capitalised_months'] / 12},
                      rep_start=2024 - FY0, rep_years=11, weights=w))
    tr.append(Tranche('NCDs 2021-22 (bullets 2027-32)', ncd['coupon'], draws={2022 - FY0: 1000, 2023 - FY0: 653.5},
                      rep_start=None))
    # Before AERA's first order (MoCA ad hoc tariff, FY2009-14) and in each order's lag, BIAL charged the old card:
    # that tariff is an input (actual aero revenue / pax).
    old_yield = lambda t: AERO_D[FY0 + t] / PAX[FY0 + t] * 10
    cfg = {
        'T': T, 'label': lbl, 'price': lambda t: PI[FY0 + t], 'cps': cps, 'vintages': vint, 'tranches': tr,
        'demand': lambda t: PAX[FY0 + t], 'pax_actual': lambda t: PAX[FY0 + t],
        'fc_pax': lambda t: PAX[FY0 + t] if FY0 + t != 2021 else P['bt_fc_fy2021'],
        'cap': lambda t: bial_capacity(FY0 + t), 'nar': lambda t: NAR[FY0 + t] / PAX[FY0 + t] * 10,
        'nar_bench': lambda t: NAR[FY0 + t] / PAX[FY0 + t] * 10,
        'opex_bench': lambda t, cap, pax: opex_model_bial(FY0 + t, pax), 'opex_extra': lambda t: bial_opening_cost(FY0 + t),
        'fee': FEE, 'levers': {'elasticity': False}, 'old_yield': old_yield, 'refi_rule': refi_rule,
    }
    return Engine(cfg).run()


def backtest():
    eng = bial_engine()
    lag_input = set()
    for cp in eng.c['cps']:
        for k, l in enumerate(cp.get('lag', [])):
            if l >= 1:
                lag_input.add(FY0 + cp['start'] + k)
    out = []
    for r in eng.rows:
        fy = int(r['label'][2:])
        a_y = AERO_D[fy] / PAX[fy] * 10 if AERO_D.get(fy) else None
        out.append({'fy': fy, 'op_year': fy - FY0 + 1, 'pax': PAX[fy],
                    'yield_act': a_y, 'yield_mod': r['aero'] / r['pax'] * 10 if r['pax'] else None, 'yield_input': fy in lag_input,
                    'ebitda_act': EBITDA[fy], 'ebitda_mod': r['ebitda'], 'margin_act': MARGIN[fy], 'margin_mod': r['margin'],
                    'dscr_act': DSCR[fy], 'dscr_basis': DSCR_BASIS[fy], 'dscr_mod': r['dscr_pre'], 'interest_mod': r['interest'], 'principal_mod': r['principal'],
                    'interest_act': J('bial.path.interest_cr')[fy - FY0], 'principal_act': J('bial.path.principal_cr')[fy - FY0],
                    'debt_mod': r['debt'], 'yield_basis': 'R' if AERO[fy] else ('D' if AERO_D.get(fy) else None)})
    return eng, out


# ---------------------------------------------------------------------------------------------
# VSI: its own premise, BIAL's unit costs and mechanisms
# ---------------------------------------------------------------------------------------------
ERAS = [(1, 5, 7), (2, 8, 10), (3, 11, 13), (4, 14, 18)] + [(e, 19 + 5 * (e - 5), 23 + 5 * (e - 5)) for e in range(5, 12)] + [(12, 54, 60)]


def era_of(year):
    for e, a, b in ERAS:
        if a <= year <= b:
            return e
    return None


def vsi_level(year):
    mv = P['vsi_move_years']
    return 1 if year < mv[2] else 2 if year < mv[3] else 3 if year < mv[4] else 4


def ops_at(profile, year):
    """The shift outcome in force in a game year (Level 5 from era 5)."""
    o = P['ops_profiles'][profile]
    i = 4 if year >= 19 else vsi_level(year) - 1
    return {k: v[i] for k, v in o.items()}


def vsi_demand_fn(profile, drag_by_year=None):
    """Annual demand (m pax) from the design-day premise: the level's design day on its move-in date, then
    market growth (world.game_traffic_growth) plus the ops star bonus. Same as design/eras.md section 3."""
    dd = J('game.design_day_movements_by_level')
    move = P['vsi_move_years']
    ppm = P['vsi_ppm']
    g = J('world.game_traffic_growth')['cagr_by_era']
    p2a = J('game.peak_day_to_annual')
    cache = {}

    def D(year):
        if year < 5:
            return 0.0
        if year in cache:
            return cache[year]
        L = vsi_level(year)
        base = dd[str(L)] * ppm[L] * p2a / 1e6
        for t in range(move[L] + 1, year + 1):
            base *= 1 + g[min(11, (t - 1) // 5)] + ops_at(profile, t)['star'] + (drag_by_year(t) if drag_by_year else 0.0)
        cache[year] = base
        return base
    return D


SCEN = {
    'EXPERT': {'gearing': 0.75, 'phase1': 'lean', 'state_loan': True, 'defer_state_loan': True, 'push': 'normal',
               'profile': 'sculpt', 'refi': True, 'cure': True, 'retain_until': 0, 'prepay_share': 0.0,
               'phase2': True, 'ops': 'expert', 'fee': None, 'card': None, 'shock': False, 'prepay_locked': False},
    'BAD': {'gearing': 0.75, 'phase1': 'lean', 'state_loan': False, 'defer_state_loan': False, 'push': 'hard',
            'profile': 'sculpt', 'refi': False, 'cure': False, 'retain_until': 0, 'prepay_share': 0.0,
            'phase2': False, 'ops': 'poor', 'fee': None, 'card': None, 'shock': False},
    'LAZY': {'gearing': 0.70, 'phase1': 'lean', 'state_loan': False, 'defer_state_loan': False, 'push': 'normal',
             'profile': 'sculpt', 'refi': False, 'cure': False, 'retain_until': 0, 'prepay_share': 0.0,
             'phase2': False, 'ops': 'lazy', 'fee': None, 'card': None, 'shock': False},
}
PUSH = {'soft': {'shock_carry': P['soft_push_carry'], 'esc': None, 'hard': False},
        'normal': {'shock_carry': P['tariff_shock_carry'], 'esc': None, 'hard': False},
        'hard': {'shock_carry': 0.0, 'esc': 0.0, 'hard': True}}


def stage_names(s, with_p2):
    return ['1A_' + s['phase1'], '1B_' + s['phase1'], '1C', '1D'] + (['P2'] if with_p2 else [])


def stage_key(n):
    return '1A' if n.startswith('1A') else '1B' if n.startswith('1B') else 'T2' if n in ('1C', '1D') else 'P2'


def vsi_build(s, gear, scheds, base, with_p2, sizing_weights=None, label='?'):
    """One VSI run. gear = {stage: debt share}; scheds = {stage: {t: principal}} (None = sculpt in-run on
    sizing_weights[stage]). base = the lender base case (base ops, no carry, no push costs, no shock, no refi)."""
    cpi = P['cpi_forward']
    pr = lambda t: (1 + cpi) ** t          # t = game year - 1
    st = P['vsi_stages']
    lt = P['vsi_loan_terms']
    names = stage_names(s, with_p2)
    delay = 0 if base else s.get('delay', 0)      # 1A opens late (BIAL's T2: 21 months); the bank sized on time
    planned_cod1 = st[names[0]]['cod']
    if delay:
        st = {k: dict(v) for k, v in st.items()}
        st[names[0]]['cod'] += delay
    y_open = st[names[0]]['cod']
    prof = 'base' if base else s['ops']
    ops = lambda t: ops_at(prof, t + 1)
    push = PUSH['normal'] if base else PUSH[s['push']]
    hard_cp = push['hard']
    drag = (lambda y: P['airline_relations_drag'] if y >= 5 else 0.0) if hard_cp else None
    D = vsi_demand_fn(prof, drag)
    Dbase = vsi_demand_fn('base')
    disallow = P['push_hard_disallowance'] if hard_cp else 0.0

    def cap_year(year):
        c = 0.0
        for n in names:
            if year >= st[n]['cod']:
                if n == 'P2':
                    ramp = J('world.game_capacity')['ramp']
                    k = min(2, year - st[n]['cod'])
                    c = st['1D']['cap'] + (st['P2']['cap'] - st['1D']['cap']) * ramp[k]
                else:
                    c = st[n]['cap']
        return c
    cap = lambda t: cap_year(t + 1)
    fc_pax = lambda t: min(Dbase(t + 1), P['capacity_headroom'] * cap_year(t + 1))
    a_fix, b_var = CALIB['opex_fixed_per_mppa'], CALIB['opex_per_pax']

    def opx(t, c, pax):
        if c <= 0 or t < 4:
            return 0.0
        return pr(t) * (a_fix * c + b_var * pax / 10)

    def opening_cost(t):
        """BIAL's opening cost: greenfield in years 5 (full) and 6 (half); expansions in their first two years.
        Borne by the operator: AERA does not allow it (see bial_opening_cost)."""
        y = t + 1
        if y < y_open:
            return 0.0
        new_g = cap_year(y_open) if y == y_open else cap_year(y_open) * P['opening_cost']['greenfield_year2_share'] if y == y_open + 1 else 0.0
        new_e = 0.0
        for k in (0, 1) if not (s.get('no_expansion_opening') and not base) else ():
            if y - k > y_open:
                new_e += max(0.0, cap_year(y - k) - cap_year(y - k - 1))
        kg = CALIB['open_k_greenfield_alone'] if s.get('greenfield_alone') else CALIB['open_k_greenfield']
        return pr(t) * a_fix * (kg * new_g + CALIB['open_k_expansion'] * new_e)
    # stage financing with IDC (closed form per year) and the state loan on 1A
    vintages, tranches, equity_need, stage_list = [], [], {}, []
    sl_amt = 0.0
    slt = P['state_loan_terms']
    for n in names:
        sd = st[n]
        g = gear[n]
        rc = P['idc_constr_rate'] / 100
        out, total, draws, idc_tot = 0.0, 0.0, {}, 0.0
        sl_share = slt['share_of_built_cost'] if (s['state_loan'] and n.startswith('1A_')) else 0.0
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
        vintages.append(Vintage(total, total * P['aero_asset_share'] * (1 - disallow), cod_t, 1.0, stage=n,
                                life=min(CALIB['dep_life'], 60 - cod_t)))
        stage_list.append({'name': n, 'spend_t': [y - 1 for y in sd['spend']], 'cost_nominal': total, 'idc': idc_tot, 'debt': out, 'gearing': g})
        terms = lt[stage_key(n)]
        rep_start = terms['rep_start'] - 1 if 'rep_start' in terms else (planned_cod1 - 1 if (delay and n == names[0]) else cod_t) + terms['mor']
        cap_t = planned_cod1 - 1 if (delay and n == names[0]) else cod_t   # late: interest falls due from the planned COD
        if scheds.get(n) is not None:
            trn = Tranche(n, terms['rate'], draws=draws, cap_until=cap_t, rep_start=rep_start, rep_years=terms['years'],
                          profile='fixed', sched=scheds[n])
        else:
            trn = Tranche(n, terms['rate'], draws=draws, cap_until=cap_t, rep_start=rep_start, rep_years=terms['years'],
                          profile=s['profile'], weights=(sizing_weights or {}).get(n, lambda t, pr=pr: 1.0),
                          target_mode=sizing_weights is not None and n in sizing_weights and n != 'P2')
        trn.out_planned = out
        trn.cod_t = cod_t
        tranches.append(trn)
    # DSRA funded at financial close, inside the 1A financing: two quarters of the first operating year's interest
    t1a = tranches[0]
    g1a = gear[names[0]]
    dsra0 = P['dsra_quarters'] / 4 * t1a.out_planned * t1a.rate / 100
    last = max(t1a.draws)
    t1a.draws[last] += g1a * dsra0
    equity_need[last] = equity_need.get(last, 0.0) + (1 - g1a) * dsra0
    state_loan = {'amount': sl_amt, 'n': slt['instalments'], 'first_t': slt['first_year_after_close'] - 1,
                  'defer': slt['deferral_years'], 'defer_from': slt['defer_from_year'] - 1} if sl_amt > 0 else None
    total_capex_to = lambda t: sum(sg['cost_nominal'] for sg, n in zip(stage_list, names) if st[n]['cod'] - 1 <= t)
    self_ref = {}

    def wacc(t):
        e = self_ref['eng']
        rates = [(tr.out, tr.r(t)) for tr in e.c['tranches'] if tr.out > 0]
        cod = sum(o * r for o, r in rates) / sum(o for o, r in rates) if rates else J('finance.loan_rate_base')
        nd = P['notional_debt_share_wacc']
        w = (1 - nd) * P['coe'] + nd * cod
        ws = e.sl_out / total_capex_to(t) if total_capex_to(t) > 0 else 0.0
        return (1 - ws) * w
    # control periods: CP1 at opening (year 5), every 5 years; the T2-analog CP carries part of PV(ARR)
    shock_cps = set()
    cps = []
    for k in range(12):
        start = 4 + 5 * k
        if start >= 60 or (cps and cps[-1]['start'] + cps[-1]['n'] >= 60):
            break
        n = 60 - start if 60 - start < 10 else 5      # the last CP runs to year 60: no 1-year stub
        b_in = any(start <= st[x]['cod'] - 1 < start + n for x in names if x in ('1C', '1D'))
        carry = (0.0 if (base or s.get('no_carry')) else push['shock_carry']) if b_in else 0.0
        if start + n >= 60:
            carry = 0.0
        if b_in:
            shock_cps.add(k + 1)
        lag = [0.0] * n if k == 0 else [P['aera_order_lag']] + [0.0] * (n - 1)
        cps.append({'start': start, 'n': n, 'wacc': wacc, 'till': J('till.hybrid_till_nar_share'),
                    'carry': carry, 'lag': lag, 'esc': cpi if push['esc'] is None else push['esc']})
    nar0, nar1 = J('nonaero.zmi_per_pax_start'), J('nonaero.zmi_per_pax_mature')

    def nar_pp_real(year, prof_):
        v = nar0
        for e in range(1, max(1, era_of(year) or 1)):
            a = ERAS[e - 1][1]
            v += (nar1 - v) * P['nar_convergence'] * ops_at(prof_, a)['Q']
        return v
    fee = J('bial.ca.concession_fee') if s['fee'] is None else s['fee']
    card = None
    if s['card'] == 'DEL':
        dial = J('aero.dial_aero_revenue_fy26_cr')
        card = lambda t: dial['total'] / J('benchmarks.dial_revenue_fy26_cr')['pax_m'] * 10 * pr(t) if t >= 4 else 0.0
    elif s['card'] == 'NMIA':
        u = J('aero.udf_greenfield_opening_nmia')
        intl = J('world.game_traffic_growth')['intl_share_start']
        udf_share = J('aero.dial_aero_revenue_fy26_cr')['udf'] / J('aero.dial_aero_revenue_fy26_cr')['total']
        card = lambda t: (0.5 * ((1 - intl) * u['dom_dep'] + intl * u['intl_dep'])) / udf_share * pr(t) if t >= 4 else 0.0
    rs = P['renewal_share']
    life = CALIB['dep_life']
    renewal = lambda t: 0.0 if t < 4 else min(rs['full'], rs['start'] + (rs['full'] - rs['start']) * (t - 4) / life)
    shock = P['covid_shock'] if (s.get('shock') and not base) else None

    def refi_rule(eng, t):
        rf = P['refi']
        if base or not s['refi'] or eng.refi_done:
            return
        last_cod = max(st[n]['cod'] for n in names if n != 'P2') - 1
        if t < last_cod + rf['stable_years'] - 1:
            return
        last = [r['dscr'] for r in eng.rows[-rf['stable_years']:]]
        if len(last) < rf['stable_years'] or any(d is None or d < rf['stable_dscr'] for d in last):
            return
        old = [x for x in eng.c['tranches'] if x.out > 0 and t >= x.cap_until]
        amt = sum(x.out for x in old)
        for x in old:
            x.out, x.sched, x.rep_start = 0.0, {}, None
        bw = eng.c['refi_weights']
        eng.c['tranches'].append(Tranche('refi', rf['rate'], out=amt, rep_start=t + 1 + rf['moratorium'],
                                         rep_years=rf['tenor'], profile='sculpt', weights=bw))
        eng.refi_done = t + 1
    cfg = {
        'T': 60, 'label': lambda t: f'Y{t + 1}', 'price': pr, 'cps': cps, 'vintages': vintages, 'tranches': tranches,
        'demand': lambda t: D(t + 1), 'fc_pax': fc_pax, 'cap': cap, 'ops': ops,
        'nar': lambda t: nar_pp_real(t + 1, prof) * ops(t)['Q'] * pr(t),
        'nar_bench': lambda t: nar_pp_real(t + 1, 'base') * ops_at('base', t + 1)['Q'] * pr(t),
        'opex_bench': opx, 'opex_extra': lambda t: opening_cost(t) + (P['land_rent']['bial_style_cr_per_year'] * pr(t) if s.get('land') == 'bial' and t >= 4 else 0.0), 'fee': fee, 'fee_in_arr': True, 'card': card,
        'fee_waived': (lambda t: (t + 1) in shock['years']) if shock else (lambda t: False),
        'pax_shock': {y - 1: m for y, m in shock['years'].items()} if shock else {},
        # the bank's base case has no payout policy: nothing is prepaid, so the sculpted schedules it produces sum to the loans
        'levers': {'elasticity': True, 'cure': True if base else s['cure'], 'retain_until': 0 if base else s['retain_until'] - 1,
                   'prepay_locked': False if base else s.get('prepay_locked', False),
                   'prepay_share': 0.0 if base else s['prepay_share'], 'defer_state_loan': s['defer_state_loan'],
                   'forecast': base},       # the base case is the bank's forecast: no sweeps or cures move its schedules
        'waterfall': True, 'equity_need': equity_need, 'no_step_in': bool(s.get('compare')) and not base, 'era': lambda t: era_of(t + 1), 'state_loan': state_loan,
        'stage_list': stage_list, 'renewal_share': renewal, 'refi_rule': refi_rule, 'refi_weights': lambda t: 1.0,
        'first_cod_t': st[names[0]]['cod'] - 1, 'life_to_end': True, 'tax_passthrough': True,
        'dis_in_opex': P['ops_profiles']['base']['dis'][0],
    }
    eng = Engine(cfg)
    self_ref['eng'] = eng
    eng.dsra = dsra0
    eng.dsra0 = dsra0
    eng.label = label
    eng.scen = s
    eng.stage_list = stage_list
    eng.sl_amt = sl_amt
    eng.names = names
    eng.shock_cps = shock_cps
    return eng


def size_debt(s):
    """The bank. Lender base case (design/eras.md section 7): base ops, AERA without the tariff-shock carry, stages
    on time, no phase 2 for the mandatory stages. Each stage, in order of first repayment, is sculpted on the
    capacity CFADS_base / 1.30 left by the earlier stages and capped at the player's gearing: if the stage needs more
    than its capacity (k > 1) or the interest-only years after COD fall below 1.15x, its gearing is cut. Iterated to a
    fixed point (IDC, RAB, ARR, tax and CFADS all move with the debt). Phase 2 is sized the same way when ordered, on
    a base case that includes it, with the mandatory schedules fixed."""
    tgt, mc = P['lbc_dscr_target'], P['lbc_moratorium_cover']
    lt = P['vsi_loan_terms']

    def default_gear(n):
        k = stage_key(n)
        return s['gearing'] if k in ('1A', '1B') else lt[k]['debt_share']

    def solve(names, fixed_scheds, with_p2, fixed_gear=None):
        gear = {n: (fixed_gear or {}).get(n, default_gear(n)) for n in names}
        cap_g = dict(gear)
        weights = {n: None for n in names}
        prev = None
        for it in range(30):
            sizing_w = {}
            if prev is not None:
                cf = {r['t']: r['cfads'] for r in prev.rows}
                order = sorted([tr for tr in prev.c['tranches'] if tr.name in names and tr.name not in fixed_scheds],
                               key=lambda x: x.rep_start)
                fixed_ds = {}
                for tr in prev.c['tranches']:
                    if tr.name in fixed_scheds:
                        for t, v in tr.ds_hist.items():
                            fixed_ds[t] = fixed_ds.get(t, 0.0) + v
                for i, tr in enumerate(order):
                    earlier = order[:i]
                    later = order[i + 1:]

                    def w(t, tr=tr, earlier=earlier, later=later):
                        used = fixed_ds.get(t, 0.0) + sum(e.ds_hist.get(t, 0.0) for e in earlier)
                        used += sum(l.int_hist.get(t, 0.0) for l in later)
                        return max(1e-6, cf.get(t, 0.0) / tgt - used)
                    sizing_w[tr.name] = w
            used = dict(gear)
            eng = vsi_build(s, used, dict(fixed_scheds), True, with_p2, sizing_w if prev is not None else
                            {n: (lambda t: max(1.0, (t + 1) ** 1.0)) for n in names}, 'lender base case').run()
            change = 0.0
            if prev is not None:
                for tr in eng.c['tranches']:
                    if tr.name not in gear or tr.name in fixed_scheds:
                        continue
                    # room = how much bigger (>1) or smaller (<1) this stage's loan could be: sculpt capacity (1/k)
                    # and interest cover in its interest-only years after COD
                    room = 1.0 / tr.k if tr.k else 1.0
                    for t in range(tr.cod_t, tr.rep_start):
                        r = eng.rows[t]
                        own = tr.ds_hist.get(t, 0.0)
                        if own > 1e-6:
                            room = min(room, (r['cfads'] / mc - (r['ds'] - own)) / own)
                    room = min(1.5, max(0.3, room))
                    newg = min(cap_g[tr.name], gear[tr.name] * room ** 0.7)
                    change = max(change, abs(newg - gear[tr.name]))
                    gear[tr.name] = newg
            ds_change = max(abs(a['ds'] - b['ds']) for a, b in zip(eng.rows, prev.rows)) if prev is not None else 1e9
            prev, prev_gear = eng, used
            if it > 2 and change < 1e-4 and ds_change < 1.0:     # gearing and every year's debt service settled
                break
        CALIB.setdefault('sizing_iterations', []).append((it + 1, change, ds_change))
        scheds = {tr.name: dict(tr.sched or {}) for tr in prev.c['tranches'] if tr.name in names}
        return prev_gear, scheds, prev      # the gearing the schedules were built on

    mand = stage_names(s, False)
    gear, scheds, base_eng = solve(mand, {}, False)
    if s['phase2']:
        allnames = stage_names(s, True)
        fixed = {n: scheds[n] for n in mand}
        g2, sc2, base_eng = solve(allnames, fixed, True, {n: gear[n] for n in mand})
        gear.update({'P2': g2['P2']})
        scheds['P2'] = sc2['P2']
    return gear, scheds, base_eng


def vsi_engine(s, label='?'):
    if s.get('compare'):
        # comparison rows: the expert's own bank-sized debt, priced on another airport's card; not stopped by step-in
        gear, scheds, base_eng = size_debt(dict(s, card=None, fee=None))
    else:
        gear, scheds, base_eng = size_debt(s)
    if s['profile'] == 'equal':
        # equal instalments on the bank-sized loan: the bank only lends what the annuity covers at 1.30 on the base case
        eqs = dict(s)
        gear_e = dict(gear)
        for _ in range(20):
            b = vsi_build(eqs, gear_e, {}, True, s['phase2'], None, 'base equal').run()
            worst = min((r['cfads'] / r['ds'] for r in b.rows if r['ds'] > 0 and 4 <= r['t'] <= 40), default=2)
            f = min(1.0, worst / P['lbc_dscr_target'])
            if f > 0.999:
                break
            gear_e = {n: g * f ** 0.7 for n, g in gear_e.items()}
        gear, scheds, base_eng = gear_e, {}, b
    base_cf = {r['t']: r['cfads'] for r in base_eng.rows}
    eng = vsi_build(s, gear, scheds, False, s['phase2'], None, label)
    p2ds = {}
    for tr in base_eng.c['tranches']:
        if tr.name == 'P2':
            p2ds = tr.ds_hist
    # the refinancing is sculpted in proportion to the capacity left after phase 2 (BIAL 2025: re-profiled, not paid faster)
    eng.c['refi_weights'] = lambda t: max(1e-6, base_cf.get(t, 0.0) / P['lbc_dscr_target'] - p2ds.get(t, 0.0))
    eng.gear = gear
    eng.base = base_eng
    eng.compare = bool(s.get('compare'))
    if not s.get('compare') and s['profile'] != 'equal':
        mand = stage_names(s, False)
        bm = vsi_build(s, gear, {n: scheds[n] for n in mand}, True, False, None, 'lender base case')
        bm.gear = gear
        eng.base_mand = bm.run()
    eng.run()
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
        out[e] = {'agg': cf / ds if ds > 0 else None, 'min': min(mins) if mins else None,
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


def fl(v):
    return f'{math.floor(v * 100) / 100:.2f}'     # floored, so 0.997 never prints as 1.00


def print_calibration():
    print('### Calibrated mechanism parameters (from BIAL data, no fudge factors)\n')
    print('"In-sample" = fitted to the figure it is compared with, so it validates nothing. Only the out-of-sample lines test the mechanism.\n')
    print('| Parameter | Value | How | Fit |')
    print('|---|---|---|---|')
    print(f"| Asset life, assets before FY2018 | {CALIB['dep_life_old']:.1f} years | fitted to AERA CP1 depreciation ₹789.23 cr (model {CALIB['dep_cp1']:,.0f}) | in-sample |")
    print(f"| Asset life, assets from FY2018 (used for VSI) | {CALIB['dep_life']:.1f} years | fitted to AERA CP3 depreciation ₹2,427.57 cr (model {CALIB['dep_cp3']:,.0f}) | in-sample |")
    print(f"| RAB anchors not used in the fit | {', '.join(f'FY{k % 100:02d} {v * 100:+.0f}%' for k, v in CALIB['rab_err'].items())} | model average RAB vs AERA | out-of-sample |")
    ins = [f"FY{k % 100:02d} {v * 100:+.0f}%" for k, (v, tag) in CALIB['opex_resid'].items() if tag == 'in']
    outs = [f"FY{k % 100:02d} {v * 100:+.0f}%" for k, (v, tag) in CALIB['opex_resid'].items() if tag == 'out']
    print(f"| O&M fixed cost | ₹{CALIB['opex_fixed_per_mppa']:.2f} cr per mppa of capacity per year (FY2026 ₹) | least squares on BIAL opex (OI − EBITDA − 4% fee), years that are not openings | in-sample |")
    print(f"| O&M variable cost | ₹{CALIB['opex_per_pax']:.0f} per passenger (FY2026 ₹) | same fit | in-sample |")
    print(f"| Opening cost of new capacity | {CALIB['open_k_greenfield']:.2f} × the fixed O&M of the new capacity (greenfield: year 1, half in year 2, est.; expansion: years 1 and 2) | one term, least squares on the O&M residuals of FY2009 (opening) and FY2014-15 (T1) | in-sample |")
    print(f"| O&M model residuals | {', '.join(ins)} | model ÷ actual − 1 | in-sample |")
    print(f"| O&M model residuals, T2 opening | {', '.join(outs)} | model ÷ actual − 1 | out-of-sample |")
    print(f"| O&M in the ARR, shared-revenue till (pre-control, CP1) | {CALIB['opex_share_srt']:.2f} × modelled O&M | AERA CP1 allowed O&M ₹1,399.60 cr ÷ modelled FY2012-16 | in-sample |")
    print(f"| O&M in the ARR, hybrid till (CP2 on; used for VSI) | {CALIB['aero_opex_share']:.2f} × modelled O&M | AERA CP3 allowed O&M ₹2,669.89 cr ÷ modelled FY2022-26 | in-sample |")
    print(f"| Tax in the ARR | {CALIB['tax_share'] * 100:.1f}% of the return | AERA CP3 + CP4 tax ÷ return. Back-test plans and true-ups use it (BIAL's low actual tax, from its losses and the s.80-IA infrastructure deduction (est.), is not modelled). VSI uses it only for its first plan; after that AERA passes through the aero share of the tax VSI actually pays | in-sample |")
    print(f"| Non-aero FY2017-21 scale | ×{NAR_CP2_SCALE:.2f} | interpolated NAR scaled so OI − NAR = CP2 aero total ₹4,263 cr | input |")
    print(f"| T1 expansion debt (derived) | ₹{CALIB['bt_t1_debt']:,.0f} cr | 2016 refinancing ₹1,813.74 cr less the phase-1 loan left at FY2016 | input |")
    print()


def mae(pairs):
    pairs = [(m, a) for m, a in pairs if m is not None and a]
    return (sum(abs(m / a - 1) for m, a in pairs) / len(pairs), len(pairs)) if pairs else (None, 0)


def print_backtest(eng, out):
    print('### Back-test: BIAL actual vs the mechanism on BIAL inputs\n')
    print('Actual: `bial.path`. Yield: D = derived from OI − NAR; "input" = a year billed at the tariff BIAL actually charged (before AERA\'s first order, or inside an order\'s lag), so the model copies it and it is left out of the error. EBITDA basis: R reported, D derived from a reported margin, E estimate. DSCR on both sides = EBITDA ÷ (interest + scheduled principal); E = BIAL figure is an estimate (`bial.path.dscr_basis`). Interest and principal "act" values are all derived or estimated. Nominal ₹ crore.\n')
    print('| FY | Op yr | Pax (m) | Yield act | Yield model | err | EBITDA act | EBITDA model | err | Margin act | Margin model | DSCR act | DSCR model | Int act | Int model | Prin act | Prin model |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    eb = P['bial_ebitda_basis']
    for o in out:
        ya = f(o['yield_act']) + (' D' if o['yield_basis'] == 'D' else '')
        ye = 'input' if o['yield_input'] else err(o['yield_mod'], o['yield_act'])
        da = f(o['dscr_act'], 2) + (' E' if o['dscr_act'] is not None and o['dscr_basis'] == 'E' else '')
        ea = f(o['ebitda_act']) + (f" {eb.get(o['fy'], '')}" if o['ebitda_act'] else '')
        ia = f(o['interest_act']) + (' E' if o['interest_act'] is not None else '')
        pa = f(o['principal_act']) + (' E' if o['principal_act'] is not None else '')
        print(f"| {o['fy']} | {o['op_year']} | {o['pax']:.1f} | {ya} | {f(o['yield_mod'])} | {ye} | {ea} | {f(o['ebitda_mod'])} | {err(o['ebitda_mod'], o['ebitda_act'])} | {f(o['margin_act'], 0, True)} | {f(o['margin_mod'], 0, True)} | {da} | {f(o['dscr_mod'], 2)} | {ia} | {f(o['interest_mod'])} | {pa} | {f(o['principal_mod'])} |")
    y_e, y_n = mae([(o['yield_mod'], o['yield_act']) for o in out if not o['yield_input']])
    n_in = sum(1 for o in out if o['yield_input'])
    e_all, e_n = mae([(o['ebitda_mod'], o['ebitda_act']) for o in out])
    e_r, e_rn = mae([(o['ebitda_mod'], o['ebitda_act']) for o in out if eb.get(o['fy']) == 'R'])
    d_all, d_n = mae([(o['dscr_mod'], o['dscr_act']) for o in out])
    d_r = [o for o in out if o['dscr_act'] and o['dscr_basis'] == 'R']
    real = [('pre-control (FY09-11)', 54.87), ('CP1 (FY12-16)', -313.62), ('CP2 (FY17-21)', -974.14), ('CP3 (FY22-26)', 603.38)]
    tu = [(lab, eng.trueups[k]['value'], a) for k, (lab, a) in enumerate(real) if k < len(eng.trueups)]
    CALIB['bt_summary'] = {'yield': y_e, 'n_yield': y_n, 'n_input': n_in, 'ebitda': e_all, 'n_ebitda': e_n, 'ebitda_r': e_r, 'n_ebitda_r': e_rn,
                           'dscr': d_all, 'n_dscr': d_n, 'tu': tu}
    print('\n**Back-test honesty.**\n')
    print(f"- Aero yield: mean absolute error **{y_e * 100:.0f}%** over the {y_n} years the model calculates; {n_in} years are \"input\" (copied) and excluded.")
    print(f"- EBITDA: {e_all * 100:.0f}% over {e_n} years with a BIAL figure ({e_r * 100:.0f}% over the {e_rn} reported years, FY2014-17; FY2009 is in-sample through the opening term).")
    print(f"- DSCR: {d_all * 100:.0f}% over {d_n} years, but {d_n - len(d_r)} of them are BIAL estimates; the one reported year, FY2019, is off {(d_r[0]['dscr_mod'] / d_r[0]['dscr_act'] - 1) * 100:+.0f}%. The DSCR path is not reproduced year by year.")
    print('- True-ups (the real out-of-sample test of the regulator mechanism), model vs AERA, ₹ cr: ' + '; '.join(
        f"{lab} {m:+,.0f} vs {a:+,.2f}" for lab, m, a in tu) + '. Signs match in every period; sizes miss by up to ' +
        f"{max(abs(m / a) if abs(m) > abs(a) else abs(a / m) for lab, m, a in tu):.1f}×.")
    mg = [(o['fy'], o['margin_act'], o['margin_mod']) for o in out if o['margin_act']]
    print('- Margin arc, BIAL vs model: ' + ', '.join(f"FY{fy % 100:02d} {a * 100:.0f}/{m * 100:.0f}%" for fy, a, m in mg) +
          '. The plateau near 70%, the dip at T2 and the recovery are followed. Two misses: the opening is less tight than BIAL\'s '
          '(one opening term fits three openings, so it under-fits FY2009), and FY2024 is too low (the same term adds an opening '
          'cost to T2 that BIAL\'s accounts do not show: O&M +45% out of sample).\n')
    print('Control-period plans and true-ups (model vs AERA):\n')
    print('| CP start | WACC | Model YPP (ARR ÷ forecast pax) | True-up carried out of the CP (model) | AERA true-up |')
    print('|---|---|---|---|---|')
    realtxt = ['+54.87 at Mar 2011 (→ +179.76 by 2022)', '−313.62 at Mar 2016', '−974.14 at Mar 2022', '+603.38 at Mar 2027']
    for k, p in enumerate(eng.plans):
        tuv = eng.trueups[k]['value'] if k < len(eng.trueups) else None
        print(f"| {p['label']} | {p['wacc']:.2f}% | ₹{p['ypp']:.0f} | {f(tuv, 1)} | {realtxt[k]} |")
    print()
    print('Building block over the control period, model vs AERA (₹ cr, 5 years). The plan rows use AERA\'s own traffic and non-aero forecasts and the fitted lives, O&M share and tax share, so the ARR match is in-sample; the true-ups are the test.\n')
    print('| CP | Basis | Avg RAB (sum) | Return | Depreciation | O&M | Tax | NAR deduction | ARR | Collections |')
    print('|---|---|---|---|---|---|---|---|---|---|')
    cp1, cp3 = _CPS[1], J('bial.aera.cp3_arr_and_shortfall')
    for k, name in ((1, 'CP1'), (2, 'CP2'), (3, 'CP3')):
        p, tu_ = eng.plans[k], eng.trueups[k]
        pp, tp = p['parts'], tu_['parts']
        print(f"| {name} | model plan | {f(pp['rab'])} | {f(pp['return'])} | {f(pp['dep'])} | {f(pp['opex'])} | {f(pp['tax'])} | {f(pp['nar_ded'])} | {f(sum(p['arr']))} | |")
        print(f"| {name} | model true-up | {f(tp['rab'])} | {f(tp['return'])} | {f(tp['dep'])} | {f(tp['opex'])} | {f(tp['tax'])} | {f(tp['nar_ded'])} | {f(tu_['arr'])} | {f(tu_['coll'])} |")
        if k == 1:
            o = P['bial_cp1_order']
            print(f"| CP1 | AERA order | {f(sum(cp1['avg_rab_cr']))} | {f(o['return'])} | {f(o['depreciation'])} | {f(o['opex'] + o['wc_interest'])} | {f(o['tax'])} | {f(o['nar_40pct'])} | {f(o['arr'])} | {f(sum(o['aero_rev_planned']))} (planned) |")
        if k == 2:
            c2 = _CPS[2]
            print(f"| CP2 | AERA order / true-up | | | | | | | {f(c2['arr_cr'])} / {f(c2['arr_trued_up_cr'])} | {f(c2['collections_cr'])} |")
        if k == 3:
            print(f"| CP3 | AERA order | {f(sum(J('bial.aera.cp3_rab_t2_step')['avg_ordered']))} | {f(cp3['return'])} | {f(cp3['depreciation'])} | {f(cp3['opex'])} | {f(cp3['tax'])} | {f(cp3['nar_30pct'])} | {f(cp3['gross_arr'] + cp3['nar_30pct'] + cp3['concession_fee'])} | {f(sum(_CPS[3]['aero_rev_actual_cr']))} |")
    print()


def zrow(ex, year):
    return ex.rows[year - 1] if year - 1 < len(ex.rows) else None


def vsi_events(ex):
    ev = {5: 'opens (1A); BLR moves in (L1); CP1', 6: 'opening costs (half year)', 8: 'AMD+HYD move in (L2); 1B opens',
          9: 'T2-style close for 1C+1D (80:20)', 10: 'CP2: AERA carries 13.9% of PV ARR', 11: 'BOM moves in (L3); 1C opens',
          14: 'DEL moves in (L4); 1D opens', 15: 'CP3: CP2 true-up recovered; 1C/1D repaying', 20: 'CP4'}
    p2 = P['vsi_stages']['P2']
    y0 = min(p2['spend'])
    ev[y0] = (ev[y0] + '; ' if y0 in ev else '') + 'phase 2 build'
    ev[p2['cod']] = (ev[p2['cod']] + '; ' if p2['cod'] in ev else '') + 'phase 2 opens'
    if getattr(ex, 'refi_done', 0):
        y = ex.refi_done + 1
        ev[y] = (ev[y] + '; ' if y in ev else '') + 'refinanced (8.15%, 15 yrs)'
    return ev


def side_by_side(bt, ex):
    pr = lambda t: (1 + P['cpi_forward']) ** t
    eb = P['bial_ebitda_basis']
    ev = vsi_events(ex)
    print('### BIAL actual vs VSI modelled (EXPERT), by operating year\n')
    print('BIAL operating year n = FY(2008+n); VSI operating year n = game year n+4. Aero yield = aero revenue ÷ passengers, in FY2026 rupees (BIAL deflated by CPI, VSI by the 4% game CPI). EBITDA nominal ₹ crore. "DSCR" = EBITDA ÷ (interest + scheduled principal), the basis of BIAL\'s path; "lender DSCR" = CFADS (after tax and renewals) ÷ debt service, the one the game tests. Basis letters: R reported, D derived, E estimate.\n')
    print('| Op yr | BIAL FY | BIAL pax m | VSI yr | VSI pax m | BIAL yield ₹ | VSI yield ₹ | BIAL EBITDA | VSI EBITDA | BIAL margin | VSI margin | BIAL DSCR | VSI DSCR | VSI lender DSCR | VSI event |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for o in bt:
        n = o['op_year']
        r = zrow(ex, n + 4)
        if r is None:
            continue
        fy = o['fy']
        by = o['yield_act'] / PI[fy] if o['yield_act'] else None
        zy = r['aero'] / r['pax'] * 10 / pr(r['t']) if r['pax'] else None
        dsa = f(o['dscr_act'], 2) + (' E' if o['dscr_act'] is not None and o['dscr_basis'] == 'E' else ' R' if o['dscr_act'] else '')
        ea = f(o['ebitda_act']) + (f" {eb.get(fy, '')}" if o['ebitda_act'] else '')
        print(f"| {n} | {fy} | {o['pax']:.1f} | {n + 4} | {r['pax']:.0f} | {f(by)}{' D' if o['yield_basis'] == 'D' else ''} | {f(zy)} | {ea} | {f(r['ebitda'])} | {f(o['margin_act'], 0, True)} | {f(r['margin'], 0, True)} | {dsa} | {f(r['dscr_pre'], 2)} | {f(r['dscr'], 2)} | {ev.get(n + 4, '')} |")
    print()
    print('### BIAL actual vs VSI modelled, aligned on the second terminal (BIAL T2 ↔ VSI 1D)\n')
    print('BIAL T2 opened in FY2023 (op year 15) and began repaying in FY2024; VSI 1D opens in year 14 (op year 10) and 1C/1D repay from year 15.\n')
    print('| k | BIAL FY | BIAL pax m | VSI yr | VSI pax m | BIAL yield ₹ | VSI yield ₹ | BIAL margin | VSI margin | BIAL DSCR | VSI DSCR | VSI lender DSCR |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|')
    byfy = {o['fy']: o for o in bt}
    for k in range(-3, 4):
        fy = 2023 + k
        o = byfy.get(fy)
        r = zrow(ex, 14 + k)
        if o is None or r is None:
            continue
        by = o['yield_act'] / PI[fy] if o['yield_act'] else None
        zy = r['aero'] / r['pax'] * 10 / pr(r['t']) if r['pax'] else None
        dsa = f(o['dscr_act'], 2) + (' E' if o['dscr_act'] is not None and o['dscr_basis'] == 'E' else '')
        print(f"| {k:+d} | {fy} | {o['pax']:.1f} | {14 + k} | {r['pax']:.0f} | {f(by)} | {f(zy)} | {f(o['margin_act'], 0, True)} | {f(r['margin'], 0, True)} | {dsa} | {f(r['dscr_pre'], 2)} | {f(r['dscr'], 2)} |")
    print('\nBIAL FY2021-22 are COVID years (traffic −66%); the VSI expert run has no shock (see the COVID sensitivity row).\n')
    print('### VSI (EXPERT) after BIAL\'s data ends: one row per era\n')
    print('| Era | Years | Pax m (end) | Aero yield ₹ FY26 (avg) | Aero share of revenue | EBITDA ₹cr (end yr) | Margin (avg) | Lender DSCR (worst year) | Debt end ₹cr |')
    print('|---|---|---|---|---|---|---|---|---|')
    for e, a, b in ERAS[3:]:
        rows = [r for r in ex.rows if a <= r['t'] + 1 <= b]
        if not rows:
            continue
        ys = sum(r['aero'] / r['pax'] * 10 / pr(r['t']) for r in rows) / len(rows)
        ash = sum(r['aero'] for r in rows) / sum(r['oi'] for r in rows)
        mg = sum(r['ebitda'] for r in rows) / sum(r['oi'] for r in rows)
        mins = [r['dscr'] for r in rows if r['dscr'] is not None and r['ds'] > 0.02 * r['ebitda']]
        print(f"| E{e} | {a}-{b} | {rows[-1]['pax']:.0f} | {f(ys)} | {f(ash, 0, True)} | {f(rows[-1]['ebitda'])} | {f(mg, 0, True)} | {fl(min(mins)) if mins else 'repaid'} | {f(rows[-1]['debt'])} |")
    print()


def era_cells(eng):
    et = era_table(eng)
    cells = []
    for e, a, b in ERAS:
        x = et[e]
        if x is None:
            cells.append('—')
            continue
        if x.get('repaid') or x['min'] is None:
            cells.append('repaid')
            continue
        d = x['min']
        tag = ' D' if d < 1.0 else ' C' if d < 1.10 else ' W' if d < 1.20 else ''
        cells.append(f"{fl(d)}{tag}{'*' if x['partial'] else ''}")
    return cells


def outcome(eng):
    if eng.step_in:
        return f"step-in, year {eng.step_in[0] + 1}: {eng.step_in[1]}"
    if getattr(eng, 'compare', False):
        neg = [r['t'] + 1 for r in eng.rows if r.get('cash', 0) < -1]
        return f"would breach; cash short from year {neg[0]}" if neg else 'no breach'
    return 'debt repaid' if eng.rows[-1]['debt'] < 1 else 'debt left'


def irr_txt(eng):
    if eng.step_in:
        return 'equity lost'
    if getattr(eng, 'compare', False):
        return 'n/a'
    return f(eng.irr, 1, True) if eng.irr is not None else '—'


def print_eras(engs, title, note=True):
    print(f'### {title}\n')
    if note:
        print('Each cell is the era\'s **worst single year** of lender DSCR (CFADS ÷ senior debt service), floored to 2 decimals: the game\'s test. Tags: W warning (< 1.20: dividends locked), C covenant breach (< 1.10: cash sweep), D below 1.0 (two D eras in a row: cure board, or the lenders step in; an unpaid instalment: at once). "repaid" = debt service under 2% of EBITDA. IRR = nominal rupee equity IRR on 100% of the equity (calls, cures, dividends, residual cash at year 60). Comparison rows keep the expert\'s bank-sized debt and are not stopped by step-in.\n')
    head = '| Run | ' + ' | '.join(f'E{e} ({a}-{b})' for e, a, b in ERAS) + ' | Bank gearing 1A/1B/1C-1D | Outcome | Equity IRR |'
    print(head)
    print('|' + '---|' * (len(ERAS) + 4))
    for eng in engs:
        g = eng.gear
        gs = '/'.join(f"{g[n]:.0%}" for n in eng.names[:3])
        print(f"| {eng.label} | " + ' | '.join(era_cells(eng)) + f" | {gs} | {outcome(eng)} | {irr_txt(eng)} |")
    print('\n\\* era cut short by step-in.\n')


def print_vsi_years(eng, years=range(1, 31)):
    print(f'### {eng.label}: year by year (nominal ₹ crore)\n')
    print('| Yr | Era | Pax m | Cap | Yield ₹ | Aero | NAR | EBITDA | Margin | Interest | Principal | Lender DSCR | Debt | True-up bal | DSRA | Cash | Div | Call+cure |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for r in eng.rows:
        y = r['t'] + 1
        if y not in years:
            continue
        print(f"| {y} | {era_of(y) or 0} | {r['pax']:.1f} | {r['cap']:.0f} | {f(r['yield'])} | {f(r['aero'])} | {f(r['nar'])} | {f(r['ebitda'])} | {f(r['margin'], 0, True)} | {f(r['interest'])} | {f(r['principal'])} | {f(r['dscr'], 2)} | {f(r['debt'])} | {f(r['bal'])} | {f(r.get('dsra'))} | {f(r.get('cash'))} | {f(r.get('div'))} | {f((r.get('call') or 0) + (r.get('cure') or 0))} |")
    print()


def print_levers():
    print('### Levers per scenario\n')
    print('| Scenario | Gearing asked (1A, 1B) | Phase 1 | State loan (0%, 14.2% of 1A) | Defer state loan at 1C/1D | AERA stance (carry in the 1C/1D CP / escalation / capex disallowed / airline drag) | Repayment | Refinance | Equity cure | Retain cash to | Phase 2 | Ops profile |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for n, s in SCEN.items():
        pu = PUSH[s['push']]
        print(f"| {n} | {s['gearing']:.0%} (1C/1D at 80%) | {s['phase1']} | {'yes' if s['state_loan'] else 'no'} | {'yes' if s['defer_state_loan'] else 'no'} | {s['push']} ({pu['shock_carry']:.1%} / {'CPI' if pu['esc'] is None else 'flat nominal'} / {P['push_hard_disallowance'] if pu['hard'] else 0:.1%} / {P['airline_relations_drag'] * 100 if pu['hard'] else 0:+.0f} pp a year) | {s['profile']} | {'yes' if s['refi'] else 'no'} | {'yes' if s['cure'] else 'no'} | {('year ' + str(s['retain_until'])) if s['retain_until'] else 'no'} | {('years ' + '-'.join(str(y) for y in sorted(P['vsi_stages']['P2']['spend']))) if s['phase2'] else 'no'} | {s['ops']} |")
    print()
    print('Ops profiles by level (L1, L2, L3, L4, L5), hand-set stand-ins for the shift results (estimates): ' + '; '.join(
        f"{k}: Q {v['Q']}, disruption ₹/pax {v['dis']}, SQ rebate {v['sq']}, growth bonus {v['star']}, O&M × {v['opex']}" for k, v in P['ops_profiles'].items()) + '\n')


def scenario_set():
    base = dict(SCEN)
    runs = [('EXPERT', base['EXPERT']), ('BAD', base['BAD']), ('LAZY', base['LAZY']),
            ('Comparison: Delhi card (DIAL FY26 aero yield, 45.99% revenue share)', dict(base['EXPERT'], card='DEL', fee=J('ppp.rev_share_dial'), compare=True, cure=False)),
            ('Comparison: Navi Mumbai card (opening UDF, 12.6% revenue share)', dict(base['EXPERT'], card='NMIA', fee=J('ppp.rev_share_nmia'), compare=True, cure=False))]
    sens = [
        ('EXPERT, big phase 1 (70 mppa)', dict(base['EXPERT'], phase1='big')),
        ('EXPERT, no state loan', dict(base['EXPERT'], state_loan=False, defer_state_loan=False)),
        ('EXPERT, 75% gearing', dict(base['EXPERT'], gearing=0.75)),
        ('EXPERT, 60% gearing', dict(base['EXPERT'], gearing=0.60)),
        ('EXPERT, pushes AERA hard (appeals the back-loaded order)', dict(base['EXPERT'], push='hard')),
        ('EXPERT, soft (25% carried)', dict(base['EXPERT'], push='soft')),
        ('EXPERT, equal instalments', dict(base['EXPERT'], profile='equal')),
        ('EXPERT, no refinancing', dict(base['EXPERT'], refi=False)),
        ('EXPERT, prepay instead of dividends', dict(base['EXPERT'], prepay_share=1.0)),
        ('EXPERT, keeps cash to year 15, then prepays what the lock-up traps', dict(base['EXPERT'], retain_until=15, prepay_locked=True)),
        ('EXPERT, no phase 2', dict(base['EXPERT'], phase2=False)),
        ('EXPERT, COVID-type years 16-17 (BIAL FY21-22)', dict(base['EXPERT'], shock=True)),
        ('EXPERT, Nagpur-level fee 14.49%', dict(base['EXPERT'], fee=J('ppp.rev_share_nagpur'))),
        ('EXPERT, land at a BIAL-style cost-recovery rent', dict(base['EXPERT'], land='bial')),
    ]
    return runs, sens


def print_warning_source(ex):
    """Why the expert warns at 1C/1D: the bank's own base case, then the expert with each cause removed."""
    s = SCEN['EXPERT']
    rows = [('Lender base case (what the bank sized on)', ex.base_mand),
            ('EXPERT', ex),
            ('EXPERT, AERA does not back-load the 1C/1D control period (no 13.9% carry)', vsi_engine(dict(s, no_carry=True), 'x')),
            ('EXPERT, no opening cost at the 1B/1C/1D expansions', vsi_engine(dict(s, no_expansion_opening=True), 'x')),
            ('EXPERT, 60% gearing', vsi_engine(dict(s, gearing=0.60), 'x')),
            ('EXPERT, pushes AERA hard', vsi_engine(dict(s, push='hard'), 'x'))]
    print('### Where the expert\'s lender warning comes from\n')
    bmin = min(r['dscr'] for r in ex.base_mand.rows if r['dscr'] is not None)
    by = min((r['dscr'], r['t'] + 1) for r in ex.base_mand.rows if r['dscr'] is not None)[1]
    print(f'Worst single year of lender DSCR in E2-E4 (years 8-18). The bank sculpts every tranche to {P["lbc_dscr_target"]:.2f} on its base case and will not lend into an interest-only year below {P["lbc_moratorium_cover"]:.2f} (lowest base-case year {bmin:.2f}, year {by}). The expert\'s dip below that comes from the run.\n')
    print('| Run | E2 (8-10) | E3 (11-13) | E4 (14-18) | Worst year |')
    print('|---|---|---|---|---|')
    for lab, e in rows:
        c = era_cells(e)
        yrs = [(r['dscr'], r['t'] + 1) for r in e.rows if 7 <= r['t'] <= 17 and r['dscr'] is not None]
        w = min(yrs)
        print(f"| {lab} | {c[1]} | {c[2]} | {c[3]} | year {w[1]}: {fl(w[0])} |")
    print()


def print_opening_options(ex):
    alt = vsi_engine(dict(SCEN['EXPERT'], greenfield_alone=True), 'x')
    print('### The opening year: two honest fits\n')
    print(f"BIAL's opening year (FY2009) had a 44% margin. One opening term fitted on all three BIAL openings (k = {CALIB['open_k_greenfield']:.2f}, the default) "
          f"under-fits it; a greenfield term fitted on FY2009 alone (k = {CALIB['open_k_greenfield_alone']:.2f}) fits it exactly but rests on one estimated point.\n")
    print('| Opening term | VSI margin, years 5 / 6 / 7 | Bank gearing on 1A | E1 worst year | Expert lowest year | Expert IRR |')
    print('|---|---|---|---|---|---|')
    for lab, e in (('one term, three openings (default)', ex), ('greenfield term on FY2009 alone', alt)):
        m = ' / '.join(f"{e.rows[y]['margin'] * 100:.0f}%" for y in (4, 5, 6))
        c = era_cells(e)
        low = min((r['dscr'], r['t'] + 1) for r in e.rows if r['dscr'] is not None and r['ds'] > 0.02 * r['ebitda'])
        print(f"| {lab} | {m} | {e.gear[e.names[0]]:.0%} | {c[0]} | {fl(low[0])} (year {low[1]}) | {irr_txt(e)} |")
    print()


def print_scale(ex):
    print('### Scale factor\n')
    pax_r = [(2008 + n, ex.rows[n + 3]['pax'] / PAX[2008 + n]) for n in range(1, 19) if n + 3 < len(ex.rows)]
    pax_nc = [x for fy, x in pax_r if fy not in (2021, 2022)]
    capex = sum(s['cost'] for k, s in P['vsi_stages'].items() if k in ('1A_lean', '1B_lean', '1C', '1D'))
    p1 = P['vsi_stages']['1A_lean']['cost']
    sc = J('bial.scale.capex_factor_real')
    print(f"There is no single ×5. VSI is its own premise (design-day traffic, the capex stages in money-design.md) run on BIAL's unit costs and mechanisms. "
          f"Capex (FY2026 ₹): phase 1 ₹{p1:,} cr vs BIAL ~₹{sc['bial_phase1_2025_cr']:,} cr = ×{p1 / sc['bial_phase1_2025_cr']:.1f}; "
          f"full build ₹{capex:,.0f} cr vs ~₹{sc['bial_full_build_2025_cr']:,} cr = ×{capex / sc['bial_full_build_2025_cr']:.1f}. "
          f"Traffic by operating year: ×{min(pax_nc):.1f} to ×{max(pax_nc):.1f} (×{max(x for _, x in pax_r):.0f} against BIAL's COVID year). "
          f"Mature traffic (op year 18): VSI {ex.rows[21]['pax']:.0f} m vs BIAL {PAX[2026]:.1f} m = ×{ex.rows[21]['pax'] / PAX[2026]:.1f}. "
          f"So VSI is ×{capex / sc['bial_full_build_2025_cr']:.0f} on full-build capex, ×{p1 / sc['bial_phase1_2025_cr']:.0f} on phase 1 and ×4-10 on traffic; it reaches its mature traffic in 10 operating years where BIAL took 18, "
          f"so it carries fewer passengers per rupee of capex than BIAL did, which is why its charge per passenger is higher.\n")


def print_charge(ex):
    """The AERA building-block aero yield VSI needs, against Delhi's and Bengaluru's today (FY2026 rupees)."""
    pr = lambda t: (1 + P['cpi_forward']) ** t
    yv = [r['yield'] / pr(r['t']) for r in ex.rows if r['pax'] > 0]
    cp1 = yv[0]
    dial = J('aero.dial_aero_revenue_fy26_cr')['total'] / J('benchmarks.dial_revenue_fy26_cr')['pax_m'] * 10
    blr = P['yield_market_norm']
    print('### What VSI must charge per passenger (aero yield, FY2026 ₹)\n')
    print('| Airport | Aero charge per passenger | Basis |')
    print('|---|---|---|')
    print(f"| VSI, first control period (expert) | ₹{cp1:,.0f} | AERA building block on VSI's own new RAB |")
    print(f"| VSI, average years 5-23 | ₹{sum(yv[:19]) / len(yv[:19]):,.0f} | same |")
    print(f"| Bengaluru (BIAL FY2026) | ₹{blr:,.0f} | `bial.path` |")
    print(f"| Delhi (DIAL FY2026) | ₹{dial:,.0f} | `aero.dial_aero_revenue_fy26_cr` |")
    print(f"\nVSI must charge about ₹{cp1:,.0f} per passenger to pay for itself; Bengaluru charges ₹{blr:,.0f} and Delhi ₹{dial:,.0f}, "
          f"because their airports were built far cheaper and long ago, and most of their cost is already paid off. That is {cp1 / blr:.1f}× Bengaluru and {cp1 / dial:.1f}× Delhi.\n")
    return cp1, blr, dial


def print_delay(ex):
    """1A opens late (BIAL's T2 slipped 21 months: money.json bial.t2.timeline). The bank sized the debt on time;
    interest falls due from the planned COD, there is no traffic until the doors open."""
    s = SCEN['EXPERT']
    rows = [('EXPERT, on time', ex),
            ('EXPERT, phase 1 opens 12 months late', vsi_engine(dict(s, delay=1), 'x')),
            ('EXPERT, phase 1 opens 21 months late (BIAL T2; modelled as 2 years)', vsi_engine(dict(s, delay=2), 'x')),
            ('BAD, phase 1 opens 12 months late', vsi_engine(dict(SCEN['BAD'], delay=1), 'x'))]
    print('### Construction delay (phase 1 opens late)\n')
    print('| Run | E1 (5-7) | E2 (8-10) | E3 (11-13) | E4 (14-18) | Cure money ₹ cr | Outcome | Equity IRR |')
    print('|---|---|---|---|---|---|---|---|')
    for lab, e in rows:
        c = era_cells(e)
        print(f"| {lab} | {c[0]} | {c[1]} | {c[2]} | {c[3]} | {e.cures:,.0f} | {outcome(e)} | {irr_txt(e)} |")
    print()


def print_irr_basis(engs):
    ff = J('bial.owners.fairfax_return')
    dep = P['inr_usd_depreciation']
    inr = (1 + ff['annualised_return']) * (1 + dep) - 1
    print('### IRR basis\n')
    print(f"All VSI IRRs are nominal rupee equity IRRs on the whole equity (the parent's 64% earns the same rate). Fairfax India's realised return on BIAL is {ff['annualised_return'] * 100:.0f}% a year in US dollars "
          f"(`bial.owners.fairfax_return`, mark-to-market, not dividends); at about {dep * 100:.1f}% a year of rupee depreciation (est.) that is about {inr * 100:.0f}% in rupees. "
          f"Fairfax's DCF discount rates (12.2-17.5%, `bial.owners.dcf_inputs`; 12.4-17.3% in 2024, `finance.equity_irr_benchmark`) are after-tax; the source does not state their currency, and BIAL's cash flows are in rupees.\n")
    for e in engs:
        print(f"- {e.label}: {irr_txt(e)}")
    print()


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'all'
    if mode == 'zmi':
        mode = 'vsi'        # old name, kept as an alias
    if mode not in ('backtest', 'vsi', 'all'):
        sys.exit('usage: python3 tools/concession_model.py [backtest|vsi|all]')
    calibrate()
    if mode in ('backtest', 'all'):
        beng, bt = backtest()
        print_calibration()
        print_backtest(beng, bt)
    if mode in ('vsi', 'all'):
        runs, sens = scenario_set()
        engs = [vsi_engine(s, n) for n, s in runs]
        if mode == 'all':
            side_by_side(bt, engs[0])
        print_levers()
        print_eras(engs, 'Lender DSCR by era: expert, bad, lazy, and the comparison cards')
        sengs = [vsi_engine(s, n) for n, s in sens]
        print_eras([engs[0]] + sengs, 'Lever sensitivities (one change from EXPERT each)', note=False)
        print_warning_source(engs[0])
        print_opening_options(engs[0])
        print_charge(engs[0])
        print_delay(engs[0])
        print_irr_basis(engs[:3] + sengs)
        for e in engs[:3]:
            last = e.step_in[0] + 1 if e.step_in else 30
            print_vsi_years(e, range(1, last + 1))
        print_scale(engs[0])


if __name__ == '__main__':
    main()
