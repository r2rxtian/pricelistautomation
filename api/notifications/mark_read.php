<?php
declare(strict_types=1);
/** Marks some (ids) or all of the user's notifications as read. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();

$ids = request_json()['ids'] ?? null;
repo_mark_notifications_read($user['username'], is_array($ids) ? array_map('strval', $ids) : null);
json_response(['ok' => true] + notifications_payload($user));
