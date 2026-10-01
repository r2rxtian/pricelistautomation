<?php
declare(strict_types=1);

const APP_NAME = 'LRN Price List Automation';
const STORAGE_FILE = __DIR__ . '/storage/app.json';

/*
 * Roles (Requirements.xlsx › Price Automation, section 2):
 *   admin – Upload | Update | Save | Approve | Export   (Ms. Gen, Chelsea, Margaret)
 *   user  – Export approved price lists only             (Gemma)
 */
const ROLE_PERMISSIONS = [
    'admin' => ['upload', 'update', 'save', 'approve', 'export', 'viewAudit', 'manageImages'],
    'user' => ['export'],
];

/*
 * Accounts are keyed by login email. Passwords are bcrypt hashes; override them
 * (and add or remove accounts) in config.local.php under the 'users' key.
 */
const DEFAULT_USERS = [
    'gen@lrn.local' => ['username' => 'gen', 'name' => 'Gen Ong', 'role' => 'admin', 'password_hash' => '$2y$10$dJpIE5.2lt9kmc8mrD5.SeuqmyID0N.TcCoUBvDGCZpl2ROe/jPiK'],
    'chelsea@lrn.local' => ['username' => 'chelsea', 'name' => 'Chelsea Favila', 'role' => 'admin', 'password_hash' => '$2y$10$xwR/iCZY/VrReMPDPGtV/uNqPQ53kMhK.zZ8n5A4bffstSONeBiKG'],
    'margaret@lrn.local' => ['username' => 'margaret', 'name' => 'Margaret Santos', 'role' => 'admin', 'password_hash' => '$2y$10$Klf7UoI.9P8Ue2jiqgahrO0xAnNOnvKiN7RgdkUVMZnjwx4DMZ3R6'],
    'gemma@lrn.local' => ['username' => 'gemma', 'name' => 'Gemma Comission', 'role' => 'user', 'password_hash' => '$2y$10$.DjUeOQjP9pSqqvh21fOLeW60eoUgb5tz3EjcrruceK1R/JpJQcC6'],
];

/*
 * Approval routing (Requirements.xlsx › "Process for Uploading | Update"):
 *   Chelsea  → approved by Ms. Gen & Meg (Margaret)
 *   Margaret → approved by Ms. Gen & Chelsea
 */
const DEFAULT_APPROVERS = [
    'chelsea' => ['gen', 'margaret'],
    'margaret' => ['gen', 'chelsea'],
];

/*
 * Users whose saves are approved instantly (no approval step). Ms. Gen is the
 * top approver, so her price lists are exportable as soon as she saves them.
 */
const DEFAULT_AUTO_APPROVE = ['gen'];

/*
 * Countries a price list can be assigned to (upload and save dropdowns).
 * PLACEHOLDER: replace with the official list of 44 countries when it is provided,
 * either here or via 'countries' in config.local.php.
 */
/*
 * Price levels are numbered (Price Level 1, Price Level 2, …). Change the count here or set
 * 'price_levels' => 8 in config.local.php.
 */
const DEFAULT_PRICE_LEVEL_COUNT = 5;

const DEFAULT_COUNTRIES = [
    'Australia', 'Bahrain', 'Bangladesh', 'Belgium', 'Brunei', 'Cambodia', 'Canada', 'China', 'Egypt', 'France', 'Germany',
    'Hong Kong', 'India', 'Indonesia', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kuwait', 'Lebanon', 'Malaysia', 'Maldives',
    'Mexico', 'Myanmar', 'Netherlands', 'New Zealand', 'Oman', 'Pakistan', 'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore',
    'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'United Arab Emirates',
    'United Kingdom', 'United States', 'Vietnam',
];

/*
 * 'any' – one approval from the listed approvers makes the price list exportable.
 * 'all' – every listed approver must approve.
 */
const DEFAULT_APPROVAL_MODE = 'any';

$localConfiguration = is_file(__DIR__ . '/config.local.php')
    ? require __DIR__ . '/config.local.php'
    : [];
if (!is_array($localConfiguration)) $localConfiguration = [];

define('USERS', is_array($localConfiguration['users'] ?? null) ? $localConfiguration['users'] : DEFAULT_USERS);
define('APPROVERS', is_array($localConfiguration['approvers'] ?? null) ? $localConfiguration['approvers'] : DEFAULT_APPROVERS);
define('PRICE_LEVELS', array_map(
    fn(int $number) => "Price Level {$number}",
    range(1, max(1, min(50, (int) ($localConfiguration['price_levels'] ?? DEFAULT_PRICE_LEVEL_COUNT))))
));
define('COUNTRIES', array_values(array_unique(array_filter(array_map(
    fn($country) => trim((string) $country),
    is_array($localConfiguration['countries'] ?? null) ? $localConfiguration['countries'] : DEFAULT_COUNTRIES
)))));
define('AUTO_APPROVE_USERS', is_array($localConfiguration['auto_approve'] ?? null) ? array_map('strval', $localConfiguration['auto_approve']) : DEFAULT_AUTO_APPROVE);
define('APPROVAL_MODE', in_array($localConfiguration['approval_mode'] ?? '', ['any', 'all'], true) ? $localConfiguration['approval_mode'] : DEFAULT_APPROVAL_MODE);

/*
 * Developer tools (floating panel for wiping test data). Enabled by default for testing;
 * set 'dev_tools' => false in config.local.php before go-live.
 */
define('DEV_TOOLS_ENABLED', ($localConfiguration['dev_tools'] ?? true) === true);

define('DATABASE_CONFIG', array_replace([
    'host' => getenv('PLA_DB_HOST') ?: '',
    'database' => getenv('PLA_DB_NAME') ?: '',
    'username' => getenv('PLA_DB_USER') ?: '',
    'password' => getenv('PLA_DB_PASSWORD') ?: '',
    'trust_certificate' => filter_var(getenv('PLA_DB_TRUST_CERT') ?: 'true', FILTER_VALIDATE_BOOL),
], is_array($localConfiguration['database'] ?? null) ? $localConfiguration['database'] : []));
