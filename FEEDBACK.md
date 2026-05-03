# Uniswap API Feedback

Fundz uses the Uniswap API for backend driven swaps from a Safe. Agents submit trade intents, backend checks policy, gets a Uniswap quote, requests swap calldata, and sends the transaction through the Safe (on a Tenderly Mainnet fork for the demo).

What worked well:

- The `/quote` then `/swap` flow fits a backend policy engine well.
- Not having to build routing is cool. That gives me time to build another things.
- Request IDs were useful for logging and execution history.

What was rough:

- Safe + Permit2 setup was the hardest part for me. It took some trial and error to get ERC-20 approval to Permit2.

What I wish existed:

- Better preflight or simulation support for Safe style contract wallets.
- More docs around using the API on Tenderly or forked mainnet setups.

Overall, the API did the important job well, thanks!
