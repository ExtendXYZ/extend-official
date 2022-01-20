import { useEffect, useRef, useState, useCallback } from "react";
import * as React from 'react';
import styled from "styled-components";
import Countdown from "react-countdown";
import { Alert, Button, CircularProgress, Snackbar, TextField, InputLabel, MenuItem, FormControl, Select, InputAdornment } from "@mui/material";
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import InfoIcon from '@mui/icons-material/Info';

import * as anchor from "@project-serum/anchor";

import { Commitment, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { MintLayout } from "@solana/spl-token";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Tooltip } from "antd";

import { sendInstructionsGreedyBatchMint, sendSignedTransaction } from "../../helpersMint/transactions";

import {
  awaitTransactionSignatureConfirmation,
  CandyMachine,
  getCandyMachineState,
  getTokenWallet,
  mintOneTokenInstructions,
  receiveTokenInstructions,
} from "./candy-machine";

import Reaptcha from 'reaptcha';
import {
  CAPTCHA_SITE_KEY,
  CAPTCHA_VERIFY_URL,
  VOUCHER_MINT_SEED,
  VOUCHER_SINK_SEED,
  VOUCHER_PRICE_CONSTANT,
  VOUCHER_MAX_PRICE,
  SPACE_PROGRAM_ID,
  BASE,
  VOUCHER_MINT_AUTH,
  NEIGHBORHOOD_METADATA_SEED,
  NEIGHBORHOOD_LIST_SEED,
  MINT_PRICE,
  SPACE_METADATA_SEED,
  MAX_REGISTER_ACCS,
  NEIGHBORHOOD_SIZE,
} from "../../constants";
import { Divider } from "antd";

import { ModalEnum, useModal, useWalletModal } from "../../contexts";
import { sleep, twoscomplement_i2u, twoscomplement_u2i, convertToInt, loading, notify, register_succeed_notify } from "../../utils";
import { Server } from "../Game/server.js";
import { Database } from "../Game/database.js";
import { initSpaceMetadataInstructions, sendInstructionsGreedyBatch } from "../../actions";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const axios = require('axios');

const CounterText = styled.span``; // add your styles here

const MintContainer = styled.div``; // add your styles here

const MintButton = styled(Button)``; // add your styles here

export interface HomeProps {
  connection: anchor.web3.Connection;
  startDate: number;
  txTimeout: number;
}

export const Home = (props: HomeProps) => {

  const { setModal } = useModal();
  const { setVisible } = useWalletModal();

  const handleConnect = useCallback(() => {
    setModal(ModalEnum.WALLET);
    setVisible(true);
  }, [setModal, setVisible]);

  const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref,
  ) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });


  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);

  const [tokensRedeemed, setTokensRedeemed] = useState(0);
  const [tokensSoldOut, setTokensSoldOut] = useState(false);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const [candyConfig, setCandyConfig] = useState<anchor.web3.PublicKey>();
  const [candyId, setCandyId] = useState<anchor.web3.PublicKey>();
  const [tokenTransaction, setTokenTransaction] = useState<Transaction>();
  const [isReceivingToken, setIsReceivingToken] = useState(false); // for get tokens button
  const [numTokens, setNumTokens] = useState(1); // num tokens user wants
  const [numRedeeming, setNumRedeeming] = useState(1); // num tokens user is redeeming
  const [totalTokens, setTotalTokens] = useState(0);
  const [clicked, setClicked] = useState(false); // if getTokens button is clicked
  const [verified, setVerified] = useState(false);

  const [neighborhoodX, setNeighborhoodX] = useState<Number>(); // for switching neighborhoods
  const [neighborhoodY, setNeighborhoodY] = useState<Number>();
  const [currNeighborhood, setCurrNeighborhood] = useState<String>();
  const [neighborhoods, setNeighborhoods] = useState<string[]>();
  const [nhoodNames, setNhoodNames] = useState<string[]>();
  const [doneFetching, setDoneFetching] = useState(false);
  const [noMint, setNoMint] = useState(false);
  const [disableMint, setDisableMint] = useState(false); // disable buttons while changing neighborhoods
  const [disableToken, setDisableToken] = useState(false);
  const [statuses, setStatuses] = useState<string[]>();

  const [isRegistering, setIsRegistering] = useState(false); // for register
  const server = new Server();
  const database = new Database();

  const captchaRef = useRef<Reaptcha>(null);

  const getVoucherMint = async (x, y) => {
    const n_x = twoscomplement_i2u(x);
    const n_y = twoscomplement_i2u(y);
    return (await anchor.web3.PublicKey.findProgramAddress(
      [
        BASE.toBuffer(),
        Buffer.from(VOUCHER_MINT_SEED),
        Buffer.from(n_x),
        Buffer.from(n_y)],
      SPACE_PROGRAM_ID
    )
    )[0];
  }

  const getVoucherSink = async (x, y) => {
    const n_x = twoscomplement_i2u(x);
    const n_y = twoscomplement_i2u(y);
    return (await anchor.web3.PublicKey.findProgramAddress(
      [
        BASE.toBuffer(),
        Buffer.from(VOUCHER_SINK_SEED),
        Buffer.from(n_x),
        Buffer.from(n_y)],
      SPACE_PROGRAM_ID
    )
    )[0];
  }

  const getNeighborhoodMetadata = async (x, y) => {
    const n_x = twoscomplement_i2u(x);
    const n_y = twoscomplement_i2u(y);
    return (await anchor.web3.PublicKey.findProgramAddress(
      [
        BASE.toBuffer(),
        Buffer.from(NEIGHBORHOOD_METADATA_SEED),
        Buffer.from(n_x),
        Buffer.from(n_y)],
      SPACE_PROGRAM_ID
    )
    )[0];
  }

  const getPossibleNeighborhoods = () => {
    let keys: any[] = [];
    if (nhoodNames && neighborhoods) {
      for (let i = 0; i < neighborhoods.length; i++) {
        const n = neighborhoods[i];
        keys.push(<MenuItem value={n} key={n}>{"Neighborhood (" + n + "): " + nhoodNames[i]}</MenuItem>);
      }
    }
    return keys;
  }

  const getPossibleNeighborhoodsWithStatuses = () => {
    let keys: any[] = [];
    if (neighborhoods && statuses && nhoodNames) {
      for (let i = 0; i < neighborhoods.length; i++) {
        const n = neighborhoods[i];
        if (statuses[i] !== "") {
          keys.push(<MenuItem value={n} key={n} sx={{ color: "#E0714F" }}>{"Neighborhood (" + n + "): " + nhoodNames[i] + statuses[i]}</MenuItem>);
        } else {
          keys.push(<MenuItem value={n} key={n}>{"Neighborhood (" + n + "): " + nhoodNames[i] + statuses[i]}</MenuItem>);
        }
      }
    }
    return keys;
  }

  const getTokenBalance = async (user, mint) => {
    let ATA = await getTokenWallet(user, mint);
    // if (user != VOUCHER_TOKEN_AUTH) { // avoid getAccountInfo by caching?
    const data = await props.connection.getAccountInfo(ATA);
    if (!data) {
      return 0;
    }
    // }
    const b = (await props.connection.getTokenAccountBalance(ATA)).value.amount;
    const balance = Number(b);
    return balance;
  }

  const refreshVoucherSystemState = () => {
    (async () => {
      if (!wallet || !candyId) return;

      let candyMachine;
      let goLiveDate;
      let itemsAvailable;
      let itemsRemaining;
      let itemsRedeemed;
      try {
        let res = await getCandyMachineState(
          wallet as anchor.Wallet,
          candyId,
          props.connection
        );
        candyMachine = res.candyMachine;
        goLiveDate = res.goLiveDate;
        itemsAvailable = res.itemsAvailable;
        itemsRemaining = res.itemsRemaining;
        itemsRedeemed = res.itemsRedeemed;
      } catch (e) {
        setNoMint(true);
        console.log(e)
        return;
      }

      setItemsAvailable(itemsAvailable);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);

      // global tokens
      const voucherMint = await getVoucherMint(neighborhoodX, neighborhoodY);
      const totalTokenBalance = await getTokenBalance(VOUCHER_MINT_AUTH, voucherMint);
      setTokensRedeemed(itemsAvailable - totalTokenBalance);
      setTokensSoldOut(totalTokenBalance === 0);

      // token balance 
      const tokenBalance = await getTokenBalance(wallet.publicKey, voucherMint);
      //console.log(tokenBalance)
      setTotalTokens(tokenBalance);

      setDisableMint(false); // reset disable
      setDisableToken(false);
    })();
  };

  const onMint = async () => {
    if (!wallet || !candyMachine || !candyConfig) {
      return;
    }

    const voucherMint = await getVoucherMint(neighborhoodX, neighborhoodY);
    // token balance 
    const tokenBalance = await getTokenBalance(wallet.publicKey, voucherMint);

    // check if user has the appropriate balance of tokens in beginning
    if (numRedeeming > tokenBalance) {
      notify({
        message: "Not enough tokens!",
        type: "error",
        duration: 0,
      });
      return;
    }

    try {
      setIsMinting(true);

      let ixs: anchor.web3.TransactionInstruction[][] = [];
      let mints: anchor.web3.Keypair[] = [];

      // for all tokens, create mint instructions
      const rent = await props.connection.getMinimumBalanceForRentExemption(
        MintLayout.span
      );
      const voucherSink = await getVoucherSink(neighborhoodX, neighborhoodY);
      console.log("Getting mint instructions")
      for (let i = 0; i < numRedeeming; i++) {
        let mint = anchor.web3.Keypair.generate();
        let mintInstructions = await mintOneTokenInstructions(
          candyMachine,
          candyConfig,
          wallet.publicKey,
          VOUCHER_MINT_AUTH,
          wallet as anchor.Wallet,
          mint,
          voucherMint,
          rent,
          voucherSink,
        );
        ixs.push(mintInstructions);
        mints.push(mint);
      }

      // greedy batch send mint transactions
      const response = await sendInstructionsGreedyBatchMint(
        props.connection,
        wallet,
        ixs,
        mints,
      )

      if (response.numSucceed === 0) {
        notify({
          message: "Mint failed! Please try again!",
          type: "error",
          duration: 0,
        });
      } else {
        notify({
          message: `${response.numSucceed} out of ${response.total} mints succeeded!`,
          type: "success",
          duration: 0,
        });
      }
    } catch (e) {
      console.log(e);
      notify({
        message: "Mint failed! Please try again!",
        type: "error",
        duration: 0,
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      await sleep(2000);
      refreshVoucherSystemState();
    }
  };

  const onReceiveToken = async () => {
    if (!wallet || !tokenTransaction) {
      return;
    }
    try {
      setIsReceivingToken(true);
      const connection = props.connection;
      let transaction = tokenTransaction;
      try {
        transaction = await wallet.signTransaction(tokenTransaction);
      } catch {
        return false;
      }

      try {
        var { txid, slot } = await sendSignedTransaction({
          connection,
          signedTransaction: transaction,
        });

      } catch (error) {
        notify({
          message: "Failed to receive Space Voucher! Please try again!",
          type: "error",
          duration: 0,
        });
        console.error(error);
        return
      }

      const status = await awaitTransactionSignatureConfirmation(
        txid,
        props.txTimeout,
        props.connection,
        "singleGossip",
        false
      );

      if (status && !status?.err) {
        notify({
          message: "Received Space Voucher!",
          type: "success",
          duration: 0,
        });
      } else {
        notify({
          message: "Failed to receive Space Voucher! Please try again!",
          type: "error",
          duration: 0,
        });
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Failed to receive Space Voucher! Please try again!";
      notify({
        message: "Failed to receive Space Voucher! Please try again!",
        type: "error",
        duration: 0,
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsReceivingToken(false);
      captchaRef.current?.reset();
      setVerified(false);
      await sleep(2000);
      refreshVoucherSystemState();
    }
  };

  const getPrice = (n) => {
    return Math.min(Math.max((Math.exp(VOUCHER_PRICE_CONSTANT * (n - 1))) - 1, 0), VOUCHER_MAX_PRICE);
  }

  async function onVerify(recaptchaResponse) {
    if (!wallet) {
      return;
    }

    // create unsigned transaction
    const voucherMint = await getVoucherMint(neighborhoodX, neighborhoodY);
    if (wallet) {
      const connection = props.connection;
      let commitment: Commitment = "singleGossip";

      const price = getPrice(numTokens) * Math.pow(10, 9);

      let nbd = await getNeighborhoodMetadata(neighborhoodX, neighborhoodY);
      let account = await props.connection.getAccountInfo(nbd);
      if (!account) {
        return;
      }
      let creator = new PublicKey(account.data.slice(1, 33));

      const tokenInstructions = await receiveTokenInstructions(
        connection,
        wallet as anchor.Wallet,
        creator,
        VOUCHER_MINT_AUTH,
        voucherMint,
        price,
        numTokens,
      );

      let tokenTransaction = new Transaction();
      tokenTransaction.feePayer = wallet.publicKey;
      tokenInstructions.forEach((instruction) => tokenTransaction.add(instruction));
      tokenTransaction.recentBlockhash = (await connection.getRecentBlockhash(commitment)).blockhash;

      let data = {
        response: recaptchaResponse,
        transaction: tokenTransaction.serialize({ requireAllSignatures: false })
      }
      //console.log(data);

      let res = await axios.post(CAPTCHA_VERIFY_URL, data);

      if (res.data.success) {
        //setMint(mint);
        //setMintTransaction(Transaction.from(res.data.transaction.data));
        setTokenTransaction(Transaction.from(res.data.transaction.data));
        setVerified(true);
      }
    }
  }

  const onRegister = async () => {
    setIsRegistering(true);
    if (!wallet) {
      setIsRegistering(false);
      return;
    }
    const currSpaceAccs = {};
    const currMints = {};
    let accs: any[] = [];
    let tokenCache = new Set();

    const dbData = await database.getSpacesByOwner(wallet.publicKey); // call to db for cache
    for (let pos in dbData.mints) {
      const [spaceATA,] =
        await PublicKey.findProgramAddress(
          [
            wallet.publicKey.toBuffer(),
            TOKEN_PROGRAM_ID.toBuffer(),
            dbData.mints[pos].toBuffer(),
          ],
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
      tokenCache.add(spaceATA.toBase58());
    }

    const data = await server.getSpacesByOwner(props.connection, wallet.publicKey, false, tokenCache);
    if (!data) {
      notify({
        message: "No spaces owned or minted",
        type: "info",
        duration: 0,
      });
      setIsRegistering(false);
      return;
    }
    let ownedSpacesArray: any[] = [...data.spaces]; // get unregistered spaces and mints
    let ownedMintsDict = data.mints;

    for (const p of ownedSpacesArray) {
      const pos = JSON.parse(p);
      const space_x = twoscomplement_i2u(pos.x);
      const space_y = twoscomplement_i2u(pos.y);
      const spaceAcc = (await PublicKey.findProgramAddress(
        [
          BASE.toBuffer(),
          Buffer.from(SPACE_METADATA_SEED),
          Buffer.from(space_x),
          Buffer.from(space_y),
        ],
        SPACE_PROGRAM_ID
      ))[0];
      accs.push(spaceAcc);
    }
    console.log("Accounts", accs.length)
    const accInfos = await server.batchGetMultipleAccountsInfoLoading(props.connection, accs, 'Registering');
    loading(null, 'Registering', "success");

    // pass the accounts and mints we want to initialize
    let numAccountsToRegister = 0;
    for (let i = 0; i < accInfos.length; i++) {
      if (accInfos[i] === null) {
        if (numAccountsToRegister < MAX_REGISTER_ACCS) { // limit to MAX register accs in current batch
          currSpaceAccs[ownedSpacesArray[i]] = accs[i];
          currMints[ownedSpacesArray[i]] = ownedMintsDict[ownedSpacesArray[i]];
        }
        numAccountsToRegister++;
      }
    }

    const numRegistering = Object.keys(currMints).length;
    console.log("Need to register", numRegistering)

    if (numRegistering === 0) { // if there are no spaces to register
      notify({
        message: "Already registered all spaces",
        type: "info",
        duration: 0,
      });
    } else {
      try {
        let ixs = await initSpaceMetadataInstructions(wallet, BASE, currSpaceAccs, currMints);
        let res = await sendInstructionsGreedyBatch(props.connection, wallet, ixs, "Register", false); loading(null, 'Registering', null);
        loading(null, 'Registering', null);

        // update mints that have been registered
        let responses = res.responses;
        let ixPerTx = res.ixPerTx;
        let allPositions = Object.keys(currSpaceAccs);
        let ind = 0;
        let doneMints = {};
        for (let i = 0; i < responses.length; i++) {
          if (responses[i]) { // if tx success
            for (let j = 0; j < ixPerTx[i]; j++) {
              doneMints[allPositions[ind + j]] = currMints[allPositions[ind + j]];
            }
          }
          ind += ixPerTx[i];
        }

        // update database for mints that have registered
        await sleep(20000); // sleep 20 seconds metadata completion
        await database.register(wallet.publicKey, doneMints);

        // notify if need to reclick register
        let numSucceed = res.spacesSucceed;
        if (numAccountsToRegister > numRegistering) {
          notify({
            message: `Registered succeeded for ${numSucceed} out of ${numRegistering} spaces, need to register ${numAccountsToRegister - numSucceed} more spaces, reclick register!`,
            type: "success",
            duration: 0,
          });
        } else {
          register_succeed_notify({
            wallet, numSucceed, numRegistering, duration: 0,
          });
        }
      }
      catch (e) {
        console.log(e);
        notify({
          message: `Registered failed, please try again`,
          type: "error",
          duration: 0,
        });
      }
    }
    loading(null, 'Registering', 'success'); // TODO use correct status
    setIsRegistering(false);
  }

  const onExpire = () => {
    setVerified(false);
  };

  const changeNum = (e) => {
    const tokens = parseInt(e.target.value);
    setNumTokens(tokens <= 100 ? tokens : NaN);
    setClicked(false);
    setVerified(false);
  };

  const changeNumMint = (e) => {
    setNumRedeeming(parseInt(e.target.value));
  };

  const changeNeighborhood = (e) => {
    setDisableMint(true);
    setDisableToken(true);
    const n: String = e.target.value;
    const split = n.split(',');
    const n_x = parseInt(split[0]);
    const n_y = parseInt(split[1]);
    setNeighborhoodX(n_x);
    setNeighborhoodY(n_y);
    setCurrNeighborhood(n);
    const selector = document.getElementById("selector");
    if (selector) {
      selector.style.left = (n_x + 2) * NEIGHBORHOOD_SIZE * ratio - border + "px";
      selector.style.top = (n_y + 2) * NEIGHBORHOOD_SIZE * ratio - border + "px";
    }
  }

  const onMax = () => {
    setNumRedeeming(totalTokens);
  }

  // USE EFFECTS

  useEffect(() => {
    (async () => {
      if (wallet) {
        // balance
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [wallet, props.connection]);

  useEffect(() => {
    const getActiveNeighborhoods = async () => {
      // fetch active neighborhoods at beginning to populate dropdown
      const nhoodList = (await anchor.web3.PublicKey.findProgramAddress(
        [
          BASE.toBuffer(),
          Buffer.from(NEIGHBORHOOD_LIST_SEED),
        ],
        SPACE_PROGRAM_ID
      ))[0];
      const account = await props.connection.getAccountInfo(nhoodList);
      if (!account) {
        return;
      }
      let goodNeighborhoods: string[] = [];
      const activeNeighborhoods = account.data;
      const preBuffer = 5;
      const len = convertToInt(activeNeighborhoods.slice(1, preBuffer));
      for (let i = 0; i < len; i++) {
        let x, y;
        try {
          x = twoscomplement_u2i(activeNeighborhoods.slice(i * 8 + preBuffer, (i + 1) * 8 + preBuffer));
          y = twoscomplement_u2i(activeNeighborhoods.slice((len + i) * 8 + preBuffer + 4, (len + i + 1) * 8 + preBuffer + 4));
        } catch (e) {
          console.log(e)
          return;
        }
        if (x != null && y != null) {
          goodNeighborhoods.push(x.toString() + "," + y.toString());
        }
      }
      setNeighborhoods(goodNeighborhoods);
    }
    getActiveNeighborhoods();
  }, []);

  useEffect(() => {
    const getNeighborhoodStatuses = async () => {
      if (!neighborhoods) {
        return;
      }
      const nhoods: anchor.web3.PublicKey[] = [];
      const atas: anchor.web3.PublicKey[] = [];
      for (let n of neighborhoods) { // get all accounts necessary
        const split = n.split(',');
        const x = split[0];
        const y = split[1];
        const nhoodAcc = await getNeighborhoodMetadata(x, y);
        nhoods.push(nhoodAcc)
        const voucherMint = await getVoucherMint(x, y);
        const ata = await getTokenWallet(VOUCHER_MINT_AUTH, voucherMint);
        atas.push(ata);
      }
      const nhoodInfos = await server.batchGetMultipleAccountsInfo(props.connection, nhoods);
      const ataInfos = await server.batchGetMultipleAccountsInfo(props.connection, atas);

      // update neighborhood names
      const names: string[] = [];
      for (let i = 0; i < neighborhoods.length; i++) {
        names.push(Buffer.from(nhoodInfos[i].data.slice(97, 97 + 64)).toString('utf-8'));
      }
      setNhoodNames(names);

      const currStatuses: string[] = [];
      for (let i = 0; i < neighborhoods.length; i++) { // update statuses
        const id = new anchor.web3.PublicKey(nhoodInfos[i].data.slice(65, 97));
        let res = await getCandyMachineState(
          wallet as anchor.Wallet,
          id,
          props.connection
        );
        const itemsRemaining = res.itemsRemaining;
        if (itemsRemaining === 0) {
          currStatuses.push("[MINTED OUT]"); // minted out
          continue;
        }
        if (!ataInfos[i]) {
          currStatuses.push("[SOLD OUT]"); // sold out
          continue;
        }
        const b = (await props.connection.getTokenAccountBalance(atas[i])).value.amount;
        const balance = Number(b);
        if (balance === 0) {
          currStatuses.push("[SOLD OUT]"); // sold out
        } else {
          currStatuses.push(""); // active
        }
      }
      setStatuses(currStatuses);
    }
    getNeighborhoodStatuses();
  }, [neighborhoods]);

  useEffect(() => {
    // with every change of neighborhood x and y, update the neigborhood info
    const updateNeighborhoodInfo = async () => {
      setNoMint(false);
      setClicked(false);
      if (neighborhoodX != null && neighborhoodY != null) {
        const nhoodAcc = await getNeighborhoodMetadata(neighborhoodX, neighborhoodY);
        const account = await props.connection.getAccountInfo(nhoodAcc);
        if (account) {
          setCandyConfig(new anchor.web3.PublicKey(account.data.slice(33, 65)));
          setCandyId(new anchor.web3.PublicKey(account.data.slice(65, 97)));
        }
        setDoneFetching(true);
      }
    }
    updateNeighborhoodInfo();
  }, [neighborhoodX, neighborhoodY]);

  useEffect(() => {
    // once done fetching all new neighborhood info, refresh candy machine state
    if (doneFetching) {
      refreshVoucherSystemState();
      setDoneFetching(false);
    }
  }, [doneFetching]);

  useEffect(() => {
    if (neighborhoods) {
      const getColors = async () => {
        const frameKeysMap = await server.getFrameKeys(props.connection, neighborhoods.map(x => {
          const split = x.split(",");
          return { n_x: parseInt(split[0]), n_y: parseInt(split[1]) }
        }), 0);
        const frameInfos = Object.keys(frameKeysMap).map(x => JSON.parse(x));
        const frameKeys = Object.values(frameKeysMap);
        const frameDatas = await server.batchGetMultipleAccountsInfo(
          props.connection,
          frameKeys
        );
        const colorMap = {};
        await Promise.all(
          frameInfos.map(async (value, i) => {
            const { n_x, n_y, frame } = value;
            const key = JSON.stringify({ n_x, n_y });
            colorMap[key] = await server.getFrameData(frameDatas[i]);
          })
        );
        const canvas = document.getElementById("preview") as HTMLCanvasElement;
        if (canvas) {
          const context = canvas.getContext("2d", {
            alpha: false,
            desynchronized: true,
          });
          if (context) {
            for (let n_x = -2; n_x < 3; ++n_x) {
              for (let n_y = -2; n_y < 3; ++n_y) {
                const key = JSON.stringify({ n_x, n_y });
                if (key in colorMap) {
                  const map = colorMap[key];
                  for (let x = 0; x < NEIGHBORHOOD_SIZE; ++x) {
                    for (let y = 0; y < NEIGHBORHOOD_SIZE; ++y) {
                      context.fillStyle = map[y][x];
                      context.fillRect(x + (n_x + 2) * NEIGHBORHOOD_SIZE, y + (n_y + 2) * NEIGHBORHOOD_SIZE, 1, 1);
                    }
                  }
                } else {
                  context.fillStyle = "#000000";
                  context.fillRect((n_x + 2) * NEIGHBORHOOD_SIZE, (n_y + 2) * NEIGHBORHOOD_SIZE, NEIGHBORHOOD_SIZE, NEIGHBORHOOD_SIZE);
                }
              }
            }
            context.lineWidth = 5;
            context.strokeStyle = 'white';
            context.strokeRect(0, 0, canvas.width, canvas.height);
          }
        }
      }
      getColors();
    }
  }, [neighborhoods]);

  const border = 5;
  const ratio = window.innerHeight * 0.7 / 1000;

  return (
    <div id="home" style={{display: "flex", flexDirection: "row"}}>
      <div style={{width: "50%"}}>
        <Divider/>
      <FormControl sx={{marginLeft: "20%", minWidth: "60%", maxWidth: "60%", zIndex: 1}}>
        <InputLabel id="demo-simple-select-label">Neighborhood</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={currNeighborhood}
          label="Select Neighborhood"
          onChange={changeNeighborhood}
        >
          {statuses ? getPossibleNeighborhoodsWithStatuses() : getPossibleNeighborhoods()}
        </Select>
      </FormControl>
        <Divider/>
      
      <div style={{width: window.innerHeight * 0.7, height: window.innerHeight * 0.7, marginLeft: "20%", position: "relative"}}>
        <canvas id="preview" width="1000px" height="1000px" style={{width: window.innerHeight * 0.7, height: window.innerHeight * 0.7}}/>
        <div id="selector" style={{position: "absolute", top: 400 * ratio - border + "px", left: 400 * ratio - border + "px", width: 200 * ratio + 2 * border + "px", height: 200 * ratio + 2 * border + "px", border: border + "px dashed white"}}/>
        </div>
      </div>

      <div style={{width: "50%", zIndex: 1}}>
        <Divider/>
      
      {(!wallet || (neighborhoodX === undefined && neighborhoodY === undefined)) && (
      <div style={{marginRight: "10%", marginTop: "30%"}}>
        <p style={{textAlign: "center", fontSize: "25px"}}>One million Spaces are divided into a 5 x 5 grid of neighborhoods. Each neighborhood contains 200 x 200 (40,000) Spaces and neighborhoods will be minted sequentially over a period of time. Welcome, future Neighbor, have a look around the Canvas and feel free to join the neighborhood by minting your very own Spaces.</p>
        <Divider/>
      </div>)}
      {!wallet && (
      <Button
        size="large"
        variant="contained"
        onClick={handleConnect}
        style={{
          color: "#FFFFFF",
          background: 'linear-gradient(to right bottom, #36EAEF80, #6B0AC980)',
          borderRadius: '40px',
          marginLeft: "20%",
          minWidth: "60%", 
          maxWidth: "60%",
        }}
      >
        <b>Connect Your Wallet</b>
      </Button>)}
      {wallet && <p style={{marginRight: "10%", color: "#B9A06E", textAlign: "center", fontSize: "20px"}}><b>Your balance: {(balance || 0).toLocaleString()} SOL</b></p>}
      {wallet && <p style={{marginRight: "10%", color: "#B9A06E", textAlign: "center", fontSize: "20px"}}><b>Your Space Vouchers: {totalTokens} </b></p>}

      {wallet ? (
        <div>

          {neighborhoodX != null && neighborhoodY != null && !noMint ? (
            <div>
              {wallet && 
              <div>
              <h3 style={{color: "#B687D8", display: "inline-block"}}><b>1. Claim your Space Vouchers ({tokensRedeemed} / {itemsAvailable} claimed)</b></h3>
              <Tooltip title="Enter the number of space vouchers you want and solve the captcha to receive them! Claiming multiple vouchers at once will have a higher price." placement="right">
                <InfoIcon sx={{marginLeft: "10px"}}/>
              </Tooltip>
              </div>
              }
              {wallet && <p>Get Space Vouchers to mint your Spaces </p>}
              <MintContainer>
                <div>
                  <TextField
                    required
                    id="outlined-required"
                    label="Space vouchers to buy"
                    type="number"
                    defaultValue={1}
                    onChange={changeNum}
                    value={numTokens}
                  />
                  <TextField
                    disabled
                    label="Price"
                    type="number"
                    id="outlined-disabled"
                    value={getPrice(numTokens).toFixed(4)} />
                  <Button
                    disabled={tokensSoldOut || disableToken}
                    variant="contained"
                    onClick={(e) => { setClicked(true) }}
                    sx={{ marginLeft: "10px", marginTop: "10px" }}>
                    {tokensSoldOut ? (
                      "SOLD OUT"
                    ) :
                      ("GET VOUCHERS")
                    }
                  </Button>
                  {clicked && numTokens > 0 && wallet && candyMachine?.program ?
                    [
                      <Reaptcha
                        sitekey={CAPTCHA_SITE_KEY}
                        ref={captchaRef}
                        onVerify={onVerify}
                        onExpire={onExpire}
                      />,
                      <Button
                        disabled={isReceivingToken || !verified}
                        onClick={onReceiveToken}
                        variant="contained">
                        Receive Vouchers
                      </Button>
                    ]
                    : null
                  }
                  <Divider />
                  {wallet && 
                    <div>
                      <h3 style={{color: "#B687D8", display: "inline-block"}}><b>2. Mint your Spaces ({itemsRedeemed} / {itemsAvailable} minted)</b></h3>
                      <Tooltip title="Tip: Redeeming multiple space vouchers at once is more likely to result in contiguous Spaces on the canvas" placement="right">
                        <InfoIcon sx={{marginLeft: "10px"}}/>
                      </Tooltip>
                    </div>
                  }

                  {wallet && <p>Use your Space Vouchers to mint Spaces </p>} 

                  {wallet && <p>Estimated cost to mint and register all of your Spaces: {Math.round(totalTokens * (MINT_PRICE) * 1000) / 1000} SOL</p>}

                  <TextField
                    required
                    id="redeem"
                    label="Space vouchers to redeem"
                    type="number"
                    defaultValue={1}
                    value={numRedeeming}
                    onChange={changeNumMint}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <Button onClick={onMax}>MAX</Button>
                        </InputAdornment>
                      ),
                    }}
                    style={{width: "200px"}}
                  />
                  <MintButton
                    disabled={isSoldOut || isMinting || !isActive || disableMint}
                    onClick={onMint}
                    variant="contained"
                    sx={{ marginLeft: "10px", marginTop: "10px" }}
                  >
                    {isSoldOut ? (
                      "SOLD OUT"
                    ) : isActive ? (
                      isMinting ? (
                        <CircularProgress />
                      ) : (
                        "MINT"
                      )
                    ) : (
                      <Countdown
                        date={startDate}
                        onMount={({ completed }) => completed && setIsActive(true)}
                        onComplete={() => setIsActive(true)}
                        renderer={renderCounter}
                      />
                    )}
                  </MintButton>
                  <Divider/>
                  {wallet ? (
                  <div>
                    <div>
                      <h3 style={{color: "#B687D8", display: "inline-block"}}><b>3. Register your Spaces </b></h3>
                      <Tooltip title="Tip: Registering will take around 30 seconds, and it will take longer depending on the number of Spaces you own" placement="right">
                        <InfoIcon sx={{marginLeft: "10px"}}/>
                      </Tooltip>
                    </div>
                    <p> After minting, register your Spaces in order to see them on the canvas and change their colors </p>
                  <Button
                    disabled={isRegistering || isMinting}
                    onClick={onRegister}
                    variant="contained"
                    sx={{ marginLeft: "10px"}}
                  >
                    {isRegistering ? (
                    <CircularProgress />
                    ) : (
                    "Register"
                    )}
                  </Button>
                  </div>) : null
                  }
                </div>
              </MintContainer>
            </div>)
            :
            <div>
              {noMint ?
                <div>
                  No Mint Available, Check Back Soon
                </div> : null
              }
            </div>
          }
        </div>
      ) :
        null
      }
      </div>

      <Snackbar
        open={alertState.open}
        autoHideDuration={20000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>

      <div className="botnav" id="botnav" style={{
        position: "fixed",
        zIndex: 1,
        bottom: "50px",
        right: "50px",
        width: "100px",
        display: "flex",
        flexDirection: "column-reverse",
        alignItems: "center"
      }
      }></div>
    </div >
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      {hours + (days || 0) * 24} hours, {minutes} minutes, {seconds} seconds
    </CounterText>
  );
};

export default Home;