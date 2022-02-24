import {PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction,} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {SPACE_PROGRAM_ID, NEIGHBORHOOD_METADATA_SEED, VOUCHER_MINT_SEED, VOUCHER_SINK_SEED, VOUCHER_MINT_AUTH} from "../constants";
import {correct_negative_serialization, signedIntToBytes} from "../utils/borsh";

export class GetVouchersInstructionData {
  instruction: number = 9;
  n_x: number;
  n_y: number;
  count: number;
  fee: number;

  static schema: Schema = new Map([
    [
      GetVouchersInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["n_x", "u64"],
          ["n_y", "u64"],
          ["count", "u64"],
          ["fee", "u64"],
        ],
      },
    ],
  ]);

  constructor(args: {
    n_x: number;
    n_y: number;
    count: number;
    fee: number;
  }) {
    this.n_x = args.n_x;
    this.n_y = args.n_y;
    this.count = args.count;
    this.fee = args.fee;
  }
}

export const getVouchersInstruction = async (
  connection,
  server,
  wallet: any,
  base: PublicKey,
  n_x: number,
  n_y: number,
  count,
  fee,
) => {
  const n_x_bytes = signedIntToBytes(n_x); 
  const n_y_bytes = signedIntToBytes(n_y);

  const [nhoodAcc,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(NEIGHBORHOOD_METADATA_SEED),
      Buffer.from(n_x_bytes),
      Buffer.from(n_y_bytes),
    ],
    SPACE_PROGRAM_ID
  );

  const neighborhoodCreator = await server.getNeighborhoodCreator(connection, n_x, n_y);

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
    VOUCHER_MINT_AUTH,
    false
  );
  const userVoucherATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    voucherMint,
    wallet.publicKey,
    false
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
      pubkey: neighborhoodCreator,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: VOUCHER_MINT_AUTH,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: voucherMint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: voucherSourceATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: wallet.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: userVoucherATA,
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
  let args = new GetVouchersInstructionData({
    n_x,
    n_y,
    count,
    fee,
  });
  let data = Buffer.from(serialize(GetVouchersInstructionData.schema, args));
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
