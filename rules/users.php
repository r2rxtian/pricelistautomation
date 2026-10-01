<?php
declare(strict_types=1);
/**
 * The people who can use the app: dbo.PLA_ACD_Users (the selected users, seeded by sql/seed.sql),
 * with names taken live from the HR master list. Nothing about a person is hardcoded here.
 */

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/../authz/capabilities.php';

/**
 * Every active account, keyed by username. Cached for the request.
 * @return array<string, array{id:int, employee_id:string, username:string, name:string, roleName:string}>
 */
function pla_users(): array
{
    static $users = null;
    if ($users !== null) return $users;
    $rows = db()->query('
        SELECT u.id, u.employee_id, u.username, r.name AS role_name, ml.full_name
        FROM ' . T_USERS . ' u
        JOIN ' . T_ROLES . ' r ON r.id = u.role_id
        OUTER APPLY (
            SELECT TOP 1 ' . masterListNameSql('m') . ' AS full_name
            FROM ' . T_MASTER_LIST . " m
            WHERE m.EmployeeID = u.employee_id
            ORDER BY CASE WHEN m.IsActive = '1' THEN 0 ELSE 1 END
        ) ml
        WHERE u.is_active = 1 AND u.deleted_at IS NULL
    ")->fetchAll();
    $users = [];
    foreach ($rows as $row) {
        $users[(string) $row['username']] = [
            'id' => (int) $row['id'],
            'employee_id' => (string) $row['employee_id'],
            'username' => (string) $row['username'],
            'name' => trim((string) ($row['full_name'] ?? '')) ?: (string) $row['employee_id'],
            'roleName' => (string) $row['role_name'],
        ];
    }
    return $users;
}

function find_user_by_username(string $username): ?array
{
    return pla_users()[$username] ?? null;
}

function find_user_by_id(int $id): ?array
{
    foreach (pla_users() as $user) {
        if ($user['id'] === $id) return $user;
    }
    return null;
}

function user_display_name(string $username): string
{
    return find_user_by_username($username)['name'] ?? $username;
}

/**
 * The shape the browser and the audit log see. $roleName overrides the stored role (IT-department
 * administrators are stored as User but act as Admin; see auth/login_handler.php).
 */
function public_user(array $record, ?string $roleName = null): array
{
    $roleName ??= $record['roleName'];
    return [
        'username' => $record['username'],
        'name' => $record['name'],
        'employeeId' => $record['employee_id'],
        'roleName' => $roleName,
        'role' => strtolower($roleName),
    ];
}

/** Usernames of every account whose stored role holds a permission. */
function usernames_with_permission(string $permission): array
{
    $names = [];
    foreach (pla_users() as $user) {
        if (in_array($permission, ROLE_PERMISSIONS[$user['roleName']] ?? [], true)) $names[] = $user['username'];
    }
    return $names;
}

function directory_payload(): array
{
    return array_values(array_map(fn(array $user) => ['username' => $user['username'], 'name' => $user['name'], 'role' => strtolower($user['roleName'])], pla_users()));
}
