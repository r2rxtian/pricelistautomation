<?php
declare(strict_types=1);
/** Everything the app needs on load and refresh: user, permissions, lists, photos, logs, notifications. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();

$versions = array_values(array_filter(repo_list_version_summaries(), fn($v) => version_visible_to($user, $v)));
$versions = array_map(fn($v) => version_for_client($user, $v), $versions);

json_response([
    'ok' => true,
    'user' => $user,
    'permissions' => user_permissions($user),
    'csrf' => csrfToken(),
    'approvalMode' => APPROVAL_MODE,
    'approvers' => user_can($user, 'save') ? array_map('user_display_name', approvers_for($user['username'])) : [],
    'autoApprove' => user_can($user, 'save') && is_auto_approver($user['username']),
    'countries' => COUNTRIES,
    'priceLevels' => PRICE_LEVELS,
    'directory' => directory_payload(),
    'versions' => $versions,
    'productImages' => repo_list_images(),
    'photoLibrary' => user_can($user, 'manageImages') ? repo_list_library() : [],
    'auditLogs' => user_can($user, 'viewAudit') ? repo_list_audit(1000) : [],
    'devTools' => DEV_TOOLS_ENABLED && user_can($user, 'update'),
] + notifications_payload($user));
