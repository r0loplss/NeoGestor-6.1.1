'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const updater = require('../src/updater.js');

const { compareVersions, parseSemver, findMatchingAsset, isAllowedDownloadUrl, buildUpdateResult } = updater;

test('parseSemver normaliza formatos', () => {
  assert.deepEqual(parseSemver('v6.1.6'), [6, 1, 6]);
  assert.deepEqual(parseSemver('6.1.10'), [6, 1, 10]);
  assert.deepEqual(parseSemver('6'), [6, 0, 0]);
  assert.deepEqual(parseSemver('6.2'), [6, 2, 0]);
  assert.deepEqual(parseSemver(''), [0, 0, 0]);
  assert.deepEqual(parseSemver(null), [0, 0, 0]);
  assert.deepEqual(parseSemver('6.1.7-beta'), [6, 1, 7]);
});

test('compareVersions detecta versiones mas nuevas (caso real 6.1.10 vs 6.1.9)', () => {
  assert.equal(compareVersions('6.1.10', '6.1.9'), 1);
  assert.equal(compareVersions('v6.1.10', '6.1.9'), 1);
  assert.equal(compareVersions('6.1.9', '6.1.10'), -1);
});

test('compareVersions trata el prefijo v y espacios como iguales', () => {
  assert.equal(compareVersions('v6.1.10', '6.1.10'), 0);
  assert.equal(compareVersions(' 6.1.10 ', '6.1.10'), 0);
  assert.equal(compareVersions('6.1', '6.1.0'), 0);
  assert.equal(compareVersions('6', '6.0.0'), 0);
});

test('compareVersions respeta jerarquia major/minor/patch', () => {
  assert.equal(compareVersions('6.2.0', '6.1.99'), 1);
  assert.equal(compareVersions('7.0.0', '6.99.99'), 1);
  assert.equal(compareVersions('6.1.2', '6.1.11'), -1);
});

test('compareVersions tolera vacios y nulos', () => {
  assert.equal(compareVersions(null, null), 0);
  assert.equal(compareVersions('', '6.1.0'), -1);
  assert.equal(compareVersions('6.1.0', ''), 1);
});

test('findMatchingAsset elige el portable cuando corre en portable', () => {
  const assets = [
    { name: 'Gestor de Casos Setup 6.1.10.exe' },
    { name: 'GestorCasos-portable-6.1.10.exe' }
  ];
  assert.equal(findMatchingAsset(assets, true).name, 'GestorCasos-portable-6.1.10.exe');
});

test('findMatchingAsset elige el setup cuando corre instalado', () => {
  const assets = [
    { name: 'GestorCasos-portable-6.1.10.exe' },
    { name: 'Gestor de Casos Setup 6.1.10.exe' }
  ];
  assert.equal(findMatchingAsset(assets, false).name, 'Gestor de Casos Setup 6.1.10.exe');
});

test('findMatchingAsset usa fallback exe y tolera listas vacias', () => {
  assert.equal(findMatchingAsset([{ name: 'otro.exe' }], true).name, 'otro.exe');
  assert.equal(findMatchingAsset([], true), null);
  assert.equal(findMatchingAsset(null, true), null);
});

test('isAllowedDownloadUrl acepta solo releases HTTPS de GitHub', () => {
  assert.equal(isAllowedDownloadUrl('https://github.com/r0loplss/NeoGestor-6.1.1/releases/download/v6.1.10/GestorCasos-portable-6.1.10.exe'), true);
  assert.equal(isAllowedDownloadUrl('https://objects.githubusercontent.com/foo'), true);
  assert.equal(isAllowedDownloadUrl('https://release-assets.githubusercontent.com/foo'), true);
  // Rechazos
  assert.equal(isAllowedDownloadUrl('http://github.com/x.exe'), false, 'rechaza http');
  assert.equal(isAllowedDownloadUrl('https://evil.com/github.com/x.exe'), false, 'rechaza dominio ajeno');
  assert.equal(isAllowedDownloadUrl('https://github.com.evil.com/x.exe'), false, 'rechaza sufijo malicioso');
  assert.equal(isAllowedDownloadUrl('file:///C:/x.exe'), false);
  assert.equal(isAllowedDownloadUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedDownloadUrl(''), false);
  assert.equal(isAllowedDownloadUrl(null), false);
});

test('buildUpdateResult detecta actualizacion y adjunta el asset portable', () => {
  const release = {
    tag_name: 'v6.2.0', name: 'Version v6.2.0', body: 'notas', html_url: 'https://x', published_at: '2026',
    assets: [{ name: 'GestorCasos-portable-6.2.0.exe', size: 123, browser_download_url: 'https://github.com/o/r/releases/download/v6.2.0/x.exe' }]
  };
  const r = buildUpdateResult(release, '6.1.11', { isPortable: true });
  assert.equal(r.status, 'update_available');
  assert.equal(r.latestVersion, 'v6.2.0');
  assert.equal(r.asset.name, 'GestorCasos-portable-6.2.0.exe');
  assert.equal(r.asset.downloadUrl, 'https://github.com/o/r/releases/download/v6.2.0/x.exe');
});

test('buildUpdateResult marca al dia cuando la version es igual', () => {
  const r = buildUpdateResult({ tag_name: 'v6.1.11', assets: [] }, '6.1.11', { isPortable: true });
  assert.equal(r.status, 'up_to_date');
});

test('buildUpdateResult no ofrece asset si no hay coincidencia', () => {
  const r = buildUpdateResult({ tag_name: 'v6.2.0', assets: [] }, '6.1.11', { isPortable: true });
  assert.equal(r.status, 'update_available');
  assert.equal(r.asset, null);
});
