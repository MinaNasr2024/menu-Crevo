<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VipCustomerVisit extends Model
{
    protected $table = 'vip_customer_visits';
    public $timestamps = true;
    protected $guarded = [];

    protected $casts = [
        'visit_count' => 'integer',
        'amount_total' => 'decimal:2',
        'reward_visit_count' => 'integer',
        'last_table_id' => 'integer',
        'last_branch_id' => 'integer',
        'reward_awarded_at' => 'datetime',
        'reward_consumed_at' => 'datetime',
        'last_visit_at' => 'datetime',
    ];
}
