<?php
declare(strict_types=1);
/** Everything the app needs on load and refresh: user, permissions, lists, photos, logs, notifications. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/workbook_import.php';

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
    // Offered in the dropdowns (Config › Countries & price levels).
    'countries' => active_option_names('countries'),
    'priceLevels' => active_option_names('priceLevels'),
    'priceLevelInfo' => array_map(fn($item) => ['name' => $item['name'], 'description' => $item['description']], list_options('priceLevels')),
    'listOptions' => user_can($user, 'manageImages') ? list_options_payload() : null,
    'importTemplate' => user_can($user, 'upload') ? price_list_template() : null,
    'directory' => directory_payload(),
    'versions' => $versions,
    'productImages' => repo_list_images(),
    'photoLibrary' => user_can($user, 'manageImages') ? repo_list_library() : [],
    'photoFolders' => user_can($user, 'manageImages') ? repo_list_library_folders() : [],
    'searchKeywords' => repo_list_search_keywords(), // everyone's search uses them

    'auditLogs' => user_can($user, 'viewAudit') ? repo_list_audit(1000) : [],
    'devTools' => DEV_TOOLS_ENABLED && user_can($user, 'update'),
] + notifications_payload($user));
