import React from "react";
import { Box, Button } from "@mui/material";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";

export class NeighborhoodSidebar extends React.Component {
  constructor(props) {
    super(props);
  }
  componentDidMount() {
    const canvas = document.getElementById("neighborhood-canvas");
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    context.drawImage(this.props.canvas, this.props.canvasSize * 0.25, 0, this.props.canvasSize * 0.5, this.props.canvasSize * 0.5);
  }
  componentDidUpdate() {
    const canvas = document.getElementById("neighborhood-canvas");
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    context.drawImage(this.props.canvas, this.props.canvasSize * 0.25, 0, this.props.canvasSize * 0.5, this.props.canvasSize * 0.5);
  }
  render() {
    let coordName = `Neighborhood (${this.props.n_x}, ${this.props.n_y})`;
    return (
    <div className="neighborhoodDashboard">
    <canvas id="neighborhood-canvas" width={this.props.canvasSize} height={this.props.canvasSize * 0.5}/>
    <h1 style={{marginTop: "20px"}}> {this.props.name} </h1>
    <h5> {coordName} </h5>
      <List id="focusSidebarPrefix">
        <ListItem className="info" style={{ display: "block" }}>
          <Box style={{ fontSize: "12px", color: "gray" }}>FLOOR</Box>
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
                  {this.props.trades.floor.toFixed(3)}
                </font>
              </b>
            </Box>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                  const poses = new Set(this.props.trades.floor_list.map( el => JSON.stringify({x : el[0], y: el[1]})));
                  this.props.setSelecting(poses);
              }}
              style={{
              marginLeft: "5px",
              color: "#FFFFFF",
              background: "linear-gradient(to right bottom, #36EAEF7F, #6B0AC97F)",
              }}
              // disabled={!this.props.focus.owned}
              >
              Select
            </Button>
          </div>
        </ListItem>
        <ListItem className="info" style={{ display: "block" }}>
          <Box style={{ fontSize: "12px", color: "gray" }}>VOLUME (LAST 24H)</Box>
          <Box>
            <img
              src={
                require("../../assets/images/solana-transparent.svg").default
              }
              alt="SOL"
            />
            <b>
              <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                {this.props.trades.volume.toFixed(3)}
              </font>
            </b>
          </Box>
        </ListItem>
        <ListItem className="info" style={{ display: "block" }}>
          <Box style={{ fontSize: "12px", color: "gray" }}>AVERAGE SALE (LAST 24H)</Box>
          <Box>
            <img
              src={
                require("../../assets/images/solana-transparent.svg").default
              }
              alt="SOL"
            />
            <b>
              <font color="#82CBC5" style={{ marginLeft: "5px" }}>
                {this.props.trades.average.toFixed(3)}
              </font>
            </b>
          </Box>
        </ListItem>

        <ListItem className="info" style={{ display: "block" }}>
          <Box style={{ fontSize: "12px", color: "gray" }}>LISTED ITEMS</Box>
          <Box>
                <b>
                    <font color="#82CBC5">
                    {this.props.trades.listed}
                    </font>
                </b>
                </Box>
        </ListItem>
        <ListItem className="info" style={{ display: "block" }}>
          <Box style={{ fontSize: "12px", color: "gray" }}>NUMBER OF DISTINCT OWNERS</Box>
          <Box>
                <b>
                    <font color="#82CBC5">
                    {this.props.trades.owners}
                    </font>
                </b>
                </Box>
        </ListItem>
        <ListItem className="info" style={{ display: "block" }}>
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
        </ListItem>
        {/* <ListItem className="info" style={{ display: "block" }}>
        <Box style={{ fontSize: "12px", color: "gray" }}>AVERAGE</Box>
        <Box>
          <b>
            <font color="#82CBC5">
              {this.props.focus.neighborhood_name
                ? this.props.focus.neighborhood_name
                : "NONE"}
            </font>
          </b>
        </Box>
      </ListItem>
      <ListItem className="info" style={{ display: "block" }}>
        <Box style={{ fontSize: "12px", color: "gray" }}>OWNERS</Box>
        <Box>
          <b>
            <font color="#82CBC5">
              {this.props.focus.neighborhood_name
                ? this.props.focus.neighborhood_name
                : "NONE"}
            </font>
          </b>
        </Box>
      </ListItem>
      <ListItem className="info" style={{ display: "block" }}>
        <Box style={{ fontSize: "12px", color: "gray" }}>NEIGHBORHOOD</Box>
        <Box>
          <b>
            <font color="#82CBC5">
              {this.props.focus.neighborhood_name
                ? this.props.focus.neighborhood_name
                : "NONE"}
            </font>
          </b>
        </Box>
      </ListItem> */}
      </List></div>
    );
    // return <div> Hello World </div>;
  }
}
