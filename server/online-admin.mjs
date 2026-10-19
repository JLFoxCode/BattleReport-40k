// Battle Report 40k – admin CLI of the online server (works on the data files; the running server picks the changes up).
//   node server/online-admin.mjs invite [n]               n single-use invite codes
//   node server/online-admin.mjs invites                  open invite codes
//   node server/online-admin.mjs users                    accounts
//   node server/online-admin.mjs reset-password <user> [new password]   (without: a random temporary one is printed)
//   node server/online-admin.mjs delete-user <user>       account with all its armies and finished games
//   --data <dir> / env BR_ONLINE_DATA: data directory (default %APPDATA%\BattleReport40k-online)
import path from 'node:path';
import os from 'node:os';
import { createAuth } from './auth.js';

const args = process.argv.slice(2);
const di = args.indexOf('--data');
const dataDir = di >= 0 ? args.splice(di, 2)[1] : process.env.BR_ONLINE_DATA || path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'BattleReport40k-online');
const [cmd, a1, a2] = args;
const auth = createAuth({ dataDir, log: { log() {}, info() {}, warn: console.warn, error: console.error } });

try {
  if (cmd === 'invite') {
    const codes = auth.createInvites(Number(a1) || 1);
    console.log('Invite code(s) – each works once for "Create account":');
    for (const c of codes) console.log('  ' + c);
  } else if (cmd === 'invites') {
    const l = auth.listInvites();
    console.log(l.length ? l.map(i => '  ' + i.code + '   ' + i.created).join('\n') : 'No open invite codes.');
  } else if (cmd === 'users') {
    const l = auth.listUsers();
    console.log(l.length ? l.map(u => `  ${u.name.padEnd(24)} since ${String(u.created || '').slice(0, 10)}   ${u.armies} armies, ${u.archive} finished games`).join('\n') : 'No accounts yet.');
  } else if (cmd === 'reset-password' && a1) {
    const pw = a2 || auth.tempPassword();
    await auth.setPassword(a1, pw);
    console.log(`Password of ${a1.toLowerCase()} reset – all their devices are signed out.` + (a2 ? '' : `\nTemporary password: ${pw}`));
  } else if (cmd === 'delete-user' && a1) {
    auth.deleteUser(a1);
    console.log(`Account ${a1.toLowerCase()} deleted (with its armies and finished games).`);
  } else {
    console.log('Usage: node server/online-admin.mjs invite [n] | invites | users | reset-password <user> [password] | delete-user <user>   [--data <dir>]');
    process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 1;
}
