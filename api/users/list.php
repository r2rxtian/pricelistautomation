<?php
declare(strict_types=1);
/** Everyone with access (active or not), for Config › Users. IT staff aren't listed: their access is automatic. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/user_admin.php';

$user = apiUser();
requirePermission($user, 'manageUsers', 'Only admins can manage users.');
json_response(['ok' => true, 'users' => managed_accounts(), 'me' => $user['username']]);
