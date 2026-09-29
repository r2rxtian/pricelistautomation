<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

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
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function request_json(): array
{
    $body = file_get_contents('php://input');
    $data = json_decode($body ?: '{}', true);
    if (!is_array($data)) {
        json_response(['ok' => false, 'message' => 'Invalid JSON request.'], 400);
    }
    return $data;
}

function current_user(): ?array
{
    return isset($_SESSION['user']) && is_array($_SESSION['user']) ? $_SESSION['user'] : null;
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

function can_edit(array $user): bool
{
    return in_array($user['role'] ?? '', EDIT_ROLES, true);
}

function default_store(): array
{
    return ['active' => null, 'versions' => [], 'productImages' => [], 'auditLogs' => []];
}

function record_audit_log(array &$store, string $type, string $title, string $details = '', array $metadata = []): array
{
    $user = current_user();
    $actor = $user['name'] ?? 'System';
    $role = $user['role'] ?? 'user';
    if (empty($metadata['fileName']) && !empty($store['active']['name'])) {
        $metadata['fileName'] = $store['active']['name'];
    }
    $store['auditLogs'] ??= [];

    // For save_version, if an entry for this version/file already exists, update it in place so logs do not stack up
    if ($type === 'save_version') {
        $targetVerId = (string) ($metadata['versionId'] ?? '');
        $targetFile = trim((string) ($metadata['fileName'] ?? $metadata['versionName'] ?? ''));

        foreach ($store['auditLogs'] as $idx => $existingLog) {
            $existingVerId = (string) ($existingLog['metadata']['versionId'] ?? '');
            $existingFile = trim((string) ($existingLog['metadata']['fileName'] ?? $existingLog['metadata']['versionName'] ?? ''));

            $isSameVersion = ($targetVerId !== '' && $existingVerId === $targetVerId);
            $isSameFile = ($targetFile !== '' && strcasecmp($existingFile, $targetFile) === 0);

            if (($existingLog['type'] ?? '') === 'save_version' && ($isSameVersion || $isSameFile)) {
                $existingLog['title'] = $title;
                $existingLog['details'] = $details;
                $existingLog['actor'] = $actor;
                $existingLog['role'] = $role;
                $existingLog['timestamp'] = gmdate('c');
                $existingLog['metadata'] = array_replace($existingLog['metadata'] ?? [], $metadata);
                // Move updated log to the top
                array_splice($store['auditLogs'], $idx, 1);
                array_unshift($store['auditLogs'], $existingLog);
                return $existingLog;
            }
        }
    }

    $log = [
        'id' => bin2hex(random_bytes(6)),
        'type' => $type,
        'title' => $title,
        'details' => $details,
        'actor' => $actor,
        'role' => $role,
        'timestamp' => gmdate('c'),
        'metadata' => $metadata,
    ];
    array_unshift($store['auditLogs'], $log);
    if (count($store['auditLogs']) > 200) {
        $store['auditLogs'] = array_slice($store['auditLogs'], 0, 200);
    }
    return $log;
}

function read_store(): array
{
    if (database_enabled()) return database_read_store();
    if (!is_file(STORAGE_FILE)) {
        return default_store();
    }
    $decoded = json_decode((string) file_get_contents(STORAGE_FILE), true);
    $store = is_array($decoded) ? array_replace(default_store(), $decoded) : default_store();

    // Deduplicate versions so multiple saves of the same file do not stack up in history
    if (!empty($store['versions']) && is_array($store['versions'])) {
        $seen = [];
        $unique = [];
        for ($i = count($store['versions']) - 1; $i >= 0; $i--) {
            $v = $store['versions'][$i];
            $key = strtolower(trim((string) ($v['name'] ?? $v['id'] ?? '')));
            if ($key !== '' && !isset($seen[$key])) {
                $seen[$key] = true;
                $unique[] = $v;
            }
        }
        $store['versions'] = array_reverse($unique);
    }

    // Deduplicate save_version audit logs so multiple saves of the same file do not stack up
    if (!empty($store['auditLogs']) && is_array($store['auditLogs'])) {
        $seenLogs = [];
        $uniqueLogs = [];
        foreach ($store['auditLogs'] as $l) {
            $type = (string) ($l['type'] ?? '');
            if ($type === 'save_version') {
                $targetFile = strtolower(trim((string) ($l['metadata']['fileName'] ?? $l['metadata']['versionName'] ?? $l['title'] ?? '')));
                if ($targetFile !== '') {
                    if (isset($seenLogs[$targetFile])) {
                        continue; // Skip older stacked duplicate log
                    }
                    $seenLogs[$targetFile] = true;
                }
            }
            $uniqueLogs[] = $l;
        }
        $store['auditLogs'] = $uniqueLogs;
    }

    return $store;
}

function write_store(array $store): void
{
    if (database_enabled()) {
        database_write_store($store);
        return;
    }
    $directory = dirname(STORAGE_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the storage directory.');
    }
    $temporary = STORAGE_FILE . '.' . bin2hex(random_bytes(6)) . '.tmp';
    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false || file_put_contents($temporary, $json, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write application data.');
    }
    if (!rename($temporary, STORAGE_FILE)) {
        @unlink($temporary);
        throw new RuntimeException('Unable to finalize application data.');
    }
}

function clean_text(mixed $value, int $max = 180): string
{
    $value = trim((string) $value);
    return mb_substr($value, 0, $max);
}

boot_session();
