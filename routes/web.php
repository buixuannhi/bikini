<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::group(['prefix' => ''], function(){
    Route::get('/','HomeController@index')->name('home.index');
});


Route::group(['prefix' => 'admin','namespace'=>'Admin'], function(){
    Route::get('/','AdminController@index')->name('admin.index');
    Route::get('/file','AdminController@file')->name('admin.file');
    //category
    Route::get('/category/trushed','CategoryController@trushed')->name('category.trushed');
    Route::get('/category/restore/{id}','CategoryController@restore')->name('category.restore');
    Route::delete('/category/forcedelete/{id}','CategoryController@forcedelete')->name('category.forcedelete');
    Route::delete('/category/DeleteAll/','CategoryController@DeleteAll')->name('category.DeleteAll');


    Route::resources([
        'category' => 'CategoryController',
        'product' => 'ProductController'
    ]);
    
});