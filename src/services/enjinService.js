const axios = require('axios');
const fs = require('fs');

// Resource token definitions
const RESOURCE_TOKENS = [
    { id: 1, name: "Gold Coin", media: "[{\"type\":\"image/png\",\"url\":\"https://cdn.enjin.io/mint/image/gold-coin.png\"}]"},
    { id: 2, name: "Gold Coin (Blue)", media: "[{\"type\":\"image/png\",\"url\":\"https://cdn.enjin.io/mint/image/gold-coin-blue.png\"}]" },
    { id: 3, name: "Green Gem", media: "[{\"type\":\"image/png\",\"url\":\"https://cdn.enjin.io/mint/image/green-gem.png\"}]" }
];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTransactionStatus(requestId) {
    const response = await axios.post(process.env.ENJIN_API_URL, {
        query: `query GetTransaction {
            GetTransaction(id: ${requestId}) {
                state
                result
                events {
                    edges {
                        node {
                            params {
                                type
                                value
                            }
                        }
                    }
                }
            }
        }`
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response.data.data.GetTransaction;
}

async function extractCollectionId(transaction) {
    if (!transaction.events || !transaction.events.edges) {
        return null;
    }

    for (const edge of transaction.events.edges) {
        const params = edge.node.params;
        const collectionIdParam = params.find(p => p.type === 'collection_id');
        if (collectionIdParam) {
            return collectionIdParam.value;
        }
    }

    return null;
}

async function updateEnvFile(collectionId) {
    const envContent = fs.readFileSync('.env', 'utf8');
    const updatedContent = envContent.replace(
        /ENJIN_COLLECTION_ID=.*/,
        `ENJIN_COLLECTION_ID=${collectionId}`
    );
    fs.writeFileSync('.env', updatedContent);
    process.env.ENJIN_COLLECTION_ID = collectionId;
}

async function createCollection(){
    const response = await axios.post(process.env.ENJIN_API_URL, {
        query: `mutation CreateCollection(
    $forceCollapsingSupply: Boolean
    $name: String!
    $bannerImage: String!
    $media: String!
) {
    CreateCollection(
        mintPolicy: { forceCollapsingSupply: $forceCollapsingSupply }
        attributes:[
            {
                key: \"name\",
                value: $name
            },
            {
                key: \"banner_image\",
                value: $bannerImage
            },
            {
                key: \"media\",
                value: $media
            }
        ]
    ) {
        id
        method
        state
    }
}`,
        variables: {
            forceCollapsingSupply: false,
            name: "Enjin Sample Game",
            bannerImage: "https://cdn.enjin.io/mint/image/sample-game-collection-banner.png",
            media: "[{\"type\":\"image/png\",\"url\":\"https://cdn.enjin.io/mint/image/sample-game-collection-image.png\"}]"

        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response;
}

async function createToken(collectionId, tokenId, name, media){
    const response = await axios.post(process.env.ENJIN_API_URL, {
                query: `mutation CreateToken(
    $recipient: String!
    $collectionId: BigInt!
    $tokenId: BigInt
    $name: String!
    $media: String!
){
  CreateToken(
    recipient: $recipient
    collectionId: $collectionId
    params:{
      tokenId: {integer: $tokenId}
      initialSupply: 1
      attributes: [
      {
      	key: "name",
      	value: $name
    	},
      {
      	key: "media",
      	value: $media
    	}
    ]
    }
  ){
    id
    method
    state
  }
}`,
        variables: {
            recipient: process.env.DAEMON_WALLET_ADDRESS || "5EJDmqEoySnLk8xvPNPQGrb9qUrYLcbf38K4R6zKeNryvfD6",
            collectionId: collectionId,
            tokenId: tokenId,
            name: name,
            media: media
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response;
}

async function getToken(collectionId, tokenId) {
    const response = await axios.post(process.env.ENJIN_API_URL, {
        query: `query GetToken{
  GetToken(
    collectionId: ${collectionId}
    tokenId: {integer: ${tokenId}}
  ){
    metadata
  }
}`,
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response;
}

async function getManagedWallet(externalId){
    const response = await axios.post(process.env.ENJIN_API_URL, {
        query: `query GetWallet($externalId: String!){
  GetWallet(externalId: $externalId){
    account{
      publicKey
      address
    }
  }
}`,
        variables: {
            externalId: externalId
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response.data.data.GetWallet;
}

async function createManagedWallet(externalId){
    try {
        const existingWallet = await getManagedWallet(externalId);
        if (existingWallet) {
            console.log(`Managed wallet with external ID ${externalId} already exists.`);
            return existingWallet;
        }
        const response = await axios.post(process.env.ENJIN_API_URL, {
            query: `mutation CreateWallet($externalId: String!){
  CreateWallet(externalId: $externalId)
}`,
            variables: {
                externalId: externalId
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.ENJIN_API_KEY
            }
        });

        
        const maxRetries = 10;
        const retryInterval = 1000;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const wallet = await getManagedWallet(externalId);
            if (wallet && wallet.account && wallet.account.address) {
                return wallet; // Wallet found, return it.
            }

            // If wallet not found, wait before the next attempt.
            await sleep(retryInterval);
        }

        // If the loop completes without finding the wallet, handle the failure.
        console.error(`Failed to retrieve wallet for ${externalId} after ${maxRetries} attempts.`);
        return null;
        
    } catch (error) {
        console.error(`Failed to create managed wallet with external ID ${externalId}:`, error);
        throw error;
    }
    
}

async function mintToken(tokenId, recipient, amount){
    collectionId = process.env.ENJIN_COLLECTION_ID;
    const response = await axios.post(process.env.ENJIN_API_URL, {
        query: `mutation mintToken(
  $recipient: String!
  $collectionId: BigInt!
  $tokenId: BigInt
  $amount: BigInt!
){
  MintToken(
    recipient: $recipient
    collectionId: $collectionId
    params: {
      tokenId: {integer: $tokenId}
      amount: $amount
    }
  ){
    id
    method
    state
  }
}`,
        variables: {
            recipient: recipient,
            collectionId: collectionId,
            tokenId: tokenId,
            amount: amount
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response;
}

async function burnToken(tokenId, recipient, amount){
    collectionId = process.env.ENJIN_COLLECTION_ID;
    const response = await axios.post(process.env.ENJIN_API_URL, {
                query: `mutation mintToken(
  $recipient: String!
  $collectionId: BigInt!
  $tokenId: BigInt
  $amount: BigInt!
){
  MintToken(
    recipient: $recipient
    collectionId: $collectionId
    params: {
      tokenId: {integer: $tokenId}
      amount: $amount
    }
  ){
    id
    method
    state
  }
}`,
        variables: {
            recipient: recipient,
            collectionId: collectionId,
            tokenId: tokenId,
            amount: amount
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response;
}

async function transferToken(tokenId, recipient, amount){
    collectionId = process.env.ENJIN_COLLECTION_ID;
    const response = await axios.post(process.env.ENJIN_API_URL, {
                query: `mutation mintToken(
  $recipient: String!
  $collectionId: BigInt!
  $tokenId: BigInt
  $amount: BigInt!
){
  MintToken(
    recipient: $recipient
    collectionId: $collectionId
    params: {
      tokenId: {integer: $tokenId}
      amount: $amount
    }
  ){
    id
    method
    state
  }
}`,
        variables: {
            recipient: recipient,
            collectionId: collectionId,
            tokenId: tokenId,
            amount: amount
        }
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ENJIN_API_KEY
        }
    });

    return response;
}

async function waitForTransaction(requestId, operationType = 'operation') {
    while (true) {
        const transaction = await getTransactionStatus(requestId);

        if (transaction.state === 'PENDING') {
            console.log(`Please confirm the ${operationType} request in the Enjin Platform. Request ID: ${requestId}`);
            await sleep(10000);
            continue;
        }

        if (transaction.state === 'FINALIZED' && transaction.result === 'EXTRINSIC_SUCCESS') {
            return transaction;
        }

        if (transaction.state === 'FAILED' || transaction.result === 'EXTRINSIC_FAILED') {
            throw new Error(`${operationType} failed`);
        }

        console.log(`Waiting for the ${operationType} to finalize...`);
        await sleep(10000);
    }
}

async function checkAndCreateCollection() {
    if (!process.env.ENJIN_COLLECTION_ID) {
        console.log('No collection ID found. Creating new collection, please wait...');
        try {
            const createCollectionResponse = await createCollection();
            await sleep(10000);
            
            const requestId = createCollectionResponse.data.data.CreateCollection.id;
            const transaction = await waitForTransaction(requestId, "'Enjin Sample Game' collection creation");
            
            const collectionId = await extractCollectionId(transaction);
            if (collectionId) {
                await updateEnvFile(collectionId);
                console.log(`Created new collection with ID: ${collectionId}.`);
                return collectionId;
            }
            throw new Error('Failed to extract collection ID');
        } catch (error) {
            console.error('Failed to create collection:', error);
            throw error;
        }
    }
    return process.env.ENJIN_COLLECTION_ID;
}

async function checkTokenExists(collectionId, tokenId) {
    try {
        await getToken(collectionId, tokenId);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 400) {
            return false;
        }
        throw error;
    }
}

async function createResourceToken(collectionId, tokenId, name, media) {
    console.log(`Creating resource token '${name}', please wait...`);
    const createTokenResponse = await createToken(collectionId, tokenId, name, media);
    await sleep(10000);
    
    const requestId = createTokenResponse.data.data.CreateToken.id;
    await waitForTransaction(requestId, `'${name}' token creation`);
    console.log(`Resource token '${name}' created successfully.`);
}

async function prepareCollection() {
    // Ensure collection exists
    const collectionId = await checkAndCreateCollection();

    // Checks which resource tokens exist
    const tokenExistsChecks = await Promise.all(
        RESOURCE_TOKENS.map(token =>
            checkTokenExists(collectionId, token.id)
                .then(exists => ({ ...token, exists }))
        )
    );

    // Create missing tokens in parallel
    const tokensToCreate = tokenExistsChecks.filter(token => !token.exists);
    if (tokensToCreate.length > 0) {
        await Promise.all(
            tokensToCreate.map(token =>
                createResourceToken(collectionId, token.id, token.name, token.media)
                    .catch(error => {
                        console.error(`Failed to create resource token #${token.id}:`, error);
                        throw error;
                    })
            )
        );
    }
}

module.exports = {
    prepareCollection, createManagedWallet, getManagedWallet, mintToken, burnToken, transferToken
};