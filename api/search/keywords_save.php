<?php
declare(strict_types=1);
/**
 * Saves the search keywords for a product group (category + group) or a single product code.
 * Sending no keywords removes them. Keywords only affect searching, never prices or exports.
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();
requirePermission($user, 'manageImages', 'You do not have permission to manage search keywords.');

$data = request_json();
$scope = ($data['scope'] ?? '') === 'product' ? 'product' : 'group';
$category = clean_text($data['category'] ?? '', 120);
$group = clean_text($data['group'] ?? '', 200);
$code = clean_text($data['code'] ?? '', 80);
if ($scope === 'group' && ($category === '' || $group === '')) json_response(['ok' => false, 'message' => 'Choose a product group.'], 422);
if ($scope === 'product' && $code === '') json_response(['ok' => false, 'message' => 'Choose a product code.'], 422);

// "ct, Crs ,viennoiserie" → ["ct", "crs", "viennoiserie"]: lowercase, letters/numbers/spaces/dashes.
$keywords = [];
foreach (preg_split('/[,\n;]+/', (string) ($data['keywords'] ?? '')) as $keyword) {
    $keyword = trim(preg_replace('/\s+/', ' ', preg_replace('/[^\p{L}\p{N} \-]/u', '', mb_strtolower((string) $keyword))));
    if ($keyword === '') continue;
    if (mb_strlen($keyword) > 40) json_response(['ok' => false, 'message' => "Keep each keyword under 40 characters (\"{$keyword}\")."], 422);
    $keywords[$keyword] = true;
}
$keywords = array_keys($keywords);
if (count($keywords) > 20) json_response(['ok' => false, 'message' => 'Use at most 20 keywords for one item.'], 422);

$key = $scope === 'product' ? 'product|' . mb_strtolower($code) : 'group|' . mb_strtolower($category) . '|' . mb_strtolower($group);
$entry = [
    'id' => substr(hash('sha256', $key), 0, 32),
    'scope' => $scope,
    'category' => $scope === 'group' ? $category : '',
    'group' => $scope === 'group' ? $group : '',
    'code' => $scope === 'product' ? $code : '',
    'keywords' => $keywords,
    'updatedBy' => $user['name'],
    'updatedAt' => gmdate('c'),
];
$saved = repo_save_search_keywords($entry);
$target = $scope === 'product' ? $code : "{$group} ({$category})";
record_audit('search_keywords', $keywords ? "Search keywords for {$target}" : "Removed search keywords for {$target}",
    $keywords ? "{$user['name']} set: " . implode(', ', $keywords) . '.' : "{$user['name']} removed the search keywords.", ['target' => $target, 'keywords' => $keywords]);
json_response(['ok' => true, 'entry' => $saved, 'id' => $entry['id'], 'message' => $keywords ? 'Search keywords saved.' : 'Search keywords removed.']);
