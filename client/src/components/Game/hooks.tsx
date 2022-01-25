import {useEffect, useRef, useState} from "react";
import {Game} from "./index"
import {useAnchorWallet, useWallet} from "@solana/wallet-adapter-react";
import {useConnection} from "../../contexts";
import {PublicKey, Transaction} from "@solana/web3.js";
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
    InitFrameInstruction,
    initVoucherSystemInstruction
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
} from "../../constants";
import {Server} from "./server.js";
import {Database} from "./database.js";
import {notify, loading} from "../../utils";
import {twoscomplement_i2u} from "../../utils/borsh"
import * as anchor from "@project-serum/anchor";
import {sleep} from "../../utils";

const axios = require('axios');


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
    const [changePriceTrigger, setChangePriceTrigger] = useState({});
    const [changePricesTrigger, setChangePricesTrigger] = useState({});
    const [purchaseSpaceTrigger, setPurchaseSpaceTrigger] = useState({});
    const [purchaseSpacesTrigger, setPurchaseSpacesTrigger] = useState({});
    const [imgUploadTrigger, setImgUploadTrigger] = useState({});
    const [gifUploadTrigger, setGifUploadTrigger] = useState({});
    const [registerTrigger, setRegisterTrigger] = useState(false);
    const [registerAccs, setRegisterAccs] = useState<{}>();
    const [registerMints, setRegisterMints] = useState<{}>();
    const [newNeighborhoodTrigger, setNewNeighborhoodTrigger] = useState<any>({});
    const [newFrameTrigger, setNewFrameTrigger] = useState<any>({});
    const [viewer, setViewer] = useState(0);

    const game = useRef<Game>(null);
    const crypto = require("crypto");

    const getId = () => {
        const currId = localStorage.getItem("id");
        if (currId !== null) {
            return currId;
        } 
        const id = crypto.randomBytes(20).toString('hex');
        console.log("New", id)
        localStorage.setItem("id", id);
        return id;
    }

    const pullNumViewers = async() => {
        const numViewers = await database.getNumViewers();
        setViewer(numViewers);
    }

    useEffect(() => {
        const cleanup = async () => {
            if (document.visibilityState === "hidden") {
                await database.disconnectNew(getId());
            } else if (document.visibilityState === "visible") {
                const viewers = await database.connectNew(getId());
                setViewer(viewers);
            }
        }
        const getViewer = async () => {
            const viewers = await database.connectNew(getId());
            setViewer(viewers);
            document.addEventListener('visibilitychange', cleanup);
        }
        const unMount = () => {
            database.disconnectNew(getId());
            mounted.current = false;
            document.removeEventListener('visibilitychange', cleanup);
        }
        getViewer();
        return unMount();
    }, []);

    useEffect(() => {
        const interval = setInterval(pullNumViewers, 30000); // update numviewers live
        return () => {
            clearInterval(interval);
        };
    }, []);
    

    useEffect(() => {
        const getTokens = async () => {
            setUser(wallet.publicKey ? wallet.publicKey : undefined);
            if (!wallet.publicKey) { // if wallet is disconnected, set address to null 
                server.setAddress(null); 
            }
            if (!wallet.disconnecting && wallet.publicKey && user === wallet.publicKey) {
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
                }
            }
        }
        getTokens();
    },
        [wallet, user]
    );

    useEffect(() => {
        const asyncRegisterAll = async () => {
            if (wallet.publicKey && registerTrigger) {
                let totalAccs = {};
                let totalMints = {};
                if (registerAccs == null || registerMints == null) { // whether we need to look through all account infos
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
                        const space_x = twoscomplement_i2u(pos.x);
                        const space_y = twoscomplement_i2u(pos.y);
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
                    console.log("Accounts", accs.length)
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
                console.log("Need to register", numRegistering)

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
                        
                        console.log("Total accs remaining after register", Object.keys(totalAccs).length)
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
                        console.log(e);
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
            const color = changeColorTrigger["color"];
            if (color != null && wallet.publicKey) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                const x = changeColorTrigger["x"];
                const y = changeColorTrigger["y"];
                const frame = changeColorTrigger["frame"];
                const position = JSON.stringify({x, y});

                const spaceMint = changeColorTrigger["mint"];
                let changes: ChangeColorArgs[] = [];

                let numFramesMap = {};
                let frameKeysMap = {};
                if (frame == -1){
                    let neighborhoods = server.getNeighborhoods([position]);
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
                    let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                    let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);

                    let n_frames = numFramesMap[JSON.stringify({n_x, n_y})];
                    for (let frame_i = 0; frame_i < n_frames; frame_i++){
                        changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, spaceMint}));
                    }
                }
                else{
                    let change = new ChangeColorArgs({x, y, frame, r, g, b, spaceMint});
                    changes.push(change);
                }
                try {
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color");
                }
                catch (e) {
                    console.log(e)
                    return;
                }
            }
        }
        asyncChangeColor();
    },
        [changeColorTrigger]
    );

    useEffect(() => {
        const asyncChangeColors = async () => {
            let changes: ChangeColorArgs[] = [];
            const color = changeColorsTrigger["color"];
            const spaces = changeColorsTrigger["spaces"];
            const frame = changeColorsTrigger["frame"];

            if (color != null && wallet.publicKey) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                
                const spaceGrid = ownedSpaces;
                let n_x;
                let n_y;

                let neighborhoods = server.getNeighborhoods(spaces);
                let numFramesMap = {};
                let frameKeysMap = {};
                if (frame == -1){
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
                }
                else{
                    frameKeysMap = await server.getFrameKeys(connection, neighborhoods, frame);
                }

                for (const s of spaces) {
                    if (spaceGrid.has(s)) {
                        let p = JSON.parse(s);
                        const x = p.x;
                        const y = p.y;
                        const spaceMint = ownedMints[s];

                        if (frame == -1){
                            let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                            let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                            
                            for (let frame_i = 0; frame_i < numFramesMap[JSON.stringify({n_x, n_y})]; frame_i++){
                                changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, spaceMint}));
                            }
                        }
                        else{
                            let change = new ChangeColorArgs({x, y, frame, r, g, b, spaceMint});
                            changes.push(change);
                        }
                    }
                }
                try {
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change colors");
                }
                catch (e) {
                    console.log(e)
                    return;
                }
            }
        }
        asyncChangeColors();
    },
        [changeColorsTrigger]
    );

    useEffect(() => {
        const asyncSetPrice = async() => {
            const price = changePriceTrigger["price"];
            const delist = changePriceTrigger["delist"];
            if ((price || delist) && wallet.publicKey) {
                const x = changePriceTrigger["x"];
                const y = changePriceTrigger["y"];
                const position = JSON.stringify({x, y});
                const spaceMint = changePriceTrigger["mint"];
                try {
                    let change = new ChangeOfferArgs({x, y, mint: spaceMint, price, create: !delist});
                    let ix = await changeOfferInstruction(wallet, BASE, change);
                    let name = "Set space price"
                    if (delist) {
                        name = "Delist"
                    }
                    sendTransaction(connection, wallet, ix, name);
                }
                catch (e) {
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
            const price = changePricesTrigger["price"];
            const delist = changePricesTrigger["delist"];
            const spaces = changePricesTrigger["spaces"];
            if ((price || delist) && wallet.publicKey) {

                let changes: ChangeOfferArgs[] = [];
                const spaceGrid = ownedSpaces;
                for (let space of spaces){
                    if (spaceGrid.has(space)) {
                        let p = JSON.parse(space);
                        const x = p.x;
                        const y = p.y;
                        const spaceMint = ownedMints[space];
                        let change = new ChangeOfferArgs({x, y, mint: spaceMint, price, create: !delist});
                        changes.push(change);
                    }
                }
                try{
                    let ixs = await changeOfferInstructions(wallet, BASE, changes);
                    let name = "Set space prices"
                    if (delist) {
                        name = "Delist"
                    }
                    sendInstructionsGreedyBatch(connection, wallet, ixs, name);
                }
                catch (e) {
                    return;
                }
            }
        }
        asyncSetPrices();
    },
        [changePricesTrigger]
    );

    useEffect(() => {
        const asyncBuySpace = async() => {
            let price = purchaseSpaceTrigger["price"];
            if (price) {
                if (wallet.publicKey) {
                    let currentUser = wallet.publicKey;
                    const x = purchaseSpaceTrigger["x"];
                    const y = purchaseSpaceTrigger["y"];
                    const bob = purchaseSpaceTrigger["owner"];
                    const position = JSON.stringify({x, y});
                    const spaceMint = purchaseSpaceTrigger["mint"];
                    try {
                        let change = new AcceptOfferArgs({x, y, mint: spaceMint, price, seller: bob});
                        let ix = await acceptOfferInstruction(server, connection, wallet, BASE, change);
                        const response = await sendTransaction(connection, wallet, ix, "Buy space");
                        if (response) {
                            let finalOwnedSpaces = new Set(ownedSpaces);
                            let newOwnedMints = {};
                            finalOwnedSpaces.add(position);
                            newOwnedMints[position] = spaceMint;
                            // refresh focus if not changed
                            const focus = game.current?.state.focus;
                            if (focus && focus.focus && focus.x == x && focus.y == y){
                                game.current?.handleFocusRefresh();
                            }
                            // if wallet is unchanged, update state
                            if (wallet.publicKey == currentUser){
                                setOwnedSpaces(finalOwnedSpaces);
                                setOwnedMints({...ownedMints, ...newOwnedMints});
                            }
                            database.register(wallet.publicKey, newOwnedMints);
                        }
                    }
                    catch (e) {
                        return;
                    }
                } else { // user isn't logged in
                    notify({ message: "Not logged in" });
                }
            }
        }
        asyncBuySpace();
    },
        [purchaseSpaceTrigger]
    );

    useEffect(() => {
        const asyncBuySpaces = async() => {
            if (purchaseSpacesTrigger["purchasableInfo"]) {
                if (wallet.publicKey) {
                    let currentUser = wallet.publicKey;
                    let changes = purchaseSpacesTrigger["purchasableInfo"].map(x => new AcceptOfferArgs(x));

                    try {
                        let ixs = await acceptOfferInstructions(server, connection, wallet, BASE, changes);
                        const inter = await sendInstructionsGreedyBatch(connection, wallet, ixs, "Buy spaces");
                        let responses = inter.responses;
                        let ixPerTx = inter.ixPerTx;
                        let ind = 0;
                        let finalOwnedSpaces = new Set(ownedSpaces);
                        let newOwnedMints = {};
                        for (let i = 0; i < responses.length; i++) {
                            
                            if (i != 0) {
                                ind += ixPerTx[i-1];
                            }

                            if (responses[i]) {
                                for (let j = 0; j < ixPerTx[i]; j++) {
                                    let x = changes[ind+j].x;
                                    let y = changes[ind+j].y;
                                    let spaceMint = changes[ind+j].mint;
                                    let position = JSON.stringify({x, y});
                                    finalOwnedSpaces.add(position);
                                    newOwnedMints[position] = spaceMint;
                                }
                            }
                        }
                        // if wallet is unchanged, update state
                        if (wallet.publicKey == currentUser){
                            setOwnedSpaces(finalOwnedSpaces);
                            setOwnedMints({...ownedMints, ...newOwnedMints});
                        }
                        database.register(wallet.publicKey, newOwnedMints);
                    }
                    catch (e) {
                        return;
                    }
                } else { // user isn't logged in
                    notify({ message: "Not logged in" });
                }
            }
        }
        asyncBuySpaces();
    },
        [purchaseSpacesTrigger]
    );    
    
    useEffect(() => {
        const asyncImageUpload = async () => {
            let image = imgUploadTrigger["img"];
            const spaces = imgUploadTrigger["spaces"];
            const init_x = imgUploadTrigger["init_x"];
            const init_y = imgUploadTrigger["init_y"];
            const frame = imgUploadTrigger["frame"];
            if (image != null && wallet.publicKey) {

                const spaceGrid = ownedSpaces;

                let n_x;
                let n_y;

                let changes: any[] = [];

                let neighborhoods = server.getNeighborhoods(spaces);
                let numFramesMap = {};
                let frameKeysMap = {};
                if (frame == -1){
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
                }
                else{
                    frameKeysMap = await server.getFrameKeys(connection, neighborhoods, frame);
                }

                // run through spaces, get all nbdhoods
                // do getmultacctinfo
                // cache in local dict

                for (let i = 0; i < image.length; ++i) {
                    for (let j = 0; j < image[0].length; ++j){
                        const x = init_x+j;
                        const y = init_y+i;
                        const position = JSON.stringify({x, y});
                        if (spaces.has(position) && spaceGrid.has(position)) {
                            const r = image[i][j][0];
                            const g = image[i][j][1];
                            const b = image[i][j][2];
                            const spaceMint = ownedMints[position];
                           
                            if (frame == -1){
                                let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                                let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                                
                                for (let frame_i = 0; frame_i < numFramesMap[JSON.stringify({n_x, n_y})]; frame_i++){
                                    changes.push(new ChangeColorArgs({x, y, frame: frame_i, r, g, b, spaceMint}));
                                }
                            }
                            else{
                                let change = new ChangeColorArgs({x, y, frame, r, g, b, spaceMint});
                                changes.push(change);
                            }
                        }
                    }
                }
                try {
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color");
                }
                catch (e) {
                    console.log(e)
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
            let gif = gifUploadTrigger["gif"];
            const spaces = gifUploadTrigger["spaces"];
            const init_x = gifUploadTrigger["init_x"];
            const init_y = gifUploadTrigger["init_y"];
            if (gif != null && wallet.publicKey) {

                console.log("GIF Length", gif.length)

                const spaceGrid = ownedSpaces;

                // let clusters_expl: any = {};
                let n_x;
                let n_y;

                let changes: any[] = [];

                let neighborhoods = server.getNeighborhoods(spaces);
                let {numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods);

                for (let i = 0; i < gif[0].length; ++i) {
                    for (let j = 0; j < gif[0][0].length; ++j){
                        const x = init_x+j;
                        const y = init_y+i;

                        const position = JSON.stringify({x, y});
                        if (spaces.has(position) && spaceGrid.has(position)) {
                            const spaceMint = ownedMints[position];

                            // To get num frames
                            n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                            n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                            // n_frames = await getNumFrames(n_x, n_y, clusters_expl);
                            // clusters_expl[ JSON.stringify({n_x, n_y}) ] = n_frames;

                            for (let frame = 0; frame < Math.min(gif.length, numFramesMap[JSON.stringify({n_x, n_y})]); frame++) {
                                let r: number = gif[frame][i][j][0];
                                let g: number = gif[frame][i][j][1];
                                let b: number = gif[frame][i][j][2];
                                
                                changes.push(new ChangeColorArgs({x, y, frame, r, g, b, spaceMint}));
                            }
                        }
                    }
                }

                try {
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color");
                }
                catch (e) {
                    console.log(e)
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
            
            if (wallet.publicKey && anchorWallet?.publicKey && ("captcha" in newNeighborhoodTrigger)) {
                try {
                    const candyMachineConfig = newNeighborhoodTrigger["address"];
                    const uuid = newNeighborhoodTrigger["address"].slice(0, 6);
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
                        Buffer.from(twoscomplement_i2u(n_x)),
                        Buffer.from(twoscomplement_i2u(n_y))
                        ],
                        SPACE_PROGRAM_ID
                    ))[0];
                    const voucherSink = (await PublicKey.findProgramAddress(
                        [
                            BASE.toBuffer(),
                            Buffer.from(VOUCHER_SINK_SEED),
                            Buffer.from(twoscomplement_i2u(n_x)),
                            Buffer.from(twoscomplement_i2u(n_y))
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
                
                    const initializeFrameIx = (await InitFrameInstruction(
                        connection,
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        colorRes.keypair.publicKey
                    ))[0];

                    let NeighborhoodTx = new Transaction();
                    NeighborhoodTx.feePayer = wallet.publicKey;

                    NeighborhoodTx.add(initNeighborhoodMetadataIx);
                    NeighborhoodTx.add(initVoucherSystemIx);
                    NeighborhoodTx.add(initalizeCandyMachineIx);
                    NeighborhoodTx.add(updateCandyMachineIx);
                    NeighborhoodTx.add(createColorClusterIx);
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

                    NeighborhoodTx.partialSign(colorRes.keypair);
                    
                    if (wallet.signTransaction) {
                        NeighborhoodTx = await wallet.signTransaction(NeighborhoodTx);
                    }
                    await sendSignedTransaction({
                        connection,
                        signedTransaction: NeighborhoodTx,
                    });
                    notify({ message: `Extend succeeded` });

                } catch (e) {
                    console.log("failed to explore: ", e);
                    notify({ message: `Extend failed` });
                }
                    
            }
                
        }
        asyncSetNewNeighborhood();
    },
        [newNeighborhoodTrigger]
    );

    useEffect(() => {
        const asyncAddNewFrame = async () => {
            if (wallet.publicKey && ("n_x" in newFrameTrigger)) {
                try {
                    const n_x = newFrameTrigger["n_x"];
                    const n_y = newFrameTrigger["n_y"];
                    const colorRes = await createColorClusterInstruction(
                        connection,
                        wallet
                    );
                
                    const frameIx = await InitFrameInstruction(
                        connection,
                        wallet,
                        BASE,
                        n_x,
                        n_y,
                        colorRes.keypair.publicKey
                    );

                    await sendTransaction(
                        connection,
                        wallet,
                        [...colorRes.ix, ...frameIx],
                        "Initialize frame",
                        [colorRes.keypair]
                    );
                } catch (e) {
                    console.log("failed to add new frame", e)
                }
            }
        }
        asyncAddNewFrame();
    },
        [newFrameTrigger]
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
            setChangePriceTrigger={setChangePriceTrigger}
            setChangePricesTrigger={setChangePricesTrigger}
            setPurchaseSpaceTrigger={setPurchaseSpaceTrigger}
            setPurchaseSpacesTrigger={setPurchaseSpacesTrigger}
            setRegisterTrigger={setRegisterTrigger}
            setImgUploadTrigger={setImgUploadTrigger}
            setGifUploadTrigger={setGifUploadTrigger}
            setNewNeighborhoodTrigger={setNewNeighborhoodTrigger}
            setNewFrameTrigger={setNewFrameTrigger}
            locator={props.locator}
            database={database}
            server={server}
            >
        </Game>
    );
}