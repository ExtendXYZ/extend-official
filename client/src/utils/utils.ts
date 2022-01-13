import {useCallback, useState} from 'react';

export function useLocalStorageState(key: string, defaultState?: string) {
  const [state, setState] = useState(() => {
    // NOTE: Not sure if this is ok
    const storedState = localStorage.getItem(key);
    if (storedState) {
      return JSON.parse(storedState);
    }
    return defaultState;
  });

  const setLocalStorageState = useCallback(
    newState => {
      const changed = state !== newState;
      if (!changed) {
        return;
      }
      setState(newState);
      if (newState === null) {
        localStorage.removeItem(key);
      } else {
        try {
          localStorage.setItem(key, JSON.stringify(newState));
        } catch {
          // ignore
        }
      }
    },
    [state, key],
  );

  return [state, setLocalStorageState];
}

// shorten the checksummed version of the input address to have 4 characters at start and end
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function chunks<T>(array: T[], size: number): T[][] {
  return Array.apply<number, T[], T[][]>(
    0,
    new Array(Math.ceil(array.length / size)),
  ).map((_, index) => array.slice(index * size, (index + 1) * size));
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function componentToHex(c) {
  var hex = c.toString(16);
  return hex.length === 1 ? "0" + hex : hex;
}

export function rgbToHex(r, g, b) {
  return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

export function compact_u16_len (x) {
  if (x <= 127){
    return 1;
  }
  else if (x <= 16383){
    return 2;
  }
  return 3;
}

export function convertToInt(arr) {
  var length = arr.length;

  let buffer = Buffer.from(arr);
  var result = buffer.readUIntLE(0, length);

  return result;
}

export const solToLamports = (n: any) => {
  try {
      return Math.floor(parseFloat(n) * Math.pow(10, 9));    
  } catch {
      return 0;
  }
};

export const lamportsToSol = (n: any) => {
  try {
      return n * Math.pow(10, -9);    
  } catch {
      return 0;
  }
};

export function shuffle(array, indexArray) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];

    [indexArray[currentIndex], indexArray[randomIndex]] = [
      indexArray[randomIndex], indexArray[currentIndex]];
  }

  return [array, indexArray];
}

export function formatPrice(x){
  return x.toFixed(3) > 0 ? x.toFixed(3) : x.toPrecision(2);
}