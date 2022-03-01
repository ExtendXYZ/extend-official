import React from "react";
import { 
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField
} from "@mui/material";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import { Tooltip, Spin } from "antd";
import {formatPrice, notify} from "../../utils"; 

export class NeighborhoodSidebar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showUpdateNeighborhoodMetadataDialogue: false
    }
  }
  componentDidMount() {
    if (!this.props.neighborhood.infoLoaded){
      return;
    }
    const canvas = document.getElementById("neighborhood-canvas");
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    
    context.drawImage(this.props.canvas, this.props.canvasSize * 0.25, 0, this.props.canvasSize * 0.5, this.props.canvasSize * 0.5);
    context.strokeStyle = 'white';
    context.strokeRect(this.props.canvasSize * 0.25, 0, this.props.canvasSize * 0.5, this.props.canvasSize * 0.5);

  }
  componentDidUpdate() {
    if (!this.props.neighborhood.infoLoaded){
      return;
    }
    const canvas = document.getElementById("neighborhood-canvas");
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    context.drawImage(this.props.canvas, this.props.canvasSize * 0.25, 0, this.props.canvasSize * 0.5, this.props.canvasSize * 0.5);
    context.strokeStyle = 'white';
    context.strokeRect(this.props.canvasSize * 0.25, 0, this.props.canvasSize * 0.5, this.props.canvasSize * 0.5);
  }
  handleSaveNeighborhoodMetadata = () => {
    let name = document.getElementById("name_text_field").value;
    let voucherLiveDate = Number(document.getElementById("voucher_live_date_text_field").value);
    let voucherReceiveLimit = Number(document.getElementById("voucher_receive_limit_text_field").value);
    let voucherPriceCoefficient = Number(document.getElementById("voucher_price_coefficient_text_field").value);
    if (voucherLiveDate < 0 || voucherReceiveLimit < 0 || voucherPriceCoefficient < 0){
      notify({message: "Negative values not allowed"});
      return;
    }
    try{
      this.props.updateNeighborhoodMetadata({
        name,
        voucherLiveDate,
        voucherReceiveLimit,
        voucherPriceCoefficient,
      });
    } catch(e){
        console.error(e);
        notify({message: "Invalid input"});
    }
    this.setState({ showUpdateNeighborhoodMetadataDialogue: false });
  }
  render() {
    let coordName = `Neighborhood (${this.props.neighborhood.n_x}, ${this.props.neighborhood.n_y})`;
    return (
      !this.props.neighborhood.infoLoaded ? 
        <List>
            <ListItem className="info" style={{ display: "block"}}>
            <Spin size="large" style={{ marginTop: "50px", width: "100%"}} />
            </ListItem>
        </List> : (
          <div className="neighborhoodDashboard">
          <h1 style={{marginTop: "20px"}}> {this.props.name} </h1>
          <h5> {coordName} </h5>
          <canvas id="neighborhood-canvas" width={this.props.canvasSize} height={this.props.canvasSize * 0.5}/>
          <List id="focusSidebarPrefix">
            <ListItem className="info" style={{ display: "block" }}>
            <Tooltip placement={'right'} title="The cheapest Space price in this Neighborhood">
              <Box className="infoHeader">FLOOR</Box>
            </Tooltip>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Box>
                  <img
                    src={
                      require("../../assets/images/solana-transparent.svg").default
                    }
                    alt="SOL"
                  />
                  <b>
                    <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                      {this.props.neighborhood.trades.listed_count ? formatPrice(this.props.neighborhood.trades.floor_price) : "N/A"}
                    </font>
                  </b>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                      const poses = new Set(this.props.neighborhood.trades.floor);
                      this.props.setSelecting(poses);
                  }}
                  style={{
                  marginLeft: "5px",
                  color: "#FFFFFF",
                  background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                  }}
                  disabled={!this.props.neighborhood.trades.listed_count}
                  >
                  Select
                </Button>
              </div>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
              <Box className="infoHeader">VOLUME (LAST 24H)</Box>
              <Box>
                <img
                  src={
                    require("../../assets/images/solana-transparent.svg").default
                  }
                  alt="SOL"
                />
                <b>
                  <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                    {formatPrice(this.props.neighborhood.trades.volume)}
                  </font>
                </b>
              </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
              <Box className="infoHeader">AVERAGE SALE PRICE (LAST 24H)</Box>
              <Box>
                <img
                  src={
                    require("../../assets/images/solana-transparent.svg").default
                  }
                  alt="SOL"
                />
                <b>
                  <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                    {this.props.neighborhood.trades.volume > 0 ? formatPrice(this.props.neighborhood.trades.average) : "N/A"}
                  </font>
                </b>
              </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
              <Box className="infoHeader">LISTED ITEMS</Box>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Box>
                  <b>
                      <font color="#82CBC5">
                      {this.props.neighborhood.trades.listed_count}
                      </font>
                  </b>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                      const poses = new Set(this.props.neighborhood.trades.listed);
                      this.props.setSelecting(poses);
                  }}
                  style={{
                  marginLeft: "5px",
                  color: "#FFFFFF",
                  background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                  }}
                  disabled={!this.props.neighborhood.trades.listed_count}
                  >
                  Select
                </Button>
              </div>
                </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
              <Box className="infoHeader">NUMBER OF DISTINCT OWNERS</Box>
              <Box>
                    <b>
                        <font color="#82CBC5">
                        {this.props.neighborhood.trades.owners}
                        </font>
                    </b>
                    </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
              <Box className="infoHeader">NUMBER OF FRAMES</Box>
              <Box>
                    <b>
                        <font color="#82CBC5">
                        {this.props.neighborhood.numFrames}
                        </font>
                    </b>
                    </Box>
            </ListItem>
            <ListItem className="info" style={{ display: "block" }}>
              <Tooltip placement={'right'} title="Add a new frame for this Neighborhood">
                <Button
                size="small"
                variant="contained"
                onClick={() => {
                    this.props.addNewFrame();
                }}
                style={{
                    width: "100%",
                    marginTop: "20px",
                    color: "#FFFFFF",
                    background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                }}
                >
                Add New Frame (cost: 0.84 SOL)
                </Button>
              </Tooltip>
            </ListItem>
            {
              this.props.user && this.props.neighborhood.creator && 
              this.props.user.toBase58() === this.props.neighborhood.creator.toBase58() ? 
              <ListItem className="info" style={{ display: "block" }}>
                <Tooltip placement={'right'} title="Update neighborhood metadata">
                  <Button
                  size="small"
                  variant="contained"
                  onClick={() => {this.setState({showUpdateNeighborhoodMetadataDialogue: true})}}
                  style={{
                      width: "100%",
                      marginTop: "20px",
                      color: "#FFFFFF",
                      background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                  }}
                  >
                  Update Metadata
                  </Button>
                </Tooltip>
              </ListItem> : null
            }
          </List>
          <Dialog
                    open={this.state.showUpdateNeighborhoodMetadataDialogue}
                    onClose={() => this.setState({ showUpdateNeighborhoodMetadataDialogue: false })}
                >
                    <DialogTitle>Update neighborhood metadata
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            To expand to this Neighborhood, first initialize the candy machine
                            config and paste its address here, and we'll handle the rest. Make
                            sure the config corresponds to the selected Neighborhood, and that the connected
                            wallet is the authority of the config!
                        </DialogContentText>
                        <TextField
                            autoFocus
                            id="name_text_field"
                            margin="dense"
                            label="Neighborhood Name"
                            fullWidth
                            variant="standard"
                            defaultValue={this.props.neighborhood.name}
                        />
                        <TextField
                            autoFocus
                            id="voucher_live_date_text_field"
                            margin="dense"
                            label="Voucher Live Date (unix timestamp)"
                            fullWidth
                            variant="standard"
                            type='number'
                            defaultValue={this.props.neighborhood.voucherLiveDate}
                        />
                        <TextField
                            autoFocus
                            id="voucher_receive_limit_text_field"
                            margin="dense"
                            label="Voucher Receive Limit"
                            fullWidth
                            variant="standard"
                            type='number'
                            defaultValue={this.props.neighborhood.voucherReceiveLimit}
                        />
                        <TextField
                            autoFocus
                            id="voucher_price_coefficient_text_field"
                            margin="dense"
                            label="Voucher Price Coefficient"
                            fullWidth
                            variant="standard"
                            type='number'
                            defaultValue={this.props.neighborhood.voucherPriceCoefficient}
                        />
                        
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => this.setState({ showUpdateNeighborhoodMetadataDialogue: false })}>
                            Cancel
                        </Button>
                        <Button
                            onClick={this.handleSaveNeighborhoodMetadata}
                            disabled={!this.props.user}
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
        </div>
      )
    );
  }
}
