import { createTheme, ThemeProvider } from "@mui/material/styles";
import React, { useEffect, useState } from "react";
import { Header } from "./Header/Header";
import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import {
  DataGrid,
  GridFilterItem,
  GridFilterInputValue,
  getGridStringOperators,
} from "@mui/x-data-grid";
import BN from 'bn.js';
import Button from "@mui/material/Button";
import {
  useConnection,
  useConnectionConfig,
} from "../contexts/ConnectionContext";
import {
  BASE,
  SELL_DELEGATE_SEED,
  SPACE_PROGRAM_ID,
  COLOR_PROGRAM_ID,
} from "../constants/config";
import {
  ConfirmedSignatureInfo,
  ParsedInstruction,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";
import Moment from "react-moment";
import { chunks, rgbToHex, bytesToSignedInt } from "../utils";
import base58 from "bs58";
import {
  CHANGE_COLOR_INSTRUCTION_ID,
  ChangeColorInstructionData,
  CHANGE_OFFER_INSTRUCTION_ID,
  ChangeOfferInstructionData,
  ACCEPT_OFFER_INSTRUCTION_ID,
  AcceptOfferInstructionData,
} from "../actions";
import { deserialize } from "borsh";

function parseInstruction(
  instruction: ParsedInstruction | PartiallyDecodedInstruction
) {
  if ("data" in instruction) {
    const buffer = base58.decode(instruction.data);
    switch (buffer.readInt8(0)) {
      case CHANGE_COLOR_INSTRUCTION_ID: {
        const res = deserialize(
          ChangeColorInstructionData.schema,
          ChangeColorInstructionData,
          buffer
        );
        return { res, 
          x: res['x'] < Math.pow(2, 15) ? res['x'] : - Math.pow(2,16) + res['x'],
          y: res['y'] < Math.pow(2, 15) ? res['y'] : - Math.pow(2,16) + res['y'], type: "Change color" };
          
      }
      case CHANGE_OFFER_INSTRUCTION_ID: {
        const res = deserialize(
          ChangeOfferInstructionData.schema,
          ChangeOfferInstructionData,
          buffer
        );

        res.price = res.price.isZero() ? undefined : res.price;

        return {
          res,
          x: bytesToSignedInt(new BN(res["x"]).toArray('le', 8)),
          y: bytesToSignedInt(new BN(res["y"]).toArray('le', 8)),
          type: res.price ? "Space list" : "Space delist",
          seller: instruction.accounts[2].toBase58(),
        };
      }
      case ACCEPT_OFFER_INSTRUCTION_ID: {
        const res = deserialize(
          AcceptOfferInstructionData.schema,
          AcceptOfferInstructionData,
          buffer
        );
        return {
          res,
          type: "Space buy",
          x: bytesToSignedInt(new BN(res["x"]).toArray('le', 8)),
          y: bytesToSignedInt(new BN(res["y"]).toArray('le', 8)),
          buyer: instruction.accounts[5].toBase58(),
          seller: instruction.accounts[7].toBase58(),
        };
      }
    }
  }
  return undefined;
}

export function Activity() {
  const connection = useConnection();
  const env = useConnectionConfig().env;

  const theme = createTheme({
    palette: {
      mode: "dark",
    },
  });
  const filterOperators = getGridStringOperators().filter(({ value }) =>
    ["equals"].includes(value)
  );

  const columns_color = [
    {
      field: "frame",
      headerName: "Frame #",
      width: 150,
      sortable: false,
      filterOperators,
    },
    {
      field: "color",
      headerName: "Color",
      width: 200,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        return (
          <Box
            sx={{
              width: 50,
              height: 50,
              bgcolor: params.value,
              "&:hover": {
                backgroundColor: params.value,
                opacity: [0.9, 0.8, 0.7],
              },
            }}
          />
        );
      },
    },
  ];

  const columns_market = [
    {
      field: "price",
      headerName: "Price",
      width: 150,
      sortable: true,
      renderCell: (value) => {
        return value.value
          ? `${parseInt(value.value) / 1_000_000_000} SOL`
          : "";
      },
    },
    {
      field: "seller",
      headerName: "Seller",
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const uri = `https://explorer.solana.com/address/${params.value}?cluster=${env}`;
        return <a href={uri}>{params.value}</a>;
      },
      filterOperators,
    },
    {
      field: "buyer",
      headerName: "Buyer",
      width: 150,
      sortable: false,
      renderCell: (params) => {
        const uri = `https://explorer.solana.com/address/${params.value}?cluster=${env}`;
        return <a href={uri}>{params.value}</a>;
      },
      filterOperators,
    },
  ];

  const [type, setType] = useState<string>("color");
  const [transactionSignatures, setTransactionSignatures] = useState<
    ConfirmedSignatureInfo[]
  >([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [detailsList, setDetailsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    {
      field: "signature",
      headerName: "Signature",
      renderCell: (params) => {
        const uri = `https://explorer.solana.com/tx/${params.value}?cluster=${env}`;
        return <a href={uri}>{params.value}</a>;
      },
      width: 150,
      sortable: false,
      filterOperators,
    },

    {
      field: "time",
      headerName: "Time",
      width: 150,
      renderCell: (params) => {
        return <Moment date={params.value * 1000} fromNow />;
      },
      filterable: false,
      disableColumnMenu: true,
    },
    {
      field: "type",
      type: "singleSelect",
      headerName: "Type",
      width: 200,
      sortable: false,
      valueOptions:
        type === "color"
          ? ["Change color"]
          : ["Space list", "Space delist", "Space buy"],
      filterOperators: [
        {
          value: "is",
          getApplyFilterFn: (filterItem: GridFilterItem) => {
            if (filterItem.value === null || filterItem.value === "") {
              return null;
            }

            return ({ value }): boolean => {
              if (typeof value === "object") {
                return (
                  filterItem.value ===
                  (value as { value: any; label: string }).value
                );
              }
              return filterItem.value === value;
            };
          },
          InputComponent: GridFilterInputValue,
          InputComponentProps: { type: "singleSelect" },
        },
      ],
    },

    {
      field: "x",
      headerName: "x",
      width: 150,
      sortable: false,
      filterOperators,
    },
    {
      field: "y",
      headerName: "y",
      width: 150,
      sortable: false,
      filterOperators,
    },
  ];

  useEffect(() => {
    const fetchSignatures = async (connection) => {
      const [sell_delegate_account] = await PublicKey.findProgramAddress(
        [BASE.toBuffer(), Buffer.from(SELL_DELEGATE_SEED)],
        SPACE_PROGRAM_ID
      );

      const res = await connection.getSignaturesForAddress(
        sell_delegate_account,
        {limit: 100},
        "confirmed"
      );

      res.push(
        ...(await connection.getSignaturesForAddress(
          COLOR_PROGRAM_ID,
          {limit: 100},
          "confirmed"
        ))
      );
      const sorted = res.sort((a, b) => {
        return b.blockTime - a.blockTime;
      });

      setTransactionSignatures(sorted);
    };
    fetchSignatures(connection);
  }, [connection]);

  useEffect(() => {
    const fetchTransactions = async () => {
      const chunked = chunks(transactionSignatures, 100);
      const txns: any[] = [];
      for (let j = 0; j < chunked.length; j++) {
        const item = chunked[j];
        const content = await connection.getParsedConfirmedTransactions(
          item.map((t) => t.signature),
          "confirmed"
        );
        let parsed;
        for (const element of content) {
          if (element) {
            for (const instruction of element.transaction.message
              .instructions) {
              parsed = parseInstruction(instruction);
              if (parsed) {
                txns.push({
                  signature: element.transaction.signatures[0],
                  time: element.blockTime,
                  x : parsed.x,
                  y:  parsed.y,
                  frame: parsed.res["frame"],
                  r: parsed.res["r"],
                  g: parsed.res["g"],
                  b: parsed.res["b"],
                  price: parsed.res["price"],
                  type: parsed.type,
                  seller: parsed.seller,
                  buyer: parsed.buyer,
                });
              }
            }
          }
        }
        setTransactionHistory([...txns]);
      }
    };
    fetchTransactions();
  }, [transactionSignatures]);

  useEffect(() => {
    const res = transactionHistory.map(
      (
        { signature, time, x, y, type, frame, r, g, b, price, buyer, seller },
        index
      ) => {
        return {
          id: index,
          price,
          signature: signature,
          time: time,
          x: x,
          y: y,
          type: type,
          frame: frame,
          color: r || r === 0 ? rgbToHex(r, g, b) : null,
          buyer,
          seller,
        };
      }
    );

    setDetailsList(
      res.filter((el) => {
        if (type === "market") {
          return el.type.includes("Space");
        } else {
          return el.type.includes("color");
        }
      })
    );
  }, [transactionHistory, type]);

  useEffect(()=>{
    setLoading(detailsList.length === 0);
  }, [detailsList]);


  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Header />
      <div style={{ height: "60%", width: "80%", margin: "auto" }}>
        <Button
          variant="outlined"
          onClick={(event) => {
            if (type === "color") {
              setType("market");
            } else {
              setType("color");
            }
          }}
        >
          {type}
        </Button>
        <DataGrid
          style={{
            position: "absolute",
            height: "60%",
            overflowY: "auto",
            width: "80%",
          }}
          rows={detailsList}
          columns={[
            ...columns,
            ...(type === "color" ? columns_color : []),
            ...(type === "market" ? columns_market : []),
          ]}
          disableColumnSelector
          disableSelectionOnClick
          pageSize={10}
          loading={loading}
        />
      </div>
    </ThemeProvider>
  );
}
