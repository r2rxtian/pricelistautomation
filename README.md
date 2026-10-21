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
3. **This app's users** – `dbo.PLA_Users`: the `EmployeeID` must belong to one of the selected users, which also gives the role.

Nothing about a person is stored in this project: names come from the master list, passwords from `lrnph_users`. Five wrong passwords lock the account here for 15 minutes. Successful and failed sign-ins, and sign-outs, are written to the audit log.

**Selected initial users** (`sql/seed.sql`):

| User | Employee no. | Biometrics no. (today) | Role |
|---|---|---|---|
| Ms. Gen | 2015-1652 | 1652 | Admin – Upload · Update · Save · Approve (instant) · Export |
| Chelsea Favila | 2012-00077 | 10079 | Admin – Upload · Update · Save · Approve · Export |
| Margaret Santos | 2014-00446 | 1857 | Admin – Upload · Update · Save · Approve · Export |
| Gemma Comission | 2022-21518 | 21518 | User – Export only |

To give someone access later, add a row to `dbo.PLA_Users` (employee_id, a short username, role) or add them to `sql/seed.sql` and re-run the installer.

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
2. **Upload** the official `.xlsx` template and choose its **Price Level** and **Country**. The complete workbook is validated on the server before it is saved.
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

## Price levels and customers (Requirements 17Oct2026)

The official answers are in `Requirements 17Oct2026.xlsx`:

- **Price levels (6):** FOB Price, EU Direct Price, USA Direct Price, Valrhona Price, PH Price, CW Price.
- **Customers (42):** each customer buys at exactly one price level (sheet "Price Level").
- **Upload:** choose the price level first, then the customer.
- **Exports:** use the "Excel Header Template" columns. When exporting, the user picks a letterhead (SP or LRNPH) and bank details (SP, LRNPH USD or LRNPH PHP) from the "header & footer selection" sheet.

How it works in the system (SQL Server storage):

- **Each price level is its uploaded file.** Its products, prices, descriptions and categories come from the workbook uploaded for it, in the file's order. Each worksheet is a category.
- **Re-uploading a level's workbook updates it.** The preview lists everything before it is applied:
  - new products are added;
  - changed prices and details are updated;
  - products missing from the file leave that level only.
- **A level with no file yet is empty.** The Dashboard and the switcher show it as "No file yet".
- **Files page.** It shows one card per price level's file: its workbook name, products, customers, and who uploaded it and when.
  - **Open** opens that file; **Upload new version** replaces it.
  - Customers with their own prices are listed on their level's card.
  - After an upload, the uploaded file opens in the editor.
- **Customers.** A customer gets its level's products and prices. Uploading a file for one customer gives it its own prices; its other products keep the level's.
- **The product list in the background.** `dbo.PLA_Products` holds one record per LRN code. Uploads add new products to it automatically. It links the levels, but users never open or maintain it ("Standard prices" is no longer shown).
- **Changes in the editor.** One Save with one approval can change several levels or customers.
- **A % change** applies to:
  - one customer;
  - every customer on a level;
  - picked customers;
  - every price level;
  - optionally, only some categories.
- **Dashboard** (`pages/dashboard.php`, the page after sign-in). The data comes from `rules/dashboard.php` through `api/dashboard/summary.php`. It shows:
  - the price levels as a staircase (higher = dearer than the cheapest level, with how many products each file has);
  - the price ladder (one product's price in every level);
  - what needs attention;
  - the last 30 days of uploads, price changes and exports.
- **Config › Customers & price levels.** Add customers and change their price level. A level with customers can't be removed.
- Defaults are in `rules/constants.php`:
  - `CUSTOMERS` and `PRICE_LEVELS`;
  - `EXPORT_LETTERHEADS` and `EXPORT_BANK_DETAILS` (edit the wording there).
- `php sql/load_official_lists.php --apply` loads the official lists into the database (already done on LRNPH_OJT on 2026-10-21).

**Naming note.** Customers replaced the countries of the first version. In the code and database they still use the old names: the list type `countries`, `dbo.PLA_Countries`, `country_id`, and the version field `country` all hold the **customer**. A price level's file is stored as its rows with `country_id` NULL in `dbo.PLA_PriceOverrides` (price, `row_json` with the file's details, `sort_order`); customer prices are rows with the customer's id.

## Product photos (Config)

- **Photo library:** reusable photos organized in category folders. Categories from price lists appear automatically; the + button beside Folders creates an empty folder. Select a folder or the Upload to destination, then click Upload photos to select several photos at once. Existing photos appear in Unfiled; each photo has a folder control to move it without affecting its product assignments. Search is limited to the folder being viewed. Deleting a photo that's in use removes it from those product types.
- **Product type photos:** pick a library photo for each product type.
- **Prices page:** "+ Add photo" / "Change" on a product group opens the library picker in that product category's folder. Switch folders (or choose All photos) to reuse a photo from another category, or upload directly into the selected folder. Removing the current photo keeps it in the library.

## Developer tools (testing only)

Admins see a small **Dev tools** button at the bottom-left of the screen. It opens a panel that clears test data: the uploaded file/draft in the current browser, saved price lists, notifications, audit logs and product photos. Every clear asks for confirmation and writes a "Cleared test data" entry to the audit log.

**Turn it off before go-live** by setting `PLA_DEV_TOOLS` to `false` in `conn/config.php`. When it's off, the button disappears and the server refuses the request.

## Storage

Sign-in always uses SQL Server. Price lists, audit logs, notifications and photos follow `PLA_STORAGE_DRIVER` in `conn/config.php`:

- `json` (current): `storage/app.json`. Writes are atomic and file-locked.
- `sqlserver`: the `dbo.PLA_*` tables in `sql/schema.sql` (Versions, GroupImages, PhotoLibrary, AuditLog, Notifications).

## Workbook behavior

- Download one official workbook (`PLA-2`) with an unchanged `Instructions` sheet and two approved layouts: standard products (12 columns, three header rows) and `Presentation Stands` (11 columns, one header row). Standard products end with the three pallet columns and Product Group; NW, GW, MOQ and Total Price Based on MOQ belong only to Presentation Stands.
- The shared contract is `rules/price_list_template.json`. It drives the download, upload column guide, permitted category sheets, field rules and normalized column mapping. Category or layout changes require a deliberate template-version change.
- Download a fresh PLA-2 template for new uploads. The superseded PLA-1 workbook layout is rejected; already saved lists remain readable and editable without migration.
- Approved category worksheets are Breads, Tart Shells, Pastries, Cones & Baskets, Chocolates and Presentation Stands. Included sheets must keep their exact names, header values, order, positions and merges. Extra/missing/renamed/reordered columns, extra worksheets, duplicate product codes and invalid product values are rejected with a sheet/cell error.
- Category sheets can be empty or absent, including Presentation Stands. At least one populated category is required. Replace or remove the sample product rows before uploading. Country and price level come only from the upload form.
- Only genuine, unencrypted `.xlsx` files up to 10 MB and 15,000 total products are accepted. Formula cells, macros, hyperlinks, external links, embedded objects and hidden sheets are rejected. Archive size/expansion, XML, worksheet and cell limits are enforced. Fonts, colors and column widths do not determine acceptance.
- The server reads the original multipart workbook; browser-provided headers/rows cannot create an uploaded list. Validation is all-or-nothing per workbook and occurs before repository writes, superseding older revisions, notifications or audit writes for successful imports. Existing saved lists and the price-change approval workflow are unchanged.
- Only Price/pc and Price/box are adjusted: `adjusted price = original price × (1 + percentage / 100)`. A new percentage is always calculated from the uploaded price, so adjustments never compound.
- Exports keep the workbook's layout: per-category sheets in Excel, and grouped tables with product photos in the PDF. The PDF header shows the price level, country, revision, and approver.

### Import regression checks

Run `node tests/workbook-import.test.cjs` (set `PLA_TEST_PHP` if PHP is not at `C:/xampp/php/php.exe`). The suite uses the actual template downloader and PHP workbook reader, disposable Excel files, and an isolated localhost upload API fixture. It checks both layouts, optional/empty categories, exact headers, invalid rows, archive/XML restrictions, size limits, multipart-only imports, CSRF/permissions, and existing-list saves without accessing company sessions or application storage. PHP requires its built-in Phar support plus DOM, Fileinfo, Mbstring and Zlib; a separate ZIP extension is not needed.

The compact upload window keeps file selection and metadata separate from the optional Template rules view. Its header/actions stay visible; only long file queues, error details, or the help content scroll when needed. `node tests/upload-modal.test.cjs` checks the real UI in isolated headless Edge (override its path with `PLA_TEST_EDGE`), including responsive sizes, keyboard navigation, dropdowns, busy/error/retry states and dark mode. No real sessions or application data are used.

## Out of scope

Following the documentation, the system does not:
- pull prices from external systems
- email or distribute exported files
- let regular users edit prices
- create price lists from scratch (upload a file first)
- track changes made to exported files outside the system

Invoice and Packing List creation (Requirements.xlsx › INV-PL Creation) is a separate process and is not part of this system.
