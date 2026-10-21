<?php
declare(strict_types=1);
/**
 * Saves the whole customer or price level list (Config › Customers & price levels), in display
 * order; each customer comes with the price level it buys at. A name that saved price lists use
 * can't be removed or renamed (switch it off instead), so existing lists never lose their customer
 * or level. (The customer list is the type 'countries': see CUSTOMERS in rules/constants.php.)
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to change the customer and price level lists.');

$data = request_json();
$type = in_array($data['type'] ?? '', LIST_OPTION_TYPES, true) ? $data['type'] : null;
if (!$type) json_response(['ok' => false, 'message' => 'Choose the customers or the price levels list.'], 422);
$noun = $type === 'countries' ? 'customer' : 'price level';

$items = [];
$seen = [];
foreach (is_array($data['items'] ?? null) ? $data['items'] : [] as $item) {
    if (!is_array($item)) continue;
    $name = preg_replace('/\s+/u', ' ', clean_text($item['name'] ?? '', 80));
    if ($name === '') continue;
    $key = mb_strtolower($name);
    if (isset($seen[$key])) json_response(['ok' => false, 'message' => "\"{$name}\" is listed twice."], 422);
    $seen[$key] = true;
    $entry = [
        'name' => $name,
        'description' => $type === 'priceLevels' ? clean_text($item['description'] ?? '', 200) : '',
        'active' => (bool) ($item['active'] ?? true),
    ];
    // Every customer buys at one of the price levels.
    if ($type === 'countries') {
        $level = find_option('priceLevels', clean_text($item['level'] ?? '', 120));
        if (!$level) json_response(['ok' => false, 'message' => "Choose the price level {$name} buys at."], 422);
        $entry['level'] = $level['name'];
    }
    $items[] = $entry;
}
if (count($items) > 300) json_response(['ok' => false, 'message' => 'The list can have at most 300 entries.'], 422);
if (!array_filter($items, fn($item) => $item['active'])) json_response(['ok' => false, 'message' => "Keep at least one {$noun} switched on."], 422);

// A price level with customers must stay (move its customers to another level first).
if ($type === 'priceLevels') {
    foreach (customer_levels() as $customer => $level) {
        if (!isset($seen[mb_strtolower($level)])) json_response(['ok' => false, 'message' => "{$level} still has customers ({$customer}…). Move them to another price level first."], 409);
    }
}

// Names in use must stay (as the same name).
foreach (option_usage($type) as $usedName => $count) {
    if (!isset($seen[$usedName])) {
        $original = find_option($type, $usedName)['name'] ?? $usedName;
        json_response(['ok' => false, 'message' => "{$original} is used by {$count} price list" . ($count === 1 ? '' : 's') . '. Switch it off instead of removing or renaming it.'], 409);
    }
}

$before = list_options($type);
repo_save_list_options($type, $items);
$beforeNames = array_map(fn($item) => $item['name'], $before);
$afterNames = array_map(fn($item) => $item['name'], $items);
$added = array_values(array_diff($afterNames, $beforeNames));
$removed = array_values(array_diff($beforeNames, $afterNames));
$label = $type === 'countries' ? 'customers' : 'price levels';
record_audit('list_options', "Updated the {$label} list", "{$user['name']} updated the {$label} list" . ($added ? '; added ' . implode(', ', $added) : '') . ($removed ? '; removed ' . implode(', ', $removed) : '') . '.', [
    'type' => $type, 'added' => $added, 'removed' => $removed,
]);

// Fresh values for the page (static caches in rules/options.php hold the old list in this request).
$usage = option_usage($type);
json_response([
    'ok' => true,
    'type' => $type,
    'items' => array_map(fn($item) => $item + ['usedBy' => $usage[mb_strtolower($item['name'])] ?? 0], $items),
    'active' => array_values(array_map(fn($item) => $item['name'], array_filter($items, fn($item) => $item['active']))),
    'message' => ucfirst($label) . ' saved.',
]);
