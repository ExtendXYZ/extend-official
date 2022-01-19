import React, {useCallback, useState} from "react";
import {Box} from "@mui/system";

import ConnectButton from "../ConnectButton";
import {ModalEnum, useModal, useWalletModal} from "../../contexts";
import {useWallet} from "@solana/wallet-adapter-react";
import {Tab, Tabs} from "@mui/material";
import {Link, useLocation} from "react-router-dom";

export const Header: React.FC = () => {
  const { setModal } = useModal();
  const { setVisible } = useWalletModal();
  const wallet = useWallet();
  const connected = wallet.connected;
  const location = useLocation();
  const paths = location.pathname.split('/');
  // const head = paths[1] ? "/" + paths[1] : "";
  const tail = paths[paths.length-1] ? paths[paths.length-1] : ""

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

  const isMobile = window.innerWidth < 500;
  return (<Box
      sx={{
        display: "flex",
        bgcolor: "action.disabledBackground",
      }}
      minWidth="100%"
    >
      {isMobile ? 
      <Box sx={{height: "62px"}}> </Box> :
      <>
      <Box
        sx={{
          display: "flex",
          height: "62px",
          justifyContent: "flex-start",
          alignItems: "center",
        }}
      > 
         <img
          src={
            require("../../assets/images/logo_small.svg")
            .default
            }
            alt="EXTEND"
         />
         <Tabs value={tabState} 
          onChange={handleTab} 
          indicatorColor="secondary"
          TabIndicatorProps={{
            style: {
              backgroundColor: "#DC1FFF"
             }
            }} >
          <Link to={"/"} style={{ color: '#CE65B0' }}><Tab value={0} label="Canvas" sx={{fontWeight: "bold"}}/></Link>
          <Link to={"/activity"} style={{ color: '#CE65B0' }}><Tab value={1} label="Activity" sx={{fontWeight: "bold"}}/></Link>
          <Link to={"/mint"} style={{ color: '#CE65B0' }}><Tab value={2} label="Mint" sx={{fontWeight: "bold"}}/></Link>
          </Tabs>
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
        onClickConnect={handleConnect}
        onClickChange={handleChange}
      />
      </Box>
      </>
    }
    </Box>
  );
};

export default Header;
