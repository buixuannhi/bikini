@extends('layouts.admin')
@section('title', 'thêm mới sản phẩm')
@section('main')

<form class="form-horizontal" action="{{route('product.store')}}" method="POST">
    @csrf
    <div class="card-body">
        <div class="row">
            <div class="col-md-9">
                <div class="form-group ">
                    <label for="inputEmail3">Tên sản phẩm</label>
                    <input class="form-control" name="name" placeholder="Tên sản phẩm">
                    @error('name')
                    <small class="help-block text-danger">{{$message}}</small>
                    @enderror
                </div>
                <div class="form-group">
                    <label for="description">Mô tả sản phẩm </label>
                    <textarea name="description" id="editor-ckeditor" rows="10" cols="80"></textarea>
                </div>
                <div class="form-group ">
                    <label for="inputEmail3" class="col-sm-2 col-form-label">các ảnh khác</label>
                    <div class="col-sm-10 input-group mb-3">
                        <div class="input-group-prepend">
                            <a class="input-group-btn btn btn-default" data-toggle="modal" data-target="#model_list"
                                style="width: 50px">
                                <i class="fas fa-folder"></i>
                            </a>
                        </div>
                        <input type="hidden" name="images_list" id="images_list">
                    </div>
                </div>
                   <div id="show_img_list" class="row"></div>
            </div>
            <div class="col-md-3">
                <div class="form-group ">
                    <label for="inputEmail3">giá sản phẩm</label>
                    <input class="form-control" type="number" name="price" placeholder="giá sản phẩm">
                    @error('price')
                    <small class="help-block text-danger">{{$message}}</small>
                    @enderror
                </div>
                <div class="form-group ">
                    <label for="inputEmail3">giá SALE</label>
                    <input class="form-control" value="0" type="number" name="price_sale" placeholder="giá sale">
                    @error('price_sale')
                    <small class="help-block text-danger">{{$message}}</small>
                    @enderror
                </div>
                <div class="form-group ">
                    <label for="inputEmail3">thể loại sản phẩm</label>
                    <select name="category_id" class="form-control">
                        <option value="">chọn danh mục</option>
                        @foreach($cats as $c)
                        <option value="{{$c->id}}">{{$c->name}}</option>
                        @endforeach
                    </select>
                </div>
                <div class="form-group ">
                    <label for="inputEmail3">brand</label>
                    <select name="brand_id" class="form-control">
                        <option value="1">chọn brand</option>
                        {{--                        @foreach($cats as $c)--}}
                        {{--                            <option value="{{$c->id}}">{{$c->name}}</option>--}}
                        {{--                        @endforeach--}}
                    </select>
                </div>
                <div class="form-group ">
                    <label for="inputEmail3">ảnh đại diện </label>
                    <div class="col-sm-10 input-group ">
                        <a class="input-group-text" data-toggle="modal" data-target="#modelId" style="width: 50px">
                            <i class="fas fa-folder"></i></a>
                        
                        <input type="hidden" name="image" id="image">
                    </div>
                </div>
              <div>
              <img src="" id="show_img" style="width: 100%px">
              </div>
                <div class="form-group ">
                    <label for="inputEmail3">Trạng thái sản phẩm</label>
                    <div class="form-check">
                        <input type="radio" class="form-check-input" name="status" id="status0" value="0">
                        <label class="form-check-label" for="status0">Ẩn</label>
                    </div>
                    <div class="form-check">
                        <input type="radio" class="form-check-input" name="status" id="status1" value="1" checked>
                        <label class="form-check-label" for="status1">Hiển thị</label>
                    </div>
                </div>
            <div class="form-group ">
                <div class="offset-sm-2 col-sm-10">
                    <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Lưu lại</button>
                    <button type="reset" class="btn btn-danger">làm mới</button>
                </div>
            </div>
        </div>

</form>
<!-- Modal -->
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
<div class="modal fade" id="model_list" tabindex="-1" role="dialog" aria-labelledby="modelTitleId" aria-hidden="true">
    <div class="modal-dialog modal-xl" r>
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Modal title</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <iframe src="{{url('public/file')}}/dialog.php?field_id=images_list" style="width:100%" height="600px"
                    border="none" ;></iframe>
            </div>
        </div>
    </div>
</div>

@stop()
@section('js')
<script>
var _url = "{{url('')}}";
$('#modelId').on('hide.bs.modal', event => {
    var _img_name = $('#image').val();
    console.log(_img_name);
    var _img_link = _url + '/' + _img_name;
    $('#show_img').attr('src', _img_name);
});
$('#model_list').on('hide.bs.modal', event => {
    var _img_list = $('#images_list').val();
    var images = JSON.parse(_img_list);
    var _html_tag_img = '';
    for (let img of images) {
        var _img_list_link = img;
        _html_tag_img += ' <div class="col-md-4 mt-2" >';
        _html_tag_img += '<img src="' + _img_list_link + '" style="width:100px"/>';
        _html_tag_img += '</div>';
    }
    console.log(_html_tag_img);
    $('#show_img_list').html(_html_tag_img);
});
</script>
@stop