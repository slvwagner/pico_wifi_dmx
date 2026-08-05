<?php
declare(strict_types=1);

function fixtureLibraryStandardPath(): ?string
{
    $candidates = [
        __DIR__ . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'fixture-library.json',
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'web' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'fixture-library.json',
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) return $candidate;
    }
    return null;
}

function fixtureLibraryModeKey(array $mode): string
{
    return strtolower(trim((string)($mode['name'] ?? ''))) . '|' . (int)($mode['channels'] ?? 0);
}

function fixtureLibraryControlKey(array $control): string
{
    return implode('|', [
        (string)($control['channel'] ?? ''),
        strtolower(trim((string)($control['type'] ?? ''))),
        strtolower(trim((string)($control['label'] ?? ''))),
    ]);
}

function fixtureLibraryOptionIdentity(array $option): array
{
    $keys = [];
    if (array_key_exists('min', $option) || array_key_exists('max', $option)) {
        $keys[] = 'range|' . (string)($option['min'] ?? '') . '|' . (string)($option['max'] ?? '');
    }
    if (array_key_exists('value', $option)) $keys[] = 'value|' . (string)$option['value'];
    if (isset($option['name']) && trim((string)$option['name']) !== '') {
        $keys[] = 'name|' . strtolower(trim((string)$option['name']));
    }
    if (array_key_exists('slot', $option)) {
        $keys[] = 'slot|' . (string)$option['slot'] . '|' . strtolower(trim((string)($option['kind'] ?? '')));
    }
    return $keys;
}

function fixtureLibraryPreserveImages(array &$standardMode, array $activeMode): int
{
    $standardControls =& $standardMode['profile']['controls'];
    $activeControls = $activeMode['profile']['controls'] ?? [];
    if (!is_array($standardControls) || !is_array($activeControls)) return 0;

    $activeByKey = [];
    foreach ($activeControls as $control) {
        if (is_array($control)) $activeByKey[fixtureLibraryControlKey($control)] = $control;
    }

    $preserved = 0;
    foreach ($standardControls as &$control) {
        if (!is_array($control)) continue;
        $activeControl = $activeByKey[fixtureLibraryControlKey($control)] ?? null;
        if (!is_array($activeControl)) continue;
        $activeOptions = $activeControl['options'] ?? [];
        if (!is_array($activeOptions) || !isset($control['options']) || !is_array($control['options'])) continue;

        $images = [];
        foreach ($activeOptions as $option) {
            if (!is_array($option) || !isset($option['image']) || !is_string($option['image']) || !str_starts_with($option['image'], 'data:image/')) continue;
            foreach (fixtureLibraryOptionIdentity($option) as $identity) {
                if (!isset($images[$identity])) $images[$identity] = $option['image'];
            }
        }
        foreach ($control['options'] as &$option) {
            if (!is_array($option)) continue;
            foreach (fixtureLibraryOptionIdentity($option) as $identity) {
                if (!isset($images[$identity])) continue;
                $option['image'] = $images[$identity];
                unset($option['resourceKey']);
                $preserved++;
                break;
            }
        }
        unset($option);
    }
    unset($control);
    return $preserved;
}

/** Merge explicitly user-owned data into a fresh standard catalog. */
function mergeFixtureLibraryUserData(array $standard, array $active): array
{
    $stats = ['preservedImages' => 0, 'preservedModes' => 0, 'preservedFixtures' => 0];
    $activeFixtures = [];
    foreach (($active['fixtures'] ?? []) as $fixture) {
        if (is_array($fixture) && isset($fixture['key'])) $activeFixtures[(string)$fixture['key']] = $fixture;
    }

    foreach ($standard['fixtures'] as &$fixture) {
        if (!is_array($fixture) || !isset($fixture['key'])) continue;
        $activeFixture = $activeFixtures[(string)$fixture['key']] ?? null;
        if (!is_array($activeFixture)) continue;
        $activeModes = [];
        foreach (($activeFixture['modes'] ?? []) as $mode) {
            if (is_array($mode)) $activeModes[fixtureLibraryModeKey($mode)] = $mode;
        }
        foreach ($fixture['modes'] as &$mode) {
            if (!is_array($mode)) continue;
            $activeMode = $activeModes[fixtureLibraryModeKey($mode)] ?? null;
            if (!is_array($activeMode)) continue;
            if (!empty($activeMode['userModified'])) {
                $mode = $activeMode;
                $stats['preservedModes']++;
            } else {
                $stats['preservedImages'] += fixtureLibraryPreserveImages($mode, $activeMode);
            }
        }
        unset($mode);
    }
    unset($fixture);

    $standardKeys = [];
    foreach ($standard['fixtures'] as $fixture) {
        if (is_array($fixture) && isset($fixture['key'])) $standardKeys[(string)$fixture['key']] = true;
    }
    foreach ($activeFixtures as $key => $fixture) {
        if (!empty($fixture['userFixture']) && !isset($standardKeys[$key])) {
            $standard['fixtures'][] = $fixture;
            $stats['preservedFixtures']++;
        }
    }

    $standard['fixtureCount'] = count($standard['fixtures']);
    $standard['source'] = 'Active fixture library';
    $standard['standardGeneratedAt'] = $standard['generatedAt'] ?? null;
    $standard['updatedFromStandardAt'] = gmdate('c');
    return ['library' => $standard, 'stats' => $stats];
}
