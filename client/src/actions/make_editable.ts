import {PublicKey, TransactionInstruction} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID,} from "@solana/spl-token";
import {
    COLOR_PROGRAM_ID,
    SPACE_METADATA_SEED,
    SPACE_PROGRAM_ID,
    NEIGHBORHOOD_FRAME_BASE_SEED,
    NEIGHBORHOOD_SIZE,
} from "../constants";
import {correct_negative_serialization, signedIntToBytes} from "../utils/borsh";
import BN from 'bn.js';

export const MAKE_EDITABLE_INSTRUCTION_ID = 4;
export class MakeEditableInstructionData {
  instruction: number = MAKE_EDITABLE_INSTRUCTION_ID;
  x: number;
  y: number;

  static schema: Schema = new Map([
    [
      MakeEditableInstructionData,
      {
        kind: "struct",
        fields: [
          ["instruction", "u8"],
          ["x", "u16"],
          ["y", "u16"],
        ],
      },
    ],
  ]);

  constructor(args: {
    x: number;
    y: number;
  }) {
    this.x = args.x;
    this.y = args.y;
  }
}

export class MakeEditableArgs {
  x: number;
  y: number;
  mint: PublicKey;

  constructor(args: {
    x: number;
    y: number;
    mint: PublicKey;
  }) {
    this.x = args.x;
    this.y = args.y;
    this.mint = args.mint;
  }
}

export const makeEditableInstruction = async (
  connection,
  wallet: any,
  base: PublicKey,
  change: MakeEditableArgs,
  timeCluster_input: any = null,
) => {

  const {x, y, mint} = change;

  const space_x_bytes = signedIntToBytes(x);
  const space_y_bytes = signedIntToBytes(y);
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
  const n_x_bytes = signedIntToBytes(Math.floor(x / NEIGHBORHOOD_SIZE));
  const n_y_bytes = signedIntToBytes(Math.floor(y / NEIGHBORHOOD_SIZE));
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

  var timeCluster;
  if (!timeCluster_input) {
    const neighborhoodFrameBaseData = await connection.getAccountInfo(neighborhoodFrameBase);
    timeCluster = new PublicKey(neighborhoodFrameBaseData.data.slice(9, 41));
  }
  else {
    timeCluster = timeCluster_input;
  }

  const keys = [
    {
      pubkey: base,
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
    {
      pubkey: timeCluster,
      isSigner: false,
      isWritable: true,
    },
  ];
  let args = new MakeEditableInstructionData({
    x: 0, // hardcode 0 for u16 case
    y: 0, // hardcode 0 for u16 case
  });

  let data = Buffer.from(serialize(MakeEditableInstructionData.schema, args));
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

export const makeEditableInstructions = async (
  connection,
  wallet: any,
  base: PublicKey,
  changes: MakeEditableArgs[],
  timeClusterMap: any,
) => {

  let Ixs: TransactionInstruction[] = [];

  for(let change of changes){

    let n_x = Math.floor(change.x/NEIGHBORHOOD_SIZE);
    let n_y = Math.floor(change.y/NEIGHBORHOOD_SIZE);

    let Ix = await makeEditableInstruction(
      connection,
      wallet,
      base,
      change,
      timeClusterMap[JSON.stringify({n_x, n_y})],
    );


    Ixs.push(Ix[0]);
  }

  return Ixs;
}; 