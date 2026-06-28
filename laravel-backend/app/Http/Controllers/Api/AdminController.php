<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Offer;
use App\Models\OfferGroup;
use App\Models\OfferGroupProduct;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Table;
use App\Models\VipCustomerVisit;
use App\Support\AdminToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AdminController extends Controller
{
    private function ok(mixed $data = null): Response
    {
        return response()->json(['success' => true, 'data' => $data]);
    }

    private function error(int $status, string $message, array $details = []): Response
    {
        return response()->json([
            'success' => false,
            'error' => array_filter([
                'message' => $message,
                'details' => $details ?: null,
            ]),
        ], $status);
    }

    private function normalizeScope(?string $scope): string
    {
        return $scope === 'studio' ? 'studio' : 'menu';
    }

    private function normalizeSelectionMode(mixed $value): string
    {
        return trim((string) $value) === 'radio' ? 'radio' : 'checkbox';
    }

    private function decodeJson(mixed $value): array
    {
        if (is_array($value)) return $value;
        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : [];
        }
        return [];
    }

    private function parseBool(mixed $value): bool
    {
        if (is_bool($value)) return $value;
        if (is_numeric($value)) return (int) $value !== 0;
        $value = strtolower(trim((string) $value));
        return in_array($value, ['true', '1', 'yes', 'on'], true);
    }

    private function rowValue(array|object $row, string $key, mixed $default = null): mixed
    {
        if (is_array($row)) {
            return $row[$key] ?? $default;
        }

        return isset($row->$key) ? $row->$key : $default;
    }

    private function formatBranch(array|object $row): array
    {
        return [
            'id' => (int) $this->rowValue($row, 'id', 0),
            'nameAr' => (string) $this->rowValue($row, 'nameAr', $this->rowValue($row, 'name_ar', '')),
            'nameEn' => (string) $this->rowValue($row, 'nameEn', $this->rowValue($row, 'name_en', '')),
            'code' => (string) $this->rowValue($row, 'code', ''),
            'isActive' => (bool) $this->rowValue($row, 'isActive', $this->rowValue($row, 'is_active', false)),
            'createdAt' => $this->rowValue($row, 'createdAt', $this->rowValue($row, 'created_at', null)),
        ];
    }

    private function formatTable(array|object $row): array
    {
        $status = (string) $this->rowValue($row, 'status', '');
        $currentPhone = trim((string) $this->rowValue($row, 'currentPhone', $this->rowValue($row, 'current_phone', '')));
        $openedAt = $this->rowValue($row, 'openedAt', $this->rowValue($row, 'opened_at', null));
        $isOpen = $status === 'active' && $currentPhone !== '';
        return [
            'id' => (int) $this->rowValue($row, 'id', 0),
            'branchId' => $this->rowValue($row, 'branchId', $this->rowValue($row, 'branch_id', null)),
            'name' => (string) $this->rowValue($row, 'name', ''),
            'tableNumber' => (string) $this->rowValue($row, 'tableNumber', $this->rowValue($row, 'table_number', '')),
            'qrCodeUuid' => (string) $this->rowValue($row, 'qrCodeUuid', $this->rowValue($row, 'qr_code_uuid', '')),
            'tableColor' => (string) $this->rowValue($row, 'tableColor', $this->rowValue($row, 'table_color', '')),
            'currentPhone' => $isOpen ? $currentPhone : '',
            'openedAt' => $isOpen ? $openedAt : null,
            'invoiceRequestedAt' => $this->rowValue($row, 'invoiceRequestedAt', $this->rowValue($row, 'invoice_requested_at', null)),
            'status' => $status,
            'sessionUuid' => (string) $this->rowValue($row, 'sessionUuid', $this->rowValue($row, 'session_uuid', '')),
            'activeOrderNumber' => $this->rowValue($row, 'activeOrderNumber', $this->rowValue($row, 'active_order_number', null)),
        ];
    }

    private function formatEmployee(array|object $row): array
    {
        $branchId = $this->rowValue($row, 'branchId', $this->rowValue($row, 'branch_id', null));
        $branch = $this->rowValue($row, 'branch', null);
        if (!$branch && $branchId) {
            $branchRow = DB::table('branches')
                ->select('id', 'name_ar as nameAr', 'name_en as nameEn', 'code', 'is_active as isActive', 'created_at as createdAt')
                ->where('id', $branchId)
                ->first();
            $branch = $branchRow ? $this->formatBranch($branchRow) : null;
        }

        return [
            'id' => (int) $this->rowValue($row, 'id', 0),
            'branchId' => $branchId !== null ? (int) $branchId : null,
            'fullName' => (string) $this->rowValue($row, 'fullName', $this->rowValue($row, 'full_name', '')),
            'phone' => (string) $this->rowValue($row, 'phone', ''),
            'email' => (string) $this->rowValue($row, 'email', ''),
            'role' => $this->normalizeRoleForEmployee($this->rowValue($row, 'role', 'waiter')),
            'isActive' => (bool) $this->rowValue($row, 'isActive', $this->rowValue($row, 'is_active', true)),
            'createdAt' => $this->rowValue($row, 'createdAt', $this->rowValue($row, 'created_at', null)),
            'updatedAt' => $this->rowValue($row, 'updatedAt', $this->rowValue($row, 'updated_at', null)),
            'branch' => $branch,
        ];
    }

    private function productPrice(array $product): float
    {
        $discountPrice = $product['discount_price'] ?? $product['discountPrice'] ?? null;
        if (!empty($product['is_discounted'] ?? $product['isDiscounted'] ?? false) && $discountPrice !== null && $discountPrice !== '') {
            return (float) $discountPrice;
        }
        return (float) ($product['price'] ?? 0);
    }

    private function selectCategories(string $scope): array
    {
        return DB::table('categories')
            ->select('id', 'name_ar as nameAr', 'name_en as nameEn', 'sort_order as sortOrder', 'is_active as isActive', 'scope')
            ->where('scope', $scope)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function selectProducts(string $scope): array
    {
        return DB::table('products')
            ->select(
                'id',
                'category_id as categoryId',
                'scope',
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
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function formatProduct(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'categoryId' => (int) ($row['categoryId'] ?? $row['category_id'] ?? 0),
            'scope' => (string) ($row['scope'] ?? 'menu'),
            'nameAr' => (string) ($row['nameAr'] ?? $row['name_ar'] ?? ''),
            'nameEn' => (string) ($row['nameEn'] ?? $row['name_en'] ?? ''),
            'descriptionAr' => (string) ($row['descriptionAr'] ?? $row['description_ar'] ?? ''),
            'descriptionEn' => (string) ($row['descriptionEn'] ?? $row['description_en'] ?? ''),
            'mediaType' => (string) ($row['mediaType'] ?? $row['media_type'] ?? 'image'),
            'coverMediaUrl' => (string) ($row['coverMediaUrl'] ?? $row['cover_media_url'] ?? ''),
            'galleryUrls' => $this->decodeJson($row['galleryUrls'] ?? $row['gallery_urls'] ?? []),
            'ingredients' => $this->decodeJson($row['ingredients'] ?? []),
            'tags' => $this->decodeJson($row['tags'] ?? []),
            'allergens' => $this->decodeJson($row['allergens'] ?? []),
            'sizeOptions' => $this->decodeJson($row['sizeOptions'] ?? $row['size_options'] ?? []),
            'sideDishOptions' => $this->decodeJson($row['sideDishOptions'] ?? $row['side_dish_options'] ?? []),
            'addonOptions' => $this->decodeJson($row['addonOptions'] ?? $row['addon_options'] ?? []),
            'customChoiceGroups' => $this->decodeJson($row['customChoiceGroups'] ?? $row['custom_choice_groups'] ?? []),
            'price' => (float) ($row['price'] ?? 0),
            'calories' => ($row['calories'] ?? null) !== null ? (int) $this->rowValue($row, 'calories') : null,
            'averageWaitTime' => ($row['averageWaitTime'] ?? $row['average_wait_time'] ?? null) !== null ? (int) $this->rowValue($row, 'averageWaitTime', $this->rowValue($row, 'average_wait_time')) : null,
            'isDiscounted' => (bool) ($row['isDiscounted'] ?? $row['is_discounted'] ?? false),
            'discountPrice' => ($row['discountPrice'] ?? $row['discount_price'] ?? null) !== null ? (float) $this->rowValue($row, 'discountPrice', $this->rowValue($row, 'discount_price')) : null,
            'isAvailable' => (bool) ($row['isAvailable'] ?? $row['is_available'] ?? true),
            'isFeatured' => (bool) ($row['isFeatured'] ?? $row['is_featured'] ?? false),
            'sortOrder' => (int) ($row['sortOrder'] ?? $row['sort_order'] ?? 0),
            'effectivePrice' => $this->productPrice($row),
        ];
    }

    private function selectOrders(bool $archived = false): array
    {
        if ($archived) {
            return DB::table('archived_orders')
                ->orderByDesc('archived_at')
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all();
        }

        return Order::query()
            ->with(['items'])
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($order) {
                return [
                    'id' => $order->id,
                    'tableId' => $order->table_id,
                    'branchId' => $order->branch_id,
                    'customerId' => $order->customer_id,
                    'waiterId' => $order->waiter_id,
                    'totalAmount' => (float) $order->total_amount,
                    'status' => $order->status,
                    'source' => $order->source,
                    'orderNumber' => $order->order_number ?? $order->id,
                    'cancelReason' => $order->cancel_reason,
                    'createdAt' => $order->created_at,
                    'updatedAt' => $order->updated_at,
                    'table' => DB::table('tables')->where('id', $order->table_id)->first(),
                    'items' => $order->items->map(function ($item) {
                        return [
                            'id' => $item->id,
                            'orderId' => $item->order_id,
                            'productId' => $item->product_id,
                            'offerId' => $item->offer_id,
                            'quantity' => $item->quantity,
                            'priceAtSale' => (float) $item->price_at_sale,
                            'itemType' => $item->item_type,
                            'status' => $item->status ?? 'pending',
                            'cancelReason' => $item->cancel_reason ?? null,
                            'displayNameAr' => $item->display_name_ar,
                            'displayNameEn' => $item->display_name_en,
                            'displayImageUrl' => $item->display_image_url,
                            'selectedOptions' => $this->decodeJson($item->selected_options),
                        ];
                    })->all(),
                ];
            })
            ->all();
    }

    private function createAudit(string $action, string $entityType, string $entityId, mixed $oldValues = null, mixed $newValues = null): void
    {
        DB::table('audit_logs')->insert([
            'actor_type' => 'system',
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => (string) $entityId,
            'old_values' => $oldValues !== null ? json_encode($oldValues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'new_values' => $newValues !== null ? json_encode($newValues, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
            'created_at' => now(),
            'branch_id' => null,
            'employee_id' => null,
        ]);
    }

    public function summary()
    {
        return $this->ok([
            'categories' => DB::table('categories')->count(),
            'products' => DB::table('products')->count(),
            'tables' => DB::table('tables')->count(),
            'pendingCalls' => DB::table('waiter_calls')->where('status', 'pending')->count(),
            'pendingInvoices' => DB::table('tables')->whereNotNull('invoice_requested_at')->count(),
            'orders' => DB::table('orders')->count(),
        ]);
    }

    public function offersIndex()
    {
        $offers = DB::table('offers')->orderByDesc('id')->get();
        return $this->ok($this->shapeOffers($offers->all()));
    }

    public function offersActive()
    {
        $offers = DB::table('offers')->where('is_active', true)->orderByDesc('id')->get();
        return $this->ok($this->shapeOffers($offers->all()));
    }

    private function shapeOffers(array $offers): array
    {
        if (!$offers) return [];
        $offerIds = array_map(fn ($offer) => (int) $offer->id, $offers);
        $groups = DB::table('offer_groups')->whereIn('offer_id', $offerIds)->orderBy('sort_order')->orderBy('id')->get();
        $groupIds = $groups->pluck('id')->all();
        $items = $groupIds ? DB::table('offer_group_products as ogp')
            ->join('products as p', 'p.id', '=', 'ogp.product_id')
            ->whereIn('ogp.group_id', $groupIds)
            ->orderBy('ogp.sort_order')
            ->orderBy('ogp.id')
            ->get() : collect();

        $itemsByGroup = [];
        foreach ($items as $item) {
            $itemsByGroup[$item->group_id][] = [
                'id' => (int) $item->id,
                'groupId' => (int) $item->group_id,
                'productId' => (int) $item->product_id,
                'extraPrice' => (float) $item->extra_price,
                'includeProductOptions' => (bool) $item->include_product_options,
                'sortOrder' => (int) $item->sort_order,
                'nameAr' => $item->name_ar,
                'nameEn' => $item->name_en,
                'productPrice' => (float) $item->price,
                'coverMediaUrl' => $item->cover_media_url,
                'descriptionAr' => $item->description_ar,
                'descriptionEn' => $item->description_en,
                'ingredients' => $this->decodeJson($item->ingredients),
                'allergens' => $this->decodeJson($item->allergens),
                'customChoiceGroups' => $this->decodeJson($item->custom_choice_groups),
                'calories' => $item->calories,
                'averageWaitTime' => $item->average_wait_time,
            ];
        }

        $groupsByOffer = [];
        foreach ($groups as $group) {
            $groupsByOffer[$group->offer_id][] = [
                'id' => (int) $group->id,
                'offerId' => (int) $group->offer_id,
                'titleAr' => $group->title_ar,
                'titleEn' => $group->title_en,
                'selectionMode' => $group->selection_mode === 'radio' ? 'radio' : 'checkbox',
                'minSelect' => (int) $group->min_select,
                'maxSelect' => (int) $group->max_select,
                'sortOrder' => (int) $group->sort_order,
                'required' => (bool) $group->required,
                'items' => $itemsByGroup[$group->id] ?? [],
            ];
        }

        return array_map(function ($offer) use ($groupsByOffer) {
            return [
                'id' => (int) $offer->id,
                'nameAr' => $offer->name_ar,
                'nameEn' => $offer->name_en,
                'noteAr' => $offer->note_ar ?? '',
                'noteEn' => $offer->note_en ?? '',
                'totalPrice' => (float) $offer->total_price,
                'imageUrl' => $offer->image_url ?? '',
                'isActive' => (bool) $offer->is_active,
                'groups' => $groupsByOffer[$offer->id] ?? [],
            ];
        }, $offers);
    }

    private function normalizeOfferSelectionRows(array $groups): array
    {
        return array_map(function ($group) {
            $selectionMode = $this->normalizeSelectionMode($group['selectionMode'] ?? 'checkbox');
            $required = $this->parseBool($group['required'] ?? false);
            $min = $selectionMode === 'radio' ? 1 : max(0, (int) ($group['minSelect'] ?? 0));
            $max = $selectionMode === 'radio' ? 1 : max($min, (int) ($group['maxSelect'] ?? 1));
            return [
                'title_ar' => trim((string) ($group['titleAr'] ?? '')),
                'title_en' => trim((string) ($group['titleEn'] ?? '')),
                'selection_mode' => $selectionMode,
                'min_select' => $min,
                'max_select' => $max,
                'sort_order' => (int) ($group['sortOrder'] ?? 0),
                'required' => $required,
                'items' => array_map(function ($item) {
                    return [
                        'product_id' => (int) ($item['productId'] ?? 0),
                        'extra_price' => (float) ($item['extraPrice'] ?? 0),
                        'include_product_options' => $this->parseBool($item['includeProductOptions'] ?? false),
                        'sort_order' => (int) ($item['sortOrder'] ?? 0),
                    ];
                }, array_values($group['items'] ?? [])),
            ];
        }, array_values($groups));
    }

    private function replaceOfferGraph(int $offerId, array $groups): void
    {
        DB::table('offer_groups')->where('offer_id', $offerId)->delete();
        foreach ($groups as $index => $group) {
            $groupId = DB::table('offer_groups')->insertGetId([
                'offer_id' => $offerId,
                'title_ar' => $group['title_ar'] ?: ('مجموعة ' . ($index + 1)),
                'title_en' => $group['title_en'] ?: ('Group ' . ($index + 1)),
                'selection_mode' => $group['selection_mode'],
                'min_select' => $group['min_select'],
                'max_select' => $group['max_select'],
                'sort_order' => $group['sort_order'],
                'required' => $group['required'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            foreach ($group['items'] as $itemIndex => $item) {
                DB::table('offer_group_products')->insert([
                    'group_id' => $groupId,
                    'product_id' => $item['product_id'],
                    'extra_price' => $item['extra_price'],
                    'include_product_options' => $item['include_product_options'],
                    'sort_order' => $item['sort_order'] ?: $itemIndex,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function offersStore(Request $request)
    {
        $data = $request->all();
        if (empty($data['nameAr']) || empty($data['nameEn']) || !isset($data['totalPrice']) || empty($data['groups'])) {
            return $this->error(422, 'Validation failed', ['fieldErrors' => ['nameAr' => ['Required'], 'nameEn' => ['Required'], 'totalPrice' => ['Required'], 'groups' => ['At least one group is required']]]);
        }
        $id = DB::table('offers')->insertGetId([
            'name_ar' => trim((string) $data['nameAr']),
            'name_en' => trim((string) $data['nameEn']),
            'note_ar' => trim((string) ($data['noteAr'] ?? '')),
            'note_en' => trim((string) ($data['noteEn'] ?? '')),
            'total_price' => (float) $data['totalPrice'],
            'image_url' => trim((string) ($data['imageUrl'] ?? '')),
            'is_active' => $this->parseBool($data['isActive'] ?? true),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->replaceOfferGraph($id, $this->normalizeOfferSelectionRows($data['groups'] ?? []));
        return $this->ok($this->shapeOffers([DB::table('offers')->where('id', $id)->first()])[0] ?? null);
    }

    public function offersUpdate(Request $request, int $id)
    {
        $data = $request->all();
        DB::table('offers')->where('id', $id)->update(array_filter([
            'name_ar' => array_key_exists('nameAr', $data) ? trim((string) $data['nameAr']) : null,
            'name_en' => array_key_exists('nameEn', $data) ? trim((string) $data['nameEn']) : null,
            'note_ar' => array_key_exists('noteAr', $data) ? trim((string) $data['noteAr']) : null,
            'note_en' => array_key_exists('noteEn', $data) ? trim((string) $data['noteEn']) : null,
            'total_price' => array_key_exists('totalPrice', $data) ? (float) $data['totalPrice'] : null,
            'image_url' => array_key_exists('imageUrl', $data) ? trim((string) $data['imageUrl']) : null,
            'is_active' => array_key_exists('isActive', $data) ? $this->parseBool($data['isActive']) : null,
            'updated_at' => now(),
        ], fn ($v) => $v !== null));
        if (!empty($data['groups'])) {
            $this->replaceOfferGraph($id, $this->normalizeOfferSelectionRows($data['groups']));
        }
        return $this->ok($this->shapeOffers([DB::table('offers')->where('id', $id)->first()])[0] ?? null);
    }

    public function offersDestroy(int $id)
    {
        DB::table('offers')->where('id', $id)->delete();
        return $this->ok(true);
    }

    public function offersValidateSelection(Request $request, int $id)
    {
        $offer = DB::table('offers')->where('id', $id)->first();
        if (!$offer) return $this->error(404, 'Offer not found');
        $groups = $this->shapeOffers([$offer])[0]['groups'] ?? [];
        $selections = $request->input('selections', []);
        $selectionMap = [];
        foreach ($selections as $selection) {
            $selectionMap[(int) ($selection['groupId'] ?? 0)] = array_map('intval', $selection['productIds'] ?? []);
        }
        $fieldErrors = [];
        $total = (float) $offer->total_price;
        foreach ($groups as $group) {
            $selected = array_values(array_unique($selectionMap[$group['id']] ?? []));
            $min = $group['selectionMode'] === 'radio' ? 1 : (int) $group['minSelect'];
            $max = $group['selectionMode'] === 'radio' ? 1 : (int) $group['maxSelect'];
            if (count($selected) < $min || count($selected) > $max) {
                $fieldErrors['group_' . $group['id']] = ["Select between {$min} and {$max} items"];
                continue;
            }
            $allowed = collect($group['items'])->keyBy('productId');
            foreach ($selected as $productId) {
                if (!$allowed->has($productId)) {
                    $fieldErrors['group_' . $group['id']] = ['One or more selected products do not belong to this group'];
                    break;
                }
                $total += (float) ($allowed[$productId]['extraPrice'] ?? 0);
            }
        }
        if ($fieldErrors) {
            return $this->error(422, 'Validation failed', ['fieldErrors' => $fieldErrors]);
        }
        return $this->ok(['offerId' => (int) $offer->id, 'totalPrice' => round($total, 2)]);
    }

    public function branches()
    {
        return $this->ok(DB::table('branches')->orderBy('id')->get()->map(fn ($row) => $this->formatBranch($row))->all());
    }

    public function categoriesIndex(Request $request)
    {
        return $this->ok($this->selectCategories($this->normalizeScope($request->query('scope'))));
    }

    public function categoriesStore(Request $request)
    {
        $data = $request->validate([
            'nameAr' => ['nullable', 'string'],
            'nameEn' => ['nullable', 'string'],
            'sortOrder' => ['nullable', 'integer'],
            'isActive' => ['nullable'],
            'scope' => ['nullable', 'in:menu,studio'],
        ]);
        $id = DB::table('categories')->insertGetId([
            'name_ar' => trim((string) ($data['nameAr'] ?? '')) ?: trim((string) ($data['nameEn'] ?? '')) ?: 'قسم جديد',
            'name_en' => trim((string) ($data['nameEn'] ?? '')) ?: trim((string) ($data['nameAr'] ?? '')) ?: 'New Category',
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
            'is_active' => $this->parseBool($data['isActive'] ?? true),
            'scope' => $this->normalizeScope($data['scope'] ?? 'menu'),
        ]);
        $category = DB::table('categories')->select('id', 'name_ar as nameAr', 'name_en as nameEn', 'sort_order as sortOrder', 'is_active as isActive', 'scope')->where('id', $id)->first();
        $this->createAudit('create', 'Category', (string) $id, null, $category);
        return $this->ok($category);
    }

    public function categoriesUpdate(Request $request, int $id)
    {
        $data = $request->validate([
            'nameAr' => ['nullable', 'string'],
            'nameEn' => ['nullable', 'string'],
            'sortOrder' => ['nullable', 'integer'],
            'isActive' => ['nullable'],
            'scope' => ['nullable', 'in:menu,studio'],
        ]);
        $before = DB::table('categories')->where('id', $id)->first();
        DB::table('categories')->where('id', $id)->update(array_filter([
            'name_ar' => array_key_exists('nameAr', $data) ? ((trim((string) ($data['nameAr'] ?? '')) ?: null)) : null,
            'name_en' => array_key_exists('nameEn', $data) ? ((trim((string) ($data['nameEn'] ?? '')) ?: null)) : null,
            'sort_order' => $data['sortOrder'] ?? null,
            'is_active' => array_key_exists('isActive', $data) ? $this->parseBool($data['isActive']) : null,
            'scope' => $data['scope'] ?? null,
        ], fn ($v) => $v !== null));
        $category = DB::table('categories')->select('id', 'name_ar as nameAr', 'name_en as nameEn', 'sort_order as sortOrder', 'is_active as isActive', 'scope')->where('id', $id)->first();
        $this->createAudit('update', 'Category', (string) $id, $before, $category);
        return $this->ok($category);
    }

    public function categoriesDestroy(int $id)
    {
        $before = DB::table('categories')->where('id', $id)->first();
        $dependentProducts = DB::table('products')->where('category_id', $id)->count();
        if ($dependentProducts > 0) {
            return $this->error(409, 'There are products linked to this category', ['dependentProducts' => $dependentProducts, 'categoryId' => $id]);
        }
        DB::table('categories')->where('id', $id)->delete();
        $this->createAudit('delete', 'Category', (string) $id, $before, null);
        return $this->ok(true);
    }

    public function categoriesTransfer(Request $request, int $id)
    {
        $targetId = (int) $request->input('targetCategoryId');
        if (!$targetId) return $this->error(400, 'Target category is required');
        if ($id === $targetId) return $this->error(400, 'Target category must be different from source');
        $source = DB::table('categories')->where('id', $id)->first();
        $target = DB::table('categories')->where('id', $targetId)->first();
        if (!$source || !$target) return $this->error(404, 'Category not found');
        if ($source->scope !== $target->scope) return $this->error(400, 'Categories must belong to the same menu scope');
        $products = DB::table('products')->where('category_id', $id)->get();
        DB::table('products')->where('category_id', $id)->update(['category_id' => $targetId]);
        DB::table('categories')->where('id', $id)->delete();
        $this->createAudit('update', 'CategoryProducts', "{$id}->{$targetId}", ['category' => $source, 'products' => $products], ['sourceCategoryId' => $id, 'targetCategoryId' => $targetId, 'deletedSourceCategory' => true]);
        return $this->ok(true);
    }

    public function productsIndex(Request $request)
    {
        return $this->ok(array_map([$this, 'formatProduct'], $this->selectProducts($this->normalizeScope($request->query('scope')))));
    }

    public function productsStore(Request $request)
    {
        $data = $request->all();
        $categoryId = (int) ($data['categoryId'] ?? 0);
        if (!$categoryId) return $this->error(422, 'Category is required');
        $cover = trim((string) ($data['coverMediaUrl'] ?? ''));
        $coverUrl = $cover ?: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="%23111219"/><rect x="80" y="80" width="1040" height="740" rx="44" fill="%23181b24" stroke="%23d4af37" stroke-width="6"/><text x="600" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" fill="%23ffffff">Crevo</text></svg>';
        $id = DB::table('products')->insertGetId([
            'category_id' => $categoryId,
            'scope' => $this->normalizeScope($data['scope'] ?? 'menu'),
            'name_ar' => trim((string) ($data['nameAr'] ?? '')) ?: trim((string) ($data['nameEn'] ?? '')) ?: 'منتج جديد',
            'name_en' => trim((string) ($data['nameEn'] ?? '')) ?: trim((string) ($data['nameAr'] ?? '')) ?: 'New Product',
            'description_ar' => $data['descriptionAr'] ?? null,
            'description_en' => $data['descriptionEn'] ?? null,
            'media_type' => $data['mediaType'] ?? 'image',
            'cover_media_url' => $coverUrl,
            'gallery_urls' => json_encode(array_values(array_filter($data['galleryUrls'] ?? []))),
            'ingredients' => json_encode(array_values(array_filter($data['ingredients'] ?? []))),
            'tags' => json_encode(array_values($data['tags'] ?? [])),
            'allergens' => json_encode(array_values(array_filter($data['allergens'] ?? []))),
            'size_options' => json_encode(array_values($data['sizeOptions'] ?? [])),
            'side_dish_options' => json_encode(array_values($data['sideDishOptions'] ?? [])),
            'addon_options' => json_encode(array_values($data['addonOptions'] ?? [])),
            'custom_choice_groups' => json_encode(array_values($data['customChoiceGroups'] ?? [])),
            'price' => (float) ($data['price'] ?? 0),
            'calories' => $data['calories'] ?? null,
            'average_wait_time' => $data['averageWaitTime'] ?? null,
            'is_discounted' => $this->parseBool($data['isDiscounted'] ?? false),
            'discount_price' => isset($data['discountPrice']) && $data['discountPrice'] !== '' ? $data['discountPrice'] : null,
            'is_available' => $this->parseBool($data['isAvailable'] ?? true),
            'is_featured' => $this->parseBool($data['isFeatured'] ?? false),
            'sort_order' => (int) ($data['sortOrder'] ?? 0),
        ]);
        $saved = $this->formatProduct((array) DB::table('products')->where('id', $id)->first());
        $this->createAudit('create', 'Product', (string) $id, null, $saved);
        return $this->ok($saved);
    }

    public function productsUpdate(Request $request, int $id)
    {
        $data = $request->all();
        $before = DB::table('products')->where('id', $id)->first();
        if (!$before) return $this->error(404, 'Product not found');
        $update = [];
        foreach ([
            'category_id' => $data['categoryId'] ?? null,
            'scope' => $data['scope'] ?? null,
            'name_ar' => array_key_exists('nameAr', $data) ? (trim((string) ($data['nameAr'] ?? '')) ?: null) : null,
            'name_en' => array_key_exists('nameEn', $data) ? (trim((string) ($data['nameEn'] ?? '')) ?: null) : null,
            'description_ar' => array_key_exists('descriptionAr', $data) ? ($data['descriptionAr'] ?? null) : null,
            'description_en' => array_key_exists('descriptionEn', $data) ? ($data['descriptionEn'] ?? null) : null,
            'media_type' => $data['mediaType'] ?? null,
            'cover_media_url' => $data['coverMediaUrl'] ?? null,
            'gallery_urls' => array_key_exists('galleryUrls', $data) ? json_encode(array_values($data['galleryUrls'] ?? [])) : null,
            'ingredients' => array_key_exists('ingredients', $data) ? json_encode(array_values($data['ingredients'] ?? [])) : null,
            'tags' => array_key_exists('tags', $data) ? json_encode(array_values($data['tags'] ?? [])) : null,
            'allergens' => array_key_exists('allergens', $data) ? json_encode(array_values($data['allergens'] ?? [])) : null,
            'size_options' => array_key_exists('sizeOptions', $data) ? json_encode(array_values($data['sizeOptions'] ?? [])) : null,
            'side_dish_options' => array_key_exists('sideDishOptions', $data) ? json_encode(array_values($data['sideDishOptions'] ?? [])) : null,
            'addon_options' => array_key_exists('addonOptions', $data) ? json_encode(array_values($data['addonOptions'] ?? [])) : null,
            'custom_choice_groups' => array_key_exists('customChoiceGroups', $data) ? json_encode(array_values($data['customChoiceGroups'] ?? [])) : null,
            'price' => array_key_exists('price', $data) ? (float) $data['price'] : null,
            'calories' => array_key_exists('calories', $data) ? $data['calories'] : null,
            'average_wait_time' => array_key_exists('averageWaitTime', $data) ? $data['averageWaitTime'] : null,
            'is_discounted' => array_key_exists('isDiscounted', $data) ? $this->parseBool($data['isDiscounted']) : null,
            'discount_price' => array_key_exists('discountPrice', $data) ? ($data['discountPrice'] !== '' ? $data['discountPrice'] : null) : null,
            'is_available' => array_key_exists('isAvailable', $data) ? $this->parseBool($data['isAvailable']) : null,
            'is_featured' => array_key_exists('isFeatured', $data) ? $this->parseBool($data['isFeatured']) : null,
            'sort_order' => array_key_exists('sortOrder', $data) ? (int) $data['sortOrder'] : null,
        ] as $column => $value) {
            if ($value !== null) {
                $update[$column] = $value;
            }
        }
        DB::table('products')->where('id', $id)->update($update);
        $saved = $this->formatProduct((array) DB::table('products')->where('id', $id)->first());
        $this->createAudit('update', 'Product', (string) $id, $before, $saved);
        return $this->ok($saved);
    }

    public function productsDestroy(Request $request, int $id)
    {
        $before = DB::table('products')->where('id', $id)->first();
        if (!$before) return $this->error(404, 'Product not found');
        $force = in_array(strtolower((string) $request->query('force', 'false')), ['1', 'true', 'yes'], true);
        $count = DB::table('order_items')->where('product_id', $id)->count();
        if ($count > 0 && !$force) {
            return $this->error(409, 'لا يمكن حذف المنتج لأنه مرتبط بطلبات سابقة. يمكنك إلغاء تفعيله بدل الحذف.');
        }
        if ($count > 0) {
            DB::table('order_items')->where('product_id', $id)->delete();
        }
        DB::table('products')->where('id', $id)->delete();
        $this->createAudit('delete', 'Product', (string) $id, $before, null);
        return $this->ok(['deleted' => true, 'forced' => $force]);
    }

    public function tablesIndex()
    {
        return $this->ok(DB::table('tables')->orderBy('id')->get()->map(fn ($row) => $this->formatTable($row))->all());
    }

    public function tablesStore(Request $request)
    {
        $data = $request->all();
        $id = DB::table('tables')->insertGetId([
            'branch_id' => $data['branchId'] ?? null,
            'name' => $data['name'] ?? null,
            'table_number' => trim((string) ($data['tableNumber'] ?? '')),
            'qr_code_uuid' => (string) Str::uuid(),
            'table_color' => $data['tableColor'] ?? null,
            'current_phone' => null,
            'opened_at' => null,
            'invoice_requested_at' => null,
            'status' => $data['status'] ?? 'active',
            'created_at' => now(),
        ]);
        return $this->ok($this->formatTable(DB::table('tables')->where('id', $id)->first()));
    }

    public function tablesUpdate(Request $request, int $id)
    {
        $data = $request->all();
        DB::table('tables')->where('id', $id)->update(array_filter([
            'branch_id' => $data['branchId'] ?? null,
            'name' => $data['name'] ?? null,
            'table_number' => $data['tableNumber'] ?? null,
            'table_color' => $data['tableColor'] ?? null,
            'status' => $data['status'] ?? null,
        ], fn ($v) => $v !== null));
        return $this->ok($this->formatTable(DB::table('tables')->where('id', $id)->first()));
    }

    public function tablesDestroy(int $id)
    {
        DB::table('tables')->where('id', $id)->delete();
        return $this->ok(true);
    }

    public function tablesRotateQr(int $id)
    {
        DB::table('tables')->where('id', $id)->update(['qr_code_uuid' => (string) Str::uuid()]);
        return $this->ok($this->formatTable(DB::table('tables')->where('id', $id)->first()));
    }

    public function ordersIndex()
    {
        return $this->ok($this->selectOrders(false));
    }

    public function ordersPrevious()
    {
        return $this->ok(DB::table('archived_orders')->orderByDesc('archived_at')->get()->map(fn ($row) => (array) $row)->all());
    }

    public function ordersUpdateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,completed,cancelled'],
            'reason' => ['nullable', 'string'],
        ]);
        DB::table('orders')->where('id', $id)->update([
            'status' => $data['status'],
            'cancel_reason' => $data['status'] === 'cancelled' ? ($data['reason'] ?? null) : null,
            'updated_at' => now(),
        ]);
        return $this->ok(DB::table('orders')->where('id', $id)->first());
    }

    public function orderItemUpdateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,completed,cancelled'],
            'reason' => ['nullable', 'string'],
        ]);
        DB::table('order_items')->where('id', $id)->update([
            'status' => $data['status'],
            'cancel_reason' => $data['status'] === 'cancelled' ? ($data['reason'] ?? null) : null,
        ]);
        return $this->ok(true);
    }

    public function employeesIndex()
    {
        return $this->ok(
            DB::table('employees as e')
                ->leftJoin('branches as b', 'b.id', '=', 'e.branch_id')
                ->select(
                    'e.id',
                    'e.branch_id as branchId',
                    'e.full_name as fullName',
                    'e.phone',
                    'e.email',
                    'e.password_hash',
                    'e.role',
                    'e.is_active as isActive',
                    'e.created_at as createdAt',
                    'e.updated_at as updatedAt',
                    'b.id as branchIdJoin',
                    'b.name_ar as branch_name_ar',
                    'b.name_en as branch_name_en',
                    'b.code as branch_code',
                    'b.is_active as branch_is_active'
                )
                ->orderBy('e.id')
                ->get()
                ->map(function ($row) {
                    $branch = null;
                    if ($row->branchIdJoin !== null) {
                        $branch = [
                            'id' => (int) $row->branchIdJoin,
                            'nameAr' => (string) ($row->branch_name_ar ?? ''),
                            'nameEn' => (string) ($row->branch_name_en ?? ''),
                            'code' => (string) ($row->branch_code ?? ''),
                            'isActive' => (bool) ($row->branch_is_active ?? false),
                            'createdAt' => null,
                        ];
                    }

                    return [
                        'id' => (int) $row->id,
                        'branchId' => $row->branchId !== null ? (int) $row->branchId : null,
                        'fullName' => (string) $row->fullName,
                        'phone' => (string) ($row->phone ?? ''),
                        'email' => (string) ($row->email ?? ''),
                        'role' => $this->normalizeRoleForEmployee($row->role ?? 'waiter'),
                        'isActive' => (bool) $row->isActive,
                        'createdAt' => $row->createdAt,
                        'updatedAt' => $row->updatedAt,
                        'branch' => $branch,
                    ];
                })
                ->all()
        );
    }

    public function employeesStore(Request $request)
    {
        $data = $request->all();
        $fullName = trim((string) ($data['fullName'] ?? ''));
        $phone = trim((string) ($data['phone'] ?? ''));
        if ($fullName === '') return $this->error(422, 'Validation failed', ['fieldErrors' => ['fullName' => ['Required']]]);
        if ($phone === '') return $this->error(422, 'Validation failed', ['fieldErrors' => ['phone' => ['Required']]]);
        $id = DB::table('employees')->insertGetId([
            'branch_id' => $data['branchId'] ?? null,
            'full_name' => $fullName,
            'phone' => $phone,
            'email' => ($data['email'] ?? '') ?: null,
            'password_hash' => password_hash((string) $data['password'], PASSWORD_BCRYPT),
            'role' => $this->normalizeRoleForEmployee($data['role'] ?? 'waiter'),
            'is_active' => $this->parseBool($data['isActive'] ?? true),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $this->ok($this->formatEmployee(DB::table('employees')->where('id', $id)->first()));
    }

    public function employeesUpdate(Request $request, int $id)
    {
        $data = $request->all();
        $fullName = array_key_exists('fullName', $data) ? trim((string) ($data['fullName'] ?? '')) : null;
        $phone = array_key_exists('phone', $data) ? trim((string) ($data['phone'] ?? '')) : null;
        $update = array_filter([
            'branch_id' => $data['branchId'] ?? null,
            'full_name' => $fullName,
            'phone' => $phone,
            'email' => array_key_exists('email', $data) ? (($data['email'] ?? '') ?: null) : null,
            'role' => isset($data['role']) ? $this->normalizeRoleForEmployee($data['role']) : null,
            'is_active' => array_key_exists('isActive', $data) ? $this->parseBool($data['isActive']) : null,
            'updated_at' => now(),
        ], fn ($v) => $v !== null);
        if (!empty($data['password'])) {
            $update['password_hash'] = password_hash((string) $data['password'], PASSWORD_BCRYPT);
        }
        DB::table('employees')->where('id', $id)->update($update);
        return $this->ok($this->formatEmployee(DB::table('employees')->where('id', $id)->first()));
    }

    public function employeesDestroy(int $id)
    {
        DB::table('employees')->where('id', $id)->delete();
        return $this->ok(true);
    }

    private function normalizeRoleForEmployee(mixed $role): string
    {
        $role = strtolower(trim((string) $role));
        return $role === 'seller' ? 'cashier' : ($role ?: 'waiter');
    }

    public function vipCustomersIndex()
    {
        return $this->ok(DB::table('vip_customer_visits')->orderByDesc('last_visit_at')->get()->map(fn ($row) => (array) $row)->all());
    }

    public function vipCustomersReset()
    {
        DB::table('vip_customer_visits')->update([
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
        return $this->ok(true);
    }

    public function vipSummary(Request $request)
    {
        $phone = trim((string) $request->query('phone', ''));
        if ($phone === '') return $this->ok(null);
        $visit = DB::table('vip_customer_visits')->where('phone', $phone)->first();
        return $this->ok($visit ? (array) $visit : null);
    }

    public function waiterCallsIndex()
    {
        return $this->ok(DB::table('waiter_calls')->orderByDesc('created_at')->get()->map(fn ($row) => (array) $row)->all());
    }

    public function waiterCallsAcknowledge(int $id)
    {
        DB::table('waiter_calls')->where('id', $id)->update(['status' => 'acknowledged', 'responded_at' => now()]);
        return $this->ok(true);
    }

    public function waiterCallsComplete(int $id)
    {
        DB::table('waiter_calls')->where('id', $id)->update(['status' => 'completed', 'responded_at' => now()]);
        return $this->ok(true);
    }

    public function customerReviewsIndex()
    {
        $rows = DB::table('customer_reviews')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($row) {
                $table = DB::table('tables')->where('id', $row->table_id)->first();
                return [
                    'id' => (int) $row->id,
                    'tableId' => $row->table_id,
                    'tableUuid' => $row->table_uuid,
                    'sessionUuid' => $row->session_uuid,
                    'tableNumber' => $row->table_number,
                    'tableColor' => $row->table_color,
                    'phone' => $row->phone,
                    'customerName' => $row->customer_name,
                    'ratingMode' => $row->rating_mode,
                    'ratingValue' => (int) $row->rating_value,
                    'comment' => $row->comment,
                    'createdAt' => $row->created_at,
                    'tableStatus' => $table?->status,
                ];
            })
            ->all();

        return $this->ok($rows);
    }

    public function waiterComplaintsIndex()
    {
        return $this->ok(DB::table('waiter_complaints')->orderByDesc('created_at')->get()->map(fn ($row) => (array) $row)->all());
    }

    public function waiterComplaintsStore(Request $request)
    {
        $data = $request->validate(['tableNumber' => ['required', 'string'], 'complaint' => ['required', 'string']]);
        $id = DB::table('waiter_complaints')->insertGetId([
            'table_number' => $data['tableNumber'],
            'complaint' => $data['complaint'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $this->ok(DB::table('waiter_complaints')->where('id', $id)->first());
    }

    public function waiterComplaintsUpdate(Request $request, int $id)
    {
        $data = $request->validate(['tableNumber' => ['nullable', 'string'], 'complaint' => ['nullable', 'string']]);
        DB::table('waiter_complaints')->where('id', $id)->update(array_filter([
            'table_number' => $data['tableNumber'] ?? null,
            'complaint' => $data['complaint'] ?? null,
            'updated_at' => now(),
        ], fn ($v) => $v !== null));
        return $this->ok(DB::table('waiter_complaints')->where('id', $id)->first());
    }

    public function waiterComplaintsDestroy(int $id)
    {
        DB::table('waiter_complaints')->where('id', $id)->delete();
        return $this->ok(true);
    }

    public function reportSchedulesIndex()
    {
        return $this->ok(DB::table('report_schedules')->orderByDesc('created_at')->get()->map(fn ($row) => (array) $row)->all());
    }

    public function reportSchedulesStore(Request $request)
    {
        $data = $request->all();
        $id = DB::table('report_schedules')->insertGetId([
            'branch_id' => $data['branchId'] ?? null,
            'name' => $data['name'],
            'frequency' => $data['frequency'],
            'delivery_type' => $data['deliveryType'],
            'recipient' => $data['recipient'],
            'is_active' => $this->parseBool($data['isActive'] ?? true),
            'next_run_at' => $data['nextRunAt'] ?? null,
            'last_run_at' => $data['lastRunAt'] ?? null,
            'created_at' => now(),
        ]);
        return $this->ok(DB::table('report_schedules')->where('id', $id)->first());
    }

    public function reportSchedulesUpdate(Request $request, int $id)
    {
        $data = $request->all();
        DB::table('report_schedules')->where('id', $id)->update(array_filter([
            'branch_id' => $data['branchId'] ?? null,
            'name' => $data['name'] ?? null,
            'frequency' => $data['frequency'] ?? null,
            'delivery_type' => $data['deliveryType'] ?? null,
            'recipient' => $data['recipient'] ?? null,
            'is_active' => array_key_exists('isActive', $data) ? $this->parseBool($data['isActive']) : null,
            'next_run_at' => $data['nextRunAt'] ?? null,
            'last_run_at' => $data['lastRunAt'] ?? null,
        ], fn ($v) => $v !== null));
        return $this->ok(DB::table('report_schedules')->where('id', $id)->first());
    }

    public function reportSchedulesDestroy(int $id)
    {
        DB::table('report_schedules')->where('id', $id)->delete();
        return $this->ok(true);
    }

    public function refreshReports()
    {
        return $this->ok(['refreshed' => true]);
    }

    public function topProducts(Request $request)
    {
        return $this->ok(DB::table('order_items as oi')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->join('products as p', 'p.id', '=', 'oi.product_id')
            ->selectRaw('p.id, p.name_en, SUM(oi.quantity) as total_quantity')
            ->whereBetween('o.created_at', [$request->query('from'), $request->query('to')])
            ->where('o.status', '<>', 'cancelled')
            ->groupBy('p.id', 'p.name_en')
            ->orderByDesc('total_quantity')
            ->limit(10)
            ->get());
    }

    public function peakHours(Request $request)
    {
        return $this->ok(DB::table('orders')
            ->selectRaw('HOUR(created_at) as hour_of_day, COUNT(*) as order_count, COALESCE(SUM(total_amount),0) as gross_sales')
            ->whereBetween('created_at', [$request->query('from'), $request->query('to')])
            ->where('status', '<>', 'cancelled')
            ->groupByRaw('HOUR(created_at)')
            ->orderBy('hour_of_day')
            ->get());
    }

    public function revenue(Request $request)
    {
        return $this->ok(DB::table('orders')
            ->selectRaw('DATE(created_at) as period, COALESCE(SUM(total_amount),0) as gross_sales, ROUND(AVG(total_amount),2) as average_order_value, COUNT(*) as order_count')
            ->whereBetween('created_at', [$request->query('from'), $request->query('to')])
            ->where('status', '<>', 'cancelled')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('period')
            ->get());
    }
}
