/*
 * One-off migration for a database still on the old table names (T-SQL / SQL Server, LRNPH_OJT).
 * Renames every app table from dbo.PLA_ACD_<Name> to dbo.PLA_<Name>. Already run on LRNPH_OJT.
 *
 * The price masterlist tables (PLA_Countries, PLA_PriceLevels, PLA_Products, PLA_PriceRules,
 * PLA_PriceOverrides, PLA_PriceChanges) are in sql/schema.sql; the app also creates them on first use.
 * Idempotent: a table is only renamed when the old name exists and the new one doesn't.
 */

USE LRNPH_OJT;
GO

DECLARE @renames TABLE (old_name sysname, new_name sysname);
INSERT INTO @renames VALUES
    (N'PLA_ACD_Roles', N'PLA_Roles'),
    (N'PLA_ACD_Users', N'PLA_Users'),
    (N'PLA_ACD_Versions', N'PLA_Versions'),
    (N'PLA_ACD_ProductImages', N'PLA_ProductImages'),
    (N'PLA_ACD_GroupImages', N'PLA_GroupImages'),
    (N'PLA_ACD_PhotoLibrary', N'PLA_PhotoLibrary'),
    (N'PLA_ACD_PhotoFolders', N'PLA_PhotoFolders'),
    (N'PLA_ACD_ListOptions', N'PLA_ListOptions'),
    (N'PLA_ACD_SearchKeywords', N'PLA_SearchKeywords'),
    (N'PLA_ACD_AuditLog', N'PLA_AuditLog'),
    (N'PLA_ACD_Notifications', N'PLA_Notifications');

DECLARE @old sysname, @new sysname, @from nvarchar(300);
DECLARE rename_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT old_name, new_name FROM @renames;
OPEN rename_cursor;
FETCH NEXT FROM rename_cursor INTO @old, @new;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @old, N'U') IS NOT NULL AND OBJECT_ID(N'dbo.' + @new, N'U') IS NULL
    BEGIN
        SET @from = N'dbo.' + @old;
        EXEC sp_rename @from, @new;   -- constraint/index names keep their old PLA_ACD_ text (cosmetic only)
        PRINT 'Renamed dbo.' + @old + ' → dbo.' + @new;
    END;
    FETCH NEXT FROM rename_cursor INTO @old, @new;
END;
CLOSE rename_cursor;
DEALLOCATE rename_cursor;
GO

