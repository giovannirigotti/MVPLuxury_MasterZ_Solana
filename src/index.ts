// -------------------
// --- TEST SCRIPT ---
// -------------------

import { generateNFT } from './solana_utils';

// -------------------
// -- LOGIN SCRIPTS --
// -------------------

import { showLogin } from './user_utils';
import { showSignUp } from './user_utils';
import { login } from './user_utils';
import { signUp } from './user_utils';
import { logout } from './user_utils';

// -------------------
// ----- EXPORTS -----
// -------------------

(window as any).showLogin = showLogin;
(window as any).showSignUp = showSignUp;
(window as any).login = login;
(window as any).signUp = signUp;
(window as any).logout = logout;

(window as any).generateNFT = generateNFT;
