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
    return ['active' => null, 'versions' => []];
}

function read_store(): array
{
    if (database_enabled()) return database_read_store();
    if (!is_file(STORAGE_FILE)) {
        return default_store();
    }
    $decoded = json_decode((string) file_get_contents(STORAGE_FILE), true);
    return is_array($decoded) ? array_replace(default_store(), $decoded) : default_store();
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
