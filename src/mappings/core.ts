/* eslint-disable prefer-const */
import { Bundle, Factory, Pool, Token } from '../types/schema'
import { BigDecimal } from '@graphprotocol/graph-ts'
import { Initialize, Swap as SwapEvent } from '../types/templates/Pool/Pool'
import { convertTokenToDecimal } from '../utils'
import { FACTORY_ADDRESS, ZERO_BD } from '../utils/constants'
import { findEthPerToken, getEthPriceInUSD, getTrackedAmountUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing'
import { updateUniswapDayData } from '../utils/intervalUpdates'

export function handleInitialize(event: Initialize): void {
  let pool = Pool.load(event.address.toHexString())
  pool.sqrtPrice = event.params.sqrtPriceX96
  // update token prices
  let token0 = Token.load(pool.token0)
  let token1 = Token.load(pool.token1)

  // update ETH price now that prices could have changed
  let bundle = Bundle.load('1')
  bundle.ethPriceUSD = getEthPriceInUSD()
  bundle.save()

  // update token prices
  token0.derivedETH = findEthPerToken(token0 as Token)
  token1.derivedETH = findEthPerToken(token1 as Token)
  token0.save()
  token1.save()
}

export function handleSwap(event: SwapEvent): void {
  let bundle = Bundle.load('1')
  let factory = Factory.load(FACTORY_ADDRESS)
  let pool = Pool.load(event.address.toHexString())

  // hot fix for bad pricing
  if (pool.id == '0x9663f2ca0454accad3e094448ea6f77443880454') {
    return
  }

  let token0 = Token.load(pool.token0)
  let token1 = Token.load(pool.token1)

  // amounts - 0/1 are token deltas: can be positive or negative
  let amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  let amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  // need absolute amounts for volume
  let amount0Abs = amount0
  if (amount0.lt(ZERO_BD)) {
    amount0Abs = amount0.times(BigDecimal.fromString('-1'))
  }
  let amount1Abs = amount1
  if (amount1.lt(ZERO_BD)) {
    amount1Abs = amount1.times(BigDecimal.fromString('-1'))
  }

  // get amount that should be tracked only - div 2 because cant count both input and output as volume
  let amountTotalUSDTracked = getTrackedAmountUSD(amount0Abs, token0 as Token, amount1Abs, token1 as Token).div(
    BigDecimal.fromString('2')
  )

  // global updates
  factory.totalVolumeUSD = factory.totalVolumeUSD.plus(amountTotalUSDTracked)

  // Update the pool with the new active liquidity, price, and tick.
  pool.liquidity = event.params.liquidity
  pool.sqrtPrice = event.params.sqrtPriceX96
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0)
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1)

  // updated pool ratess
  let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0 as Token, token1 as Token)
  pool.token0Price = prices[0]
  pool.token1Price = prices[1]
  pool.save()

  // update USD pricing
  bundle.ethPriceUSD = getEthPriceInUSD()
  bundle.save()
  token0.derivedETH = findEthPerToken(token0 as Token)
  token1.derivedETH = findEthPerToken(token1 as Token)

  // interval data
  let uniswapDayData = updateUniswapDayData(event)

  // update volume metrics
  uniswapDayData.volumeUSD = uniswapDayData.volumeUSD.plus(amountTotalUSDTracked)

  uniswapDayData.save()
  factory.save()
  pool.save()
  token0.save()
  token1.save()
}
