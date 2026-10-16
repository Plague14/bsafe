// Local test signer for UI testing: a fake injected wallet in the page forwards requests
// here, so the test keys stay in ../.env and never reach the browser. Localhost only.
//   node dev-signer.mjs        -> http://127.0.0.1:5299/{owner|heir}/...
import http from 'node:http';
import { Account } from 'starknet';
import { provider, loadOrCreateKey } from './common.mjs';

const accounts = {
  owner: loadOrCreateKey('DEPLOYER_PRIVATE_KEY'),
  heir: loadOrCreateKey('HEIR_PRIVATE_KEY'),
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.end();
  const [, who, action] = req.url.split('/');
  const key = accounts[who];
  if (!key) {
    res.statusCode = 404;
    return res.end('{}');
  }
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    let out;
    if (action === 'address') out = { address: key.address };
    else if (action === 'invoke') {
      const { calls } = JSON.parse(body || '{}');
      const account = new Account({ provider, address: key.address, signer: key.privateKey });
      const { transaction_hash } = await account.execute(
        calls.map(c => ({ contractAddress: c.contract_address, entrypoint: c.entry_point, calldata: c.calldata })),
      );
      console.log(who, 'invoke', calls.map(c => c.entry_point).join('+'), transaction_hash);
      out = { transaction_hash };
    } else throw new Error('unknown action');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(out));
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: String(err?.message ?? err).slice(0, 2000) }));
  }
});

server.listen(5299, '127.0.0.1', () => console.log('dev signer on http://127.0.0.1:5299'));
