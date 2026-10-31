// One month inside one mind: a 29-year-old product designer in Bengaluru,
// October 2026. Example content, labelled as such in the interface.
//
// "## Topic | what it is about | news: query; query" starts a topic.
// "- MM-DD HH:MM | Title | kind | Thought | tags" is one thought that mattered.
// Kinds: n noticed · m memory · w worry · p plan · f feeling · i idea · q question.
// Tags: @person  #place  $brand (looked up in What's new; _ for spaces)  ~theme

export const YEAR = 2026;

export const MONTH_TEXT = `
## Work | What I build for other people
- 10-01 09:40 | The roadmap | f | First day of the month and the roadmap already looks like someone else’s handwriting. | ~deadlines
- 10-05 10:05 | End of day | w | Told Priya the research slide would be ready “end of day”. Again. She did the small pause. | @Priya ~deadlines
- 10-08 11:30 | The intern | n | The new intern presented with numbers and no apologies. At twenty-two I apologised before every sentence. | @Priya ~confidence
- 10-14 16:10 | Layoff rumour | w | Another startup let go of thirty percent. We just raised money, which is what everyone says right before. | ~job-security ~money
- 10-19 12:20 | She had my back | f | In the design review Priya backed me with data I didn’t know she had. | @Priya ~confidence
- 10-23 22:40 | Slack at night | n | Slack pinged at 10:40 pm about a button colour. Muted it until morning. | $Slack ~sleep ~phone
- 10-28 09:15 | Ravi’s fan cam | n | Ravi’s camera pointed at his ceiling fan for the whole standup. Everyone laughed. The morning loosened. | @Ravi

## The offer | A bigger job, or the right one
- 10-03 14:30 | The recruiter call | n | Halcyon Pay called. Forty percent more, plus stock that may or may not be worth anything. | ~money ~job-security
- 10-04 07:55 | Shower maths | q | Did the maths again in the shower. Forty percent would pay for Ladakh twice. | ~money #Ladakh
- 10-09 22:10 | The team I have | f | But I like my team. Ravi’s terrible jokes. Priya defending us in reviews. | @Priya @Ravi
- 10-12 23:20 | Two years | q | People say “two years, then I’ll do the thing” and it becomes eight. Would I be different? | ~ambition
- 10-17 08:30 | Eat first | q | Ajji would say “eat first, decide after”. I’ve done neither. | @Ajji ~food
- 10-24 13:10 | Till Monday | p | Told the recruiter I need till Monday. She said “super”. | ~deadlines
- 10-29 21:45 | Monday is close | w | Monday is four days away. Emotionally it’s tomorrow. | ~deadlines ~sleep

## Money | Where it goes, and where it doesn’t
- 10-01 07:30 | The rent email | n | Landlord uncle: “Revised rent from January.” Ten percent more for the same dripping tap. God bless. | ~rent #Home
- 10-06 19:05 | ₹80 tomatoes | n | Tomatoes are ₹80 a kilo. I held one like jewellery. | ~prices ~food
- 10-11 20:30 | Food budget | n | The budget app says food is over by ₹2,300. Most of it is late-night Swiggy. | $Swiggy ~food ~prices
- 10-16 23:00 | The pebble | w | Money worry is quiet. It sits in every price tag like a pebble in a shoe. | ~prices
- 10-20 09:50 | Four months | n | Four months of emergency fund. The internet says six. | ~job-security
- 10-25 18:15 | Ladakh fund | n | The Ladakh fund is at ₹38,000. The goal is ₹90,000. | #Ladakh ~travel
- 10-30 08:10 | October in UPI | n | Scrolled October’s PhonePe history like a crime scene. Coffee. Coffee. Autos. Coffee. | $PhonePe ~prices ~commute

## Mom and Dad | Getting older in small ways
- 10-02 12:40 | Are you eating | n | Mom’s first question, always: “Are you eating properly?” I said yes. Mostly true. | @Mom ~food ~guilt
- 10-07 12:45 | Her knee | w | Her knee hurts again. She won’t see a doctor. “It’s age, what will he do?” | @Mom ~health
- 10-10 20:05 | Cricket from 2003 | n | Dad has started watching cricket highlights from 2003. Retirement is long. | @Dad
- 10-15 21:30 | The pension form | m | Dad spent three days on a pension form last year and called me shaking with anger. | @Dad ~forms
- 10-18 12:50 | The right age | n | Mom forwarded another article about “the right age”. No message. Just the link. | @Mom ~future
- 10-22 13:00 | Pune feels far | q | Pune is an hour’s flight. Why does it feel like another country? | #Pune @Mom @Dad ~distance
- 10-27 09:30 | Booked it | p | Booked IndiGo to Pune for the 14th of November. Actually booked, not just said. | $IndiGo #Pune @Mom @Dad

## Ajji | Fourteen months, still arriving sideways
- 10-01 07:10 | Filter coffee | m | Ajji poured coffee between two steel tumblers until it frothed. The kettle reminds me every morning. | @Ajji ~grief ~food
- 10-04 07:20 | The tulsi | n | The tulsi from her garden has three brown leaves. Watered it and said sorry, quietly. | @Ajji #Home ~grief
- 10-09 19:45 | Jasmine on a wall | n | A wall covered in jasmine stopped me mid-step. She wore it every evening. | @Ajji ~grief #Indiranagar
- 10-13 20:40 | Her rasam | m | Tamarind, tomato, pepper. I never wrote it down. | @Ajji ~food
- 10-21 23:10 | The voice note | f | Forty-one seconds of her voice, saved. I still haven’t played it again. | @Ajji ~grief ~phone
- 10-26 23:55 | In the dream | m | She was in the kitchen in my dream. The coffee was frothing. | @Ajji ~sleep

## Kabir | My little brother, mid-exams
- 10-05 17:50 | Sent him the sunset | p | Sent Kabir a photo of the orange parking lot. He replied “nice” in nine seconds. | @Kabir ~phone
- 10-12 18:05 | His exams | w | His exams start on the 26th. He sounds stressed. He sounds like me. | @Kabir ~exams
- 10-16 06:50 | The exam dream | m | Dreamt I had a maths exam and hadn’t attended a class. I’m twenty-nine. | ~exams ~sleep
- 10-19 21:00 | Study playlist | p | Made him the Spotify playlist that got me through finals. Lo-fi and one embarrassing song. | @Kabir $Spotify ~music
- 10-25 20:15 | Sunday call | n | Called him on Sunday. Didn’t give advice. Just listened. He laughed twice. | @Kabir @Mom
- 10-29 22:30 | Paper went fine | f | “Paper went fine”, and a thumbs up. I was more relieved than he was. | @Kabir ~exams

## Rhea’s wedding | Sixth grade to London
- 10-02 07:35 | 112 messages | n | 112 messages in the wedding group. Someone made a spreadsheet of songs. | @Rhea $WhatsApp ~phone
- 10-06 22:00 | Confused octopus | n | Practised the sangeet steps in the mirror. I dance like a confused octopus. | @Rhea ~confidence
- 10-11 21:30 | The pen | m | We met when she lent me a pen in sixth grade and never asked for it back. I still have it. | @Rhea
- 10-14 22:15 | London | f | After the wedding she moves to London. I’m not losing her. I’m losing living in the same city. | @Rhea #London ~distance
- 10-20 18:30 | The outfit | p | Need something that isn’t the green kurta from Diwali 2022. | @Rhea ~money
- 10-24 23:00 | A toast | i | Maybe I’ll give a toast. The pen story. I’d cry. Everyone does. | @Rhea
- 10-30 19:00 | Time zones | q | Do friendships survive five and a half hours? The ones you water do. | @Rhea #London ~distance

## Tara and the flat | Strangers two years ago
- 10-03 07:25 | Dishes in the sink | n | Tara’s dishes have been in the sink for two days. A polite note is still a note. | @Tara #Home
- 10-04 21:20 | Two seconds | f | Brought up the dishes, gently. She said “oh god, sorry” and did them. Two days rehearsing a two-second talk. | @Tara #Home ~confidence
- 10-10 21:15 | Her breakup | n | Tara ended it with Sid. I gave her advice I’ve never once followed. | @Tara ~love
- 10-13 20:50 | The tap | n | The bathroom tap drips. Drip. Drip. Ten percent more rent. | #Home ~rent
- 10-18 22:30 | Two spoons | n | Split the last tub of ice cream with two spoons and scrolled Netflix for twenty-five minutes. | @Tara $Netflix
- 10-23 20:00 | Should I move | q | Somewhere cheaper with a longer commute? Moving takes a whole month out of your life. | #Home ~rent ~commute

## Arjun | Eight months later
- 10-07 15:30 | His name on Slack | n | Arjun’s name appeared in a shared Slack channel. Our companies are partnering on something. | @Arjun $Slack
- 10-07 15:32 | Stomach drop | f | My body still knows his name before I do. | @Arjun ~love
- 10-08 23:40 | Checking anyway | n | Checked his LinkedIn at midnight. Promoted. Typed “good for him” to nobody. | @Arjun $LinkedIn ~phone ~sleep
- 10-15 19:10 | What I miss | m | I don’t miss him exactly. I miss having someone to tell small things to. | @Arjun ~love ~loneliness
- 10-22 15:40 | Muted | p | Muted the channel. Not dramatic. Practical. | @Arjun $Slack

## Running | Proving I could
- 10-04 06:30 | Sunday 5K | m | 5K in 34 minutes. Stopped twice. Still counts. | $Strava ~health
- 10-08 14:00 | Back pain | n | Lower back aching. Curled like a prawn over the laptop all afternoon. | ~health ~posture
- 10-11 06:45 | 33:10 | f | Shaved a minute off. Logged it on Strava and felt like I’d won a medal. | $Strava ~health ~confidence
- 10-15 19:40 | Skipped it | f | Skipped the run. My back said so. Or I said my back said so. Walked instead. | ~health ~guilt
- 10-21 18:20 | New shoes | p | The soles are gone. Decathlon has a sale; the good pair is still ₹4,999. | $Decathlon ~money ~health
- 10-26 06:40 | Rain run | f | Ran in the rain. Puddles with streetlights in them. Best run of the month. | ~health ~rain #Bengaluru

## Sleep | Lights out by eleven, in theory
- 10-02 01:20 | 1:20 am | n | Asleep at 1:20 after reading about the Assam floods in bed. | ~sleep ~news ~phone
- 10-09 23:30 | All the tabs | f | The moment the lights go off, my brain opens all its tabs. | ~sleep
- 10-13 06:40 | Five more minutes | f | Five more minutes always turns into twenty. | ~sleep
- 10-17 23:20 | The fan | n | The fan clicks once every turn. In for four, hold for four, out for six, in time with it. | ~sleep ~calm
- 10-24 22:45 | Phone in the kitchen | p | Phone charging in the kitchen tonight. First time this month. | ~sleep ~phone
- 10-25 07:10 | Eight hours | f | Slept eight hours and the morning felt twice as long. | ~sleep ~health

## Food | Who I am at 11 pm
- 10-03 20:30 | Maggi | n | Maggi for dinner. Two packets, one egg, a little guilt. | $Maggi ~guilt ~food
- 10-08 12:30 | Canteen dal | n | The canteen dal tastes of nothing. Mom’s tadka could be heard from the next room. | @Mom ~food
- 10-12 23:10 | Biryani at eleven | f | Ordered biryani at 11 pm. Hungry, tired, tapping. | $Swiggy ~sleep ~money ~food
- 10-17 20:00 | 214 recipes | n | 214 saved recipes on Instagram. I’ve cooked three. | $Instagram ~phone ~food
- 10-22 20:20 | Cooking is care | i | Cooking for yourself says you’re worth the trouble. | ~calm ~food
- 10-28 20:30 | Ajji’s rasam, written | p | Asked Mom for Ajji’s rasam on the phone. Wrote it down this time. | @Mom @Ajji ~food

## The city | Bengaluru, in the rain | news: Bengaluru rain
- 10-01 08:45 | Autos refusing | n | Three autos said no. One said yes, for double. | ~commute ~rain #Bengaluru
- 10-05 08:50 | Surge | w | ₹180 on Rapido for six kilometres. Rain tax. | $Rapido ~money ~commute
- 10-09 09:10 | Domlur flyover | n | Twenty minutes on the flyover under a billboard: “Luxury living from ₹2.4 crore.” I laughed out loud. | ~commute #Bengaluru ~rent
- 10-14 18:20 | A serious kid | n | A kid on the metro stared at me with total seriousness. I smiled. He hid, then peeked again. | $Namma_Metro ~commute ~kindness
- 10-19 18:25 | Broken escalator | n | The station escalator is broken again. Eighty people climbing in silence. | $Namma_Metro #Indiranagar ~commute
- 10-26 17:50 | Orange parking lot | n | The clouds broke at sunset and the parking lot turned orange. | #Bengaluru ~rain

## Biscuit | The street dog by the gate
- 10-01 08:40 | Dry spot | n | Biscuit is asleep under the scooter by the gate. Dry spot. Smart dog. | @Biscuit #Indiranagar ~rain
- 10-06 08:42 | Someone fed him | n | Someone left rice for him in a steel plate. I don’t know who. I like them already. | @Biscuit ~kindness
- 10-15 19:50 | Marie biscuits | p | Bought Britannia Marie for Biscuit. Fitting. | @Biscuit $Britannia ~kindness
- 10-15 19:55 | An understanding | n | He ate four, sat down, and looked at me like we had an understanding. | @Biscuit ~calm
- 10-27 08:40 | Dog time | i | Biscuit lives in the present. He isn’t worried about rent. | @Biscuit ~rent ~calm

## Reading | Fifty books a year, once
- 10-01 08:55 | Unfinished books | w | I used to read fifty books a year. I haven’t finished one since March. | ~attention
- 10-09 09:05 | A podcast on attention | n | Half listening to a podcast about attention. Feels like proof. | $Spotify ~attention ~commute
- 10-14 18:30 | The paper book | q | The woman across on the metro was halfway through a paper book. I wanted the title so badly. | $Namma_Metro ~attention
- 10-20 22:50 | One chapter | p | One chapter before bed. Phone in the other room. | ~sleep ~phone ~attention
- 10-27 23:05 | Kindle battery | n | My Kindle still had 80 percent after six months. That says everything. | $Kindle ~attention
- 10-29 22:20 | Finished one | f | Finished a book. A short one. Still counts. | ~attention ~confidence

## The phone | Lying here like a fish with a screen
- 10-02 06:45 | Phone first | f | Feet on the floor before the phone: the one rule I keep failing. | ~phone ~sleep
- 10-07 07:30 | 43 notifications | n | Forty-three notifications before seven. Most from one wedding group. | $WhatsApp @Rhea ~phone
- 10-11 23:15 | Everyone is somewhere | n | Lisbon. Spiti. A beach that looks edited. Comparison is a tax I pay every night around eleven. | $Instagram ~phone ~travel ~comparison
- 10-16 13:40 | Twenty minutes without | p | Twenty minutes without the phone after lunch. Got an idea for onboarding. | ~attention ~phone ~onboarding
- 10-23 23:00 | Screen time | n | Screen time: 6 hours 41 minutes. Up 12 percent. | $Apple ~phone ~sleep
- 10-28 22:50 | Face down | p | Turned the phone face down. A small act of independence. | ~phone ~calm

## Travel | Somewhere that makes me small | news: Ladakh travel; Kyoto cherry blossom
- 10-04 07:58 | Ladakh in June | i | Mountains that make you feel like a small, unimportant dot. In a good way. | #Ladakh ~travel
- 10-11 23:20 | Kyoto in April | i | Cherry blossoms, quiet temples and very bad Japanese. | #Kyoto ~travel $Instagram
- 10-16 23:05 | Two Ladakhs | w | Japan costs two Ladakhs. Neither is funded. | #Ladakh #Kyoto ~money ~travel
- 10-21 21:40 | A homestay in Leh | n | Found a homestay in Leh on Airbnb with a dog in every photo. Saved it. | $Airbnb #Ladakh ~travel
- 10-29 20:30 | One trip with Rhea | i | One last trip with Rhea before London? Gokarna, like when we were twenty. | @Rhea #Gokarna ~travel

## Friends | The ones I water, and the ones I don’t
- 10-08 16:30 | Terrace chai | n | Chai with Neha on the terrace. The sky looked like wet cement. | @Neha ~rain
- 10-08 16:35 | Fourteen weeks | n | Neha is pregnant. She told me before she told HR. | @Neha ~future
- 10-12 20:00 | Cubbon Park Sundays | m | My first month here I walked Cubbon Park every Sunday because I knew no one. | #Bengaluru ~loneliness
- 10-17 21:00 | Alone, not lonely | i | Alone and lonely are different rooms. I’m mostly in the first one. | ~loneliness ~calm
- 10-22 19:30 | Group call | n | College group call. Six faces, four time zones, the same three jokes. | ~distance #London
- 10-27 13:20 | Neha’s fear | n | She’s scared of being a bad mother. She’ll be a great one. | @Neha ~future

## The future | Kids, clocks and timetables
- 10-08 16:40 | Do I want kids | q | I don’t know. I’m allowed not to know at twenty-nine. | ~future @Neha
- 10-18 12:55 | My own clock | i | My clock isn’t broken. It runs on a different timetable. | ~future @Mom
- 10-20 23:30 | At twenty | m | At twenty I thought twenty-nine would feel finished, like a house with furniture. | ~future ~confidence
- 10-26 23:40 | Good parents | q | What makes a good parent? Mine did their best with what they had. | @Mom @Dad ~future
- 10-29 23:50 | Smaller now | f | Dad carried me into the waves at Gokarna. He’s smaller now. Or I’m bigger. | @Dad #Gokarna

## Design craft | The parts nobody sees
- 10-04 07:58 | One question first | i | The onboarding should ask one question first, not seven. Wrote it on the fogged mirror. | ~onboarding
- 10-06 11:00 | final_v7_REAL | n | The Figma file is called onboarding_final_v7_REAL. I named it. | $Figma ~onboarding
- 10-09 11:30 | Step three | n | Forty-one percent of people quit at step three. Probably the same reason I quit things. | ~onboarding ~quitting
- 10-19 12:10 | Presenting | n | Presented the one-question idea. My voice wobbled, then settled. | @Priya ~confidence ~onboarding
- 10-19 12:15 | What’s the metric | q | The CTO asked “what’s the metric?” before I finished the sentence. | ~onboarding
- 10-28 15:00 | A small yes | f | The A/B test starts next sprint. Small yeses count. | ~onboarding ~confidence

## Public good | The forms my parents struggle with
- 10-03 14:45 | What I care about | q | What do I actually care about? Not what sounds good on LinkedIn. | $LinkedIn ~ambition
- 10-15 21:35 | Design for Dad | i | Someone should design pension forms for people like Dad. Maybe that someone is me. | @Dad ~forms ~ambition
- 10-18 10:00 | DigiLocker | n | Helped Mom get her documents into DigiLocker over a video call. Forty minutes, three OTPs. | $DigiLocker @Mom ~forms
- 10-21 22:00 | Naive | w | Is that naive? Slow, less money, endless approvals. | ~ambition ~money
- 10-25 11:30 | Both | i | Maybe it isn’t either-or. Take the money for two years, save, then do the thing. | ~ambition ~money ~job-security

## Who I am | The grey shirt, again
- 10-02 08:20 | The grey shirt | n | The grey shirt again, third time this week. Nobody notices clothes as much as the person wearing them. | ~self-image
- 10-07 08:25 | Who I dress for | q | Do I dress for myself, or for the version of me in other people’s heads? | ~self-image ~comparison
- 10-13 09:35 | Badge photo | n | My badge photo is from my first week. That person looks rested. | ~self-image ~sleep
- 10-18 21:45 | Hypocrite | f | Said “I’m a hypocrite” out loud to Tara. She laughed for the first time that night. | @Tara ~confidence
- 10-24 19:45 | What people remember | q | What will people remember about me? Ajji is remembered for jasmine. I’ll be the grey shirt. | ~self-image @Ajji
- 10-30 07:40 | Good enough | f | Good enough. Most days are made of good enough. | ~calm ~self-image

## The news | The world through a small screen | news: Assam floods
- 10-02 00:50 | Assam floods | n | Read about the floods in Assam at midnight and couldn’t stop. | ~news ~sleep
- 10-02 08:30 | Donated | p | Donated a small amount before leaving. Small, but not nothing. | ~news ~kindness
- 10-14 16:15 | Layoffs again | n | Another round of layoffs in the news. Thirty percent, again. | ~news ~job-security
- 10-20 08:00 | Rain until November | n | The forecast says rain until November. This city has timing. | ~rain #Bengaluru ~news
- 10-27 07:45 | Onion prices | n | Onion prices on the morning news. Mom called to discuss them like gossip. | ~prices @Mom ~news

## Music | A very expensive coat stand
- 10-06 11:40 | I quit guitar | m | Quit guitar after three months because my fingers hurt and I sounded bad. | ~quitting ~music
- 10-06 21:10 | The coat stand | n | The guitar is still in the corner. A very expensive coat stand. | #Home ~music
- 10-09 09:00 | The driver’s radio | n | The auto driver played old Kannada songs and hummed the high parts. | ~music ~commute
- 10-19 21:05 | 212 plays | n | Spotify says I’ve played the same song 212 times this year. | $Spotify ~music
- 10-27 21:30 | Ten minutes a day | p | Ten minutes of guitar a day. Step three is where people leave. | ~music ~quitting ~onboarding

## Small wonders | What stops me mid-step
- 10-05 06:55 | Petrichor | n | The room smelled of wet mud and someone’s agarbatti downstairs. | ~rain #Home
- 10-14 18:35 | Whole days inside | i | Everyone in that metro carriage had a whole day inside them, like mine. | $Namma_Metro ~kindness
- 10-21 20:10 | Puddle lights | n | Every puddle had a streetlight in it. | ~rain #Bengaluru
- 10-26 23:58 | Gokarna stars | m | At Gokarna there were so many stars the sky looked dusty. | #Gokarna ~calm
- 10-30 00:10 | Like stars | i | Maybe thoughts are like stars. Thousands a day. Most go out by morning. | ~calm
`;
