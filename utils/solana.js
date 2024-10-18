const { Connection, clusterApiUrl, PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL, SystemInstruction, SystemProgram } = require('@solana/web3.js');
const { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { TokenAmount, ROUTE_PATH, findBestPath, Trade } = require('@raydium-io/raydium-sdk');

async function initSolConnection(cluster = "devnet") {
    return new Connection(clusterApiUrl(cluster), 'confirmed');
}

async function createAccount() {
    const newAccount = Keypair.generate();
    console.log('New account created:', newAccount.publicKey.toBase58());
    return newAccount;
}

async function transferSOl(connection, sender, receiverPublicKey, solAmount) {
    try {
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: sender.publicKey,
                toPubkey: receiverPublicKey,
                lamports: amountSol * LAMPORTS_PER_SOL, // Conversion SOL en lamports
            })
        );

        const signature = await connection.sendTransaction(transaction, [sender]);
        console.log('Transaction sent:', signature);
        await connection.confirmTransaction(signature);
        return signature;
    } catch (error) {
        console.error('Error sending SOL:', error);
        return null;
    }
}

async function getAccountBalance(connection, publicKey) {
    try {
        const balance = await connection.getBalance(new PublicKey(publicKey));
        console.log('Account balance:', balance / LAMPORTS_PER_SOL, 'SOL');
        return balance / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error('Error getting account balance:', error);
        return null;
    }
}



// SPL TOKEN SECTION
// Créer un compte associé pour un jeton SPL
async function createAssociatedTokenAccount(connection, payer, mintAddress, owner) {
    try {
        const mintPublicKey = new PublicKey(mintAddress);
        const associatedTokenAddress = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mintPublicKey,
            new PublicKey(owner)
        );

        const transaction = new Transaction().add(
            Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                mintPublicKey,
                associatedTokenAddress,
                new PublicKey(owner),
                payer.publicKey
            )
        );

        const signature = await connection.sendTransaction(transaction, [payer]);
        console.log('Associated token account created:', associatedTokenAddress.toBase58());
        return associatedTokenAddress;
    } catch (error) {
        console.error('Error creating associated token account:', error);
        return null;
    }
}

// Transférer des jetons SPL d'un compte à un autre
async function transferSplTokens(connection, payer, fromTokenAccount, toTokenAccount, amount, mintAddress) {
    try {
        const mintPublicKey = new PublicKey(mintAddress);
        const transaction = new Transaction().add(
            Token.createTransferInstruction(
                TOKEN_PROGRAM_ID,
                fromTokenAccount,
                toTokenAccount,
                payer.publicKey,
                [],
                amount
            )
        );

        const signature = await connection.sendTransaction(transaction, [payer]);
        console.log('SPL token transfer transaction sent:', signature);
        await connection.confirmTransaction(signature);
        return signature;
    } catch (error) {
        console.error('Error transferring SPL tokens:', error);
        return null;
    }
}

module.exports = {
    initSolConnection,
    createAccount,
    transferSOl,
    getAccountBalance,
    createAssociatedTokenAccount,
    transferSplTokens
}