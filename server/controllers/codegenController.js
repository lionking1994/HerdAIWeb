const axios = require('axios');
const pool = require('../config/database');

const CODEGEN_API_URL = 'https://codegen-sh--rest-api.modal.run/v1';
const CODEGEN_API_KEY = 'sk-da2e3732-ecb2-4b1b-a135-59cdfa6626bd';

exports.startCodegen = async (req, res) => {
  try {
    const { feedback } = req.body;
    const prompt = `Please generate code and create a PR in HerdAIWeb for this feedback:
    Path: ${feedback.url}
    Subject: ${feedback.subject}
    Details: ${feedback.details}

    To confirm your PR, you should return the PR link in the response. Response shouldn't include other text than PR link.
    `;
    // const prompt = `Feedback:
    // Path: ${feedback.url}
    // Subject: ${feedback.subject}
    // Details: ${feedback.details}

    // Please generate code for the feedback in HerdAIWeb repository and make Pull Request.

    // To confirm your PR, you should return the PR link in the response. Response shouldn't include other text than PR link.
    // `;

    const response = await axios.post(
      `${CODEGEN_API_URL}/organizations/540/agent/run`,
      { prompt },
      {
        headers: {
          'Authorization': `Bearer ${CODEGEN_API_KEY}`
        }
      }
    );

    res.json({ taskId: response.data.id });
  } catch (error) {
    console.error('Error starting codegen:', error);
    res.status(500).json({ error: 'Failed to start code generation' });
  }
};

exports.checkStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { feedbackId } = req.query;

    const response = await axios.get(
      `${CODEGEN_API_URL}/organizations/540/agent/run/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${CODEGEN_API_KEY}`
        }
      }
    );

    // return res.json({ status: 'COMPLETE' });

    // // If status is COMPLETE and we have a result, update the feedback table
    // if (response.data.status === 'COMPLETE' && response.data.result) {
    //   await pool.query(
    //     'UPDATE feedback SET pr_link = $1 WHERE id = $2',
    //     [response.data.result, feedbackId]
    //   );
    // }

    // // If status is COMPLETE but no PR link yet, consider it still active
    // if (response.data.status === 'COMPLETE' && !response.data.result) {
    //   return res.json({ status: 'ACTIVE' });
    // }

    if (response?.data?.status === 'COMPLETE') {
      const prLink = response.data?.result;
      if (prLink) {
        const prLinkMatch = prLink?.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/)?.[0] || '';
        await pool.query(
          'UPDATE feedback SET status = $1, pr_link = $2 WHERE id = $3',
          ['pr ready', prLinkMatch, feedbackId]
        );
      }
    }
    else {
      return res.json({ status: 'ACTIVE' });
    }

    return res.json(response.data);
  } catch (error) {
    console.error('Error checking codegen status:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
}; 