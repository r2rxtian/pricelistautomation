<?php
declare(strict_types=1);
/**
 * Loads the official customers and price levels (Requirements 17Oct2026.xlsx › Price Level, kept in
 * CUSTOMERS / PRICE_LEVELS in rules/constants.php) into Config, replacing the placeholder countries
 * and "Price Level 1…5" of the first version.
 *
 *   php sql/load_official_lists.php          show what would change
 *   php sql/load_official_lists.php --apply  change it
 *
 * Command line only. Customers and price levels already there keep their ids (matched by name).
 * Anything not in the official lists is removed, with the test prices and % changes made for it.
 * The products and standard prices are kept.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../rules/customers.php';
require_once __DIR__ . '/../conn/sqlserver.php';

$apply = in_array('--apply', $argv, true);
$db = database_connection(); // also adds the customer → price level column when it is missing
$names = fn(string $sql) => array_map(fn($row) => (string) $row['name'], $db->query($sql)->fetchAll());
$lower = fn(array $list) => array_map('mb_strtolower', $list);

$levelsNow = $names('SELECT name FROM dbo.PLA_PriceLevels');
$customersNow = $names('SELECT name FROM dbo.PLA_Countries');
$oldLevels = array_values(array_filter($levelsNow, fn($n) => !in_array(mb_strtolower($n), $lower(PRICE_LEVELS), true)));
$oldCustomers = array_values(array_filter($customersNow, fn($n) => !in_array(mb_strtolower($n), $lower(array_keys(CUSTOMERS)), true)));
$in = fn(array $list) => $list ? implode(', ', array_fill(0, count($list), '?')) : "''";

$statement = $db->prepare('SELECT
    (SELECT COUNT(*) FROM dbo.PLA_PriceOverrides o JOIN dbo.PLA_Countries c ON c.country_id = o.country_id WHERE c.name IN (' . $in($oldCustomers) . '))
  + (SELECT COUNT(*) FROM dbo.PLA_PriceOverrides o JOIN dbo.PLA_PriceLevels l ON l.price_level_id = o.price_level_id WHERE l.name IN (' . $in($oldLevels) . '))');
$statement->execute(array_merge($oldCustomers, $oldLevels));
$testPrices = (int) $statement->fetchColumn();

echo "Price levels: " . count(PRICE_LEVELS) . " official; removing " . count($oldLevels) . ($oldLevels ? ' (' . implode(', ', $oldLevels) . ')' : '') . "\n";
echo "Customers:    " . count(CUSTOMERS) . " official; removing " . count($oldCustomers) . " placeholder countries\n";
echo "Test prices set for removed entries (deleted with them): {$testPrices}\n";
if (!$apply) { echo "\nNothing changed. Run again with --apply to load the official lists.\n"; exit; }

$db->beginTransaction();
try {
    // Test prices and % changes made for the placeholder entries.
    foreach ([['dbo.PLA_Countries', 'country_id', $oldCustomers], ['dbo.PLA_PriceLevels', 'price_level_id', $oldLevels]] as [$table, $id, $old]) {
        if (!$old) continue;
        $ids = "SELECT {$id} FROM {$table} WHERE name IN (" . $in($old) . ')';
        $db->prepare("DELETE FROM dbo.PLA_PriceOverrides WHERE {$id} IN ({$ids})")->execute($old);
        $db->prepare("DELETE FROM dbo.PLA_PriceRules WHERE {$id} IN ({$ids})")->execute($old);
    }
    if ($oldLevels) $db->prepare('UPDATE dbo.PLA_Countries SET price_level_id = NULL WHERE price_level_id IN (SELECT price_level_id FROM dbo.PLA_PriceLevels WHERE name IN (' . $in($oldLevels) . '))')->execute($oldLevels);
    if ($oldCustomers) $db->prepare('DELETE FROM dbo.PLA_Countries WHERE name IN (' . $in($oldCustomers) . ')')->execute($oldCustomers);
    if ($oldLevels) $db->prepare('DELETE FROM dbo.PLA_PriceLevels WHERE name IN (' . $in($oldLevels) . ')')->execute($oldLevels);
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
// The official lists, in the requirement's order (levels) and A–Z (customers), all switched on.
database_save_list_options('priceLevels', array_map(fn($name) => ['name' => $name, 'description' => '', 'active' => true], PRICE_LEVELS));
$customers = CUSTOMERS;
uksort($customers, 'strcasecmp');
database_save_list_options('countries', array_map(fn($name, $level) => ['name' => $name, 'description' => '', 'active' => true, 'level' => $level], array_keys($customers), $customers));
echo "Done: " . count(PRICE_LEVELS) . " price levels and " . count(CUSTOMERS) . " customers are in Config.\n";
