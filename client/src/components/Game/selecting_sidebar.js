import React from "react";
import "./index.css";
import {getBounds} from './index.js';
import { notify } from "../../utils";
import { NEIGHBORHOOD_SIZE } from "../../constants";
import {
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  TextField,
  RadioGroup,
  Typography,
  Radio,
} from "@mui/material";
import { Tooltip } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import { formatPrice, intersection} from "../../utils";
import {Tab, Tabs, AppBar} from "@mui/material";

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
      this.state = {value: 0, ownedSelection: new Set(), editable: new Set(), totalEditable: new Set(), editableSelection: new Set()};
      this.handleTabChange = this.handleTabChange.bind(this);
      this.selectionSize = 0;
    }

    componentDidMount(){
        this.setState({
          ownedSelection: intersection(this.props.ownedSpaces, this.props.selecting.poses),
          editable: this.props.selecting.editable,
          totalEditable: this.props.selecting.totalEditable,
          editableSelection: complement(this.props.selecting.editable, this.props.ownedSpaces),
        });
        this.selectionSize = this.props.selecting.poses.size;
    }

    componentDidUpdate(prevProps) {
        if (this.props.ownedSpaces != prevProps.ownedSpaces || this.props.selecting.poses != prevProps.selecting.poses
            || this.props.selecting.poses.size != this.selectionSize) {
                this.setState({
                  ownedSelection: intersection(this.props.ownedSpaces, this.props.selecting.poses),
                  editable: this.props.selecting.editable,
                  totalEditable: this.props.selecting.totalEditable,
                  editableSelection: complement(this.props.selecting.editable, this.props.ownedSpaces),
                });
                this.selectionSize = this.props.selecting.poses.size;
        }
        if (this.props.selecting.editable != this.state.editable || this.props.selecting.totalEditable != this.state.totalEditable ) {
          this.setState({
            editable: this.props.selecting.editable,
            totalEditable: this.props.selecting.totalEditable,
            editableSelection: complement(this.props.selecting.editable, this.props.ownedSpaces),
          });
        }

        // if new image upload, render preview
        if (this.props.selecting.hasImage && this.props.selecting.imgUpload !== prevProps.selecting.imgUpload) {
          // draw image on sidebar
          let reader = new FileReader();
          reader.onload = function (e) {
              let bfile = e.target.result;

              let image = new Image();

              // draw image in sidebar
              const img = document.getElementById("img-render");

              let bounds = getBounds(this.props.selecting.poses);
              const height = bounds.bottom - bounds.top + 1;
              const width = bounds.right - bounds.left + 1;

              let imgwidth;
              let imgheight;

              if (width >= height) {
                  imgwidth = 0.6*this.props.canvasSize;
                  imgheight = (height/width) * imgwidth;
              }
              else {
                  imgheight = 0.6*this.props.canvasSize;
                  imgwidth = (width/height) * imgheight;
              }

              image.onload = function () {
                  const context = img.getContext("2d", {
                      alpha: false,
                      desynchronized: true,
                  });
                  context.clearRect(0, 0, img.width, img.height);
                  context.fillStyle = "#000000";
                  context.fillRect(0, 0, img.width, img.height);
                  context.drawImage(image, 0, 0, imgwidth, imgheight);
              } // .bind(this)
              image.setAttribute("src",bfile);
          }.bind(this);

          reader.readAsDataURL(this.props.selecting.imgUpload);
        }
        else if (!this.props.selecting.hasImage){ // if no image, clear preview
          const img = document.getElementById("img-render");
          const context = img.getContext("2d", {
              alpha: false,
              desynchronized: true,
          });
          context.clearRect(0, 0, img.width, img.height);
        }
    }

    handleTabChange(event, newValue) {
        this.setState({value: newValue});
        this.props.resetTargets();
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

        const modifyColorHeader = <List style={{ marginTop: "0px" }}>
        <ListItem className="info" style={{ display: "block" }}>
            <Box className="infoHeader">
            <div style={{ display: "flex", alignItems: "center", width: "50%", float: "left"}}>
              OWNED SPACES
            </div>
            <div style={{ display: "flex", alignItems: "center", width: "50%", float: "right"}}>
              EDITABLE SPACES
            </div>
            </Box>
            <Box>
              <div style={{ display: "flex", alignItems: "center", width: "50%", float: "left"}}>
              <b>
                <font color="#82CBC5">
                  {this.state.ownedSelection.size +
                    "/" +
                    this.props.selecting.poses.size}
                </font>
              </b>
              </div>
              <div style={{ display: "flex", alignItems: "center", width: "50%", float: "right"}}>
              <b>
                <font color="#82CBC5">
                  {this.state.totalEditable.size +
                    "/" +
                    this.props.selecting.poses.size}
                </font>
              </b>
              </div>
            </Box>
            &nbsp;
            <Box>
              <div style={{ display: "flex", alignItems: "center", width: "100%"}}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    this.props.selectOwnedSpaces();
                  }}
                  style={{
                    marginLeft: "5px",
                    color: "#FFFFFF",
                    background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                  }}
                  disabled={!this.state.ownedSelection.size}
                >
                  SELECT OWNED SPACES
                </Button>
              </div>
            </Box>
            &nbsp;
        </ListItem>
        </List>;

        let tooltipModifyColorTitle = `Estimated Cost to Change Colors:  ${(this.state.ownedSelection.size * 0.000005 + this.state.editableSelection.size * 0.000001).toFixed(6)} SOL`;
        let tooltipSetPriceTitle = `Estimated Cost to List/Delist:  ${(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL`;
        let tooltipBuyTitle = `Batch buying is non-atomic and is available as a convenience feature. Successful purchase of every Space selected is not guaranteed.

        Estimated Transaction Cost to Buy:  ${(this.props.selecting.purchasableInfo.length * 0.000005).toFixed(6)} SOL`;
        let tooltipMakeEditable = `Click the checkbox to make your selected spaces editable by others and gain SOL from their color changes on the spaces. To make the spaces uneditable, simply change the color to your desired color.`;
        let tooltipEditPrice = `Pay a fixed price to upload an image or edit the color of editable spaces that you don't own (0.000001 SOL per space). After changing colors, the colors will be able to be edited again in 30 seconds.`

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
                      {/* <Tab label="Rent Info" {...a11yProps(3)} /> */}
                    </Tabs>
                  </AppBar>

                  

                  <TabPanel value={this.state.value} index={0}>
                      {modifyColorHeader}

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
                        
                        <Box className="infoHeader">
                          <Tooltip placement={'right'} title={tooltipModifyColorTitle}>
                          <div style={{width: "65%", float: "left"}}>
                            COLOR
                          </div>
                          </Tooltip>
                          {this.state.editableSelection.size > 0 ?
                          <Tooltip placement={'right'} title={tooltipEditPrice}>
                          <div style={{width: "35%", float: "right"}}>
                              EDIT PRICE
                          </div>
                          </Tooltip> 
                          : null
                          }
                        </Box>
                        <div style={{ display: "flex", alignItems: "center", width: "65%", float: "left"}}>
                          <input
                            className="newColor"
                            type="color"
                            value={this.props.selecting.color}
                            onChange={(e) => this.props.handleChangeColors(e)}
                            disabled={!this.state.ownedSelection.size && this.state.editableSelection.size === 0}
                          ></input>
                          <Tooltip placement={'right'} title={tooltipModifyColorTitle}>
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
                              disabled={!this.state.ownedSelection.size && this.state.editableSelection.size === 0}
                            >
                              Change Color
                            </Button>
                          </Tooltip>
                        </div>
                        {this.state.editableSelection.size > 0 ? 
                            <div style={{ display: "flex", alignItems: "center", width: "35%", float: "right"}}>
                                {(this.state.editableSelection.size * 0.000001).toFixed(6)} SOL
                            </div>
                          : null
                        }

                        {this.state.ownedSelection.size > 0 ?
                          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                              <Tooltip placement={'right'} title={tooltipMakeEditable}>
                              <FormControl>
                              <FormControlLabel
                                  style={{marginLeft: "2px"}} // fix alignment
                                  control={
                                      <Checkbox
                                          onChange={(e) => this.props.makeEditableColors(e)}
                                          checked={intersection(this.state.ownedSelection, this.state.editable).size === this.state.ownedSelection.size}
                                      />
                                  }
                                  labelPlacement="start"
                                  label="EDITABLE"
                              />
                              </FormControl>
                              </Tooltip>
                          </div>
                          : 
                          null
                        }
                        <div style={{display: "flex", alignItems: "center", width: "100%"}}>
                        <Box className="infoHeader" style={{marginTop: "10px", width: "100%"}}>IMAGE</Box>
                        </div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <Tooltip placement={'right'} title="Upload an image on your selected spaces">
                            <Button
                              variant="contained"
                              component="label"
                              size="small"
                              disabled={!this.state.ownedSelection.size && this.state.editableSelection.size === 0}
                              style={{
                                width: "100%",
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
                          {this.props.selecting.hasImage && 
                            <Box className="infoText1" style={{marginLeft: "10px"}}>
                              {this.props.selecting.imgUpload.name}
                            </Box> 
                          }
                        </div>
                        <canvas 
                          id="img-render"
                          style={{marginTop: "20px"}}
                          width={this.props.selecting.hasImage ? 0.6*this.props.canvasSize + "px" : 0}
                          height={this.props.selecting.hasImage ? 0.6*this.props.canvasSize + "px" : 0}/> 
                        <Tooltip placement={'right'} title={tooltipModifyColorTitle}>
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
                            disabled={!this.props.selecting.hasImage}
                          >
                            Upload
                          </Button>
                        </Tooltip>
                        &nbsp;
                      </ListItem>           
                  </TabPanel>


                    
                  <TabPanel value={this.state.value} index={1}>
                      {sidebarHeader}
                          
                      {/* Purchase info */}
                      
                      {this.state.ownedSelection.size > 0 ? 
                        <div>
                        <Divider className="sidebarDivider">
                            Modify Listing
                        </Divider>
                        <ListItem className="info" style={{ display: "block" }}>
                          {/* // <Box className="infoText2">
                          //   Estimated Cost:{" "}
                          //   {(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL
                          // </Box>  */}
                          <Tooltip placement={'right'} title={tooltipSetPriceTitle}>
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
                          <Tooltip placement={'right'} title={tooltipSetPriceTitle}>
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
                          <Tooltip placement={'right'} title={tooltipSetPriceTitle}>
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
                        </div> : null
                      }
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
                              this.props.selecting.totalPrice === null
                              ? "no spaces targeted"
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
                              this.props.selecting.totalPrice === null
                                ? "no spaces targeted"
                                :
                                formatPrice(this.props.selecting.totalPrice)
                              }
                            </font>
                          </b>
                        </Box>
                      </ListItem>
                      {/* <ListItem className="info" style={{ display: "block" }}>
                        // <Button
                        //   size="small"
                        //   variant="contained"
                        //   onClick={() => {
                        //     this.props.loadPurchasableInfo();
                        //   }}
                        //   style={{
                        //     width: "100%",
                        //     marginLeft: "5px",
                        //     color: "#FFFFFF",
                        //     background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                        //   }}
                        // >
                        //   Load Price Info
                        // </Button>
                      </ListItem> */}
                      <ListItem className="info" style={{ display: "block" }}>
                        <Tooltip placement={'right'} title="Select all purchasable Spaces in your selection to prepare to purchase them.">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.handleTargetAll();
                            }}
                            // disabled={this.props.selecting.loadingPricesStatus !== 2}
                            disabled={!this.props.selecting.infoLoaded}
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
                            // disabled={this.props.selecting.loadingPricesStatus !== 2}
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
                            // disabled={this.props.selecting.loadingPricesStatus !== 2}
                            style={{ width: "25%" }}
                            size="small"
                          />
                          <Tooltip placement={'right'} title="Select the cheapest rectangle in your selection of the specified width and height dimensions.">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                this.props.handleTargetFloor();
                              }}
                              disabled={!this.props.selecting.infoLoaded}
                              style={{
                                width: "45%",
                                // marginLeft: "10px",
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
                                                onChange={(e) => this.handleTargetFloor(e)} 
                                                checked={this.props.floor}
                                                disabled={this.props.selecting.loadingPricesStatus !== 2}
                                                />
                                            } 
                                            label="SHOW FLOOR"
                                        />
                                    </FormControl> */}
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Tooltip placement={'right'} title={tooltipBuyTitle}>
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
                              !this.props.user
                              || !this.props.selecting.infoLoaded
                              || this.props.selecting.purchasable.size === 0
                            }
                          >
                            Buy Now
                          </Button>
                        </Tooltip>
                        &nbsp;
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
                              <Tooltip placement={'right'} title="Refresh information for these Spaces directly from the blockchain. Refreshing may be rate-limited if performed excessively.">  
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
                              <Tooltip placement={'right'} title="Copy link to the rectangular box containing the selected pixels.">
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
                            &nbsp;
                        </ListItem>
                        </>
                    </TabPanel>



                    <TabPanel value={this.state.value} index={3}>
                      {sidebarHeader}
                          
                      {/* Purchase info */}

                      <Divider className="sidebarDivider">
                          Modify Rent
                      </Divider>
                      <ListItem className="info" style={{ display: "block" }}>
                        {/* <Box className="infoText2">
                          Estimated Cost:{" "}
                          {(this.state.ownedSelection.size * 0.000005).toFixed(6)} SOL
                        </Box> */}
                        <Tooltip placement={'right'} title={tooltipSetPriceTitle}>
                          <Box className="infoHeader">PRICE (per day)</Box>
                        </Tooltip>
                        <TextField
                          hiddenLabel
                          id="price-textfield"
                          value={
                            this.props.selecting.rentPrice === null
                              ? ""
                              : this.props.selecting.rentPrice
                          }
                          onChange={(e) => this.props.handleChangeSelectingRentPrice(e)}
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
                        <Tooltip placement={'right'} title={tooltipSetPriceTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.changeRents();
                            }}
                            style={{
                              width: "100%",
                              marginTop: "20px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={
                              !this.state.ownedSelection.size ||
                              this.props.selecting.rentPrice === null
                            }
                          >
                            Set Rent
                          </Button>
                        </Tooltip>
                        <Tooltip placement={'right'} title={tooltipSetPriceTitle}>
                          <Button
                            size="small"
                            variant="contained"ent
                            onClick={() => {
                              this.props.delistRents();
                            }}
                            style={{
                              width: "100%",
                              marginTop: "10px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={!this.state.ownedSelection.size}
                          >
                            Delist Rent
                          </Button>
                        </Tooltip>
                      </ListItem>
                      <Divider className="sidebarDivider" style={{marginTop: "20px"}}>
                          Rent Spaces
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
                              this.props.selecting.loadingRentStatus !== 2
                                ? "not loaded"
                              :
                                this.props.selecting.rentableInfo.length +
                                "/" +
                                this.props.selecting.poses.size}
                            </font>
                          </b>
                        </Box>
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Box className="infoText1">Total Price (per day)</Box>
                        <Box
                          style={{
                            filter:
                              this.props.selecting.loadingRentStatus === 1
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
                              this.props.selecting.loadingRentStatus !== 2
                                ? "not loaded"
                                :
                                formatPrice(this.props.selecting.totalRentPrice)
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
                            this.props.loadRentableInfo();
                          }}
                          style={{
                            width: "100%",
                            marginLeft: "5px",
                            color: "#FFFFFF",
                            background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                          }}
                        >
                          Load Rent Info
                        </Button>
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Tooltip placement={'right'} title="Select all purchasable Spaces in your selection to prepare to purchase them.">
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.handleTargetRentAll();
                            }}
                
                            disabled={this.props.selecting.loadingRentStatus !== 2}
                            style={{
                              width: "100%",
                              marginLeft: "5px",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                          >
                            Target All Rentable
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
                            disabled={this.props.selecting.loadingRentStatus !== 2}
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
                            disabled={this.props.selecting.loadingRentStatus !== 2}
                            style={{ width: "25%" }}
                            size="small"
                          />
                          <Tooltip placement={'right'} title="Select the cheapest rectangle in your selection of the specified width and height dimensions.">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => {
                                this.props.handleTargetRentFloor();
                              }}
                              disabled={this.props.selecting.loadingRentStatus !== 2}
                              style={{
                                width: "45%",
                                // marginLeft: "10px",
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
                                                onChange={(e) => this.handleTargetFloor(e)} 
                                                checked={this.props.floor}
                                                disabled={this.props.selecting.loadingPricesStatus !== 2}
                                                />
                                            } 
                                            label="SHOW FLOOR"
                                        />
                                    </FormControl> */}
                      </ListItem>
                      <ListItem className="info" style={{ display: "block" }}>
                        <Tooltip placement={'right'} title={tooltipBuyTitle}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              this.props.rentSpaces();
                            }}
                            style={{
                              width: "100%",
                              color: "#FFFFFF",
                              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                            }}
                            disabled={
                              !this.props.user ||
                              this.props.selecting.loadingRentStatus !== 2 ||
                              this.props.selecting.rentable.size === 0
                            }
                          >
                            Rent Now
                          </Button>
                        </Tooltip>
                      </ListItem>
                  </TabPanel>
                </div>
        )
    }
}