<?php
declare(strict_types=1);
/**
 * Price list versions and the approval workflow.
 *
 *   source  'upload' – a file as uploaded: live at once, no approval needed
 *           'change' – edited prices: pending → approved | rejected
 *   status  uploaded | pending | approved | rejected | superseded
 */

require_once __DIR__ . '/users.php';
require_once __DIR__ . '/../repository/store.php';

function is_auto_approver(string $username): bool
{
    return in_array($username, AUTO_APPROVE_USERS, true);
}

/** Approvers for a submitter, never including the submitter. Auto-approving users need none. */
function approvers_for(string $submitter): array
{
    if (is_auto_approver($submitter)) return [];
    $configured = APPROVERS[$submitter] ?? null;
    $list = is_array($configured) && $configured ? $configured : usernames_with_permission('approve');
    return array_values(array_unique(array_filter(
        array_map('strval', $list),
        fn(string $name) => $name !== $submitter && ($record = find_user_by_username($name)) && in_array('approve', ROLE_PERMISSIONS[$record['roleName']] ?? [], true)
    )));
}

/** A price list is identified by name + country + price level, so one country can hold several price levels. */
function same_price_list(array $a, array $b): bool
{
    $norm = fn($value) => mb_strtolower(preg_replace('/\s+/u', ' ', trim((string) $value)));
    return $norm($a['name'] ?? '') === $norm($b['name'] ?? '')
        && $norm($a['country'] ?? '') === $norm($b['country'] ?? '')
        && $norm($a['priceLevel'] ?? '') === $norm($b['priceLevel'] ?? '');
}

const VERSION_SUMMARY_KEYS = [
    'id', 'name', 'priceLevel', 'country', 'revision', 'status', 'adjustment', 'categoryAdjustments', 'summary',
    'savedAt', 'savedBy', 'savedByUser', 'requiredApprovers', 'approvals', 'approvedAt', 'approvedBy',
    'rejectedAt', 'rejectedBy', 'rejectionRemarks', 'productCount', 'categories', 'changeCount', 'source', 'basedOn',
];

function version_summary(array $version): array
{
    $summary = array_intersect_key($version, array_flip(VERSION_SUMMARY_KEYS));
    if (!isset($summary['productCount'])) $summary['productCount'] = is_array($version['rows'] ?? null) ? count($version['rows']) : 0;
    return $summary;
}

/** Normalises records written by older builds so every version has workflow fields. */
function normalize_version(array $version): array
{
    $version['status'] = in_array($version['status'] ?? '', ['uploaded', 'pending', 'approved', 'rejected', 'superseded'], true) ? $version['status'] : 'pending';
    if (($version['source'] ?? '') !== 'upload') {
        // Records saved before uploads and changes were separated: a list with no parent, no adjustments
        // and no cell edits is an unmodified upload.
        $adjusted = $version['summary']['adjustedCategories'] ?? [];
        $isUpload = !$adjusted && empty($version['basedOn']) && (int) ($version['changeCount'] ?? 0) === 0 && (float) ($version['adjustment'] ?? 0) === 0.0;
        $version['source'] = $isUpload ? 'upload' : 'change';
        if ($isUpload && in_array($version['status'], ['pending', 'approved', 'rejected'], true)) $version['status'] = 'uploaded';
    }
    $version['source'] = $version['source'] === 'upload' ? 'upload' : 'change';
    $version['revision'] = max(1, (int) ($version['revision'] ?? 1));
    $version['priceLevel'] = (string) ($version['priceLevel'] ?? '');
    $version['country'] = (string) ($version['country'] ?? '');
    $version['savedByUser'] = (string) ($version['savedByUser'] ?? '');
    $version['approvals'] = is_array($version['approvals'] ?? null) ? array_values($version['approvals']) : [];
    if ($version['source'] === 'upload') {
        $version['requiredApprovers'] = [];
    } elseif (!is_array($version['requiredApprovers'] ?? null) || !$version['requiredApprovers']) {
        $version['requiredApprovers'] = $version['savedByUser'] !== '' ? approvers_for($version['savedByUser']) : usernames_with_permission('approve');
    }
    if (!isset($version['productCount']) && is_array($version['rows'] ?? null)) $version['productCount'] = count($version['rows']);
    return $version;
}

function can_user_approve(array $user, array $version): bool
{
    if (!user_can($user, 'approve')) return false;
    if (($version['status'] ?? '') !== 'pending') return false;
    if (($version['savedByUser'] ?? '') === $user['username']) return false;
    if (!in_array($user['username'], $version['requiredApprovers'] ?? [], true)) return false;
    foreach ($version['approvals'] ?? [] as $approval) {
        if (($approval['username'] ?? '') === $user['username']) return false;
    }
    return true;
}

function approval_complete(array $version): bool
{
    $approved = array_map(fn($a) => (string) ($a['username'] ?? ''), $version['approvals'] ?? []);
    $required = $version['requiredApprovers'] ?? [];
    if (!$required) return count($approved) > 0;
    if (APPROVAL_MODE === 'all') return !array_diff($required, $approved);
    return (bool) array_intersect($required, $approved);
}

function version_visible_to(array $user, array $version): bool
{
    if (user_can($user, 'update')) return true;
    // Export-only users see live lists: approved changes and uploaded files.
    return in_array($version['status'] ?? '', ['approved', 'uploaded'], true);
}

function is_exportable(array $version): bool
{
    return in_array($version['status'] ?? '', ['approved', 'uploaded'], true);
}

function version_label(array $version): string
{
    $parts = [$version['name'] ?? 'Price list'];
    $meta = array_filter([$version['priceLevel'] ?? '', $version['country'] ?? '']);
    if ($meta) $parts[] = '(' . implode(' · ', $meta) . ')';
    if (($version['revision'] ?? 1) > 1) $parts[] = 'rev ' . $version['revision'];
    return implode(' ', $parts);
}

function version_for_client(array $user, array $version): array
{
    $version['canApprove'] = can_user_approve($user, $version);
    $version['approverNames'] = array_map('user_display_name', $version['requiredApprovers'] ?? []);
    return $version;
}

/**
 * Once a newer revision is live (approved changes or a fresh upload), earlier live revisions of the same
 * price list (approved or uploaded) are marked superseded.
 */
function supersede_older_approved(array $version): void
{
    foreach (repo_list_version_summaries() as $other) {
        if ($other['id'] !== $version['id'] && in_array($other['status'], ['approved', 'uploaded'], true) && same_price_list($other, $version)) {
            $previous = repo_get_version($other['id']);
            if ($previous) {
                $previous['status'] = 'superseded';
                repo_save_version($previous);
            }
        }
    }
    repo_prune_superseded($version);
}
