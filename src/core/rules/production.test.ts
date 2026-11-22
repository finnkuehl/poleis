import { describe, expect, it } from 'vitest';
import { at, addBuilding, addCity, makeTestState } from '../testing';
import { previewProduction, runProduction } from './production';

const rows = Array.from({ length: 5 }, () => 'ppppp');

/** City center (4 residents) at (0,2); buildings are added in a connected row. */
function setup(goods = {}) {
  const s = makeTestState(rows, { goods });
  addCity(s, at(0, 2), { radius: 6 });
  return s;
}

describe('production', () => {
  it('woodcutter produces +2 wood', () => {
    const s = setup();
    const id = addBuilding(s, 'woodcutter', at(1, 2));
    const report = runProduction(s, 0);
    expect(s.players[0].goods.wood).toBe(2);
    expect(report.delta).toEqual({ wood: 2, grain: 2 });
    expect(report.buildings.find((b) => b.buildingId === id)?.status).toEqual({
      kind: 'producing',
    });
  });
  it('sawmill uses wood cut in the same turn, even if older', () => {
    const s = setup();
    addBuilding(s, 'sawmill', at(1, 2));
    addBuilding(s, 'woodcutter', at(2, 2));
    const report = runProduction(s, 0);
    expect(s.players[0].goods.wood).toBe(0);
    expect(s.players[0].goods.planks).toBe(2);
    expect(report.delta).toEqual({ planks: 2, grain: 2 });
  });
  it('sawmill without wood is missingInput', () => {
    const s = setup();
    const id = addBuilding(s, 'sawmill', at(1, 2));
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)).toMatchObject({
      buildingId: id,
      status: { kind: 'missingInput', missing: { wood: 2 } },
    });
  });
  it('reports missing workers with numbers', () => {
    const s = setup(); // 4 residents
    addBuilding(s, 'farm', at(1, 2)); // 2
    addBuilding(s, 'farm', at(2, 2)); // 2
    const mine = addBuilding(s, 'mine', at(3, 2)); // needs 2, none left
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === mine)?.status).toEqual({
      kind: 'missingWorkers',
      assigned: 0,
      needed: 2,
    });
  });
  it('a paused building does nothing and is reported as paused', () => {
    const s = setup();
    const id = addBuilding(s, 'woodcutter', at(1, 2));
    s.buildings.find((b) => b.id === id)!.paused = true;
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)?.status).toEqual({ kind: 'paused' });
    expect(s.players[0].goods.wood).toBe(0);
  });
  it('reports not connected', () => {
    const s = setup();
    const id = addBuilding(s, 'woodcutter', at(4, 4));
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)?.status).toEqual({
      kind: 'notConnected',
    });
    expect(s.players[0].goods.wood).toBe(0);
  });
  it('houses have noProduction', () => {
    const s = setup();
    const id = addBuilding(s, 'house', at(1, 2));
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)?.status.kind).toBe('noProduction');
  });
  it('city center produces 2 grain by itself, without workers', () => {
    const s = setup();
    s.cities[0].residents = 0;
    const center = s.buildings[0].id;
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === center)?.status).toEqual({
      kind: 'producing',
    });
    expect(s.players[0].goods.grain).toBe(2);
    expect(report.delta).toEqual({ grain: 2 });
  });
  it('farm makes 4 grain with 2 workers', () => {
    const s = setup();
    const id = addBuilding(s, 'farm', at(1, 2));
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)?.status).toEqual({
      kind: 'producing',
    });
    expect(s.players[0].goods.grain).toBe(6); // 4 from the farm + 2 from the city center
  });
  it('smelter needs ore AND wood', () => {
    const s = setup({ ore: 2 });
    const id = addBuilding(s, 'smelter', at(1, 2));
    expect(previewProduction(s, 0).buildings.find((b) => b.buildingId === id)?.status).toEqual({
      kind: 'missingInput',
      missing: { wood: 1 },
    });
    s.players[0].goods.wood = 1;
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)?.status.kind).toBe('producing');
    expect(s.players[0].goods.bronze).toBe(1);
    expect(s.players[0].goods.ore).toBe(0);
    expect(report.delta).toEqual({ ore: -2, wood: -1, bronze: 1, grain: 2 });
  });
  it('preview does not mutate and equals the run result', () => {
    const s = setup({ wood: 1 });
    addBuilding(s, 'woodcutter', at(1, 2));
    addBuilding(s, 'sawmill', at(2, 2));
    const before = JSON.stringify(s);
    const preview = previewProduction(s, 0);
    expect(JSON.stringify(s)).toBe(before);
    expect(runProduction(s, 0)).toEqual(preview);
  });
});

describe('service buildings', () => {
  it('marketplace is working when connected and staffed; temple has no production', () => {
    const s = setup();
    const market = addBuilding(s, 'marketplace', at(1, 2));
    const temple = addBuilding(s, 'temple', at(2, 2));
    const statuses = previewProduction(s, 0).buildings;
    expect(statuses.find((b) => b.buildingId === market)?.status).toEqual({ kind: 'working' });
    expect(statuses.find((b) => b.buildingId === temple)?.status).toEqual({ kind: 'noProduction' });
  });
  it('marketplace can be paused, unconnected or unstaffed', () => {
    const s = setup();
    const market = addBuilding(s, 'marketplace', at(1, 2));
    const far = addBuilding(s, 'marketplace', at(4, 0));
    const kind = (id: number) =>
      previewProduction(s, 0).buildings.find((b) => b.buildingId === id)?.status.kind;
    expect(kind(far)).toBe('notConnected');
    s.buildings.find((b) => b.id === market)!.paused = true;
    expect(kind(market)).toBe('paused');
    s.buildings.find((b) => b.id === market)!.paused = false;
    s.cities[0].residents = 0;
    expect(kind(market)).toBe('missingWorkers');
  });
});
