<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Offer extends Model
{
    protected $table = 'offers';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'total_price' => 'decimal:2',
        'is_active' => 'boolean',
    ];
}
