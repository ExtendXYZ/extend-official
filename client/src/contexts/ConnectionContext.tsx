import {sleep, useLocalStorageState, shuffle} from "../utils/utils";
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
} from "@solana/web3.js";
import {RPC_devnet, BATCH_TX_SIZE, RPC} from "../constants"
import React, {useContext, useEffect, useMemo, useState} from "react";
import {notify} from "../utils/notifications";
import {ExplorerLink} from "../components/ExplorerLink";
import {ENV as ChainId, TokenInfo, TokenListProvider,} from "@solana/spl-token-registry";
import {WalletSigner} from "./WalletContext/WalletContext";
import {WalletNotConnectedError} from "@solana/wallet-adapter-base";
import {loading} from '../utils/loading';

let requestNum = 0;
let sigNum = 0;
let txNum = 0; 

interface BlockhashAndFeeCalculator {
  blockhash: Blockhash;
  feeCalculator: FeeCalculator;
}

export type ENV = "mainnet-beta" | "testnet" | "devnet" | "localnet";
// figure out devnet/mainnet endpoint
// console.log("RPC", RPC)
let name = "devnet";
let chainId = ChainId.Devnet;
if (RPC?.includes("mainnet")) {
  name = "mainnet-beta";
  chainId = ChainId.MainnetBeta;
} else if (RPC?.includes("testnet")) {
  name = "testnet";
  chainId = ChainId.Testnet;
}
const endpoint = RPC ? RPC : RPC_devnet;
// console.log("using ", name);

export const ENDPOINTS = [
  // {
  //   name: "devnet" as ENV,
  //   endpoint: RPC_devnet, //"https://api.devnet.solana.com",
  //   ChainId: ChainId.Devnet,
  // },
  // {
  //   name: "mainnet-beta" as ENV,
  //   endpoint: RPC_mainnet, //"https://api.mainnet-beta.solana.com",
  //   ChainId: ChainId.MainnetBeta,
  // },
  {
    name: name as ENV,
    endpoint: endpoint, //"https://api.mainnet-beta.solana.com",
    ChainId: chainId,
  },
];

const DEFAULT = ENDPOINTS[0].endpoint;

interface ConnectionConfig {
  connection: Connection;
  endpoint: string;
  env: ENV;
  setEndpoint: (val: string) => void;
  tokens: TokenInfo[];
  tokenMap: Map<string, TokenInfo>;
}

const ConnectionContext = React.createContext<ConnectionConfig>({
  endpoint: DEFAULT,
  setEndpoint: () => {},
  connection: new Connection(DEFAULT, "recent"),
  env: ENDPOINTS[0].name,
  tokens: [],
  tokenMap: new Map<string, TokenInfo>(),
});


export function ConnectionProvider({ children = undefined as any }) {
  const [endpoint, setEndpoint] = useLocalStorageState(
    "connectionEndpoint",
    ENDPOINTS[0].endpoint
  );

  const connection = useMemo(
    () => new Connection(endpoint, "recent"),
    [endpoint]
  );

  const env =
    ENDPOINTS.find((end) => end.endpoint === endpoint)?.name ||
    ENDPOINTS[0].name;

  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(new Map());
  useEffect(() => {
    // fetch token files
    new TokenListProvider().resolve().then((container) => {
      const list = container
        .excludeByTag("nft")
        .filterByChainId(
          ENDPOINTS.find((end) => end.endpoint === endpoint)?.ChainId ||
            ChainId.MainnetBeta
        )
        .getList();

      const knownMints = [...list].reduce((map, item) => {
        map.set(item.address, item);
        return map;
      }, new Map<string, TokenInfo>());

      setTokenMap(knownMints);
      setTokens(list);
    });
  }, [env, endpoint]);

  // The websocket library solana/web3.js uses closes its websocket connection when the subscription list
  // is empty after opening its first time, preventing subsequent subscriptions from receiving responses.
  // This is a hack to prevent the list from every getting empty
  useEffect(() => {
    const id = connection.onAccountChange(
      Keypair.generate().publicKey,
      () => {}
    );
    return () => {
      connection.removeAccountChangeListener(id);
    };
  }, [connection]);

  useEffect(() => {
    const id = connection.onSlotChange(() => null);
    return () => {
      connection.removeSlotChangeListener(id);
    };
  }, [connection]);

  return (
    <ConnectionContext.Provider
      value={{
        endpoint,
        setEndpoint,
        connection,
        tokens,
        tokenMap,
        env,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext).connection as Connection;
}

export function useConnectionConfig() {
  const context = useContext(ConnectionContext);
  return {
    endpoint: context.endpoint,
    setEndpoint: context.setEndpoint,
    env: context.env,
    tokens: context.tokens,
    tokenMap: context.tokenMap,
  };
}

export const getErrorForTransaction = async (
  connection: Connection,
  txid: string
) => {
  // wait for all confirmation before geting transaction
  await connection.confirmTransaction(txid, "max");

  const tx = await connection.getParsedConfirmedTransaction(txid);

  const errors: string[] = [];
  if (tx?.meta && tx.meta.logMessages) {
    tx.meta.logMessages.forEach((log) => {
      const regex = /Error: (.*)/gm;
      let m;
      while ((m = regex.exec(log)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
          regex.lastIndex++;
        }

        if (m.length > 1) {
          errors.push(m[1]);
        }
      }
    });
  }

  return errors;
};

export enum SequenceType {
  Sequential,
  Parallel,
  StopOnFailure,
}

export async function sendTransactionsWithManualRetry(
  connection: Connection,
  wallet: WalletSigner,
  instructions: TransactionInstruction[][],
  signers: Keypair[][],
  sequenceType: SequenceType = SequenceType.Parallel,
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
    if (instructions.length === 1) {
      let response = await sendTransactionWithRetry(
        connection,
        wallet,
        instructions[0],
        filteredSigners[0],
        "single"
      );
      if (!response) {
        return [false];
      }
      return [true];
    } else {
      responses = await sendTransactions(
        connection,
        wallet,
        instructions,
        filteredSigners,
        sequenceType,
        "single",
      );
    }
  } catch (e) {
    console.error(e);
    loading(null, "Sending transactions...", "Exception");
  }
  // console.log(
  //   "Finished instructions length is",
  //   instructions.length
  // );

  // make response know whether the transactions failed or succeeded
  return responses;
}

export const sendTransactions = async (
  connection: Connection,
  wallet: WalletSigner,
  instructionSet: TransactionInstruction[][],
  signersSet: Keypair[][],
  sequenceType: SequenceType = SequenceType.Parallel,
  commitment: Commitment = "singleGossip",
  successCallback: (txid: string, ind: number) => void = (txid, ind) => {},
  failCallback: (reason: string, ind: number) => boolean = (txid, ind) => false,
  block?: BlockhashAndFeeCalculator,
): Promise<boolean[]> => {
  if (!wallet.publicKey) throw new WalletNotConnectedError();

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

    // if (signers.length > 0) {
    //   transaction.partialSign(...signers);
    // }

    unsignedTxns.push(transaction);
  }
  //// console.log(unsignedTxns.length,"SHOULD BE # of txs hard divide by batch_size")

  // const signedTxns = await wallet.signAllTransactions(unsignedTxns);

  let totalResponses: boolean[] = [];

  if (sequenceType !== SequenceType.Parallel) {
    // for (let i = 0; i < signedTxns.length; i++) {
    //   // console.log(i)
    //   try {
    //     await sendSignedTransaction({
    //     connection,
    //     signedTransaction: signedTxns[i],});
    //     // }).then(({ txid, slot }) => {
    //     //       //successCallback(txid, slot);
    //     //     })
    //     //     .catch((reason) => {
    //     //       //failCallback(reason, -1);
    //     //     });

    //   } catch (e) {
    //     // console.log("Caught failure", e);
    //     if (breakEarlyObject.breakEarly) {
    //       // // console.log("Died on ", breakEarlyObject.i);
    //       return breakEarlyObject.i; // Return the txn we failed on by index
    //     }
    //   }
    // }
  } else {

    // let startTime = getUnixTs();
    requestNum = 0;
    sigNum = 0;
    txNum = 0;
    // let currRequests = 0;
    // let currSig = 0;
    // let currTx = 0;
    // let elapsed = 0;
    for (let i = 0; i < unsignedTxns.length; i+=BATCH_TX_SIZE) {
      loading(i / (unsignedTxns.length) * (100), "Sending transactions...", null);
      let currArr = unsignedTxns.slice(i,i+BATCH_TX_SIZE);
      
      let nloops = 0;

      let finalResponses: boolean[] = [];
      let idxMap: number[] = [];
      for(let j = 0; j < currArr.length; j++) {
        finalResponses.push(false);
        idxMap.push(j);
      }

      while (currArr.length !== 0 && nloops < 2) {
        // get recent blockhash and sign transactions
        let currBlock = await connection.getRecentBlockhash(commitment);
        currArr.forEach((tx) => tx.recentBlockhash = currBlock.blockhash);

        // sign each transaction in current slice
        for (let j = 0; j < currArr.length; j++) { 
          if (signersSet[idxMap[j] + i].length > 0) {
            currArr[j].partialSign(...signersSet[idxMap[j] + i]);
          }
        }

        const signedTx = await wallet.signAllTransactions(currArr);

        let counter = 0;
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
                  counter += 1;
                  return 1;
                }
                failCallback(reason, -1);
                return 0;
              })
        ))
        
        let responses = await Promise.all(promises);
        console.log("Num transactions to retry on blockhash", counter)
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
        // console.log("Need to retry", nextArr.length);

        // shuffling nextArr
        let outp = shuffle(nextArr, newIdxMap);
        nextArr = outp[0];
        newIdxMap = outp[1];

        currArr = nextArr;
        idxMap = newIdxMap;

        // elapsed = getUnixTs() - startTime;
        // console.log("Elapsed time", elapsed);
        // startTime = getUnixTs();
        // // console.log("Ratio", (requestNum - currRequests) / elapsed)
        // console.log("Num requests done", requestNum - currRequests);
        // console.log("Cumulative time", getUnixTs() - beginTime);
        // currRequests = requestNum;
        // currTx = txNum;
        // currSig = sigNum;
      }

      // push into totalResponses
      totalResponses.push(...finalResponses);
    }
    loading(null, "Sending transactions...", 'success');

    // const promises = signedTxns.map((item) => (
    //   rateLimiter.acquireToken(async () => await sendSignedTransaction({
    //     connection,
    //     signedTransaction: item,
    //     timeout: 1000000000,
    //     }).then(({ txid, slot }) => {
    //           successCallback(txid, slot);
    //         })
    //         .catch((reason) => {
    //           failCallback(reason, -1);
    //         })
    //   ))
    // );
    // const responses = await Promise.all(promises);
  }

  return totalResponses;
};

export const sendTransaction = async (
  connection: Connection,
  wallet: WalletSigner,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  awaitConfirmation = true,
  commitment: Commitment = "singleGossip",
  includesFeePayer: boolean = false,
  block?: BlockhashAndFeeCalculator
) => {
  if (!wallet.publicKey) throw new WalletNotConnectedError();

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
    transaction = await wallet.signTransaction(transaction);
  }

  const rawTransaction = transaction.serialize();
  let options = {
    skipPreflight: true,
    commitment,
  };

  const txid = await connection.sendRawTransaction(rawTransaction, options);
  let slot = 0;

  if (awaitConfirmation) {
    const confirmation = await awaitTransactionSignatureConfirmation(
      txid,
      DEFAULT_TIMEOUT,
      connection,
      commitment
    );

    if (!confirmation)
      throw new Error("Timed out awaiting confirmation on transaction");
    slot = confirmation?.slot || 0;

    if (confirmation?.err) {
      const errors = await getErrorForTransaction(connection, txid);
      notify({
        message: "Transaction failed...",
        description: (
          <>
            {errors.map((err) => (
              <div>{err}</div>
            ))}
            <ExplorerLink address={txid} type="transaction" />
          </>
        ),
        type: "error",
      });

      throw new Error(`Raw transaction ${txid} failed`);
    }
  }

  return { txid, slot };
};

export const sendTransactionWithRetry = async (
  connection: Connection,
  wallet: WalletSigner,
  instructions: TransactionInstruction[],
  signers: Keypair[],
  commitment: Commitment = "singleGossip",
  includesFeePayer: boolean = false,
  block?: BlockhashAndFeeCalculator,
  beforeSend?: () => void
) => {
  if (!wallet.publicKey) throw new WalletNotConnectedError();
  
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
  //// console.log("About to send");
  try {
    const { txid, slot } = await sendSignedTransaction({
      connection,
      signedTransaction: transaction,
    });
    return { txid, slot };
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const getUnixTs = () => {
  return new Date().getTime() / 1000;
};

const DEFAULT_TIMEOUT = 15000*1000;

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
    // console.log(e)
  }
  const startTime = getUnixTs();
  let slot = 0;
  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight: true,
    }
  );
  requestNum += 1;
  txNum += 1;

  // // console.log("Started awaiting confirmation for", txid);

  let done = false;
  await sleep(2000);
  (async () => {
    let maxTime = 6000;
    await sleep(maxTime);
    while (!done && getUnixTs() - startTime < timeout) {
      // // console.log("Run 2nd time")
      const newTxid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
      });
      requestNum += 1;
      txNum += 1;
      // // console.log("Same txid", newTxid === txid)
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
        console.log("Not confirmed, max retry hit")
        throw new Error("Max signature retries hit")
      }
      if (confirmation && confirmation.err) {
        console.error(confirmation.err);
        throw new Error("Transaction failed: Custom instruction error");
      }

      slot = confirmation ? confirmation.slot : 0;
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

  // // console.log("Latency", txid, getUnixTs() - startTime);
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
  let endpoint = (connection as any)._rpcEndpoint;
  let env = "mainnet-beta";
  for (const cfg of ENDPOINTS) {
    if (cfg.endpoint === endpoint) {
      env = cfg.name;
      break;
    }
  }

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
      // // console.log("Rejecting for timeout...");
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
          requestNum += 1;
          sigNum += 1;
          numTries += 1;
          // // console.log("After try", numTries)
          status = signatureStatuses && signatureStatuses.value[0];
          // // console.log(`https://explorer.solana.com/tx/${txid}?cluster=${env}`); // TODO
          if (!done) {
            if (!status) {
              // // console.log("Not status", signatureStatuses.value[0])
              // // console.log("REST null result for", txid, status);
            } else if (status.err) {
              // // console.log("REST error for", txid, status);
              done = true;
              reject(status.err);
            } else if (!status.confirmations) {
              // // console.log("REST no confirmations for", txid, status);
            } else {
              // // console.log("REST confirmation for", txid, status);
              done = true;
              resolve(status);
            }
          }
        } catch (e) {
          if (!done) {
            // // console.log("REST connection error: txid", txid, e);
            console.error(e)
            reject();
          }
        }
      })();
      await sleep(10000);
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
