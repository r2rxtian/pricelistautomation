<?php
declare(strict_types=1);
/** Read-only: who a biometrics number belongs to (master list) and whether they already have access. */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../rules/user_management.php';

$user = apiUser();
requirePermission($user, 'manageUsers', 'Only admins can manage users.');
$biometricsId = clean_text($_GET['biometrics_id'] ?? '', 20);
if ($biometricsId === '' || !preg_match('/^[A-Za-z0-9-]+$/', $biometricsId)) json_response(['ok' => false, 'message' => 'Enter a biometrics number.'], 422);
$person = lookup_person($biometricsId);
if (!$person) json_response(['ok' => false, 'message' => "No employee found with biometrics number {$biometricsId}."], 404);
json_response(['ok' => true, 'person' => $person + ['biometricsId' => $biometricsId]]);
