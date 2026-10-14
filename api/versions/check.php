<?php
declare(strict_types=1);
/**
 * Checks an attached workbook against the official template as soon as it is chosen, before any
 * country or price level is picked, so a wrong file is explained right away. Nothing is saved:
 * the real upload (versions/save.php) validates the file again in full.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/workbook_import.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'upload', 'Your role cannot upload price lists.');

$multipart = str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'multipart/form-data');
if (!$multipart || count($_FILES) !== 1 || !isset($_FILES['workbook']) || !is_array($_FILES['workbook'])) {
    json_response(['ok' => false, 'message' => 'Choose the official .xlsx workbook to check.'], 422);
}

try {
    // Country and price level only label the products once saved; they don't affect validation.
    $result = import_official_uploaded_workbook($_FILES['workbook'], '', '');
} catch (WorkbookTemplateException $error) {
    json_response(['ok' => false, 'message' => $error->getMessage(), 'problems' => $error->problems], 422);
}

$categories = array_values(array_unique(array_map(fn($row) => (string) $row[0], $result['rows'])));
json_response(['ok' => true, 'productCount' => count($result['rows']), 'categories' => $categories]);
