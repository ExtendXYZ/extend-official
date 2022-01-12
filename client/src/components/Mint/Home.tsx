import { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Alert, Button, CircularProgress, Snackbar, TextField, InputLabel, MenuItem, FormControl, Select } from "@mui/material";

import * as anchor from "@project-serum/anchor";

import { Commitment, LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { MintLayout } from "@solana/spl-token";

import { useAnchorWallet } from "@solana/wallet-adapter-react";

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
} from "../../constants";
import { Divider } from "antd";

import { ModalEnum, useModal, useWalletModal } from "../../contexts";
import { sleep, twoscomplement_i2u, twoscomplement_u2i, convertToInt, loading } from "../../utils";
import { Server } from "../Game/server.js";
import { Database } from "../Game/database.js";
import { initSpaceMetadataInstructions, sendInstructionsGreedyBatch } from "../../actions";
import {ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID} from "@solana/spl-token";

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
  const [doneFetching, setDoneFetching] = useState(false);
  const [noMint, setNoMint] = useState(false);

  const [isRegistering, setIsRegistering] = useState(false); // for register
  const server = new Server();
  const database = new Database();

  const captchaRef = useRef<Reaptcha>(null);

  const getVoucherMint = async () => {
    const n_x = twoscomplement_i2u(neighborhoodX);
    const n_y = twoscomplement_i2u(neighborhoodY);
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

  const getVoucherSink = async () => {
    const n_x = twoscomplement_i2u(neighborhoodX);
    const n_y = twoscomplement_i2u(neighborhoodY);
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

  const getNeighborhoodMetadata = async () => {
    const n_x = twoscomplement_i2u(neighborhoodX);
    const n_y = twoscomplement_i2u(neighborhoodY);
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
    if (neighborhoods) {
      for (let n of neighborhoods) {
        keys.push(<MenuItem value={n}>{"Neighborhood (" + n + ")"}</MenuItem>);
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
      const voucherMint = await getVoucherMint();
      const totalTokenBalance = await getTokenBalance(VOUCHER_MINT_AUTH, voucherMint);
      setTokensRedeemed(itemsAvailable - totalTokenBalance);
      setTokensSoldOut(totalTokenBalance === 0);

      // token balance 
      const tokenBalance = await getTokenBalance(wallet.publicKey, voucherMint);
      //console.log(tokenBalance)
      setTotalTokens(tokenBalance);
    })();
  };

  const onMint = async () => {
    if (!wallet || !candyMachine || !candyConfig) {
      return;
    }

    const voucherMint = await getVoucherMint();
    // token balance 
    const tokenBalance = await getTokenBalance(wallet.publicKey, voucherMint);

    // check if user has the appropriate balance of tokens in beginning
    if (numRedeeming > tokenBalance) {
      setAlertState({
        open: true,
        message: "Not enough tokens!",
        severity: "error",
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
      const voucherSink = await getVoucherSink();
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
        setAlertState({
          open: true,
          message: "Mint failed! Please try again!",
          severity: "error",
        });
      } else {
        setAlertState({
          open: true,
          message: `Congratulations! ${response.numSucceed} out of ${response.total} mints succeeded!`,
          severity: "success",
        });
      }
    } catch (e) {
      console.log(e)
      setAlertState({
        open: true,
        message: "Mint failed! Please try again!",
        severity: "error",
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
        setAlertState({
          open: true,
          message: "Failed to receive Space Voucher! Please try again!",
          severity: "error",
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
        setAlertState({
          open: true,
          message: "Congratulations! Received Space Voucher!",
          severity: "success",
        });
      } else {
        setAlertState({
          open: true,
          message: "Failed to receive Space Voucher! Please try again!",
          severity: "error",
        });
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.msg || "Failed to receive Space Voucher! Please try again!";
      setAlertState({
        open: true,
        message: "Failed to receive Space Voucher! Please try again!",
        severity: "error",
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
    const voucherMint = await getVoucherMint();
    if (wallet) {
      const connection = props.connection;
      let commitment: Commitment = "singleGossip";

      const price = getPrice(numTokens) * Math.pow(10, 9);

      let nbd = await getNeighborhoodMetadata();
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

  const onRegister = async() => {
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

    const data = await server.getSpacesByOwner(props.connection, wallet.publicKey, true, tokenCache);
    if (!data) {
      setAlertState({
        open: true,
        message: "No spaces owned or minted",
        severity: "info",
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
    loading(null, 'Registering', null);

    // pass the accounts and mints we want to initialize
    let numAccountsToRegister = 0;
    for (let i = 0; i < accInfos.length; i++) {
      if (accInfos[i] === null) {
        if(numAccountsToRegister < MAX_REGISTER_ACCS) { // limit to MAX register accs in current batch
          currSpaceAccs[ownedSpacesArray[i]] = accs[i];
          currMints[ownedSpacesArray[i]] = ownedMintsDict[ownedSpacesArray[i]];
        } 
        numAccountsToRegister++;
      }
    }

    const numRegistering = Object.keys(currMints).length;
    console.log("Need to register", numRegistering)

    if (numRegistering === 0) { // if there are no spaces to register
      setAlertState({
        open: true,
        message: "Already registered all spaces",
        severity: "info",
      });
    } else {
      try {
        let ixs = await initSpaceMetadataInstructions(wallet, BASE, currSpaceAccs, currMints);
        let res = await sendInstructionsGreedyBatch(props.connection, wallet, ixs, "Register", false);

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
          setAlertState({
            open: true,
            message: `Registered succeeded for ${numSucceed} out of ${numRegistering} spaces, need to register ${numAccountsToRegister - numSucceed} more spaces, reclick register!`,
            severity: "success",
          });
        } else {
          setAlertState({
            open: true,
            message: `Register succeeded for ${numSucceed} out of ${numRegistering} spaces`,
            severity: "success",
          });
        }
      }
      catch (e) {
        console.log(e);
        setAlertState({
          open: true,
          message: `Registered failed, please try again`,
          severity: "error",
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
    const n: String = e.target.value;
    const split = n.split(',');
    setNeighborhoodX(parseInt(split[0]));
    setNeighborhoodY(parseInt(split[1]));
    setCurrNeighborhood(n);
  }

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
    // with every change of neighborhood x and y, update the neigborhood info
    const updateNeighborhoodInfo = async () => {
      setNoMint(false);
      if (neighborhoodX != null && neighborhoodY != null) {
        const n_x = twoscomplement_i2u(neighborhoodX);
        const n_y = twoscomplement_i2u(neighborhoodY);
        const nhoodAcc = (await anchor.web3.PublicKey.findProgramAddress(
          [
            BASE.toBuffer(),
            Buffer.from(NEIGHBORHOOD_METADATA_SEED),
            Buffer.from(n_x),
            Buffer.from(n_y),
          ],
          SPACE_PROGRAM_ID
        ))[0];
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

  return (
    <div id="home" className="centered-full">
      <div >
        <img src={require("../../assets/images/space.gif").default} style={{ height: window.innerHeight - 63 + "px" }}></img>
      </div>

      {wallet ? (
        <div>
          <p>Your balance: {(balance || 0).toLocaleString()} SOL</p>
          <FormControl sx={{ minWidth: 300, maxWidth: 300 }}>
            <InputLabel id="demo-simple-select-label">Neighborhood</InputLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={currNeighborhood}
              label="Select Neighborhood"
              onChange={changeNeighborhood}
            >
              {getPossibleNeighborhoods()}
            </Select>
          </FormControl>

          <Divider />

          {neighborhoodX != null && neighborhoodY != null && !noMint ? (
            <div>
              {wallet && <p><b>1. Claim your Space Vouchers ({tokensRedeemed} / {itemsAvailable} claimed)</b></p>}

              {/* {wallet && <p>Receive space vouchers to mint your spaces </p>} */}
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
                    disabled={tokensSoldOut}
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
                  {wallet && <p><b>2. Mint your Spaces ({itemsRedeemed} / {itemsAvailable} minted)</b></p>}

                  {/* {wallet && <p>Use your space vouchers from Step 1 to mint spaces </p>}  */}
                  {wallet && <p>Your Space vouchers: {totalTokens} </p>}

                  {wallet && <p>Estimated cost to mint and register Spaces: {Math.round(totalTokens * (MINT_PRICE) * 1000) / 1000} SOL</p>}

                  <TextField
                    required
                    id="outlined-required"
                    label="Space vouchers to redeem"
                    type="number"
                    defaultValue={1}
                    value={numRedeeming}
                    onChange={changeNumMint} />
                  <MintButton
                    disabled={isSoldOut || isMinting || !isActive}
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
                    <b>3. Register your Spaces </b>
                    {/* <p> Register your spaces in order to see them on the canvas and change their colors </p> */}
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
        (<Button
          size="large"
          variant="contained"
          onClick={handleConnect}
          style={{
            color: "#FFFFFF",
            background: 'linear-gradient(to right bottom, #36EAEF80, #6B0AC980)',
            borderRadius: '40px'
          }}
        >
          <b>Connect Your Wallet</b>
        </Button>)
      }

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </div>
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