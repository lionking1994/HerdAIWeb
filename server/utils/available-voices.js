const axios = require('axios');

var availableVoices = [];

const fetchAvailableVoices = async () => {
    try {
        const response = await axios.get(
            'https://api.elevenlabs.io/v1/voices',
            {
                headers: {
                    'xi-api-key': process.env.ELEVENLABS_API_KEY
                }
            }
        );
        const englishVoices = response.data.voices.filter(voice =>
            voice.labels?.language === 'en' ||
            voice.fine_tuning?.language === 'en' ||
            voice.verified_languages?.some(lang => lang.language === 'en')
        )
        availableVoices = englishVoices;
        return englishVoices;
    } catch (error) {
        console.log(error);
        return [];
    }
}

const getAvailableVoicesVar = () => {
    return availableVoices;
}

exports.fetchAvailableVoices = fetchAvailableVoices;
exports.getAvailableVoicesVar = getAvailableVoicesVar;