// Convert OKLCH to RGB (simplified conversion)
function oklchToRGB(l, c, h) {
    // For now, use a simple approximation
    // This should be replaced with a proper OKLCH to RGB conversion
    const r = Math.max(0, Math.min(255, l * 255));
    const g = Math.max(0, Math.min(255, l * 255));
    const b = Math.max(0, Math.min(255, l * 255));
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Parse and convert OKLCH color string to RGB
export function convertOKLCHToRGB(oklchString) {
    const match = oklchString.match(/oklch\((.*?)\)/);
    if (!match) return oklchString;

    const values = match[1].split(' ').map(v => parseFloat(v));
    return oklchToRGB(values[0], values[1], values[2]);
}

// Convert gradient with OKLCH colors to RGB
export function convertGradientColors(gradientString) {
    if (!gradientString) return gradientString;

    return gradientString.replace(/oklch\([^)]+\)/g, (match) => {
        return convertOKLCHToRGB(match);
    });
}

// Convert hex to RGB
export const hexToRGB = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

// Convert RGB to hex
export const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
};

// Blend two colors with a given ratio
export const blendColors = (color1, color2, ratio) => {
    const rgb1 = hexToRGB(color1);
    const rgb2 = hexToRGB(color2);

    if (!rgb1 || !rgb2) return color1;

    const blend = {
        r: rgb1.r * (1 - ratio) + rgb2.r * ratio,
        g: rgb1.g * (1 - ratio) + rgb2.g * ratio,
        b: rgb1.b * (1 - ratio) + rgb2.b * ratio
    };

    return rgbToHex(blend.r, blend.g, blend.b);
};

// Darken a color by a percentage
export const darkenColor = (color, amount) => {
    const rgb = hexToRGB(color);
    if (!rgb) return color;

    return rgbToHex(
        rgb.r * (1 - amount),
        rgb.g * (1 - amount),
        rgb.b * (1 - amount)
    );
}
