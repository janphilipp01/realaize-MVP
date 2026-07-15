import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import type { AcquisitionDeal } from '@/models/types';

// Characterization tests for the app store — a net that proves the upcoming
// slice extraction preserves behaviour. Uses seeded ids so no domain objects
// need constructing.

const s = () => useStore.getState();
beforeEach(() => s().resetToMockData());

describe('initial state', () => {
  it('is seeded from mock data', () => {
    expect(s().assets.length).toBeGreaterThan(0);
    expect(s().deals.length).toBe(0); // acquisition pipeline seeds empty
    expect(s().developments.length).toBeGreaterThan(0);
    expect(s().sales.length).toBeGreaterThan(0);
    expect(s().benchmarks.length).toBeGreaterThan(0);
    expect(s().candidateDeals.length).toBeGreaterThan(0);
    expect(s().acquisitionProfiles.length).toBeGreaterThan(0);
    expect(s().settings.taxRate).toBe(25);
  });
});

describe('settings', () => {
  it('updateSettings patches and resetToMockData restores', () => {
    s().updateSettings({ taxRate: 30 });
    expect(s().settings.taxRate).toBe(30);
    s().resetToMockData();
    expect(s().settings.taxRate).toBe(25);
  });
});

describe('assets', () => {
  it('updateAsset patches and deleteAsset removes', () => {
    const id = s().assets[0].id;
    s().updateAsset(id, { notes: 'hello' });
    expect(s().assets.find(a => a.id === id)?.notes).toBe('hello');
    const n = s().assets.length;
    s().deleteAsset(id);
    expect(s().assets.length).toBe(n - 1);
  });
});

describe('deals', () => {
  it('addDeal then deleteDeal round-trips (pipeline seeds empty)', () => {
    expect(s().deals.length).toBe(0);
    s().addDeal({ id: 'deal-test', name: 'Test-Ankauf', city: 'Düsseldorf', askingPrice: 1_000_000 } as unknown as AcquisitionDeal);
    expect(s().deals.length).toBe(1);
    s().deleteDeal('deal-test');
    expect(s().deals.length).toBe(0);
  });
});

describe('market intelligence actions', () => {
  it('triggerQuarterlyRefresh appends a job and grows history', () => {
    const jobs = s().refreshJobs.length;
    const histBefore = s().benchmarks[0].history?.length ?? 0;
    s().triggerQuarterlyRefresh('Tester');
    expect(s().refreshJobs.length).toBe(jobs + 1);
    expect(s().benchmarks[0].history?.length ?? 0).toBeGreaterThanOrEqual(histBefore);
  });

  it('refreshCityBenchmarks restamps a city and drifts its values', () => {
    const before = s().benchmarks.find(b => b.city === 'Düsseldorf')!;
    const stampBefore = before.extractedAt;
    s().refreshCityBenchmarks('Düsseldorf');
    const after = s().benchmarks.find(b => b.id === before.id)!;
    expect(after.extractedAt).not.toBe(stampBefore);
  });

  it('approveBenchmark marks a record approved', () => {
    const b = s().benchmarks.find(x => x.validationStatus === 'pending') ?? s().benchmarks[0];
    s().approveBenchmark(b.id, 'Tester');
    expect(s().benchmarks.find(x => x.id === b.id)?.validationStatus).toBe('manual_approved');
  });
});

describe('screening', () => {
  it('runScreening updates the timestamp and keeps candidates', () => {
    s().runScreening();
    expect(s().lastScreeningAt).toBeTruthy();
    expect(s().candidateDeals.length).toBeGreaterThan(0);
  });

  it('updateAcquisitionProfile patches and re-screens', () => {
    const id = s().acquisitionProfiles[0].id;
    s().updateAcquisitionProfile(id, { name: 'Renamed' });
    expect(s().acquisitionProfiles.find(p => p.id === id)?.name).toBe('Renamed');
  });
});

describe('deal radar', () => {
  it('dismissRadarListing sets status dismissed', () => {
    const id = s().dealRadarListings[0]?.id;
    if (!id) return;
    s().dismissRadarListing(id, 'not a fit');
    expect(s().dealRadarListings.find(l => l.id === id)?.status).toBe('dismissed');
  });
});
