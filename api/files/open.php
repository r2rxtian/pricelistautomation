<?php
declare(strict_types=1);
/** Opens one price list (with its rows) in the editor. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();

$version = find_open_version($user, clean_text(request_json()['id'] ?? '', 32));
json_response(['ok' => true, 'active' => version_for_client($user, $version)]);
