<?php
declare(strict_types=1);
/**
 * Shared PDO connection factory (SQL Server via pdo_sqlsrv). Credentials live in conn/config.php,
 * which Git ignores and conn/.htaccess keeps off the web.
 *
 * The company tables (dbo.lrnph_users, dbo.lrn_master_list) and this app's dbo.PLA_* tables all
 * live in the shared LRNPH_OJT database.
 */

if (!is_file(__DIR__ . '/config.php')) {
    throw new RuntimeException('Missing conn/config.php. Copy conn/config.example.php to conn/config.php and fill it in.');
}
require_once __DIR__ . '/config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $server = str_replace([';', "\0", "\r", "\n"], '', PLA_DB_HOST);
    $database = str_replace([';', "\0", "\r", "\n"], '', PLA_DB_NAME);
    // ConnectionPooling=0: under Apache the driver otherwise hands out pooled connections that may
    // have gone stale on the network; a query on one hangs for seconds (or fails). A fresh connection
    // per request costs ~50 ms and is reliable.
    $pdo = new PDO("sqlsrv:Server={$server};Database={$database};TrustServerCertificate=true;LoginTimeout=5;ConnectionPooling=0", PLA_DB_USER, PLA_DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::SQLSRV_ATTR_ENCODING => PDO::SQLSRV_ENCODING_UTF8,
    ]);
    return $pdo;
}
