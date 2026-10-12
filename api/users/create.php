<?php
declare(strict_types=1);
/**
 * Gives a person access. Only the biometrics number and role come from the browser: the person is
 * looked up again here. Someone whose access was removed earlier is reactivated with the new role.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/user_admin.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageUsers', 'Only admins can manage users.');

$data = request_json();
$biometricsId = clean_text($data['biometricsId'] ?? '', 20);
$role = in_array($data['role'] ?? '', [ROLE_ADMIN, ROLE_USER], true) ? $data['role'] : null;
if ($biometricsId === '' || !$role) json_response(['ok' => false, 'message' => 'Enter a biometrics number and choose a role.'], 422);

$person = lookup_person($biometricsId);
if (!$person) json_response(['ok' => false, 'message' => "No employee found with biometrics number {$biometricsId}."], 404);
if ($person['managedByIt']) json_response(['ok' => false, 'message' => 'IT department staff get admin access automatically when they sign in.'], 409);
if ($person['account'] && $person['account']['active']) json_response(['ok' => false, 'message' => "{$person['name']} already has access."], 409);
$roleId = role_id($role);
if ($roleId === null) json_response(['ok' => false, 'message' => 'That role is not set up. Run sql/seed.sql.'], 500);

if ($person['account']) {
    db()->prepare('UPDATE ' . T_USERS . ' SET is_active = 1, deleted_at = NULL, role_id = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = SYSDATETIME() WHERE id = ?')
        ->execute([$roleId, $person['account']['id']]);
    $verb = 'restored access for';
} else {
    db()->prepare('INSERT INTO ' . T_USERS . ' (employee_id, username, role_id, is_active, failed_login_attempts) VALUES (?, ?, ?, 1, 0)')
        ->execute([$person['employeeId'], new_username($person['firstName'], $person['employeeId']), $roleId]);
    $verb = 'gave access to';
}
$roleLabel = $role === ROLE_ADMIN ? 'Admin' : 'Export only';
record_audit('user_access', "Gave {$person['name']} access", "{$user['name']} {$verb} {$person['name']} ({$person['employeeId']}) as {$roleLabel}.", [
    'employeeId' => $person['employeeId'], 'role' => $role,
]);
json_response([
    'ok' => true,
    'users' => managed_accounts(),
    'message' => "{$person['name']} can now sign in as {$roleLabel}" . ($person['hasLogin'] ? '.' : ' once IT creates their company login.'),
]);
