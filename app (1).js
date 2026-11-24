'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const date = s => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const TYPES = { short: ['Short survey', 10], detailed: ['Detailed survey', 25], website: ['Website testing', 30], app: ['App testing', 80], interview: ['User interview', 100] };
const AGES = ['18–24', '25–34', '35–44', '45+'];
const HOME = { f: 'dash', c: 'tasks', a: 'admin' };
const ROLE = { dash: 'f', create: 'f', campaign: 'f', tasks: 'c', task: 'c', profile: 'c', admin: 'a', wallet: 'fc' };
const S = { user: null, qs: [{ q: '', h: '', t: 'text', r: 1 }], tab: 'new', cache: {} };

const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
const api = async (path, method = 'GET', b = {}) => {
  if (path === '/me') {
    const { data: { session } } = await sb.auth.getSession(); if (!session) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single(); if (error) throw error;
    return { id: data.id, name: data.name, email: session.user.email, role: data.role, profile: { age: data.age, loc: data.loc, prof: data.prof, int: data.interests } };
  }
  const id = +(path.match(/\d+/) || [0])[0]; let r;
  if (path === '/campaigns') r = method === 'POST' ? ['create_campaign', { p: b }] : ['list_campaigns'];
  else if (path === '/my/campaigns') r = ['my_campaigns'];
  else if (path === '/my/submissions') r = ['my_submissions'];
  else if (path === '/admin/queue') r = ['admin_queue'];
  else if (path === '/wallet') r = ['wallet'];
  else if (path === '/wallet/topup') r = ['topup', { p_amount: b.amount }];
  else if (path === '/wallet/withdraw') r = ['withdraw', { p_amount: b.amount }];
  else if (path === '/profile') r = ['save_profile', { p_age: b.age, p_loc: b.loc, p_prof: b.prof, p_int: b.int }];
  else if (path.endsWith('/feedback')) r = ['campaign_feedback', { p_cid: id }];
  else if (path.endsWith('/end')) r = ['end_campaign', { p_cid: id }];
  else if (path.endsWith('/submit')) r = ['submit_task', { p_cid: id, p_answers: b.answers }];
  else if (path.endsWith('/decision')) r = ['admin_decide', { p_sid: id, p_decision: b.decision, p_reason: b.reason }];
  else throw new Error('Not found.');
  const { data, error } = await sb.rpc(...r);
  if (error) throw new Error(error.message);
  return data;
};
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; t.setAttribute('role', 'status'); document.body.append(t); setTimeout(() => t.remove(), 3000); };
const showErr = (m, id = 'err') => { const e = $('#' + id); if (e) { e.textContent = m; e.hidden = !m; } };
const fail = e => showErr(e.message);
const busy = async (btn, fn) => { btn.disabled = true; try { await fn(); } catch (e) { fail(e); } finally { btn.disabled = false; } };
const pill = s => `<span class="pill ${s === 'Approved' ? 'ok' : s === 'Rejected' ? 'er' : 'wn'}">${esc(s)}</span>`;
const errBox = '<div class="err" id="err" role="alert" hidden></div>';
const field = (id, label, type = 'text', extra = '') => `<div><label for="${id}">${label}</label><input id="${id}" type="${type}" ${extra}></div>`;

/* ---------- routing ---------- */
const route = () => { const [v, id] = location.hash.slice(1).split('/'); return [v || 'home', id]; };
const go = (v, id) => { const h = id ? `${v}/${id}` : v; if (location.hash.slice(1) === h) draw(); else location.hash = h; scrollTo(0, 0); };

async function draw() {
  let [v, id] = route();
  if (!V[v]) v = 'nf';
  if (!S.user) { try { S.user = await api('/me'); } catch { } }
  const need = ROLE[v];
  if (need && !S.user) { S.next = location.hash.slice(1); return go('login'); }
  if (need && !need.includes(S.user.role)) return go(HOME[S.user.role]);
  if (['login', 'signup'].includes(v) && S.user) return go(HOME[S.user.role]);
  nav(v);
  $('#app').innerHTML = '<p class="mu">Loading…</p>';
  try { $('#app').innerHTML = await V[v](id); } catch (e) { $('#app').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
  document.title = 'Loopback';
  $('#app').focus?.();
}

function nav(v) {
  const r = S.user?.role, L = { f: [['dash', 'Dashboard'], ['create', 'New campaign'], ['wallet', 'Wallet']], c: [['tasks', 'Tasks'], ['wallet', 'Wallet'], ['profile', 'Profile']], a: [['admin', 'Review queue']] }[r] || [];
  $('#nav').innerHTML = `<a class="logo" data-go="${r ? HOME[r] : 'home'}">Loop<b>back</b></a>${L.map(([k, t]) => `<a class="${v === k ? 'on' : ''}" data-go="${k}">${t}</a>`).join('')}${S.user ? `<a data-act="logout">Log out</a>` : '<a data-go="login">Log in</a><a class="btn sm" data-go="signup">Sign up</a>'}`;
}

/* ---------- views ---------- */
const V = {
  home: () => `<section class="hero"><h1>Honest feedback for founders. Fair rewards for the people who give it.</h1><p class="lead">Loopback puts your idea, website or app in front of real people who tell you what confused them, what worked and what they’d change. Every answer is read by our team before it reaches you.</p><div class="ctas"><button class="btn" data-go="signup" data-role="c">I want to earn by giving feedback</button><button class="btn g" data-go="signup" data-role="f">I want to get feedback</button></div></section>
<div class="facts">${[['Read by people', 'Every response is checked before a founder sees it.'], ['Paid for quality', 'Contributors earn only when feedback is approved.'], ['Clear decisions', 'Every rejection comes with a reason.'], ['Private by default', 'Contact details stay hidden. Data is never sold.']].map(x => `<div><b>${x[0]}</b>${x[1]}</div>`).join('')}</div>
<div class="sec"><h2>How it works</h2><div class="grid g2"><div class="card stack"><h3>For founders</h3><p class="mu">Describe what people should try, write your own questions, choose your audience and fund the campaign. Only approved feedback reaches you, and unused budget is returned.</p></div><div class="card stack"><h3>For contributors</h3><p class="mu">Create a profile, pick a task that suits you, answer the founder’s questions with care and submit. Once our team approves your answers, the reward is credited to your wallet.</p></div></div></div>
<div class="sec"><h2>Questions, answered</h2><div class="grid g2"><div>${[['Is it free to join?', 'Yes. Creating an account and browsing tasks costs nothing.'], ['Is every submission paid?', 'No. Rewards are credited only after a submission is reviewed and approved.'], ['Why might feedback be rejected?', 'Missing answers, very short or off-topic replies, copied text, or not following the task steps. You always receive a clear reason.']].map(x => `<details><summary>${x[0]}</summary><p>${x[1]}</p></details>`).join('')}</div><div>${[['What can I get feedback on?', 'Websites, apps, business ideas, branding, pricing and short interviews.'], ['Can I choose who answers?', 'Yes. Target by age group and location.'], ['Do I see every response?', 'You see only approved feedback. Spam and incomplete answers never reach you.']].map(x => `<details><summary>${x[0]}</summary><p>${x[1]}</p></details>`).join('')}</div></div></div>`,

  privacy: () => `<div class="pol" style="max-width:720px"><h2>Privacy policy</h2><p>Last updated: November 2026.</p><h3>What we collect</h3><p>Account details, profile information you choose to share, the feedback you submit, and basic usage data.</p><h3>How we use it</h3><p>To match contributors with relevant tasks, review submissions, process rewards, prevent fraud and improve the service.</p><h3>What founders can see</h3><p>Approved feedback and a contributor’s first name only. Contact details are never shared.</p><h3>What we never do</h3><ul><li>Sell personal data.</li><li>Share rejected or unreviewed submissions with founders.</li></ul><h3>Your rights</h3><p>You can access, correct or delete your data at any time by contacting support.</p></div>`,

  nf: () => `<div class="card auth stack"><h2>Page not found</h2><p class="mu">The link may be broken or the page may have moved.</p><button class="btn" data-go="home">Back to home</button></div>`,

  login: () => `<form class="card auth stack" data-form="login"><h2>Log in</h2>${errBox}${S.next ? '<div class="note">Please log in to continue.</div>' : ''}${field('e', 'Email', 'email', 'autocomplete="email" required')}${field('p', 'Password', 'password', 'autocomplete="current-password" required')}<button class="btn" style="width:100%">Log in</button><p class="ex">New here? <a data-go="signup">Create an account</a></p></form>`,

  signup: () => `<form class="card auth stack" data-form="signup"><h2>Create your account</h2>${errBox}<div><label>I want to</label><div class="seg"><button type="button" data-role="c" class="${S.role !== 'f' ? 'on' : ''}">Earn by giving feedback</button><button type="button" data-role="f" class="${S.role === 'f' ? 'on' : ''}">Get feedback</button></div></div>${field('n', 'Full name', 'text', 'autocomplete="name" required')}${field('e', 'Email', 'email', 'autocomplete="email" required')}${field('p', 'Password (8+ characters)', 'password', 'autocomplete="new-password" required minlength="8"')}${field('p2', 'Confirm password', 'password', 'autocomplete="new-password" required')}<label class="chk"><input id="ag" type="checkbox" required> I agree to the <a data-go="privacy">privacy policy</a></label><button class="btn" style="width:100%">Create account</button><p class="ex">Already registered? <a data-go="login">Log in</a></p></form>`,

  profile: async () => { const p = S.user.profile || {}; return `<h2>Your profile</h2><p class="mu">Used only to match you with campaigns. Founders never see your contact details.</p><form class="card stack" style="max-width:560px;margin-top:16px" data-form="profile">${errBox}<div><label for="age">Age group *</label><select id="age"><option value="">Select</option>${AGES.map(a => `<option ${p.age === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>${field('loc', 'Location *', 'text', `value="${esc(p.loc)}" placeholder="City, state"`)}${field('prof', 'Profession', 'text', `value="${esc(p.prof)}"`)}${field('int', 'Interests', 'text', `value="${esc(p.int)}"`)}<button class="btn">Save profile</button></form>`; },

  tasks: async () => {
    const [list, mine] = await Promise.all([api('/campaigns'), api('/my/submissions')]);
    const earned = mine.filter(s => s.status === 'Approved').reduce((n, s) => n + s.reward, 0);
    S.cache.tasks = list;
    return `<div class="row"><h2>Your tasks</h2><span class="pill ok">Earned: ${inr(earned)}</span></div>${S.user.profile?.age ? '' : '<div class="note">Complete your <a data-go="profile">profile</a> to see campaigns that match you.</div>'}
<div class="tabs"><button class="${S.tab === 'new' ? 'on' : ''}" data-tab="new">Available (${list.length})</button><button class="${S.tab === 'done' ? 'on' : ''}" data-tab="done">Submitted (${mine.length})</button></div>
${S.tab === 'done' ? `<div class="grid">${mine.map(s => `<div class="card stack"><div class="row"><b>${esc(s.title)}</b>${pill(s.status)}</div>${s.reason ? `<div class="err">Reason: ${esc(s.reason)}</div>` : `<p class="ex">${s.status === 'Approved' ? 'Reward credited: ' + inr(s.reward) : 'With our review team. Nothing is paid until it is approved.'}</p>`}</div>`).join('') || '<p class="mu">No submissions yet.</p>'}</div>`
        : `<div class="grid g3">${list.map(c => `<div class="card stack"><div class="row"><span class="pill">${TYPES[c.type][0]}</span><b>${inr(c.reward)}</b></div><h3>${esc(c.title)}</h3><p class="mu">${esc(c.descr.slice(0, 140))}</p><div class="row"><span class="ex">${c.left} responses left</span><button class="btn sm" data-go="task" data-id="${c.id}">View task</button></div></div>`).join('') || '<p class="mu">No matching tasks right now. Check back soon.</p>'}</div>`}`;
  },

  task: async id => {
    const list = S.cache.tasks || await api('/campaigns'), c = list.find(x => x.id == id);
    if (!c) return V.nf();
    const inp = q => q.t === 'text' ? '<textarea class="ans"></textarea>' : q.t === 'rating' ? `<select class="ans"><option value="">Select 1 (poor) to 5 (great)</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}</select>` : '<select class="ans"><option value="">Select</option><option>Yes</option><option>No</option><option>Not sure</option></select>';
    return `<a data-go="tasks">← Back to tasks</a><div class="grid g2" style="margin-top:14px;align-items:start"><div class="card stack"><div><span class="pill">${TYPES[c.type][0]}</span> <span class="pill ok">${inr(c.reward)} reward</span></div><h2>${esc(c.title)}</h2><p>${esc(c.descr)}</p>${c.steps.length ? `<div><b>What you’ll do</b><ol class="mu">${c.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}${c.link ? `<p><a href="${esc(c.link)}" target="_blank" rel="noopener noreferrer">Open the product to test</a></p>` : ''}<p class="ex">Closes ${esc(c.deadline)}. Detailed, honest answers are approved faster.</p></div>
<form class="card stack" data-form="submit" data-id="${c.id}"><h3>Answer the founder’s questions</h3>${errBox}${c.questions.map(q => `<div><label>${esc(q.q)}${q.r ? ' *' : ''}</label>${q.h ? `<div class="hint">${esc(q.h)}</div>` : ''}${inp(q)}</div>`).join('')}<button class="btn" style="width:100%">Submit for review</button></form></div>`;
  },

  wallet: async () => {
    const w = await api('/wallet'), f = S.user.role === 'f';
    return `<h2>Wallet</h2><div class="note">Payments and withdrawals are simulated until a payment gateway is connected.</div><div class="grid g3"><div class="card stat"><b>${inr(w.balance)}</b><span>Available</span></div><div class="card stat"><b>${inr(f ? w.reserved : w.pending)}</b><span>${f ? 'Reserved for live campaigns' : 'Pending approval'}</span></div></div>
<div class="grid g2" style="margin:16px 0;align-items:start">${f ? `<form class="card stack" data-form="topup"><h3>Add money</h3>${errBox}${field('amt', 'Amount (₹100 to ₹10,000)', 'number', 'min="100" max="10000" required')}<button class="btn">Add money</button></form>` : ''}<form class="card stack" data-form="withdraw"><h3>Withdraw</h3><div id="err2" class="err" hidden></div>${field('wamt', 'Amount', 'number', 'min="1" required')}<button class="btn g">Request withdrawal</button></form></div>
<div class="card tw"><h3>Transactions</h3><table><tr><th>Date</th><th>Description</th><th>Amount</th></tr>${w.tx.map(t => `<tr><td>${date(t.created)}</td><td>${esc(t.note)}</td><td>${t.amount > 0 ? '+' : ''}${inr(t.amount)}</td></tr>`).join('') || '<tr><td colspan="3">No transactions yet.</td></tr>'}</table></div>`;
  },

  dash: async () => {
    const [cs, w] = await Promise.all([api('/my/campaigns'), api('/wallet')]);
    return `<div class="row"><h2>Founder dashboard</h2><button class="btn" data-go="create">+ New campaign</button></div><div class="grid g4" style="margin:20px 0"><div class="card stat"><b>${cs.filter(c => c.status === 'Live').length}</b><span>Live campaigns</span></div><div class="card stat"><b>${cs.reduce((n, c) => n + c.done, 0)}</b><span>Approved responses</span></div><div class="card stat"><b>${inr(w.balance)}</b><span>Wallet available</span></div><div class="card stat"><b>${inr(w.reserved)}</b><span>Reserved</span></div></div>
<div class="card tw"><table><tr><th>Campaign</th><th>Type</th><th>Status</th><th>Progress</th><th>Deadline</th><th></th></tr>${cs.map(c => `<tr><td><b>${esc(c.title)}</b></td><td>${TYPES[c.type][0]}</td><td><span class="pill ${c.status === 'Live' ? 'ok' : ''}">${c.status}</span></td><td>${c.done}/${c.need}</td><td>${esc(c.deadline)}</td><td><button class="btn g sm" data-go="campaign" data-id="${c.id}">Open</button></td></tr>`).join('') || '<tr><td colspan="6">No campaigns yet. Create your first one.</td></tr>'}</table></div>`;
  },

  create: () => `<a data-go="dash">← Dashboard</a><h2 style="margin-top:8px">Create a campaign</h2><p class="mu">The budget is reserved from your wallet and used only as responses are approved. Unused funds return when the campaign ends.</p>
<form class="stack" style="max-width:760px;margin-top:16px" data-form="create">${errBox}<div class="card stack"><h3>The basics</h3>${field('t', 'Title *', 'text', 'maxlength="120" required')}<div><label for="d">Description *</label><textarea id="d" required></textarea></div><div><label for="type">Feedback type *</label><select id="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v[0]} (${k === 'interview' ? '₹100–200' : inr(v[1])} per approved response)</option>`).join('')}</select></div><div id="rw" hidden>${field('reward', 'Reward per interview (₹100–200)', 'number', 'min="100" max="200" value="150"')}</div><div><label for="st">Instructions (one step per line)</label><textarea id="st"></textarea></div>${field('lk', 'Link to test (optional)', 'url', 'placeholder="https://"')}</div>
<div class="card stack"><h3>Questions</h3><div id="qs">${S.qs.map((x, i) => `<div class="card stack qrow" style="margin-bottom:10px"><input class="qq" placeholder="Question ${i + 1}" value="${esc(x.q)}"><input class="qh" placeholder="Hint (optional)" value="${esc(x.h)}"><div class="row"><select class="qt"><option value="text" ${x.t === 'text' ? 'selected' : ''}>Written answer</option><option value="rating" ${x.t === 'rating' ? 'selected' : ''}>Rating 1–5</option><option value="yesno" ${x.t === 'yesno' ? 'selected' : ''}>Yes / No / Not sure</option></select><label class="chk"><input class="qr" type="checkbox" ${x.r ? 'checked' : ''}> Required</label><button type="button" class="btn g sm" data-act="rq" data-id="${i}">Remove</button></div></div>`).join('')}</div><button type="button" class="btn g sm" data-act="aq">+ Add a question</button></div>
<div class="card stack"><h3>Requirements and audience</h3><div class="grid g2">${field('n', 'Responses required *', 'number', 'min="1" value="10" required')}${field('dl', 'Deadline *', 'date', `min="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}" required`)}</div><div><label>Age group (leave empty for everyone)</label>${AGES.map(a => `<label class="chk"><input type="checkbox" class="age" value="${a}"> ${a}</label>`).join('')}</div>${field('loc', 'Location (comma-separated, optional)', 'text', 'placeholder="Hyderabad, Mumbai"')}</div>
<button class="btn">Launch campaign</button></form>`,

  campaign: async id => {
    const d = await api(`/campaigns/${id}/feedback`);
    return `<a data-go="dash">← Dashboard</a><div class="row" style="margin:8px 0 16px"><h2>${esc(d.title)}</h2>${d.status === 'Live' ? `<button class="btn g sm" data-act="end" data-id="${id}">End campaign</button>` : `<span class="pill">${d.status}</span>`}</div><div class="card stat"><b>${d.feedback.length}/${d.need}</b><span>Approved responses</span></div><h3 style="margin:24px 0 12px">Feedback received</h3>${d.feedback.map(f => `<div class="card stack" style="margin-bottom:12px"><div class="row"><b>${esc(f.who)}</b><span class="ex">${date(f.at)}</span></div>${d.questions.map((q, i) => `<div class="fb"><div class="ex">${esc(q.q)}</div><p>${esc(f.answers[i] || '—')}</p></div>`).join('')}</div>`).join('') || '<p class="mu">No approved feedback yet. Responses appear here after our team reviews them.</p>'}`;
  },

  admin: async () => {
    const q = await api('/admin/queue');
    return `<h2>Review queue (${q.length})</h2><p class="mu" style="margin:6px 0 18px">Check relevance, completeness, quality and whether the task steps were followed.</p>${q.map(s => `<div class="card stack" style="margin-bottom:14px"><div class="row"><b>${esc(s.title)}</b><span class="ex">${esc(s.who)} · ${date(s.at)}</span></div>${s.questions.map((x, i) => `<div class="fb"><div class="ex">${esc(x.q)}</div><p>${esc(s.answers[i] || '—')}</p></div>`).join('')}<input id="rs${s.id}" placeholder="Reason (required to reject)"><div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="dec" data-id="${s.id}" data-d="approve">Approve and credit reward</button><button class="btn r sm" data-act="dec" data-id="${s.id}" data-d="reject">Reject</button></div></div>`).join('') || '<div class="card"><p class="mu">The queue is clear.</p></div>'}`;
  }
};

/* ---------- forms ---------- */
const syncQs = () => { const r = $$('.qrow'); if (r.length) S.qs = r.map(x => ({ q: x.querySelector('.qq').value, h: x.querySelector('.qh').value, t: x.querySelector('.qt').value, r: x.querySelector('.qr').checked ? 1 : 0 })); };
const F = {
  async login() { const { error } = await sb.auth.signInWithPassword({ email: $('#e').value.trim(), password: $('#p').value }); if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message); await enter(); },
  async signup() {
    if ($('#p').value !== $('#p2').value) return showErr('Passwords do not match.');
    const { data, error } = await sb.auth.signUp({ email: $('#e').value.trim(), password: $('#p').value, options: { data: { name: $('#n').value.trim(), role: S.role || 'c' } } });
    if (error) throw new Error(error.message);
    if (!data.session) { toast('Check your email to confirm your account, then log in.'); return go('login'); }
    await enter();
  },
  async profile() { S.user.profile = await api('/profile', 'PUT', { age: $('#age').value, loc: $('#loc').value, prof: $('#prof').value, int: $('#int').value }); toast('Profile saved.'); go('tasks'); },
  async submit(f) { await api(`/campaigns/${f.dataset.id}/submit`, 'POST', { answers: $$('.ans').map(x => x.value) }); S.tab = 'done'; delete S.cache.tasks; toast('Submitted. Our team reviews it before it reaches the founder.'); go('tasks'); },
  async topup() { await api('/wallet/topup', 'POST', { amount: +$('#amt').value }); toast('Money added.'); draw(); },
  async withdraw() { try { await api('/wallet/withdraw', 'POST', { amount: +$('#wamt').value }); toast('Withdrawal requested.'); draw(); } catch (e) { showErr(e.message, 'err2'); } },
  async create() {
    syncQs();
    const r = await api('/campaigns', 'POST', { title: $('#t').value, descr: $('#d').value, type: $('#type').value, reward: +$('#reward').value, steps: $('#st').value, link: $('#lk').value, questions: S.qs, need: +$('#n').value, deadline: $('#dl').value, age: $$('.age:checked').map(x => x.value), loc: $('#loc').value });
    S.qs = [{ q: '', h: '', t: 'text', r: 1 }]; toast('Campaign is live. ' + inr(r.budget) + ' reserved.'); go('dash');
  }
};
async function enter() { S.user = await api('/me'); const n = S.next; S.next = ''; go(n || HOME[S.user.role]); }

/* ---------- events (delegated, CSP-safe) ---------- */
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); showErr(''); busy(f.querySelector('button:not([type=button])'), () => F[f.dataset.form](f)); });
document.addEventListener('change', e => { if (e.target.id === 'type') $('#rw').hidden = e.target.value !== 'interview'; });
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-go],[data-act],[data-tab],[data-role]'); if (!t) return;
  if (t.dataset.role) { S.role = t.dataset.role; if (t.type === 'button') return $$('.seg button').forEach(b => b.classList.toggle('on', b === t)); }
  if (t.dataset.tab) { S.tab = t.dataset.tab; return draw(); }
  if (t.dataset.go) return go(t.dataset.go, t.dataset.id);
  const a = t.dataset.act, id = t.dataset.id;
  try {
    if (a === 'logout') { await sb.auth.signOut(); S.user = null; S.cache = {}; go('home'); }
    else if (a === 'aq') { syncQs(); S.qs.push({ q: '', h: '', t: 'text', r: 1 }); draw(); }
    else if (a === 'rq') { syncQs(); S.qs.splice(+id, 1); if (!S.qs.length) S.qs.push({ q: '', h: '', t: 'text', r: 1 }); draw(); }
    else if (a === 'end') { if (confirm('End this campaign? Unused budget returns to your wallet.')) { await api(`/campaigns/${id}/end`, 'POST'); toast('Campaign ended.'); draw(); } }
    else if (a === 'dec') { await api(`/admin/submissions/${id}/decision`, 'POST', { decision: t.dataset.d, reason: $('#rs' + id).value }); toast(t.dataset.d === 'approve' ? 'Approved and reward credited.' : 'Rejected.'); draw(); }
  } catch (err) { toast(err.message); }
});
addEventListener('hashchange', draw);
draw();
