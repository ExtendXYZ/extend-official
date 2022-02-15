import {
    Blockhash,
    Commitment,
    Connection,
    FeeCalculator,
    Keypair,
    RpcResponseAndContext,
    SignatureStatus,
    SimulatedTransactionResponse,
    Transaction,
    TransactionInstruction,
    TransactionSignature,
    PublicKey,
} from "@solana/web3.js";
import {getUnixTs, sleep, shuffle, compact_u16_len} from "./various";
import {DEFAULT_TIMEOUT} from "./constants";
import log from "loglevel";
import { LedgerKeypair, getPublicKey, signTransaction, getDerivationPath } from '../ledger/utils'
import Transport from '@ledgerhq/hw-transport-node-hid';
import base58 from "bs58"
import { times, transform } from "lodash";
import * as anchor from "@project-serum/anchor";
import {BASE_TRANSACTION_SIZE, MAX_TRANSACTION_SIZE} from "../../../client/src/constants"

const BATCH_SIZE = 50;

export interface WalletAdapter {
  publicKey: PublicKey;
  autoApprove: boolean;
  connected: boolean;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transaction: Transaction[]) => Promise<Transaction[]>;
  connect: () => any; // eslint-disable-line
  disconnect: () => any; // eslint-disable-line
  on(event: string, fn: () => void): this;
}

export type WalletSigner = Pick<WalletAdapter,
    "publicKey" | "signTransaction" | "signAllTransactions">;

interface BlockhashAndFeeCalculator {
  blockhash: Blockhash;
  feeCalculator: FeeCalculator;
}

export const sendTransactionWithRetryWithKeypair = async (
  connection: Connection,
  wallet: Keypair | LedgerKeypair,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  commitment: Commitment = "singleGossip",
  includesFeePayer: boolean = false,
  block?: BlockhashAndFeeCalculator,
  beforeSend?: () => void,
) => {
  
  const transaction = new Transaction({feePayer : includesFeePayer ? signers[0].publicKey : wallet.publicKey });
  
  instructions.forEach((instruction) => transaction.add(instruction));
  transaction.recentBlockhash = (
    block || (await connection.getRecentBlockhash(commitment))
  ).blockhash;

  if (wallet instanceof Keypair){
    transaction.partialSign(wallet);
  }
  else{
    const transport = await Transport.create();
    const sig_bytes = await signTransaction(transport, transaction, getDerivationPath(wallet.derivation));
    transaction.addSignature(wallet.publicKey, sig_bytes);
    await transport.close();
  }
  
  if (signers.length > 0) {
    transaction.partialSign(...signers);
  } 
  
  if (beforeSend) {
    beforeSend();
  }

  const { txid, slot } = await sendSignedTransaction({
    connection,
    signedTransaction: transaction,
  });

  return { txid, slot };
};

export async function sendSignedTransaction({
  signedTransaction,
  connection,
  timeout = DEFAULT_TIMEOUT,
}: {
  signedTransaction: Transaction;
  connection: Connection;
  sendingMessage?: string;
  sentMessage?: string;
  successMessage?: string;
  timeout?: number;
}): Promise<{ txid: string; slot: number }> {
  let rawTransaction;
  try {
    rawTransaction = signedTransaction.serialize();
  } catch(e){
    console.log(e)
  }
  const startTime = getUnixTs();
  let slot = 0;
  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight: true,
    }
  );

  // console.log("Started awaiting confirmation for", txid);

  let done = false;
  await sleep(2000);
  (async () => {
    let maxTime = 6000;
    await sleep(maxTime);
    while (!done && getUnixTs() - startTime < timeout) {
      // console.log("Run 2nd time")
      const newTxid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });
      // console.log("Same txid", newTxid === txid)
      await sleep(maxTime);
    }
  })();
  while(!done) {
    try {
      const confirmation = await awaitTransactionSignatureConfirmation(
        txid,
        timeout,
        connection,
        "recent",
        true
      );
      if (!confirmation) {
        // console.log("Not confirmed, max retry hit")
        throw new Error("Max signature retries hit")
      }
      if (confirmation.err) {
        console.error(confirmation.err);
        throw new Error("Transaction failed: Custom instruction error");
      }

      slot = confirmation?.slot || 0;
    } catch (err) {
      console.error("Error caught", err);
      if ((err as any).timeout) {
        throw new Error("Timed out awaiting confirmation on transaction");
      }
      if ((err as Error).toString().includes("retries")) {
        throw new Error("Max signature retries hit");
      }
      let simulateResult: SimulatedTransactionResponse | null = null;
      try {
        simulateResult = (
          await simulateTransaction(connection, signedTransaction, "single")
        ).value;
      } catch (e) {}
      if (simulateResult && simulateResult.err) {
        if (simulateResult.logs) {
          for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
            const line = simulateResult.logs[i];
            if (line.startsWith("Program log: ")) {
              throw new Error(
                "Transaction failed: " + line.slice("Program log: ".length)
              );
            }
          }
        }
        throw new Error(JSON.stringify(simulateResult.err));
      }
      // throw new Error('Transaction failed');
    } finally {
      done = true;
    }
  }

  // console.log("Latency", txid, getUnixTs() - startTime);
  return { txid, slot };
}

async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
  commitment: Commitment
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  // @ts-ignore
  transaction.recentBlockhash = await connection._recentBlockhash(
    // @ts-ignore
    connection._disableBlockhashCaching
  );

  const signData = transaction.serializeMessage();
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData);
  const encodedTransaction = wireTransaction.toString("base64");
  const config: any = { encoding: "base64", commitment };
  const args = [encodedTransaction, config];

  // @ts-ignore
  const res = await connection._rpcRequest("simulateTransaction", args);
  if (res.error) {
    throw new Error("failed to simulate transaction: " + res.error.message);
  }
  return res.result;
}

async function awaitTransactionSignatureConfirmation(
  txid: TransactionSignature,
  timeout: number,
  connection: Connection,
  commitment: Commitment = "recent",
  queryStatus = false
): Promise<SignatureStatus | null | void> {

  let done = false;
  let status: SignatureStatus | null | void = {
    slot: 0,
    confirmations: 0,
    err: null,
  };
  let hitMaxRetry = false;
  status = await new Promise(async (resolve, reject) => {
    setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      // console.log("Rejecting for timeout...");
      reject({ timeout: true });
    }, timeout);

    let numTries = 0;
    let maxTries = 3;
    while (!done && numTries < maxTries && queryStatus) {
      // eslint-disable-next-line no-loop-func
      await (async () => {
        try {
          const signatureStatuses = await connection.getSignatureStatuses([
            txid,
          ]);
          numTries += 1;
          // console.log("After try", numTries)
          status = signatureStatuses && signatureStatuses.value[0];
          // console.log(`https://explorer.solana.com/tx/${txid}?cluster=${env}`); // TODO
          if (!done) {
            if (!status) {
              // console.log("Not status", signatureStatuses.value[0])
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
            reject();
          }
        }
      })();
      await sleep(5000);
    }
    
    if (numTries === maxTries && !done) { // met max retries
      done = true;
      hitMaxRetry = true;
      resolve(status);
    }
  });

  if(hitMaxRetry) {
    status = null;
  }
  
  done = true;
  return status;
}

export async function sendTransactionsWithManualRetry(
  connection: Connection,
  wallet: WalletSigner,
  instructions: TransactionInstruction[][],
  signers: Keypair[][],
) {
  let toRemoveSigners: Record<number, boolean> = {};

  instructions = instructions.filter((instr, i) => {
    if (instr.length > 0) {
      return true;
    } else {
      toRemoveSigners[i] = true;
      return false;
    }
  });
  let filteredSigners = signers.filter((_, i) => !toRemoveSigners[i]);

  let responses: boolean[] = [];

  try {
    responses = await sendTransactions(
      connection,
      wallet,
      instructions,
      filteredSigners,
      "single",
    );
  } catch (e) {
    console.error(e);
  }
  console.log(
    "Finished instructions length is",
    instructions.length
  );

  // make response know whether the transactions failed or succeeded
  return responses;
}

export const sendTransactions = async (
  connection: Connection,
  wallet: WalletSigner,
  instructionSet: TransactionInstruction[][],
  signersSet: Keypair[][],
  commitment: Commitment = "singleGossip",
  successCallback: (txid: string, ind: number) => void = (txid, ind) => {},
  failCallback: (reason: string, ind: number) => boolean = (txid, ind) => false,
  block?: BlockhashAndFeeCalculator,
): Promise<boolean[]> => {

  const unsignedTxns: Transaction[] = [];
  if (!block) {
    block = await connection.getRecentBlockhash(commitment);
  }

  for (let i = 0; i < instructionSet.length; i++) {
    // batchsize --> pack instructions together
    const instructions = instructionSet[i];
    const signers = signersSet[i];

    if (instructions.length === 0) {
      continue;
    }

    let transaction = new Transaction();
    instructions.forEach((instruction) => transaction.add(instruction));
    transaction.recentBlockhash = block.blockhash;
    transaction.setSigners(
      // fee payed by the wallet owner
      wallet.publicKey,
      ...signers.map((s) => s.publicKey)
    );

    unsignedTxns.push(transaction);
  }

  const pendingTxns: Promise<{ txid: string; slot: number }>[] = [];

  let breakEarlyObject = { breakEarly: false, i: 0 };
  let totalResponses: boolean[] = [];

  for (let i = 0; i < unsignedTxns.length; i+=BATCH_SIZE) {
    let currArr = unsignedTxns.slice(i,i+BATCH_SIZE);
    
    let nloops = 0;

    let finalResponses: boolean[] = [];
    let idxMap: number[] = [];
    for(let j = 0; j < currArr.length; j++) {
      finalResponses.push(false);
      idxMap.push(j);
    }

    while (currArr.length != 0 && nloops < 2) {
      // get recent blockhash and sign transactions
      let currBlock = await connection.getRecentBlockhash(commitment);
      currArr.forEach((tx) => tx.recentBlockhash = currBlock.blockhash);

      // sign each transaction in current slice
      for (let j = 0; j < currArr.length; j++) { 
        if (signersSet[j + i].length > 0) {
          currArr[j].partialSign(...signersSet[j + i]);
        }
      }

      const signedTx = await wallet.signAllTransactions(currArr);

      let promises = signedTx.map((item) => (sendSignedTransaction({
        connection,
        signedTransaction: item,
        timeout: 1000000000,
        })
        .then(({ txid, slot }) => {
              successCallback(txid, slot);
              return 2;
            })
            .catch((reason) => {
              if (reason.toString().includes("retries")) { // for retries
                return 1;
              }
              failCallback(reason, -1);
              return 0;
            })
      ))

      console.log("Sending transactions", i, "try", nloops+1)

      let responses = await Promise.all(promises);
      for (let j = 0; j < responses.length; j++) { // populate finalResponses with whether each tx succeed
        finalResponses[idxMap[j]] = (responses[j] === 2);
      }

      nloops += 1;
      let nextArr: Transaction[] = [];
      let newIdxMap: number[] = [];
      for (let k = 0; k < responses.length; k++) {
        if (responses[k] === 1){
          nextArr.push(currArr[k]);
          newIdxMap.push(idxMap[k]);
        }
      }
      console.log("Need to retry", nextArr.length);

      // shuffling nextArr
      let outp = shuffle(nextArr, newIdxMap);
      nextArr = outp[0];
      newIdxMap = outp[1];

      currArr = nextArr;
      idxMap = newIdxMap;
    }

    // push into totalResponses
    totalResponses.push(...finalResponses);

    sleep(5000);
  }
  return totalResponses;
};

export const sendInstructionsGreedyBatchMint = async (
  connection,
  wallet: any,
  Ixs: anchor.web3.TransactionInstruction[][],
  mints: anchor.web3.Keypair[],
) => {

  let transactions: anchor.web3.TransactionInstruction[][] = [];
  let signers: anchor.web3.Keypair[][] = [];

  let transaction: anchor.web3.TransactionInstruction[] = [];
  let newTx = new Transaction();
  let commitment: Commitment = "singleGossip";
  let staleBlockhash = (await connection.getRecentBlockhash(commitment)).blockhash;
  let ixPerTx: number[] = [];
  let idx = 0;
  for (let i = 0; i < Ixs.length; i++){
    let newTransaction = [...transaction];
    Ixs[i].forEach((instruction) => newTransaction.push(instruction));
    Ixs[i].forEach((instruction) => newTx.add(instruction));
    newTx.recentBlockhash = staleBlockhash;
    newTx.feePayer = wallet.publicKey;
    try {
      let _ = newTx.serialize({requireAllSignatures: false});
      transaction = newTransaction;
    }
    catch (e) {
      //console.log(e)
      // size limit reached, register the batched transaction and start a new batch
      transactions.push(transaction);
      signers.push(mints.slice(idx, i));
      ixPerTx.push(i - idx); // length of ix
      idx = i;
      transaction = [];
      newTx = new Transaction();
      i = i-1;
    }
  }

  transactions.push(transaction);
  signers.push(mints.slice(idx, Ixs.length));
  ixPerTx.push(Ixs.length - idx);

  console.log("Num Transactions", transactions.length)

  const responses = await sendTransactionsWithManualRetry(
    connection,
    wallet,
    transactions,
    signers,
  );

  let numSucceed = 0;
  let total = 0;
  for (let i = 0; i < responses.length; i++) {
    numSucceed += Number(responses[i]) * ixPerTx[i];
    total += ixPerTx[i];
  }

  return {numSucceed, total};
};

export const sendInstructionsGreedyBatch = async (
  connection,
  wallet: any,
  instructions: TransactionInstruction[],
) => {

  let transactions: TransactionInstruction[][] = [];
  let signers: Keypair[][] = [];

  let transaction: TransactionInstruction[] = [];
  let transactionSize = BASE_TRANSACTION_SIZE;
  let transactionAccounts = new Set();
  let numInstructions = 0;
  let ixPerTx: number[] = [];

  for (let i = 0; i < instructions.length; i++) {
      let instruction = instructions[i];
      let delta = 0;
      let instructionAccounts = new Set(instruction.keys.map(key => key.pubkey.toBase58()));
      instructionAccounts.add(instruction.programId.toBase58());
      for (let account of instructionAccounts) {
          if (!transactionAccounts.has(account)) {
              transactionAccounts.add(account);
              delta += 32;
          }
      }
      delta += 1
          + compact_u16_len(instruction.keys.length)
          + instruction.keys.length
          + compact_u16_len(instruction.data.length)
          + instruction.data.length;

      let newTransactionSize = transactionSize + delta + compact_u16_len(transactionAccounts.size) + compact_u16_len(numInstructions + 1);

      if (newTransactionSize <= MAX_TRANSACTION_SIZE) {
          transactionSize += delta;
          transaction.push(instruction);
          numInstructions = numInstructions + 1;
          //code to allow us to check correctness
          // tx.add(instruction);
          // console.log(tx.serialize({requireAllSignatures: false}).length, newTransactionSize);
      }
      else {
          // register batched ransaction
          transactions.push(transaction);
          signers.push([]); // assume no signers other than wallet
          ixPerTx.push(transaction.length); // update number of ix per tx
          transaction = [];
          transactionSize = BASE_TRANSACTION_SIZE;
          transactionAccounts = new Set();
          i = i - 1;
          numInstructions = 0;
      }
  }

  transactions.push(transaction);
  signers.push([]);
  ixPerTx.push(transaction.length);

  console.log("Num Transactions", transactions.length)

  const responses = await sendTransactionsWithManualRetry(
      connection,
      wallet,
      transactions,
      signers,
  );

  // notify user how many spaces succeeded
  let spacesSucceed = 0;
  let totalSpaces = 0;
  for (let i = 0; i < responses.length; i++) {
      spacesSucceed += Number(responses[i]) * ixPerTx[i];
      totalSpaces += ixPerTx[i];
  }
  
  return { responses, ixPerTx, spacesSucceed };
};