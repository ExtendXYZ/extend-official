import React, { useCallback, useState } from "react";
import { Box } from "@mui/system";

import ConnectButton from "../ConnectButton";
import { ModalEnum, useModal, useWalletModal } from "../../contexts";
import { useWallet } from "@solana/wallet-adapter-react";
import { Link, useLocation } from "react-router-dom";
import { Tab, Tabs } from "@mui/material";

export const Header = (props: { setNotificationsBar?: (type: string) => void }) => {
  const { setModal } = useModal();
  const { setVisible } = useWalletModal();
  const wallet = useWallet();
  const connected = wallet.connected;
  const location = useLocation();
  const paths = location.pathname.split('/');
  // const head = paths[1] ? "/" + paths[1] : "";
  const tail = paths[paths.length - 1] ? paths[paths.length - 1] : ""

  const handleChange = useCallback(() => setVisible(true), [setVisible]);

  const handleConnect = useCallback(() => {
    setModal(ModalEnum.WALLET);
    setVisible(true);
  }, [setModal, setVisible]);

  const fetchCurrentTab = () => {
    if (tail === "canvas") {
      return 0;
    } else if (tail === "activity") {
      return 1;
    } else if (tail === "mint") {
      return 2;
    }
    return 0;
  };
  const [tabState, setTabState] = useState(fetchCurrentTab);

  const handleTab = (e, value) => {
    setTabState(value);
  };

  return (
      <Box
          sx={{
            display: "flex",
            bgcolor: "action.disabledBackground",
          }}
          className={"headerMenu gameMenu"}
          minWidth="100%"
      >
        <Box
            sx={{
              display: "flex",
              height: "62px",
              justifyContent: "flex-start",
              alignItems: "center",
            }}
        >
          <div style={{ marginLeft: 36, display: "flex" }}>
            <img className={"headerLogoLeft"} src={"header/logo.svg"} />
            <Tabs value={tabState}
                  onChange={handleTab}
                  indicatorColor="secondary"
                  TabIndicatorProps={{
                    style: {
                      backgroundColor: "#DC1FFF"
                    }
                  }}>
              <Link to={"/"} style={{ color: '#CE65B0' }}>
                <Tab value={0} label="Canvas" sx={{ fontWeight: "bold" }} />
              </Link>
              <Link to={"/activity"} style={{ color: '#CE65B0' }}>
                <Tab value={1} label="Activity" sx={{ fontWeight: "bold" }} />
              </Link>
              <Link to={"/mint"} style={{ color: '#CE65B0' }}>
                <Tab value={2} label="Mint" sx={{ fontWeight: "bold" }} />
              </Link>

            </Tabs>
          </div>
        </Box>
        <Box sx={{ flexGrow: 1 }}></Box>
        <Box
            sx={{
              display: "flex",
              height: "62px",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
        >
          <ConnectButton
              isConnected={connected}
              sx={{ marginRight: "36px" }}
              style={{ marginRight: 36 }}
              onClickConnect={handleConnect}
              onClickChange={handleChange}
          />
        </Box>
      </Box>
  );
};

export default Header;
