import { describe, expect, it } from 'vitest';
import { at, addBuilding, makeTestState } from '../testing';
import { previewProduction, runProduction } from './production';

const rows = Array.from({ length: 5 }, () => 'ppppp');

/** City center (4 residents) at (0,2); buildings are added in a connected row. */
function setup(goods = {}) {
  const s = makeTestState(rows, { goods });
  addBuilding(s, 'cityCenter', at(0, 2));
  return s;
}

describe('production', () => {
  it('woodcutter produces +2 wood', () => {
    const s = setup();
    const id = addBuilding(s, 'woodcutter', at(1, 2));
    const report = runProduction(s, 0);
    expect(s.players[0].goods.wood).toBe(2);
    expect(report.delta).toEqual({ wood: 2 });
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
    expect(report.delta).toEqual({ planks: 2 });
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
  it('reports not connected', () => {
    const s = setup();
    const id = addBuilding(s, 'woodcutter', at(4, 4));
    const report = runProduction(s, 0);
    expect(report.buildings.find((b) => b.buildingId === id)?.status).toEqual({
      kind: 'notConnected',
    });
    expect(s.players[0].goods.wood).toBe(0);
  });
  it('houses and storehouses have noProduction', () => {
    const s = setup();
    addBuilding(s, 'house', at(1, 2));
    const report = runProduction(s, 0);
    expect(report.buildings.every((b) => b.status.kind === 'noProduction')).toBe(true);
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
    expect(report.delta).toEqual({ ore: -2, wood: -1, bronze: 1 });
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
