import React from "react";
import { PublicKey } from "@solana/web3.js";
import "./index.css";
import { Captcha } from "./captcha.js";
import { priceToColor, rentPriceToColor, colorHighlight } from "../../utils";
import { NEIGHBORHOOD_SIZE, UPPER } from "../../constants";
import {
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from "@mui/material";

const CLICK_THRESHOLD = 5;
const TOUCH_THRESHOLD = 10;
const LEFT = 500;

export class Board extends React.Component {
    constructor(props) {
        super(props);
        const locator = props.locator;
        this.interval = 0; // refresh
        this.canvasCache = { t: Date.now() };
        this.boxed = {};
        this.focus = {x: 0, y: 0};
        this.press = {
            pressed: false,
            x: 0,
            y: 0,
            start_x: 0,
            start_y: 0,
        };
        this.state = {
            inputConfig: false,
        };
        const width = window.innerWidth;
        const height = window.innerHeight - UPPER;
        this.width = width;
        this.height = height;
        this.fit = Math.min(
            100,
            this.height / NEIGHBORHOOD_SIZE,
            this.width / NEIGHBORHOOD_SIZE
        );

        this.scale = ("scale" in locator)? parseInt(locator.scale) * this.height / 100 / NEIGHBORHOOD_SIZE : height / 2 / NEIGHBORHOOD_SIZE;
        this.scale = Math.max(1, Math.round(this.scale));
        
        if ("x" in locator) {
            this.x = width * 0.5 - parseInt(locator.x) * this.scale;
        }
        else if ("col" in locator) {
            this.x = width * 0.5 - (parseInt(locator.col) + 0.5) * this.scale;
        }
        else if ("colStart" in locator && "colEnd" in locator) {
            this.x = width * 0.5 - 0.5*(parseInt(locator.colStart)+parseInt(locator.colEnd)) * this.scale;
        }
        else {
            this.x = 0.5 * width - (NEIGHBORHOOD_SIZE / 2) * this.scale;
        }

        if ("y" in locator) {
            this.y = height * 0.5 - parseInt(locator.y) * this.scale;
        }
        else if ("row" in locator) {
            this.y = height * 0.5 - (parseInt(locator.row) + 0.5) * this.scale;
        }
        else if ("rowStart" in locator && "rowEnd" in locator) {
            this.y = height * 0.5 - 0.5*(parseInt(locator.rowStart)+parseInt(locator.rowEnd)) * this.scale;
        }
        else {
            this.y = 0.5 * height - (NEIGHBORHOOD_SIZE / 2) * this.scale;
        }
        
        this.sensor = React.createRef();
        this.canvas = React.createRef();
        this.resizeHandler = this.resizeHandler.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onWheel = this.onWheel.bind(this);
        this.map = null;
        this.neighborhood_name = null;
        this.pinchCanche = null;
    }

    wheelHandler(event) {
        let scale = this.scale;
        const rect = this.sensor.current.getBoundingClientRect();
        const width = this.width;
        const height = this.height;
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const center_x = (offsetX - this.x) / scale;
        const center_y = (offsetY - this.y) / scale;
        const delta = event.deltaY / 2;
        scale -= Math.sign(delta) * Math.min(Math.max(1, Math.abs(delta)), scale);
        // TODO: maybe make this more clear?
        scale = Math.min(
            Math.max(
                scale,
                this.height /
                2 /
                (NEIGHBORHOOD_SIZE *
                    5) /* (NEIGHBORHOOD_SIZE * 5) used to be SIZE */,
                1
            ),
            this.height / 2
        );
        scale = Math.round(scale);
        const x = offsetX - center_x * scale;
        const y = offsetY - center_y * scale;
        const neighborhood_scale = scale * NEIGHBORHOOD_SIZE;
        this.props.onViewportChange(
            Math.floor(-x / neighborhood_scale),
            Math.floor(-y / neighborhood_scale),
            Math.ceil((-x + width) / neighborhood_scale),
            Math.ceil((-y + height) / neighborhood_scale)
        );
        this.scale = scale;
        this.x = x;
        this.y = y;
        requestAnimationFrame(() => {
            this.drawCanvasCache();
            this.drawMouseTracker();
            this.drawNTracker();
            this.drawSelected();
        });
    }

    mouseDownHandler(event) {
        const rect = this.sensor.current.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        if (event.shiftKey) {
            this.boxed = { x0: offsetX, y0: offsetY, x1: offsetX, y1: offsetY, alt: false };
        } else if (event.altKey) {
            this.boxed = { x0: offsetX, y0: offsetY, x1: offsetX, y1: offsetY, alt: true }; 
        } else {
            this.press.pressed = true;
            this.press.x = offsetX;
            this.press.y = offsetY;
            this.press.start_x = offsetX;
            this.press.start_y = offsetY;
        }
    }
    touchStartHandler(event) {
        event.preventDefault();
        const touches = event.touches;
        if (touches.length === 2) {
            const rect = this.sensor.current.getBoundingClientRect();
            const offsetX0 = touches[0].clientX - rect.left;
            const offsetY0 = touches[0].clientY - rect.top;
            const offsetX1 = touches[1].clientX - rect.left;
            const offsetY1 = touches[1].clientY - rect.top;
            this.pinchCache = [{
                id: touches[0].identifier, 
                x: offsetX0,
                y: offsetY0
            }, {
                id: touches[1].identifier,
                x: offsetX1,
                y: offsetY1
            }];
        } else if (touches.length === 1) {
            const rect = this.sensor.current.getBoundingClientRect();
            const offsetX = touches[0].clientX - rect.left;
            const offsetY = touches[0].clientY - rect.top;
            this.press.x = offsetX;
            this.press.y = offsetY;
            this.press.start_x = offsetX;
            this.press.start_y = offsetY;
        }
    }
    mouseMoveHandler(event) {
        const scale = this.scale;
        const rect = this.sensor.current.getBoundingClientRect();
        const width = this.width;
        const height = this.height;
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        if ("x0" in this.boxed) {
            this.boxed = { ...this.boxed, x1: offsetX, y1: offsetY };
            this.press.x = offsetX;
            this.press.y = offsetY;
            requestAnimationFrame(() => this.drawSelection());
        } else {
            if (this.press.pressed) {
                const x = offsetX - this.press.x + this.x;
                const y = offsetY - this.press.y + this.y;
                this.press.x = offsetX;
                this.press.y = offsetY;
                const neighborhood_scale = scale * NEIGHBORHOOD_SIZE;
                this.props.onViewportChange(
                    Math.floor(-x / neighborhood_scale),
                    Math.floor(-y / neighborhood_scale),
                    Math.ceil((-x + width) / neighborhood_scale),
                    Math.ceil((-y + height) / neighborhood_scale)
                );
                this.x = x;
                this.y = y;
                requestAnimationFrame(() => {
                    this.drawCanvasCache();
                    this.drawSelected();
                });
            }
            const center_x = Math.round((offsetX - this.x) / scale - 0.5);
            const center_y = Math.round((offsetY - this.y) / scale - 0.5);
            this.focus = { x: center_x, y: center_y };
            
            requestAnimationFrame(() => {
                this.drawMouseTracker();
                this.drawNTracker();
            });
        }
    }
    touchMoveHandler(event) {
        event.preventDefault();
        const touches = event.touches;
        if (touches.length === 2) {
            const rect = this.sensor.current.getBoundingClientRect();
            const offsetX0 = touches[0].clientX - rect.left;
            const offsetY0 = touches[0].clientY - rect.top;
            const offsetX1 = touches[1].clientX - rect.left;
            const offsetY1 = touches[1].clientY - rect.top;
            // console.log("offsets", offsetX0, offsetY0, offsetX1, offsetY1);
            const dx0 = this.pinchCache[0].x - this.pinchCache[1].x;
            const dy0 = this.pinchCache[0].y - this.pinchCache[1].y;
            const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
            const dx1 = offsetX0 - offsetX1;
            const dy1 = offsetY0 - offsetY1;
            const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            const newScale = Math.max(dist1 / dist0 * this.scale, 1);
            const rate = newScale / this.scale;
            this.scale = newScale;
            const sx0 = 0.5 * (this.pinchCache[0].x + this.pinchCache[1].x);
            const sy0 = 0.5 * (this.pinchCache[0].y + this.pinchCache[1].y);
            const sx1 = 0.5 * (offsetX0 + offsetX1);
            const sy1 = 0.5 * (offsetY0 + offsetY1);
            this.x = (this.x - sx0) * rate + sx1;
            this.y = (this.y - sy0) * rate + sy1;
            this.pinchCache = [{
                id: touches[0].identifier, 
                x: offsetX0,
                y: offsetY0
            }, {
                id: touches[1].identifier,
                x: offsetX1,
                y: offsetY1
            }];
            requestAnimationFrame(() => {
                this.drawCanvasCache();
                this.drawMouseTracker();
                this.drawNTracker();
                this.drawSelected();
            });
            // console.log("scaleM", this.scale);
            // console.log("x, y", this.x, this.y, sx0, sy0, sx1, sy1);
        } else if (touches.length === 1) {
            if (this.pinchCache && touches[0].identifier === this.pinchCache[0].id) {
                this.press.x = this.pinchCache[0].x
                this.press.y = this.pinchCache[0].y
            } else if (this.pinchCache && touches[0].identifier === this.pinchCache[1].id) {
                this.press.x = this.pinchCache[1].x
                this.press.y = this.pinchCache[1].y
            }
            const scale = this.scale;
            const rect = this.sensor.current.getBoundingClientRect();
            const width = this.width;
            const height = this.height;
            const offsetX = touches[0].clientX - rect.left;
            const offsetY = touches[0].clientY - rect.top;
            const x = offsetX - this.press.x + this.x;
            const y = offsetY - this.press.y + this.y;
            this.press.x = offsetX;
            this.press.y = offsetY;
            const neighborhood_scale = scale * NEIGHBORHOOD_SIZE;
            this.props.onViewportChange(
                Math.floor(-x / neighborhood_scale),
                Math.floor(-y / neighborhood_scale),
                Math.ceil((-x + width) / neighborhood_scale),
                Math.ceil((-y + height) / neighborhood_scale)
            );
            this.x = x;
            this.y = y;
            requestAnimationFrame(() => {
                this.drawCanvasCache();
                this.drawSelected();
            });
            const center_x = Math.round((offsetX - this.x) / scale - 0.5);
            const center_y = Math.round((offsetY - this.y) / scale - 0.5);
            this.focus = { x: center_x, y: center_y };
            
            requestAnimationFrame(() => {
                this.drawMouseTracker();
                this.drawNTracker();
            });
        }
    }
    mouseUpHandler(event) {
        if ("x0" in this.boxed) {
            const scale = this.scale;
            let left = Math.floor((this.boxed.x0 - this.x) / scale);
            let top = Math.floor((this.boxed.y0 - this.y) / scale);
            let right = Math.ceil((this.boxed.x1 - this.x) / scale - 1);
            let bot = Math.ceil((this.boxed.y1 - this.y) / scale - 1);
            if (right < left) {
                [left, right] = [right, left];
            }
            if (bot < top) {
                [top, bot] = [bot, top];
            }
            const selection = [];
            for (let x = left; x <= right; ++x) {
                for (let y = top; y <= bot; ++y) {
                    selection.push(JSON.stringify({ x, y }));
                }
            }
            if (this.boxed.alt) {
                this.props.altClick(new Set(selection));
            }
            else {
                this.props.shiftClick(new Set(selection));
            }
        } else if (this.press.pressed) {
            const scale = this.scale;
            const rect = this.sensor.current.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            if (
                Math.abs(offsetX - this.press.start_x) < CLICK_THRESHOLD &&
                Math.abs(offsetY - this.press.start_y) < CLICK_THRESHOLD
            ) {
                const x = Math.round((offsetX - this.x) / scale - 0.5);
                const y = Math.round((offsetY - this.y) / scale - 0.5);
                this.focus = { x: x, y: y };
                this.props.click(this.focus.x, this.focus.y);
            }
        }
        this.boxed = {};
        this.press.pressed = false;
        const currentMouse = document.getElementById("multiSelection");
        currentMouse.style.display = "none";
    }
    touchEndHandler(event) {
        event.preventDefault();
        const touches = event.changedTouches;
        if (touches.length === 1) {
            const scale = this.scale;
            const rect = this.sensor.current.getBoundingClientRect();
            const offsetX = touches[0].clientX - rect.left;
            const offsetY = touches[0].clientY - rect.top;
            if (
                Math.abs(offsetX - this.press.start_x) < TOUCH_THRESHOLD &&
                Math.abs(offsetY - this.press.start_y) < TOUCH_THRESHOLD
            ) {
                const x = Math.round((offsetX - this.x) / scale - 0.5);
                const y = Math.round((offsetY - this.y) / scale - 0.5);
                this.focus = { x: x, y: y };
                this.props.click(this.focus.x, this.focus.y);
            }
        }
    }
    touchCancelHandler(event) {
        event.preventDefault();
        const touches = event.changedTouches;
        if (touches.length === 1) {
            const scale = this.scale;
            const rect = this.sensor.current.getBoundingClientRect();
            const offsetX = touches[0].clientX - rect.left;
            const offsetY = touches[0].clientY - rect.top;
            if (
                Math.abs(offsetX - this.press.start_x) < TOUCH_THRESHOLD &&
                Math.abs(offsetY - this.press.start_y) < TOUCH_THRESHOLD
            ) {
                const x = Math.round((offsetX - this.x) / scale - 0.5);
                const y = Math.round((offsetY - this.y) / scale - 0.5);
                this.focus = { x: x, y: y };
                this.props.click(this.focus.x, this.focus.y);
            }
        }
    }
    mouseEnterHandler(event) {
        const scale = this.scale;
        const rect = this.sensor.current.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const center_x = Math.round((offsetX - this.x) / scale - 0.5);
        const center_y = Math.round((offsetY - this.y) / scale - 0.5);
        this.focus = { x: center_x, y: center_y };
    }
    mouseLeaveHandler(event) {
        this.press.pressed = false;
    }
    keyDownHandler(event) {
        if (this.props.clicked && !this.props.selecting.selecting) {
            const x = this.props.clicked_x;
            const y = this.props.clicked_y;
            const arrowKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
            const dx = [-1, 1, 0, 0];
            const dy = [0, 0, -1, 1];
            for (let i = 0; i < 4; i++) {
                if (event.key === arrowKeys[i]) {
                    this.props.click(x + dx[i], y + dy[i]);
                }
            }
        }
    }

    resizeHandler(event) {
        const width = window.innerWidth;
        const height = window.innerHeight - UPPER;
        this.width = width;
        this.height = height;
        this.canvas.current.width = width;
        this.canvas.current.height = height;
        this.sensor.current.width = width;
        this.sensor.current.height = height;
        requestAnimationFrame(() => this.drawCanvasCache());
    }

    onTouchMove(event) {
        if (event.target.className.slice(0, 3) !== "Mui") {
            event.preventDefault();
        }
    }

    onWheel(event) {
        if (event.ctrlKey) {
            event.preventDefault();
        }
    }

    async componentDidMount() {
        const canvas = document.getElementById("canvas");
        const sensor = document.getElementById("sensor");
        const width = this.width;
        const height = this.height;
        canvas.width = width;
        canvas.height = height;
        sensor.width = width;
        sensor.height = height;

        this.interval = setInterval(() => {
            if (!document.hidden && Date.now() - this.canvasCache.t > 500) {
                requestAnimationFrame(() => this.drawCanvas());
            }
        }, 1000);

        window.addEventListener("resize", this.resizeHandler);
        // document.addEventListener("touchstart", this.preventDefault, {passive: false});
        document.addEventListener("touchmove", this.onTouchMove, {passive: false});
        document.addEventListener("wheel", this.onWheel, {passive: false});
        // document.addEventListener("touchend", this.preventDefault, {passive: false});
        // document.addEventListener("touchcancel", this.preventDefault, {passive: false});
        await this.props.prepare();
        requestAnimationFrame(() => this.drawCanvas());
    }

    componentWillUnmount() {
        clearInterval(this.interval);
        window.removeEventListener("resize", this.resizeHandler);
        // document.removeEventListener("touchstart", this.preventDefault);
        document.removeEventListener("touchmove", this.onTouchMove);
        document.removeEventListener("wheel", this.onWheel);
        // document.removeEventListener("touchend", this.preventDefault);
        // document.removeEventListener("touchcancel", this.preventDefault);
    }

    resetCanvas(){
        for (let key in this.canvasCache) {
            if (key !== "t") {
                const tmpCanvas = this.canvasCache[key];
                const tmpContext = tmpCanvas.getContext("2d", {
                    alpha: false,
                    desynchronized: true,
                });
                tmpContext.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
            }
        }
        requestAnimationFrame(() => this.drawCanvas());
    }

    drawMouseTracker() {
        const currentMouse = document.getElementById("mouseTracker");
        const n_x = Math.floor(this.focus.x / NEIGHBORHOOD_SIZE);
        const n_y = Math.floor(this.focus.y / NEIGHBORHOOD_SIZE);
        const key = JSON.stringify({ n_x, n_y });
        currentMouse.style.left = this.x + this.focus.x * this.scale + "px";
        currentMouse.style.top = this.y + this.focus.y * this.scale + "px";
        currentMouse.style.width = this.scale + "px";
        currentMouse.style.height = this.scale + "px";
        if (this.map && key in this.map) {
            const p_x = this.focus.x - n_x * NEIGHBORHOOD_SIZE;
            const p_y = this.focus.y - n_y * NEIGHBORHOOD_SIZE;
            const color = this.map[key][p_y][p_x];
            const newColor = colorHighlight(color);
            currentMouse.style.borderColor = newColor;
        }
    }

    drawNTracker() {
        const currentMouse = document.getElementById("nTracker");
        const n_x = Math.floor(this.focus.x / NEIGHBORHOOD_SIZE);
        const n_y = Math.floor(this.focus.y / NEIGHBORHOOD_SIZE);
        const neighborhood_scale = NEIGHBORHOOD_SIZE * this.scale;
        currentMouse.style.left = this.x + n_x * neighborhood_scale + "px";
        currentMouse.style.top = this.y + n_y * neighborhood_scale + "px";
        currentMouse.style.width = neighborhood_scale + "px";
        currentMouse.style.height = neighborhood_scale + "px";
        let key = JSON.stringify({ n_x, n_y });
        let neighborhood_names = this.props.getNeighborhoodNames();
        const currentNeighborhood = document.getElementById("neighborhood");
        if (neighborhood_names && (key in neighborhood_names)) {
            this.neighborhood_name = neighborhood_names[key];
            if (this.scale <= this.fit - 1) {
                currentNeighborhood.innerHTML = "<h1>" + this.neighborhood_name + "</h1>";
            } else {
                currentNeighborhood.innerHTML = "";
            }
        } else {
            this.neighborhood_name = null;
            currentNeighborhood.innerHTML = "<h1> Expand </h1>";
        }
    }

    drawSelection() {
        if ("x0" in this.boxed) {
            const currentMouse = document.getElementById("multiSelection");
            let left = this.boxed.x0;
            let top = this.boxed.y0;
            let right = this.boxed.x1;
            let bot = this.boxed.y1;
            if (right < left) {
                [left, right] = [right, left];
            }
            if (bot < top) {
                [top, bot] = [bot, top];
            }
            currentMouse.style.display = "block";
            currentMouse.style.left = left + "px";
            currentMouse.style.top = top + "px";
            currentMouse.style.width = right - left + "px";
            currentMouse.style.height = bot - top + "px";
        }
    }

    drawSelected() {
        const scale = this.scale;
        if (this.props.selecting.selecting) {
            this.props.ownedSpaces.forEach((pos) => {
                if (!this.props.selecting.poses.has(pos)){
                    return;
                }
                // owned spaces
                const p = JSON.parse(pos);
                const x = p.x;
                const y = p.y;
                const deltax = x * scale + this.x;
                const deltay = y * scale + this.y;
                const currentRef = document.getElementById(`boxTracker${pos}`);
                currentRef.style.left = deltax + 0.1 * scale + "px";
                currentRef.style.top = deltay + 0.1 * scale + "px";
                currentRef.style.width = scale - 0.2 * scale + "px";
                currentRef.style.height = scale - 0.2 * scale + "px";
                currentRef.style.border = 0.1 * scale + "px solid blue";
                currentRef.style.outline = 0.1 * scale + "px solid " + colorHighlight("#0000FF");
            });
            this.props.selecting.purchasableInfo.forEach((info) => {
                // purchasable spaces
                const { x, y, mint, price, seller } = info;
                const pos = JSON.stringify({ x, y });
                const deltax = x * scale + this.x;
                const deltay = y * scale + this.y;
                const currentRef = document.getElementById(`boxTracker${pos}`);
                const color = "#" + priceToColor(price);
                currentRef.style.left = deltax + 0.1 * scale + "px";
                currentRef.style.top = deltay + 0.1 * scale + "px";
                currentRef.style.width = scale - 0.2 * scale + "px";
                currentRef.style.height = scale - 0.2 * scale + "px";
                currentRef.style.border = 0.1 * scale + "px solid " + color;
                currentRef.style.outline = 0.1 * scale + "px solid " + colorHighlight(color);
            });
            this.props.selecting.purchasableInfo.forEach((info) => {
                // purchasable spaces
                const { x, y, mint, price} = info;
                const pos = JSON.stringify({ x, y });
                const deltax = x * scale + this.x;
                const deltay = y * scale + this.y;
                const currentRef = document.getElementById(`boxTracker${pos}`);
                const color = "#" + priceToColor(price);
                currentRef.style.left = deltax + 0.1 * scale + "px";
                currentRef.style.top = deltay + 0.1 * scale + "px";
                currentRef.style.width = scale - 0.2 * scale + "px";
                currentRef.style.height = scale - 0.2 * scale + "px";
                currentRef.style.border = 0.1 * scale + "px solid " + color;
                currentRef.style.outline = 0.1 * scale + "px solid " + colorHighlight(color);
            });
            this.props.selecting.rentableInfo.forEach((info) => {
                // purchasable spaces
                const { x, y, mint, price} = info;
                const pos = JSON.stringify({ x, y });
                const deltax = x * scale + this.x;
                const deltay = y * scale + this.y;
                const currentRef = document.getElementById(`boxTracker${pos}`);
                const color = "#" + rentPriceToColor(price);
                currentRef.style.left = deltax + 0.1 * scale + "px";
                currentRef.style.top = deltay + 0.1 * scale + "px";
                currentRef.style.width = scale - 0.2 * scale + "px";
                currentRef.style.height = scale - 0.2 * scale + "px";
                currentRef.style.border = 0.1 * scale + "px solid " + color;
                currentRef.style.outline = 0.1 * scale + "px solid " + colorHighlight(color);
            });

            this.props.selecting.poses.forEach((pos) => {
                // remaining selected spaces
                if (
                    this.props.ownedSpaces.has(pos) ||
                    this.props.selecting.purchasable.has(pos) ||
                    this.props.selecting.rentable.has(pos)
                ) {
                    return;
                }
                const p = JSON.parse(pos);
                const x = p.x;
                const y = p.y;
                const deltax = x * scale + this.x;
                const deltay = y * scale + this.y;
                const currentRef = document.getElementById(`boxTracker${pos}`);
                currentRef.style.left = deltax + 0.1 * scale + "px";
                currentRef.style.top = deltay + 0.1 * scale + "px";
                currentRef.style.width = scale - 0.2 * scale + "px";
                currentRef.style.height = scale - 0.2 * scale + "px";
                currentRef.style.border = 0.1 * scale + "px solid red";
                currentRef.style.outline = 0.1 * scale + "px solid " + colorHighlight("#FF0000");
            });
        } else if (this.props.clicked) {
            const deltax = this.props.clicked_x * scale + this.x;
            const deltay = this.props.clicked_y * scale + this.y;
            const currentRef = document.getElementById(`clickTracker`);
            currentRef.style.left = deltax + 0.1 * scale + "px";
            currentRef.style.top = deltay + 0.1 * scale + "px";
            currentRef.style.width = scale - 0.2 * scale + "px";
            currentRef.style.height = scale - 0.2 * scale + "px";

            const n_x = Math.floor(this.props.clicked_x / NEIGHBORHOOD_SIZE);
            const n_y = Math.floor(this.props.clicked_y / NEIGHBORHOOD_SIZE);
            const key = JSON.stringify({ n_x, n_y });

            if (this.map && key in this.map) {
                const p_x = this.props.clicked_x - n_x * NEIGHBORHOOD_SIZE;
                const p_y = this.props.clicked_y - n_y * NEIGHBORHOOD_SIZE;
                const color = this.map[key][p_y][p_x];
                const newColor = colorHighlight(color);
                const colorstr = `px dashed ${newColor}`;
                currentRef.style.border = 0.1 * scale + colorstr;
            }
        }
    }

    drawCanvas() {
        const canvas = document.getElementById("canvas");
        const width = this.width;
        const height = this.height;
        if (canvas === null) {
            // add fix to when moving between tabs
            return;
        }
        const context = canvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
        });
        const scale = this.scale;
        context.clearRect(0, 0, width, height);
        const neighborhood_scale = scale * NEIGHBORHOOD_SIZE;
        const startx = Math.floor(-this.x / neighborhood_scale);
        const starty = Math.floor(-this.y / neighborhood_scale);
        const endx = Math.ceil((-this.x + width) / neighborhood_scale);
        const endy = Math.ceil((-this.y + height) / neighborhood_scale);
        const currentMap = this.props.getMap();
        this.map = currentMap;
        for (let n_x = startx; n_x < endx; ++n_x) {
            for (let n_y = starty; n_y < endy; ++n_y) {
                let key = JSON.stringify({ n_x, n_y });
                if (key in currentMap) {
                    if (!(key in this.canvasCache)) {
                        this.canvasCache[key] = document.createElement("canvas");
                    }
                    const tmpCanvas = this.drawNeighborhood(
                        currentMap[key],
                        this.canvasCache[key]
                    );
                }
                if (key in this.canvasCache) {
                    context.drawImage(
                        this.canvasCache[key],
                        this.x + n_x * neighborhood_scale,
                        this.y + n_y * neighborhood_scale,
                        neighborhood_scale,
                        neighborhood_scale
                    );
                }
            }
        }
        this.canvasCache.t = Date.now();
    }

    examine() {
        const n_x = Math.floor(this.focus.x / NEIGHBORHOOD_SIZE);
        const n_y = Math.floor(this.focus.y / NEIGHBORHOOD_SIZE);
        this.props.clickNeighborhood(n_x, n_y);
        requestAnimationFrame(() => {
            this.drawCanvasCache({
                x: n_x * NEIGHBORHOOD_SIZE,
                y: n_y * NEIGHBORHOOD_SIZE,
                width: NEIGHBORHOOD_SIZE,
                height: NEIGHBORHOOD_SIZE,
            });
            this.drawNTracker();
            this.drawSelected();
        });
    }

    drawCanvasCache(center) {
        const canvas = document.getElementById("canvas");
        const width = this.width;
        const height = this.height;
        if (canvas === null) {
            return;
        }
        const context = canvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
        });
        
        if (center) {
            const dest = {}
            dest.scale = Math.max(
                Math.min(100, height / center.height, (width - LEFT) / center.width),
                1
            );
            dest.scale = Math.floor(dest.scale);
            const center_x = center.x + 0.5 * center.width;
            const center_y = center.y + 0.5 * center.height;
            dest.x = -center_x * dest.scale + 0.5 * width + 0.5 * LEFT;
            dest.y = -center_y * dest.scale + 0.5 * height;
            origin = {scale: this.scale, x: this.x, y: this.y};
            this.approachAnimation(origin, dest, Date.now());
        } else {
            const scale = this.scale;
            context.clearRect(0, 0, width, height);
            const neighborhood_scale = scale * NEIGHBORHOOD_SIZE;
            const startx = Math.floor(-this.x / neighborhood_scale);
            const starty = Math.floor(-this.y / neighborhood_scale);
            const endx = Math.ceil((-this.x + width) / neighborhood_scale);
            const endy = Math.ceil((-this.y + height) / neighborhood_scale);

            for (let n_x = startx; n_x < endx; ++n_x) {
                for (let n_y = starty; n_y < endy; ++n_y) {
                    let key = JSON.stringify({ n_x, n_y });
                    if (key in this.canvasCache) {
                        context.drawImage(
                            this.canvasCache[key],
                            this.x + n_x * neighborhood_scale,
                            this.y + n_y * neighborhood_scale,
                            neighborhood_scale,
                            neighborhood_scale
                        );
                    }
                }
            }
            this.canvasCache.t = Date.now();
        }
    }

    approachAnimation(origin, dest, start) {
        const current = Date.now();
        const elapse = current - start;
        if (elapse >= 1000) {
            this.x = dest.x;
            this.y = dest.y;
            this.scale = dest.scale;
            requestAnimationFrame(() => {
                this.drawCanvasCache();
                this.drawMouseTracker();
                this.drawNTracker();
                this.drawSelected();
            });
        } else {
            this.x = origin.x + (dest.x - origin.x) * elapse / 1000;
            this.y = origin.y + (dest.y - origin.y) * elapse / 1000;
            this.scale = origin.scale + (dest.scale - origin.scale) * elapse / 1000;
            requestAnimationFrame(() => {
                this.drawCanvasCache();
                this.drawMouseTracker();
                this.drawNTracker();
                this.drawSelected();
                this.approachAnimation(origin, dest, start);
            });
        }
    }

    drawNeighborhood(map, tmpCanvas) {
        let scale = Math.min(this.scale, 50);
        if (this.width < 500) {
            scale = Math.min(this.scale, 20);
        }
        tmpCanvas.width = NEIGHBORHOOD_SIZE * scale;
        tmpCanvas.height = NEIGHBORHOOD_SIZE * scale;
        const tmpContext = tmpCanvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
        });
        tmpContext.clearRect(0, 0, tmpCanvas.width, tmpCanvas.height);
        for (let x = 0; x < NEIGHBORHOOD_SIZE; ++x) {
            for (let y = 0; y < NEIGHBORHOOD_SIZE; ++y) {
                tmpContext.fillStyle = map[y][x];
                tmpContext.fillRect(x * scale, y * scale, scale, scale);
            }
        }
        return tmpCanvas;
    }

    render() {
        let boxTracker = null;
        let clickTracker = null;
        const scale = this.scale;
        const n_x = Math.floor(this.focus.x / NEIGHBORHOOD_SIZE);
        const n_y = Math.floor(this.focus.y / NEIGHBORHOOD_SIZE);

        if (this.props.selecting.selecting) {
            boxTracker = [];
            boxTracker.push(
                Array.from(this.props.ownedSpaces).map((pos) => {
                    if (!this.props.selecting.poses.has(pos)){
                        return;
                    }
                    // draw owned spaces
                    const p = JSON.parse(pos);
                    const x = p.x;
                    const y = p.y;
                    const deltax = x * scale + this.x;
                    const deltay = y * scale + this.y;
                    return (
                        <div
                            className="boxTracker"
                            id={`boxTracker${pos}`}
                            style={{
                                left: deltax + 0.1 * scale,
                                top: deltay + 0.1 * scale,
                                width: scale - 0.2 * scale,
                                height: scale - 0.2 * scale,
                                border: 0.1 * scale + "px solid blue",
                                outline: 0.1 * scale + "px solid " + colorHighlight("#0000FF")
                            }}
                            key={pos}
                        >
                        </div>
                    );
                })
            );
            boxTracker.push(
                Array.from(this.props.selecting.purchasableInfo).map((info) => {
                    // draw purchasable spaces
                    const { x, y, mint, price, seller } = info;
                    const pos = JSON.stringify({ x, y });
                    const deltax = x * scale + this.x;
                    const deltay = y * scale + this.y;
                    const color = "#" + priceToColor(price);
                    return (
                        <div
                            className="boxTracker"
                            id={`boxTracker${pos}`}
                            style={{
                                left: deltax + 0.1 * scale,
                                top: deltay + 0.1 * scale,
                                width: scale - 0.2 * scale,
                                height: scale - 0.2 * scale,
                                border: 0.1 * scale + "px solid " + color,
                                outline: 0.1 * scale + "px solid " + colorHighlight(color)
                            }}
                            key={pos}
                        >
                        </div>
                    );
                })
            );
            boxTracker.push(
                Array.from(this.props.selecting.rentableInfo).map((info) => {
                    // draw purchasable spaces
                    const { x, y, mint, price } = info;
                    const pos = JSON.stringify({ x, y });
                    const deltax = x * scale + this.x;
                    const deltay = y * scale + this.y;
                    const color = "#" + rentPriceToColor(price);
                    return (
                        <div
                            className="boxTracker"
                            id={`boxTracker${pos}`}
                            style={{
                                left: deltax + 0.1 * scale,
                                top: deltay + 0.1 * scale,
                                width: scale - 0.2 * scale,
                                height: scale - 0.2 * scale,
                                border: 0.1 * scale + "px solid " + color,
                                outline: 0.1 * scale + "px solid " + colorHighlight(color)
                            }}
                            key={pos}
                        >
                        </div>
                    );
                })
            );
            boxTracker.push(
                // draw remaining selected spaces
                Array.from(this.props.selecting.poses)
                    .map((pos) => {
                        if (
                            this.props.ownedSpaces.has(pos) ||
                            this.props.selecting.purchasable.has(pos) ||
                            this.props.selecting.rentable.has(pos)
                        ) {
                            return null;
                        }
                        const p = JSON.parse(pos);
                        const x = p.x;
                        const y = p.y;
                        const deltax = x * scale + this.x;
                        const deltay = y * scale + this.y;
                        return (
                            <div
                                className="boxTracker"
                                id={`boxTracker${pos}`}
                                style={{
                                    left: deltax + 0.1 * scale,
                                    top: deltay + 0.1 * scale,
                                    width: scale - 0.2 * scale,
                                    height: scale - 0.2 * scale,
                                    border: 0.1 * scale + "px solid red",
                                    outline: 0.1 * scale + "px solid " + colorHighlight("#FF0000")
                                }}
                                key={pos}
                            >
                            </div>
                        );
                    })
                    .filter((x) => x !== null)
            );
        } else if (this.props.clicked) {
            const deltax = this.props.clicked_x * scale + this.x;
            const deltay = this.props.clicked_y * scale + this.y;
            let n_x = Math.floor(this.props.clicked_x / NEIGHBORHOOD_SIZE);
            let n_y = Math.floor(this.props.clicked_y / NEIGHBORHOOD_SIZE);
            let key = JSON.stringify({ n_x, n_y });
            let colorstr = "px dashed white";
            if (this.map && key in this.map) {
                const p_x = this.props.clicked_x - n_x * NEIGHBORHOOD_SIZE;
                const p_y = this.props.clicked_y - n_y * NEIGHBORHOOD_SIZE;
                const color = this.map[key][p_y][p_x];
                const newColor = colorHighlight(color);
                colorstr = `px dashed ${newColor}`;
            }
            clickTracker = (
                <div
                    className="clickTracker"
                    id={"clickTracker"}
                    style={{
                        left: deltax + 0.1 * scale,
                        top: deltay + 0.1 * scale,
                        width: scale - 0.2 * scale,
                        height: scale - 0.2 * scale,
                        border: 0.1 * scale + colorstr,
                    }}
                >
                </div>
            );
        }

        return (
            <div className="myboard">
                <canvas className="canvas" id="canvas" ref={this.canvas}></canvas>
                <div className="nTracker" id="nTracker">
                    <div className="examine">
                        <div id="neighborhood" className="name" href="#" onClick={() => {
                            if (this.neighborhood_name) {
                                this.examine();
                            } else {
                                this.setState({inputConfig: true});
                            }
                        }}>
                        <h1> {this.neighborhood_name ? this.neighborhood_name : "Expand"} </h1>
                        </div>
                    </div>
                </div>
                <Dialog
                    open={this.state.inputConfig}
                    onClose={() => this.setState({ inputConfig: false })}
                >
                    <DialogTitle>Expand To Neighborhood 
                        ({Math.floor(this.focus.x / NEIGHBORHOOD_SIZE)}, {Math.floor(this.focus.y / NEIGHBORHOOD_SIZE)})
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            To expand to this Neighborhood, first initialize the candy machine
                            config and paste its address here, and we'll handle the rest. Make
                            sure the config corresponds to the selected Neighborhood, and that the current
                            wallet is the authority of the config!
                        </DialogContentText>
                        <TextField
                            autoFocus
                            id="candyMachineAddress"
                            margin="dense"
                            label="Candy Machine Config Address"
                            fullWidth
                            variant="standard"
                        />
                        <TextField
                            autoFocus
                            id="neighborhoodName"
                            margin="dense"
                            label="Neighborhood Name"
                            fullWidth
                            variant="standard"
                        />
                        <Captcha
                            onVerify={(response) => {
                                this.captchaResponse = response;
                            }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ inputConfig: false })}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                this.props.expand({
                                    n_x: Math.floor(this.focus.x / NEIGHBORHOOD_SIZE),
                                    n_y: Math.floor(this.focus.y / NEIGHBORHOOD_SIZE),
                                    address: new PublicKey(document.getElementById("candyMachineAddress").value),
                                    name: document.getElementById("neighborhoodName").value,
                                    captcha: this.captchaResponse,
                                });
                                this.setState({ inputConfig: false });
                            }}
                        >
                            Register
                        </Button>
                    </DialogActions>
                </Dialog>
                <div className="mouseTracker" id="mouseTracker"></div>
                {clickTracker}
                {boxTracker}
                <div className="multiSelection" id="multiSelection"></div>
                <canvas className="sensor" id="sensor" ref={this.sensor}
                    onWheel={(e) => this.wheelHandler(e)}
                    onMouseDown={(e) => this.mouseDownHandler(e)}
                    onMouseMove={(e) => this.mouseMoveHandler(e)}
                    onMouseUp={(e) => this.mouseUpHandler(e)}
                    onMouseEnter={(e) => this.mouseEnterHandler(e)}
                    onMouseLeave={(e) => this.mouseLeaveHandler(e)}
                    onKeyDown={(e) => this.keyDownHandler(e)}
                    onTouchStart={(e) => this.touchStartHandler(e)}
                    onTouchMove={(e) => this.touchMoveHandler(e)}
                    onTouchEnd={(e) => this.touchEndHandler(e)}
                    onTouchCancel={(e) => this.touchCancelHandler(e)}
                    tabIndex={-1}
                ></canvas>
            </div>
        );
    }
}