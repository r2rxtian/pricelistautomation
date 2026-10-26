<?php
declare(strict_types=1);
/**
 * The pricing tables (SQL Server only):
 *   dbo.PLA_Products        one row per product (LRN code) with its base prices
 *   dbo.PLA_PriceRules      % on the base price per customer / price level / category (NULL = all)
 *   dbo.PLA_PriceOverrides  a price set for one product in one price level: for all its customers
 *                           (country_id NULL) or for one customer
 * (Customers live in dbo.PLA_Countries and are country_id: see CUSTOMERS in rules/constants.php.)
 *   dbo.PLA_PriceChanges    what each save changed
 * Business logic (how a price is found, uploads, approvals) is in rules/pricing.php.
 */

require_once __DIR__ . '/sqlserver.php';

function pricing_db_number(mixed $value): ?float
{
    return $value === null || $value === '' ? null : (float) $value;
}

/** @return array<int,array> products in file order (category, then row), active ones unless $all. */
function pricing_db_products(bool $all = false): array
{
    $query = database_connection()->query(
        'SELECT product_id, product_code, category, product_group, layout, description, base_price_pc, base_price_box,
                row_json, sort_order, is_active, version_id, updated_at
         FROM dbo.PLA_Products' . ($all ? '' : ' WHERE is_active = 1') . ' ORDER BY sort_order, product_id'
    );
    return array_map(static fn(array $r): array => [
        'id' => (int) $r['product_id'],
        'code' => (string) $r['product_code'],
        'category' => (string) $r['category'],
        'group' => (string) ($r['product_group'] ?? ''),
        'layout' => (string) $r['layout'],
        'description' => (string) $r['description'],
        'pricePc' => pricing_db_number($r['base_price_pc']),
        'priceBox' => pricing_db_number($r['base_price_box']),
        'row' => json_decode((string) $r['row_json'], true) ?: [],
        'sort' => (int) $r['sort_order'],
        'active' => (bool) $r['is_active'],
        'versionId' => (string) ($r['version_id'] ?? ''),
        'updatedAt' => database_iso($r['updated_at']),
    ], $query->fetchAll());
}

/**
 * How many active products there are and their categories in list order: what the app's list
 * summaries need, without reading every product's details (pricing_db_products takes ~6× longer).
 */
function pricing_db_product_overview(): array
{
    $rows = database_connection()->query(
        'SELECT category, COUNT(*) AS n, MIN(sort_order) AS first_sort FROM dbo.PLA_Products WHERE is_active = 1 GROUP BY category ORDER BY MIN(sort_order), category'
    )->fetchAll();
    return ['count' => array_sum(array_map(fn($r) => (int) $r['n'], $rows)), 'categories' => array_map(fn($r) => (string) $r['category'], $rows)];
}

/** Id => name for countries or price levels (switched-off ones too). */
function pricing_db_option_ids(string $type): array
{
    [$table, $idColumn] = database_list_option_table($type);
    $ids = [];
    foreach (database_connection()->query("SELECT {$idColumn} AS id, name FROM {$table}")->fetchAll() as $row) $ids[(int) $row['id']] = (string) $row['name'];
    return $ids;
}

function pricing_db_rules(): array
{
    $query = database_connection()->query(
        'SELECT rule_id, country_id, price_level_id, category, percent_change, updated_at, updated_by FROM dbo.PLA_PriceRules ORDER BY rule_id'
    );
    return array_map(static fn(array $r): array => [
        'id' => (int) $r['rule_id'],
        'countryId' => $r['country_id'] === null ? null : (int) $r['country_id'],
        'levelId' => $r['price_level_id'] === null ? null : (int) $r['price_level_id'],
        'category' => $r['category'] === null ? null : (string) $r['category'],
        'percent' => (float) $r['percent_change'],
        'updatedAt' => database_iso($r['updated_at']),
        'updatedBy' => (string) $r['updated_by'],
    ], $query->fetchAll());
}

/**
 * Overrides for one customer + price level, keyed by product id. Customer 0 = the level's own prices
 * (for every customer on it; country_id NULL in the table).
 */
function pricing_db_overrides(int $countryId, int $levelId): array
{
    $statement = database_connection()->prepare(
        'SELECT product_id, price_pc, price_box, base_price_pc_when_set, base_price_box_when_set, version_id, set_at, set_by, row_json, sort_order, formulas_json
         FROM dbo.PLA_PriceOverrides WHERE ' . ($countryId === 0 ? 'country_id IS NULL' : 'country_id = ?') . ' AND price_level_id = ?'
    );
    $statement->execute($countryId === 0 ? [$levelId] : [$countryId, $levelId]);
    $overrides = [];
    foreach ($statement->fetchAll() as $r) {
        $overrides[(int) $r['product_id']] = [
            'pricePc' => pricing_db_number($r['price_pc']),
            'priceBox' => pricing_db_number($r['price_box']),
            'basePcWhenSet' => pricing_db_number($r['base_price_pc_when_set']),
            'baseBoxWhenSet' => pricing_db_number($r['base_price_box_when_set']),
            'versionId' => (string) ($r['version_id'] ?? ''),
            'setAt' => database_iso($r['set_at']),
            'setBy' => (string) $r['set_by'],
            // A level's row: the product as its uploaded file has it (details and order).
            'row' => $r['row_json'] === null ? null : (json_decode((string) $r['row_json'], true) ?: null),
            'sort' => $r['sort_order'] === null ? null : (int) $r['sort_order'],
            // The uploaded file's formulas for this product: column => ['excel' => …, 'expr' => …].
            'formulas' => $r['formulas_json'] === null ? [] : (json_decode((string) $r['formulas_json'], true) ?: []),
        ];
    }
    return $overrides;
}

/**
 * Makes a price level's list exactly an uploaded file: $rows are product id => ['pricePc', 'priceBox',
 * 'basePc', 'baseBox', 'row', 'sort'] (every product in the file); products of the level that are not in
 * $rows leave it, with any prices set for its customers.
 */
function pricing_db_replace_level(PDO $connection, int $levelId, array $rows, string $versionId, string $by): void
{
    $keep = array_map('intval', array_keys($rows));
    $current = $connection->prepare('SELECT product_id FROM dbo.PLA_PriceOverrides WHERE country_id IS NULL AND price_level_id = ?');
    $current->execute([$levelId]);
    $remove = array_diff(array_map('intval', $current->fetchAll(PDO::FETCH_COLUMN)), $keep);
    $drop = $connection->prepare('DELETE FROM dbo.PLA_PriceOverrides WHERE product_id = ? AND price_level_id = ?');
    foreach ($remove as $productId) $drop->execute([$productId, $levelId]);
    $update = $connection->prepare(
        'UPDATE dbo.PLA_PriceOverrides SET price_pc = ?, price_box = ?, base_price_pc_when_set = ?, base_price_box_when_set = ?, row_json = ?, sort_order = ?,
            version_id = ?, set_at = SYSUTCDATETIME(), set_by = ?
         WHERE product_id = ? AND country_id IS NULL AND price_level_id = ?'
    );
    $insert = $connection->prepare(
        'INSERT INTO dbo.PLA_PriceOverrides (product_id, country_id, price_level_id, price_pc, price_box, base_price_pc_when_set, base_price_box_when_set, row_json, sort_order, version_id, set_by)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($rows as $productId => $r) {
        $values = [$r['pricePc'], $r['priceBox'], $r['basePc'], $r['baseBox'], json_encode($r['row'], JSON_UNESCAPED_UNICODE), $r['sort']];
        $update->execute(array_merge($values, [$versionId, $by, $productId, $levelId]));
        if ($update->rowCount() === 0) $insert->execute(array_merge([$productId, $levelId], $values, [$versionId, $by]));
    }
}

/** How many own prices each list has: "customerId-levelId" (0 = the level's) => count (active products only). */
function pricing_db_override_counts(): array
{
    $counts = [];
    $query = database_connection()->query(
        'SELECT o.country_id, o.price_level_id, COUNT(*) AS n FROM dbo.PLA_PriceOverrides o
         JOIN dbo.PLA_Products p ON p.product_id = o.product_id AND p.is_active = 1
         GROUP BY o.country_id, o.price_level_id'
    );
    foreach ($query->fetchAll() as $r) $counts[(int) $r['country_id'] . '-' . $r['price_level_id']] = (int) $r['n'];
    return $counts;
}

/** When each list last changed and by whom: "customerId-levelId" (0 = the level's file) => ['at', 'by']. */
function pricing_db_last_changes(): array
{
    $changes = [];
    $query = database_connection()->query(
        'SELECT country_id, price_level_id, set_at, set_by FROM (
            SELECT country_id, price_level_id, set_at, set_by,
                   ROW_NUMBER() OVER (PARTITION BY country_id, price_level_id ORDER BY set_at DESC) AS n
            FROM dbo.PLA_PriceOverrides) latest WHERE n = 1'
    );
    foreach ($query->fetchAll() as $r) $changes[(int) $r['country_id'] . '-' . $r['price_level_id']] = ['at' => database_iso($r['set_at']), 'by' => (string) $r['set_by']];
    return $changes;
}

/** The newest change record's id: where an opened list starts watching for changes made by others. */
function pricing_db_latest_change_id(): int
{
    return (int) database_connection()->query('SELECT ISNULL(MAX(change_id), 0) FROM dbo.PLA_PriceChanges')->fetchColumn();
}

/**
 * Changes applied after change $after that reach one list (customer 0 = the price level's own list):
 * ['count' => products changed, 'people' => [who saved them], 'at' => newest, 'last' => newest change id],
 * or null when there are none. Standard prices and % changes for every list count too.
 */
function pricing_db_changes_since(int $after, int $countryId, int $levelId): ?array
{
    $statement = database_connection()->prepare(
        'SELECT ch.change_id, ch.product_code, ch.change_kind, ch.changed_at, v.saved_by
         FROM dbo.PLA_PriceChanges ch LEFT JOIN dbo.PLA_Versions v ON v.version_id = ch.version_id
         WHERE ch.change_id > ? AND (ch.price_level_id IS NULL OR ch.price_level_id = ?)
           AND ' . ($countryId === 0 ? 'ch.country_id IS NULL' : '(ch.country_id IS NULL OR ch.country_id = ?)') . '
         ORDER BY ch.change_id DESC'
    );
    $statement->execute($countryId === 0 ? [$after, $levelId] : [$after, $levelId, $countryId]);
    $rows = $statement->fetchAll();
    if (!$rows) return null;
    $products = [];
    $people = [];
    foreach ($rows as $r) {
        // A % change has no product: it counts as one change.
        $products[$r['change_kind'] === 'rule' ? 'rule-' . $r['change_id'] : mb_strtolower((string) $r['product_code'])] = true;
        if (trim((string) $r['saved_by']) !== '') $people[(string) $r['saved_by']] = true;
    }
    return ['count' => count($products), 'people' => array_keys($people), 'at' => database_iso($rows[0]['changed_at']), 'last' => (int) $rows[0]['change_id']];
}

/** When the masterlist was last changed and by which save. */
function pricing_db_last_update(): ?array
{
    $row = database_connection()->query('SELECT TOP 1 version_id, updated_at FROM dbo.PLA_Products ORDER BY updated_at DESC')->fetch();
    return $row ? ['versionId' => (string) ($row['version_id'] ?? ''), 'updatedAt' => database_iso($row['updated_at'])] : null;
}

/** Runs $work inside one transaction (all or nothing). */
function pricing_db_transaction(callable $work): mixed
{
    $connection = database_connection();
    $connection->beginTransaction();
    try {
        $result = $work($connection);
        $connection->commit();
        return $result;
    } catch (Throwable $error) {
        $connection->rollBack();
        throw $error;
    }
}

/**
 * Writes masterlist products: $upserts are full product records (matched by code); codes in
 * $deactivate are switched off (kept so history and older prices still resolve).
 */
function pricing_db_write_products(PDO $connection, array $upserts, array $deactivate, string $versionId): void
{
    $merge = $connection->prepare(
        'MERGE dbo.PLA_Products AS target
         USING (SELECT ? AS product_code) AS source ON target.product_code = source.product_code
         WHEN MATCHED THEN UPDATE SET category = ?, product_group = ?, layout = ?, description = ?, base_price_pc = ?, base_price_box = ?,
            row_json = ?, sort_order = ?, is_active = 1, version_id = ?, updated_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN INSERT (product_code, category, product_group, layout, description, base_price_pc, base_price_box, row_json, sort_order, is_active, version_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?);'
    );
    foreach ($upserts as $p) {
        $values = [$p['category'], $p['group'], $p['layout'], $p['description'], $p['pricePc'], $p['priceBox'], json_encode($p['row'], JSON_UNESCAPED_UNICODE), $p['sort'], $versionId];
        $merge->execute(array_merge([$p['code']], $values, [$p['code']], $values));
    }
    $off = $connection->prepare('UPDATE dbo.PLA_Products SET is_active = 0, version_id = ?, updated_at = SYSUTCDATETIME() WHERE product_code = ?');
    foreach ($deactivate as $code) $off->execute([$versionId, $code]);
}

/**
 * Sets (or clears, when both prices are null) the own prices of products in one list (customer 0 =
 * the level's prices). $prices: product id => ['pricePc' => ?float, 'priceBox' => ?float, 'basePc' => ?float, 'baseBox' => ?float].
 */
function pricing_db_write_overrides(PDO $connection, int $countryId, int $levelId, array $prices, string $versionId, string $by): void
{
    $customer = $countryId === 0 ? null : $countryId;
    $sameCustomer = $customer === null ? 'country_id IS NULL' : 'country_id = ?';
    // No price of its own any more: the row goes, unless it holds the list's own details (then only its prices are cleared).
    $delete = $connection->prepare("DELETE FROM dbo.PLA_PriceOverrides WHERE product_id = ? AND {$sameCustomer} AND price_level_id = ? AND row_json IS NULL");
    $clear = $connection->prepare("UPDATE dbo.PLA_PriceOverrides SET price_pc = NULL, price_box = NULL WHERE product_id = ? AND {$sameCustomer} AND price_level_id = ? AND row_json IS NOT NULL");
    $update = $connection->prepare(
        "UPDATE dbo.PLA_PriceOverrides SET price_pc = ?, price_box = ?, base_price_pc_when_set = ?, base_price_box_when_set = ?, version_id = ?, set_at = SYSUTCDATETIME(), set_by = ?
         WHERE product_id = ? AND {$sameCustomer} AND price_level_id = ?"
    );
    $insert = $connection->prepare(
        'INSERT INTO dbo.PLA_PriceOverrides (product_id, country_id, price_level_id, price_pc, price_box, base_price_pc_when_set, base_price_box_when_set, version_id, set_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $key = fn(int $productId) => $customer === null ? [$productId, $levelId] : [$productId, $customer, $levelId];
    foreach ($prices as $productId => $p) {
        if ($p['pricePc'] === null && $p['priceBox'] === null) {
            $delete->execute($key($productId));
            $clear->execute($key($productId));
            continue;
        }
        $values = [$p['pricePc'], $p['priceBox'], $p['basePc'], $p['baseBox'], $versionId, $by];
        $update->execute(array_merge($values, $key($productId)));
        if ($update->rowCount() === 0) $insert->execute(array_merge([$productId, $customer, $levelId], $values));
    }
}

/**
 * Saves product details (row_json) in one list: a price level's file (customer 0) or one customer's own
 * details. $rows: product id => row. A customer without a row for the product gets one with no prices of
 * its own (it keeps following its level's prices).
 */
function pricing_db_write_rows(PDO $connection, int $countryId, int $levelId, array $rows, string $versionId, string $by, ?array $formulas = null): void
{
    // $formulas (product id => [column => formula]): an upload's formulas, saved with the rows. Left out
    // (null), the saved formulas stay as they are (editing details doesn't touch them).
    if ($formulas !== null) {
        $setFormulas = $connection->prepare('UPDATE dbo.PLA_PriceOverrides SET formulas_json = ? WHERE product_id = ? AND ' . ($countryId === 0 ? 'country_id IS NULL' : 'country_id = ?') . ' AND price_level_id = ?');
    }
    $customer = $countryId === 0 ? null : $countryId;
    $sameCustomer = $customer === null ? 'country_id IS NULL' : 'country_id = ?';
    $update = $connection->prepare(
        "UPDATE dbo.PLA_PriceOverrides SET row_json = ?, version_id = ?, set_at = SYSUTCDATETIME(), set_by = ?
         WHERE product_id = ? AND {$sameCustomer} AND price_level_id = ?"
    );
    $insert = $connection->prepare(
        'INSERT INTO dbo.PLA_PriceOverrides (product_id, country_id, price_level_id, price_pc, price_box, row_json, version_id, set_by)
         VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)'
    );
    foreach ($rows as $productId => $row) {
        $json = json_encode(array_values($row), JSON_UNESCAPED_UNICODE);
        $update->execute(array_merge([$json, $versionId, $by, $productId], $customer === null ? [$levelId] : [$customer, $levelId]));
        if ($update->rowCount() === 0 && $customer !== null) $insert->execute([$productId, $customer, $levelId, $json, $versionId, $by]);
        if ($formulas !== null) {
            $set = $formulas[$productId] ?? [];
            $value = $set ? json_encode($set, JSON_UNESCAPED_UNICODE) : null;
            $setFormulas->execute(array_merge([$value, $productId], $customer === null ? [$levelId] : [$customer, $levelId]));
        }
    }
}

/**
 * Adds a % on top of the rule for one scope (rules at the same scope multiply into one), and moves
 * the prices set by hand in that scope by the same %, so every price shown there moves together.
 * Returns [old %, new %] of the rule.
 */
function pricing_db_compose_rule(PDO $connection, array $op, string $by): array
{
    $where = static fn(string $column, $value) => $value === null ? "{$column} IS NULL" : "{$column} = ?";
    $params = array_values(array_filter([$op['countryId'], $op['levelId'], $op['category']], fn($v) => $v !== null));
    $find = $connection->prepare('SELECT rule_id, percent_change FROM dbo.PLA_PriceRules WHERE ' . implode(' AND ', [
        $where('country_id', $op['countryId']), $where('price_level_id', $op['levelId']), $where('category', $op['category']),
    ]));
    $find->execute($params);
    $existing = $find->fetch() ?: null;
    $old = $existing ? (float) $existing['percent_change'] : 0.0;
    $new = round(((1 + $old / 100) * (1 + $op['percent'] / 100) - 1) * 100, 4);
    if ($existing && abs($new) < 0.00005) {
        $connection->prepare('DELETE FROM dbo.PLA_PriceRules WHERE rule_id = ?')->execute([$existing['rule_id']]);
    } elseif ($existing) {
        $connection->prepare('UPDATE dbo.PLA_PriceRules SET percent_change = ?, updated_at = SYSUTCDATETIME(), updated_by = ? WHERE rule_id = ?')->execute([$new, $by, $existing['rule_id']]);
    } elseif (abs($new) >= 0.00005) {
        $connection->prepare('INSERT INTO dbo.PLA_PriceRules (country_id, price_level_id, category, percent_change, updated_by) VALUES (?, ?, ?, ?, ?)')
            ->execute([$op['countryId'], $op['levelId'], $op['category'], $new, $by]);
    }
    // Prices set by hand in this scope move by the same %.
    $factor = 1 + $op['percent'] / 100;
    $scope = ['1 = 1'];
    $scaleParams = [$factor, $factor];
    if ($op['countryId'] !== null) { $scope[] = 'o.country_id = ?'; $scaleParams[] = $op['countryId']; }
    if ($op['levelId'] !== null) { $scope[] = 'o.price_level_id = ?'; $scaleParams[] = $op['levelId']; }
    if ($op['category'] !== null) { $scope[] = "COALESCE(JSON_VALUE(o.row_json, '$[0]'), p.category) = ?"; $scaleParams[] = $op['category']; }
    $connection->prepare(
        'UPDATE o SET price_pc = ROUND(o.price_pc * ?, 4), price_box = ROUND(o.price_box * ?, 4)
         FROM dbo.PLA_PriceOverrides o JOIN dbo.PLA_Products p ON p.product_id = o.product_id WHERE ' . implode(' AND ', $scope)
    )->execute($scaleParams);
    return [$existing ? $old : null, abs($new) < 0.00005 ? null : $new];
}

/** Records what a save changed. $changes: [{kind, code?, countryId?, levelId?, category?, field?, old?, new?}]. */
function pricing_db_record_changes(PDO $connection, string $versionId, array $changes): void
{
    $insert = $connection->prepare(
        'INSERT INTO dbo.PLA_PriceChanges (version_id, change_kind, product_code, country_id, price_level_id, category, field_name, old_value, new_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $text = static fn($value) => $value === null ? null : mb_substr(is_float($value) ? rtrim(rtrim(number_format($value, 4, '.', ''), '0'), '.') : (string) $value, 0, 400);
    foreach ($changes as $c) {
        $insert->execute([$versionId, $c['kind'], $c['code'] ?? null, $c['countryId'] ?? null, $c['levelId'] ?? null, $c['category'] ?? null, $c['field'] ?? null, $text($c['old'] ?? null), $text($c['new'] ?? null)]);
    }
}

/**
 * Countries / price levels the masterlist uses, keyed by lowercase name: how many lists have their own
 * prices for it, plus its price rules.
 */
function pricing_db_option_usage(string $type): array
{
    [$table, $idColumn] = database_list_option_table($type);
    $otherColumn = $type === 'countries' ? 'price_level_id' : 'country_id';
    $usage = [];
    $query = database_connection()->query(
        "SELECT t.name, (SELECT COUNT(DISTINCT ISNULL(o.{$otherColumn}, 0)) FROM dbo.PLA_PriceOverrides o WHERE o.{$idColumn} = t.{$idColumn})
                      + (SELECT COUNT(*) FROM dbo.PLA_PriceRules r WHERE r.{$idColumn} = t.{$idColumn}) AS n
         FROM {$table} t"
    );
    foreach ($query->fetchAll() as $r) if ((int) $r['n'] > 0) $usage[mb_strtolower((string) $r['name'])] = (int) $r['n'];
    return $usage;
}
