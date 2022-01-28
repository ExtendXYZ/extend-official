import { RPC, DATABASE_SERVER_URL } from "../../constants";
import {PublicKey, LAMPORTS_PER_SOL} from "@solana/web3.js";
const axios = require('axios');

/*c
Database functions with name identical to server functions have identical documentation
see Server comments
*/


export class Database {
    constructor() {
        const prefix = RPC?.includes("mainnet") ? "mainnet" : "devnet";
        this.mysql = DATABASE_SERVER_URL + `/${prefix}`;
    }

    async getSpacesByOwner(address) {
        const results = await axios.get(this.mysql + '/owner/' + address.toBase58());
        const data = results.data;

        // fill spaces and mints
        let spaces = new Set();
        let mints = {};
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

        let spaces = new Set();
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

        return {
            mint: new PublicKey(mint),
            owner: new PublicKey(owner),
            price: Number(price),
            hasPrice: Boolean(forSale)
        }
    }

    async getSpaceInfoWithRent(x, y){
        const results = await axios.get(this.mysql + '/infoWithRent/' + x + '/' + y);
        const data = results.data[0];
        console.log(data);
        let [mint, owner, price, forSale, rentPrice, minDuration, maxDuration, maxTimestamp, rentEnd, renter, rentee] = data;

        let hasRentPrice = true;
            let now = Date.now() / 1000;
            if (rentPrice == 0 || (owner !== renter) || (maxTimestamp > 0 && now > maxTimestamp) || now < rentEnd) {
                hasRentPrice = false;
                rentPrice = 0;
            }

        return {
            mint: mint ? new PublicKey(mint) : null,
            owner: owner? new PublicKey(owner) : null,
            price,
            hasPrice: Boolean(forSale),
            rentPrice,
            minDuration,
            maxDuration,
            maxTimestamp,
            rentEnd,
            renter: renter ? new PublicKey(renter) : null,
            rentee: rentee ? new PublicKey(rentee) : null,
            hasRentPrice,
        }
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

    async getRentableInfo(user, poses) {
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

        const results = await axios.get(this.mysql + '/rentableSpaces/' + minX + '/' + minY + '/' + maxX + '/' + maxY);
        const data = results.data;

        let rentableInfo = [];
        for (let arr of data) {
            let [x, y, mint, owner, rentPrice, minDuration, maxDuration, maxTimestamp, rentEnd, renter] = arr;
            console.log(arr);
            if (poses.has(JSON.stringify({x, y})) && (!user || user.toBase58() != owner)) { // if in poses, not owned by curr user, and for Sale 
                rentableInfo.push(
                    {
                        x,
                        y,
                        mint: mint ? new PublicKey(mint) : null,
                        price: Number(rentPrice),
                        minDuration: Number(minDuration),
                        maxDuration: Number(maxDuration),
                        maxTimestamp: Number(maxTimestamp),
                        renter: renter ? new PublicKey(renter) : null,
                    }
                );
            }
        }
        rentableInfo.sort((a, b) => a.y == b.y ? a.x - b.x : a.y - b.y);

        return rentableInfo;
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
        return result.data[0][0];
    }

    async disconnectNew(id) {
        return await axios.post(this.mysql + "/connectId/", {type: "disconnect", id: id, time: Date.now()});
    }

    async getNumViewers() {
        const result = await axios.get(this.mysql + '/connectId');
        return result.data[0][0];
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

    async updateSpaceInfo(owners, mints){
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