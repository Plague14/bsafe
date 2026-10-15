// Shows the deployer account address (creating its key on first run) and its STRK balance.
import { loadOrCreateKey, strkBalance, isDeployed, fmt, RPC_URL } from './common.mjs';

const { address } = loadOrCreateKey();
console.log('RPC:      ', RPC_URL);
console.log('Deployer: ', address);
console.log('Deployed: ', await isDeployed(address));
console.log('STRK:     ', fmt(await strkBalance(address)));
