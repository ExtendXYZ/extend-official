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
        this.state.ownedSelection = intersection(this.props.ownedSpaces, this.props.selecting.poses);
    }

    componentDidUpdate(prevProps) {
        if (this.props.ownedSpaces !== prevProps.ownedSpaces || this.props.selecting.poses != prevProps.selecting.poses) {
            this.state.ownedSelection = intersection(this.props.ownedSpaces, this.props.selecting.poses);
        }
    }

    handleTabChange(event, newValue) {
        this.setState({value: newValue});
    };

    render() {
        let bounds = getBounds(this.props.selecting.poses);

        const sidebarHeader = <List style={{ marginTop: "0px" }}>
        <ListItem className="info" style={{ display: "block" }}>
          <Box style={{ fontSize: "12px", color: "gray" }}>OWNED SPACES</Box>
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
                        <Box style={{ fontSize: "10px", color: "gray" }}>
                          Estimated Cost:{" "}
                          {(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL
                        </Box>
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
                                style={{ fontSize: "12px", color: "gray" }}
                              >{`Current frame (Frame ${this.props.frame})`}</Typography>
                            }
                          />
                          <FormControlLabel
                            value={true}
                            control={<Radio size="small" />}
                            label={
                              <Typography style={{ fontSize: "12px", color: "gray" }}>
                                All frames
                              </Typography>
                            }
                          />
                        </RadioGroup>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <input
                            className="newColor"
                            type="color"
                            value={this.props.selecting.color}
                            onChange={(e) => this.props.handleChangeColors(e)}
                            disabled={!this.state.ownedSelection.size}
                          ></input>
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
                        </div>

                        <Box style={{ fontSize: "12px", color: "gray", marginTop: "10px"}}>IMAGE</Box>
                        <div style={{ display: "flex", alignItems: "center" }}>
                        <Tooltip title="Upload an image on your selected spaces">
                          <Button
                            variant="outlined"
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
                          <Box style={{marginLeft: "10px"}}>
                            {this.props.imageFilename}
                          </Box> 
                        }
                        </div>
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
                      </ListItem>            
                  </TabPanel>


                    
                  <TabPanel value={this.state.value} index={1}>
                      {sidebarHeader}
                          
                      {/* Purchase info */}

                      <Divider className="sidebarDivider">
                          Modify Listing
                      </Divider>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Box style={{ fontSize: "10px", color: "gray" }}>
                          Estimated Cost:{" "}
                          {(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL
                        </Box>
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
                      </ListItem>
                      <Divider className="sidebarDivider" style={{marginTop: "20px"}}>
                          Purchase Spaces
                      </Divider>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Box style={{ fontSize: "12px", color: "gray" }}>
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
                        <Box style={{ fontSize: "12px", color: "gray" }}>Total Price</Box>
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
                          variant="outlined"
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
                        <Button
                          size="small"
                          variant="outlined"
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
                          <Button
                            size="small"
                            variant="outlined"
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
                        <Tooltip title="Batch buying is non-atomic and is available as a convenience feature. Successful purchase of every space selected is not guaranteed.">
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
                            </ListItem>
                        <ListItem className="info" style={{ display: "block" }}>
                            <Typography align="center">
                                <Button
                                    variant="contained"
                                    onClick={() => {
                                        const prefix = RPC?.includes("mainnet") ? "canvas.extend.xyz" : "localhost:3000";
                                        const fraction = Math.round(this.props.scale * NEIGHBORHOOD_SIZE / this.props.height * 100);
                                        navigator.clipboard.writeText(`https://${prefix}/rect/${bounds.left}/${bounds.right}/${bounds.top}/${bounds.bottom}/${fraction}`);
                                        notify({
                                        description: "URL copied to clipboard",
                                        });
                                    }}
                                    disabled={!this.props.scale}
                                    sx={{
                                        marginRight: "10px",
                                        borderRadius: "40px",
                                        color: "#FFFFFF",
                                        background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                    }}
                                    style={{
                                        width: "100%",
                                    }}
                                    >
                                        <CopyOutlined />
                                        Share Rectangular Bounding
                                </Button>
                            </Typography>
                        </ListItem>
                        </>
                    </TabPanel>
                </div>
        )
    }
}