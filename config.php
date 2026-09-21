<?php
declare(strict_types=1);

const APP_NAME = 'LRN Price List Automation';
const STORAGE_FILE = __DIR__ . '/storage/app.json';

const USERS = [
    'admin@lrn.local' => ['name' => 'System Admin', 'password' => 'Admin123!', 'role' => 'admin'],
    'editor@lrn.local' => ['name' => 'Price Editor', 'password' => 'Editor123!', 'role' => 'editor'],
    'viewer@lrn.local' => ['name' => 'Read Only', 'password' => 'Viewer123!', 'role' => 'viewer'],
];

const EDIT_ROLES = ['admin', 'editor'];

$localConfiguration = is_file(__DIR__ . '/config.local.php')
    ? require __DIR__ . '/config.local.php'
    : [];

define('DATABASE_CONFIG', array_replace([
    'host' => getenv('PLA_DB_HOST') ?: '',
    'database' => getenv('PLA_DB_NAME') ?: '',
    'username' => getenv('PLA_DB_USER') ?: '',
    'password' => getenv('PLA_DB_PASSWORD') ?: '',
    'trust_certificate' => filter_var(getenv('PLA_DB_TRUST_CERT') ?: 'true', FILTER_VALIDATE_BOOL),
], is_array($localConfiguration['database'] ?? null) ? $localConfiguration['database'] : []));
