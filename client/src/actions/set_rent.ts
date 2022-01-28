import {PublicKey, SystemProgram, TransactionInstruction,} from "@solana/web3.js";
import BN from "bn.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, u64,} from "@solana/spl-token";
import {SPACE_METADATA_SEED, SELL_DELEGATE_SEED, RENT_ACCOUNT_SEED, SPACE_PROGRAM_ID, RENT_PROGRAM_ID} from "../constants";
import {correct_negative_serialization, twoscomplement_i2u} from "../utils/borsh";

export class SetRentInstructionData {
  instruction: number = 0;
  x: number;
  y: number;
  price: BN;
  min_duration: BN;
  max_duration: BN;
  max_timestamp: BN;
  create: boolean;

  static schema: Schema = new Map([
    [
      SetRentInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u64"],
          ["y", "u64"],
          ["price", "u64"],
          ["min_duration", "u64"],
          ["max_duration", "u64"],
          ["max_timestamp", "u64"],
          ["create", "u8"],
        ],
      },
    ],
  ]);

  constructor(args: {
    x: number;
    y: number;
    price: number;
    min_duration: number;
    max_duration: number;
    max_timestamp: number;
    create: boolean;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.price = new BN(Math.floor(args.price));
    this.min_duration = new BN(Math.floor(args.min_duration));
    this.max_duration = new BN(Math.floor(args.max_duration));
    this.max_timestamp = new BN(Math.floor(args.max_timestamp));
    this.create = args.create;
  }
}

export class SetRentArgs{
  x: number;
  y: number;
  mint: PublicKey;
  price: number;
  min_duration: number;
  max_duration: number;
  max_timestamp: number;
  create: boolean;
  constructor(args: {
    x: number;
    y: number;
    mint: PublicKey;
    price: number;
    min_duration: number;
    max_duration: number;
    max_timestamp: number;
    create: boolean;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.mint = args.mint;
    this.price = args.price;
    this.min_duration = args.min_duration;
    this.max_duration = args.max_duration;
    this.max_timestamp = args.max_timestamp;
    this.create = args.create;
  }
}

export const setRentInstruction = async (
  wallet: any,
  base: PublicKey,
  change: SetRentArgs,
) => {
  const {x, y, mint, price, min_duration, max_duration, max_timestamp, create} = change;

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


  const spaceATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    wallet.publicKey,
    false
  );
  
  const args = new SetRentInstructionData({
    x,
    y,
    price,
    min_duration,
    max_duration,
    max_timestamp,
    create,
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
      isWritable: false,
    },
    {
      pubkey: spaceATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
  ];

  let data = Buffer.from(serialize(SetRentInstructionData.schema, args));
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

export const setRentInstructions = async (
  wallet: any,
  base: PublicKey,
  changes: SetRentArgs[],
) => {

  let Ixs: TransactionInstruction[] = [];

  for (let change of changes) {

    let Ix = await setRentInstruction(
      wallet,
      base,
      change,
    );
    
    Ixs.push(Ix[0]);
  }

  return Ixs;
};
