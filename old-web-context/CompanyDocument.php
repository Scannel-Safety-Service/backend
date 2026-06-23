<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class CompanyDocument extends Model
{
    //
    public function category() {
        return $this->hasOne('App\Category', 'id', 'category_id');
    }    

    public function section() {
        return $this->hasOne('App\Section', 'id', 'section_id');
    }

    public function individual() {
        return $this->hasOne('App\Individual', 'id', 'individual_id');
    }  
}
