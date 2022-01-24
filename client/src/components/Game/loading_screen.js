import React from "react";


export class LoadingScreen extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount(){
    document.body.style.backgroundColor = "black";
  }
  componentWillUnmount(){
    document.body.style.backgroundColor = null;
  }

  render() {
    return (

        <div className="loadingScreen">
            <img src={require("../../assets/images/space.gif").default} style={{height: window.innerHeight - 300 + "px"}} />
            <h1> Loading... </h1>
            <h1> Turn on auto-approve transactions for best experience </h1>

        </div>
    );
  }
}
