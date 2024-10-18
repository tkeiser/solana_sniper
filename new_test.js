const WebSocket = require('ws');
const { addTokenToWatchList, purgeDB, getDocument } = require('./db/mongo');
const { solanaConnection, rayFee } = require('./utils/constants');


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

                const { logs, err, signature } = response.params.result.value;

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
                const parsedTransaction = await connection.getParsedTransaction(signature,
                    { 
                        maxSupportedTransactionVersion: 0,
                        commitment: "confirmed"
                     }
                );


                console.log("Parsed transaction: ", parsedTransaction);
                console.log(new Date())

                const transaction = await connection.getTransaction(signature, 
                    { maxSupportedTransactionVersion: 0 });
                console.log("Transaction: ", transaction);
                console.log(signature)

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
                    console.log("Pool Address: ", poolAddress);

                    const { poolTokenAReserve, poolTokenBReserve } = await getPoolReserve(connection, poolAddress);
                    console.log("Pool reserves: ", poolTokenAReserve, poolTokenBReserve);
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
                    },
                    quoteInfo: {
                        quoteAddress,
                        quoteDecimals,
                        quoteLpAmount
                    },
                    logs: logs,
                    tokenData: parsedTransaction
                };


                console.log(`Found new token signature: ${signature} with pair address ${poolAddress} @ ${new Date()}`);
                addTokenToWatchList(newTokenData);
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

// Exécuter la nouvelle fonction
monitorNewTokensWithWebSocket(solanaConnection);
