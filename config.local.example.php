<?php
declare(strict_types=1);

// Copy this file to config.local.php. The copied file is ignored by Git.
// Never commit database passwords to source control.
return [
    // App storage in SQL Server (leave out to keep storage/app.json).
    'database' => [
        'host' => '10.2.0.167',
        'database' => 'LRNPH_OJT',
        'username' => 'your_sql_username',
        'password' => 'your_sql_password',
        'trust_certificate' => true,
    ],

    // Employee master list for biometrics sign-in (read only). Settings left out fall back to 'database'.
    'master_list' => [
        'host' => '10.2.0.167',
        'database' => 'LRNPH_OJT',
        'username' => 'your_sql_username',
        'password' => 'your_sql_password',
        // 'table' => 'dbo.lrn_master_list',
    ],

    // Optional: replace the default accounts. Employees are linked to the master list by employee_id
    // and sign in with their BiometricsID from it. Other accounts sign in with email + password_hash:
    //   php -r "echo password_hash('NewPassword!', PASSWORD_DEFAULT);"
    // 'users' => [
    //     'gen@lrn.local' => ['username' => 'gen', 'name' => 'Gen Ong', 'role' => 'admin', 'employee_id' => '2015-1652'],
    //     'gemma@lrn.local' => ['username' => 'gemma', 'name' => 'Gemma Comission', 'role' => 'user', 'password_hash' => '...'],
    // ],

    // Optional: submitter username => approver usernames.
    // 'approvers' => [
    //     'chelsea' => ['gen', 'margaret'],
    //     'margaret' => ['gen', 'chelsea'],
    // ],

    // Optional: the official country list used by the upload and save dropdowns.
    // 'countries' => ['Philippines', 'Japan', 'United Arab Emirates' /* … */],

    // Optional: usernames whose saves are approved instantly (default: Ms. Gen).
    // 'auto_approve' => ['gen'],

    // Optional: 'any' (one approval is enough) or 'all' (every listed approver must approve).
    // 'approval_mode' => 'any',

    // Optional: number of price levels (Price Level 1 … N). Default 5.
    // 'price_levels' => 5,

    // Developer tools panel for wiping test data. Set to false before go-live.
    'dev_tools' => false,
];
