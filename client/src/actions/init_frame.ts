import {Keypair, PublicKey, SystemProgram, TransactionInstruction,} from "@solana/web3.js";
import {Schema, serialize} from "borsh";
import {
    COLOR_CLUSTER_SIZE,
    TIME_CLUSTER_SIZE,
    COLOR_PROGRAM_ID,
    SPACE_PROGRAM_ID,
    NEIGHBORHOOD_FRAME_BASE_SEED,
    NEIGHBORHOOD_FRAME_POINTER_SEED,
    NEIGHBORHOOD_METADATA_SEED
} from "../constants";
import {correct_negative_serialization, signedIntToBytes} from "../utils/borsh";
import BN from "bn.js";

export class InitFrameInstructionData {
  instruction: number = 0;
  n_x: number;
  n_y: number;

  static schema: Schema = new Map([
    [
      InitFrameInstructionData,
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

export const createColorClusterInstruction = async (
  connection,
  wallet: any,
) => {
  const colorClusterKeypair = new Keypair();

  const lamports = await connection.getMinimumBalanceForRentExemption(COLOR_CLUSTER_SIZE);
  let Ix = [SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: colorClusterKeypair.publicKey,
    lamports: lamports,
    space: COLOR_CLUSTER_SIZE,
    programId: COLOR_PROGRAM_ID,
  })];
  return {keypair: colorClusterKeypair, ix: Ix};
};

export const createTimeClusterInstruction = async (
  connection,
  wallet: any,
) => {
  const timeClusterKeypair = new Keypair();

  const lamports = await connection.getMinimumBalanceForRentExemption(TIME_CLUSTER_SIZE);
  let Ix = [SystemProgram.createAccount({
    fromPubkey: wallet.publicKey,
    newAccountPubkey: timeClusterKeypair.publicKey,
    lamports: lamports,
    space: TIME_CLUSTER_SIZE,
    programId: COLOR_PROGRAM_ID,
  })];
  return {keypair: timeClusterKeypair, ix: Ix};
};

export const initFrameInstruction = async (
  connection,
  wallet: any,
  base: PublicKey,
  n_x: number,
  n_y: number,
  colorFrameCluster: PublicKey,
  timeCluster: PublicKey,
) => {
  const n_x_bytes = signedIntToBytes(n_x);
  const n_y_bytes = signedIntToBytes(n_y);
  // initialize cluster without PDA
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
  
  // read current number of frames
  const neighborhoodFrameBaseData = await connection.getAccountInfo(neighborhoodFrameBase);
  const frame_bytes = neighborhoodFrameBaseData ? neighborhoodFrameBaseData.data.slice(1, 9) : new BN(0).toArray('le', 8);

  const [neighborhoodFrameKeyAccount,] =
    await PublicKey.findProgramAddress(
      [
        base.toBuffer(),
        Buffer.from(NEIGHBORHOOD_FRAME_POINTER_SEED),
        Buffer.from(n_x_bytes),
        Buffer.from(n_y_bytes),
        Buffer.from(frame_bytes)
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
  
  const keys = [
    {
      pubkey: base,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: colorFrameCluster,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: neighborhoodFrameBase,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: neighborhoodFrameKeyAccount,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: neighborhoodMetadata,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: wallet.publicKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: timeCluster,
      isSigner: false,
      isWritable: true,
    },
  ];

  const args = new InitFrameInstructionData({
    n_x,
    n_y,
  });

  let data = Buffer.from(serialize(InitFrameInstructionData.schema, args));
  // borsh JS sucks, need to be able to serialize negative numbers
  data = correct_negative_serialization(data, 1, 9, n_x_bytes);
  data = correct_negative_serialization(data, 9, 17, n_y_bytes);

  let Ix =
    [new TransactionInstruction({
      keys,
      programId: COLOR_PROGRAM_ID,
      data,
    })];

  return Ix;
};
