<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WaiterComplaint extends Model
{
    protected $table = 'waiter_complaints';
    public $timestamps = true;
    protected $guarded = [];
}
