import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction,} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {SPACE_PROGRAM_ID, NEIGHBORHOOD_METADATA_SEED, VOUCHER_MINT_SEED, VOUCHER_SINK_SEED} from "../constants";
import {correct_negative_serialization, twoscomplement_i2u} from "../utils/borsh";

export class InitVoucherSystemInstructionData {
  instruction: number = 5;
  n_x: number;
  n_y: number;

  static schema: Schema = new Map([
    [
      InitVoucherSystemInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["n_x", "u64"],
          ["n_y", "u64"],
        ],
      },
    ],
  ]);

  constructor(args: { n_x: number; n_y: number;}) {
    this.n_x = args.n_x;
    this.n_y = args.n_y;
  }
}

export const initVoucherSystemInstruction = async (
  wallet: any,
  base: PublicKey,
  n_x: number,
  n_y: number,
  voucherAuth: PublicKey,
) => {
  const n_x_bytes = twoscomplement_i2u(n_x); 
  const n_y_bytes = twoscomplement_i2u(n_y);

  const [nhoodAcc,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(NEIGHBORHOOD_METADATA_SEED),
      Buffer.from(n_x_bytes),
      Buffer.from(n_y_bytes),
    ],
    SPACE_PROGRAM_ID
  );
  const [voucherMint,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(VOUCHER_MINT_SEED),
      Buffer.from(n_x_bytes),
      Buffer.from(n_y_bytes),
    ],
    SPACE_PROGRAM_ID
  );
  const voucherSourceATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    voucherMint,
    voucherAuth,
    false
  ); 
  const [voucherSink,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(VOUCHER_SINK_SEED),
      Buffer.from(n_x_bytes),
      Buffer.from(n_y_bytes),
    ],
    SPACE_PROGRAM_ID
  );

  const keys = [
    {
      pubkey: base,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: nhoodAcc,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: wallet.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: voucherAuth,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: voucherMint,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: voucherSourceATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: voucherSink,
      isSigner: false,
      isWritable: true,
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
  let args = new InitVoucherSystemInstructionData({
    n_x,
    n_y,
  });
  let data = Buffer.from(serialize(InitVoucherSystemInstructionData.schema, args));
  // borsh JS sucks, need to be able to serialize negative numbers
  data = correct_negative_serialization(data, 1, 9, n_x_bytes);
  data = correct_negative_serialization(data, 9, 17, n_y_bytes);

  let Ix = 
    [new TransactionInstruction({
      keys,
      programId: SPACE_PROGRAM_ID,
      data,
    })];

  return Ix;
};
