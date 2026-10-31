// Runs the Supabase migration in PGlite (real Postgres in WebAssembly) with a
// small stand-in for Supabase's auth schema, then checks privacy and the free
// week as two different users. It tests the SQL, policies and triggers, not
// Supabase Auth itself.
//
//   npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const db = new PGlite();
const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(dir, f), "utf8"));
  console.log(`applied ${f}`);
}
await db.exec(`insert into auth.users values ('${A}', 'a@example.com'), ('${B}', 'b@example.com');`);

const as = async (user, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${user ?? ""}', false); set role ${user ? "authenticated" : "anon"};`);
  return db.query(sql, params);
};
const tryAs = async (user, sql, params) => {
  try {
    return { res: await as(user, sql, params) };
  } catch (e) {
    return { err: e.message };
  }
};
const admin = async (sql) => {
  await db.exec(`reset role; ${sql}`);
};

// Sign-up creates a profile with a free week.
const prof = await as(A, `select trial_ends_at, subscription_status from public.profiles`);
ok(prof.rows.length === 1, "signing up creates a profile");
const days = (new Date(prof.rows[0].trial_ends_at) - Date.now()) / 86400000;
ok(days > 6.9 && days < 7.1, "the free week lasts 7 days");

// A writes during the free week.
const topic = (await as(A, `insert into public.topics (name) values ('Family') returning id, user_id`)).rows[0];
ok(topic.user_id === A, "a topic belongs to whoever made it");
const thought = (
  await as(A, `insert into public.thoughts (topic_id, title, body, kind, tags) values ($1, 'Booked Pune', 'Booked the flight.', 'plan', '{person:Mom,brand:IndiGo}') returning id, user_id`, [topic.id])
).rows[0];
ok(thought.user_id === A, "a thought belongs to whoever wrote it");

// Privacy.
ok((await as(B, `select * from public.topics`)).rows.length === 0, "B cannot see A's topics");
ok((await as(B, `select * from public.thoughts`)).rows.length === 0, "B cannot see A's thoughts");
ok((await as(B, `select * from public.profiles where id = '${A}'`)).rows.length === 0, "B cannot see A's profile");
ok((await tryAs(null, `select * from public.thoughts`)).err !== undefined, "anonymous visitors are denied");
const intoA = await tryAs(B, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'x', 'y', 'idea')`, [topic.id]);
ok(intoA.err !== undefined, "B cannot file a thought under A's topic");
const upd = await as(B, `update public.thoughts set body = 'changed' where id = $1`, [thought.id]);
ok(upd.affectedRows === 0, "B cannot change A's thought");
const del = await as(B, `delete from public.thoughts where id = $1`, [thought.id]);
ok(del.affectedRows === 0, "B cannot delete A's thought");

// The night diary: spoken notes keep their shape, and only the server writes Claude's reading.
const spoken = await tryAs(
  A,
  `insert into public.thoughts (topic_id, title, body, kind, source, voice) values ($1, 'Told Ma', $2, 'feeling', 'voice', '{"seconds": 14, "wave": [0.2, 0.6, 0.4]}') returning id, source`,
  [topic.id, "a".repeat(1800)],
);
ok(spoken.err === undefined && spoken.res.rows[0].source === "voice", "a long spoken note saves with its voice shape");
ok((await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind, source) values ($1, 'x', 'y', 'idea', 'telepathy')`, [topic.id])).err !== undefined, "only typed, voice or flow are allowed sources");
ok((await as(A, `select source from public.thoughts where id = $1`, [thought.id])).rows[0].source === "typed", "older thoughts count as typed");
const fakeRead = await tryAs(A, `update public.thoughts set lens = '{"emotion": "joy"}' where id = $1`, [thought.id]);
ok(fakeRead.err !== undefined, "a person cannot write Claude's reading themselves");
const fakeInsert = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind, lens) values ($1, 'x', 'y', 'idea', '{}')`, [topic.id]);
ok(fakeInsert.err !== undefined, "nor slip one in with a new thought");
await admin(`update public.thoughts set lens = '{"emotion": "love"}' where id = '${spoken.res?.rows[0].id}'`);
ok((await as(A, `select lens->>'emotion' as e from public.thoughts where source = 'voice'`)).rows[0]?.e === "love", "the server's reading comes back with the thought");
ok((await as(B, `select * from public.thoughts where source = 'voice'`)).rows.length === 0, "B cannot see A's spoken notes");
ok((await as(A, `update public.thoughts set title = 'Booked Pune, again' where id = $1`, [thought.id])).affectedRows === 1, "people can still edit their own words");
await admin(`delete from public.thoughts where source = 'voice'`);

// Nobody can give themselves more time or a subscription from the browser.
const selfUpgrade = await tryAs(A, `update public.profiles set trial_ends_at = now() + interval '10 years', subscription_status = 'active'`);
const stillTrial = (await as(A, `select subscription_status from public.profiles`)).rows[0].subscription_status;
ok(selfUpgrade.err !== undefined || stillTrial === "none", "a profile cannot be upgraded from the browser");

// When the free week ends, writing stops; reading continues.
await admin(`update public.profiles set trial_ends_at = now() - interval '1 day' where id = '${A}'`);
const late = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'Late', 'After the week', 'idea')`, [topic.id]);
ok(late.err !== undefined, "after the free week, new thoughts are refused");
ok((await as(A, `select * from public.thoughts`)).rows.length === 1, "after the free week, everything saved is still readable");

// A subscription (set by the server once Razorpay confirms) opens writing again.
await admin(`update public.profiles set subscription_status = 'active', current_period_end = now() + interval '30 days' where id = '${A}'`);
const member = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'Member', 'Subscribed', 'idea') returning id`, [topic.id]);
ok(member.err === undefined, "members can add thoughts");
await admin(`update public.profiles set subscription_status = 'authenticated', current_period_end = null where id = '${A}'`);
const scheduled = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'Scheduled', 'First charge pending', 'idea')`, [topic.id]);
ok(scheduled.err === undefined, "a card set up with the first charge pending counts as paid");
await admin(`update public.profiles set subscription_status = 'halted' where id = '${A}'`);
const halted = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'Halted', 'Payment failed', 'idea')`, [topic.id]);
ok(halted.err !== undefined, "a halted subscription stops new thoughts");

// Paying by UPI: the person submits the reference; only the owner can approve it.
const claim = await tryAs(A, `insert into public.payments (utr, amount_inr) values ('123456789012', 99) returning status, email`);
ok(claim.err === undefined && claim.res.rows[0].status === "pending", "a person can submit a UPI payment reference");
ok(claim.res?.rows[0].email === "a@example.com", "the claim records whose payment it is");
ok((await tryAs(A, `insert into public.payments (utr, amount_inr) values ('12345', 99)`)).err !== undefined, "a UPI reference must be 12 digits");
ok((await tryAs(B, `insert into public.payments (utr, amount_inr) values ('123456789012', 99)`)).err !== undefined, "one payment cannot unlock two accounts");
ok((await as(B, `select * from public.payments`)).rows.length === 0, "nobody else can see someone's claim");
ok((await tryAs(A, `update public.payments set status = 'approved'`)).err !== undefined, "a person cannot approve their own payment");
ok((await tryAs(A, `insert into public.payments (utr, amount_inr, status) values ('222222222222', 99, 'approved')`)).err !== undefined, "nor submit a claim that is already approved");
ok((await tryAs(A, `insert into public.payments (utr, amount_inr) values ('333333333333', 99)`)).err === undefined, "a second claim can wait");
ok((await tryAs(A, `insert into public.payments (utr, amount_inr) values ('444444444444', 99)`)).err === undefined, "a third claim can wait");
ok((await tryAs(A, `insert into public.payments (utr, amount_inr) values ('555555555555', 99)`)).err !== undefined, "no more than three claims wait at once");
const stillLocked = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'Early', 'Claim only', 'idea')`, [topic.id]);
ok(stillLocked.err !== undefined, "a claim alone unlocks nothing");
await admin(`update public.payments set status = 'approved' where utr = '123456789012'`);
const unlocked = await tryAs(A, `insert into public.thoughts (topic_id, title, body, kind) values ($1, 'Paid', 'UPI approved', 'idea') returning id`, [topic.id]);
ok(unlocked.err === undefined, "once the owner approves, the account can write again");
const upiProfile = (await as(A, `select subscription_status, current_period_end from public.profiles`)).rows[0];
const upiDays = (new Date(upiProfile.current_period_end) - Date.now()) / 86400000;
ok(upiProfile.subscription_status === "active" && upiDays > 29.9 && upiDays < 30.1, "approval gives 30 days of membership");
ok((await as(A, `select reviewed_at from public.payments where utr = '123456789012'`)).rows[0].reviewed_at !== null, "the review is time-stamped");
await admin(`update public.payments set status = 'approved' where utr = '123456789012'`);
const afterRepeat = (await as(A, `select current_period_end from public.profiles`)).rows[0].current_period_end;
ok(Math.abs(new Date(afterRepeat) - new Date(upiProfile.current_period_end)) < 1000, "approving the same payment twice adds no extra time");

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
