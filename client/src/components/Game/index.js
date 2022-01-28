import React from "react";
import "./index.css";

import { GIF, notify, shortenAddress } from "../../utils";
import { PublicKey } from "@solana/web3.js";
import { NEIGHBORHOOD_SIZE, UPPER, BASE, NEIGHBORHOOD_METADATA_SEED, SPACE_PROGRAM_ID, RPC } from "../../constants";
import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    InputAdornment,
    MenuItem,
    Switch,
    TextField,
    Select,
    Menu,
    fabClasses,
} from "@mui/material";
import { Tooltip } from 'antd';
import { CopyOutlined } from "@ant-design/icons";
import SearchIcon from "@mui/icons-material/Search";
import CancelIcon from "@mui/icons-material/Cancel";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import VisibilityIcon from "@mui/icons-material/Visibility"
import { twoscomplement_i2u } from "../../utils/borsh";

import { Server } from "./server.js";
import { Database } from "./database.js";
import { LoadingScreen } from './loading_screen.js';
import { Board } from './canvas.js';
import { FocusSidebar } from './focus_sidebar.js';
import { SelectingSidebar } from './selecting_sidebar.js';
import { NeighborhoodSidebar } from './neighborhood_sidebar.js';
import { solToLamports, lamportsToSol, xor} from "../../utils";
import { priceToColor, colorHighlight } from "../../utils";
import {loading} from '../../utils/loading';
import { letterSpacing } from "@mui/system";
import { InfoOutlined } from "@mui/icons-material";
import Search from "antd/es/input/Search";

const SIDE_NAV_WIDTH = 400;
const FETCH_COLORS_INTERVAL = 10 * 1000;
const FETCH_NAMES_INTERVAL = 60 * 1000;
const FETCH_PRICES_INTERVAL = 3 * 60 * 1000;
const ANIMATION_INTERVAL = 300;

export const getBounds = (spaces) => {
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const p of spaces) {
        const space = JSON.parse(p);

        const row = space.y;
        const col = space.x;
        if (col < left) {
            left = col;
        }
        if (col > right) {
            right = col;
        }
        if (row < top) {
            top = row;
        }
        if (row > bottom) {
            bottom = row;
        }
    }
    return { left, right, top, bottom };
};

export class Game extends React.Component {
    constructor(props) {
        super(props);
        this.intervalFetchColors = 0;
        this.intervalFetchNeighborhoodNames = 0;
        this.intervalFetchPrices = 0;
        this.intervalChangeFrame = 0;
        this.state = {
            neighborhood_colors: {},
            showNav: false,
            focus: {
                focus: false,
                x: 0,
                y: 0,
                color: "#000000",
                owner: "",
                owned: false,
                hasPrice: false,
                price: null,
                mint: null,
                infoLoaded: false,
                imgLoaded: false,
                neighborhood_name: null,
                hasRentPrice: false,
                rentPrice: null,
                minDuration: null,
                maxDuration: null,
                maxTimestamp: null,
                renter: null,
                rentEnd: null,
                rentee: null,
            },
            selecting: {
                selecting: false,
                poses: new Set(),
                color: "#000000",
                price: null,
                loadingPricesStatus: 0,
                targetStatus: 0,
                purchasableInfoAll: new Array(),
                purchasableInfo: new Array(),
                purchasable: new Set(),
                totalPrice: NaN,
                rentPrice: null,
                loadingRentStatus: 0,
                rentableInfoAll: new Array(),
                rentableInfo: new Array(),
                rentable: new Set(),
                totalRentPrice: NaN,
                floorM: 1,
                floorN: 1,
            },
            neighborhood: {
                focused: false,
                n_x: 0,
                n_y: 0,
                infoLoaded: false,
                num_frames: 0,
                trades: {},
            },
            initialFetchStatus: 0,
            findingSpaces: false,
            refreshingUserSpaces: false,
            colorApplyAll: false,
            anims: false,
            animsInfoLoaded: true,
            floor: false,
            img_upl: null,
            has_img: false,
            frame: 0,
            maxFrame: 1,
            viewMenuOpen: false, 
            viewMenuAnchorEl: null,
            shareMenuOpen: false, 
            shareMenuAnchorEl: null,
            mySpacesMenuOpen: false,
            mySpacesMenuAnchorEl: null,
        };
        this.clusters_expl = {};
        this.subIds = [];

        this.viewport = {
            neighborhood_start: [-1, -1], // inclusive
            neighborhood_end: [2, 2], // exclusive
            neighborhood_colors: {},
            neighborhood_colors_all_frames: {},
            neighborhood_names: {},
            neighborhood_prices: {},
            view: 0,
        };
        this.board = React.createRef();
        this.captchaResponse = null;
        this.mobile = window.innerWidth < 500;
    }

    // gets neighborhoods in viewport with neighborhood metadata created
    getViewportNeighborhoods = async() => {
        const start = this.viewport.neighborhood_start;
        const end = this.viewport.neighborhood_end;
        let neighborhoods = [];

        for (let n_x = start[0]; n_x < end[0]; n_x++) {
            for (let n_y = start[1]; n_y < end[1]; n_y++) {
                neighborhoods.push({ n_x, n_y });
            }
        }
        return this.props.server.filterExistingNeighborhoods(this.props.connection, neighborhoods);
    }

    // pull color data for a specific frame into viewport
    fetch_colors = async (frame) => {
        const connection = this.props.connection;
        let neighborhoods = await this.getViewportNeighborhoods();

        const frameKeysMap = await this.props.server.getFrameKeys(
            connection,
            neighborhoods,
            frame
        );
        const frameInfos = Object.keys(frameKeysMap).map(x => JSON.parse(x));
        const frameKeys = Object.values(frameKeysMap);

        const frameDatas = await this.props.server.batchGetMultipleAccountsInfo(
            this.props.connection,
            frameKeys
        );
        const tmp_neighborhood_colors = {};
        let newMax = this.state.maxFrame;
        const neighborhood_accounts = await Promise.all(
            frameInfos.map(async (value, i) => {
                let { n_x, n_y, frame } = value;
                let key = JSON.stringify({ n_x, n_y });
                tmp_neighborhood_colors[key] = await this.props.server.getFrameData(
                    frameDatas[i]
                );
                const newNumFrames = await this.props.server.getNumFrames(
                    this.props.connection,
                    n_x,
                    n_y
                );
                newMax = newNumFrames > newMax ? newNumFrames : newMax;

                const n_meta = await PublicKey.findProgramAddress([
                    BASE.toBuffer(),
                    Buffer.from(NEIGHBORHOOD_METADATA_SEED),
                    Buffer.from(twoscomplement_i2u(n_x)),
                    Buffer.from(twoscomplement_i2u(n_y)),
                ], SPACE_PROGRAM_ID
                );
                return n_meta[0];
            })
        );

        this.viewport.neighborhood_colors = tmp_neighborhood_colors;
        this.setState({ maxFrame: newMax });
        return frameKeys;
    }

    // pull all color data into viewport
    fetch_colors_all_frames = async () => {
        const connection = this.props.connection;

        let neighborhoods = await this.getViewportNeighborhoods();

        let { numFramesMap, frameKeysMap } = await this.props.server.getAllFrameKeys(
            connection,
            neighborhoods
        );
        const frameInfos = Object.keys(frameKeysMap).map(x => JSON.parse(x));
        const frameKeys = Object.values(frameKeysMap);
        
        const frameDatas = await this.props.server.batchGetMultipleAccountsInfo(
            this.props.connection,
            frameKeys
        );

        let newMax = this.state.maxFrame;
        this.viewport.neighborhood_colors_all_frames = {};
        for (let i = 0; i < frameDatas.length; i++) {
            let { n_x, n_y, frame } = frameInfos[i];
            let key = JSON.stringify({ n_x, n_y });
            let n_frames = numFramesMap[key];
            newMax = n_frames > newMax ? n_frames : newMax;

            if (!(key in this.viewport.neighborhood_colors_all_frames)) {
                this.viewport.neighborhood_colors_all_frames[key] = [];
                for (let k = 0; k < n_frames; k++) {
                    this.viewport.neighborhood_colors_all_frames[key].push(
                        Array.from({ length: NEIGHBORHOOD_SIZE }, () =>
                            new Array(NEIGHBORHOOD_SIZE).fill(null)
                        )
                    );
                }
            }

            this.viewport.neighborhood_colors_all_frames[key][frame] =
                await this.props.server.getFrameData(frameDatas[i]);
        }

        this.setState({ maxFrame: newMax });
        return frameKeys;
    }

    fetch_neighborhood_names = async() => {
        const connection = this.props.connection;

        let neighborhoods = await this.getViewportNeighborhoods();
        
        const neighborhood_accounts = await Promise.all(
            neighborhoods.map(async (value, i) => {
                let { n_x, n_y } = value;
                let key = JSON.stringify({ n_x, n_y });
                const n_meta = await PublicKey.findProgramAddress([
                    BASE.toBuffer(),
                    Buffer.from(NEIGHBORHOOD_METADATA_SEED),
                    Buffer.from(twoscomplement_i2u(n_x)),
                    Buffer.from(twoscomplement_i2u(n_y)),
                ], SPACE_PROGRAM_ID
                );
                return n_meta[0];
            })
        );
        let accounts = await this.props.server.batchGetMultipleAccountsInfo(this.props.connection, neighborhood_accounts);
        for (let cntr = 0; cntr < neighborhoods.length; cntr++) {
            let account = accounts[cntr];
            let { n_x, n_y } = neighborhoods[cntr];
            let key = JSON.stringify({ n_x, n_y });
            if (account) {
                const name = Buffer.from(account.data.slice(97, 97 + 64)).toString('utf-8');
                this.viewport.neighborhood_names[key] = name.replaceAll("\x00", " ").trim();
            }
        }
    }

    fetch_neighborhood_prices = async() => {
        let neighborhoods = await this.getViewportNeighborhoods();
        let poses = new Set();
        for(let {n_x, n_y} of neighborhoods){ // loop through all spaces
            for(let x = n_x * NEIGHBORHOOD_SIZE; x < (n_x + 1) * NEIGHBORHOOD_SIZE; x++){
                for(let y = n_y * NEIGHBORHOOD_SIZE; y < (n_y + 1) * NEIGHBORHOOD_SIZE; y++){
                    poses.add(JSON.stringify({x, y}));
                }
            }
        }
        let purchasableInfo = await this.props.database.getPurchasableInfo(null, poses);
        let colorMap = {};
        for(let {x, y, mint, price, seller} of purchasableInfo){
            let color = `#${priceToColor(price)}`;
            colorMap[JSON.stringify({x, y})] = color;
        }
        this.viewport.neighborhood_prices = {};
        for(let {n_x, n_y} of neighborhoods){ // loop through all spaces
            let data = Array.from({ length: NEIGHBORHOOD_SIZE }, () => new Array(NEIGHBORHOOD_SIZE).fill(null));
            for(let x = n_x * NEIGHBORHOOD_SIZE; x < (n_x + 1) * NEIGHBORHOOD_SIZE; x++){
                for(let y = n_y * NEIGHBORHOOD_SIZE; y < (n_y + 1) * NEIGHBORHOOD_SIZE; y++){
                    let key = JSON.stringify({x, y});
                    let x_relative = x - n_x * NEIGHBORHOOD_SIZE;
                    let y_relative = y - n_y * NEIGHBORHOOD_SIZE;
                    if (key in colorMap){
                        data[y_relative][x_relative] = colorMap[key];
                    }
                    else{
                        data[y_relative][x_relative] = "#000000" // black
                    }
                }
            }
            let key = JSON.stringify({n_x, n_y});
            this.viewport.neighborhood_prices[key] = data;
        }
    }

    // updateAccount = async (account) => {
    //     if (account) {
    //         let nx = account.data.slice(
    //             3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE,
    //             3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + 8
    //         );
    //         let ny = account.data.slice(
    //             3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + 8,
    //             3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE + 16
    //         );
    //         let nx_buffer = Buffer.from(nx);
    //         let ny_buffer = Buffer.from(ny);
    //         let nx_int = nx_buffer.readUIntLE(0, 8);
    //         let ny_int = ny_buffer.readUIntLE(0, 8);

    //         let key = JSON.stringify({ n_x: nx_int, n_y: ny_int });

    //         this.viewport.neighborhood_colors[key] = await this.props.server.getFrameData(
    //             account
    //         );
    //     }t
    // }

    async componentDidMount() {
        await Promise.all([
            this.fetch_colors(this.state.frame),
            this.fetch_neighborhood_names(this.state.frame),
            this.fetch_neighborhood_prices(),
        ]);
        this.setState({
            initialFetchStatus: 1,
        });

        // setInterval for requerying from chain regularly
        this.intervalFetchColors = setInterval(async () => {
            if (!document.hidden){
                await this.fetch_colors(this.state.frame);
            }
        }, FETCH_COLORS_INTERVAL);
        this.intervalFetchNeighborhoodNames = setInterval(async () => {
            if (!document.hidden){
                await this.fetch_neighborhood_names();
            }
        }, FETCH_NAMES_INTERVAL);
        this.intervalFetchPrices = setInterval(async () => {
            if (!document.hidden){
                await this.fetch_neighborhood_prices();
            }
        }, FETCH_PRICES_INTERVAL);

        // open websocket to listen to color cluster accounts
        // for (let j = 0; j < colorClusterKeys.length; j++) {
        //     if (colorClusterKeys[j]) {
        //         const id = connection.onAccountChange(colorClusterKeys[j], this.updateAccount.bind(this));
        //         this.subIds.push(id);
        //     }
        // }
        
        if ("address" in this.props.locator) {
            try {
                const text = this.props.locator.address;
                const pubkey = new PublicKey(text); // make sure valid pubkey
                let data;
                try{
                    data = await this.props.database.getSpacesByOwner(pubkey);
                } catch(e){
                    console.error(e);
                    data = await this.props.server.getSpacesByOwner(this.props.connection, pubkey, true);
                }
                if (data && data["spaces"]) {
                    const msg =
                        data["spaces"].size > 0 ? "Spaces shown on map" : "No Spaces found";
                    notify({
                        message: "Finding Spaces...",
                        description: msg,
                    });
                    if (data["spaces"].size > 0) {
                        this.setSelecting(new Set(data["spaces"]));
                        const bounds = getBounds(data["spaces"]);
                        requestAnimationFrame(() => {
                            this.board.current.drawCanvasCache({
                                x: bounds.left,
                                y: bounds.top,
                                width: bounds.right - bounds.left + 1,
                                height: bounds.bottom - bounds.top + 1,
                            });
                            this.board.current.drawSelected();
                        });
                    }
                }
            } catch (e) {
                notify({
                    message: "Please enter a valid wallet address",
                });
            }
        }
        else if ("col" in this.props.locator && "row" in this.props.locator) {
            try {
                this.setFocus(parseInt(this.props.locator.col), parseInt(this.props.locator.row));
            } catch (e) {
                console.log(e)
                notify({
                    message: `(${this.props.locator.col}, ${this.props.locator.row}) is not a valid Space coordinate.`
                });
            }
        }
        else if ("colStart" in this.props.locator && "colEnd" in this.props.locator && "rowStart" in this.props.locator && "rowEnd" in this.props.locator) {
            try {
                const spaces = new Set();
                for (let x = parseInt(this.props.locator.colStart); x < parseInt(this.props.locator.colEnd)+1; x++) {
                    for (let y = parseInt(this.props.locator.rowStart); y < parseInt(this.props.locator.rowEnd)+1; y++) {
                        spaces.add(JSON.stringify({x, y}));
                    }
                }
                this.setSelecting(spaces);
            } catch (e) {
                console.log(e)
                notify({
                    message: `[${this.props.locator.colStart},${this.props.locator.colEnd}] x [${this.props.locator.rowStart},${this.props.locator.rowEnd}] is not a valid range of Spaces.`
                })
            }
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalFetchColors);
        clearInterval(this.intervalFetchNeighborhoodNames);
        clearInterval(this.intervalChangeFrame);
        clearInterval(this.intervalFetchPrices);
        // remove account listeners
        // const connection = this.props.connection;
        // for (const id of this.subIds) {
        //     connection.removeAccountChangeListener(id);
        // }
    }

    closeSideNav = () => {
        this.setState({ showNav: false});
    }

    changeColor = () => {
        this.props.setChangeColorTrigger({
            color: this.state.focus.color,
            x: this.state.focus.x,
            y: this.state.focus.y,
            frame: this.state.colorApplyAll ? -1 : this.state.frame,
            mint: this.state.focus.mint,
        });
        notify({
            message: "Changing color...",
        });
    }

    changeColors = () => {
        this.props.setChangeColorsTrigger({
            color: this.state.selecting.color,
            spaces: this.state.selecting.poses,
            frame: this.state.colorApplyAll ? -1 : this.state.frame,
        });
        notify({
            message: "Changing colors...",
        });
    }

    uploadImage = () => {
        let reader = new FileReader();

        let bfile;
        reader.onload = function (e) {
            bfile = e.target.result;

            var canvas = document.createElement("canvas");
            var image;

            if (bfile.slice(0, 14) !== "data:image/gif") {
                image = new Image();

                image.onload = function () {
                    let bounds = getBounds(this.state.selecting.poses);

                    const height = bounds.bottom - bounds.top + 1;
                    const width = bounds.right - bounds.left + 1;

                    canvas.width = width;
                    canvas.height = height;

                    var context = canvas.getContext("2d", {
                        alpha: false,
                        desynchronized: true,
                    });
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);

                    var imageData = context.getImageData(
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );

                    var pixArray = Array.from({ length: imageData.height }, () =>
                        Array(imageData.width).fill("FFFFFF")
                    );

                    for (var x = 0; x < imageData.width; x++) {
                        for (var y = 0; y < imageData.height; y++) {
                            var index = (x + y * imageData.width) * 4;
                            var red = imageData.data[index];
                            var green = imageData.data[index + 1];
                            var blue = imageData.data[index + 2];

                            pixArray[y][x] = [red, green, blue];
                        }
                    }

                    this.props.setImgUploadTrigger({
                        img: pixArray,
                        spaces: this.state.selecting.poses,
                        init_x: bounds.left,
                        init_y: bounds.top,
                        frame: this.state.colorApplyAll === "true" ? -1 : this.state.frame,
                    });
                    notify({
                        message: "Uploading image...",
                    });
                }.bind(this);

                image.setAttribute("src", bfile);
            } else {
                image = new GIF();
                image.onload = function () {
                    let bounds = getBounds(this.state.selecting.poses);

                    const height = bounds.bottom - bounds.top + 1;
                    const width = bounds.right - bounds.left + 1;

                    canvas.width = width;
                    canvas.height = height;

                    var context = canvas.getContext("2d", {
                        alpha: false,
                        desynchronized: true,
                    });
                    var imageData;
                    context.drawImage(
                        image.frames[0].image,
                        0,
                        0,
                        canvas.width,
                        canvas.height
                    );
                    imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    var pixArray = Array.from({ length: image.frames.length }, () =>
                        Array.from({ length: imageData.height }, () =>
                            Array(imageData.width).fill("FFFFFF")
                        )
                    );
                    for (let k = 0; k < image.frames.length; ++k) {
                        context.drawImage(
                            image.frames[k].image,
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        );
                        imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                        for (var x = 0; x < imageData.width; x++) {
                            for (var y = 0; y < imageData.height; y++) {
                                var index = (x + y * imageData.width) * 4;
                                var red = imageData.data[index];
                                var green = imageData.data[index + 1];
                                var blue = imageData.data[index + 2];

                                pixArray[k][y][x] = [red, green, blue];
                            }
                        }
                    }

                    this.props.setGifUploadTrigger({
                        gif: pixArray,
                        spaces: this.state.selecting.poses,
                        init_x: bounds.left,
                        init_y: bounds.top,
                    });
                    notify({
                        message: "Uploading gif...",
                    });
                }.bind(this);

                var BASE64_MARKER = ";base64,";
                var base64Index = bfile.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
                var base64 = bfile.substring(base64Index);

                const bfile_inp = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

                image.load(bfile_inp);
            }
        }.bind(this);

        // Read in the image file as a data URL.
        reader.readAsDataURL(this.state.img_upl);
    }

    handleChangeColorApplyAll = (e) => {
        let isTrue = (e.target.value === "true")
        this.setState({
            colorApplyAll: isTrue,
        });
    }

    changePrice = () => {
        let price = Number(this.state.focus.price);
        if (price != 0 && !price) {
            notify({
                message: "Warning:",
                description: `Could not parse price ${this.state.focus.price}`,
            });
        } else if (price <= 0) {
            notify({
                message: "Warning:",
                description: "Can only set to positive amount of SOL",
            });
        } else {
            this.props.setChangePriceTrigger({
                x: this.state.focus.x,
                y: this.state.focus.y,
                price: solToLamports(price),
                create: true,
                mint: this.state.focus.mint,
            });
            notify({
                message: "Setting price...",
            });
        }
    }

    changePrices = () => {
        let price = this.state.selecting.price;
        if (price != 0 && !price) {
            notify({
                message: "Warning:",
                description: "Price is undefined",
            });
        } else if (price <= 0) {
            notify({
                message: "Warning:",
                description: "Can only set to positive amount of SOL",
            });
        } else {
            this.props.setChangePricesTrigger({
                spaces: this.state.selecting.poses,
                price: solToLamports(price),
                create: true,
            });
            notify({
                message: "Setting prices...",
            });
        }
    }

    delistSpace = () => {
        let hasPrice = this.state.focus.hasPrice;
        if (!hasPrice) {
            notify({
                message: "Warning:",
                description: "Space is not listed",
            });
        } else {
            this.props.setChangePriceTrigger({
                x: this.state.focus.x,
                y: this.state.focus.y,
                price: 0,
                create: false,
                mint: this.state.focus.mint,
            });
            notify({
                message: "Delisting...",
            });
        }
    }

    changeRent = () => {
        let rentPrice = Number(this.state.focus.rentPrice);
        if (rentPrice != 0 && !rentPrice) {
            notify({
                message: "Warning:",
                description: `Could not parse rent price ${this.state.focus.rentPrice}`,
            });
        } else if (rentPrice <= 0) {
            notify({
                message: "Warning:",
                description: "Can only set to positive amount of SOL",
            });
        } else {
            this.props.setChangeRentTrigger({
                x: this.state.focus.x,
                y: this.state.focus.y,
                price: solToLamports(rentPrice / 86400), // convert day to seconds
                min_duration: 300, // TODO: make input for this
                max_duration: 3600, // TODO: make input for this
                max_timestamp: 2000000000, // TODO: make input for this
                create: true,
                mint: this.state.focus.mint,
            });
            notify({
                message: "Setting rent...",
            });
        }
    }

    changeRents = () => {
        let rentPrice = this.state.selecting.rentPrice;
        if (rentPrice != 0 && !rentPrice) {
            notify({
                message: "Warning:",
                description: "Price is undefined",
            });
        } else if (rentPrice <= 0) {
            notify({
                message: "Warning:",
                description: "Can only set to positive amount of SOL",
            });
        } else {
            this.props.setChangeRentsTrigger({
                spaces: this.state.selecting.poses,
                price: solToLamports(rentPrice / 86400), // convert day to seconds
                min_duration: 300, // TODO: make input for this
                max_duration: 3600, // TODO: make input for this
                max_timestamp: 2000000000, // TODO: make input for this
                create: true,
            });
            notify({
                message: "Setting rent...",
            });
        }
    }

    delistRent = () => {
        let hasRentPrice = this.state.focus.hasRentPrice;
        if (!hasRentPrice) {
            notify({
                message: "Warning:",
                description: "Space is not listed for rent",
            });
        } else {
            this.props.setChangeRentTrigger({
                x: this.state.focus.x,
                y: this.state.focus.y,
                price: 0,
                min_duration: 0,
                max_duration: 0,
                max_timestamp: 0,
                create: false,
                mint: this.state.focus.mint,
            });
            notify({
                message: "Delisting rent...",
            });
        }
    }

    delistSpaces = () => {
        this.props.setChangePricesTrigger({
            spaces: this.state.selecting.poses,
            price: 0,
            create: false,
        });
        notify({
            message: "Delisting...",
        });
    }

    delistRents = () => {
        this.props.setChangeRentsTrigger({
            spaces: this.state.selecting.poses,
            price: 0,
            create: false,
        });
        notify({
            message: "Delisting rents...",
        });
    }

    purchaseSpace = async () => {
        let price = this.state.focus.price;
        if (!price) {
            notify({
                message: "Warning:",
                description: "Not for sale",
            });
        } else {
            let x = this.state.focus.x;
            let y = this.state.focus.y;
            notify({
                message: "Buying...",
            });
            this.props.setPurchaseSpaceTrigger({
                x: this.state.focus.x,
                y: this.state.focus.y,
                price: solToLamports(price),
                owner: this.state.focus.owner,
                mint: this.state.focus.mint,
            });
        }
    }

    rentSpace = async () => {
        let rentPrice = this.state.focus.rentPrice;
        if (!rentPrice) {
            notify({
                message: "Warning:",
                description: "Not for rent",
            });
        } else {
            let x = this.state.focus.x;
            let y = this.state.focus.y;
            notify({
                message: "Renting...",
            });
            this.props.setAcceptRentTrigger({
                x: this.state.focus.x,
                y: this.state.focus.y,
                price: solToLamports(rentPrice / 86400), // convert days to seconds
                rent_time: 500, // TODO: make a input for this
                owner: this.state.focus.owner,
                mint: this.state.focus.mint,
            });
        }
    }

    purchaseSpaces = () => {
        this.props.setPurchaseSpacesTrigger({ purchasableInfo: this.state.selecting.purchasableInfo });
        notify({
            message: "Buying...",
        });
        this.setState({
            selecting: {
                ...this.state.selecting,
                purchasable: new Set(),
                purchasableInfo: [],
                totalPrice: 0,
            },
        });
    }

    rentSpaces = () => {
        console.log(this.state.selecting.rentableInfo);
        this.props.setAcceptRentsTrigger({
            rentableInfo: this.state.selecting.rentableInfo,
            rent_time: 500, // TODO: make a input for this
        });
        notify({
            message: "Renting...",
        });
        this.setState({
            selecting: {
                ...this.state.selecting,
                rentable: new Set(),
                rentableInfo: [],
                totalPrice: 0,
            },
        });
    }

    loadPurchasableInfo = async () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                loadingPricesStatus: 1,
                purchasableInfoAll: [],
                purchasableInfo: [],
                purchasable: new Set(),
                totalPrice: NaN,
            },
        });
        
        let purchasableInfoAll;
        loading(null, "loading price info", null);
        try { // run props.database query
            purchasableInfoAll = await this.props.database.getPurchasableInfo(this.props.user, this.state.selecting.poses);
            // throw Error;
        } catch(e) { // if error getting from db, run RPC calls
            console.error(e);
            console.log("RPC call for getting purchasable info");
            purchasableInfoAll = await this.props.server.getPurchasableInfo(this.props.connection, this.props.user, this.state.selecting.poses);
        }
        loading(null, "loading price info", "success");
        this.setState({
            selecting: {
                ...this.state.selecting,
                loadingPricesStatus: 2,
                purchasableInfoAll,
            },
        });
    }

    loadRentableInfo = async () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                loadingRentStatus: 1,
                rentableInfoAll: [],
                rentableInfo: [],
                rentable: new Set(),
                totalRentPrice: NaN,
            },
        });
        
        let rentableInfoAll;
        loading(null, "loading rent info", null);
        try { // run props.database query
            rentableInfoAll = await this.props.database.getRentableInfo(this.props.user, this.state.selecting.poses);
        } catch(e) { // if error getting from db, run RPC calls
            console.error(e);
            console.log("RPC call for getting rentable info");
            rentableInfoAll = await this.props.server.getRentableInfo(this.props.connection, this.props.user, this.state.selecting.poses);
        }
        loading(null, "loading rent info", "success");
        this.setState({
            selecting: {
                ...this.state.selecting,
                loadingRentStatus: 2,
                rentableInfoAll,
            },
        });
    }

    resetTargets = () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                purchasable: new Set(),
                purchasableInfo: [],
                totalPrice: null,
                rentable: new Set(),
                rentableInfo: [],
                totalRentPrice: null,
            },
        });
    }

    handleTargetAll = async () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                targetStatus: 1,
            },
        });
        let totalPrice = 0;
        let purchasable = new Set();
        let purchasableInfo = [];
        for (const info of this.state.selecting.purchasableInfoAll) {
            const { x, y, mint, price } = info;
            totalPrice += price;
            purchasable.add(JSON.stringify({ x, y }));
            purchasableInfo.push(info);
        }

        if (purchasable.size === 0) {
            totalPrice = NaN;
            notify({
                message: "No Spaces available to buy",
            });
        }
        this.setState({
            selecting: {
                ...this.state.selecting,
                purchasable,
                purchasableInfo,
                totalPrice: lamportsToSol(totalPrice),
                targetStatus: 2,
            },
        });
    }
    handleTargetRentAll = async () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                targetStatus: 1,
            },
        });
        let totalPrice = 0;
        let rentable = new Set();
        let rentableInfo = [];
        for (const info of this.state.selecting.rentableInfoAll) {
            const { x, y, mint, price } = info;
            totalPrice += price;
            rentable.add(JSON.stringify({ x, y }));
            rentableInfo.push(info);
        }

        if (rentable.size === 0) {
            totalPrice = NaN;
            notify({
                message: "No Spaces available to rent",
            });
        }
        this.setState({
            selecting: {
                ...this.state.selecting,
                rentable,
                rentableInfo,
                totalRentPrice: lamportsToSol(totalPrice * 86400), // convert seconds to days
                targetStatus: 2,
            },
        });
    }

    getFloor = (infoAll, n, m) => {
        const poses = [...this.state.selecting.poses];
        const topLeft = JSON.parse(poses[0]);
        const bottomRight = JSON.parse(poses[poses.length - 1]);
        const r = bottomRight.x - topLeft.x + 1;
        const c = bottomRight.y - topLeft.y + 1;
        const offsetX = topLeft.x;
        const offsetY = topLeft.y;
        let listed = Array.from({ length: r + 1 }, () => new Array(c + 1).fill(0));
        let prices = Array.from({ length: r + 1 }, () => new Array(c + 1).fill(0));
        let infos = Array.from({ length: r + 1 }, () =>
            new Array(c + 1).fill(null)
        );
        let purchasableInfo = infoAll;

        if (m > r || n > c || m <= 0 || n <= 0) {
            let purchasable = new Set();
            let floor = NaN;
            return {purchasable, purchasableInfo, floor};
        }

        for (let info of purchasableInfo) {
            // fill arrays
            const { x, y, mint, price } = info;
            listed[x - offsetX + 1][y - offsetY + 1] = 1;
            prices[x - offsetX + 1][y - offsetY + 1] = price;
            infos[x - offsetX + 1][y - offsetY + 1] = info;
        }

        // make prices the sum from (0,0) to (i,j), same with listed
        for (let i = 1; i <= r; i++) {
            for (let j = 1; j <= c; j++) {
                prices[i][j] +=
                    prices[i - 1][j] + prices[i][j - 1] - prices[i - 1][j - 1];
                listed[i][j] +=
                    listed[i - 1][j] + listed[i][j - 1] - listed[i - 1][j - 1];
            }
        }

        let floor = Number.MAX_VALUE;
        let floorX = NaN;
        let floorY = NaN;
        for (let i = m; i <= r; i++) {
            // find floor
            for (let j = n; j <= c; j++) {
                const currPrice =
                    prices[i][j] -
                    prices[i - m][j] -
                    prices[i][j - n] +
                    prices[i - m][j - n];
                const numListed =
                    listed[i][j] -
                    listed[i - m][j] -
                    listed[i][j - n] +
                    listed[i - m][j - n];
                if (numListed === m * n && currPrice < floor) {
                    // check if all are listed
                    floor = currPrice;
                    floorX = i;
                    floorY = j;
                }
            }
        }

        let purchasable = new Set();
        if (isNaN(floorX) && isNaN(floorY)) {
            // if no m x n block is all listed
            floor = NaN;
        } else {
            // update purchasable
            for (let i = floorX - m + 1; i <= floorX; i++) {
                for (let j = floorY - n + 1; j <= floorY; j++) {
                    purchasable.add(
                        JSON.stringify({ x: i + offsetX - 1, y: j + offsetY - 1 })
                    );
                }
            }
        }
        purchasableInfo = purchasableInfo.filter(({ x, y }) => purchasable.has(JSON.stringify({ x, y })));
        return {spaces: purchasable, info: purchasableInfo, floor};
    }

    handleTargetFloor = async () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                targetStatus: 1,
            },
        });
        let {spaces, info, floor} = this.getFloor(this.state.selecting.purchasableInfoAll, this.state.selecting.floorN, this.state.selecting.floorM);

        this.setState({
            selecting: {
                ...this.state.selecting,
                targetStatus: 2,
                purchasable: spaces,
                purchasableInfo: info,
                totalPrice: lamportsToSol(floor),
            },
        });
    }

    handleTargetRentFloor = async () => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                targetRentStatus: 1,
            },
        });
        let {spaces, info, floor} = this.getFloor(this.state.selecting.rentableInfoAll, this.state.selecting.floorN, this.state.selecting.floorM);

        this.setState({
            selecting: {
                ...this.state.selecting,
                targetRentStatus: 2,
                rentable: spaces,
                rentableInfo: info,
                totalRentPrice: lamportsToSol(floor * 86400), // convert seconds to days
            },
        });
    }

    moveToSpaces = (spaces) => {
        if (spaces.size > 0) {
            const bounds = getBounds(spaces);
            requestAnimationFrame(() => {
                this.board.current.drawCanvasCache({
                    x: bounds.left,
                    y: bounds.top,
                    width: bounds.right - bounds.left + 1,
                    height: bounds.bottom - bounds.top + 1,
                });
                this.board.current.drawSelected();
            });
            setTimeout(() => {
                this.resetSelecting();
                this.setSelecting(new Set(spaces));
            }, 1000);
        } else {
            notify({
                message: "No Spaces Selected",
            });
        }
    }

    handleGetMySpaces = async () => {
        if (!this.props.user){
            return;
        }
        this.setState({
            mySpacesMenuOpen: false,
            mySpacesMenuAnchorEl: null,
        });

        loading(null, "Getting your Spaces", null);
        let data;
        try{
            data = await this.props.database.getSpacesByOwner(this.props.user);
        }
        catch (e){
            console.error(e);
            data = this.props.server.getSpacesByOwner(this.props.connection, this.props.user);
        }
        const spaces = data.spaces;
        const mints = data.mints;
        this.props.setOwnedSpaces(spaces); // set spaces and mints on hooks side
        this.props.setOwnedMints(mints);

        this.moveToSpaces(spaces);
        loading(null, "Getting your Spaces", "success");
    }

    handleGetMyListings = async () => {
        this.setState({
            mySpacesMenuOpen: false,
            mySpacesMenuAnchorEl: null,
        });

        loading(null, "Getting your listings", null);
        let data;
        try{
            data = await this.props.database.getListedSpaces(this.props.user);
        }
        catch(e){
            console.error(e);
            notify({
                message: "Get listings failed",
            });
            loading(null, "Getting your listings", "error");
            return;
        }
        const spaces = data.spaces;

        this.moveToSpaces(spaces);
        loading(null, "Getting your listings", "success");
    }

    addNewFrame = async () => {
        const n_x = this.state.neighborhood.n_x;
        const n_y = this.state.neighborhood.n_y;
        this.props.setNewFrameTrigger({ n_x: n_x, n_y: n_y });
        notify({
            message: "Adding new frame",
        });
    }

    expand = (neighborhood) => {
        this.props.setNewNeighborhoodTrigger(neighborhood);
        notify({
            message: "Initializing new Neighborhood...",
        });

        // const n_x = Math.floor(this.focus.x / NEIGHBORHOOD_SIZE);
        // const n_y = Math.floor(this.focus.y / NEIGHBORHOOD_SIZE);
        // requestAnimationFrame(() => {
        //     this.drawCanvasCache({x: n_x * NEIGHBORHOOD_SIZE, y: n_y * NEIGHBORHOOD_SIZE, width: NEIGHBORHOOD_SIZE, height: NEIGHBORHOOD_SIZE});
        //     this.drawNTracker();
        //     this.drawSelected();
        // })
    }

    register = () => {
        this.setState({
            mySpacesMenuOpen: false,
            mySpacesMenuAnchorEl: null,
        });
        this.props.setRegisterTrigger(true);
        notify({
            message: "Registering all Spaces...",
        });
    }

    handleFindSpaces = async () => {
        this.setState({ findingSpaces: true });
        const text = document.getElementById("address-textfield").value;
        let found = false;
        if (text) {
            if (text.includes(",")) {
                // coordinates case
                try {
                    let coordinates = text.split(",");
                    coordinates[0] = coordinates[0].replace("(", ""); // remove parentheses if there are any
                    coordinates[1] = coordinates[1].replace(")", "");
                    const x = parseInt(coordinates[0]);
                    const y = parseInt(coordinates[1]);
                    if (!isNaN(x) && !isNaN(y)) {
                        this.setFocus(x, y);
                        requestAnimationFrame(() => {
                            this.board.current.drawCanvasCache({
                                x,
                                y,
                                width: 1,
                                height: 1,
                            });
                            this.board.current.drawSelected();
                        });
                        found = true;
                    }
                } catch (e) {
                    console.log(e);
                    found = false;
                }
            } else {
                // pubkey case
                // const data = await this.props.server.getSpacesByOwner(
                //     this.props.connection,
                //     text,
                //     true
                // );
                try {
                    loading(null, "Finding Spaces", null);
                    const pubkey = new PublicKey(text); // make sure valid pubkey
                    let data;
                    try{
                        data = await this.props.database.getSpacesByOwner(pubkey);
                    } catch(e){
                        console.error(e);
                        data = await this.props.server.getSpacesByOwner(this.props.connection, pubkey, true);
                    }
                    if (data && data["spaces"]) {
                        const msg =
                            data["spaces"].size > 0 ? "Spaces shown on map" : "No Spaces found";
                        notify({
                            message: "Finding Spaces...",
                            description: msg,
                        });
                        if (data["spaces"].size > 0) {
                            this.setSelecting(new Set(data["spaces"]));
                            const bounds = getBounds(data["spaces"]);
                            requestAnimationFrame(() => {
                                this.board.current.drawCanvasCache({
                                    x: bounds.left,
                                    y: bounds.top,
                                    width: bounds.right - bounds.left + 1,
                                    height: bounds.bottom - bounds.top + 1,
                                });
                                this.board.current.drawSelected();
                            });
                        }
                        found = true;
                    }
                    loading(null, "Finding Spaces", "success");
                } catch (e) {
                    console.log(e);
                    loading(null, "Finding Spaces", "error");
                    found = false;
                }
            }
        }
        if (!found) {
            notify({
                message: "Please enter a valid wallet address or a valid x, y location",
            });
        }
        this.setState({ findingSpaces: false });
    }

    isOwn = (x, y) => {
        return this.props.ownedSpaces.has(JSON.stringify({ x, y }));
    }

    rgbatoString = (rgb) => {
        return "#" + rgb.toString("hex");
    }

    rgbtoString = (r, g, b) => {
        return (
            "#" +
            [r, g, b]
                .map((x) => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? "0" + hex : hex;
                })
                .join("")
        );
    }

    handleChangeAnims = async (e) => {
        let anims = e.target.checked;

        this.setState({
            anims: anims,
            animsInfoLoaded: false
        });

        let k = this.state.frame;

        if (anims) {
            clearInterval(this.intervalFetchColors);
            loading(null, "Loading frames", null);
            await this.fetch_colors_all_frames();
            loading(null, "Loading frames", "success");
            this.intervalChangeFrame = setInterval(() => {
                if (document.hidden){
                    return;
                }
                const start = this.viewport.neighborhood_start;
                const end = this.viewport.neighborhood_end;

                for (let n_x = start[0]; n_x < end[0]; n_x++) {
                    for (let n_y = start[1]; n_y < end[1]; n_y++) {
                        let key = JSON.stringify({ n_x, n_y });
                        if (key in this.viewport.neighborhood_colors_all_frames) {
                            let datalen =
                                this.viewport.neighborhood_colors_all_frames[key].length;
                            this.viewport.neighborhood_colors[key] =
                                this.viewport.neighborhood_colors_all_frames[key][k % datalen];
                        }
                    }
                }
                requestAnimationFrame(() => {
                    this.board.current.drawCanvas();
                });
                k = k + 1;
            }, ANIMATION_INTERVAL);
        } else {
            clearInterval(this.intervalChangeFrame);
            await this.fetch_colors(this.state.frame);
            requestAnimationFrame(() => {
                this.board.current.drawCanvas();
            });
            this.intervalFetchColors = setInterval(async () => {
                if (document.hidden){
                    return;
                }
                await this.fetch_colors(this.state.frame);
            }, FETCH_COLORS_INTERVAL);
        }
        this.setState({
            anims: anims,
            animsInfoLoaded: true
        });
    }

    handleChangeColor = (e) => {
        this.setState({
            focus: {
                ...this.state.focus,
                color: e.target.value,
            },
        });
    }

    handleChangeFrame = async (e) => {
        loading(null, "Loading frame", null);
        await this.fetch_colors(e.target.value);
        loading(null, "Loading frame", "success");
        const x = this.state.focus.x;
        const y = this.state.focus.y;
        const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
        const n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
        const p_y =
            ((y % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
        const p_x =
            ((x % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
        let key = JSON.stringify({ n_x, n_y });
        this.setState({
            frame: e.target.value,
            focus: {
                ...this.state.focus,
                color:
                    key in this.viewport.neighborhood_colors
                        ? this.viewport.neighborhood_colors[key][p_y][p_x]
                        : 0,
            },
        });
        requestAnimationFrame(() => {
            this.board.current.drawCanvas();
        });
    }

    handleChangeColors = (e) => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                color: e.target.value,
            },
        });
    }

    handleChangeImg = (e) => {
        let files = e.target.files; // FileList object

        // use the 1st file from the list if it exists
        if (files.length > 0) {
            let f = files[0];
            this.setState({ img_upl: f, has_img: true });
        }
    }

    handleChangeFocusPrice = (e) => {
        this.setState({
            focus: {
                ...this.state.focus,
                price: e.target.value,
            },
        });
    }
    handleChangeFocusRentPrice = (e) => {
        this.setState({
            focus: {
                ...this.state.focus,
                rentPrice: e.target.value,
            },
        });
    }
    handleChangeSelectingPrice = (e) => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                price: e.target.value,
            },
        });
    }
    handleChangeSelectingRentPrice = (e) => {
        this.setState({
            selecting: {
                ...this.state.selecting,
                rentPrice: e.target.value,
            },
        });
    }

    resetFocus = () => {
        this.setState({
            focus: {
                focus: false,
                x: 0,
                y: 0,
                color: "#000000",
                owner: "",
                owned: false,
                hasPrice: false,
                price: null,
                mint: null,
                infoLoaded: false,
                imgLoaded: false,
                neighborhood_name: null,
                hasRentPrice: false,
                rentPrice: null,
                minDuration: null,
                maxDuration: null,
                maxTimestamp: null,
                renter: null,
                rentEnd: null,
                rentee: null,
            },
        });
    }

    resetNeighborhood = () => {
        this.setState({
            neighborhood: {
                focused: false,
                n_x: 0,
                n_y: 0,
                infoLoaded: false,
                numFrames: 0,
                trades: {},
            }
        });
    }

    resetSelecting = () => {
        this.setState({
            selecting: {
                selecting: false,
                poses: new Set(),
                color: "#000000",
                price: null,
                loadingPricesStatus: 0,
                purchasableInfoAll: new Array(),
                purchasableInfo: new Array(),
                purchasable: new Set(),
                totalPrice: NaN,
                rentPrice: null,
                loadingRentStatus: 0,
                rentableInfoAll: new Array(),
                rentableInfo: new Array(),
                rentable: new Set(),
                totalRentPrice: NaN,
                floorM: 1,
                floorN: 1,
            },
        });
    }

    setFocus = async (x, y) => {
        this.resetSelecting();
        this.resetNeighborhood();
        //await this.resetFocus();
        this.setState({
            showNav: true,
            focus: {
                ...this.state.focus,
                focus: true,
                x,
                y,
                infoLoaded: false,
                imgLoaded: this.state.focus.imgLoaded && (x == this.state.focus.x, y == this.state.focus.y) // true if img already loaded and focus unchanged
            },
        });
        const connection = this.props.connection;
        // let space_metadata_data = await this.props.server.getSpaceMetadata(
        //   connection,
        //   x,
        //   y
        // );
        let info;
        try { // run props.database query
            // info = await this.props.database.getSpaceInfoWithRent(x, y);
            info = await this.props.database.getSpaceMetadata(x, y);
        } catch(e) { // if fails, run RPC call
            console.error(e);
            console.log("RPC call for Space metadata");
            // info = await this.props.server.getSpaceInfoWithRent(connection, x, y);
            info = await this.props.server.getSpaceMetadata(connection, x, y);
        }

        if (info.hasPrice) {
            info.price = lamportsToSol(info.price);
        } else {
            info.price = null;
        }
        let owned =
            (this.props.ownedSpaces &&
                this.props.ownedSpaces.has(JSON.stringify({ x, y }))) ||
            (this.props.user && this.props.user === info.owner);
        

        // if (info.hasRentPrice){
        //     info.rentPrice = lamportsToSol(info.rentPrice * 86400); // convert seconds to day
        // }
        // else{
        //     info.rentPrice = null;
        // }

        const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
        const n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
        let p_y = ((y % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
        let p_x = ((x % NEIGHBORHOOD_SIZE) + NEIGHBORHOOD_SIZE) % NEIGHBORHOOD_SIZE;
        let neighborhood_name = "";
        let key = JSON.stringify({ n_x, n_y });
        if (key in this.viewport.neighborhood_names) {
            neighborhood_name = this.viewport.neighborhood_names[key];
        }

        console.log(info);

        if (!this.state.focus.focus || this.state.focus.x !== x || this.state.focus.y !== y) { // sidebar changed
            return;
        }

        
        this.setState({
            focus: {
                ...this.state.focus,
                color:
                    key in this.viewport.neighborhood_colors
                        ? this.viewport.neighborhood_colors[key][p_y][p_x]
                        : "#000000",
                owned: owned,
                infoLoaded: true,
                neighborhood_name: neighborhood_name,
                ...info,
            },
            showNav: true,
        });
    }

    setNeighborhood = async (n_x, n_y) => {
        this.resetSelecting();
        this.resetFocus();
        this.setState({
            showNav: true,
            neighborhood: {
              focused: true,
              n_x,
              n_y,
              infoLoaded: false
            },
          });
        let numFrames, trades;
        try{
            [numFrames, trades] = await Promise.all([
                this.props.server.getNumFrames(this.props.connection, n_x, n_y),
                this.props.database.getNeighborhoodStats(n_x, n_y),
            ]);
        } catch(e){
            console.error(e);
            numFrames = 0;
            trades = {};
        }
        console.log("NEIGHBOR SIDEBAR");
        if (!this.state.neighborhood.focused){ // sidebar changed
            return;
        }
        this.setState({
          showNav: true,
          neighborhood: {
            focused: true,
            n_x,
            n_y,
            infoLoaded: true,
            numFrames,
            trades,
          },
        });
    }

    setSelecting = (poses) => {
        this.resetNeighborhood();
        this.resetFocus();
        if (poses.size === 0) {
            this.resetSelecting();
            this.setState({showNav: false});
        } else {
            this.setState({
                showNav: true,
                selecting: {
                    ...this.state.selecting,
                    selecting: true,
                    poses,
                    loadingPricesStatus: 0,
                    targetStatus: 0,
                    purchasableInfo: new Array(),
                    purchasable: new Set(),
                    totalPrice: NaN,
                    floorM: 1,
                    floorN: 1,
                },
                img_upl: null,
                has_img: false,
            });
        }
    }

    getSelectOwnedBlocks = () => {
        var options = this.props.ownedSpaces;
        let keys = [];
        for (const p of options) {
            var opt = JSON.parse(p);
            keys.push(<MenuItem value={opt}>{opt}</MenuItem>);
        }
        return keys;
    }

    handleChangeFloorM = (e) => {
        const floorM = parseInt(e.target.value);
        this.setState({
            selecting: {
                ...this.state.selecting,
                floorM,
            },
        });
    }

    handleChangeFloorN = (e) => {
        const floorN = parseInt(e.target.value);
        this.setState({
            selecting: {
                ...this.state.selecting,
                floorN,
            },
        });
    }

    handleRefreshUserSpaces = async () => {
        this.setState({
            mySpacesMenuOpen: false,
            mySpacesMenuAnchorEl: null,
        });
        this.setState({refreshingUserSpaces: true});
        console.log("refreshing user Spaces");
        let data = await this.props.server.getSpacesByOwner(this.props.connection, this.props.user);
        const spaces = data.spaces;
        const mints = data.mints;

        // let changed = false;
        // if (spaces.size != this.props.ownedSpaces.size){
        //     changed = true;
        // }
        // for (let space of spaces){
        //     if (!this.props.ownedSpaces.has(space)){
        //         changed = true;
        //         break;
        //     }
        // }

        loading(null, 'Refreshing', null);
        let error = false;
        try{
            await this.props.database.register(this.props.user, mints);
        } catch(e){
            console.error(e);
            error = true;
        }
        this.props.setOwnedSpaces(spaces); // set spaces and mints on hooks side
        this.props.setOwnedMints(mints);
        
        if (error){
            notify({
                description: "Refresh failed, please try again later",
            });
        }
        else{
            notify({
                description: "Refresh complete",
            });
        }

        this.setState({refreshingUserSpaces: false});
        loading(null, 'Refreshing', error ? "error" : "success");
    }

    handleFocusRefresh = async () => {
        this.setState({ // trigger loading icon
            showNav: true,
            focus: { 
                ...this.state.focus,
                infoLoaded: false,            
            },
        });
        let x = this.state.focus.x;
        let y = this.state.focus.y;
        let space_metadata_data = await this.props.server.getSpaceMetadata(this.props.connection, x, y);
        let owner = space_metadata_data.owner;
        let mint = space_metadata_data.mint;
        let key = JSON.stringify({x, y});
        let owners = {[key]: owner};
        let mints = {[key]: mint};
        try{
            await this.props.database.updateSpaceInfo(owners, mints);
        } catch (e){
            console.error(e);
        }

        // refresh info client side
        try{
            const data = await this.props.database.getSpacesByOwner(this.props.user);
            this.props.setOwnedSpaces(data.spaces); // set spaces and mints on hooks side
            this.props.setOwnedMints(data.mints);
        }
        catch(e){
            console.error(e);
        }

        // set focus, if focus hasn't changed
        if (x == this.state.focus.x && y == this.state.focus.y){
            this.setFocus(this.state.focus.x, this.state.focus.y);
        }
    }

    handleSelectingRefresh = async () => {
        let infos = await this.props.server.getSpaceInfos(this.props.connection, this.state.selecting.poses);

        let owners = {};
        let mints = {};
        for (let info of infos){
            let key = JSON.stringify({x: info.x, y: info.y})
            owners[key] = info.owner;
            mints[key] = info.mint;
        }

        loading(null, "refreshing", null);
        let error = false;
        try{
            await this.props.database.updateSpaceInfo(owners, mints);
        }
        catch (e){
            console.error(e);
            error = true;
        }

        // refresh info client side
        try{
            const data = await this.props.database.getSpacesByOwner(this.props.user);
            this.props.setOwnedSpaces(data.spaces); // set spaces and mints on hooks side
            this.props.setOwnedMints(data.mints);
        }
        catch(e){
            console.error(e);
        }

        if (error){
            notify({
                description: "Refresh failed, please try again later",
            });
        }
        else{
            notify({
                description: "Refresh complete",
            });
        }

        loading(null, "refreshing", "success");
    }

    setColorView = () => {
        this.viewport.view = 0;
        this.board.current.resetCanvas();
        this.setState({
            viewMenuOpen: false,
            viewMenuAnchorEl: null,
        });
    }
    setPriceView = () => {
        clearInterval(this.intervalChangeFrame);
        this.intervalFetchColors = setInterval(async () => {
            if (document.hidden){
                return;
            }
            await this.fetch_colors(this.state.frame);
        }, FETCH_COLORS_INTERVAL);
        this.viewport.view = 1;
        this.board.current.resetCanvas();
        this.setState({
            anims: false,
            animsInfoLoaded: true,
            viewMenuOpen: false,
            viewMenuAnchorEl: null,
        });
    }

    copyCurrentView = (e) => {
        const width = this.board.current.width;
        const height = this.board.current.height;
        const scale = Math.round(this.board.current.scale);
        const x = Math.round((width * 0.5 - this.board.current.x) / scale);
        const y = Math.round((height * 0.5 - this.board.current.y) / scale);
        const fraction = Math.round(scale * NEIGHBORHOOD_SIZE / height * 100);
        let prefix = window.location.hostname;
        if (window.location.port) { // for localhost
            prefix += ":" + window.location.port;
        }
        navigator.clipboard.writeText(`https://${prefix}/locator/${x}/${y}/${fraction}`);
        notify({
            description: "URL copied to clipboard",
        });
        this.setState({
            shareMenuOpen: false,
            shareMenuAnchorEl: null,
        });
    }

    copyMyView = (e) => {
        if (this.props.user) { // if user is logged in
            let prefix = window.location.hostname; 
            if (window.location.port) { // for localhost
                prefix += ":" + window.location.port;
            }
            navigator.clipboard.writeText(`https://${prefix}/pubkey/${this.props.user}`);
            notify({
                description: "URL copied to clipboard",
            });
        } else {
            notify({
                description: "Not logged in",
            });
        }
        this.setState({
            shareMenuOpen: false,
            shareMenuAnchorEl: null,
        });
    }

    handleViewMenuOpen = (e) => {
        this.setState({
            viewMenuOpen: true,
            viewMenuAnchorEl: e.currentTarget,
        });
    }

    handleViewMenuClose = () => {
        this.setState({
            viewMenuOpen: false,
            viewMenuAnchorEl: null,
        });
    }

    handleShareMenuOpen = (e) => {
        this.setState({
            shareMenuOpen: true,
            shareMenuAnchorEl: e.currentTarget,
        });
    }

    handleShareMenuClose = () => {
        this.setState({
            shareMenuOpen: false,
            shareMenuAnchorEl: null,
        });
    }

    handleMySpacesMenuOpen = (e) => {
        this.setState({
            mySpacesMenuOpen: true,
            mySpacesMenuAnchorEl: e.currentTarget,
        });
    }

    handleMySpacesMenuClose = () => {
        this.setState({
            mySpacesMenuOpen: false,
            mySpacesMenuAnchorEl: null,
        });
    }

    render() {
        if (this.state.initialFetchStatus == 0){
            return (
                <LoadingScreen/>
            );
        }
        let info = <FocusSidebar
            ownedSpaces={this.props.ownedSpaces}
            focus={this.state.focus}
            user={this.props.user}
            colorApplyAll={this.state.colorApplyAll}
            frame={this.state.frame}
            handleOnImgLoad={() => this.setState({ focus: { ...this.state.focus, imgLoaded: true } })}
            handleChangeColorApplyAll={this.handleChangeColorApplyAll}
            handleChangeColor={this.handleChangeColor}
            changeColor={this.changeColor}
            purchaseSpace={this.purchaseSpace}
            handleChangeFocusPrice={this.handleChangeFocusPrice}
            changePrice={this.changePrice}
            delistSpace={this.delistSpace}
            handleFocusRefresh={this.handleFocusRefresh}
            handleChangeFocusRentPrice={this.handleChangeFocusRentPrice}
            changeRent={this.changeRent}
            delistRent={this.delistRent}
            rentSpace={this.rentSpace}
            scale={this.board.current ? this.board.current.scale : null}
            height={this.board.current ? this.board.current.height: null}
            />;
        if (this.state.selecting.selecting) {
            info = <SelectingSidebar
                ownedSpaces={this.props.ownedSpaces}
                selecting={this.state.selecting}
                user={this.props.user}
                colorApplyAll={this.state.colorApplyAll}
                frame={this.state.frame}
                handleChangeColorApplyAll={this.handleChangeColorApplyAll}
                handleChangeColors={this.handleChangeColors}
                changeColors={this.changeColors}
                handleChangeImg={this.handleChangeImg}
                uploadImage={this.uploadImage}
                hasImage={this.state.has_img}
                handleChangeSelectingPrice={this.handleChangeSelectingPrice}
                changePrices={this.changePrices}
                delistSpaces={this.delistSpaces}
                loadPurchasableInfo={this.loadPurchasableInfo}
                resetTargets={this.resetTargets}
                handleTargetAll={this.handleTargetAll}
                handleTargetFloor={this.handleTargetFloor}
                purchaseSpaces={this.purchaseSpaces}
                handleSelectingRefresh={this.handleSelectingRefresh}
                handleChangeSelectingRentPrice={this.handleChangeSelectingRentPrice}
                changeRents={this.changeRents}
                delistRents={this.delistRents}
                loadRentableInfo={this.loadRentableInfo}
                handleTargetRentAll={this.handleTargetRentAll}
                handleTargetRentFloor={this.handleTargetRentFloor}
                rentSpaces={this.rentSpaces}
                handleChangeFloorM={this.handleChangeFloorM}
                handleChangeFloorN={this.handleChangeFloorN}
                scale={this.board.current ? this.board.current.scale : null}
                height={this.board.current ? this.board.current.height : null}
                canvasSize = {Math.min(SIDE_NAV_WIDTH, window.innerWidth - 48)}
                img_upl={this.state.img_upl}
            />
        }
        else if (this.state.neighborhood.focused) {
            const n_x = this.state.neighborhood.n_x;
            const n_y = this.state.neighborhood.n_y;
            info = <NeighborhoodSidebar
                neighborhood={this.state.neighborhood}
                name = { this.viewport.neighborhood_names[JSON.stringify({ n_x:  this.state.neighborhood.n_x, n_y : this.state.neighborhood.n_y })]} 
                canvas = {this.board.current.canvasCache[JSON.stringify({ n_x, n_y })]}
                canvasSize = {Math.min(SIDE_NAV_WIDTH, window.innerWidth - 48)}
                addNewFrame={this.addNewFrame}
                setSelecting={this.setSelecting}
            />;
        }
        let nspaces = this.props.ownedSpaces.size;
        return (
            <div className="game">
                <Board
                    ownedSpaces={this.props.ownedSpaces}
                    ref={this.board}
                    getMap={() => this.viewport.view == 0 ? this.viewport.neighborhood_colors : this.viewport.neighborhood_prices}
                    getNeighborhoodNames={() => this.viewport.neighborhood_names}
                    user={this.props.user}
                    onViewportChange={(startx, starty, endx, endy) => {
                        this.viewport.neighborhood_start = [startx, starty];
                        this.viewport.neighborhood_end = [endx, endy];
                    }}
                    prepare={async () => await this.fetch_colors(0)}
                    click={this.setFocus}
                    clickNeighborhood={this.setNeighborhood}
                    selecting={this.state.selecting}
                    reset={this.resetSelecting}
                    shiftClick={async (x) =>
                        this.setSelecting(
                            xor(this.state.selecting.poses || new Set(), x)
                        )
                    }
                    altClick={async (x) =>
                        this.setSelecting(x)
                    }
                    clicked={this.state.focus.focus}
                    clicked_x={this.state.focus.x}
                    clicked_y={this.state.focus.y}
                    expand={(n) => {
                        this.expand(n);
                    }}
                    locator={this.props.locator}
                />
                <div
                    className="sidenav"
                    style={{ width: this.state.showNav ? Math.min(SIDE_NAV_WIDTH, window.innerWidth - 48) : 0 }}
                >
                    <div href="#" className="close" onClick={() => this.closeSideNav()}>
                        <CancelIcon />
                    </div>
                    {info}
                </div>

                <Box
                    sx={{
                        display: "flex",
                        bgcolor: "action.disabledBackground",
                    }}
                    minWidth="100%"
                    className={"headerMenu"}
                >
                    
                    <Box
                        sx={{
                            display: "flex",
                            height: "63px",
                            justifyContent: "flex-start",
                            alignItems: "center",
                            marginLeft: "20px", // TODO
                        }}
                    >
                        <Tooltip title="Change view">
                            <Button
                                variant="contained"
                                className={"defaultButton"}
                                id="view-button"
                                aria-controls={this.state.viewMenuOpen ? 'view-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={this.state.viewMenuOpen ? 'true' : undefined}
                                onClick={(e) => this.handleViewMenuOpen(e)}
                                endIcon={<KeyboardArrowDownIcon />}
                                sx={{marginRight: "10px"}}
                            >
                                {this.viewport.view == 0 ? "Colors" : "Prices"}
                            </Button>
                        </Tooltip>
                        <Menu
                            id="view-menu"
                            aria-labelledby="view-button"
                            anchorEl={this.state.viewMenuAnchorEl}
                            open={this.state.viewMenuOpen}
                            onClose={() => this.handleViewMenuClose()}
                        >
                            <MenuItem onClick={(e) => this.setColorView()}>Colors</MenuItem>
                            <MenuItem onClick={(e) => this.setPriceView()}>Prices</MenuItem>
                        </Menu>
                        <FormControl>
                            <FormControlLabel
                                disabled={!this.state.animsInfoLoaded || this.viewport.view != 0}
                                control={
                                    <Switch
                                        onChange={(e) => this.handleChangeAnims(e)}
                                        checked={this.state.anims}
                                    />
                                }
                                label="Animations"
                            />
                        </FormControl>
                        <Tooltip title="Select frame to view" placement="top">
                            <Select
                                variant="standard"
                                value={this.state.frame}
                                disabled={this.state.anims || this.viewport.view != 0}
                                onChange={(e) => {
                                    this.handleChangeFrame(e);
                                }}
                                label="Frame"
                                sx={{ marginRight: "10px", borderRadius: "40px" }}
                            >
                                {Array.from({ length: this.state.maxFrame }, (x, i) => (
                                    <MenuItem value={i} key={"frame" + i}>
                                        {" "}
                                        {`${i}`}{" "}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Tooltip>
                        {!this.mobile &&
                        <>
                            <div className={"animationsSeparator"}></div>
                        {/* <Tooltip title="Register your spaces to be able to find your spaces and change their colors">
                            <Button
                                variant="contained"
                                onClick={() => this.register()}
                                disabled={!this.props.loadedOwned}
                                sx={{
                                    marginRight: "10px",
                                    borderRadius: "40px",
                                    color: "#FFFFFF",
                                    background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                }}
                            >
                                Register
                            </Button>
                        </Tooltip> */}
                        {/* <Tooltip title="Refresh your spaces to match their blockchain state">
                            <Button
                                variant="contained"
                                onClick={this.handleRefreshUserSpaces}
                                disabled={!this.props.loadedOwned || this.state.refreshingUserSpaces}
                                sx={{
                                    borderRadius: "40px",
                                    color: "#FFFFFF",
                                    background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                }}
                            >
                                Refresh
                            </Button>
                        </Tooltip> */}
                        </>}
                        <Tooltip title="Number of viewers">
                            <Box sx={{marginLeft: "10px"}}>
                                <VisibilityIcon/> {this.props.viewer}
                            </Box>
                        </Tooltip>
                    </Box>
                    

                    <Box sx={{ flexGrow: 1 }}></Box>
                    {!this.mobile && <Box
                        sx={{
                            display: "flex",
                            height: "63px",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            marginRight: "36px", // TODO
                        }}
                    >
                        <Tooltip title="Copy link to share Spaces with others">
                            <Button
                                variant="contained"
                                className={"defaultButton"}
                                id="share-button"
                                aria-controls={this.state.shareMenuOpen ? 'share-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={this.state.shareMenuOpen ? 'true' : undefined}
                                onClick={(e) => this.handleShareMenuOpen(e)}
                                endIcon={<KeyboardArrowDownIcon />}
                            >
                                <CopyOutlined />
                                Share
                            </Button>
                        </Tooltip>
                        <Menu
                            id="share-menu"
                            aria-labelledby="share-button"
                            anchorEl={this.state.shareMenuAnchorEl}
                            open={this.state.shareMenuOpen}
                            onClose={() => this.handleShareMenuClose()}
                        >
                            <MenuItem onClick={(e) => this.copyCurrentView()}>Current View</MenuItem>
                            <MenuItem onClick={(e) => this.copyMyView()}>My Spaces</MenuItem>
                        </Menu>
                        <Tooltip

                            title="Enter a user's wallet address to select their Spaces or enter a location in the form of x,y">
                            <Search
                            id="address-textfield"
                            allowClear
                            onSearch={() => this.handleFindSpaces()}
                            disabled={this.state.findSpaces}
                            className="searchButton"
                            />
                        </Tooltip>

                        <Tooltip title="Click for your Spaces">
                            <Button
                                variant="contained"
                                disabled={!this.props.user || !this.props.loadedOwned || this.state.refreshingUserSpaces}
                                className={"defaultButton"}
                                id="myspaces-button"
                                aria-controls={this.state.mySpacesMenuOpen ? 'myspaces-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={this.state.mySpacesMenuOpen ? 'true' : undefined}
                                onClick={(e) => this.handleMySpacesMenuOpen(e)}
                                endIcon={<KeyboardArrowDownIcon />}
                            >
                                My Spaces
                            </Button>
                        </Tooltip>
                        <Menu
                                id="myspaces-menu"
                                aria-labelledby="myspaces-button"
                                anchorEl={this.state.mySpacesMenuAnchorEl}
                                open={this.state.mySpacesMenuOpen}
                                onClose={() => this.handleMySpacesMenuClose()}
                            >
                            <Tooltip title="Click to select all your Spaces" placement="right">
                                <MenuItem onClick={async () => await this.handleGetMySpaces()}>Show Spaces</MenuItem>
                            </Tooltip>
                            <Tooltip title="Click to select all your listed Spaces" placement="right">
                                <MenuItem onClick={async () => await this.handleGetMyListings()}>Show my Listed Spaces</MenuItem>
                            </Tooltip>
                            <Tooltip title="Refresh your Spaces to match their blockchain state" placement="right">
                                <MenuItem onClick={async () => await this.handleRefreshUserSpaces()}>Refresh Spaces</MenuItem>
                            </Tooltip>
                            <Tooltip title="Register your Spaces to be able to find your spaces and change their colors" placement="right">
                                <MenuItem onClick={() => this.register()}>Register Spaces</MenuItem>
                            </Tooltip>
                        </Menu>
                    </Box>}
                </Box>
                <div className="botnav" id="botnav"></div>
                {/* <div className="topnav" id="topnav">
                    <Button sx={{color: "white"}} onClick={() => {
                        this.moveToSpaces(this.state.selecting.poses)}}> All Selected</Button>
                    <Button sx={{color: "blue"}} onClick={() => {
                        this.moveToSpaces(new Set([...this.state.selecting.poses].filter(x=> this.props.ownedSpaces.has(x))))}}> Owned </Button>
                    <Button sx={{color: "yellow"}} onClick={() => {
                        this.moveToSpaces(this.state.selecting.purchasable)
                    }}> Purchasable</Button>
                    <Button sx={{color: "red"}} onClick={() => {
                        this.moveToSpaces(new Set([...this.state.selecting.poses].filter(
                            x=> (!this.props.ownedSpaces.has(x)) && (!this.state.selecting.purchasable.has(x)))))}}> Other </Button>
                    <Button sx={{color: "white"}}> Neighborhood </Button> 
                </div> */}
            </div>
        );
    }
}
