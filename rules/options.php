<?php
declare(strict_types=1);
/**
 * The customer and price level lists (Config › Customers & price levels). Until an admin edits a
 * list, the defaults from constants.php (CUSTOMERS, PRICE_LEVELS) apply. Each entry is
 * {name, description, active}; customers also have 'level', the price level they buy at. Inactive
 * entries stay valid for price lists that already use them, but can't be chosen for new uploads.
 * (The customer list keeps its first name, 'countries': see CUSTOMERS in constants.php.)
 */

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/../repository/store.php';

const LIST_OPTION_TYPES = ['countries', 'priceLevels'];

/** @return array<int,array{name:string,description:string,active:bool,level?:string}> */
function list_options(string $type): array
{
    static $cache = [];
    if (isset($cache[$type])) return $cache[$type];
    $saved = repo_get_list_options($type);
    if ($saved === null) {
        $saved = $type === 'countries'
            ? array_map(fn($name, $level) => ['name' => $name, 'level' => $level], array_keys(CUSTOMERS), CUSTOMERS)
            : array_map(fn($name) => ['name' => $name], PRICE_LEVELS);
    }
    return $cache[$type] = array_values(array_map(fn($item) => [
        'name' => (string) ($item['name'] ?? ''),
        'description' => (string) ($item['description'] ?? ''),
        'active' => (bool) ($item['active'] ?? true),
    ] + ($type === 'countries' ? ['level' => (string) ($item['level'] ?? '')] : []), $saved));
}

/** Names offered in the upload/save dropdowns. */
function active_option_names(string $type): array
{
    return array_values(array_map(fn($item) => $item['name'], array_filter(list_options($type), fn($item) => $item['active'])));
}

/** Customer name => the price level it buys at (switched-on customers with a level). */
function customer_levels(): array
{
    $levels = [];
    foreach (list_options('countries') as $item) {
        if ($item['active'] && $item['level'] !== '') $levels[$item['name']] = $item['level'];
    }
    return $levels;
}

/** The configured entry matching $input (any case/spacing), active or not; null when not listed. */
function find_option(string $type, string $input): ?array
{
    $key = mb_strtolower(preg_replace('/\s+/u', ' ', trim($input)));
    if ($key === '') return null;
    foreach (list_options($type) as $item) {
        if (mb_strtolower($item['name']) === $key) return $item;
    }
    return null;
}

/** How many saved price lists use each name, keyed by lowercase name. */
function option_usage(string $type): array
{
    $field = $type === 'countries' ? 'country' : 'priceLevel';
    $counts = [];
    $seen = [];
    foreach (repo_list_version_summaries() as $version) {
        $name = mb_strtolower(trim((string) ($version[$field] ?? '')));
        if ($name === '') continue;
        // Count price lists (name + customer + level), not every saved version of them.
        $list = mb_strtolower(trim((string) ($version['name'] ?? ''))) . '|' . mb_strtolower((string) ($version['country'] ?? '')) . '|' . mb_strtolower((string) ($version['priceLevel'] ?? ''));
        if (isset($seen[$list])) continue;
        $seen[$list] = true;
        $counts[$name] = ($counts[$name] ?? 0) + 1;
    }
    // Prices set for a customer / level in the price list, and its % changes, use it too.
    if (STORAGE_DRIVER === 'sqlserver') {
        require_once __DIR__ . '/../repository/masterlist.php';
        foreach (masterlist_db_option_usage($type) as $name => $count) $counts[$name] = ($counts[$name] ?? 0) + $count;
    }
    return $counts;
}

/** Both lists with usage counts, for the Config page. */
function list_options_payload(): array
{
    $payload = [];
    foreach (LIST_OPTION_TYPES as $type) {
        $usage = option_usage($type);
        $payload[$type] = array_map(fn($item) => $item + ['usedBy' => $usage[mb_strtolower($item['name'])] ?? 0], list_options($type));
    }
    // How many customers buy at each price level.
    $customers = array_count_values(array_filter(array_map(fn($item) => mb_strtolower($item['level']), list_options('countries'))));
    $payload['priceLevels'] = array_map(fn($item) => $item + ['customers' => $customers[mb_strtolower($item['name'])] ?? 0], $payload['priceLevels']);
    return $payload;
}
