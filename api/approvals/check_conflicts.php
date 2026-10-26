<?php
declare(strict_types=1);
/**
 * For a price change waiting for approval: the prices it changes that someone else changed after it was
 * saved (see pricing_batch_conflicts() in rules/pricing.php). The review window shows them so the
 * approver knows approving would replace them. Body: {id}.
 */
require_once __DIR__ . '/../bootstrap.php';

$user = apiUser();
requirePost();
csrfVerify();

$version = find_open_version($user, clean_text(request_json()['id'] ?? '', 32));
$waiting = ($version['kind'] ?? '') === 'batch' && ($version['status'] ?? '') === 'pending' && is_array($version['masterlistBatch'] ?? null);
json_response(['ok' => true, 'conflicts' => $waiting && pricing_enabled() ? pricing_batch_conflicts($version['masterlistBatch']) : []]);
