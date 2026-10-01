<?php
declare(strict_types=1);
/**
 * Shared setup for the JSON endpoints in api/**. A typical write endpoint:
 *
 *   require_once __DIR__ . '/../bootstrap.php';
 *   $user = apiUser();                 // 401 when signed out
 *   requirePost(); csrfVerify();       // writes only
 *   requirePermission($user, 'save', 'Your role cannot save price lists.');
 *
 * Responses are {ok: true, …} or {ok: false, message} (read by scripts/app.js › api()).
 */

require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../auth/csrf.php';
require_once __DIR__ . '/../authz/authz.php';
require_once __DIR__ . '/../authz/audit.php';
require_once __DIR__ . '/../rules/workflow.php';
require_once __DIR__ . '/../rules/validation.php';

set_exception_handler(function (Throwable $error): void {
    error_log($error->__toString());
    json_response(['ok' => false, 'message' => 'The server could not complete the request.'], 500);
});

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
    $decoded = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($decoded)) json_response(['ok' => false, 'message' => 'Invalid JSON request.'], 400);
    return $data = $decoded;
}

function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['ok' => false, 'message' => 'Method not allowed.'], 405);
}

function apiUser(): array
{
    return requireLogin(true);
}

/** A version the user may open, or a 404 response. */
function find_open_version(array $user, string $id): array
{
    $version = repo_get_version($id);
    if (!$version || !version_visible_to($user, $version)) {
        json_response(['ok' => false, 'message' => 'Price list not found or not available to your account.'], 404);
    }
    return $version;
}

/** A version this user may approve or reject right now, or an error response saying why not. */
function find_reviewable_version(array $user, string $id): array
{
    $version = repo_get_version($id);
    if (!$version) json_response(['ok' => false, 'message' => 'Price list not found.'], 404);
    if (!can_user_approve($user, $version)) {
        $reason = ($version['savedByUser'] ?? '') === $user['username']
            ? 'You cannot approve or reject a price list you saved yourself.'
            : (($version['status'] ?? '') !== 'pending' ? 'This price list is no longer awaiting approval.' : 'You are not an assigned approver for this price list.');
        json_response(['ok' => false, 'message' => $reason], 403);
    }
    return $version;
}
