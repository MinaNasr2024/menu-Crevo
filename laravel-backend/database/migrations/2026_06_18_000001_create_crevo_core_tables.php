<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('name_ar');
            $table->string('name_en');
            $table->string('code')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('full_name');
            $table->string('phone')->nullable()->unique();
            $table->string('email')->nullable()->unique();
            $table->string('password_hash');
            $table->string('role')->default('waiter');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('status');
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('checked_out_at')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('full_name')->nullable();
            $table->string('phone')->nullable()->unique();
            $table->string('email')->nullable()->unique();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('name')->nullable();
            $table->string('table_number')->unique();
            $table->string('qr_code_uuid')->unique();
            $table->string('table_color')->nullable();
            $table->string('current_phone')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('invoice_requested_at')->nullable();
            $table->string('status')->default('active');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name_ar');
            $table->string('name_en');
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('scope')->default('menu');
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('categories')->restrictOnDelete();
            $table->string('name_ar');
            $table->string('name_en');
            $table->text('description_ar')->nullable();
            $table->text('description_en')->nullable();
            $table->string('media_type');
            $table->string('cover_media_url');
            $table->json('gallery_urls');
            $table->json('ingredients');
            $table->json('tags');
            $table->json('allergens');
            $table->json('size_options')->nullable();
            $table->json('side_dish_options')->nullable();
            $table->json('addon_options')->nullable();
            $table->json('custom_choice_groups')->nullable();
            $table->decimal('price', 10, 2);
            $table->integer('calories')->nullable();
            $table->integer('average_wait_time')->nullable();
            $table->boolean('is_discounted')->default(false);
            $table->decimal('discount_price', 10, 2)->nullable();
            $table->boolean('is_available')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->integer('sort_order')->default(0);
            $table->string('scope')->default('menu');
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_id')->constrained('tables')->restrictOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('waiter_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->decimal('total_amount', 10, 2);
            $table->string('status')->default('pending');
            $table->string('source')->default('qr');
            $table->integer('order_number')->nullable();
            $table->text('cancel_reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->index(['table_id', 'created_at']);
            $table->index(['branch_id', 'created_at']);
            $table->index(['status']);
            $table->index(['customer_id']);
            $table->index(['waiter_id']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->unsignedBigInteger('offer_id')->nullable();
            $table->integer('quantity');
            $table->decimal('price_at_sale', 10, 2);
            $table->string('item_type')->default('product');
            $table->string('display_name_ar')->nullable();
            $table->string('display_name_en')->nullable();
            $table->string('display_image_url')->nullable();
            $table->json('selected_options')->nullable();
            $table->index(['order_id']);
            $table->index(['product_id']);
        });

        Schema::create('waiter_calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_id')->constrained('tables')->restrictOnDelete();
            $table->foreignId('waiter_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('status')->default('pending');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('responded_at')->nullable();
            $table->index(['table_id', 'status', 'created_at']);
        });

        Schema::create('qr_scans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('table_id')->constrained('tables')->cascadeOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->timestamp('scanned_at')->useCurrent();
        });

        Schema::create('product_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->timestamp('viewed_at')->useCurrent();
        });

        Schema::create('product_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('reaction');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['branch_id', 'created_at']);
            $table->index(['table_id', 'created_at']);
            $table->index(['customer_id', 'created_at']);
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('product_id')->unique()->constrained('products')->cascadeOnDelete();
            $table->integer('stock_level')->default(0);
            $table->integer('low_stock_threshold')->default(10);
            $table->integer('wasted_quantity')->default(0);
            $table->integer('expired_quantity')->default(0);
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('category');
            $table->decimal('amount', 10, 2);
            $table->timestamp('expense_date');
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->string('actor_type')->default('system');
            $table->string('action');
            $table->string('entity_type');
            $table->string('entity_id');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('report_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('name');
            $table->string('frequency');
            $table->string('delivery_type');
            $table->string('recipient');
            $table->boolean('is_active')->default(true);
            $table->timestamp('next_run_at')->nullable();
            $table->timestamp('last_run_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('site_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->json('value');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_settings');
        Schema::dropIfExists('report_schedules');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('product_reactions');
        Schema::dropIfExists('product_views');
        Schema::dropIfExists('qr_scans');
        Schema::dropIfExists('waiter_calls');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('tables');
        Schema::dropIfExists('customers');
        Schema::dropIfExists('attendance_logs');
        Schema::dropIfExists('employees');
        Schema::dropIfExists('branches');
    }
};
