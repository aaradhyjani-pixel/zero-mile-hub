# Press conference after a bad day (idea #6, design/fun.md)

```
TITLE:          VSI's chief faces the press
MODE:           PAPER: a reporter's notepad on the desk, three questions in sequence (about 60 seconds)
CHAPTER, WHEN:  any chapter with a shift (Takeoff, Climb, Cruise, Turbulence, Landing), the evening after the shift,
                before the year's results
CAUSE:          the shift the player just flew (s.shiftLog, the engine's own record of it). The day is "bad" when any of:
                - the shift earned 1 star or none (it kept the airport safe and nothing more);
                - fewer than 70% of flights ran on time;
                - 20 or more passengers missed their connection, and they were at least 15% of everyone connecting.
                No bad day, no press conference. Each question names the shift's own worst numbers, worst first:
                "200 passengers missed their Akasa Air connections on opening morning. What went wrong?"
                "380 passengers from Lucknow missed London tonight." (Cruise, when London left without them)
                Paper pin: the notepad's header names the shift's date; the next front page carries the answer.
ON SCREEN:      the desk, a reporter's spiral notepad from The Zero Mile Times with the question in pencil and the bad
                number circled; the founder's folded name card ("Asha Rao · Director, VSIAL") in front of it; the
                adviser's slip shows what tomorrow's paper will print for each answer.
CHOICES (≤3):   per question, the same three:
                - Own it, and name the fix. Now: a hard headline ("VSI'S CHIEF OWNS THE BAD MORNING"), airline trust
                  up a little (+2 points). Later: when the next shift is flown, the airline sees the fix: +2 more.
                - Blame someone else (the fog, the airlines' late flights, their timetable). Now: "VSI BLAMES THE FOG",
                  trust unchanged. Later: the airline knows whose airport it is: −4 points.
                - Deflect to the good news. Now: the kindest headline ("VSI POINTS TO A RECORD YEAR"), trust up
                  +2, the same as owning it. Later: the numbers come out: −6 points.
                Three honest answers: +12 points of trust in all. Three deflections: −12. Honest answers never lower
                trust, at any time.
ECHO:           - the next front page (the cliffhanger after Takeoff and Cruise, else the next chapter's): a column
                  under the answer's headline, with what the founder said;
                - Akasa Air's trust (s.plateauTrust, the number Takeoff sets): after Takeoff, it decides whether Akasa
                  Air will share Climb's afternoon bank (it needs 70 points); later, the Black Box's "did your
                  partners stay?" question;
                - the next press conference opens with what the founder said last time ("In 2032 you blamed the fog.").
TRUTH:          (est.) Indian airports and airlines answer to the press after bad days: Delhi's fog diversions, the
                Bengaluru opening-day queues of May 2008 and the December 2022 queues at Delhi's Terminal 3 all made
                front pages and drew public answers. The trust points are game estimates, small on purpose: one
                press room can tip a borderline airline, never rescue a disaster.
SCORE:          Wow 2 / Agency 2 / Link 2 / Cost S → 6.0
```

## Rules it keeps (design/fun.md)

- Paper, not live: a press conference is a paper moment in real life.
- Three answers per question, plain words, no finance terms. No jokes; no real person is quoted. Airlines appear in their
  factual role (who flies which bank). The reporter is "our aviation reporter", not a named person.
- Deterministic: the same save and the same answers always give the same trust and the same headline.
- The bots: `HUB.flight.auto('smart')` owns every answer; `'blind'` deflects every answer.
