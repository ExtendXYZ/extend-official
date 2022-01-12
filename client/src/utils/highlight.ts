export function colorHighlight(color: string) {
    const r = (parseInt(color.slice(1, 3), 16) + 128) % 256;
    const g = (parseInt(color.slice(3, 5), 16) + 128) % 256;
    const b = (parseInt(color.slice(5, 7), 16) + 0) % 256;
    const newColor = "#" + Buffer.from([r, g, b]).toString('hex');
    return newColor;
}