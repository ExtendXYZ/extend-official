import { RPC, DATABASE_SERVER_URL } from "../../constants";
import {PublicKey, LAMPORTS_PER_SOL} from "@solana/web3.js";
const axios = require('axios');

export class Database {
    constructor() {
        const prefix = RPC?.includes("mainnet") ? "mainnet" : "devnet";
        this.mysql = DATABASE_SERVER_URL + `/${prefix}`;
    }

    async getSpacesByOwner(address) {
        const results = await axios.get(this.mysql + '/owner/' + address.toBase58());
        const data = results.data;

        // fill spaces and mints
        const spaces = new Set();
        const mints = {};
        for (let arr of data) {
            const [x, y, mint] = arr;
            const position = {x, y};
            spaces.add(JSON.stringify(position));
            mints[JSON.stringify(position)] = new PublicKey(mint);
        }
        return {spaces: spaces, mints};
    }

    async getListedSpaces(address) {
        const results = await axios.get(this.mysql + '/listed/' + address.toBase58());
        const data = results.data;

        const spaces = new Set();
        for (let arr of data) {
            const [x, y] = arr;
            const position = {x, y};
            spaces.add(JSON.stringify(position));
        }

        return {spaces: spaces}
    }

    async getSpaceMetadata(x, y) {
        const results = await axios.get(this.mysql + '/info/' + x + '/' + y);
        const data = results.data[0];
        const [mint, owner, price, forSale] = data;

        return {mint: new PublicKey(mint), owner: new PublicKey(owner), price: Number(price), has_price: Boolean(forSale)}
    }

    async getPurchasableInfo(user, poses) {
        const newPoses = [...poses];
        let posesX = [];
        let posesY = [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let pose of newPoses) {
            let pos = JSON.parse(pose);
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x);
            maxY = Math.max(maxY, pos.y);
        }

        const results = await axios.get(this.mysql + '/listedSpaces/' + minX + '/' + minY + '/' + maxX + '/' + maxY);
        const data = results.data;

        let purchasableInfo = [];
        for (let arr of data) {
            const [x, y, mint, owner, price] = arr;
            if (poses.has(JSON.stringify({x, y})) && (!user || user.toBase58() != owner)) { // if in poses, not owned by curr user, and for Sale 
                purchasableInfo.push({x, y, mint: new PublicKey(mint), price: Number(price), seller: new PublicKey(owner)});
            }
        }
        purchasableInfo.sort((a, b) => a.y == b.y ? a.x - b.x : a.y - b.y);

        return purchasableInfo;
    }

    async connect() {
        console.log("connecting:");
        return await axios.post(this.mysql + "/connect/", "connect", {
            headers: { 'Content-Type': 'text/plain' }
          });
    }

    async disconnect() {
        await fetch(this.mysql + "/connect", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain"
            }, 
            body: "disconnect",
            keepalive: true
        });
    }

    async connectNew(id) {
        const currTime = Date.now();
        const result = await axios.post(this.mysql + "/connectId/", {type: "connect", id: id, time: Date.now()});
        return result.data[0];
    }

    async disconnectNew(id) {
        return await axios.post(this.mysql + "/connectId/", {type: "disconnect", id: id, time: Date.now()});
    }

    async getOnline() {
        const result = await axios.get(this.mysql + '/connect');
        console.log(result);
    }

    // async refreshPrices(spaces) {
    //     await axios.post(this.mysql + '/refresh-prices', {spaces});
    // }
    // async refreshOwners(spaces) {
    //     await axios.post(this.mysql + '/refresh-owners', {spaces});
    // }

    async register(owner, mints) {
        let mintsStrings = {};
        for(let key in mints){
            mintsStrings[key] = mints[key].toBase58();
        }

        await axios.post(this.mysql + '/register', {owner: owner.toBase58(), mints: mintsStrings});
    }

    async update(owners, mints){
        let ownersStrings = {};
        let mintsStrings = {};
        for(let key in owners){
            ownersStrings[key] = owners[key].toBase58();
            mintsStrings[key] = mints[key].toBase58();
        }
        await axios.post(this.mysql + '/update', {owners: ownersStrings, mints: mintsStrings});
    }

    async getNeighborhoodStats(x, y) {
        const results = await axios.get(this.mysql + "/stats/" + x + "/" + y);
        const data = results.data;
        return {
          floor_price: Number(data.listed_stats[0][0]) / LAMPORTS_PER_SOL,
          listed_count: data.listed_stats[0][1],
          volume: Number(data.trade_stats[0][0]) / LAMPORTS_PER_SOL,
          average: Number(data.trade_stats[0][1]) / LAMPORTS_PER_SOL,
          owners: data.owner_stats[0][0],
          floor: data.floor.map( el => JSON.stringify({x : el[0], y: el[1]})),
          listed: data.listed.map( el => JSON.stringify({x : el[0], y: el[1]})),
        };
    } 
}