import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction,} from "@solana/web3.js";
import BN from "bn.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, u64,} from "@solana/spl-token";
import {NEIGHBORHOOD_SIZE, NEIGHBORHOOD_METADATA_SEED, SPACE_METADATA_SEED, SPACE_PROGRAM_ID, SELL_DELEGATE_SEED, RENT_ACCOUNT_SEED, RENT_PROGRAM_ID} from "../constants";
import {correct_negative_serialization, twoscomplement_i2u} from "../utils/borsh";
import { Server } from "ws";

export class AcceptRentInstructionData {
  instruction: number = 1;
  x: number;
  y: number;
  price: BN;
  rent_time: BN;

  static schema: Schema = new Map([
    [
      AcceptRentInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u64"],
          ["y", "u64"],
          ["price", "u64"],
          ["rent_time", "u64"],
        ],
      },
    ],
  ]);

  constructor(args: {
    x: number;
    y: number;
    price: number;
    rent_time: number;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.price = new BN(Math.floor(args.price));
    this.rent_time = new BN(Math.floor(args.rent_time));
  }
}

export class AcceptRentArgs{
  x: number;
  y: number;
  mint: PublicKey;
  price: number;
  rent_time: number;
  renter: PublicKey;

  constructor(args: {
    x: number;
    y: number;
    mint: PublicKey;
    price: number;
    rent_time: number;
    renter: PublicKey;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.mint = args.mint;
    this.price = args.price;
    this.rent_time = args.rent_time;
    this.renter = args.renter;
  }
}

export const acceptRentInstruction = async (
  server,
  connection,
  wallet: any,
  base: PublicKey,
  change: AcceptRentArgs,
) => {

  const {x, y, mint, price, rent_time, renter} = change;
  console.log(change);

  const space_x = twoscomplement_i2u(x);
  const space_y = twoscomplement_i2u(y);
  const [space_metadata_account,] =
      await PublicKey.findProgramAddress(
      [
        base.toBuffer(),
        Buffer.from(SPACE_METADATA_SEED),
        Buffer.from(space_x),
        Buffer.from(space_y),
      ],
      SPACE_PROGRAM_ID
    );

  const [rent_account,] =
    await PublicKey.findProgramAddress(
      [
        base.toBuffer(),
        Buffer.from(RENT_ACCOUNT_SEED),
        Buffer.from(space_x),
        Buffer.from(space_y),
      ],
      RENT_PROGRAM_ID
    );

  const renter_space_ATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    renter,
    false,
  );

  const args = new AcceptRentInstructionData({
    x,
    y,
    price,
    rent_time,
  });

  const keys = [
    {
      pubkey: base,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: space_metadata_account,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: rent_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: wallet.publicKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: renter,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: renter_space_ATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];

  let data = Buffer.from(serialize(AcceptRentInstructionData.schema, args));
  // borsh JS sucks, need to be able to serialize negative numbers
  data = correct_negative_serialization(data, 1, 9, space_x);
  data = correct_negative_serialization(data, 9, 17, space_y);

  let Ix =
    [new TransactionInstruction({
      keys,
      programId: RENT_PROGRAM_ID,
      data,
    })];

  return Ix;
};

export const acceptRentInstructions = async (
  server,
  connection,
  wallet: any,
  base: PublicKey,
  changes: AcceptRentArgs[],
) => {

  let Ixs: TransactionInstruction[] = [];

  for (let change of changes) {

    let Ix = await acceptRentInstruction(
      server,
      connection,
      wallet,
      base,
      change,
    );
    
    Ixs.push(Ix[0]);
  }

  return Ixs;
};