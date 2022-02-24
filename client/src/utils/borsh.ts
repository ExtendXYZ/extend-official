import {PublicKey} from '@solana/web3.js';
import BN from 'bn.js';
import {BinaryReader, BinaryWriter} from 'borsh';
import base58 from 'bs58';
import {StringPublicKey} from './ids';

export const extendBorsh = () => {
  (BinaryReader.prototype as any).readPubkey = function () {
    const reader = this as unknown as BinaryReader;
    const array = reader.readFixedArray(32);
    return new PublicKey(array);
  };

  (BinaryWriter.prototype as any).writePubkey = function (value: PublicKey) {
    const writer = this as unknown as BinaryWriter;
    writer.writeFixedArray(value.toBuffer());
  };

  (BinaryReader.prototype as any).readPubkeyAsString = function () {
    const reader = this as unknown as BinaryReader;
    const array = reader.readFixedArray(32);
    return base58.encode(array) as StringPublicKey;
  };

  (BinaryWriter.prototype as any).writePubkeyAsString = function (
    value: StringPublicKey,
  ) {
    const writer = this as unknown as BinaryWriter;
    writer.writeFixedArray(base58.decode(value));
  };
};

extendBorsh();

export const bytesToSignedInt = function(arr) {
  let sign = 1;
  if (arr.slice(7)[0] > 127) {
      arr = arr.map(value => 255 - value);
      arr[0] += 1;
      sign = -1;
  }
  let counter = 7;
  while(arr[counter] === 0) {
      counter -= 1;
  }
  let num = 0;
  for (let i = 0; i < counter + 1; i++) {
      num += arr[i] * Math.pow(2, 8*i);
  }
  return sign * num;
};

export const signedIntToBytes = function(long) {
  return new BN(long).toTwos(64).toArray('le', 8);
};

export function bytesToUInt(arr) {
  var length = arr.length;

  let buffer = Buffer.from(arr);
  var result = buffer.readUIntLE(0, length);

  return result;
}

export function UIntToBytes(long) {
  return new BN(long).toArray('le', 8);
}



export const correct_negative_serialization = function(data, i_start, i_end, correct) {
  for (let i = 0; i < i_end-i_start; ++i) {
    data[i+i_start] = correct[i];
  }
  
  return data;
};
