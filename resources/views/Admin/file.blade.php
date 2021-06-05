@extends('layouts.admin')
@section('title', 'quản lý file')
@section('main')

<iframe src="{{url('public/file')}}/dialog.php" style="width:100%" height="600px" border="none";></iframe>

@stop()