<?php
declare(strict_types=1);
/**
 * Changes someone's role or turns their access off/on. You can't change your own account, IT staff
 * are managed automatically, and at least one active Admin always remains.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/user_admin.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageUsers', 'Only admins can manage users.');

$data = request_json();
$id = (int) ($data['id'] ?? 0);
$target = null;
foreach (list_accounts() as $account) if ($account['id'] === $id) $target = $account;
if (!$target) json_response(['ok' => false, 'message' => 'User not found. Refresh and try again.'], 404);
if ($target['username'] === $user['username']) json_response(['ok' => false, 'message' => "You can't change your own access. Ask another admin."], 409);
if ($target['managedByIt']) json_response(['ok' => false, 'message' => 'IT department access is managed automatically.'], 409);

$role = array_key_exists('role', $data) ? (in_array($data['role'], [ROLE_ADMIN, ROLE_USER], true) ? $data['role'] : null) : $target['role'];
if ($role === null) json_response(['ok' => false, 'message' => 'Choose Admin or Export only.'], 422);
$active = array_key_exists('active', $data) ? (bool) $data['active'] : $target['active'];

// Never leave the app without an admin.
$losesAdmin = $target['active'] && $target['role'] === ROLE_ADMIN && (!$active || $role !== ROLE_ADMIN);
if ($losesAdmin && count_active_admins() <= 1) json_response(['ok' => false, 'message' => "{$target['name']} is the last admin. Make someone else an admin first."], 409);

$roleId = role_id($role);
db()->prepare('UPDATE ' . T_USERS . ' SET role_id = ?, is_active = ?, deleted_at = NULL, updated_at = SYSDATETIME() WHERE id = ?')
    ->execute([$roleId, $active ? 1 : 0, $id]);

$roleLabel = $role === ROLE_ADMIN ? 'Admin' : 'Export only';
$changes = [];
if ($role !== $target['role']) $changes[] = "role to {$roleLabel}";
if ($active !== $target['active']) $changes[] = $active ? 'access turned on' : 'access turned off';
$summary = $changes ? implode(', ', $changes) : 'no change';
record_audit('user_access', "Updated {$target['name']}'s access", "{$user['name']} changed {$target['name']}: {$summary}.", [
    'employeeId' => $target['employeeId'], 'role' => $role, 'active' => $active,
]);
json_response([
    'ok' => true,
    'users' => managed_accounts(),
    'message' => !$active ? "{$target['name']} can no longer sign in." : ($role !== $target['role'] ? "{$target['name']} is now {$roleLabel}." : "{$target['name']} can sign in again."),
]);
