@extends('layouts.admin')
@section('title', 'Chỉnh sửa sản phẩm: '.$product->name)
@section('main')

    <form class="form-horizontal" action="{{route('product.update', $product->id)}}" method="POST">
        @csrf  @method('PUT')
        <div class="card-body">
            <div class="form-group row">
                <label for="inputEmail3" class="col-sm-2 col-form-label">Tên sản phẩm </label>
                <div class="col-sm-10">
                    <input class="form-control" name="name" value="{{$product->name}}">
                    @error('name')
                    <small class="help-block text-danger">{{$message}}</small>
                    @enderror
                </div>
            </div>
            <div class="form-group row">
                <label for="inputEmail3" class="col-sm-2 col-form-label">ảnh đại diện </label>
                <div class="col-sm-10 input-group ">
                    <a class="input-group-text" data-toggle="modal" data-target="#modelId" style="width: 50px">
                        <i class="fas fa-folder"></i></a>
                    <img src="" id="show_img" style="width: 100px" >
                    <input type="text" name="image" id="image"  value="{{$product->image}}">
                </div>
            </div>
            <div class="form-group row">
                <label for="inputEmail3" class="col-sm-2 col-form-label">Trạng thái danh mục</label>
                <div class="col-sm-10">
                    <div class="form-check">
                        <input type="radio" class="form-check-input" name="status" id="status0" value="0" {{$product->status == 0 ? 'checked' : ''}}>
                        <label class="form-check-label" for="status0">Ẩn</label>
                    </div>
                    <div class="form-check">
                        <input type="radio" class="form-check-input" name="status" id="status1" value="1" {{$product->status == 1 ? 'checked' : ''}}>
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

        <div class="modal fade" id="modelId" tabindex="-1" role="dialog" aria-labelledby="modelTitleId" aria-hidden="true">
            <div class="modal-dialog modal-xl" r>
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Modal title</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <iframe src="{{url('public/file')}}/dialog.php?field_id=image" style="width:100%" height="600px"
                                border="none" ;></iframe>
                    </div>
                </div>
            </div>
        </div>
    </form>
@stop()
@section('js')
    <script>
        var _url = "{{url('public/uploads')}}";
        $('#modelId').on('hide.bs.modal', event => {
            var _img_name = $('#image').val();
            console.log(_img_name);
            var _img_link = _url + '/' + _img_name;
            $('#show_img').attr('src', _img_link);
        });

    </script>
@stop
