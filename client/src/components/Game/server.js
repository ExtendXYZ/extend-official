import {PublicKey} from "@solana/web3.js";
import BN from "bn.js";
import {
    BASE,
    COLOR_PROGRAM_ID,
    SPACE_METADATA_SEED,
    SPACE_PROGRAM_ID,
    MAX_ACCOUNTS,
    METADATA_PROGRAM_ID,
    NEIGHBORHOOD_FRAME_BASE_SEED,
    NEIGHBORHOOD_FRAME_POINTER_SEED,
    NEIGHBORHOOD_METADATA_SEED,
    NEIGHBORHOOD_SIZE,
    SELL_DELEGATE_SEED,
    BATCH_LOAD_PRICE_SIZE,
} from "../../constants";
import {TOKEN_PROGRAM_ID} from '@solana/spl-token';
import {decodeMetadata} from "../../actions/metadata";
import {twoscomplement_i2u} from "../../utils/borsh";
import {loading} from '../../utils/loading';

window.frameKeyCache = {};
window.neighborhoodCreatorCache = {};
window.neighborhoodCandyMachineCache = {};
window.myTokens = new Set();

let user = null;

export class Server {
    
    async getNumFrames(connection, n_x, n_y, clusters_expl = {}) {
        let n_frames;
        if (! (JSON.stringify({n_x, n_y}) in clusters_expl)) {
            const n_meta = await PublicKey.findProgramAddress([
                BASE.toBuffer(),
                Buffer.from(NEIGHBORHOOD_FRAME_BASE_SEED),
                Buffer.from(twoscomplement_i2u(n_x)),
                Buffer.from(twoscomplement_i2u(n_y)),
                ], COLOR_PROGRAM_ID
            );
            const account = await connection.getAccountInfo(n_meta[0]);
            if (!account) {
                return -1;
            }
            let buffer = Buffer.from(account.data.slice(1,9));
            
            var result = buffer.readUIntLE(0, 8);
            n_frames = result;
        }
        else {
            n_frames = clusters_expl[JSON.stringify({n_x, n_y})];
        }
        return n_frames;
    };

    // get neighborhoods involving a selection of spaces
    getNeighborhoods(selections){
        let seen = new Set();
        let neighborhoods = [];
        for (let selection of selections) {
            let space = JSON.parse(selection);
            let x = space.x;
            let y = space.y;

            let n_x = Math.floor(x/NEIGHBORHOOD_SIZE);
            let n_y = Math.floor(y/NEIGHBORHOOD_SIZE);
            let n_key = JSON.stringify({n_x, n_y});
            if (!seen.has(n_key)){
                seen.add(n_key);
                neighborhoods.push({n_x, n_y});
            }
        }
        return neighborhoods;
    }

    /*
    For a specific frame, returns a map from n_x, n_y, frame to the public key of the corresponding color cluster
    only frames that exist will be in the map; if a neighborhood doesn't have the corresponding frame, there will be no
    corresponding entry in the map.
    */
    async getFrameKeys(connection, neighborhoods, frame) {
        let frameKeysMap = {};
        let framePointerAccounts = [];
        let neighborhoodsFiltered = [];
        for (const {n_x, n_y} of neighborhoods){ // skip cached frame keys
            let hash = JSON.stringify({n_x, n_y, frame});
            if (hash in window.frameKeyCache){
                frameKeysMap[hash] = window.frameKeyCache[hash];
            }
            else{
                neighborhoodsFiltered.push({n_x, n_y});
            }
        }
        // console.log("cache", window.frameKeyCache);
        neighborhoods = neighborhoodsFiltered;

        for (const {n_x, n_y} of neighborhoods){
            let framePointerAccount = (await PublicKey.findProgramAddress([
                    BASE.toBuffer(),
                    Buffer.from(NEIGHBORHOOD_FRAME_POINTER_SEED),
                    Buffer.from(twoscomplement_i2u(n_x)),
                    Buffer.from(twoscomplement_i2u(n_y)),
                    new BN(frame).toArray('le', 8),
                ], 
                COLOR_PROGRAM_ID
            ))[0];
            framePointerAccounts.push(framePointerAccount);
        }

        const framePointerDatas = await this.batchGetMultipleAccountsInfo(connection, framePointerAccounts);

        for (let i = 0; i < framePointerDatas.length; i++) {
            if (!framePointerDatas[i]){
                continue;
            }
            let n_x = neighborhoods[i].n_x;
            let n_y = neighborhoods[i].n_y;
            let hash = JSON.stringify({n_x, n_y, frame});
            let clusterKey = new PublicKey(framePointerDatas[i].data.slice(1, 33));
            frameKeysMap[hash] = clusterKey;
            window.frameKeyCache[hash] = clusterKey;
        }

        return frameKeysMap;
    }

    /*
    returns maps, one mapping neighborhoods to the number of frames it has, and one mapping
    n_x, n_y, frame to the public key of the color cluster
    */
    async getAllFrameKeys(connection, neighborhoods) {
        let numFramesMap = {};
        let frameKeysMap = {};

        for (const {n_x, n_y} of neighborhoods){
            let numFrames = await this.getNumFrames(connection, n_x, n_y);
            numFramesMap[JSON.stringify({n_x, n_y})] = numFrames;
            
            if (numFrames <= 0){
                continue;
            }

            let frames = [];
            for (let frame = 0; frame < numFrames; ++frame){
                let hash = JSON.stringify({n_x, n_y, frame});
                if (hash in window.frameKeyCache){
                    frameKeysMap[hash] = window.frameKeyCache[hash];
                }
                else{
                    frames.push(frame);
                }
            }
            
            let framePointerAccounts = await Promise.all(
                frames.map( async (frame) => {
                    const key = (await PublicKey.findProgramAddress([
                            BASE.toBuffer(),
                            Buffer.from(NEIGHBORHOOD_FRAME_POINTER_SEED),
                            Buffer.from(twoscomplement_i2u(n_x)),
                            Buffer.from(twoscomplement_i2u(n_y)),
                            new BN(frame).toArray('le', 8),
                        ], 
                        COLOR_PROGRAM_ID
                    ))[0];
                    
                    return key;
                })
            );
            const framePointerDatas = await connection.getMultipleAccountsInfo(framePointerAccounts);
            frames.forEach((frame, i) => {
                let hash = JSON.stringify({n_x, n_y, frame});
                let clusterKey = new PublicKey(framePointerDatas[i].data.slice(1, 33));
                frameKeysMap[hash] = clusterKey;
                window.frameKeyCache[hash] = clusterKey;
            });
        }

        return {numFramesMap, frameKeysMap};
    }

    async getFrameKey(connection, n_x, n_y, frame) {
        const hash = JSON.stringify({n_x, n_y, frame});
        if (hash in window.frameKeyCache) {
            return window.frameKeyCache[hash];
        }
        const n_meta = await PublicKey.findProgramAddress([
                    BASE.toBuffer(),
                    Buffer.from(NEIGHBORHOOD_FRAME_POINTER_SEED),
                    Buffer.from(twoscomplement_i2u(n_x)),
                    Buffer.from(twoscomplement_i2u(n_y)),
                    new BN(frame).toArray('le', 8),
                ], COLOR_PROGRAM_ID
            );
        const account = await connection.getAccountInfo(n_meta[0]);

        if (account === null) {
            return null;
        }
        const colorClusterKey = account.data.slice(1, 33);
        window.frameKeyCache[hash] = new PublicKey(colorClusterKey);
        return window.frameKeyCache[hash];
    }

    async getNeighborhoodCreator(connection, n_x, n_y) {
        const hash = JSON.stringify({n_x, n_y});
        if (hash in window.neighborhoodCreatorCache) {
            return window.neighborhoodCreatorCache[hash];
        }
        const n_meta = await PublicKey.findProgramAddress([
            BASE.toBuffer(),
            Buffer.from(NEIGHBORHOOD_METADATA_SEED),
            Buffer.from(twoscomplement_i2u(n_x)),
            Buffer.from(twoscomplement_i2u(n_y)),
        ], SPACE_PROGRAM_ID);
        const account = await connection.getAccountInfo(n_meta[0]);
        if (account === null) {
            return null;
        }
        const key = account.data.slice(1, 33);
        window.neighborhoodCreatorCache[hash] = new PublicKey(key);
        return window.neighborhoodCreatorCache[hash];
    }

    async getNeighborhoodCandyMachine(connection, n_x, n_y) {
        const hash = JSON.stringify({n_x, n_y});
        if (hash in window.neighborhoodCandyMachineCache) {
            return window.neighborhoodCandyMachineCache[hash];
        }
        const n_meta = await PublicKey.findProgramAddress([
            BASE.toBuffer(),
            Buffer.from(NEIGHBORHOOD_METADATA_SEED),
            twoscomplement_i2u(n_x),
            twoscomplement_i2u(n_y),
        ], SPACE_PROGRAM_ID);
        const account = await connection.getAccountInfo(n_meta[0]);
        if (account === null) {
            return null;
        }
        const key = account.data.slice(65, 97);
        window.neighborhoodCandyMachineCache[hash] = new PublicKey(key);
        return window.neighborhoodCandyMachineCache[hash];
    }

    async getNeighborhoodMetadata(connection, n_x, n_y) {
        const hash = JSON.stringify({n_x, n_y});
        const n_meta = await PublicKey.findProgramAddress([
            BASE.toBuffer(),
            Buffer.from(NEIGHBORHOOD_METADATA_SEED),
            twoscomplement_i2u(n_x),
            twoscomplement_i2u(n_y),
        ], SPACE_PROGRAM_ID);
        const account = await connection.getAccountInfo(n_meta[0]);
        if (account === null) {
            return null;
        }
        const name = account.data.slice(97, 161);
        return name
    }

    async getFrameData(colorClusterAccount) {
        let data = Array.from({ length: NEIGHBORHOOD_SIZE }, () => new Array(NEIGHBORHOOD_SIZE).fill(null));

        if (!colorClusterAccount) {
            return null;
        }

        for (let x = 0; x < NEIGHBORHOOD_SIZE; x++) {
            for (let y = 0; y < NEIGHBORHOOD_SIZE; y++) {
                const offset = 3 * (x * NEIGHBORHOOD_SIZE + y);
                const color = colorClusterAccount.data.slice(offset, offset + 3);
                data[y][x] = '#' + color.toString('hex');
            }
        }
        return data;
    }

    rgbatoString(rgb) {
        return '#' + rgb.toString('hex');
    }

    convert(Uint8Arr) {
        var length = Uint8Arr.length;

        let buffer = Buffer.from(Uint8Arr);
        var result = buffer.readUIntLE(0, length);

        return result;
    }

    async getSpaceMetadata(connection, p_x, p_y) {
        const spaceMetadata = await PublicKey.findProgramAddress([
                BASE.toBuffer(),
                Buffer.from(SPACE_METADATA_SEED),
                twoscomplement_i2u(p_x),
                twoscomplement_i2u(p_y),
            ],
            SPACE_PROGRAM_ID
        );
        //console.log(spaceMetadata[0].toBase58());
        const account = await connection.getAccountInfo(spaceMetadata[0]);
        if (account) {
            let mint = new PublicKey(account.data.slice(1, 33));

            const {owner, delegate} = await this.getNFTOwner(connection, mint);

            // check if delegate matches sell delegate
            const sell_del = await PublicKey.findProgramAddress([
                    BASE.toBuffer(),
                    Buffer.from(SELL_DELEGATE_SEED),
                ],
                SPACE_PROGRAM_ID
            );

            let has_price = false;
            let price = 0;
            if (delegate.toBase58() === sell_del[0].toBase58()) {
                has_price = true;
                price = this.convert(account.data.slice(33, 33+8));
            }

            // const metadata = (await PublicKey.findProgramAddress([
            //     Buffer.from("metadata"),
            //     METADATA_PROGRAM_ID.toBuffer(),
            //     mint.toBytes()
            // ], METADATA_PROGRAM_ID))[0];

            // const metadataInfo = await connection.getAccountInfo(metadata);
            // const meta = decodeMetadata(metadataInfo.data);
            // console.log(meta.data);

            return {
                mint: mint,
                has_price: has_price,
                price: price,
                owner: owner,
                //swappable: (!!account.data[42]),
            }
        } else {
            return null;
        }
    }

    async getSpaceInfos(connection, poses){
        try {
            loading(0, 'Loading Info', null);
            let newposes_array = Array.from(poses);
            
            // check the space metadata for all spaces
            const BASEBuffer = BASE.toBuffer();
            const SPACE_METADATA_SEEDBuffer = Buffer.from(SPACE_METADATA_SEED);
            const spaceMetas = await Promise.all(newposes_array.map(async (x) => {
                let coord = JSON.parse(x);
                return (await PublicKey.findProgramAddress([BASEBuffer, SPACE_METADATA_SEEDBuffer, twoscomplement_i2u(coord.x), twoscomplement_i2u(coord.y),], SPACE_PROGRAM_ID))[0];
            }));
            let spaceDatas = await this.batchGetMultipleAccountsInfoLoading(connection, spaceMetas, 'Loading Info', user, false, 0, 10);

            const sell_del = await PublicKey.findProgramAddress([
                    BASE.toBuffer(),
                    Buffer.from(SELL_DELEGATE_SEED),
                ],
                SPACE_PROGRAM_ID
            );

            let priceDatas = [];

            for (let j = 0; j < spaceDatas.length; j++) {
                let spaceData = spaceDatas[j];
                if (spaceData) {
                    let mint = new PublicKey(spaceData.data.slice(1,33));
                    let price = this.convert(spaceData.data.slice(33, 33+8));
                    // if (price > 0){
                    //     priceDatas.push({mint, price, ...JSON.parse(newposes_array[j])});
                    // }
                    priceDatas.push({mint, price, ...JSON.parse(newposes_array[j])});
                }
            }

            // ratelimit
            let tokenaccts = [];
            for (let j = 0; j < priceDatas.length; j += BATCH_LOAD_PRICE_SIZE) {
                let currArr = priceDatas.slice(j, j+BATCH_LOAD_PRICE_SIZE);
                let promises = currArr.map(async (x) => 
                    {
                        const account = await connection.getTokenLargestAccounts(x.mint);
                        let address = account.value[0].address;
                        return address;
                    }
                );
                loading(10 + j / priceDatas.length * (80 - 10), 'Loading Info', null);
                let responses = await Promise.all(promises);
                tokenaccts.push(...responses);
                // TODO: await sleep??
            }

            loading(80, 'Loading Info', null);

            let outps = await this.batchGetMultipleAccountsInfoLoading(connection, tokenaccts, 'Loading Info', user, false, 80, 99);

            let info = [];

            for (let j = 0; j < outps.length; j++) {
                let account_data = outps[j];
                
                if (account_data !== null) {
                    let owner = new PublicKey(account_data.data.slice(32, 64));
                    let has_delegate = (new BN(account_data.data.slice(72, 76))).toNumber();
                    let delegate = account_data.data.slice(76, 108);
                    if (!has_delegate){
                        delegate.fill(0);
                    }
                    delegate = new PublicKey(delegate);

                    // if (owner.toBase58() === user || delegate.toBase58() !== sell_del[0].toBase58()) {
                    //     continue;
                    // }
                    info.push({...priceDatas[j], owner, forSale: delegate.toBase58() == sell_del[0].toBase58()})
                }
            }
            loading(null, 'Loading Info', 'success');
            return info;
        } catch (e) {
            loading(null, 'Loading Info', 'exception');
            console.error(e);
            return [];
        }
    }

    /*
    get purchasable info, excluding user. Set user to null to get all info
    return a list, each element is an object {x, y, mint, price, seller}
    */
    async getPurchasableInfo(connection, user, poses) {
        let infos = await this.getSpaceInfos(connection, poses);
        let purchasableInfo = []
        for (let info of infos){
            if (info.owner.toBase58() == user || !info.forSale){
                continue;
            }
            purchasableInfo.push({
                x: info.x,
                y: info.y,
                mint: info.mint,
                price: info.price,
                seller: info.owner,
            })
        }
        purchasableInfo.sort((a, b) => a.y == b.y ? a.x - b.x : a.y - b.y);

        return purchasableInfo;
    }

    async getNFTOwner(connection, mint) {
        const account = await connection.getTokenLargestAccounts(mint);
        if (account !== null) {
            const account_data = await connection.getAccountInfo(account.value[0].address);
            // console.log("account_data", account_data);
            let owner = account_data.data.slice(32, 64);
            let has_delegate = (new BN(account_data.data.slice(72, 76))).toNumber();
            let delegate = account_data.data.slice(76, 108);
            if (!has_delegate){
                delegate.fill(0);
            }
            // console.log("owner", owner)
            return { 
                owner: new PublicKey(owner),
                delegate: new PublicKey(delegate)
            };
        }
        else {
            return null;
        }
    }

    setAddress(address) { // take address from hooks
        user = address;
    }

    refreshCache(address) { // refresh cache when a different user is connected 
        if (user !== address) {
            window.myTokens = new Set();
            user = address;
        }
    }

    /*
    returns {spaces, mints}. Blocks is a set of stringified {x, y} of owned spaces. mints 
    is a map from spaces to the mint of the block (mint is a string). Ignores tokens in tokenCache
    */
    async getSpacesByOwner(connection, address, diffUser=false, tokenCache=new Set()) {
        let infoText = diffUser ? "Getting User Spaces" : "Loading Your Spaces"; 
        try {
            loading(0, infoText, null);
            const spaces = new Set();
            const mints = {};
            const tokens = await connection.getTokenAccountsByOwner(address, { programId: TOKEN_PROGRAM_ID });
            // FILTER out token accounts with 0 qty or inside the token cache
            const validTokens = [];
            for (let t of tokens.value) {
                // if quantity is 1 and it is not in the token cache
                if (this.convert(t.account.data.slice(64, 72)) === 1 && !tokenCache.has(t.pubkey.toBase58())) {
                    validTokens.push(t);
                }
            }
            loading(20, infoText, null);
            const metadataBuffer = Buffer.from("metadata");
            const METADATA_PROGRAM_IDBuffer = METADATA_PROGRAM_ID.toBuffer();
            const listMetadatas = await Promise.all(validTokens.map(async (x) => {
                const mint = new PublicKey(x.account.data.slice(0, 32));
                return new Promise((resolve) => {
                    setTimeout(() => {
                        PublicKey.findProgramAddress([metadataBuffer, METADATA_PROGRAM_IDBuffer, mint.toBytes()], METADATA_PROGRAM_ID)
                        .then(value => resolve(value[0]));
                    }, 500);
                });
            }));
            // batch list metadatas 
            const metadataInfo = await this.batchGetMultipleAccountsInfoLoading(connection, listMetadatas, infoText, address, diffUser, 20, 99);
            let candyMachines = {};
            for (let currMetadata of metadataInfo) {
                if (currMetadata) {
                    const meta = decodeMetadata(currMetadata.data);
                    if (meta.data.name.split(' ')[0] !== "Space") {
                        continue;
                    }
                    const name_split_comma = meta.data.name.split(',');
                    if (name_split_comma.length !== 2) {
                        continue;
                    }
                    const x = Number(name_split_comma[0].split('(')[1]);
                    const y = Number(name_split_comma[1].split(')')[0]);
                    const n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
                    const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
                    let key = JSON.stringify({n_x, n_y});
                    let candyMachine;
                    if (key in candyMachines) {
                        candyMachine = candyMachines[key];
                    } else {
                        candyMachine = (await this.getNeighborhoodCandyMachine(connection, n_x, n_y)).toBase58();
                        candyMachines[key] = candyMachine;
                    }

                    // if first creator (candymachine) matches
                    if (meta.data.creators[0].address === candyMachine) {
                        const position = {x, y};
                        spaces.add(JSON.stringify(position));
                        mints[JSON.stringify(position)] = new PublicKey(meta.mint);
                    }
                }
            }
            console.log("Done getting owner Spaces")

            loading(null, infoText, 'success');
            return { spaces, mints };
        } catch (e) {
            loading(null, infoText, 'exception');
            console.log(e);
            return null;
        }
    }

    async batchGetMultipleAccountsInfoLoading(connection, accs, info, address=null, diffUser=false, loadingStart=0, loadingEnd=100) {
        const allAccInfo = [];
        for (let i = 0; i < Math.ceil(accs.length / MAX_ACCOUNTS); i++) {
            const currAccs = accs.slice(i * MAX_ACCOUNTS, Math.min((i + 1) * MAX_ACCOUNTS, accs.length));
            const accInfos = await connection.getMultipleAccountsInfo(currAccs);
            allAccInfo.push(...accInfos);
            loading(loadingStart + (i + 1) / Math.ceil(accs.length / MAX_ACCOUNTS) * (loadingEnd - loadingStart), info, null);
            // return early if user switches wallets
            if (address && user !== address && !diffUser) {
                loading(loadingEnd, info, null);
                return allAccInfo;
            }
        }
        loading(loadingEnd, info, null);
        return allAccInfo;
    }

    async batchGetMultipleAccountsInfo(connection, accs) {
        const allAccInfo = [];
        for (let i = 0; i < Math.ceil(accs.length / MAX_ACCOUNTS); i++) {
            const currAccs = accs.slice(i * MAX_ACCOUNTS, Math.min((i + 1) * MAX_ACCOUNTS, accs.length));
            const accInfos = await connection.getMultipleAccountsInfo(currAccs);
            allAccInfo.push(...accInfos);
        }
        return allAccInfo;
    }
}