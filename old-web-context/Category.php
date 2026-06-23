<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    //
     protected $fillable = ['section_id', 'name', 'user_id'];

    public function user() {
        return $this->hasOne('App\User', 'id', 'user_id');
    }

    public function company() {
        return $this->hasOne('App\User', 'id', 'company_user_id');
    }

}
