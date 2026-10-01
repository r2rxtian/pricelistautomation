<?php
declare(strict_types=1);
/**
 * SQL Server storage for price lists, audit logs, notifications and photos (dbo.PLA_ACD_* tables).
 * Used when conn/config.php sets PLA_STORAGE_DRIVER to 'sqlserver'.
 */

require_once __DIR__ . '/../rules/constants.php';

function database_enabled(): bool
{
    return STORAGE_DRIVER === 'sqlserver';
}

/** The shared connection (conn/db.php), with the storage tables created on first use. */
function database_connection(): PDO
{
    static $ready = false;
    $connection = db();
    if (!$ready) {
        ensure_database_schema($connection);
        $ready = true;
    }
    return $connection;
}

/** Idempotent DDL for the storage tables, kept in sync with sql/schema.sql. */
function ensure_database_schema(PDO $connection): void
{
    $statements = [
        "IF OBJECT_ID(N'dbo.PLA_ACD_Versions', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_Versions (
            version_id varchar(32) NOT NULL PRIMARY KEY,
            list_name nvarchar(160) NOT NULL,
            adjustment decimal(12,4) NOT NULL CONSTRAINT DF_PLA_ACD_Adjustment DEFAULT 0,
            saved_at datetime2(0) NOT NULL,
            saved_by nvarchar(180) NOT NULL,
            data_json nvarchar(max) NOT NULL,
            CONSTRAINT CK_PLA_ACD_Versions_JSON CHECK (ISJSON(data_json) = 1)
         )",
        "IF COL_LENGTH('dbo.PLA_ACD_Versions', 'status') IS NULL
         ALTER TABLE dbo.PLA_ACD_Versions ADD status nvarchar(20) NOT NULL CONSTRAINT DF_PLA_ACD_Status DEFAULT N'pending'",
        "IF COL_LENGTH('dbo.PLA_ACD_Versions', 'price_level') IS NULL
         ALTER TABLE dbo.PLA_ACD_Versions ADD price_level nvarchar(120) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_Versions', 'country') IS NULL
         ALTER TABLE dbo.PLA_ACD_Versions ADD country nvarchar(120) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_Versions', 'revision') IS NULL
         ALTER TABLE dbo.PLA_ACD_Versions ADD revision int NOT NULL CONSTRAINT DF_PLA_ACD_Revision DEFAULT 1",
        "IF COL_LENGTH('dbo.PLA_ACD_Versions', 'saved_by_user') IS NULL
         ALTER TABLE dbo.PLA_ACD_Versions ADD saved_by_user nvarchar(120) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_Versions', 'summary_json') IS NULL
         ALTER TABLE dbo.PLA_ACD_Versions ADD summary_json nvarchar(max) NULL",
        "IF OBJECT_ID(N'dbo.PLA_ACD_ProductImages', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_ProductImages (
            product_code nvarchar(100) NOT NULL PRIMARY KEY,
            image_path nvarchar(500) NOT NULL,
            alt_text nvarchar(250) NULL,
            updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_ImageUpdated DEFAULT SYSUTCDATETIME(),
            updated_by nvarchar(180) NOT NULL
         )",
        "IF OBJECT_ID(N'dbo.PLA_ACD_GroupImages', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_GroupImages (
            image_key varchar(64) NOT NULL PRIMARY KEY,
            category_name nvarchar(120) NOT NULL,
            group_name nvarchar(300) NOT NULL,
            image_path nvarchar(500) NOT NULL,
            alt_text nvarchar(250) NULL,
            updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_GroupImageUpdated DEFAULT SYSUTCDATETIME(),
            updated_by nvarchar(180) NOT NULL
         )",
        "IF OBJECT_ID(N'dbo.PLA_ACD_AuditLog', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_AuditLog (
            audit_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
            action_name nvarchar(60) NOT NULL,
            version_id varchar(32) NULL,
            actor nvarchar(180) NOT NULL,
            details nvarchar(1000) NULL,
            created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_AuditCreated DEFAULT SYSUTCDATETIME()
         )",
        "IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'log_uid') IS NULL
         ALTER TABLE dbo.PLA_ACD_AuditLog ADD log_uid varchar(32) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'title') IS NULL
         ALTER TABLE dbo.PLA_ACD_AuditLog ADD title nvarchar(300) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'actor_user') IS NULL
         ALTER TABLE dbo.PLA_ACD_AuditLog ADD actor_user nvarchar(120) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'role_name') IS NULL
         ALTER TABLE dbo.PLA_ACD_AuditLog ADD role_name nvarchar(40) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'file_name') IS NULL
         ALTER TABLE dbo.PLA_ACD_AuditLog ADD file_name nvarchar(300) NULL",
        "IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'metadata_json') IS NULL
         ALTER TABLE dbo.PLA_ACD_AuditLog ADD metadata_json nvarchar(max) NULL",
        "IF OBJECT_ID(N'dbo.PLA_ACD_Notifications', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_Notifications (
            notification_id varchar(32) NOT NULL PRIMARY KEY,
            recipient nvarchar(120) NOT NULL,
            notification_type nvarchar(40) NOT NULL,
            title nvarchar(300) NOT NULL,
            message nvarchar(1000) NULL,
            version_id varchar(32) NULL,
            is_read bit NOT NULL CONSTRAINT DF_PLA_ACD_NotificationRead DEFAULT 0,
            created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_NotificationCreated DEFAULT SYSUTCDATETIME()
         )",
        "IF COL_LENGTH('dbo.PLA_ACD_GroupImages', 'library_id') IS NULL
         ALTER TABLE dbo.PLA_ACD_GroupImages ADD library_id varchar(32) NULL",
        "IF OBJECT_ID(N'dbo.PLA_ACD_PhotoLibrary', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_PhotoLibrary (
            photo_id varchar(32) NOT NULL PRIMARY KEY,
            photo_name nvarchar(200) NOT NULL,
            image_path nvarchar(500) NOT NULL,
            width int NULL,
            height int NULL,
            size_bytes int NULL,
            uploaded_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_PhotoUploaded DEFAULT SYSUTCDATETIME(),
            uploaded_by nvarchar(180) NOT NULL
         )",
        "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PLA_ACD_Notifications_Recipient')
         CREATE INDEX IX_PLA_ACD_Notifications_Recipient ON dbo.PLA_ACD_Notifications (recipient, created_at DESC)",
    ];
    foreach ($statements as $statement) $connection->exec($statement);
}

function database_datetime(?string $iso): string
{
    return (new DateTimeImmutable($iso ?: 'now'))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
}

function database_iso(mixed $value): string
{
    if ($value instanceof DateTimeInterface) return $value->format(DateTimeInterface::ATOM);
    if (!$value) return '';
    return (new DateTimeImmutable((string) $value, new DateTimeZone('UTC')))->format(DateTimeInterface::ATOM);
}

// ---------------------------------------------------------------------------
// Versions
// ---------------------------------------------------------------------------

function database_list_version_summaries(): array
{
    $query = database_connection()->query(
        'SELECT version_id, list_name, adjustment, saved_at, saved_by, status, price_level, country, revision, saved_by_user, summary_json
         FROM dbo.PLA_ACD_Versions ORDER BY saved_at DESC, version_id DESC'
    );
    $summaries = [];
    foreach ($query->fetchAll() as $record) {
        $summary = json_decode((string) ($record['summary_json'] ?? ''), true);
        if (!is_array($summary)) {
            // Rows saved by earlier builds have no summary column; derive it once from the full record.
            $full = database_get_version((string) $record['version_id']);
            $summary = $full ? version_summary($full) : [];
        }
        $summary = array_replace($summary, [
            'id' => (string) $record['version_id'],
            'name' => (string) $record['list_name'],
            'status' => (string) $record['status'],
            'revision' => (int) $record['revision'],
        ]);
        $summaries[] = normalize_version($summary);
    }
    return $summaries;
}

function database_get_version(string $id): ?array
{
    $statement = database_connection()->prepare('SELECT data_json, status FROM dbo.PLA_ACD_Versions WHERE version_id = ?');
    $statement->execute([$id]);
    $record = $statement->fetch();
    if (!$record) return null;
    $version = json_decode((string) $record['data_json'], true);
    if (!is_array($version)) return null;
    $version['status'] = (string) $record['status'];
    return normalize_version($version);
}

function database_save_version(array $version): void
{
    $json = json_encode($version, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    $summary = json_encode(version_summary($version), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR);
    $values = [
        $version['name'], (float) ($version['adjustment'] ?? 0), database_datetime($version['savedAt'] ?? null), $version['savedBy'] ?? '',
        $json, $version['status'], $version['priceLevel'] ?? '', $version['country'] ?? '', (int) ($version['revision'] ?? 1),
        $version['savedByUser'] ?? '', $summary,
    ];
    $statement = database_connection()->prepare(
        'MERGE dbo.PLA_ACD_Versions AS target
         USING (SELECT ? AS version_id) AS source ON target.version_id = source.version_id
         WHEN MATCHED THEN UPDATE SET
            list_name = ?, adjustment = ?, saved_at = ?, saved_by = ?, data_json = ?, status = ?,
            price_level = ?, country = ?, revision = ?, saved_by_user = ?, summary_json = ?
         WHEN NOT MATCHED THEN INSERT
            (version_id, list_name, adjustment, saved_at, saved_by, data_json, status, price_level, country, revision, saved_by_user, summary_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
    );
    $statement->execute(array_merge([$version['id']], $values, [$version['id']], $values));
}

function database_delete_version(string $id): bool
{
    $statement = database_connection()->prepare('DELETE FROM dbo.PLA_ACD_Versions WHERE version_id = ?');
    $statement->execute([$id]);
    return $statement->rowCount() > 0;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function database_add_audit(array $log): void
{
    $metadata = is_array($log['metadata'] ?? null) ? $log['metadata'] : [];
    $statement = database_connection()->prepare(
        'INSERT INTO dbo.PLA_ACD_AuditLog
            (action_name, version_id, actor, details, created_at, log_uid, title, actor_user, role_name, file_name, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $statement->execute([
        $log['type'],
        isset($metadata['versionId']) ? mb_substr((string) $metadata['versionId'], 0, 32) : null,
        $log['actor'],
        $log['details'],
        database_datetime($log['timestamp'] ?? null),
        $log['id'],
        $log['title'],
        $log['actorUser'] ?? '',
        $log['role'] ?? '',
        mb_substr((string) ($metadata['fileName'] ?? ''), 0, 300),
        json_encode($metadata, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
    ]);
}

function database_list_audit(int $limit): array
{
    $limit = max(1, min(5000, $limit));
    $query = database_connection()->query(
        "SELECT TOP ({$limit}) audit_id, action_name, version_id, actor, details, created_at, log_uid, title, actor_user, role_name, file_name, metadata_json
         FROM dbo.PLA_ACD_AuditLog ORDER BY created_at DESC, audit_id DESC"
    );
    return array_map(static function (array $record): array {
        $metadata = json_decode((string) ($record['metadata_json'] ?? ''), true);
        if (!is_array($metadata)) $metadata = [];
        if ($record['version_id'] && empty($metadata['versionId'])) $metadata['versionId'] = $record['version_id'];
        if ($record['file_name'] && empty($metadata['fileName'])) $metadata['fileName'] = $record['file_name'];
        return [
            'id' => (string) ($record['log_uid'] ?: $record['audit_id']),
            'type' => (string) $record['action_name'],
            'title' => (string) ($record['title'] ?: $record['action_name']),
            'details' => (string) ($record['details'] ?? ''),
            'actor' => (string) $record['actor'],
            'actorUser' => (string) ($record['actor_user'] ?? ''),
            'role' => (string) ($record['role_name'] ?? ''),
            'timestamp' => database_iso($record['created_at']),
            'metadata' => $metadata,
        ];
    }, $query->fetchAll());
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function database_add_notification(array $notification): void
{
    $statement = database_connection()->prepare(
        'INSERT INTO dbo.PLA_ACD_Notifications (notification_id, recipient, notification_type, title, message, version_id, is_read, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    );
    $statement->execute([
        $notification['id'], $notification['recipient'], $notification['type'], $notification['title'],
        $notification['message'], $notification['versionId'], database_datetime($notification['createdAt'] ?? null),
    ]);
}

function database_list_notifications(string $username, int $limit): array
{
    $limit = max(1, min(500, $limit));
    $statement = database_connection()->prepare(
        "SELECT TOP ({$limit}) notification_id, recipient, notification_type, title, message, version_id, is_read, created_at
         FROM dbo.PLA_ACD_Notifications WHERE recipient = ? ORDER BY created_at DESC"
    );
    $statement->execute([$username]);
    return array_map(static fn(array $record): array => [
        'id' => (string) $record['notification_id'],
        'recipient' => (string) $record['recipient'],
        'type' => (string) $record['notification_type'],
        'title' => (string) $record['title'],
        'message' => (string) ($record['message'] ?? ''),
        'versionId' => $record['version_id'] !== null ? (string) $record['version_id'] : null,
        'read' => (bool) $record['is_read'],
        'createdAt' => database_iso($record['created_at']),
    ], $statement->fetchAll());
}

function database_mark_notifications_read(string $username, ?array $ids): void
{
    $connection = database_connection();
    if ($ids === null) {
        $connection->prepare('UPDATE dbo.PLA_ACD_Notifications SET is_read = 1 WHERE recipient = ? AND is_read = 0')->execute([$username]);
        return;
    }
    $ids = array_values(array_filter($ids, fn($id) => is_string($id) && preg_match('/^[a-f0-9]{16,32}$/', $id)));
    if (!$ids) return;
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $connection->prepare("UPDATE dbo.PLA_ACD_Notifications SET is_read = 1 WHERE recipient = ? AND notification_id IN ({$placeholders})")
        ->execute(array_merge([$username], $ids));
}

// ---------------------------------------------------------------------------
// Product type images
// ---------------------------------------------------------------------------

function database_read_group_images(): array
{
    $query = database_connection()->query(
        'SELECT image_key, category_name, group_name, image_path, alt_text, updated_at, updated_by, library_id
         FROM dbo.PLA_ACD_GroupImages
         ORDER BY category_name, group_name'
    );
    return array_map(
        static fn(array $record): array => [
            'key' => (string) $record['image_key'],
            'category' => (string) $record['category_name'],
            'groupName' => (string) $record['group_name'],
            'imagePath' => (string) $record['image_path'],
            'altText' => (string) ($record['alt_text'] ?? ''),
            'updatedAt' => database_iso($record['updated_at']),
            'updatedBy' => (string) $record['updated_by'],
            'libraryId' => (string) ($record['library_id'] ?? ''),
        ],
        $query->fetchAll()
    );
}

function database_upsert_group_image(array $image): ?array
{
    $connection = database_connection();
    $existing = $connection->prepare('SELECT image_key, image_path FROM dbo.PLA_ACD_GroupImages WHERE image_key = ?');
    $existing->execute([$image['key']]);
    $previous = $existing->fetch() ?: null;

    $statement = $connection->prepare(
        'MERGE dbo.PLA_ACD_GroupImages AS target
         USING (SELECT ? AS image_key) AS source
         ON target.image_key = source.image_key
         WHEN MATCHED THEN UPDATE SET
            category_name = ?, group_name = ?, image_path = ?, alt_text = ?, library_id = ?,
            updated_at = SYSUTCDATETIME(), updated_by = ?
         WHEN NOT MATCHED THEN INSERT
            (image_key, category_name, group_name, image_path, alt_text, library_id, updated_at, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, SYSUTCDATETIME(), ?);'
    );
    $statement->execute([
        $image['key'],
        $image['category'], $image['groupName'], $image['imagePath'], $image['altText'], $image['libraryId'] ?? null, $image['updatedBy'],
        $image['key'], $image['category'], $image['groupName'], $image['imagePath'], $image['altText'], $image['libraryId'] ?? null, $image['updatedBy'],
    ]);
    return $previous;
}

function database_delete_group_image(string $key): ?array
{
    $connection = database_connection();
    $select = $connection->prepare(
        'SELECT image_key, category_name, group_name, image_path FROM dbo.PLA_ACD_GroupImages WHERE image_key = ?'
    );
    $select->execute([$key]);
    $record = $select->fetch() ?: null;
    if (!$record) return null;
    $connection->prepare('DELETE FROM dbo.PLA_ACD_GroupImages WHERE image_key = ?')->execute([$key]);
    return $record;
}

// ---------------------------------------------------------------------------
// Photo library
// ---------------------------------------------------------------------------

function database_list_library(): array
{
    $query = database_connection()->query(
        'SELECT photo_id, photo_name, image_path, width, height, size_bytes, uploaded_at, uploaded_by
         FROM dbo.PLA_ACD_PhotoLibrary ORDER BY uploaded_at DESC, photo_id DESC'
    );
    return array_map(static fn(array $record): array => [
        'id' => (string) $record['photo_id'],
        'name' => (string) $record['photo_name'],
        'imagePath' => (string) $record['image_path'],
        'width' => (int) ($record['width'] ?? 0),
        'height' => (int) ($record['height'] ?? 0),
        'size' => (int) ($record['size_bytes'] ?? 0),
        'uploadedAt' => database_iso($record['uploaded_at']),
        'uploadedBy' => (string) $record['uploaded_by'],
    ], $query->fetchAll());
}

function database_add_library_photo(array $photo): void
{
    database_connection()->prepare(
        'INSERT INTO dbo.PLA_ACD_PhotoLibrary (photo_id, photo_name, image_path, width, height, size_bytes, uploaded_at, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $photo['id'], $photo['name'], $photo['imagePath'], $photo['width'], $photo['height'], $photo['size'],
        database_datetime($photo['uploadedAt'] ?? null), $photo['uploadedBy'],
    ]);
}

function database_delete_library_photo(string $id): ?array
{
    foreach (database_list_library() as $photo) {
        if ($photo['id'] !== $id) continue;
        database_connection()->prepare('DELETE FROM dbo.PLA_ACD_PhotoLibrary WHERE photo_id = ?')->execute([$id]);
        return $photo;
    }
    return null;
}