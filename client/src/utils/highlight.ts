const TINT_RATIO = 0.5;

export function colorHighlight(color: string) {

    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);
    r = r + (255 - r) * TINT_RATIO;
    g = g+ (255 - g) * TINT_RATIO;
    b = b + (255 - b) * TINT_RATIO;
    // const r = (parseInt(color.slice(1, 3), 16) + 128) % 256;
    // const g = (parseInt(color.slice(3, 5), 16) + 128) % 256;
    // const b = (parseInt(color.slice(5, 7), 16) + 0) % 256;
    const newColor = "#" + Buffer.from([r, g, b]).toString('hex');
    return newColor;
}