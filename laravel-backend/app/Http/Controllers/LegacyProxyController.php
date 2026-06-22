<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Response;

class LegacyProxyController extends Controller
{
    private function legacyBaseUrl(): string
    {
        return rtrim(env('LEGACY_BACKEND_URL', 'http://127.0.0.1:4006'), '/');
    }

    private function forwardHeaders(Request $request): array
    {
        $headers = [];

        foreach ($request->headers->all() as $name => $values) {
            $key = strtolower((string) $name);
            if (in_array($key, ['host', 'content-length', 'connection'], true)) {
                continue;
            }
            $headers[$name] = is_array($values) ? implode(',', $values) : $values;
        }

        return $headers;
    }

    private function proxyRequest(Request $request, string $targetPath, bool $preserveApiPrefix = true)
    {
        $baseUrl = $this->legacyBaseUrl();
        $path = ltrim($targetPath, '/');
        $url = $preserveApiPrefix
            ? "{$baseUrl}/api/{$path}"
            : "{$baseUrl}/{$path}";

        $query = $request->query();
        $headers = $this->forwardHeaders($request);

        $client = Http::withHeaders($headers)->withOptions([
            'http_errors' => false,
            'allow_redirects' => false,
        ]);

        $method = strtoupper($request->method());
        $response = null;

        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            $response = $client->send($method, $url, ['query' => $query]);
        } else {
            $contentType = (string) $request->header('Content-Type', 'application/json');
            $body = $request->getContent();
            $options = ['query' => $query];
            if ($body !== '') {
                $options['body'] = $body;
                $options['headers']['Content-Type'] = $contentType;
            }
            $response = $client->send($method, $url, $options);
        }

        $proxied = Response::make($response->body(), $response->status());
        foreach ($response->headers() as $name => $values) {
            if (in_array(strtolower($name), ['transfer-encoding', 'content-encoding', 'connection'], true)) {
                continue;
            }
            $proxied->header($name, implode(',', $values));
        }

        return $proxied;
    }

    public function api(Request $request, string $path = '')
    {
        return $this->proxyRequest($request, $path, true);
    }

    public function qr(Request $request, string $uuid)
    {
        return $this->proxyRequest($request, "qr/{$uuid}", false);
    }

    public function uploads(Request $request, string $path = '')
    {
        return $this->proxyRequest($request, "uploads/{$path}", false);
    }
}
