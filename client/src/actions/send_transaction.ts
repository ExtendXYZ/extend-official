import { Commitment, Keypair, Transaction, TransactionInstruction, } from "@solana/web3.js";
import { Connection as Conn } from "../contexts";
import { notify, compact_u16_len } from "../utils";
import { MAX_TRANSACTION_SIZE, BASE_TRANSACTION_SIZE } from "../constants";

export const sendTransaction = async (
    connection,
    wallet: any,
    Ix: any[],
    name: string,
    signers: Keypair[] = []
) => {

    const response = await Conn.sendTransactionWithRetry(
        connection,
        wallet,
        [...Ix],
        signers,
        "max"
    );

    if (!response) {
        notify({ message: `${name} failed` });
    } else {
        notify({ message: `${name} succeeded` });
    }

    return response;
};

// Assumes wallet is the only signer
export const sendInstructionsGreedyBatch = async (
    connection,
    wallet: any,
    instructions: TransactionInstruction[],
    name: string,
    showNotify: boolean = true,
    frames: number = -1,
) => {

    let transactions: TransactionInstruction[][] = [];
    let signers: Keypair[][] = [];

    let transaction: TransactionInstruction[] = [];
    let transactionSize = BASE_TRANSACTION_SIZE;
    let transactionAccounts = new Set();
    let numInstructions = 0;
    let ixPerTx: number[] = [];

    //code to allow us to check correctness
    // let tx = new Transaction();
    // let commitment: Commitment = "singleGossip";
    // tx.recentBlockhash = (await connection.getRecentBlockhash(commitment)).blockhash;
    // tx.feePayer = wallet.publicKey;

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

            //code to allow us to check correctness
            // tx = new Transaction();
            // commitment = "singleGossip";
            // tx.recentBlockhash = (await connection.getRecentBlockhash(commitment)).blockhash;
            // tx.feePayer = wallet.publicKey;  
        }
    }

    transactions.push(transaction);
    signers.push([]);
    ixPerTx.push(transaction.length);

    console.log("Num Transactions", transactions.length)

    const responses = await Conn.sendTransactionsWithManualRetry(
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

    console.log(frames)
    if (frames !== -1) { // if multiple frames, divide by frame number
        spacesSucceed = Math.floor(spacesSucceed / frames);
        totalSpaces = Math.floor(totalSpaces / frames);
    }

    if (showNotify) {
        notify({ message: `${name} succeeded for ${spacesSucceed} out of ${totalSpaces} Spaces` });
    }
    
    return { responses, ixPerTx, spacesSucceed };
};
