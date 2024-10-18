const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const dotenv = require('dotenv');
dotenv.config();

const RPC_ENDPOINT = process.env.RPC_ENDPOINT ?? clusterApiUrl('mainnet-beta');
const RPC_WEBSOCKET_ENDPOINT = process.env.RPC_WEBSOCKET_ENDPOINT ?? 'wss://api.mainnet-beta.solana.com';

const solanaConnection = new Connection(
    RPC_ENDPOINT,
    {
        wsEndpoint: RPC_WEBSOCKET_ENDPOINT,
    }
);

const rayFee = new PublicKey(
    '7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5'
);

module.exports = {
    solanaConnection,
    rayFee
}