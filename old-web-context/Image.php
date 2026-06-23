<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Image extends Model
{
    //
    protected $fillable = [
        'user_id', 'section_id', 'individual_id', 'name', 'filename'
    ];

    public function section() {
        return $this->hasOne('App\Section', 'id', 'section_id');
    }
}
