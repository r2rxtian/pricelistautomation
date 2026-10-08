<?php
declare(strict_types=1);
/**
 * Shared constants: table names and the business rules from Requirements.xlsx.
 * Connection settings and per-server switches (storage driver, dev tools) live in conn/config.php.
 */

require_once __DIR__ . '/../conn/db.php';

const APP_NAME = 'PLA · Price List Automation';
define('APP_ROOT', dirname(__DIR__));
define('STORAGE_FILE', APP_ROOT . '/storage/app.json');

// The DB server runs on Philippine time; keep PHP on the same clock.
date_default_timezone_set('Asia/Manila');

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

// This app's own tables (dbo.PLA_ACD_*, see sql/schema.sql).
const T_ROLES = 'dbo.PLA_ACD_Roles';
const T_USERS = 'dbo.PLA_ACD_Users';

// The company-wide HR master list this app does NOT own (same LRNPH_OJT database, maintained by
// another system). PLA_ACD_Users.employee_id matches its EmployeeID column; its BiometricsID column
// is the bridge from dbo.lrnph_users (see below). It is the single source of truth for names.
const T_MASTER_LIST = 'dbo.lrn_master_list';

// The company-wide login table this app does NOT own (shared by the internal apps). Its username
// column holds the person's biometrics number (= lrn_master_list.BiometricsID) and its password the
// company password hash. auth/login_handler.php bridges lrnph_users → lrn_master_list → PLA_ACD_Users.
const T_LRNPH_USERS = 'dbo.lrnph_users';

// Employees in this HR department get effective Admin access automatically at sign-in (same rule as
// QRTS), so IT can support the system. Their rows are provisioned in PLA_ACD_Users with the User role;
// they are never approvers. Set to '' to turn this off.
const IT_ADMIN_DEPARTMENT = 'Information Technology Department - LRN';

function isItDepartmentAdmin(?string $department): bool
{
    return IT_ADMIN_DEPARTMENT !== '' && trim((string) $department) === IT_ADMIN_DEPARTMENT;
}

/** "Firstname Lastname" from a lrn_master_list row aliased $alias. */
function masterListNameSql(string $alias = 'ml'): string
{
    return "LTRIM(RTRIM(CONCAT($alias.FirstName, ' ', $alias.LastName)))";
}

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

// ---------------------------------------------------------------------------
// Approval routing (Requirements.xlsx › "Process for Uploading | Update")
//   Chelsea  → approved by Ms. Gen & Meg (Margaret)
//   Margaret → approved by Ms. Gen & Chelsea
// Keys and values are PLA_ACD_Users.username.
// ---------------------------------------------------------------------------

const APPROVERS = [
    'chelsea' => ['gen', 'margaret'],
    'margaret' => ['gen', 'chelsea'],
];

// Users whose saves are approved instantly (no approval step): Ms. Gen is the top approver.
const AUTO_APPROVE_USERS = ['gen'];

// 'any' – one approval from the listed approvers is enough; 'all' – every listed approver must approve.
const APPROVAL_MODE = 'any';

// ---------------------------------------------------------------------------
// Price lists
// ---------------------------------------------------------------------------

// Price levels are numbered: Price Level 1 … Price Level N.
const PRICE_LEVEL_COUNT = 5;
define('PRICE_LEVELS', array_map(fn(int $n) => "Price Level {$n}", range(1, PRICE_LEVEL_COUNT)));

// Countries a price list can be assigned to (upload and save dropdowns).
// PLACEHOLDER: replace with the official list of 44 countries when it is provided.
const COUNTRIES = [
    'Australia', 'Bahrain', 'Bangladesh', 'Belgium', 'Brunei', 'Cambodia', 'Canada', 'China', 'Egypt', 'France', 'Germany',
    'Hong Kong', 'India', 'Indonesia', 'Israel', 'Italy', 'Japan', 'Jordan', 'Kuwait', 'Lebanon', 'Malaysia', 'Maldives',
    'Mexico', 'Myanmar', 'Netherlands', 'New Zealand', 'Oman', 'Pakistan', 'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore',
    'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Switzerland', 'Taiwan', 'Thailand', 'Turkey', 'United Arab Emirates',
    'United Kingdom', 'United States', 'Vietnam',
];

// Activity the browser may log on its own (everything else is logged by the server).
const CLIENT_AUDIT_TYPES = ['import_workbook', 'price_adjust', 'cell_edit', 'reset_prices'];

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const AUDIT_LOG_LIMIT = 5000;
const NOTIFICATION_LIMIT_PER_USER = 200;
const SUPERSEDED_KEEP_PER_LIST = 5;

// Photo library and per-product-type photos (paths are relative to the project root).
const LIBRARY_DIR = 'storage/product-library';
const GROUP_IMAGE_DIR = 'storage/product-images';

define('STORAGE_DRIVER', defined('PLA_STORAGE_DRIVER') && PLA_STORAGE_DRIVER === 'sqlserver' ? 'sqlserver' : 'json');
define('DEV_TOOLS_ENABLED', defined('PLA_DEV_TOOLS') && PLA_DEV_TOOLS === true);
