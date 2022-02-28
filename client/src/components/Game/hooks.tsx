import {useEffect, useRef, useState} from "react";
import {box} from "tweetnacl";
import {Game} from "./index"
import {useAnchorWallet, useWallet} from "@solana/wallet-adapter-react";
import {useConnection} from "../../contexts";
import {PublicKey, Transaction, Keypair, SystemProgram} from "@solana/web3.js";
import {
    AcceptOfferArgs,
    acceptOfferInstruction,
    acceptOfferInstructions,
    ChangeColorArgs,
    changeColorInstructions,
    ChangeOfferArgs,
    changeOfferInstruction,
    changeOfferInstructions,
    initSpaceMetadataInstructions,
    sendInstructionsGreedyBatch,
    sendTransaction,
    initNeighborhoodMetadataInstruction,
    createColorClusterInstruction,
    createTimeClusterInstruction,
    initFrameInstruction,
    initVoucherSystemInstruction,
    MakeEditableArgs,
    makeEditableInstruction,
    makeEditableInstructions,
    SetRentArgs,
    setRentInstruction,
    setRentInstructions,
    AcceptRentArgs,
    acceptRentInstruction,
    acceptRentInstructions,
    updateNeighborhoodMetadataInstruction
} from "../../actions";
import { sendSignedTransaction } from '../../contexts/ConnectionContext'
import {
    BASE, 
    SPACE_METADATA_SEED, 
    SPACE_PROGRAM_ID, 
    MAX_REGISTER_ACCS, 
    NEIGHBORHOOD_SIZE,
    CANDY_MACHINE_PROGRAM_ID,
    VOUCHER_MINT_SEED,
    VOUCHER_SINK_SEED,
    CAPTCHA_VERIFY_URL,
    VOUCHER_MINT_AUTH,
    MESSAGE_PROGRAM_ID,
    GlOBAL_CHANNEL,
    DEFAULT_MINT,
} from "../../constants";
import {Server} from "./server.js";
import {Database} from "./database.js";
import {notify, loading, rgbToHex} from "../../utils";
import {signedIntToBytes} from "../../utils/borsh"
import * as anchor from "@project-serum/anchor";
import {sleep} from "../../utils";

const axios = require('axios');

function checkKeys(obj, keys){
    for(let key of keys){
        if (!(key in obj)){
            return false;
        }
    }
    return true;
}


export function Screen(props) {
    const [user, setUser] = useState<PublicKey>();
    const wallet = useWallet();
    const anchorWallet = useAnchorWallet();
    const connection = useConnection();
    const server = new Server();
    const database = new Database();

    const mounted = useRef(true); 
    const [ownedSpaces, setOwnedSpaces] = useState(new Set<string>());
    const [ownedMints, setOwnedMints] = useState({});
    const [loadedOwned, setLoadedOwned] = useState(false);
    const [changeColorTrigger, setChangeColorTrigger] = useState({});
    const [changeColorsTrigger, setChangeColorsTrigger] = useState({});
    const [makeEditableColorTrigger, setMakeEditableColorTrigger] = useState({});
    const [makeEditableColorsTrigger, setMakeEditableColorsTrigger] = useState({});
    const [changePriceTrigger, setChangePriceTrigger] = useState({});
    const [changePricesTrigger, setChangePricesTrigger] = useState({});
    const [purchaseSpaceTrigger, setPurchaseSpaceTrigger] = useState({});
    const [purchaseSpacesTrigger, setPurchaseSpacesTrigger] = useState({});
    const [imgUploadTrigger, setImgUploadTrigger] = useState({});
    const [gifUploadTrigger, setGifUploadTrigger] = useState({});
    const [registerTrigger, setRegisterTrigger] = useState(false);
    const [registerAccs, setRegisterAccs] = useState({});
    const [registerMints, setRegisterMints] = useState({});
    const [newNeighborhoodTrigger, setNewNeighborhoodTrigger] = useState<any>({});
    const [updateNeighborhoodMetadataTrigger, setUpdateNeighborhoodMetadataTrigger] = useState<any>({});
    const [newFrameTrigger, setNewFrameTrigger] = useState<any>({});
    const [changeRentTrigger, setChangeRentTrigger] = useState({});
    const [changeRentsTrigger, setChangeRentsTrigger] = useState({});
    const [acceptRentTrigger, setAcceptRentTrigger] = useState({});
    const [acceptRentsTrigger, setAcceptRentsTrigger] = useState({});
    const [messageOpenTrigger, setMessageOpenTrigger] = useState({});
    const [sendMessageTrigger, setSendMessageTrigger] = useState<any>({});
    const [checkInboxTrigger, setCheckInboxTrigger] = useState({});
    const [checkGlobalTrigger, setCheckGlobalTrigger] = useState({});
    const [viewer, setViewer] = useState(0);
    const [inboxKeypair, setInboxKeypair] = useState<any>(null);
    const [inboxMessage, setInboxMessage] = useState([]);
    const [globalMessage, setGlobalMessage] = useState([]);
    const game = useRef<Game>(null);
    const crypto = require("crypto");

    const getId = () => {
        const currId = localStorage.getItem("id");
        if (currId) {
            return currId;
        } 
        const id = crypto.randomBytes(20).toString('hex');
        // console.log("New", id)
        localStorage.setItem("id", id);
        return id;
    }

    const pullNumViewers = async() => {
        const numViewers = await database.getNumViewers();
        setViewer(numViewers);
    }

    const refreshUser = async() => {
        const numViewers = await database.connectNew(getId());
        setViewer(numViewers);
    }

    useEffect(() => {
        // const cleanup = async () => {
        //     if (document.visibilityState === "visible") {
        //         await refreshUser();
        //     }
        // }
        const getViewer = async () => {
            await refreshUser();
            // document.addEventListener('visibilitychange', cleanup);
        }
        const unMount = () => {
            mounted.current = false;
            // document.removeEventListener('visibilitychange', cleanup);
        }
        getViewer();
        return unMount();
    }, []);

    useEffect(() => {
        const interval = setInterval(pullNumViewers, 60 * 1000); // update numviewers live
        return () => {
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const interval = setInterval(refreshUser, 4 * 60 * 1000); // refresh timestamp for user
        return () => {
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const getTokens = async () => {
            console.log("wallet hook");
            console.log(wallet);
            setUser(wallet.publicKey ? wallet.publicKey : undefined);
            if (!wallet.publicKey) { // if wallet is disconnected, set address to null 
                server.setAddress(null); 
                setOwnedSpaces(new Set());
                setOwnedMints({});
                // game.current?.resetTargets();
            }
            // update owned tokens
            else if (!wallet.disconnecting && wallet.publicKey && user === wallet.publicKey) {
                //server.refreshCache(wallet.publicKey.toBase58());
                server.setAddress(user);
                // const data = await server.getSpacesByOwner(connection, wallet.publicKey.toBase58(), false);
                let data;
                try {
                    data = await database.getSpacesByOwner(wallet.publicKey);
                } catch(e){
                    console.error(e);
                    data = await server.getSpacesByOwner(connection, wallet.publicKey);
                }
                if (data && mounted) {
                    setOwnedSpaces(data.spaces);
                    setOwnedMints(data.mints);
                    setLoadedOwned(true);
                    // game.current?.resetTargets();
                }
                game.current?.refreshSidebar();
            }
        }
        getTokens();
    },
        [wallet, user]
    );

    useEffect(() => {
        setInboxKeypair(null);
    },
        [wallet, user]
    );

    useEffect(() => {
        const checkInbox = async () => {
            if (wallet.signMessage && user && anchorWallet) {
                if (!inboxKeypair) {
                    notify({message: "You don't have your inbox"});
                    return;
                }
                const myInbox = (await PublicKey.findProgramAddress(
                    [
                        BASE.toBuffer(),
                        Buffer.from("inbox"),
                        user.toBuffer(),
                    ],
                    MESSAGE_PROGRAM_ID,
                ))[0];
                const sigs = await connection.getConfirmedSignaturesForAddress2(myInbox, undefined, "confirmed");
                let myInboxMessage: any = [];
                for (let sig of sigs) {
                    try {
                        const sigInfo = sig.signature;
                        const tx: any = await connection.getConfirmedTransaction(sigInfo, "confirmed");
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
                        myInboxMessage = [...myInboxMessage, {
                            from: parsedFromAddress,
                            at: parsedTimestamp,
                            message: decryptedText,
                        }];
                        setInboxMessage(myInboxMessage);
                    } catch (error) {
                        console.log(error);
                    }
                    
                }
            }
        }
        checkInbox();
    },
        [checkInboxTrigger]
    );

    useEffect(() => {
        const checkInbox = async () => {
            const sigs = await connection.getConfirmedSignaturesForAddress2(GlOBAL_CHANNEL, undefined, "confirmed");
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
                        myGlobalMessage = [...myGlobalMessage, {
                            from: parsedFromAddress,
                            at: parsedTimestamp,
                            message: decryptedText,
                        }];
                        setGlobalMessage(myGlobalMessage);
                    }
                } catch (error) {
                    console.log(error);
                }
                
            }
        }
        checkInbox();
    },
        [checkGlobalTrigger]
    );

    useEffect(() => {
        const sendMessage = async () => {
            if (wallet.signMessage && user && anchorWallet) {
                if (!inboxKeypair) {
                    notify({message: "You don't have inbox"});
                    return;
                }
                const provider = new anchor.Provider(connection, anchorWallet, {
                    preflightCommitment: "recent",
                });
                const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                const myInbox = (await PublicKey.findProgramAddress(
                    [
                        BASE.toBuffer(),
                        Buffer.from("inbox"),
                        user.toBuffer(),
                    ],
                    MESSAGE_PROGRAM_ID,
                ))[0];
                try {
                    if (sendMessageTrigger.to === "Global") {
                        const plainText = Buffer.alloc(128);
                        plainText.write(sendMessageTrigger.message, 0);
                        const instruction = await program.instruction.broadCast({
                            message: plainText,
                        }, {
                            accounts: {
                                from: user,
                                global: GlOBAL_CHANNEL,
                            }
                        });
                        const response = await sendTransaction(connection, wallet, [instruction], "Sent Message");
                        if (!response) {
                            notify({ message: "Failed to broadcast" });
                        } else {
                            notify({ message: "Broadcasted" });
                        }
                    } else {
                        const toAddress = new PublicKey(sendMessageTrigger.to);
                        const toInbox = (await PublicKey.findProgramAddress(
                            [
                                BASE.toBuffer(),
                                Buffer.from("inbox"),
                                toAddress.toBuffer(),
                            ],
                            MESSAGE_PROGRAM_ID,
                        ))[0];
                        const toInboxData: any = await program.account.inbox.fetch(toInbox);
                        const plainText = Buffer.alloc(112);
                        plainText.write(sendMessageTrigger.message, 0);
                        const nonce = crypto.randomBytes(24);
                        const cipherText = box(plainText, nonce, Buffer.from(toInboxData.address), inboxKeypair.secretKey);
                        const instruction = await program.instruction.sendMessage({
                            message: cipherText,
                            nonce: nonce,
                            pubkey: inboxKeypair.publicKey,
                        }, {
                            accounts: {
                                from: user,
                                to: toAddress,
                                inbox: toInbox,
                            }
                        });
                        const response = await sendTransaction(connection, wallet, [instruction], "Sent Message");
                        if (!response) {
                            notify({ message: "Failed to send message" });
                        } else {
                            notify({ message: "Message sent" });
                        }
                    }
                } catch (error) {
                    console.log(error);
                    notify({ message: "Both you and receiver should have inboxes ready" });
                }
            }
        }
        sendMessage();
    },
        [sendMessageTrigger]
    );

    useEffect(() => {
        const checkInbox = async () => {
            if (wallet.signMessage && user && anchorWallet && !inboxKeypair) {
                const inboxSignature = await wallet.signMessage(Buffer.from("inbox"));
                const inboxSeed = inboxSignature.slice(0, 32);
                const myInboxKeypair = box.keyPair.fromSecretKey(inboxSeed);
                const provider = new anchor.Provider(connection, anchorWallet, {
                    preflightCommitment: "recent",
                });
                const idl = await anchor.Program.fetchIdl(MESSAGE_PROGRAM_ID, provider);
                const program = new anchor.Program(idl, MESSAGE_PROGRAM_ID, provider);
                const myInbox = (await PublicKey.findProgramAddress(
                    [
                        BASE.toBuffer(),
                        Buffer.from("inbox"),
                        user.toBuffer(),
                    ],
                    MESSAGE_PROGRAM_ID,
                ))[0];
                try {
                    const myInboxData: any = await program.account.inbox.fetch(myInbox);
                    if (Buffer.compare(Buffer.from(myInboxData.address), Buffer.from(myInboxKeypair.publicKey)) !== 0) {
                        notify({ message: "Your inbox is not up to date" });
                        throw "inbox address not match";
                    } else {
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
                            payer: user,
                            base: BASE,
                            systemProgram: SystemProgram.programId
                        }
                    });
                    const response = await sendTransaction(connection, wallet, [instruction], "Create Inbox");
                    if (response) {
                        setInboxKeypair(myInboxKeypair);
                        notify({ message: "Your new inbox is initialized" });
                    } else {
                        setInboxKeypair(null);
                        notify({ message: "Your new inbox is not initialized" });
                    }
                }
            }
        }
        checkInbox();
    },
        [messageOpenTrigger]
    );


    useEffect(() => {
        const asyncRegisterAll = async () => {
            if (wallet.publicKey && registerTrigger) {
                let totalAccs = {};
                let totalMints = {};
                if (!registerAccs || !registerMints) { // whether we need to look through all account infos
                    let accs: any[] = [];
                    // let ownedSpacesArray: any[] = [...ownedSpaces];
                    const data = await server.getSpacesByOwner(connection, wallet.publicKey);
                    if (!data) {
                        return;
                    }
                    //await database.register(wallet.publicKey.toBase58(), data.mints); // update database for mints that have registered
                    let ownedSpacesArray: any[] = [...data.spaces];
                    let ownedMintsDict = data.mints;
                    
                    for (const p of ownedSpacesArray) {
                        const pos = JSON.parse(p);
                        const space_x = signedIntToBytes(pos.x);
                        const space_y = signedIntToBytes(pos.y);
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
                    // console.log("Accounts", accs.length)
                    const accInfos = await server.batchGetMultipleAccountsInfoLoading(connection, accs, 'Registering');
                    loading(null, 'Registering', "success");

                    for (let i = 0; i < accInfos.length; i++) {
                        if (accInfos[i] === null) { // pass the accounts we want to initialize
                            totalAccs[ownedSpacesArray[i]] = accs[i];
                            totalMints[ownedSpacesArray[i]] = ownedMintsDict[ownedSpacesArray[i]];
                        }
                    }
                } else { // otherwise use cache
                    totalAccs = registerAccs;
                    totalMints = registerMints;
                }

                const currSpaceAccs = {};
                const currMints = {};
                let numAccountsToRegister = 0;
                // populate currAccs and mints to register
                for (let position in totalAccs) {
                    if (Object.keys(currMints).length < MAX_REGISTER_ACCS) { // limit to MAX register accs in current batch
                        currSpaceAccs[position] = totalAccs[position];
                        currMints[position] = totalMints[position];
                    }
                    numAccountsToRegister++;
                }

                const numRegistering = Object.keys(currMints).length;
                // console.log("Need to register", numRegistering)

                if (numRegistering === 0) { // if there are no spaces to register
                    notify({ message: "Already registered all Spaces" });
                } else {
                    try {
                        let ixs = await initSpaceMetadataInstructions(wallet, BASE, currSpaceAccs, currMints);
                        let res = await sendInstructionsGreedyBatch(connection, wallet, ixs, "Register", false);

                        // remove registered accs from totalAccs and mints
                        let responses = res.responses;
                        let ixPerTx = res.ixPerTx;
                        let allPositions = Object.keys(totalAccs);
                        let ind = 0;
                        let doneMints = {};
                        for(let i = 0; i < responses.length; i++) {
                            if(responses[i]) { // if tx success
                                for(let j = 0; j < ixPerTx[i]; j++) { // remove from the objects
                                    doneMints[allPositions[ind + j]] = totalMints[allPositions[ind + j]];
                                    delete totalAccs[allPositions[ind + j]];
                                    delete totalMints[allPositions[ind + j]];
                                }
                            }
                            ind += ixPerTx[i];
                        }
                        
                        // update database for mints that have registered
                        await sleep(20000); // sleep 20 seconds metadata completion
                        await database.register(wallet.publicKey, doneMints);
                        
                        // console.log("Total accs remaining after register", Object.keys(totalAccs).length)
                        setRegisterAccs(totalAccs); // cache the unregistered accs and mints to avoid heavy get account infos
                        setRegisterMints(totalMints);

                        // notify if need to reclick register
                        let numSucceed = res.spacesSucceed;
                        notify({ message: `Register succeeded for ${numSucceed} out of ${numRegistering} Spaces` });
                        if (numAccountsToRegister > numRegistering) {
                            notify({ message: `Registered ${numSucceed} Spaces, need to register ${numAccountsToRegister - numSucceed} more Spaces, reclick register!` });
                        }
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
                loading(null, 'Registering', 'success'); // TODO use correct status
            }
            setRegisterTrigger(false); // reset register so that we can click multiple times
        }
        asyncRegisterAll();
    },
        [registerTrigger]
    );

    useEffect(() => {
        const asyncChangeColor = async() => {
            let keys = ["color", "x", "y", "frame"]
            if (checkKeys(changeColorTrigger, keys) && wallet.publicKey) {
                const color = changeColorTrigger["color"];
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                const x = changeColorTrigger["x"];
                const y = changeColorTrigger["y"];
                const frame = changeColorTrigger["frame"];
                const position = JSON.stringify({x, y});

                const n_x = Math.floor(x / NEIGHBORHOOD_SIZE); // filter out same color
                const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                const p_y = ((y % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
                const p_x = ((x % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
                const nhood = JSON.stringify({n_x, n_y});
                if (frame !== -1 && game.current?.viewport.neighborhoodColors[nhood][p_y][p_x] === color) {
                    notify({
                        message: "Already the selected color, try changing to a different color",
                    });
                    return;
                }

                let mint = changeColorTrigger["mint"];
                let owner = changeColorTrigger["owner"];
                if (!owner) { // if there is no owner
                    owner = user;
                    mint = DEFAULT_MINT;
                }

                let changes: ChangeColorArgs[] = [];

                let numFramesMap = {};
                let frameKeysMap = {};
                let n_frames = -1;
                let neighborhoods = server.getNeighborhoods([position]);
                const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);
                if (frame === -1){
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));

                    n_frames = numFramesMap[JSON.stringify({n_x, n_y})];
                    for (let frame_i = 0; frame_i < n_frames; frame_i++){
                        changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, mint, owner}));
                    }
                }
                else{
                    let change = new ChangeColorArgs({x, y, frame, r, g, b, mint, owner});
                    changes.push(change);
                }
                try {
                    notify({
                        message: "Changing color...",
                    });
                    let ixs = await changeColorInstructions(connection, server, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color", true, n_frames);
                }
                catch (e) {
                    console.error(e);
                    return;
                }
            }
        }
        asyncChangeColor();
    },
        [changeColorTrigger]
    );

    // useEffect(() => {
    //     const asyncChangeColors = async () => {
    //         let changes: ChangeColorArgs[] = [];
    //         const color = changeColorsTrigger["color"];
    //         const spaces = changeColorsTrigger["spaces"];
    //         const frame = changeColorsTrigger["frame"];
    //         const owners = changeColorsTrigger["owners"];
    //         const mints = changeColorsTrigger["mints"];
    //         const editable = changeColorsTrigger["editable"];

    //         if (color != null && wallet.publicKey) {
    //             const r = parseInt(color.slice(1, 3), 16);
    //             const g = parseInt(color.slice(3, 5), 16);
    //             const b = parseInt(color.slice(5, 7), 16);
                
    //             const spaceGrid = ownedSpaces;
    //             let n_x;
    //             let n_y;

    //             let neighborhoods = server.getNeighborhoods(spaces);
    //             let numFramesMap = {};
    //             let frameKeysMap = {};
    //             let n_frames = -1;
    //             if (frame == -1){
    //                 ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
    //             }
    //             else{
    //                 frameKeysMap = await server.getFrameKeys(connection, neighborhoods, frame);
    //             }
    //             const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);

    //             for (const s of spaces) {
    //                 if (spaceGrid.has(s)) {
    //                     let p = JSON.parse(s);
    //                     const x = p.x;
    //                     const y = p.y;
    //                     const mint = ownedMints[s];
    //                     const owner = owners[s];

    //                     if (frame == -1){
    //                         let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
    //                         let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                            
    //                         n_frames = numFramesMap[JSON.stringify({n_x, n_y})];
    //                         for (let frame_i = 0; frame_i < n_frames; frame_i++){
    //                             changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, mint, owner}));
    //                         }
    //                     }
    //                     else{
    //                         let change = new ChangeColorArgs({x, y, frame, r, g, b, mint, owner});
    //                         changes.push(change);
    //                     }
    //                 }
    //             }
    //             try {
    //                 let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap, timeClusterMap);
    //                 sendInstructionsGreedyBatch(connection, wallet, ixs, "change colors", true, n_frames);
    //             }
    //             catch (e) {
    //                 console.log(e)
    //                 return;
    //             }
    //         }
    //     }
    //     asyncChangeColors();
    // },
    //     [changeColorsTrigger]
    // );

    useEffect(() => {
        const asyncChangeColors = async () => {
            let keys = ["color", "spaces", "frame", "owners", "mints", "editable"];

            if (checkKeys(changeColorsTrigger, keys) && wallet.publicKey) {
                const color = changeColorsTrigger["color"];
                const spaces = changeColorsTrigger["spaces"];
                const frame = changeColorsTrigger["frame"];
                const owners = changeColorsTrigger["owners"];
                const mints = changeColorsTrigger["mints"];
                const editable = changeColorsTrigger["editable"];
                let changes: ChangeColorArgs[] = [];
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                
                const spaceGrid = ownedSpaces;

                let neighborhoods = server.getNeighborhoods(spaces);
                let numFramesMap = {};
                let frameKeysMap = {};
                let n_frames = -1;
                if (frame === -1){
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
                }
                else{
                    frameKeysMap = await server.getFrameKeys(connection, neighborhoods, frame);
                }
                const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);

                for (const s of spaces) {
                    if ((frame !== -1 && editable.has(s)) || (frame === -1 && spaceGrid.has(s))) {
                        let p = JSON.parse(s);
                        const x = p.x;
                        const y = p.y;
                        const n_x = Math.floor(x / NEIGHBORHOOD_SIZE); // filter out same color
                        const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                        const p_y = ((y % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
                        const p_x = ((x % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
                        const nhood = JSON.stringify({n_x, n_y});
                        if (frame !== -1 && game.current?.viewport.neighborhoodColors[nhood][p_y][p_x] === color) { // same color
                            continue;
                        }
                        let owner, mint;
                        if (Object.keys(owners).length > 0 && owners[s] && mints[s]) {
                            owner = owners[s];
                            mint = mints[s];
                        } else { // if owners is null, db is down
                            owner = user;
                            mint = DEFAULT_MINT;
                        }

                        if (frame === -1){
                            n_frames = numFramesMap[JSON.stringify({n_x, n_y})];
                            for (let frame_i = 0; frame_i < n_frames; frame_i++){
                                changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, mint, owner}));
                            }
                        }
                        else{
                            let change = new ChangeColorArgs({x, y, frame, r, g, b, mint, owner});
                            changes.push(change);
                        }
                    }
                }

                if (changes.length === 0) { // if empty
                    notify({
                        message: "All spaces already have the selected color",
                    });
                    return;
                }

                try {
                    notify({
                        message: "Changing colors...",
                    });
                    let ixs = await changeColorInstructions(connection, server, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change colors", true, n_frames);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncChangeColors();
    },
        [changeColorsTrigger]
    );

    useEffect(() => {
        const asyncMakeEditableColor = async() => {
            let keys = ["editable", "x", "y", "mint"];
            if (checkKeys(makeEditableColorTrigger, keys) && wallet.publicKey) {
                const editable = makeEditableColorTrigger["editable"];
                const x = makeEditableColorTrigger["x"];
                const y = makeEditableColorTrigger["y"];
                const position = JSON.stringify({x, y});
                const mint = makeEditableColorTrigger["mint"];

                const n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                const timeClusterKey = await server.getEditableTimeClusterKey(connection, n_x, n_y);
                try {
                    let change = new MakeEditableArgs({x, y, mint});
                    let ix = await makeEditableInstruction(connection, wallet, BASE, change, timeClusterKey);
                    sendTransaction(connection, wallet, ix, "Make color editable");
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncMakeEditableColor();
    },
        [makeEditableColorTrigger]
    );

    useEffect(() => {
        const asyncMakeEditableColors = async() => {
            let keys = ["editable", "spaces"]
            if (checkKeys(makeEditableColorsTrigger, keys) && wallet.publicKey) {
                const editable = makeEditableColorsTrigger["editable"];
                const spaces = makeEditableColorsTrigger["spaces"];
                const mints = makeEditableColorsTrigger["mints"];
                let changes: MakeEditableArgs[] = [];
                const spaceGrid = ownedSpaces;
                for (let space of spaces) {
                    if (spaceGrid.has(space)) {
                        const mint = mints[space];
                        const p = JSON.parse(space);
                        const x = p.x;
                        const y = p.y;
                        let change = new MakeEditableArgs({x, y, mint});
                        changes.push(change);
                    }
                }
                let neighborhoods = server.getNeighborhoods(spaces);
                const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);

                try {
                    let ixs = await makeEditableInstructions(connection, wallet, BASE, changes, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "Make colors editable");
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncMakeEditableColors();
    },
        [makeEditableColorsTrigger]
    );

    useEffect(() => {
        const asyncSetPrice = async() => {
            let keys = ["price", "create", "x", "y", "mint"];
            const price = changePriceTrigger["price"];
            const create = changePriceTrigger["create"];
            if (checkKeys(changePriceTrigger, keys) && (price || !create) && wallet.publicKey) {
                const x = changePriceTrigger["x"];
                const y = changePriceTrigger["y"];
                const mint = changePriceTrigger["mint"];
                try {
                    let change = new ChangeOfferArgs({x, y, mint, price, create});
                    let ix = await changeOfferInstruction(wallet, BASE, change);
                    let name = "Set space price"
                    if (!create) {
                        name = "Delist"
                    }
                    sendTransaction(connection, wallet, ix, name);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncSetPrice();
    },
        [changePriceTrigger]
    );

    useEffect(() => {
        const asyncSetPrices = async() => {
            let keys = ["price", "create", "spaces"];
            const price = changePricesTrigger["price"];
            const create = changePricesTrigger["create"];
            const spaces = changePricesTrigger["spaces"];
            if (checkKeys(changePricesTrigger, keys) && (price || !create) && wallet.publicKey && spaces) {

                let changes: ChangeOfferArgs[] = [];
                const spaceGrid = ownedSpaces;
                for (let space of spaces){
                    if (spaceGrid.has(space)) {
                        let p = JSON.parse(space);
                        const x = p.x;
                        const y = p.y;
                        const mint = ownedMints[space];
                        let change = new ChangeOfferArgs({x, y, mint: mint, price, create});
                        changes.push(change);
                    }
                }
                try{
                    let ixs = await changeOfferInstructions(wallet, BASE, changes);
                    let name = "Set space prices"
                    if (!create) {
                        name = "Delist"
                    }
                    sendInstructionsGreedyBatch(connection, wallet, ixs, name);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncSetPrices();
    },
        [changePricesTrigger]
    );

    useEffect(() => {
        const asyncPurchaseSpace = async() => {
            let keys = ["price", "x", "y", "owner", "mint"];
            let price = purchaseSpaceTrigger["price"];
            if (checkKeys(purchaseSpaceTrigger, keys) && price && wallet.publicKey) {
                let currentUser = wallet.publicKey;
                const x = purchaseSpaceTrigger["x"];
                const y = purchaseSpaceTrigger["y"];
                const bob = purchaseSpaceTrigger["owner"];
                const position = JSON.stringify({x, y});
                const mint = purchaseSpaceTrigger["mint"];
                try {
                    let change = new AcceptOfferArgs({x, y, mint: mint, price, seller: bob});
                    let ix = await acceptOfferInstruction(connection, server, wallet, BASE, change);
                    const response = await sendTransaction(connection, wallet, ix, "Buy space");
                    if (response) {
                        let finalOwnedSpaces = new Set(ownedSpaces);
                        let newOwnedMints = {};
                        finalOwnedSpaces.add(position);
                        newOwnedMints[position] = mint;
                        game.current?.refreshSidebar();

                        // if wallet is unchanged, update state
                        if (wallet.publicKey === currentUser){
                            setOwnedSpaces(finalOwnedSpaces);
                            setOwnedMints({...ownedMints, ...newOwnedMints});
                        }
                        database.register(wallet.publicKey, newOwnedMints);
                    }
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncPurchaseSpace();
    },
        [purchaseSpaceTrigger]
    );

    useEffect(() => {
        const asyncPurchaseSpaces = async() => {
            let keys = ["purchasableInfo"];
            if (checkKeys(purchaseSpacesTrigger, keys) && wallet.publicKey) {
                try {
                    let currentUser = wallet.publicKey;
                    let changes = purchaseSpacesTrigger["purchasableInfo"].map(x => new AcceptOfferArgs(x));
                    let ixs = await acceptOfferInstructions(connection, server, wallet, BASE, changes);
                    const inter = await sendInstructionsGreedyBatch(connection, wallet, ixs, "Buy spaces");
                    let responses = inter.responses;
                    let ixPerTx = inter.ixPerTx;
                    let ind = 0;
                    let finalOwnedSpaces = new Set(ownedSpaces);
                    let newOwnedMints = {};
                    for (let i = 0; i < responses.length; i++) {
                        
                        if (i !== 0) {
                            ind += ixPerTx[i-1];
                        }

                        if (responses[i]) {
                            for (let j = 0; j < ixPerTx[i]; j++) {
                                let x = changes[ind+j].x;
                                let y = changes[ind+j].y;
                                let mint = changes[ind+j].mint;
                                let position = JSON.stringify({x, y});
                                finalOwnedSpaces.add(position);
                                newOwnedMints[position] = mint;
                            }
                        }
                    }
                    game.current?.refreshSidebar();

                    // if wallet is unchanged, update state
                    if (wallet.publicKey === currentUser){
                        setOwnedSpaces(finalOwnedSpaces);
                        setOwnedMints({...ownedMints, ...newOwnedMints});
                    }
                    database.register(wallet.publicKey, newOwnedMints);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncPurchaseSpaces();
    },
        [purchaseSpacesTrigger]
    );    
    
    useEffect(() => {
        const asyncImageUpload = async () => {
            let keys = ["img", "spaces", "init_x", "init_y", "frame", "owners", "mints", "editable"];
            if (checkKeys(imgUploadTrigger, keys) && wallet.publicKey) {
                let image = imgUploadTrigger["img"];
                const spaces = imgUploadTrigger["spaces"];
                const init_x = imgUploadTrigger["init_x"];
                const init_y = imgUploadTrigger["init_y"];
                const frame = imgUploadTrigger["frame"];
                const owners = imgUploadTrigger["owners"];
                const mints = imgUploadTrigger["mints"];
                const editable = imgUploadTrigger["editable"];

                const spaceGrid = ownedSpaces;

                let changes: any[] = [];

                let neighborhoods = server.getNeighborhoods(spaces);
                let numFramesMap = {};
                let frameKeysMap = {};
                let n_frames = -1;
                if (frame === -1){
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
                }
                else{
                    frameKeysMap = await server.getFrameKeys(connection, neighborhoods, frame);
                }
                const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);

                // run through spaces, get all nbdhoods
                // do getmultacctinfo
                // cache in local dict

                for (let i = 0; i < image.length; ++i) {
                    for (let j = 0; j < image[0].length; ++j){
                        const x = init_x+j;
                        const y = init_y+i;
                        const s = JSON.stringify({x, y});
                        if ( spaces.has(s) && ((frame !== -1 && editable.has(s)) || (frame === -1 && spaceGrid.has(s))) ) {
                            const r = image[i][j][0];
                            const g = image[i][j][1];
                            const b = image[i][j][2];
                            
                            const n_x = Math.floor(x / NEIGHBORHOOD_SIZE); // filter out same color
                            const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                            const p_y = ((y % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
                            const p_x = ((x % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
                            const nhood = JSON.stringify({n_x, n_y});
                            if (frame !== -1 && game.current?.viewport.neighborhoodColors[nhood][p_y][p_x] === rgbToHex(r, g, b)) { // same color
                                continue;
                            }

                            let owner, mint;
                            if (Object.keys(owners).length > 0 && owners[s] && mints[s]) {
                                owner = owners[s];
                                mint = mints[s];
                            } else { // if owners is null, db is down
                                owner = user;
                                mint = DEFAULT_MINT;
                            }

                            if (frame === -1){  
                                n_frames = numFramesMap[JSON.stringify({n_x, n_y})];
                                for (let frame_i = 0; frame_i < n_frames; frame_i++){
                                    changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, mint, owner}));
                                }
                            }
                            else{
                                let change = new ChangeColorArgs({x, y, frame, r, g, b, mint, owner});
                                changes.push(change);
                            }
                        }
                    }
                }
                if (changes.length === 0) { // if empty
                    notify({
                        message: "All spaces already have the selected color",
                    });
                    return;
                }

                try {
                    notify({
                        message: "Uploading image...",
                    });
                    let ixs = await changeColorInstructions(connection, server, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color", true, n_frames);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncImageUpload();
    },
        [imgUploadTrigger]
    );

    useEffect(() => {
        const asyncGifUpload = async () => {
            let keys = ["gif", "spaces", "init_x", "init_y", "owners", "mints", "editable"]
            let gif = gifUploadTrigger["gif"];
            const spaces = gifUploadTrigger["spaces"];
            const init_x = gifUploadTrigger["init_x"];
            const init_y = gifUploadTrigger["init_y"];
            const owners = gifUploadTrigger["owners"];
            const mints = gifUploadTrigger["mints"];
            const editable = gifUploadTrigger["editable"];
            if (checkKeys(gifUploadTrigger, keys) && wallet.publicKey) {

                // console.log("GIF Length", gif.length)

                const spaceGrid = ownedSpaces;

                // let clusters_expl: any = {};
                let n_x;
                let n_y;

                let changes: any[] = [];

                let neighborhoods = server.getNeighborhoods(spaces);
                let {numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods);
                const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);

                let n_frames = -1;
                for (let i = 0; i < gif[0].length; ++i) {
                    for (let j = 0; j < gif[0][0].length; ++j){
                        const x = init_x+j;
                        const y = init_y+i;

                        const s = JSON.stringify({x, y});
                        if (spaces.has(s) && editable.has(s)) {
                            let owner, mint;
                            if (Object.keys(owners).length > 0 && owners[s] && mints[s]) {
                                owner = owners[s];
                                mint = mints[s];
                            } else { // if owners is null, db is down
                                owner = user;
                                mint = DEFAULT_MINT;
                            }

                            // To get num frames
                            n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                            n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                            // n_frames = await getNumFrames(n_x, n_y, clusters_expl);
                            // clusters_expl[ JSON.stringify({n_x, n_y}) ] = n_frames;

                            n_frames = Math.min(gif.length, numFramesMap[JSON.stringify({n_x, n_y})]);
                            for (let frame = 0; frame < n_frames; frame++) {
                                let r: number = gif[frame][i][j][0];
                                let g: number = gif[frame][i][j][1];
                                let b: number = gif[frame][i][j][2];
                                
                                changes.push(new ChangeColorArgs({x, y, frame, r, g, b, mint, owner}));
                            }
                        }
                    }
                }

                try {
                    let ixs = await changeColorInstructions(connection, server, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color", true, n_frames);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }

            }
        }
        asyncGifUpload();
    },
        [gifUploadTrigger]
    );

    useEffect(() => {
        const asyncSetNewNeighborhood = async() => {
            let keys = ["n_x", "n_y", "address", "name", "voucherLiveDate", "voucherReceiveLimit", "voucherPriceCoefficient", "captcha"];
            if (checkKeys(newNeighborhoodTrigger, keys) && wallet.publicKey && anchorWallet?.publicKey) {
                loading(null, "Expanding", null);
                try {
                    
                    const candyMachineConfig = newNeighborhoodTrigger["address"];
                    const uuid = newNeighborhoodTrigger["address"].toBase58().slice(0, 6);
                    const [candyMachineAddress, bump] = (await PublicKey.findProgramAddress(
                        [
                            Buffer.from("candy_machine"), 
                            candyMachineConfig.toBuffer(), 
                            Buffer.from(uuid)
                        ], CANDY_MACHINE_PROGRAM_ID
                    ));
                    const n_x = newNeighborhoodTrigger["n_x"];
                    const n_y = newNeighborhoodTrigger["n_y"];

                    const initNeighborhoodMetadataIx = (await initNeighborhoodMetadataInstruction(
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        1,
                        candyMachineConfig,
                        candyMachineAddress,
                        newNeighborhoodTrigger["name"],
                        newNeighborhoodTrigger["voucherLiveDate"],
                        newNeighborhoodTrigger["voucherReceiveLimit"],
                        newNeighborhoodTrigger["voucherPriceCoefficient"] * 1000000000, // stored onchain as u64 preserving 9 decimal places
                    ))[0];

                    const initVoucherSystemIx = (await initVoucherSystemInstruction(
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        VOUCHER_MINT_AUTH,
                    ))[0];

                    const voucherMint = (await PublicKey.findProgramAddress(
                        [
                        BASE.toBuffer(),
                        Buffer.from(VOUCHER_MINT_SEED),
                        Buffer.from(signedIntToBytes(n_x)),
                        Buffer.from(signedIntToBytes(n_y))
                        ],
                        SPACE_PROGRAM_ID
                    ))[0];
                    const voucherSink = (await PublicKey.findProgramAddress(
                        [
                            BASE.toBuffer(),
                            Buffer.from(VOUCHER_SINK_SEED),
                            Buffer.from(signedIntToBytes(n_x)),
                            Buffer.from(signedIntToBytes(n_y))
                        ],
                        SPACE_PROGRAM_ID
                    ))[0];

                    const provider = new anchor.Provider(connection, anchorWallet, {
                        preflightCommitment: "recent",
                    });
                    const idl = await anchor.Program.fetchIdl(CANDY_MACHINE_PROGRAM_ID, provider);
                    const program = new anchor.Program(idl, CANDY_MACHINE_PROGRAM_ID, provider);
                    let initalizeCandyMachineIx = await program.instruction.initializeCandyMachine(
                        bump,
                        {
                        uuid: uuid,
                        price: new anchor.BN(1),
                        itemsAvailable: new anchor.BN(40000),
                        goLiveDate: null,
                        // requireCreatorSignature: requireCreatorSignature,
                        },
                        {
                        accounts: {
                            candyMachine: candyMachineAddress,
                            wallet: voucherSink,
                            config: candyMachineConfig,
                            authority: wallet.publicKey,
                            payer: wallet.publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                        },
                        signers: [],
                        remainingAccounts: [{
                            pubkey: voucherMint,
                            isWritable: false,
                            isSigner: false,
                        }],
                        }
                    );

                    let updateCandyMachineIx = await program.instruction.updateCandyMachine(
                        null,
                        new anchor.BN(Date.now() / 1000), // now
                        // requireCreatorSignature ? requireCreatorSignature : null,
                        {
                        accounts: {
                            candyMachine: candyMachineAddress,
                            authority: wallet.publicKey,
                        },
                        }
                    );

                    const colorRes = await createColorClusterInstruction(
                        connection,
                        wallet
                    );

                    let createColorClusterIx = colorRes.ix[0];

                    const timeRes = await createTimeClusterInstruction(
                        connection,
                        wallet
                    );

                    let createTimeClusterIx = timeRes.ix[0];
                
                    const initializeFrameIx = (await initFrameInstruction(
                        connection,
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        colorRes.keypair.publicKey,
                        timeRes.keypair.publicKey,
                    ))[0];
                    
                    /*
                    temporary code to deal with the instructions not fitting in one transaction,
                    so create clusters first in a separate transaction.
                    */
                    let createClustersTX = new Transaction();
                    createClustersTX.feePayer = wallet.publicKey;
                    createClustersTX.add(createColorClusterIx);
                    createClustersTX.add(createTimeClusterIx);
                    createClustersTX.recentBlockhash = (await connection.getRecentBlockhash("singleGossip")).blockhash;
                    createClustersTX.partialSign(colorRes.keypair);
                    createClustersTX.partialSign(timeRes.keypair);
                    if (wallet.signTransaction) {
                        createClustersTX = await wallet.signTransaction(createClustersTX);
                    }
                    await sendSignedTransaction({
                        connection,
                        signedTransaction: createClustersTX,
                    });

                    sleep(20000);

                    let colorClusterData = await connection.getAccountInfo(colorRes.keypair.publicKey);
                    let timeClusterData = await connection.getAccountInfo(timeRes.keypair.publicKey);
                    while(!colorClusterData || !timeClusterData){
                        sleep(5000);
                        colorClusterData = await connection.getAccountInfo(colorRes.keypair.publicKey);
                        timeClusterData = await connection.getAccountInfo(timeRes.keypair.publicKey);
                    }

                    /*
                    end temporary code to deal with the instructions not fitting in one transaction
                    */

                    let NeighborhoodTx = new Transaction();
                    NeighborhoodTx.feePayer = wallet.publicKey;

                    NeighborhoodTx.add(initNeighborhoodMetadataIx);
                    NeighborhoodTx.add(initVoucherSystemIx);
                    NeighborhoodTx.add(initalizeCandyMachineIx);
                    NeighborhoodTx.add(updateCandyMachineIx);
                    // NeighborhoodTx.add(createColorClusterIx);
                    // NeighborhoodTx.add(createTimeClusterIx);
                    NeighborhoodTx.add(initializeFrameIx);



                    NeighborhoodTx.recentBlockhash = (await connection.getRecentBlockhash("singleGossip")).blockhash;
                    
                    let data = {
                        response: newNeighborhoodTrigger["captcha"],
                        transaction: NeighborhoodTx.serialize({ requireAllSignatures: false })
                    }
                    
                    let res = await axios.post(CAPTCHA_VERIFY_URL, data);
                    if (!res.data.success) {
                        return;
                    }

                    NeighborhoodTx = Transaction.from(res.data.transaction.data);

                    // NeighborhoodTx.partialSign(colorRes.keypair);
                    // NeighborhoodTx.partialSign(timeRes.keypair);
                    
                    if (wallet.signTransaction) {
                        NeighborhoodTx = await wallet.signTransaction(NeighborhoodTx);
                    }
                    await sendSignedTransaction({
                        connection,
                        signedTransaction: NeighborhoodTx,
                    });
                    notify({ message: `Expand succeeded` });

                } catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                }
                loading(null, "Expanding", "success");
                    
            }
                
        }
        asyncSetNewNeighborhood();
    },
        [newNeighborhoodTrigger]
    );

    useEffect(() => {
        const asyncAddNewFrame = async () => {
            let keys = ["n_x", "n_y"];
            if (checkKeys(newFrameTrigger, keys) && wallet.publicKey) {
                try {
                    const n_x = newFrameTrigger["n_x"];
                    const n_y = newFrameTrigger["n_y"];
                    const colorRes = await createColorClusterInstruction(
                        connection,
                        wallet
                    );

                    const timeCluster = await server.getTimeClusterAcc(connection, n_x, n_y);
                
                    const frameIx = await initFrameInstruction(
                        connection,
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        colorRes.keypair.publicKey,
                        timeCluster
                    );

                    await sendTransaction(
                        connection,
                        wallet,
                        [...colorRes.ix, ...frameIx],
                        "Initialize frame",
                        [colorRes.keypair]
                    );
                } catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                }
            }
        }
        asyncAddNewFrame();
    },
        [newFrameTrigger]
    );

    useEffect(() => {
        const asyncUpdateNeighborhoodMetadata = async() => {
            let keys = ["n_x", "n_y", "name", "voucherLiveDate", "voucherReceiveLimit", "voucherPriceCoefficient"];
            if (checkKeys(updateNeighborhoodMetadataTrigger, keys) && wallet.publicKey) {
                const {n_x, n_y, name, voucherLiveDate, voucherReceiveLimit, voucherPriceCoefficient} = updateNeighborhoodMetadataTrigger;
                try {
                    let ix = await updateNeighborhoodMetadataInstruction(
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        name,
                        voucherLiveDate,
                        voucherReceiveLimit,
                        voucherPriceCoefficient * 1000000000,
                    );
                    sendTransaction(connection, wallet, ix, "Update neighborhood metadata");
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncUpdateNeighborhoodMetadata();
    },
        [updateNeighborhoodMetadataTrigger]
    );

    useEffect(() => {
        const asyncChangeRent = async() => {
            const price = changeRentTrigger["price"];
            const create = changeRentTrigger["create"];
            if (price !== undefined && (price || !create) && wallet.publicKey) {
                const x = changeRentTrigger["x"];
                const y = changeRentTrigger["y"];
                const min_duration = changeRentTrigger["min_duration"];
                const max_duration = changeRentTrigger["max_duration"];
                const max_timestamp = changeRentTrigger["max_timestamp"];
                const mint = changeRentTrigger["mint"];
                try {
                    let change = new SetRentArgs({x, y, mint, price, min_duration, max_duration, max_timestamp, create});
                    let ix = await setRentInstruction(wallet, BASE, change);
                    let name = "Set rent";
                    if (!create) {
                        name = "Delist rent";
                    }
                    const response = await sendTransaction(connection, wallet, ix, name);
                    // console.log(response);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncChangeRent();
    },
        [changeRentTrigger]
    );

    useEffect(() => {
        const asyncChangeRents = async() => {
            const price = changeRentsTrigger["price"];
            const create = changeRentsTrigger["create"];
            const spaces = changeRentsTrigger["spaces"];
            if (price !== undefined && (price || !create) && wallet.publicKey && spaces) {

                const min_duration = changeRentsTrigger["min_duration"];
                const max_duration = changeRentsTrigger["max_duration"];
                const max_timestamp = changeRentsTrigger["max_timestamp"];
                let changes: SetRentArgs[] = [];
                const spaceGrid = ownedSpaces;
                for (let space of spaces){
                    if (spaceGrid.has(space)) {
                        let p = JSON.parse(space);
                        const x = p.x;
                        const y = p.y;
                        const mint = ownedMints[space];
                        let change = new SetRentArgs({x, y, mint, price, min_duration, max_duration, max_timestamp, create});
                        changes.push(change);
                    }
                }
                try{
                    let ixs = await setRentInstructions(wallet, BASE, changes);
                    let name = "Set rent"
                    if (!create) {
                        name = "Delist rent"
                    }
                    sendInstructionsGreedyBatch(connection, wallet, ixs, name);
                }
                catch (e) {
                    notify({ message: `Unexpected error, please try again later` });
                    console.error(e);
                    return;
                }
            }
        }
        asyncChangeRents();
    },
        [changeRentsTrigger]
    );

    useEffect(() => {
        const asyncAcceptRent = async() => {
            let price = acceptRentTrigger["price"];
            if (price) {
                if (wallet.publicKey) {
                    let currentUser = wallet.publicKey;
                    const x = acceptRentTrigger["x"];
                    const y = acceptRentTrigger["y"];
                    const rent_time = acceptRentTrigger["rent_time"];
                    const renter = acceptRentTrigger["owner"];
                    const position = JSON.stringify({x, y});
                    const mint = acceptRentTrigger["mint"];
                    try {
                        let change = new AcceptRentArgs({x, y, mint, price, rent_time, renter});
                        let ix = await acceptRentInstruction(server, connection, wallet, BASE, change);
                        const response = await sendTransaction(connection, wallet, ix, "Rent space");
                        // if (response) {
                        //     let finalOwnedSpaces = new Set(ownedSpaces);
                        //     let newOwnedMints = {};
                        //     finalOwnedSpaces.add(position);
                        //     newOwnedMints[position] = mint;
                        //     // refresh focus if not changed
                        //     const focus = game.current?.state.focus;
                        //     if (focus && focus.focus && focus.x === x && focus.y === y){
                        //         game.current?.refreshFocus();
                        //     }
                        //     // if wallet is unchanged, update state
                        //     if (wallet.publicKey === currentUser){
                        //         setOwnedSpaces(finalOwnedSpaces);
                        //         setOwnedMints({...ownedMints, ...newOwnedMints});
                        //     }
                        //     database.register(wallet.publicKey, newOwnedMints);
                        // }
                    }
                    catch (e) {
                        notify({ message: `Unexpected error, please try again later` });
                        console.error(e);
                        return;
                    }
                } else { // user isn't logged in
                    notify({ message: "Not logged in" });
                }
            }
        }
        asyncAcceptRent();
    },
        [acceptRentTrigger]
    );

    useEffect(() => {
        const asyncAcceptRents = async() => {
            if (acceptRentsTrigger["rentableInfo"]) {
                if (wallet.publicKey) {
                    // let currentUser = wallet.publicKey;
                    const rent_time = acceptRentsTrigger["rent_time"];
                    let changes = acceptRentsTrigger["rentableInfo"].map(x => new AcceptRentArgs({...x, rent_time}));

                    try {
                        let ixs = await acceptRentInstructions(server, connection, wallet, BASE, changes);
                        await sendInstructionsGreedyBatch(connection, wallet, ixs, "Rent spaces");
                        // let responses = inter.responses;
                        // let ixPerTx = inter.ixPerTx;
                        // let ind = 0;
                        // let finalOwnedSpaces = new Set(ownedSpaces);
                        // let newOwnedMints = {};
                        // for (let i = 0; i < responses.length; i++) {
                            
                        //     if (i !== 0) {
                        //         ind += ixPerTx[i-1];
                        //     }

                        //     if (responses[i]) {
                        //         for (let j = 0; j < ixPerTx[i]; j++) {
                        //             let x = changes[ind+j].x;
                        //             let y = changes[ind+j].y;
                        //             let mint = changes[ind+j].mint;
                        //             let position = JSON.stringify({x, y});
                        //             finalOwnedSpaces.add(position);
                        //             newOwnedMints[position] = mint;
                        //         }
                        //     }
                        // }
                        // // if wallet is unchanged, update state
                        // if (wallet.publicKey === currentUser){
                        //     setOwnedSpaces(finalOwnedSpaces);
                        //     setOwnedMints({...ownedMints, ...newOwnedMints});
                        // }
                        // database.register(wallet.publicKey, newOwnedMints);
                    }
                    catch (e) {
                        notify({ message: `Unexpected error, please try again later` });
                        console.error(e);
                        return;
                    }
                } else { // user isn't logged in
                    notify({ message: "Not logged in" });
                }
            }
        }
        asyncAcceptRents();
    },
        [acceptRentsTrigger]
    );    

    return (
        <Game
            ref={game}
            ownedSpaces={ownedSpaces}
            loadedOwned={loadedOwned}
            user={user}
            viewer={viewer}
            connection={connection}
            setOwnedSpaces={setOwnedSpaces}
            setOwnedMints={setOwnedMints}
            setChangeColorTrigger={setChangeColorTrigger}
            setChangeColorsTrigger={setChangeColorsTrigger}
            setMakeEditableColorTrigger={setMakeEditableColorTrigger}
            setMakeEditableColorsTrigger={setMakeEditableColorsTrigger}
            setChangePriceTrigger={setChangePriceTrigger}
            setChangePricesTrigger={setChangePricesTrigger}
            setPurchaseSpaceTrigger={setPurchaseSpaceTrigger}
            setPurchaseSpacesTrigger={setPurchaseSpacesTrigger}
            setRegisterTrigger={setRegisterTrigger}
            setImgUploadTrigger={setImgUploadTrigger}
            setGifUploadTrigger={setGifUploadTrigger}
            setNewNeighborhoodTrigger={setNewNeighborhoodTrigger}
            setUpdateNeighborhoodMetadataTrigger={setUpdateNeighborhoodMetadataTrigger}
            setNewFrameTrigger={setNewFrameTrigger}
            setChangeRentTrigger={setChangeRentTrigger}
            setChangeRentsTrigger={setChangeRentsTrigger}
            setAcceptRentTrigger={setAcceptRentTrigger}
            setAcceptRentsTrigger={setAcceptRentsTrigger}
            setCheckInboxTrigger={setCheckInboxTrigger}
            setCheckGlobalTrigger={setCheckGlobalTrigger}
            setMessageOpenTrigger={setMessageOpenTrigger}
            setSendMessageTrigger={setSendMessageTrigger}
            inboxMessage={inboxMessage}
            globalMessage={globalMessage}
            locator={props.locator}
            database={database}
            server={server}
            >
        </Game>
    );
}