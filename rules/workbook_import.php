<?php
declare(strict_types=1);

/** The same contract drives the download, column guide and server-side import. */
function price_list_template(): array
{
    static $template = null;
    return $template ??= json_decode(file_get_contents(__DIR__ . '/price_list_template.json'), true, 512, JSON_THROW_ON_ERROR);
}

/**
 * A workbook that doesn't follow the template. The message is the headline; `problems` lists every
 * issue found (unknown sheets, a missing Instructions sheet, the first error in each category
 * sheet), so one upload shows everything that needs fixing instead of only the first thing.
 */
final class WorkbookTemplateException extends RuntimeException
{
    public function __construct(string $message, public readonly array $problems = [])
    {
        parent::__construct($message);
    }
}

/**
 * Bounded, values-only OOXML reader for the two approved layouts. It does not execute
 * formulas, extract archive files, resolve external XML entities or trust client rows.
 * PharData is built into this PHP installation; no change to php.ini is necessary.
 */
final class OfficialPriceWorkbook
{
    private const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    private const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
    private const DOC_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    private const MAX_PART_BYTES = 16777216;
    private const MAX_EXPANDED_BYTES = 50331648;
    private const MAX_ENTRIES = 1000; // the export price list carries a few hundred product photos
    private const MAX_ROWS = 20000;
    private const MAX_CELLS = 400000;

    private array $parts = [];
    private array $strings = [];
    private int $cellCount = 0;
    private PharData $archive;

    public static function read(string $path, string $country, string $priceLevel): array
    {
        $reader = new self();
        $directory = sys_get_temp_dir() . '/pla_workbook_' . bin2hex(random_bytes(12));
        if (!mkdir($directory, 0700)) throw new RuntimeException('Cannot create workbook validation directory.');
        $archivePath = $directory . '/workbook.zip';
        try {
            $reader->inspectZip($path);
            if (!copy($path, $archivePath)) throw new RuntimeException('Cannot read uploaded workbook.');
            $reader->archive = new PharData($archivePath, FilesystemIterator::SKIP_DOTS, null, Phar::ZIP);
            return $reader->import($country, $priceLevel);
        } catch (WorkbookTemplateException $error) {
            throw $error;
        } catch (Throwable $error) {
            error_log('Workbook validation: ' . $error->getMessage());
            throw new WorkbookTemplateException('Unable to read this workbook. Upload an unencrypted .xlsx using the official template.');
        } finally {
            unset($reader->archive);
            if (is_file($archivePath)) unlink($archivePath);
            rmdir($directory);
        }
    }

    /** Inspect the ZIP directory before decompressing anything, including hidden parts. */
    private function inspectZip(string $path): void
    {
        $size = filesize($path);
        if ($size === false || $size < 22 || $size > price_list_template()['maxFileBytes']) {
            $this->fail('Workbook must be a valid .xlsx of no more than 10 MB.');
        }
        $bytes = file_get_contents($path);
        if ($bytes === false || substr($bytes, 0, 4) !== "PK\x03\x04") $this->fail('File contents are not an .xlsx workbook.');
        $end = strrpos($bytes, "PK\x05\x06");
        if ($end === false || $end + 22 > $size) $this->fail('The workbook archive is invalid.');
        $directory = unpack('vdisk/vstartDisk/vdiskCount/vcount/Vlength/Voffset/vcomment', substr($bytes, $end + 4, 18));
        if ($directory['disk'] || $directory['startDisk'] || $directory['diskCount'] !== $directory['count']
            || $directory['count'] < 1 || $directory['count'] > self::MAX_ENTRIES
            || $end + 22 + $directory['comment'] !== $size
            || $directory['offset'] + $directory['length'] !== $end) {
            $this->fail('Unsupported or oversized workbook archive.');
        }
        $position = $directory['offset'];
        $expanded = 0;
        $seen = [];
        for ($i = 0; $i < $directory['count']; $i++) {
            if ($position + 46 > $end || substr($bytes, $position, 4) !== "PK\x01\x02") $this->fail('The workbook archive is invalid.');
            $part = unpack('vmade/vneeded/vflags/vmethod/vtime/vdate/Vcrc/Vcompressed/Vexpanded/vnameLength/vextraLength/vcommentLength/vdisk/vinternal/Vexternal/Voffset', substr($bytes, $position + 4, 42));
            $entryLength = 46 + $part['nameLength'] + $part['extraLength'] + $part['commentLength'];
            if ($position + $entryLength > $end) $this->fail('The workbook archive is invalid.');
            $name = substr($bytes, $position + 46, $part['nameLength']);
            $key = strtolower($name);
            if (isset($seen[$key]) || !preg_match('~^[A-Za-z0-9_\[\]./\-]+$~D', $name)
                || str_starts_with($name, '/') || preg_match('~(?:^|/)\.\.?(/|$)~', $name)) {
                $this->fail('Workbook contains duplicate or unsafe archive entries.');
            }
            $seen[$key] = true;
            if ($part['disk'] || ($part['flags'] & 65) || !in_array($part['method'], [0, 8], true)
                || (($part['external'] >> 16) & 0170000) === 0120000) {
                $this->fail('Encrypted or unsupported workbook contents are not accepted.');
            }
            $expanded += $part['expanded'];
            if ($part['expanded'] > self::MAX_PART_BYTES || $expanded > self::MAX_EXPANDED_BYTES
                || $part['expanded'] > max(1, $part['compressed']) * 200) {
                $this->fail('Workbook exceeds the safe decompression limits.');
            }
            $local = $part['offset'];
            if ($local + 30 > $directory['offset'] || substr($bytes, $local, 4) !== "PK\x03\x04") $this->fail('The workbook archive is invalid.');
            $localHeader = unpack('vneeded/vflags/vmethod/vtime/vdate/Vcrc/Vcompressed/Vexpanded/vnameLength/vextraLength', substr($bytes, $local + 4, 26));
            if ($localHeader['flags'] !== $part['flags'] || $localHeader['method'] !== $part['method']
                || substr($bytes, $local + 30, $localHeader['nameLength']) !== $name
                || $local + 30 + $localHeader['nameLength'] + $localHeader['extraLength'] + $part['compressed'] > $directory['offset']) {
                $this->fail('The workbook archive is inconsistent.');
            }
            foreach (['crc', 'compressed', 'expanded'] as $field) {
                if ($localHeader[$field] !== $part[$field] && (!(($part['flags'] & 8)) || $localHeader[$field] !== 0)) $this->fail('The workbook archive is inconsistent.');
            }
            if (!str_ends_with($name, '/')) {
                // Pictures, their drawing links, printer settings and Excel's calculation order are listed
                // here but never opened (only sheet XML is read), so they are safe to carry.
                if (!preg_match('~^(?:\[Content_Types\]\.xml|_rels/\.rels|docProps/(?:app|core|custom)\.xml|docProps/thumbnail\.(?:jpe?g|png|wmf|emf)|xl/(?:workbook\.xml|styles\.xml|metadata\.xml|sharedStrings\.xml|calcChain\.xml|_rels/workbook\.xml\.rels|theme/theme[0-9]+\.xml|worksheets/sheet[0-9]+\.xml|worksheets/_rels/sheet[0-9]+\.xml\.rels|drawings/drawing[0-9]+\.xml|drawings/_rels/drawing[0-9]+\.xml\.rels|media/[A-Za-z0-9_]+\.(?i:png|jpe?g|gif|bmp|tiff?|emf|wmf|wdp)|printerSettings/printerSettings[0-9]+\.bin|persons/person\.xml))$~D', $name)) {
                    $this->fail("Workbook contains unsupported parts ({$name}). Macros, embedded objects, hyperlinks and external links are not accepted.");
                }
                $this->parts[$name] = $part['expanded'];
            } elseif ($part['expanded'] !== 0) {
                $this->fail('Invalid workbook archive directory.');
            }
            $position += $entryLength;
        }
        if ($position !== $end) $this->fail('The workbook archive is invalid.');
    }

    private function xml(string $part): DOMDocument
    {
        if (!isset($this->parts[$part])) $this->fail("Workbook is missing {$part}. Download the official template.");
        $content = $this->archive[$part]->getContent();
        if (strlen($content) !== $this->parts[$part] || preg_match('/<!\s*(?:DOCTYPE|ENTITY)\b/i', $content)) {
            $this->fail('Workbook XML is unsafe or invalid.');
        }
        $document = new DOMDocument();
        $document->resolveExternals = false;
        $document->substituteEntities = false;
        $previous = libxml_use_internal_errors(true);
        try {
            if (!$document->loadXML($content, LIBXML_NONET | LIBXML_COMPACT)) $this->fail('Workbook contains invalid XML.');
            if ($document->doctype !== null) $this->fail('Workbook XML is unsafe or invalid.');
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        return $document;
    }

    private function xpath(DOMDocument $document): DOMXPath
    {
        if ($document->documentElement?->namespaceURI !== self::NS) $this->fail('Unsupported workbook XML format. Use the official .xlsx template.');
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('m', self::NS);
        return $xpath;
    }

    private function relationships(string $part, string $base): array
    {
        $document = $this->xml($part);
        if ($document->documentElement?->namespaceURI !== self::REL_NS) $this->fail('Invalid workbook relationships.');
        $result = [];
        foreach ($document->documentElement->childNodes as $node) {
            if (!$node instanceof DOMElement) continue;
            $id = $node->getAttribute('Id');
            $target = $node->getAttribute('Target');
            if ($node->localName !== 'Relationship' || !$id || isset($result[$id])
                || !in_array($node->getAttribute('TargetMode'), ['', 'Internal'], true)
                || str_contains($target, '\\') || str_contains($target, ':') || str_contains($target, '%') || str_contains($target, '?') || str_contains($target, '#')) {
                $this->fail('External or invalid workbook relationships are not accepted.');
            }
            $segments = [];
            foreach (explode('/', str_starts_with($target, '/') ? substr($target, 1) : $base . $target) as $segment) {
                if ($segment === '' || $segment === '.') continue;
                if ($segment === '..') {
                    if (!$segments) $this->fail('Invalid workbook relationship path.');
                    array_pop($segments);
                } else $segments[] = $segment;
            }
            $target = implode('/', $segments);
            if (!isset($this->parts[$target])) $this->fail('Workbook relationship points to missing or unsupported contents.');
            $result[$id] = ['target' => $target, 'type' => $node->getAttribute('Type')];
        }
        return $result;
    }

    private function import(string $country, string $priceLevel): array
    {
        $template = price_list_template();
        $types = $this->xml('[Content_Types].xml');
        if ($types->documentElement?->namespaceURI !== 'http://schemas.openxmlformats.org/package/2006/content-types' || $types->documentElement->localName !== 'Types') $this->fail('Invalid workbook content types.');
        $xlsxType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
        $hasWorkbook = false;
        foreach ($types->documentElement->childNodes as $node) {
            if (!$node instanceof DOMElement) continue;
            $type = $node->getAttribute('ContentType');
            // Some writers declare an unused .bin default even for plain .xlsx files.
            // Actual binary entries are rejected by the package allowlist above.
            if ($node->localName === 'Override' && (stripos($type, 'macro') !== false || stripos($type, 'vba') !== false || stripos($type, 'oleObject') !== false)) $this->fail('Macro-enabled or embedded workbook contents are not accepted.');
            if ($node->getAttribute('PartName') === '/xl/workbook.xml' && $type === $xlsxType) $hasWorkbook = true;
        }
        if (!$hasWorkbook) $this->fail('Only the official .xlsx workbook format is accepted.');
        $rootRelations = $this->relationships('_rels/.rels', '');
        if (!array_filter($rootRelations, fn($r) => $r['type'] === self::DOC_REL_NS . '/officeDocument' && $r['target'] === 'xl/workbook.xml')) $this->fail('Invalid workbook document.');
        $relations = $this->relationships('xl/_rels/workbook.xml.rels', 'xl/');
        foreach (array_keys($this->parts) as $part) {
            if (str_starts_with($part, 'docProps/') || str_starts_with($part, 'xl/theme/') || in_array($part, ['xl/styles.xml', 'xl/metadata.xml'], true)) $this->xml($part);
        }
        if (isset($this->parts['xl/persons/person.xml'])) $this->xml('xl/persons/person.xml');
        if (isset($this->parts['xl/sharedStrings.xml'])) {
            $document = $this->xml('xl/sharedStrings.xml');
            $xpath = $this->xpath($document);
            foreach ($xpath->query('/m:sst/m:si') as $node) {
                $this->strings[] = $this->text($xpath, $node);
                if (count($this->strings) > 200000) $this->fail('Workbook contains too many shared strings.');
            }
            unset($xpath, $document);
        }
        $document = $this->xml('xl/workbook.xml');
        $xpath = $this->xpath($document);
        $products = [];
        $seenCodes = [];
        $seenSheets = [];
        $usedParts = [];
        // 1. Which sheets are there? (Broken or unsafe sheet entries still stop the check at once.)
        $sheets = [];
        $hidden = [];
        foreach ($xpath->query('/m:workbook/m:sheets/m:sheet') as $sheet) {
            $name = $sheet->getAttribute('name');
            $id = $sheet->getAttributeNS(self::DOC_REL_NS, 'id');
            if (isset($seenSheets[$name]) || !isset($relations[$id]) || $relations[$id]['type'] !== self::DOC_REL_NS . '/worksheet'
                || !preg_match('~^xl/worksheets/sheet[0-9]+\.xml$~D', $relations[$id]['target']) || isset($usedParts[$relations[$id]['target']])) {
                $this->fail('Workbook contains duplicate or invalid worksheets.');
            }
            if ($sheet->getAttribute('state') !== '' && $sheet->getAttribute('state') !== 'visible') $hidden[] = $name;
            $seenSheets[$name] = true;
            $usedParts[$relations[$id]['target']] = true;
            $sheets[] = ['name' => $name, 'part' => $relations[$id]['target']];
        }
        foreach (array_keys($this->parts) as $part) {
            if (str_starts_with($part, 'xl/worksheets/sheet') && !isset($usedParts[$part])) $this->fail('Workbook contains an unregistered worksheet.');
        }
        $names = array_column($sheets, 'name');
        // The company's export price list (the file the team keeps: product photos, a title row above each
        // product group, formulas) is read as it is. Otherwise the strict template rules below apply.
        if (!in_array($template['instructionsSheet'], $names, true) && $this->looksLikeExportList($sheets, $hidden)) {
            return $this->readExportList($sheets, $hidden, $country, $priceLevel);
        }
        // Google Sheets adds an empty drawing to every sheet. Those are fine; in the template, a drawing
        // with anything in it (a picture, shape or chart) is not.
        foreach (array_keys($this->parts) as $part) {
            if (!preg_match('~^xl/drawings/drawing[0-9]+\.xml$~', $part)) continue;
            $drawing = $this->xml($part)->documentElement;
            $empty = $drawing?->localName === 'wsDr' && !array_filter(iterator_to_array($drawing->childNodes), fn($node) => $node instanceof DOMElement);
            if (!$empty) $this->fail('Workbook contains pictures, shapes or charts. Remove them and keep only the price list values.');
        }
        foreach (array_keys($this->parts) as $part) {
            if (str_starts_with($part, 'xl/media/') || str_starts_with($part, 'xl/printerSettings/') || str_starts_with($part, 'xl/drawings/_rels/')) {
                $this->fail('Workbook contains pictures, shapes or charts. Remove them and keep only the price list values.');
            }
        }
        // 2. Each sheet is recognised by its header rows, not its name: any sheet whose headers match an
        //    approved layout is a category (the sheet name becomes the category), so new categories can
        //    be added by copying a category sheet and renaming it.
        $instructions = $template['instructionsSheet'];
        $hasInstructions = in_array($instructions, $names, true);
        $quote = fn(array $list) => implode(', ', array_map(fn($name) => '"' . $name . '"', $list));
        $layoutLabel = ['standard' => 'product', 'presentation' => 'presentation stand'];
        $startsWith = fn(string $key) => implode(' · ', array_slice(array_filter($template['layouts'][$key]['headerRows'][0], fn($cell) => $cell !== ''), 0, 3)) . '…';
        $detected = [];   // sheet name => layout key
        $unrecognised = []; // sheet name => what's wrong with its headers
        foreach ($sheets as $sheet) {
            if ($sheet['name'] === $instructions || in_array($sheet['name'], $hidden, true)) continue;
            $match = $this->detectLayout($sheet['part'], $template['layouts']);
            if (isset($match['layout'])) $detected[$sheet['name']] = $match['layout'];
            else $unrecognised[$sheet['name']] = $match;
        }

        // 3. Nothing looks like the template at all: say that plainly, about headers (not names).
        if (!$detected && !$hasInstructions) {
            $this->fail('This workbook doesn\'t follow the price list template.', [
                'None of its sheets (' . $quote($names) . ') have the template\'s column headers.',
                'Each product sheet needs the template headers in its first rows: ' . $startsWith('standard') . ' for products, or ' . $startsWith('presentation') . ' for presentation stands. The sheet name becomes the category, so you can add your own.',
                'Download the official template from this window and copy your products into it.',
            ]);
        }

        // 4. Partly matching: collect every problem instead of stopping at the first.
        $problems = [];
        foreach ($unrecognised as $name => $match) {
            if ($match['close'] ?? null) {
                // Most headers are right: point at the exact cell that differs.
                [$row, $column, $expected, $actual] = $match['close'];
                $problems[] = "\"{$name}\"!" . $this->letter($column) . $row . ': expected ' . ($expected === '' ? 'an empty header cell' : "\"{$expected}\"") . ($actual !== '' ? ", found \"{$actual}\"" : '') . '. The headers must match the template exactly (' . $layoutLabel[$match['closest']] . ' layout).';
            } else {
                $problems[] = "\"{$name}\" doesn't have the template's column headers. Remove the sheet, or give it the template headers to make it a category.";
            }
        }
        if ($hidden) $problems[] = 'Hidden sheets are not accepted: ' . $quote($hidden) . '. Unhide or delete them.';
        if (!$hasInstructions) $problems[] = "The \"{$instructions}\" sheet (with the template version) is missing. Start from the current official template.";
        foreach ($sheets as $sheet) {
            $name = $sheet['name'];
            if ($name !== $instructions && !isset($detected[$name])) continue;
            try {
                if ($name === $instructions) {
                    $this->validateSheet($name, $sheet['part'], $template['instructions'], [], [], $products, $seenCodes, $country, $priceLevel);
                } else {
                    $layout = $template['layouts'][$detected[$name]];
                    $this->validateSheet($name, $sheet['part'], $layout['headerRows'], $layout['merges'], $layout['columns'], $products, $seenCodes, $country, $priceLevel);
                }
            } catch (WorkbookTemplateException $error) {
                if (str_starts_with($error->getMessage(), 'Workbook ')) throw $error; // whole-file limits (size, cells, XML) stop at once
                $problems[] = $error->getMessage(); // the first problem in this sheet; the other sheets are still checked
            }
        }
        if (!$problems && !$products) $problems[] = 'The workbook contains no products. Fill at least one category sheet.';
        if ($problems) {
            $this->fail(count($problems) === 1 ? $problems[0] : count($problems) . ' things need fixing in this workbook:', count($problems) === 1 ? [] : $problems);
        }
        // layouts: category (sheet name) => 'standard' | 'presentation', for the price masterlist.
        return ['headers' => $template['normalizedHeaders'], 'rows' => $products, 'priceColumns' => [8, 9], 'templateVersion' => $template['version'], 'layouts' => $detected];
    }

    // -----------------------------------------------------------------------------------------------
    // The export price list: the workbook the team keeps ("LRN Export PL …"). Each category sheet holds
    // blocks of products: a title row (the product group) in column A, a header block ("Code No …",
    // then the 40ft / 20ft and pallet-size rows), then its products. Presentation Stands has one header
    // row ("LRN code …") with section title rows as groups. Columns are found by their header text, not
    // their position. Pictures are ignored; formula cells are read as Excel's saved result, and the
    // formula is kept with the product.
    // -----------------------------------------------------------------------------------------------

    /** Simplified header text for matching ("Price/box in USD " → "price/box in usd"). */
    private static function headerKey(mixed $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', mb_strtolower((string) $text)));
    }

    /** Which normalized column a header belongs to, or null (see normalizedHeaders in the template). */
    private static function exportColumn(string $key, string $layout): ?int
    {
        if ($key === '') return null;
        if ($layout === 'presentation') {
            return match (true) {
                in_array($key, ['lrn code', 'code no', 'code'], true) => 1,
                str_starts_with($key, 'item name') || $key === 'description' => 2,
                str_contains($key, 'per box') => 6,
                str_starts_with($key, 'price/pc') => 8,
                str_starts_with($key, 'price/box') => 9,
                str_starts_with($key, 'nw') => 13,
                str_starts_with($key, 'gw') => 14,
                $key === 'box size' => 7,
                $key === 'moq' => 15,
                str_contains($key, 'total price') => 17,
                default => null,
            };
        }
        return match (true) {
            str_starts_with($key, 'code') => 1,
            str_starts_with($key, 'description') => 2,
            str_starts_with($key, 'expiry') => 4,
            str_starts_with($key, 'weight') => 5,
            str_starts_with($key, 'pcs') => 6,
            $key === 'box size' => 7,
            str_starts_with($key, 'price/pc') => 8,
            str_starts_with($key, 'price/box') => 9,
            str_contains($key, '16 pallets') => 10,
            str_contains($key, '(2 pallets)') => 11,
            str_contains($key, '(8 pallets)') => 12,
            default => null,
        };
    }

    /**
     * True when a visible sheet has the export price list's header row ("Code No" or "LRN code") and no
     * sheet follows the system's own template (a template workbook, even an incomplete one, gets the
     * template's strict checks).
     */
    private function looksLikeExportList(array $sheets, array $hidden): bool
    {
        $found = false;
        foreach ($sheets as $sheet) {
            if (in_array($sheet['name'], $hidden, true)) continue;
            $match = $this->detectLayout($sheet['part'], price_list_template()['layouts']);
            if (isset($match['layout']) || ($match['close'] ?? null)) return false;
            foreach ($this->headerCells($sheet['part'], 60) as $row) {
                foreach ($row as $value) if (in_array(self::headerKey($value), ['code no', 'lrn code'], true)) $found = true;
            }
        }
        return $found;
    }

    /** A copy of a shared formula, moved from its first cell to another (relative references follow). */
    private function shiftFormula(string $formula, int $fromRow, int $fromColumn, int $toRow, int $toColumn): string
    {
        return (string) preg_replace_callback('/(?<![A-Za-z0-9_.!])(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})(?![A-Za-z0-9_(])/', function (array $m) use ($fromRow, $fromColumn, $toRow, $toColumn) {
            $column = 0;
            foreach (str_split($m[2]) as $letter) $column = $column * 26 + ord($letter) - 64;
            $column--;
            $newColumn = $m[1] === '$' ? $column : $column + ($toColumn - $fromColumn);
            $newRow = $m[3] === '$' ? (int) $m[4] : (int) $m[4] + ($toRow - $fromRow);
            return $newColumn < 0 || $newRow < 1 ? $m[0] : $m[1] . $this->letter($newColumn) . $m[3] . $newRow;
        }, $formula);
    }

    /** Every cell of a sheet: [row => [column => ['v' => value, 'f' => '=formula' or null, 'noValue' => bool]]]. */
    private function sheetCells(string $name, string $part): array
    {
        $document = $this->xml($part);
        $xpath = $this->xpath($document);
        if ($document->documentElement->localName !== 'worksheet') $this->fail("{$name}: invalid worksheet.");
        $cells = [];
        $shared = [];
        $previousRow = 0;
        foreach ($xpath->query('/m:worksheet/m:sheetData/m:row') as $row) {
            $rowNumber = filter_var($row->getAttribute('r'), FILTER_VALIDATE_INT);
            if (!$rowNumber || $rowNumber <= $previousRow || $rowNumber > self::MAX_ROWS) $this->fail("{$name}: invalid or oversized row numbering.");
            $previousRow = $rowNumber;
            foreach ($xpath->query('./m:c', $row) as $cell) {
                if (++$this->cellCount > self::MAX_CELLS) $this->fail('Workbook contains too many cells.');
                [$cellRow, $column] = $this->coordinate($cell->getAttribute('r'));
                if ($cellRow !== $rowNumber) $this->fail("{$name}: invalid cell at {$cell->getAttribute('r')}.");
                if ($column >= 60) continue; // far to the right of any price list column
                $formula = null;
                $f = $xpath->query('./m:f', $cell)->item(0);
                if ($f instanceof DOMElement) {
                    $text = $f->textContent;
                    if ($f->getAttribute('t') === 'shared') {
                        $si = $f->getAttribute('si');
                        if ($text !== '') $shared[$si] = [$text, $cellRow, $column];
                        elseif (isset($shared[$si])) $text = $this->shiftFormula($shared[$si][0], $shared[$si][1], $shared[$si][2], $cellRow, $column);
                    }
                    if ($text !== '') $formula = '=' . $text;
                }
                $hasValue = $xpath->query('./m:v | ./m:is', $cell)->length > 0;
                $value = $this->value($xpath, $cell, $name);
                $cells[$cellRow][$column] = ['v' => is_string($value) ? trim($value) : $value, 'f' => $formula, 'noValue' => $formula !== null && !$hasValue];
            }
        }
        return $cells;
    }

    private function readExportList(array $sheets, array $hidden, string $country, string $priceLevel): array
    {
        $template = price_list_template();
        $width = count($template['normalizedHeaders']);
        $products = [];
        $formulas = [];  // product index => [column => ['excel' => '=ROUND(J6/G6,3)', 'cell' => 'I6', 'expr' => 'ROUND({9}/{6},3)' or null]]
        $layouts = [];
        $skipped = [];
        $problems = [];
        $seenCodes = [];
        $names = ['1' => 'Code', '2' => 'Description', '6' => 'Pieces per box', '8' => 'Price/pc', '9' => 'Price/box'];
        foreach ($sheets as $sheet) {
            $name = $sheet['name'];
            if (in_array($name, $hidden, true)) { $skipped[] = "{$name} (hidden)"; continue; }
            $cells = $this->sheetCells($name, $sheet['part']);
            ksort($cells);
            $map = null;
            $layout = null;
            $codeColumn = null;
            $headerEnd = 0;
            $group = '';
            foreach ($cells as $r => $row) {
                ksort($row);
                $keys = array_map(fn($cell) => self::headerKey($cell['v']), $row);
                $headerLayout = in_array('lrn code', $keys, true) ? 'presentation' : (in_array('code no', $keys, true) ? 'standard' : null);
                if ($headerLayout) {
                    // A header block: which column holds what, for the products below it.
                    $layout = $headerLayout;
                    $map = [];
                    foreach ($keys as $c => $key) {
                        $target = self::exportColumn($key, $layout);
                        if ($target !== null && !in_array($target, $map, true)) $map[$c] = $target;
                    }
                    if ($layout === 'standard') {
                        foreach ([1, 2] as $below) foreach ($cells[$r + $below] ?? [] as $c => $cell) {
                            $target = self::exportColumn(self::headerKey($cell['v']), 'standard');
                            if (in_array($target, [10, 11, 12], true) && !in_array($target, $map, true)) $map[$c] = $target;
                        }
                        $headerEnd = $r + 2;
                    } else {
                        // Columns without a header of their own: the second description line, the MOQ number.
                        foreach ([2 => 3, 15 => 16] as $beside => $target) {
                            $c = array_search($beside, $map, true);
                            if ($c !== false && !isset($map[$c + 1]) && self::headerKey($row[$c + 1]['v'] ?? '') === '') $map[$c + 1] = $target;
                        }
                        $headerEnd = $r;
                    }
                    $found = array_search(1, $map, true);
                    $codeColumn = $found === false ? null : $found;
                    $layouts[$name] = $layout;
                    continue;
                }
                if ($r <= $headerEnd) continue;
                $code = $codeColumn !== null ? trim((string) ($row[$codeColumn]['v'] ?? '')) : '';
                if ($code === '') {
                    // A title row (text only, left of the codes): the group of the products below it.
                    $texts = array_filter($row, fn($cell) => is_string($cell['v']) && $cell['v'] !== '');
                    $first = array_key_first($texts);
                    if ($texts && count($texts) <= 2 && $first !== null && $first < ($codeColumn ?? 2)) $group = (string) $texts[$first]['v'];
                    continue;
                }
                if ($map === null) continue;
                $product = array_fill(0, $width, '');
                $product[0] = $name;
                $product[18] = $group !== '' ? $group : $name;
                $product[19] = $priceLevel;
                $product[20] = $country;
                $cellFormulas = [];
                foreach ($map as $c => $target) {
                    $cell = $row[$c] ?? null;
                    if (!$cell) continue;
                    $ref = $this->letter($c) . $r;
                    if ($cell['noValue']) {
                        $problems[] = "{$name}!{$ref}: this formula has no saved result. Open the file in Excel, let it calculate, and save it again.";
                        continue;
                    }
                    $product[$target] = $cell['v'];
                    if ($cell['f'] !== null) {
                        // Same-row references to known columns become {column}: the system can recalculate those.
                        $plain = true;
                        $expr = preg_replace_callback('/(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)([0-9]{1,7})(?![A-Za-z0-9_(])/', function (array $m) use ($r, $map, &$plain) {
                            $column = 0;
                            foreach (str_split($m[2]) as $letter) $column = $column * 26 + ord($letter) - 64;
                            if ((int) $m[4] !== $r || !isset($map[$column - 1])) { $plain = false; return $m[0]; }
                            return '{' . $map[$column - 1] . '}';
                        }, substr($cell['f'], 1));
                        if (str_contains($cell['f'], '!')) $plain = false;
                        $cellFormulas[$target] = ['excel' => $cell['f'], 'cell' => $ref, 'expr' => $plain ? $expr : null];
                    }
                }
                $at = "{$name}!" . $this->letter($codeColumn) . $r;
                if (mb_strlen($code) > 80 || preg_match('/[\x00-\x1F\x7F]/', $code)) { $problems[] = "{$at}: the code is too long or has invalid characters."; continue; }
                if (trim((string) $product[2]) === '') $problems[] = "{$at}: {$code} has no description.";
                foreach ([8, 9] as $column) {
                    $value = $product[$column];
                    if ($value === '' || $value === null) $problems[] = "{$at}: {$code} has no {$names[$column]}.";
                    elseif (!is_numeric($value) || (float) $value < 0) $problems[] = "{$at}: {$code}'s {$names[$column]} is not a number (\"{$value}\").";
                    else $product[$column] = (float) $value;
                }
                if (is_numeric($product[6]) && (float) $product[6] > 0) $product[6] = floor((float) $product[6]) === (float) $product[6] ? (int) $product[6] : (float) $product[6];
                elseif ($product[6] !== '') $problems[] = "{$at}: {$code}'s {$names[6]} is not a number (\"{$product[6]}\").";
                foreach ($product as $column => $value) {
                    if (is_string($value) && (mb_strlen($value) > 500 || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value))) $problems[] = "{$at}: {$code} has text that is too long or has invalid characters.";
                }
                $key = mb_strtolower($code);
                if (isset($seenCodes[$key])) { $problems[] = "{$at}: the code {$code} is also at {$seenCodes[$key]}. Each product code can appear once."; continue; }
                $seenCodes[$key] = $at;
                $products[] = $product;
                if ($cellFormulas) $formulas[count($products) - 1] = $cellFormulas;
                if (count($products) > $template['maxProducts']) $this->fail('Workbook exceeds 15,000 product rows.');
            }
            if ($layout === null) $skipped[] = $name; // no header row: not a product sheet (e.g. "Factory Picture")
        }
        if (!$products && !$problems) $problems[] = 'No products found: no sheet has a "Code No" or "LRN code" header row.';
        if ($problems) {
            $shown = array_slice($problems, 0, 40);
            if (count($problems) > 40) $shown[] = 'and ' . (count($problems) - 40) . ' more';
            $this->fail(count($problems) === 1 ? $problems[0] : count($problems) . ' things need fixing in this workbook:', count($problems) === 1 ? [] : $shown);
        }
        return [
            'headers' => $template['normalizedHeaders'], 'rows' => $products, 'priceColumns' => [8, 9], 'templateVersion' => 'LRN-EXPORT-PL',
            'layouts' => $layouts, 'formulas' => $formulas, 'skippedSheets' => $skipped,
        ];
    }

    /** The values in a sheet's first rows (where the headers are), without the full checks. */
    private function headerCells(string $part, int $rows): array
    {
        $xpath = $this->xpath($this->xml($part));
        $cells = [];
        foreach ($xpath->query('/m:worksheet/m:sheetData/m:row') as $row) {
            $rowNumber = (int) $row->getAttribute('r');
            if ($rowNumber > $rows) break;
            foreach ($xpath->query('./m:c', $row) as $cell) {
                [$cellRow, $column] = $this->coordinate($cell->getAttribute('r'));
                if ($cellRow <= $rows && $column < 40) $cells[$cellRow][$column] = $this->value($xpath, $cell, 'sheet');
            }
        }
        return $cells;
    }

    /**
     * Which approved layout a sheet's header rows match: ['layout' => key]. Otherwise the closest
     * layout and, when most of its headers are right, the first cell that differs (['close' => …]).
     */
    private function detectLayout(string $part, array $layouts): array
    {
        $depth = max(array_map(fn($layout) => count($layout['headerRows']), $layouts));
        $cells = $this->headerCells($part, $depth);
        $best = ['matched' => -1];
        foreach ($layouts as $key => $layout) {
            $matched = 0; $total = 0; $first = null;
            foreach ($layout['headerRows'] as $rowIndex => $headerRow) {
                foreach ($headerRow as $column => $expected) {
                    $actual = $cells[$rowIndex + 1][$column] ?? '';
                    if ($expected !== '') $total++;
                    if ($actual === $expected) { if ($expected !== '') $matched++; }
                    elseif ($first === null) $first = [$rowIndex + 1, $column, $expected, is_string($actual) ? $actual : (string) $actual];
                }
            }
            if ($first === null) return ['layout' => $key];
            if ($matched > $best['matched']) $best = ['matched' => $matched, 'total' => $total, 'first' => $first, 'layout' => $key];
        }
        // "Close" = at least half of the named headers are right: then it's meant to be a category sheet.
        return ['layout' => null, 'closest' => $best['layout'], 'close' => $best['matched'] * 2 >= $best['total'] ? $best['first'] : null];
    }

    private function validateSheet(string $name, string $part, array $headers, array $expectedMerges, array $columns, array &$products, array &$seenCodes, string $country, string $priceLevel): void
    {
        $document = $this->xml($part);
        $xpath = $this->xpath($document);
        if ($document->documentElement->localName !== 'worksheet') $this->fail("{$name}: invalid worksheet.");
        if ($xpath->query('//m:hyperlinks | //m:oleObjects | //m:legacyDrawing')->length) $this->fail("{$name}: hyperlinks and embedded objects are not accepted.");
        $relsPart = preg_replace('~^xl/worksheets/(sheet[0-9]+\.xml)$~', 'xl/worksheets/_rels/$1.rels', $part);
        $sheetRelations = isset($this->parts[$relsPart]) ? $this->relationships($relsPart, 'xl/worksheets/') : [];
        foreach ($sheetRelations as $relation) {
            if ($relation['type'] !== self::DOC_REL_NS . '/drawing' || !str_starts_with($relation['target'], 'xl/drawings/')) $this->fail("{$name}: hyperlinks, comments and embedded objects are not accepted.");
        }
        foreach ($xpath->query('/m:worksheet/m:drawing') as $drawing) {
            if (!isset($sheetRelations[$drawing->getAttributeNS(self::DOC_REL_NS, 'id')])) $this->fail("{$name}: invalid drawing reference.");
        }
        $width = count($headers[0]);
        $dimension = $xpath->query('/m:worksheet/m:dimension')->item(0);
        if ($dimension) {
            $end = explode(':', $dimension->getAttribute('ref'));
            [$rowNumber, $column] = $this->coordinate(end($end));
            if ($rowNumber > self::MAX_ROWS || $column >= $width) $this->fail("{$name}: extra columns or an oversized worksheet are not accepted.");
        }
        $merges = [];
        foreach ($xpath->query('/m:worksheet/m:mergeCells/m:mergeCell') as $merge) $merges[] = strtoupper($merge->getAttribute('ref'));
        sort($merges); sort($expectedMerges);
        if ($merges !== $expectedMerges) $this->fail("{$name}: header merges do not match the official template. Do not merge product cells or change the header structure.");
        $matrix = [];
        $previousRow = 0;
        foreach ($xpath->query('/m:worksheet/m:sheetData/m:row') as $row) {
            $rowNumber = filter_var($row->getAttribute('r'), FILTER_VALIDATE_INT);
            if (!$rowNumber || $rowNumber <= $previousRow || $rowNumber > self::MAX_ROWS) $this->fail("{$name}: invalid or oversized row numbering.");
            $previousRow = $rowNumber;
            foreach ($xpath->query('./m:c', $row) as $cell) {
                if (++$this->cellCount > self::MAX_CELLS) $this->fail('Workbook contains too many cells.');
                [$cellRow, $column] = $this->coordinate($cell->getAttribute('r'));
                if ($cellRow !== $rowNumber || $column >= $width || isset($matrix[$rowNumber][$column])) $this->fail("{$name}: invalid, duplicate or extra column at {$cell->getAttribute('r')}.");
                if ($xpath->query('./m:f', $cell)->length) $this->fail("{$name}!{$cell->getAttribute('r')}: formulas are not accepted. Paste values instead.");
                $matrix[$rowNumber][$column] = $this->value($xpath, $cell, $name);
            }
        }
        foreach ($headers as $rowIndex => $header) {
            foreach ($header as $column => $expected) {
                $actual = $matrix[$rowIndex + 1][$column] ?? '';
                if ($actual !== $expected) {
                    $coordinate = $this->letter($column) . ($rowIndex + 1);
                    $expectation = $expected === '' ? 'an empty header cell' : '"' . $expected . '"';
                    $this->fail("{$name}!{$coordinate}: expected {$expectation}. Headers and template version must exactly match the official template.");
                }
            }
        }
        foreach ($matrix as $rowNumber => $row) {
            if ($rowNumber <= count($headers) || !array_filter($row, fn($v) => $v !== '')) continue;
            if (!$columns) $this->fail("{$name}: keep the Instructions sheet unchanged.");
            $product = array_fill(0, count(price_list_template()['normalizedHeaders']), '');
            $product[0] = $name; $product[19] = $priceLevel; $product[20] = $country;
            foreach ($columns as $index => $definition) {
                $value = $row[$index] ?? '';
                $product[$definition['target']] = $this->validateValue($value, $definition, "{$name}!" . $this->letter($index) . $rowNumber);
            }
            $key = mb_strtolower((string) $product[1]);
            if (isset($seenCodes[$key])) $this->fail("{$name}!A{$rowNumber}: duplicate product code '{$product[1]}' (already at {$seenCodes[$key]}).");
            $seenCodes[$key] = "{$name}!A{$rowNumber}";
            $products[] = $product;
            if (count($products) > price_list_template()['maxProducts']) $this->fail('Workbook exceeds 15,000 product rows.');
        }
    }

    private function validateValue(mixed $value, array $definition, string $cell): string|float|int
    {
        if (is_string($value)) $value = trim($value);
        if ($value === '') {
            if ($definition['required'] ?? false) $this->fail("{$cell}: {$definition['name']} is required.");
            return '';
        }
        if ($definition['type'] === 'text') {
            $text = (string) $value;
            if (mb_strlen($text) > $definition['maxLength'] || preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $text) || str_starts_with($text, '=')) {
                $this->fail("{$cell}: {$definition['name']} contains invalid text or exceeds {$definition['maxLength']} characters.");
            }
            return $text;
        }
        if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < 0 || (float) $value > 1000000000
            || (($definition['positive'] ?? false) && (float) $value <= 0)
            || ($definition['type'] === 'integer' && floor((float) $value) !== (float) $value)) {
            $rule = $definition['type'] === 'integer' ? 'a positive whole number' : (($definition['positive'] ?? false) ? 'a positive number' : 'a non-negative number');
            $this->fail("{$cell}: {$definition['name']} must be {$rule}, no greater than 1,000,000,000.");
        }
        return $definition['type'] === 'integer' ? (int) $value : (float) $value;
    }

    private function value(DOMXPath $xpath, DOMElement $cell, string $sheet): string|float
    {
        $type = $cell->getAttribute('t');
        $value = $xpath->query('./m:v', $cell)->item(0)?->textContent ?? '';
        if ($type === 's') {
            if (!ctype_digit($value) || !array_key_exists((int) $value, $this->strings)) $this->fail("{$sheet}: invalid shared string.");
            return $this->strings[(int) $value];
        }
        if ($type === 'inlineStr') {
            $inline = $xpath->query('./m:is', $cell)->item(0);
            return $inline ? $this->text($xpath, $inline) : '';
        }
        if ($type === 'str' || $type === 'd') return $value;
        if ($type !== '' && $type !== 'n') $this->fail("{$sheet}!{$cell->getAttribute('r')}: boolean values and Excel errors are not accepted.");
        if ($value === '') return '';
        if (!is_numeric($value) || !is_finite((float) $value)) $this->fail("{$sheet}!{$cell->getAttribute('r')}: invalid numeric value.");
        // To 15 significant digits, as Excel shows it: a formula's saved result such as 0.64 + 0.5 is
        // 1.1400000000000001 in the file, which Excel (and now this) reads as 1.14.
        return (float) sprintf('%.15G', (float) $value);
    }

    private function text(DOMXPath $xpath, DOMNode $node): string
    {
        $text = '';
        foreach ($xpath->query('./m:t | ./m:r/m:t', $node) as $part) $text .= $part->textContent;
        if (mb_strlen($text) > 1000) $this->fail('Workbook contains oversized text values.');
        return $text;
    }

    private function coordinate(string $reference): array
    {
        if (!preg_match('/^([A-Z]{1,3})([1-9][0-9]{0,6})$/D', $reference, $match)) $this->fail('Workbook contains invalid cell coordinates.');
        $column = 0;
        foreach (str_split($match[1]) as $letter) $column = $column * 26 + ord($letter) - 64;
        return [(int) $match[2], $column - 1];
    }

    private function letter(int $column): string
    {
        $letter = '';
        do { $letter = chr(65 + $column % 26) . $letter; $column = intdiv($column, 26) - 1; } while ($column >= 0);
        return $letter;
    }

    private function fail(string $message, array $problems = []): never
    {
        throw new WorkbookTemplateException($message, $problems);
    }
}

/** Only PHP's received multipart file can enter the original-upload save path. */
function import_official_uploaded_workbook(array $file, string $country, string $priceLevel): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) throw new WorkbookTemplateException('Upload failed or exceeded the server limit. Choose an official .xlsx of no more than 10 MB.');
    $name = $file['name'] ?? '';
    $path = $file['tmp_name'] ?? '';
    if (!is_string($name) || !preg_match('/\.xlsx$/iD', $name) || !is_string($path) || !is_uploaded_file($path)) {
        throw new WorkbookTemplateException('Only an uploaded official .xlsx workbook is accepted. Download the current template.');
    }
    $type = (new finfo(FILEINFO_MIME_TYPE))->file($path);
    if (!in_array($type, ['application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], true)) {
        throw new WorkbookTemplateException('The uploaded file is not an .xlsx workbook.');
    }
    return OfficialPriceWorkbook::read($path, $country, $priceLevel) + ['sourceFile' => mb_substr(basename(str_replace('\\', '/', $name)), 0, 200)];
}
