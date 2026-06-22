<?php

namespace App\Support;

use Illuminate\Support\Str;

class AdminToken
{
    public static function secret(): string
    {
        return (string) env('ADMIN_TOKEN', 'change-me-in-production');
    }

    public static function normalizeRole(?string $role): string
    {
        return $role === 'cashier' ? 'seller' : (string) $role;
    }

    public static function issue(array $payload = []): string
    {
        $normalized = array_merge($payload, [
            'role' => self::normalizeRole($payload['role'] ?? 'admin'),
            'issuedAt' => now()->toIso8601String(),
        ]);
        $body = rtrim(strtr(base64_encode(json_encode($normalized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)), '+/', '-_'), '=');
        $signature = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, self::secret(), true)), '+/', '-_'), '=');

        return $body.'.'.$signature;
    }

    public static function parse(?string $token): ?array
    {
        if (!$token) {
            return null;
        }

        $token = trim($token);
        if ($token === self::secret()) {
            return ['role' => 'admin', 'type' => 'admin', 'legacy' => true];
        }

        [$body, $signature] = array_pad(explode('.', $token, 2), 2, null);
        if (!$body || !$signature) {
            return null;
        }

        $expected = rtrim(strtr(base64_encode(hash_hmac('sha256', $body, self::secret(), true)), '+/', '-_'), '=');
        if (!hash_equals($expected, $signature)) {
            return null;
        }

        $base64 = strtr($body, '-_', '+/');
        $padding = strlen($base64) % 4;
        if ($padding > 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }
        $json = base64_decode($base64, true);
        if ($json === false) {
            return null;
        }

        try {
            $payload = json_decode($json, true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        if (!is_array($payload)) {
            return null;
        }

        $payload['role'] = self::normalizeRole($payload['role'] ?? 'admin');
        return $payload;
    }
}
