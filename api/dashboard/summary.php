<?php
declare(strict_types=1);
/** The Dashboard: price levels, the price ladder and the last 30 days of activity (rules/dashboard.php). */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/dashboard.php';

$user = apiUser();
json_response(['ok' => true, 'dashboard' => dashboard_payload($user)]);
