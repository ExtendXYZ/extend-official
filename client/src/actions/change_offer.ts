import {PublicKey, TransactionInstruction,} from "@solana/web3.js";
import BN from "bn.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {SPACE_METADATA_SEED, SPACE_PROGRAM_ID, SELL_DELEGATE_SEED,} from "../constants";
import {correct_negative_serialization, signedIntToBytes} from "../utils/borsh";

export const CHANGE_OFFER_INSTRUCTION_ID = 3;
export class ChangeOfferInstructionData {
  instruction: number = 3;
  x: number;
  y: number;
  price: BN;
  create: boolean;

  static schema: Schema = new Map([
    [
      ChangeOfferInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u64"],
          ["y", "u64"],
          ["price", "u64"],
          ["create", "u8"],
        ],
      },
    ],
  ]);

  constructor(args: {
    x: number;
    y: number;
    price: number;
    create: boolean;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.price = new BN(Math.floor(args.price));
    this.create = args.create;
  }
}

export class ChangeOfferArgs{
  x: number;
  y: number;
  mint: PublicKey;
  price: number;
  create: boolean;
  constructor(args: {
    x: number;
    y: number;
    mint: PublicKey;
    price: number;
    create: boolean;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.mint = args.mint;
    this.price = args.price;
    this.create = args.create;
  }
}

export const changeOfferInstruction = async (
  wallet: any,
  base: PublicKey,
  change: ChangeOfferArgs,
) => {
  const {x, y, mint, price, create} = change;

  const space_x = signedIntToBytes(x);
  const space_y = signedIntToBytes(y);
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

  const [sell_delegate_account,] =
    await PublicKey.findProgramAddress(
      [base.toBuffer(), Buffer.from(SELL_DELEGATE_SEED)],
      SPACE_PROGRAM_ID
    );

  const spaceATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    wallet.publicKey,
    false
  );
  
  const args = new ChangeOfferInstructionData({
    x,
    y,
    price,
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
      pubkey: sell_delegate_account,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
  ];

  let data = Buffer.from(serialize(ChangeOfferInstructionData.schema, args));
  // borsh JS sucks, need to be able to serialize negative numbers
  data = correct_negative_serialization(data, 1, 9, space_x);
  data = correct_negative_serialization(data, 9, 17, space_y);

  let Ix = 
    [new TransactionInstruction({
      keys,
      programId: SPACE_PROGRAM_ID,
      data,
    })];

  return Ix;
};

export const changeOfferInstructions = async (
  wallet: any,
  base: PublicKey,
  changes: ChangeOfferArgs[],
) => {

  let Ixs: TransactionInstruction[] = [];

  for (let change of changes) {

    let Ix = await changeOfferInstruction(
      wallet,
      base,
      change,
    );
    
    Ixs.push(Ix[0]);
  }

  return Ixs;
};
