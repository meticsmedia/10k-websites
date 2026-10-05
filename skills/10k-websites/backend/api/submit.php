<?php
// submit.php: receives every form on the site, stores it, and emails the owner.
declare(strict_types=1);
define('K_BACKEND', 1);
require __DIR__ . '/lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['stamp'])) k_json(200, ['stamp' => k_stamp()]);
// a quick health check for after deploying: PHP runs, where data goes, how email is sent (nothing private)
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET' && isset($_GET['check'])) {
  $dir = k_dir();
  k_json(200, ['ok' => true, 'php' => PHP_VERSION, 'storage' => k_mode(), 'private_folder' => !str_starts_with($dir, dirname(__DIR__)), 'writable' => is_writable($dir), 'email' => k_setting('smtp_user') ? 'mailbox' : 'server']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') k_json(405, ['ok' => false, 'error' => 'method']);

$wantsJson = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
$back = function (bool $ok, string $error = '') use ($wantsJson) {
  if ($wantsJson) k_json($ok ? 200 : 400, $ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
  // without JavaScript: go back to the page with a result flag
  $ref = $_POST['_page'] ?? '/';
  $ref = (is_string($ref) && str_starts_with($ref, '/') && !str_starts_with($ref, '//')) ? $ref : '/';
  header('Location: ' . strtok($ref, '#?') . '?sent=' . ($ok ? '1' : '0') . '#' . ($ok ? 'sent' : 'form-error'), true, 303);
  exit;
};

$in = $_POST;
// bots fill every field, including this hidden one; answer "ok" so they move on, and store nothing
if (!empty($in['_website'])) $back(true);
if (!k_stamp_ok((string)($in['_t'] ?? ''))) $back(false, 'expired');

// rate limit: 5 sends per 10 minutes per visitor
if (k_hits('send:' . k_ip_key(), 600) >= 5) $back(false, 'slow_down');
k_hits('send:' . k_ip_key(), 600, true);

$clean = fn($v, $max) => mb_substr(trim(str_replace("\0", '', (string)$v)), 0, $max);
$name = $clean($in['name'] ?? '', 200);
$email = $clean($in['email'] ?? '', 254);
$message = $clean($in['message'] ?? '', 5000);
$form = preg_replace('/[^a-z0-9_-]/i', '', (string)($in['_form'] ?? 'contact')) ?: 'contact';
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $back(false, 'email');
if ($name === '' && $email === '' && $message === '') $back(false, 'empty');

$extra = [];
foreach ($in as $k => $v) {
  if (in_array($k, ['name', 'email', 'message'], true) || str_starts_with((string)$k, '_')) continue;
  if (!preg_match('/^[a-z0-9_-]{1,40}$/i', (string)$k) || count($extra) >= 20) continue;
  $val = is_array($v) ? implode(', ', array_filter(array_map(fn($x) => $clean($x, 500), $v), 'strlen')) : $clean($v, 2000);
  if ($val !== '') $extra[$k] = $val;
}
$page = $clean($in['_page'] ?? '', 300);
k_add_entry(['created' => gmdate('c'), 'form' => $form, 'name' => $name, 'email' => $email, 'message' => $message, 'extra' => json_encode($extra, JSON_UNESCAPED_UNICODE), 'page' => $page]);

// email the owner; the inbox page is the record, so a failed email never loses a message
if (!empty($K['owner_email'])) {
  $lines = ["New {$form} message from your website", '', "Name: {$name}", "Email: {$email}"];
  foreach ($extra as $k => $v) $lines[] = ucfirst(str_replace(['_', '-'], ' ', $k)) . ": {$v}";
  $lines[] = ''; $lines[] = $message; $lines[] = ''; $lines[] = 'All messages: ' . ($K['site_url'] ?? '') . '/admin/';
  k_send_mail($K['owner_email'], "[{$K['site_name']}] New {$form}: " . ($name ?: $email ?: 'message'), implode("\n", $lines), $email !== '' ? str_replace(["\r", "\n"], '', $email) : '');
}
$back(true);
