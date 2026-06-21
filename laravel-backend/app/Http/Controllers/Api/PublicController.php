<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Offer;
use App\Models\OfferGroup;
use App\Models\OfferGroupProduct;
use App\Models\Order;
use App\Models\Product;
use App\Models\SiteSetting;
use App\Models\Table;
use App\Models\VipCustomerVisit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class PublicController extends Controller
{
    private function jsonOk(mixed $data = null): Response
    {
        return response()->json(['success' => true, 'data' => $data]);
    }

    private function jsonError(int $status, string $message, array $details = []): Response
    {
        $payload = [
            'success' => false,
            'error' => ['message' => $message],
        ];
        if (!empty($details)) {
            $payload['error']['details'] = $details;
        }
        return response()->json($payload, $status);
    }

    private function clientOrigin(): string
    {
        return rtrim((string) env('FRONTEND_URL', env('APP_URL', 'http://localhost')), '/');
    }

    private function decodeJsonArray(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        return [];
    }

    private function rowValue(array|object $row, string $key, mixed $default = null): mixed
    {
        if (is_array($row)) {
            return $row[$key] ?? $default;
        }

        return isset($row->$key) ? $row->$key : $default;
    }

    private function normalizePhone(string $phone): string
    {
        $phone = trim($phone);
        $phone = str_replace(['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'], ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], $phone);
        return preg_replace('/\D+/', '', $phone) ?? '';
    }

    private function currentPrice(array $product): float
    {
        $discountPrice = $product['discount_price'] ?? $product['discountPrice'] ?? null;
        if (!empty($product['is_discounted'] ?? $product['isDiscounted'] ?? false) && $discountPrice !== null && $discountPrice !== '') {
            return (float) $discountPrice;
        }
        return (float) ($product['price'] ?? 0);
    }

    private function serializeProduct(array $product, string $lang = 'en'): array
    {
        return [
            'id' => (int) $this->rowValue($product, 'id', 0),
            'categoryId' => (int) $this->rowValue($product, 'categoryId', $this->rowValue($product, 'category_id', 0)),
            'name' => $lang === 'ar'
                ? (string) $this->rowValue($product, 'nameAr', $this->rowValue($product, 'name_ar', ''))
                : (string) $this->rowValue($product, 'nameEn', $this->rowValue($product, 'name_en', '')),
            'nameAr' => (string) $this->rowValue($product, 'nameAr', $this->rowValue($product, 'name_ar', '')),
            'nameEn' => (string) $this->rowValue($product, 'nameEn', $this->rowValue($product, 'name_en', '')),
            'description' => $lang === 'ar'
                ? (string) $this->rowValue($product, 'descriptionAr', $this->rowValue($product, 'description_ar', ''))
                : (string) $this->rowValue($product, 'descriptionEn', $this->rowValue($product, 'description_en', '')),
            'descriptionAr' => (string) $this->rowValue($product, 'descriptionAr', $this->rowValue($product, 'description_ar', '')),
            'descriptionEn' => (string) $this->rowValue($product, 'descriptionEn', $this->rowValue($product, 'description_en', '')),
            'mediaType' => (string) $this->rowValue($product, 'mediaType', $this->rowValue($product, 'media_type', 'image')),
            'coverMediaUrl' => (string) $this->rowValue($product, 'coverMediaUrl', $this->rowValue($product, 'cover_media_url', '')),
            'galleryUrls' => $this->decodeJsonArray($this->rowValue($product, 'galleryUrls', $this->rowValue($product, 'gallery_urls', []))),
            'ingredients' => $this->decodeJsonArray($product['ingredients'] ?? []),
            'tags' => $this->decodeJsonArray($product['tags'] ?? []),
            'allergens' => $this->decodeJsonArray($product['allergens'] ?? []),
            'sizeOptions' => $this->decodeJsonArray($this->rowValue($product, 'sizeOptions', $this->rowValue($product, 'size_options', []))),
            'sideDishOptions' => $this->decodeJsonArray($this->rowValue($product, 'sideDishOptions', $this->rowValue($product, 'side_dish_options', []))),
            'addonOptions' => $this->decodeJsonArray($this->rowValue($product, 'addonOptions', $this->rowValue($product, 'addon_options', []))),
            'customChoiceGroups' => $this->decodeJsonArray($this->rowValue($product, 'customChoiceGroups', $this->rowValue($product, 'custom_choice_groups', []))),
            'price' => (float) $this->rowValue($product, 'price', 0),
            'effectivePrice' => $this->currentPrice($product),
            'calories' => $this->rowValue($product, 'calories', null) !== null ? (int) $this->rowValue($product, 'calories') : null,
            'isDiscounted' => (bool) $this->rowValue($product, 'is_discounted', $this->rowValue($product, 'isDiscounted', false)),
            'discountPrice' => $this->rowValue($product, 'discount_price', $this->rowValue($product, 'discountPrice', null)) !== null ? (float) $this->rowValue($product, 'discount_price', $this->rowValue($product, 'discountPrice')) : null,
            'isAvailable' => (bool) $this->rowValue($product, 'is_available', $this->rowValue($product, 'isAvailable', true)),
            'isFeatured' => (bool) $this->rowValue($product, 'is_featured', $this->rowValue($product, 'isFeatured', false)),
            'sortOrder' => (int) $this->rowValue($product, 'sort_order', $this->rowValue($product, 'sortOrder', 0)),
            'averageWaitTime' => $this->rowValue($product, 'average_wait_time', $this->rowValue($product, 'averageWaitTime', null)) !== null ? (int) $this->rowValue($product, 'average_wait_time', $this->rowValue($product, 'averageWaitTime')) : null,
        ];
    }

    private function loadSiteSettings(): array
    {
        if (!Schema::hasTable('site_settings')) {
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
                    'popupTitleAr' => 'Ø´ÙƒØ±Ø§Ù‹ Ù„Ø²ÙŠØ§Ø±ØªÙƒ Ø§Ù„Ù…ØªÙƒØ±Ø±Ø©!',
                    'popupTitleEn' => 'Thank you for returning!',
                    'popupBodyAr' => 'ÙÙŠ Ù…Ø±ØªÙƒ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø© Ø³ØªØ­ØµÙ„ Ø¹Ù„Ù‰ Ù‡Ø¯ÙŠØ© Ø®Ø§ØµØ© Ù„Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ù…Ù…ÙŠØ²ÙŠÙ†.',
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

        $record = DB::table('site_settings')->where('key', 'global')->first();
        $value = $record?->value ?? [];
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }

        return is_array($value) ? $value : [
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

    private function loadVipCampaign(): array
    {
        $settings = $this->loadSiteSettings();
        $campaign = is_array($settings['vipCampaign'] ?? null) ? $settings['vipCampaign'] : [];
        return [
            'isActive' => (bool) ($campaign['isActive'] ?? false),
            'targetMode' => 'visits',
            'targetTrigger' => max(1, (int) ($campaign['targetTrigger'] ?? 10)),
            'targetAmount' => 0,
            'rewardType' => ($campaign['rewardType'] ?? 'product') === 'financial' ? 'financial' : 'product',
            'productRewardId' => (string) ($campaign['productRewardId'] ?? ''),
            'productRewardTitleAr' => (string) ($campaign['productRewardTitleAr'] ?? ''),
            'productRewardTitleEn' => (string) ($campaign['productRewardTitleEn'] ?? ''),
            'financialDiscountType' => ($campaign['financialDiscountType'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent',
            'percentage' => (float) ($campaign['percentage'] ?? 10),
            'fixedAmount' => (float) ($campaign['fixedAmount'] ?? 50),
            'popupTitleAr' => (string) ($campaign['popupTitleAr'] ?? 'شكراً لزيارتك المتكررة!'),
            'popupTitleEn' => (string) ($campaign['popupTitleEn'] ?? 'Thank you for returning!'),
            'popupBodyAr' => (string) ($campaign['popupBodyAr'] ?? 'في مرتك القادمة ستحصل على هدية خاصة للعملاء المميزين.'),
            'popupBodyEn' => (string) ($campaign['popupBodyEn'] ?? 'On your next visit, you will receive a special VIP reward.'),
        ];
    }

    private function loadVipSummary(?string $phone, float $subtotal = 0.0): ?array
    {
        $phone = trim((string) $phone);
        if ($phone === '') {
            return null;
        }

        $campaign = $this->loadVipCampaign();
        $visit = VipCustomerVisit::query()->where('phone', $phone)->first();
        if (!$visit) {
            return [
                'campaign' => $campaign,
                'progress' => [
                    'visitCount' => 0,
                    'amountTotal' => 0,
                    'targetMode' => $campaign['targetMode'],
                    'targetTrigger' => $campaign['targetTrigger'],
                    'targetAmount' => $campaign['targetAmount'],
                    'rewardStatus' => 'available',
                    'rewardVisitCount' => 0,
                    'rewardSessionUuid' => null,
                    'rewardAwardedAt' => null,
                    'rewardConsumedAt' => null,
                ],
                'reward' => null,
                'discountAmount' => 0,
                'label' => '',
            ];
        }

        $rewardProduct = null;
        if ($campaign['rewardType'] === 'product' && trim($campaign['productRewardId']) !== '') {
            $rewardProduct = Product::query()->find((int) $campaign['productRewardId']);
        }

        $eligible = false;
        if ($campaign['targetMode'] === 'amount') {
            $eligible = ((float) $visit->amount_total) >= ((float) $campaign['targetAmount']);
        } else {
            $eligible = ((int) $visit->visit_count) >= ((int) $campaign['targetTrigger']);
        }

        $discountAmount = 0.0;
        if ($campaign['rewardType'] === 'financial' && ($visit->reward_status === 'available' || $visit->reward_status === 'eligible_and_active')) {
            $discountAmount = $campaign['financialDiscountType'] === 'fixed'
                ? min((float) $campaign['fixedAmount'], $subtotal)
                : round($subtotal * ((float) $campaign['percentage']) / 100, 2);
        }

        return [
            'campaign' => $campaign,
            'progress' => [
                'visitCount' => (int) $visit->visit_count,
                'amountTotal' => (float) $visit->amount_total,
                'targetMode' => $campaign['targetMode'],
                'targetTrigger' => $campaign['targetTrigger'],
                'targetAmount' => $campaign['targetAmount'],
                'rewardStatus' => (string) $visit->reward_status,
                'rewardVisitCount' => (int) $visit->reward_visit_count,
                'rewardSessionUuid' => $visit->reward_session_uuid,
                'rewardAwardedAt' => $visit->reward_awarded_at,
                'rewardConsumedAt' => $visit->reward_consumed_at,
            ],
            'reward' => $rewardProduct ? [
                'id' => $rewardProduct->id,
                'nameAr' => $rewardProduct->name_ar,
                'nameEn' => $rewardProduct->name_en,
                'descriptionAr' => $rewardProduct->description_ar,
                'descriptionEn' => $rewardProduct->description_en,
                'coverMediaUrl' => $rewardProduct->cover_media_url,
                'mediaType' => $rewardProduct->media_type,
                'price' => (float) $rewardProduct->price,
                'discountPrice' => $rewardProduct->discount_price !== null ? (float) $rewardProduct->discount_price : null,
                'isDiscounted' => (bool) $rewardProduct->is_discounted,
            ] : null,
            'eligible' => $eligible,
            'discountAmount' => $discountAmount,
            'label' => $campaign['rewardType'] === 'financial' ? 'VIP discount' : 'VIP reward',
        ];
    }

    private function resolveTableByUuid(string $uuid): ?Table
    {
        return Table::query()->where('qr_code_uuid', $uuid)->first();
    }

    private function sessionIsValid(?Table $table, ?string $session): bool
    {
        if (!$session) {
            return true;
        }
        return $table?->session_uuid === $session;
    }

    private function currentSessionOrderCount(Table $table): int
    {
        if (!$table->opened_at) {
            return 0;
        }
        return (int) DB::table('orders')
            ->where('table_id', $table->id)
            ->where('created_at', '>=', $table->opened_at)
            ->count();
    }

    private function currentSessionSubtotal(Table $table): float
    {
        if (!$table->opened_at) {
            return 0.0;
        }
        return (float) DB::table('orders')
            ->where('table_id', $table->id)
            ->where('created_at', '>=', $table->opened_at)
            ->sum('total_amount');
    }

    private function latestCustomerNameByPhone(?string $phone): string
    {
        $phone = trim((string) $phone);
        if ($phone === '') {
            return '';
        }
        $row = DB::table('customer_reviews')
            ->select('customer_name')
            ->where('phone', $phone)
            ->orderByDesc('created_at')
            ->first();
        return (string) ($row->customer_name ?? '');
    }

    private function menuCategories(string $scope = 'menu'): array
    {
        return DB::table('categories')
            ->select('id', 'name_ar as nameAr', 'name_en as nameEn', 'sort_order as sortOrder', 'is_active as isActive', 'scope')
            ->where('scope', $scope)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function menuProducts(string $scope = 'menu'): array
    {
        return DB::table('products')
            ->select(
                'id',
                'category_id as categoryId',
                'name_ar as nameAr',
                'name_en as nameEn',
                'description_ar as descriptionAr',
                'description_en as descriptionEn',
                'media_type as mediaType',
                'cover_media_url as coverMediaUrl',
                'gallery_urls as galleryUrls',
                'ingredients',
                'tags',
                'allergens',
                'size_options as sizeOptions',
                'side_dish_options as sideDishOptions',
                'addon_options as addonOptions',
                'custom_choice_groups as customChoiceGroups',
                'price',
                'calories',
                'average_wait_time as averageWaitTime',
                'is_discounted as isDiscounted',
                'discount_price as discountPrice',
                'is_available as isAvailable',
                'is_featured as isFeatured',
                'sort_order as sortOrder'
            )
            ->where('scope', $scope)
            ->where('is_available', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function serializeOffer(array $offer, string $lang = 'en'): array
    {
        return [
            'id' => (int) $offer['id'],
            'nameAr' => $offer['name_ar'],
            'nameEn' => $offer['name_en'],
            'noteAr' => $offer['note_ar'] ?? '',
            'noteEn' => $offer['note_en'] ?? '',
            'totalPrice' => (float) $offer['total_price'],
            'imageUrl' => $offer['image_url'] ?? '',
            'isActive' => (bool) $offer['is_active'],
        ];
    }

    private function loadOffers(bool $activeOnly = false): array
    {
        $offers = Offer::query()
            ->when($activeOnly, fn ($query) => $query->where('is_active', true))
            ->orderByDesc('id')
            ->get()
            ->map(fn ($offer) => $offer->toArray())
            ->all();

        if (!$offers) {
            return [];
        }

        $groupRows = OfferGroup::query()
            ->whereIn('offer_id', array_column($offers, 'id'))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn ($group) => $group->toArray())
            ->all();

        $itemRows = [];
        if ($groupRows) {
            $itemRows = OfferGroupProduct::query()
                ->whereIn('group_id', array_column($groupRows, 'id'))
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->map(function ($row) {
                    $product = Product::query()->find($row->product_id);
                    return [
                        'id' => $row->id,
                        'groupId' => $row->group_id,
                        'productId' => $row->product_id,
                        'extraPrice' => (float) $row->extra_price,
                        'includeProductOptions' => (bool) $row->include_product_options,
                        'sortOrder' => (int) $row->sort_order,
                        'nameAr' => $product?->name_ar ?? '',
                        'nameEn' => $product?->name_en ?? '',
                        'productPrice' => $product?->price ?? 0,
                        'coverMediaUrl' => $product?->cover_media_url ?? '',
                        'descriptionAr' => $product?->description_ar ?? '',
                        'descriptionEn' => $product?->description_en ?? '',
                        'ingredients' => $this->decodeJsonArray($product?->ingredients ?? []),
                        'allergens' => $this->decodeJsonArray($product?->allergens ?? []),
                        'customChoiceGroups' => $this->decodeJsonArray($product?->custom_choice_groups ?? []),
                        'calories' => $product?->calories,
                        'averageWaitTime' => $product?->average_wait_time,
                    ];
                })->all();
        }

        $grouped = [];
        foreach ($groupRows as $group) {
            $grouped[$group['offer_id']][] = [
                'id' => $group['id'],
                'offerId' => $group['offer_id'],
                'titleAr' => $group['title_ar'],
                'titleEn' => $group['title_en'],
                'selectionMode' => $group['selection_mode'] === 'radio' ? 'radio' : 'checkbox',
                'minSelect' => (int) $group['min_select'],
                'maxSelect' => (int) $group['max_select'],
                'sortOrder' => (int) $group['sort_order'],
                'required' => (bool) $group['required'],
                'items' => array_values(array_filter($itemRows, fn ($item) => (int) $item['groupId'] === (int) $group['id'])),
            ];
        }

        return array_map(function ($offer) use ($grouped) {
            $groups = $grouped[$offer['id']] ?? [];
            usort($groups, fn ($a, $b) => $a['sortOrder'] <=> $b['sortOrder'] ?: $a['id'] <=> $b['id']);
            return [
                'id' => (int) $offer['id'],
                'nameAr' => $offer['name_ar'],
                'nameEn' => $offer['name_en'],
                'noteAr' => $offer['note_ar'] ?? '',
                'noteEn' => $offer['note_en'] ?? '',
                'totalPrice' => (float) $offer['total_price'],
                'imageUrl' => $offer['image_url'] ?? '',
                'isActive' => (bool) $offer['is_active'],
                'groups' => $groups,
            ];
        }, $offers);
    }

    public function menu(Request $request)
    {
        try {
            $lang = $request->query('lang', 'en');
            $tableUuid = $request->query('table');
            $session = $request->query('session');

            if ($tableUuid && !$session) {
                return $this->jsonError(403, 'QR session required');
            }

            $table = null;
            if ($tableUuid) {
                $table = $this->resolveTableByUuid($tableUuid);
                if (!$table) {
                    return $this->jsonError(404, 'Invalid table QR code');
                }
                if (!$this->sessionIsValid($table, $session)) {
                    return $this->jsonError(403, 'QR session expired');
                }
            }

            if (!Schema::hasTable('categories') || !Schema::hasTable('products')) {
                return $this->jsonOk([
                    'table' => $table ? [
                        'id' => $table->id,
                        'name' => $table->name,
                        'tableNumber' => $table->table_number,
                        'qrCodeUuid' => $table->qr_code_uuid,
                        'sessionUuid' => $table->session_uuid,
                        'tableColor' => $table->table_color,
                        'activeOrderNumber' => $table->active_order_number,
                        'status' => $table->status,
                        'currentPhone' => $table->current_phone,
                        'customerName' => $table->current_phone ? $this->latestCustomerNameByPhone($table->current_phone) : '',
                        'openedAt' => $table->opened_at,
                        'invoiceRequestedAt' => $table->invoice_requested_at,
                        'orderCount' => $table ? $this->currentSessionOrderCount($table) : 0,
                        'hasOrders' => false,
                    ] : null,
                    'verified' => (bool) $table,
                    'categories' => [],
                    'vip' => null,
                ]);
            }

            $categories = $this->menuCategories('menu');
            $products = $this->menuProducts('menu');
            $productsByCategory = [];
            foreach ($products as $product) {
                $productsByCategory[$product['categoryId']][] = $this->serializeProduct($product, $lang);
            }

            $shaped = array_map(function ($category) use ($productsByCategory, $lang) {
                $category['name'] = $lang === 'ar' ? $category['nameAr'] : $category['nameEn'];
                $category['products'] = $productsByCategory[$category['id']] ?? [];
                return $category;
            }, $categories);

            $orderCount = $table ? $this->currentSessionOrderCount($table) : 0;
            $customerName = $table?->current_phone ? $this->latestCustomerNameByPhone($table->current_phone) : '';
            $subtotal = $table ? $this->currentSessionSubtotal($table) : 0.0;
            $vip = $table?->current_phone ? $this->loadVipSummary($table->current_phone, $subtotal) : null;

            return $this->jsonOk([
                'table' => $table ? [
                    'id' => $table->id,
                    'name' => $table->name,
                    'tableNumber' => $table->table_number,
                    'qrCodeUuid' => $table->qr_code_uuid,
                    'sessionUuid' => $table->session_uuid,
                    'tableColor' => $table->table_color,
                    'activeOrderNumber' => $table->active_order_number,
                    'status' => $table->status,
                    'currentPhone' => $table->current_phone,
                    'customerName' => $customerName,
                    'openedAt' => $table->opened_at,
                    'invoiceRequestedAt' => $table->invoice_requested_at,
                    'orderCount' => $orderCount,
                    'hasOrders' => $orderCount > 0,
                ] : null,
                'verified' => (bool) $table,
                'categories' => $shaped,
                'vip' => $vip,
            ]);
        } catch (Throwable) {
            return $this->jsonOk([
                'table' => null,
                'verified' => false,
                'categories' => [],
                'vip' => null,
            ]);
        }
    }

    public function offers()
    {
        try {
            return $this->jsonOk($this->loadOffers(true));
        } catch (Throwable) {
            return $this->jsonOk([]);
        }
    }

    public function resolveTable(Request $request)
    {
        try {
            $uuid = (string) $request->query('uuid', '');
            $session = $request->query('session') ? (string) $request->query('session') : null;
            $table = $this->resolveTableByUuid($uuid);
            if (!$table) {
                return $this->jsonError(404, 'Invalid table QR code');
            }
            if ($session && !$this->sessionIsValid($table, $session)) {
                return $this->jsonError(403, 'QR session expired');
            }

            $orderCount = $this->currentSessionOrderCount($table);
            return $this->jsonOk([
                'id' => $table->id,
                'name' => $table->name,
                'tableNumber' => $table->table_number,
                'qrCodeUuid' => $table->qr_code_uuid,
                'sessionUuid' => $table->session_uuid,
                'tableColor' => $table->table_color,
                'activeOrderNumber' => $table->active_order_number,
                'status' => $table->status,
                'currentPhone' => $table->current_phone,
                'customerName' => $table->current_phone ? $this->latestCustomerNameByPhone($table->current_phone) : '',
                'openedAt' => $table->opened_at,
                'invoiceRequestedAt' => $table->invoice_requested_at,
                'orderCount' => $orderCount,
                'hasOrders' => $orderCount > 0,
            ]);
        } catch (Throwable) {
            return $this->jsonOk([
                'id' => null,
                'name' => '',
                'tableNumber' => '',
                'qrCodeUuid' => '',
                'sessionUuid' => '',
                'tableColor' => null,
                'activeOrderNumber' => null,
                'status' => 'active',
                'currentPhone' => '',
                'customerName' => '',
                'openedAt' => null,
                'invoiceRequestedAt' => null,
                'orderCount' => 0,
                'hasOrders' => false,
            ]);
        }
    }

    public function qr(string $uuid)
    {
        $table = $this->resolveTableByUuid($uuid);
        if (!$table) {
            return $this->jsonError(404, 'Invalid table QR code');
        }

        $redirectUrl = url('/t/' . $table->qr_code_uuid . '?session=' . urlencode((string) ($table->session_uuid ?? '')));
        return redirect()->away($redirectUrl, 302);
    }

    public function openTable(Request $request)
    {
        try {
        $normalizedPhone = $this->normalizePhone((string) $request->input('phone', ''));
        $request->merge(['phone' => $normalizedPhone]);

        $data = $request->validate([
            'uuid' => ['required', 'uuid'],
            'phone' => ['required', 'regex:/^01\d{9}$/u'],
            'session' => ['nullable', 'uuid'],
        ]);

        $table = $this->resolveTableByUuid($data['uuid']);
        if (!$table) {
            return $this->jsonError(404, 'Invalid table QR code');
        }
        if (!$this->sessionIsValid($table, $data['session'] ?? null)) {
            return $this->jsonError(403, 'QR session expired');
        }
        if ($table->current_phone && $table->current_phone !== $data['phone']) {
            return $this->jsonError(403, 'الرجاء كتابة الرقم المفتوح به الطاولة');
        }

        $table->current_phone = $table->current_phone ?? $data['phone'];
        $table->opened_at = $table->opened_at ?? now();
        $table->save();

        DB::table('qr_scans')->insert([
            'branch_id' => $table->branch_id,
            'table_id' => $table->id,
            'customer_id' => null,
            'scanned_at' => now(),
        ]);

        $customerName = $this->latestCustomerNameByPhone($table->current_phone ?? $data['phone']);
        $subtotal = $this->currentSessionSubtotal($table);
        $vip = $this->loadVipSummary($table->current_phone ?? $data['phone'], $subtotal);

        return $this->jsonOk([
            'id' => $table->id,
            'name' => $table->name,
            'tableNumber' => $table->table_number,
            'qrCodeUuid' => $table->qr_code_uuid,
            'sessionUuid' => $table->session_uuid,
            'tableColor' => $table->table_color,
            'activeOrderNumber' => $table->active_order_number,
            'status' => $table->status,
            'currentPhone' => $table->current_phone,
            'customerName' => $customerName,
            'openedAt' => $table->opened_at,
            'invoiceRequestedAt' => $table->invoice_requested_at,
            'vip' => $vip,
        ]);
        } catch (Throwable) {
            return $this->jsonOk([
                'id' => null,
                'name' => '',
                'tableNumber' => '',
                'qrCodeUuid' => '',
                'sessionUuid' => '',
                'tableColor' => null,
                'activeOrderNumber' => null,
                'status' => 'active',
                'currentPhone' => '',
                'customerName' => '',
                'openedAt' => null,
                'invoiceRequestedAt' => null,
                'vip' => null,
            ]);
        }
    }

    public function closeTable(Request $request)
    {
        try {
            $data = $request->validate([
                'uuid' => ['required', 'uuid'],
                'session' => ['nullable', 'uuid'],
            ]);

            $table = $this->resolveTableByUuid($data['uuid']);
            if (!$table) {
                return $this->jsonError(404, 'Invalid table QR code');
            }
            if (!$this->sessionIsValid($table, $data['session'] ?? null)) {
                return $this->jsonError(403, 'QR session expired');
            }

            $closingPhone = trim((string) $request->input('phone', ''));
            if ($closingPhone !== '' && !preg_match('/^01\d{9}$/u', $closingPhone)) {
                return $this->jsonError(422, 'Phone number must be 11 digits and start with 01');
            }
            if ($closingPhone === '') {
                $closingPhone = trim((string) ($table->current_phone ?? ''));
            }
            if ($table->current_phone && $closingPhone !== '' && $table->current_phone !== $closingPhone) {
                return $this->jsonError(403, 'Phone number does not match the open table');
            }

            $vip = null;
            if ($closingPhone !== '') {
                try {
                    $subtotal = $this->currentSessionSubtotal($table);
                    $vip = $this->loadVipSummary($closingPhone, $subtotal);
                } catch (Throwable $vipError) {
                    report($vipError);
                }
            }

            try {
                $orders = Order::query()
                    ->where('table_id', $table->id)
                    ->orderBy('created_at')
                    ->with('items')
                    ->get();

                foreach ($orders as $order) {
                    try {
                        DB::table('archived_orders')->updateOrInsert(
                            ['order_id' => $order->id],
                            [
                                'table_id' => $order->table_id,
                                'table_number' => $table->table_number,
                                'table_color' => $table->table_color,
                                'session_uuid' => $table->session_uuid,
                                'order_number' => $order->order_number,
                                'status' => $order->status,
                                'source' => $order->source,
                                'total_amount' => $order->total_amount,
                                'created_at' => $order->created_at,
                                'archived_at' => now(),
                                'payload' => json_encode([
                                    'order' => $order->toArray(),
                                    'items' => $order->items->toArray(),
                                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                            ]
                        );
                    } catch (Throwable $archiveError) {
                        report($archiveError);
                    }
                }
            } catch (Throwable $archiveListError) {
                report($archiveListError);
            }

            $nextSessionUuid = (string) Str::uuid();
            try {
                DB::transaction(function () use ($table, $closingPhone, $nextSessionUuid) {
                    $lockedTable = Table::query()->whereKey($table->id)->lockForUpdate()->first();
                    if (!$lockedTable) {
                        throw new \RuntimeException('Table not found during close operation');
                    }

                    $lockedTable->session_uuid = $nextSessionUuid;
                    $lockedTable->current_phone = null;
                    $lockedTable->opened_at = null;
                    $lockedTable->invoice_requested_at = null;
                    $lockedTable->active_order_number = null;
                    $lockedTable->save();

                    if (!empty($closingPhone)) {
                        VipCustomerVisit::query()->where('phone', $closingPhone)->update([
                            'visit_count' => 0,
                            'amount_total' => 0,
                            'reward_status' => 'expired',
                            'reward_visit_count' => 0,
                            'reward_session_uuid' => null,
                            'reward_awarded_at' => null,
                            'reward_consumed_at' => null,
                            'reward_consumed_session_uuid' => null,
                            'updated_at' => now(),
                        ]);
                    }
                });
            } catch (Throwable $closeError) {
                report($closeError);
                Table::query()->whereKey($table->id)->update([
                    'session_uuid' => $nextSessionUuid,
                    'current_phone' => null,
                    'opened_at' => null,
                    'invoice_requested_at' => null,
                    'active_order_number' => null,
                ]);

                if (!empty($closingPhone)) {
                    VipCustomerVisit::query()->where('phone', $closingPhone)->update([
                        'visit_count' => 0,
                        'amount_total' => 0,
                        'reward_status' => 'expired',
                        'reward_visit_count' => 0,
                        'reward_session_uuid' => null,
                        'reward_awarded_at' => null,
                        'reward_consumed_at' => null,
                        'reward_consumed_session_uuid' => null,
                        'updated_at' => now(),
                    ]);
                }
            }

            $updated = $this->resolveTableByUuid($data['uuid']) ?? $table;
            return $this->jsonOk([
                'id' => $updated->id,
                'name' => $updated->name,
                'tableNumber' => $updated->table_number,
                'qrCodeUuid' => $updated->qr_code_uuid,
                'sessionUuid' => $updated->session_uuid,
                'tableColor' => $updated->table_color,
                'activeOrderNumber' => $updated->active_order_number,
                'status' => $updated->status,
                'invoiceRequestedAt' => $updated->invoice_requested_at,
                'vip' => $vip,
            ]);
        } catch (Throwable $e) {
            report($e);
            Log::error('Failed to close table', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            if (isset($table) && $table instanceof Table) {
                try {
                    $nextSessionUuid = $nextSessionUuid ?? (string) Str::uuid();
                    Table::query()->whereKey($table->id)->update([
                        'session_uuid' => $nextSessionUuid,
                        'current_phone' => null,
                        'opened_at' => null,
                        'invoice_requested_at' => null,
                        'active_order_number' => null,
                    ]);

                    if (!empty($closingPhone ?? '')) {
                        VipCustomerVisit::query()->where('phone', $closingPhone)->update([
                            'visit_count' => 0,
                            'amount_total' => 0,
                            'reward_status' => 'expired',
                            'reward_visit_count' => 0,
                            'reward_session_uuid' => null,
                            'reward_awarded_at' => null,
                            'reward_consumed_at' => null,
                            'reward_consumed_session_uuid' => null,
                            'updated_at' => now(),
                        ]);
                    }

                    $updated = $this->resolveTableByUuid($data['uuid']) ?? $table;
                    return $this->jsonOk([
                        'id' => $updated->id,
                        'name' => $updated->name,
                        'tableNumber' => $updated->table_number,
                        'qrCodeUuid' => $updated->qr_code_uuid,
                        'sessionUuid' => $updated->session_uuid,
                        'tableColor' => $updated->table_color,
                        'activeOrderNumber' => $updated->active_order_number,
                        'status' => $updated->status,
                        'invoiceRequestedAt' => $updated->invoice_requested_at,
                        'vip' => $vip,
                    ]);
                } catch (Throwable $fallbackError) {
                    report($fallbackError);
                    Log::error('Failed to apply fallback table close', [
                        'message' => $fallbackError->getMessage(),
                        'trace' => $fallbackError->getTraceAsString(),
                    ]);
                }
            }

            $nextSessionUuid = $nextSessionUuid ?? (string) Str::uuid();
            $tableData = isset($table) && $table instanceof Table
                ? ($this->resolveTableByUuid($data['uuid']) ?? $table)
                : null;

            if ($tableData instanceof Table) {
                return $this->jsonOk([
                    'id' => $tableData->id,
                    'name' => $tableData->name,
                    'tableNumber' => $tableData->table_number,
                    'qrCodeUuid' => $tableData->qr_code_uuid,
                    'sessionUuid' => $tableData->session_uuid ?? $nextSessionUuid,
                    'tableColor' => $tableData->table_color,
                    'activeOrderNumber' => $tableData->active_order_number,
                    'status' => $tableData->status,
                    'invoiceRequestedAt' => $tableData->invoice_requested_at,
                    'vip' => $vip,
                ]);
            }

            return $this->jsonOk([
                'id' => null,
                'name' => null,
                'tableNumber' => null,
                'qrCodeUuid' => $data['uuid'],
                'sessionUuid' => $nextSessionUuid,
                'tableColor' => null,
                'activeOrderNumber' => null,
                'status' => null,
                'invoiceRequestedAt' => null,
                'vip' => $vip,
            ]);
        }
    }

    public function placeOrder(Request $request)
    {
        $data = $request->validate([
            'tableUuid' => ['required', 'uuid'],
            'session' => ['nullable', 'uuid'],
            'items' => ['required', 'array', 'min:1'],
        ]);

        $table = $this->resolveTableByUuid($data['tableUuid']);
        if (!$table) {
            return $this->jsonError(403, 'A valid table QR is required to place an order');
        }
        if (!$this->sessionIsValid($table, $data['session'] ?? null)) {
            Log::warning('Order received with session mismatch, continuing with tableUuid only', [
                'tableUuid' => $data['tableUuid'],
                'tableId' => $table->id,
                'session' => $data['session'] ?? null,
                'currentPhone' => $table->current_phone ?? null,
            ]);
        }

        $productIds = collect($data['items'])->pluck('productId')->unique()->values()->all();
        $products = Product::query()->whereIn('id', $productIds)->where('scope', 'menu')->where('is_available', true)->get()->keyBy('id');
        if ($products->count() !== count($productIds)) {
            return $this->jsonError(400, 'One or more products are unavailable');
        }

        $order = DB::transaction(function () use ($data, $table, $products) {
            $lockedTable = Table::query()->whereKey($table->id)->lockForUpdate()->first();
            $orderNumber = (int) ($lockedTable->active_order_number ?? 0);
            if (!$orderNumber) {
                $orderNumber = (int) (DB::table('orders')->max('order_number') ?? 0) + 1;
                $lockedTable->active_order_number = $orderNumber;
                $lockedTable->save();
            }

            $totalAmount = 0.0;
            foreach ($data['items'] as $item) {
                $product = $products[(int) $item['productId']];
                $unitPrice = isset($item['unitPrice']) && is_numeric($item['unitPrice'])
                    ? (float) $item['unitPrice']
                    : (float) $product->price;
                $totalAmount += $unitPrice * (int) $item['quantity'];
            }

            $vipDiscount = null;
            if ($table->current_phone) {
                $vip = $this->loadVipSummary($table->current_phone, $totalAmount);
                if ($vip && ($vip['campaign']['rewardType'] ?? '') === 'financial') {
                    $vipDiscount = $vip;
                }
            }

            $discountAmount = 0.0;
            if ($vipDiscount) {
                $discountAmount = (float) ($vipDiscount['discountAmount'] ?? 0);
            }
            $discountedTotal = max(0, round($totalAmount - $discountAmount, 2));

            $orderId = DB::table('orders')->insertGetId([
                'table_id' => $table->id,
                'branch_id' => $table->branch_id,
                'customer_id' => null,
                'waiter_id' => null,
                'total_amount' => $discountedTotal,
                'status' => 'pending',
                'source' => 'qr',
                'order_number' => $orderNumber,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($data['items'] as $index => $item) {
                $product = $products[(int) $item['productId']];
                $selectedOptions = $item['selectedOptions'] ?? [];
                $display = !empty($selectedOptions['offerId']) || (($selectedOptions['itemType'] ?? '') === 'offer');
                DB::table('order_items')->insert([
                    'order_id' => $orderId,
                    'product_id' => $product->id,
                    'offer_id' => $display ? (int) ($selectedOptions['offerId'] ?? 0) ?: null : null,
                    'quantity' => (int) $item['quantity'],
                    'price_at_sale' => isset($item['unitPrice']) && is_numeric($item['unitPrice']) ? (float) $item['unitPrice'] : (float) $product->price,
                    'item_type' => $display ? 'offer' : 'product',
                    'display_name_ar' => $selectedOptions['displayNameAr'] ?? $selectedOptions['offerNameAr'] ?? null,
                    'display_name_en' => $selectedOptions['displayNameEn'] ?? $selectedOptions['offerNameEn'] ?? null,
                    'display_image_url' => $selectedOptions['displayImageUrl'] ?? $selectedOptions['offerImageUrl'] ?? null,
                    'selected_options' => json_encode($selectedOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
            }

            return ['id' => $orderId, 'orderNumber' => $orderNumber, 'discountAmount' => $discountAmount];
        });

        if ($table->current_phone) {
            $campaign = $this->loadVipCampaign();
            $shouldReset = false;
            if ($campaign['rewardType'] === 'product') {
                $rewardProductId = (int) ($campaign['productRewardId'] ?? 0);
                $shouldReset = $rewardProductId > 0 && collect($data['items'])->contains(fn ($item) => (int) $item['productId'] === $rewardProductId && (float) ($item['unitPrice'] ?? 0) === 0.0);
            } elseif ((float) ($order['discountAmount'] ?? 0) > 0) {
                $shouldReset = true;
            }

            if ($shouldReset) {
                VipCustomerVisit::query()->where('phone', $table->current_phone)->update([
                    'visit_count' => 0,
                    'amount_total' => 0,
                    'reward_status' => 'expired',
                    'reward_visit_count' => 0,
                    'reward_session_uuid' => null,
                    'reward_awarded_at' => null,
                    'reward_consumed_at' => null,
                    'reward_consumed_session_uuid' => null,
                    'updated_at' => now(),
                ]);
            }
        }

        return $this->jsonOk([
            'orderId' => $order['id'],
            'orderNumber' => $order['orderNumber'],
        ]);
    }

    public function requestInvoice(Request $request)
    {
        $data = $request->validate([
            'tableUuid' => ['required', 'uuid'],
            'session' => ['nullable', 'uuid'],
        ]);

        $table = $this->resolveTableByUuid($data['tableUuid']);
        if (!$table) {
            return $this->jsonError(403, 'A valid table QR is required to request the bill');
        }
        if (!$this->sessionIsValid($table, $data['session'] ?? null)) {
            return $this->jsonError(403, 'QR session expired');
        }

        $table->invoice_requested_at = now();
        $table->save();
        return $this->jsonOk(['success' => true]);
    }

    public function callWaiter(Request $request)
    {
        $data = $request->validate([
            'tableUuid' => ['required', 'uuid'],
            'session' => ['nullable', 'uuid'],
        ]);

        $table = $this->resolveTableByUuid($data['tableUuid']);
        if (!$table) {
            return $this->jsonError(403, 'A valid table QR is required to call the waiter');
        }
        if (!$this->sessionIsValid($table, $data['session'] ?? null)) {
            return $this->jsonError(403, 'QR session expired');
        }

        $callId = DB::table('waiter_calls')->insertGetId([
            'table_id' => $table->id,
            'waiter_id' => null,
            'status' => 'pending',
            'created_at' => now(),
            'responded_at' => null,
        ]);

        return $this->jsonOk(['id' => $callId]);
    }

    public function productViews(Request $request)
    {
        $data = $request->validate([
            'productId' => ['required', 'integer'],
            'tableUuid' => ['nullable', 'uuid'],
            'session' => ['nullable', 'uuid'],
            'customerId' => ['nullable', 'integer'],
        ]);

        $table = null;
        if (!empty($data['tableUuid'])) {
            $table = $this->resolveTableByUuid($data['tableUuid']);
            if ($table && !$this->sessionIsValid($table, $data['session'] ?? null)) {
                return $this->jsonError(403, 'QR session expired');
            }
        }

        $id = DB::table('product_views')->insertGetId([
            'branch_id' => $table?->branch_id,
            'table_id' => $table?->id,
            'customer_id' => $data['customerId'] ?? null,
            'product_id' => $data['productId'],
            'viewed_at' => now(),
        ]);

        return $this->jsonOk(['id' => $id]);
    }

    public function customerReviews(Request $request)
    {
        $data = $request->validate([
            'tableUuid' => ['required', 'uuid'],
            'session' => ['nullable', 'uuid'],
            'customerName' => ['required', 'string'],
            'ratingMode' => ['required', 'in:stars,emoji'],
            'ratingValue' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string'],
        ]);

        $table = $this->resolveTableByUuid($data['tableUuid']);
        if (!$table) {
            return $this->jsonError(403, 'A valid table QR is required to send a review');
        }
        if (!$this->sessionIsValid($table, $data['session'] ?? null)) {
            return $this->jsonError(403, 'QR session expired');
        }
        if (!trim((string) $table->current_phone)) {
            return $this->jsonError(403, 'Open table phone is required');
        }

        $id = DB::table('customer_reviews')->insertGetId([
            'table_id' => $table->id,
            'table_uuid' => $table->qr_code_uuid,
            'session_uuid' => $table->session_uuid,
            'table_number' => $table->table_number,
            'table_color' => $table->table_color,
            'phone' => $table->current_phone,
            'customer_name' => $data['customerName'],
            'rating_mode' => $data['ratingMode'],
            'rating_value' => $data['ratingValue'],
            'comment' => $data['comment'] ?? '',
            'created_at' => now(),
        ]);

        return $this->jsonOk(['id' => $id]);
    }

    public function waiterComplaints(Request $request)
    {
        $data = $request->validate([
            'tableNumber' => ['required', 'string'],
            'complaint' => ['required', 'string'],
        ]);

        $id = DB::table('waiter_complaints')->insertGetId([
            'table_number' => $data['tableNumber'],
            'complaint' => $data['complaint'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->jsonOk(['id' => $id]);
    }
}
