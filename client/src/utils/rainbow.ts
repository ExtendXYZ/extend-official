import Rainbow from 'rainbowvis.js';

const solanaGradient = new Rainbow();
solanaGradient.setSpectrum('#00FFA3', '#03E1FF', '#DC1FFF');
solanaGradient.setNumberRange(7, 10);

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// returns color (without # in front)
export function priceToColor(price : number){
    const price_log = Math.log10(price);
    return solanaGradient.colorAt(price_log, 7, 10);
}
