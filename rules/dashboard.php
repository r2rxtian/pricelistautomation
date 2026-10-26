<?php
declare(strict_types=1);
/**
 * The Dashboard (pages/dashboard.php): every price level at a glance, worked out in one pass.
 *   - levels:   per price level, its customers, how many of its prices were uploaded / set for it
 *               (the rest still follow the reference prices), how it compares with the cheapest
 *               level, and when it last changed and by whom;
 *   - ladder:   every product with its Price/pc and Price/box in each level (the "price ladder");
 *   - activity: uploads, price changes and exports per day for the last 30 days.
 */

require_once __DIR__ . '/pricing.php';

const DASHBOARD_DAYS = 30;

function dashboard_payload(array $user): array
{
    $products = pricing_enabled() ? pricing_db_products() : [];
    $rules = $products ? pricing_db_rules() : [];
    $levels = array_values(array_filter(database_get_list_options('priceLevels') ?? [], fn($o) => $o['active']));
    $customers = array_values(array_filter(database_get_list_options('countries') ?? [], fn($o) => $o['active']));

    // Every price set for a level or a customer, once.
    $levelPrices = [];   // levelId => productId => row
    $customerOwn = [];   // levelId => count
    $lastChange = [];    // levelId => ['at', 'by']
    $touch = function (int $levelId, string $at, string $by) use (&$lastChange) {
        if ($at !== '' && ($lastChange[$levelId]['at'] ?? '') < $at) $lastChange[$levelId] = ['at' => $at, 'by' => $by];
    };
    if ($products) {
        $query = database_connection()->query(
            'SELECT o.product_id, o.country_id, o.price_level_id, o.price_pc, o.price_box, o.set_at, o.set_by
             FROM dbo.PLA_PriceOverrides o JOIN dbo.PLA_Products p ON p.product_id = o.product_id AND p.is_active = 1'
        );
        foreach ($query->fetchAll() as $row) {
            $levelId = (int) $row['price_level_id'];
            $touch($levelId, database_iso($row['set_at']), (string) $row['set_by']);
            if ($row['country_id'] === null) {
                $levelPrices[$levelId][(int) $row['product_id']] = ['pc' => pricing_db_number($row['price_pc']), 'box' => pricing_db_number($row['price_box'])];
            } else {
                $customerOwn[$levelId] = ($customerOwn[$levelId] ?? 0) + 1;
            }
        }
        foreach ($rules as $rule) if ($rule['levelId'] !== null) $touch($rule['levelId'], $rule['updatedAt'], $rule['updatedBy']);
    }

    // The ladder: each product's price in each level.
    $ladder = [];
    $uploaded = [];
    foreach ($products as $p) {
        $pcs = [];
        $boxes = [];
        $own = [];
        // A level's price is the one in its uploaded file; a product not in that file has none there.
        foreach ($levels as $level) {
            $set = $levelPrices[$level['id']][$p['id']] ?? null;
            $pcs[] = $set['pc'] ?? null;
            $boxes[] = $set['box'] ?? null;
            $own[] = $set !== null;
            if ($set !== null) $uploaded[$level['id']] = ($uploaded[$level['id']] ?? 0) + 1;
        }
        if (!array_filter($own)) continue; // in no level's file (any more)
        $ladder[] = [
            'code' => $p['code'], 'name' => $p['description'], 'category' => $p['category'], 'group' => $p['group'],
            'pc' => $pcs, 'box' => $boxes, 'own' => $own,
        ];
    }

    // How each level compares with the cheapest one, product by product (average of price ÷ lowest).
    $ratios = array_fill(0, count($levels), []);
    foreach ($ladder as $item) {
        $known = array_filter($item['pc'], fn($v) => $v !== null && $v > 0);
        if (count($known) < 2) continue;
        $low = min($known);
        foreach ($item['pc'] as $i => $value) if ($value !== null && $value > 0) $ratios[$i][] = $value / $low;
    }

    $levelCards = [];
    foreach ($levels as $i => $level) {
        $onLevel = array_values(array_map(fn($c) => $c['name'], array_filter($customers, fn($c) => $c['levelId'] === $level['id'])));
        $levelCards[] = [
            'id' => pricing_list_id(0, $level['id']), 'name' => $level['name'], 'description' => $level['description'],
            'customers' => $onLevel,
            'uploaded' => $uploaded[$level['id']] ?? 0,
            'customerPrices' => $customerOwn[$level['id']] ?? 0,
            'aboveLowest' => $ratios[$i] ? round((array_sum($ratios[$i]) / count($ratios[$i]) - 1) * 100, 1) : null,
            'lastChange' => $lastChange[$level['id']] ?? null,
        ];
    }

    return [
        'products' => count($ladder), // in at least one level's file
        'customers' => count($customers),
        'customersWithoutLevel' => array_values(array_map(fn($c) => $c['name'], array_filter($customers, fn($c) => $c['levelId'] === null))),
        'levels' => $levelCards,
        'ladder' => $ladder,
        'activity' => dashboard_activity($user),
    ];
}

/** Uploads, price changes and exports per day (Philippine time), oldest first, plus the latest few. */
function dashboard_activity(array $user): array
{
    $groups = [
        'uploads' => ['import_workbook'],
        'changes' => ['save_version', 'approve_version', 'reject_version'],
        'exports' => ['export_excel', 'export_pdf'],
    ];
    $days = [];
    $today = new DateTimeImmutable('today', new DateTimeZone('Asia/Manila'));
    for ($i = DASHBOARD_DAYS - 1; $i >= 0; $i--) {
        $days[$today->modify("-{$i} days")->format('Y-m-d')] = ['uploads' => 0, 'changes' => 0, 'exports' => 0];
    }
    $recent = [];
    foreach (repo_list_audit(800) as $log) {
        $day = (new DateTimeImmutable($log['timestamp']))->setTimezone(new DateTimeZone('Asia/Manila'))->format('Y-m-d');
        if (!isset($days[$day])) continue;
        foreach ($groups as $group => $types) {
            if (!in_array($log['type'], $types, true)) continue;
            $days[$day][$group]++;
            if (count($recent) < 6) $recent[] = ['group' => $group, 'title' => $log['title'], 'actor' => $log['actor'], 'at' => $log['timestamp']];
        }
    }
    $out = [];
    foreach ($days as $date => $counts) $out[] = ['date' => $date] + $counts;
    // Who did what is in the audit log: only people who may read it see the names.
    return ['days' => $out, 'recent' => user_can($user, 'viewAudit') ? $recent : []];
}
