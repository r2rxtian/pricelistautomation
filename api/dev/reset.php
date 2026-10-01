<?php
declare(strict_types=1);
/** Developer tools: wipes test data. Only when PLA_DEV_TOOLS is on (conn/config.php). */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
if (!DEV_TOOLS_ENABLED) json_response(['ok' => false, 'message' => 'Developer tools are disabled.'], 403);
requirePermission($user, 'update', 'Only price list administrators can clear test data.');

$targets = array_values(array_intersect(['versions', 'audit', 'notifications', 'images'], (array) (request_json()['targets'] ?? [])));
if (!$targets) json_response(['ok' => false, 'message' => 'Choose what to clear.'], 422);
$cleared = [];
foreach ($targets as $target) {
    $cleared[$target] = repo_dev_clear($target);
    if ($target === 'images') {
        $cleared['images'] += repo_dev_clear('library');
        foreach (array_merge(glob(APP_ROOT . '/' . GROUP_IMAGE_DIR . '/*') ?: [], glob(APP_ROOT . '/' . LIBRARY_DIR . '/*') ?: []) as $file) {
            if (is_file($file)) @unlink($file);
        }
    }
}
$labels = ['versions' => 'saved price lists', 'audit' => 'audit log entries', 'notifications' => 'notifications', 'images' => 'product photos'];
$summary = implode(', ', array_map(fn($t) => "{$cleared[$t]} {$labels[$t]}", $targets));
// Always leave a trace, even when the audit log itself was wiped.
record_audit('dev_reset', 'Cleared test data', "{$user['name']} used developer tools to clear: {$summary}.", ['cleared' => $cleared]);
json_response(['ok' => true, 'cleared' => $cleared, 'message' => "Cleared {$summary}."]);
