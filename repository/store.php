<?php
declare(strict_types=1);

/*
 * Repository layer. Every repo_* function dispatches to SQL Server (dbo.PLA_ACD_* tables) when
 * conn/config.php sets PLA_STORAGE_DRIVER to 'sqlserver', otherwise to the JSON store (storage/app.json).
 */

require_once __DIR__ . '/../rules/constants.php';
require_once __DIR__ . '/sqlserver.php';
require_once __DIR__ . '/../rules/workflow.php';

// ---------------------------------------------------------------------------
// JSON development store
// ---------------------------------------------------------------------------

function json_default_store(): array
{
    return ['versions' => [], 'auditLogs' => [], 'notifications' => [], 'productImages' => [], 'photoLibrary' => [], 'photoFolders' => []];
}

function json_read_store(): array
{
    if (!is_file(STORAGE_FILE)) return json_default_store();
    $decoded = json_decode((string) file_get_contents(STORAGE_FILE), true);
    $store = is_array($decoded) ? array_replace(json_default_store(), $decoded) : json_default_store();
    unset($store['active']);
    foreach (['versions', 'auditLogs', 'notifications', 'productImages', 'photoLibrary', 'photoFolders'] as $key) {
        $store[$key] = is_array($store[$key]) ? array_values($store[$key]) : [];
    }
    $store['versions'] = array_map('normalize_version', $store['versions']);
    return $store;
}

function json_write_store(array $store): void
{
    $directory = dirname(STORAGE_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the storage directory.');
    }
    $temporary = STORAGE_FILE . '.' . bin2hex(random_bytes(6)) . '.tmp';
    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false || file_put_contents($temporary, $json, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write application data.');
    }
    if (!rename($temporary, STORAGE_FILE)) {
        @unlink($temporary);
        throw new RuntimeException('Unable to finalize application data.');
    }
}

/** Runs a read-modify-write cycle under an exclusive lock and returns the callback's result. */
function json_mutate(callable $callback): mixed
{
    $directory = dirname(STORAGE_FILE);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the storage directory.');
    }
    $lock = fopen(STORAGE_FILE . '.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Unable to lock application data.');
    try {
        $store = json_read_store();
        $result = $callback($store);
        json_write_store($store);
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

/** @return array<int,array> Version summaries (no rows), newest first. */
function repo_list_version_summaries(): array
{
    if (database_enabled()) return database_list_version_summaries();
    $versions = json_read_store()['versions'];
    usort($versions, fn($a, $b) => strcmp((string) ($b['savedAt'] ?? ''), (string) ($a['savedAt'] ?? '')));
    return array_map('version_summary', $versions);
}

function repo_get_version(string $id): ?array
{
    if ($id === '') return null;
    if (database_enabled()) return database_get_version($id);
    foreach (json_read_store()['versions'] as $version) {
        if (($version['id'] ?? '') === $id) return $version;
    }
    return null;
}

function repo_save_version(array $version): void
{
    if (database_enabled()) {
        database_save_version($version);
        return;
    }
    json_mutate(function (array &$store) use ($version) {
        foreach ($store['versions'] as $index => $existing) {
            if (($existing['id'] ?? '') === $version['id']) {
                $store['versions'][$index] = $version;
                return;
            }
        }
        $store['versions'][] = $version;
    });
}

function repo_delete_version(string $id): bool
{
    if (database_enabled()) return database_delete_version($id);
    return json_mutate(function (array &$store) use ($id) {
        $before = count($store['versions']);
        $store['versions'] = array_values(array_filter($store['versions'], fn($v) => ($v['id'] ?? '') !== $id));
        return count($store['versions']) !== $before;
    });
}

/** Removes the oldest superseded revisions of a price list (same name, country and price level) beyond the retention limit. */
function repo_prune_superseded(array $version): void
{
    $superseded = array_filter(
        repo_list_version_summaries(),
        fn($v) => ($v['status'] ?? '') === 'superseded' && same_price_list($v, $version)
    );
    foreach (array_slice(array_values($superseded), SUPERSEDED_KEEP_PER_LIST) as $old) {
        repo_delete_version((string) $old['id']);
    }
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function repo_add_audit(array $log): void
{
    if (database_enabled()) {
        database_add_audit($log);
        return;
    }
    json_mutate(function (array &$store) use ($log) {
        array_unshift($store['auditLogs'], $log);
        if (count($store['auditLogs']) > AUDIT_LOG_LIMIT) $store['auditLogs'] = array_slice($store['auditLogs'], 0, AUDIT_LOG_LIMIT);
    });
}

function repo_list_audit(int $limit = 1000): array
{
    if (database_enabled()) return database_list_audit($limit);
    return array_slice(json_read_store()['auditLogs'], 0, $limit);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function repo_add_notification(array $notification): void
{
    if (database_enabled()) {
        database_add_notification($notification);
        return;
    }
    json_mutate(function (array &$store) use ($notification) {
        array_unshift($store['notifications'], $notification);
        $counts = [];
        $store['notifications'] = array_values(array_filter($store['notifications'], function ($n) use (&$counts) {
            $recipient = (string) ($n['recipient'] ?? '');
            $counts[$recipient] = ($counts[$recipient] ?? 0) + 1;
            return $counts[$recipient] <= NOTIFICATION_LIMIT_PER_USER;
        }));
    });
}

function repo_list_notifications(string $username, int $limit = 100): array
{
    if (database_enabled()) return database_list_notifications($username, $limit);
    $mine = array_filter(json_read_store()['notifications'], fn($n) => ($n['recipient'] ?? '') === $username);
    return array_slice(array_values($mine), 0, $limit);
}

/** Marks the given notification ids (or all when null) as read for a user. */
function repo_mark_notifications_read(string $username, ?array $ids): void
{
    if (database_enabled()) {
        database_mark_notifications_read($username, $ids);
        return;
    }
    json_mutate(function (array &$store) use ($username, $ids) {
        foreach ($store['notifications'] as &$notification) {
            if (($notification['recipient'] ?? '') !== $username) continue;
            if ($ids === null || in_array($notification['id'] ?? '', $ids, true)) $notification['read'] = true;
        }
        unset($notification);
    });
}

// ---------------------------------------------------------------------------
// Photo library (the "drawer" of reusable product photos)
// ---------------------------------------------------------------------------

/** @return array<int,array> Newest first. */
function repo_list_library(): array
{
    if (database_enabled()) return database_list_library();
    return json_read_store()['photoLibrary'];
}

function repo_get_library_photo(string $id): ?array
{
    if ($id === '') return null;
    foreach (repo_list_library() as $photo) {
        if (($photo['id'] ?? '') === $id) return $photo;
    }
    return null;
}

function repo_add_library_photo(array $photo): void
{
    if (database_enabled()) {
        database_add_library_photo($photo);
        return;
    }
    json_mutate(function (array &$store) use ($photo) {
        array_unshift($store['photoLibrary'], $photo);
    });
}

/** Folder names are category labels, independent of file-system paths. */
function repo_list_library_folders(): array
{
    if (database_enabled()) return database_list_library_folders();
    return array_values(array_filter(json_read_store()['photoFolders'], 'is_string'));
}

function repo_add_library_folder(string $category): string
{
    if ($category === '') return '';
    if (database_enabled()) return database_add_library_folder($category);
    return json_mutate(function (array &$store) use ($category) {
        foreach ($store['photoFolders'] as $folder) {
            if (is_string($folder) && mb_strtolower($folder) === mb_strtolower($category)) return $folder;
        }
        $store['photoFolders'][] = $category;
        return $category;
    });
}

function repo_move_library_photo(string $id, string $category): ?array
{
    if (database_enabled()) return database_move_library_photo($id, $category);
    return json_mutate(function (array &$store) use ($id, $category) {
        foreach ($store['photoLibrary'] as &$photo) {
            if (($photo['id'] ?? '') !== $id) continue;
            $photo['category'] = $category;
            return $photo;
        }
        return null;
    });
}

/** @return array|null The removed record. */
function repo_delete_library_photo(string $id): ?array
{
    if ($id === '') return null;
    if (database_enabled()) return database_delete_library_photo($id);
    return json_mutate(function (array &$store) use ($id) {
        foreach ($store['photoLibrary'] as $index => $photo) {
            if (($photo['id'] ?? '') === $id) {
                unset($store['photoLibrary'][$index]);
                $store['photoLibrary'] = array_values($store['photoLibrary']);
                return $photo;
            }
        }
        return null;
    });
}

// ---------------------------------------------------------------------------
// Developer tools: wipe test data
// ---------------------------------------------------------------------------

/** Deletes every record of one kind ('versions', 'audit', 'notifications', 'images', 'library'); returns how many were removed. */
function repo_dev_clear(string $target): int
{
    $tables = ['versions' => 'PLA_ACD_Versions', 'audit' => 'PLA_ACD_AuditLog', 'notifications' => 'PLA_ACD_Notifications', 'images' => 'PLA_ACD_GroupImages', 'library' => 'PLA_ACD_PhotoLibrary'];
    if (!isset($tables[$target])) throw new InvalidArgumentException('Unknown data set.');
    if (database_enabled()) {
        return (int) database_connection()->exec('DELETE FROM dbo.' . $tables[$target]);
    }
    $keys = ['versions' => 'versions', 'audit' => 'auditLogs', 'notifications' => 'notifications', 'images' => 'productImages', 'library' => 'photoLibrary'];
    return json_mutate(function (array &$store) use ($keys, $target) {
        $count = count($store[$keys[$target]]);
        $store[$keys[$target]] = [];
        return $count;
    });
}

// ---------------------------------------------------------------------------
// Product type images
// ---------------------------------------------------------------------------

function repo_list_images(): array
{
    if (database_enabled()) return database_read_group_images();
    return json_read_store()['productImages'];
}

/** @return array|null The replaced record, if any. */
function repo_upsert_image(array $image): ?array
{
    if (database_enabled()) {
        $previous = database_upsert_group_image($image);
        return $previous ? ['imagePath' => (string) ($previous['image_path'] ?? '')] : null;
    }
    return json_mutate(function (array &$store) use ($image) {
        $previous = null;
        foreach ($store['productImages'] as $index => $existing) {
            if (($existing['key'] ?? '') === $image['key']) {
                $previous = $existing;
                unset($store['productImages'][$index]);
            }
        }
        $store['productImages'] = array_values($store['productImages']);
        $store['productImages'][] = $image;
        return $previous;
    });
}

/** @return array|null The removed record, if it existed. */
function repo_delete_image(string $key): ?array
{
    if (database_enabled()) {
        $record = database_delete_group_image($key);
        return $record ? ['imagePath' => (string) ($record['image_path'] ?? ''), 'category' => $record['category_name'], 'groupName' => $record['group_name']] : null;
    }
    return json_mutate(function (array &$store) use ($key) {
        foreach ($store['productImages'] as $index => $existing) {
            if (($existing['key'] ?? '') === $key) {
                unset($store['productImages'][$index]);
                $store['productImages'] = array_values($store['productImages']);
                return $existing;
            }
        }
        return null;
    });
}
