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
    createTimeClusterInstruction,
    initFrameInstruction,
    initVoucherSystemInstruction,
    SetRentArgs,
    setRentInstruction,
    setRentInstructions,
    AcceptRentArgs,
    acceptRentInstruction,
    acceptRentInstructions,
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
    const [changeRentTrigger, setChangeRentTrigger] = useState({});
    const [changeRentsTrigger, setChangeRentsTrigger] = useState({});
    const [acceptRentTrigger, setAcceptRentTrigger] = useState({});
    const [acceptRentsTrigger, setAcceptRentsTrigger] = useState({});
    const [viewer, setViewer] = useState(0);

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
        const interval = setInterval(refreshUser, 5 * 60 * 1000); // refresh timestamp for user
        return () => {
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        const getTokens = async () => {
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
                        // console.log(e);
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
            if (color && wallet.publicKey) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                const x = changeColorTrigger["x"];
                const y = changeColorTrigger["y"];
                const frame = changeColorTrigger["frame"];
                const position = JSON.stringify({x, y});

                const mint = changeColorTrigger["mint"];
                const owner = changeColorTrigger["owner"];
                let changes: ChangeColorArgs[] = [];

                let numFramesMap = {};
                let frameKeysMap = {};
                let n_frames = -1;
                let neighborhoods = server.getNeighborhoods([position]);
                const timeClusterMap = await server.getEditableTimeClusterKeys(connection, neighborhoods);
                if (frame === -1){
                    ({numFramesMap, frameKeysMap} = await server.getAllFrameKeys(connection, neighborhoods));
                    let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                    let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);

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
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color", true, n_frames);
                }
                catch (e) {
                    // console.log(e)
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
            const owners = changeColorsTrigger["owners"];

            if (color && wallet.publicKey) {
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
                    if (spaceGrid.has(s)) {
                        let p = JSON.parse(s);
                        const x = p.x;
                        const y = p.y;
                        const mint = ownedMints[s];
                        let owner;
                        if (Object.keys(owners).length > 0) {
                            owner = owners[s];
                        } else { // if owners is null, db is down
                            owner = user;
                        }

                        if (frame === -1){
                            let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                            let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                            
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
                try {
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change colors", true, n_frames);
                }
                catch (e) {
                    // console.log(e)
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
            const create = changePriceTrigger["create"];
            if ((price || !create) && wallet.publicKey) {
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
            const create = changePricesTrigger["create"];
            const spaces = changePricesTrigger["spaces"];
            if ((price || !create) && wallet.publicKey && spaces) {

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
            let price = purchaseSpaceTrigger["price"];
            if (price) {
                if (wallet.publicKey) {
                    let currentUser = wallet.publicKey;
                    const x = purchaseSpaceTrigger["x"];
                    const y = purchaseSpaceTrigger["y"];
                    const bob = purchaseSpaceTrigger["owner"];
                    const position = JSON.stringify({x, y});
                    const mint = purchaseSpaceTrigger["mint"];
                    try {
                        let change = new AcceptOfferArgs({x, y, mint: mint, price, seller: bob});
                        let ix = await acceptOfferInstruction(server, connection, wallet, BASE, change);
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
                        return;
                    }
                } else { // user isn't logged in
                    notify({ message: "Not logged in" });
                }
            }
        }
        asyncPurchaseSpace();
    },
        [purchaseSpaceTrigger]
    );

    useEffect(() => {
        const asyncPurchaseSpaces = async() => {
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
                        return;
                    }
                } else { // user isn't logged in
                    notify({ message: "Not logged in" });
                }
            }
        }
        asyncPurchaseSpaces();
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
            const owners = imgUploadTrigger["owners"];
            if (image && wallet.publicKey) {
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
                        const position = JSON.stringify({x, y});
                        if (spaces.has(position) && spaceGrid.has(position)) {
                            const r = image[i][j][0];
                            const g = image[i][j][1];
                            const b = image[i][j][2];
                            const mint = ownedMints[position];
                            let owner;
                            if (Object.keys(owners).length > 0) {
                                owner = owners[position];
                            } else { // if owners is null, db is down
                                owner = user;
                            }

                            if (frame === -1){
                                let n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                                let n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                                
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
                try {
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color", true, n_frames);
                }
                catch (e) {
                    // console.log(e)
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
            const owners = gifUploadTrigger["owners"];
            if (gif && wallet.publicKey) {

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

                        const position = JSON.stringify({x, y});
                        if (spaces.has(position) && spaceGrid.has(position)) {
                            const mint = ownedMints[position];
                            let owner;
                            if (Object.keys(owners).length > 0) {
                                owner = owners[position];
                            } else { // if owners is null, db is down
                                owner = user;
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
                    let ixs = await changeColorInstructions(connection, wallet, BASE, changes, frameKeysMap, timeClusterMap);
                    sendInstructionsGreedyBatch(connection, wallet, ixs, "change color", true, n_frames);
                }
                catch (e) {
                    // console.log(e)
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
                    // console.log("failed to expand: ", e);
                    notify({ message: `Expand failed` });
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
            if (wallet.publicKey && ("n_x" in newFrameTrigger)) {
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
                    // console.log("failed to add new frame", e)
                }
            }
        }
        asyncAddNewFrame();
    },
        [newFrameTrigger]
    );

    useEffect(() => {
        const asyncChangeRent = async() => {
            const price = changeRentTrigger["price"];
            const create = changeRentTrigger["create"];
            if ((price || !create) && wallet.publicKey) {
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
                    sendTransaction(connection, wallet, ix, name);
                }
                catch (e) {
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
            if ((price || !create) && wallet.publicKey && spaces) {

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
                        //         game.current?.handleFocusRefresh();
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
            setChangePriceTrigger={setChangePriceTrigger}
            setChangePricesTrigger={setChangePricesTrigger}
            setPurchaseSpaceTrigger={setPurchaseSpaceTrigger}
            setPurchaseSpacesTrigger={setPurchaseSpacesTrigger}
            setRegisterTrigger={setRegisterTrigger}
            setImgUploadTrigger={setImgUploadTrigger}
            setGifUploadTrigger={setGifUploadTrigger}
            setNewNeighborhoodTrigger={setNewNeighborhoodTrigger}
            setNewFrameTrigger={setNewFrameTrigger}
            setChangeRentTrigger={setChangeRentTrigger}
            setChangeRentsTrigger={setChangeRentsTrigger}
            setAcceptRentTrigger={setAcceptRentTrigger}
            setAcceptRentsTrigger={setAcceptRentsTrigger}
            locator={props.locator}
            database={database}
            server={server}
            >
        </Game>
    );
}