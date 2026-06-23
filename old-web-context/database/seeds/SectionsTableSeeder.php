<?php

use Illuminate\Database\Seeder;

class SectionsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        //
        DB::table('sections')->insert(['name' => 'Safety Statement']);
        DB::table('sections')->insert(['name' => 'Company Documents']);
        DB::table('sections')->insert(['name' => 'Risk Assessment']);

        DB::table('sections')->insert(['name' => 'Method Statements']);
        DB::table('sections')->insert(['name' => 'Training Register']);
        DB::table('sections')->insert(['name' => 'Training Qualifications']);
    }
}
