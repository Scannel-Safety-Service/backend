<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

use Carbon\Carbon;

class Reminder extends Model
{
    //
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'reminder_date', 'training_date'
    ];

    function reminder_date_formatted() {
        return Carbon::createFromFormat('Y-m-d', $this->reminder_date)->format('d-m-Y');
    }

    function training_date_formatted() {
        return Carbon::createFromFormat('Y-m-d', $this->training_date)->format('d-m-Y');
    }

    public function user() {
        return $this->hasOne('App\User', 'id', 'user_id');
    }    
}
