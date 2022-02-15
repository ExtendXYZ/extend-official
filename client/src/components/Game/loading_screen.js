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
            <h5> Tip: Visit the Help tab for tutorials on using the Canvas </h5>

        </div>
    );
  }
}
