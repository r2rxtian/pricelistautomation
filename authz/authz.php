<?php
declare(strict_types=1);
/**
 * The single shared authorization check. Every write endpoint in api/ calls this after
 * requireLogin(true) and csrfVerify():
 *
 *   requirePermission($user, 'approve', 'Your role cannot approve price lists.');
 *
 * A role → permission check (see authz/capabilities.php) plus an audit-log entry on denial.
 */

require_once __DIR__ . '/capabilities.php';
require_once __DIR__ . '/audit.php';

function requirePermission(array $user, string $permission, string $message = 'You do not have permission to perform this action.'): void
{
    if (user_can($user, $permission)) return;
    try {
        record_audit('access_denied', 'Access denied', "{$user['name']} tried an action that needs the '{$permission}' permission.", ['permission' => $permission], $user);
    } catch (Throwable $error) {
        error_log('Access-denied audit: ' . $error->getMessage());
    }
    respondForbidden($message);
}

function respondForbidden(string $message = 'You do not have permission to perform this action.'): never
{
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'success' => false, 'message' => $message, 'type' => 'error']);
    exit;
}
