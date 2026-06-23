<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Individual extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'name'
    ];
}
