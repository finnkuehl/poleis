// All visible game texts live here (English).
export const en = {
  gameTitle: 'Poleis',
  renderError: 'The graphics could not be started. Please reload the page or try another browser.',
  terrain: {
    ocean: 'Ocean',
    coast: 'Coastal water',
    plains: 'Plains',
    forest: 'Forest',
    hills: 'Hills',
    mountains: 'Mountains',
  },
  terrainNote: {
    ocean: 'Open sea – ships only',
    coast: 'Fishery and harbor are built next to it',
    plains: 'Standard for most buildings',
    forest: 'Wood source – build a woodcutter next to it',
    hills: 'For quarry, mine and vineyard',
    mountains: 'Impassable – build a mine or quarry next to it',
  },
  tileInfo: {
    movement: 'Movement',
    defense: 'Defense',
    buildable: 'Buildable',
    yes: 'yes',
    no: 'no',
    shipsOnly: 'ships only',
    impassable: 'impassable',
    tile: 'Tile',
    close: 'Close',
  },
  seedLabel: 'Seed',
} as const;
