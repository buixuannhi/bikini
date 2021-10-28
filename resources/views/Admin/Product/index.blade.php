@extends('layouts.admin')
@section('title', 'Quản lý sản phẩm ')
@section('main')

    <form action="" method="get" class="form-inline" role="form">

        <div class="form-group">
            <label class="sr-only" for="">label</label>
            <input type="text" class="form-control" name="key" placeholder="Input field">
        </div>
        <button type="submit" class="btn btn-primary mr-2"><i class="fas fa-search"></i></button>
        <a href="{{route('product.create')}}" class="btn btn-success"><i class="fas fa-plus"></i>Thêm mới</a>
    </form>

    <hr>
    <form action="" method="POST">
        <button type="submit" class="btn btn-primary mr-2"><i class="fas fa-trash"></i></button>
        @csrf @method("DELETE")
        <table class="table table-hover">
            <thead>
            <tr>
                <th>
                    <input type="checkbox" id="checkall">
                </th>
                <th>Id</th>
                <th>Name</th>

                <th>Status</th>
                <th>Created at</th>
                <th>Total Product</th>
                <th class="text-right">hoạt động</th>
            </tr>
            </thead>
            <tbody>
            @foreach($data as $model)
                <tr>
                    <td>
                        <input type="checkbox" name="id[]" value="{{$model->id}}" class="check-item">
                    </td>
                    <td>{{$model->id}}</td>
                    <td>{{$model->cats->name}}</td>
                    <td>{{$model->status == 0 ? 'Ẩn' : 'Hiển thị'}}</td>
                    <td>{{$model->created_at}}</td>
                    <td class="text-right">
                        <a href="{{route('product.edit',$model->id)}}" class="btn btn-primary btn-sm" title="Sửa"><i class="fas fa-edit"></i></a>
                        <a href="{{route('product.show',$model->id)}}" class="btn btn-primary btn-sm" title="Sửa">preview</a>
                        <a href="{{route('product.destroy',$model->id)}}" class="btn btn-danger btn-delete btn-sm" title="Xóa bỏ" onclick="return confirm('Chắc chưa ?!')">
                            <i class="fas fa-trash"></i></a>

                    </td>
                </tr>
            @endforeach
            </tbody>
        </table>

    </form>
    <hr>
    <form action="" method="post" id="delete-form">
        @csrf @method('DELETE')
    </form>
    <div class="d-flex justify-content-center">
        {{ $data->appends(request()->all())->links() }}
    </div>
@stop()

@section('js')
    <script>
        $('.btn-delete').click(function(ev){
            ev.preventDefault();
            var _href =$(this).attr('href');
            $('#delete-form').attr('action',_href);
            $('#delete-form').submit();
        });

        $('#checkall').click(function(){
            var check=$(this).is(':checked');
            // console.log(check);
            if(check){
                $('.check-item').prop('checked',true);
            }else{
                $('.check-item').prop('checked',false);
            }
        });
    </script>
@stop()
