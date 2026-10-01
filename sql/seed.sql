/*
 * Price List Automation — baseline data (T-SQL / SQL Server). Run after schema.sql.
 * Idempotent: re-running it adds what is missing and leaves existing rows alone.
 *
 * 2 roles (Requirements.xlsx › Price Automation, section 2):
 *   Admin – Upload | Update | Save | Approve | Export
 *   User  – Export approved price lists only
 *
 * The selected initial users. Only employee_id, a short username and the role are stored: names
 * come live from dbo.lrn_master_list (matched on EmployeeID) and sign-in goes through the company
 * login table dbo.lrnph_users (bridged by BiometricsID), see auth/login_handler.php. The names below
 * are only a human-readable reference for whose employee_id is whose.
 *
 * IT-department administrators are provisioned automatically at their first successful sign-in,
 * so they are not listed here.
 */

USE LRNPH_OJT;
GO

-- ============================================================
-- Roles (2 rows)
-- ============================================================
MERGE dbo.PLA_ACD_Roles AS target
USING (VALUES
    ('Admin', 'Upload, update, save, approve and export price lists.'),
    ('User',  'Export approved price lists only.')
) AS source (name, description)
    ON target.name = source.name
WHEN NOT MATCHED THEN
    INSERT (name, description) VALUES (source.name, source.description);
GO

-- ============================================================
-- Selected initial users
-- ============================================================
DECLARE @adminRoleId TINYINT = (SELECT id FROM dbo.PLA_ACD_Roles WHERE name = 'Admin');
DECLARE @userRoleId TINYINT = (SELECT id FROM dbo.PLA_ACD_Roles WHERE name = 'User');

MERGE dbo.PLA_ACD_Users AS target
USING (
    SELECT employee_id, username, CASE WHEN role_key = 'admin' THEN @adminRoleId ELSE @userRoleId END AS role_id
    FROM (VALUES
        ('2015-1652',  'gen',      'Ong, Genevie Leslie (Ms. Gen)', 'admin'),
        ('2012-00077', 'chelsea',  'Favila, Chelsea Mauve',         'admin'),
        ('2014-00446', 'margaret', 'Santos, Margaret (Meg)',        'admin'),
        ('2022-21518', 'gemma',    'Comission, Gemma',              'user')
    ) AS t (employee_id, username, full_name, role_key)
) AS source
    ON target.employee_id = source.employee_id
WHEN NOT MATCHED THEN
    INSERT (employee_id, username, role_id) VALUES (source.employee_id, source.username, source.role_id);
GO

PRINT 'Baseline data ready: 2 roles, 4 selected users.';
