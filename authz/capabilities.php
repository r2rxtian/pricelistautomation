<?php
declare(strict_types=1);
/**
 * Role → permission matrix (Requirements.xlsx › Price Automation, section 2). Keyed by role NAME
 * (dbo.PLA_ACD_Roles.name), not numeric id, so it doesn't depend on IDENTITY insertion order.
 *
 *   Admin – Upload | Update | Save | Approve | Export   (Ms. Gen, Chelsea, Margaret)
 *   User  – Export approved price lists only             (Gemma)
 */

const ROLE_ADMIN = 'Admin';
const ROLE_USER = 'User';

const ROLE_PERMISSIONS = [
    ROLE_ADMIN => ['upload', 'update', 'save', 'approve', 'export', 'viewAudit', 'manageImages'],
    ROLE_USER => ['export'],
];

/** Permissions of a user array (see rules/users.php › public_user). */
function user_permissions(array $user): array
{
    return ROLE_PERMISSIONS[$user['roleName'] ?? ''] ?? [];
}

function user_can(array $user, string $permission): bool
{
    return in_array($permission, user_permissions($user), true);
}
