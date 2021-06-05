@extends('layouts.admin')
@section('title', 'Danh mục đã xóa')
@section('main')


<table class="table table-hover">
    <thead>
        <tr>
            <th>Id</th>
            <th>Name</th>
            <th>Status</th>
            <th>deleted at</th>
            <th class="text-right">hoạt động</th>
        </tr>
    </thead>
    <tbody>
        @foreach($data as $model)
        <tr>
            <td>{{$model->id}}</td>
            <td>{{$model->name}}</td>
            <td>{{$model->status == 0 ? 'Ẩn' : 'Hiển thị'}}</td>
            <td>{{$model->deleted_at->format('d-m-Y')}}</td>
            <td class="text-right">
            <form action="{{route('category.forcedelete',$model->id)}}" method="POST">
                @csrf @method('DELETE')          
                <a href="{{route('category.edit',$model->id)}}" class="btn btn-primary btn-sm" title="Sửa"><i class="fas fa-edit"></i></a>
                <a href="{{route('category.restore',$model->id)}}" class="btn btn-primary btn-sm" title="khôi phục"><i class="fas fa-sync-alt"></i></a>
                <button  class="btn btn-danger btn-delete btn-sm" title="Xóa bỏ" onclick="return confirm('bạn có chắc muốn xóa ?!')"><i class="fas fa-trash"></i></button>
            
            </form>
            </td>
        </tr>
        @endforeach
    </tbody>
</table>
<hr>

<div class="d-flex justify-content-center">
{{ $data->appends(request()->all())->links() }}
</div>
@stop()

@section('js')
@stop()