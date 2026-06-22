<?php

use App\Http\Controllers\Api\PublicController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::any('/qr/{uuid}', [PublicController::class, 'qr'])->whereUuid('uuid');
