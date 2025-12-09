const fs = require('fs');
const path = require('path');
const axios = require('axios');
const pool = require('../config/database');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue =
    typeof value === 'string' ? value : JSON.stringify(value);
  const needsQuoting = /[",\n]/.test(stringValue);
  const escaped = stringValue.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

function convertObjectsToCSV(arrayData) {
  const headersSet = new Set();
  arrayData.forEach(item => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      Object.keys(item).forEach(key => headersSet.add(key));
    }
  });

  const headers = Array.from(headersSet);
  if (headers.length === 0) {
    return convertTextToCSV(JSON.stringify(arrayData, null, 2));
  }

  const rows = arrayData.map(item =>
    headers.map(header => sanitizeValue(item ? item[header] : ''))
  );

  return [headers.map(sanitizeValue).join(','), ...rows.map(row => row.join(','))].join('\n');
}

function convertTextToCSV(text) {
  const lines = (text || '').toString().split(/\r?\n/);
  const csvLines = ['value', ...lines.map(line => sanitizeValue(line))];
  return csvLines.join('\n');
}

function tryParseJson(content) {
  try {
    return JSON.parse(content);
  } catch (err) {
    return null;
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
  if (rows.length === 0 || !rows[0].api_key) {
    throw new Error("OpenAI API key not found for CSV generation.");
  }
  return rows[0].api_key;
}

async function generateStructuredTable(content) {
  try {
    const API_KEY = await getOpenAIKey();
    const systemPrompt = `You are a senior data analyst specializing in turning unstructured notes into clean tables ready for CSV export.

Guidelines:
- Analyze the provided content and infer the most informative columns (max 8).
- Produce consistent column names across all rows.
- Summaries should be concise; include numeric values where relevant.
- Output ONLY valid JSON: an array of row objects. No markdown.`;

    const payload = {
      model: 'gpt-4.1',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Transform the following content into a structured table:\n${content}\nReturn only JSON.`
        },
      ],
    };

    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    let structured = response.data.choices?.[0]?.message?.content?.trim();
    if (!structured) {
      return null;
    }
    if (structured.startsWith('```')) {
      structured = structured.replace(/```json\s*|\s*```/g, '');
    }

    const parsed = JSON.parse(structured);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.rows)) {
      return parsed.rows;
    }
    return null;
  } catch (error) {
    console.error('Failed to generate structured table:', error.message);
    return null;
  }
}

async function generateCSVFile(content, options = {}) {
  const {
    outputPath = 'public/csv/output.csv',
  } = options;

  try {
    if (!content) {
      throw new Error('No content provided to generate CSV.');
    }

    let csvString;

    const structuredFromAI = await generateStructuredTable(content);
    console.log("-----generateCSVFile----1----", structuredFromAI);
    if (structuredFromAI && Array.isArray(structuredFromAI) && structuredFromAI.length > 0) {
      csvString = convertObjectsToCSV(structuredFromAI);
    } else {
      const parsed = typeof content === 'string' ? tryParseJson(content) : content;
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(item => item && typeof item === 'object' && !Array.isArray(item))
      ) {
        csvString = convertObjectsToCSV(parsed);
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        csvString = convertObjectsToCSV([parsed]);
      } else {
        const textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        csvString = convertTextToCSV(textContent);
      }
    }

    const dir = path.dirname(outputPath);
    ensureDirectory(dir);
    await fs.promises.writeFile(outputPath, csvString, 'utf8');

    return {
      success: true,
      filePath: outputPath,
      csvContent: csvString,
      message: 'CSV generated successfully',
    };
  } catch (error) {
    console.error('Error generating CSV:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to generate CSV',
    };
  }
}

module.exports = {
  generateCSVFile,
};

