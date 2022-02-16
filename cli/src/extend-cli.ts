import { program } from "commander";
import * as anchor from "@project-serum/anchor";
import log from "loglevel";
import {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { parseDate, parsePrice, getVoucherMint, getVoucherSink, getNeighborhoodMetadata, sleep, getSpacesByOwner, registerDB, batchGetMultipleAccountsInfo } from "./helpers/various";
import { clusterApiUrl, Keypair, PublicKey } from "@solana/web3.js";
import { upload } from "./commands/upload";
import { mint } from "./commands/mint";
import { send_all_nfts } from "./commands/sendAllNfts";
import {
  createColorClusterInstruction,
  createTimeClusterInstruction,
  initFrameInstruction,
} from "./../../client/src/actions/init_frame";
import { initBaseInstruction } from "./../../client/src/actions/init_base";
import { updateAuthorityInstruction } from "./../../client/src/actions/update_authority";
import { initNeighborhoodMetadataInstruction } from "./../../client/src/actions/init_neighborhood_metadata";
import { initSpaceMetadataInstructions } from "./../../client/src/actions/init_space_metadata";
import { initVoucherSystemInstruction } from "./../../client/src/actions/init_voucher_system";
import { mintOneTokenInstructions, getCandyMachine } from "./../../client/src/components/Mint/candy-machine";
import { MintLayout } from "@solana/spl-token";
import { sendInstructionsGreedyBatchMint, sendInstructionsGreedyBatch, sendTransactionWithRetryWithKeypair } from "./helpers/transactions";
import base58 from "bs58";
import {
  getCandyMachineAddress,
  loadCandyProgram,
  loadWalletKey,
  loadWalletKeyOrLedger,
} from "./helpers/accounts";

import { loadCache, saveCache, saveBase } from "./helpers/cache";

import {
  BASE,
  VOUCHER_MINT_SEED,
  VOUCHER_SINK_SEED,
  SPACE_PROGRAM_ID,
  VOUCHER_MINT_AUTH,
  SPACE_METADATA_SEED,
  MAX_REGISTER_ACCS
} from "../../client/src/constants";
import { twoscomplement_i2u } from "../../client/src/utils/borsh";

programCommand("send-all-nfts")
  .option("-r, --destination-address <string>", "Destination address")
  .option("-d, --dry")

  .action(async (directory, cmd) => {
    const { keypair, env, cacheName, destinationAddress, dry } = cmd.opts();

    const payerKp = loadWalletKey(keypair);
    const destinationPubkey = new PublicKey(destinationAddress);

    const tx = await send_all_nfts(payerKp, destinationPubkey, env, dry);
    log.info("mint_one_token finished", tx);
  });

programCommand("mint-tokens")
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .option("-t, --number-of-tokens <number>", `Number of tokens`, "1")
  .option("-r, --rpc-token <string>", "RPC token")
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      neighborhoodRow,
      neighborhoodCol,
      numberOfTokens,
      rpcToken,
    } = cmd.opts();

    const n = parseInt(numberOfTokens); // parse args
    // const solConnection = new anchor.web3.Connection(clusterApiUrl(env));
    const solConnection = new anchor.web3.Connection(`https://extend.${env}.rpcpool.com/${rpcToken}`);
    const walletKeyPair = await loadWalletKey(keypair);
    const neighborhoodX = Number(neighborhoodRow);
    const neighborhoodY = Number(neighborhoodCol);

    const voucherSink = await getVoucherSink(neighborhoodX, neighborhoodY); // find relevant accounts
    const voucherMint = await getVoucherMint(neighborhoodX, neighborhoodY);
    const nhoodAcc = await getNeighborhoodMetadata(neighborhoodX, neighborhoodY);
    const account = await solConnection.getAccountInfo(nhoodAcc);
    const candyConfig = new anchor.web3.PublicKey(account.data.slice(33, 65));
    const candyId = new anchor.web3.PublicKey(account.data.slice(65, 97));
    const wallet = new anchor.Wallet(walletKeyPair);
    const candyMachine = await getCandyMachine(wallet, solConnection, candyId);

    let ixs: anchor.web3.TransactionInstruction[][] = [];
    let mints: anchor.web3.Keypair[] = [];
    const rent = await solConnection.getMinimumBalanceForRentExemption(
      MintLayout.span
    );
    
    for (let i = 0; i < n; i++) { // get mint instructions
      let mint = anchor.web3.Keypair.generate();
      let mintInstructions = await mintOneTokenInstructions(
        candyMachine,
        candyConfig,
        walletKeyPair.publicKey,
        VOUCHER_MINT_AUTH,
        wallet, // not using wallet to get instructions
        mint,
        voucherMint,
        rent,
        voucherSink,
      );
      ixs.push(mintInstructions);
      mints.push(mint);
    }

    const response = await sendInstructionsGreedyBatchMint(
      solConnection,
      wallet,
      ixs,
      mints,
    )

    console.log(`Mint successful for ${response.numSucceed} out of ${response.total} NFTS`)
  });

  programCommand("register")
  .option("-r, --rpc-token <string>", "RPC token")
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      rpcToken,
    } = cmd.opts();

    const solConnection = new anchor.web3.Connection(`https://extend.${env}.rpcpool.com/${rpcToken}`);
    const walletKeyPair = await loadWalletKey(keypair);
    const wallet = new anchor.Wallet(walletKeyPair);

    const currSpaceAccs = {};
    const currMints = {};
    let accs: any[] = [];

    const data = await getSpacesByOwner(solConnection, walletKeyPair.publicKey);
    let ownedSpacesArray: any[] = [...data.spaces]; // get unregistered spaces and mints
    let ownedMintsDict = data.mints;

    for (const p of ownedSpacesArray) {
      const pos = JSON.parse(p);
      const space_x = twoscomplement_i2u(pos.x);
      const space_y = twoscomplement_i2u(pos.y);
      const spaceAcc = (await PublicKey.findProgramAddress(
        [
          BASE.toBuffer(),
          Buffer.from(SPACE_METADATA_SEED),
          Buffer.from(space_x),
          Buffer.from(space_y),
        ],
        SPACE_PROGRAM_ID
      ))[0];
      accs.push(spaceAcc);
    }
    console.log("Accounts", accs.length)
    const accInfos = await batchGetMultipleAccountsInfo(solConnection, accs);
    
    // pass the accounts and mints we want to initialize
    let numAccountsToRegister = 0;
    for (let i = 0; i < accInfos.length; i++) {
      if (accInfos[i] === null) {
        if (numAccountsToRegister < MAX_REGISTER_ACCS) { // limit to MAX register accs in current batch
          currSpaceAccs[ownedSpacesArray[i]] = accs[i];
          currMints[ownedSpacesArray[i]] = ownedMintsDict[ownedSpacesArray[i]];
        }
        numAccountsToRegister++;
      }
    }

    const numRegistering = Object.keys(currMints).length;
    console.log("Need to register", numRegistering)

    if (numRegistering === 0) { // if there are no spaces to register
      console.log("Nothing to register")
    } else {
      try {
        let ixs = await initSpaceMetadataInstructions(wallet, BASE, currSpaceAccs, currMints);
        let res = await sendInstructionsGreedyBatch(solConnection, wallet, ixs); 

        // update mints that have been registered
        let responses = res.responses;
        let ixPerTx = res.ixPerTx;
        let allPositions = Object.keys(currSpaceAccs);
        let ind = 0;
        let doneMints = {};
        for (let i = 0; i < responses.length; i++) {
          if (responses[i]) { // if tx success
            for (let j = 0; j < ixPerTx[i]; j++) {
              doneMints[allPositions[ind + j]] = currMints[allPositions[ind + j]];
            }
          }
          ind += ixPerTx[i];
        }

        // update database for mints that have registered
        await sleep(20000); // sleep 20 seconds metadata completion
        await registerDB(walletKeyPair.publicKey, doneMints, env);

        // notify if need to reclick register
        let numSucceed = res.spacesSucceed;
        console.log("Number of registered spaces that succeeded", numSucceed)
      }
      catch (e) {
        console.log(e);
      }
    }
  });

programCommand("initialize-base")
  .option("-v --vanity <string>", "Vanity keypair", null)
  .action(async (directory, cmd) => {
    console.log("INITIALIZING BASE");
    const { keypair, env, vanity } = cmd.opts();

    const base_keypair = vanity ? loadWalletKey(vanity) : new Keypair();

    const walletKeyPair = await loadWalletKeyOrLedger(keypair);
    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));

    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      await initBaseInstruction(
        walletKeyPair,
        base_keypair.publicKey
      ),
      [base_keypair]
    );

    const cacheName = base_keypair.publicKey.toBase58().slice(0, 8);
    saveBase(cacheName, env, {
      base_pubkey: base_keypair.publicKey.toBase58(),
    });
    console.log("SUCCESSFULLY INITIALIZED BASE");
    console.log("cacheNAME : ", cacheName);
    console.log(
      "Base : ",
      base_keypair.publicKey.toBase58(),
      "please add to client/src/constants/config.ts"
    );
  });

  programCommand("update-authority")
  .option(
    "-a, --auth <path>",
    `new authority`,
    "--auth not provided"
  )

  .action(async (directory, cmd) => {
    console.log("UPDATING AUTHORITY");
    const { keypair, env, auth } = cmd.opts();

    const walletKeyPair = await loadWalletKeyOrLedger(keypair);
    const newAuth = await loadWalletKeyOrLedger(auth);
    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));

    const base_address = BASE;

    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      await updateAuthorityInstruction(
        walletKeyPair,
        base_address,
        walletKeyPair.publicKey,
        newAuth.publicKey,
      ),
      []
    );

    console.log("SUCCESSFULLY UPDATED AUTHORITY");
  });

programCommand("register-candy-machine")
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .action(async (directory, cmd) => {
    const { keypair, env, cacheName, neighborhoodRow, neighborhoodCol, base } =
      cmd.opts();

    console.log("REGISTERING CANDY MACHINE");
    const cacheContent = loadCache(
      neighborhoodRow,
      neighborhoodCol,
      cacheName,
      env
    );

    const base_address = BASE;

    const walletKeyPair = await loadWalletKeyOrLedger(keypair);

    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));

    const candyMachineConfig = new PublicKey(cacheContent.program.config);
    const candyMachineAddress = new PublicKey(cacheContent.candyMachineAddress);

    const nrow = Number(neighborhoodRow);
    const ncol = Number(neighborhoodCol);
    if (isNaN(nrow) || isNaN(ncol)) {
      throw new Error(
        `Invalid neighboorhood row (${neighborhoodRow}) or col (${neighborhoodCol})`
      );
    }

    console.log(walletKeyPair.publicKey.toBase58());

    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      await initNeighborhoodMetadataInstruction(
        walletKeyPair,
        base_address,
        neighborhoodRow,
        neighborhoodCol,
        1,
        candyMachineConfig,
        candyMachineAddress
      ),
      []
    );

    console.log("REGISTERED CANDY MACHINE");
  });

programCommand("init-voucher-system")
  .option(
    "-a, --captcha-auth <path>",
    `voucher mint auth location`,
    "--keypair not provided"
  )
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      cacheName,
      captchaAuth,
      neighborhoodRow,
      neighborhoodCol,
      base,
    } = cmd.opts();

    console.log("INITIALIZING VOUCHER SYSTEM");
    const cacheContent = loadCache(
      neighborhoodRow,
      neighborhoodCol,
      cacheName,
      env
    );
    const auth = captchaAuth

    const base_address = BASE;

    const walletKeyPair = await loadWalletKeyOrLedger(keypair);
    const voucherMintAuth = loadWalletKey(auth);

    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));

    const candyMachineConfig = new PublicKey(cacheContent.program.config);
    const candyMachineAddress = new PublicKey(cacheContent.candyMachineAddress);

    const nrow = Number(neighborhoodRow);
    const ncol = Number(neighborhoodCol);
    if (isNaN(nrow) || isNaN(ncol)) {
      throw new Error(
        `Invalid neighboorhood row (${neighborhoodRow}) or col (${neighborhoodCol})`
      );
    }

    console.log("wallet",walletKeyPair.publicKey.toBase58());

    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      await initVoucherSystemInstruction(
        walletKeyPair,
        base_address,
        neighborhoodRow,
        neighborhoodCol,
        voucherMintAuth.publicKey,
      ),
      [voucherMintAuth]
    );

    console.log("VOUCHERS SYSTEM COMPLETE");
  });

programCommand("initialize-cluster")
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .option("-f, --frame <number>", `Frame`, undefined)
  .action(async (directory, cmd) => {
    console.log("INITIALIZING FRAME");

    const {
      keypair,
      env,
      cacheName,
      neighborhoodRow,
      neighborhoodCol,
      frame,
      base,
    } = cmd.opts();
    const cacheContent = loadCache(
      neighborhoodRow,
      neighborhoodCol,
      cacheName,
      env
    );

    const base_address = BASE;

    const walletKeyPair = await loadWalletKeyOrLedger(keypair);

    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));

    const nrow = Number(neighborhoodRow);
    const ncol = Number(neighborhoodCol);
    if (isNaN(nrow) || isNaN(ncol)) {
      throw new Error(
        `Invalid neighboorhood row (${neighborhoodRow}) or col (${neighborhoodCol})`
      );
    }

    const colorRes = await createColorClusterInstruction(
      solConnection,
      walletKeyPair
    );
    const timeRes = await createTimeClusterInstruction(
      solConnection,
      walletKeyPair
    );

    log.debug("Parsed arguments!");
    const ixs = await initFrameInstruction(
      solConnection,
      walletKeyPair,
      base_address,
      neighborhoodRow,
      neighborhoodCol,
      colorRes["keypair"].publicKey,
      timeRes["keypair"].publicKey,
    );

    log.debug("Instructions complete");
    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      [...colorRes["ix"], ...timeRes["ix"], ...ixs],
      [colorRes["keypair"], timeRes["keypair"]],
    );

    console.log("FRAME INITIALIZED");
  });

programCommand("create-candy-machine")
  .option(
    "-p, --price <string>",
    "Price denominated in SOL or spl-token override",
    "1"
  )
  .option(
    "-t, --spl-token <string>",
    "SPL token used to price NFT mint. To use voucher mint leave this empty."
  )
  .option(
    "-a, --spl-token-account <string>",
    "SPL token account that receives mint payments. Only required if spl-token is specified."
  )
  // .option(
  //   "-r, --require-creator-signature",
  //   "Use if minting should require creator signature"
  // )
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .action(async (directory, cmd) => {
    //CHECK TEHESE DIFFS
    console.log("CREATING CANDY MACHINE");
    const {
      keypair,
      env,
      price,
      cacheName,
      splToken,
      splTokenAccount,
      // requireCreatorSignature,
      neighborhoodRow,
      neighborhoodCol,
    } = cmd.opts();

    let parsedPrice = parsePrice(price);
    const cacheContent = loadCache(
      neighborhoodRow,
      neighborhoodCol,
      cacheName,
      env
    );

    const walletKeyPair =
      keypair !== "ledger"
        ? loadWalletKey(keypair)
        : Keypair.fromSecretKey(base58.decode(cacheContent.hot_wallet));
    const anchorProgram = await loadCandyProgram(walletKeyPair, env);

    let wallet = walletKeyPair.publicKey;
    const remainingAccounts = [];

    const n_x = twoscomplement_i2u(Number(neighborhoodRow));
    const n_y = twoscomplement_i2u(Number(neighborhoodCol));
    const voucherMint = (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          BASE.toBuffer(),
          Buffer.from(VOUCHER_MINT_SEED),
          Buffer.from(n_x),
          Buffer.from(n_y),
        ],
        SPACE_PROGRAM_ID
      )
    )[0];
    const voucherSink = (
      await anchor.web3.PublicKey.findProgramAddress(
        [
          BASE.toBuffer(),
          Buffer.from(VOUCHER_SINK_SEED),
          Buffer.from(n_x),
          Buffer.from(n_y),
        ],
        SPACE_PROGRAM_ID
      )
    )[0];

    const splTokenKey = splToken ? new PublicKey(splToken) : voucherMint;
    const splTokenAccountKey = splTokenAccount
      ? new PublicKey(splTokenAccount)
      : voucherSink;

    const token = new Token(
      anchorProgram.provider.connection,
      splTokenKey,
      TOKEN_PROGRAM_ID,
      walletKeyPair
    );

    const mintInfo = await token.getMintInfo();
    if (!mintInfo.isInitialized) {
      throw new Error(`The specified spl-token is not initialized`);
    }
    const tokenAccount = await token.getAccountInfo(splTokenAccountKey);
    if (!tokenAccount.isInitialized) {
      throw new Error(`The specified spl-token-account is not initialized`);
    }
    if (!tokenAccount.mint.equals(splTokenKey)) {
      throw new Error(
        `The spl-token-account's mint (${tokenAccount.mint.toString()}) does not match specified spl-token ${splTokenKey.toString()}`
      );
    }

    wallet = splTokenAccountKey;
    parsedPrice = parsePrice(price, 10 ** mintInfo.decimals);
    remainingAccounts.push({
      pubkey: splTokenKey,
      isWritable: false,
      isSigner: false,
    });

    const config = new PublicKey(cacheContent.program.config);
    const [candyMachine, bump] = await getCandyMachineAddress(
      config,
      cacheContent.program.uuid
    );

    console.log("voucher sink token account", wallet.toBase58())
    console.log("voucher token", splTokenKey.toBase58())
    console.log("fee payer", walletKeyPair.publicKey.toBase58())

    await anchorProgram.rpc.initializeCandyMachine(
      bump,
      {
        uuid: cacheContent.program.uuid,
        price: new anchor.BN(parsedPrice),
        itemsAvailable: new anchor.BN(Object.keys(cacheContent.items).length),
        goLiveDate: null,
        // requireCreatorSignature: requireCreatorSignature,
      },
      {
        accounts: {
          candyMachine,
          wallet,
          config: config,
          authority: walletKeyPair.publicKey,
          payer: walletKeyPair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [],
        remainingAccounts,
      }
    );
    cacheContent.candyMachineAddress = candyMachine.toBase58();
    saveCache(neighborhoodRow, neighborhoodCol, cacheName, env, cacheContent);
    log.info(
      `create_candy_machine finished. candy machine pubkey: ${candyMachine.toBase58()}`
    );
  });

programCommand("update-candy-machine")
  .option(
    "-d, --date <string>",
    'timestamp - eg "04 Dec 1995 00:12:00 GMT" or "now"'
  )
  .option("-p, --price <string>", "SOL price")
  // .option(
  //   "-r, --require-creator-signature",
  //   "Use if minting should require creator signature"
  // )
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .action(async (directory, cmd) => {
    const {
      keypair,
      env,
      date,
      price,
      // requireCreatorSignature,
      cacheName,
      neighborhoodRow,
      neighborhoodCol,
    } = cmd.opts();

    console.log("UPDATING CANDY MACHINE");

    const cacheContent = loadCache(
      neighborhoodRow,
      neighborhoodCol,
      cacheName,
      env
    );

    if (cacheContent) {
      const secondsSinceEpoch = date ? parseDate(date) : null;
      const lamports = price ? parsePrice(price) : null;

      const walletKeyPair =
        keypair !== "ledger"
          ? loadWalletKey(keypair)
          : Keypair.fromSecretKey(base58.decode(cacheContent.hot_wallet));
      const anchorProgram = await loadCandyProgram(walletKeyPair, env);

      const candyMachine = new PublicKey(cacheContent.candyMachineAddress);
      const tx = await anchorProgram.rpc.updateCandyMachine(
        lamports ? new anchor.BN(lamports) : null,
        secondsSinceEpoch ? new anchor.BN(secondsSinceEpoch) : null,
        // requireCreatorSignature ? requireCreatorSignature : null,
        {
          accounts: {
            candyMachine,
            authority: walletKeyPair.publicKey,
          },
        }
      );

      cacheContent.startDate = secondsSinceEpoch;
      saveCache(neighborhoodRow, neighborhoodCol, cacheName, env, cacheContent);

      if (date)
        log.info(
          ` - updated startDate timestamp: ${secondsSinceEpoch} (${date})`
        );
      if (lamports)
        log.info(` - updated price: ${lamports} lamports (${price} SOL)`);

      if (cacheContent.hot_wallet) {
        const ledgerWallet = await loadWalletKeyOrLedger("ledger");
        const newAuthority = ledgerWallet.publicKey;
        await anchorProgram.rpc.updateAuthority(newAuthority, {
          accounts: {
            candyMachine,
            authority: walletKeyPair.publicKey,
          },
        });

        log.info("Authority given to :", ledgerWallet.publicKey.toBase58());
      }
      log.info("update_candy_machine finished", tx);
    }
  });

programCommand("dismantle-candy-machine")
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .action(async (directory, cmd) => {
    const { keypair, env, cacheName, neighborhoodRow, neighborhoodCol } =
      cmd.opts();

    const cacheContent = loadCache(
      neighborhoodRow,
      neighborhoodCol,
      cacheName,
      env
    );

    if (cacheContent) {
      const walletKeyPair = loadWalletKey(keypair);
      const anchorProgram = await loadCandyProgram(walletKeyPair, env);

      const configPubkey = new PublicKey(cacheContent.program.config);
      const tx = await anchorProgram.rpc.withdrawFunds({
        accounts: {
          config: configPubkey,
          authority: walletKeyPair.publicKey,
        },
      });

      log.info("dismantle finished", tx);
    }
  });

programCommand("upload-neighborhood")
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .option("--no-retain-authority", "Do not retain authority to update metadata")
  .option("--no-mutable", "Metadata will not be editable")
  .action(async (options, cmd) => {
    const {
      neighborhoodRow,
      neighborhoodCol,
      keypair,
      env,
      cacheName,
      retainAuthority,
      mutable,
    } = cmd.opts();

    const items = [];

    for (
      let row = parseInt(neighborhoodRow) * 200;
      row < (parseInt(neighborhoodRow) + 1) * 200;
      row++
    ) {
      for (
        let col = parseInt(neighborhoodCol) * 200;
        col < (parseInt(neighborhoodCol) + 1) * 200;
        col++
      ) {
        items.push([row, col]);
      }
    }

    console.log(`Beginning the upload for ${items.length} NFTS`);

    const startMs = Date.now();
    log.info("started at: " + startMs.toString());
    let config;
    try {
      config = await upload({
        items,
        cacheName,
        env,
        keypair,
        retainAuthority,
        mutable,
        neighborhoodRow,
        neighborhoodCol,
      });
    } catch (err) {
      log.warn("upload was not successful, please re-run.", err);
    }

    const endMs = Date.now();
    const timeTaken = new Date(endMs - startMs).toISOString().substr(11, 8);
    log.info(
      `ended at: ${new Date(endMs).toISOString()}. time taken: ${timeTaken}`
    );
    log.info(
      `candy machine config to copy: ${config}`
    )
  });

programCommand("transfer-voucher-tokens")
  .option("-m, --voucher-mint <string>", `Voucher mint`, undefined)
  .option("-d, --address <string>", `Destination Address`, undefined)
  .option("-a, --amount <string>", `Amount`, undefined)
  .action(async (directory, cmd) => {
    const { keypair, env, voucherMint, address, amount } = cmd.opts();

    const walletKeyPair = loadWalletKey(keypair);
    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));
    const mint = new PublicKey(voucherMint);
    const destAddress = new PublicKey(address);

    let ixs: any[] = [];
    const ownATA = (
      await PublicKey.findProgramAddress(
        [
          walletKeyPair.publicKey.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )[0];
    const destATA = (
      await PublicKey.findProgramAddress(
        [destAddress.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )[0];
    const splToken = require("@solana/spl-token");

    const resp = await solConnection.getAccountInfo(destATA);
    if (!resp) {
      ixs.push(
        splToken.Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          mint,
          destATA,
          destAddress,
          walletKeyPair.publicKey
        )
      );
    }
    ixs.push(
      splToken.Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        ownATA,
        destATA,
        walletKeyPair.publicKey,
        [],
        amount
      )
    );

    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      ixs,
      []
    );
  });

//Only used with ledger
programCommand("fund-hot-wallet")
  .option("-nx, --neighborhood-row <number>", `Neighborhood x`, undefined)
  .option("-ny, --neighborhood-col <number>", `Neighborhood y`, undefined)
  .action(async (directory, cmd) => {
    console.log("FUND HOT WALLET");
    const { keypair, env, neighborhoodCol, neighborhoodRow, cacheName } =
      cmd.opts();

    const cacheContent =
      loadCache(neighborhoodRow, neighborhoodCol, cacheName, env) || {};

    const hotWallet = new Keypair();
    const walletKeyPair = await loadWalletKeyOrLedger(keypair);
    const solConnection = new anchor.web3.Connection(clusterApiUrl(env));

    await sendTransactionWithRetryWithKeypair(
      solConnection,
      walletKeyPair,
      [
        anchor.web3.SystemProgram.transfer({
          fromPubkey: walletKeyPair.publicKey,
          toPubkey: hotWallet.publicKey,
          lamports: 70_000_000_000,
        }),
      ],
      []
    );
    cacheContent.hot_wallet = base58.encode(hotWallet.secretKey);
    saveCache(neighborhoodRow, neighborhoodCol, cacheName, env, cacheContent);
    console.log("SUCCESSFULLY FUNDED HOT WALLET");
  });

function programCommand(name: string) {
  return program
    .command(name)

    .option("-k, --keypair <path>", `Solana wallet location`, "ledger")
    .option(
      "-e, --env <string>",
      "Solana cluster env name",
      "devnet" //mainnet-beta, testnet, devnet
    )
    .option(
      "-c, --cache-name <string>",
      "Cache file name",
      BASE.toBase58().slice(0, 8)
    )
    .option("-l, --log-level <string>", "log level", setLogLevel);
}

function setLogLevel(value) {
  if (value === undefined || value === null) {
    return;
  }
  log.info("setting the log value to: " + value);
  log.setLevel(value);
}

program.parse(process.argv);
