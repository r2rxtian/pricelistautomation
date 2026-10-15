<?php
declare(strict_types=1);
/**
 * The price masterlist tables (SQL Server only):
 *   dbo.PLA_Products        one row per product (LRN code) with its base prices
 *   dbo.PLA_PriceRules      % on the base price per country / price level / category (NULL = all)
 *   dbo.PLA_PriceOverrides  a price set for one product in one country + price level
 *   dbo.PLA_PriceChanges    what each save changed
 * Business logic (how a price is found, uploads, approvals) is in rules/masterlist.php.
 */

require_once __DIR__ . '/sqlserver.php';

function masterlist_db_number(mixed $value): ?float
{
    return $value === null || $value === '' ? null : (float) $value;
}

/** @return array<int,array> products in file order (category, then row), active ones unless $all. */
function masterlist_db_products(bool $all = false): array
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
        'pricePc' => masterlist_db_number($r['base_price_pc']),
        'priceBox' => masterlist_db_number($r['base_price_box']),
        'row' => json_decode((string) $r['row_json'], true) ?: [],
        'sort' => (int) $r['sort_order'],
        'active' => (bool) $r['is_active'],
        'versionId' => (string) ($r['version_id'] ?? ''),
        'updatedAt' => database_iso($r['updated_at']),
    ], $query->fetchAll());
}

/** Id => name for countries or price levels (switched-off ones too). */
function masterlist_db_option_ids(string $type): array
{
    [$table, $idColumn] = database_list_option_table($type);
    $ids = [];
    foreach (database_connection()->query("SELECT {$idColumn} AS id, name FROM {$table}")->fetchAll() as $row) $ids[(int) $row['id']] = (string) $row['name'];
    return $ids;
}

function masterlist_db_rules(): array
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

/** Overrides for one country + price level, keyed by product id. */
function masterlist_db_overrides(int $countryId, int $levelId): array
{
    $statement = database_connection()->prepare(
        'SELECT product_id, price_pc, price_box, base_price_pc_when_set, base_price_box_when_set, version_id, set_at, set_by
         FROM dbo.PLA_PriceOverrides WHERE country_id = ? AND price_level_id = ?'
    );
    $statement->execute([$countryId, $levelId]);
    $overrides = [];
    foreach ($statement->fetchAll() as $r) {
        $overrides[(int) $r['product_id']] = [
            'pricePc' => masterlist_db_number($r['price_pc']),
            'priceBox' => masterlist_db_number($r['price_box']),
            'basePcWhenSet' => masterlist_db_number($r['base_price_pc_when_set']),
            'baseBoxWhenSet' => masterlist_db_number($r['base_price_box_when_set']),
            'versionId' => (string) ($r['version_id'] ?? ''),
            'setAt' => database_iso($r['set_at']),
            'setBy' => (string) $r['set_by'],
        ];
    }
    return $overrides;
}

/** How many own prices each list has: "countryId-levelId" => count (active products only). */
function masterlist_db_override_counts(): array
{
    $counts = [];
    $query = database_connection()->query(
        'SELECT o.country_id, o.price_level_id, COUNT(*) AS n FROM dbo.PLA_PriceOverrides o
         JOIN dbo.PLA_Products p ON p.product_id = o.product_id AND p.is_active = 1
         GROUP BY o.country_id, o.price_level_id'
    );
    foreach ($query->fetchAll() as $r) $counts[$r['country_id'] . '-' . $r['price_level_id']] = (int) $r['n'];
    return $counts;
}

/** When the masterlist was last changed and by which save. */
function masterlist_db_last_update(): ?array
{
    $row = database_connection()->query('SELECT TOP 1 version_id, updated_at FROM dbo.PLA_Products ORDER BY updated_at DESC')->fetch();
    return $row ? ['versionId' => (string) ($row['version_id'] ?? ''), 'updatedAt' => database_iso($row['updated_at'])] : null;
}

/** Runs $work inside one transaction (all or nothing). */
function masterlist_db_transaction(callable $work): mixed
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
function masterlist_db_write_products(PDO $connection, array $upserts, array $deactivate, string $versionId): void
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
 * Sets (or clears, when both prices are null) the own prices of products in one list.
 * $prices: product id => ['pricePc' => ?float, 'priceBox' => ?float, 'basePc' => ?float, 'baseBox' => ?float].
 */
function masterlist_db_write_overrides(PDO $connection, int $countryId, int $levelId, array $prices, string $versionId, string $by): void
{
    $delete = $connection->prepare('DELETE FROM dbo.PLA_PriceOverrides WHERE product_id = ? AND country_id = ? AND price_level_id = ?');
    $merge = $connection->prepare(
        'MERGE dbo.PLA_PriceOverrides AS target
         USING (SELECT ? AS product_id, ? AS country_id, ? AS price_level_id) AS source
            ON target.product_id = source.product_id AND target.country_id = source.country_id AND target.price_level_id = source.price_level_id
         WHEN MATCHED THEN UPDATE SET price_pc = ?, price_box = ?, base_price_pc_when_set = ?, base_price_box_when_set = ?, version_id = ?, set_at = SYSUTCDATETIME(), set_by = ?
         WHEN NOT MATCHED THEN INSERT (product_id, country_id, price_level_id, price_pc, price_box, base_price_pc_when_set, base_price_box_when_set, version_id, set_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);'
    );
    foreach ($prices as $productId => $p) {
        if ($p['pricePc'] === null && $p['priceBox'] === null) {
            $delete->execute([$productId, $countryId, $levelId]);
            continue;
        }
        $values = [$p['pricePc'], $p['priceBox'], $p['basePc'], $p['baseBox'], $versionId, $by];
        $merge->execute(array_merge([$productId, $countryId, $levelId], $values, [$productId, $countryId, $levelId], $values));
    }
}

/**
 * Adds a % on top of the rule for one scope (rules at the same scope multiply into one), and moves
 * the prices set by hand in that scope by the same %, so every price shown there moves together.
 * Returns [old %, new %] of the rule.
 */
function masterlist_db_compose_rule(PDO $connection, array $op, string $by): array
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
    if ($op['category'] !== null) { $scope[] = 'p.category = ?'; $scaleParams[] = $op['category']; }
    $connection->prepare(
        'UPDATE o SET price_pc = ROUND(o.price_pc * ?, 4), price_box = ROUND(o.price_box * ?, 4)
         FROM dbo.PLA_PriceOverrides o JOIN dbo.PLA_Products p ON p.product_id = o.product_id WHERE ' . implode(' AND ', $scope)
    )->execute($scaleParams);
    return [$existing ? $old : null, abs($new) < 0.00005 ? null : $new];
}

/** Records what a save changed. $changes: [{kind, code?, countryId?, levelId?, category?, field?, old?, new?}]. */
function masterlist_db_record_changes(PDO $connection, string $versionId, array $changes): void
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
function masterlist_db_option_usage(string $type): array
{
    [$table, $idColumn] = database_list_option_table($type);
    $otherColumn = $type === 'countries' ? 'price_level_id' : 'country_id';
    $usage = [];
    $query = database_connection()->query(
        "SELECT t.name, (SELECT COUNT(DISTINCT o.{$otherColumn}) FROM dbo.PLA_PriceOverrides o WHERE o.{$idColumn} = t.{$idColumn})
                      + (SELECT COUNT(*) FROM dbo.PLA_PriceRules r WHERE r.{$idColumn} = t.{$idColumn}) AS n
         FROM {$table} t"
    );
    foreach ($query->fetchAll() as $r) if ((int) $r['n'] > 0) $usage[mb_strtolower((string) $r['name'])] = (int) $r['n'];
    return $usage;
}
