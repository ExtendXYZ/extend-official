import { useContext, createContext, useEffect, useState } from "react"
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
    const [lastUser, setLastUser] = useLocalStorageState("lastUser");
    const [inboxKeypair, setInboxKeypair] = useState<any>(null);

    useEffect(() => {
        const connectInbox = async () => {
            if (wallet.signMessage && anchorWallet && lastUser !== anchorWallet.publicKey.toBase58()) {
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
                        if (Buffer.compare(Buffer.from(myInboxData.address), Buffer.from(myInboxKeypair.publicKey)) !== 0) {
                            notify({ message: "Your inbox is not up to date" });
                            throw "inbox address not match";
                        } else {
                            setInboxKey(base58.encode(inboxSeed));
                            setLastUser(anchorWallet.publicKey.toBase58());
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
                            notify({ message: "Your new inbox is initialized" });
                        } else {
                            setInboxKey(null);
                            notify({ message: "Your new inbox is not initialized" });
                        }
                    }
                } catch (error) {
                    setInboxKey(null);
                    notify({ message: "Can not get your inbox address"});
                }
            }
        }
        connectInbox();
    },
        [anchorWallet]
    );

    useEffect(() => {
        if (inboxKey) {
            setInboxKeypair(box.keyPair.fromSecretKey(base58.decode(inboxKey)));
        }
    }, [inboxKey]);
    
    return (
        <InboxContext.Provider
            value={inboxKeypair}
        >
            {children}
        </InboxContext.Provider>
    )
}

export const useInbox = () => {
    return useContext(InboxContext);
}