const axios = require('axios');
const fs = require('fs');

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
        query: `mutation CreateCollection($forceCollapsingSupply: Boolean) {
    CreateCollection(
        mintPolicy: { forceCollapsingSupply: $forceCollapsingSupply }
        attributes:[
            {
                key: \"name\",
                value: \"Enjin Sample Game\"
            },
            {
                key: \"banner_image\",
                value: \"https://cdn.enjin.io/mint/image/sample-game-collection-banner.png\"
            },
            {
                key: \"media\",
                value: "[{\\\"type\\\":\\\"image/png\\\",\\\"url\\\":\\\"https://cdn.enjin.io/mint/image/sample-game-collection-image.png\\\"}]"
            }
        ]
    ) {
        id
        method
        state
    }
}`,
        variables: {
            forceCollapsingSupply: false
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
  $collectionId: BigInt!
  $tokenId: BigInt
  $name: String!
  $media: String!
){
  CreateToken(
    recipient: "5DcENk1KZjFo1C3Rp9drb1wuWP3vgZMUTEjBV3vw3Jm3wamK"
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

async function mintToken(collectionId, tokenId) {
    try {
        const response = await axios.post(process.env.ENJIN_API_URL, {
            query: `todo`,
            variables: {
                forceCollapsingSupply: false
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.ENJIN_API_KEY
            }
        });

        
        await sleep(1000);
        const requestId = response.data.data.CreateCollection.id;
        console.log(`New collection request was sent. Please confirm the request in the Enjin Platform. Request ID: ${requestId}`);

        // Poll for transaction status every 5 seconds
        while (true) {
            const transaction = await getTransactionStatus(requestId);

            if (transaction.state === 'PENDING'){
                console.log(`Please confirm the request in the Enjin Platform. Request ID: ${requestId}`);
                await sleep(10000);
                continue;
            }
            
            if (transaction.state === 'FINALIZED' && transaction.result === 'EXTRINSIC_SUCCESS') {
                const collectionId = await extractCollectionId(transaction);
                if (collectionId) {
                    await updateEnvFile(collectionId);
                    console.log(`Created new collection with ID: ${collectionId}. You can start playing the game!`);
                    break;
                }
            } else if (transaction.state === 'FAILED' || transaction.result === 'EXTRINSIC_FAILED') {
                throw new Error('Collection creation failed');
            }

            console.log('Waiting for collection creation to finalize...');
            await sleep(10000);
        }
    } catch (error) {
        console.error('Failed to create collection:', error);
        throw error;
    }
}

async function checkAndPrepareCollection() {
    if (!process.env.ENJIN_COLLECTION_ID) {
        console.log('No collection ID found. Creating new collection...');
        try {
            const createCollectionResponse = await createCollection();
            await sleep(1000);
            const requestId = createCollectionResponse.data.data.CreateCollection.id;

            // Poll for transaction status every 10 seconds
            while (true) {
                const transaction = await getTransactionStatus(requestId);

                if (transaction.state === 'PENDING'){
                    console.log(`Please confirm the request in the Enjin Platform. Request ID: ${requestId}`);
                    await sleep(10000);
                    continue;
                }
                
                if (transaction.state === 'FINALIZED' && transaction.result === 'EXTRINSIC_SUCCESS') {
                    const collectionId = await extractCollectionId(transaction);
                    if (collectionId) {
                        await updateEnvFile(collectionId);
                        console.log(`Created new collection with ID: ${collectionId}.`);
                        break;
                    }
                } else if (transaction.state === 'FAILED' || transaction.result === 'EXTRINSIC_FAILED') {
                    throw new Error('Collection creation failed');
                }

                console.log('Waiting for collection creation to finalize...');
                await sleep(10000);
            }
        } catch (error) {
            console.error('Failed to create collection:', error);
            throw error;
        }
    }

    let tokenResource1Exists = true;
    let tokenResource2Exists = true;
    let tokenResource3Exists = true;

    // Check if resource token #1 is created
    try{
        const getTokenResponse = await getToken(process.env.ENJIN_COLLECTION_ID, 1)
    } catch (error) {
        if (error.response && error.response.status === 400)
            tokenResource1Exists = false;
        else
            throw error;
    }

    // Check if resource token #2 is created
    try{
        const getTokenResponse = await getToken(process.env.ENJIN_COLLECTION_ID, 2)
    } catch (error) {
        if (error.response && error.response.status === 400)
            tokenResource2Exists = false;
        else
            throw error;
    }

    // Check if resource token #3 is created
    try{
        const getTokenResponse = await getToken(process.env.ENJIN_COLLECTION_ID, 3)
    } catch (error) {
        if (error.response && error.response.status === 400)
            tokenResource3Exists = false;
        else
            throw error;
    }

    // Creating resource token #1 if it's wasn't created yet.
    try{
        if (!tokenResource1Exists){
            console.log("Creating resource token #1.")
            const createTokenResponse = await createToken(process.env.ENJIN_COLLECTION_ID, 1, "Resource Token #1", "[{\\\"type\\\":\\\"image/png\\\",\\\"url\\\":\\\"https://cdn.enjin.io/mint/image/sample-game-collection-image.png\\\"}]");
            await sleep(1000);
            const createTokenRequestId = createTokenResponse.data.data.CreateToken.id;

            // Poll for transaction status every 10 seconds
            while (true) {
                const transaction = await getTransactionStatus(createTokenRequestId);

                if (transaction.state === 'PENDING'){
                    console.log(`Please confirm the request in the Enjin Platform. Request ID: ${createTokenRequestId}`);
                    await sleep(10000);
                    continue;
                }
                
                if (transaction.state === 'FINALIZED' && transaction.result === 'EXTRINSIC_SUCCESS') {
                    console.log("Resource token #1 created successfully.");
                    break;
                } else if (transaction.state === 'FAILED' || transaction.result === 'EXTRINSIC_FAILED') {
                    throw new Error('Token creation failed');
                }

                console.log('Waiting for token creation to finalize...');
                await sleep(10000);
            }

        }
    } catch (error) {
        console.error('Failed to create resource token #1:', error);
        throw error;
    }

    // Creating resource token #2 if it's wasn't created yet.
    try{
        if (!tokenResource2Exists){
            console.log("Creating resource token #2.")
            const createTokenResponse = await createToken(process.env.ENJIN_COLLECTION_ID, 2, "Resource Token #2", "[{\\\"type\\\":\\\"image/png\\\",\\\"url\\\":\\\"https://cdn.enjin.io/mint/image/sample-game-collection-image.png\\\"}]");
            await sleep(1000);
            const createTokenRequestId = createTokenResponse.data.data.CreateToken.id;

            // Poll for transaction status every 10 seconds
            while (true) {
                const transaction = await getTransactionStatus(createTokenRequestId);

                if (transaction.state === 'PENDING'){
                    console.log(`Please confirm the request in the Enjin Platform. Request ID: ${createTokenRequestId}`);
                    await sleep(10000);
                    continue;
                }
                
                if (transaction.state === 'FINALIZED' && transaction.result === 'EXTRINSIC_SUCCESS') {
                    console.log("Resource token #2 created successfully.");
                    break;
                } else if (transaction.state === 'FAILED' || transaction.result === 'EXTRINSIC_FAILED') {
                    throw new Error('Token creation failed');
                }

                console.log('Waiting for token creation to finalize...');
                await sleep(10000);
            }

        }
    } catch (error) {
        console.error('Failed to create resource token #2:', error);
        throw error;
    }

    // Creating resource token #3 if it's wasn't created yet.
    try{
        if (!tokenResource3Exists){
            console.log("Creating resource token #3.")
            const createTokenResponse = await createToken(process.env.ENJIN_COLLECTION_ID, 3, "Resource Token #3", "[{\\\"type\\\":\\\"image/png\\\",\\\"url\\\":\\\"https://cdn.enjin.io/mint/image/sample-game-collection-image.png\\\"}]");
            await sleep(1000);
            const createTokenRequestId = createTokenResponse.data.data.CreateToken.id;

            // Poll for transaction status every 10 seconds
            while (true) {
                const transaction = await getTransactionStatus(createTokenRequestId);

                if (transaction.state === 'PENDING'){
                    console.log(`Please confirm the request in the Enjin Platform. Request ID: ${createTokenRequestId}`);
                    await sleep(10000);
                    continue;
                }
                
                if (transaction.state === 'FINALIZED' && transaction.result === 'EXTRINSIC_SUCCESS') {
                    console.log("Resource token #3 created successfully.");
                    break;
                } else if (transaction.state === 'FAILED' || transaction.result === 'EXTRINSIC_FAILED') {
                    throw new Error('Token creation failed');
                }

                console.log('Waiting for token creation to finalize...');
                await sleep(10000);
            }

        }
    } catch (error) {
        console.error('Failed to create resource token #3:', error);
        throw error;
    }
}

module.exports = {
    checkAndPrepareCollection
};