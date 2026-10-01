<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/storage.php';

function boot_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        $sessionDirectory = __DIR__ . '/storage/sessions';
        if (!is_dir($sessionDirectory) && !mkdir($sessionDirectory, 0775, true) && !is_dir($sessionDirectory)) {
            throw new RuntimeException('Unable to create the session directory.');
        }
        session_save_path($sessionDirectory);
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        session_start();
    }
    $_SESSION['csrf'] ??= bin2hex(random_bytes(24));
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function request_json(): array
{
    static $data = null;
    if ($data !== null) return $data;
    $body = file_get_contents('php://input');
    $decoded = json_decode($body ?: '{}', true);
    if (!is_array($decoded)) {
        json_response(['ok' => false, 'message' => 'Invalid JSON request.'], 400);
    }
    return $data = $decoded;
}

function clean_text(mixed $value, int $max = 180): string
{
    if (is_array($value) || is_object($value)) return '';
    $value = trim((string) $value);
    return mb_substr($value, 0, $max);
}

// ---------------------------------------------------------------------------
// Users, roles and permissions
// ---------------------------------------------------------------------------

/** @return array{username:string,name:string,role:string,email:string}|null */
function find_user_by_email(string $email): ?array
{
    $record = USERS[strtolower($email)] ?? null;
    if (!is_array($record)) return null;
    return ['email' => strtolower($email)] + $record;
}

function find_user_by_username(string $username): ?array
{
    foreach (USERS as $email => $record) {
        if (($record['username'] ?? '') === $username) return ['email' => $email] + $record;
    }
    return null;
}

function user_display_name(string $username): string
{
    return find_user_by_username($username)['name'] ?? $username;
}

function verify_user_password(array $record, string $password): bool
{
    if (!empty($record['password_hash'])) return password_verify($password, (string) $record['password_hash']);
    if (isset($record['password'])) return hash_equals((string) $record['password'], $password);
    return false;
}

function public_user(array $record): array
{
    return [
        'username' => (string) $record['username'],
        'name' => (string) $record['name'],
        'role' => (string) $record['role'],
        'email' => (string) ($record['email'] ?? ''),
    ];
}

function current_user(): ?array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || empty($user['username'])) return null;
    // Re-read the account so role changes and removed accounts take effect immediately.
    $record = find_user_by_username((string) $user['username']);
    return $record ? public_user($record) : null;
}

function require_user(): array
{
    $user = current_user();
    if (!$user) {
        json_response(['ok' => false, 'message' => 'Please sign in again.'], 401);
    }
    return $user;
}

function require_csrf(): void
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!hash_equals($_SESSION['csrf'] ?? '', $token)) {
        json_response(['ok' => false, 'message' => 'Your session token is invalid. Refresh and try again.'], 419);
    }
}

function user_permissions(array $user): array
{
    return ROLE_PERMISSIONS[$user['role'] ?? ''] ?? [];
}

function user_can(array $user, string $permission): bool
{
    return in_array($permission, user_permissions($user), true);
}

function require_permission(array $user, string $permission, string $message): void
{
    if (!user_can($user, $permission)) json_response(['ok' => false, 'message' => $message], 403);
}

/** Usernames of every account that holds a permission. */
function usernames_with_permission(string $permission): array
{
    $names = [];
    foreach (USERS as $record) {
        if (in_array($permission, ROLE_PERMISSIONS[$record['role'] ?? ''] ?? [], true)) $names[] = (string) $record['username'];
    }
    return $names;
}

function is_auto_approver(string $username): bool
{
    return in_array($username, AUTO_APPROVE_USERS, true);
}

/** Approvers for a submitter, never including the submitter. Auto-approving users need none. */
function approvers_for(string $submitter): array
{
    if (is_auto_approver($submitter)) return [];
    $configured = APPROVERS[$submitter] ?? null;
    $list = is_array($configured) && $configured ? $configured : usernames_with_permission('approve');
    $list = array_values(array_unique(array_filter(
        array_map('strval', $list),
        fn(string $name) => $name !== $submitter && ($record = find_user_by_username($name)) && in_array('approve', ROLE_PERMISSIONS[$record['role']] ?? [], true)
    )));
    return $list;
}

// ---------------------------------------------------------------------------
// Price list versions
// ---------------------------------------------------------------------------

/** Maps "1", "level 1", "PL1" or "Price Level 1" to "Price Level 1"; null when it isn't a configured level. */
function canonical_price_level(string $input): ?string
{
    if (!preg_match('/^\s*(?:price\s*level|level|pl|lvl)?\s*#?\s*(\d{1,3})\s*$/i', $input, $match)) return null;
    $level = 'Price Level ' . (int) $match[1];
    return in_array($level, PRICE_LEVELS, true) ? $level : null;
}

/** Maps a country (any case/spacing) to its entry in the configured list, or null when it isn't listed. */
function canonical_country(string $input): ?string
{
    $key = mb_strtolower(preg_replace('/\s+/u', ' ', trim($input)));
    if ($key === '') return null;
    foreach (COUNTRIES as $country) {
        if (mb_strtolower($country) === $key) return $country;
    }
    return COUNTRIES ? null : trim($input);
}

/** A price list is identified by name + country + price level, so one country can hold several price levels. */
function same_price_list(array $a, array $b): bool
{
    $norm = fn($value) => mb_strtolower(preg_replace('/\s+/u', ' ', trim((string) $value)));
    return $norm($a['name'] ?? '') === $norm($b['name'] ?? '')
        && $norm($a['country'] ?? '') === $norm($b['country'] ?? '')
        && $norm($a['priceLevel'] ?? '') === $norm($b['priceLevel'] ?? '');
}

const VERSION_SUMMARY_KEYS = [
    'id', 'name', 'priceLevel', 'country', 'revision', 'status', 'adjustment', 'categoryAdjustments', 'summary',
    'savedAt', 'savedBy', 'savedByUser', 'requiredApprovers', 'approvals', 'approvedAt', 'approvedBy',
    'rejectedAt', 'rejectedBy', 'rejectionRemarks', 'productCount', 'categories', 'changeCount', 'source', 'basedOn',
];

function version_summary(array $version): array
{
    $summary = array_intersect_key($version, array_flip(VERSION_SUMMARY_KEYS));
    if (!isset($summary['productCount'])) $summary['productCount'] = is_array($version['rows'] ?? null) ? count($version['rows']) : 0;
    return $summary;
}

/** Normalises records written by older builds so every version has workflow fields. */
function normalize_version(array $version): array
{
    $version['status'] = in_array($version['status'] ?? '', ['uploaded', 'pending', 'approved', 'rejected', 'superseded'], true) ? $version['status'] : 'pending';
    // 'upload' = a file as uploaded (no approval needed); 'change' = edited prices that go through approval.
    if (($version['source'] ?? '') !== 'upload') {
        // Records saved before uploads and changes were separated: a list with no parent, no adjustments
        // and no cell edits is an unmodified upload.
        $adjusted = $version['summary']['adjustedCategories'] ?? [];
        $isUpload = !$adjusted && empty($version['basedOn']) && (int) ($version['changeCount'] ?? 0) === 0 && (float) ($version['adjustment'] ?? 0) === 0.0;
        $version['source'] = $isUpload ? 'upload' : 'change';
        if ($isUpload && in_array($version['status'], ['pending', 'approved', 'rejected'], true)) $version['status'] = 'uploaded';
    }
    $version['source'] = $version['source'] === 'upload' ? 'upload' : 'change';
    $version['revision'] = max(1, (int) ($version['revision'] ?? 1));
    $version['priceLevel'] = (string) ($version['priceLevel'] ?? '');
    $version['country'] = (string) ($version['country'] ?? '');
    $version['savedByUser'] = (string) ($version['savedByUser'] ?? '');
    $version['approvals'] = is_array($version['approvals'] ?? null) ? array_values($version['approvals']) : [];
    if ($version['source'] === 'upload') {
        $version['requiredApprovers'] = [];
    } elseif (!is_array($version['requiredApprovers'] ?? null) || !$version['requiredApprovers']) {
        $version['requiredApprovers'] = $version['savedByUser'] !== '' ? approvers_for($version['savedByUser']) : usernames_with_permission('approve');
    }
    if (!isset($version['productCount']) && is_array($version['rows'] ?? null)) $version['productCount'] = count($version['rows']);
    return $version;
}

function can_user_approve(array $user, array $version): bool
{
    if (!user_can($user, 'approve')) return false;
    if (($version['status'] ?? '') !== 'pending') return false;
    if (($version['savedByUser'] ?? '') === $user['username']) return false;
    if (!in_array($user['username'], $version['requiredApprovers'] ?? [], true)) return false;
    foreach ($version['approvals'] ?? [] as $approval) {
        if (($approval['username'] ?? '') === $user['username']) return false;
    }
    return true;
}

function approval_complete(array $version): bool
{
    $approved = array_map(fn($a) => (string) ($a['username'] ?? ''), $version['approvals'] ?? []);
    $required = $version['requiredApprovers'] ?? [];
    if (!$required) return count($approved) > 0;
    if (APPROVAL_MODE === 'all') return !array_diff($required, $approved);
    return (bool) array_intersect($required, $approved);
}

function version_visible_to(array $user, array $version): bool
{
    if (user_can($user, 'update')) return true;
    // Export-only users see live lists: approved changes and uploaded files.
    return in_array($version['status'] ?? '', ['approved', 'uploaded'], true);
}

function is_exportable(array $version): bool
{
    return in_array($version['status'] ?? '', ['approved', 'uploaded'], true);
}

// ---------------------------------------------------------------------------
// Audit log and notifications
// ---------------------------------------------------------------------------

function record_audit(string $type, string $title, string $details = '', array $metadata = [], ?array $actor = null): array
{
    $actor ??= current_user();
    $log = [
        'id' => bin2hex(random_bytes(8)),
        'type' => clean_text($type, 40),
        'title' => clean_text($title, 300),
        'details' => clean_text($details, 1000),
        'actor' => $actor['name'] ?? 'System',
        'actorUser' => $actor['username'] ?? '',
        'role' => $actor['role'] ?? 'system',
        'timestamp' => gmdate('c'),
        'metadata' => $metadata,
    ];
    repo_add_audit($log);
    return $log;
}

function notify(array $usernames, string $type, string $title, string $message, ?string $versionId = null): void
{
    $current = current_user()['username'] ?? '';
    foreach (array_unique($usernames) as $username) {
        if ($username === '' || $username === $current || !find_user_by_username($username)) continue;
        repo_add_notification([
            'id' => bin2hex(random_bytes(8)),
            'recipient' => $username,
            'type' => clean_text($type, 40),
            'title' => clean_text($title, 300),
            'message' => clean_text($message, 1000),
            'versionId' => $versionId,
            'createdAt' => gmdate('c'),
            'read' => false,
        ]);
    }
}

function version_label(array $version): string
{
    $parts = [$version['name'] ?? 'Price list'];
    $meta = array_filter([$version['priceLevel'] ?? '', $version['country'] ?? '']);
    if ($meta) $parts[] = '(' . implode(' · ', $meta) . ')';
    if (($version['revision'] ?? 1) > 1) $parts[] = 'rev ' . $version['revision'];
    return implode(' ', $parts);
}

boot_session();
