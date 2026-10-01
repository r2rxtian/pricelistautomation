<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

const CLIENT_AUDIT_TYPES = ['import_workbook', 'price_adjust', 'cell_edit', 'reset_prices'];

function delete_managed_group_image(string $relativePath): void
{
    if (!str_starts_with(str_replace('\\', '/', $relativePath), 'storage/product-images/')) return;
    $root = realpath(__DIR__ . '/storage/product-images');
    $target = realpath(__DIR__ . '/' . ltrim(str_replace('\\', '/', $relativePath), '/'));
    if (!$root || !$target || !str_starts_with($target, $root . DIRECTORY_SEPARATOR)) return;
    if (is_file($target)) @unlink($target);
}

const LIBRARY_DIR = 'storage/product-library';

/** Turns $_FILES entries (single or multiple) into a flat list of upload arrays. */
function normalize_uploaded_files(mixed $entry): array
{
    if (!is_array($entry) || !isset($entry['name'])) return [];
    if (!is_array($entry['name'])) return [$entry];
    $files = [];
    foreach (array_keys($entry['name']) as $index) {
        $files[] = [
            'name' => $entry['name'][$index] ?? '',
            'tmp_name' => $entry['tmp_name'][$index] ?? '',
            'size' => $entry['size'][$index] ?? 0,
            'error' => $entry['error'][$index] ?? UPLOAD_ERR_NO_FILE,
        ];
    }
    return $files;
}

/** Validates one uploaded image, stores it in the photo library and returns its record. */
function store_library_photo(array $file, array $user): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) throw new InvalidArgumentException('The upload did not complete.');
    $size = (int) ($file['size'] ?? 0);
    if ($size < 1 || $size > 6 * 1024 * 1024) throw new InvalidArgumentException('Images must be smaller than 6 MB.');
    $temporaryPath = (string) ($file['tmp_name'] ?? '');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath) ?: '';
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime])) throw new InvalidArgumentException('Use a JPG, PNG, or WebP image.');
    $dimensions = @getimagesize($temporaryPath);
    if (!$dimensions || $dimensions[0] < 120 || $dimensions[1] < 120 || $dimensions[0] > 6000 || $dimensions[1] > 6000) {
        throw new InvalidArgumentException('Images must be between 120 and 6,000 pixels in each direction.');
    }
    $directory = __DIR__ . '/' . LIBRARY_DIR;
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the photo library directory.');
    }
    $id = bin2hex(random_bytes(8));
    $filename = $id . '.' . $extensions[$mime];
    if (!move_uploaded_file($temporaryPath, $directory . DIRECTORY_SEPARATOR . $filename)) {
        throw new RuntimeException('Unable to store the uploaded image.');
    }
    $name = clean_text(preg_replace('/\.[^.]+$/', '', basename((string) ($file['name'] ?? 'Photo'))) ?: 'Photo', 200);
    $photo = [
        'id' => $id,
        'name' => $name,
        'imagePath' => LIBRARY_DIR . '/' . $filename,
        'width' => (int) $dimensions[0],
        'height' => (int) $dimensions[1],
        'size' => $size,
        'uploadedAt' => gmdate('c'),
        'uploadedBy' => $user['name'],
    ];
    try {
        repo_add_library_photo($photo);
    } catch (Throwable $error) {
        @unlink($directory . DIRECTORY_SEPARATOR . $filename);
        throw $error;
    }
    return $photo;
}

function delete_library_file(string $relativePath): void
{
    if (!str_starts_with(str_replace('\\', '/', $relativePath), LIBRARY_DIR . '/')) return;
    $root = realpath(__DIR__ . '/' . LIBRARY_DIR);
    $target = realpath(__DIR__ . '/' . ltrim(str_replace('\\', '/', $relativePath), '/'));
    if (!$root || !$target || !str_starts_with($target, $root . DIRECTORY_SEPARATOR)) return;
    if (is_file($target)) @unlink($target);
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

function directory_payload(): array
{
    $users = [];
    foreach (USERS as $email => $record) {
        $users[] = ['username' => (string) $record['username'], 'name' => (string) $record['name'], 'role' => (string) $record['role']];
    }
    return $users;
}

function notifications_payload(array $user): array
{
    $items = repo_list_notifications($user['username'], 100);
    return [
        'notifications' => $items,
        'unreadCount' => count(array_filter($items, fn($n) => empty($n['read']))),
    ];
}

function version_for_client(array $user, array $version): array
{
    $version['canApprove'] = can_user_approve($user, $version);
    $version['approverNames'] = array_map('user_display_name', $version['requiredApprovers'] ?? []);
    return $version;
}

function clean_number(mixed $value, float $min, float $max): ?float
{
    $number = filter_var($value, FILTER_VALIDATE_FLOAT);
    if ($number === false || $number < $min || $number > $max) return null;
    return (float) $number;
}

function find_open_version(array $user, string $id): array
{
    $version = repo_get_version($id);
    if (!$version || !version_visible_to($user, $version)) {
        json_response(['ok' => false, 'message' => 'Price list not found or not available to your account.'], 404);
    }
    return $version;
}

try {
    if ($action === 'login') {
        $data = request_json();
        // Biometrics ID from the master list (e.g. 1652) for employees; email for other accounts.
        $login = clean_text($data['login'] ?? $data['email'] ?? '', 120);
        $password = (string) ($data['password'] ?? '');
        try {
            $record = authenticate_login($login, $password);
        } catch (MasterListUnavailable $error) {
            error_log('Sign-in: ' . $error->getMessage());
            json_response(['ok' => false, 'message' => "Can't reach the employee master list right now, so biometrics sign-in is unavailable. Please try again shortly."], 503);
        }
        if (!$record) {
            json_response(['ok' => false, 'message' => 'Incorrect biometrics ID or password.'], 422);
        }
        session_regenerate_id(true);
        $user = public_user($record);
        $_SESSION['user'] = ['username' => $user['username']];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        record_audit('login', "{$user['name']} signed in", '', [], $user);
        json_response(['ok' => true, 'user' => $user, 'permissions' => user_permissions($user), 'csrf' => $_SESSION['csrf']]);
    }

    if ($action === 'logout') {
        require_user();
        require_csrf();
        $_SESSION = [];
        session_destroy();
        json_response(['ok' => true]);
    }

    $user = require_user();

    if ($action === 'state') {
        $versions = array_values(array_filter(repo_list_version_summaries(), fn($v) => version_visible_to($user, $v)));
        $versions = array_map(fn($v) => version_for_client($user, $v), $versions);
        json_response([
            'ok' => true,
            'user' => $user,
            'permissions' => user_permissions($user),
            'csrf' => $_SESSION['csrf'],
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
    }

    if ($action === 'dev-reset') {
        require_csrf();
        if (!DEV_TOOLS_ENABLED) json_response(['ok' => false, 'message' => 'Developer tools are disabled.'], 403);
        require_permission($user, 'update', 'Only price list administrators can clear test data.');
        $targets = array_values(array_intersect(['versions', 'audit', 'notifications', 'images'], (array) (request_json()['targets'] ?? [])));
        if (!$targets) json_response(['ok' => false, 'message' => 'Choose what to clear.'], 422);
        $cleared = [];
        foreach ($targets as $target) {
            $cleared[$target] = repo_dev_clear($target);
            if ($target === 'images') {
                $cleared['images'] += repo_dev_clear('library');
                foreach (array_merge(glob(__DIR__ . '/storage/product-images/*') ?: [], glob(__DIR__ . '/' . LIBRARY_DIR . '/*') ?: []) as $file) {
                    if (is_file($file)) @unlink($file);
                }
            }
        }
        $labels = ['versions' => 'saved price lists', 'audit' => 'audit log entries', 'notifications' => 'notifications', 'images' => 'product photos'];
        $summary = implode(', ', array_map(fn($t) => "{$cleared[$t]} {$labels[$t]}", $targets));
        // Always leave a trace, even when the audit log itself was wiped.
        record_audit('dev_reset', 'Cleared test data', "{$user['name']} used developer tools to clear: {$summary}.", ['cleared' => $cleared]);
        json_response(['ok' => true, 'cleared' => $cleared, 'message' => "Cleared {$summary}."]);
    }

    if ($action === 'open') {
        $version = find_open_version($user, clean_text(request_json()['id'] ?? '', 32));
        json_response(['ok' => true, 'active' => version_for_client($user, $version)]);
    }

    if ($action === 'save') {
        require_csrf();
        require_permission($user, 'save', 'Your role cannot save price lists.');
        $data = request_json();
        $name = clean_text($data['name'] ?? '', 160);
        $priceLevelInput = clean_text($data['priceLevel'] ?? '', 120);
        $countryInput = clean_text($data['country'] ?? '', 120);
        if ($name === '' || $priceLevelInput === '' || $countryInput === '') {
            json_response(['ok' => false, 'message' => 'Enter the price list name, price level, and country.'], 422);
        }
        // Countries come from the configured list, so "philippines" and "Philippines" are the same record.
        $country = canonical_country($countryInput);
        if ($country === null) {
            json_response(['ok' => false, 'message' => "\"{$countryInput}\" is not in the country list. Choose a country from the dropdown."], 422);
        }
        // Price levels are numbered (Price Level 1, 2, …).
        $priceLevel = canonical_price_level($priceLevelInput);
        if ($priceLevel === null) {
            json_response(['ok' => false, 'message' => "\"{$priceLevelInput}\" is not a valid price level. Choose Price Level 1 to " . count(PRICE_LEVELS) . '.'], 422);
        }

        $headers = $data['headers'] ?? [];
        $rows = $data['rows'] ?? [];
        $priceColumns = $data['priceColumns'] ?? [];
        if (!is_array($headers) || !is_array($rows) || !is_array($priceColumns) || !$rows || count($rows) > 15000) {
            json_response(['ok' => false, 'message' => 'The imported workbook data is invalid or too large.'], 422);
        }
        $headers = array_map(fn($value) => clean_text($value, 120), array_slice(array_values($headers), 0, 80));
        $width = count($headers);
        $adjustment = clean_number($data['adjustment'] ?? 0, -100, 10000);
        if ($width === 0 || $adjustment === null) {
            json_response(['ok' => false, 'message' => 'Check the headers and percentage.'], 422);
        }
        $priceColumns = array_values(array_unique(array_filter(array_map('intval', $priceColumns), fn($i) => $i >= 0 && $i < $width)));
        if (!$priceColumns) json_response(['ok' => false, 'message' => 'No price columns were detected.'], 422);

        $categoryAdjustments = [];
        foreach (is_array($data['categoryAdjustments'] ?? null) ? $data['categoryAdjustments'] : [] as $category => $value) {
            $key = clean_text((string) $category, 120);
            $number = clean_number($value, -100, 10000);
            if ($key !== '' && $number !== null) $categoryAdjustments[$key] = $number;
        }

        $cleanRows = [];
        $categories = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $clean = [];
            for ($i = 0; $i < $width; $i++) {
                $value = $row[$i] ?? '';
                $clean[] = (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value) && in_array($i, $priceColumns, true)))
                    ? (float) $value
                    : clean_text($value, 500);
            }
            $cleanRows[] = $clean;
            if ($clean[0] !== '') $categories[(string) $clean[0]] = ($categories[(string) $clean[0]] ?? 0) + 1;
        }

        $adjustedCategories = [];
        $adjustedProducts = 0;
        foreach ($categories as $category => $count) {
            $rate = $categoryAdjustments[$category] ?? $adjustment;
            if ((float) $rate !== 0.0) {
                $adjustedCategories[] = ['category' => $category, 'adjustment' => $rate, 'productCount' => $count];
                $adjustedProducts += $count;
            }
        }

        $changes = [];
        foreach (array_slice(is_array($data['changes'] ?? null) ? $data['changes'] : [], 0, 1000) as $change) {
            if (!is_array($change)) continue;
            $changes[] = [
                'code' => clean_text($change['code'] ?? '', 80),
                'product' => clean_text($change['product'] ?? '', 200),
                'category' => clean_text($change['category'] ?? '', 120),
                'column' => clean_text($change['column'] ?? '', 120),
                'oldValue' => clean_text($change['oldValue'] ?? '', 200),
                'newValue' => clean_text($change['newValue'] ?? '', 200),
            ];
        }

        $summaries = repo_list_version_summaries();
        // Same price list = same name, country and price level (one country can have several price levels).
        $identity = ['name' => $name, 'country' => $country, 'priceLevel' => $priceLevel];
        $sameName = array_values(array_filter($summaries, fn($v) => same_price_list($v, $identity)));

        // Uploads are stored as-is (original prices) and need no approval; only later price changes do.
        if (($data['kind'] ?? '') === 'upload') {
            $revision = 1;
            foreach ($sameName as $summary) $revision = max($revision, (int) $summary['revision'] + 1);
            $version = [
                'id' => bin2hex(random_bytes(8)),
                'source' => 'upload',
                'name' => $name,
                'priceLevel' => $priceLevel,
                'country' => $country,
                'revision' => $revision,
                'status' => 'uploaded',
                'headers' => $headers,
                'rows' => $cleanRows,
                'priceColumns' => $priceColumns,
                'adjustment' => 0.0,
                'categoryAdjustments' => [],
                'summary' => ['totalProducts' => count($cleanRows), 'totalAdjustedProducts' => 0, 'adjustedCategories' => []],
                'changes' => [],
                'changeCount' => 0,
                'productCount' => count($cleanRows),
                'categories' => array_keys($categories),
                'savedAt' => gmdate('c'),
                'savedBy' => $user['name'],
                'savedByUser' => $user['username'],
                'requiredApprovers' => [],
                'approvals' => [],
                'approvedAt' => null,
                'approvedBy' => null,
                'rejectedAt' => null,
                'rejectedBy' => null,
                'rejectionRemarks' => null,
                'basedOn' => null,
            ];
            repo_save_version($version);
            supersede_older_approved($version);
            $label = version_label($version);
            record_audit('import_workbook', "Uploaded '{$name}'", "{$user['name']} uploaded {$label}: " . count($cleanRows) . ' products across ' . count($categories) . ' categories.', [
                'versionId' => $version['id'], 'versionName' => $name, 'fileName' => $name, 'revision' => $revision,
                'priceLevel' => $priceLevel, 'country' => $country, 'rowCount' => count($cleanRows), 'categoryCount' => count($categories),
                'sourceFile' => clean_text($data['sourceFile'] ?? '', 200),
            ]);
            notify(usernames_with_permission('export'), 'available', "New price list: {$name}", "{$user['name']} uploaded {$label}. It is available to open and export.", $version['id']);
            json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => "Uploaded {$name}."]);
        }

        // Price changes: update an unapproved change in place, or open a new revision for approval.
        $targetId = clean_text($data['id'] ?? '', 32);
        $base = null;
        foreach ($summaries as $summary) {
            if ($targetId !== '' && $summary['id'] === $targetId) $base = $summary;
        }
        if (!$base && $sameName) $base = $sameName[0];

        $inPlace = $base && in_array($base['status'], ['pending', 'rejected'], true);
        $revision = 1;
        foreach ($sameName as $summary) $revision = max($revision, (int) $summary['revision'] + ($inPlace ? 0 : 1));
        if ($inPlace) $revision = (int) $base['revision'];

        $version = [
            'id' => $inPlace ? $base['id'] : bin2hex(random_bytes(8)),
            'source' => 'change',
            'name' => $name,
            'priceLevel' => $priceLevel,
            'country' => $country,
            'revision' => $revision,
            'status' => 'pending',
            'headers' => $headers,
            'rows' => $cleanRows,
            'priceColumns' => $priceColumns,
            'adjustment' => $adjustment,
            'categoryAdjustments' => $categoryAdjustments,
            'summary' => [
                'totalProducts' => count($cleanRows),
                'totalAdjustedProducts' => $adjustedProducts,
                'adjustedCategories' => $adjustedCategories,
            ],
            'changes' => $changes,
            'changeCount' => count($changes),
            'productCount' => count($cleanRows),
            'categories' => array_keys($categories),
            'savedAt' => gmdate('c'),
            'savedBy' => $user['name'],
            'savedByUser' => $user['username'],
            'requiredApprovers' => approvers_for($user['username']),
            'approvals' => [],
            'approvedAt' => null,
            'approvedBy' => null,
            'rejectedAt' => null,
            'rejectedBy' => null,
            'rejectionRemarks' => null,
            'basedOn' => $base['id'] ?? null,
        ];
        // Top approvers (e.g. Ms. Gen) publish directly: their saves are approved on the spot.
        $autoApproved = is_auto_approver($user['username']);
        if ($autoApproved) {
            $version['status'] = 'approved';
            $version['approvals'] = [['username' => $user['username'], 'name' => $user['name'], 'at' => gmdate('c'), 'remarks' => 'Approved on save', 'auto' => true]];
            $version['approvedAt'] = gmdate('c');
            $version['approvedBy'] = $user['name'];
        }
        repo_save_version($version);
        if ($autoApproved) supersede_older_approved($version);

        $label = version_label($version);
        $adjustText = $adjustedCategories
            ? implode(', ', array_map(fn($c) => "{$c['category']} " . ($c['adjustment'] > 0 ? '+' : '') . "{$c['adjustment']}%", $adjustedCategories))
            : 'original prices';
        $auditMeta = [
            'versionId' => $version['id'], 'versionName' => $name, 'fileName' => $name, 'revision' => $revision,
            'priceLevel' => $priceLevel, 'country' => $country, 'adjustedCategories' => $adjustedCategories,
            'changeCount' => count($changes), 'approvers' => array_map('user_display_name', $version['requiredApprovers']),
        ];

        if ($autoApproved) {
            record_audit('save_version', "Saved '{$name}' (approved)", "{$label} saved and approved by {$user['name']} with {$adjustText}; " . count($changes) . ' cell edit(s). Available for export.', $auditMeta + ['autoApproved' => true]);
            notify(usernames_with_permission('export'), 'available', "Ready for export: {$name}", "{$user['name']} saved and approved {$label}. It is available for export.", $version['id']);
            json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => 'Saved and approved. It is ready for export.']);
        }

        record_audit('save_version', "Saved '{$name}' for approval", "{$label} saved by {$user['name']} with {$adjustText}; " . count($changes) . ' cell edit(s). Awaiting approval.', $auditMeta);
        notify($version['requiredApprovers'], 'approval_request', "Approval needed: {$name}",
            "{$user['name']} saved {$label} and needs your approval before it can be exported.", $version['id']);

        $approverNames = implode(' & ', array_map('user_display_name', $version['requiredApprovers']));
        json_response([
            'ok' => true,
            'active' => version_for_client($user, $version),
            'message' => $approverNames !== '' ? "Saved and sent to {$approverNames} for approval." : 'Saved. Awaiting approval.',
        ]);
    }

    if ($action === 'approve' || $action === 'reject') {
        require_csrf();
        require_permission($user, 'approve', 'Your role cannot approve price lists.');
        $data = request_json();
        $version = repo_get_version(clean_text($data['id'] ?? '', 32));
        if (!$version) json_response(['ok' => false, 'message' => 'Price list not found.'], 404);
        if (!can_user_approve($user, $version)) {
            $reason = ($version['savedByUser'] ?? '') === $user['username']
                ? 'You cannot approve or reject a price list you saved yourself.'
                : (($version['status'] ?? '') !== 'pending' ? 'This price list is no longer awaiting approval.' : 'You are not an assigned approver for this price list.');
            json_response(['ok' => false, 'message' => $reason], 403);
        }
        $remarks = clean_text($data['remarks'] ?? '', 500);
        $label = version_label($version);
        $submitter = (string) ($version['savedByUser'] ?? '');

        if ($action === 'reject') {
            if ($remarks === '') json_response(['ok' => false, 'message' => 'Enter the reason for rejecting this price list.'], 422);
            $version['status'] = 'rejected';
            $version['rejectedAt'] = gmdate('c');
            $version['rejectedBy'] = $user['name'];
            $version['rejectionRemarks'] = $remarks;
            repo_save_version($version);
            record_audit('reject_version', "Rejected '{$version['name']}'", "{$user['name']} rejected {$label}: {$remarks}", [
                'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'remarks' => $remarks,
            ]);
            notify([$submitter], 'rejected', "Rejected: {$version['name']}", "{$user['name']} rejected {$label}. Reason: {$remarks}", $version['id']);
            json_response(['ok' => true, 'active' => version_for_client($user, $version), 'message' => 'Price list rejected. The submitter has been notified.']);
        }

        $version['approvals'][] = ['username' => $user['username'], 'name' => $user['name'], 'at' => gmdate('c'), 'remarks' => $remarks];
        $complete = approval_complete($version);
        if ($complete) {
            $version['status'] = 'approved';
            $version['approvedAt'] = gmdate('c');
            $version['approvedBy'] = implode(' & ', array_map(fn($a) => $a['name'], $version['approvals']));
        }
        repo_save_version($version);

        if ($complete) {
            supersede_older_approved($version);
            record_audit('approve_version', "Approved '{$version['name']}'", "{$user['name']} approved {$label}. It is now available for export." . ($remarks !== '' ? " Remarks: {$remarks}" : ''), [
                'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'remarks' => $remarks,
            ]);
            notify([$submitter], 'approved', "Approved: {$version['name']}", "{$user['name']} approved {$label}. It is ready for export.", $version['id']);
            notify(usernames_with_permission('export'), 'available', "Ready for export: {$version['name']}", "{$label} was approved and is available for export.", $version['id']);
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
    }

    if ($action === 'export') {
        require_csrf();
        require_permission($user, 'export', 'Your role cannot export price lists.');
        $data = request_json();
        $format = in_array($data['format'] ?? '', ['excel', 'pdf'], true) ? $data['format'] : null;
        if (!$format) json_response(['ok' => false, 'message' => 'Choose Excel or PDF.'], 422);
        $version = find_open_version($user, clean_text($data['id'] ?? '', 32));
        if (!is_exportable($version)) {
            json_response(['ok' => false, 'message' => 'Only uploaded files and approved price changes can be exported.'], 403);
        }
        $scope = clean_text($data['scope'] ?? '', 200);
        record_audit('export_' . $format, "Exported '{$version['name']}' to " . ($format === 'pdf' ? 'PDF' : 'Excel'),
            "{$user['name']} exported " . version_label($version) . ($scope !== '' ? " ({$scope})" : '') . '.', [
                'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'], 'format' => $format, 'scope' => $scope,
            ]);
        json_response(['ok' => true, 'version' => $version]);
    }

    if ($action === 'delete-version') {
        require_csrf();
        require_permission($user, 'update', 'Only price list administrators can delete saved versions.');
        $version = repo_get_version(clean_text(request_json()['id'] ?? '', 32));
        if (!$version) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
        if (!repo_delete_version($version['id'])) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
        record_audit('delete_version', "Deleted '{$version['name']}'", "{$user['name']} deleted " . version_label($version) . " ({$version['status']}).", [
            'versionId' => $version['id'], 'versionName' => $version['name'], 'fileName' => $version['name'],
        ]);
        json_response(['ok' => true, 'message' => 'Saved version deleted.']);
    }

    if ($action === 'log-activity') {
        require_csrf();
        require_permission($user, 'update', 'Permission denied.');
        $data = request_json();
        $type = clean_text($data['type'] ?? '', 40);
        if (!in_array($type, CLIENT_AUDIT_TYPES, true)) json_response(['ok' => false, 'message' => 'Unknown activity type.'], 422);
        $metadata = [];
        foreach (is_array($data['metadata'] ?? null) ? $data['metadata'] : [] as $key => $value) {
            $key = clean_text((string) $key, 40);
            if ($key === '') continue;
            $metadata[$key] = is_array($value)
                ? array_slice(array_map(fn($v) => is_scalar($v) ? clean_text($v, 200) : '', $value), 0, 100)
                : (is_bool($value) || is_int($value) || is_float($value) ? $value : clean_text($value, 300));
        }
        $log = record_audit($type, clean_text($data['title'] ?? 'Price list activity', 300), clean_text($data['details'] ?? '', 1000), $metadata);
        json_response(['ok' => true, 'log' => $log]);
    }

    if ($action === 'audit-logs') {
        require_permission($user, 'viewAudit', 'Your role cannot view audit logs.');
        json_response(['ok' => true, 'auditLogs' => repo_list_audit(1000)]);
    }

    if ($action === 'notifications') {
        json_response(['ok' => true] + notifications_payload($user));
    }

    if ($action === 'notifications-read') {
        require_csrf();
        $ids = request_json()['ids'] ?? null;
        repo_mark_notifications_read($user['username'], is_array($ids) ? array_map('strval', $ids) : null);
        json_response(['ok' => true] + notifications_payload($user));
    }

    if ($action === 'library-upload') {
        require_csrf();
        require_permission($user, 'manageImages', 'You do not have permission to manage product photos.');
        $files = normalize_uploaded_files($_FILES['images'] ?? null);
        if (!$files) json_response(['ok' => false, 'message' => 'Choose one or more JPG, PNG, or WebP images.'], 422);
        if (count($files) > 40) json_response(['ok' => false, 'message' => 'Upload at most 40 photos at a time.'], 422);
        $added = [];
        $errors = [];
        foreach ($files as $file) {
            try {
                $added[] = store_library_photo($file, $user);
            } catch (InvalidArgumentException $error) {
                $errors[] = ($file['name'] ?? 'Image') . ': ' . $error->getMessage();
            }
        }
        if ($added) {
            record_audit('image_update', 'Added ' . count($added) . ' photo' . (count($added) === 1 ? '' : 's') . ' to the library',
                "{$user['name']} uploaded " . implode(', ', array_map(fn($p) => $p['name'], array_slice($added, 0, 10))) . (count($added) > 10 ? '…' : '') . '.',
                ['count' => count($added)]);
        }
        $message = $added ? count($added) . ' photo' . (count($added) === 1 ? '' : 's') . ' added to the library.' : 'No photos were added.';
        if ($errors) $message .= ' ' . count($errors) . ' skipped.';
        json_response(['ok' => (bool) $added, 'photos' => $added, 'errors' => $errors, 'message' => $message], $added ? 200 : 422);
    }

    if ($action === 'library-delete') {
        require_csrf();
        require_permission($user, 'manageImages', 'You do not have permission to manage product photos.');
        $id = clean_text(request_json()['id'] ?? '', 32);
        $photo = repo_delete_library_photo($id);
        if (!$photo) json_response(['ok' => false, 'message' => 'Photo not found.'], 404);
        // Product types that used this photo fall back to "no photo".
        $unassigned = 0;
        foreach (repo_list_images() as $image) {
            if (($image['libraryId'] ?? '') === $id) {
                repo_delete_image((string) $image['key']);
                $unassigned++;
            }
        }
        delete_library_file((string) $photo['imagePath']);
        record_audit('image_delete', "Deleted library photo '{$photo['name']}'", "{$user['name']} deleted a library photo" . ($unassigned ? " used by {$unassigned} product type(s)." : '.'), ['unassigned' => $unassigned]);
        json_response(['ok' => true, 'unassigned' => $unassigned, 'message' => 'Photo deleted' . ($unassigned ? " and removed from {$unassigned} product type(s)." : '.')]);
    }

    if ($action === 'assign-group-image' || $action === 'upload-group-image') {
        require_csrf();
        require_permission($user, 'manageImages', 'You do not have permission to manage product images.');
        $input = $action === 'assign-group-image' ? request_json() : $_POST;
        $category = clean_text($input['category'] ?? '', 120);
        $groupName = clean_text($input['groupName'] ?? '', 300);
        if ($category === '' || $groupName === '') json_response(['ok' => false, 'message' => 'Choose a category and product type.'], 422);

        if ($action === 'upload-group-image') {
            // Direct upload: the file also goes into the library so it can be reused.
            $files = normalize_uploaded_files($_FILES['image'] ?? null);
            if (!$files) json_response(['ok' => false, 'message' => 'Choose a valid image file.'], 422);
            try {
                $photo = store_library_photo($files[0], $user);
            } catch (InvalidArgumentException $error) {
                json_response(['ok' => false, 'message' => $error->getMessage()], 422);
            }
        } else {
            $photo = repo_get_library_photo(clean_text($input['libraryId'] ?? '', 32));
            if (!$photo) json_response(['ok' => false, 'message' => 'That photo is no longer in the library.'], 404);
        }

        $record = [
            'key' => hash('sha256', mb_strtolower($category) . "\0" . mb_strtolower($groupName)),
            'category' => $category,
            'groupName' => $groupName,
            'imagePath' => $photo['imagePath'],
            'libraryId' => $photo['id'],
            'altText' => $groupName . ' product image',
            'updatedAt' => gmdate('c'),
            'updatedBy' => $user['name'],
        ];
        $previous = repo_upsert_image($record);
        // Older direct uploads lived outside the library; remove those files when replaced.
        $oldPath = (string) ($previous['imagePath'] ?? '');
        if ($oldPath !== '' && $oldPath !== $record['imagePath']) delete_managed_group_image($oldPath);
        record_audit('image_update', "Set photo for '{$groupName}'", "{$user['name']} set the {$category} / {$groupName} photo to '{$photo['name']}'.", [
            'category' => $category, 'groupName' => $groupName, 'photo' => $photo['name'],
        ]);
        json_response(['ok' => true, 'image' => $record, 'photo' => $photo, 'message' => 'Product photo updated.']);
    }

    if ($action === 'delete-group-image') {
        require_csrf();
        require_permission($user, 'manageImages', 'You do not have permission to manage product images.');
        $key = clean_text(request_json()['key'] ?? '', 64);
        if (!preg_match('/^[a-f0-9]{64}$/', $key)) {
            json_response(['ok' => false, 'message' => 'Invalid product image key.'], 422);
        }
        $record = repo_delete_image($key);
        if (!$record) json_response(['ok' => false, 'message' => 'Custom image not found.'], 404);
        delete_managed_group_image((string) ($record['imagePath'] ?? ''));
        record_audit('image_delete', "Removed photo for '" . ($record['groupName'] ?? 'product type') . "'", "{$user['name']} removed a custom product type photo.", [
            'category' => $record['category'] ?? '', 'groupName' => $record['groupName'] ?? '',
        ]);
        json_response(['ok' => true, 'message' => 'Custom photo removed successfully.']);
    }

    json_response(['ok' => false, 'message' => 'Unknown API action.'], 404);
} catch (Throwable $error) {
    error_log($error->__toString());
    json_response(['ok' => false, 'message' => 'The server could not complete the request.'], 500);
}
