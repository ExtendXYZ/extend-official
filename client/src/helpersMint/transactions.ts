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
} from '@solana/web3.js';
import {getUnixTs, sleep} from './various';
import * as anchor from "@project-serum/anchor";
import log from 'loglevel';
import {sendTransactionsWithManualRetry} from "../contexts"

export const DEFAULT_TIMEOUT = 30000;

interface BlockhashAndFeeCalculator {
  blockhash: Blockhash;
  feeCalculator: FeeCalculator;
}

export const sendTransactionWithRetry = async (
  connection: Connection,
  wallet: anchor.Wallet,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  commitment: Commitment = "singleGossip",
  includesFeePayer: boolean = false,
  block?: BlockhashAndFeeCalculator,
  beforeSend?: () => void
) => {

  let transaction = new Transaction();
  instructions.forEach((instruction) => transaction.add(instruction));
  transaction.recentBlockhash = (
    block || (await connection.getRecentBlockhash(commitment))
  ).blockhash;

  if (includesFeePayer) {
    transaction.setSigners(...signers.map((s) => s.publicKey));
  } else {
    transaction.setSigners(
      // fee payed by the wallet owner
      wallet.publicKey,
      ...signers.map((s) => s.publicKey)
    );
  }

  if (signers.length > 0) {
    transaction.partialSign(...signers);
  }
  if (!includesFeePayer) {
    try {
      transaction = await wallet.signTransaction(transaction);
    } catch {
      return false;
    }
  }

  if (beforeSend) {
    beforeSend();
  }
  console.log("About to send");
  try {
    const { txid, slot } = await sendSignedTransaction({
      connection,
      signedTransaction: transaction,
    });

    return { txid, slot };
  } catch (error) {
    console.error(error);
  }
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
  const rawTransaction = signedTransaction.serialize();
  const startTime = getUnixTs();
  let slot = 0;
  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight: true,
    },
  );

  // console.log("transaction ID:", txid);

  log.debug('Started awaiting confirmation for', txid);

  let done = false;
  (async () => {
    while (!done && getUnixTs() - startTime < timeout) {
      connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });
      await sleep(500);
    }
  })();
  try {
    const confirmation = await awaitTransactionSignatureConfirmation(
      txid,
      timeout,
      connection,
      'recent',
      true,
    );

    if (!confirmation)
      throw new Error('Timed out awaiting confirmation on transaction');

    if (confirmation.err) {
      log.error(confirmation.err);
      throw new Error('Transaction failed: Custom instruction error');
    }

    slot = confirmation?.slot || 0;
  } catch (err : any) {
    log.error('Timeout Error caught', err);
    if (err.timeout) {
      throw new Error('Timed out awaiting confirmation on transaction');
    }
    let simulateResult: SimulatedTransactionResponse | null = null;
    try {
      simulateResult = (
        await simulateTransaction(connection, signedTransaction, 'single')
      ).value;
    } catch (e) {
      log.error('Simulate Transaction error', e);
    }
    if (simulateResult && simulateResult.err) {
      if (simulateResult.logs) {
        for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
          const line = simulateResult.logs[i];
          if (line.startsWith('Program log: ')) {
            throw new Error(
              'Transaction failed: ' + line.slice('Program log: '.length),
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

  log.debug('Latency', txid, getUnixTs() - startTime);
  return { txid, slot };
}

async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
  commitment: Commitment,
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  // @ts-ignore
  transaction.recentBlockhash = await connection._recentBlockhash(
    // @ts-ignore
    connection._disableBlockhashCaching,
  );

  const signData = transaction.serializeMessage();
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData);
  const encodedTransaction = wireTransaction.toString('base64');
  const config: any = { encoding: 'base64', commitment };
  const args = [encodedTransaction, config];

  // @ts-ignore
  const res = await connection._rpcRequest('simulateTransaction', args);
  if (res.error) {
    throw new Error('failed to simulate transaction: ' + res.error.message);
  }
  return res.result;
}

async function awaitTransactionSignatureConfirmation(
  txid: TransactionSignature,
  timeout: number,
  connection: Connection,
  commitment: Commitment = 'recent',
  queryStatus = false,
): Promise<SignatureStatus | null | void> {
  let done = false;
  let status: SignatureStatus | null | void = {
    slot: 0,
    confirmations: 0,
    err: null,
  };
  let subId = 0;
  // eslint-disable-next-line no-async-promise-executor
  status = await new Promise(async (resolve, reject) => {
    setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      log.warn('Rejecting for timeout...');
      reject({ timeout: true });
    }, timeout);
    try {
      subId = connection.onSignature(
        txid,
        (result, context) => {
          done = true;
          status = {
            err: result.err,
            slot: context.slot,
            confirmations: 0,
          };
          if (result.err) {
            log.warn('Rejected via websocket', result.err);
            reject(status);
          } else {
            log.debug('Resolved via websocket', result);
            resolve(status);
          }
        },
        commitment,
      );
    } catch (e) {
      done = true;
      log.error('WS error in setup', txid, e);
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
              log.debug('REST null result for', txid, status);
            } else if (status.err) {
              log.error('REST error for', txid, status);
              done = true;
              reject(status.err);
            } else if (!status.confirmations) {
              log.error('REST no confirmations for', txid, status);
            } else {
              log.debug('REST confirmation for', txid, status);
              done = true;
              resolve(status);
            }
          }
        } catch (e) {
          if (!done) {
            log.error('REST connection error: txid', txid, e);
          }
        }
      })();
      await sleep(2000);
    }
  });

  //@ts-ignore
  if (connection._signatureSubscriptions[subId])
    connection.removeSignatureListener(subId);
  done = true;
  log.debug('Returning status', status);
  return status;
}

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