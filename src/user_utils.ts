import { db, auth } from './firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthError, onAuthStateChanged, signOut } from 'firebase/auth';
import { get, ref, set, update, onValue } from 'firebase/database';


export function showLogin(): void {
    ($('#loginModal') as any).modal('show');
}

export function showSignUp(): void {
    ($('#signUpModal') as any).modal('show');
}

export function login(): void {
    const email = (document.getElementById('loginEmail') as HTMLInputElement).value;
    const password = (document.getElementById('loginPassword') as HTMLInputElement).value;
    
    signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
        // Signed in successfully
        const user = userCredential.user;
        
        const userRef = ref(db, `users/${user.uid}`);
        
        // Fetch the data using get()
        get(userRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                const wallet = userData.wallet;
                window.localStorage.setItem('wallet', wallet);

                let isCertifier = userData.certifier;
                
                if(isCertifier) {
                    window.location.href = 'certifier.html';
                }else{
                    window.location.href = 'user.html';
                }
            } else {
                console.log('User data not found.');
                // Handle the case where user data is missing
                // Redirect or handle as per your application logic
                window.location.href = 'home.html';
            }
        })
        .catch((error) => {
            console.error('Error fetching user data:', error.message);
            alert('Error fetching user data. Please try again.');
        });
    })
    .catch((error: AuthError) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        alert(errorMessage);
    });
}

export function signUp(): void {
    const email = (document.getElementById('signUpEmail') as HTMLInputElement).value;
    const password = (document.getElementById('signUpPassword') as HTMLInputElement).value;
    const wallet = (document.getElementById('signUpWallet') as HTMLInputElement).value;
    const isCertifier = (document.getElementById('isCertifier') as HTMLInputElement).checked;
    
    createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
        // Signed up successfully
        const user = userCredential.user;
        
        // Save wallet to Firebase Database
        const userRef = ref(db, `users/${user.uid}`); // Assuming 'users' is the collection and user.uid is the unique identifier
        set(userRef, {
            email: user.email,
            wallet: wallet,
            certifier: isCertifier
        }).then(async () => {
            console.log('Wallet saved to Firebase Database');
            // Redirect to home and update 'wallet' paragraph
            if(isCertifier) {
                window.location.href = 'certifier.html';
            }
            else{
                window.location.href = 'user.html';
            }
            window.localStorage.setItem('wallet', wallet);
        }).catch((error) => {
            console.error('Error saving wallet:', error);
            alert('Error saving wallet. Please try again.');
        });
    })
    .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        alert(errorMessage);
    });
}
// ---------------
// logout function
// ---------------

// Logout function
export function logout(): void {
    signOut(auth)
    .then(() => {
        console.log('User signed out successfully');
        // CLEAN
        window.localStorage.setItem('wallet', '0x0');
        const nftsContainer = document.getElementById('NFTs');
        if (nftsContainer) { nftsContainer.innerHTML = ''; }
        // EXIT
        window.location.href = 'index.html';
    })
    .catch((error) => {
        alert(error.message);
    });
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

function showNFTs() {
    // ONLY IN USER PAGE
    if (window.location.pathname !== '/user.html') {
        console.log('Not on user page. Skipping NFTs fetch.');
        return;
    }

    // CHECK WALLET
    const wallet = window.localStorage.getItem('wallet');
    if (wallet === null || wallet === '0x0') {
        console.log('No wallet found. Please login to view NFTs.');
        return;
    }

    // FETCH NFTS
    console.log('Fetching NFTs for wallet:', wallet);
    const nftsRef = ref(db, `NFTs/${wallet}`);
    console.log('NFTs ref:', nftsRef);

    onValue(nftsRef, async (snapshot) => {
        console.log('Snapshot received:', snapshot.exists());
        const nftsContainer = document.getElementById('NFTs');
        if (nftsContainer) {
            nftsContainer.innerHTML = ''; // Clear existing NFTs

            if (snapshot.exists()) {
                const nfts = snapshot.val();
                console.log('NFTs data:', nfts); // Log the fetched NFTs data

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

                for (const key of Object.keys(nfts)) {
                    const nft = nfts[key];
                    console.log('NFT:', nft); // Log each individual NFT data

                    const metadata = await fetchMetadata(nft.metadataUri);
                    const solanaExplorerLink = `https://explorer.solana.com/tx/${nft.signature}?cluster=devnet`;
                    if (metadata) {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><img src="${metadata.image}" alt="NFT Image" width="150" height="150"></td>
                            <td>${metadata.brand}</td>
                            <td>${metadata.model}</td>
                            <td>${metadata.serialNumber}</td>
                            <td><a href="${solanaExplorerLink}" target="_blank"><img width="50" height="50" src="./images/solana.png"></a></td>
                            <td><a href="${nft.metadataUri}" target="_blank"><img width="50" height="50" src="./images/json.png"></a></td>
                            <td>${metadata.price} €</td>
                        `;
                        tbody?.appendChild(row);
                    }
                }

                nftsContainer.appendChild(table);
            } else {
                console.log('No NFTs found.');
                nftsContainer.innerHTML = '<p>No NFTs found.</p>';
            }
        } else {
            console.error('NFTs container not found in the DOM.');
        }
    }, (error) => {
        console.error('Error fetching NFTs:', error);
    });
}

showNFTs();