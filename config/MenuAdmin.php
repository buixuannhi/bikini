<?php 
return [
    [
        'label'=> 'Home', 
        'icon'=>' fa-home',
    ], 
     [
        'label'=> 'quản lý file', 
        'icon'=>' fa-image',
        'route'=>'admin.file'
    ],
    [
        'label'=> 'quản lý danh mục', 
        'icon'=>' fa-copy',
        'items'=>[
                   [
                   'label'=> 'danh sách',
                   'route'=>'category.index',
                   'icon'=>'  fa-circle',
                   ],
                   [
                    'label'=> 'thêm mới',
                    'route'=>'category.create',
                    'icon'=>'  fa-circle',
                   ],
                   [
                    'label'=> 'danh mục đã xóa',
                    'route'=>'category.trushed',
                    'icon'=>'  fa-circle',
                   ]
                    
        ]
   ],
    [
        'label'=> 'quản lý sản phẩm',  
        'icon'=>' fa-copy',
        'items'=>[
                   [
                   'label'=> 'danh sách',
                   'route'=>'product.index',
                   'icon'=>'  fa-circle',
                   ],
                   [
                    'label'=> 'thêm mới',
                    'route'=>'product.store',
                    'icon'=>'  fa-circle',
                   ]
                    
        ]
    ],
    // [
    //     'label'=> 'quản lý nhã hàng',   
    //     'icon'=>' fa-copy',
    //     'items'=>[
    //                [
    //                'label'=> 'danh sách',
    //                'route'=>'admin.Brand.ListBrand',
    //                'icon'=>'  fa-circle',
    //                ],
    //                [
    //                 'label'=> 'thêm mới',
    //                 'route'=>'admin.Brand.AddBrand',
    //                 'icon'=>'  fa-circle',
    //                ]
                    
    //     ]
    // ],
]

?>