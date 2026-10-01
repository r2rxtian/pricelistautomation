<?php
declare(strict_types=1);
/**
 * Audit log and in-app notifications (stored through the repository: storage/app.json or SQL Server).
 */

require_once __DIR__ . '/../auth/session.php';
require_once __DIR__ . '/../rules/validation.php';
require_once __DIR__ . '/../repository/store.php';

function record_audit(string $type, string $title, string $details = '', array $metadata = [], ?array $actor = null): array
{
    $actor ??= currentUser();
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
    $current = currentUser()['username'] ?? '';
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

function notifications_payload(array $user): array
{
    $items = repo_list_notifications($user['username'], 100);
    return [
        'notifications' => $items,
        'unreadCount' => count(array_filter($items, fn($n) => empty($n['read']))),
    ];
}
