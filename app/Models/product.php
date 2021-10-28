<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class product extends Model
{
    use HasFactory;
    protected $table = 'products';
    protected $fillable=['name','image','images_list','price','price_sale','description','category_id','brand_id','status'];

    public function cats(){
        return $this->belongsTo(Category::class, 'category_id');
    }
    public function ScopeSearch($query){
        if($key=request()->key){
            $query=$query->where('name','like','%'.$key.'%');
        }
        return $query;
    }
}
