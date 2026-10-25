/* Account screens (js/account.js): the sign-in screen of the online server (#/… while no session – every route waits
 * behind it, a join link continues after signing in) and the Account page (#/account) in the menu: sign in with server
 * address (installed apps), sync status, upload this device's lists, change password, sign out. */
import { esc, btn, toast, confirmSheet } from './components.js';
import { accountInfo, onAccount, login, register, logout, changePassword, sync, uploadLocal, needsLogin, continueAsGuest, DEFAULT_SERVER } from '../account.js';

let lastRoot = null, tab = 'login', pwOpen = false, busy = false, err = '';
let bound = new WeakSet();

onAccount(ev => {
  // the status line follows the sync without re-rendering the forms (typing is kept)
  if (lastRoot && lastRoot.isConnected) {
    const s = lastRoot.querySelector('[data-acct-status]');
    if (s) s.innerHTML = statusHtml(accountInfo());
    const up = lastRoot.querySelector('[data-acct-upload]');
    if (up) up.outerHTML = uploadHtml(accountInfo());
    if (ev === 'login' || ev === 'logout') { pwOpen = false; draw(); }
  }
});

export function render(root) {
  lastRoot = root;
  draw();
  if (!bound.has(root)) {
    bound.add(root);
    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick);
  }
}

function draw() {
  const root = lastRoot;
  if (!root) return;
  const i = accountInfo();
  const keep = {};
  root.querySelectorAll('input[name]').forEach(el => { if (el.type !== 'password') keep[el.name] = el.value; });
  root.innerHTML = needsLogin() ? gateHtml(i) : pageHtml(i);
  for (const [k, v] of Object.entries(keep)) { const el = root.querySelector(`input[name="${k}"]`); if (el && !el.value) el.value = v; }
}

/* ── sign-in screen of the online server (page from the online server itself) ── */
function gateHtml(i) {
  return `<div class="lobby page acct-gate">
    <header class="hero"><div class="hero-kicker">Warhammer 40,000 · 11th Edition</div><h1 class="title hero-title">Battle Report 40k</h1></header>
    <section class="card acct-card">
      <p class="muted">Online server – sign in with your account. New here? Create an account with the invite code you got from the host.</p>
      ${formHtml(i, false)}
    </section>
    <section class="card acct-card">
      <div class="title">Without an account</div>
      <p class="muted">Rulebook, army lists and joining a game by its code work without an account – everything is kept in this browser. An account adds hosting games here and the sync of your lists and finished games to your other devices; what you build without one is offered for upload when you sign in later.</p>
      ${btn({ label: 'Continue without account', kind: 'ghost', action: 'acct-guest' })}
    </section>
  </div>`;
}

/* ── Account page in the menu ── */
function pageHtml(i) {
  const head = `<header class="page-head"><a class="btn ghost sm" href="#/">‹ Menu</a><h1 class="title">Account</h1><span></span></header>`;
  if (!i.user) {
    return `<div class="lobby page">${head}
      <section class="card acct-card">
        <p class="muted">${i.guest ? 'You use this server without an account: your lists and finished games live in this browser only. ' : ''}With an account on the online server your army lists and finished games are kept in the account and synced to every device you sign in on – build a list on the PC, use it on your phone.${i.guest ? ' Hosting games here needs the account too. Lists built without one are offered for upload when you sign in.' : ' Games at the table still run on this device as before.'}</p>
        ${formHtml(i, i.mode !== 'same')}
      </section></div>`;
  }
  return `<div class="lobby page">${head}
    <section class="card acct-card">
      <div class="title">Signed in as <span class="acct-user" data-no-i18n>${esc(i.user)}</span></div>
      ${i.mode === 'remote' ? `<p class="muted small">Online server: <span data-no-i18n>${esc(i.server)}</span></p>` : ''}
      <p class="acct-status" data-acct-status>${statusHtml(i)}</p>
      <div class="row acct-actions">
        ${btn({ label: 'Sync now', kind: 'ghost', action: 'acct-sync' })}
        ${uploadHtml(i)}
      </div>
      ${i.mode === 'remote' ? `<p class="muted small">Games for players apart (other places, mobile data): <a href="${esc(i.server)}/" target="_blank" rel="noopener">open the online server</a> – sign in there with the same account.</p>` : ''}
    </section>
    <section class="card acct-card">
      ${pwOpen ? `<form class="acct-form" data-form="password" autocomplete="on">
          <div class="title">Change password</div>
          <input type="text" name="username" autocomplete="username" value="${esc(i.user)}" hidden>
          <label class="field"><span>Current password</span><input type="password" name="old" autocomplete="current-password" required></label>
          <label class="field"><span>New password</span><input type="password" name="password" autocomplete="new-password" minlength="8" required></label>
          <p class="muted xs">At least 8 characters. Your other devices are signed out.</p>
          ${err ? `<p class="acct-err" role="alert">${esc(err)}</p>` : ''}
          <div class="row">${btn({ label: 'Cancel', kind: 'ghost', action: 'acct-pw-cancel' })}${btn({ label: 'Save password', kind: 'primary', type: 'submit', disabled: busy })}</div>
        </form>`
      : `<div class="row acct-actions">${btn({ label: 'Change password', kind: 'ghost', action: 'acct-pw' })}${btn({ label: 'Sign out', kind: 'danger', action: 'acct-logout' })}</div>`}
    </section>
  </div>`;
}

function uploadHtml(i) {
  return i.localOnly ? `<button type="button" class="btn primary" data-action="acct-upload" data-acct-upload>Upload lists from this device (${i.localOnly})</button>` : '<span data-acct-upload hidden></span>';
}

function statusHtml(i) {
  if (i.syncing) return '<span class="muted">Syncing …</span>';
  if (i.error) return `<span class="text-warn">${i.offline ? 'Offline – the lists on this device keep working and sync later.' : 'Sync failed: ' + esc(i.error)}</span>`;
  if (i.lastSync) return `<span class="text-ok">Synced ${esc(new Date(i.lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</span>`;
  return '<span class="muted">Not synced yet</span>';
}

function formHtml(i, withServer) {
  const reg = tab === 'register';
  return `
    <div class="chips acct-tabs" role="tablist">
      <button type="button" class="chip${reg ? '' : ' on'}" data-action="acct-tab" data-tab="login" role="tab" aria-selected="${!reg}">Sign in</button>
      <button type="button" class="chip${reg ? ' on' : ''}" data-action="acct-tab" data-tab="register" role="tab" aria-selected="${reg}">Create account</button>
    </div>
    <form class="acct-form" data-form="${reg ? 'register' : 'login'}" autocomplete="on">
      ${withServer ? `<label class="field"><span>Server address</span><input type="url" name="server" inputmode="url" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="https://….trycloudflare.com" value="${esc(i.server || DEFAULT_SERVER)}" required></label>` : ''}
      <label class="field"><span>User name</span><input type="text" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="24" value="${esc(i.lastUser || '')}" required></label>
      <label class="field"><span>Password</span><input type="password" name="password" autocomplete="${reg ? 'new-password' : 'current-password'}" ${reg ? 'minlength="8" ' : ''}required></label>
      ${reg ? `<label class="field"><span>Invite code</span><input type="text" name="invite" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="12" placeholder="XXXX-XXXX" required></label>
        <p class="muted xs">User name: 3–24 characters (a–z, 0–9, _ and -). Password: at least 8 characters.</p>` : ''}
      ${err ? `<p class="acct-err" role="alert">${esc(err)}</p>` : ''}
      ${btn({ label: reg ? 'Create account' : 'Sign in', kind: 'primary', cta: true, type: 'submit', disabled: busy })}
    </form>`;
}

async function onSubmit(e) {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  if (busy) return;
  const v = n => (f.elements[n] ? f.elements[n].value : '');
  busy = true; err = '';
  try {
    if (f.dataset.form === 'password') {
      await changePassword(v('old'), v('password'));
      pwOpen = false;
      toast('Password changed', 'ok');
    } else {
      const o = { username: v('username').trim(), password: v('password'), server: v('server') };
      if (f.dataset.form === 'register') await register(Object.assign(o, { invite: v('invite') }));
      else await login(o);
      toast('Signed in as ' + accountInfo().user, 'ok');
      tab = 'login';
    }
  } catch (ex) {
    err = ex && ex.message ? ex.message : String(ex);
  } finally {
    busy = false;
    draw();
  }
}

async function onClick(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  if (a === 'acct-tab') { tab = b.dataset.tab; err = ''; draw(); return; }
  if (a === 'acct-pw') { pwOpen = true; err = ''; draw(); return; }
  if (a === 'acct-pw-cancel') { pwOpen = false; err = ''; draw(); return; }
  if (a === 'acct-sync') { sync().then(() => toast('Synced', 'ok', 1500)).catch(ex => toast(ex.message, 'bad')); return; }
  if (a === 'acct-guest') { continueAsGuest(); location.hash = '#/'; return; }
  if (a === 'acct-upload') { b.disabled = true; uploadLocal().then(n => toast(n === 1 ? '1 list uploaded' : n + ' lists uploaded', 'ok')).catch(ex => toast(ex.message, 'bad')); return; }
  if (a === 'acct-logout') {
    const ok = await confirmSheet({ title: 'Sign out?', text: 'Lists and finished games that are in the account are removed from this device – they come back when you sign in again.', ok: 'Sign out', kind: 'danger' });
    if (ok) { await logout(); toast('Signed out', 'ok'); }
  }
}

/** Once after the first sign-in: lists that were only on this device can go into the account. */
export function installAccountPrompts() {
  onAccount(async (ev, i) => {
    if (ev !== 'offer' || !i.localOnly) return;
    const ok = await confirmSheet({ title: 'Upload your lists?', text: i.localOnly === 1 ? '1 army list on this device is not in your account yet. Upload it so it is on all your devices?' : `${i.localOnly} army lists on this device are not in your account yet. Upload them so they are on all your devices?`, ok: 'Upload' });
    if (ok) uploadLocal().then(n => toast(n === 1 ? '1 list uploaded' : n + ' lists uploaded', 'ok')).catch(ex => toast(ex.message, 'bad'));
  });
}
