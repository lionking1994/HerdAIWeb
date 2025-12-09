const pool = require("../config/database");
const dotenv = require('dotenv');
const { sendEmail } = require('../utils/email');
dotenv.config();

exports.sendContactMessage = async (req, res) => {
    const { username, useremail, usermessage } = req.body;
    try {
        const html = `
            <h1>Contact Message from ${username}</h1>
            <p>Email: ${useremail}</p>
            <p>Message: ${usermessage}</p>
        `;
        await sendEmail({ to: 'light.dev930405@gmail.com', subject: 'New Contact Message', html });
        res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create task'
        });
    }
};