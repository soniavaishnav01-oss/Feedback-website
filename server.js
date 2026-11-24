require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PORT = 3000, DB_FILE = 'loopback.db' } = process.env;
const CM = Number(process.env.COMMISSION || 0.2);
const RATES = { short: 10, detailed: 25, website: 30, app: 80, interview: 150 };
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error('Set JWT_SECRET (32+ chars) in .env'); process.exit(1); }

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.exec(`
create table if not exists users(id integer primary key, name text not null, email text unique not null, hash text not null, role text not null, profile text default '{}', created text default current_timestamp);
create table if not exists campaigns(id integer primary key, owner integer not null, title text, descr text, type text, reward real, need integer, deadline text, questions text, steps text, link text, target text, status text default 'Live', reserved real default 0, created text default current_timestamp);
create table if not exists submissions(id integer primary key, cid integer not null, uid integer not null, answers text, status text default 'Pending Review', reason text, reviewer integer, created text default current_timestamp, unique(cid, uid));
create table if not exists ledger(id integer primary key, uid integer not null, kind text, amount real, note text, sid integer, created text default current_timestamp);
create unique index if not exists one_reward on ledger(sid) where kind = 'reward';
`);

if (ADMIN_EMAIL && ADMIN_PASSWORD && !db.prepare("select 1 from users where role='a'").get())
  db.prepare('insert into users(name,email,hash,role) values(?,?,?,?)').run('Admin', ADMIN_EMAIL.toLowerCase(), bcrypt.hashSync(ADMIN_PASSWORD, 12), 'a');

const app = express();
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", 'https://fonts.googleapis.com'], styleSrcAttr: ["'unsafe-inline'"], fontSrc: ['https://fonts.gstatic.com'], scriptSrc: ["'self'"] } } }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30 }));
app.use(express.static(path.join(__dirname, '../public')));

const wrap = fn => (req, res) => { try { fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: 'Something went wrong.' }); } };
const bad = (res, m, c = 400) => res.status(c).json({ error: m });
const str = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const json = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const sign = u => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, profile: json(u.profile, {}) });

const auth = (...roles) => (req, res, next) => {
  try {
    const p = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), JWT_SECRET);
    const u = db.prepare('select * from users where id=?').get(p.id);
    if (!u) throw 0;
    if (roles.length && !roles.includes(u.role)) return bad(res, 'Not allowed for your account type.', 403);
    req.user = u; next();
  } catch { bad(res, 'Please log in.', 401); }
};

const unit = c => c.reward / (1 - CM);
const approved = id => db.prepare("select count(*) n from submissions where cid=? and status='Approved'").get(id).n;
const balance = uid => db.prepare('select coalesce(sum(amount),0) b from ledger where uid=?').get(uid).b;
const addLedger = (uid, kind, amount, note, sid = null) => db.prepare('insert into ledger(uid,kind,amount,note,sid) values(?,?,?,?,?)').run(uid, kind, amount, note, sid);

function release(c) {
  const pend = db.prepare("select count(*) n from submissions where cid=? and status='Pending Review'").get(c.id).n;
  const fresh = db.prepare('select * from campaigns where id=?').get(c.id);
  const r = Math.max(0, fresh.reserved - pend * unit(fresh));
  if (r > 0) { db.prepare('update campaigns set reserved=reserved-? where id=?').run(r, c.id); addLedger(c.owner, 'release', r, 'Unused budget released: ' + c.title); }
}
const expire = () => db.prepare("select * from campaigns where status='Live' and deadline < date('now')").all()
  .forEach(c => { db.prepare("update campaigns set status='Ended' where id=?").run(c.id); release(c); });

function matches(c, p) {
  const t = json(c.target, {});
  if (t.age?.length && !t.age.includes(p.age)) return false;
  if (t.loc && !t.loc.split(',').some(x => (p.loc || '').toLowerCase().includes(x.trim().toLowerCase()))) return false;
  return true;
}

/* ---------- auth ---------- */
app.post('/api/auth/register', wrap((req, res) => {
  const name = str(req.body.name, 80), email = str(req.body.email, 120).toLowerCase(), pw = String(req.body.password || ''), role = req.body.role;
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter your name and a valid email.');
  if (pw.length < 8) return bad(res, 'Password must be at least 8 characters.');
  if (!['f', 'c'].includes(role)) return bad(res, 'Choose an account type.');
  if (db.prepare('select 1 from users where email=?').get(email)) return bad(res, 'An account with this email already exists.', 409);
  const id = db.prepare('insert into users(name,email,hash,role) values(?,?,?,?)').run(name, email, bcrypt.hashSync(pw, 12), role).lastInsertRowid;
  const u = db.prepare('select * from users where id=?').get(id);
  res.json({ token: sign(u), user: pub(u) });
}));

app.post('/api/auth/login', wrap((req, res) => {
  const u = db.prepare('select * from users where email=?').get(str(req.body.email, 120).toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.hash)) return bad(res, 'Incorrect email or password.', 401);
  res.json({ token: sign(u), user: pub(u) });
}));

app.get('/api/me', auth(), (req, res) => res.json(pub(req.user)));
app.put('/api/profile', auth('c'), wrap((req, res) => {
  const b = req.body, p = { age: str(b.age, 10), loc: str(b.loc, 80), prof: str(b.prof, 80), int: str(b.int, 120) };
  if (!p.age || !p.loc) return bad(res, 'Age group and location are required.');
  db.prepare('update users set profile=? where id=?').run(JSON.stringify(p), req.user.id);
  res.json(p);
}));

/* ---------- campaigns ---------- */
app.get('/api/campaigns', auth('c'), wrap((req, res) => {
  expire();
  const p = json(req.user.profile, {});
  const rows = db.prepare("select * from campaigns where status='Live' and owner!=? and id not in (select cid from submissions where uid=?)").all(req.user.id, req.user.id)
    .filter(c => approved(c.id) < c.need && matches(c, p))
    .map(c => ({ id: c.id, title: c.title, descr: c.descr, type: c.type, reward: c.reward, left: c.need - approved(c.id), deadline: c.deadline, questions: json(c.questions, []), steps: json(c.steps, []), link: c.link }));
  res.json(rows);
}));

app.post('/api/campaigns', auth('f'), wrap((req, res) => {
  const b = req.body, title = str(b.title, 120), descr = str(b.descr), type = b.type, need = Math.floor(Number(b.need));
  const qs = (Array.isArray(b.questions) ? b.questions : []).slice(0, 15).map(q => ({ q: str(q.q, 300), h: str(q.h, 200), t: ['text', 'rating', 'yesno'].includes(q.t) ? q.t : 'text', r: q.r ? 1 : 0 })).filter(q => q.q);
  let reward = RATES[type];
  if (type === 'interview') reward = Math.min(200, Math.max(100, Number(b.reward) || 150));
  if (!title || descr.length < 20) return bad(res, 'Add a title and a description of at least 20 characters.');
  if (!reward) return bad(res, 'Choose a feedback type.');
  if (!qs.length) return bad(res, 'Add at least one question.');
  if (!(need >= 1 && need <= 1000)) return bad(res, 'Responses required must be between 1 and 1000.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.deadline || '') || b.deadline <= new Date().toISOString().slice(0, 10)) return bad(res, 'Choose a deadline in the future.');
  const budget = (reward * need) / (1 - CM);
  const tx = db.transaction(() => {
    if (balance(req.user.id) < budget) throw new Error('FUNDS');
    const id = db.prepare('insert into campaigns(owner,title,descr,type,reward,need,deadline,questions,steps,link,target,reserved) values(?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.user.id, title, descr, type, reward, need, b.deadline, JSON.stringify(qs), JSON.stringify(str(b.steps).split('\n').map(s => s.trim()).filter(Boolean)), /^https?:\/\//.test(b.link || '') ? str(b.link, 300) : '',
        JSON.stringify({ age: Array.isArray(b.age) ? b.age.slice(0, 4) : [], loc: str(b.loc, 120) }), budget).lastInsertRowid;
    addLedger(req.user.id, 'reserve', -budget, 'Budget reserved: ' + title);
    return id;
  });
  try { res.json({ id: tx(), budget }); } catch (e) { e.message === 'FUNDS' ? bad(res, 'Add ₹' + Math.ceil(budget - balance(req.user.id)) + ' more to your wallet to launch.', 402) : (() => { throw e; })(); }
}));

app.get('/api/my/campaigns', auth('f'), wrap((req, res) => {
  expire();
  res.json(db.prepare('select * from campaigns where owner=? order by id desc').all(req.user.id).map(c => ({ id: c.id, title: c.title, type: c.type, status: c.status, need: c.need, done: approved(c.id), deadline: c.deadline, reward: c.reward })));
}));

app.get('/api/campaigns/:id/feedback', auth('f'), wrap((req, res) => {
  const c = db.prepare('select * from campaigns where id=? and owner=?').get(req.params.id, req.user.id);
  if (!c) return bad(res, 'Campaign not found.', 404);
  const rows = db.prepare("select s.answers, s.created, u.name from submissions s join users u on u.id=s.uid where s.cid=? and s.status='Approved'").all(c.id)
    .map(r => ({ who: r.name.split(' ')[0], at: r.created, answers: json(r.answers, []) }));
  res.json({ title: c.title, status: c.status, need: c.need, questions: json(c.questions, []), feedback: rows });
}));

app.post('/api/campaigns/:id/end', auth('f'), wrap((req, res) => {
  const c = db.prepare("select * from campaigns where id=? and owner=? and status='Live'").get(req.params.id, req.user.id);
  if (!c) return bad(res, 'Campaign not found or already closed.', 404);
  db.transaction(() => { db.prepare("update campaigns set status='Ended' where id=?").run(c.id); release(c); })();
  res.json({ ok: true });
}));

/* ---------- submissions ---------- */
app.post('/api/campaigns/:id/submit', auth('c'), wrap((req, res) => {
  const c = db.prepare("select * from campaigns where id=? and status='Live'").get(req.params.id);
  if (!c || c.deadline < new Date().toISOString().slice(0, 10) || approved(c.id) >= c.need || c.owner === req.user.id) return bad(res, 'This campaign is not accepting responses.', 404);
  const qs = json(c.questions, []), a = (Array.isArray(req.body.answers) ? req.body.answers : []).map(x => str(x));
  for (let i = 0; i < qs.length; i++) {
    if (qs[i].r && !a[i]) return bad(res, 'Answer every required question.');
    if (qs[i].t === 'text' && a[i] && a[i].length < 15) return bad(res, 'Written answers need at least 15 characters.');
  }
  try { db.prepare('insert into submissions(cid,uid,answers) values(?,?,?)').run(c.id, req.user.id, JSON.stringify(a.slice(0, qs.length))); }
  catch { return bad(res, 'You have already submitted this task.', 409); }
  res.json({ ok: true });
}));

app.get('/api/my/submissions', auth('c'), wrap((req, res) => {
  res.json(db.prepare('select s.id,s.status,s.reason,s.created,c.title,c.reward from submissions s join campaigns c on c.id=s.cid where s.uid=? order by s.id desc').all(req.user.id));
}));

/* ---------- admin ---------- */
app.get('/api/admin/queue', auth('a'), wrap((req, res) => {
  res.json(db.prepare("select s.id,s.answers,s.created,u.name,c.title,c.questions from submissions s join users u on u.id=s.uid join campaigns c on c.id=s.cid where s.status='Pending Review' order by s.id").all()
    .map(r => ({ id: r.id, who: r.name, title: r.title, at: r.created, questions: json(r.questions, []), answers: json(r.answers, []) })));
}));

app.post('/api/admin/submissions/:id/decision', auth('a'), wrap((req, res) => {
  const s = db.prepare("select * from submissions where id=? and status='Pending Review'").get(req.params.id);
  if (!s) return bad(res, 'Submission not found or already decided.', 404);
  const approve = req.body.decision === 'approve', reason = str(req.body.reason, 500);
  if (!approve && reason.length < 10) return bad(res, 'Give a rejection reason of at least 10 characters.');
  const c = db.prepare('select * from campaigns where id=?').get(s.cid);
  if (approve && approved(c.id) >= c.need) return bad(res, 'This campaign has already reached its target.', 409);
  db.transaction(() => {
    db.prepare('update submissions set status=?, reason=?, reviewer=? where id=?').run(approve ? 'Approved' : 'Rejected', approve ? '' : reason, req.user.id, s.id);
    if (approve) {
      addLedger(s.uid, 'reward', c.reward, 'Reward: ' + c.title, s.id);
      db.prepare('update campaigns set reserved=reserved-? where id=?').run(unit(c), c.id);
      if (approved(c.id) >= c.need) db.prepare("update campaigns set status='Completed' where id=?").run(c.id);
    }
    const f = db.prepare('select * from campaigns where id=?').get(c.id);
    if (f.status !== 'Live') release(f);
  })();
  res.json({ ok: true });
}));

/* ---------- wallet (simulated payments) ---------- */
app.get('/api/wallet', auth('f', 'c'), wrap((req, res) => {
  const tx = db.prepare('select kind,amount,note,created from ledger where uid=? order by id desc limit 100').all(req.user.id);
  const reserved = req.user.role === 'f' ? db.prepare('select coalesce(sum(reserved),0) r from campaigns where owner=?').get(req.user.id).r : 0;
  const pending = req.user.role === 'c' ? db.prepare("select coalesce(sum(c.reward),0) p from submissions s join campaigns c on c.id=s.cid where s.uid=? and s.status='Pending Review'").get(req.user.id).p : 0;
  res.json({ balance: balance(req.user.id), reserved, pending, tx });
}));

app.post('/api/wallet/topup', auth('f'), wrap((req, res) => {
  const a = Number(req.body.amount);
  if (!(a >= 100 && a <= 10000)) return bad(res, 'Top-up must be between ₹100 and ₹10,000.');
  // TODO: replace with a verified payment-gateway webhook (e.g. Razorpay) before going live.
  addLedger(req.user.id, 'topup', a, 'Wallet top-up'); res.json({ ok: true });
}));

app.post('/api/wallet/withdraw', auth('f', 'c'), wrap((req, res) => {
  const a = Number(req.body.amount);
  if (!(a > 0) || a > balance(req.user.id)) return bad(res, 'Enter an amount up to your available balance.');
  addLedger(req.user.id, 'withdraw', -a, 'Withdrawal request'); res.json({ ok: true });
}));

app.use('/api', (req, res) => bad(res, 'Not found.', 404));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.listen(PORT, () => console.log('Loopback running on http://localhost:' + PORT));
