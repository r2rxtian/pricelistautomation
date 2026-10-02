<?php
declare(strict_types=1);
/**
 * POST target for pages/login.php. Accepts login_id + login_password and returns JSON
 * {success, message, type, data}. Same flow as QRTS:
 *
 *   dbo.lrnph_users      company login for that biometrics number (must be active)
 *     → dbo.lrn_master_list   BiometricsID → EmployeeID, name, department
 *     → dbo.PLA_ACD_Users     EmployeeID → this app's account and role (the selected users)
 *
 * The password is the person's biometrics number, as held in the master list (BiometricsID). It is
 * looked up at sign-in, never stored here; most are the employee number without the year, but some
 * people have their own.
 *
 * Ordinary users need an active company login, an active master-list record and an active
 * PLA_ACD_Users row. Employees of the IT department (rules/constants.php) are provisioned
 * automatically on a successful company login and act as Admin. Failed attempts count towards a
 * lockout (LOGIN_MAX_ATTEMPTS / LOGIN_LOCKOUT_MINUTES).
 */

require_once __DIR__ . '/session.php';
require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/../authz/audit.php';

header('Content-Type: application/json');
startSession();

function jsonError(string $message, int $code = 400): never
{
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message, 'type' => 'error']);
    exit;
}

/** Failed attempts go to the audit log with the number that was tried (never the password). */
function auditFailedLogin(string $loginId, string $reason, array $extra = []): void
{
    try {
        record_audit('login_failed', 'Failed sign-in', "Biometrics number {$loginId}: " . str_replace('_', ' ', $reason) . '.',
            ['attemptedId' => $loginId, 'reason' => $reason] + $extra, ['name' => 'Unknown', 'username' => '', 'role' => 'system']);
    } catch (Throwable $error) {
        error_log('Sign-in audit: ' . $error->getMessage());
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonError('Method not allowed.', 405);
}

csrfVerify();

$loginId = trim((string) ($_POST['login_id'] ?? ''));
$password = (string) ($_POST['login_password'] ?? '');

if ($loginId === '' || $password === '') {
    jsonError('Please enter your biometrics number and password.');
}
if (mb_strlen($loginId) > 50) {
    jsonError('Invalid biometrics number or password.', 401);
}

try {
    $pdo = db();
    // Some biometrics numbers appear on more than one master-list row (old records): only active rows
    // count, and a row that has an account here wins.
    $stmt = $pdo->prepare('
        SELECT TOP 1 u.id, ml.EmployeeID AS employee_id, ml.Department AS department,
               ml.BiometricsID AS biometrics_id, lu.status AS lrnph_status,
               u.is_active, u.failed_login_attempts, u.locked_until, u.deleted_at
        FROM ' . T_LRNPH_USERS . ' lu
        JOIN ' . T_MASTER_LIST . " ml ON ml.BiometricsID = lu.username AND ml.IsActive = '1'
        LEFT JOIN " . T_USERS . ' u ON u.employee_id = ml.EmployeeID
        WHERE lu.username = ?
        ORDER BY CASE WHEN u.id IS NULL THEN 1 ELSE 0 END
    ');
    $stmt->execute([$loginId]);
    $user = $stmt->fetch();
} catch (PDOException $error) {
    error_log('Sign-in: ' . $error->getMessage());
    jsonError("Can't reach the company database right now. Please try again shortly.", 503);
}

$isDepartmentAdmin = $user && isItDepartmentAdmin($user['department'] ?? null);

// Generic failure message throughout (don't reveal whether the account exists).
if (
    !$user
    || $user['lrnph_status'] !== 'active'
    || (!$isDepartmentAdmin && (!$user['id'] || !$user['is_active'] || $user['deleted_at'] !== null))
) {
    auditFailedLogin($loginId, 'not_found_or_inactive');
    jsonError('Invalid biometrics number or password.', 401);
}

if ($user['id'] && $user['locked_until'] && strtotime((string) $user['locked_until']) > time()) {
    $minutesLeft = max(1, (int) ceil((strtotime((string) $user['locked_until']) - time()) / 60));
    auditFailedLogin($loginId, 'locked');
    jsonError("Too many failed attempts. Please try again in $minutesLeft minute(s).", 429);
}

// The password is the biometrics number from the master list.
if (!hash_equals(trim((string) $user['biometrics_id']), $password)) {
    $attempts = (int) $user['failed_login_attempts'] + 1;
    $lockUntil = null;
    if ($attempts >= LOGIN_MAX_ATTEMPTS) {
        $lockUntil = (new DateTime())->modify('+' . LOGIN_LOCKOUT_MINUTES . ' minutes')->format('Y-m-d H:i:s');
    }
    if ($user['id']) {
        $pdo->prepare('UPDATE ' . T_USERS . ' SET failed_login_attempts = ?, locked_until = ?, updated_at = SYSDATETIME() WHERE id = ?')
            ->execute([$attempts, $lockUntil, $user['id']]);
    }
    auditFailedLogin($loginId, 'bad_password', ['attempts' => $attempts]);
    jsonError('Invalid biometrics number or password.', 401);
}

// Success
if ($isDepartmentAdmin) {
    $userRoleId = $pdo->prepare('SELECT id FROM ' . T_ROLES . ' WHERE name = ?');
    $userRoleId->execute([ROLE_USER]);
    $userRoleId = $userRoleId->fetchColumn();
    if (!$userRoleId) {
        jsonError('The application roles are not set up. Run sql/schema.sql and sql/seed.sql.', 500);
    }
    // IT rows are stored with the User role (so they never become approvers) and act as Admin through
    // the session. HOLDLOCK stops two simultaneous first sign-ins from creating duplicate rows.
    $provision = $pdo->prepare('
        MERGE ' . T_USERS . ' WITH (HOLDLOCK) AS target
        USING (SELECT CAST(? AS VARCHAR(20)) AS employee_id) AS source
            ON target.employee_id = source.employee_id
        WHEN MATCHED THEN
            UPDATE SET is_active = 1, deleted_at = NULL, failed_login_attempts = 0, locked_until = NULL,
                       last_login_at = SYSDATETIME(), updated_at = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (employee_id, username, role_id, is_active, failed_login_attempts, last_login_at)
            VALUES (source.employee_id, source.employee_id, ?, 1, 0, SYSDATETIME())
        OUTPUT INSERTED.id;
    ');
    $provision->execute([$user['employee_id'], $userRoleId]);
    $user['id'] = (int) $provision->fetchColumn();
} else {
    $pdo->prepare('UPDATE ' . T_USERS . ' SET failed_login_attempts = 0, locked_until = NULL, last_login_at = SYSDATETIME(), updated_at = SYSDATETIME() WHERE id = ?')
        ->execute([$user['id']]);
}

session_regenerate_id(true);
$_SESSION['user_id'] = (int) $user['id'];
$_SESSION['department_admin'] = $isDepartmentAdmin;
$_SESSION['csrf_token'] = bin2hex(random_bytes(32)); // rotate on login
$_SESSION['signed_in_at'] = time();

$current = currentUser();
if (!$current) {
    jsonError('Your account could not be loaded. Please contact the system administrator.', 500);
}

record_audit('login', "{$current['name']} signed in", $isDepartmentAdmin ? 'Signed in as an IT department administrator.' : '', ['departmentAdmin' => $isDepartmentAdmin], $current);

echo json_encode([
    'success' => true,
    'message' => 'Welcome back, ' . $current['name'] . '!',
    'type' => 'success',
    'data' => ['redirect' => 'prices.php'],
]);
