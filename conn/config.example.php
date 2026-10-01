<?php
/**
 * Connection settings for this server. Copy this file to conn/config.php and fill it in.
 * conn/config.php is ignored by Git (never commit database passwords), and conn/.htaccess keeps
 * the folder from being served.
 */

// SQL Server holding the company tables (dbo.lrnph_users, dbo.lrn_master_list) and this app's dbo.PLA_ACD_* tables.
const PLA_DB_HOST = '10.2.0.167';
const PLA_DB_NAME = 'LRNPH_OJT';
const PLA_DB_USER = 'your_sql_username';
const PLA_DB_PASS = 'your_sql_password';

// Where price lists, audit logs, notifications and photos are kept:
//   'json'      – storage/app.json on this server
//   'sqlserver' – the dbo.PLA_ACD_* tables (see sql/schema.sql)
// Sign-in always uses SQL Server.
const PLA_STORAGE_DRIVER = 'json';

// Floating developer tools panel for wiping test data. Set to false before go-live.
const PLA_DEV_TOOLS = true;
