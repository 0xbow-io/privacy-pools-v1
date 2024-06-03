import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox-viem';
import '@nomicfoundation/hardhat-foundry';

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  paths: {
    sources: './contracts/src',
    tests: './contracts/test',
    cache: './contracts/cache',
    artifacts: './contracts/artifacts',
  },
};
export default config;
