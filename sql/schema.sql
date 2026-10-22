/*
 * Price List Automation — schema (T-SQL / SQL Server, database LRNPH_OJT). Run before seed.sql.
 *
 * Idempotent: safe on a new database or on one created by an earlier build. All tables live in the
 * dbo schema of the shared LRNPH_OJT database and are prefixed PLA_ so they never collide with
 * other apps' tables. The company tables this app only reads (dbo.lrnph_users, dbo.lrn_master_list)
 * are not created here.
 *
 * Sign-in always uses PLA_Roles / PLA_Users. The storage tables below are used when
 * conn/config.php sets PLA_STORAGE_DRIVER to 'sqlserver' (the app also creates them on first use).
 */

USE LRNPH_OJT;
GO

-- ============================================================
-- dbo.PLA_Roles — fixed set of 2 rows (Admin, User), seeded by seed.sql
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_Roles', N'U') IS NULL
CREATE TABLE dbo.PLA_Roles (
    id            TINYINT IDENTITY(1,1) PRIMARY KEY,
    name          VARCHAR(30)   NOT NULL,
    description   VARCHAR(255)  NULL,
    created_at    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT UQ_PLA_Roles_name UNIQUE (name)
);
GO

-- ============================================================
-- dbo.PLA_Users — who can use the app, and their role
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_Users', N'U') IS NULL
CREATE TABLE dbo.PLA_Users (
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
    CONSTRAINT UQ_PLA_Users_employee_id UNIQUE (employee_id),
    CONSTRAINT UQ_PLA_Users_username UNIQUE (username)
);
GO

-- ============================================================
-- Storage: price list versions
-- Approval workflow: pending → approved | rejected; a live list becomes superseded when a newer
-- revision of the same price list goes live.
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_Versions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_Versions (
        version_id varchar(32) NOT NULL PRIMARY KEY,
        list_name nvarchar(160) NOT NULL,
        adjustment decimal(12,4) NOT NULL CONSTRAINT DF_PLA_Adjustment DEFAULT 0,
        saved_at datetime2(0) NOT NULL,
        saved_by nvarchar(180) NOT NULL,
        data_json nvarchar(max) NOT NULL,
        CONSTRAINT CK_PLA_Versions_JSON CHECK (ISJSON(data_json) = 1)
    );
END;
GO

IF COL_LENGTH('dbo.PLA_Versions', 'status') IS NULL
    ALTER TABLE dbo.PLA_Versions ADD status nvarchar(20) NOT NULL CONSTRAINT DF_PLA_Status DEFAULT N'pending';
IF COL_LENGTH('dbo.PLA_Versions', 'price_level') IS NULL
    ALTER TABLE dbo.PLA_Versions ADD price_level nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_Versions', 'country') IS NULL
    ALTER TABLE dbo.PLA_Versions ADD country nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_Versions', 'revision') IS NULL
    ALTER TABLE dbo.PLA_Versions ADD revision int NOT NULL CONSTRAINT DF_PLA_Revision DEFAULT 1;
IF COL_LENGTH('dbo.PLA_Versions', 'saved_by_user') IS NULL
    ALTER TABLE dbo.PLA_Versions ADD saved_by_user nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_Versions', 'summary_json') IS NULL
    ALTER TABLE dbo.PLA_Versions ADD summary_json nvarchar(max) NULL;
GO

-- ============================================================
-- Storage: product photos
-- ============================================================
-- (PLA_ProductImages, a per-product photo table, was never used and was removed on 2026-10-22.)

IF OBJECT_ID(N'dbo.PLA_GroupImages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_GroupImages (
        image_key varchar(64) NOT NULL PRIMARY KEY,
        category_name nvarchar(120) NOT NULL,
        group_name nvarchar(300) NOT NULL,
        image_path nvarchar(500) NOT NULL,
        alt_text nvarchar(250) NULL,
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_GroupImageUpdated DEFAULT SYSUTCDATETIME(),
        updated_by nvarchar(180) NOT NULL
    );
END;
GO

-- Link from a product type to a photo in the library.
IF COL_LENGTH('dbo.PLA_GroupImages', 'library_id') IS NULL
    ALTER TABLE dbo.PLA_GroupImages ADD library_id varchar(32) NULL;
GO

-- Photo library ("drawer" of reusable product photos).
IF OBJECT_ID(N'dbo.PLA_PhotoLibrary', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_PhotoLibrary (
        photo_id varchar(32) NOT NULL PRIMARY KEY,
        photo_name nvarchar(200) NOT NULL,
        image_path nvarchar(500) NOT NULL,
        width int NULL,
        height int NULL,
        size_bytes int NULL,
        uploaded_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_PhotoUploaded DEFAULT SYSUTCDATETIME(),
        uploaded_by nvarchar(180) NOT NULL
    );
END;
GO

-- ============================================================
-- Category folders preserve empty folders; existing photos remain unfiled.
-- Folder labels are metadata and do not change uploaded file paths.
IF COL_LENGTH('dbo.PLA_PhotoLibrary', 'category_name') IS NULL
    ALTER TABLE dbo.PLA_PhotoLibrary ADD category_name nvarchar(120) NULL;
GO

IF OBJECT_ID(N'dbo.PLA_PhotoFolders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_PhotoFolders (
        folder_name nvarchar(120) NOT NULL PRIMARY KEY,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_PhotoFolderCreated DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- (PLA_ListOptions, the first shared list of countries and price levels, was replaced by PLA_Countries
-- and PLA_PriceLevels below and removed on 2026-10-22.)

-- Search keywords (Config): admin shortcuts for a product group or one product code.
IF OBJECT_ID(N'dbo.PLA_SearchKeywords', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_SearchKeywords (
        keyword_id varchar(64) NOT NULL PRIMARY KEY,
        scope varchar(10) NOT NULL,              -- 'group' or 'product'
        category_name nvarchar(120) NULL,
        group_name nvarchar(200) NULL,
        product_code nvarchar(80) NULL,
        keywords nvarchar(1000) NOT NULL,        -- comma-separated, lowercase
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_SearchKeywordsUpdated DEFAULT SYSUTCDATETIME(),
        updated_by nvarchar(180) NOT NULL
    );
END;
GO

-- ============================================================
-- Storage: audit log
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_AuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_AuditLog (
        audit_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        action_name nvarchar(60) NOT NULL,
        version_id varchar(32) NULL,
        actor nvarchar(180) NOT NULL,
        details nvarchar(1000) NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_AuditCreated DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF COL_LENGTH('dbo.PLA_AuditLog', 'log_uid') IS NULL
    ALTER TABLE dbo.PLA_AuditLog ADD log_uid varchar(32) NULL;
IF COL_LENGTH('dbo.PLA_AuditLog', 'title') IS NULL
    ALTER TABLE dbo.PLA_AuditLog ADD title nvarchar(300) NULL;
IF COL_LENGTH('dbo.PLA_AuditLog', 'actor_user') IS NULL
    ALTER TABLE dbo.PLA_AuditLog ADD actor_user nvarchar(120) NULL;
IF COL_LENGTH('dbo.PLA_AuditLog', 'role_name') IS NULL
    ALTER TABLE dbo.PLA_AuditLog ADD role_name nvarchar(40) NULL;
IF COL_LENGTH('dbo.PLA_AuditLog', 'file_name') IS NULL
    ALTER TABLE dbo.PLA_AuditLog ADD file_name nvarchar(300) NULL;
IF COL_LENGTH('dbo.PLA_AuditLog', 'metadata_json') IS NULL
    ALTER TABLE dbo.PLA_AuditLog ADD metadata_json nvarchar(max) NULL;
GO

-- ============================================================
-- Storage: notifications
-- ============================================================
IF OBJECT_ID(N'dbo.PLA_Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_Notifications (
        notification_id varchar(32) NOT NULL PRIMARY KEY,
        recipient nvarchar(120) NOT NULL,
        notification_type nvarchar(40) NOT NULL,
        title nvarchar(300) NOT NULL,
        message nvarchar(1000) NULL,
        version_id varchar(32) NULL,
        is_read bit NOT NULL CONSTRAINT DF_PLA_NotificationRead DEFAULT 0,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_NotificationCreated DEFAULT SYSUTCDATETIME()
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PLA_Notifications_Recipient')
    CREATE INDEX IX_PLA_Notifications_Recipient ON dbo.PLA_Notifications (recipient, created_at DESC);
GO

-- ============================================================
-- Price masterlist (rules/masterlist.php)
-- One list of products with base prices. A price in a country + price level list is the price set
-- for it there (PLA_PriceOverrides), otherwise the base price × every matching % rule (PLA_PriceRules).
-- ============================================================

-- Customers (PLA_Countries keeps its first name; see CUSTOMERS in rules/constants.php) and price levels
-- (Config). Ids are kept when the lists are edited, so prices stay attached.
IF OBJECT_ID(N'dbo.PLA_Countries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_Countries (
        country_id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name nvarchar(120) NOT NULL CONSTRAINT UQ_PLA_Countries_name UNIQUE,
        description nvarchar(300) NULL,
        is_active bit NOT NULL CONSTRAINT DF_PLA_Countries_active DEFAULT 1,   -- 0 = no longer offered
        sort_order int NOT NULL CONSTRAINT DF_PLA_Countries_sort DEFAULT 0,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_Countries_created DEFAULT SYSUTCDATETIME()
    );
END;
GO
IF OBJECT_ID(N'dbo.PLA_PriceLevels', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_PriceLevels (
        price_level_id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name nvarchar(120) NOT NULL CONSTRAINT UQ_PLA_PriceLevels_name UNIQUE,
        description nvarchar(300) NULL,
        is_active bit NOT NULL CONSTRAINT DF_PLA_PriceLevels_active DEFAULT 1,
        sort_order int NOT NULL CONSTRAINT DF_PLA_PriceLevels_sort DEFAULT 0,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_PriceLevels_created DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- The masterlist: one row per product (LRN code). row_json is the product's full template row
-- (expiry, weight, sizes, pallets, NW/GW, MOQ…); the base prices are also columns for querying.
IF OBJECT_ID(N'dbo.PLA_Products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_Products (
        product_id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        product_code nvarchar(80) NOT NULL CONSTRAINT UQ_PLA_Products_code UNIQUE,
        category nvarchar(120) NOT NULL,          -- the workbook sheet
        product_group nvarchar(300) NULL,         -- product type (shares a photo)
        layout varchar(20) NOT NULL CONSTRAINT CK_PLA_Products_layout CHECK (layout IN ('standard', 'presentation')),
        description nvarchar(500) NOT NULL,
        base_price_pc decimal(14,4) NULL,         -- USD
        base_price_box decimal(14,4) NULL,        -- USD
        row_json nvarchar(max) NOT NULL CONSTRAINT CK_PLA_Products_row CHECK (ISJSON(row_json) = 1),
        sort_order int NOT NULL CONSTRAINT DF_PLA_Products_sort DEFAULT 0,       -- row order in the file
        is_active bit NOT NULL CONSTRAINT DF_PLA_Products_active DEFAULT 1,      -- 0 = removed by an upload
        version_id varchar(32) NULL,              -- the upload or approved change that last set it
        created_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_Products_created DEFAULT SYSUTCDATETIME(),
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_Products_updated DEFAULT SYSUTCDATETIME()
    );
END;
GO

-- % on the base price. NULL country / price level / category = all of them; rules that cover the
-- same list multiply.
IF OBJECT_ID(N'dbo.PLA_PriceRules', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_PriceRules (
        rule_id int IDENTITY(1,1) NOT NULL PRIMARY KEY,
        country_id int NULL CONSTRAINT FK_PLA_PriceRules_country REFERENCES dbo.PLA_Countries (country_id),
        price_level_id int NULL CONSTRAINT FK_PLA_PriceRules_level REFERENCES dbo.PLA_PriceLevels (price_level_id),
        category nvarchar(120) NULL,
        percent_change decimal(9,4) NOT NULL,     -- 5.0000 = +5%
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_PriceRules_updated DEFAULT SYSUTCDATETIME(),
        updated_by nvarchar(180) NOT NULL,
        CONSTRAINT UQ_PLA_PriceRules_scope UNIQUE (country_id, price_level_id, category)
    );
END;
GO

-- Prices set for one product in one country + price level, only where they differ from the rules.
-- NULL price_pc or price_box = that price follows the masterlist.
IF OBJECT_ID(N'dbo.PLA_PriceOverrides', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_PriceOverrides (
        product_id int NOT NULL CONSTRAINT FK_PLA_PriceOverrides_product REFERENCES dbo.PLA_Products (product_id),
        country_id int NOT NULL CONSTRAINT FK_PLA_PriceOverrides_country REFERENCES dbo.PLA_Countries (country_id),
        price_level_id int NOT NULL CONSTRAINT FK_PLA_PriceOverrides_level REFERENCES dbo.PLA_PriceLevels (price_level_id),
        price_pc decimal(14,4) NULL,
        price_box decimal(14,4) NULL,
        base_price_pc_when_set decimal(14,4) NULL,   -- to flag "the masterlist price changed since"
        base_price_box_when_set decimal(14,4) NULL,
        version_id varchar(32) NULL,
        set_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_PriceOverrides_set DEFAULT SYSUTCDATETIME(),
        set_by nvarchar(180) NOT NULL,
        CONSTRAINT PK_PLA_PriceOverrides PRIMARY KEY (product_id, country_id, price_level_id)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PLA_PriceOverrides_list')
    CREATE INDEX IX_PLA_PriceOverrides_list ON dbo.PLA_PriceOverrides (country_id, price_level_id);
GO

-- What each upload or approved change did: one row per price, rule or product.
IF OBJECT_ID(N'dbo.PLA_PriceChanges', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PLA_PriceChanges (
        change_id bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
        version_id varchar(32) NOT NULL,           -- PLA_Versions (the save it belongs to)
        change_kind varchar(20) NOT NULL CONSTRAINT CK_PLA_PriceChanges_kind CHECK (change_kind IN ('base', 'rule', 'override', 'product_add', 'product_remove', 'field')),
        product_code nvarchar(80) NULL,
        country_id int NULL,
        price_level_id int NULL,
        category nvarchar(120) NULL,
        field_name nvarchar(60) NULL,              -- price_pc, price_box, percent_change, Description…
        old_value nvarchar(400) NULL,
        new_value nvarchar(400) NULL,
        changed_at datetime2(0) NOT NULL CONSTRAINT DF_PLA_PriceChanges_at DEFAULT SYSUTCDATETIME()
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PLA_PriceChanges_version')
    CREATE INDEX IX_PLA_PriceChanges_version ON dbo.PLA_PriceChanges (version_id);
GO

PRINT 'dbo.PLA_* tables ready. Next: run seed.sql.';
