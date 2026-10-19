# ideas.md — making Zero Mile sharper and more interesting

The core loop works: read the waves on the bank chart, flip runways ahead of them, make the odd real call. These ideas deepen that loop rather than bolt things on. Ordered by how much they sharpen the game for the effort. Effort: S (an hour or two), M (half a day), L (a day or more).

## Top 5 (do these next)

1. **Plan flips on the bank chart (M).** Drag a runway's mode onto a time on the chart ("27C → ARR at 12:15") and it happens then. This turns the game from reflexes into planning, which is what a duty manager really does. The forecast line updates live, so you see your plan flatten the stack before it happens. Planned flips cost the same 2-minute changeover; last-second flips could cost 3, which rewards foresight.

2. **A score, not just stars, plus a ghost of your best run (S/M).** Score = movements × on-time multiplier × combo, minus delay minutes. The bank chart shows your best run's stack curve as a faint ghost, so a replay is a race against yourself. Stars stay as the pass mark; the score is what you chase.

3. **The wind shift: change the whole airport's direction (M).** Mid-level, the wind swings round and the airport must switch from west flow to east flow: all thresholds flip, the approach stacks move, and a 10-minute changeover has to be timed between waves. It's the most dramatic decision a real hub makes, and only the bank chart tells you when the gap comes.

4. **Spotter moments that pay off the 3D (S).** When something special happens (an A380 on final, a heavy rotating at 46 °C, the haboob wall arriving, a go-around), a small "Watch: Emirates A380 on final for 27C" chip appears; one key jumps the approach camera there for a few seconds. Add a photo mode (hide the UI, free camera, save a screenshot). Shareable images are the cheapest marketing a game can get.

5. **A 2-minute interactive tutorial inside Level 1 (M).** The brief already asks for it: "See the purple wave coming? Set 28R to ARR now." The chart pulses and the button glows. Then one call: "Click the red icon." Skippable, shown once. Without it, first-time players never learn that the runway desk is the game.

## Deeper decisions

- **Stand planning as a lever (M).** Let the player assign airline neighbourhoods (IndiGo in A–B, Air India in C–D) before a level. Good assignments shorten transfers and raise connections, and bad ones show up as missed connections in the debrief.
- **Holding-bay and heat-pad use (S).** The spec already has holding bays and a heat pad; let arrivals with no stand wait there instead of blocking a taxiway, and let heavies wait on the pad for the long runway. It makes the 3D layout matter.
- **Runway inspections as a schedulable task (S).** A sweeper needs a 90-second gap; the player can grant it in a lull (no cost) or it takes one at a bad moment. Small, but it rewards reading the chart.
- **Airline mood (M).** Each airline remembers your delays across a level (IndiGo hates late departures, Emirates hates missed connections). Unhappy airlines send "priority request" calls. That gives the incidents a cause and a memory.

## Feel and drama

- **ATC voice (S).** Read the key radio lines aloud with the Web Speech API (Indian English voice where available). Muted by default on mobile.
- **A tension score (S/M).** A soft drone that rises with the stack, a heartbeat when a MAYDAY is live, a release chord when the stack clears.
- **Stack clears as a moment (S).** When a big stack drains to zero, flash "Stack clear" with the minutes it took. Small wins need noise.
- **Weather you can see coming (M).** The andhi already rolls in from the west; put a radar strip on the bank chart that shows the storm arriving, so preparing for it becomes a decision.

## Replay and meta

- **Daily challenge (S).** One seeded day for everyone, with a share code ("VSI-1018: ★★★ 9,420"). Same schedule, compare scores.
- **Campaign: "The Migration" (L).** The four levels become chapters across the opening year, with a build budget in crores between chapters (open a concourse, add a rapid exit, extend a runway, hire a second wildlife team). Choices persist and have trade-offs.
- **Achievements (S).** "Flawless bank" (a wave with no holding), "A380 whisperer" (every A380 on time), "Calm in the andhi" (no go-arounds in the storm), "Zero MAYDAY at Level 4".
- **Endless mode (M).** Traffic grows 5% every hour of game time until the hub breaks. Your score is how long you hold it together.

## Teaching (builds on the new debrief)

- **Replayable shift timeline (M).** Scrub the 90 minutes in the debrief and watch the stack, queues and your flips; click a lesson to jump to its moment.
- **"Try again from here" (L).** Restart a level from 5 minutes before your worst moment, with the debrief's advice pinned. It needs sim snapshots, but it is the fastest way to learn.
- **Coach on demand (S).** A "?" next to the forecast line explains in one sentence what to do right now, based on the same analysis the debrief uses.

## Quality of life

- Key bindings for the runway desk (Shift+1..6 then A/D/M).
- A compact "next 15 minutes" summary under the clock: "Purple wave in 6 min · 41 arrivals".
- Colour-blind-safe palette option for ARR/DEP/MIX.
