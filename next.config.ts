import type { NextConfig } from 'next'
import { networkInterfaces } from 'node:os'

const lanAddresses = Object.values(networkInterfaces())
  .flatMap(addresses => addresses ?? [])
  .filter(address => address.family === 'IPv4' && !address.internal)
  .map(address => address.address)

const config: NextConfig = {
  allowedDevOrigins: lanAddresses,
}

export default config
