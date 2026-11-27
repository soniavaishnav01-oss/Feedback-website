'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); 
const date = s => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const HOME = { f: 'dash', c: 'tasks', a: 'admin' }, ROLE = { dash: 'f', create: 'f', campaign: 'f', tasks: 'c', task: 'c', profile: 'fc', pay: 'fc', prefs: 'fc', security: 'fc', admin: 'a', wallet: 'fc', notes: 'fca' };
const S = { user: null, role: 'c', tab: 'new', at: 'q', cache: {}, unread: 0, qs: sq('website'), cf: { type: 'website', launch: 'yes', age: [] }, pricing: {} };
const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; t.setAttribute('role', 'status'); document.body.append(t); setTimeout(() => t.remove(), 3500); };
const showErr = (m, id = 'err') => { const e = $('#' + id); if (e) { e.textContent = m; e.hidden = !m; } };
const busy = async (b, fn) => { b.disabled = true; try { await fn(); } catch (e) { showErr(e.message); toast(e.message); } finally { b.disabled = false; } };
const pill = s => `<span class="pill ${s === 'Approved' || s === 'Resolved' ? 'ok' : s === 'Rejected' ? 'er' : 'wn'}">${esc(s)}</span>`;
const errBox = '<div class="err" id="err" role="alert" hidden></div>';
const inp = (id, label, type = 'text', x = '') => `<div><label for="${id}">${label}</label><input id="${id}" type="${type}" ${x}></div>`;

/* routing */
const route = () => { const [v, id] = location.hash.slice(1).split('/'); return [v || 'home', id]; };
const go = (v, id) => { const h = id ? `${v}/${id}` : v; if (location.hash.slice(1) === h) draw(); else location.hash = h; scrollTo(0, 0); };
async function draw() {
  let [v, id] = route(); if (!V[v]) v = 'nf';
  if (!S.user) { try { S.user = await me(); } catch { } }
  const need = ROLE[v];
  if (need && !S.user) { S.next = location.hash.slice(1); return go('login'); }
  if (need && !need.includes(S.user.role)) return go(HOME[S.user.role]);
  if (['login', 'signup'].includes(v) && S.user) return go(HOME[S.user.role]);
  if (S.user) { const [n, w] = await Promise.all([sb.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false), rpc('wallet').catch(() => null)]); S.unread = n.count || 0; S.bal = w?.available || 0; }
  nav(v); $('#app').innerHTML = '<p class="mu">Loading…</p>';
  try { $('#app').innerHTML = await V[v](id); } catch (e) { $('#app').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
function nav(v) {
  const r = S.user?.role, L = { f: [['dash', 'Dashboard'], ['create', 'New campaign']], c: [['tasks', 'Tasks']], a: [['admin', 'Admin']] }[r] || [];
  const items = r === 'a' ? [] : [['profile', 'Profile and settings'], ['pay', 'Payment methods'], ['wallet', r === 'f' ? 'Wallet and add funds' : 'Earnings and withdraw'], ['prefs', 'Email and notifications'], ['security', 'Security and privacy']];
  $('#nav').innerHTML = `<a class="logo" data-go="${r ? HOME[r] : 'home'}">Loop<b>back</b></a>${L.map(([k, t]) => `<a class="${v === k ? 'on' : ''}" data-go="${k}">${t}</a>`).join('')}${S.user ? `<a class="icon-btn" data-go="notes" aria-label="Notifications">${BELL}${S.unread ? `<i class="badge">${S.unread > 9 ? '9+' : S.unread}</i>` : ''}</a><div class="acct"><button class="avatar" data-act="menu" aria-label="Account menu">${esc((S.user.name || 'U')[0].toUpperCase())}</button><div class="menu" id="menu" hidden><div class="mhead"><b>${esc(S.user.name)}</b><div class="ex">${{ f: 'Founder', c: 'Contributor', a: 'Admin' }[r]}</div>${r !== 'a' ? `<div class="bal">Balance <b>${inr(S.bal)}</b></div>` : ''}</div>${items.map(([k, t]) => `<a data-go="${k}">${t}</a>`).join('')}<a data-act="logout">Log out</a></div></div>` : '<a data-go="login">Log in</a><a class="btn sm" data-go="signup">Sign up</a>'}`;
}

/* views */
const grid = (a, c = 'g3') => `<div class="grid ${c}">${a.join('')}</div>`;
const V = {
  home: () => homePage(),

  privacy: () => `<div class="pol" style="max-width:720px"><h2>Privacy policy</h2><p>Last updated: November 2026.</p><h3>What we collect</h3><p>Account details, profile information you choose to share, the feedback you submit and basic usage data.</p><h3>What founders see</h3><p>Approved feedback and a contributor’s first name only.</p><h3>What we never do</h3><ul><li>Sell personal data.</li><li>Share rejected or unreviewed submissions with founders.</li></ul><h3>Public campaigns</h3><p>Campaigns are visible to eligible contributors. Public access cannot guarantee that an idea will not be copied.</p><h3>Your rights</h3><p>You can access, correct or delete your data by contacting support.</p></div>`,
  nf: () => `<div class="card auth stack"><h2>Page not found</h2><button class="btn" data-go="home">Back to home</button></div>`,
  login: () => `<form class="card auth stack" data-form="login"><h2>Log in</h2>${errBox}${S.next ? '<div class="note">Please log in to continue.</div>' : ''}${inp('e', 'Email', 'email', 'autocomplete="email" required')}${inp('p', 'Password', 'password', 'autocomplete="current-password" required')}<button class="btn" style="width:100%">Log in</button><p class="ex">New here? <a data-go="signup">Create an account</a></p></form>`,
  signup: () => `<form class="card auth stack" data-form="signup"><h2>Create your account</h2>${errBox}<div><label>I’m a</label><div class="seg"><button type="button" data-role="c" class="${S.role !== 'f' ? 'on' : ''}">Contributor</button><button type="button" data-role="f" class="${S.role === 'f' ? 'on' : ''}">Founder</button></div><p class="ex" id="rd">${RD[S.role === 'f' ? 'f' : 'c']}</p></div>${inp('n', 'Full name', 'text', 'autocomplete="name" required')}${inp('e', 'Email', 'email', 'autocomplete="email" required')}${inp('p', 'Password (8+ characters)', 'password', 'autocomplete="new-password" required minlength="8"')}${inp('p2', 'Confirm password', 'password', 'required')}<label class="chk"><input id="ag" type="checkbox" required> I agree to the <a data-go="privacy">privacy policy</a></label><button class="btn" style="width:100%">Create account</button><p class="ex">Already registered? <a data-go="login">Log in</a></p></form>`,

  profile: () => { const p = S.user.profile || {}; return `<h2>Your profile</h2><p class="mu">Used only to match you with campaigns.</p><form class="card stack" style="max-width:560px;margin-top:16px" data-form="profile">${errBox}${inp('dn', 'Display name', 'text', `value="${esc(S.user.name)}" required`)}<div><label for="age">Age group *</label><select id="age"><option value="">Select</option>${AGES.map(a => `<option ${p.age === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>${inp('loc', 'Location *', 'text', `value="${esc(p.loc)}" placeholder="City, country"`)}${inp('prof', 'Professional experience', 'text', `value="${esc(p.prof)}"`)}${inp('int', 'Interests and devices', 'text', `value="${esc(p.int)}"`)}<button class="btn">Save profile</button></form>`; },

  notes: async () => {
    const n = await rows(sb.from('notifications').select('*').order('id', { ascending: false }).limit(50)); rpc('read_notifications');
    return `<h2>Notifications</h2><div class="grid" style="margin-top:16px">${n.map(x => { const [v, i] = (x.link || '').split('/'); return `<div class="card row"><div>${x.read ? '' : '<span class="pill">New</span> '}${esc(x.msg)}<div class="ex">${date(x.created)}</div></div>${v ? `<button class="btn g sm" data-go="${esc(v)}" data-id="${esc(i || '')}">View</button>` : ''}</div>`; }).join('') || '<p class="mu">Nothing yet.</p>'}</div>`;
  },

  tasks: async () => {
    const [list, mine] = await Promise.all([rpc('list_campaigns'), rpc('my_submissions')]); S.cache.tasks = list;
    return `<div class="row"><h2>Your tasks</h2><span class="pill ok">Approved: ${mine.filter(s => s.status === 'Approved').length}</span></div>${S.user.profile?.age ? '' : '<div class="note">Complete your <a data-go="profile">profile</a> to see campaigns that match you.</div>'}
<div class="tabs"><button class="${S.tab === 'new' ? 'on' : ''}" data-tab="new">Available (${list.length})</button><button class="${S.tab === 'done' ? 'on' : ''}" data-tab="done">Submitted (${mine.length})</button></div>
${S.tab === 'done' ? grid(mine.map(s => `<div class="card stack"><div class="row"><b>${esc(s.title)}</b>${pill(s.status)}</div>${s.reason ? `<div class="err">Reason: ${esc(s.reason)}</div>` : `<p class="ex">${s.status === 'Approved' ? 'Reward credited: ' + inr(s.reward) + ' (withdrawable 7 days after approval)' : 'Pending review. Nothing is paid until approved.'}</p>`}</div>`), 'g2') || '<p class="mu">No submissions yet.</p>'
        : grid(list.map(c => `<div class="card stack"><div class="row"><span class="pill">${CATS[c.type]?.n}</span><b>${inr(c.reward)}</b></div><h3>${esc(c.title)}</h3><p class="mu">${esc(c.descr.slice(0, 130))}</p><div class="row"><span class="ex">${c.left} responses left · ${c.questions.length} questions</span><button class="btn sm" data-go="task" data-id="${c.id}">View task</button></div></div>`)) || '<p class="mu">No matching tasks right now.</p>'}`;
  },

  task: async id => {
    let L = S.cache.tasks || await rpc('list_campaigns'), c = L.find(x => x.id == id); if (!c) { L = await rpc('list_campaigns'); S.cache.tasks = L; c = L.find(x => x.id == id); } if (!c) return V.nf();
    const ctl = q => q.t === 'long' ? '<textarea class="ans"></textarea>' : q.t === 'text' ? '<input class="ans">' : q.t === 'rating' ? `<select class="ans"><option value="">Select 1 (poor) to 5 (great)</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}</select>` : q.t === 'choice' ? `<select class="ans"><option value="">Select</option>${(q.o || []).map(o => `<option>${esc(o)}</option>`).join('')}</select>` : '<select class="ans"><option value="">Select</option><option>Yes</option><option>No</option><option>Not sure</option></select>';
    const det = CATS[c.type].f.map(f => f.split('|')).filter(f => c.details[f[0]]).map(f => `<div><div class="ex">${f[1]}</div>${f[2] === 'u' && /^https?:\/\//.test(c.details[f[0]]) ? `<a href="${esc(c.details[f[0]])}" target="_blank" rel="noopener noreferrer">${esc(c.details[f[0]])}</a>` : `<p>${esc(c.details[f[0]])}</p>`}</div>`).join('');
    return `<a data-go="tasks">← Back to tasks</a><div class="grid g2" style="margin-top:14px;align-items:start"><div class="card stack"><div><span class="pill">${CATS[c.type].n}</span> <span class="pill ok">${inr(c.reward)} reward</span></div><h2>${esc(c.title)}</h2><p>${esc(c.descr)}</p>${det}<p class="ex">Closes ${esc(c.deadline)}. Reward is paid only after approval and can be withdrawn 7 days later.</p></div>
<form class="card stack" data-form="submit" data-id="${c.id}"><h3>Your feedback</h3>${errBox}${c.questions.map(q => `<div><label>${esc(q.q)}${q.r ? ' *' : ''}</label>${q.h ? `<div class="hint">${esc(q.h)}</div>` : ''}${ctl(q)}</div>`).join('')}<button class="btn" style="width:100%">Submit for review</button></form></div>`;
  },

  wallet: async () => {
    const [w, po] = await Promise.all([rpc('wallet'), rpc('my_payouts')]), f = S.user.role === 'f', t = (b, l) => `<div class="card stat"><b>${inr(b)}</b><span>${l}</span></div>`;
    return `<h2>Wallet</h2><div class="note">Payments are simulated in this version. No real money moves until a payment gateway is connected and verified on the backend.</div>${grid(f ? [t(w.available, 'Available'), t(w.reserved, 'Reserved for campaigns')] : [t(w.pending, 'Pending review'), t(w.hold, 'Credited, on 7-day hold'), t(w.available, 'Available to withdraw')])}
<div class="grid g2" style="margin:16px 0;align-items:start">${f ? `<form class="card stack" data-form="topup"><h3>Add money (test)</h3>${errBox}${inp('amt', 'Amount (₹100 to ₹10,000)', 'number', 'min="100" max="10000" required')}<button class="btn">Add money</button></form>` : ''}<form class="card stack" data-form="withdraw"><h3>Withdraw</h3><div id="err2" class="err" hidden></div>${po.length ? `<div><label for="wk">Send to</label><select id="wk">${po.map(m => `<option value="${m.kind}">${m.kind === 'upi' ? 'UPI' : 'Bank account'} · ${esc(m.masked)}</option>`).join('')}</select></div>` : '<div class="note">Add a UPI ID or bank account in <a data-go="pay">Payment methods</a> before withdrawing.</div>'}${inp('wamt', 'Amount', 'number', 'min="1" step="any" required')}<button class="btn g">Request withdrawal</button>${f ? '<p class="ex">Unused funds can be withdrawn any time. Money reserved for live campaigns is released when a campaign ends.</p>' : '<p class="ex">Rewards unlock 7 days after approval. That is a minimum, not a promise of an instant transfer.</p>'}</form></div>
<div class="card tw"><h3>Transactions</h3><table><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr>${w.tx.map(x => `<tr><td>${date(x.created)}</td><td>${esc(x.note)}</td><td>${x.amount > 0 ? '+' : ''}${inr(x.amount)}</td><td>${x.available_at && new Date(x.available_at) > new Date() ? 'On hold until ' + date(x.available_at) : '—'}</td></tr>`).join('') || '<tr><td colspan="4">No transactions yet.</td></tr>'}</table></div>`;
  },

  dash: async () => {
    const [cs, w] = await Promise.all([rpc('my_campaigns'), rpc('wallet')]);
    return `<div class="row"><h2>Founder dashboard</h2><button class="btn" data-go="create">+ New campaign</button></div>${grid([[cs.filter(c => c.status === 'Live').length, 'Live campaigns'], [cs.reduce((n, c) => n + c.done, 0), 'Approved responses'], [inr(w.available), 'Wallet available'], [inr(w.reserved), 'Reserved']].map(x => `<div class="card stat"><b>${x[0]}</b><span>${x[1]}</span></div>`), 'g4')}
<div class="card tw" style="margin-top:20px"><table><tr><th>Campaign</th><th>Category</th><th>Status</th><th>Progress</th><th>Deadline</th><th></th></tr>${cs.map(c => `<tr><td><b>${esc(c.title)}</b></td><td>${CATS[c.type]?.n}</td><td>${pill(c.status === 'Live' ? 'Approved' : c.status).replace('Approved', c.status)}</td><td>${c.done}/${c.need}</td><td>${esc(c.deadline)}</td><td><button class="btn g sm" data-go="campaign" data-id="${c.id}">Open</button></td></tr>`).join('') || '<tr><td colspan="6">No campaigns yet.</td></tr>'}</table></div>`;
  },

  create: async () => {
    if (!Object.keys(S.pricing).length) (await rows(sb.from('pricing').select('*'))).forEach(p => S.pricing[p.type] = p);
    const c = S.cf, T = CATS[c.type], P = S.pricing[c.type] || { price: 0 }, v = k => esc(c[k] ?? '');
    const fld = f => { const [k, l, kind, r] = f.split('|'), L = `<label>${l}${r === '1' ? ' *' : ''}</label>`; return kind === 'a' ? `<div>${L}<textarea data-k="${k}">${v(k)}</textarea></div>` : kind.startsWith('s:') ? `<div>${L}<select data-k="${k}"><option value="">Select</option>${kind.slice(2).split(',').map(o => `<option ${c[k] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>` : `<div>${L}<input data-k="${k}" type="${kind === 'u' ? 'url' : 'text'}" value="${v(k)}"></div>`; };
    return `<a data-go="dash">← Dashboard</a><h2 style="margin-top:8px">Create a campaign</h2>
<div class="note">Campaigns are public in this first version. Unlisted and private campaigns are planned for later.</div>
<form class="stack" style="max-width:760px" data-form="create">${errBox}
<div class="card stack"><h3>1. Category</h3><div class="grid g3">${Object.entries(CATS).map(([k, x]) => `<button type="button" class="opt ${c.type === k ? 'on' : ''}" data-act="ctype" data-id="${k}"><b>${x.n}</b><span>${inr((S.pricing[k] || {}).price || 0)} per approved response</span></button>`).join('')}</div></div>
<div class="card stack"><h3>2. Details</h3><div><label>Campaign title *</label><input data-k="t" maxlength="120" value="${v('t')}"></div><div><label>Description *</label><div class="hint">What does it do, and what do you want to learn?</div><textarea data-k="descr">${v('descr')}</textarea></div>${T.f.map(fld).join('')}
<div><label>Has your product or website launched publicly? *</label><select data-k="launch"><option value="yes" ${c.launch === 'yes' ? 'selected' : ''}>Yes, it is already public</option><option value="no" ${c.launch === 'no' ? 'selected' : ''}>No, not launched yet</option><option value="soon" ${c.launch === 'soon' ? 'selected' : ''}>It will launch soon</option></select></div>
${c.launch !== 'yes' ? `<div class="note"><b>Your product is not public yet. Please protect your idea before sharing it.</b><br>Your campaign will be visible to eligible contributors. Avoid sharing an unreleased domain or brand, use a staging URL, never share your full business plan, source code, passwords, API keys or customer data, use dummy accounts, and share only what testers need. Public campaigns are not suitable for trade secrets. Loopback cannot guarantee that an idea cannot be copied.<label class="chk" style="margin-top:8px"><input type="checkbox" data-k="ack" ${c.ack ? 'checked' : ''}> I understand and accept this</label></div>` : ''}</div>
<div class="card stack"><h3>3. Questions</h3><p class="mu">Suggested questions are loaded for this category. Edit, remove or add your own. Pair website and app questions with a clear activity in the instructions.</p>${S.qs.map((x, i) => `<div class="card stack" style="margin-bottom:6px"><input data-qi="${i}" data-qf="q" placeholder="Question ${i + 1}" value="${esc(x.q)}"><input data-qi="${i}" data-qf="h" placeholder="Hint (optional)" value="${esc(x.h)}"><div class="row"><select data-qi="${i}" data-qf="t">${Object.entries(QT).map(([k, l]) => `<option value="${k}" ${x.t === k ? 'selected' : ''}>${l}</option>`).join('')}</select><label class="chk"><input type="checkbox" data-qi="${i}" data-qf="r" ${x.r ? 'checked' : ''}> Required</label><button type="button" class="btn g sm" data-act="rq" data-id="${i}">Remove</button></div>${x.t === 'choice' ? `<input data-qi="${i}" data-qf="o" placeholder="Options, comma-separated" value="${esc((x.o || []).join(', '))}">` : ''}</div>`).join('')}<div class="row" style="justify-content:flex-start"><button type="button" class="btn g sm" data-act="aq">+ Add a question</button><button type="button" class="btn g sm" data-act="reset">Reset to suggested</button></div></div>
<div class="card stack"><h3>4. Audience and budget</h3><div class="grid g2"><div><label>Responses required *</label><input data-k="need" type="number" min="1" value="${v('need') || 10}"></div><div><label>Deadline *</label><input data-k="deadline" type="date" min="${new Date(Date.now() + 864e5).toISOString().slice(0, 10)}" value="${v('deadline')}"></div></div><div><label>Age group (empty = everyone)</label>${AGES.map(a => `<label class="chk"><input type="checkbox" data-age="${a}" ${c.age.includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div><div><label>Location (comma-separated, optional)</label><input data-k="loc" value="${v('loc')}"></div>
<div class="note">Price per approved response: <b>${inr(P.price)}</b> · Total budget: <b id="tot">${inr(P.price * (+c.need || 10))}</b>. Reserved from your wallet; unused funds are returned when the campaign ends.</div>${fundPanel()}</div>
<button class="btn">Launch campaign</button></form>`;
  },

  campaign: async id => {
    const d = await rpc('campaign_feedback', { p_cid: +id });
    return `<a data-go="dash">← Dashboard</a><div class="row" style="margin:8px 0 16px"><h2>${esc(d.title)}</h2>${d.status === 'Live' ? `<button class="btn g sm" data-act="end" data-id="${id}">End campaign</button>` : `<span class="pill">${d.status}</span>`}</div><div class="card stat"><b>${d.feedback.length}/${d.need}</b><span>Approved responses</span></div><h3 style="margin:24px 0 12px">Feedback received</h3>
${d.feedback.map(f => `<div class="card stack" style="margin-bottom:12px"><div class="row"><b>${esc(f.who)}</b><span class="ex">${date(f.at)}</span></div>${d.questions.map((q, i) => `<div class="fb"><div class="ex">${esc(q.q)}</div><p>${esc(f.answers[i] || '—')}</p></div>`).join('')}
${f.complaint ? `<p>Complaint: ${pill(f.complaint)}</p>` : f.can ? `<details><summary>Raise a complaint (until ${date(f.until)})</summary><form class="stack" data-form="complaint" data-id="${f.sid}"><select id="cr${f.sid}">${REASONS.map(r => `<option>${r}</option>`).join('')}</select><textarea id="cd${f.sid}" placeholder="Describe the issue"></textarea><button class="btn sm">Submit complaint</button></form></details>` : '<p class="ex">Complaint window closed.</p>'}</div>`).join('') || '<p class="mu">No approved feedback yet.</p>'}`;
  },

  admin: async () => {
    const T = S.at, tabs = [['q', 'Review queue'], ['c', 'Complaints'], ['p', 'Pricing'], ['l', 'Audit log']], qa = (qs, as) => qs.map((x, i) => `<div class="fb"><div class="ex">${esc(x.q)}</div><p>${esc(as[i] || '—')}</p></div>`).join('');
    let body = '';
    if (T === 'q') { const q = await rpc('admin_queue'); body = q.map(s => `<div class="card stack" style="margin-bottom:14px"><div class="row"><b>${esc(s.title)}</b><span class="ex">${esc(s.who)} · ${date(s.at)}</span></div>${qa(s.questions, s.answers)}<input id="rs${s.id}" placeholder="Reason (required to reject)"><div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="dec" data-id="${s.id}" data-d="approve">Approve and credit reward</button><button class="btn r sm" data-act="dec" data-id="${s.id}" data-d="reject">Reject</button></div></div>`).join('') || '<div class="card"><p class="mu">The queue is clear.</p></div>'; }
    if (T === 'c') { const c = await rpc('admin_complaints'); body = c.map(k => `<div class="card stack" style="margin-bottom:14px"><div class="row"><b>${esc(k.title)}</b>${pill(k.status)}</div><p class="ex">Contributor: ${esc(k.who)} · ${date(k.at)}</p><p><b>${esc(k.reason)}</b></p><p class="mu">${esc(k.descr)}</p>${qa(k.questions, k.answers)}<select id="cs${k.id}">${['Under Review', 'Additional Information Required', 'Resolved', 'Rejected'].map(s => `<option ${k.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select><input id="cn${k.id}" placeholder="Outcome note" value="${esc(k.outcome || '')}"><button class="btn sm" data-act="rc" data-id="${k.id}">Save outcome</button></div>`).join('') || '<div class="card"><p class="mu">No complaints.</p></div>'; }
    if (T === 'p') { const p = await rows(sb.from('pricing').select('*').order('type')); body = `<div class="card stack"><p class="mu">New campaigns use these prices. Running campaigns keep the price they started with. Reward must not exceed the founder price.</p>${p.map(x => `<div class="row"><b style="min-width:200px">${CATS[x.type].n}</b><input id="pp${x.type}" type="number" value="${x.price}" style="width:110px" aria-label="Founder price"><input id="pr${x.type}" type="number" value="${x.reward}" style="width:110px" aria-label="Contributor reward"><button class="btn sm" data-act="sp" data-id="${x.type}">Save</button></div>`).join('')}<p class="ex">Left: founder price per approved response. Right: contributor reward.</p></div>`; }
    if (T === 'l') { const l = await rows(sb.from('audit_log').select('*').order('id', { ascending: false }).limit(100)); body = `<div class="card tw"><table><tr><th>When</th><th>Action</th><th>Reference</th><th>Note</th></tr>${l.map(x => `<tr><td>${date(x.created)}</td><td>${esc(x.action)}</td><td>${esc(x.ref)}</td><td style="white-space:normal">${esc(x.note)}</td></tr>`).join('') || '<tr><td colspan="4">Empty.</td></tr>'}</table></div>`; }
    return `<h2>Admin</h2><div class="tabs">${tabs.map(([k, t]) => `<button class="${T === k ? 'on' : ''}" data-at="${k}">${t}</button>`).join('')}</div>${body}`;
  }
};

const shell = (a, body) => { const f = S.user.role === 'f'; return `<div class="side"><aside class="card stack"><b class="ex">SETTINGS</b>${[['profile', 'Profile'], ['pay', 'Payment methods'], ['wallet', f ? 'Wallet and payments' : 'Earnings and wallet'], ['prefs', 'Email and notifications'], ['security', 'Security and privacy']].map(([k, t]) => `<a class="${a === k ? 'on' : ''}" data-go="${k}">${t}</a>`).join('')}</aside><div>${body}</div></div>`; };
const P0 = V.profile, W0 = V.wallet;
V.profile = () => shell('profile', S.user.role === 'f' ? `<h2>Your profile</h2><p class="mu">Your details as shown to our team.</p><form class="card stack" style="margin-top:16px;max-width:560px" data-form="fname">${errBox}${inp('dn', 'Display name', 'text', `value="${esc(S.user.name)}" required`)}<div><div class="ex">Email</div><p>${esc(S.user.email)}</p></div><div><div class="ex">Account type</div><p>Founder</p></div><button class="btn">Save</button></form>` : P0());
V.wallet = async () => shell('wallet', await W0());
V.pay = async () => {
  const po = await rpc('my_payouts'), g = k => po.find(m => m.kind === k), f = S.user.role === 'f';
  const saved = (k, t) => { const m = g(k); return m ? `<div class="row"><div><b>${t}</b> <span class="pill ok">Saved</span><div class="ex">${esc(m.holder)} · ${esc(m.masked)}${m.bank ? ' · ' + esc(m.bank) : ''}</div></div><button type="button" class="btn g sm" data-act="rmpay" data-id="${k}">Remove</button></div>` : `<div><b>${t}</b> <span class="pill wn">Not added</span></div>`; };
  return shell('pay', `<h2>Payment methods</h2><p class="mu">${f ? 'Where unused campaign funds are withdrawn to.' : 'Where your approved earnings are sent when you withdraw.'}</p>${errBox}<div class="note">Test mode: no real money moves yet. UPI, net banking and card options for adding funds will appear at checkout once the payment gateway is connected. Payouts go exactly where you enter, so check your details carefully. Saved details are shown masked.</div>
<form class="card stack" style="margin:16px 0" data-form="upi">${saved('upi', 'UPI')}${inp('uh', 'Account holder name', 'text', 'autocomplete="off" required')}${inp('uu', 'UPI ID', 'text', 'placeholder="name@bank" autocomplete="off" required')}<button class="btn">${g('upi') ? 'Replace UPI ID' : 'Save UPI ID'}</button></form>
<form class="card stack" data-form="bank">${saved('bank', 'Bank account (net banking transfer)')}${inp('bh', 'Account holder name', 'text', 'autocomplete="off" required')}${inp('ba', 'Account number', 'password', 'inputmode="numeric" autocomplete="off" required')}${inp('ba2', 'Confirm account number', 'text', 'inputmode="numeric" autocomplete="off" required')}${inp('bi', 'IFSC code', 'text', 'placeholder="HDFC0001234" autocomplete="off" required')}${inp('bn', 'Bank name', 'text', 'required')}<button class="btn">${g('bank') ? 'Replace bank account' : 'Save bank account'}</button></form>`);
};
V.prefs = () => { const p = S.user.prefs || {}, o = [['feedback', 'New feedback and approvals'], ['payments', 'Rewards, payments and withdrawals'], ['complaints', 'Complaint updates'], ['updates', 'Product news and tips']];
  return shell('prefs', `<h2>Email and notifications</h2><p class="mu">Choose what you want to hear about.</p><form class="card stack" style="margin-top:16px" data-form="prefs">${errBox}${o.map(([k, l]) => `<div><label class="chk"><input type="checkbox" id="pf_${k}" ${(p[k] === undefined ? k !== 'updates' : p[k]) ? 'checked' : ''}> ${l}</label></div>`).join('')}<p class="ex">In-app notifications are always on. Email delivery is not active yet, so your choices are saved for when it is.</p><button class="btn">Save preferences</button></form>`); };
V.security = () => shell('security', `<h2>Security and privacy</h2><div class="card stack" style="margin:16px 0"><div class="ex">Email</div><p>${esc(S.user.email)} ${S.user.verified ? '<span class="pill ok">Verified</span>' : '<span class="pill wn">Not verified</span>'}</p></div>
<form class="card stack" data-form="password"><h3>Change password</h3>${errBox}${inp('np', 'New password (8+ characters)', 'password', 'minlength="8" autocomplete="new-password" required')}${inp('np2', 'Confirm new password', 'password', 'required')}<button class="btn">Update password</button></form>
<div class="card stack" style="margin-top:16px"><h3>Sessions</h3><p class="mu">Signed in somewhere you don’t recognise? Log out everywhere else.</p><div><button class="btn g sm" data-act="others">Log out of other devices</button></div></div>
<div class="card stack" style="margin-top:16px"><h3>Delete my account</h3><p class="mu">Request deletion of your account and data. Our team reviews requests, and pending rewards or reserved campaign funds are settled first.</p>${S.user.delReq ? `<div class="note">Deletion requested on ${date(S.user.delReq)}.</div>` : '<div><button class="btn r sm" data-act="del">Request deletion</button></div>'}</div>`);
const need$ = () => ((S.pricing[S.cf.type] || {}).price || 0) * (+S.cf.need || 10), short$ = () => Math.max(0, need$() - (S.bal || 0)), fa$ = () => Math.min(10000, Math.max(100, Math.ceil(short$())));
const fundPanel = () => `<div class="note" id="fund" ${short$() > 0 ? '' : 'hidden'}><b>Your wallet has ${inr(S.bal)}. You need <span id="shn">${inr(short$())}</span> more to launch.</b><div class="row" style="margin-top:8px;justify-content:flex-start"><input id="fa" type="number" min="100" max="10000" value="${fa$()}" style="width:140px" aria-label="Amount to add"><button type="button" class="btn sm" data-act="addfunds">Add money</button></div><p class="ex">Test mode: no real money is charged yet.</p></div>`;
/* form handlers */
const SENSITIVE = /(password|passwd|api[_-]?key|secret|access[_-]?token)\s*[:=]|[?&](token|key|apikey|access_token)=|:\/\/[^\/\s]*:[^@\s]*@/i;
async function enter() { S.user = await me(); const n = S.next; S.next = ''; go(n || HOME[S.user.role]); }
const F = {
  async fname() { S.user.name = await rpc('update_name', { p_name: $('#dn').value }); toast('Saved.'); draw(); },
  async upi() { await rpc('save_payout', { p_kind: 'upi', p_holder: $('#uh').value, p_upi: $('#uu').value }); toast('UPI ID saved.'); draw(); },
  async bank() { if ($('#ba').value !== $('#ba2').value) throw new Error('Account numbers do not match.'); await rpc('save_payout', { p_kind: 'bank', p_holder: $('#bh').value, p_acc: $('#ba').value, p_ifsc: $('#bi').value, p_bank: $('#bn').value }); toast('Bank account saved.'); draw(); },
  async prefs() { S.user.prefs = await rpc('save_prefs', { p: Object.fromEntries(['feedback', 'payments', 'complaints', 'updates'].map(k => [k, $('#pf_' + k).checked])) }); toast('Preferences saved.'); },
  async password() { if ($('#np').value !== $('#np2').value) throw new Error('Passwords do not match.'); const { error } = await sb.auth.updateUser({ password: $('#np').value }); if (error) throw new Error(error.message); toast('Password updated.'); draw(); },
  async login() { const { error } = await sb.auth.signInWithPassword({ email: $('#e').value.trim(), password: $('#p').value }); if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message); await enter(); },
  async signup() {
    if ($('#p').value !== $('#p2').value) throw new Error('Passwords do not match.');
    const { data, error } = await sb.auth.signUp({ email: $('#e').value.trim(), password: $('#p').value, options: { data: { name: $('#n').value.trim(), role: S.role || 'c' } } });
    if (error) throw new Error(error.message);
    if (!data.session) { toast('Check your email to confirm your account, then log in.'); return go('login'); } await enter();
  },
  async profile() { S.user.name = await rpc('update_name', { p_name: $('#dn').value }); S.user.profile = await rpc('save_profile', { p_age: $('#age').value, p_loc: $('#loc').value, p_prof: $('#prof').value, p_int: $('#int').value }); toast('Profile saved.'); go('tasks'); },
  async submit(f) { await rpc('submit_task', { p_cid: +f.dataset.id, p_answers: $$('.ans').map(x => x.value) }); S.tab = 'done'; S.cache = {}; toast('Submitted for review.'); go('tasks'); },
  async topup() { await rpc('topup', { p_amount: +$('#amt').value }); toast('Money added (test).'); draw(); },
  async withdraw() { try { await rpc('withdraw', { p_amount: +$('#wamt').value, p_kind: ($('#wk') || {}).value || 'upi' }); toast('Withdrawal requested.'); draw(); } catch (e) { showErr(e.message, 'err2'); } },
  async complaint(f) { const i = f.dataset.id; await rpc('file_complaint', { p_sid: +i, p_reason: $('#cr' + i).value, p_descr: $('#cd' + i).value }); toast('Complaint submitted.'); draw(); },
  async create() {
    const c = S.cf, d = {};
    if (!(c.t || '').trim() || !(c.descr || '').trim()) throw new Error('Add a title and description.');
    for (const f of CATS[c.type].f) { const [k, l, , r] = f.split('|'), v = (c[k] || '').trim(); if (r === '1' && !v) throw new Error(l + ' is required.'); if (v) d[k] = v; }
    if (SENSITIVE.test(JSON.stringify([c.descr, d, S.qs]))) throw new Error('Remove passwords, API keys, tokens or credentials from your campaign before publishing.');
    if (c.launch !== 'yes' && !c.ack) throw new Error('Please acknowledge the privacy warning to continue.');
    if (!S.qs.some(x => x.q.trim())) { S.qs = sq(c.type); toast('We added suggested questions. Review them, then launch again.'); return draw(); }
    const r = await rpc('create_campaign', { p: { title: c.t, descr: c.descr, type: c.type, launch: c.launch, ack: !!c.ack, details: d, questions: S.qs, need: +c.need || 10, deadline: c.deadline, age: c.age, loc: c.loc || '' } });
    S.cf = { type: c.type, launch: 'yes', age: [] }; S.qs = sq(c.type); toast('Campaign is live. ' + inr(r.budget) + ' reserved.'); go('dash');
  }
};

/* events (delegated) */
document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); showErr(''); busy(f.querySelector('button:not([type=button])'), () => F[f.dataset.form](f)); });
document.addEventListener('input', e => {
  const t = e.target, d = t.dataset;
  if (d.k) S.cf[d.k] = t.type === 'checkbox' ? t.checked : t.value;
  else if (d.age) S.cf.age = t.checked ? [...new Set([...S.cf.age, d.age])] : S.cf.age.filter(a => a !== d.age);
  else if (d.qi != null) S.qs[+d.qi][d.qf] = d.qf === 'r' ? (t.checked ? 1 : 0) : d.qf === 'o' ? t.value.split(',').map(x => x.trim()).filter(Boolean) : t.value;
  if (d.k === 'need' && $('#tot')) { $('#tot').textContent = inr(need$()); $('#fund').hidden = short$() <= 0; $('#shn').textContent = inr(short$()); $('#fa').value = fa$(); }
});
document.addEventListener('change', e => { const d = e.target.dataset; if (d.k === 'launch' || d.qf === 't') draw(); });
document.addEventListener('click', async e => {
  if (!e.target.closest('.acct')) { const m = $('#menu'); if (m) m.hidden = true; }
  const t = e.target.closest('[data-go],[data-act],[data-tab],[data-at],[data-role]'); if (!t) return;
  const d = t.dataset;
  if (d.role) { S.role = d.role; if (t.type === 'button') { const r = $('#rd'); if (r) r.textContent = RD[d.role]; return $$('.seg button').forEach(b => b.classList.toggle('on', b === t)); } }
  if (d.tab) { S.tab = d.tab; return draw(); }
  if (d.at) { S.at = d.at; return draw(); }
  if (d.go) return go(d.go, d.id);
  try {
    if (d.act === 'menu') { const m = $('#menu'); m.hidden = !m.hidden; }
    else if (d.act === 'logout') { await sb.auth.signOut(); S.user = null; S.cache = {}; go('home'); }
    else if (d.act === 'others') { await sb.auth.signOut({ scope: 'others' }); toast('Logged out of other devices.'); }
    else if (d.act === 'del') { if (confirm('Request deletion of your account and data?')) { await rpc('request_deletion'); S.user.delReq = new Date().toISOString(); toast('Deletion requested.'); draw(); } }
    else if (d.act === 'rmpay') { if (confirm('Remove this payment method?')) { await rpc('delete_payout', { p_kind: d.id }); toast('Removed.'); draw(); } }
    else if (d.act === 'addfunds') { await rpc('topup', { p_amount: +$('#fa').value }); toast('Money added (test).'); draw(); }
    else if (d.act === 'ctype') { S.cf.type = d.id; S.qs = sq(d.id); draw(); }
    else if (d.act === 'reset') { S.qs = sq(S.cf.type); draw(); }
    else if (d.act === 'aq') { S.qs.push({ q: '', h: '', t: 'long', r: 1, o: [] }); draw(); }
    else if (d.act === 'rq') { S.qs.splice(+d.id, 1); draw(); }
    else if (d.act === 'end') { if (confirm('End this campaign? Unused budget returns to your wallet.')) { await rpc('end_campaign', { p_cid: +d.id }); toast('Campaign ended.'); draw(); } }
    else if (d.act === 'dec') { await rpc('admin_decide', { p_sid: +d.id, p_decision: d.d, p_reason: $('#rs' + d.id).value }); toast(d.d === 'approve' ? 'Approved. Reward credited.' : 'Rejected.'); draw(); }
    else if (d.act === 'rc') { await rpc('resolve_complaint', { p_id: +d.id, p_status: $('#cs' + d.id).value, p_note: $('#cn' + d.id).value }); toast('Saved.'); draw(); }
    else if (d.act === 'sp') { await rpc('set_pricing', { p_type: d.id, p_price: +$('#pp' + d.id).value, p_reward: +$('#pr' + d.id).value }); S.pricing = {}; toast('Pricing saved.'); draw(); }
  } catch (err) { toast(err.message); }
});
addEventListener('hashchange', draw);
draw();
