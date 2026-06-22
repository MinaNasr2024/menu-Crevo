<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Support\AdminToken;
use App\Support\LegacyPassword;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $adminUsername = (string) env('ADMIN_USERNAME', 'admin');
        $adminPassword = (string) env('ADMIN_PASSWORD', 'admin123');

        if ($data['username'] === $adminUsername && $data['password'] === $adminPassword) {
            return response()->json([
                'success' => true,
                'data' => [
                    'token' => AdminToken::issue([
                        'role' => 'admin',
                        'type' => 'admin',
                        'username' => $adminUsername,
                    ]),
                    'user' => [
                        'username' => $data['username'],
                        'role' => 'admin',
                        'type' => 'admin',
                    ],
                ],
            ]);
        }

        $employee = Employee::query()
            ->where('is_active', true)
            ->where(function ($query) use ($data) {
                $query->where('phone', $data['username'])
                    ->orWhere('email', $data['username'])
                    ->orWhere('full_name', $data['username']);
            })
            ->first();

        if (!$employee || !LegacyPassword::verify($data['password'], $employee->password_hash)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'message' => 'Invalid credentials',
                ],
            ], 401);
        }

        $role = AdminToken::normalizeRole($employee->role);

        return response()->json([
            'success' => true,
            'data' => [
                'token' => AdminToken::issue([
                    'role' => $role,
                    'type' => 'employee',
                    'employeeId' => $employee->id,
                    'username' => $employee->phone ?? $employee->email ?? $employee->full_name,
                ]),
                'user' => [
                    'username' => $employee->phone ?? $employee->email ?? $employee->full_name,
                    'role' => $role,
                    'type' => 'employee',
                    'employeeId' => $employee->id,
                ],
            ],
        ]);
    }
}
