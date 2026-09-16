# A small dog with a life inside the planner

Research and implementation notes, September 16, 2026. Scope: the whole `/dog` planner surface. The companion is not injected into unrelated applications on this site.

## Evidence → decisions

| Source | What it supports | Application and limits |
| --- | --- | --- |
| [Mateas, CMU: An Oz-Centric Review of Interactive Drama and Believable Agents (1997)](https://www.cs.cmu.edu/afs/cs/project/oz/web/papers/CMU-CS-97-156.html) | Believability comes from personality, motives, change, social relationships, and coherent perception/action—not literal realism. | A hungry dog investigates its bowl; a restless dog bows and explores; a settled dog curls up. Persistent task memories and learned tricks establish continuity. This is a conceptual character-design framework, not a trial proving planner effectiveness. |
| [Using Virtual Pets to Promote Physical Activity in Children (2015)](https://pubmed.ncbi.nlm.nih.gov/26020285/) | A short intervention connected physical activity goals to a virtual pet and learning tricks, reporting increased activity. | Link care and growth to work outside the pet interaction itself. Children, physical activity, and short exposure do not establish effectiveness for adult task planning or long-term retention. |
| [Self-Determination Theory: the theory](https://selfdeterminationtheory.org/the-theory/) | Autonomy, competence, and relatedness matter to motivation. | People choose their own tasks; thresholds are visible; a small plan can satisfy every need. No death, punishment for absence, mandatory streak, or inventory. These are design inferences, not a validated treatment. |
| [Nielsen Norman Group: Animation for a Purpose](https://www.nngroup.com/articles/animation-purpose-ux/) and [Animation Duration](https://www.nngroup.com/articles/animation-duration/) | Motion attracts attention and should communicate something useful; frequency and context matter. | Task acknowledgments are brief. Autonomous decisions occur at 14-second intervals, with idle time between journeys; focus, typing, dialogs, hidden tabs, and motion preferences take priority. Travel duration scales with distance. |
| [W3C: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html) and [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | Users need control over nonessential moving content and interaction-triggered animation. | Persistent Pause wandering plus operating-system reduced motion suppress travel and character animation. Toss ball is keyboard operable; Escape ends play. Accessibility behavior still needs assistive-technology testing. |

Also investigated Fish’n’Steps (Lin et al., UbiComp 2006, DOI 10.1007/11853565_16) for longer-term novelty and encouragement. The indexed abstract was available, but the primary full-text link failed. Its findings are not treated here as independently verified full-text evidence.

## The shipped local behavior

Three needs fit into one small card rather than three meters or another dashboard:

| Need | Earned by today's saved plan | Interaction | Persistent result |
| --- | --- | --- | --- |
| Food | First completed task | Serve meal; puppy goes toward its bowl and eats | Filled bowl; Fed |
| Exercise | Half the plan completed, rounded up | Go sniffing; a brief fetch session allows up to three throws into free page space or via Toss ball | Exercised |
| Comfort | Whole plan completed | Tuck in; curled sleeping pose | Cozy |

One completed task in a one-task plan unlocks all three. Actions remain individually available until used. Adding more tasks or undoing a checkbox never takes earned care away. Care is recorded once per action per local day using an atomic database update; no click currency, timer farming, or calendar-event rewards. Unique task/day receipts prevent the same task being counted twice toward tricks. This is a self-reported planner: it cannot verify real-world completion, and deleting/recreating different tasks is not treated as an adversarial cheating problem.

Paw, spin, and roll become available after 3, 8, and 15 recorded task completions. Asking for a known trick or calling the dog is companionship, not a way to refill its needs. A short cooldown prevents constant trick spam. The last care action remembers its associated task. Daily needs reset without losing those memories or learned tricks; absence does not injure the dog.

The page is part of the dog's environment: it can investigate the edge of a new task, glance toward the pointer, travel around safe margins, greet on returning to the page, retrieve a ball, and rest during a timer. The home area anchors its bowl, blanket, and toy. On compact/mobile layouts care is available from the header dog menu; fetch controls appear only during earned play. Paths are checked continuously against visible task rows and controls, including at intermediate path segments. When no safe route exists it stays put; scrolling/resizing cancels travel and relocates only if its current footprint conflicts with content. This avoids putting a moving target over a task checkbox.

Motion priority: hidden/reduced motion/paused/focus → user editing or dialog → earned care interaction → contextual task feedback → occasional idle behavior. No animation framework, game engine, image downloads, external pet service, or LLM is added.

## Validation and what remains unproven

Automated checks exercise saved completion gates, repeated actions, undo/recheck, account separation, short plans, historical/future plans, midnight, persistent memory, trick thresholds, and safe continuous routes. Browser checks exercise real signup/task persistence, locked and earned care, responsive layout, focus, quiet mode, and keyboard interactions. Run commands and local infrastructure are in README.md.

These checks establish behavior and layout, not that users find the dog lifelike or motivating. No human usability study or A/B test has been conducted. The following is a ready-to-run formative study, not fabricated results:

1. Recruit five people who currently organize with Notes or paper. Give them three ordinary tasks to enter without explanation. Record time to first task, errors, and requests for help; target four of five finishing entry without help within 30 seconds.
2. Ask, “What does the dog need? What would you do next?” Before any explanation, target four of five correctly identifying that completing tasks unlocks care. Observe whether disabled actions communicate the next step.
3. Have them finish a task and feed the dog. Target four of five completing both within 10 seconds of checking the task, with no hunt through settings.
4. Run a one-minute focus session. Observe accidental clicks and whether the dog distracts; target zero motion during focus and no blocked task controls. Repeat with keyboard-only interaction and reduced motion.
5. Complete half a plan, throw a ball using the page, then use the keyboard alternative. Check discovery, safe click placement, cancellation, and whether three throws feel sufficient. The fetch window should not delay returning to planning.
6. Return after a simulated day off. Ask whether the dog feels welcoming or guilt-inducing. Any belief that the dog can die or must be constantly maintained is a design failure requiring copy/behavior revision.
7. Ask what made the dog feel alive, and what felt repetitive. Run a seven-day follow-up diary before claiming sustained motivation. Compare against the previous unlimited pet/treat buttons with counterbalanced order; measure task-flow friction separately from affection ratings.

Revise based on observed confusion first. Do not add more needs, currencies, or progression screens to compensate for weak character animation.

### Completed automated run

18 care/model/Google unit and integration tests passed. Chrome suites passed for the full planner, task times/timers, mocked Google Calendar, earned care/fetch/tricks, and obstacle-safe roaming. Desktop and mobile screenshots were visually reviewed. Google provider calls were mocked; no live OAuth connection was tested. The additive schema was applied only to the isolated local D1 database. This work does not deploy the site.
