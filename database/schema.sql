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
