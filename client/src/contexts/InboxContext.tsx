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
    MESSAGE_PROGRAM_ID,
} from "../constants";

export const InboxContext = createContext<any>(null);

export const InboxProvider = ({ children }) => {
    const wallet = useWallet();
    const anchorWallet = useAnchorWallet();
    const connection = useConnection();
    const [inboxKey, setInboxKey] = useLocalStorageState("inbox");
    const [inboxKeypair, setInboxKeypair] = useState<any>(null);
    const [myInbox, setMyInbox] = useState<any>(null);

    useEffect(() => {
        if (!localStorage.getItem("walletName")) {
            setInboxKey(null);
            setInboxKeypair(null);
            setMyInbox(null);
        }
    },
        [anchorWallet]
    );

    useEffect(() => {
        const findMyInbox = async () => {
            if (anchorWallet) {
                const foundInbox = (await anchor.web3.PublicKey.findProgramAddress(
                    [
                        BASE.toBuffer(),
                        Buffer.from("inbox"),
                        anchorWallet.publicKey.toBuffer(),
                    ],
                    MESSAGE_PROGRAM_ID,
                ))[0];
                setMyInbox(foundInbox);
            }
        }
        findMyInbox();
    },
        [anchorWallet] 
    );

    useEffect(() => {
        const connectInbox = async () => {
            if (wallet.signMessage && anchorWallet && myInbox && !inboxKeypair) {
                try {
                    const inboxSignature = await wallet.signMessage(Buffer.from("inbox"));
                    const inboxSeed = inboxSignature.slice(0, 32);
                    const myInboxKeypair = box.keyPair.fromSecretKey(inboxSeed);
                    const provider = new anchor.Provider(connection, anchorWallet, {
                        preflightCommitment: "recent",
                    });
                    const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                    const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                    try {
                        const myInboxData: any = await program.account.inbox.fetch(myInbox);
                        if (Buffer.compare(Buffer.from(myInboxData.address), Buffer.from(myInboxKeypair.publicKey)) !== 0) {
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
        [anchorWallet, myInbox, inboxKeypair]
    );

    useEffect(() => {
        if (inboxKey && !inboxKeypair) {
            setInboxKeypair(box.keyPair.fromSecretKey(base58.decode(inboxKey)));
        }
    }, [inboxKey]);

    const connect = useCallback(() => {
        const connectInbox = async () => {
            if (wallet.signMessage && anchorWallet && myInbox && !inboxKeypair) {
                try {
                    const inboxSignature = await wallet.signMessage(Buffer.from("inbox"));
                    const inboxSeed = inboxSignature.slice(0, 32);
                    const myInboxKeypair = box.keyPair.fromSecretKey(inboxSeed);
                    const provider = new anchor.Provider(connection, anchorWallet, {
                        preflightCommitment: "recent",
                    });
                    const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                    const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                    try {
                        const myInboxData: any = await program.account.inbox.fetch(myInbox);
                        if (Buffer.compare(Buffer.from(myInboxData.address), Buffer.from(myInboxKeypair.publicKey)) !== 0) {
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
        [anchorWallet, myInbox, inboxKeypair]
    );

    // useEffect(() => {

    //     const id = connection.onProgramAccountChange(MESSAGE_PROGRAM_ID, (accountInfo) => {
    //         if (accountInfo.accountId.toBase58() === myInbox.toBase58()) {

    //         }
    //     }, "confirmed");
    //     return () => {
    //         connection.removeProgramAccountChangeListener(id);
    //     };
    // },
    //     [anchorWallet] 
    // )
    
    return (
        <InboxContext.Provider
            value={{
                inboxKeypair: inboxKeypair,
                inboxAddress: myInbox,
                connect: connect,
            }}
        >
            {children}
        </InboxContext.Provider>
    )
}

export const useInbox = () => {
    return useContext(InboxContext);
}