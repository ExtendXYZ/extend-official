import {Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, TransactionInstruction,} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {SPACE_PROGRAM_ID, NEIGHBORHOOD_LIST_SEED, NEIGHBORHOOD_METADATA_SEED, VOUCHER_MINT_SEED, EXTEND_TOKEN_MINT} from "../constants";
import {correct_negative_serialization, twoscomplement_i2u} from "../utils/borsh";




export class InitNeighborhoodMetadataInstructionData {
  instruction: number = 1;
  n_x: number;
  n_y: number;
  price: number;
  // name: not here because don't know how to serialize with schema

  static schema: Schema = new Map([
    [
      InitNeighborhoodMetadataInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["n_x", "u64"],
          ["n_y", "u64"],
          ["price", "u64"],
        ],
      },
    ],
  ]);

  constructor(args: { n_x: number; n_y: number; price: number; }) {
    this.n_x = args.n_x;
    this.n_y = args.n_y;
    this.price = args.price;
  }
}

export const initNeighborhoodMetadataInstruction = async (
  wallet: any,
  base: PublicKey,
  n_x: number,
  n_y: number,
  price: number,
  candyMachineConfig: PublicKey,
  candyMachineAddress: PublicKey,
  name: string = "",
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
  const [neighborhoodList,] =
    await PublicKey.findProgramAddress(
      [
        base.toBuffer(),
        Buffer.from(NEIGHBORHOOD_LIST_SEED),
      ],
      SPACE_PROGRAM_ID
    );
  const payerATA = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    EXTEND_TOKEN_MINT,
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
      pubkey: neighborhoodList,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: candyMachineConfig,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: candyMachineAddress,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: wallet.publicKey,
      isSigner: true,
      isWritable: false,
    },
    {
      pubkey: payerATA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: EXTEND_TOKEN_MINT,
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
      pubkey: SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  let args = new InitNeighborhoodMetadataInstructionData({
    n_x,
    n_y,
    price,
  });


  let data = Buffer.from(serialize(InitNeighborhoodMetadataInstructionData.schema, args));
  // borsh JS sucks, need to be able to serialize negative numbers
  data = correct_negative_serialization(data, 1, 9, n_x_bytes);
  data = correct_negative_serialization(data, 9, 17, n_y_bytes);

  // construct name buffer
  let name_buffer = Buffer.from(name, "utf-8");
  let zeros = Buffer.from(new Array(64 - name_buffer.length).fill(0));
  name_buffer = Buffer.concat([name_buffer, zeros]);
  
  data = Buffer.concat([data, name_buffer]);

  let Ix = 
    [new TransactionInstruction({
      keys,
      programId: SPACE_PROGRAM_ID,
      data,
    })];

  return Ix;
};
