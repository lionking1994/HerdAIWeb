const pool = require("../config/database");
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

exports.getResearchContentByIds = async (req, res) => {
    const { ids } = req.body;
    try {
        const researchQueryResult = await pool.query("SELECT * FROM research_requests WHERE id = ANY($1)", [ids]);

        // Process all research files in parallel
        const researchContentWithFiles = await Promise.all(
            researchQueryResult.rows.map(async (item) => {
                const { request_id } = item;
                try {
                    // Read DOCX file using mammoth
                    const filePath = path.join(__dirname, `../public/files/research-${request_id}.docx`);
                    const buffer = await fs.readFile(filePath);
                    const result = await mammoth.extractRawText({ buffer });

                    return {
                        id: item.id,
                        researchFile: result.value
                    };
                } catch (fileError) {
                    console.error(`Error reading file for request_id ${request_id}:`, fileError);
                    return {
                        id: item.id,
                        researchFile: 'Error reading file content'
                    };
                }
            })
        );

        res.status(200).json({
            success: true,
            researchContent: researchContentWithFiles
        });
    } catch (error) {
        console.error('Error fetching research content:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching research content'
        });
    }
}