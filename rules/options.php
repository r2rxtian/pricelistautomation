<?php
declare(strict_types=1);
/**
 * The country and price level lists (Config › Countries & price levels). Until an admin edits a
 * list, the defaults from constants.php (COUNTRIES, PRICE_LEVELS) apply. Each entry is
 * {name, description, active}: inactive entries stay valid for price lists that already use them,
 * but can't be chosen for new uploads.
 */

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/../repository/store.php';

const LIST_OPTION_TYPES = ['countries', 'priceLevels'];

/** @return array<int,array{name:string,description:string,active:bool}> */
function list_options(string $type): array
{
    static $cache = [];
    if (isset($cache[$type])) return $cache[$type];
    $saved = repo_get_list_options($type);
    if ($saved === null) {
        $defaults = $type === 'countries' ? COUNTRIES : PRICE_LEVELS;
        $saved = array_map(fn($name) => ['name' => $name, 'description' => '', 'active' => true], $defaults);
    }
    return $cache[$type] = array_values(array_map(fn($item) => [
        'name' => (string) ($item['name'] ?? ''),
        'description' => (string) ($item['description'] ?? ''),
        'active' => (bool) ($item['active'] ?? true),
    ], $saved));
}

/** Names offered in the upload/save dropdowns. */
function active_option_names(string $type): array
{
    return array_values(array_map(fn($item) => $item['name'], array_filter(list_options($type), fn($item) => $item['active'])));
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
        // Count price lists (name + country + level), not every saved version of them.
        $list = mb_strtolower(trim((string) ($version['name'] ?? ''))) . '|' . mb_strtolower((string) ($version['country'] ?? '')) . '|' . mb_strtolower((string) ($version['priceLevel'] ?? ''));
        if (isset($seen[$list])) continue;
        $seen[$list] = true;
        $counts[$name] = ($counts[$name] ?? 0) + 1;
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
    return $payload;
}
