<?php
// lib.php: shared helpers for the 10K Websites backend. Not reachable from the web (see .htaccess).
// Storage: SQLite when the host has it, otherwise a locked JSON file. Both live outside the public folder when possible.
// Email: through the owner's own mailbox (SMTP) once they save it in the inbox settings, otherwise PHP mail().
declare(strict_types=1);
if (!defined('K_BACKEND')) { http_response_code(404); exit; }
$K = require __DIR__ . '/config.php';

function k_dir(): string {
  static $dir = null;
  if ($dir) return $dir;
  // keep data outside the public folder when the host allows it, so no deploy can overwrite or expose it
  $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: dirname(__DIR__);
  $dir = dirname($root) . '/k-data';
  if (!is_dir($dir)) @mkdir($dir, 0700, true);
  if (!is_dir($dir) || !is_writable($dir)) $dir = dirname(__DIR__) . '/data';
  return $dir;
}
function k_mode(): string { global $K; if (($K['storage'] ?? '') === 'file') return 'file'; return in_array('sqlite', PDO::getAvailableDrivers(), true) ? 'sqlite' : 'file'; }

/* ---------- SQLite ---------- */
function k_db(): PDO {
  global $K;
  static $db = null;
  if ($db) return $db;
  $db = new PDO('sqlite:' . k_dir() . '/' . $K['db_file'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $db->exec('PRAGMA journal_mode=WAL');
  $db->exec('CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY, created TEXT, form TEXT, name TEXT, email TEXT, message TEXT, extra TEXT, page TEXT, status TEXT DEFAULT "new")');
  $db->exec('CREATE TABLE IF NOT EXISTS hits (ip TEXT, at INTEGER)');
  $db->exec('CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT)');
  return $db;
}

/* ---------- JSON file (any PHP host) ---------- */
function k_file(callable $fn) {
  global $K;
  $path = k_dir() . '/' . preg_replace('/\.sqlite$/', '.json', $K['db_file']);
  $fh = fopen($path, 'c+');
  flock($fh, LOCK_EX);
  $raw = stream_get_contents($fh);
  $data = $raw ? json_decode($raw, true) : null;
  if (!is_array($data)) $data = ['next' => 1, 'entries' => [], 'hits' => [], 'settings' => []];
  $result = $fn($data);
  ftruncate($fh, 0); rewind($fh);
  fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE));
  fflush($fh); flock($fh, LOCK_UN); fclose($fh);
  @chmod($path, 0600);
  return $result;
}

/* ---------- the storage API both use ---------- */
function k_setting(string $k, ?string $v = null): ?string {
  if (k_mode() === 'sqlite') {
    $db = k_db();
    if ($v !== null) { $db->prepare('INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)')->execute([$k, $v]); return $v; }
    $s = $db->prepare('SELECT v FROM settings WHERE k = ?'); $s->execute([$k]);
    $r = $s->fetchColumn(); return $r === false ? null : (string)$r;
  }
  return k_file(function (&$d) use ($k, $v) { if ($v !== null) $d['settings'][$k] = $v; return $d['settings'][$k] ?? null; });
}
// counts hits for a key within the window, optionally adding one
function k_hits(string $key, int $window, bool $add = false): int {
  $now = time();
  if (k_mode() === 'sqlite') {
    $db = k_db();
    $db->prepare('DELETE FROM hits WHERE at < ?')->execute([$now - 900]);
    $s = $db->prepare('SELECT COUNT(*) FROM hits WHERE ip = ? AND at >= ?'); $s->execute([$key, $now - $window]);
    $n = (int)$s->fetchColumn();
    if ($add) $db->prepare('INSERT INTO hits (ip, at) VALUES (?, ?)')->execute([$key, $now]);
    return $n;
  }
  return k_file(function (&$d) use ($key, $window, $add, $now) {
    $d['hits'] = array_values(array_filter($d['hits'], fn($h) => $h[1] >= $now - 900));
    $n = count(array_filter($d['hits'], fn($h) => $h[0] === $key && $h[1] >= $now - $window));
    if ($add) $d['hits'][] = [$key, $now];
    return $n;
  });
}
function k_add_entry(array $e): void {
  if (k_mode() === 'sqlite') {
    k_db()->prepare('INSERT INTO entries (created, form, name, email, message, extra, page) VALUES (?, ?, ?, ?, ?, ?, ?)')
      ->execute([$e['created'], $e['form'], $e['name'], $e['email'], $e['message'], $e['extra'], $e['page']]);
    return;
  }
  k_file(function (&$d) use ($e) { $e['id'] = $d['next']++; $e['status'] = 'new'; $d['entries'][] = $e; });
}
function k_entries(bool $all, int $limit = 300): array {
  if (k_mode() === 'sqlite') return k_db()->query('SELECT * FROM entries ' . ($all ? '' : "WHERE status = 'new' ") . 'ORDER BY id DESC LIMIT ' . (int)$limit)->fetchAll(PDO::FETCH_ASSOC);
  return k_file(function (&$d) use ($all, $limit) {
    $rows = array_reverse(array_filter($d['entries'], fn($r) => $all || $r['status'] === 'new'));
    return array_slice(array_values($rows), 0, $limit);
  });
}
function k_count_new(): int {
  if (k_mode() === 'sqlite') return (int)k_db()->query("SELECT COUNT(*) FROM entries WHERE status = 'new'")->fetchColumn();
  return k_file(fn(&$d) => count(array_filter($d['entries'], fn($r) => $r['status'] === 'new')));
}
function k_update_entry(int $id, ?string $status): void {
  if (k_mode() === 'sqlite') {
    if ($status === null) k_db()->prepare('DELETE FROM entries WHERE id = ?')->execute([$id]);
    else k_db()->prepare('UPDATE entries SET status = ? WHERE id = ?')->execute([$status, $id]);
    return;
  }
  k_file(function (&$d) use ($id, $status) {
    foreach ($d['entries'] as $i => $r) if ((int)$r['id'] === $id) { if ($status === null) unset($d['entries'][$i]); else $d['entries'][$i]['status'] = $status; }
    $d['entries'] = array_values($d['entries']);
  });
}

/* ---------- small helpers ---------- */
function k_ip_key(): string { global $K; return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '', $K['secret']); }
function k_json(int $code, array $body): never {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}
function k_h(?string $s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
// a signed timestamp set when the page loads; forms sent back within 3 seconds are almost always bots
function k_stamp(): string { global $K; $t = (string)time(); return $t . '.' . substr(hash_hmac('sha256', $t, $K['secret']), 0, 16); }
function k_stamp_ok(string $s): bool {
  global $K;
  [$t, $sig] = array_pad(explode('.', $s, 2), 2, '');
  if (!ctype_digit($t) || !hash_equals(substr(hash_hmac('sha256', $t, $K['secret']), 0, 16), $sig)) return false;
  $age = time() - (int)$t;
  return $age >= 3 && $age <= 86400;
}

/* ---------- secrets at rest (the mailbox password) ---------- */
function k_seal(string $plain): string {
  global $K;
  if (!function_exists('openssl_encrypt')) return 'plain:' . base64_encode($plain);
  $iv = random_bytes(12); $tag = '';
  $c = openssl_encrypt($plain, 'aes-256-gcm', hash('sha256', $K['secret'], true), OPENSSL_RAW_DATA, $iv, $tag);
  return 'gcm:' . base64_encode($iv . $tag . $c);
}
function k_open(?string $sealed): string {
  global $K;
  if (!$sealed) return '';
  if (str_starts_with($sealed, 'plain:')) return (string)base64_decode(substr($sealed, 6));
  $b = base64_decode(substr($sealed, 4));
  return (string)openssl_decrypt(substr($b, 28), 'aes-256-gcm', hash('sha256', $K['secret'], true), OPENSSL_RAW_DATA, substr($b, 0, 12), substr($b, 12, 16));
}

/* ---------- email ---------- */
// Sends through the owner's mailbox when it is set up in the inbox settings (reliable, lands in the inbox),
// otherwise through the server's PHP mail() (limited on shared hosting and more likely to land in spam).
function k_send_mail(string $to, string $subject, string $body, string $replyTo = ''): array {
  global $K;
  $user = k_setting('smtp_user');
  $subj = '=?UTF-8?B?' . base64_encode($subject) . '?=';
  $fromName = '=?UTF-8?B?' . base64_encode($K['site_name']) . '?=';
  if ($user) {
    $err = k_smtp($user, k_open(k_setting('smtp_pass')), $to, $subj, $body, $fromName, $replyTo);
    k_setting('mail_last', $err ? 'failed: ' . $err : 'ok ' . gmdate('c'));
    return [$err === '', $err ?: 'sent through ' . $user];
  }
  $headers = ["From: {$fromName} <{$K['from_email']}>", 'Content-Type: text/plain; charset=UTF-8', 'MIME-Version: 1.0'];
  if ($replyTo) $headers[] = 'Reply-To: ' . $replyTo;
  $ok = function_exists('mail') && @mail($to, $subj, $body, implode("\r\n", $headers));
  k_setting('mail_last', $ok ? 'ok (server mail) ' . gmdate('c') : 'failed: server mail');
  return [$ok, $ok ? 'sent through the server' : 'server mail failed'];
}
function k_smtp(string $user, string $pass, string $to, string $subj, string $body, string $fromName, string $replyTo): string {
  $host = k_setting('smtp_host') ?: 'ssl://smtp.hostinger.com';
  $port = (int)(k_setting('smtp_port') ?: 465);
  $fp = @stream_socket_client("{$host}:{$port}", $errno, $errstr, 15);
  if (!$fp) return "could not connect ({$errstr})";
  stream_set_timeout($fp, 15);
  $read = function () use ($fp) { $out = ''; while (($l = fgets($fp, 1024)) !== false) { $out .= $l; if (isset($l[3]) && $l[3] === ' ') break; } return $out; };
  $cmd = function (string $c, string $want) use ($fp, $read) { if ($c !== '') fwrite($fp, $c . "\r\n"); $r = $read(); return str_starts_with($r, $want) ? '' : (trim($r) ?: 'no answer'); };
  $domain = substr(strrchr($user, '@') ?: '@localhost', 1);
  $steps = [['', '220'], ["EHLO {$domain}", '250'], ['AUTH LOGIN', '334'], [base64_encode($user), '334'], [base64_encode($pass), '235'],
    ["MAIL FROM:<{$user}>", '250'], ['RCPT TO:<' . str_replace(['<', '>', "\r", "\n"], '', $to) . '>', '25'], ['DATA', '354']];
  foreach ($steps as [$c, $w]) { $e = $cmd($c, $w); if ($e) { fclose($fp); return $w === '235' ? 'the mailbox rejected the password' : $e; } }
  $msg = "From: {$fromName} <{$user}>\r\nTo: <{$to}>\r\nSubject: {$subj}\r\nDate: " . date('r') . "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n"
    . ($replyTo ? "Reply-To: {$replyTo}\r\n" : '') . "\r\n" . preg_replace('/^\./m', '..', str_replace(["\r\n", "\n"], "\r\n", $body)) . "\r\n.";
  $e = $cmd($msg, '250');
  fwrite($fp, "QUIT\r\n"); fclose($fp);
  return $e;
}
