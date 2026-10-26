<?php
declare(strict_types=1);
/**
 * Who has which price list open right now (dbo.PLA_Presence, SQL Server only). Each browser tab checks
 * in every 15 seconds (api/app/presence.php); a tab that stops checking in counts as gone after
 * PRESENCE_GONE_SECONDS. Nothing is locked: it only tells people someone else is in the same file.
 */

require_once __DIR__ . '/sqlserver.php';

const PRESENCE_GONE_SECONDS = 90;

/** Records that this tab is open, on list $listId ('' = no file in view), with $unsaved products changed. */
function presence_touch(string $tab, array $user, string $listId, int $unsaved): void
{
    $values = [$user['username'], $user['name'], $listId !== '' ? $listId : null, max(0, $unsaved)];
    $statement = database_connection()->prepare(
        'MERGE dbo.PLA_Presence AS target
         USING (SELECT ? AS tab_id) AS source ON target.tab_id = source.tab_id
         WHEN MATCHED THEN UPDATE SET username = ?, display_name = ?, list_id = ?, unsaved = ?, seen_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (tab_id, username, display_name, list_id, unsaved) VALUES (?, ?, ?, ?, ?);'
    );
    $statement->execute(array_merge([$tab], $values, [$tab], $values));
}

/** The tab was closed (or signed out). */
function presence_leave(string $tab): void
{
    database_connection()->prepare('DELETE FROM dbo.PLA_Presence WHERE tab_id = ?')->execute([$tab]);
}

/**
 * Everyone else in the app now: [{username, name, listId, unsaved}], one entry per person and list (a
 * person with the same list open in two tabs counts once, with the larger number of unsaved changes).
 * Old rows are cleared on the way.
 */
function presence_others(string $username): array
{
    $connection = database_connection();
    $connection->exec('DELETE FROM dbo.PLA_Presence WHERE seen_at < DATEADD(second, -120, SYSUTCDATETIME())');
    $statement = $connection->prepare(
        'SELECT username, MAX(display_name) AS display_name, list_id, MAX(unsaved) AS unsaved
         FROM dbo.PLA_Presence
         WHERE username <> ? AND seen_at >= DATEADD(second, -' . PRESENCE_GONE_SECONDS . ', SYSUTCDATETIME())
         GROUP BY username, list_id'
    );
    $statement->execute([$username]);
    return array_map(static fn(array $r): array => [
        'username' => (string) $r['username'],
        'name' => (string) $r['display_name'],
        'listId' => (string) ($r['list_id'] ?? ''),
        'unsaved' => (int) $r['unsaved'],
    ], $statement->fetchAll());
}
