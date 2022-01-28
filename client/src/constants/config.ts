import {PublicKey} from "@solana/web3.js";
// import dotenv from "dotenv";
// dotenv.config();

export const NEIGHBORHOOD_SIZE = 200;
export const COLOR_CLUSTER_SIZE = NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE * 3 + 16 + 1;
export const K = 3;
export const UPPER = 125;
export const MAX_ACCOUNTS = 100;
export const MAX_REGISTER_ACCS = 5000;
export const RPC_mainnet = `https://extend.mainnet.rpcpool.com`;
export const RPC_devnet = `https://extend.devnet.rpcpool.com`;
export const RPC = process.env.REACT_APP_RPC;
export const NEIGHBORHOOD_LIST_SEED = "neighborhood_list";
export const NEIGHBORHOOD_FRAME_BASE_SEED = "neighborhood_frame_base";
export const NEIGHBORHOOD_FRAME_POINTER_SEED = "neighborhood_frame_pointer";
export const NEIGHBORHOOD_METADATA_SEED = "neighborhood_metadata";
export const SELL_DELEGATE_SEED = "sell_delegate"
export const SPACE_METADATA_SEED = "space_metadata";
export const VOUCHER_MINT_SEED = "voucher_mint";
export const VOUCHER_SINK_SEED = "voucher_sink";
export const RENT_ACCOUNT_SEED = "rent_account";

export const BATCH_TX_SIZE = 200;
export const BATCH_LOAD_PRICE_SIZE = 600;
export const MAX_TRANSACTION_SIZE = 1232;
export const BASE_TRANSACTION_SIZE = 3 + 32 + 65;
export const VOUCHER_PRICE_CONSTANT = 0.01059;
export const VOUCHER_MAX_PRICE = 1000000;
export const MINT_PRICE = 0.014;

export const BASE = new PublicKey(
  "XBSEZzB7ojaKgXqfCSpNbPLnuMGk3JVtSKYjXYqg7Pn"
);

export const EXTEND_TOKEN_MINT = new PublicKey(
  "Vote111111111111111111111111111111111111111"
); ////PLACEHOLDER

export const VOUCHER_MINT_AUTH = new PublicKey(
  "XCAPXCd2cRh1TKYXtK9AoWxbLPxFeykpnmU4S67Jzqu"
);

export const COLOR_PROGRAM_ID = new PublicKey(
  "XCLReS3yMKtcHWJxW8HX8yr6YmY8rwTaS5NUmVk21mM"
);
export const SPACE_PROGRAM_ID = new PublicKey(
  "XSPCZghPXkWTWpvrfQ34Szpx3rwmUjsxebRFf5ckbMD"
);
export const RENT_PROGRAM_ID = new PublicKey(
  "XRNTtrxNf3Y2pAyi2bKkngYpuRxRouTkTQ1bNro3KGx"
);
export const METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);
export const CANDY_MACHINE_PROGRAM_ID = new PublicKey(
  "XCNDrq9XYHPWi6BBWJg8huhtf6ZciNAQunkrtQgFHEz"
);

// This can be removed after metadata app is deployed
export const IMAGE_GENERATOR_URL = 'https://metadata.extend.xyz/api/';

export const CANDY_START_DATE = "1634841157";

export const CAPTCHA_VERIFY_URL = "https://captcha.extend.xyz/api/verify";

export const DATABASE_SERVER_URL = 'https://db.solanapixelexchange.com:3000';

export const CAPTCHA_SITE_KEY = "6LcsJZ4dAAAAADt6g3s1WR47si9byFbhEfge1vD9"; 
export const LEDGER_KEYPAIR_INDEX = 0;