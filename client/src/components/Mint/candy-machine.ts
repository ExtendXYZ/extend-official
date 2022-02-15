import * as anchor from "@project-serum/anchor";
import {MintLayout, Token, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {TransactionInstruction} from "@solana/web3.js";
import { CANDY_MACHINE_PROGRAM_ID } from "../../constants";

const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID = new anchor.web3.PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const SYS_PROGRAM_ID = new anchor.web3.PublicKey(
  "11111111111111111111111111111111"
);

export interface CandyMachine {
  id: anchor.web3.PublicKey,
  connection: anchor.web3.Connection;
  program: anchor.Program;
}

interface CandyMachineState {
  candyMachine: CandyMachine;
  itemsAvailable: number;
  itemsRedeemed: number;
  itemsRemaining: number;
  goLiveDate: Date,
}

export const awaitTransactionSignatureConfirmation = async (
  txid: anchor.web3.TransactionSignature,
  timeout: number,
  connection: anchor.web3.Connection,
  commitment: anchor.web3.Commitment = "recent",
  queryStatus = false
): Promise<anchor.web3.SignatureStatus | null | void> => {
  let done = false;
  let status: anchor.web3.SignatureStatus | null | void = {
    slot: 0,
    confirmations: 0,
    err: null,
  };
  let subId = 0;
  status = await new Promise(async (resolve, reject) => {
    setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      // console.log("Rejecting for timeout...");
      reject({ timeout: true });
    }, timeout);
    try {
      subId = connection.onSignature(
        txid,
        (result: any, context: any) => {
          done = true;
          status = {
            err: result.err,
            slot: context.slot,
            confirmations: 0,
          };
          if (result.err) {
            // console.log("Rejected via websocket", result.err);
            reject(status);
          } else {
            // console.log("Resolved via websocket", result);
            resolve(status);
          }
        },
        commitment
      );
    } catch (e) {
      done = true;
      console.error("WS error in setup", txid, e);
    }
    while (!done && queryStatus) {
      // eslint-disable-next-line no-loop-func
      (async () => {
        try {
          const signatureStatuses = await connection.getSignatureStatuses([
            txid,
          ]);
          status = signatureStatuses && signatureStatuses.value[0];
          if (!done) {
            if (!status) {
              // console.log("REST null result for", txid, status);
            } else if (status.err) {
              // console.log("REST error for", txid, status);
              done = true;
              reject(status.err);
            } else if (!status.confirmations) {
              // console.log("REST no confirmations for", txid, status);
            } else {
              // console.log("REST confirmation for", txid, status);
              done = true;
              resolve(status);
            }
          }
        } catch (e) {
          if (!done) {
            // console.log("REST connection error: txid", txid, e);
          }
        }
      })();
      await sleep(2000);
    }
  });

  //@ts-ignore
  if (connection._signatureSubscriptions[subId]) {
    connection.removeSignatureListener(subId);
  }
  done = true;
  // console.log("Returning status", status);
  return status;
}

/* export */ const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

export const getCandyMachine = async(wallet, connection, candyMachineId) => {
  const provider = new anchor.Provider(connection, wallet, {
    preflightCommitment: "recent",
  });

  const idl = await anchor.Program.fetchIdl(
    CANDY_MACHINE_PROGRAM_ID,
    provider
  );

  const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM_ID, provider);
  const candyMachine = {
    id: candyMachineId,
    connection,
    program,
  }
  return candyMachine;
}

export const getCandyMachineState = async (
  anchorWallet: anchor.Wallet,
  candyMachineId: anchor.web3.PublicKey,
  connection: anchor.web3.Connection,
  candyProgram: anchor.web3.PublicKey,
): Promise<CandyMachineState> => {
  const provider = new anchor.Provider(connection, anchorWallet, {
    preflightCommitment: "recent",
  });

  const idl = await anchor.Program.fetchIdl(
    candyProgram,
    provider
  );

  const program = new anchor.Program(idl, candyProgram, provider);
  const candyMachine = {
    id: candyMachineId,
    connection,
    program,
  }

  const state: any = await program.account.candyMachine.fetch(candyMachineId);
  // // console.log(state);

  const itemsAvailable = state.data.itemsAvailable.toNumber();
  const itemsRedeemed = state.itemsRedeemed.toNumber();
  const itemsRemaining = itemsAvailable - itemsRedeemed;

  let goLiveDate = new Date(1000000000);
  if (state.data.goLiveDate != null){
    let date = state.data.goLiveDate.toNumber();
    goLiveDate = new Date(date * 1000);
  }

  // // console.log({
  //   itemsAvailable,
  //   itemsRedeemed,
  //   itemsRemaining,
  //   goLiveDate,
  // })

  return {
    candyMachine,
    itemsAvailable,
    itemsRedeemed,
    itemsRemaining,
    goLiveDate,
  };
}

const getMasterEdition = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

const getMetadata = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

export const getTokenWallet = async (
  wallet: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
    )
  )[0];
};

export const receiveTokenInstructions = async (
  connection: anchor.web3.Connection,
  anchor_wallet : anchor.Wallet,
  dest : anchor.web3.PublicKey,
  owner : anchor.web3.PublicKey,
  tokenMint: anchor.web3.PublicKey,
  amount: number,
  numTokens: number,
) : Promise<TransactionInstruction[]> => {

  const payerATA = await getTokenWallet(anchor_wallet.publicKey, tokenMint);
  const ownerATA = await getTokenWallet(owner, tokenMint);
  const createATAIx: TransactionInstruction[] = [];
  
  const data = await connection.getAccountInfo(payerATA);
  if (!data) {
    createATAIx.push(
      createAssociatedTokenAccountInstruction(
      payerATA,
      anchor_wallet.publicKey,
      anchor_wallet.publicKey,
      tokenMint,
    )
    );
  }

  const instructions = [
    ...createATAIx,
    anchor.web3.SystemProgram.transfer({
      fromPubkey: anchor_wallet.publicKey,
      toPubkey: dest,
      lamports: amount,
    }),
    Token.createTransferInstruction(
      TOKEN_PROGRAM_ID, 
      ownerATA,
      payerATA,
      owner,
      [],
      numTokens,
    )
  ]
  return instructions;
}

export const mintOneTokenInstructions = async (
  candyMachine: CandyMachine,
  config: anchor.web3.PublicKey, // feels like this should be part of candyMachine?
  payer: anchor.web3.PublicKey,
  creator: anchor.web3.PublicKey,
  anchor_wallet : anchor.Wallet,
  mint: anchor.web3.Keypair,
  tokenMint: anchor.web3.PublicKey,
  rent: number,
  voucherSink: anchor.web3.PublicKey,
): Promise<TransactionInstruction[]> => {
  const token = await getTokenWallet(payer, mint.publicKey);
  const { connection, program } = candyMachine;
  const metadata = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);
  const payerATA = await getTokenWallet(payer, tokenMint);

  const instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports: rent,
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      0,
      payer,
      payer
    ),
    createAssociatedTokenAccountInstruction(
      token,
      payer,
      payer,
      mint.publicKey
    ),
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      token,
      payer,
      [],
      1
    ),
  ]

  instructions.push(
    await program.instruction.mintNft({
      accounts: {
        config: config,
        candyMachine: candyMachine.id,
        payer: payer,
        //@ts-ignore
        wallet: voucherSink,
        mint: mint.publicKey,
        metadata: metadata,
        masterEdition,
        mintAuthority: payer,
        updateAuthority: payer,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      },
      remainingAccounts: [
        {
          pubkey: payerATA,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: payer,
          isSigner: true,
          isWritable: false,
        }  
      ]
    }),
  );
  
  // // console.log("returning instructions");

  return instructions;
}

// function is no longer used
// export const mintOneToken = async (
//   candyMachine: CandyMachine,
//   config: anchor.web3.PublicKey, // feels like this should be part of candyMachine?
//   payer: anchor.web3.PublicKey,
//   creator: anchor.web3.PublicKey,
//   creator_key: anchor.web3.Keypair = new anchor.web3.Keypair(),
//   anchor_wallet : anchor.Wallet 
// ): Promise<string> => {

//   let mint = anchor.web3.Keypair.generate();
//   const program = candyMachine.program;

//   let instructions = await mintOneTokenInstructions(
//     candyMachine,
//     config,
//     payer,
//     creator,
//     anchor_wallet,  
//     mint
//   );

//   let res = await sendTransactionWithRetry(
//     program.provider.connection,
//     anchor_wallet,
//     instructions,
//     [mint, creator_key],
//   );



//   // console.log(res);




//   if (res) {return res.txid}
//   return 'ERROR';
// }

export const shortenAddress = (address: string, chars = 4): string => {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}