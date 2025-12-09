const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pool = require('../config/database');

const DEFAULT_IMAGE_SIZE = '1024x1024';
const SVG_BG_COLOR = '#F5F7FB';

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function getOpenAIKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  const { rows } = await pool.query(
    "SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1",
    ["openai"]
  );
  if (!rows.length || !rows[0].api_key) {
    throw new Error("OpenAI API key not found for diagram generation.");
  }
  return rows[0].api_key;
}

function buildDiagramPrompt(content) {
  return `Design a polished, presentation-ready dashboard-style diagram based on the following content. Focus on clarity, hierarchy, and readability.

Global requirements:
- Use a clean grid layout with rounded cards, subtle shadows, and the palette (background #F5F7FB, primary #1D4ED8, accent #38BDF8, text #0F172A).
- Combine charts, key metrics, and short insights that best summarize the information.
- Ensure legends, axis labels, and numbers remain readable and aligned.
- Avoid decorative elements that do not support the data story.

Content to visualize:
${content}

Produce a high-resolution infographic that could be dropped into a presentation slide.`;
}

function sizeToDimensions(size) {
  if (typeof size !== 'string') {
    return { width: 1024, height: 1024 };
  }
  const [width, height] = size.split('x').map((value) => parseInt(value, 10));
  if (!width || !height) {
    return { width: 1024, height: 1024 };
  }
  return { width, height };
}

function createSvgWrapper(base64Image, size = DEFAULT_IMAGE_SIZE) {
  const { width, height } = sizeToDimensions(size);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${SVG_BG_COLOR}" />
  <image href="data:image/png;base64,${base64Image}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" />
</svg>`;
}

async function requestDiagramImage(content, size = DEFAULT_IMAGE_SIZE) {
  const API_KEY = await getOpenAIKey();
  const payload = {
    model: 'gpt-image-1',
    prompt: content, //buildDiagramPrompt(content),
    size,
  };
  console.log("-----generateDiagramSVG----2----");
  
  const response = await axios.post('https://api.openai.com/v1/images/generations', payload, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  console.log("-----generateDiagramSVG----3----");

  // Check if response has the expected structure
  if (!response.data || !response.data.data || !Array.isArray(response.data.data) || response.data.data.length === 0) {
    throw new Error("Invalid response structure from API");
  }

  const imageData = response.data.data[0];
  let imageBase64;

  // Check if we have a URL or base64 data
  if (imageData.url) {
    // Download the image from the URL and convert to base64
    console.log("Downloading image from URL:", imageData.url);
    const imageResponse = await axios.get(imageData.url, {
      responseType: 'arraybuffer'
    });
    const imageBuffer = Buffer.from(imageResponse.data);
    imageBase64 = imageBuffer.toString('base64');
  } else if (imageData.b64_json) {
    // Use base64 data directly
    console.log("Using base64 data from response");
    imageBase64 = imageData.b64_json;
  } else {
    throw new Error("No URL or base64 data found in response. Response structure: " + JSON.stringify(imageData));
  }

  if (!imageBase64) {
    throw new Error('No image data received from OpenAI Images API.');
  }
  return imageBase64;
}

async function generateDiagramSVG(content, options = {}) {
  const {
    outputPath = `public/diagrams/diagram.svg`,
    pngOutputPath,
    convertToPng = true,
    imageSize = DEFAULT_IMAGE_SIZE,
  } = options;

  try {
    if (!content || !content.toString().trim()) {
      throw new Error('No content provided to generate diagram.');
    }
    console.log("-----generateDiagramSVG----1----", imageSize);
    const imageBase64 = await requestDiagramImage(content, imageSize);

    let pngPath = null;
    if (convertToPng) {
      pngPath = pngOutputPath || outputPath.replace(/\.svg$/i, '.png');
      ensureDirectory(path.dirname(pngPath));
      await fs.promises.writeFile(pngPath, Buffer.from(imageBase64, 'base64'));
    }

    if (outputPath) {
      ensureDirectory(path.dirname(outputPath));
      const svgMarkup = createSvgWrapper(imageBase64, imageSize);
      await fs.promises.writeFile(outputPath, svgMarkup, 'utf8');
    }

    return {
      success: true,
      filePath: outputPath,
      pngPath,
      message: 'Diagram generated successfully via gpt-image-1',
    };
  } catch (error) {
    console.error('Error generating diagram:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to generate diagram',
    };
  }
}

module.exports = {
  generateDiagramSVG,
};

