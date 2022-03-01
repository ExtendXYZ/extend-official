import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useEffect, useState } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { Header } from "./Header/Header";
import Box from "@mui/material/Box";
import List from '@mui/material/List';
import Drawer from '@mui/material/Drawer'
import ListItemButton from '@mui/material/ListItemButton';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InboxIcon from '@mui/icons-material/Inbox';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import Divider from '@mui/material/Divider';
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TextField from "@mui/material/TextField";
import RefreshIcon from '@mui/icons-material/Refresh';
import ReplyIcon from '@mui/icons-material/Reply';
import SendIcon from '@mui/icons-material/Send';
import {box} from "tweetnacl";
import base58 from "bs58";

import {useAnchorWallet} from "@solana/wallet-adapter-react";
import * as anchor from "@project-serum/anchor";
import {useConnection, useInbox} from "../contexts";
import {notify} from "../utils";
import {sendTransaction} from "../actions";

import {
    BASE,
    MESSAGE_PROGRAM_ID,
    GlOBAL_CHANNEL,
} from "../constants";

const theme = createTheme({
    palette: {
        mode: "dark",
    },
});

export const Message = () => {
    const anchorWallet = useAnchorWallet();
    const connection = useConnection();
    const inboxKeypair = useInbox();
    const [selectedIndex, setSelectedIndex] = useState(1);
    const [drafting, setDrafting] = useState(false);
    const [inboxMessage, setInboxMessage] = useState<any>([]);
    const [globalMessage, setGlobalMessage] = useState<any>([]);
    const [currentTo, setCurrentTo] = useState("");
    const [currentMessage, setCurrentMessage] = useState("");
    const crypto = require("crypto");

    useEffect(() => {
        const checkInbox = async () => {
            if (anchorWallet) {
                const myInbox = (await anchor.web3.PublicKey.findProgramAddress(
                    [
                        BASE.toBuffer(),
                        Buffer.from("inbox"),
                        anchorWallet.publicKey.toBuffer(),
                    ],
                    MESSAGE_PROGRAM_ID,
                ))[0];
                const sigs = await connection.getConfirmedSignaturesForAddress2(myInbox, {limit: 50}, "confirmed");
                const myInboxMessage: any = [];
                for (let sig of sigs) {
                    try {
                        const sigInfo = sig.signature;
                        const tx: any = await connection.getConfirmedTransaction(sigInfo, "confirmed");
                        if (tx["transaction"]["programId"].toBase58() === MESSAGE_PROGRAM_ID.toBase58()) {
                            const fromAddress = tx["meta"]["logMessages"][3];
                            const parsedFromAddress = fromAddress.slice(19);
                            const timestamp = tx["meta"]["logMessages"][5];
                            const parsedTimestamp = new Date(parseInt(timestamp.slice(17)) * 1000);
                            const msg = tx["meta"]["logMessages"][6];
                            const parsedMsg = Buffer.from(msg.slice(23, msg.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                            const msgNonce: any = tx["meta"]["logMessages"][7];
                            const parsedNonce = Buffer.from(msgNonce.slice(21, msgNonce.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                            const msgPubkey: any = tx["meta"]["logMessages"][8];
                            const parsedPubkey = Buffer.from(msgPubkey.slice(22, msgPubkey.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                            const decipheredText: any = box.open(parsedMsg, parsedNonce, parsedPubkey, inboxKeypair.secretKey);
                            const decryptedText = Buffer.from(decipheredText).toString();
                            myInboxMessage.push({
                                signature: sigInfo,
                                from: parsedFromAddress,
                                at: parsedTimestamp,
                                message: decryptedText,
                            });
                        }
                    } catch (error) {
                        console.log(error);
                    }
                }
                setInboxMessage(myInboxMessage);
            }
        }
        checkInbox();
    },
        [anchorWallet]
    );

    useEffect(() => {
        const checkInbox = async () => {
            const sigs = await connection.getConfirmedSignaturesForAddress2(GlOBAL_CHANNEL, {limit: 50}, "confirmed");
            let myGlobalMessage: any = [];
            for (let sig of sigs) {
                try {
                    const sigInfo = sig.signature;
                    const tx: any = await connection.getConfirmedTransaction(sigInfo, "confirmed");
                    if (tx["transaction"]["programId"].toBase58() === MESSAGE_PROGRAM_ID.toBase58()) {
                        const fromAddress = tx["meta"]["logMessages"][3];
                        const parsedFromAddress = fromAddress.slice(19);
                        const timestamp = tx["meta"]["logMessages"][4];
                        const parsedTimestamp = new Date(parseInt(timestamp.slice(17)) * 1000);
                        const msg = tx["meta"]["logMessages"][5];
                        const parsedMsg = Buffer.from(msg.slice(23, msg.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                        const decryptedText = Buffer.from(parsedMsg).toString();
                        myGlobalMessage.push({
                            signature: sigInfo,
                            from: parsedFromAddress,
                            at: parsedTimestamp,
                            message: decryptedText,
                        });
                    }
                } catch (error) {
                    console.log(error);
                }
            }
            setGlobalMessage(myGlobalMessage);
        }
        checkInbox();
    },
        [selectedIndex]
    );

    let messageList: any = null;
    if (!inboxKeypair) {
        messageList = "Your inbox is not connected. Please reconnect your wallet and set up your inbox";
    } else {
        if (selectedIndex === 1) {
            messageList = inboxMessage.map(v => 
                <ListItem key={v.signature}>
                    <div style={{width: "30%"}}>
                        {v.from}
                    </div>
                    <div style={{marginLeft: "auto", marginRight: "auto", width: "50%", overflowWrap: "break-word"}}>
                        {v.message}
                    </div>
                    <div >
                        {v.at.toLocaleString()}
                    </div>
                    <div >
                        <IconButton onClick={() => {
                            setCurrentTo(v.from);
                            setDrafting(true);
                        }}>
                            <ReplyIcon/>
                        </IconButton>
                    </div>
                </ListItem>
            );
        } else if (selectedIndex === 2) {
            messageList = globalMessage.map(v => 
                <ListItem key={v.signature}>
                    <div style={{width: "30%"}}>
                        {v.from}
                    </div>
                    <div style={{marginLeft: "auto", marginRight: "auto", width: "50%", overflowWrap: "break-word"}}>
                        {v.message}
                    </div>
                    <div >
                        {v.at.toLocaleString()}
                    </div>
                    <div >
                        <IconButton onClick={() => {
                            setCurrentTo(v.from);
                            setDrafting(true);
                        }}>
                            <ReplyIcon/>
                        </IconButton>
                    </div>
                </ListItem>
            );
        }
    }

    return (
        <div className="Message" style={{ backgroundColor: "transparent" }}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <Header />
                <div style={{display: "flex"}}>
                <div style={{ width: "20%", backgroundColor: "background.paper"}}>
                    <Button 
                        variant="contained"
                        className={"defaultButton"}
                        id="send-message-button"
                        sx={{marginTop: "10px"}}
                        onClick={(event) => setDrafting(true)}
                    >
                        Send Message
                    </Button>
                    <Drawer anchor="bottom" open={drafting} variant="persistent">
                        <div style={{display: "flex", alignItems: "center"}}>
                        <div style={{marginLeft: "auto"}}>
                            New message
                        </div>
                        <div style={{marginRight: "auto"}}>
                            <IconButton onClick={(event) => setDrafting(false)}>
                                <KeyboardArrowDownIcon />
                            </IconButton>
                        </div>
                        </div>
                        <Divider/>
                        <TextField
                            autoFocus
                            id="toAddress"
                            margin="dense"
                            label="To"
                            sx={{width: "50%", margin: "auto"}}
                            variant="standard"
                            helperText='Public Key or "Global"'
                            value={currentTo}
                            onChange={event => setCurrentTo(event.target.value)}
                        />
                        <TextField
                            id="messageContent"
                            margin="dense"
                            label="Message"
                            sx={{width: "50%", margin: "auto", height: "50%"}}
                            variant="standard"
                            multiline
                            rows={2}
                            value={currentMessage}
                            onChange={event => setCurrentMessage(event.target.value)}
                        />
                        <Button
                            style={{margin: "auto"}}
                            onClick={async (event) => {
                                if (!inboxKeypair || !anchorWallet) {
                                    notify({message: "Your inbox is not connected"});
                                } else {
                                    const provider = new anchor.Provider(connection, anchorWallet, {
                                        preflightCommitment: "recent",
                                    });
                                    const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                                    const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                                    try {
                                        if (currentTo === "Global") {
                                            const plainText = Buffer.alloc(128);
                                            plainText.write(currentMessage, 0);
                                            const instruction = await program.instruction.broadCast({
                                                message: plainText,
                                            }, {
                                                accounts: {
                                                    from: anchorWallet.publicKey,
                                                    global: GlOBAL_CHANNEL,
                                                }
                                            });
                                            const response = await sendTransaction(connection, anchorWallet, [instruction], "Sent Message");
                                            if (!response) {
                                                notify({ message: "Failed to broadcast" });
                                            } else {
                                                notify({ message: "Broadcasted" });
                                                setCurrentTo("");
                                                setCurrentMessage("")
                                                setDrafting(false);
                                            }
                                        } else {
                                            const toAddress = new anchor.web3.PublicKey(currentTo);
                                            const toInbox = (await anchor.web3.PublicKey.findProgramAddress(
                                                [
                                                    BASE.toBuffer(),
                                                    Buffer.from("inbox"),
                                                    toAddress.toBuffer(),
                                                ],
                                                MESSAGE_PROGRAM_ID,
                                            ))[0];
                                            const toInboxData: any = await program.account.inbox.fetch(toInbox);
                                            const plainText = Buffer.alloc(112);
                                            plainText.write(currentMessage, 0);
                                            const nonce = crypto.randomBytes(24);
                                            const cipherText = box(plainText, nonce, Buffer.from(toInboxData.address), inboxKeypair.secretKey);
                                            const instruction = await program.instruction.sendMessage({
                                                message: cipherText,
                                                nonce: nonce,
                                                pubkey: inboxKeypair.publicKey,
                                            }, {
                                                accounts: {
                                                    from: anchorWallet.publicKey,
                                                    to: toAddress,
                                                    inbox: toInbox,
                                                }
                                            });
                                            const response = await sendTransaction(connection, anchorWallet, [instruction], "Sent Message");
                                            if (!response) {
                                                notify({ message: "Failed to send message" });
                                            } else {
                                                notify({ message: "Message sent" });
                                                setCurrentTo("");
                                                setCurrentMessage("")
                                                setDrafting(false);
                                            }
                                        }
                                    } catch (error) {
                                        console.log(error);
                                        notify({ message: "Both you and receiver should have inboxes ready" });
                                    }
                                }
                            }}
                        >
                            Send
                            <SendIcon/>
                        </Button>
                    </Drawer>
                    <List component="nav" aria-label="main mailbox folders">
                        <ListItemButton
                        selected={selectedIndex === 1}
                        onClick={(event) => setSelectedIndex(1)}
                        >
                        <ListItemIcon>
                            <InboxIcon />
                        </ListItemIcon>
                        <ListItemText primary="Inbox" />
                        </ListItemButton>
                        <ListItemButton
                        selected={selectedIndex === 2}
                        onClick={(event) => setSelectedIndex(2)}
                        >
                        <ListItemIcon>
                            <PodcastsIcon />
                        </ListItemIcon>
                        <ListItemText primary="Broadcasts" />
                        </ListItemButton>
                    </List>

                </div>
                <Box sx={{width: "80%", bgcolor: "background.paper"}}>
                <div style={{display: "flex", alignContent: "center", marginTop: "10px"}}>
                    <div style={{marginLeft: "8px", marginTop: "auto", marginBottom: "auto"}}>
                        <IconButton onClick={async () => {
                            if (selectedIndex === 1) {
                                if (!anchorWallet || !inboxKeypair) {
                                    notify({message: "Your inbox is not connected"});
                                } else {
                                    const myInbox = (await anchor.web3.PublicKey.findProgramAddress(
                                        [
                                            BASE.toBuffer(),
                                            Buffer.from("inbox"),
                                            anchorWallet.publicKey.toBuffer(),
                                        ],
                                        MESSAGE_PROGRAM_ID,
                                    ))[0];
                                    const sigs = await connection.getConfirmedSignaturesForAddress2(myInbox, {limit: 50}, "confirmed");
                                    const myInboxMessage: any = [];
                                    for (let sig of sigs) {
                                        try {
                                            const sigInfo = sig.signature;
                                            const tx: any = await connection.getConfirmedTransaction(sigInfo, "confirmed");
                                            if (tx["transaction"]["programId"].toBase58() === MESSAGE_PROGRAM_ID.toBase58()) {
                                                const fromAddress = tx["meta"]["logMessages"][3];
                                                const parsedFromAddress = fromAddress.slice(19);
                                                const timestamp = tx["meta"]["logMessages"][5];
                                                const parsedTimestamp = new Date(parseInt(timestamp.slice(17)) * 1000);
                                                const msg = tx["meta"]["logMessages"][6];
                                                const parsedMsg = Buffer.from(msg.slice(23, msg.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                                                const msgNonce: any = tx["meta"]["logMessages"][7];
                                                const parsedNonce = Buffer.from(msgNonce.slice(21, msgNonce.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                                                const msgPubkey: any = tx["meta"]["logMessages"][8];
                                                const parsedPubkey = Buffer.from(msgPubkey.slice(22, msgPubkey.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                                                const decipheredText: any = box.open(parsedMsg, parsedNonce, parsedPubkey, inboxKeypair.secretKey);
                                                const decryptedText = Buffer.from(decipheredText).toString();
                                                myInboxMessage.push({
                                                    signature: sigInfo,
                                                    from: parsedFromAddress,
                                                    at: parsedTimestamp,
                                                    message: decryptedText,
                                                });
                                            }
                                        } catch (error) {
                                            console.log(error);
                                        }
                                    }
                                    setInboxMessage(myInboxMessage);
                                }
                            } else if (selectedIndex === 2) {
                                const sigs = await connection.getConfirmedSignaturesForAddress2(GlOBAL_CHANNEL, {limit: 50}, "confirmed");
                                let myGlobalMessage: any = [];
                                for (let sig of sigs) {
                                    try {
                                        const sigInfo = sig.signature;
                                        const tx: any = await connection.getConfirmedTransaction(sigInfo, "confirmed");
                                        if (tx["transaction"]["programId"].toBase58() === MESSAGE_PROGRAM_ID.toBase58()) {
                                            const fromAddress = tx["meta"]["logMessages"][3];
                                            const parsedFromAddress = fromAddress.slice(19);
                                            const timestamp = tx["meta"]["logMessages"][4];
                                            const parsedTimestamp = new Date(parseInt(timestamp.slice(17)) * 1000);
                                            const msg = tx["meta"]["logMessages"][5];
                                            const parsedMsg = Buffer.from(msg.slice(23, msg.length - 1).split(",").map((v: string) => v.trim()).map((v : string) => parseInt(v)));
                                            const decryptedText = Buffer.from(parsedMsg).toString();
                                            myGlobalMessage.push({
                                                signature: sigInfo,
                                                from: parsedFromAddress,
                                                at: parsedTimestamp,
                                                message: decryptedText,
                                            });
                                        }
                                    } catch (error) {
                                        console.log(error);
                                    }
                                }
                                setGlobalMessage(myGlobalMessage);
                            }
                        }}>
                            <RefreshIcon />
                        </IconButton>
                    </div>
                    <div style={{margin: "auto"}}/>
                    <div style={{marginRight: "20px", marginTop: "auto", marginBottom: "auto"}}>
                        <IconButton>
                            <KeyboardArrowLeftIcon/>
                        </IconButton>
                        <IconButton>
                            <KeyboardArrowRightIcon/>
                        </IconButton>
                    </div>
                </div>
                <Divider />
                <List component="nav" aria-label="main mailbox contents">
                    {messageList}
                </List>
                </Box>
                </div>
            </ThemeProvider>
        </div>
    );
}