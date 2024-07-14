import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { createGenericFile, createSignerFromKeypair, signerIdentity, generateSigner, percentAmount } from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { base58 } from '@metaplex-foundation/umi/serializers';

import { db, auth } from './firebaseConfig';
import { ref, push, set, onValue } from 'firebase/database';

import wallet from "./wallet.json";


// Declare `umi` variable for TypeScript to recognize it
let umi: any;
let myKeypairSigner: any;

// Initialize `umi` asynchronously
async function initializeUmi() {
    try {
        umi = createUmi("https://api.devnet.solana.com", "finalized");

        const keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
        myKeypairSigner = createSignerFromKeypair(umi, keypair);
        umi.use(signerIdentity(myKeypairSigner)).use(irysUploader());

        console.log("Umi initialized successfully");
    } catch (error) {
        console.error("Failed to initialize umi:", error);
        throw error;
    }
}

async function getImageUri():Promise<string>{
    // Ensure umi is initialized before proceeding
    await initializeUmi();

    // READ PARAMS
    const fileInput = document.getElementById('image') as HTMLInputElement;
    const brand = (document.getElementById('brandName') as HTMLInputElement).value;
    const model = (document.getElementById('modelName') as HTMLInputElement).value;

    // UPLAOD IMAGE    
    const file = fileInput.files?.[0];

    if (!file) {
        throw new Error("No file selected");
    }

    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = async (event) => {
            try {
                const arrayBuffer = event.target?.result;
                if (!arrayBuffer) {
                    throw new Error("Failed to read file");
                }

                const nft_image = createGenericFile(new Uint8Array(arrayBuffer as ArrayBuffer), `${brand}-${model}`);

                const [myUri] = await umi.uploader.upload([nft_image]);

                console.log("Image URI: " + myUri);

                resolve(myUri);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => {
            reject(error);
        };

        reader.readAsArrayBuffer(file);
    });
}

async function getMetadataUri(imageUri:string):Promise<string>{
    // Ensure umi is initialized before proceeding
    await initializeUmi();
    
    // READ PARAMS
    const description = (document.getElementById('description') as HTMLInputElement).value;
    const serialNumber = (document.getElementById('serialNumber') as HTMLInputElement).value;
    const year = (document.getElementById('productionYear') as HTMLInputElement).value;
    const status = (document.getElementById('watchStatus') as HTMLInputElement).value;    
    const price = (document.getElementById('watchPriceEstimation') as HTMLInputElement).value;
    const owner = (document.getElementById('watchOwner') as HTMLInputElement).value;
    const brand = (document.getElementById('brandName') as HTMLInputElement).value;
    const model = (document.getElementById('modelName') as HTMLInputElement).value;

    // CREATE NFT METADATA
    const metadata = {
        name: "Lux Cert NFT",
        symbol: "LXC",
        description: description,
        image: imageUri,
        brand: brand,
        model: model,
        serialNumber: serialNumber,
        year: year,
        status: status,
        price: price,
        owner: owner,
        date: new Date().toISOString(),
        attributes: [
            {
                trait_type: "Rarity",
                value: "Common"
            },
            {
                trait_type: "Author",
                value: "CERT-" + window.localStorage.getItem('wallet')
            }
        ],
        properties: {
            files: [
                {
                    type: "image/jpeg",
                    uri: imageUri
                }
            ]
        }
    };

    const nftUri = await umi.uploader.uploadJson(metadata);
    console.log("Metadata URI: " + nftUri);
    return nftUri;
}

async function saveSignature(signature: string, metadataUri: string) {
    // READ OWNER
    const owner = (document.getElementById('watchOwner') as HTMLInputElement).value;

    // Generate a unique ID for the signature entry
    const newSignatureRef = push(ref(db, 'NFTs/' + owner));

    // SAVE OWNER - SIGNATURE on FireBase DB
    set(newSignatureRef, {
        signature: signature,
        metadataUri: metadataUri,
        timestamp: new Date().toISOString() // Optional: Add timestamp
    }).then(() => {
        console.log('Data saved successfully!');
    }).catch((error) => {
        console.error('Error saving data:', error);
    });
}

async function getNFTSignature(metadataUri:string): Promise<string> {
    // RESET UMI
    await initializeUmi();
    umi.use(signerIdentity(myKeypairSigner)).use(mplTokenMetadata());

    // UTILS
    let signature: any;
 
    // NFT GENERATION
    const name = "Lux Cert NFT";
    const symbol = "LXC";
    const uri = metadataUri;
    const mint = generateSigner(umi);
    const sellerFeeBasisPoints = percentAmount(5, 2);

    (async () => {

        let tx = createNft(
            umi,
            {
                mint,
                name,
                symbol,
                uri,
                sellerFeeBasisPoints,
            }
        );

        let result = await tx.sendAndConfirm(umi);
        const res = base58.deserialize(result.signature);

        if (!Array.isArray(res)) {
            console.error("Signature is not an array");
            return null;
        }
        
        signature = res[0];
        console.log(`Signature: ${signature}`);

        // SAVE ADDRESS_OWNER - SIGNATURE on FireBase DB
        saveSignature(signature, metadataUri);

        // UPLOAD UI
        updateSolanaExplorer(signature, metadataUri);
    })();
    return signature;
}

export async function generateNFT(): Promise<any> {

    // show spinner
    const spinner = window.document.getElementById('spinner');
    spinner?.removeAttribute('hidden');

    // disable button
    window?.document?.getElementById('submit-nft')?.setAttribute('disabled','true');
    window?.document?.getElementById('submit-nft')?.setAttribute('class', 'btn btn-secondary');

    // UPLOAD IMAGE
    console.log("UPLOADING IMAGE");
    const imageUri = await getImageUri();

    // UPLOAD METADATA
    console.log("UPLOADING METADATA");
    const metadataUri = await getMetadataUri(imageUri);

    // GENERATE NFT
    console.log("GENERATING NFT");
    const signature = await getNFTSignature(metadataUri);

    // RETURN
    return signature;
}

function updateSolanaExplorer(signature: string, metadataUri: string) {
    // creating solana explorer link
    const solanaExplorerLink = `https://explorer.solana.com/tx/${signature}?cluster=devnet`;

    // Visualize NFT data
    visualizeNFTData(signature, metadataUri, solanaExplorerLink);

    // enable button
    window?.document?.getElementById('submit-nft')?.removeAttribute('disabled');
    window?.document?.getElementById('submit-nft')?.setAttribute('class', 'btn btn-primary');

    // hide spinner
    const spinner = window.document.getElementById('spinner');
    spinner?.setAttribute('hidden', 'true');

    // close/hide modal
    const modalElement = window.document.getElementById('createCertificateModal') as HTMLDivElement;

    if (modalElement) {
        modalElement.classList.remove('show');
        modalElement.setAttribute('aria-hidden', 'true');
        modalElement.setAttribute('style', 'display: none');

        // get modal backdrop
        const modalBackdrops = document.getElementsByClassName('modal-backdrop');

        // remove opened modal backdrop
        document.body.removeChild(modalBackdrops[0]);
    }
}

async function fetchMetadata(metadataUri: string) {
    try {
        const response = await fetch(metadataUri);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const metadata = await response.json();
        return metadata;
    } catch (error) {
        console.error('Failed to fetch metadata:', error);
        return null;
    }
}

async function visualizeNFTData(signature: string, metadataUri: string, solanaExplorerLink: string) {    
    const metadata = await fetchMetadata(metadataUri);
    if (!metadata) {
        console.error('Failed to fetch metadata');
        return;
    }

    // Update UI
    const nftElement = window.document.getElementById('emptyNFT');
    if (!nftElement) {
        return;
    }

    nftElement.innerHTML = '';

    // Create a table to display the NFTs
    const table = document.createElement('table');
    table.classList.add('table', 'table-striped', 'table-bordered');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Image</th>
                <th>Brand</th>
                <th>Model</th>
                <th>Serial Number</th>
                <th>Solana Explorer</th>
                <th>Metadata URI</th>
                <th>Price Estimation [€]</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    // ROW
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><img src="${metadata.image}" alt="NFT Image" width="150" height="150"></td>
        <td>${metadata.brand}</td>
        <td>${metadata.model}</td>
        <td>${metadata.serialNumber}</td>
        <td><a href="${solanaExplorerLink}" target="_blank"><img width="50" height="50" src="./images/solana.png"></a></td>
        <td><a href="${metadataUri}" target="_blank"><img width="50" height="50" src="./images/json.png"></a></td>
        <td>${metadata.price} €</td>
    `;
    tbody?.appendChild(row);

    // APPEND
    
    nftElement.appendChild(table);
}
