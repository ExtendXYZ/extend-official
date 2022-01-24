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
            <img src={require("../../assets/images/space.gif").default} style={{height: window.innerHeight - 200 + "px"}} />
            <h1> Loading... </h1>
            <h5> Turn on auto-approving transactions for the best experience </h5>

        </div>
    );
  }
}
