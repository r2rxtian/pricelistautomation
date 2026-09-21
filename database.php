<?php
declare(strict_types=1);

function database_enabled(): bool
{
    return DATABASE_CONFIG['host'] !== ''
        && DATABASE_CONFIG['database'] !== ''
        && DATABASE_CONFIG['username'] !== ''
        && DATABASE_CONFIG['password'] !== '';
}

function database_connection(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) return $connection;

    $config = DATABASE_CONFIG;
    $server = str_replace([';', "\0", "\r", "\n"], '', $config['host']);
    $database = str_replace([';', "\0", "\r", "\n"], '', $config['database']);
    $trust = $config['trust_certificate'] ? 'yes' : 'no';
    $dsn = "sqlsrv:Server={$server};Database={$database};TrustServerCertificate={$trust};LoginTimeout=5";
    $connection = new PDO($dsn, $config['username'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    ensure_database_schema($connection);
    return $connection;
}

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
        "IF OBJECT_ID(N'dbo.PLA_ACD_ProductImages', N'U') IS NULL
         CREATE TABLE dbo.PLA_ACD_ProductImages (
            product_code nvarchar(100) NOT NULL PRIMARY KEY,
            image_path nvarchar(500) NOT NULL,
            alt_text nvarchar(250) NULL,
            updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_ImageUpdated DEFAULT SYSUTCDATETIME(),
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
    ];
    foreach ($statements as $statement) $connection->exec($statement);
}

function database_read_store(): array
{
    $query = database_connection()->query(
        'SELECT TOP (25) data_json FROM dbo.PLA_ACD_Versions ORDER BY saved_at DESC, version_id DESC'
    );
    $versions = [];
    foreach (array_reverse($query->fetchAll()) as $record) {
        $version = json_decode($record['data_json'], true);
        if (is_array($version)) $versions[] = $version;
    }
    return ['active' => $versions ? $versions[array_key_last($versions)] : null, 'versions' => $versions];
}

function database_write_store(array $store): void
{
    $connection = database_connection();
    $connection->beginTransaction();
    try {
        $exists = $connection->prepare('SELECT COUNT(1) FROM dbo.PLA_ACD_Versions WHERE version_id = ?');
        $insert = $connection->prepare(
            'INSERT INTO dbo.PLA_ACD_Versions (version_id, list_name, adjustment, saved_at, saved_by, data_json)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $audit = $connection->prepare(
            'INSERT INTO dbo.PLA_ACD_AuditLog (action_name, version_id, actor, details) VALUES (?, ?, ?, ?)'
        );
        foreach ($store['versions'] ?? [] as $version) {
            $id = (string) ($version['id'] ?? '');
            if ($id === '') continue;
            $exists->execute([$id]);
            if ((int) $exists->fetchColumn() > 0) continue;
            $json = json_encode($version, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $savedAt = (new DateTimeImmutable((string) ($version['savedAt'] ?? 'now')))->format('Y-m-d H:i:s');
            $insert->execute([$id, $version['name'], $version['adjustment'], $savedAt, $version['savedBy'], $json]);
            $audit->execute(['price_list_saved', $id, $version['savedBy'], 'Price list version saved']);
        }
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
}

function database_delete_version(string $id, string $actor): bool
{
    $connection = database_connection();
    $connection->beginTransaction();
    try {
        $statement = $connection->prepare('DELETE FROM dbo.PLA_ACD_Versions WHERE version_id = ?');
        $statement->execute([$id]);
        $deleted = $statement->rowCount() > 0;
        if ($deleted) {
            $audit = $connection->prepare('INSERT INTO dbo.PLA_ACD_AuditLog (action_name, version_id, actor, details) VALUES (?, ?, ?, ?)');
            $audit->execute(['price_list_deleted', $id, $actor, 'Saved price list version permanently deleted']);
        }
        $connection->commit();
        return $deleted;
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
}
