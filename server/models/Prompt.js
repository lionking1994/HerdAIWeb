const pool = require("../config/database");

class Prompt {
  static async update(prompt_title, prompt_content, modelId, maxtokens) {
    const promptQuery =
      "UPDATE prompts SET prompt_content = $2, model = $3, maxtokens = $4 WHERE prompt_title = $1 RETURNING *";
    const promptResult = await pool.query(promptQuery, [
      prompt_title,
      prompt_content,
      modelId,
      maxtokens,
    ]);
    return promptResult.rows[0];
  }
  static async get(prompt_title) {
    const promptQuery = `
        SELECT 
          pr.id,
          pr.prompt_title,
          pr.prompt_content,
          pr.maxtokens,
          mo.model,
          mo.id as modelid,
          ap.api_key,
          ap.provider
      FROM prompts pr 
          INNER JOIN api_config_models mo ON mo."id" = pr.model 
        INNER JOIN api_configurations ap ON ap."id" = mo.config_id
      WHERE
          pr.prompt_title = $1 
      GROUP BY
          pr.id,
          pr.prompt_title,
          pr.prompt_content,
          mo.model,
          mo.id,
          ap.api_key,
          ap.provider`;
    const promptResult = await pool.query(promptQuery, [prompt_title]);
    return {
      promptTitle: promptResult.rows[0].prompt_title,
      promptContent: promptResult.rows[0].prompt_content,
      model: promptResult.rows[0].model,
      modelId: promptResult.rows[0].modelid,
      maxtokens: promptResult.rows[0].maxtokens,
      apiKey: promptResult.rows[0].api_key,
      provider: promptResult.rows[0].provider,
    };
  }
}

module.exports = Prompt;
