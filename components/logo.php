<?php
declare(strict_types=1);
/**
 * The PLA logo as inline SVG, so it stays sharp at any size and follows light/dark mode. Colours
 * come from CSS variables (--pla-maroon, --pla-ink, --pla-accent) with the logo's own colours as
 * fallbacks; assets/images/pla-mark.svg is the same mark with fixed colours (browser tab icon).
 */

/** The mark: the maroon "P" with its arrow sweep around a list (bullets and lines) and the "LA". */
function pla_logo_mark(string $class = 'pla-mark'): string
{
    return '<svg class="' . htmlspecialchars($class) . '" viewBox="240 236 462 400" aria-hidden="true" focusable="false">'
        . pla_logo_paths()
        . '</svg>';
}

/** Mark + "PLA" + "Price List Automation", as in the full logo. */
function pla_logo_lockup(string $class = 'pla-lockup'): string
{
    return '<span class="' . htmlspecialchars($class) . '">'
        . pla_logo_mark('pla-mark')
        . '<span class="pla-words"><b class="pla-name"><i>P</i>LA</b><small class="pla-tagline">Price List Automation</small></span>'
        . '</span>';
}

function pla_logo_paths(): string
{
    $maroon = 'style="fill:var(--pla-maroon,#6e0f2b)"';
    $ink = 'style="fill:var(--pla-ink,#2f3035)"';
    $accent = 'style="fill:var(--pla-accent,#ef8a98)"';
    return
        // "P" frame: upright and top bar, the bowl sweeping round into an arrowhead and a tapering tail.
        '<path ' . $maroon . ' d="M243 632V240h284c62 0 107 18 129 43l7 4c0 53-7 113-27 155-9-30-16-57-22-76l6-23-32-17 18-17c-20-13-45-19-79-19H293v342z"/>'
        . '<path ' . $accent . ' d="M614 366c8 26 16 52 22 76 4-24 0-50-8-74z"/>'
        // List bullets.
        . '<rect ' . $maroon . ' x="314" y="316" width="41" height="38" rx="6"/>'
        . '<rect ' . $maroon . ' x="314" y="375" width="41" height="37" rx="6"/>'
        . '<rect ' . $maroon . ' x="314" y="434" width="41" height="38" rx="6"/>'
        // List lines, cut along the slope of the "A".
        . '<path ' . $ink . ' d="M377 316h146c17 0 30 13 30 30v8H377z"/>'
        . '<path ' . $ink . ' d="M377 375h178l-19 37H377z"/>'
        . '<path ' . $ink . ' d="M377 434h145l-20 38H377z"/>'
        // "L": its foot ends on the slope of the "A".
        . '<path ' . $ink . ' d="M314 492h56v88h240l25 52H314z"/>'
        // "A": its right leg runs past the foot of the "L".
        . '<path ' . $ink . ' d="M573 373l127 260h-52l-68-140-42 72h-63z"/>';
}
