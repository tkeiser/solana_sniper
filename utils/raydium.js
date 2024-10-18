const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl
} = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Amm, MAINNET_PROGRAM_ID, Liquidity, LIQUIDITY_STATE_LAYOUT_V4 } = require('@raydium-io/raydium-sdk');
const BN = require('bn.js');
const { initSolConnection } = require('../utils/solana');
const dotenv = require('dotenv')

async function getPoolReserve(connection, poolAddress) {
    // Récupérer les informations du compte de la pool
    const accountInfo = await connection.getAccountInfo(new PublicKey(poolAddress));
    if (!accountInfo) {
        throw new Error('Pool account not found');
    }

    // Décoder les données de la pool
    const poolData = LIQUIDITY_STATE_LAYOUT_V4.decode(accountInfo.data);

    // Récupérer les adresses des coffres de base et de quote
    const baseVaultPubkey = new PublicKey(poolData.baseVault);
    const quoteVaultPubkey = new PublicKey(poolData.quoteVault);

    // Récupérer les soldes des coffres
    const baseVaultBalanceInfo = await connection.getTokenAccountBalance(baseVaultPubkey);
    const quoteVaultBalanceInfo = await connection.getTokenAccountBalance(quoteVaultPubkey);

    // Extraire les réserves des soldes des coffres
    const poolTokenAReserve = parseFloat(baseVaultBalanceInfo.value.amount);
    const poolTokenBReserve = parseFloat(quoteVaultBalanceInfo.value.amount);

    return { poolTokenAReserve, poolTokenBReserve };
}

async function swapOnRaydium(
    connection, // Instance de connexion à solana
    payer, // Compte payeur qui signe la transaction
    poolAddress, // Adresse du pool de liquidité
    inputTokenAccount, // Compte de jeton d'entrée à partir duquel les jetons seront envoyés
    outputTokenAccount, // Compte de jeton de sortie où les jetons reçus seront envoyés
    amountIn, // Quantité de jetons d'entrée à échanger 
    minAmountOut, // Quantité minimale de jetons de sortie à recevoir
    programId, // Programme d'échange (Raydium AMM)
    slippage // Taux de glissement maximal autorisé
) {

}



async function main() {
    const RPC_ENDPOINT = process.env.RPC_ENDPOINT ?? clusterApiUrl('mainnet-beta');
    const RPC_WEBSOCKET_ENDPOINT = process.env.RPC_WEBSOCKET_ENDPOINT ?? 'wss://api.mainnet-beta.solana.com';

    const solanaConnection = new Connection(
        RPC_ENDPOINT,
        {
            wsEndpoint: RPC_WEBSOCKET_ENDPOINT
        }
    );

    const { poolTokenAReserve, poolTokenBReserve } = await getPoolReserve(solanaConnection, "DKFAq7Wg7rMQLw5mAt7fH7YoPn7qYWLqZhdu7tFoPZyt")
    console.log(poolTokenAReserve, poolTokenBReserve)

}

//main()

module.exports = {
    getPoolReserve
}