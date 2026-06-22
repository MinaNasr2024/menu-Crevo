<?php

namespace App\Support;

use RuntimeException;

class LegacyPassword
{
    public static function verify(string $password, ?string $storedHash): bool
    {
        if (!$storedHash || !str_starts_with($storedHash, 'pbkdf2$')) {
            return false;
        }

        $parts = explode('$', $storedHash);
        if (count($parts) !== 4) {
            return false;
        }

        [, $iterations, $salt, $hash] = $parts;
        $derived = hash_pbkdf2('sha512', $password, $salt, (int) $iterations, 64, true);
        $buffer = hex2bin($hash);

        if ($buffer === false || strlen($buffer) !== strlen($derived)) {
            return false;
        }

        return hash_equals($buffer, $derived);
    }
}
