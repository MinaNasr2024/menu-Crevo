<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\OrderItem;

class Order extends Model
{
    protected $table = 'orders';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'table_id' => 'integer',
        'branch_id' => 'integer',
        'customer_id' => 'integer',
        'waiter_id' => 'integer',
        'total_amount' => 'decimal:2',
        'order_number' => 'integer',
    ];

    public function items()
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }
}
