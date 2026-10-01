/*
 * Price List Automation — schema (T-SQL / SQL Server, database LRNPH_OJT). Run before seed.sql.
 *
 * Idempotent: safe on a new database or on one created by an earlier build. All tables live in the
 * dbo schema of the shared LRNPH_OJT database and are prefixed PLA_ACD_ so they never collide with
 * other apps' tables. The company tables this app only reads (dbo.lrnph_users, dbo.lrn_master_list)
 * are not created here.
 *
 * Sign-in always uses PLA_ACD_Roles / PLA_ACD_Users. The storage tables below are used when
 * conn/config.php sets PLA_STORAGE_DRIVER to 'sqlserver' (the app also creates them on first use).
 */

USE LRNPH_OJT;
GO

-- ============================================================
-- dbo.PLA_ACD_Roles — fixed set of 2 rows (Admin, User), seeded by seed.sql
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_ACD_Roles', N'U') IS NULL
CREATE TABLE dbo.PLA_ACD_Roles (
    id            TINYINT IDENTITY(1,1) PRIMARY KEY,
    name          VARCHAR(30)   NOT NULL,
    description   VARCHAR(255)  NULL,
    created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_PLA_ACD_Roles_name UNIQUE (name)
);
GO

-- ============================================================
-- dbo.PLA_ACD_Users — who can use the app, and their role
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_ACD_Users', N'U') IS NULL
CREATE TABLE dbo.PLA_ACD_Users (
    id                    INT IDENTITY(1,1) PRIMARY KEY,
    employee_id           VARCHAR(20)    NOT NULL,        -- matches dbo.lrn_master_list.EmployeeID: the person's name
                                                          -- comes from there, and their login from dbo.lrnph_users
                                                          -- (via lrn_master_list.BiometricsID). Neither a name nor a
                                                          -- password is stored in this table.
    username              VARCHAR(30)    NOT NULL,        -- short handle used by approval routing, approvals and
                                                          -- notifications (rules/constants.php › APPROVERS)
    role_id               TINYINT        NOT NULL,
    is_active             BIT            NOT NULL DEFAULT 1,
    failed_login_attempts SMALLINT       NOT NULL DEFAULT 0,
    locked_until          DATETIME2      NULL,
    last_login_at         DATETIME2      NULL,
    created_at            DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
    updated_at            DATETIME2      NOT NULL DEFAULT SYSDATETIME(),  -- the app sets this on every UPDATE
    deleted_at            DATETIME2      NULL,            -- soft delete/deactivate
    CONSTRAINT UQ_PLA_ACD_Users_employee_id UNIQUE (employee_id),
    CONSTRAINT UQ_PLA_ACD_Users_username UNIQUE (username)
);
GO

-- ============================================================
-- Storage: price list versions
-- Approval workflow: pending → approved | rejected; a live list becomes superseded when a newer
-- revision of the same price list goes live.
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_ACD_Versions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_ACD_Versions (
        version_id varchar(32) NOT NULL PRIMARY KEY,
        list_name nvarchar(160) NOT NULL,
        adjustment decimal(12,4) NOT NULL CONSTRAINT DF_PLA_ACD_Adjustment DEFAULT 0,
        saved_at datetime2(0) NOT NULL,
        saved_by nvarchar(180) NOT NULL,
        data_json nvarchar(max) NOT NULL,
        CONSTRAINT CK_PLA_ACD_Versions_JSON CHECK (ISJSON(data_json) = 1)
    );
END;
GO

IF COL_LENGTH('dbo.PLA_ACD_Versions', 'status') IS NULL
    ALTER TABLE dbo.PLA_ACD_Versions ADD status nvarchar(20) NOT NULL CONSTRAINT DF_PLA_ACD_Status DEFAULT N'pending';
IF COL_LENGTH('dbo.PLA_ACD_Versions', 'price_level') IS NULL
    ALTER TABLE dbo.PLA_ACD_Versions ADD price_level nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_ACD_Versions', 'country') IS NULL
    ALTER TABLE dbo.PLA_ACD_Versions ADD country nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_ACD_Versions', 'revision') IS NULL
    ALTER TABLE dbo.PLA_ACD_Versions ADD revision int NOT NULL CONSTRAINT DF_PLA_ACD_Revision DEFAULT 1;
IF COL_LENGTH('dbo.PLA_ACD_Versions', 'saved_by_user') IS NULL
    ALTER TABLE dbo.PLA_ACD_Versions ADD saved_by_user nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_ACD_Versions', 'summary_json') IS NULL
    ALTER TABLE dbo.PLA_ACD_Versions ADD summary_json nvarchar(max) NULL;
GO

-- ============================================================
-- Storage: product photos
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_ACD_ProductImages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_ACD_ProductImages (
        product_code nvarchar(100) NOT NULL PRIMARY KEY,
        image_path nvarchar(500) NOT NULL,
        alt_text nvarchar(250) NULL,
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_ImageUpdated DEFAULT SYSUTCDATETIME(),
        updated_by nvarchar(180) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.PLA_ACD_GroupImages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_ACD_GroupImages (
        image_key varchar(64) NOT NULL PRIMARY KEY,
        category_name nvarchar(120) NOT NULL,
        group_name nvarchar(300) NOT NULL,
        image_path nvarchar(500) NOT NULL,
        alt_text nvarchar(250) NULL,
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_GroupImageUpdated DEFAULT SYSUTCDATETIME(),
        updated_by nvarchar(180) NOT NULL
    );
END;
GO

-- Link from a product type to a photo in the library.
IF COL_LENGTH('dbo.PLA_ACD_GroupImages', 'library_id') IS NULL
    ALTER TABLE dbo.PLA_ACD_GroupImages ADD library_id varchar(32) NULL;
GO

-- Photo library ("drawer" of reusable product photos).
IF OBJECT_ID(N'dbo.PLA_ACD_PhotoLibrary', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_ACD_PhotoLibrary (
        photo_id varchar(32) NOT NULL PRIMARY KEY,
        photo_name nvarchar(200) NOT NULL,
        image_path nvarchar(500) NOT NULL,
        width int NULL,
        height int NULL,
        size_bytes int NULL,
        uploaded_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_PhotoUploaded DEFAULT SYSUTCDATETIME(),
        uploaded_by nvarchar(180) NOT NULL
    );
END;
GO

-- ============================================================
-- Storage: audit log
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_ACD_AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_ACD_AuditLog (
        audit_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        action_name nvarchar(60) NOT NULL,
        version_id varchar(32) NULL,
        actor nvarchar(180) NOT NULL,
        details nvarchar(1000) NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_AuditCreated DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'log_uid') IS NULL
    ALTER TABLE dbo.PLA_ACD_AuditLog ADD log_uid varchar(32) NULL;
IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'title') IS NULL
    ALTER TABLE dbo.PLA_ACD_AuditLog ADD title nvarchar(300) NULL;
IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'actor_user') IS NULL
    ALTER TABLE dbo.PLA_ACD_AuditLog ADD actor_user nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'role_name') IS NULL
    ALTER TABLE dbo.PLA_ACD_AuditLog ADD role_name nvarchar(40) NULL;
IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'file_name') IS NULL
    ALTER TABLE dbo.PLA_ACD_AuditLog ADD file_name nvarchar(300) NULL;
IF COL_LENGTH('dbo.PLA_ACD_AuditLog', 'metadata_json') IS NULL
    ALTER TABLE dbo.PLA_ACD_AuditLog ADD metadata_json nvarchar(max) NULL;
GO

-- ============================================================
-- Storage: notifications
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_ACD_Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_ACD_Notifications (
        notification_id varchar(32) NOT NULL PRIMARY KEY,
        recipient nvarchar(120) NOT NULL,
        notification_type nvarchar(40) NOT NULL,
        title nvarchar(300) NOT NULL,
        message nvarchar(1000) NULL,
        version_id varchar(32) NULL,
        is_read bit NOT NULL CONSTRAINT DF_PLA_ACD_NotificationRead DEFAULT 0,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_ACD_NotificationCreated DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PLA_ACD_Notifications_Recipient')
    CREATE INDEX IX_PLA_ACD_Notifications_Recipient ON dbo.PLA_ACD_Notifications (recipient, created_at DESC);
GO

PRINT 'dbo.PLA_ACD_* tables ready. Next: run seed.sql.';
