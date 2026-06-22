<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Table extends Model
{
    protected $table = 'tables';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'branch_id' => 'integer',
        'opened_at' => 'datetime',
        'invoice_requested_at' => 'datetime',
    ];
}
