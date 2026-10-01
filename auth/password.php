<?php
declare(strict_types=1);

function verifyPassword(string $plain, string $hash): bool
{
    return password_verify($plain, $hash);
}
