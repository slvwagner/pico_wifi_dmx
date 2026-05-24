const { expect } = require('@playwright/test');

async function openDmxPage(page, path = '') {
  await page.addInitScript(() => {
    localStorage.setItem('dmxPicoBaseUrl', '');
    localStorage.setItem('selectedGroupIds', '[]');
  });
  const suffix = path ? path : '';
  await page.goto(suffix + (suffix.includes('?') ? '&' : '?') + 'test=' + Date.now());
  await expect(page.locator('header h1')).toBeVisible();
}

const compactProfiles = [
  {
    id: 1,
    name: 'Profile A',
    mode: 'test',
    channels: 8,
    controls: [
      { id: 11, type: 'slider8', label: 'Dimmer', channel: 1 },
      { id: 12, type: 'panTilt16', label: 'Pan/Tilt', pan: 2, panFine: 3, tilt: 4, tiltFine: 5 }
    ]
  },
  {
    id: 2,
    name: 'Profile B',
    mode: 'test',
    channels: 6,
    controls: [
      { id: 21, type: 'slider8', label: 'Dimmer', channel: 1 },
      { id: 22, type: 'rgb', label: 'Color', a: 2, b: 3, c: 4 }
    ]
  },
  {
    id: 3,
    name: 'Profile C',
    mode: 'test',
    channels: 4,
    controls: [
      { id: 31, type: 'wheel', label: 'Gobo', channel: 1, options: [{ name: 'Open', value: 0 }] }
    ]
  }
];

const compactFixtures = [
  { id: 101, name: 'A 1', profileId: 1, start: 1 },
  { id: 102, name: 'B 1', profileId: 2, start: 21 },
  { id: 103, name: 'C 1', profileId: 3, start: 41 }
];

async function injectControllerCompactSetup(page) {
  await page.evaluate(({ profilesData, fixturesData }) => {
    profiles = JSON.parse(JSON.stringify(profilesData));
    fixtures = JSON.parse(JSON.stringify(fixturesData));
    Object.keys(values).forEach(key => delete values[key]);
    savedGroups = [{ id: 'grp_dimmer', name: 'Dimmer Pair', fixtureIds: [101, 102], values: {} }];
    activeSavedGroupIds = new Set();
    selectedFixtureIds = new Set();
    sceneFixtureFilterActive = false;
    activeControlScopeKeys.clear();
    fanAffectedKeys.clear();
    DmxCommon.saveSharedGroupSelection([]);
    drawProfiles();
    drawPatched();
    renderSavedGroupsList();
    drawSurface();
  }, { profilesData: compactProfiles, fixturesData: compactFixtures });
}

async function injectChaserCompactSetup(page) {
  await page.evaluate(({ profilesData, fixturesData }) => {
    setup = {
      baseUrl: '',
      profiles: JSON.parse(JSON.stringify(profilesData)),
      fixtures: JSON.parse(JSON.stringify(fixturesData)),
      values: {}
    };
    steps = [];
    selectedStepIdx = -1;
    activeStepValueKeys = null;
    sourceFixtureId = null;
    participating = {};
    setup.fixtures.forEach(f => {
      const p = fixtureProfile(f);
      if (!p) return;
      p.controls.forEach(c => participating[controlKey(f, c)] = true);
    });
    chaserGroupsBox.groups.length = 0;
    chaserGroupsBox.groups.push({ id: 'grp_dimmer', name: 'Dimmer Pair', fixtureIds: [101, 102], values: {} });
    chaserGroupsBox.clearSelection();
    chaserGroupsBox.render();
    drawParticipation();
    drawStepList();
    drawStepEditor();
    refreshChaserGroupActions();
  }, { profilesData: compactProfiles, fixturesData: compactFixtures });
}

async function injectMotionCompactSetup(page) {
  await page.evaluate(({ profilesData, fixturesData }) => {
    setup = {
      baseUrl: '',
      profiles: JSON.parse(JSON.stringify(profilesData)),
      fixtures: JSON.parse(JSON.stringify(fixturesData)),
      values: {}
    };
    motionFixtures = [];
    setup.fixtures.forEach(f => {
      const p = fixtureProfile(f);
      if (!p) return;
      p.controls.filter(isMotionControl).forEach(c => {
        const kind = motionControlKind(c);
        motionFixtures.push({
          fixture: f,
          control: c,
          kind,
          enabled: kind === 'panTilt',
          phaseOffset: 0,
          basePan: kind === 'panTilt' ? 32768 : 0,
          baseTilt: kind === 'panTilt' ? 32768 : 0,
          baseValue: 0
        });
      });
    });
    motionGroupsBox.groups.length = 0;
    motionGroupsBox.groups.push({ id: 'grp_dimmer', name: 'Dimmer Pair', fixtureIds: [101, 102], values: {} });
    motionGroupsBox.clearSelection();
    motionGroupsBox.render();
    selectedMotionTargetKey = motionControlOptions()[0]?.key || '';
    drawFixtureList();
    drawPathPreview();
    refreshMotionGroupActions();
  }, { profilesData: compactProfiles, fixturesData: compactFixtures });
}

module.exports = {
  openDmxPage,
  injectControllerCompactSetup,
  injectChaserCompactSetup,
  injectMotionCompactSetup
};
