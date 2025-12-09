const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const pool = require('../config/database');

dotenv.config();

async function getOpenAIKey() {
  let API_KEY = process.env.OPENAI_API_KEY;
  if (API_KEY) return API_KEY;

  const { rows } = await pool.query(
    'SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1',
    ['openai']
  );
  if (!rows.length || !rows[0].api_key) {
    throw new Error('OpenAI API key not found');
  }
  return rows[0].api_key;
}

async function generatePresentationContent(prompt, slideCount = 5, includeImages = false, includeTables = false) {
  try {
    console.log('🤖 Generating enhanced presentation content with GPT-5.1...');

    let systemPrompt = `You are a professional presentation content creator. Create a structured presentation with ${slideCount} slides based on the user's prompt.`;
    if (includeImages) {
      systemPrompt += `\n- Include relevant image suggestions for slides where visual content would be helpful.`;
    }
    if (includeTables) {
      systemPrompt += `\n- Include tables for data comparison, statistics, or structured information.`;
    }
    systemPrompt += `\n\nReturn the response as a valid JSON array where each object has:
- "title": string (slide title)
- "content": array of strings (bullet points, 3-5 points per slide, and descriptions of them)
- "notes": string (optional speaker notes)
- "image": string or object (optional image description or URL for AI image generation)
- "table": object (optional table data with headers and rows based on real data)
- Current date : ${new Date()}
Image field format:
"image": {
  "description": "detailed description for AI image generation",
  "purpose": "why this image is relevant to the slide"
}

Table field format:
"table": {
  "headers": ["Header1", "Header2", "Header3"],
  "rows": [
    ["Data1", "Data2", "Data3"],
    ["Data4", "Data5", "Data6"]
  ],
  "title": "Table Title"
}

Important: Return ONLY the JSON array, no other text.`;

    const API_KEY = await getOpenAIKey();
    const url = 'https://api.openai.com/v1/chat/completions';
    const payload = {
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Create a ${slideCount}-slide presentation about: ${prompt}. current time: ${new Date()}, ${includeImages ? 'Include relevant images.' : ''} ${includeTables ? 'Include data tables where appropriate.' : ''}`,
        },
      ],
      // max_tokens: 4000,
      temperature: 0.2,
      top_p: 0.9,
    };

    const response = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    });
    const content = response.data.choices[0].message.content.trim();

    let cleanedContent = content;
    if (content.startsWith('```json')) {
      cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    }
    const parsedContent = JSON.parse(cleanedContent);
    console.log(`✅ Generated ${parsedContent.length} slides with enhanced content`);
    return parsedContent;
  } catch (error) {
    console.error('❌ Error generating enhanced presentation content:', error.message);
    if (error.response && error.response.status === 429) {
      console.log('⚠️ Rate limit, using GPT fallback');
      return await generateWithFallback(prompt, slideCount, includeImages, includeTables);
    }
    if (error.message && (error.message.includes('rate limit') || error.message.includes('model'))) {
      console.log('⚠️ Using GPT fallback');
      return await generateWithFallback(prompt, slideCount, includeImages, includeTables);
    }
    throw error;
  }
}

async function generateWithFallback(prompt, slideCount, includeImages, includeTables) {
  const API_KEY = await getOpenAIKey();
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: 'gpt-5.1',
    messages: [
      {
        role: 'system',
        content: `Create ${slideCount} slides about "${prompt}". Return as JSON array with title, content, notes.${includeImages ? ' Add image descriptions where helpful.' : ''}${includeTables ? ' Add tables for data.' : ''}`,
      },
      { role: 'user', content: prompt },
    ],
    // max_tokens: 3000,
    temperature: 0.2,
    top_p: 0.9,
  };
  const response = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  });
  const content = response.data.choices[0].message.content.trim();
  let cleanedContent = content;
  if (content.startsWith('```json')) {
    cleanedContent = content.replace(/```json\n?|\n?```/g, '');
  }
  return JSON.parse(cleanedContent);
}

async function generateAIImage(description, outputDir = 'images') {
  try {
    console.log(`🎨 Generating AI image: ${description.substring(0, 50)}...`);
    // Still use OpenAI for image generation (DALL-E)
    let API_KEY = process.env.OPENAI_API_KEY;
    if (!API_KEY) {
      const { rows } = await pool.query(
        'SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1',
        ['openai']
      );
      if (!rows.length || !rows[0].api_key) {
        throw new Error('OpenAI API key not found for image generation');
      }
      API_KEY = rows[0].api_key;
    }
    const url = 'https://api.openai.com/v1/images/generations';
    const payload = {
      model: 'dall-e-3',
      prompt: `Professional presentation image: ${description}. Create a clean, professional image suitable for a business presentation.`,
      size: '512x512',
      n: 1,
    };
    const response = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const imageUrl = response.data.data[0].url;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const imageName = `image-${Date.now()}.png`;
    const imagePath = path.join(outputDir, imageName);
    const imageResponse = await axios({ method: 'GET', url: imageUrl, responseType: 'stream' });
    const writer = fs.createWriteStream(imagePath);
    imageResponse.data.pipe(writer);
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`✅ AI image saved: ${imagePath}`);
        resolve(imagePath);
      });
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('❌ Error generating AI image:', error.message);
    return null;
  }
}

async function handleImageSource(imageSource, outputDir = 'images') {
  if (typeof imageSource === 'string' && fs.existsSync(imageSource)) {
    return imageSource;
  }
  if (typeof imageSource === 'object' && imageSource && imageSource.description) {
    return await generateAIImage(imageSource.description, outputDir);
  }
  if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const imageName = `downloaded-${Date.now()}.jpg`;
      const imagePath = path.join(outputDir, imageName);
      const response = await axios({ method: 'GET', url: imageSource, responseType: 'stream' });
      const writer = fs.createWriteStream(imagePath);
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(imagePath));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('❌ Error downloading image:', error.message);
      return null;
    }
  }
  return null;
}

async function createEnhancedPresentation(content, outputPath, theme = 'professional', generateImages = false) {
  try {
    console.log('📊 Creating enhanced PowerPoint presentation...');
    const pres = new PptxGenJS();

    pres.title = content[0]?.title || 'AI Generated Presentation';
    pres.subject = 'Generated with GPT-5.1';
    pres.author = 'Enhanced PPT Generator';
    pres.company = 'AI Services';

    const themes = {
      professional: { primary: '2C5AA0', secondary: 'FFFFFF', accent: 'F0F4F8', text: '2C3E50' },
      modern: { primary: 'FF6B6B', secondary: '4ECDC4', accent: 'F7F7F7', text: '333333' },
      creative: { primary: '9B59B6', secondary: 'E74C3C', accent: 'FDF2E9', text: '2C3E50' },
    };
    const themeColors = themes[theme] || themes.professional;

    const imagesDir = 'public/presentation-images';
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    for (let i = 0; i < content.length; i++) {
      const slideData = content[i];
      const slide = pres.addSlide();
      await addSlideContent(slide, slideData, themeColors, imagesDir, generateImages, i);
    }

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await pres.writeFile({ fileName: outputPath });
    console.log(`✅ Enhanced presentation saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Error creating enhanced presentation:', error.message);
    throw error;
  }
}

async function addSlideContent(slide, slideData, themeColors, imagesDir, generateImages, slideIndex) {
  slide.addText(slideData.title, {
    x: 0.5,
    y: 0.3,
    w: 9,
    h: 0.8,
    fontSize: 28,
    bold: true,
    color: themeColors.primary,
    align: 'left',
  });

  const contentY = 1.2;
  const contentWidth = 9;
  const hasImage = slideData.image && generateImages;
  const hasTable = slideData.table;

  if (hasImage || hasTable) {
    await addTwoColumnLayout(slide, slideData, themeColors, imagesDir, generateImages, contentY);
  } else {
    addTextContent(slide, slideData, themeColors, contentY, contentWidth);
  }

  slide.addText(`Slide ${slideIndex + 1}`, {
    x: 9.2,
    y: 7.0,
    w: 0.8,
    h: 0.3,
    fontSize: 14,
    color: '666666',
    align: 'right',
  });

  if (slideData.notes) {
    slide.addNotes(slideData.notes);
  }
}

async function addTwoColumnLayout(slide, slideData, themeColors, imagesDir, generateImages, startY) {
  const leftColumnX = 0.5;
  const rightColumnX = 5.0;
  const columnWidth = 4.0;

  if (slideData.content && slideData.content.length > 0) {
    slideData.content.forEach((point, index) => {
      slide.addText(` ${point}`, {
        x: leftColumnX,
        y: startY + index * 0.5,
        w: columnWidth,
        h: 0.4,
        fontSize: 12,
        color: themeColors.text,
        bullet: true,
      });
    });
  }

  if (slideData.image && generateImages) {
    await addImageToSlide(slide, slideData.image, rightColumnX, startY, columnWidth, 3.5, imagesDir);
  } else if (slideData.table) {
    addTableToSlide(slide, slideData.table, rightColumnX, startY, columnWidth, 3.5, themeColors);
  }
}

function addTextContent(slide, slideData, themeColors, startY, width) {
  if (slideData.content && slideData.content.length > 0) {
    slideData.content.forEach((point, index) => {
      slide.addText(` ${point}`, {
        x: 0.7,
        y: startY + index * 0.5,
        w: width,
        h: 0.4,
        fontSize: 14,
        color: themeColors.text,
        bullet: true,
      });
    });
  }
}

async function addImageToSlide(slide, imageData, x, y, width, height, imagesDir) {
  try {
    const imagePath = await handleImageSource(imageData, imagesDir);
    if (imagePath && fs.existsSync(imagePath)) {
      slide.addImage({ path: imagePath, x, y, w: width, h: height });
      if (imageData.purpose) {
        slide.addText(imageData.purpose, {
          x,
          y: y + height + 0.1,
          w: width,
          h: 0.3,
          fontSize: 10,
          color: '666666',
          align: 'center',
        });
      }
    }
  } catch (error) {
    console.error('❌ Error adding image to slide:', error.message);
  }
}

function addTableToSlide(slide, tableData, x, y, width, height, themeColors) {
  try {
    if (!tableData.headers || !tableData.rows) {
      console.warn('⚠️ Invalid table data structure');
      return;
    }
    if (tableData.title) {
      slide.addText(tableData.title, {
        x,
        y: y - 0.3,
        w: width,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: themeColors.primary,
        align: 'center',
      });
    }
    const tableRows = [tableData.headers, ...tableData.rows];
    slide.addTable(tableRows, {
      x,
      y,
      w: width,
      h: height,
      border: { pt: 1, color: 'CCCCCC' },
      fill: { color: 'F9F9F9' },
      fontSize: 10,
      color: themeColors.text,
      align: 'center',
      valign: 'middle',
      row: [
        {
          fill: { color: themeColors.primary },
          color: themeColors.secondary,
          bold: true,
        },
      ],
    });
  } catch (error) {
    console.error('❌ Error adding table to slide:', error.message);
  }
}

async function generateEnhancedPPT(prompt, options = {}) {
  const {
    outputPath = 'public/presentations/enhanced-output.pptx',
    slideCount = 10,
    theme = 'professional',
    includeImages = true ,
    includeTables = true ,
    generateAIImages = true,
  } = options;

  try {
    if (!prompt || prompt.trim().length < 5) {
      throw new Error('Prompt must be at least 5 characters long');
    }

    console.log('🚀 Starting enhanced PPT generation...');
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`📊 Slides: ${slideCount}`);
    console.log(`🎨 Theme: ${theme}`);
    console.log(`🖼️ Images: ${includeImages ? 'Yes' : 'No'} ${generateAIImages ? '(AI Generated)' : ''}`);
    console.log(`📊 Tables: ${includeTables ? 'Yes' : 'No'}`);

    const content = await generatePresentationContent(
      prompt,
      slideCount,
      includeImages,
      includeTables
    );

    console.log('🎉🚀🚀🚀🚀 content generated successfully!', content);
    
    const result = await createEnhancedPresentation(
      content,
      outputPath,
      theme,
      generateAIImages && includeImages
    );

    console.log('🎉 Enhanced presentation generated successfully!');
    return {
      success: true,
      filePath: result,
      slides: content.length,
      hasImages: includeImages,
      hasTables: includeTables,
      message: 'Enhanced presentation generated successfully',
    };
  } catch (error) {
    console.error('💥 Failed to generate enhanced presentation:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to generate enhanced presentation',
    };
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  generateEnhancedPPT,
  generatePresentationContent,
  generateWithFallback,
  createEnhancedPresentation,
  addSlideContent,
  addTwoColumnLayout,
  addTextContent,
  addImageToSlide,
  addTableToSlide,
  handleImageSource,
  generateAIImage,
  delay,
};
