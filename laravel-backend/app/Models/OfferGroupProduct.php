<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfferGroupProduct extends Model
{
    protected $table = 'offer_group_products';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'group_id' => 'integer',
        'product_id' => 'integer',
        'extra_price' => 'decimal:2',
        'include_product_options' => 'boolean',
        'sort_order' => 'integer',
    ];
}
