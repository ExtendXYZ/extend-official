import { WalletError } from "@solana/wallet-adapter-base";
import { WalletAdapter } from "../../types/wallet";
import { useWallet, WalletProvider as BaseWalletProvider, } from "@solana/wallet-adapter-react";
import {
    getLedgerWallet,
    getMathWallet,
    getPhantomWallet,
    getSolflareWallet,
    getSolletWallet,
    getSolongWallet,
    getTorusWallet,
} from "@solana/wallet-adapter-wallets";
import { Button } from "antd";
import React, { createContext, FC, ReactNode, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import { notify } from "../../utils";

import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

import "./wallet.less";
import CancelIcon from "@mui/icons-material/Cancel";

export interface WalletModalContextState {
    visible: boolean;
    setVisible: (open: boolean) => void;
}

export const WalletModalContext = createContext<WalletModalContextState>(
    {} as WalletModalContextState
);

export function useWalletModal(): WalletModalContextState {
    return useContext(WalletModalContext);
}

export const WalletModal: FC = () => {
    const { wallets, wallet: selected, select } = useWallet();
    const { visible, setVisible } = useWalletModal();
    const close = useCallback(() => {
        setVisible(false);
    }, [setVisible]);

    return (
        <div
            className="sidenav notifications-sidenav"
            style={{ width: Math.min(visible ? 500 : 0, window.innerWidth - 48) }}
        >
            <div className="close">
                <CancelIcon onClick={close} />
            </div>
            <>
                <>
                    <div
                        style={{
                            textAlign: "center",
                            verticalAlign: "middle",
                            fontWeight: 700,
                            fontSize: "1.3rem",
                            lineHeight: 2.4,
                            marginBottom: 10,
                        }}
                    ></div>
                    <div style={{margin: "0 16px"}}>
                        <div style={{display: "flex"}}>
                            <PersonOutlineIcon style={{color: "#FFFFFFB2"}}/> &nbsp; <p className={"dm"} style={{color: "#FFFFFFB2"}}>My Wallet</p>
                        </div>
                    </div>
                    <hr style={{border: "1px solid gray", filter: "opacity(0.5)"}}/>
                    <div style={{margin: "0 16px"}}>
                        <p className={"dm"} style={{margin: "10px 0", color: "#FFFFFFB2"}}>Connect your wallet & explore metaverse...</p>
                    </div>                    <br />
                    {wallets.map((wallet) => {
                        return (
                            <Button
                                key={wallet.name}
                                size="large"
                                type={wallet === selected ? "primary" : "ghost"}
                                onClick={() => {
                                    select(wallet.name);
                                    close();
                                }}
                                icon={
                                    <img
                                        alt={`${wallet.name}`}
                                        width={20}
                                        height={20}
                                        src={wallet.icon}
                                        style={{ marginRight: 30, float: "left", height: 48, width: "auto" }}
                                    />
                                }
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    width: "100%",
                                    textAlign: "left",
                                    marginBottom: 8,
                                    color: "white",
                                    border: 0,
                                    height: 72,
                                    fontSize: 18
                                }}
                            >
                                {wallet.name}
                            </Button>
                        );
                    })

                    }
                </>
            </>
        </div>
    );
};

export const WalletModalProvider: FC<{ children: ReactNode }> = ({
                                                                     children,
                                                                 }) => {
    const { publicKey } = useWallet();
    const [connected, setConnected] = useState(!!publicKey);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (publicKey) {
            const base58 = publicKey.toBase58();
            const keyToDisplay =
                base58.length > 20
                    ? `${base58.substring(0, 7)}.....${base58.substring(
                        base58.length - 7,
                        base58.length
                    )}`
                    : base58;

            notify({
                message: "Wallet update",
                description: "Connected to wallet " + keyToDisplay,
            });
        }
    }, [publicKey]);

    useEffect(() => {
        if (!publicKey && connected) {
            notify({
                message: "Wallet update",
                description: "Disconnected from wallet",
            });
        }
        setConnected(!!publicKey);
    }, [publicKey, connected, setConnected]);

    return (
        <WalletModalContext.Provider
            value={{
                visible,
                setVisible,
            }}
        >
            {children}
            <WalletModal />
        </WalletModalContext.Provider>
    );
};

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const wallets = useMemo(
        () => [
            getPhantomWallet(),
            getSolflareWallet(),
            getTorusWallet({
                options: {
                    // @FIXME: this should be changed for Default, and by each Default storefront
                    clientId:
                        "BOM5Cl7PXgE9Ylq1Z1tqzhpydY0RVr8k90QQ85N7AKI5QGSrr9iDC-3rvmy0K_hF0JfpLMiXoDhta68JwcxS1LQ",
                },
            }),
            getLedgerWallet(),
            getSolongWallet(),
            getMathWallet(),
            getSolletWallet(),
        ],
        []
    );

    const onError = useCallback((error: WalletError) => {
        console.error(error);
        notify({
            message: "Wallet error",
            description: error.message,
        });
    }, []);

    return (
        <BaseWalletProvider wallets={wallets} onError={onError} autoConnect>
            <WalletModalProvider>{children}</WalletModalProvider>
        </BaseWalletProvider>
    );
};

export type WalletSigner = Pick<WalletAdapter,
    "publicKey" | "signTransaction" | "signAllTransactions">;