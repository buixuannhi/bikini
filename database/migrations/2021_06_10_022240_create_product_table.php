<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateProductTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name','100')->unique();
            $table->string('image');
            $table->text('images_list')->nullable();
            $table->integer('price');
            $table->integer('price_sale')->default(0)->nullable();
            $table->text('description')->nullable();
            $table->integer('category_id');
            $table->integer('brand_id')->nullable();
            $table->tinyInteger('status')->comment('0 là ẩn, 1 là hiện');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('products');
    }
}
