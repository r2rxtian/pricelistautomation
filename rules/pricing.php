<?php
declare(strict_types=1);
/**
 * Pricing: how every price is worked out and changed. One list of products with standard (base)
 * prices, from which every price level and customer is worked out (Requirements 17Oct2026: each
 * customer buys at one price level). The tables themselves are read and written in conn/pricing_tables.php.
 *
 * (This was first called the "masterlist". That word remains only in saved data, e.g. the id
 * 'masterlist' of the standard prices list and the version fields masterlistBatch / masterlistEdits,
 * so records saved earlier still open. Don't rename those values.)
 *
 * A price level's price for a product is
 *   1. the price set for that product in that level (PLA_PriceOverrides, country_id NULL), or
 *   2. the standard price × every matching % rule (PLA_PriceRules: per price level, customer and/or
 *      category; rules that match together multiply, e.g. +5% and +3% = +8.15%).
 * A customer's price is
 *   1. the price set for that product for that customer (PLA_PriceOverrides), or
 *   2. its price level's own price × the customer's own % rules, or
 *   3. the standard price × every matching % rule (the level's and the customer's).
 * Only prices are set per level or customer; descriptions, sizes and the rest come from the masterlist.
 *
 * Customers are the old "countries" (country_id, the version field 'country'): see constants.php.
 * In the app a list is a "version" like an uploaded file (same rows, editor and export), with the id
 * list-<customerId>-<priceLevelId>, where customer 0 = the price level itself (all its customers);
 * the masterlist is the id 'masterlist'. Saving price changes makes a normal pending version (rows +
 * the edits it makes); approving it applies the edits.
 * SQL Server only (conn/config.php › PLA_STORAGE_DRIVER = 'sqlserver').
 */

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/customers.php';
require_once __DIR__ . '/workbook_import.php';
require_once __DIR__ . '/../conn/pricing_tables.php';

const STANDARD_PRICES_ID = 'masterlist';  // saved-data value: keep as is (see above)
const PRICE_LIST_NAME = 'Price list';
const LIST_VIEW_NAME = 'Price list';
const PRICE_COLUMNS = [8, 9];               // Price/pc, Price/box (normalized columns)
const MOQ_TOTAL_COLUMN = 17;                // Total Price Based on MOQ: follows Price/box
const UPLOAD_PREVIEW_LIMIT = 300;           // rows listed per section of an upload preview

function pricing_enabled(): bool
{
    return STORAGE_DRIVER === 'sqlserver';
}

function pricing_list_id(int $countryId, int $levelId): string
{
    return "list-{$countryId}-{$levelId}";
}

/** [countryId, levelId] for a list id, or null. */
function pricing_parse_list_id(string $id): ?array
{
    return preg_match('/^list-(\d{1,9})-(\d{1,9})$/D', $id, $m) ? [(int) $m[1], (int) $m[2]] : null;
}

function pricing_is_virtual_id(string $id): bool
{
    return $id === STANDARD_PRICES_ID || pricing_parse_list_id($id) !== null;
}

function pricing_round(?float $value): ?float
{
    return $value === null ? null : round(max(0.0, $value), 4);
}

function pricing_same_price(mixed $a, mixed $b): bool
{
    $blank = fn($v) => $v === null || $v === '';
    if ($blank($a) || $blank($b)) return $blank($a) && $blank($b);
    return is_numeric($a) && is_numeric($b) && abs((float) $a - (float) $b) < 0.00005;
}

/**
 * The combined rule multiplier for one product category in one list (customer 0 = the price level:
 * only rules for every customer count). $customerOnly: just the rules made for this one customer.
 */
function pricing_factor(array $rules, int $countryId, int $levelId, string $category, bool $customerOnly = false): float
{
    $factor = 1.0;
    foreach ($rules as $rule) {
        if ($customerOnly && $rule['countryId'] === null) continue;
        if ($rule['countryId'] !== null && $rule['countryId'] !== $countryId) continue;
        if ($rule['levelId'] !== null && $rule['levelId'] !== $levelId) continue;
        if ($rule['category'] !== null && mb_strtolower($rule['category']) !== mb_strtolower($category)) continue;
        $factor *= 1 + $rule['percent'] / 100;
    }
    return $factor;
}

/** "Chefs Warehouse" or "All customers": who a list's prices are for. */
function pricing_list_label(array $list): string
{
    return trim((string) ($list['country'] ?? '')) !== '' ? (string) $list['country'] : 'All customers';
}

/** "Chefs Warehouse · CW Price" or "CW Price (all customers)": a list in words. */
function pricing_list_name(array $list): string
{
    return trim((string) ($list['country'] ?? '')) !== '' ? "{$list['country']} · {$list['priceLevel']}" : "{$list['priceLevel']} (all customers)";
}

/** A product as a normalized price list row, with the given prices for a country and level. */
function pricing_row(array $product, ?float $pricePc, ?float $priceBox, string $country = '', string $level = ''): array
{
    $width = count(price_list_template()['normalizedHeaders']);
    $row = array_slice(array_pad(array_values($product['row']), $width, ''), 0, $width);
    $row[0] = $product['category'];
    $row[1] = $product['code'];
    $row[8] = $pricePc ?? '';
    $row[9] = $priceBox ?? '';
    // The MOQ total is price/box × MOQ in the template: it moves with the price/box.
    $row[MOQ_TOTAL_COLUMN] = pricing_moq_total($product['row'], $priceBox, $product['priceBox'] ?? null);
    $row[19] = $level;
    $row[20] = $country;
    return $row;
}

/**
 * Presentation Stands › "Total Price Based on MOQ": Price/box × the MOQ quantity ("10 Sets" → 10). A MOQ
 * without a number keeps the uploaded total, moved in proportion to the price (against the Price/box the
 * row was saved with: the level's file, or the product list).
 */
function pricing_moq_total(array $savedRow, ?float $priceBox, ?float $fallbackBox = null): mixed
{
    $total = $savedRow[MOQ_TOTAL_COLUMN] ?? '';
    if ($priceBox !== null && preg_match('/\d+(?:\.\d+)?/', (string) ($savedRow[15] ?? ''), $m) && (float) $m[0] > 0) {
        return round($priceBox * (float) $m[0], 2);
    }
    $savedBox = is_numeric($savedRow[9] ?? null) ? (float) $savedRow[9] : (float) ($fallbackBox ?? 0);
    return is_numeric($total) && $priceBox !== null && $savedBox > 0 ? round((float) $total * $priceBox / $savedBox, 2) : $total;
}

/** A version-shaped record for the editor and export (no approvals: it is the live list). */
function pricing_version_shell(string $id, string $kind, string $name, string $country, string $level, array $rows, string $savedAt, string $savedBy): array
{
    $categories = array_values(array_unique(array_map(fn($row) => (string) $row[0], $rows)));
    return [
        'id' => $id, 'source' => 'masterlist', 'kind' => $kind, 'name' => $name, 'country' => $country, 'priceLevel' => $level,
        'revision' => 1, 'status' => 'approved',
        'headers' => price_list_template()['normalizedHeaders'], 'rows' => $rows, 'priceColumns' => PRICE_COLUMNS,
        'adjustment' => 0.0, 'categoryAdjustments' => [],
        'summary' => ['totalProducts' => count($rows), 'totalAdjustedProducts' => 0, 'adjustedCategories' => []],
        'changes' => [], 'changeCount' => 0, 'productCount' => count($rows), 'categories' => $categories,
        'savedAt' => $savedAt, 'savedBy' => $savedBy, 'savedByUser' => '',
        'requiredApprovers' => [], 'approvals' => [], 'approvedAt' => $savedAt, 'approvedBy' => $savedBy,
        'rejectedAt' => null, 'rejectedBy' => null, 'rejectionRemarks' => null, 'basedOn' => null,
        'templateVersion' => price_list_template()['version'],
    ];
}

/** Who last changed the masterlist and when (its latest upload or approved change). */
function pricing_last_saved(): array
{
    // Once per request: it is asked for by every list worked out in it.
    static $last = null;
    if ($last !== null) return $last;
    // The newest upload or approved change of the price list: its prices changed then. (Any change
    // counts, so a list someone opened earlier is fetched again once prices moved.)
    $latest = null;
    foreach (repo_list_version_summaries() as $v) {
        if (!in_array($v['kind'] ?? '', ['masterlist', 'batch', 'list', 'rules'], true)) continue;
        if (!in_array($v['status'], ['uploaded', 'approved', 'superseded'], true)) continue;
        $at = (string) ($v['approvedAt'] ?? '') ?: (string) $v['savedAt'];
        if ($latest === null || strcmp($at, $latest['at']) > 0) $latest = ['at' => $at, 'by' => (string) ($v['approvedBy'] ?? '') ?: (string) $v['savedBy']];
    }
    if ($latest) return $last = $latest;
    $update = pricing_db_last_update();
    return $last = ['at' => $update['updatedAt'] ?? '', 'by' => ''];
}

/** The masterlist as a list: every product at its base price. */
function pricing_base_version(): array
{
    $rows = array_map(fn($p) => pricing_row($p, $p['pricePc'], $p['priceBox']), pricing_db_products());
    $last = pricing_last_saved();
    $version = pricing_version_shell(STANDARD_PRICES_ID, 'masterlist', PRICE_LIST_NAME, '', '', $rows, $last['at'], $last['by']);
    $version['priceOnly'] = false;
    $version['changeMark'] = pricing_db_latest_change_id();
    return $version;
}

/**
 * Every product's price in one list: ['product', 'rulePc', 'ruleBox', 'pricePc', 'priceBox', 'own'].
 * 'rule…' is the price the list follows when it has none of its own (for a customer: its price
 * level's); 'own' is the override record when the list has its own price for the product.
 */
function pricing_list_prices(int $countryId, int $levelId, bool $all = false): array
{
    // $all: every product, also the ones not in this list (to add one through a customer's own price).
    $rules = pricing_db_rules();
    $overrides = pricing_db_overrides($countryId, $levelId);
    // A price level's list is exactly its uploaded file (its rows); a customer has its level's
    // products at the level's prices, with its own % on top, plus any prices of its own.
    $levelPrices = $countryId === 0 ? $overrides : pricing_db_overrides(0, $levelId);
    $prices = [];
    foreach (pricing_db_products() as $p) {
        $level = $levelPrices[$p['id']] ?? null;
        if (!$all && $level === null && !isset($overrides[$p['id']])) continue; // not in this level's file
        if ($level !== null && $level['row']) {
            // The product as this level's file has it.
            $p['row'] = $level['row'];
            $p['category'] = (string) ($level['row'][0] ?? '') ?: $p['category'];
            $p['description'] = (string) ($level['row'][2] ?? '') ?: $p['description'];
            $p['group'] = (string) ($level['row'][18] ?? '') ?: $p['group'];
        }
        // A customer's own details (its own uploaded file, or edited just for it) come before the level's.
        $mine = $countryId !== 0 ? ($overrides[$p['id']]['row'] ?? null) : null;
        if ($mine) {
            $p['row'] = $mine;
            $p['category'] = (string) ($mine[0] ?? '') ?: $p['category'];
            $p['description'] = (string) ($mine[2] ?? '') ?: $p['description'];
            $p['group'] = (string) ($mine[18] ?? '') ?: $p['group'];
        }
        $p['levelSort'] = $level['sort'] ?? (1000000 + $p['sort']);
        $factor = pricing_factor($rules, $countryId, $levelId, $p['category']);
        $customerFactor = $countryId === 0 ? 1.0 : pricing_factor($rules, $countryId, $levelId, $p['category'], true);
        $follow = function (string $field) use ($p, $level, $factor, $customerFactor): ?float {
            if ($level !== null && $level[$field] !== null) return pricing_round($level[$field] * $customerFactor);
            return $p[$field] === null ? null : pricing_round($p[$field] * $factor);
        };
        $rulePc = $follow('pricePc');
        $ruleBox = $follow('priceBox');
        $own = $countryId === 0 ? $level : ($overrides[$p['id']] ?? null);
        $prices[$p['code']] = [
            'product' => $p, 'rulePc' => $rulePc, 'ruleBox' => $ruleBox,
            'pricePc' => $own['pricePc'] ?? $rulePc, 'priceBox' => $own['priceBox'] ?? $ruleBox, 'own' => $own,
            'inLevel' => $level !== null,
        ];
    }
    // In the order of the level's file.
    uasort($prices, fn($a, $b) => $a['product']['levelSort'] <=> $b['product']['levelSort']);
    return $prices;
}

/**
 * One price level (customer 0) or one customer on its price level, or null when either doesn't exist
 * or the customer buys at another level.
 */
function pricing_list_version(int $countryId, int $levelId): ?array
{
    $levels = pricing_db_option_ids('priceLevels');
    if (!isset($levels[$levelId])) return null;
    $customer = '';
    if ($countryId !== 0) {
        $entry = null;
        foreach (database_get_list_options('countries') ?? [] as $option) if ($option['id'] === $countryId) $entry = $option;
        if (!$entry || $entry['levelId'] !== $levelId) return null;
        $customer = $entry['name'];
    }
    $rows = [];
    $own = [];
    $latest = pricing_last_saved();
    foreach (pricing_list_prices($countryId, $levelId) as $code => $price) {
        $rows[] = pricing_row($price['product'], $price['pricePc'], $price['priceBox'], $customer, $levels[$levelId]);
        if (!$price['own']) continue;
        if ($price['own']['setAt'] > $latest['at']) $latest = ['at' => $price['own']['setAt'], 'by' => $price['own']['setBy']];
        // A customer's own prices are marked in its list (the level's are simply its file).
        if ($countryId !== 0) {
            $own[$code] = [
                'pc' => $price['own']['pricePc'] !== null, 'box' => $price['own']['priceBox'] !== null,
                'rulePc' => $price['rulePc'], 'ruleBox' => $price['ruleBox'],
                'setAt' => $price['own']['setAt'], 'setBy' => $price['own']['setBy'], 'baseChanged' => false,
            ];
        }
    }
    $version = pricing_version_shell(pricing_list_id($countryId, $levelId), 'list', LIST_VIEW_NAME, $customer, $levels[$levelId], $rows, $latest['at'], $latest['by']);
    $version['ownPrices'] = $own;
    $version['priceOnly'] = true;
    $version['levelWide'] = $countryId === 0;
    // Changes applied after this one are someone else's: the open editor is told (api/app/presence.php).
    $version['changeMark'] = pricing_db_latest_change_id();
    return $version;
}

/** The live masterlist or list for an id ('masterlist' or list-<c>-<l>), or null. */
function pricing_virtual_version(string $id): ?array
{
    if (!pricing_enabled()) return null;
    if ($id === STANDARD_PRICES_ID) return pricing_base_version();
    $ids = pricing_parse_list_id($id);
    return $ids ? pricing_list_version($ids[0], $ids[1]) : null;
}

/** [countryId, levelId] for names (any case), or null when either isn't in Config. */
function pricing_option_pair(string $country, string $level): ?array
{
    $countryId = pricing_option_id('countries', $country);
    $levelId = pricing_option_id('priceLevels', $level);
    return $countryId === null || $levelId === null ? null : [$countryId, $levelId];
}

/** The id of a country or price level by name (any case), or null. */
function pricing_option_id(string $type, string $name): ?int
{
    $id = array_search(mb_strtolower(trim($name)), array_map('mb_strtolower', pricing_db_option_ids($type)), true);
    return $id === false ? null : (int) $id;
}

/**
 * Light summaries of the masterlist, every switched-on price level and every customer on it, for the
 * Files page and the list switcher (the rows are fetched when a list is opened).
 */
function pricing_summaries(): array
{
    if (!pricing_enabled()) return [];
    $products = pricing_db_products();
    $count = count($products);
    $categories = array_values(array_unique(array_map(fn($p) => $p['category'], $products)));
    $last = pricing_last_saved();
    $counts = pricing_db_override_counts();
    $changed = pricing_db_last_changes();
    // Each list carries only what the page uses; the rows come when one is opened.
    $base = fn(string $id, string $kind, string $name, string $country, string $level) => [
        'id' => $id, 'source' => 'masterlist', 'kind' => $kind, 'name' => $name, 'country' => $country, 'priceLevel' => $level,
        'status' => 'approved', 'savedAt' => $last['at'],
    ];
    $summaries = [$base(STANDARD_PRICES_ID, 'masterlist', PRICE_LIST_NAME, '', '') + [
        'productCount' => $count, 'categories' => $categories, 'savedBy' => $last['by'], 'approvedAt' => $last['at'], 'approvedBy' => $last['by'],
    ]];
    $customers = array_filter(database_get_list_options('countries') ?? [], fn($o) => $o['active'] && $o['levelId'] !== null);
    foreach (database_get_list_options('priceLevels') ?? [] as $level) {
        if (!$level['active']) continue;
        // The price level itself (every customer on it), then its customers.
        $onLevel = array_filter($customers, fn($c) => $c['levelId'] === $level['id']);
        $summary = $base(pricing_list_id(0, $level['id']), 'list', LIST_VIEW_NAME, '', $level['name']) + ['levelWide' => true, 'customerCount' => count($onLevel)];
        if (!empty($counts['0-' . $level['id']])) $summary['ownPriceCount'] = $counts['0-' . $level['id']];
        // When this level's file last changed, and by whom.
        if (isset($changed['0-' . $level['id']])) $summary = ['savedAt' => $changed['0-' . $level['id']]['at'], 'savedBy' => $changed['0-' . $level['id']]['by']] + $summary;
        $summaries[] = $summary;
        foreach ($onLevel as $customer) {
            $summary = $base(pricing_list_id($customer['id'], $level['id']), 'list', LIST_VIEW_NAME, $customer['name'], $level['name']);
            if (!empty($counts[$customer['id'] . '-' . $level['id']])) $summary['ownPriceCount'] = $counts[$customer['id'] . '-' . $level['id']];
            if (isset($changed[$customer['id'] . '-' . $level['id']])) $summary = ['savedAt' => $changed[$customer['id'] . '-' . $level['id']]['at'], 'savedBy' => $changed[$customer['id'] . '-' . $level['id']]['by']] + $summary;
            $summaries[] = $summary;
        }
    }
    return $summaries;
}

// ---------------------------------------------------------------------------
// Changes made in the editor (saved for approval, applied when approved)
// ---------------------------------------------------------------------------

/** The rows a save shows: its rows with any % adjustments applied, as the editor does (4 decimals). */
function pricing_effective_rows(array $rows, float $adjustment, array $categoryAdjustments): array
{
    return array_map(function (array $row) use ($adjustment, $categoryAdjustments) {
        $rate = (float) ($categoryAdjustments[trim((string) ($row[0] ?? ''))] ?? $adjustment);
        if ($rate === 0.0) return $row;
        foreach (PRICE_COLUMNS as $col) {
            if (is_numeric($row[$col] ?? null)) $row[$col] = round(max(0.0, (float) $row[$col] * (1 + $rate / 100)), 4);
        }
        return $row;
    }, $rows);
}

/** Header names of the normalized columns (for change records and messages). */
function pricing_column_name(int $col): string
{
    $names = price_list_template()['normalizedHeaders'];
    return $col === 3 ? 'Column D' : ($col === 16 ? 'Column Q' : (string) ($names[$col] ?? "Column {$col}"));
}

/**
 * The edits a save makes to a list or the masterlist ($live = its current version), or a message
 * saying why it can't be saved. Rows are matched by product code; products can't be added or removed
 * in the editor (that is what a masterlist upload is for), and lists only change prices.
 * @return array{edits: array, error: ?string}
 */
function pricing_edits(array $live, array $rows): array
{
    $before = [];
    foreach ($live['rows'] as $row) $before[mb_strtolower((string) $row[1])] = $row;
    $edits = [];
    $seen = [];
    foreach ($rows as $row) {
        $key = mb_strtolower((string) ($row[1] ?? ''));
        $old = $before[$key] ?? null;
        if ($old === null) return ['edits' => [], 'error' => "Product '{$row[1]}' is not in the price list. Add new products by uploading an updated price list."];
        $seen[$key] = true;
        $edit = ['code' => (string) $old[1], 'description' => (string) $old[2], 'category' => (string) $old[0], 'prices' => [], 'fields' => []];
        foreach ([8 => 'pricePc', 9 => 'priceBox'] as $col => $field) {
            $new = is_numeric($row[$col] ?? null) ? pricing_round((float) $row[$col]) : null;
            $was = is_numeric($old[$col] ?? null) ? (float) $old[$col] : null;
            if (!pricing_same_price($new, $was)) $edit['prices'][$field] = ['old' => $was, 'new' => $new];
        }
        // Other cells: only the masterlist may change them (the MOQ total follows the price; codes, the
        // category and the country / level columns are fixed).
        foreach ($old as $col => $oldValue) {
            if (in_array($col, [0, 1, 8, 9, MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
            $newValue = $row[$col] ?? '';
            if (trim((string) $newValue) === trim((string) $oldValue)) continue;
            if ($live['kind'] !== 'masterlist') {
                return ['edits' => [], 'error' => "Only prices can be changed for a price level or customer. '" . pricing_column_name($col) . "' of {$old[1]} is shared by every price level: it comes from the uploaded workbook."];
            }
            $edit['fields'][] = ['col' => $col, 'name' => pricing_column_name($col), 'old' => $oldValue, 'new' => $newValue];
        }
        if ($edit['prices'] || $edit['fields']) $edits[] = $edit;
    }
    if (count($seen) !== count($before)) return ['edits' => [], 'error' => 'Products cannot be removed in the editor. Remove them by uploading an updated price list.'];
    return ['edits' => $edits, 'error' => null];
}

/**
 * Applies an approved change (a version saved from the masterlist or a list) and records what it
 * changed. Edits were worked out when it was saved, so only what the person changed is applied.
 */
function pricing_apply_version(array $version, string $by): void
{
    if (($version['kind'] ?? '') === 'batch') {
        if (is_array($version['masterlistBatch'] ?? null)) pricing_apply_batch($version['masterlistBatch'], $version['id'], $by);
        return;
    }
    $edits = is_array($version['masterlistEdits'] ?? null) ? $version['masterlistEdits'] : [];
    if (!$edits) return;
    if (($version['kind'] ?? '') === 'masterlist') {
        pricing_apply_base_edits($edits, $version['id'], $by);
        return;
    }
    $pair = pricing_parse_list_id((string) ($version['basedOn'] ?? ''));
    if (!$pair) return;
    $prices = [];
    foreach ($edits as $edit) {
        $prices[$edit['code']] = array_map(fn($p) => $p['new'], $edit['prices']);
    }
    pricing_set_list_prices($pair[0], $pair[1], $prices, $version['id'], $by);
}

/** Masterlist edits: new base prices and details for existing products. */
function pricing_apply_base_edits(array $edits, string $versionId, string $by): void
{
    $products = [];
    foreach (pricing_db_products() as $p) $products[mb_strtolower($p['code'])] = $p;
    $upserts = [];
    $changes = [];
    foreach ($edits as $edit) {
        $p = $products[mb_strtolower($edit['code'])] ?? null;
        if (!$p) continue;
        foreach ($edit['prices'] as $field => $price) {
            $changes[] = ['kind' => 'base', 'code' => $p['code'], 'category' => $p['category'], 'field' => $field === 'pricePc' ? 'price_pc' : 'price_box', 'old' => $p[$field], 'new' => $price['new']];
            if ($field === 'priceBox' && is_numeric($p['row'][MOQ_TOTAL_COLUMN] ?? null) && $p['priceBox'] > 0 && $price['new'] !== null) {
                $p['row'][MOQ_TOTAL_COLUMN] = round((float) $p['row'][MOQ_TOTAL_COLUMN] * $price['new'] / $p['priceBox'], 2);
            }
            $p[$field] = $price['new'];
        }
        foreach ($edit['fields'] as $field) {
            $changes[] = ['kind' => 'field', 'code' => $p['code'], 'category' => $p['category'], 'field' => $field['name'], 'old' => $field['old'], 'new' => $field['new']];
            $p['row'][$field['col']] = $field['new'];
        }
        $p['row'][8] = $p['pricePc'] ?? '';
        $p['row'][9] = $p['priceBox'] ?? '';
        $p['description'] = (string) ($p['row'][2] ?? $p['description']);
        $p['group'] = (string) ($p['row'][18] ?? $p['group']);
        $upserts[] = $p;
    }
    pricing_db_transaction(function (PDO $db) use ($upserts, $changes, $versionId) {
        pricing_db_write_products($db, $upserts, [], $versionId);
        pricing_db_record_changes($db, $versionId, $changes);
    });
}

/**
 * Sets the prices shown in one list. $prices: code => ['pricePc' => ?float, 'priceBox' => ?float]
 * (a missing key leaves that price as it is). A price equal to the masterlist + rules price is not
 * stored, so the product follows the masterlist again. Returns the change records written.
 */
function pricing_set_list_prices(int $countryId, int $levelId, array $prices, string $versionId, string $by, bool $keepAll = false): array
{
    // A price level's prices are its file's: kept as they are, even one equal to the reference price
    // (dropping it would take the product out of the level's list). $keepAll does the same for others.
    $keepAll = $keepAll || $countryId === 0;
    $current = pricing_list_prices($countryId, $levelId, $countryId !== 0);
    $index = [];
    foreach ($current as $code => $entry) $index[mb_strtolower($code)] = $entry;
    $writes = [];
    $changes = [];
    foreach ($prices as $code => $set) {
        $entry = $index[mb_strtolower((string) $code)] ?? null;
        if (!$entry) continue;
        $p = $entry['product'];
        $next = ['pricePc' => $entry['pricePc'], 'priceBox' => $entry['priceBox']];
        foreach (['pricePc', 'priceBox'] as $field) {
            if (!array_key_exists($field, $set)) continue;
            if (!pricing_same_price($set[$field], $entry[$field])) {
                $changes[] = ['kind' => 'override', 'code' => $p['code'], 'countryId' => $countryId ?: null, 'levelId' => $levelId, 'category' => $p['category'],
                    'field' => $field === 'pricePc' ? 'price_pc' : 'price_box', 'old' => $entry[$field], 'new' => $set[$field]];
            }
            $next[$field] = $set[$field];
        }
        // (A customer's product that isn't in its level's file stays only through its own price.)
        $keep = $keepAll || empty($entry['inLevel']);
        $own = [
            'pricePc' => !$keep && pricing_same_price($next['pricePc'], $entry['rulePc']) ? null : $next['pricePc'],
            'priceBox' => !$keep && pricing_same_price($next['priceBox'], $entry['ruleBox']) ? null : $next['priceBox'],
            'basePc' => $p['pricePc'], 'baseBox' => $p['priceBox'],
        ];
        $had = $entry['own'] !== null;
        if ($own['pricePc'] === null && $own['priceBox'] === null && !$had) continue;
        if ($keep && $had && pricing_same_price($own['pricePc'], $entry['own']['pricePc']) && pricing_same_price($own['priceBox'], $entry['own']['priceBox'])) continue;
        $writes[$p['id']] = $own;
    }
    pricing_db_transaction(function (PDO $db) use ($countryId, $levelId, $writes, $changes, $versionId, $by) {
        pricing_db_write_overrides($db, $countryId, $levelId, $writes, $versionId, $by);
        pricing_db_record_changes($db, $versionId, $changes);
    });
    return $changes;
}

// ---------------------------------------------------------------------------
// The masterlist as one file: edits to its base prices and to any number of price level and customer
// lists, plus % changes for many lists at once, saved together as one change (one approval).
//   - a % (on a list, on a whole price level, or on picked customers) becomes a price rule, so those
//     lists keep following the masterlist; prices set by hand there move by the same %;
//   - a price typed in a list becomes that list's own price.
// ---------------------------------------------------------------------------

/** "Every customer · FOB Price · Breads": a rule scope in words. */
function pricing_scope_label(?int $countryId, ?int $levelId, ?string $category): string
{
    $countries = pricing_db_option_ids('countries');
    $levels = pricing_db_option_ids('priceLevels');
    return implode(' · ', [
        $countryId === null ? 'Every customer' : ($countries[$countryId] ?? '?'),
        $levelId === null ? 'every price level' : ($levels[$levelId] ?? '?'),
        $category ?? 'all categories',
    ]);
}

/** The combined % factor of the batch's rule changes for one product category in one list. */
function pricing_ops_factor(array $ops, int $countryId, int $levelId, string $category): float
{
    $factor = 1.0;
    foreach ($ops as $op) {
        if ($op['countryId'] !== null && $op['countryId'] !== $countryId) continue;
        if ($op['levelId'] !== null && $op['levelId'] !== $levelId) continue;
        if ($op['category'] !== null && mb_strtolower($op['category']) !== mb_strtolower($category)) continue;
        $factor *= 1 + $op['percent'] / 100;
    }
    return $factor;
}

/** Same cell value: prices by amount, other cells as text. */
function pricing_same_cell(int $col, mixed $a, mixed $b): bool
{
    if (trim((string) $a) === trim((string) $b)) return true;
    return in_array($col, PRICE_COLUMNS, true) && pricing_same_price($a, $b);
}

/**
 * Two people in one list. $opened: the rows as this person's editor showed them when they opened the
 * list; $mine: the rows as they are now. Only what this person changed since opening counts: their
 * changed cells go on top of the list as it is now ($liveRows), so prices someone else changed in the
 * meantime stay as they are instead of being put back.
 * A cell both changed, to different values, is a conflict. $resolve: 'mine' keeps this person's value,
 * 'theirs' keeps the current one, 'ask' keeps this person's and lists it so they can be asked.
 * A product this person changed that has left the list since is listed too ('gone'); it can't be saved.
 * @return array{rows: array, conflicts: array}
 */
function pricing_rebase_rows(array $liveRows, array $opened, array $mine, string $resolve): array
{
    $key = fn(array $row) => mb_strtolower(trim((string) ($row[1] ?? '')));
    $openedByCode = [];
    foreach ($opened as $row) $openedByCode[$key($row)] = $row;
    $liveCodes = [];
    $rows = [];
    $conflicts = [];
    $mineByCode = [];
    foreach ($mine as $row) $mineByCode[$key($row)] = $row;
    $fixed = [0, 1, MOQ_TOTAL_COLUMN, 19, 20]; // category, code, MOQ total (follows the price), level, customer
    foreach ($liveRows as $live) {
        $code = $key($live);
        $liveCodes[$code] = true;
        $row = $live;
        $was = $openedByCode[$code] ?? null;
        $now = $mineByCode[$code] ?? null;
        if ($was !== null && $now !== null) {
            foreach ($now as $col => $value) {
                if (in_array($col, $fixed, true) || pricing_same_cell($col, $value, $was[$col] ?? '')) continue; // not changed by this person
                $current = $live[$col] ?? '';
                if (!pricing_same_cell($col, $current, $was[$col] ?? '') && !pricing_same_cell($col, $current, $value)) {
                    $conflicts[] = ['code' => (string) $live[1], 'description' => (string) $live[2], 'col' => $col, 'column' => pricing_column_name($col),
                        'opened' => $was[$col] ?? '', 'theirs' => $current, 'mine' => $value, 'gone' => false];
                    if ($resolve === 'theirs') continue;
                }
                $row[$col] = $value;
            }
        }
        $rows[] = $row;
    }
    foreach ($mineByCode as $code => $now) {
        $was = $openedByCode[$code] ?? null;
        if (isset($liveCodes[$code]) || $was === null) continue;
        foreach (PRICE_COLUMNS as $col) {
            if (pricing_same_cell($col, $now[$col] ?? '', $was[$col] ?? '')) continue;
            $conflicts[] = ['code' => (string) $now[1], 'description' => (string) ($now[2] ?? ''), 'col' => $col, 'column' => pricing_column_name($col),
                'opened' => $was[$col] ?? '', 'theirs' => null, 'mine' => $now[$col] ?? '', 'gone' => true];
        }
    }
    return ['rows' => $rows, 'conflicts' => $conflicts];
}

/** Who set each product's current price in one list (code, lowercase => ['by', 'at']), for conflict messages. */
function pricing_price_setters(int $countryId, int $levelId): array
{
    $setters = [];
    foreach (pricing_list_prices($countryId, $levelId, $countryId !== 0) as $code => $entry) {
        if ($entry['own']) $setters[mb_strtolower((string) $code)] = ['by' => (string) $entry['own']['setBy'], 'at' => (string) $entry['own']['setAt']];
    }
    return $setters;
}

/**
 * Works out a one-file save. $input: {base?: {rows, opened?, adjustment, categoryAdjustments}, lists: [{id,
 * rows, opened?, adjustment, categoryAdjustments}], scoped: [{countries: [], levels: [], categories: [],
 * percent}], resolve?: 'mine'|'theirs'} (empty arrays = all). 'opened' are the rows as the editor showed
 * them when opened: with them, only what this person changed is saved (see pricing_rebase_rows).
 * Returns ['batch' => …, 'error' => ?string, 'conflicts' => [prices someone else changed meanwhile]].
 */
function pricing_build_batch(array $input): array
{
    $fail = fn(string $message) => ['batch' => null, 'error' => $message];
    $clean = function (array $rows): array {
        $width = count(price_list_template()['normalizedHeaders']);
        return array_map(function ($row) use ($width) {
            $row = array_values(is_array($row) ? $row : []);
            $out = [];
            for ($i = 0; $i < $width; $i++) {
                $value = $row[$i] ?? '';
                $out[] = in_array($i, PRICE_COLUMNS, true) && is_numeric($value) ? (float) $value : (is_scalar($value) ? trim((string) $value) : '');
            }
            return $out;
        }, array_slice($rows, 0, 15000));
    };
    $rate = fn(array $draft, string $category) => (float) ($draft['categoryAdjustments'][$category] ?? $draft['adjustment'] ?? 0);
    $resolve = in_array($input['resolve'] ?? '', ['mine', 'theirs'], true) ? (string) $input['resolve'] : 'ask';
    $conflicts = [];
    // Only this person's own changes, on top of the list as it is now (when the editor sent how it opened).
    $rebase = function (array $live, array $draft, string $where) use ($clean, $resolve, &$conflicts): array {
        $rows = $clean($draft['rows']);
        if (!is_array($draft['opened'] ?? null) || !$draft['opened']) return $rows;
        $result = pricing_rebase_rows($live['rows'], $clean($draft['opened']), $rows, $resolve);
        if ($result['conflicts']) {
            $pair = pricing_parse_list_id((string) $live['id']);
            $setters = $pair ? pricing_price_setters($pair[0], $pair[1]) : [];
            foreach ($result['conflicts'] as $conflict) {
                $conflicts[] = $conflict + ['where' => $where, 'listId' => (string) $live['id'], 'by' => $setters[mb_strtolower($conflict['code'])]['by'] ?? '', 'at' => $setters[mb_strtolower($conflict['code'])]['at'] ?? ''];
            }
        }
        return $result['rows'];
    };

    // Base prices (the masterlist itself).
    $baseEdits = [];
    if (is_array($input['base'] ?? null) && is_array($input['base']['rows'] ?? null)) {
        $draft = $input['base'];
        $baseLive = pricing_base_version();
        $rows = $rebase($baseLive, $draft, 'Standard prices');
        $result = pricing_edits($baseLive, pricing_effective_rows($rows, (float) ($draft['adjustment'] ?? 0), is_array($draft['categoryAdjustments'] ?? null) ? $draft['categoryAdjustments'] : []));
        if ($result['error'] !== null) return $fail($result['error']);
        $baseEdits = $result['edits'];
    }

    // % changes: from each list's own adjustments, and from the ones made for many lists at once.
    $ops = [];
    $lists = [];
    foreach (array_slice(is_array($input['lists'] ?? null) ? $input['lists'] : [], 0, 1000) as $draft) {
        $pair = is_array($draft) ? pricing_parse_list_id((string) ($draft['id'] ?? '')) : null;
        if (!$pair || !is_array($draft['rows'] ?? null)) continue;
        $live = pricing_list_version($pair[0], $pair[1]);
        if (!$live) return $fail('One of the lists is no longer in Config (customer or price level), or the customer moved to another price level. Refresh and try again.');
        $lists[] = ['pair' => $pair, 'live' => $live, 'rows' => $rebase($live, $draft, pricing_list_name($live))];
        // A % on a price level (customer 0) is for every customer on it. One % for the whole list is one
        // change (not one per category); a % per category is one change per category.
        $categories = array_values(array_unique(array_map(fn($row) => (string) $row[0], $live['rows'])));
        $percents = array_map(fn($category) => round($rate($draft, $category), 4), $categories);
        $whole = (float) ($draft['adjustment'] ?? 0);
        if ($whole !== 0.0 && count(array_unique($percents)) === 1 && $percents[0] === round($whole, 4)) {
            $ops[] = ['countryId' => $pair[0] ?: null, 'levelId' => $pair[1], 'category' => null, 'percent' => round($whole, 4)];
        } else {
            foreach ($categories as $i => $category) {
                if ($percents[$i] !== 0.0) $ops[] = ['countryId' => $pair[0] ?: null, 'levelId' => $pair[1], 'category' => $category, 'percent' => $percents[$i]];
            }
        }
    }
    foreach (array_slice(is_array($input['scoped'] ?? null) ? $input['scoped'] : [], 0, 200) as $entry) {
        $percent = is_array($entry) ? clean_number($entry['percent'] ?? null, -90, 1000) : null;
        if ($percent === null || (float) $percent === 0.0) continue;
        $scopeIds = [];
        foreach (['countries' => 'countries', 'priceLevels' => 'levels'] as $type => $key) {
            $names = is_array($entry[$key] ?? null) ? $entry[$key] : [];
            $scopeIds[$type] = $names ? [] : [null]; // none named = all
            foreach ($names as $name) {
                $id = pricing_option_id($type, (string) $name);
                if ($id === null) return $fail("\"{$name}\" is not in Config any more. Refresh and try again.");
                $scopeIds[$type][] = $id;
            }
        }
        [$countryIds, $levelIds] = [$scopeIds['countries'], $scopeIds['priceLevels']];
        $categories = is_array($entry['categories'] ?? null) && $entry['categories'] ? array_map('strval', $entry['categories']) : [null];
        foreach ($countryIds as $countryId) foreach ($levelIds as $levelId) foreach ($categories as $category) {
            $ops[] = ['countryId' => $countryId, 'levelId' => $levelId, 'category' => $category, 'percent' => round((float) $percent, 4)];
        }
    }

    // Prices typed in a list: the price as shown (with the % above) becomes the list's own price.
    // Details (description, sizes, shelf life…) changed in a price level's view change that level's file
    // (all its customers); changed in one customer's view, they are that customer's own.
    $listEdits = [];
    foreach ($lists as ['pair' => [$countryId, $levelId], 'live' => $live, 'rows' => $rows]) {
        $before = [];
        foreach ($live['rows'] as $row) $before[mb_strtolower((string) $row[1])] = $row;
        $where = pricing_list_name($live);
        if (count($rows) !== count($before)) return $fail("{$where}: products cannot be added or removed in the editor.");
        $edits = [];
        foreach ($rows as $row) {
            $old = $before[mb_strtolower((string) $row[1])] ?? null;
            if (!$old) return $fail("{$where}: product '{$row[1]}' is not in the price list.");
            $edit = ['code' => (string) $old[1], 'description' => (string) $old[2], 'category' => (string) $old[0], 'prices' => [], 'fields' => []];
            foreach ($old as $col => $value) {
                // Fixed: category (its worksheet), code, prices (below), the MOQ total (follows the price), level, customer.
                if (in_array($col, [0, 1, 8, 9, MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
                $new = trim((string) ($row[$col] ?? ''));
                if ($new === trim((string) $value)) continue;
                if (mb_strlen($new) > 400) return $fail("{$where}: '" . pricing_column_name($col) . "' of {$old[1]} is too long (400 characters at most).");
                $edit['fields'][] = ['col' => $col, 'name' => pricing_column_name($col), 'old' => (string) $value, 'new' => $new];
            }
            $factor = pricing_ops_factor($ops, $countryId, $levelId, (string) $old[0]);
            foreach ([8 => 'pricePc', 9 => 'priceBox'] as $col => $field) {
                $was = is_numeric($old[$col]) ? (float) $old[$col] : null;
                $now = is_numeric($row[$col]) ? (float) $row[$col] : null;
                if (pricing_same_price($was, $now)) continue;
                $edit['prices'][$field] = ['old' => $was, 'new' => $now === null ? null : pricing_round($now * $factor)];
            }
            if ($edit['prices'] || $edit['fields']) $edits[] = $edit;
        }
        if ($edits) $listEdits[] = ['id' => $live['id'], 'countryId' => $countryId, 'levelId' => $levelId, 'country' => $live['country'], 'priceLevel' => $live['priceLevel'], 'edits' => $edits];
    }

    if (!$baseEdits && !$ops && !$listEdits) return $fail('Nothing has changed, so there is nothing to save.') + ['conflicts' => $conflicts];
    $ops = array_map(fn($op) => $op + ['label' => pricing_scope_label($op['countryId'], $op['levelId'], $op['category'])], $ops);
    return ['batch' => ['baseEdits' => $baseEdits, 'ruleOps' => $ops, 'lists' => $listEdits], 'error' => null, 'conflicts' => $conflicts];
}

/**
 * Before a saved change is approved: the prices it changes that are different now from when it was
 * saved (another change was approved in between). Approving would replace them with this change's.
 * [{where, code, description, column, saved, now, new, by, at, gone}]
 */
function pricing_batch_conflicts(array $batch): array
{
    $out = [];
    $label = fn(string $field) => $field === 'pricePc' ? pricing_column_name(8) : pricing_column_name(9);
    foreach ($batch['lists'] ?? [] as $list) {
        [$countryId, $levelId] = [(int) $list['countryId'], (int) $list['levelId']];
        $current = [];
        foreach (pricing_list_prices($countryId, $levelId, $countryId !== 0) as $code => $entry) $current[mb_strtolower((string) $code)] = $entry;
        foreach ($list['edits'] as $edit) {
            $entry = $current[mb_strtolower((string) $edit['code'])] ?? null;
            foreach ($edit['prices'] ?? [] as $field => $price) {
                $now = $entry[$field] ?? null;
                if ($entry && (pricing_same_price($now, $price['old']) || pricing_same_price($now, $price['new']))) continue;
                $out[] = ['where' => pricing_list_name($list), 'code' => (string) $edit['code'], 'description' => (string) $edit['description'], 'column' => $label($field),
                    'saved' => $price['old'], 'now' => $now, 'new' => $price['new'], 'by' => (string) ($entry['own']['setBy'] ?? ''), 'at' => (string) ($entry['own']['setAt'] ?? ''), 'gone' => $entry === null];
            }
            // Details changed in the level's file since this was saved.
            foreach ($edit['fields'] ?? [] as $field) {
                $now = $entry ? (string) ($entry['product']['row'][$field['col']] ?? '') : null;
                if ($entry && (trim($now) === trim((string) $field['old']) || trim($now) === trim((string) $field['new']))) continue;
                $out[] = ['where' => pricing_list_name($list), 'code' => (string) $edit['code'], 'description' => (string) $edit['description'], 'column' => $field['name'],
                    'saved' => $field['old'], 'now' => $now, 'new' => $field['new'], 'by' => (string) ($entry['own']['setBy'] ?? ''), 'at' => (string) ($entry['own']['setAt'] ?? ''), 'gone' => $entry === null];
            }
        }
    }
    if ($batch['baseEdits'] ?? []) {
        $products = [];
        foreach (pricing_db_products() as $p) $products[mb_strtolower($p['code'])] = $p;
        foreach ($batch['baseEdits'] as $edit) {
            $p = $products[mb_strtolower((string) $edit['code'])] ?? null;
            foreach ($edit['prices'] ?? [] as $field => $price) {
                $now = $p[$field] ?? null;
                if ($p && (pricing_same_price($now, $price['old']) || pricing_same_price($now, $price['new']))) continue;
                $out[] = ['where' => 'Standard prices', 'code' => (string) $edit['code'], 'description' => (string) $edit['description'], 'column' => $label($field),
                    'saved' => $price['old'], 'now' => $now, 'new' => $price['new'], 'by' => '', 'at' => '', 'gone' => $p === null];
            }
        }
    }
    return $out;
}

/**
 * A one-file save in plain words, for messages, notifications and the audit log:
 *   'parts' – short phrases ("+10% for every FOB Price customer", "2 prices for Sinodis · FOB Price",
 *             "Classic Baguette standard price"), and 'text' – them joined;
 *   'lines' – one line per change, with product names and prices before → after (capped).
 */
function pricing_batch_description(array $batch): array
{
    $money = fn($value) => $value === null ? '—' : number_format((float) $value, 2);
    $priceLine = function (array $edit) use ($money): string {
        $prices = [];
        foreach ($edit['prices'] ?? [] as $field => $price) $prices[] = ($field === 'pricePc' ? 'Price/pc' : 'Price/box') . " {$money($price['old'])} → {$money($price['new'])}";
        foreach ($edit['fields'] ?? [] as $field) $prices[] = "{$field['name']} “{$field['old']}” → “{$field['new']}”";
        return "{$edit['description']} (" . implode(', ', $prices) . ')';
    };
    $parts = [];
    $lines = [];
    // % changes: one phrase per customer / price level / % (its categories together).
    $countries = pricing_db_option_ids('countries');
    $levels = pricing_db_option_ids('priceLevels');
    $groups = [];
    foreach ($batch['ruleOps'] ?? [] as $op) {
        $key = ($op['countryId'] ?? '') . '|' . ($op['levelId'] ?? '') . '|' . $op['percent'];
        $groups[$key] ??= ['op' => $op, 'categories' => []];
        if ($op['category'] !== null) $groups[$key]['categories'][] = $op['category'];
        else $groups[$key]['all'] = true;
    }
    foreach ($groups as $group) {
        $op = $group['op'];
        $level = $op['levelId'] === null ? null : ($levels[$op['levelId']] ?? '?');
        $where = $op['countryId'] !== null ? ($countries[$op['countryId']] ?? '?') . ($level ? " · {$level}" : '')
            : ($level ? "every {$level} customer" : 'every price level');
        $categories = empty($group['all']) && $group['categories'] ? ' (' . implode(', ', $group['categories']) . ')' : '';
        $phrase = ($op['percent'] > 0 ? '+' : '') . rtrim(rtrim(number_format((float) $op['percent'], 4, '.', ''), '0'), '.') . "% for {$where}{$categories}";
        $parts[] = $phrase;
        $lines[] = ucfirst($phrase);
    }
    // Prices typed for a price level or a customer.
    foreach ($batch['lists'] ?? [] as $list) {
        $count = count($list['edits']);
        $name = pricing_list_name($list);
        $what = array_filter($list['edits'], fn($edit) => !empty($edit['fields'])) ? 'change' : 'price';
        $parts[] = $count === 1 ? "{$list['edits'][0]['description']} {$what} for {$name}" : "{$count} {$what}s for {$name}";
        foreach (array_slice($list['edits'], 0, 20) as $edit) $lines[] = "{$name}: " . $priceLine($edit);
        if ($count > 20) $lines[] = "{$name}: and " . ($count - 20) . ' more';
    }
    // Standard prices (every price level follows them).
    $base = $batch['baseEdits'] ?? [];
    if ($base) {
        $parts[] = count($base) <= 2 ? implode(' and ', array_map(fn($edit) => $edit['description'], $base)) . ' standard price' . (count($base) === 1 ? '' : 's') : count($base) . ' standard prices';
        foreach (array_slice($base, 0, 20) as $edit) $lines[] = 'Standard prices: ' . $priceLine($edit);
        if (count($base) > 20) $lines[] = 'Standard prices: and ' . (count($base) - 20) . ' more';
    }
    // Messages stay readable: the first few phrases, then a count.
    $shown = array_slice($parts, 0, 4);
    if (count($parts) > 4) $shown[] = (count($parts) - 4) . ' more';
    return ['parts' => $parts, 'text' => implode('; ', $shown), 'lines' => $lines];
}

/** How much a one-file save changes, for messages: [base products, % changes, list prices]. */
function pricing_batch_counts(array $batch): array
{
    return [count($batch['baseEdits']), count($batch['ruleOps']), array_sum(array_map(fn($list) => count($list['edits']), $batch['lists']))];
}

/** Applies an approved one-file save: base prices, then the % changes, then prices typed in lists. */
function pricing_apply_batch(array $batch, string $versionId, string $by): void
{
    if ($batch['baseEdits'] ?? []) pricing_apply_base_edits($batch['baseEdits'], $versionId, $by);
    if ($batch['ruleOps'] ?? []) {
        pricing_db_transaction(function (PDO $db) use ($batch, $versionId, $by) {
            $changes = [];
            foreach ($batch['ruleOps'] as $op) {
                [$old, $new] = pricing_db_compose_rule($db, $op, $by);
                $changes[] = ['kind' => 'rule', 'countryId' => $op['countryId'], 'levelId' => $op['levelId'], 'category' => $op['category'], 'field' => 'percent_change', 'old' => $old, 'new' => $new];
            }
            pricing_db_record_changes($db, $versionId, $changes);
        });
    }
    foreach ($batch['lists'] ?? [] as $list) {
        $prices = [];
        $details = [];
        foreach ($list['edits'] as $edit) {
            if ($edit['prices'] ?? []) $prices[$edit['code']] = array_map(fn($p) => $p['new'], $edit['prices']);
            foreach ($edit['fields'] ?? [] as $field) $details[$edit['code']][(int) $field['col']] = $field['new'];
        }
        if ($prices) pricing_set_list_prices((int) $list['countryId'], (int) $list['levelId'], $prices, $versionId, $by);
        if ($details) pricing_set_list_details((int) $list['countryId'], (int) $list['levelId'], $details, $versionId, $by);
    }
}

/**
 * Changes product details (description, sizes, shelf life…) in one list. $details: code => [column =>
 * new value]. In a price level's view (customer 0) they change the level's file: every customer on it
 * sees them, and so do exports. In a customer's view they are that customer's own details, on top of
 * the level's. Products not in the list are skipped.
 */
function pricing_set_list_details(int $countryId, int $levelId, array $details, string $versionId, string $by): void
{
    $current = [];
    foreach (pricing_list_prices($countryId, $levelId, $countryId !== 0) as $code => $entry) $current[mb_strtolower((string) $code)] = $entry;
    $width = count(price_list_template()['normalizedHeaders']);
    $rows = [];
    $changes = [];
    foreach ($details as $code => $set) {
        $entry = $current[mb_strtolower((string) $code)] ?? null;
        if (!$entry || ($countryId === 0 && !$entry['inLevel'])) continue;
        $p = $entry['product'];
        $row = array_slice(array_pad(array_values($p['row']), $width, ''), 0, $width); // the details as shown in this list
        foreach ($set as $col => $value) {
            if (trim((string) ($row[$col] ?? '')) === trim((string) $value)) continue;
            $changes[] = ['kind' => 'field', 'code' => $p['code'], 'countryId' => $countryId ?: null, 'levelId' => $levelId, 'category' => $p['category'], 'field' => pricing_column_name((int) $col), 'old' => $row[$col] ?? '', 'new' => $value];
            $row[$col] = $value;
        }
        $rows[$p['id']] = $row;
    }
    if (!$changes) return;
    pricing_db_transaction(function (PDO $db) use ($countryId, $levelId, $rows, $changes, $versionId, $by) {
        pricing_db_write_rows($db, $countryId, $levelId, $rows, $versionId, $by);
        pricing_db_record_changes($db, $versionId, $changes);
    });
}

// ---------------------------------------------------------------------------
// Uploads: preview first, then apply (same file, same preview)
// ---------------------------------------------------------------------------

/** Product records from an imported workbook (masterlist upload), in file order. */
function pricing_products_from_import(array $import): array
{
    $layouts = $import['layouts'] ?? [];
    $products = [];
    foreach (array_values($import['rows']) as $i => $row) {
        $row[19] = '';
        $row[20] = '';
        $products[] = [
            'code' => (string) $row[1], 'category' => (string) $row[0], 'group' => (string) ($row[18] ?? ''),
            'layout' => ($layouts[(string) $row[0]] ?? 'standard') === 'presentation' ? 'presentation' : 'standard',
            'description' => (string) $row[2],
            'pricePc' => is_numeric($row[8]) ? pricing_round((float) $row[8]) : null,
            'priceBox' => is_numeric($row[9]) ? pricing_round((float) $row[9]) : null,
            'row' => $row, 'sort' => $i + 1,
        ];
    }
    return $products;
}

function pricing_preview_item(array $p, array $extra = []): array
{
    return ['code' => $p['code'], 'description' => $p['description'], 'category' => $p['category']] + $extra;
}

/** What a masterlist upload would change. */
function pricing_preview_masterlist(array $import): array
{
    $current = [];
    foreach (pricing_db_products(true) as $p) $current[mb_strtolower($p['code'])] = $p;
    $incoming = pricing_products_from_import($import);
    $added = $removed = $priceChanges = $detailChanges = [];
    $unchanged = 0;
    $seen = [];
    foreach ($incoming as $p) {
        $key = mb_strtolower($p['code']);
        $seen[$key] = true;
        $old = $current[$key] ?? null;
        if (!$old || !$old['active']) { $added[] = pricing_preview_item($p, ['pricePc' => $p['pricePc'], 'priceBox' => $p['priceBox'], 'returning' => (bool) $old]); continue; }
        $changed = false;
        if (!pricing_same_price($old['pricePc'], $p['pricePc']) || !pricing_same_price($old['priceBox'], $p['priceBox'])) {
            $priceChanges[] = pricing_preview_item($p, ['pcOld' => $old['pricePc'], 'pcNew' => $p['pricePc'], 'boxOld' => $old['priceBox'], 'boxNew' => $p['priceBox']]);
            $changed = true;
        }
        $fields = [];
        if ($old['category'] !== $p['category']) $fields[] = ['name' => 'Category', 'old' => $old['category'], 'new' => $p['category']];
        foreach ($p['row'] as $col => $value) {
            if (in_array($col, [0, 1, 8, 9, MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
            if (trim((string) $value) !== trim((string) ($old['row'][$col] ?? ''))) $fields[] = ['name' => pricing_column_name($col), 'old' => $old['row'][$col] ?? '', 'new' => $value];
        }
        if ($fields) { $detailChanges[] = pricing_preview_item($p, ['fields' => $fields]); $changed = true; }
        if (!$changed) $unchanged++;
    }
    foreach ($current as $key => $p) if ($p['active'] && !isset($seen[$key])) $removed[] = pricing_preview_item($p);
    $limit = fn(array $items) => array_slice($items, 0, UPLOAD_PREVIEW_LIMIT);
    return [
        'mode' => 'masterlist', 'products' => count($incoming), 'first' => !array_filter($current, fn($p) => $p['active']),
        'counts' => ['added' => count($added), 'removed' => count($removed), 'priceChanges' => count($priceChanges), 'detailChanges' => count($detailChanges), 'unchanged' => $unchanged],
        'added' => $limit($added), 'removed' => $limit($removed), 'priceChanges' => $limit($priceChanges), 'detailChanges' => $limit($detailChanges),
    ];
}

/** Applies a masterlist upload; returns the change records. */
function pricing_apply_masterlist(array $import, string $versionId): array
{
    $preview = pricing_preview_masterlist($import);
    $current = [];
    foreach (pricing_db_products(true) as $p) $current[mb_strtolower($p['code'])] = $p;
    $incoming = pricing_products_from_import($import);
    $changes = [];
    $seen = [];
    foreach ($incoming as $p) {
        $old = $current[mb_strtolower($p['code'])] ?? null;
        $seen[mb_strtolower($p['code'])] = true;
        if (!$old || !$old['active']) { $changes[] = ['kind' => 'product_add', 'code' => $p['code'], 'category' => $p['category'], 'new' => $p['description']]; continue; }
        foreach (['pricePc' => 'price_pc', 'priceBox' => 'price_box'] as $field => $name) {
            if (!pricing_same_price($old[$field], $p[$field])) $changes[] = ['kind' => 'base', 'code' => $p['code'], 'category' => $p['category'], 'field' => $name, 'old' => $old[$field], 'new' => $p[$field]];
        }
    }
    foreach ($preview['detailChanges'] as $item) {
        foreach ($item['fields'] as $field) $changes[] = ['kind' => 'field', 'code' => $item['code'], 'category' => $item['category'], 'field' => $field['name'], 'old' => $field['old'], 'new' => $field['new']];
    }
    $deactivate = [];
    foreach ($current as $key => $p) {
        if ($p['active'] && !isset($seen[$key])) { $deactivate[] = $p['code']; $changes[] = ['kind' => 'product_remove', 'code' => $p['code'], 'category' => $p['category'], 'old' => $p['description']]; }
    }
    pricing_db_transaction(function (PDO $db) use ($incoming, $deactivate, $changes, $versionId) {
        pricing_db_write_products($db, $incoming, $deactivate, $versionId);
        pricing_db_record_changes($db, $versionId, $changes);
    });
    return $changes;
}

/** Product details (not prices) that differ between a product in the price list and an uploaded row. */
function pricing_detail_changes(array $old, array $new): array
{
    $fields = [];
    if ($old['category'] !== $new['category']) $fields[] = ['col' => 0, 'name' => 'Category', 'old' => $old['category'], 'new' => $new['category']];
    foreach ($new['row'] as $col => $value) {
        if (in_array($col, [0, 1, 8, 9, MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
        if (trim((string) $value) !== trim((string) ($old['row'][$col] ?? ''))) $fields[] = ['col' => $col, 'name' => pricing_column_name($col), 'old' => $old['row'][$col] ?? '', 'new' => $value];
    }
    return $fields;
}

/**
 * What uploading a workbook would change.
 *   - A price level (customer 0): its list becomes exactly the file: its products (in its order, with
 *     its descriptions and details) at its prices. Products not in the file leave the level.
 *   - A customer: the file's prices become the customer's own; its other products keep the level's.
 * Products new to the system are added to the product records kept in the background.
 */
function pricing_preview_list(array $import, int $countryId, int $levelId): ?array
{
    $live = pricing_list_version($countryId, $levelId);
    if (!$live) return null;
    $current = [];
    foreach (pricing_list_prices($countryId, $levelId) as $code => $entry) $current[mb_strtolower($code)] = $entry;
    $added = $priceChanges = $notInFile = $detailChanges = [];
    $unchanged = 0;
    $seen = [];
    foreach (pricing_products_from_import($import) as $p) {
        $key = mb_strtolower($p['code']);
        $seen[$key] = true;
        $old = $current[$key] ?? null;
        if (!$old) { $added[] = pricing_preview_item($p, ['pricePc' => $p['pricePc'], 'priceBox' => $p['priceBox']]); continue; }
        if ($countryId === 0) {
            $fields = pricing_detail_changes($old['product'], $p);
            if ($fields) $detailChanges[] = pricing_preview_item($p, ['fields' => $fields]);
        }
        if (pricing_same_price($old['pricePc'], $p['pricePc']) && pricing_same_price($old['priceBox'], $p['priceBox'])) { $unchanged++; continue; }
        $priceChanges[] = pricing_preview_item($p, ['pcOld' => $old['pricePc'], 'pcNew' => $p['pricePc'], 'boxOld' => $old['priceBox'], 'boxNew' => $p['priceBox']]);
    }
    foreach ($current as $key => $entry) if (!isset($seen[$key])) $notInFile[] = pricing_preview_item($entry['product']);
    // A level's file also sets its order: a new order alone is a change too.
    $reordered = $countryId === 0 && !$added && !$notInFile && array_keys($current) !== array_keys($seen);
    $limit = fn(array $items) => array_slice($items, 0, UPLOAD_PREVIEW_LIMIT);
    return [
        'mode' => 'list', 'listId' => $live['id'], 'customer' => $live['country'], 'priceLevel' => $live['priceLevel'],
        'products' => count($seen), 'first' => !$current, 'replaces' => $countryId === 0,
        'counts' => [
            'added' => count($added), 'priceChanges' => count($priceChanges), 'detailChanges' => count($detailChanges), 'unchanged' => $unchanged,
            // Leaving the level (level file), or keeping the level's price (customer file).
            'removed' => $countryId === 0 ? count($notInFile) : 0, 'notInFile' => count($notInFile), 'reordered' => $reordered ? 1 : 0,
        ],
        'added' => $limit($added), 'priceChanges' => $limit($priceChanges), 'detailChanges' => $limit($detailChanges), 'notInFile' => $limit($notInFile),
    ];
}

/** Applies a price level / customer upload (see pricing_preview_list); returns the change records. */
function pricing_apply_list(array $import, int $countryId, int $levelId, string $versionId, string $by): array
{
    $catalog = [];
    $lastSort = 0;
    foreach (pricing_db_products(true) as $p) {
        $catalog[mb_strtolower($p['code'])] = $p;
        $lastSort = max($lastSort, $p['sort']);
    }
    // Products new to the system first (their reference prices are this file's).
    $incoming = pricing_products_from_import($import);
    $new = [];
    foreach ($incoming as $p) {
        $old = $catalog[mb_strtolower($p['code'])] ?? null;
        if (!$old || !$old['active']) $new[] = ['sort' => $old['sort'] ?? ++$lastSort] + $p;
    }
    if ($new) {
        pricing_db_transaction(fn(PDO $db) => pricing_db_write_products($db, $new, [], $versionId));
        $catalog = [];
        foreach (pricing_db_products(true) as $p) $catalog[mb_strtolower($p['code'])] = $p;
    }

    if ($countryId !== 0) {
        // A customer: the file's prices become its own.
        $records = array_map(fn($p) => ['kind' => 'product_add', 'code' => $p['code'], 'category' => $p['category'], 'new' => $p['description']], $new);
        if ($records) pricing_db_transaction(fn(PDO $db) => pricing_db_record_changes($db, $versionId, $records));
        $prices = [];
        foreach ($incoming as $p) $prices[$p['code']] = ['pricePc' => $p['pricePc'], 'priceBox' => $p['priceBox']];
        $records = array_merge($records, pricing_set_list_prices($countryId, $levelId, $prices, $versionId, $by));
        // Its file's details (descriptions, sizes…) are the customer's own too, so a later upload of the
        // level's file doesn't replace what this customer's file says.
        $rows = [];
        foreach ($incoming as $p) if (isset($catalog[mb_strtolower($p['code'])])) $rows[$catalog[mb_strtolower($p['code'])]['id']] = $p['row'];
        if ($rows) pricing_db_transaction(fn(PDO $db) => pricing_db_write_rows($db, $countryId, $levelId, $rows, $versionId, $by));
        return $records;
    }

    // A price level: its list becomes the file.
    $current = [];
    foreach (pricing_list_prices(0, $levelId) as $code => $entry) $current[mb_strtolower($code)] = $entry;
    $rows = [];
    $records = [];
    foreach ($incoming as $i => $p) {
        $key = mb_strtolower($p['code']);
        $product = $catalog[$key];
        $old = $current[$key] ?? null;
        $rows[$product['id']] = ['pricePc' => $p['pricePc'], 'priceBox' => $p['priceBox'], 'basePc' => $product['pricePc'], 'baseBox' => $product['priceBox'], 'row' => $p['row'], 'sort' => $i + 1];
        if (!$old) { $records[] = ['kind' => 'product_add', 'code' => $p['code'], 'levelId' => $levelId, 'category' => $p['category'], 'new' => $p['description']]; continue; }
        foreach (['pricePc' => 'price_pc', 'priceBox' => 'price_box'] as $field => $name) {
            if (!pricing_same_price($old[$field], $p[$field])) $records[] = ['kind' => 'override', 'code' => $p['code'], 'levelId' => $levelId, 'category' => $p['category'], 'field' => $name, 'old' => $old[$field], 'new' => $p[$field]];
        }
        foreach (pricing_detail_changes($old['product'], $p) as $field) {
            $records[] = ['kind' => 'field', 'code' => $p['code'], 'levelId' => $levelId, 'category' => $p['category'], 'field' => $field['name'], 'old' => $field['old'], 'new' => $field['new']];
        }
    }
    foreach ($current as $key => $entry) {
        if (!isset($rows[$entry['product']['id']])) $records[] = ['kind' => 'product_remove', 'code' => $entry['product']['code'], 'levelId' => $levelId, 'category' => $entry['product']['category'], 'old' => $entry['product']['description']];
    }
    pricing_db_transaction(function (PDO $db) use ($levelId, $rows, $records, $versionId, $by) {
        pricing_db_replace_level($db, $levelId, $rows, $versionId, $by);
        pricing_db_record_changes($db, $versionId, $records);
    });
    return $records;
}

/** Everything the page needs about the masterlist (null when it's off). */
function pricing_payload(): ?array
{
    if (!pricing_enabled()) return null;
    return ['enabled' => true, 'id' => STANDARD_PRICES_ID];
}
