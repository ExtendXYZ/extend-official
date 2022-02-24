import {PublicKey, SystemProgram, TransactionInstruction,} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {
    SPACE_METADATA_SEED,
    SPACE_PROGRAM_ID,
    METADATA_PROGRAM_ID,
    NEIGHBORHOOD_METADATA_SEED,
    NEIGHBORHOOD_SIZE,
} from "../constants";
import {correct_negative_serialization, signedIntToBytes} from "../utils/borsh";

export class InitSpaceMetadataInstructionData {
  instruction: number = 2;
  x: number;
  y: number;

  static schema: Schema = new Map([
    [
      InitSpaceMetadataInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u64"],
          ["y", "u64"],
        ],
      },
    ],
  ]);

  constructor(args: { x: number; y: number; }) {
    this.x = args.x;
    this.y = args.y;
  }
}

export const initSpaceMetadataInstruction = async (
  wallet: any,
  base: PublicKey,
  x: number,
  y: number,
  spaceMint: PublicKey,
) => {
  const space_x = signedIntToBytes(x);
  const space_y = signedIntToBytes(y);
  const [spaceAcc,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(SPACE_METADATA_SEED),
      Buffer.from(space_x),
      Buffer.from(space_y),
    ],
    SPACE_PROGRAM_ID
  );
  const [spaceATA,] =
    await PublicKey.findProgramAddress(
      [
        wallet.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        spaceMint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  const n_x = signedIntToBytes(Math.floor(x / NEIGHBORHOOD_SIZE));
  const n_y = signedIntToBytes(Math.floor(y / NEIGHBORHOOD_SIZE));
  const [nhoodAcc,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(NEIGHBORHOOD_METADATA_SEED),
      Buffer.from(n_x),
      Buffer.from(n_y),
    ],
    SPACE_PROGRAM_ID
  );
  
  // get metadata metaplex
  const [metaplexMetadata,] = await PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"), 
      METADATA_PROGRAM_ID.toBytes(), 
      spaceMint.toBytes()
    ], 
    METADATA_PROGRAM_ID
  );

  const keys = [
    {
      pubkey: base,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: metaplexMetadata,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: spaceAcc,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: spaceMint,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: nhoodAcc,
      isSigner: false,
      isWritable: false,
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
  let args = new InitSpaceMetadataInstructionData({
    x,
    y,
  });
  let data = Buffer.from(serialize(InitSpaceMetadataInstructionData.schema, args));
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

export const initSpaceMetadataInstructions = async (
  wallet: any,
  base: PublicKey,
  spaceAccs,
  spaceMints,
) => {
  let Ixs: TransactionInstruction[] = [];
  for (let p in spaceAccs) {
    const spaceMint = spaceMints[p];
    const space = JSON.parse(p);

    let Ix = await initSpaceMetadataInstruction(
      wallet,
      base,
      space.x,
      space.y,
      spaceMint
    );

    Ixs.push(Ix[0]);
  }
  return Ixs;
};