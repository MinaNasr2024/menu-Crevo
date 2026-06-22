<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfferGroup extends Model
{
    protected $table = 'offer_groups';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'offer_id' => 'integer',
        'min_select' => 'integer',
        'max_select' => 'integer',
        'sort_order' => 'integer',
        'required' => 'boolean',
    ];
}
