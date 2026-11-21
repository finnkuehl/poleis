// General economy numbers (see docs/GAME_DESIGN.md, section 5).

export const economyConfig = {
  // Goods the player owns at the start of a game.
  startGoods: { wood: 20, stone: 10 },
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
  // Number of turns of a game, shown as "Turn X / 120" (victory rules come in M5).
  turnLimit: 120,
} as const;
