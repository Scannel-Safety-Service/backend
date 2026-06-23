<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    //
    protected $fillable = [
        'user_id', 'section_id', 'individual_id', 'name', 'filename'
    ];

    public function section() {
        return $this->hasOne('App\Section', 'id', 'section_id');
    }

    public function individual() {
        return $this->hasOne('App\Individual', 'id', 'individual_id');
    }

    public function category() {
        return $this->hasOne('App\Category', 'id', 'category_id');
    }    

    public function url() {
        return url('/documents/').'/'.$this->id;
    }
}
