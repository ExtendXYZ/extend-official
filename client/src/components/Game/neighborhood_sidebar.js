import React from "react";
import { Box, Button, Tooltip } from "@mui/material";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import { Spin } from "antd";
import {formatPrice} from "../../utils"; 

export class NeighborhoodSidebar extends React.Component {
  constructor(props) {
    super(props);
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
            <Tooltip title="The cheapest space price in this neighborhood">
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
                      {this.props.neighborhood.trades.listed ? formatPrice(this.props.neighborhood.trades.floor) : "N/A"}
                    </font>
                  </b>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                      const poses = new Set(this.props.neighborhood.trades.floor_list.map( el => JSON.stringify({x : el[0], y: el[1]})));
                      this.props.setSelecting(poses);
                  }}
                  style={{
                  marginLeft: "5px",
                  color: "#FFFFFF",
                  background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
                  }}
                  disabled={!this.props.neighborhood.trades.listed}
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
              <Box>
                    <b>
                        <font color="#82CBC5">
                        {this.props.neighborhood.trades.listed}
                        </font>
                    </b>
                    </Box>
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
              <Tooltip title="Add a new frame for this neighborhood">
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
                Add New Frame
                </Button>
              </Tooltip>
            </ListItem>
          </List>
        </div>
      )
    );
  }
}
