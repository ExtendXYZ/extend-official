import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ENDPOINTS, ModalEnum, useConnectionConfig, useModal, useWalletModal } from "../../contexts";
import { notify, shortenAddress } from "../../utils";
import { CopyOutlined } from "@ant-design/icons";
import { Box } from "@mui/system";
import { Button, FormControl, NativeSelect } from "@mui/material";

export function Settings({
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

  return (
      <>
        <Box sx={{ display: "flex", minWidth: "100%" }}>
          {!connected && (
              <>
                <Button
                    variant="contained"
                    onClick={handleConnect}
                    className={"defaultButton gradientButton"}
                >
                  <b>Connect wallet</b>
                </Button>
              </>
          )}
          {connected && (
              <>
                {publicKey && (
                    <Button
                        className={"defaultButton"}
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
                    >
                      <CopyOutlined />
                      <b>{shortenAddress(publicKey.toBase58())}</b>
                    </Button>
                )}
                {/* <Button
                    variant="contained"
                    className={"defaultButton"}
                    onClick={open}
                >
                  <b>Change Wallet</b>
                </Button> */}
                <Button
                    variant="contained"
                    className={"defaultButton"}
                    onClick={() => disconnect().catch()}
                >
                  {/* <b>Disconnect ({env})</b> */}
                  <b>Disconnect</b>
                </Button>
              </>
          )}
          {additionalSettings}
        </Box>
      </>
  );
}