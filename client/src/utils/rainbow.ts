import Rainbow from 'rainbowvis.js';

const solanaGradient = new Rainbow();
solanaGradient.setSpectrum('#3d50c3', 'white', '#b70d28');
solanaGradient.setNumberRange(7, 10);

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

// returns color (without # in front)
export function priceToColor(price : number){
    const price_log = Math.log10(price);
    return solanaGradient.colorAt(price_log, 7, 10);
}

// returns color (without # in front)
export function rentPriceToColor(price : number){
    const price_log = Math.log10(price);
    return solanaGradient.colorAt(price_log, 7, 10);
}
