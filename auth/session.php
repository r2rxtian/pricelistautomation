<?php
declare(strict_types=1);
/**
 * Session bootstrap + identity accessors. Every page/api file that needs the current user includes
 * this and calls requireLogin()/currentUser().
 */

require_once __DIR__ . '/../rules/users.php';

function startSession(): void
{
    if (session_status() !== PHP_SESSION_NONE) return;
    $directory = APP_ROOT . '/storage/sessions';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the session directory.');
    }
    session_save_path($directory);
    // Own cookie name so this app never shares a session with the other apps on the same server.
    session_name('PriceListAutomation');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_start();
}

/**
 * The signed-in user, or null. The account is re-read on every request, so a deactivated or removed
 * user loses access immediately. Never trust identity sent by the browser; always use this.
 */
function currentUser(): ?array
{
    startSession();
    if (!isset($_SESSION['user_id'])) return null;
    $record = find_user_by_id((int) $_SESSION['user_id']);
    if (!$record) {
        $_SESSION = [];
        return null;
    }
    // IT-department administrators act as Admin (granted at sign-in, see login_handler.php).
    return public_user($record, !empty($_SESSION['department_admin']) ? ROLE_ADMIN : null);
}

function isLoggedIn(): bool
{
    return currentUser() !== null;
}

/**
 * For pages/*.php: redirects to login.php when signed out.
 * For api/**: pass $isApi = true to get a 401 JSON response instead.
 */
function requireLogin(bool $isApi = false): array
{
    $user = currentUser();
    if ($user !== null) return $user;

    if ($isApi) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['ok' => false, 'success' => false, 'message' => 'Please sign in again.', 'type' => 'error']);
        exit;
    }
    header('Location: login.php');
    exit;
}
