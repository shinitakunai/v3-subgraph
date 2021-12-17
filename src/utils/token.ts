/* eslint-disable prefer-const */
import { ERC20 } from '../types/Factory/ERC20'
import { StaticTokenDefinition } from './staticTokenDefinition'
import { BigInt, Address } from '@graphprotocol/graph-ts'

export function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress)
  // try types uint8 for decimals
  let decimalValue = null

  // try with the static definition
  let staticTokenDefinition = StaticTokenDefinition.fromAddress(tokenAddress)
  if (staticTokenDefinition != null) {
    return staticTokenDefinition.decimals
  }

  let decimalResult = contract.try_decimals()
  if (!decimalResult.reverted) {
    decimalValue = decimalResult.value
  }

  return BigInt.fromI32(decimalValue as i32)
}
