import {PublicKey, TransactionInstruction,} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {
    COLOR_PROGRAM_ID,
    SPACE_METADATA_SEED,
    SPACE_PROGRAM_ID,
    NEIGHBORHOOD_FRAME_BASE_SEED,
    NEIGHBORHOOD_FRAME_POINTER_SEED,
    NEIGHBORHOOD_METADATA_SEED,
    NEIGHBORHOOD_SIZE,
} from "../constants";
import {correct_negative_serialization, twoscomplement_i2u} from "../utils/borsh";
import BN from 'bn.js';

export const CHANGE_COLOR_INSTRUCTION_ID = 2;
export class ChangeColorInstructionData {
  instruction: number = CHANGE_COLOR_INSTRUCTION_ID;
  x: number;
  y: number;
  frame: number;
  r: number;
  g: number;
  b: number;

  static schema: Schema = new Map([
    [
      ChangeColorInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u16"],
          ["y", "u16"],
          ["frame", "u8"],
          ["r", "u8"],
          ["g", "u8"],
          ["b", "u8"],
        ],
      },
    ],
  ]);

  constructor(args: {
    x: number;
    y: number;
    frame: number;
    r: number;
    g: number;
    b: number;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.frame = args.frame;
    this.r = args.r;
    this.g = args.g;
    this.b = args.b;
  }
}

export class ChangeColorArgs {
  x: number;
  y: number;
  frame: number;
  r: number;
  g: number;
  b: number;
  mint: PublicKey;

  constructor(args: {
    x: number;
    y: number;
    frame: number;
    r: number;
    g: number;
    b: number;
    mint: PublicKey;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.frame = args.frame;
    this.r = args.r;
    this.g = args.g;
    this.b = args.b;
    this.mint = args.mint;
  }
}

export const changeColorInstruction = async (
  connection,
  wallet: any,
  base: PublicKey,
  change: ChangeColorArgs,
  colorCluster_input: any = null,
) => {

  const {x, y, frame, r, g, b, mint} = change;

  const space_x_bytes = twoscomplement_i2u(x);
  const space_y_bytes = twoscomplement_i2u(y);
  const [spaceAcc,] = await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(SPACE_METADATA_SEED),
      Buffer.from(space_x_bytes),
      Buffer.from(space_y_bytes),
    ],
    SPACE_PROGRAM_ID
  );
  const [spaceATA,] =
    await PublicKey.findProgramAddress(
      [
        wallet.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  const n_x_bytes = twoscomplement_i2u(Math.floor(x / NEIGHBORHOOD_SIZE));
  const n_y_bytes = twoscomplement_i2u(Math.floor(y / NEIGHBORHOOD_SIZE));
  const [neighborhoodFrameBase,] =
  await PublicKey.findProgramAddress(
    [
      base.toBuffer(),
      Buffer.from(NEIGHBORHOOD_FRAME_BASE_SEED),
      Buffer.from(n_x_bytes),
      Buffer.from(n_y_bytes),
    ],
    COLOR_PROGRAM_ID
  );

  const frame_bytes = new BN(frame).toArray('le', 8);
  const [neighborhoodFrameKeyAccount,] =
    await PublicKey.findProgramAddress(
      [
        base.toBuffer(),
        Buffer.from(NEIGHBORHOOD_FRAME_POINTER_SEED),
        Buffer.from(n_x_bytes),
        Buffer.from(n_y_bytes),
        Buffer.from(frame_bytes),
      ],
      COLOR_PROGRAM_ID
    );
  const [neighborhoodMetadata,] = 
    await PublicKey.findProgramAddress(
      [
        base.toBuffer(),
        Buffer.from(NEIGHBORHOOD_METADATA_SEED),
        Buffer.from(n_x_bytes),
        Buffer.from(n_y_bytes),
      ],
      SPACE_PROGRAM_ID
    );

  var colorCluster;
  if (!colorCluster_input) {
    const neighborhoodFrameKeyData = await connection.getAccountInfo(neighborhoodFrameKeyAccount);
    colorCluster = new PublicKey(neighborhoodFrameKeyData.data.slice(1, 33));
  }
  else {
    colorCluster = colorCluster_input;
  }

  const keys = [
    {
      pubkey: base,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: colorCluster,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: neighborhoodFrameBase,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: neighborhoodFrameKeyAccount,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: neighborhoodMetadata,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: spaceAcc,
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
      isWritable: false,
    },
  ];
  let args = new ChangeColorInstructionData({
    x: 0, // hardcode 0 for u16 case
    y: 0, // hardcode 0 for u16 case
    frame,
    r,
    g,
    b,
  });
  
  let data = Buffer.from(serialize(ChangeColorInstructionData.schema, args));
  // borsh JS sucks, need to be able to serialize negative numbers
  let space_x_bytes_16 = new BN(x).toTwos(16).toArray('le', 2);
  let space_y_bytes_16 = new BN(y).toTwos(16).toArray('le', 2);
  data = correct_negative_serialization(data, 1, 3, space_x_bytes_16);
  data = correct_negative_serialization(data, 3, 5, space_y_bytes_16);

  let Ix = 
    [new TransactionInstruction({
      keys,
      programId: COLOR_PROGRAM_ID,
      data,
    })];

  return Ix;
};

export const changeColorInstructions = async (
  connection,
  wallet: any,
  base: PublicKey,
  changes: ChangeColorArgs[],
  frameKeyMap: any,
) => {

  let Ixs: TransactionInstruction[] = [];

  for(let change of changes){

    let n_x = Math.floor(change.x/NEIGHBORHOOD_SIZE);
    let n_y = Math.floor(change.y/NEIGHBORHOOD_SIZE);
    
    let Ix = await changeColorInstruction(
      connection,
      wallet,
      base,
      change,
      frameKeyMap[JSON.stringify({n_x, n_y, frame: change.frame})],
    );

    
    Ixs.push(Ix[0]);
  }

  return Ixs;
};
