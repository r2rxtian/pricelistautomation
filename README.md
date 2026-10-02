# LRN Price List Automation

A PHP 8.2 application for uploading an Excel price list, adjusting prices by category, getting the updated list approved, and exporting approved lists to Excel or PDF. It implements the Price List Automation System requirements (`Requirements.xlsx` › Price Automation, and the General Documentation).

## Run locally

1. Copy `conn/config.example.php` to `conn/config.php` and enter the SQL Server connection (LRNPH_OJT). Git ignores `conn/config.php`.
2. Create the tables and the selected users once: `php sql/install.php` (runs `sql/schema.sql` then `sql/seed.sql`; safe to re-run).
3. Start Apache in XAMPP and open `http://localhost/pricelistautomation/` (it redirects to `pages/login.php`).

## Sign-in

Sign-in works the same way as QRTS (`auth/login_handler.php`):

1. **Company login** – `dbo.lrnph_users`: the biometrics number and the person's **company password** (the same login as the other internal apps). The account must be `active`.
2. **HR master list** – `dbo.lrn_master_list`: the active row with that `BiometricsID` gives the `EmployeeID`, name and department.
3. **This app's users** – `dbo.PLA_ACD_Users`: the `EmployeeID` must belong to one of the selected users, which also gives the role.

Nothing about a person is stored in this project: names come from the master list, passwords from `lrnph_users`. Five wrong passwords lock the account here for 15 minutes. Successful and failed sign-ins, and sign-outs, are written to the audit log.

**Selected initial users** (`sql/seed.sql`):

| User | Employee no. | Biometrics no. (today) | Role |
|---|---|---|---|
| Ms. Gen | 2015-1652 | 1652 | Admin – Upload · Update · Save · Approve (instant) · Export |
| Chelsea Favila | 2012-00077 | 10079 | Admin – Upload · Update · Save · Approve · Export |
| Margaret Santos | 2014-00446 | 1857 | Admin – Upload · Update · Save · Approve · Export |
| Gemma Comission | 2022-21518 | 21518 | User – Export only |

To give someone access later, add a row to `dbo.PLA_ACD_Users` (employee_id, a short username, role) or add them to `sql/seed.sql` and re-run the installer.

**IT department:** as in QRTS, employees of *Information Technology Department - LRN* get Admin access automatically on a successful company sign-in, so IT can support the system. They are stored with the User role and are never approvers. Turn it off by setting `IT_ADMIN_DEPARTMENT` to `''` in `rules/constants.php`.

## Folder structure

```text
pricelistautomation/
├── index.php              redirects to pages/login.php
├── pages/                 login.php, prices.php, files.php, approvals.php, audit_logs.php, config.php, 404.php
├── components/            app_shell.php: the shared top bar, pages and dialogs the page files render
├── api/                   JSON endpoints, one file per action (app/, versions/, audit/, notifications/, photos/, dev/)
├── auth/                  session, CSRF, login_handler.php, logout.php
├── authz/                 roles → permissions, permission guard, audit log + notifications
├── conn/                  db.php (PDO, SQL Server) and config.php (credentials, not in Git)
├── rules/                 constants (tables, approval routing, countries, price levels), users, workflow, validation, photos
├── repository/            storage: JSON file or SQL Server tables
├── scripts/               app.js (the app pages), login.js, theme.js
├── styles/                app.css, login.css
├── assets/                vendor libraries (SheetJS, jsPDF) and images
├── sql/                   schema.sql, seed.sql, install.php
└── storage/               app.json, sessions, uploaded photos (not in Git)
```

`conn/`, `rules/`, `authz/`, `repository/` and `sql/` are not served by Apache, and `storage/` only serves photos.

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
- `approval_mode` is `any` by default: one approval from the listed approvers is enough. Set `APPROVAL_MODE` to `all` in `rules/constants.php` to require every listed approver.
- Routing is `APPROVERS` in `rules/constants.php` (by username).

### Statuses

- **Pending approval**: saved and waiting for an approver.
- **Approved**: exportable by everyone with export access.
- **Rejected**: returned to the submitter with the approver's reason. Saving again resubmits it.
- **Superseded**: an older approved revision replaced by a newer approved revision of the same price list. Editing an approved list and saving it creates a new revision. The previous approved revision stays exportable until the new one is approved.

The server enforces export access, not just the UI. `api/versions/export.php` only returns uploaded files and approved price changes, and logs every export.

## Countries and saved price lists

Each uploaded price list belongs to one country and price level, chosen at upload (e.g. Philippines · Price Level 1). Price levels are numbered (**Price Level 1, 2, …**; 5 by default, `PRICE_LEVEL_COUNT` in `rules/constants.php`). Countries are picked from a fixed list (`COUNTRIES` in `rules/constants.php`). The current list is a **placeholder**; replace it with the official 44 countries when they're provided.

A price list is identified by **name + country + price level**. Uploading another Philippines file with a different price level adds a second Philippines price level; it doesn't replace the first, and Philippines still appears once in the Country filter.

The editor toolbar filters in this order: **Country → Level → List**, then **Category → LRN code → Search**. Choosing a country opens its most recent saved list, and Level/List switch between that country's saved files. With no file open, the same navigator appears on the start screen.

## Product photos (Config)

- **Photo library:** a "drawer" of reusable photos. Upload many at once (select several or drag and drop), search, or delete them. Deleting a photo that's in use removes it from those product types.
- **Product type photos:** pick a library photo for each product type.
- **Prices page:** "+ Add photo" / "Change" on a product group opens the same library picker. The picker also has "Upload new photos" and "Remove current photo".

## Developer tools (testing only)

Admins see a small **Dev tools** button at the bottom-left of the screen. It opens a panel that clears test data: the uploaded file/draft in the current browser, saved price lists, notifications, audit logs and product photos. Every clear asks for confirmation and writes a "Cleared test data" entry to the audit log.

**Turn it off before go-live** by setting `PLA_DEV_TOOLS` to `false` in `conn/config.php`. When it's off, the button disappears and the server refuses the request.

## Storage

Sign-in always uses SQL Server. Price lists, audit logs, notifications and photos follow `PLA_STORAGE_DRIVER` in `conn/config.php`:

- `json` (current): `storage/app.json`. Writes are atomic and file-locked.
- `sqlserver`: the `dbo.PLA_ACD_*` tables in `sql/schema.sql` (Versions, GroupImages, PhotoLibrary, AuditLog, Notifications).

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
