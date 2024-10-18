const WebSocket = require('ws');
const { addTokenToWatchList, purgeDB, getDocument } = require('./db/mongo');
const { solanaConnection, rayFee } = require('./utils/constants');

function extractTokenInfoFromLogs(logs) {
    let baseAddress = '';
    let baseLpAmount = 0;
    let quoteAddress = 'So11111111111111111111111111111111111111112'; // USDC ou stablecoin utilisé
    let quoteLpAmount = 0;
    let mintDetected = false;
    let mintAmount = 0;

    // Parcourir les logs pour trouver les informations pertinentes
    logs.forEach((log) => {
        // Détecter l'instruction InitializeMint pour identifier le nouveau token
        if (log.includes('Instruction: InitializeMint')) {
            mintDetected = true;
        }

        // Extraire les informations de l'instruction MintTo (émission de tokens)
        if (log.includes('Instruction: MintTo')) {
            const mintToRegex = /MintTo.*ray_log: ([A-Za-z0-9=\/+]+)/;
            const match = mintToRegex.exec(log);
            if (match) {
                mintAmount = decodeBase64(match[1]); // Décoder le montant de l'encodage en base64
                baseLpAmount = parseInt(mintAmount, 10);
            }
        }

        // Détecter les paramètres initiaux du pool dans l'instruction initialize2
        if (log.includes('initialize2:')) {
            const initParamsRegex = /init_pc_amount: ([0-9]+), init_coin_amount: ([0-9]+)/;
            const match = initParamsRegex.exec(log);
            if (match) {
                quoteLpAmount = parseInt(match[1], 10);
                baseLpAmount = parseInt(match[2], 10);
            }
        }
    });

    return {
        baseAddress: mintDetected ? baseAddress : '',
        baseLpAmount,
        quoteAddress,
        quoteLpAmount,
        mintDetected
    };
}

function decodeBase64(encodedString) {
    // Décoder une chaîne encodée en base64
    const buffer = Buffer.from(encodedString, 'base64');
    return buffer.toString();
}

async function getTransaction(connection, signature) {

    const transaction = await connection.getTransaction(signature,
        { maxSupportedTransactionVersion: 0 }
    )
    return transaction

}



async function main() {

    const doc = await getDocument('watchlist', 'tokens');

    const res = extractTokenInfoFromLogs(doc.logs);

    const transaction = await getTransaction(solanaConnection, doc.lpSignature);
    console.log(transaction)

}

main()