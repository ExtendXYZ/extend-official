import React from "react";
import "./index.css";
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
import { getSize, revertSize } from "../../utils"; 
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

  
  
export class FocusSidebar extends React.Component {
    constructor(props) {
      super(props);
      this.state = {value: 0};
      this.handleTabChange = this.handleTabChange.bind(this);
    }

    handleTabChange(event, newValue) {
        this.setState({value: newValue});
    };

    render() {
        let priceInfoName = this.props.focus.owned ? "Listing" : "Purchase";

        const sidebarHeader = <>
        <List>
            <ListItem>
            <div style={{display: 'flex',  justifyContent:'center', alignItems:'center'}}>
                <img
                    src={`https://metadata.extend.xyz/api/artwork?ext=png&x=${this.props.focus.x}&y=${this.props.focus.y}`}
                    style={this.props.focus.infoLoaded && this.props.focus.imgLoaded ? {maxWidth: "30%"} : {display: 'none'}}
                    class="center"
                    onLoad={() => this.props.handleOnImgLoad()}
                ></img>
            </div>
            </ListItem>
        </List>
        {(!this.props.focus.infoLoaded || !this.props.focus.imgLoaded) ? 
        <List>
            <ListItem className="info" style={{ display: "block"}}>
            <Spin size="large" style={{ marginTop: "50px", width: "100%"}} />
            </ListItem>
        </List> : (
        <>
        <List id="focusSidebarPrefix">
            <ListItem className="info" style={{ display: "block" }}>
                <Box style={{ fontSize: "12px", color: "gray" }}>POSITION</Box>
                <Box>
                <b>
                    <font color="#82CBC5">
                    X={this.props.focus.x}, Y={this.props.focus.y}
                    </font>
                </b>
                </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
                <Box style={{ fontSize: "12px", color: "gray" }}>NEIGHBORHOOD</Box>
                <Box>
                <b>
                    <font color="#82CBC5">
                    {this.props.focus.neighborhood_name ? this.props.focus.neighborhood_name : "NONE"}
                    </font>
                </b>
                </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
                <Box style={{ fontSize: "12px", color: "gray" }}>
                {this.props.focus.owned ? "OWNER (YOU)" : "OWNER"}
                </Box>
                <Box>
                <Button
                    size="small"
                    variant="text"
                    onClick={async () => {
                    if (this.props.focus.owner) {
                        navigator.clipboard.writeText(this.props.focus.owner.toBase58());
                        notify({
                            description: "Address copied to clipboard",
                        });
                    }
                    }}
                    style={{ padding: 0 }}
                    disabled={!this.props.focus.owner}
                >
                    {this.props.focus.owner ? (
                    <>
                        <CopyOutlined />
                        {shortenAddress(this.props.focus.owner.toBase58())}
                    </>
                    ) : (
                    "NONE"
                    )}
                </Button>
                </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
                <Box style={{ fontSize: "12px", color: "gray" }}>
                    MINT
                </Box>
                <Box>
                <Button
                    size="small"
                    variant="text"
                    onClick={async () => {
                    if (this.props.focus.mint) {
                        navigator.clipboard.writeText(this.props.focus.mint.toBase58());
                        notify({
                            description: "Address copied to clipboard",
                        });
                    }
                    }}
                    style={{ padding: 0 }}
                    disabled={!this.props.focus.mint}
                >
                    {this.props.focus.mint ? (
                    <>
                        <CopyOutlined />
                        {shortenAddress(this.props.focus.mint.toBase58())}
                    </>
                    ) : (
                    "NONE"
                    )}
                </Button>
                </Box>
            </ListItem>
        </List>
        </>)}
        </>;
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
                        <Tab label={priceInfoName} {...a11yProps(1)} />
                        <Tab label="Advanced" {...a11yProps(2)} />
                      </Tabs>
                    </AppBar>


                    <TabPanel value={this.state.value} index={0}>
                        {sidebarHeader}

                        {/* Color stuff */}
                        {(!this.props.focus.infoLoaded || !this.props.focus.imgLoaded) ?
                            null
                            :
                            (<List>
                                <Divider className="sidebarDivider">
                                    Modify Color
                                </Divider>
                                <ListItem className="info" style={{ display: "block" }}>
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
                                        disabled={!this.props.focus.owned}
                                        label={
                                        <Typography
                                            style={{ fontSize: "12px", color: "gray" }}
                                        >{`Current frame (Frame ${this.props.frame})`}</Typography>
                                        }
                                    />
                                    <FormControlLabel
                                        value={true}
                                        control={<Radio size="small" />}
                                        disabled={!this.props.focus.owned}
                                        label={
                                        <Typography style={{ fontSize: "12px", color: "gray" }}>
                                            All frames
                                        </Typography>
                                        }
                                    />
                                    </RadioGroup>
                                    <Box style={{ fontSize: "12px", color: "gray" }}>COLOR</Box>
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                    <input
                                        className="newColor"
                                        type="color"
                                        value={this.props.focus.color}
                                        onChange={(e) => this.props.handleChangeColor(e)}
                                        disabled={!this.props.focus.owned}
                                    ></input>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => {
                                            this.props.changeColor();
                                        }}
                                        style={{
                                        marginLeft: "5px",
                                        color: "#FFFFFF",
                                        background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                        }}
                                        disabled={!this.props.focus.owned}
                                    >
                                        Change Color
                                    </Button>
                                    </div>
                                </ListItem>
                            </List>)
                        }
                    </TabPanel>


                    
                    <TabPanel value={this.state.value} index={1}>
                        {sidebarHeader}

                        {/* purchase info */}
                        
                        {(!this.props.focus.infoLoaded || !this.props.focus.imgLoaded) ?
                            null
                            :
                            <>
                            {!this.props.focus.owned && this.props.focus.hasPrice ? 
                                <>
                                <Divider className="sidebarDivider">
                                    Purchase Space
                                </Divider>
                                <ListItem className="info" style={{ display: "block" }}>
                                    <Box style={{ fontSize: "12px", color: "gray" }}>PRICE</Box>
                                    <Box>
                                    <img
                                        src={
                                        require("../../assets/images/solana-transparent.svg")
                                            .default
                                        }
                                        alt="SOL"
                                    />
                                    <b>
                                        <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                                        {this.props.focus.hasPrice
                                            ? (this.props.focus.price.toFixed(3) > 0 ? this.props.focus.price.toFixed(3) : this.props.focus.price.toPrecision(2) )
                                            : "NONE"}
                                        </font>
                                    </b>
                                    </Box>
                                </ListItem>
                                <ListItem className="info" style={{ display: "block" }}>
                                    <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => {
                                        this.props.purchaseSpace();
                                    }}
                                    style={{
                                        width: "100%",
                                        color: "#FFFFFF",
                                        background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                    }}
                                    disabled={!this.props.user}
                                    >
                                    Buy Now
                                    </Button>
                                </ListItem>
                                </>
                            : 
                                (!this.props.focus.owned && !this.props.focus.hasPrice ?
                                    (<Divider className="sidebarDivider">
                                        Space Not Listed
                                    </Divider>) : null
                                )
                            }
                            {this.props.focus.owned ? (
                                // <Box sx={{ display: 'flex', color: '#173A5E', bgcolor: 'black' }}>
                                <>
                                <Divider className="sidebarDivider">
                                    Modify Listing
                                </Divider>
                                <ListItem className="info" style={{ display: "block" }}>
                                    <TextField
                                    hiddenLabel
                                    id="price-textfield"
                                    value={
                                        this.props.focus.price === null ? "" : this.props.focus.price
                                    }
                                    onChange={(e) => this.props.handleChangeFocusPrice(e)}
                                    style={{
                                        width: "100%",
                                        height: "30px",
                                    }}
                                    variant="filled"
                                    size="small"
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
                                        this.props.changePrice();
                                    }}
                                    style={{
                                        width: "100%",
                                        marginTop: "20px",
                                        color: "#FFFFFF",
                                        background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                    }}
                                    disabled={this.props.focus.price === null}
                                    >
                                    Set Price
                                    </Button>
                                    {this.props.focus.hasPrice ? (
                                    <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => {
                                        this.props.delistSpace();
                                        }}
                                        style={{
                                        width: "100%",
                                        marginTop: "10px",
                                        color: "#FFFFFF",
                                        background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                                        }}
                                    >
                                        Delist
                                    </Button>
                                    ) : null}
                                </ListItem>
                                </>
                            ) : null}
                            </>
                        }
                    </TabPanel>




                    <TabPanel value={this.state.value} index={2}>
                        {sidebarHeader}

                        {/* Advanced */}

                        {(!this.props.focus.infoLoaded || !this.props.focus.imgLoaded) ?
                            null
                            :   
                            <> 
                            <Divider className="sidebarDivider">
                                Advanced
                            </Divider>
                            <ListItem className="info" style={{ display: "block" }}>
                                <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                    this.props.handleFocusRefresh();
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
                                            navigator.clipboard.writeText(`https://${prefix}/space/${this.props.focus.x}/${this.props.focus.y}/${fraction}`);
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
                                            Share This Space
                                    </Button>
                                </Typography>
                            </ListItem>
                            </>
                        }
                    </TabPanel>
                  </div>            
        );
    }
}