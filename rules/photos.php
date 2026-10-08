<?php
declare(strict_types=1);
/**
 * Photo library ("drawer") uploads and product-type photo files.
 */

require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/../repository/store.php';
require_once __DIR__ . '/../authz/audit.php';

/** Turns $_FILES entries (single or multiple) into a flat list of upload arrays. */
function normalize_uploaded_files(mixed $entry): array
{
    if (!is_array($entry) || !isset($entry['name'])) return [];
    if (!is_array($entry['name'])) return [$entry];
    $files = [];
    foreach (array_keys($entry['name']) as $index) {
        $files[] = [
            'name' => $entry['name'][$index] ?? '',
            'tmp_name' => $entry['tmp_name'][$index] ?? '',
            'size' => $entry['size'][$index] ?? 0,
            'error' => $entry['error'][$index] ?? UPLOAD_ERR_NO_FILE,
        ];
    }
    return $files;
}

/** Category folders are labels, never directories or user-supplied file paths. */
function normalize_library_category(mixed $value): string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) throw new InvalidArgumentException('Choose a valid photo folder.');
    $category = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    if (mb_strlen($category) > 120 || preg_match('/[\x00-\x1f\x7f]/u', $category)) {
        throw new InvalidArgumentException('Folder names must be at most 120 characters and contain no control characters.');
    }
    return $category;
}

/** Validates one uploaded image, stores it in the photo library and returns its record. */
function store_library_photo(array $file, array $user, string $category = ''): array
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) throw new InvalidArgumentException('The upload did not complete.');
    $size = (int) ($file['size'] ?? 0);
    if ($size < 1 || $size > 6 * 1024 * 1024) throw new InvalidArgumentException('Images must be smaller than 6 MB.');
    $temporaryPath = (string) ($file['tmp_name'] ?? '');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($temporaryPath) ?: '';
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime])) throw new InvalidArgumentException('Use a JPG, PNG, or WebP image.');
    $dimensions = @getimagesize($temporaryPath);
    if (!$dimensions || $dimensions[0] < 120 || $dimensions[1] < 120 || $dimensions[0] > 6000 || $dimensions[1] > 6000) {
        throw new InvalidArgumentException('Images must be between 120 and 6,000 pixels in each direction.');
    }
    $category = normalize_library_category($category);
    if ($category !== '') $category = repo_add_library_folder($category);
    $directory = APP_ROOT . '/' . LIBRARY_DIR;
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('Unable to create the photo library directory.');
    }
    $id = bin2hex(random_bytes(8));
    $filename = $id . '.' . $extensions[$mime];
    if (!move_uploaded_file($temporaryPath, $directory . DIRECTORY_SEPARATOR . $filename)) {
        throw new RuntimeException('Unable to store the uploaded image.');
    }
    $name = clean_text(preg_replace('/\.[^.]+$/', '', basename((string) ($file['name'] ?? 'Photo'))) ?: 'Photo', 200);
    $photo = [
        'id' => $id,
        'name' => $name,
        'category' => $category,
        'imagePath' => LIBRARY_DIR . '/' . $filename,
        'width' => (int) $dimensions[0],
        'height' => (int) $dimensions[1],
        'size' => $size,
        'uploadedAt' => gmdate('c'),
        'uploadedBy' => $user['name'],
    ];
    try {
        repo_add_library_photo($photo);
    } catch (Throwable $error) {
        @unlink($directory . DIRECTORY_SEPARATOR . $filename);
        throw $error;
    }
    return $photo;
}

/** Sets a library photo as the photo of a product type (category + product group) and logs it. */
function assign_group_photo(array $user, string $category, string $groupName, array $photo): array
{
    $record = [
        'key' => hash('sha256', mb_strtolower($category) . "\0" . mb_strtolower($groupName)),
        'category' => $category,
        'groupName' => $groupName,
        'imagePath' => $photo['imagePath'],
        'libraryId' => $photo['id'],
        'altText' => $groupName . ' product image',
        'updatedAt' => gmdate('c'),
        'updatedBy' => $user['name'],
    ];
    $previous = repo_upsert_image($record);
    // Older direct uploads lived outside the library; remove those files when replaced.
    $oldPath = (string) ($previous['imagePath'] ?? '');
    if ($oldPath !== '' && $oldPath !== $record['imagePath']) delete_managed_group_image($oldPath);
    record_audit('image_update', "Set photo for '{$groupName}'", "{$user['name']} set the {$category} / {$groupName} photo to '{$photo['name']}'.", [
        'category' => $category, 'groupName' => $groupName, 'photo' => $photo['name'],
    ]);
    return $record;
}

/** Deletes a file only when it sits inside $directory (relative to the project root). */
function delete_file_inside(string $directory, string $relativePath): void
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    if (!str_starts_with($relativePath, $directory . '/')) return;
    $root = realpath(APP_ROOT . '/' . $directory);
    $target = realpath(APP_ROOT . '/' . $relativePath);
    if (!$root || !$target || !str_starts_with($target, $root . DIRECTORY_SEPARATOR)) return;
    if (is_file($target)) @unlink($target);
}

function delete_library_file(string $relativePath): void
{
    delete_file_inside(LIBRARY_DIR, $relativePath);
}

/** Older direct uploads lived outside the library. */
function delete_managed_group_image(string $relativePath): void
{
    delete_file_inside(GROUP_IMAGE_DIR, $relativePath);
}
