import React from "react";
import {View, Image, Text} from "react-native";


export class LoadingScreen extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (

        <div className="loadingScreen" style=
          {{
            display: "flex",
            backgroundColor: "black",
          }}
        >
            <img src={require("../../assets/images/space.gif").default} style={{height: window.innerHeight - 63 + "px"}} />
            <h1> Loading... </h1>
            <h1> Turn on auto-approve transactions for best experience </h1>

        </div>
    );
  }
}
