// General economy numbers (see docs/GAME_DESIGN.md, section 5).

export const economyConfig = {
  // Goods the player owns at the start of a game.
  startGoods: { wood: 20, stone: 10 },
  // Only used in test mode (?sandbox in the address): a big stock to test long progressions quickly.
  sandboxGoods: {
    wood: 200,
    stone: 200,
    planks: 100,
    grain: 100,
    bread: 100,
    fish: 100,
    olives: 50,
    oil: 50,
    ore: 50,
    bronze: 50,
    grapes: 50,
    wine: 50,
    drachmas: 200,
  },
  // Cost of every new road tile.
  roadCost: { wood: 1 },
  // Share of the building cost you get back when demolishing (0 = nothing, 0.5 = half).
  demolishRefund: 0,
  // Marketplace trading: sell 2 of a good for 1 drachma; buy 1 good for 3 drachmas.
  market: {
    // Goods paid per "lot" when selling.
    sellAmount: 2,
    // Drachmas received per lot sold.
    sellPrice: 1,
    // Drachmas paid for 1 good when buying.
    buyPrice: 3,
  },
} as const;
