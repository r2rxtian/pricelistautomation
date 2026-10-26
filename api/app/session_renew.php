<?php
declare(strict_types=1);
/**
 * Keeps an open app signed in and renews its session: called by the page every SESSION_RENEW_MINUTES
 * (rules/constants.php). The session gets a new id (the old one stops working), so a copied session
 * cookie is only good until the next renewal. Signed out (or the account switched off): 401, and the
 * page goes back to the sign-in page.
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser(true); // it renews the session, so the session stays open
requirePost();
csrfVerify();

// Renew at most once per period, however often it is asked (several tabs share one session).
$due = time() - (int) ($_SESSION['renewed_at'] ?? 0) >= SESSION_RENEW_MINUTES * 60 - 30;
if ($due) {
    session_regenerate_id(true);
    $_SESSION['renewed_at'] = time();
}
json_response(['ok' => true, 'renewed' => $due, 'renewedAt' => gmdate('c', (int) $_SESSION['renewed_at']), 'nextInSeconds' => SESSION_RENEW_MINUTES * 60]);
