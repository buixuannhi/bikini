<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory,SoftDeletes;

    protected $table = 'category';
    protected $dates=['deleted_at'];
    protected $fillable = ['name','status'];
    
    public function prods()
    {
        return $this->hasMany(Product::class,'category_id','id');
    }
    function ScopeSearch($query){
        if($key=request()->key){
            $query=$query->where('name','like','%'.$key.'%');
            }
            return $query;  
    }
}
