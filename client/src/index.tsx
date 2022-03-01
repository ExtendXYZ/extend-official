import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "antd/dist/antd.css";
import "@fontsource/open-sans";
import "@fontsource/roboto";
import "@fontsource/sora";

import App from "./App";
import AppMint from "./AppMint";
import { Activity, Message } from "./components";
import { ConnectionProvider, WalletProvider, InboxProvider } from "./contexts";
import reportWebVitals from "./reportWebVitals";

import "./index.css";

ReactDOM.render(
  <React.StrictMode>
    <ConnectionProvider>
      <WalletProvider>
        <InboxProvider>
        <Router>
          <Switch>
            <Route exact path="/mint"><AppMint /></Route>
            <Route exact path="/activity"><Activity /></Route>
            <Route exact path="/message"><Message /></Route>
            <Route exact path="/locator/:x/:y/:scale"><App /></Route>
            <Route exact path="/pubkey/:address"><App /></Route>
            <Route exact path="/space/:col/:row/:scale"><App /></Route>
            <Route exact path="/rect/:colStart/:colEnd/:rowStart/:rowEnd/:scale"><App /></Route>
            <Route exact path="/neighborhood/:nX/:nY"><App /></Route>
            <Route exact path="/"><App /></Route>
          </Switch>
        </Router>
        </InboxProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>,
  document.getElementById("root")
);

reportWebVitals();