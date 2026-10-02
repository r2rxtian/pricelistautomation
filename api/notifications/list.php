<?php
declare(strict_types=1);
/** The signed-in user's notifications (polled by the app). */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();

json_response(['ok' => true] + notifications_payload($user));
