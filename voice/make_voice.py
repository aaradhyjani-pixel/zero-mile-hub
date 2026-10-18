"""Render every recorded voice line in the game and write voice/spg_audio.js (injected by build.py at /*@@VOICE@@*/).

  python3 voice/make_voice.py            # render new lines, reuse the rest
  python3 voice/make_voice.py --force    # re-render everything
  VOICE_JOBS=1 python3 voice/make_voice.py   # one clip at a time

Inputs
  voice/voices.json      accent id -> {"voice": macOS `say` voice, "rate": wpm, "fx": earpiece|radio|cockpit|pa|none,
                         "pause": ms of silence between sentences, "pitch": optional (<1 deeper), "lang": BCP-47 for the
                         browser's fallback voice}; keys starting with _ are comments
  voice/lines/*.json     [{"key": exact on-screen text, "voice": accent id, "say": optional spoken text}, ...]
                         "say" may hold [[slnc 800]] pauses; without it the key is spoken, emoji stripped, runway
                         designators spelled out (27L -> "two seven left") and a pause put between sentences.
Outputs
  voice/clips/<sha1[:12]>.mp3   one small mono mp3 per line (only the clips in use are kept; build.py ships them)
  voice/spg_audio.js            const SPG_AUDIO={key: 'voice/clips/xxxx.mp3'}; const VOICE_LANG={accent id: lang};
Clips are named by a hash of (voice settings, fx, spoken text), so an unchanged line is never rendered twice; voice/cache/
(gitignored) keeps every clip ever rendered, so switching a line back and forth is free too.

Accents: a macOS voice for language X reading English text speaks English with an X accent (Milena -> Russian English).
"""
import concurrent.futures as cf, glob, hashlib, json, os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS, CACHE = os.path.join(HERE, 'clips'), os.path.join(HERE, 'cache')
FXVER = 2  # bump when an fx chain changes, so every clip using it is re-rendered
SR = 24000

# Words the voices get wrong, per macOS voice ('*' = every voice). Each spelling was checked with a phone recogniser
# (wav2vec2 espeak CTC): Aman reads "Jai Hind" as "Jay Hynd" (dʒ e h a n); "Jye, Hinnd" gives dʒ aɪ h i n, the same
# phonemes the Hindi voice Lekha gives for जय हिंद (dʒ a j h i n).
# A straight apostrophe in a line that also holds an embedded command ([[slnc N]]) makes Aman drop words: "...the People's
# Republic of China shall now be landing on runway two seven right" came out as "...the People's Republic, two seven right"
# (5.8 s instead of 7.9 s; without the [[slnc]], or with a typographic apostrophe, every word is there). The typographic
# apostrophe reads the same in every voice, so all of them get it.
PRON = {
    '*': [(r"'", '\u2019')],
    'Aman': [(r'\bJai Hind\b', 'Jye, Hinnd')],
    # Rishi's "runway" is heard as "runaway" (small.en, ~40 tower clips); "runnway" is heard as "runway" every time
    'Rishi': [(r'\b([Rr])unway', r'\1unnway')],
}

DIG = 'zero one two three four five six seven eight nine'.split()
SIDE = {'L': 'left', 'R': 'right', 'C': 'centre'}
EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-➿️‍⭐⬆↔-⇿]')


def spell_runways(t):
    """27L -> two seven left, 09 -> zero nine (only after 'runway'), as ATC says them."""
    t = re.sub(r'\b([0-3]\d)([LRC])\b', lambda m: ' '.join(DIG[int(c)] for c in m.group(1)) + ' ' + SIDE[m.group(2)], t)
    return re.sub(r'(?i)\b(runways?\s+)([0-3]\d)\b', lambda m: m.group(1) + ' '.join(DIG[int(c)] for c in m.group(2)), t)


def spoken(line, acc):
    if line.get('say'):
        t = line['say']
    else:
        t = EMOJI.sub('', line['key']).strip()
        if acc.get('pause'):  # a real pause between sentences, never inside one
            t = re.sub(r'(?<=[.!?])\s+(?=["\'(A-Z0-9])', f' [[slnc {acc["pause"]}]] ', t)
    t = spell_runways(t)
    for pat, rep in PRON.get('*', []) + PRON.get(acc['voice'], []):
        t = re.sub(pat, rep, t)
    return re.sub(r'\s+', ' ', t).strip()


def chain(fx):
    """ffmpeg inputs after the voice (input 0) and a filter graph ending in [o]."""
    mono = f'aresample={SR},aformat=sample_fmts=fltp:channel_layouts=mono'
    if fx in ('earpiece', 'radio', 'cockpit'):
        # band-limited, compressed and a little driven, hiss under the voice, a squelch burst at each end
        lo, hi, drive, hiss, cin, cout = {
            'earpiece': (300, 3400, 1.9, 0.05, (0.06, 'white', 1500, 0.6), (0.09, 'pink', 900, 0.45)),
            'radio': (300, 3000, 1.7, 0.035, (0.05, 'white', 1800, 0.35), (0.12, 'pink', 900, 0.35)),
            'cockpit': (300, 3000, 2.3, 0.07, (0.05, 'white', 1600, 0.45), (0.16, 'pink', 800, 0.5)),
        }[fx]
        ins = ['-f', 'lavfi', '-t', str(cin[0]), '-i', f'anoisesrc=c={cin[1]}:a=0.5:r={SR}',
               '-f', 'lavfi', '-t', str(cout[0]), '-i', f'anoisesrc=c={cout[1]}:a=0.5:r={SR}',
               '-f', 'lavfi', '-t', '60', '-i', f'anoisesrc=c=pink:a=1:r={SR}']
        fc = (f'[0:a]{mono},highpass=f={lo},highpass=f={lo},lowpass=f={hi},lowpass=f={hi},'
              f'acompressor=threshold=-20dB:ratio=5:attack=4:release=80,volume={drive},asoftclip=type=tanh[s];'
              f'[1:a]{mono},highpass=f={cin[2]},volume={cin[3]}[c1];[2:a]{mono},highpass=f={cout[2]},volume={cout[3]}[c2];'
              f'[3:a]{mono},bandpass=f=1800:w=2600,volume={hiss}[h];'
              '[s][h]amix=inputs=2:duration=first:normalize=0[sh];[c1][sh][c2]concat=n=3:v=0:a=1[o]')
        return ins, fc
    if fx == 'pa':  # a public-address hall: full band, gently compressed, a short light reverb that rings out
        return [], (f'[0:a]{mono},highpass=f=110,lowpass=f=7500,equalizer=f=180:t=q:w=1:g=2,'
                    'acompressor=threshold=-18dB:ratio=3:attack=10:release=150,apad=pad_dur=0.7,'
                    'aecho=0.85:0.7:43|97|163|251:0.26|0.19|0.13|0.08,volume=1.5,alimiter=limit=0.9[o]')
    return [], f'[0:a]{mono},highpass=f=70,acompressor=threshold=-18dB:ratio=3,volume=1.4,alimiter=limit=0.9[o]'


def render(text, acc, out):
    with tempfile.TemporaryDirectory() as td:
        a = os.path.join(td, 'v.aiff')
        subprocess.run(['say', '-v', acc['voice'], '-r', str(acc.get('rate', 160)), '--data-format=BEI16@22050', '-o', a, text],
                       check=True)
        ins, fc = chain(acc.get('fx', 'none'))
        if acc.get('pitch'):  # deeper (or higher) voice at the same speed: resample, then stretch back
            p = float(acc['pitch']); fc = fc.replace('[0:a]', f'[0:a]asetrate={round(22050 * p)},aresample=22050,atempo={1 / p:.4f},', 1)
        kbps = '40k' if acc.get('fx') in ('pa', 'none', None) else '32k'
        tmp = os.path.join(td, 'o.mp3')
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', a, *ins, '-filter_complex', fc,
                        '-map', '[o]', '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', kbps, tmp], check=True)
        shutil.move(tmp, out)


def main():
    force = '--force' in sys.argv
    voices = {k: v for k, v in json.load(open(os.path.join(HERE, 'voices.json'), encoding='utf-8')).items() if not k.startswith('_')}
    lines, seen = [], {}
    # spg.json first: the bodyguard's own lines win over copies of them in other manifests
    for f in sorted(glob.glob(os.path.join(HERE, 'lines', '*.json')), key=lambda f: (os.path.basename(f) != 'spg.json', f)):
        for ln in json.load(open(f, encoding='utf-8')):
            k, src = ln.get('key'), os.path.basename(f)
            if not k or ln.get('voice') not in voices:
                print(f'WARNING {src}: skipped {k!r}: unknown voice {ln.get("voice")!r}'); continue
            if k in seen:
                print(f'WARNING {src}: duplicate key {k!r} (already in {seen[k]}), keeping the first'); continue
            seen[k] = src; lines.append(ln)
    os.makedirs(CLIPS, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
    jobs, out, stat = {}, {}, {'rendered': 0, 'cached': 0}
    for ln in lines:
        acc = voices[ln['voice']]
        text = spoken(ln, acc)
        h = hashlib.sha1(json.dumps([FXVER, acc['voice'], acc.get('rate', 160), acc.get('fx', 'none'), acc.get('pitch'), text],
                                    ensure_ascii=False).encode()).hexdigest()
        out[ln['key']] = f'voice/clips/{h[:12]}.mp3'
        jobs[h] = (text, acc)

    def job(h):
        clip, cached = os.path.join(CLIPS, h[:12] + '.mp3'), os.path.join(CACHE, h + '.mp3')
        if not force and os.path.exists(clip):
            return 'cached'
        if not force and os.path.exists(cached):
            shutil.copy(cached, clip); return 'cached'
        render(*jobs[h], cached); shutil.copy(cached, clip); return 'rendered'

    # VOICE_JOBS=1 renders one clip at a time (cooler on a laptop)
    with cf.ThreadPoolExecutor(max_workers=int(os.environ.get('VOICE_JOBS') or min(8, os.cpu_count() or 4))) as ex:
        for h, r in zip(jobs, ex.map(job, jobs)):
            stat[r] += 1
    keep = {h[:12] + '.mp3' for h in jobs}
    stale = [f for f in os.listdir(CLIPS) if f.endswith('.mp3') and f not in keep]
    for f in stale:
        os.remove(os.path.join(CLIPS, f))
    js = ('// generated by voice/make_voice.py from voice/lines/*.json and voice/voices.json: each recorded line\'s clip, keyed by\n'
          '// its exact on-screen text, and each accent\'s language for the browser\'s fallback voice\n'
          'const SPG_AUDIO=' + json.dumps(out, ensure_ascii=False, indent=0) + ';\n'
          'const VOICE_LANG=' + json.dumps({k: v.get('lang') for k, v in voices.items()}) + ';\n')
    open(os.path.join(HERE, 'spg_audio.js'), 'w', encoding='utf-8').write(js)
    size = sum(os.path.getsize(os.path.join(CLIPS, f)) for f in keep)
    print(f'{len(out)} lines, {len(keep)} clips: {stat["rendered"]} rendered, {stat["cached"]} cached, '
          f'{len(stale)} stale removed; clips {size // 1024} KB, spg_audio.js {len(js.encode()) // 1024} KB')


if __name__ == '__main__':
    main()
