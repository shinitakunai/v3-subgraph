import { ZERO_BD } from './constants'
/* eslint-disable prefer-const */
import { UniswapDayData } from './../types/schema'
import { ethereum } from '@graphprotocol/graph-ts'

/**
 * Tracks global aggregate data over daily windows
 * @param event
 */
export function updateUniswapDayData(event: ethereum.Event): UniswapDayData {
  let timestamp = event.block.timestamp.toI32()
  let dayID = timestamp / 86400 // rounded
  let uniswapDayData = UniswapDayData.load(dayID.toString())
  if (uniswapDayData === null) {
    uniswapDayData = new UniswapDayData(dayID.toString())
    uniswapDayData.volumeUSD = ZERO_BD
  }
  uniswapDayData.save()
  return uniswapDayData as UniswapDayData
}
