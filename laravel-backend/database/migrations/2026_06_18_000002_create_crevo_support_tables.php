<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->string('name_ar');
            $table->string('name_en');
            $table->text('note_ar')->default('');
            $table->text('note_en')->default('');
            $table->decimal('total_price', 10, 2)->default(0);
            $table->text('image_url')->default('');
            $table->boolean('is_active')->default(true);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->index(['is_active', 'id']);
        });

        Schema::create('offer_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('offer_id')->constrained('offers')->cascadeOnDelete();
            $table->text('title_ar');
            $table->text('title_en');
            $table->string('selection_mode')->default('checkbox');
            $table->integer('min_select')->default(1);
            $table->integer('max_select')->default(1);
            $table->integer('sort_order')->default(0);
            $table->boolean('required')->default(false);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->index(['offer_id', 'sort_order', 'id']);
        });

        Schema::create('offer_group_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('group_id')->constrained('offer_groups')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->decimal('extra_price', 10, 2)->default(0);
            $table->boolean('include_product_options')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->unique(['group_id', 'product_id']);
            $table->index(['group_id', 'sort_order', 'id']);
        });

        Schema::create('waiter_complaints', function (Blueprint $table) {
            $table->id();
            $table->string('table_number');
            $table->text('complaint');
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->index(['created_at', 'id']);
        });

        Schema::create('customer_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->string('table_uuid');
            $table->string('session_uuid')->nullable();
            $table->string('table_number');
            $table->string('table_color')->nullable();
            $table->string('phone');
            $table->string('customer_name');
            $table->string('rating_mode');
            $table->integer('rating_value');
            $table->text('comment')->default('');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['table_id', 'phone', 'created_at']);
        });

        Schema::create('vip_customer_visits', function (Blueprint $table) {
            $table->id();
            $table->string('phone')->unique();
            $table->integer('visit_count')->default(0);
            $table->decimal('amount_total', 10, 2)->default(0);
            $table->string('reward_status')->default('available');
            $table->integer('reward_visit_count')->default(0);
            $table->string('reward_session_uuid')->nullable();
            $table->timestamp('reward_awarded_at')->nullable();
            $table->timestamp('reward_consumed_at')->nullable();
            $table->string('reward_consumed_session_uuid')->nullable();
            $table->foreignId('last_table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->string('last_table_number')->nullable();
            $table->foreignId('last_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->timestamp('last_visit_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
            $table->index(['visit_count', 'last_visit_at']);
            $table->index(['reward_visit_count', 'last_visit_at']);
        });

        Schema::create('archived_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('order_id')->unique();
            $table->foreignId('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->string('table_number')->nullable();
            $table->string('table_color')->nullable();
            $table->string('session_uuid')->nullable();
            $table->integer('order_number')->nullable();
            $table->string('status')->nullable();
            $table->string('source')->nullable();
            $table->decimal('total_amount', 10, 2)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('archived_at')->useCurrent();
            $table->json('payload');
            $table->index(['session_uuid', 'archived_at', 'order_id']);
            $table->index(['table_id', 'archived_at', 'order_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archived_orders');
        Schema::dropIfExists('vip_customer_visits');
        Schema::dropIfExists('customer_reviews');
        Schema::dropIfExists('waiter_complaints');
        Schema::dropIfExists('offer_group_products');
        Schema::dropIfExists('offer_groups');
        Schema::dropIfExists('offers');
    }
};
