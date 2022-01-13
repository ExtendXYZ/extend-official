import {useCallback} from "react";
import {useWallet} from "@solana/wallet-adapter-react";
import {ENDPOINTS, ModalEnum, useConnectionConfig, useModal, useWalletModal} from "../../contexts";
import {notify, shortenAddress} from "../../utils";
import {CopyOutlined} from "@ant-design/icons";
import {Box} from "@mui/system";
import {Button, FormControl, NativeSelect} from "@mui/material";
import {RPC} from "../../constants";

export function Settings ({
  additionalSettings,
}: {
  additionalSettings?: JSX.Element;
}) {
  const { connected, disconnect, publicKey } = useWallet();
  const { setEndpoint, env, endpoint } = useConnectionConfig();
  const { setVisible } = useWalletModal();
  const open = useCallback(() => setVisible(true), [setVisible]);
  const { setModal } = useModal();

  const handleConnect = useCallback(() => {
    setModal(ModalEnum.WALLET);
    setVisible(true);
  }, [setModal, setVisible]);
  
  return (<Box sx={{ display: "flex", minWidth: "100%" }}>
        {!connected && (
          <>
            <Button
              variant="contained"
              onClick={handleConnect}
              style={{
                color: "#FFFFFF", 
                background: 'linear-gradient(to right bottom, #36EAEF, #6B0AC9)', 
                borderRadius: '40px'
              }}
            >
              <b>Connect</b>
            </Button>
          </>
        )}
        {connected && (
          <>
            {publicKey && (
              <Button
                variant="contained"
                onClick={async () => {
                  if (publicKey) {
                    await navigator.clipboard.writeText(publicKey.toBase58());
                    notify({
                      message: "Wallet update",
                      description: "Address copied to clipboard",
                    });
                  }
                }}
                style={{
                  color: "#FFFFFF", 
                  background: 'linear-gradient(to right bottom, #36EAEF, #6B0AC9)',
                  borderRadius: '40px'
                }}
              >
                <CopyOutlined />
                <b>{shortenAddress(publicKey.toBase58())}</b>
              </Button>
            )}
            {/* <Button
              variant="contained"
              onClick={open}
              style={{ 
                color: "#FFFFFF", 
                marginLeft: "10px", 
                background: 'linear-gradient(to right bottom, #36EAEF, #6B0AC9)',
                borderRadius: '40px'
              }}
            >
              <b>Change Wallet</b>
            </Button> */}
            <Button
              variant="contained"
              onClick={() => disconnect().catch()}
              style={{ 
                color: "#FFFFFF", 
                marginLeft: "10px", 
                background: 'linear-gradient(to right bottom, #FF0000, #FE7801)',
                borderRadius: '40px'
              }}
            >
              {/* <b>Disconnect ({env})</b> */}
              <b>Disconnect</b>
            </Button>
          </>
        )}
        {additionalSettings}
  </Box>);
}
