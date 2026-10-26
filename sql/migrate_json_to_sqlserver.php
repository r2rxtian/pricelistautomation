<?php
declare(strict_types=1);
/**
 * One-time copy of the JSON store (storage/app.json) into the SQL Server tables (dbo.PLA_*), for
 * switching conn/config.php's PLA_STORAGE_DRIVER from 'json' to 'sqlserver'.
 *
 *   php sql/migrate_json_to_sqlserver.php          copy everything
 *   php sql/migrate_json_to_sqlserver.php --dry    only count what would be copied
 *
 * Command line only. storage/app.json is only read (it stays as a backup). Safe to re-run: rows
 * already in SQL Server are updated or skipped, never duplicated.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../rules/workflow.php';
require_once __DIR__ . '/../conn/store.php';

$dry = in_array('--dry', $argv, true);
$path = __DIR__ . '/../storage/app.json';
$store = json_decode((string) @file_get_contents($path), true);
if (!is_array($store)) { fwrite(STDERR, "Cannot read {$path}\n"); exit(1); }
$db = database_connection(); // also creates any missing dbo.PLA_* storage tables
$exists = function (string $sql, array $params) use ($db): bool { $s = $db->prepare($sql); $s->execute($params); return (bool) $s->fetchColumn(); };
$report = [];
$count = function (string $what, int $copied, int $total) use (&$report) { $report[] = sprintf('%-22s %4d of %4d', $what, $copied, $total); };

// Price lists (full versions; MERGE by id, so a re-run updates instead of duplicating).
$versions = $store['versions'] ?? [];
if (!$dry) foreach ($versions as $version) database_save_version($version);
$count('Price list versions', count($versions), count($versions));

// Audit log: skipped when its log id is already there.
$copied = 0;
foreach ($store['auditLogs'] ?? [] as $log) {
    if ($exists('SELECT 1 FROM dbo.PLA_AuditLog WHERE log_uid = ?', [$log['id']])) continue;
    if (!$dry) database_add_audit($log);
    $copied++;
}
$count('Audit log entries', $copied, count($store['auditLogs'] ?? []));

// Notifications (keeping read / unread).
$copied = 0;
foreach ($store['notifications'] ?? [] as $note) {
    if ($exists('SELECT 1 FROM dbo.PLA_Notifications WHERE notification_id = ?', [$note['id']])) continue;
    if (!$dry) {
        database_add_notification($note);
        if (!empty($note['read'])) $db->prepare('UPDATE dbo.PLA_Notifications SET is_read = 1 WHERE notification_id = ?')->execute([$note['id']]);
    }
    $copied++;
}
$count('Notifications', $copied, count($store['notifications'] ?? []));

// Photo library, its folders, and product type photos.
$copied = 0;
foreach ($store['photoLibrary'] ?? [] as $photo) {
    if ($exists('SELECT 1 FROM dbo.PLA_PhotoLibrary WHERE photo_id = ?', [$photo['id']])) continue;
    if (!$dry) database_add_library_photo($photo);
    $copied++;
}
$count('Library photos', $copied, count($store['photoLibrary'] ?? []));
if (!$dry) foreach ($store['photoFolders'] ?? [] as $folder) if (is_string($folder) && $folder !== '') database_add_library_folder($folder);
$count('Photo folders', count($store['photoFolders'] ?? []), count($store['photoFolders'] ?? []));
if (!$dry) foreach ($store['productImages'] ?? [] as $image) {
    database_upsert_group_image($image + ['altText' => '', 'updatedBy' => '']);
    // The upsert stamps "now"; keep the date the photo was really set.
    if (!empty($image['updatedAt'])) {
        $utc = (new DateTimeImmutable($image['updatedAt']))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $db->prepare('UPDATE dbo.PLA_GroupImages SET updated_at = ? WHERE image_key = ?')->execute([$utc, $image['key']]);
    }
}
$count('Product type photos', count($store['productImages'] ?? []), count($store['productImages'] ?? []));

// Search shortcuts, countries and price levels (replaced as a whole, so a re-run is the same).
if (!$dry) foreach ($store['searchKeywords'] ?? [] as $entry) database_save_search_keywords($entry);
$count('Search shortcuts', count($store['searchKeywords'] ?? []), count($store['searchKeywords'] ?? []));
foreach (['countries' => 'Countries', 'priceLevels' => 'Price levels'] as $type => $label) {
    $items = $store['listOptions'][$type] ?? [];
    if (!$dry && $items) database_save_list_options($type, $items);
    $count($label, count($items), count($items));
}

echo ($dry ? "Dry run (nothing written):\n" : "Copied into SQL Server:\n") . implode("\n", $report) . "\n";
