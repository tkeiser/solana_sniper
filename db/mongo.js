const { MongoClient } = require('mongodb');

// MongoDB URI (Replace with your URI if using MongoDB Atlas or other remote DB)
const uri = 'mongodb://localhost:17092';

// Database name and collection name
const dbName = 'watchlist';
const collectionName = 'tokens';

// Function to insert new token into MongoDB
async function addTokenToWatchList(tokenData) {
    const client = new MongoClient(uri);
    
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected successfully to MongoDB');
        
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        
        // Check if tokenData.signature already exists in the collection
        const existingToken = await collection.findOne({ signature: tokenData.lpSignature });
        if (existingToken) {
            console.log(`Token with signature ${tokenData.signature} already exists in the watchlist`);
            return;
        }

        // Insert the token data into the watchlist collection
        const result = await collection.insertOne(tokenData);
        console.log(`Token inserted with _id: ${result.insertedId}`);
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error code
            console.log('Token already exists in the watchlist, skipping insertion.');
        } else {
            console.error('Error inserting token into MongoDB:', error);
        }
    } finally {
        // Close the connection
        await client.close();
    }
}

async function purgeDB(dbName, collectionName) {
    const client = new MongoClient(uri);
    
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected successfully to MongoDB');
        
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        
        // Insert the token data into the watchlist collection
        const result = await collection.deleteMany({});
        console.log(`Deleted ${result.deletedCount} documents`);
    } catch (error) {
        console.error('Error inserting token into MongoDB:', error);
    } finally {
        // Close the connection
        await client.close();
    }
}

// Get a document function
async function getDocument(dbName, collectionName, query) {
    const client = new MongoClient(uri);
    
    try {
        // Connect to MongoDB
        await client.connect();
        console.log('Connected successfully to MongoDB');
        
        const db = client.db(dbName);
        const collection = db.collection(collectionName);
        
        // Find the document
        const document = await collection.findOne(query);
        return document;
    } catch (error) {
        console.error('Error finding document in MongoDB:', error);
    } finally {
        // Close the connection
        await client.close();
    }
}

module.exports = { 
    addTokenToWatchList,
    purgeDB,
    getDocument
};