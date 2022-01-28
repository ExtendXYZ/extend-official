import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction,} from "@solana/web3.js";
import BN from "bn.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {NEIGHBORHOOD_SIZE, NEIGHBORHOOD_METADATA_SEED, SPACE_METADATA_SEED, SPACE_PROGRAM_ID, SELL_DELEGATE_SEED,} from "../constants";
import {correct_negative_serialization, twoscomplement_i2u} from "../utils/borsh";
import { Server } from "ws";

export const ACCEPT_OFFER_INSTRUCTION_ID = 4;
export class AcceptOfferInstructionData {
  instruction: number = 4; // don't use constant to allow serialization
  x: number;
  y: number;
  price: BN;

  static schema: Schema = new Map([
    [
      AcceptOfferInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u64"],
          ["y", "u64"],
          ["price", "u64"],
        ],
      },
    ],
  ]);

  constructor(args: {
    x: number;
    y: number;
    price: number;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.price = new BN(Math.floor(args.price));
  }
}

export class AcceptOfferArgs{
  x: number;
  y: number;
  mint: PublicKey;
  price: number;
  seller: PublicKey;

  constructor(args: {
    x: number;
    y: number;
    mint: PublicKey;
    price: number;
    seller: PublicKey;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.mint = args.mint;
    this.price = args.price;
    this.seller = args.seller;
  }
}

export const acceptOfferInstruction = async (
  server,
  connection,
  wallet: any,
  base: PublicKey,
  change: AcceptOfferArgs,
) => {

  const {x, y, mint, price, seller} = change;

  const n_x = Math.floor(x / NEIGHBORHOOD_SIZE);
  const n_y = Math.floor(y / NEIGHBORHOOD_SIZE);
  const [neighborhoodMetadata,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(NEIGHBORHOOD_METADATA_SEED),
      Buffer.from(twoscomplement_i2u(n_x)),
      Buffer.from(twoscomplement_i2u(n_y)),
    ],
    SPACE_PROGRAM_ID
  );

  const neighborhoodCreator = await server.getNeighborhoodCreator(connection, n_x, n_y);

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

  const [sell_delegate_account,] =
      await PublicKey.findProgramAddress(
      [base.toBuffer(), Buffer.from(SELL_DELEGATE_SEED)],
      SPACE_PROGRAM_ID
    );

  const alice_space_ATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    wallet.publicKey,
    false
  );

  const seller_space_ATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint,
    seller,
    false
  );

  const args = new AcceptOfferInstructionData({
    x,
    y,
    price,
  });

  const keys = [
    {
      pubkey: base,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: neighborhoodMetadata,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: neighborhoodCreator,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: space_metadata_account,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: mint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: wallet.publicKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: alice_space_ATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: seller,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: seller_space_ATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: sell_delegate_account,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];

  let data = Buffer.from(serialize(AcceptOfferInstructionData.schema, args));
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

export const acceptOfferInstructions = async (
  server,
  connection,
  wallet: any,
  base: PublicKey,
  changes: AcceptOfferArgs[],
) => {

  let Ixs: TransactionInstruction[] = [];

  for (let change of changes) {

    let Ix = await acceptOfferInstruction(
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