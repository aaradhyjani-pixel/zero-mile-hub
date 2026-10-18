"""Run every level with every bot in parallel and print a summary table.

  python3 run_all.py [outdir] [levels e.g. 1234] [bots e.g. expert,handler,lazy]

Each run writes its log and screenshots to outdir/L{n}{bot}/.
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '/tmp/zmh/runs')
LEVELS = [int(c) for c in (sys.argv[2] if len(sys.argv) > 2 else '1234')]
BOTS = (sys.argv[3] if len(sys.argv) > 3 else 'expert,handler,lazy').split(',')
PY = os.path.join(HERE, '.venv', 'bin', 'python')
if not os.path.exists(PY):
    PY = sys.executable

procs = []
for L in LEVELS:
    for b in BOTS:
        d = os.path.join(OUT, f'L{L}{b}')
        os.makedirs(d, exist_ok=True)
        log = open(os.path.join(d, 'out.txt'), 'w')
        procs.append((L, b, d, subprocess.Popen([PY, os.path.join(HERE, 'run.py'), str(L), b, d], stdout=log, stderr=subprocess.STDOUT)))

rows = []
for L, b, d, p in procs:
    p.wait()
    res, err = None, ''
    for line in open(os.path.join(d, 'out.txt')):
        if line.startswith('RESULT '):
            res = json.loads(line[7:])
        if line.startswith('ERR '):
            err = line[4:].strip()
    rows.append((L, b, res, err))

print(f"{'lvl':<4}{'bot':<9}{'stars':<6}{'moves':<10}{'otp':<5}{'cnx':<5}{'safe':<6}{'flips':<6}{'inc':<5}types / errors")
for L, b, r, err in rows:
    if not r:
        print(f'{L:<4}{b:<9}NO RESULT  {err}')
        continue
    print(f"{L:<4}{b:<9}{'*' * r['stars']:<6}{str(r['moves']) + '/' + str(r['target']):<10}{r['otp']:<5}{r['cx']:<5}{round(r['safety']):<6}{r['flips']:<6}{r.get('incSeen', 0):<5}{json.dumps(r.get('incTypes', {}))} {'' if err == '[]' else err}")
json.dump([{'level': L, 'bot': b, 'result': r, 'errors': err} for L, b, r, err in rows], open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)
