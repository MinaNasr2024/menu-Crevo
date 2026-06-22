<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $table = 'order_items';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'order_id' => 'integer',
        'product_id' => 'integer',
        'offer_id' => 'integer',
        'quantity' => 'integer',
        'price_at_sale' => 'decimal:2',
        'selected_options' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }
}
