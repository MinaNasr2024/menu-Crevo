<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class SiteSettingsController extends Controller
{
    private function defaultSettings(): array
    {
        return [
            'logoUrl' => '',
            'faviconUrl' => '',
            'restaurantName' => '',
            'restaurantNameAr' => '',
            'restaurantNameEn' => '',
            'phone' => '',
            'theme' => 'light',
            'buttonColor' => '#d7a439',
            'headingColor' => '#10172a',
            'headingFont' => 'Tajawal',
            'bodyFont' => 'Tajawal',
            'heroSlides' => [],
            'offerGroup' => [
                'titleAr' => '',
                'titleEn' => '',
                'productIds' => [],
                'price' => '',
                'isActive' => false,
            ],
            'vipCampaigns' => [],
            'vipCampaign' => [
                'isActive' => false,
                'targetMode' => 'visits',
                'targetTrigger' => 10,
                'targetAmount' => 0,
                'rewardType' => 'product',
                'productRewardId' => '',
                'productRewardTitleAr' => '',
                'productRewardTitleEn' => '',
                'financialDiscountType' => 'percent',
                'percentage' => 10,
                'fixedAmount' => 50,
                'popupTitleAr' => 'شكراً لزيارتك المتكررة!',
                'popupTitleEn' => 'Thank you for returning!',
                'popupBodyAr' => 'في مرتك القادمة ستحصل على هدية خاصة للعملاء المميزين.',
                'popupBodyEn' => 'On your next visit, you will receive a special VIP reward.',
            ],
            'socialLinks' => [
                'facebook' => '',
                'instagram' => '',
                'snapchat' => '',
                'tiktok' => '',
                'youtube' => '',
            ],
        ];
    }

    private function normalize(array $value): array
    {
        $data = $value['value'] ?? $value;
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($data)) {
            $data = [];
        }
        $defaults = $this->defaultSettings();
        $social = is_array($data['socialLinks'] ?? null) ? $data['socialLinks'] : [];
        $vipCampaign = is_array($data['vipCampaign'] ?? null) ? $data['vipCampaign'] : [];

        return array_replace_recursive($defaults, [
            'logoUrl' => (string) ($data['logoUrl'] ?? ''),
            'faviconUrl' => (string) ($data['faviconUrl'] ?? ''),
            'restaurantName' => (string) ($data['restaurantName'] ?? ''),
            'restaurantNameAr' => (string) ($data['restaurantNameAr'] ?? ''),
            'restaurantNameEn' => (string) ($data['restaurantNameEn'] ?? ''),
            'phone' => (string) ($data['phone'] ?? ''),
            'theme' => ($data['theme'] ?? 'light') === 'dark' ? 'dark' : 'light',
            'buttonColor' => (string) ($data['buttonColor'] ?? $defaults['buttonColor']),
            'headingColor' => (string) ($data['headingColor'] ?? $defaults['headingColor']),
            'headingFont' => (string) ($data['headingFont'] ?? $defaults['headingFont']),
            'bodyFont' => (string) ($data['bodyFont'] ?? $defaults['bodyFont']),
            'heroSlides' => array_values(array_filter(is_array($data['heroSlides'] ?? null) ? $data['heroSlides'] : [])),
            'offerGroup' => [
                'titleAr' => (string) ($data['offerGroup']['titleAr'] ?? ''),
                'titleEn' => (string) ($data['offerGroup']['titleEn'] ?? ''),
                'productIds' => array_values(array_filter(array_map('strval', is_array($data['offerGroup']['productIds'] ?? null) ? $data['offerGroup']['productIds'] : []))),
                'price' => (string) ($data['offerGroup']['price'] ?? ''),
                'isActive' => (bool) ($data['offerGroup']['isActive'] ?? false),
            ],
            'vipCampaigns' => array_values(is_array($data['vipCampaigns'] ?? null) ? $data['vipCampaigns'] : []),
            'vipCampaign' => [
                'isActive' => (bool) ($vipCampaign['isActive'] ?? false),
                'targetMode' => 'visits',
                'targetTrigger' => is_numeric($vipCampaign['targetTrigger'] ?? null) ? (int) $vipCampaign['targetTrigger'] : 10,
                'targetAmount' => 0,
                'rewardType' => ($vipCampaign['rewardType'] ?? 'product') === 'financial' ? 'financial' : 'product',
                'productRewardId' => (string) ($vipCampaign['productRewardId'] ?? ''),
                'productRewardTitleAr' => (string) ($vipCampaign['productRewardTitleAr'] ?? ''),
                'productRewardTitleEn' => (string) ($vipCampaign['productRewardTitleEn'] ?? ''),
                'financialDiscountType' => ($vipCampaign['financialDiscountType'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
                'percentage' => is_numeric($vipCampaign['percentage'] ?? null) ? (float) $vipCampaign['percentage'] : 10,
                'fixedAmount' => is_numeric($vipCampaign['fixedAmount'] ?? null) ? (float) $vipCampaign['fixedAmount'] : 50,
                'popupTitleAr' => (string) ($vipCampaign['popupTitleAr'] ?? $defaults['vipCampaign']['popupTitleAr']),
                'popupTitleEn' => (string) ($vipCampaign['popupTitleEn'] ?? $defaults['vipCampaign']['popupTitleEn']),
                'popupBodyAr' => (string) ($vipCampaign['popupBodyAr'] ?? $defaults['vipCampaign']['popupBodyAr']),
                'popupBodyEn' => (string) ($vipCampaign['popupBodyEn'] ?? $defaults['vipCampaign']['popupBodyEn']),
            ],
            'socialLinks' => [
                'facebook' => (string) ($social['facebook'] ?? ''),
                'instagram' => (string) ($social['instagram'] ?? ''),
                'snapchat' => (string) ($social['snapchat'] ?? ''),
                'tiktok' => (string) ($social['tiktok'] ?? ''),
                'youtube' => (string) ($social['youtube'] ?? ''),
            ],
        ]);
    }

    public function show()
    {
        try {
            if (!Schema::hasTable('site_settings')) {
                return response()->json(['success' => true, 'data' => $this->defaultSettings()]);
            }

            $record = DB::table('site_settings')->where('key', 'global')->first();
            if (!$record) {
                DB::table('site_settings')->insert([
                    'key' => 'global',
                    'value' => json_encode($this->defaultSettings(), JSON_UNESCAPED_UNICODE),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $record = DB::table('site_settings')->where('key', 'global')->first();
            }

            return response()->json(['success' => true, 'data' => $this->normalize((array) $record)]);
        } catch (Throwable) {
            return response()->json(['success' => true, 'data' => $this->defaultSettings()]);
        }
    }

    public function update(Request $request)
    {
        try {
            if (!Schema::hasTable('site_settings')) {
                return response()->json(['success' => true, 'data' => $this->defaultSettings()]);
            }

            $record = DB::table('site_settings')->where('key', 'global')->first();
            $current = $record ? $this->normalize((array) $record) : $this->defaultSettings();
            $incoming = $request->all();
            $merged = array_replace_recursive($current, is_array($incoming) ? $incoming : []);

            DB::table('site_settings')->updateOrInsert(
                ['key' => 'global'],
                [
                    'value' => json_encode($this->normalize($merged), JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                    'created_at' => $record?->created_at ?? now(),
                ]
            );

            return response()->json(['success' => true, 'data' => $this->normalize($merged)]);
        } catch (Throwable) {
            return response()->json(['success' => true, 'data' => $this->defaultSettings()]);
        }
    }
}
