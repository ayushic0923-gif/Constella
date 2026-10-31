// My reading of every example thought through the lenses (see the framework in
// README). Written by hand for the example month; for people's own thoughts the
// same structure comes from Claude on the server, or from rules on the device.
//
// "thought id | emotion valence arousal | needs | patterns"
//   emotion: joy love hope calm wonder worry sadness guilt irritation
//   valence -1..1 (how it feels), arousal 0..1 (how charged)
//   needs: security belonging competence autonomy meaning rest
//   patterns, traps: catastrophising should comparison mind-reading all-or-nothing
//                    rumination avoidance self-criticism fortune-telling
//             moves: reframe self-compassion gratitude acceptance action

export const READINGS = `
work/the-roadmap | worry -0.3 0.4 | autonomy competence | -
work/end-of-day | worry -0.5 0.6 | competence | should avoidance
work/the-intern | sadness -0.2 0.3 | competence | comparison
work/layoff-rumour | worry -0.7 0.7 | security | catastrophising fortune-telling
work/she-had-my-back | love 0.8 0.5 | belonging competence | gratitude
work/slack-at-night | irritation -0.4 0.5 | rest autonomy | action
work/ravis-fan-cam | joy 0.7 0.5 | belonging | -
the-offer/the-recruiter-call | hope 0.3 0.6 | security competence | -
the-offer/shower-maths | hope 0.2 0.5 | security autonomy | rumination
the-offer/the-team-i-have | love 0.6 0.3 | belonging | -
the-offer/two-years | worry -0.4 0.4 | meaning autonomy | fortune-telling rumination
the-offer/eat-first | sadness -0.3 0.3 | belonging autonomy | avoidance rumination
the-offer/till-monday | worry -0.2 0.5 | autonomy | avoidance
the-offer/monday-is-close | worry -0.7 0.7 | autonomy security | catastrophising rumination
money/the-rent-email | irritation -0.5 0.6 | security | -
money/80-tomatoes | irritation -0.2 0.3 | security | -
money/food-budget | guilt -0.4 0.4 | security | self-criticism
money/the-pebble | worry -0.6 0.4 | security | rumination
money/four-months | worry -0.5 0.5 | security | comparison
money/ladakh-fund | hope 0.4 0.4 | meaning autonomy | action
money/october-in-upi | guilt -0.3 0.3 | security | self-criticism
mom-and-dad/are-you-eating | guilt -0.1 0.3 | belonging | -
mom-and-dad/her-knee | worry -0.6 0.5 | belonging security | -
mom-and-dad/cricket-from-2003 | sadness -0.3 0.2 | belonging meaning | -
mom-and-dad/the-pension-form | irritation -0.6 0.6 | belonging competence | -
mom-and-dad/the-right-age | irritation -0.4 0.4 | autonomy | mind-reading
mom-and-dad/pune-feels-far | sadness -0.5 0.3 | belonging | -
mom-and-dad/booked-it | joy 0.6 0.5 | belonging autonomy | action
ajji/filter-coffee | sadness -0.3 0.2 | belonging meaning | -
ajji/the-tulsi | guilt -0.4 0.3 | belonging meaning | -
ajji/jasmine-on-a-wall | love 0.3 0.4 | belonging meaning | -
ajji/her-rasam | guilt -0.4 0.3 | belonging | -
ajji/the-voice-note | sadness -0.7 0.4 | belonging | avoidance
ajji/in-the-dream | love 0.4 0.2 | belonging rest | -
kabir/sent-him-the-sunset | joy 0.5 0.4 | belonging | -
kabir/his-exams | worry -0.5 0.5 | belonging | -
kabir/the-exam-dream | worry -0.5 0.6 | competence rest | -
kabir/study-playlist | love 0.6 0.4 | belonging competence | action
kabir/sunday-call | love 0.7 0.4 | belonging | -
kabir/paper-went-fine | joy 0.8 0.6 | belonging | gratitude
rheas-wedding/112-messages | irritation -0.2 0.5 | belonging rest | -
rheas-wedding/confused-octopus | joy 0.3 0.6 | belonging competence | self-compassion
rheas-wedding/the-pen | love 0.7 0.3 | belonging | -
rheas-wedding/london | sadness -0.6 0.4 | belonging | reframe
rheas-wedding/the-outfit | worry -0.2 0.3 | belonging security | -
rheas-wedding/a-toast | love 0.6 0.5 | belonging meaning | -
rheas-wedding/time-zones | hope 0.3 0.3 | belonging | reframe
tara-and-the-flat/dishes-in-the-sink | irritation -0.4 0.4 | autonomy belonging | avoidance
tara-and-the-flat/two-seconds | joy 0.4 0.3 | belonging | action reframe
tara-and-the-flat/her-breakup | love 0.2 0.4 | belonging | self-criticism
tara-and-the-flat/the-tap | irritation -0.4 0.3 | security | -
tara-and-the-flat/two-spoons | joy 0.6 0.2 | belonging rest | -
tara-and-the-flat/should-i-move | worry -0.4 0.4 | security autonomy | rumination
arjun/his-name-on-slack | worry -0.4 0.7 | belonging | -
arjun/stomach-drop | sadness -0.6 0.8 | belonging | -
arjun/checking-anyway | guilt -0.5 0.5 | belonging rest | comparison rumination
arjun/what-i-miss | sadness -0.6 0.3 | belonging | reframe
arjun/muted | calm 0.3 0.2 | autonomy rest | action
running/sunday-5k | joy 0.6 0.6 | competence rest | self-compassion
running/back-pain | irritation -0.4 0.3 | rest | -
running/33-10 | joy 0.8 0.6 | competence | -
running/skipped-it | guilt -0.3 0.3 | rest | avoidance
running/new-shoes | hope 0.3 0.3 | competence security | -
running/rain-run | joy 0.9 0.7 | rest competence | -
sleep/1-20-am | worry -0.5 0.4 | rest | rumination
sleep/all-the-tabs | worry -0.6 0.6 | rest | rumination
sleep/five-more-minutes | guilt -0.2 0.2 | rest | avoidance
sleep/the-fan | calm 0.4 0.1 | rest | action
sleep/phone-in-the-kitchen | hope 0.4 0.3 | rest autonomy | action
sleep/eight-hours | joy 0.7 0.4 | rest | gratitude
food/maggi | guilt -0.3 0.2 | rest | self-criticism
food/canteen-dal | sadness -0.3 0.2 | belonging | -
food/biryani-at-eleven | guilt -0.4 0.3 | rest security | -
food/214-recipes | guilt -0.3 0.2 | competence | self-criticism
food/cooking-is-care | calm 0.5 0.2 | rest meaning | self-compassion
food/ajjis-rasam-written | love 0.7 0.4 | belonging meaning | action
the-city/autos-refusing | irritation -0.5 0.5 | security | -
the-city/surge | irritation -0.5 0.5 | security | -
the-city/domlur-flyover | joy 0.3 0.4 | security | -
the-city/a-serious-kid | joy 0.6 0.4 | belonging | -
the-city/broken-escalator | irritation -0.3 0.3 | rest | -
the-city/orange-parking-lot | wonder 0.7 0.4 | meaning | gratitude
biscuit/dry-spot | joy 0.5 0.2 | belonging | -
biscuit/someone-fed-him | love 0.6 0.3 | belonging meaning | gratitude
biscuit/marie-biscuits | joy 0.5 0.3 | belonging | action
biscuit/an-understanding | calm 0.6 0.2 | belonging | -
biscuit/dog-time | calm 0.5 0.1 | rest meaning | reframe
reading/unfinished-books | guilt -0.5 0.3 | competence meaning | comparison
reading/a-podcast-on-attention | irritation -0.1 0.3 | competence | -
reading/the-paper-book | wonder 0.4 0.4 | meaning | -
reading/one-chapter | hope 0.4 0.2 | rest competence | action
reading/kindle-battery | guilt -0.3 0.2 | competence | self-criticism
reading/finished-one | joy 0.7 0.4 | competence | self-compassion
the-phone/phone-first | guilt -0.4 0.3 | autonomy rest | self-criticism avoidance
the-phone/43-notifications | irritation -0.4 0.6 | rest autonomy | -
the-phone/everyone-is-somewhere | sadness -0.5 0.4 | belonging meaning | comparison
the-phone/twenty-minutes-without | joy 0.5 0.4 | autonomy competence | action
the-phone/screen-time | guilt -0.5 0.4 | autonomy rest | self-criticism
the-phone/face-down | calm 0.5 0.2 | autonomy | action
travel/ladakh-in-june | wonder 0.8 0.5 | meaning autonomy | -
travel/kyoto-in-april | hope 0.7 0.5 | meaning | -
travel/two-ladakhs | worry -0.4 0.4 | security meaning | all-or-nothing
travel/a-homestay-in-leh | hope 0.6 0.4 | meaning | action
travel/one-trip-with-rhea | love 0.6 0.4 | belonging meaning | -
friends/terrace-chai | calm 0.4 0.2 | belonging | -
friends/fourteen-weeks | joy 0.6 0.5 | belonging | -
friends/cubbon-park-sundays | sadness -0.3 0.2 | belonging | -
friends/alone-not-lonely | calm 0.5 0.2 | belonging autonomy | reframe
friends/group-call | joy 0.5 0.4 | belonging | -
friends/nehas-fear | love 0.6 0.4 | belonging | -
the-future/do-i-want-kids | worry -0.2 0.3 | autonomy meaning | acceptance
the-future/my-own-clock | calm 0.4 0.3 | autonomy | reframe
the-future/at-twenty | sadness -0.3 0.2 | meaning competence | comparison
the-future/good-parents | love 0.4 0.3 | belonging meaning | acceptance
the-future/smaller-now | sadness -0.3 0.3 | belonging | acceptance
design-craft/one-question-first | hope 0.6 0.6 | competence meaning | -
design-craft/final-v7-real | joy 0.2 0.3 | competence | -
design-craft/step-three | worry -0.2 0.4 | competence | self-criticism
design-craft/presenting | hope 0.3 0.7 | competence | action
design-craft/whats-the-metric | irritation -0.3 0.5 | competence autonomy | -
design-craft/a-small-yes | joy 0.6 0.4 | competence | gratitude
public-good/what-i-care-about | hope 0.2 0.4 | meaning | -
public-good/design-for-dad | hope 0.7 0.6 | meaning belonging | -
public-good/digilocker | irritation -0.2 0.4 | belonging competence | action
public-good/naive | worry -0.5 0.4 | security meaning | self-criticism
public-good/both | hope 0.5 0.4 | meaning security autonomy | reframe
who-i-am/the-grey-shirt | calm 0.1 0.2 | autonomy | reframe
who-i-am/who-i-dress-for | worry -0.2 0.3 | autonomy belonging | mind-reading
who-i-am/badge-photo | sadness -0.3 0.2 | rest | comparison
who-i-am/hypocrite | joy 0.4 0.4 | belonging | self-criticism
who-i-am/what-people-remember | sadness -0.2 0.3 | meaning | comparison
who-i-am/good-enough | calm 0.6 0.2 | rest competence | self-compassion acceptance
the-news/assam-floods | sadness -0.7 0.5 | meaning | rumination
the-news/donated | hope 0.4 0.3 | meaning | action
the-news/layoffs-again | worry -0.6 0.5 | security | catastrophising
the-news/rain-until-november | joy 0.2 0.2 | rest | -
the-news/onion-prices | joy 0.3 0.3 | belonging security | -
music/i-quit-guitar | guilt -0.4 0.3 | competence | all-or-nothing avoidance
music/the-coat-stand | guilt -0.3 0.2 | competence | self-criticism
music/the-drivers-radio | joy 0.6 0.3 | meaning | -
music/212-plays | joy 0.4 0.3 | rest | -
music/ten-minutes-a-day | hope 0.5 0.4 | competence | action
small-wonders/petrichor | wonder 0.6 0.2 | meaning rest | gratitude
small-wonders/whole-days-inside | wonder 0.6 0.3 | meaning belonging | -
small-wonders/puddle-lights | wonder 0.7 0.3 | meaning | gratitude
small-wonders/gokarna-stars | wonder 0.8 0.3 | meaning belonging | -
small-wonders/like-stars | calm 0.6 0.2 | meaning | acceptance
`;

// Reasoning between thoughts.
//   cause a > b | why      a set b off
//   answer a > b | why     b answers the question a asked
//   kept a > b | why       b is where intention a got done
//   tension a <> b | why   they pull in opposite directions
//   loop Name | a, b, c | why    one thought replayed in different words
//   open a | why           an intention with nothing after it yet
export const LOGIC = `
cause money/the-rent-email > tara-and-the-flat/should-i-move | Ten percent more rent turned moving into a real question
cause money/the-rent-email > tara-and-the-flat/the-tap | After the rise, the dripping tap felt personal
cause work/layoff-rumour > money/four-months | A rumour sent me counting how many months I could last
cause the-news/layoffs-again > the-offer/two-years | More layoffs made the safe job look safer
cause the-offer/the-recruiter-call > the-offer/shower-maths | The number started the maths
cause kabir/his-exams > kabir/the-exam-dream | His exams brought back my own exam dream
cause kabir/his-exams > kabir/study-playlist | Worry for him turned into something useful
cause arjun/his-name-on-slack > arjun/stomach-drop | Seeing his name
cause arjun/stomach-drop > arjun/checking-anyway | The jolt sent me looking
cause the-news/assam-floods > sleep/1-20-am | The floods kept me reading until 1:20
cause the-news/assam-floods > the-news/donated | Helplessness became a small act
cause the-phone/everyone-is-somewhere > travel/kyoto-in-april | Other people's trips started my own daydream
cause travel/kyoto-in-april > travel/two-ladakhs | The daydream ran into the budget
cause work/slack-at-night > sleep/phone-in-the-kitchen | A 10:40 pm ping pushed the phone out of the bedroom
cause the-phone/twenty-minutes-without > design-craft/presenting | The idea from a quiet twenty minutes got presented
cause running/back-pain > running/skipped-it | The back gave me a reason to skip
cause mom-and-dad/the-pension-form > public-good/design-for-dad | Dad's fight with a form became a mission
answer public-good/what-i-care-about > public-good/design-for-dad | Asked on 3 Oct, answered on 15 Oct
answer the-offer/two-years > public-good/both | The fear of "two years" became a two-year plan
answer mom-and-dad/pune-feels-far > mom-and-dad/booked-it | "Far" became a booked flight
answer the-future/do-i-want-kids > the-future/my-own-clock | Not knowing became a different timetable
answer rheas-wedding/london > rheas-wedding/time-zones | The fear of distance found its answer: keep watering
answer the-phone/phone-first > the-phone/face-down | The rule I kept failing, finally kept
kept ajji/her-rasam > food/ajjis-rasam-written | 13 Oct: never wrote it down. 28 Oct: wrote it down
kept reading/one-chapter > reading/finished-one | One chapter a night became a finished book
kept sleep/phone-in-the-kitchen > sleep/eight-hours | The phone left the room and sleep came back
kept kabir/study-playlist > kabir/paper-went-fine | The playlist, then the paper
kept design-craft/one-question-first > design-craft/a-small-yes | The idea on a fogged mirror got its test
kept tara-and-the-flat/dishes-in-the-sink > tara-and-the-flat/two-seconds | Two days rehearsing, two seconds saying it
kept running/sunday-5k > running/33-10 | Kept running, got faster
tension the-offer/the-recruiter-call <> the-offer/the-team-i-have | More money, or the people I like
tension work/she-had-my-back <> the-offer/shower-maths | Loyalty against the maths
tension public-good/design-for-dad <> public-good/naive | Meaning against security
tension travel/ladakh-in-june <> money/the-pebble | Wanting the mountains, worrying about every price
tension the-phone/twenty-minutes-without <> the-phone/screen-time | Proof I can put it down, proof I don't
tension mom-and-dad/the-right-age <> the-future/my-own-clock | Her timetable against mine
loop The offer | the-offer/shower-maths, the-offer/two-years, the-offer/eat-first, the-offer/till-monday, the-offer/monday-is-close | One decision replayed five times in 26 days, still unmade
loop After eleven | arjun/checking-anyway, the-phone/everyone-is-somewhere, food/biryani-at-eleven, the-phone/screen-time, sleep/1-20-am | The phone after 11 pm: other people's lives, food, more screen
loop Ajji, through food | ajji/filter-coffee, ajji/her-rasam, the-offer/eat-first, food/canteen-dal, food/ajjis-rasam-written | Grief keeps arriving through coffee, rasam and dal
loop The pebble | money/food-budget, money/the-pebble, the-city/surge, money/october-in-upi | Small prices, the same quiet worry
open the-offer/till-monday | Promised an answer by Monday; no decision yet
open tara-and-the-flat/should-i-move | Asked, never answered
open music/ten-minutes-a-day | Ten minutes of guitar a day, not started yet
open ajji/the-voice-note | Saved, not yet listened to
open rheas-wedding/the-outfit | Still the green kurta
`;
