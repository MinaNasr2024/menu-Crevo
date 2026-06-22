<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\BiController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\SiteSettingsController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\LegacyProxyController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/public/site-settings', [SiteSettingsController::class, 'show']);
Route::put('/admin/site-settings', [SiteSettingsController::class, 'update'])
    ->middleware('admin.token');

Route::get('/public/menu', [PublicController::class, 'menu']);
Route::get('/public/offers', [PublicController::class, 'offers']);
Route::get('/public/table/resolve', [PublicController::class, 'resolveTable']);
Route::get('/public/qr/{uuid}', [PublicController::class, 'qr']);
Route::post('/public/table/open', [PublicController::class, 'openTable']);
Route::post('/public/table/close', [PublicController::class, 'closeTable']);
Route::post('/public/orders', [PublicController::class, 'placeOrder']);
Route::post('/public/invoice-requests', [PublicController::class, 'requestInvoice']);
Route::post('/public/invoice-request', [PublicController::class, 'requestInvoice']);
Route::post('/public/request-invoice', [PublicController::class, 'requestInvoice']);
Route::post('/public/customer-reviews', [PublicController::class, 'customerReviews']);
Route::post('/public/waiter-calls', [PublicController::class, 'callWaiter']);
Route::post('/public/product-views', [PublicController::class, 'productViews']);

Route::post('/admin/uploads', [UploadController::class, 'store'])->middleware('admin.token');

Route::middleware('admin.token')->prefix('/admin')->group(function () {
    Route::get('/dashboard/summary', [AdminController::class, 'summary']);
    Route::get('/branches', [AdminController::class, 'branches']);
    Route::get('/categories', [AdminController::class, 'categoriesIndex']);
    Route::post('/categories', [AdminController::class, 'categoriesStore']);
    Route::patch('/categories/{id}', [AdminController::class, 'categoriesUpdate']);
    Route::delete('/categories/{id}', [AdminController::class, 'categoriesDestroy']);
    Route::post('/categories/{id}/transfer-products', [AdminController::class, 'categoriesTransfer']);
    Route::get('/products', [AdminController::class, 'productsIndex']);
    Route::post('/products', [AdminController::class, 'productsStore']);
    Route::patch('/products/{id}', [AdminController::class, 'productsUpdate']);
    Route::delete('/products/{id}', [AdminController::class, 'productsDestroy']);
    Route::get('/offers', [AdminController::class, 'offersIndex']);
    Route::post('/offers', [AdminController::class, 'offersStore']);
    Route::patch('/offers/{id}', [AdminController::class, 'offersUpdate']);
    Route::delete('/offers/{id}', [AdminController::class, 'offersDestroy']);
    Route::post('/offers/{id}/validate-selection', [AdminController::class, 'offersValidateSelection']);
    Route::get('/orders', [AdminController::class, 'ordersIndex']);
    Route::get('/orders/previous', [AdminController::class, 'ordersPrevious']);
    Route::patch('/orders/{id}/status', [AdminController::class, 'ordersUpdateStatus']);
    Route::patch('/order-items/{id}/status', [AdminController::class, 'orderItemUpdateStatus']);
    Route::get('/customer-reviews', [AdminController::class, 'customerReviewsIndex']);
    Route::get('/employees', [AdminController::class, 'employeesIndex']);
    Route::post('/employees', [AdminController::class, 'employeesStore']);
    Route::patch('/employees/{id}', [AdminController::class, 'employeesUpdate']);
    Route::delete('/employees/{id}', [AdminController::class, 'employeesDestroy']);
    Route::get('/tables', [AdminController::class, 'tablesIndex']);
    Route::post('/tables', [AdminController::class, 'tablesStore']);
    Route::patch('/tables/{id}', [AdminController::class, 'tablesUpdate']);
    Route::delete('/tables/{id}', [AdminController::class, 'tablesDestroy']);
    Route::post('/tables/{id}/rotate-qr', [AdminController::class, 'tablesRotateQr']);
    Route::get('/vip-customers', [AdminController::class, 'vipCustomersIndex']);
    Route::post('/vip-customers/reset', [AdminController::class, 'vipCustomersReset']);
    Route::get('/vip-summary', [AdminController::class, 'vipSummary']);
    Route::get('/waiter-calls', [AdminController::class, 'waiterCallsIndex']);
    Route::post('/waiter-calls/{id}/acknowledge', [AdminController::class, 'waiterCallsAcknowledge']);
    Route::post('/waiter-calls/{id}/complete', [AdminController::class, 'waiterCallsComplete']);
    Route::get('/waiter-complaints', [AdminController::class, 'waiterComplaintsIndex']);
    Route::post('/waiter-complaints', [AdminController::class, 'waiterComplaintsStore']);
    Route::patch('/waiter-complaints/{id}', [AdminController::class, 'waiterComplaintsUpdate']);
    Route::delete('/waiter-complaints/{id}', [AdminController::class, 'waiterComplaintsDestroy']);
    Route::get('/report-schedules', [AdminController::class, 'reportSchedulesIndex']);
    Route::post('/report-schedules', [AdminController::class, 'reportSchedulesStore']);
    Route::patch('/report-schedules/{id}', [AdminController::class, 'reportSchedulesUpdate']);
    Route::delete('/report-schedules/{id}', [AdminController::class, 'reportSchedulesDestroy']);
    Route::post('/reports/refresh', [AdminController::class, 'refreshReports']);
    Route::get('/analytics/top-products', [AdminController::class, 'topProducts']);
    Route::get('/analytics/peak-hours', [AdminController::class, 'peakHours']);
    Route::get('/analytics/revenue', [AdminController::class, 'revenue']);
});

Route::middleware('admin.token')->prefix('/bi')->group(function () {
    Route::get('/executive', [BiController::class, 'executive']);
    Route::get('/sales', [BiController::class, 'sales']);
    Route::get('/products', [BiController::class, 'products']);
    Route::get('/categories', [BiController::class, 'categories']);
    Route::get('/branches', [BiController::class, 'branches']);
    Route::get('/tables', [BiController::class, 'tables']);
    Route::get('/waiters', [BiController::class, 'waiters']);
    Route::get('/employees', [BiController::class, 'employees']);
    Route::get('/customers', [BiController::class, 'customers']);
    Route::get('/time', [BiController::class, 'time']);
    Route::get('/offers', [BiController::class, 'offers']);
    Route::get('/inventory', [BiController::class, 'inventory']);
    Route::get('/expenses', [BiController::class, 'expenses']);
    Route::get('/financial', [BiController::class, 'financial']);
    Route::get('/audit', [BiController::class, 'audit']);
    Route::get('/export/{report}', [BiController::class, 'export']);
});

Route::any('{path?}', [LegacyProxyController::class, 'api'])
    ->where('path', '.*');
