@extends('layouts.admin')
@section('title', 'Chỉnh sửa danh mục: '.$category->name)
@section('main')

<form class="form-horizontal" action="{{route('category.update', $category->id)}}" method="POST">
    @csrf  @method('PUT')
    <div class="card-body">
        <div class="form-group row">
            <label for="inputEmail3" class="col-sm-2 col-form-label">Tên danh mục</label>
            <div class="col-sm-10">
                <input class="form-control" name="name" value="{{$category->name}}">
                @error('name')
                <small class="help-block text-danger">{{$message}}</small>
                @enderror
            </div>
        </div>
        <div class="form-group row">
            <label for="inputEmail3" class="col-sm-2 col-form-label">Trạng thái danh mục</label>
            <div class="col-sm-10">
                <div class="form-check">
                    <input type="radio" class="form-check-input" name="status" id="status0" value="0" {{$category->status == 0 ? 'checked' : ''}}>
                    <label class="form-check-label" for="status0">Ẩn</label>
                </div>
                <div class="form-check">
                    <input type="radio" class="form-check-input" name="status" id="status1" value="1" {{$category->status == 1 ? 'checked' : ''}}>
                    <label class="form-check-label" for="status1">Hiển thị</label>
                </div>
            </div>
        </div>
        <div class="form-group row">
            <div class="offset-sm-2 col-sm-10">
                <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Lưu lại</button>
                <button type="reset" class="btn btn-danger">làm mới</button>
            </div>
        </div>
    </div>

</form>
@stop()