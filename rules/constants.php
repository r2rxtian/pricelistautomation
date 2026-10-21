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

// This app's own tables (dbo.PLA_*, see sql/schema.sql).
const T_ROLES = 'dbo.PLA_Roles';
const T_USERS = 'dbo.PLA_Users';

// The company-wide HR master list this app does NOT own (same LRNPH_OJT database, maintained by
// another system). PLA_Users.employee_id matches its EmployeeID column; its BiometricsID column
// is the bridge from dbo.lrnph_users (see below). It is the single source of truth for names.
const T_MASTER_LIST = 'dbo.lrn_master_list';

// The company-wide login table this app does NOT own (shared by the internal apps). Its username
// column holds the person's biometrics number (= lrn_master_list.BiometricsID) and its password the
// company password hash. auth/login_handler.php bridges lrnph_users → lrn_master_list → PLA_Users.
const T_LRNPH_USERS = 'dbo.lrnph_users';

// Employees in this HR department get effective Admin access automatically at sign-in (same rule as
// QRTS), so IT can support the system. Their rows are provisioned in PLA_Users with the User role;
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
// Keys and values are PLA_Users.username.
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

// Price levels and customers: from "Requirements 17Oct2026.xlsx" › Price Level. These are the
// defaults; the live lists are edited in Config › Customers & price levels.
const PRICE_LEVELS = ['FOB Price', 'EU Direct Price', 'USA Direct Price', 'Valrhona Price', 'PH Price', 'CW Price'];

// Every customer buys at exactly one price level. All customers on a level share its prices; a
// customer can also have a few prices of its own.
// NOTE: customers took the place of the countries of the first version. In the code and the database
// they still use the old names: the 'countries' list type, dbo.PLA_Countries, country_id and the
// version field 'country' all hold the CUSTOMER.
const CUSTOMERS = [
    'F.Mayer' => 'FOB Price', 'Cnudde' => 'EU Direct Price', 'Snowcap' => 'USA Direct Price', 'Qualifirst' => 'USA Direct Price',
    'Sinodis' => 'FOB Price', 'Truebell' => 'FOB Price', 'EMF Trading' => 'FOB Price', 'LRN Europe' => 'FOB Price',
    'LRN Switzerland' => 'FOB Price', 'Prescott' => 'EU Direct Price', 'Valrhona' => 'Valrhona Price', 'Baker Patissier' => 'FOB Price',
    'Pandarusa' => 'FOB Price', 'La Rousse' => 'EU Direct Price', 'Selecta' => 'EU Direct Price', 'Nichifutsu' => 'FOB Price',
    'Sunin' => 'FOB Price', 'Minerva' => 'FOB Price', 'Galaxy Entertainment' => 'FOB Price', 'Pastry Pro' => 'FOB Price',
    'A La Carte' => 'EU Direct Price', 'Hanos' => 'EU Direct Price', 'Werdenberg' => 'PH Price', 'Guev Café' => 'PH Price',
    'Zermatt' => 'PH Price', 'Maiks' => 'PH Price', 'Aqua Asia' => 'PH Price', 'Golden Acres' => 'PH Price',
    'Food Fresh' => 'FOB Price', 'Indoguna' => 'FOB Price', 'Tehmag' => 'FOB Price', 'Global Food Product' => 'FOB Price',
    'Town & Country' => 'EU Direct Price', 'Ace Endico' => 'USA Direct Price', 'Atalanta' => 'USA Direct Price', 'Cambie' => 'FOB Price',
    'Chefs Warehouse' => 'CW Price', 'Fortune Fish' => 'USA Direct Price', 'Gourmet Kitchen' => 'USA Direct Price', 'LRN USA' => 'FOB Price',
    'Paris Gourmet' => 'FOB Price', 'Savory Gourmet' => 'USA Direct Price',
];

// Exports: the letterhead on top and the bank details at the bottom are chosen when exporting
// (Requirements 17Oct2026 › "header & footer selection"). Edit the wording here.
const EXPORT_LETTERHEADS = [
    'SP' => ['label' => 'Swiss Patissiers Limited', 'lines' => [
        'Swiss Patissiers Limited',
        'RM1516, 15/F., Corporation Square, 8 Lam Lok Street, Kowloon Bay, Hong Kong',
    ]],
    'LRNPH' => ['label' => 'La Rose Noire Philippines', 'lines' => [
        'La Rose Noire Philippines, INC.',
        'Lot 1 - A & B, Clark IE-05 Area, M.A Roxas Highway, Clark Freeport Zone, Philippines',
        'Tel: +63 45 499-3010 · Fax: +63 45 499 2346 · Email: office@la-rose-noire.com',
    ]],
];
const EXPORT_BANK_DETAILS = [
    'SP' => ['label' => 'Swiss Patissiers (USD)', 'rows' => [
        ['Beneficiary Name', 'Swiss Patissiers Limited'],
        ['Beneficiary’s Bank', 'Standard Chartered Bank (Hong Kong) Limited'],
        ['Bank account no', '578-1-010124-3'],
        ['Account Currency', 'USD'],
        ['Address of Beneficiary', 'RM1516, 15/F., Corporation Square, 8 Lam Lok Street, Kowloon Bay, Hong Kong'],
        ['Address of Bank', '15/F, Standard Chartered Tower, 388 Kwun Tong Road, Kwun Tong, Kowloon, Hong Kong'],
        ['Bank’s Swift Code', 'SCBLHKHH'],
    ]],
    'LRNPH USD' => ['label' => 'La Rose Noire PH (USD)', 'rows' => [
        ['Beneficiary’s Name', 'La Rose Noire Philippines Inc.'],
        ['Beneficiary’s Address', 'Lot 1-A&B, Clark IE-05 Area, M.A Roxas Highway Clark Freeport Zone Philippines'],
        ['Beneficiary’s Bank', 'Metropolitan Bank & Trust Company'],
        ['Bank account no', '377-2-37700867-1'],
        ['Address of Bank', 'The Pavilion Mall Philexcel Business Park, Clark Freeport Zone, Philippines'],
        ['Bank’s Swift Code', 'MBTCPHMM'],
    ]],
    'LRNPH PHP' => ['label' => 'La Rose Noire PH (PHP)', 'rows' => [
        ['Beneficiary’s Account Name', 'PHP Savings Account'],
        ['Beneficiary’s Name', 'La Rose Noire Philippines Inc'],
        ['Beneficiary’s Address', 'Lot 1 A&B, Clark IE-05 Area, MA Roxas Highway, Clark Freeport Zone'],
        ['Account Number', '377-7-37701111-9'],
        ['Beneficiary’s Bank Name', 'Metropolitan Bank and Trust Company'],
        ['Bank Address', 'CM Rector Highway, Clark Freeport Zone'],
        ['Beneficiary Bank Swift Code', 'MBTCPHMM'],
    ]],
];

// Activity the browser may log on its own (everything else is logged by the server).
// Edits are no longer logged as they happen (the save records them); the old types stay accepted for
// pages still open on the previous script.
const CLIENT_AUDIT_TYPES = ['import_workbook', 'price_adjust', 'cell_edit', 'reset_prices', 'discard_changes'];

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
