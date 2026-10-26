<?php
declare(strict_types=1);
/**
 * Who else is here. Each open tab calls this every 15 seconds (scripts/app.js › sendPresence) with
 *   {tab, listId, unsaved, after?, leaving?}
 * listId: the price list in view ('' when none), unsaved: how many of its products this person changed
 * without saving, after: the open list's changeMark (the newest change it has).
 * Answers {people: [{username, name, listId, unsaved}], changed: null | {count, people, at, last}}:
 * everyone else in the app and what they have open, and the changes applied to the open list since
 * `after` (someone else's change approved, or a new upload). Nothing is locked.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../conn/presence.php';

$user = apiUser();
requirePost();
csrfVerify();
if (!database_enabled()) json_response(['ok' => true, 'people' => [], 'changed' => null]);

$data = request_json();
$tab = preg_match('/^[a-z0-9]{8,32}$/i', (string) ($data['tab'] ?? '')) ? (string) $data['tab'] : '';
if ($tab === '') json_response(['ok' => false, 'message' => 'Missing tab id.'], 422);
if (!empty($data['leaving'])) {
    presence_leave($tab);
    json_response(['ok' => true]);
}

$listId = (string) ($data['listId'] ?? '');
$pair = pricing_parse_list_id($listId);
if (!$pair) $listId = '';
presence_touch($tab, $user, $listId, (int) ($data['unsaved'] ?? 0));

$changed = null;
if ($pair && is_numeric($data['after'] ?? null)) $changed = pricing_db_changes_since((int) $data['after'], $pair[0], $pair[1]);
json_response(['ok' => true, 'people' => presence_others($user['username']), 'changed' => $changed]);
