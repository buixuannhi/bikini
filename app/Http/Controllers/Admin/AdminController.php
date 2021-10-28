<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Auth;

class AdminController extends Controller
{
    public function index()
    {
        return view('Admin.index');
    }

    public function file()
    {
        return view('Admin.file');
    }

    public function login()
    {
        return view('Admin.login');
    }

    public function checklogin(Request $req)
    {
        $data = $req->only('email', 'password');
        $check = Auth::attempt($data, $req->has('remember'));
        if ($check) {
            return redirect()->route('admin.index');
        }
        return redirect()->back();
    }

    public function logout()
    {
        Auth::logout();
        return redirect()->route('admin.login');
    }
}
