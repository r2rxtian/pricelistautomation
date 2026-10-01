# LRN Price List Automation

A PHP 8.2 application for uploading an Excel price list, adjusting prices by category, getting the updated list approved, and exporting approved lists to Excel or PDF. It implements the Price List Automation System requirements (`Requirements.xlsx` › Price Automation, and the General Documentation).

## Run locally

1. Start Apache in XAMPP.
2. Open `http://localhost/pricelistautomation/`.
3. Sign in with one of the accounts below.

| User | Employee no. (LRNPH_OJT master list) | Sign in with (biometrics ID) | Password | Access |
|---|---|---|---|---|
| Ms. Gen (Gen Ong) | 2015-1652 | `1652` | `1652` | Upload · Update · Save · Approve (instant) · Export |
| Chelsea Favila | 2012-00077 | `10079` | `10079` | Upload · Update · Save · Approve · Export |
| Margaret Santos | 2014-00446 | `1857` | `1857` | Upload · Update · Save · Approve · Export |
| Gemma Comission | not yet known | `gemma@lrn.local` | `Gemma@2026!` | Export only |

Employee sign-in is checked live against `dbo.lrn_master_list` (LRNPH_OJT): the app finds the active row (`IsActive = '1'`) with that `BiometricsID`, and its `EmployeeID` must belong to an account in `config.php`. The password is the same biometrics ID. No biometrics IDs or passwords are stored in this project, so a changed ID in the master list takes effect at once and an employee who leaves loses access. The IDs above are what the master list holds today. The connection goes in `config.local.php` under `master_list` (see `config.local.example.php`); if the master list can't be reached, employees can't sign in. Gemma keeps the email login until her employee number is added to `config.php`.
Change the passwords before going live by overriding `users` in `config.local.php` (see `config.local.example.php`). Passwords are stored as bcrypt hashes.

## Workflow

1. **Sign in.**
2. **Upload** an `.xlsx`/`.xls` price list and enter its **Price Level** (e.g. FOB Subic) and **Country**.
3. **Open the editor.** Filter by **Product Category**, **LRN Code**, **Price Level**, or **Country**, or search.
4. **Adjust prices** by a percentage for selected categories or for all categories, or edit individual cells.
5. Every upload, adjustment, cell edit, save, approval, rejection, and export is written to the **audit log**. Approvers and users get **notifications**.
6. **Save.** The review dialog lists every category adjustment and cell edit and asks for confirmation. Saving sends the list for approval. Closing without saving ends the process without changes.
7. **Approval:** an assigned approver approves the list, or rejects it with a reason. Once approved, the list is **ready for exporting** as Excel or PDF.

### Approval routing

| Saved by | Approvers |
|---|---|
| Chelsea | Ms. Gen & Margaret (Meg) |
| Margaret | Ms. Gen & Chelsea |
| Ms. Gen | Chelsea & Margaret *(not specified in the requirements; configurable)* |

- A user cannot approve their own price list.
- `approval_mode` is `any` by default: one approval from the listed approvers is enough. Set it to `all` in `config.local.php` to require every listed approver.
- Routing can be changed under `approvers` in `config.local.php`.

### Statuses

- **Pending approval**: saved and waiting for an approver.
- **Approved**: exportable by everyone with export access.
- **Rejected**: returned to the submitter with the approver's reason. Saving again resubmits it.
- **Superseded**: an older approved revision replaced by a newer approved revision of the same price list. Editing an approved list and saving it creates a new revision. The previous approved revision stays exportable until the new one is approved.

The server enforces export access, not just the UI. `api.php?action=export` only returns approved price lists and logs every export.

## Countries and saved price lists

Each uploaded price list belongs to one country and price level, chosen at upload (e.g. Philippines · Price Level 1). Price levels are numbered (**Price Level 1, 2, …**; 5 by default, set `price_levels` in `config.local.php` to change). Countries are picked from a fixed list (`countries` in `config.php` or `config.local.php`). The current list is a **placeholder**; replace it with the official 44 countries when they're provided.

A price list is identified by **name + country + price level**. Uploading another Philippines file with a different price level adds a second Philippines price level; it doesn't replace the first, and Philippines still appears once in the Country filter.

The editor toolbar filters in this order: **Country → Level → List**, then **Category → LRN code → Search**. Choosing a country opens its most recent saved list, and Level/List switch between that country's saved files. With no file open, the same navigator appears on the start screen.

## Product photos (Config)

- **Photo library:** a "drawer" of reusable photos. Upload many at once (select several or drag and drop), search, or delete them. Deleting a photo that's in use removes it from those product types.
- **Product type photos:** pick a library photo for each product type.
- **Prices page:** "+ Add photo" / "Change" on a product group opens the same library picker. The picker also has "Upload new photos" and "Remove current photo".

## Developer tools (testing only)

Admins see a small **Dev tools** button at the bottom-left of the screen. It opens a panel that clears test data: the uploaded file/draft in the current browser, saved price lists, notifications, audit logs and product photos. Every clear asks for confirmation and writes a "Cleared test data" entry to the audit log.

**Turn it off before go-live** by adding `'dev_tools' => false` to `config.local.php`. When it's off, the button disappears and the server refuses the request.

## Storage

- **Development:** without database credentials, data is stored in `storage/app.json`. Writes are atomic and file-locked.
- **Production:** Microsoft SQL Server through `pdo_sqlsrv`. Copy `config.local.example.php` to `config.local.php` and enter the credentials. On first connection the app creates or migrates `dbo.PLA_ACD_Versions`, `dbo.PLA_ACD_GroupImages`, `dbo.PLA_ACD_AuditLog`, and `dbo.PLA_ACD_Notifications`. The same idempotent DDL is in `database/schema.sql`.

## Workbook behavior

- The importer scans every worksheet, skips cover sheets, and normalizes repeated section headers and the `Presentation Stands` layout into one product list.
- If a worksheet has `Price Level` or `Country` columns, each row keeps its own value. Other rows use the values entered at upload.
- Only Price/pc and Price/box are adjusted: `adjusted price = original price × (1 + percentage / 100)`. A new percentage is always calculated from the uploaded price, so adjustments never compound.
- Exports keep the workbook's layout: per-category sheets in Excel, and grouped tables with product photos in the PDF. The PDF header shows the price level, country, revision, and approver.

## Out of scope

Following the documentation, the system does not:
- pull prices from external systems
- email or distribute exported files
- let regular users edit prices
- create price lists from scratch (upload a file first)
- track changes made to exported files outside the system

Invoice and Packing List creation (Requirements.xlsx › INV-PL Creation) is a separate process and is not part of this system.
