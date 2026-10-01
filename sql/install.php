<?php
declare(strict_types=1);
/**
 * Runs sql/schema.sql then sql/seed.sql against the database in conn/config.php.
 * Both scripts are idempotent, so this is safe to re-run. Command line only:
 *
 *   php sql/install.php
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../conn/db.php';

foreach (['schema.sql', 'seed.sql'] as $file) {
    $script = (string) file_get_contents(__DIR__ . '/' . $file);
    // Batches are separated by GO lines; the connection already targets the right database.
    $batches = preg_split('/^\s*GO\s*$/mi', $script);
    $ran = 0;
    foreach ($batches as $batch) {
        $batch = trim(preg_replace('/^\s*USE\s+\w+\s*;?\s*$/mi', '', $batch));
        if ($batch === '' || preg_match('/^(\/\*.*?\*\/\s*)+$/s', $batch)) continue;
        db()->exec($batch);
        $ran++;
    }
    echo "{$file}: {$ran} batches run.", PHP_EOL;
}

$rows = db()->query('SELECT u.username, u.employee_id, r.name AS role FROM dbo.PLA_ACD_Users u JOIN dbo.PLA_ACD_Roles r ON r.id = u.role_id ORDER BY u.id')->fetchAll();
echo 'Users:', PHP_EOL;
foreach ($rows as $row) echo "  {$row['username']} ({$row['employee_id']}) – {$row['role']}", PHP_EOL;
