<?php
declare(strict_types=1);
/**
 * Input clean-up and the canonical forms of countries and price levels.
 */

require_once __DIR__ . '/constants.php';
require_once __DIR__ . '/options.php';

function clean_text(mixed $value, int $max = 180): string
{
    if (is_array($value) || is_object($value)) return '';
    $value = trim((string) $value);
    return mb_substr($value, 0, $max);
}

function clean_number(mixed $value, float $min, float $max): ?float
{
    $number = filter_var($value, FILTER_VALIDATE_FLOAT);
    if ($number === false || $number < $min || $number > $max) return null;
    return (float) $number;
}

/**
 * A price level from the configured list (rules/options.php): its exact name in any case, or the
 * shorthand "1", "level 1", "PL1" for "Price Level 1". Null when it isn't listed.
 */
function canonical_price_level(string $input): ?string
{
    $found = find_option('priceLevels', $input);
    if ($found) return $found['name'];
    if (!preg_match('/^\s*(?:price\s*level|level|pl|lvl)?\s*#?\s*(\d{1,3})\s*$/i', $input, $match)) return null;
    return find_option('priceLevels', 'Price Level ' . (int) $match[1])['name'] ?? null;
}

/** Maps a country (any case/spacing) to its entry in the configured list, or null when it isn't listed. */
function canonical_country(string $input): ?string
{
    return find_option('countries', $input)['name'] ?? null;
}
