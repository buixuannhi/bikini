<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        if($request->cc){
            $a =$request->cc;
        }else $a=3;

        $data = Category::orderBy('id', 'DESC')->search()->paginate($a);
        return view('Admin.Category.index', compact('data'));
    }

    public function trushed()
    {
        $data = Category::orderBy('id', 'DESC')->onlyTrashed()->paginate(3);
        return view('admin.category.trushed', compact('data'));
    }

    public function restore($id)
    {
        $category = Category::withTrashed()->find($id);
        if ($category) {
            $category->restore();
            return redirect()->route('category.index')->with('yes', 'Khôi phục thành công');
        }
        return redirect()->route('category.index')->with('no', 'Khôi phục không thành công');
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        return view('Admin.Category.create');
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|unique:categories',
        ], [
            'name.required' => 'Tên danh mục không để trống',
            'name.unique' => 'Tên danh mục này đã được sử dụng',
        ]);

        $request->offsetUnset('_token');
        // $request->merge(['image' => 'link img','link' => 'link href']);
        if (Category::create($request->all())) {
            return redirect()->route('category.index')->with('yes', 'Thêm mới thành công');
        }

        return redirect()->back()->with('no', 'Thêm mới không thành công');
    }

    /**
     * Display the specified resource.
     *
     * @param \App\Models\Category $category
     * @return \Illuminate\Http\Response
     */
    public function show(Category $category)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param \App\Models\Category $category
     * @return \Illuminate\Http\Response
     */
    public function edit(Category $category)
    {
        return view('Admin.Category.edit', compact('category'));
    }

    /**
     * Update the specified resource in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @param \App\Models\Category $category
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Category $category)
    {
        $data = $request->only('name', 'status');
        if ($category->update($data)) {
            return redirect()->route('category.index')->with('yes', 'Sửa danh mục thành công');
        }

        return redirect()->back()->with('no', 'Sửa danh mục không thành công');

    }

    /**
     * Remove the specified resource from storage.
     *
     * @param \App\Models\Category $category
     * @return \Illuminate\Http\Response
     */
    public function destroy(Category $category)
    {
        if ($category->prods->count() == 0) {
            $category->delete();
            return redirect()->route('category.index')->with('yes', 'Xóa thành công');
        }
        return redirect()->route('category.index')->with('no', 'Xóa không thành công');

    }

    public function forcedelete($id)
    {
        $category = Category::withTrashed()->find($id);
        if ($category) {
            $category->forceDelete();
            return redirect()->route('category.trushed')->with('yes', 'Xóa vĩnh thành công');
        }
        return redirect()->route('category.trushed')->with('no', 'Xóa không thành công');
    }

    public function DeleteAll(request $request)
    {
        $a = 0;
        foreach ($request->id as $id) {
            $category = Category::find($id);
            if ($category->prods->count() == 0) {
                $category->delete();
                $a++;

            }
        }
        if ($a > 0) {
            return redirect()->route('category.index')->with('yes', 'Xóa thành công' . $a . 'bản ghi');
        }

        return redirect()->route('category.index')->with('no', 'Không có bản ghi nào được xóa');
    }


}
