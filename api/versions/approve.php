<?php
declare(strict_types=1);
/** Records an approval; the price list goes live once the approval rule (APPROVAL_MODE) is met. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'approve', 'Your role cannot approve price lists.');

$data = request_json();
$version = find_reviewable_version($user, clean_text($data['id'] ?? '', 32));
$remarks = clean_text($data['remarks'] ?? '', 500);
$label = version_label($version);
$submitter = (string) ($version['savedByUser'] ?? '');

$version['approvals'][] = ['username' => $user['username'], 'name' => $user['name'], 'at' => gmdate('c'), 'remarks' => $remarks];
$complete = approval_complete($version);
if ($complete) {
    $version['status'] = 'approved';
    $version['approvedAt'] = gmdate('c');
    $version['approvedBy'] = implode(' & ', array_map(fn($a) => $a['name'], $version['approvals']));
}
repo_save_version($version);

// This approver has acted; once fully approved, nobody's "Approval needed" is outstanding.
if ($complete) repo_resolve_notifications($version['id'], ['approval_request']);
else repo_mark_notifications_read($user['username'], array_column(array_filter(repo_list_notifications($user['username'], 200),
    fn($n) => ($n['versionId'] ?? '') === $version['id'] && ($n['type'] ?? '') === 'approval_request'), 'id'));

if ($complete) {
    supersede_older_approved($version);
    record_audit('approve_version', "Approved '{$version['name']}'", "{$user['name']} approved {$label}. It is now available for export." . ($remarks !== '' ? " Remarks: {$remarks}" : ''), [
        'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'remarks' => $remarks,
    ]);
    notify([$submitter], 'approved', "Approved: {$version['name']}", "{$user['name']} approved {$label}. It is ready for export.", $version['id']);
    // Everyone who exports hears it's ready, except the submitter, who already got "Approved".
    notify(array_diff(usernames_with_permission('export'), [$submitter]), 'available', "Ready for export: {$version['name']}", "{$label} was approved and is available for export.", $version['id']);
    $message = 'Price list approved and available for export.';
} else {
    $waiting = array_diff($version['requiredApprovers'], array_map(fn($a) => $a['username'], $version['approvals']));
    record_audit('approve_version', "Approved '{$version['name']}' (partial)", "{$user['name']} approved {$label}. Still waiting for " . implode(' & ', array_map('user_display_name', $waiting)) . '.', [
        'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'remarks' => $remarks,
    ]);
    notify([$submitter], 'partial_approval', "Partially approved: {$version['name']}", "{$user['name']} approved {$label}. Waiting for the remaining approver(s).", $version['id']);
    $message = 'Approval recorded. Waiting for the remaining approver(s).';
}
json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => $message]);
