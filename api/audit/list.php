<?php
declare(strict_types=1);
/** The latest audit log entries. */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePermission($user, 'viewAudit', 'Your role cannot view audit logs.');

json_response(['ok' => true, 'auditLogs' => repo_list_audit(1000)]);
