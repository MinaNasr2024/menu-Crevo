<?php

namespace App\Http\Middleware;

use App\Support\AdminToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminTokenMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->header('x-admin-token');
        $auth = AdminToken::parse($token);

        if (!$auth) {
            return response()->json([
                'success' => false,
                'error' => [
                    'message' => 'Admin authentication required',
                ],
            ], 401);
        }

        $request->attributes->set('auth', $auth);

        return $next($request);
    }
}
