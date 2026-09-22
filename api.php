<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

try {
    if ($action === 'login') {
        $data = request_json();
        $email = strtolower(clean_text($data['email'] ?? '', 120));
        $password = (string) ($data['password'] ?? '');
        $record = USERS[$email] ?? null;
        if (!$record || !hash_equals($record['password'], $password)) {
            json_response(['ok' => false, 'message' => 'Incorrect email or password.'], 422);
        }
        session_regenerate_id(true);
        $_SESSION['user'] = ['email' => $email, 'name' => $record['name'], 'role' => $record['role']];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        json_response(['ok' => true, 'user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf']]);
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
        $store = read_store();
        json_response([
            'ok' => true,
            'user' => $user,
            'csrf' => $_SESSION['csrf'],
            'canEdit' => can_edit($user),
            'active' => $store['active'],
            'versions' => array_map(
                fn(array $version) => array_intersect_key($version, array_flip(['id', 'name', 'adjustment', 'categoryAdjustments', 'summary', 'savedAt', 'savedBy'])),
                array_slice(array_reverse($store['versions']), 0, 12)
            ),
        ]);
    }

    if ($action === 'save') {
        require_csrf();
        if (!can_edit($user)) {
            json_response(['ok' => false, 'message' => 'Your role cannot change price lists.'], 403);
        }
        $data = request_json();
        $name = clean_text($data['name'] ?? 'Untitled price list', 160);
        $headers = $data['headers'] ?? [];
        $rows = $data['rows'] ?? [];
        $priceColumns = $data['priceColumns'] ?? [];
        $adjustment = filter_var($data['adjustment'] ?? 0, FILTER_VALIDATE_FLOAT);
        $categoryAdjustments = $data['categoryAdjustments'] ?? [];
        $cleanCategoryAdjustments = [];
        if (is_array($categoryAdjustments)) {
            foreach ($categoryAdjustments as $cat => $val) {
                $catKey = clean_text((string) $cat, 120);
                $valNum = filter_var($val, FILTER_VALIDATE_FLOAT);
                if ($catKey !== '' && $valNum !== false && $valNum >= -100 && $valNum <= 10000) {
                    $cleanCategoryAdjustments[$catKey] = (float) $valNum;
                }
            }
        }
        $summary = $data['summary'] ?? null;
        $cleanSummary = null;
        if (is_array($summary)) {
            $cleanSummary = [
                'totalAdjustedProducts' => intval($summary['totalAdjustedProducts'] ?? 0),
                'totalProducts' => intval($summary['totalProducts'] ?? count($rows)),
                'adjustedCategories' => []
            ];
            if (is_array($summary['adjustedCategories'] ?? null)) {
                foreach ($summary['adjustedCategories'] as $item) {
                    if (is_array($item)) {
                        $catName = clean_text(strval($item['category'] ?? ''), 120);
                        $adjVal = filter_var($item['adjustment'] ?? 0, FILTER_VALIDATE_FLOAT);
                        $prodCount = intval($item['productCount'] ?? 0);
                        if ($catName !== '' && $adjVal !== false) {
                            $cleanSummary['adjustedCategories'][] = [
                                'category' => $catName,
                                'adjustment' => (float) $adjVal,
                                'productCount' => $prodCount
                            ];
                        }
                    }
                }
            }
        }
        if (!is_array($headers) || !is_array($rows) || !is_array($priceColumns) || count($rows) > 15000) {
            json_response(['ok' => false, 'message' => 'The imported workbook data is invalid or too large.'], 422);
        }
        $headers = array_map(fn($value) => clean_text($value, 120), array_slice($headers, 0, 80));
        $width = count($headers);
        if ($width === 0 || $width > 80 || count($priceColumns) === 0 || $adjustment === false || $adjustment < -100 || $adjustment > 10000) {
            json_response(['ok' => false, 'message' => 'Check the headers, price columns, and percentage.'], 422);
        }
        $priceColumns = array_values(array_unique(array_filter(array_map('intval', $priceColumns), fn($i) => $i >= 0 && $i < $width)));
        if (!$priceColumns) {
            json_response(['ok' => false, 'message' => 'Select at least one valid price column.'], 422);
        }
        $cleanRows = [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $clean = [];
            for ($i = 0; $i < $width; $i++) {
                $value = $row[$i] ?? '';
                $clean[] = is_numeric($value) ? (float) $value : clean_text($value, 500);
            }
            $cleanRows[] = $clean;
        }
        $store = read_store();
        $version = [
            'id' => bin2hex(random_bytes(8)),
            'name' => $name,
            'headers' => $headers,
            'rows' => $cleanRows,
            'priceColumns' => $priceColumns,
            'adjustment' => (float) $adjustment,
            'categoryAdjustments' => $cleanCategoryAdjustments,
            'summary' => $cleanSummary,
            'savedAt' => gmdate('c'),
            'savedBy' => $user['name'],
        ];
        $store['active'] = $version;
        $store['versions'][] = $version;
        if (count($store['versions']) > 25) $store['versions'] = array_slice($store['versions'], -25);
        write_store($store);
        json_response(['ok' => true, 'active' => $version, 'message' => 'Price list saved.']);
    }

    if ($action === 'open') {
        $id = clean_text(request_json()['id'] ?? '', 32);
        $store = read_store();
        $found = null;
        foreach ($store['versions'] as $version) {
            if (($version['id'] ?? '') === $id) $found = $version;
        }
        if (!$found) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
        json_response(['ok' => true, 'active' => $found]);
    }

    if ($action === 'delete-version') {
        require_csrf();
        if (($user['role'] ?? '') !== 'admin') json_response(['ok' => false, 'message' => 'Only an administrator can delete saved versions.'], 403);
        $id = clean_text(request_json()['id'] ?? '', 32);
        if ($id === '') json_response(['ok' => false, 'message' => 'A version ID is required.'], 422);
        if (database_enabled()) {
            if (!database_delete_version($id, $user['name'])) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
        } else {
            $store = read_store();
            $before = count($store['versions']);
            $store['versions'] = array_values(array_filter($store['versions'], fn(array $version) => ($version['id'] ?? '') !== $id));
            if (count($store['versions']) === $before) json_response(['ok' => false, 'message' => 'Saved version not found.'], 404);
            if (($store['active']['id'] ?? '') === $id) $store['active'] = $store['versions'] ? $store['versions'][array_key_last($store['versions'])] : null;
            write_store($store);
        }
        json_response(['ok' => true, 'message' => 'Saved version deleted.']);
    }

    json_response(['ok' => false, 'message' => 'Unknown API action.'], 404);
} catch (Throwable $error) {
    error_log($error->__toString());
    json_response(['ok' => false, 'message' => 'The server could not complete the request.'], 500);
}
