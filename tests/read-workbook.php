<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../rules/workbook_import.php';
try {
    echo json_encode(['ok' => true, 'result' => OfficialPriceWorkbook::read($argv[1], 'Switzerland', 'Price Level 4')], JSON_THROW_ON_ERROR);
} catch (WorkbookTemplateException $error) {
    echo json_encode(['ok' => false, 'message' => $error->getMessage()], JSON_THROW_ON_ERROR);
    exit(1);
}
