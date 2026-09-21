# LRN Price List Automation

A small PHP 8.2 application for importing an Excel price list, applying one percentage adjustment to every detected price, filtering products, saving versions, and exporting Excel or PDF.

## Run locally

1. Start Apache in XAMPP.
2. Open `http://localhost/pricelistautomation/`.
3. Sign in with one of the demo accounts:
   - `admin@lrn.local` / `Admin123!` (upload, edit, save, export)
   - `editor@lrn.local` / `Editor123!` (upload, edit, save, export)
   - `viewer@lrn.local` / `Viewer123!` (view, filter, export)

The first visit creates `storage/app.json`. Imported workbook data is parsed in the browser, then saved through the PHP API. This avoids server-specific Excel extensions while keeping the backend in PHP.

## SQL Server

Production persistence supports Microsoft SQL Server through `pdo_sqlsrv`. Copy `config.local.example.php` to `config.local.php`, enter the local credentials, and reload the application. The ignored local file prevents passwords from being committed. The app creates the idempotent `dbo.PLA_ACD_Versions`, `dbo.PLA_ACD_ProductImages`, and `dbo.PLA_ACD_AuditLog` tables automatically. The same DDL is available in `database/schema.sql` for review or manual deployment. Without local database configuration, the development JSON store remains active.

## Workbook behavior

- The importer scans every worksheet and skips non-product cover sheets automatically.
- Repeated section headers and the alternate `Presentation Stands` layout are normalized into one searchable product list.
- It consolidates worksheet, code, description, packing details, price per piece, price per box, and MOQ total.
- Price per piece and price per box are selected automatically; derived totals and non-price product details are never adjusted.
- The workspace can be filtered by worksheet category and shown in 20, 40, 80, or 160 rows per page.
- Each product has a compact image placeholder keyed to its description; these slots can be replaced by final product photography later.
- Category tables retain all workbook fields, including expiry, weight, pieces per box, box size, container pallet quantities, presentation-stand weights, MOQ, and total MOQ price.
- Workbook subsection titles such as `Mini Cones With Coating` and `Vegan Mini Cones` are preserved as product-group dividers in the table.
- A `Full table` view combines every applicable workbook column in one horizontally scrollable grid, while the sidebar remains fixed during expanded vertical scrolling.
- The formula is `adjusted price = original price × (1 + percentage / 100)`.
- A negative percentage performs a decrease.
- Previewing a new percentage always recalculates from the saved original price, preventing accidental compounding.

## Design brief

Focused dark operations interface using the requested black, pink, and white theme. Visual variance 4/10, motion 2/10, density 7/10. Native CSS is used for a fast, accessible data-table workflow.
