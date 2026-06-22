<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    private function extensionFromMime(string $mime): string
    {
        if (str_contains($mime, 'png')) return 'png';
        if (str_contains($mime, 'jpeg') || str_contains($mime, 'jpg')) return 'jpg';
        if (str_contains($mime, 'webp')) return 'webp';
        if (str_contains($mime, 'mp4')) return 'mp4';
        if (str_contains($mime, 'quicktime')) return 'mov';
        return 'bin';
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'fileData' => ['required', 'string'],
            'fileName' => ['nullable', 'string'],
        ]);

        if (!preg_match('/^data:(.+?);base64,(.+)$/', $data['fileData'], $matches)) {
            return response()->json([
                'success' => false,
                'error' => ['message' => 'Invalid upload data']
            ], 422);
        }

        $mimeType = $matches[1];
        $base64 = $matches[2];
        $buffer = base64_decode($base64, true);
        if ($buffer === false) {
            return response()->json([
                'success' => false,
                'error' => ['message' => 'Invalid upload data']
            ], 422);
        }
        if (strlen($buffer) > 1024 * 1024) {
            return response()->json([
                'success' => false,
                'error' => ['message' => 'Upload must be 1MB or smaller']
            ], 422);
        }

        $extension = $this->extensionFromMime($mimeType);
        $directory = base_path('uploads');
        if (!File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }

        $fileName = Str::uuid()->toString().'.'.$extension;
        File::put($directory.DIRECTORY_SEPARATOR.$fileName, $buffer);

        return response()->json([
            'success' => true,
            'data' => [
                'fileName' => $fileName,
                'url' => '/uploads/'.$fileName,
                'mimeType' => $mimeType,
            ],
        ]);
    }
}
