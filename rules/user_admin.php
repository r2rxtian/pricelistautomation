<?php
declare(strict_types=1);
/**
 * User management (the Users page), the same flow as QRTS: look a person up by biometrics number in
 * the HR master list, then give them access with a role. Names, departments and sign-in always come
 * from the company tables; PLA_Users only holds who has access, their role and a short username.
 * IT department staff are not managed here: they get Admin automatically at sign-in.
 */

require_once __DIR__ . '/users.php';

/** The person behind a biometrics number, with their access status here. Null when not found. */
function lookup_person(string $biometricsId): ?array
{
    $statement = db()->prepare('
        SELECT TOP 1 ml.EmployeeID AS employee_id, ' . masterListNameSql('ml') . ' AS full_name, ml.FirstName AS first_name,
               ml.Department AS department, ml.PositionTitle AS position, ml.IsActive AS employed, lu.status AS login_status
        FROM ' . T_MASTER_LIST . ' ml
        LEFT JOIN ' . T_LRNPH_USERS . ' lu ON lu.username = ml.BiometricsID
        WHERE ml.BiometricsID = ?
        ORDER BY CASE WHEN ml.IsActive = \'1\' THEN 0 ELSE 1 END
    ');
    $statement->execute([$biometricsId]);
    $person = $statement->fetch();
    if (!$person) return null;
    $account = db()->prepare('SELECT u.id, u.is_active, u.deleted_at, r.name AS role_name FROM ' . T_USERS . ' u JOIN ' . T_ROLES . ' r ON r.id = u.role_id WHERE u.employee_id = ?');
    $account->execute([$person['employee_id']]);
    $existing = $account->fetch() ?: null;
    return [
        'employeeId' => (string) $person['employee_id'],
        'name' => trim((string) $person['full_name']),
        'firstName' => trim((string) ($person['first_name'] ?? '')),
        'department' => (string) ($person['department'] ?? ''),
        'position' => (string) ($person['position'] ?? ''),
        'employed' => (string) $person['employed'] === '1',
        'hasLogin' => ($person['login_status'] ?? '') === 'active',
        'managedByIt' => isItDepartmentAdmin($person['department'] ?? null),
        'account' => $existing ? [
            'id' => (int) $existing['id'],
            'active' => (bool) $existing['is_active'] && $existing['deleted_at'] === null,
            'role' => (string) $existing['role_name'],
        ] : null,
    ];
}

/** Every account (active or not) with the master-list details, for the Users table. */
function list_accounts(): array
{
    $rows = db()->query('
        SELECT u.id, u.employee_id, u.username, u.is_active, u.deleted_at, u.last_login_at, r.name AS role_name,
               ml.full_name, ml.department, ml.position, ml.biometrics_id
        FROM ' . T_USERS . ' u
        JOIN ' . T_ROLES . ' r ON r.id = u.role_id
        OUTER APPLY (
            SELECT TOP 1 ' . masterListNameSql('m') . ' AS full_name, m.Department AS department, m.PositionTitle AS position, m.BiometricsID AS biometrics_id
            FROM ' . T_MASTER_LIST . " m
            WHERE m.EmployeeID = u.employee_id
            ORDER BY CASE WHEN m.IsActive = '1' THEN 0 ELSE 1 END
        ) ml
        ORDER BY CASE WHEN u.is_active = 1 AND u.deleted_at IS NULL THEN 0 ELSE 1 END, ml.full_name
    ")->fetchAll();
    return array_map(fn(array $row) => [
        'id' => (int) $row['id'],
        'employeeId' => (string) $row['employee_id'],
        'biometricsId' => (string) ($row['biometrics_id'] ?? ''),
        'username' => (string) $row['username'],
        'name' => trim((string) ($row['full_name'] ?? '')) ?: (string) $row['employee_id'],
        'department' => (string) ($row['department'] ?? ''),
        'position' => (string) ($row['position'] ?? ''),
        'role' => (string) $row['role_name'],
        'active' => (bool) $row['is_active'] && $row['deleted_at'] === null,
        'lastLogin' => $row['last_login_at'] ? (new DateTimeImmutable((string) $row['last_login_at']))->format(DateTimeInterface::ATOM) : null,
        'managedByIt' => isItDepartmentAdmin($row['department'] ?? null),
    ], $rows);
}

/** The accounts the Users page manages: IT staff are left out because their access is automatic. */
function managed_accounts(): array
{
    return array_values(array_filter(list_accounts(), fn(array $account) => !$account['managedByIt']));
}

/** A short unique handle for approvals and notifications, e.g. "gemma" or "gemma2". */
function new_username(string $firstName, string $employeeId): string
{
    $base = strtolower(preg_replace('/[^a-z0-9]/i', '', explode(' ', trim($firstName))[0] ?? '')) ?: strtolower(preg_replace('/[^a-z0-9]/i', '', $employeeId));
    $base = substr($base, 0, 24) ?: 'user';
    $taken = db()->prepare('SELECT 1 FROM ' . T_USERS . ' WHERE username = ?');
    for ($n = 1; $n < 1000; $n++) {
        $candidate = $n === 1 ? $base : $base . $n;
        $taken->execute([$candidate]);
        if (!$taken->fetchColumn()) return $candidate;
    }
    return $base . bin2hex(random_bytes(3));
}

function role_id(string $role): ?int
{
    $statement = db()->prepare('SELECT id FROM ' . T_ROLES . ' WHERE name = ?');
    $statement->execute([$role]);
    $id = $statement->fetchColumn();
    return $id === false ? null : (int) $id;
}

/** Active Admin accounts other than IT's automatic ones (there must always be at least one). */
function count_active_admins(): int
{
    return count(array_filter(managed_accounts(), fn($account) => $account['active'] && $account['role'] === ROLE_ADMIN));
}
