<?php
declare(strict_types=1);
// Isolated localhost-only integration fixture. Never uses company sessions or repositories.
$testToken = getenv('PLA_WORKBOOK_TEST_TOKEN');
if (PHP_SAPI !== 'cli-server' || !$testToken || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1'
    || !hash_equals($testToken, $_SERVER['HTTP_X_WORKBOOK_TEST'] ?? '')) { http_response_code(404); exit; }
if (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) === '/health') { echo 'ok'; exit; }
require_once __DIR__ . '/../rules/workbook_import.php';
require_once __DIR__ . '/../authz/capabilities.php';
const PRICE_LEVELS = ['Price Level 1', 'Price Level 4'];
$effects = ['saved' => 0, 'superseded' => 0, 'audit' => 0, 'notifications' => 0];
function json_response(array $payload, int $status = 200): never {
    http_response_code($status); header('Content-Type: application/json');
    echo json_encode($payload + ['_testEffects' => $GLOBALS['effects']], JSON_THROW_ON_ERROR); exit;
}
function apiUser(): array { return ['username' => 'fixture', 'name' => 'Fixture Admin', 'roleName' => $_SERVER['HTTP_X_TEST_ROLE'] ?? 'Admin']; }
function requirePost(): void { if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_response(['ok'=>false,'message'=>'Method not allowed.'], 405); }
function csrfVerify(): void { if (($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '') !== 'fixture-csrf') json_response(['ok'=>false,'message'=>'Invalid CSRF.'], 403); }
function requirePermission(array $user, string $permission, string $message): void { if (!user_can($user, $permission)) json_response(['ok'=>false,'message'=>$message], 403); }
function request_json(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
function clean_text(mixed $value, int $max = 180): string { return is_scalar($value) ? mb_substr(trim((string)$value), 0, $max) : ''; }
function clean_number(mixed $value, float $min, float $max): ?float { return is_numeric($value) && (float)$value >= $min && (float)$value <= $max ? (float)$value : null; }
function canonical_country(string $value): ?string { return in_array($value, ['Switzerland', 'Philippines'], true) ? $value : null; }
function canonical_price_level(string $value): ?string { return in_array($value, PRICE_LEVELS, true) ? $value : null; }
function repo_list_version_summaries(): array {
    return [
        ['id'=>'uploaded-base','revision'=>1,'name'=>'Test price list','country'=>'Switzerland','priceLevel'=>'Price Level 4','status'=>'uploaded'],
        ['id'=>'legacy-base','revision'=>1,'name'=>'Legacy list','country'=>'Switzerland','priceLevel'=>'Price Level 4','status'=>'uploaded']
    ];
}
function find_open_version(array $user, string $id): array {
    foreach (repo_list_version_summaries() as $version) {
        if ($version['id'] === $id) return $version + ['templateVersion'=>$id === 'legacy-base' ? null : 'PLA-1'];
    }
    json_response(['ok'=>false,'message'=>'Price list not found.'], 404);
}
function same_price_list(array $left, array $right): bool { return $left['name'] === $right['name'] && $left['country'] === $right['country'] && $left['priceLevel'] === $right['priceLevel']; }
function repo_save_version(array $version): void { $GLOBALS['effects']['saved']++; }
function supersede_older_approved(array $version): void { $GLOBALS['effects']['superseded']++; }
function record_audit(...$args): void { $GLOBALS['effects']['audit']++; }
function notify(...$args): void { $GLOBALS['effects']['notifications']++; }
function usernames_with_permission(string $permission): array { return ['fixture-exporter']; }
function version_label(array $version): string { return $version['name']; }
function version_for_client(array $user, array $version): array { return $version; }
function approvers_for(string $username): array { return ['fixture-reviewer']; }
function is_auto_approver(string $username): bool { return false; }
function user_display_name(string $username): string { return $username; }
set_exception_handler(function(Throwable $error): void { json_response(['ok'=>false,'message'=>$error->getMessage()], 500); });
$code = file_get_contents(__DIR__ . '/../api/versions/save.php');
$code = preg_replace('~^<\?php\s*declare\(strict_types=1\);~', '', $code);
$code = preg_replace('~^require_once __DIR__ .*;$~m', '', $code);
eval($code);
