<?php

namespace App;

use Illuminate\Notifications\Notifiable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\SoftDeletes;

class User extends Authenticatable
{
    use Notifiable;
    use SoftDeletes;

    protected $dates = ['deleted_at'];

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'name', 'email', 'password', 'unique_user_id'
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'password', 'remember_token',
    ];

    public function isAdmin()
    {
        if ($this->type == 'admin') {
            return true;
        }
        else {
            return false;
        }
    }

    public function isCompany()
    {
        if ($this->type == 'company') {
            return true;
        }
        else {
            return false;
        }
    }

    public function documents() {
        return $this->hasMany('App\Document')->where('uploaded_from_app', false);
    }

    public function images() {
        return $this->hasMany('App\Image');
    }

    public function individuals() {
        return $this->hasMany('App\Individual');
    }

    public function reminders() {
        return $this->hasMany('App\Reminder');
    }
}
