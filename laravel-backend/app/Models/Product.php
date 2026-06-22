<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $table = 'products';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'category_id' => 'integer',
        'gallery_urls' => 'array',
        'ingredients' => 'array',
        'tags' => 'array',
        'allergens' => 'array',
        'size_options' => 'array',
        'side_dish_options' => 'array',
        'addon_options' => 'array',
        'custom_choice_groups' => 'array',
        'price' => 'decimal:2',
        'calories' => 'integer',
        'average_wait_time' => 'integer',
        'is_discounted' => 'boolean',
        'discount_price' => 'decimal:2',
        'is_available' => 'boolean',
        'is_featured' => 'boolean',
        'sort_order' => 'integer',
    ];
}
