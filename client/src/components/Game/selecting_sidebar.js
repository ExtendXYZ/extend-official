import React from "react";
import "./index.css";
import { Server } from "./server.js";
import { Board } from './canvas.js';
import {getBounds} from './index.js';
import { GIF, notify, shortenAddress } from "../../utils";
import { NEIGHBORHOOD_SIZE, RPC, UPPER } from "../../constants";
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Select,
  RadioGroup,
  Typography,
  Radio,
} from "@mui/material";
import { Spin } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import SearchIcon from "@mui/icons-material/Search";
import CancelIcon from "@mui/icons-material/Cancel";
import HelpIcon from "@mui/icons-material/Help";
import { solToLamports, lamportsToSol, formatPrice, intersection} from "../../utils";
import {Tab, Tabs, AppBar} from "@mui/material";


import ReactDOM from "react-dom";

import PropTypes from "prop-types";

function TabPanel(props) {
    const { children, value, index, ...other } = props;
  
    return (
      <Typography
        component="div"
        role="tabpanel"
        hidden={value !== index}
        id={`scrollable-auto-tabpanel-${index}`}
        aria-labelledby={`scrollable-auto-tab-${index}`}
        {...other}
      >
        <Box p={3}>{children}</Box>
      </Typography>
    );
  }
  
  TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.any.isRequired,
    value: PropTypes.any.isRequired
  };
  
  function a11yProps(index) {
    return {
      id: `scrollable-auto-tab-${index}`,
      "aria-controls": `scrollable-auto-tabpanel-${index}`
    };
  }

export class SelectingSidebar extends React.Component {
    constructor(props) {
      super(props);
      this.state = {value: 0, ownedSelection: new Set()};
      this.handleTabChange = this.handleTabChange.bind(this);
    }

    componentDidMount(){
        this.setState({ownedSelection: intersection(this.props.ownedSpaces, this.props.selecting.poses)});
    }

    componentDidUpdate(prevProps) {
        if (this.props.ownedSpaces !== prevProps.ownedSpaces || this.props.selecting.poses != prevProps.selecting.poses) {
            this.setState({ownedSelection: intersection(this.props.ownedSpaces, this.props.selecting.poses)});
        }
    }

    handleTabChange(event, newValue) {
        this.setState({value: newValue});
    };

    render() {
        let bounds = getBounds(this.props.selecting.poses);

        const sidebarHeader = <List style={{ marginTop: "0px" }}>
        <ListItem className="info" style={{ display: "block" }}>
          <Box className="infoHeader">OWNED SPACES</Box>
          <Box>
            <b>
              <font color="#82CBC5">
                {this.state.ownedSelection.size +
                  "/" +
                  this.props.selecting.poses.size}
              </font>
            </b>
          </Box>
        </ListItem>
        </List>;

        let tooltipModifyColorTitle = `Estimated Cost to Change Colors:  ${(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL`;
        let tooltipSetPriceTitle = `Estimated Cost to List/Delist:  ${(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL`;
        let tooltipBuyTitle = `Batch buying is non-atomic and is available as a convenience feature. Successful purchase of every space selected is not guaranteed.
        
        Estimated Transaction Cost to Buy:  ${(this.props.selecting.purchasableInfo.length * 0.000005).toFixed(6)} SOL`;

        return (

                <div>
                  <AppBar position="static" color="default">
                    <Tabs
                      value={this.state.value}
                      onChange={ this.handleTabChange }
                      indicatorColor="primary"
                      textColor="primary"
                      variant="scrollable"
                      scrollButtons="auto"
                      aria-label="scrollable auto tabs example"
                    >
                      <Tab label="Modify" {...a11yProps(0)} />
                      <Tab label="Price Info" {...a11yProps(1)} />
                      <Tab label="Advanced" {...a11yProps(2)} />
                    </Tabs>
                  </AppBar>

                  

                  <TabPanel value={this.state.value} index={0}>
                      {sidebarHeader}

                      {/* Color stuff */}

                      <Divider className="sidebarDivider">
                          Modify Colors
                      </Divider>
                      <ListItem className="info" style={{ display: "block" }}>
                        {/* <Box className="infoText2">
                          Estimated Cost:{" "}
                          {(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL
                        </Box> */}
                        <RadioGroup
                          row
                          value={this.props.colorApplyAll}
                          onChange={(e) => {
                            this.props.handleChangeColorApplyAll(e);
                          }}
                        >
                          <FormControlLabel
                            value={false}
                            control={<Radio size="small" />}
                            label={
                              <Typography
                                className="infoText2"
                              >{`Current frame (Frame ${this.props.frame})`}</Typography>
                            }
                          />
                          <FormControlLabel
                            value={true}
                            control={<Radio size="small" />}
                            label={
                              <Typography className="infoText2">
                                All frames
                              </Typography>
                            }
                          />
                        </RadioGroup>
                        <Tooltip title={tooltipModifyColorTitle}>
                          <Box className="infoHeader">COLOR</Box>
                        </Tooltip>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <input
                            className="newColor"
                            type="color"
                            value={this.props.selecting.color}
                            onChange={(e) => this.props.handleChangeColors(e)}
                            disabled={!this.state.ownedSelection.size}
                          ></input>
                        <Tooltip title={tooltipModifyColorTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.changeColors();
                            }}
                            style={{
                              marginLeft: "5px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={!this.state.ownedSelection.size}
                          >
                            Change Color
                          </Button>
                        </Tooltip>
                        </div>

                        <Box className="infoHeader" style={{marginTop: "10px"}}>IMAGE</Box>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <Tooltip title="Upload an image on your selected spaces">
                            <Button
                              variant="contained"
                              component="label"
                              style={{ width: "100%" }}
                              size="small"
                              disabled={!this.state.ownedSelection.size}
                              style={{
                                marginLeft: "5px",
                                color: "#FFFFFF",
                                background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                              }}
                            >
                              Choose File
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => this.props.handleChangeImg(e)}
                                hidden
                              />
                            </Button>
                          </Tooltip>
                          {this.props.hasImage && 
                            <Box className="infoText1" style={{marginLeft: "10px"}}>
                              {this.props.imageFilename}
                            </Box> 
                          }
                        </div>
                        <Tooltip title={tooltipModifyColorTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.uploadImage();
                            }}
                            style={{
                              width: "100%",
                              marginTop: "20px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={!this.props.hasImage}
                          >
                            Upload
                          </Button>
                        </Tooltip>
                      </ListItem>            
                  </TabPanel>


                    
                  <TabPanel value={this.state.value} index={1}>
                      {sidebarHeader}
                          
                      {/* Purchase info */}

                      <Divider className="sidebarDivider">
                          Modify Listing
                      </Divider>
                      <ListItem className="info" style={{ display: "block" }}>
                        {/* <Box className="infoText2">
                          Estimated Cost:{" "}
                          {(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL
                        </Box> */}
                        <Tooltip title={tooltipSetPriceTitle}>
                          <Box className="infoHeader">PRICE</Box>
                        </Tooltip>
                        <TextField
                          hiddenLabel
                          id="price-textfield"
                          value={
                            this.props.selecting.price === null
                              ? ""
                              : this.props.selecting.price
                          }
                          onChange={(e) => this.props.handleChangeSelectingPrice(e)}
                          style={{
                            width: "100%",
                            height: "30px",
                          }}
                          variant="filled"
                          size="small"
                          disabled={!this.state.ownedSelection.size}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">SOL</InputAdornment>
                            ),
                          }}
                        />
                        <Tooltip title={tooltipSetPriceTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.changePrices();
                            }}
                            style={{
                              width: "100%",
                              marginTop: "20px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={
                              !this.state.ownedSelection.size ||
                              this.props.selecting.price === null
                            }
                          >
                            Set Price
                          </Button>
                        </Tooltip>
                        <Tooltip title={tooltipSetPriceTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.delistSpaces();
                            }}
                            style={{
                              width: "100%",
                              marginTop: "10px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={!this.state.ownedSelection.size}
                          >
                            Delist
                          </Button>
                        </Tooltip>
                      </ListItem>
                      <Divider className="sidebarDivider" style={{marginTop: "20px"}}>
                          Purchase Spaces
                      </Divider>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Box className="infoText1">
                          Targeted cells count
                        </Box>
                        <Box
                          style={{
                            filter:
                              this.props.selecting.loadingPricesStatus === 1
                                ? "blur(0.5rem)"
                                : "blur(0)",
                            transition: "0.5s",
                          }}
                        >
                          <b>
                            <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                              {
                              this.props.selecting.loadingPricesStatus !== 2
                                ? "not loaded"
                              :
                                this.props.selecting.purchasableInfo.length +
                                "/" +
                                this.props.selecting.poses.size}
                            </font>
                          </b>
                        </Box>
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Box className="infoText1">Total Price</Box>
                        <Box
                          style={{
                            filter:
                              this.props.selecting.loadingPricesStatus === 1
                                ? "blur(0.5rem)"
                                : "blur(0)",
                            transition: "0.5s",
                          }}
                        >
                          <img
                            src={
                              require("../../assets/images/solana-transparent.svg").default
                            }
                            alt="SOL"
                          />
                          <b>
                            <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                              { 
                              this.props.selecting.loadingPricesStatus !== 2
                                ? "not loaded"
                                :
                                formatPrice(this.props.selecting.totalPrice)
                              }
                            </font>
                          </b>
                        </Box>
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            this.props.loadPrice();
                          }}
                          style={{
                            width: "100%",
                            marginLeft: "5px",
                            color: "#FFFFFF",
                            background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                          }}
                        >
                          Load Price Info
                        </Button>
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Tooltip title="Select all purchasable spaces in your selection to prepare to purchase them.">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.handleShowAllPurchasable();
                            }}
                
                            disabled={this.props.selecting.loadingPricesStatus != 2}
                            style={{
                              width: "100%",
                              marginLeft: "5px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                          >
                            Target All Purchasable
                          </Button>
                        </Tooltip>
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <TextField
                            required
                            id="outlined-required"
                            label="width"
                            type="number"
                            defaultValue={1}
                            onChange={(e) => this.props.handleChangeFloorM(e)}
                            value={this.props.selecting.floorM}
                            disabled={this.props.selecting.loadingPricesStatus != 2}
                            style={{ width: "25%" }}
                            size="small"
                          />
                          <TextField
                            required
                            id="outlined-required"
                            label="height"
                            type="number"
                            defaultValue={1}
                            onChange={(e) => this.props.handleChangeFloorN(e)}
                            value={this.props.selecting.floorN}
                            disabled={this.props.selecting.loadingPricesStatus != 2}
                            style={{ width: "25%" }}
                            size="small"
                          />
                          <Tooltip title="Select the cheapest rectangle in your selection of the specified width and height dimensions.">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                this.props.handleShowFloor();
                              }}
                              disabled={this.props.selecting.loadingPricesStatus != 2}
                              style={{
                                width: "45%",
                                marginLeft: "10px",
                                marginTop: "5px",
                                marginLeft: "5px",
                                color: "#FFFFFF",
                                background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                              }}
                            >
                              Target Floor
                            </Button>
                          </Tooltip>
                        </div>
                        {/* <FormControl style={{alignItems: "center"}}>
                                        <FormControlLabel
                                            control={
                                                <Switch 
                                                onChange={(e) => this.handleShowFloor(e)} 
                                                checked={this.props.floor}
                                                disabled={this.props.selecting.loadingPricesStatus != 2}
                                                />
                                            } 
                                            label="SHOW FLOOR"
                                        />
                                    </FormControl> */}
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Tooltip title={tooltipBuyTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.purchaseSpaces();
                            }}
                            style={{
                              width: "100%",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={
                              !this.props.user ||
                              this.props.selecting.loadingPricesStatus != 2 ||
                              this.props.selecting.purchasable.size === 0
                            }
                          >
                            Buy Now
                          </Button>
                        </Tooltip>
                      </ListItem>
                  </TabPanel>

                  <TabPanel value={this.state.value} index={2}>
                        {sidebarHeader}

                        {/* Advanced */}
                        <> 
                        <Divider className="sidebarDivider">
                            Advanced
                        </Divider>
                        <ListItem className="info" style={{ display: "block" }}>
                              <Tooltip title="Refresh information for these spaces directly from the blockchain. Refreshing may be rate-limited if performed excessively.">  
                                <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                    this.props.handleSelectingRefresh();
                                }}
                                style={{
                                    width: "100%",
                                    color: "#FFFFFF",
                                    background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                }}
                                >
                                    Refresh Info
                                </Button>
                              </Tooltip>
                            </ListItem>
                        <ListItem className="info" style={{ display: "block" }}>
                            <Typography align="center">
                              <Tooltip title="Share the rectangular box containing the selected pixels.">
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => {
                                        let prefix = window.location.hostname;
                                        if (window.location.port) { // for localhost
                                            prefix += ":" + window.location.port;
                                        }
                                        const fraction = Math.round(this.props.scale * NEIGHBORHOOD_SIZE / this.props.height * 100);
                                        navigator.clipboard.writeText(`https://${prefix}/rect/${bounds.left}/${bounds.right}/${bounds.top}/${bounds.bottom}/${fraction}`);
                                        notify({
                                        description: "URL copied to clipboard",
                                        });
                                    }}
                                    disabled={!this.props.scale}
                                    style={{
                                        width: "100%",
                                        color: "#FFFFFF",
                                        background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                    }}
                                    >
                                        <CopyOutlined />
                                        Share Rectangular Bounding
                                </Button>
                              </Tooltip>
                            </Typography>
                        </ListItem>
                        </>
                    </TabPanel>
                </div>
        )
    }
}