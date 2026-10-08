<?php
declare(strict_types=1);

/** The same contract drives the download, column guide and server-side import. */
function price_list_template(): array
{
    static $template = null;
    return $template ??= json_decode(file_get_contents(__DIR__ . '/price_list_template.json'), true, 512, JSON_THROW_ON_ERROR);
}

final class WorkbookTemplateException extends RuntimeException {}

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
    private const MAX_ENTRIES = 200;
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
                if (!preg_match('~^(?:\[Content_Types\]\.xml|_rels/\.rels|docProps/(?:app|core|custom)\.xml|xl/(?:workbook\.xml|styles\.xml|metadata\.xml|sharedStrings\.xml|_rels/workbook\.xml\.rels|theme/theme[0-9]+\.xml|worksheets/sheet[0-9]+\.xml))$~D', $name)) {
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
        $categories = array_column($template['categories'], null, 'name');
        $products = [];
        $seenCodes = [];
        $seenSheets = [];
        $usedParts = [];
        $hasInstructions = false;
        foreach ($xpath->query('/m:workbook/m:sheets/m:sheet') as $sheet) {
            $name = $sheet->getAttribute('name');
            $id = $sheet->getAttributeNS(self::DOC_REL_NS, 'id');
            if (isset($seenSheets[$name]) || !isset($relations[$id]) || $relations[$id]['type'] !== self::DOC_REL_NS . '/worksheet'
                || !preg_match('~^xl/worksheets/sheet[0-9]+\.xml$~D', $relations[$id]['target']) || isset($usedParts[$relations[$id]['target']])) {
                $this->fail('Workbook contains duplicate or invalid worksheets.');
            }
            if ($sheet->getAttribute('state') !== '' && $sheet->getAttribute('state') !== 'visible') $this->fail("{$name}: hidden worksheets are not accepted.");
            $seenSheets[$name] = true;
            $usedParts[$relations[$id]['target']] = true;
            if ($name === $template['instructionsSheet']) {
                $this->validateSheet($name, $relations[$id]['target'], $template['instructions'], [], [], $products, $seenCodes, $country, $priceLevel);
                $hasInstructions = true;
            } elseif (isset($categories[$name])) {
                $layout = $template['layouts'][$categories[$name]['layout']];
                $this->validateSheet($name, $relations[$id]['target'], $layout['headerRows'], $layout['merges'], $layout['columns'], $products, $seenCodes, $country, $priceLevel);
            } else $this->fail("{$name}: worksheet is not part of the official template. Use the original category sheet names.");
        }
        foreach (array_keys($this->parts) as $part) {
            if (str_starts_with($part, 'xl/worksheets/') && !isset($usedParts[$part])) $this->fail('Workbook contains an unregistered worksheet.');
        }
        if (!$hasInstructions) $this->fail('Missing Instructions sheet and template version. Download the current official template.');
        if (!$products) $this->fail('The workbook contains no products. Fill at least one category worksheet.');
        return ['headers' => $template['normalizedHeaders'], 'rows' => $products, 'priceColumns' => [8, 9], 'templateVersion' => $template['version']];
    }

    private function validateSheet(string $name, string $part, array $headers, array $expectedMerges, array $columns, array &$products, array &$seenCodes, string $country, string $priceLevel): void
    {
        $document = $this->xml($part);
        $xpath = $this->xpath($document);
        if ($document->documentElement->localName !== 'worksheet') $this->fail("{$name}: invalid worksheet.");
        if ($xpath->query('//m:hyperlinks | //m:oleObjects | //m:drawing | //m:legacyDrawing')->length) $this->fail("{$name}: hyperlinks and embedded objects are not accepted.");
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
        return (float) $value;
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

    private function fail(string $message): never
    {
        throw new WorkbookTemplateException($message);
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
