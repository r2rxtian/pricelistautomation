<?php
declare(strict_types=1);
/**
 * The price masterlist: one list of products with base prices, from which every country + price
 * level list is worked out. A price in a list is
 *   1. the price set for that product in that list (PLA_PriceOverrides), when there is one;
 *   2. otherwise the base price × every matching % rule (PLA_PriceRules: per price level, country
 *      and/or category; rules that match together multiply, e.g. +5% and +3% = +8.15%).
 * Only prices are set per list; descriptions, sizes and the rest always come from the masterlist.
 *
 * In the app a list is a "version" like an uploaded file (same rows, editor and export), with the id
 * list-<countryId>-<priceLevelId>; the masterlist itself is the id 'masterlist'. Saving price changes
 * to either makes a normal pending version (rows + the edits it makes); approving it applies the edits.
 * SQL Server only (conn/config.php › PLA_STORAGE_DRIVER = 'sqlserver').
 */

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/options.php';
require_once __DIR__ . '/workbook_import.php';
require_once __DIR__ . '/../repository/masterlist.php';

const MASTERLIST_ID = 'masterlist';
const MASTERLIST_NAME = 'Price list';
const MASTERLIST_LIST_NAME = 'Price list';
const MASTERLIST_PRICE_COLUMNS = [8, 9];   // Price/pc, Price/box (normalized columns)
const MASTERLIST_MOQ_TOTAL_COLUMN = 17;     // Total Price Based on MOQ: follows Price/box
const MASTERLIST_PREVIEW_LIMIT = 300;       // rows listed per section of an upload preview

function masterlist_enabled(): bool
{
    return STORAGE_DRIVER === 'sqlserver';
}

function masterlist_list_id(int $countryId, int $levelId): string
{
    return "list-{$countryId}-{$levelId}";
}

/** [countryId, levelId] for a list id, or null. */
function masterlist_parse_list_id(string $id): ?array
{
    return preg_match('/^list-(\d{1,9})-(\d{1,9})$/D', $id, $m) ? [(int) $m[1], (int) $m[2]] : null;
}

function masterlist_is_virtual_id(string $id): bool
{
    return $id === MASTERLIST_ID || masterlist_parse_list_id($id) !== null;
}

function masterlist_round(?float $value): ?float
{
    return $value === null ? null : round(max(0.0, $value), 4);
}

function masterlist_same_price(mixed $a, mixed $b): bool
{
    $blank = fn($v) => $v === null || $v === '';
    if ($blank($a) || $blank($b)) return $blank($a) && $blank($b);
    return is_numeric($a) && is_numeric($b) && abs((float) $a - (float) $b) < 0.00005;
}

/** The combined rule multiplier for one product category in one list. */
function masterlist_factor(array $rules, int $countryId, int $levelId, string $category): float
{
    $factor = 1.0;
    foreach ($rules as $rule) {
        if ($rule['countryId'] !== null && $rule['countryId'] !== $countryId) continue;
        if ($rule['levelId'] !== null && $rule['levelId'] !== $levelId) continue;
        if ($rule['category'] !== null && mb_strtolower($rule['category']) !== mb_strtolower($category)) continue;
        $factor *= 1 + $rule['percent'] / 100;
    }
    return $factor;
}

/** A product as a normalized price list row, with the given prices for a country and level. */
function masterlist_row(array $product, ?float $pricePc, ?float $priceBox, string $country = '', string $level = ''): array
{
    $width = count(price_list_template()['normalizedHeaders']);
    $row = array_slice(array_pad(array_values($product['row']), $width, ''), 0, $width);
    $row[0] = $product['category'];
    $row[1] = $product['code'];
    $row[8] = $pricePc ?? '';
    $row[9] = $priceBox ?? '';
    // The MOQ total is price/box × MOQ in the template: it moves with the price/box.
    $total = $product['row'][MASTERLIST_MOQ_TOTAL_COLUMN] ?? '';
    if (is_numeric($total) && $priceBox !== null && ($product['priceBox'] ?? 0) > 0) {
        $row[MASTERLIST_MOQ_TOTAL_COLUMN] = round((float) $total * $priceBox / $product['priceBox'], 2);
    }
    $row[19] = $level;
    $row[20] = $country;
    return $row;
}

/** A version-shaped record for the editor and export (no approvals: it is the live list). */
function masterlist_version_shell(string $id, string $kind, string $name, string $country, string $level, array $rows, string $savedAt, string $savedBy): array
{
    $categories = array_values(array_unique(array_map(fn($row) => (string) $row[0], $rows)));
    return [
        'id' => $id, 'source' => 'masterlist', 'kind' => $kind, 'name' => $name, 'country' => $country, 'priceLevel' => $level,
        'revision' => 1, 'status' => 'approved',
        'headers' => price_list_template()['normalizedHeaders'], 'rows' => $rows, 'priceColumns' => MASTERLIST_PRICE_COLUMNS,
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
function masterlist_last_saved(): array
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
    $update = masterlist_db_last_update();
    return $last = ['at' => $update['updatedAt'] ?? '', 'by' => ''];
}

/** The masterlist as a list: every product at its base price. */
function masterlist_base_version(): array
{
    $rows = array_map(fn($p) => masterlist_row($p, $p['pricePc'], $p['priceBox']), masterlist_db_products());
    $last = masterlist_last_saved();
    $version = masterlist_version_shell(MASTERLIST_ID, 'masterlist', MASTERLIST_NAME, '', '', $rows, $last['at'], $last['by']);
    $version['priceOnly'] = false;
    return $version;
}

/**
 * Every product's price in one list: ['product', 'rulePc', 'ruleBox', 'pricePc', 'priceBox', 'own'].
 * 'own' is the override record when the list has its own price for the product.
 */
function masterlist_list_prices(int $countryId, int $levelId): array
{
    $rules = masterlist_db_rules();
    $overrides = masterlist_db_overrides($countryId, $levelId);
    $prices = [];
    foreach (masterlist_db_products() as $p) {
        $factor = masterlist_factor($rules, $countryId, $levelId, $p['category']);
        $rulePc = $p['pricePc'] === null ? null : masterlist_round($p['pricePc'] * $factor);
        $ruleBox = $p['priceBox'] === null ? null : masterlist_round($p['priceBox'] * $factor);
        $own = $overrides[$p['id']] ?? null;
        $prices[$p['code']] = [
            'product' => $p, 'rulePc' => $rulePc, 'ruleBox' => $ruleBox,
            'pricePc' => $own['pricePc'] ?? $rulePc, 'priceBox' => $own['priceBox'] ?? $ruleBox, 'own' => $own,
        ];
    }
    return $prices;
}

/** One country + price level list, or null when that country or level doesn't exist. */
function masterlist_list_version(int $countryId, int $levelId): ?array
{
    $countries = masterlist_db_option_ids('countries');
    $levels = masterlist_db_option_ids('priceLevels');
    if (!isset($countries[$countryId], $levels[$levelId])) return null;
    $rows = [];
    $own = [];
    $latest = masterlist_last_saved();
    foreach (masterlist_list_prices($countryId, $levelId) as $code => $price) {
        $rows[] = masterlist_row($price['product'], $price['pricePc'], $price['priceBox'], $countries[$countryId], $levels[$levelId]);
        if ($price['own']) {
            $p = $price['product'];
            $own[$code] = [
                'pc' => $price['own']['pricePc'] !== null, 'box' => $price['own']['priceBox'] !== null,
                'rulePc' => $price['rulePc'], 'ruleBox' => $price['ruleBox'],
                'setAt' => $price['own']['setAt'], 'setBy' => $price['own']['setBy'],
                // The masterlist price moved since this price was set: worth a second look.
                'baseChanged' => !masterlist_same_price($price['own']['basePcWhenSet'], $p['pricePc']) || !masterlist_same_price($price['own']['baseBoxWhenSet'], $p['priceBox']),
            ];
            if ($price['own']['setAt'] > $latest['at']) $latest = ['at' => $price['own']['setAt'], 'by' => $price['own']['setBy']];
        }
    }
    $version = masterlist_version_shell(masterlist_list_id($countryId, $levelId), 'list', MASTERLIST_LIST_NAME, $countries[$countryId], $levels[$levelId], $rows, $latest['at'], $latest['by']);
    $version['ownPrices'] = $own;
    $version['priceOnly'] = true;
    return $version;
}

/** The live masterlist or list for an id ('masterlist' or list-<c>-<l>), or null. */
function masterlist_virtual_version(string $id): ?array
{
    if (!masterlist_enabled()) return null;
    if ($id === MASTERLIST_ID) return masterlist_base_version();
    $ids = masterlist_parse_list_id($id);
    return $ids ? masterlist_list_version($ids[0], $ids[1]) : null;
}

/** [countryId, levelId] for names (any case), or null when either isn't in Config. */
function masterlist_option_pair(string $country, string $level): ?array
{
    $countryId = masterlist_option_id('countries', $country);
    $levelId = masterlist_option_id('priceLevels', $level);
    return $countryId === null || $levelId === null ? null : [$countryId, $levelId];
}

/** The id of a country or price level by name (any case), or null. */
function masterlist_option_id(string $type, string $name): ?int
{
    $id = array_search(mb_strtolower(trim($name)), array_map('mb_strtolower', masterlist_db_option_ids($type)), true);
    return $id === false ? null : (int) $id;
}

/**
 * Light summaries of the masterlist and every switched-on country × price level list, for the Files
 * page, the list switcher and the navigator (the rows are fetched when a list is opened).
 */
function masterlist_summaries(): array
{
    if (!masterlist_enabled()) return [];
    $products = masterlist_db_products();
    $count = count($products);
    $categories = array_values(array_unique(array_map(fn($p) => $p['category'], $products)));
    $last = masterlist_last_saved();
    $counts = masterlist_db_override_counts();
    // Each country + price level list carries only what the page uses (there can be hundreds); the
    // rows come when one is opened.
    $base = fn(string $id, string $kind, string $name, string $country, string $level) => [
        'id' => $id, 'source' => 'masterlist', 'kind' => $kind, 'name' => $name, 'country' => $country, 'priceLevel' => $level,
        'status' => 'approved', 'savedAt' => $last['at'],
    ];
    $summaries = [$base(MASTERLIST_ID, 'masterlist', MASTERLIST_NAME, '', '') + [
        'productCount' => $count, 'categories' => $categories, 'savedBy' => $last['by'], 'approvedAt' => $last['at'], 'approvedBy' => $last['by'],
    ]];
    if (!$count) return $summaries;
    $levels = array_filter(database_get_list_options('priceLevels') ?? [], fn($o) => $o['active']);
    foreach (database_get_list_options('countries') ?? [] as $country) {
        if (!$country['active']) continue;
        foreach ($levels as $level) {
            $summary = $base(masterlist_list_id($country['id'], $level['id']), 'list', MASTERLIST_LIST_NAME, $country['name'], $level['name']);
            if (!empty($counts[$country['id'] . '-' . $level['id']])) $summary['ownPriceCount'] = $counts[$country['id'] . '-' . $level['id']];
            $summaries[] = $summary;
        }
    }
    return $summaries;
}

// ---------------------------------------------------------------------------
// Changes made in the editor (saved for approval, applied when approved)
// ---------------------------------------------------------------------------

/** The rows a save shows: its rows with any % adjustments applied, as the editor does (4 decimals). */
function masterlist_effective_rows(array $rows, float $adjustment, array $categoryAdjustments): array
{
    return array_map(function (array $row) use ($adjustment, $categoryAdjustments) {
        $rate = (float) ($categoryAdjustments[trim((string) ($row[0] ?? ''))] ?? $adjustment);
        if ($rate === 0.0) return $row;
        foreach (MASTERLIST_PRICE_COLUMNS as $col) {
            if (is_numeric($row[$col] ?? null)) $row[$col] = round(max(0.0, (float) $row[$col] * (1 + $rate / 100)), 4);
        }
        return $row;
    }, $rows);
}

/** Header names of the normalized columns (for change records and messages). */
function masterlist_column_name(int $col): string
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
function masterlist_edits(array $live, array $rows): array
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
            $new = is_numeric($row[$col] ?? null) ? masterlist_round((float) $row[$col]) : null;
            $was = is_numeric($old[$col] ?? null) ? (float) $old[$col] : null;
            if (!masterlist_same_price($new, $was)) $edit['prices'][$field] = ['old' => $was, 'new' => $new];
        }
        // Other cells: only the masterlist may change them (the MOQ total follows the price; codes, the
        // category and the country / level columns are fixed).
        foreach ($old as $col => $oldValue) {
            if (in_array($col, [0, 1, 8, 9, MASTERLIST_MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
            $newValue = $row[$col] ?? '';
            if (trim((string) $newValue) === trim((string) $oldValue)) continue;
            if ($live['kind'] !== 'masterlist') {
                return ['edits' => [], 'error' => "Only prices can be changed for a country. '" . masterlist_column_name($col) . "' of {$old[1]} is the same everywhere: change it in Standard prices."];
            }
            $edit['fields'][] = ['col' => $col, 'name' => masterlist_column_name($col), 'old' => $oldValue, 'new' => $newValue];
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
function masterlist_apply_version(array $version, string $by): void
{
    if (($version['kind'] ?? '') === 'batch') {
        if (is_array($version['masterlistBatch'] ?? null)) masterlist_apply_batch($version['masterlistBatch'], $version['id'], $by);
        return;
    }
    $edits = is_array($version['masterlistEdits'] ?? null) ? $version['masterlistEdits'] : [];
    if (!$edits) return;
    if (($version['kind'] ?? '') === 'masterlist') {
        masterlist_apply_base_edits($edits, $version['id'], $by);
        return;
    }
    $pair = masterlist_parse_list_id((string) ($version['basedOn'] ?? ''));
    if (!$pair) return;
    $prices = [];
    foreach ($edits as $edit) {
        $prices[$edit['code']] = array_map(fn($p) => $p['new'], $edit['prices']);
    }
    masterlist_set_list_prices($pair[0], $pair[1], $prices, $version['id'], $by);
}

/** Masterlist edits: new base prices and details for existing products. */
function masterlist_apply_base_edits(array $edits, string $versionId, string $by): void
{
    $products = [];
    foreach (masterlist_db_products() as $p) $products[mb_strtolower($p['code'])] = $p;
    $upserts = [];
    $changes = [];
    foreach ($edits as $edit) {
        $p = $products[mb_strtolower($edit['code'])] ?? null;
        if (!$p) continue;
        foreach ($edit['prices'] as $field => $price) {
            $changes[] = ['kind' => 'base', 'code' => $p['code'], 'category' => $p['category'], 'field' => $field === 'pricePc' ? 'price_pc' : 'price_box', 'old' => $p[$field], 'new' => $price['new']];
            if ($field === 'priceBox' && is_numeric($p['row'][MASTERLIST_MOQ_TOTAL_COLUMN] ?? null) && $p['priceBox'] > 0 && $price['new'] !== null) {
                $p['row'][MASTERLIST_MOQ_TOTAL_COLUMN] = round((float) $p['row'][MASTERLIST_MOQ_TOTAL_COLUMN] * $price['new'] / $p['priceBox'], 2);
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
    masterlist_db_transaction(function (PDO $db) use ($upserts, $changes, $versionId) {
        masterlist_db_write_products($db, $upserts, [], $versionId);
        masterlist_db_record_changes($db, $versionId, $changes);
    });
}

/**
 * Sets the prices shown in one list. $prices: code => ['pricePc' => ?float, 'priceBox' => ?float]
 * (a missing key leaves that price as it is). A price equal to the masterlist + rules price is not
 * stored, so the product follows the masterlist again. Returns the change records written.
 */
function masterlist_set_list_prices(int $countryId, int $levelId, array $prices, string $versionId, string $by): array
{
    $current = masterlist_list_prices($countryId, $levelId);
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
            if (!masterlist_same_price($set[$field], $entry[$field])) {
                $changes[] = ['kind' => 'override', 'code' => $p['code'], 'countryId' => $countryId, 'levelId' => $levelId, 'category' => $p['category'],
                    'field' => $field === 'pricePc' ? 'price_pc' : 'price_box', 'old' => $entry[$field], 'new' => $set[$field]];
            }
            $next[$field] = $set[$field];
        }
        $own = [
            'pricePc' => masterlist_same_price($next['pricePc'], $entry['rulePc']) ? null : $next['pricePc'],
            'priceBox' => masterlist_same_price($next['priceBox'], $entry['ruleBox']) ? null : $next['priceBox'],
            'basePc' => $p['pricePc'], 'baseBox' => $p['priceBox'],
        ];
        $had = $entry['own'] !== null;
        if ($own['pricePc'] === null && $own['priceBox'] === null && !$had) continue;
        $writes[$p['id']] = $own;
    }
    masterlist_db_transaction(function (PDO $db) use ($countryId, $levelId, $writes, $changes, $versionId, $by) {
        masterlist_db_write_overrides($db, $countryId, $levelId, $writes, $versionId, $by);
        masterlist_db_record_changes($db, $versionId, $changes);
    });
    return $changes;
}

// ---------------------------------------------------------------------------
// The masterlist as one file: edits to its base prices and to any number of country + price level
// lists, plus % changes for many lists at once, saved together as one change (one approval).
//   - a % (on a list, or on every country of a level, or on picked countries) becomes a price rule,
//     so those lists keep following the masterlist; prices set by hand there move by the same %;
//   - a price typed in a list becomes that list's own price.
// ---------------------------------------------------------------------------

/** "Every country · Price Level 2 · Breads": a rule scope in words. */
function masterlist_scope_label(?int $countryId, ?int $levelId, ?string $category): string
{
    $countries = masterlist_db_option_ids('countries');
    $levels = masterlist_db_option_ids('priceLevels');
    return implode(' · ', [
        $countryId === null ? 'Every country' : ($countries[$countryId] ?? '?'),
        $levelId === null ? 'every price level' : ($levels[$levelId] ?? '?'),
        $category ?? 'all categories',
    ]);
}

/** The combined % factor of the batch's rule changes for one product category in one list. */
function masterlist_ops_factor(array $ops, int $countryId, int $levelId, string $category): float
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

/**
 * Works out a one-file save. $input: {base?: {rows, adjustment, categoryAdjustments}, lists: [{id, rows,
 * adjustment, categoryAdjustments}], scoped: [{countries: [], levels: [], categories: [], percent}]}
 * (empty arrays = all). Returns ['batch' => …, 'error' => ?string].
 */
function masterlist_build_batch(array $input): array
{
    $fail = fn(string $message) => ['batch' => null, 'error' => $message];
    $clean = function (array $rows): array {
        $width = count(price_list_template()['normalizedHeaders']);
        return array_map(function ($row) use ($width) {
            $row = array_values(is_array($row) ? $row : []);
            $out = [];
            for ($i = 0; $i < $width; $i++) {
                $value = $row[$i] ?? '';
                $out[] = in_array($i, MASTERLIST_PRICE_COLUMNS, true) && is_numeric($value) ? (float) $value : (is_scalar($value) ? trim((string) $value) : '');
            }
            return $out;
        }, array_slice($rows, 0, 15000));
    };
    $rate = fn(array $draft, string $category) => (float) ($draft['categoryAdjustments'][$category] ?? $draft['adjustment'] ?? 0);

    // Base prices (the masterlist itself).
    $baseEdits = [];
    if (is_array($input['base'] ?? null) && is_array($input['base']['rows'] ?? null)) {
        $draft = $input['base'];
        $result = masterlist_edits(masterlist_base_version(), masterlist_effective_rows($clean($draft['rows']), (float) ($draft['adjustment'] ?? 0), is_array($draft['categoryAdjustments'] ?? null) ? $draft['categoryAdjustments'] : []));
        if ($result['error'] !== null) return $fail($result['error']);
        $baseEdits = $result['edits'];
    }

    // % changes: from each list's own adjustments, and from the ones made for many lists at once.
    $ops = [];
    $lists = [];
    foreach (array_slice(is_array($input['lists'] ?? null) ? $input['lists'] : [], 0, 1000) as $draft) {
        $pair = is_array($draft) ? masterlist_parse_list_id((string) ($draft['id'] ?? '')) : null;
        if (!$pair || !is_array($draft['rows'] ?? null)) continue;
        $live = masterlist_list_version($pair[0], $pair[1]);
        if (!$live) return $fail('One of the lists is no longer in Config (country or price level). Refresh and try again.');
        $lists[] = ['pair' => $pair, 'live' => $live, 'rows' => $clean($draft['rows'])];
        foreach (array_unique(array_map(fn($row) => (string) $row[0], $live['rows'])) as $category) {
            $percent = $rate($draft, $category);
            if ($percent !== 0.0) $ops[] = ['countryId' => $pair[0], 'levelId' => $pair[1], 'category' => $category, 'percent' => round($percent, 4)];
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
                $id = masterlist_option_id($type, (string) $name);
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
    $listEdits = [];
    foreach ($lists as ['pair' => [$countryId, $levelId], 'live' => $live, 'rows' => $rows]) {
        $before = [];
        foreach ($live['rows'] as $row) $before[mb_strtolower((string) $row[1])] = $row;
        if (count($rows) !== count($before)) return $fail("{$live['country']} · {$live['priceLevel']}: products cannot be added or removed in the editor.");
        $edits = [];
        foreach ($rows as $row) {
            $old = $before[mb_strtolower((string) $row[1])] ?? null;
            if (!$old) return $fail("{$live['country']} · {$live['priceLevel']}: product '{$row[1]}' is not in the price list.");
            foreach ($old as $col => $value) {
                if (in_array($col, [0, 1, 8, 9, MASTERLIST_MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
                if (trim((string) ($row[$col] ?? '')) !== trim((string) $value)) {
                    return $fail("{$live['country']} · {$live['priceLevel']}: only prices can be changed for a country. '" . masterlist_column_name($col) . "' of {$old[1]} is the same everywhere: change it in Standard prices.");
                }
            }
            $factor = masterlist_ops_factor($ops, $countryId, $levelId, (string) $old[0]);
            $edit = ['code' => (string) $old[1], 'description' => (string) $old[2], 'category' => (string) $old[0], 'prices' => [], 'fields' => []];
            foreach ([8 => 'pricePc', 9 => 'priceBox'] as $col => $field) {
                $was = is_numeric($old[$col]) ? (float) $old[$col] : null;
                $now = is_numeric($row[$col]) ? (float) $row[$col] : null;
                if (masterlist_same_price($was, $now)) continue;
                $edit['prices'][$field] = ['old' => $was, 'new' => $now === null ? null : masterlist_round($now * $factor)];
            }
            if ($edit['prices']) $edits[] = $edit;
        }
        if ($edits) $listEdits[] = ['id' => $live['id'], 'countryId' => $countryId, 'levelId' => $levelId, 'country' => $live['country'], 'priceLevel' => $live['priceLevel'], 'edits' => $edits];
    }

    if (!$baseEdits && !$ops && !$listEdits) return $fail('Nothing has changed, so there is nothing to save.');
    $ops = array_map(fn($op) => $op + ['label' => masterlist_scope_label($op['countryId'], $op['levelId'], $op['category'])], $ops);
    return ['batch' => ['baseEdits' => $baseEdits, 'ruleOps' => $ops, 'lists' => $listEdits], 'error' => null];
}

/**
 * A one-file save in plain words, for messages, notifications and the audit log:
 *   'parts' – short phrases ("+10% for every country · Price Level 2", "2 prices for Japan · Price Level 2",
 *             "Classic Baguette standard price"), and 'text' – them joined;
 *   'lines' – one line per change, with product names and prices before → after (capped).
 */
function masterlist_batch_description(array $batch): array
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
    // % changes: one phrase per country / price level / % (its categories together).
    $countries = masterlist_db_option_ids('countries');
    $levels = masterlist_db_option_ids('priceLevels');
    $groups = [];
    foreach ($batch['ruleOps'] ?? [] as $op) {
        $key = ($op['countryId'] ?? '') . '|' . ($op['levelId'] ?? '') . '|' . $op['percent'];
        $groups[$key] ??= ['op' => $op, 'categories' => []];
        if ($op['category'] !== null) $groups[$key]['categories'][] = $op['category'];
        else $groups[$key]['all'] = true;
    }
    foreach ($groups as $group) {
        $op = $group['op'];
        $where = ($op['countryId'] === null ? 'every country' : ($countries[$op['countryId']] ?? '?')) . ' · ' . ($op['levelId'] === null ? 'every price level' : ($levels[$op['levelId']] ?? '?'));
        $categories = empty($group['all']) && $group['categories'] ? ' (' . implode(', ', $group['categories']) . ')' : '';
        $phrase = ($op['percent'] > 0 ? '+' : '') . rtrim(rtrim(number_format((float) $op['percent'], 4, '.', ''), '0'), '.') . "% for {$where}{$categories}";
        $parts[] = $phrase;
        $lines[] = ucfirst($phrase);
    }
    // Prices typed for a country + price level.
    foreach ($batch['lists'] ?? [] as $list) {
        $count = count($list['edits']);
        $name = "{$list['country']} · {$list['priceLevel']}";
        $parts[] = $count === 1 ? "{$list['edits'][0]['description']} price for {$name}" : "{$count} prices for {$name}";
        foreach (array_slice($list['edits'], 0, 20) as $edit) $lines[] = "{$name}: " . $priceLine($edit);
        if ($count > 20) $lines[] = "{$name}: and " . ($count - 20) . ' more';
    }
    // Standard prices (every country follows them).
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
function masterlist_batch_counts(array $batch): array
{
    return [count($batch['baseEdits']), count($batch['ruleOps']), array_sum(array_map(fn($list) => count($list['edits']), $batch['lists']))];
}

/** Applies an approved one-file save: base prices, then the % changes, then prices typed in lists. */
function masterlist_apply_batch(array $batch, string $versionId, string $by): void
{
    if ($batch['baseEdits'] ?? []) masterlist_apply_base_edits($batch['baseEdits'], $versionId, $by);
    if ($batch['ruleOps'] ?? []) {
        masterlist_db_transaction(function (PDO $db) use ($batch, $versionId, $by) {
            $changes = [];
            foreach ($batch['ruleOps'] as $op) {
                [$old, $new] = masterlist_db_compose_rule($db, $op, $by);
                $changes[] = ['kind' => 'rule', 'countryId' => $op['countryId'], 'levelId' => $op['levelId'], 'category' => $op['category'], 'field' => 'percent_change', 'old' => $old, 'new' => $new];
            }
            masterlist_db_record_changes($db, $versionId, $changes);
        });
    }
    foreach ($batch['lists'] ?? [] as $list) {
        $prices = [];
        foreach ($list['edits'] as $edit) $prices[$edit['code']] = array_map(fn($p) => $p['new'], $edit['prices']);
        masterlist_set_list_prices((int) $list['countryId'], (int) $list['levelId'], $prices, $versionId, $by);
    }
}

// ---------------------------------------------------------------------------
// Uploads: preview first, then apply (same file, same preview)
// ---------------------------------------------------------------------------

/** Product records from an imported workbook (masterlist upload), in file order. */
function masterlist_products_from_import(array $import): array
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
            'pricePc' => is_numeric($row[8]) ? masterlist_round((float) $row[8]) : null,
            'priceBox' => is_numeric($row[9]) ? masterlist_round((float) $row[9]) : null,
            'row' => $row, 'sort' => $i + 1,
        ];
    }
    return $products;
}

function masterlist_preview_item(array $p, array $extra = []): array
{
    return ['code' => $p['code'], 'description' => $p['description'], 'category' => $p['category']] + $extra;
}

/** What a masterlist upload would change. */
function masterlist_preview_masterlist(array $import): array
{
    $current = [];
    foreach (masterlist_db_products(true) as $p) $current[mb_strtolower($p['code'])] = $p;
    $incoming = masterlist_products_from_import($import);
    $added = $removed = $priceChanges = $detailChanges = [];
    $unchanged = 0;
    $seen = [];
    foreach ($incoming as $p) {
        $key = mb_strtolower($p['code']);
        $seen[$key] = true;
        $old = $current[$key] ?? null;
        if (!$old || !$old['active']) { $added[] = masterlist_preview_item($p, ['pricePc' => $p['pricePc'], 'priceBox' => $p['priceBox'], 'returning' => (bool) $old]); continue; }
        $changed = false;
        if (!masterlist_same_price($old['pricePc'], $p['pricePc']) || !masterlist_same_price($old['priceBox'], $p['priceBox'])) {
            $priceChanges[] = masterlist_preview_item($p, ['pcOld' => $old['pricePc'], 'pcNew' => $p['pricePc'], 'boxOld' => $old['priceBox'], 'boxNew' => $p['priceBox']]);
            $changed = true;
        }
        $fields = [];
        if ($old['category'] !== $p['category']) $fields[] = ['name' => 'Category', 'old' => $old['category'], 'new' => $p['category']];
        foreach ($p['row'] as $col => $value) {
            if (in_array($col, [0, 1, 8, 9, MASTERLIST_MOQ_TOTAL_COLUMN, 19, 20], true)) continue;
            if (trim((string) $value) !== trim((string) ($old['row'][$col] ?? ''))) $fields[] = ['name' => masterlist_column_name($col), 'old' => $old['row'][$col] ?? '', 'new' => $value];
        }
        if ($fields) { $detailChanges[] = masterlist_preview_item($p, ['fields' => $fields]); $changed = true; }
        if (!$changed) $unchanged++;
    }
    foreach ($current as $key => $p) if ($p['active'] && !isset($seen[$key])) $removed[] = masterlist_preview_item($p);
    $limit = fn(array $items) => array_slice($items, 0, MASTERLIST_PREVIEW_LIMIT);
    return [
        'mode' => 'masterlist', 'products' => count($incoming), 'first' => !array_filter($current, fn($p) => $p['active']),
        'counts' => ['added' => count($added), 'removed' => count($removed), 'priceChanges' => count($priceChanges), 'detailChanges' => count($detailChanges), 'unchanged' => $unchanged],
        'added' => $limit($added), 'removed' => $limit($removed), 'priceChanges' => $limit($priceChanges), 'detailChanges' => $limit($detailChanges),
    ];
}

/** Applies a masterlist upload; returns the change records. */
function masterlist_apply_masterlist(array $import, string $versionId): array
{
    $preview = masterlist_preview_masterlist($import);
    $current = [];
    foreach (masterlist_db_products(true) as $p) $current[mb_strtolower($p['code'])] = $p;
    $incoming = masterlist_products_from_import($import);
    $changes = [];
    $seen = [];
    foreach ($incoming as $p) {
        $old = $current[mb_strtolower($p['code'])] ?? null;
        $seen[mb_strtolower($p['code'])] = true;
        if (!$old || !$old['active']) { $changes[] = ['kind' => 'product_add', 'code' => $p['code'], 'category' => $p['category'], 'new' => $p['description']]; continue; }
        foreach (['pricePc' => 'price_pc', 'priceBox' => 'price_box'] as $field => $name) {
            if (!masterlist_same_price($old[$field], $p[$field])) $changes[] = ['kind' => 'base', 'code' => $p['code'], 'category' => $p['category'], 'field' => $name, 'old' => $old[$field], 'new' => $p[$field]];
        }
    }
    foreach ($preview['detailChanges'] as $item) {
        foreach ($item['fields'] as $field) $changes[] = ['kind' => 'field', 'code' => $item['code'], 'category' => $item['category'], 'field' => $field['name'], 'old' => $field['old'], 'new' => $field['new']];
    }
    $deactivate = [];
    foreach ($current as $key => $p) {
        if ($p['active'] && !isset($seen[$key])) { $deactivate[] = $p['code']; $changes[] = ['kind' => 'product_remove', 'code' => $p['code'], 'category' => $p['category'], 'old' => $p['description']]; }
    }
    masterlist_db_transaction(function (PDO $db) use ($incoming, $deactivate, $changes, $versionId) {
        masterlist_db_write_products($db, $incoming, $deactivate, $versionId);
        masterlist_db_record_changes($db, $versionId, $changes);
    });
    return $changes;
}

/** Everything the page needs about the masterlist (null when it's off). */
function masterlist_payload(): ?array
{
    if (!masterlist_enabled()) return null;
    return ['enabled' => true, 'id' => MASTERLIST_ID];
}
