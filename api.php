<?php
declare(strict_types=1);

require_once __DIR__ . '/lib.php';

$action = $_GET['action'] ?? '';

function delete_managed_group_image(string $relativePath): void
{
    if (!str_starts_with(str_replace('\\', '/', $relativePath), 'storage/product-images/')) return;
    $root = realpath(__DIR__ . '/storage/product-images');
    $target = realpath(__DIR__ . '/' . ltrim(str_replace('\\', '/', $relativePath), '/'));
    if (!$root || !$target || !str_starts_with($target, $root . DIRECTORY_SEPARATOR)) return;
    if (is_file($target)) @unlink($target);
}

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
            'productImages' => array_values(is_array($store['productImages'] ?? null) ? $store['productImages'] : []),
        ]);
    }

    if ($action === 'upload-group-image') {
        require_csrf();
        if (($user['role'] ?? '') !== 'admin') {
            json_response(['ok' => false, 'message' => 'Only an administrator can manage product images.'], 403);
        }
        $category = clean_text($_POST['category'] ?? '', 120);
        $groupName = clean_text($_POST['groupName'] ?? '', 300);
        $file = $_FILES['image'] ?? null;
        if ($category === '' || $groupName === '') {
            json_response(['ok' => false, 'message' => 'Choose a category and product type.'], 422);
        }
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            json_response(['ok' => false, 'message' => 'Choose a valid image file.'], 422);
        }
        $size = (int) ($file['size'] ?? 0);
        if ($size < 1 || $size > 6 * 1024 * 1024) {
            json_response(['ok' => false, 'message' => 'Images must be smaller than 6 MB.'], 422);
        }
        $temporaryPath = (string) ($file['tmp_name'] ?? '');
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath) ?: '';
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($extensions[$mime])) {
            json_response(['ok' => false, 'message' => 'Use a JPG, PNG, or WebP image.'], 422);
        }
        $dimensions = @getimagesize($temporaryPath);
        if (!$dimensions || $dimensions[0] < 120 || $dimensions[1] < 120 || $dimensions[0] > 6000 || $dimensions[1] > 6000) {
            json_response(['ok' => false, 'message' => 'Images must be between 120 and 6,000 pixels in each direction.'], 422);
        }

        $key = hash('sha256', mb_strtolower($category) . "\0" . mb_strtolower($groupName));
        $uploadDirectory = __DIR__ . '/storage/product-images';
        if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0775, true) && !is_dir($uploadDirectory)) {
            throw new RuntimeException('Unable to create the product image directory.');
        }
        $filename = $key . '-' . bin2hex(random_bytes(4)) . '.' . $extensions[$mime];
        $relativePath = 'storage/product-images/' . $filename;
        $targetPath = $uploadDirectory . DIRECTORY_SEPARATOR . $filename;
        if (!move_uploaded_file($temporaryPath, $targetPath)) {
            throw new RuntimeException('Unable to store the uploaded image.');
        }

        $record = [
            'key' => $key,
            'category' => $category,
            'groupName' => $groupName,
            'imagePath' => $relativePath,
            'altText' => $groupName . ' product image',
            'updatedAt' => gmdate('c'),
            'updatedBy' => $user['name'],
        ];
        $oldPath = null;
        try {
            if (database_enabled()) {
                $previous = database_upsert_group_image($record);
                $oldPath = is_array($previous) ? (string) ($previous['image_path'] ?? '') : null;
            } else {
                $store = read_store();
                $images = array_values(is_array($store['productImages'] ?? null) ? $store['productImages'] : []);
                foreach ($images as $index => $image) {
                    if (($image['key'] ?? '') === $key) {
                        $oldPath = (string) ($image['imagePath'] ?? '');
                        unset($images[$index]);
                    }
                }
                $images[] = $record;
                $store['productImages'] = array_values($images);
                write_store($store);
            }
        } catch (Throwable $error) {
            @unlink($targetPath);
            throw $error;
        }
        if ($oldPath && $oldPath !== $relativePath) delete_managed_group_image($oldPath);
        json_response(['ok' => true, 'image' => $record, 'message' => 'Product type image updated.']);
    }

    if ($action === 'delete-group-image') {
        require_csrf();
        if (($user['role'] ?? '') !== 'admin') {
            json_response(['ok' => false, 'message' => 'Only an administrator can manage product images.'], 403);
        }
        $key = clean_text(request_json()['key'] ?? '', 64);
        if (!preg_match('/^[a-f0-9]{64}$/', $key)) {
            json_response(['ok' => false, 'message' => 'Invalid product image key.'], 422);
        }
        $record = null;
        if (database_enabled()) {
            $record = database_delete_group_image($key, $user['name']);
        } else {
            $store = read_store();
            $images = array_values(is_array($store['productImages'] ?? null) ? $store['productImages'] : []);
            foreach ($images as $index => $image) {
                if (($image['key'] ?? '') === $key) {
                    $record = $image;
                    unset($images[$index]);
                    break;
                }
            }
            if ($record) {
                $store['productImages'] = array_values($images);
                write_store($store);
            }
        }
        if (!$record) json_response(['ok' => false, 'message' => 'Custom image not found.'], 404);
        delete_managed_group_image((string) ($record['imagePath'] ?? $record['image_path'] ?? ''));
        json_response(['ok' => true, 'message' => 'Custom image removed. The default image is active again.']);
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
