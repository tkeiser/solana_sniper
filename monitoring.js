const { solanaConnection, rayFee } = require('./utils/constants');
const { addTokenToWatchList, purgeDB, getDocument } = require('./db/mongo');
const { Connection, PublicKey } = require('@solana/web3.js');
const { MAINNET_PROGRAM_ID } = require('@raydium-io/raydium-sdk')
const { getPoolReserve } = require('./utils/raydium');

const RAYDIUM_AMM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8';

/**
 * 
 * @param {*} transaction The transaction to extract the pool address from
 * @returns 
 */
function extractPoolAddressFromTransaction(transaction) {
    try {
        // Vérifier si innerInstructions sont présentes
        const innerInstructions = transaction?.meta?.innerInstructions;
        if (!innerInstructions || innerInstructions.length === 0) {
            console.log('Aucune instruction interne trouvée.');
            return null;
        }

        // Parcours des innerInstructions
        for (const innerInstruction of innerInstructions) {
            const instructions = innerInstruction.instructions;

            for (let i = instructions.length - 1; i >= 0; i--) {
                const instruction = instructions[i];
                if (instruction?.parsed?.info?.account && instruction?.parsed?.info?.owner == RAYDIUM_AMM_PROGRAM_ID) {
                    return instruction?.parsed?.info?.account
                }
            }
        }
    } catch (error) {
        console.error('Error extracting pool address from transaction:', error);
    }

    console.log('No pool address found in transaction.');
    return null;
}

/**
 * 
 * @param {*} connection Connection to the Solana network
 * @param {*} mintAddress Address of the token to get information from
 * @returns 
 */
async function getTokenInfo(connection, mintAddress) {
    try {
        const mintPublicKey = new PublicKey(mintAddress);
        const tokenInfo = await connection.getParsedAccountInfo(mintPublicKey, 'confirmed');

        if (tokenInfo?.value?.data?.parsed?.info) {
            const info = tokenInfo.value.data.parsed.info;
            return {
                name: info.name || 'Unknown', // Le champ "name" peut ne pas toujours être présent
                symbol: info.symbol || 'Unknown',
                decimals: info.decimals || 0
            };
        }
    } catch (error) {
        console.error(`Error fetching token info for ${mintAddress}:`, error);
    }

    return {
        name: 'Unknown',
        symbol: 'Unknown',
        decimals: 0
    };
}


/**
 * Function that listen the transactions on the Solana network and monitor new tokens (for Raydium)
 * @param {*} connection Connection to the Solana network
 */
async function monitorNewTokens(connection) {

    purgeDB('watchlist', 'tokens');

    console.log('Monitoring new tokens...');

    try {
        connection.onLogs(
            rayFee, 
            async ({ logs, err, signature}) => {
                try {
                    console.log(new Date())
                    if (err) {
                        console.error('Error monitoring new tokens:', err);
                        return;
                    }

                    let signer = '';
                    let baseAddress = '';
                    let baseDecimals = 0;
                    let baseLpAmount = 0;
                    let quoteAddress = '';
                    let quoteDecimals = 0;
                    let quoteLpAmount = 0;
                    let poolAddress = '';

                    const parsedTransaction = await connection.getParsedTransaction(
                        signature,
                        {
                          maxSupportedTransactionVersion: 0,
                          commitment: 'confirmed',
                        }
                    );
                    

                    if (parsedTransaction && parsedTransaction?.meta.err == null) {

                        signer = parsedTransaction?.transaction.message.accountKeys[0].pubkey.toString();


                        const postTokenBalances = parsedTransaction?.meta.postTokenBalances;
                        const baseInfo = postTokenBalances?.find(
                            (balance) => 
                                balance.owner === '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' && balance.mint !== 'So11111111111111111111111111111111111111112'
                        );

                        if (baseInfo) {
                            baseAddress = baseInfo.mint;
                            baseDecimals = baseInfo.uiTokenAmount.decimals;
                            baseLpAmount = baseInfo.uiTokenAmount.amount;

                            // Récupérer les informations supplémentaires du token
                            const tokenDetails = await getTokenInfo(connection, baseAddress);
                            baseName = tokenDetails.name;
                            baseSymbol = tokenDetails.symbol;
                            baseDecimals = tokenDetails.decimals;
                        }

                        const quoteInfo = postTokenBalances?.find(
                            (balance) => 
                                balance.owner === '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' && balance.mint == 'So11111111111111111111111111111111111111112'
                        );

                        if (quoteInfo) {
                            quoteAddress = quoteInfo.mint;
                            quoteDecimals = quoteInfo.uiTokenAmount.decimals;
                            quoteLpAmount = quoteInfo.uiTokenAmount.amount;
                        }  

                        poolAddress = extractPoolAddressFromTransaction(parsedTransaction);
                        console.log(poolAddress)

                        
                        const { poolTokenAReserve, poolTokenBReserve } = await getPoolReserve(connection, poolAddress);
                        console.log(poolTokenAReserve, poolTokenBReserve)
                    }

                    const newTokenData = {
                        lpSignature: signature,
                        creator: signer,
                        poolAddress: poolAddress,
                        timestamp: new Date(),
                        baseInfo: {
                            baseAddress,
                            baseDecimals,
                            baseLpAmount,
                            baseName,
                            baseSymbol
                        },
                        quoteInfo: {
                            quoteAddress,
                            quoteDecimals,
                            quoteLpAmount
                        },
                        logs: logs,
                        tokenData: parsedTransaction
                    };

                    console.log(`found new token signature: ${signature} with pair address ${poolAddress} @ ${new Date()}`);
                    addTokenToWatchList(newTokenData);

                } catch (error) {
                    console.error('Error monitoring new tokens:', error);
                }
            }
        )
    } catch (error) {
        console.error('Error monitoring new tokens:', error);
    }

}

const WebSocket = require('ws');

async function monitorNewTokensWithWebSocket(connection) {
    // URL du WebSocket RPC de Solana
    const solanaWsUrl = "wss://rpc.ankr.com/solana/ws/a4f6c64ef2770f8ac63b6bc5c4fde3f7f23ad90ede1d89afc8e57f976bcecef9"; // Remplacez par votre URL WebSocket si vous avez un service payant
    const targetAddress = '7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5';
    
    // Purge de la base de données avant le démarrage
    purgeDB('watchlist', 'tokens');
    console.log('Monitoring new tokens using WebSocket...');

    let ws = new WebSocket(solanaWsUrl);

    ws.on('open', function open() {
        console.log('WebSocket connection established.');

        // Abonnement aux journaux des transactions
        const subscribeMessage = JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "logsSubscribe",
            params: [
                { mentions: [targetAddress] },
                { commitment: "processed" }
            ]
        });

        ws.send(subscribeMessage);
        console.log('Subscribed to transaction logs...');
    });

    ws.on('message', async function incoming(data) {
        try {
            const response = JSON.parse(data);
            
            if (response.method === 'logsNotification') {
                console.log(response.params.result.value);
                const { logs, err, signature } = response.params.result.value;

                console.log(new Date());
                if (err) {
                    console.error('Error monitoring new tokens:', err);
                    return;
                }

                let signer = '';
                let baseAddress = '';
                let baseDecimals = 0;
                let baseLpAmount = 0;
                let quoteAddress = '';
                let quoteDecimals = 0;
                let quoteLpAmount = 0;
                let poolAddress = '';

                // Remplacer 'connection' par un appel manuel pour récupérer les informations de transaction
                const parsedTransaction = await connection.getParsedTransaction(
                    signature,
                    {
                      maxSupportedTransactionVersion: 0,
                      commitment: 'processed',
                    }
                );

                console.log(parsedTransaction);
                console.log(new Date())

                if (parsedTransaction && parsedTransaction?.meta.err == null) {
                    signer = parsedTransaction?.transaction.message.accountKeys[0].pubkey.toString();

                    const postTokenBalances = parsedTransaction?.meta.postTokenBalances;
                    const baseInfo = postTokenBalances?.find(
                        (balance) =>
                            balance.owner === '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' && balance.mint !== 'So11111111111111111111111111111111111111112'
                    );

                    if (baseInfo) {
                        baseAddress = baseInfo.mint;
                        baseDecimals = baseInfo.uiTokenAmount.decimals;
                        baseLpAmount = baseInfo.uiTokenAmount.amount;

                        // Récupérer les informations supplémentaires du token
                        /*const tokenDetails = await getTokenInfo(connection, baseAddress);
                        baseName = tokenDetails.name;
                        baseSymbol = tokenDetails.symbol;
                        baseDecimals = tokenDetails.decimals;*/
                    }

                    const quoteInfo = postTokenBalances?.find(
                        (balance) =>
                            balance.owner === '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' && balance.mint == 'So11111111111111111111111111111111111111112'
                    );

                    if (quoteInfo) {
                        quoteAddress = quoteInfo.mint;
                        quoteDecimals = quoteInfo.uiTokenAmount.decimals;
                        quoteLpAmount = quoteInfo.uiTokenAmount.amount;
                    }

                    poolAddress = extractPoolAddressFromTransaction(parsedTransaction);
                    console.log(poolAddress);

                    const { poolTokenAReserve, poolTokenBReserve } = await getPoolReserve(connection, poolAddress);
                    console.log(poolTokenAReserve, poolTokenBReserve);
                }

                const newTokenData = {
                    lpSignature: signature,
                    creator: signer,
                    poolAddress: poolAddress,
                    timestamp: new Date(),
                    baseInfo: {
                        baseAddress,
                        baseDecimals,
                        baseLpAmount,
                        //baseName,
                        //baseSymbol
                    },
                    quoteInfo: {
                        quoteAddress,
                        quoteDecimals,
                        quoteLpAmount
                    },
                    logs: logs,
                    tokenData: parsedTransaction
                };

                console.log(newTokenData)

                console.log(`Found new token signature: ${signature} with pair address ${poolAddress} @ ${new Date()}`);
                addTokenToWatchList(newTokenData);
                console.log(Signature)
            }
        } catch (error) {
            console.error('Global error:', error);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
        console.log('WebSocket connection closed. Reconnecting in 5 seconds...');
        setTimeout(monitorNewTokensWithWebSocket, 5000);
    });
}

// Fonction auxiliaire pour récupérer les informations de transaction manuellement
async function getParsedTransaction(signature) {
    try {
        const response = await fetch(`https://api.mainnet-beta.solana.com`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getParsedTransaction',
                params: [
                    signature,
                    { maxSupportedTransactionVersion: 0, commitment: 'confirmed' }
                ]
            })
        });

        const json = await response.json();
        return json.result;
    } catch (error) {
        console.error('Error fetching parsed transaction:', error);
        return null;
    }
}

// Exécuter la nouvelle fonction
monitorNewTokensWithWebSocket(solanaConnection);


//monitorNewTokens(solanaConnection);