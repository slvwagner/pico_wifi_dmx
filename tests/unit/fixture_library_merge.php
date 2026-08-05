<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'fixture_library_merge.php';

function assertSameValue(mixed $actual, mixed $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Expected ' . var_export($expected, true) . ', got ' . var_export($actual, true));
    }
}

function option(string $name, int $min, int $max, ?string $image = null): array
{
    $value = ['name' => $name, 'min' => $min, 'max' => $max];
    if ($image !== null) $value['image'] = $image;
    return $value;
}

$standard = [
    'schemaVersion' => 1,
    'generatedAt' => '2026-08-05T10:00:00Z',
    'fixtures' => [[
        'key' => 'fun-generation/picospot-20-led',
        'name' => 'PicoSpot 20 LED updated by OFL',
        'modes' => [
            ['name' => '11-channel', 'channels' => 11, 'profile' => ['controls' => [[
                'channel' => 7, 'type' => 'gobo', 'label' => 'Gobo',
                'options' => [option('Gobo 2', 10, 19), option('Gobo 2 shake', 128, 135)],
            ]]]],
            ['name' => '9-channel', 'channels' => 9, 'profile' => ['controls' => []]],
        ],
    ]],
];
$active = [
    'fixtures' => [
        [
            'key' => 'fun-generation/picospot-20-led',
            'name' => 'Old name',
            'modes' => [
                ['name' => '11-channel', 'channels' => 11, 'profile' => ['controls' => [[
                    'channel' => 7, 'type' => 'gobo', 'label' => 'Gobo',
                    'options' => [option('Gobo 2', 10, 19, 'data:image/png;base64,user-icon')],
                ]]]],
                ['name' => '9-channel', 'channels' => 9, 'userModified' => true, 'profile' => ['controls' => [['channel' => 1, 'label' => 'User dimmer']]]],
            ],
        ],
        ['key' => 'custom/my-fixture', 'name' => 'My fixture', 'userFixture' => true, 'modes' => []],
        ['key' => 'custom/moving-head-16ch', 'name' => 'Obsolete fixture', 'modes' => []],
    ],
];

$result = mergeFixtureLibraryUserData($standard, $active);
$library = $result['library'];
assertSameValue($library['source'], 'Active fixture library', 'The merged catalog is not identified as active.');
assertSameValue($library['fixtureCount'], 2, 'Only explicitly user-created custom fixtures should survive.');
assertSameValue($library['fixtures'][0]['name'], 'PicoSpot 20 LED updated by OFL', 'OFL fixture information was not refreshed.');
assertSameValue($library['fixtures'][0]['modes'][0]['profile']['controls'][0]['options'][0]['image'], 'data:image/png;base64,user-icon', 'User gobo image was not preserved.');
assertSameValue(isset($library['fixtures'][0]['modes'][0]['profile']['controls'][0]['options'][1]['image']), false, 'Base gobo image leaked into a shake range.');
assertSameValue($library['fixtures'][0]['modes'][1]['profile']['controls'][0]['label'], 'User dimmer', 'User-modified mode was not preserved.');
assertSameValue($library['fixtures'][1]['key'], 'custom/my-fixture', 'Explicit user fixture was not preserved.');
assertSameValue($result['stats'], ['preservedImages' => 1, 'preservedModes' => 1, 'preservedFixtures' => 1], 'Preservation statistics are wrong.');

echo "fixture_library_merge: PASS\n";
