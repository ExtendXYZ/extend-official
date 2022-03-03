import { useContext, createContext, useEffect, useState, useCallback } from "react"
import {useAnchorWallet, useWallet} from "@solana/wallet-adapter-react";
import * as anchor from "@project-serum/anchor";
import {useConnection} from "../contexts";
import {notify, useLocalStorageState} from "../utils";
import {sendTransaction} from "../actions";
import {box} from "tweetnacl";
import base58 from "bs58";

import {
    BASE,
    GlOBAL_CHANNEL,
    MESSAGE_PROGRAM_ID,
} from "../constants";

export const InboxContext = createContext<any>(null);

export const InboxProvider = ({ children }) => {
    const wallet = useWallet();
    const anchorWallet = useAnchorWallet();
    const connection = useConnection();
    const [inboxKey, setInboxKey] = useLocalStorageState("inbox");
    const [inboxKeypair, setInboxKeypair] = useState<any>(null);
    const [newMessage, setNewMessage] = useState(-1);
    const [newBroadcast, setNewBroadcast] = useState(-1);
    const [newSent, setNewSent] = useState(-1);

    useEffect(() => {
        if (!anchorWallet) {
            if (!localStorage.getItem("walletName")) {
                setInboxKey(null);
                setInboxKeypair(null);
            } else if (inboxKey && !inboxKeypair) {
                setInboxKeypair(box.keyPair.fromSecretKey(base58.decode(inboxKey)));
            }
        }
    },
        [anchorWallet]
    );

    useEffect(() => {
        const connectInbox = async () => {
            if (wallet.signMessage && anchorWallet && !inboxKeypair) {
                try {
                    const inboxSignature = await wallet.signMessage(Buffer.from("inbox"));
                    const inboxSeed = inboxSignature.slice(0, 32);
                    const myInboxKeypair = box.keyPair.fromSecretKey(inboxSeed);
                    const provider = new anchor.Provider(connection, anchorWallet, {
                        preflightCommitment: "recent",
                    });
                    const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                    const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                    const myInbox = (await anchor.web3.PublicKey.findProgramAddress(
                        [
                            BASE.toBuffer(),
                            Buffer.from("inbox"),
                            anchorWallet.publicKey.toBuffer(),
                        ],
                        MESSAGE_PROGRAM_ID,
                    ))[0];
                    try {
                        const myInboxData: any = await program.account.inbox.fetch(myInbox);
                        if (base58.encode(myInboxData.address) !== base58.encode(myInboxKeypair.publicKey)) {
                            notify({ message: "Your inbox is not up to date" });
                            throw "inbox address not match";
                        } else {
                            setInboxKey(base58.encode(inboxSeed));
                            setInboxKeypair(myInboxKeypair);
                            notify({message: "Your inbox is ready"});
                        }
                    } catch (error) {
                        console.log(error);
                        const instruction = await program.instruction.createInbox({
                            address: myInboxKeypair.publicKey
                        }, {
                            accounts: {
                                inbox: myInbox,
                                payer: anchorWallet.publicKey,
                                base: BASE,
                                systemProgram: anchor.web3.SystemProgram.programId
                            }
                        });
                        const response = await sendTransaction(connection, anchorWallet, [instruction], "Create Inbox");
                        if (response) {
                            setInboxKey(base58.encode(inboxSeed));
                            setInboxKeypair(myInboxKeypair);
                            notify({ message: "Your new inbox is initialized" });
                        } else {
                            setInboxKey(null);
                            setInboxKeypair(null);
                            notify({ message: "Your new inbox is not initialized" });
                        }
                    }
                } catch (error) {
                    setInboxKey(null);
                    setInboxKeypair(null);
                    notify({ message: "Can not get your inbox address"});
                }
            }
        }
        connectInbox();
    },
        [anchorWallet, inboxKeypair]
    );

    const connect = useCallback(() => {
        const connectInbox = async () => {
            if (wallet.signMessage && anchorWallet && !inboxKeypair) {
                try {
                    const inboxSignature = await wallet.signMessage(Buffer.from("inbox"));
                    const inboxSeed = inboxSignature.slice(0, 32);
                    const myInboxKeypair = box.keyPair.fromSecretKey(inboxSeed);
                    const provider = new anchor.Provider(connection, anchorWallet, {
                        preflightCommitment: "recent",
                    });
                    const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                    const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                    const myInbox = (await anchor.web3.PublicKey.findProgramAddress(
                        [
                            BASE.toBuffer(),
                            Buffer.from("inbox"),
                            anchorWallet.publicKey.toBuffer(),
                        ],
                        MESSAGE_PROGRAM_ID,
                    ))[0];
                    try {
                        const myInboxData: any = await program.account.inbox.fetch(myInbox);
                        if (base58.encode(myInboxData.address) !== base58.encode(myInboxKeypair.publicKey)) {
                            notify({ message: "Your inbox is not up to date" });
                            throw "inbox address not match";
                        } else {
                            setInboxKey(base58.encode(inboxSeed));
                            setInboxKeypair(myInboxKeypair);
                            notify({message: "Your inbox is ready"});
                        }
                    } catch (error) {
                        console.log(error);
                        const instruction = await program.instruction.createInbox({
                            address: myInboxKeypair.publicKey
                        }, {
                            accounts: {
                                inbox: myInbox,
                                payer: anchorWallet.publicKey,
                                base: BASE,
                                systemProgram: anchor.web3.SystemProgram.programId
                            }
                        });
                        const response = await sendTransaction(connection, anchorWallet, [instruction], "Create Inbox");
                        if (response) {
                            setInboxKey(base58.encode(inboxSeed));
                            setInboxKeypair(myInboxKeypair);
                            notify({ message: "Your new inbox is initialized" });
                        } else {
                            setInboxKey(null);
                            setInboxKeypair(null);
                            notify({ message: "Your new inbox is not initialized" });
                        }
                    }
                } catch (error) {
                    setInboxKey(null);
                    setInboxKeypair(null);
                    notify({ message: "Can not get your inbox address"});
                }
            }
        }
        connectInbox();
    },
        [anchorWallet, inboxKeypair]
    );

    useEffect(() => {

        const id = connection.onLogs(MESSAGE_PROGRAM_ID, (logs) => {
            let receiver = "";
            let sender = "";
            if (logs.logs.length === 11) {
                sender = logs.logs[3].slice(19);
                receiver = logs.logs[8].slice(17);
            } else if (logs.logs.length === 9) {
                sender = logs.logs[3].slice(19);
                receiver = logs.logs[6].slice(17);
            }
            if (anchorWallet && receiver === anchorWallet.publicKey.toBase58()) {
                setNewMessage(newMessage === -1 ? 1 : newMessage + 1);
            }
            if (receiver === GlOBAL_CHANNEL.toBase58()) {
                setNewBroadcast(newBroadcast === -1 ? 1 : newBroadcast + 1);
            } 
            if (anchorWallet && sender === anchorWallet.publicKey.toBase58()) {
                setNewSent(newSent === -1 ? 1 : newSent + 1);
            }
        }, "confirmed");
        return () => {
            connection.removeOnLogsListener(id);
        };
    },
        [anchorWallet] 
    );
    
    return (
        <InboxContext.Provider
            value={{
                inboxKeypair: inboxKeypair,
                connect: connect,
                newMessage: newMessage,
                readNewMessage: () => setNewMessage(0),
                newBroadcast: newBroadcast,
                readNewBroadcast: () => setNewBroadcast(0),
                newSent: newSent,
                readNewSent: () => setNewSent(0),
            }}
        >
            {children}
        </InboxContext.Provider>
    )
}

export const useInbox = () => {
    return useContext(InboxContext);
}