<?php
// admin/index.php: the owner's private inbox for every form on the site.
declare(strict_types=1);
define('K_BACKEND', 1);
require dirname(__DIR__) . '/api/lib.php';

$https = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('k_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

$_SESSION['csrf'] ??= bin2hex(random_bytes(16));
$csrf_ok = fn() => hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''));
$hash = k_setting('admin_hash');
$setup_open = !$hash || k_setting('setup_used') !== hash('sha256', $K['setup_code']);
$note = '';

// too many wrong passwords: 8 tries per 15 minutes
$ip = 'login:' . k_ip_key();
$tries = fn() => k_hits($ip, 900);
$fail = fn() => k_hits($ip, 900, true);

$action = $_POST['action'] ?? '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$csrf_ok()) { $note = 'The page expired. Please try again.'; $action = ''; }

if ($action === 'setup' && $setup_open) {
  if ($tries() >= 8) $note = 'Too many tries. Wait 15 minutes.';
  elseif (!hash_equals($K['setup_code'], trim((string)($_POST['code'] ?? '')))) { $fail(); $note = 'That setup code is not right.'; }
  elseif (strlen((string)($_POST['pw'] ?? '')) < 10) $note = 'Use at least 10 characters.';
  elseif (($_POST['pw'] ?? '') !== ($_POST['pw2'] ?? '')) $note = 'The two passwords do not match.';
  else {
    k_setting('admin_hash', password_hash((string)$_POST['pw'], PASSWORD_DEFAULT));
    k_setting('setup_used', hash('sha256', $K['setup_code']));
    session_regenerate_id(true); $_SESSION['in'] = true; $setup_open = false; $hash = k_setting('admin_hash');
  }
}
if ($action === 'login' && $hash) {
  if ($tries() >= 8) $note = 'Too many tries. Wait 15 minutes.';
  elseif (password_verify((string)($_POST['pw'] ?? ''), $hash)) { session_regenerate_id(true); $_SESSION['in'] = true; }
  else { $fail(); $note = 'Wrong password.'; }
}
if ($action === 'logout') { $_SESSION = []; session_destroy(); header('Location: ./'); exit; }

$in = !empty($_SESSION['in']) && !$setup_open;
if ($in && in_array($action, ['done', 'new', 'delete'], true)) {
  k_update_entry((int)($_POST['id'] ?? 0), $action === 'delete' ? null : $action);
  header('Location: ./' . (isset($_GET['all']) ? '?all' : '')); exit;
}
// email settings: the owner's own mailbox makes notifications reliable (the password never leaves this page)
if ($in && $action === 'mail_save') {
  $u = trim((string)($_POST['smtp_user'] ?? '')); $pw = (string)($_POST['smtp_pass'] ?? '');
  if (!filter_var($u, FILTER_VALIDATE_EMAIL)) $note = 'Enter the full mailbox address, like hello@yourdomain.com.';
  elseif ($pw === '' && !k_setting('smtp_pass')) $note = 'Enter the mailbox password.';
  else {
    k_setting('smtp_user', $u);
    if ($pw !== '') k_setting('smtp_pass', k_seal($pw));
    [$ok, $msg] = k_send_mail($K['owner_email'] ?: $u, "[{$K['site_name']}] Test: your website can send email", "This test came from your website's inbox settings. New messages will now arrive like this.");
    $note = $ok ? "Saved. A test email is on its way to " . ($K['owner_email'] ?: $u) . '.' : "Saved, but the test email failed: {$msg}. Check the address and password.";
  }
}
if ($in && $action === 'mail_off') { k_setting('smtp_user', ''); k_setting('smtp_pass', ''); $note = 'Notifications now use the server email.'; }
if ($in && $action === 'mail_test') {
  [$ok, $msg] = k_send_mail($K['owner_email'] ?: (string)k_setting('smtp_user'), "[{$K['site_name']}] Test email", 'This is a test from your website inbox.');
  $note = $ok ? 'Test email sent (' . $msg . ').' : "The test email failed: {$msg}.";
}
if ($in && isset($_GET['export'])) {
  header('Content-Type: text/csv; charset=utf-8');
  header('Content-Disposition: attachment; filename="messages.csv"');
  $out = fopen('php://output', 'w'); fwrite($out, "\xEF\xBB\xBF");
  fputcsv($out, ['date', 'form', 'name', 'email', 'message', 'details', 'status']);
  foreach (k_entries(true, 100000) as $r) {
    // a leading = + - @ would run as a formula in a spreadsheet
    $safe = fn($v) => preg_match('/^[=+\-@]/', (string)$v) ? "'" . $v : $v;
    fputcsv($out, array_map($safe, [$r['created'], $r['form'], $r['name'], $r['email'], $r['message'], $r['extra'], $r['status']]));
  }
  exit;
}
$show_all = isset($_GET['all']);
$rows = $in ? k_entries($show_all) : [];
$new_count = $in ? k_count_new() : 0;
$mail_user = $in ? (string)k_setting('smtp_user') : '';
$mail_last = $in ? (string)k_setting('mail_last') : '';
$csrf = k_h($_SESSION['csrf']);
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Inbox · <?= k_h($K['site_name']) ?></title>
<style>
:root{--bg:#f6f4f0;--card:#fff;--ink:#1d1b18;--soft:#6b655d;--line:#e6e1d9;--accent:#1d1b18}
@media (prefers-color-scheme:dark){:root{--bg:#161412;--card:#201d1a;--ink:#f1ece4;--soft:#a79f94;--line:#35302a;--accent:#f1ece4}}
*{box-sizing:border-box}a{color:inherit}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 20px 80px}h1{font-size:28px;margin:0}header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px;margin-bottom:12px}
.meta{color:var(--soft);font-size:14px}.msg{white-space:pre-wrap;margin:10px 0}dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:10px 0;font-size:15px}dt{color:var(--soft)}dd{margin:0}
button,.b{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:8px 16px;cursor:pointer;text-decoration:none;display:inline-block;min-height:40px}
.primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}form.inline{display:inline}.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
input{font:inherit;width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--ink);margin:6px 0 14px}
.narrow{max-width:420px;margin:12vh auto}.note{background:#fff3cd;color:#5c4400;padding:10px 14px;border-radius:10px;margin-bottom:14px}
.tag{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:2px 8px;margin-left:6px}
</style></head><body><main>
<?php if ($setup_open): ?>
  <div class="narrow card"><h1>Set up your inbox</h1>
  <p class="meta">Enter the setup code you were given, then choose the password you will use to read your messages.</p>
  <?php if ($note): ?><div class="note"><?= k_h($note) ?></div><?php endif; ?>
  <form method="post"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="action" value="setup">
  <label>Setup code<input name="code" autocomplete="one-time-code" required></label>
  <label>New password (10+ characters)<input type="password" name="pw" autocomplete="new-password" minlength="10" required></label>
  <label>Password again<input type="password" name="pw2" autocomplete="new-password" minlength="10" required></label>
  <button class="primary">Save and open inbox</button></form></div>
<?php elseif (!$in): ?>
  <div class="narrow card"><h1><?= k_h($K['site_name']) ?></h1><p class="meta">Your private inbox.</p>
  <?php if ($note): ?><div class="note"><?= k_h($note) ?></div><?php endif; ?>
  <form method="post"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="action" value="login">
  <label>Password<input type="password" name="pw" autocomplete="current-password" required autofocus></label>
  <button class="primary">Open inbox</button></form></div>
<?php else: ?>
  <header><div><h1>Inbox</h1><div class="meta"><?= $new_count ?> new · <?= k_h($K['site_name']) ?></div></div>
  <div class="row"><a class="b" href="./<?= $show_all ? '' : '?all' ?>"><?= $show_all ? 'Show new only' : 'Show all' ?></a><a class="b" href="?export=csv">Download spreadsheet</a>
  <form class="inline" method="post"><input type="hidden" name="csrf" value="<?= $csrf ?>"><button name="action" value="logout">Sign out</button></form></div></header>
  <?php if ($note): ?><div class="note"><?= k_h($note) ?></div><?php endif; ?>
  <?php if (!$rows): ?><div class="card meta">No <?= $show_all ? '' : 'new ' ?>messages yet.</div><?php endif; ?>
  <?php foreach ($rows as $r): $extra = json_decode($r['extra'] ?: '{}', true) ?: []; ?>
  <article class="card">
    <div><strong><?= k_h($r['name'] ?: 'No name') ?></strong><?php if ($r['email']): ?> · <a href="mailto:<?= k_h($r['email']) ?>"><?= k_h($r['email']) ?></a><?php endif; ?>
    <span class="tag"><?= k_h($r['form']) ?></span><?php if ($r['status'] === 'done'): ?><span class="tag">done</span><?php endif; ?></div>
    <div class="meta"><?= k_h(date('j M Y, H:i', strtotime($r['created']))) ?><?= $r['page'] ? ' · from ' . k_h($r['page']) : '' ?></div>
    <?php if ($extra): ?><dl><?php foreach ($extra as $k => $v): ?><dt><?= k_h(ucfirst(str_replace(['_', '-'], ' ', (string)$k))) ?></dt><dd><?= k_h((string)$v) ?></dd><?php endforeach; ?></dl><?php endif; ?>
    <?php if ($r['message']): ?><div class="msg"><?= k_h($r['message']) ?></div><?php endif; ?>
    <form class="row" method="post" action="./<?= $show_all ? '?all' : '' ?>"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
      <?php if ($r['email']): ?><a class="b primary" href="mailto:<?= k_h($r['email']) ?>?subject=<?= rawurlencode('Re: your message to ' . $K['site_name']) ?>">Reply</a><?php endif; ?>
      <?php if ($r['status'] === 'new'): ?><button name="action" value="done">Mark done</button><?php else: ?><button name="action" value="new">Mark new</button><?php endif; ?>
      <button name="action" value="delete" formnovalidate>Delete</button>
    </form>
  </article>
  <?php endforeach; ?>
  <details class="card"><summary><strong>Email notifications</strong> <span class="meta">· <?= $mail_user ? 'sent from ' . k_h($mail_user) : 'using the server email (may land in spam)' ?><?= $mail_last ? ' · last: ' . k_h($mail_last) : '' ?></span></summary>
    <p class="meta">For reliable notifications, send them from a mailbox on your own domain (Hostinger includes free mailboxes). Enter it here; the password is stored encrypted on your hosting and never shown again.</p>
    <form method="post"><input type="hidden" name="csrf" value="<?= $csrf ?>"><input type="hidden" name="action" value="mail_save">
      <label>Mailbox address<input name="smtp_user" type="email" value="<?= k_h($mail_user) ?>" placeholder="hello@yourdomain.com" autocomplete="off"></label>
      <label>Mailbox password<input name="smtp_pass" type="password" placeholder="<?= $mail_user ? 'unchanged' : '' ?>" autocomplete="new-password"></label>
      <div class="row"><button class="primary">Save and send a test</button>
      <button name="action" value="mail_test" formnovalidate>Send a test</button>
      <?php if ($mail_user): ?><button name="action" value="mail_off" formnovalidate>Stop using this mailbox</button><?php endif; ?></div>
    </form>
  </details>
<?php endif; ?>
</main></body></html>
