const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
// const removeMarkdown = require("remove-markdown");
const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const pool = require("../config/database");
const { generateEnhancedPPT } = require("./ppt-generator-enhanced");
const { generateCSVFile } = require("./csvGenerator");
const { generateDiagramSVG } = require("./diagramGenerator");
const bedrock = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function generatebyPerplexity(
  API_KEY,
  sysprompt,
  userprompt,
  max_tokens,
  model = "sonar-pro"
) {
  const url = "https://api.perplexity.ai/chat/completions";

  const payload = {
    model: model, //-deep-research or your preferred model
    messages: [
      {
        role: "system",
        content: sysprompt,
      },
      {
        role: "user",
        content: userprompt,
      },
    ],
    max_tokens: max_tokens, // Adjust as needed
    temperature: 0.2,
    top_p: 0.9,
    // add other parameters if needed
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = response.data;

    if (data.choices && data.choices.length > 0) {
      let report = data.choices[0].message.content;

      return report;
    } else {
      console.error("No response from API:", data);
      return "No response from API";
    }
  } catch (err) {
    console.error("Error fetching from Perplexity API:", err);
    return "Error fetching from Perplexity API";
  }
}

async function verifyApiToken(API_KEY) {
  const url = "https://api.perplexity.ai/chat/completions";

  const payload = {
    model: "sonar-pro",
    messages: [
      {
        role: "system",
        content: "Test",
      },
      {
        role: "user",
        content: "Test message",
      },
    ],
    max_tokens: 5,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    // If you get a successful response, the token is valid
    console.log("API token is valid.");
    return { status: true };
  } catch (err) {
    if (err.response) {
      // API responded with an error
      if (err.response.status === 401) {
        console.log("Invalid or expired API token.");
        return { status: false, message: "Invalid or expired API token." };
      } else {
        console.log("API error:", err.response.data);
        return { status: false, message: "API error." };
      }
    } else {
      // Network or other error
      console.error("Error:", err.message);
      return { status: false, message: "Error." };
    }
  }
}

async function generatebyClaude(sysprompt, userprompt, max_tokens) {
  // const params = {
  //   modelId: "anthropic.claude-v2",
  //   contentType: "application/json",
  //   accept: "application/json",
  //   body: JSON.stringify({
  //     prompt: `\n\nHuman: ${sysprompt} ${userprompt}\n\nAssistant:`,
  //     max_tokens_to_sample: max_tokens,
  //     temperature: 0.7,
  //     top_k: 250,
  //     top_p: 1,
  //     // anthropic_version: "bedrock-2023-05-31",
  //   }),
  // };

  const params = {
    modelId: 'global.anthropic.claude-sonnet-4-20250514-v1:0',
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: max_tokens,
      temperature: 1, // Sampling temperature for creativity
      top_k: 250, // Top-k sampling
      top_p: 1, // Top-p sampling
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: `\n\nHuman: ${sysprompt} ${userprompt}\n\nAssistant:` }]
        }
      ]
    })
  };

  try {
    const command = new InvokeModelCommand(params);
    const response = await bedrock.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log(`response=======================`, responseBody);
    return responseBody.content[0].text.trim();
  } catch (error) {
    // Handle the error appropriately
    console.error("Error generating response:", error);
    // You can return a default message or rethrow the error
    return "Sorry, an error occurred while generating the response.";
    // or throw error; // if you want to propagate the error
  }
}

async function generatebyGPT(sysprompt, userprompt, max_tokens, model = "gpt-4") {
  try {
    // Get API key from environment or database
    let API_KEY = process.env.OPENAI_API_KEY;
    
    // If not in environment, try to get from database
    if (!API_KEY) {
      const { rows } = await pool.query(
        "SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1",
        ["openai"]
      );
      
      if (rows.length === 0 || !rows[0].api_key) {
        throw new Error("OpenAI API key not found");
      }
      
      API_KEY = rows[0].api_key;
    }

    const url = "https://api.openai.com/v1/chat/completions";
    
    // Check if model requires max_completion_tokens instead of max_tokens
    // GPT-5.1 and newer models use max_completion_tokens
    const modelsRequiringMaxCompletionTokens = ['gpt-5.1', 'gpt-5', 'o1', 'o1-preview', 'o1-mini'];
    const useMaxCompletionTokens = modelsRequiringMaxCompletionTokens.some(m => model.toLowerCase().includes(m.toLowerCase()));
    
    const payload = {
      model: model, // gpt-5.1, gpt-5, gpt-4, gpt-4-turbo, gpt-3.5-turbo, etc.
      messages: [
        {
          role: "system",
          content: sysprompt,
        },
        {
          role: "user",
          content: userprompt,
        },
      ],
      temperature: 0.7,
      top_p: 1,
    };
    
    // Use the appropriate parameter based on model
    if (useMaxCompletionTokens) {
      payload.max_completion_tokens = max_tokens;
    } else {
      payload.max_tokens = max_tokens;
    }

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = response.data;

    if (data.choices && data.choices.length > 0) {
      const result = data.choices[0].message.content;
      return result;
    } else {
      console.error("No response from OpenAI API:", data);
      return "No response from OpenAI API";
    }
  } catch (err) {
    console.error("Error fetching from OpenAI API:", err);
    
    // Return more specific error messages
    if (err.response) {
      if (err.response.status === 401) {
        return "Error: Invalid OpenAI API key";
      } else if (err.response.status === 429) {
        return "Error: Rate limit exceeded. Please try again later";
      } else {
        return `Error: ${err.response.status} - ${err.response.data?.error?.message || "API request failed"}`;
      }
    }
    
    return `Error fetching from OpenAI API: ${err.message}`;
  }
}

async function test_prompt(sysprompt, userprompt, maxtokens, api, model) {
  try {
    let response;
    switch (api) {
      case "claude":
      case "anthropic":
        response = await generatebyClaude(
          sysprompt,
          userprompt,
          parseInt(maxtokens)
        );
        return {
          status: true,
          preview: response,
          message: "preview success!",
        };
      case "openai":
        // Get API key from database if not in env
        let apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          const { rows } = await pool.query(
            "SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1",
            ["openai"]
          );

          if (rows.length === 0) {
            return {
              status: false,
              error: "OpenAI API key not found",
              message: "preview failed.",
            };
          }
          apiKey = rows[0].api_key;
        }

        response = await generatebyGPT(
          sysprompt,
          userprompt,
          parseInt(maxtokens),
          model || "gpt-4"
        );
        return {
          status: true,
          preview: response,
          message: "preview success!",
        };
      case "perplexity":
        // Get API key from database
        const { rows } = await pool.query(
          "SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1",
          ["perplexity"]
        );

        if (rows.length === 0) {
          return {
            status: false,
            error: "Perplexity API key not found",
            message: "preview failed.",
          };
        }

        response = await generatebyPerplexity(
          rows[0].api_key,
          sysprompt,
          userprompt,
          parseInt(maxtokens),
          model
        );
        return {
          status: true,
          preview: response,
          message: "preview success!",
        };
      default:
        return {
          status: false,
          error: "Invalid API",
          message: "preview failed.",
        };
    }
  } catch (error) {
    return {
      status: false,
      error: error.message,
      message: "preview failed.",
    };
  }
}

async function processAI(sysprompt, userprompt, max_tokens) {
  try {
    // Get all API configurations
    const { rows: apiConfigs } = await pool.query(
      "SELECT * FROM api_configurations"
    );

    // If no configurations exist, use Claude as default
    if (apiConfigs.length === 0) {
      console.log("No API configurations found, using Claude as default");
      return await generatebyClaude(sysprompt, userprompt, max_tokens);
    }

    // For now, just use the first configuration
    // In the future, you could implement a strategy to choose between multiple configurations
    const config = apiConfigs[0];

    let result;
    switch (config.provider) {
      case "openai":
        console.log(`Using OpenAI GPT model with config: ${config.name}`);
        // Default to gpt-4 if no model specified
        result = await generatebyGPT(sysprompt, userprompt, max_tokens, "gpt-4");
        break;
      case "claude":
      case "anthropic":
        console.log(`Using Claude model with config: ${config.name}`);
        result = await generatebyClaude(sysprompt, userprompt, max_tokens);
        break;
      case "perplexity":
        console.log(`Using Perplexity model with config: ${config.name}`);
        result = await generatebyPerplexity(
          config.api_key,
          sysprompt,
          userprompt,
          max_tokens
        );
        break;
      default:
        // Handle unknown model case
        console.warn(`Unknown model: ${config.provider}, defaulting to Claude`);
        result = await generatebyClaude(sysprompt, userprompt, max_tokens);
        break;
    }
    return result;
  } catch (error) {
    // Handle errors during database query or model generation
    console.error("Error in processAI:", error);
    // You can return a default response or propagate the error
    return "Sorry, an error occurred while processing your request.";
  }
}
//Need image generation model support such as dall-e, midjourney, etc.

async function generatebyDallE(sysprompt, userprompt, max_tokens) {
  const url = "https://api.openai.com/v1/images/generations";
  const payload = {
    model: "dall-e-3",
    prompt: userprompt,
    n: 1,
    size: "1024x1024",
  };
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
  });
  console.log("🤡🤡🤡🤡DallE Response:", response.data);
  return response.data.data[0].url;
}

async function processAIWithModel(sysprompt, userprompt, max_tokens, provider, model, output_type = 'txt') {
  try {
    let result, resultType;
    switch (provider) {
      case "openai":
        switch (model) {
          case "dalle-3":
          case "dall-e-3":
          case "dall-e":
            result = await generatebyDallE(sysprompt, userprompt, max_tokens);
            resultType = 'image';
            break;
          case "gpt-5.1":
          case "gpt-5":
          case "gpt-4":
          case "gpt-4o":
          case "gpt-4-turbo":
          case "gpt-3.5-turbo":
            result = await generatebyGPT(sysprompt, userprompt, max_tokens, model);
            resultType = 'text';
            console.log("@@@@@@@@@@@@@@@@@@@@@#############!@312312312", result);
            break;
          default:
            // Default to gpt-4 if model not recognized
            result = await generatebyGPT(sysprompt, userprompt, max_tokens, "gpt-4");
            resultType = 'text';
            break;
        }
        break;
      case "anthropic":
        // Handle Claude models
        result = await generatebyClaude(sysprompt, userprompt, max_tokens);
        resultType = 'text';
        break;
      case "perplexity":
        // Get API key from database
        const { rows } = await pool.query(
          "SELECT api_key FROM api_configurations WHERE provider = $1 LIMIT 1",
          ["perplexity"]
        );

        if (rows.length === 0 || !rows[0].api_key) {
          throw new Error("Perplexity API key not found");
        }

        result = await generatebyPerplexity(
          rows[0].api_key,
          sysprompt,
          userprompt,
          max_tokens,
          model || "sonar-pro"
        );
        resultType = 'text';
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    console.log('----------result-------', result);
    if(output_type == 'ppt')
    {
      const ppt_result = await generateEnhancedPPT(result, {outputPath: `public/presentations/${uuidv4()}-output.pptx`});
      console.log('----------test ppt-------', JSON.stringify(ppt_result));
      if(ppt_result.success) {
        // Convert file path to download URL
        const fileName = ppt_result.filePath.replace('public/presentations/', '');
        const downloadUrl = `/presentations/${fileName}`;
        console.log('----------ppt_result-------', downloadUrl);
        return {result: downloadUrl, resultType: output_type, filePath: ppt_result.filePath, content: result};
      }
      return {result, resultType};
    }
    if(output_type == 'csv')
    {
      const csv_result = await generateCSVFile(result, {outputPath: `public/csv/${uuidv4()}-output.csv`});
      console.log('----------test csv-------', JSON.stringify(csv_result));
      if(csv_result.success) {
        const fileName = csv_result.filePath.replace('public/csv/', '');
        const downloadUrl = `/csv/${fileName}`;
        return {result: downloadUrl, resultType: output_type, filePath: csv_result.filePath, content: csv_result.csvContent};
      }
      return {result, resultType};
    }
    const modelName = model?.toLowerCase?.() || '';
    const isNativeImageModel = provider === 'openai' && modelName.includes('dall-e');
    if(output_type === 'img' && !isNativeImageModel)
    {
      const diagramSource = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      const diagramId = uuidv4();
      const diagram_result = await generateDiagramSVG(userprompt, {
        outputPath: `public/diagrams/${diagramId}-diagram.svg`,
        pngOutputPath: `public/diagrams/${diagramId}-diagram.png`,
      });
      console.log('----------diagram_result-------', JSON.stringify(diagram_result));
      if(diagram_result.success) {
        const preferredPath = diagram_result.pngPath || diagram_result.filePath;
        const fileName = preferredPath.replace('public/diagrams/', '');
        const downloadUrl = `/diagrams/${fileName}`;
        return {
          result: downloadUrl,
          resultType: 'image',
          filePath: preferredPath,
          content: result,
          svgPath: diagram_result.filePath,
        };
      }
      return {result, resultType};
    }
    return {result, resultType};
  } catch (error) {
    console.error("Error in processAIWithModel:", error);
    return `Sorry, an error occurred while processing your request: ${error.message}`;
  }
}

async function outputType1(prompt) {
  // const { prompt } = req.body;
  try {
    const system_prompt = 
    `we have to analysis the output type such as : pdf, ppt, txt, img, csv.  
     Provide answer only one of these word. 
     Sample : pdf`;
     const maxTokens = 4000;
    console.log("prompt", prompt)
    const aiResponse = await processAIWithModel(
      system_prompt,
      prompt,
      maxTokens,
      'openai',
      'gpt-4'
    );
    console.log("----------", aiResponse);
    // aiResponse can be either an object {result, resultType} or an error string
    if (typeof aiResponse === "string") {
      return { success: false, error: aiResponse };
    }

    switch(aiResponse.result)
    {
      case 'pdf':
      case 'ppt':
      case 'txt':
      case 'img':
      case 'csv':
      return { success: true, ...aiResponse };

    }

    } catch (error) {
      console.error("Error Output type:", error);
      return { success: false, error: "Failed to Output type" };
    }
};


module.exports = {
  generatebyPerplexity,
  generatebyGPT,
  generatebyClaude,
  generatebyDallE,
  verifyApiToken,
  processAI,
  test_prompt,
  processAIWithModel,
  outputType1,
};
