<?php
declare(strict_types=1);
/**
 * Input clean-up and the canonical forms of countries and price levels.
 */

require_once __DIR__ . '/constants.php';

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

/** Maps "1", "level 1", "PL1" or "Price Level 1" to "Price Level 1"; null when it isn't a configured level. */
function canonical_price_level(string $input): ?string
{
    if (!preg_match('/^\s*(?:price\s*level|level|pl|lvl)?\s*#?\s*(\d{1,3})\s*$/i', $input, $match)) return null;
    $level = 'Price Level ' . (int) $match[1];
    return in_array($level, PRICE_LEVELS, true) ? $level : null;
}

/** Maps a country (any case/spacing) to its entry in the configured list, or null when it isn't listed. */
function canonical_country(string $input): ?string
{
    $key = mb_strtolower(preg_replace('/\s+/u', ' ', trim($input)));
    if ($key === '') return null;
    foreach (COUNTRIES as $country) {
        if (mb_strtolower($country) === $key) return $country;
    }
    return COUNTRIES ? null : trim($input);
}
