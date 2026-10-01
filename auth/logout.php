<?php
declare(strict_types=1);
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/../authz/audit.php';

startSession();

try {
    $user = currentUser();
    if ($user) record_audit('logout', "{$user['name']} signed out", '', [], $user);
} catch (Throwable $error) {
    // Signing out must always work, even if the database is unreachable.
    error_log('Sign-out audit: ' . $error->getMessage());
}

$_SESSION = [];
session_unset();
session_destroy();

header('Location: ../pages/login.php');
exit;
