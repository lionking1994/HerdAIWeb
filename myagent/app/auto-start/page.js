'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { motion } from 'framer-motion'
import VoiceAssistant from '../../components/VoiceAssistant'
import { Conversation } from '@11labs/client'
import { getSignedUrl } from '@/app/actions/getSignedUrl'

// Avatar component for when avatar URL is provided
function AvatarAssistant({ autoStartData, avatarUrl }) {
  const [conversation, setConversation] = useState(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [autoStartError, setAutoStartError] = useState(null)
  const [availableVoices, setAvailableVoices] = useState([])

  // Fetch available voices from ElevenLabs
  const fetchVoices = async () => {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const englishVoices = data.voices.filter(voice => 
        voice.labels?.language === 'en' || 
        voice.fine_tuning?.language === 'en' ||
        voice.verified_languages?.some(lang => lang.language === 'en')
      )
      
      setAvailableVoices(englishVoices)
      
      // Auto-start conversation after voices are loaded
      if (englishVoices.length > 0) {
        handleAutoStart(englishVoices)
      }
      
    } catch (error) {
      console.error('Error fetching voices:', error)
      setAutoStartError('Failed to load voices. Please try again.')
    }
  }

  // Load voices on component mount
  useEffect(() => {
    fetchVoices()
  }, [])

  const handleAutoStart = async (voices) => {
    try {
      // Validate voice ID
      const voice = voices.find(v => v.voice_id === autoStartData.voice_id)
      if (!voice) {
        setAutoStartError(`Voice ID "${autoStartData.voice_id}" not found. Please use a valid voice ID.`)
        return
      }

      // Start conversation automatically
      setTimeout(() => {
        startConversationWithData(autoStartData, voice)
      }, 1000)
      
    } catch (error) {
      console.error('Auto-start error:', error)
      setAutoStartError('Failed to auto-start conversation. Please try again.')
    }
  }

  // Function to fetch meeting attendees
  const fetchMeetingAttendees = async (meetingId) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_TOOLS_SERVER_HOST}/get-attendees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_TOOLS_API_KEY || 'your-secret-api-key-here'
        },
        body: JSON.stringify({
          meeting_id: meetingId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.attendees || [];
    } catch (error) {
      console.error('Error fetching meeting attendees:', error);
      return [];
    }
  };

  // Function to fetch user profile information
  const fetchUserProfile = async (userId) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_TOOLS_SERVER_HOST}/get-user-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_TOOLS_API_KEY || 'your-secret-api-key-here'
        },
        body: JSON.stringify({
          user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.user || null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Function to fetch company users (teammates)
  const fetchCompanyUsers = async (userEmail) => {
    try {
      if (!userEmail || !userEmail.includes('@')) {
        console.log('No valid user email provided for fetching teammates');
        return [];
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_TOOLS_SERVER_HOST}/get-company-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_TOOLS_API_KEY || 'your-secret-api-key-here'
        },
        body: JSON.stringify({
          user_email: userEmail
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.company_users || [];
    } catch (error) {
      console.error('Error fetching company users:', error);
      return [];
    }
  };

  // Format meeting attendees for context
  const formatAttendeesForContext = (attendees) => {
    if (!attendees || attendees.length === 0) {
      return "No meeting attendees found.";
    }
    return attendees.map((attendee, index) => {
      const parts = [];
      parts.push(`${index + 1}. ${attendee.name || attendee.email}`);
      if (attendee.id) parts.push(`User ID: ${attendee.id}`);
      if (attendee.role) parts.push(`Role: ${attendee.role}`);
      if (attendee.email && attendee.email !== attendee.name) parts.push(`Email: ${attendee.email}`);
      if (attendee.bio) parts.push(`Bio: ${attendee.bio}`);
      if (attendee.skills) parts.push(`Skills: ${attendee.skills}`);
      if (attendee.location) parts.push(`Location: ${attendee.location}`);
      if (attendee.education) parts.push(`Education: ${attendee.education}`);
      if (attendee.certifications) parts.push(`Certifications: ${attendee.certifications}`);
      if (attendee.projects) parts.push(`Projects: ${attendee.projects}`);
      if (attendee.publications) parts.push(`Publications: ${attendee.publications}`);
      if (attendee.recommendations) parts.push(`Recommendations: ${attendee.recommendations}`);
      if (attendee.phone) parts.push(`Phone: ${attendee.phone}`);
      return parts.join(' | ');
    }).join('\n');
  };

  // Format teammates for context
  const formatTeammatesForContext = (teammates) => {
    if (!teammates || teammates.length === 0) {
      return "No teammates found.";
    }
    return teammates.map((teammate, index) => {
      const parts = [];
      parts.push(`${index + 1}. ${teammate.user_name || teammate.user_email}`);
      parts.push(`User ID: ${teammate.user_id}`);
      if (teammate.user_email && teammate.user_email !== teammate.user_name) {
        parts.push(`Email: ${teammate.user_email}`);
      }
      return parts.join(' | ');
    }).join('\n');
  };

  // Format user profile for context
  const formatUserProfileForContext = (userProfile) => {
    if (!userProfile) {
      return "No user profile information found.";
    }
    
    const parts = [];
    if (userProfile.name) parts.push(`Name: ${userProfile.name}`);
    if (userProfile.email) parts.push(`Email: ${userProfile.email}`);
    if (userProfile.role) parts.push(`Role: ${userProfile.role}`);
    if (userProfile.bio) parts.push(`Bio: ${userProfile.bio}`);
    if (userProfile.skills) parts.push(`Skills: ${userProfile.skills}`);
    if (userProfile.location) parts.push(`Location: ${userProfile.location}`);
    if (userProfile.education) parts.push(`Education: ${userProfile.education}`);
    if (userProfile.certifications) parts.push(`Certifications: ${userProfile.certifications}`);
    if (userProfile.projects) parts.push(`Projects: ${userProfile.projects}`);
    if (userProfile.publications) parts.push(`Publications: ${userProfile.publications}`);
    if (userProfile.recommendations) parts.push(`Recommendations: ${userProfile.recommendations}`);
    if (userProfile.phone) parts.push(`Phone: ${userProfile.phone}`);
    
    return parts.length > 0 ? parts.join(' | ') : "No detailed profile information available.";
  };

  const startConversationWithData = async (data, voice) => {
    try {
      // Get signed URL using server action
      const { signedUrl } = await getSignedUrl()
      if (!signedUrl) {
        throw new Error('Failed to get signed URL')
      }
      
      // Fetch research documents
      const researchResponse = await fetch(`${process.env.NEXT_PUBLIC_TOOLS_SERVER_HOST}/get-research-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_TOOLS_API_KEY || 'your-secret-api-key-here'
        },
        body: JSON.stringify({
          user_id: data.user_id
        })
      });

      const researchData = await researchResponse.json();
      const researchDocuments = researchData.documents;

      // Format research documents for context
      const researchContext = researchDocuments.length > 0
        ? researchDocuments.map((doc, index) => 
            `${index + 1}. Topic of research: "${doc.title}" (ID: ${doc.id})`
          ).join('\n')
        : "No research document";

      // Fetch meeting attendees if meeting_id is provided
      let meetingAttendeesContext = "Not found meeting attendees information.";
      if (data.meeting_id) {
        const attendees = await fetchMeetingAttendees(data.meeting_id);
        meetingAttendeesContext = formatAttendeesForContext(attendees);
      } else {
        // If no meeting_id, fetch user profile and use it as meeting attendees
        const userProfile = await fetchUserProfile(data.user_id);
        if (userProfile) {
          // Format user profile as a single attendee
          const userAsAttendee = [{
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email,
            role: userProfile.role,
            bio: userProfile.bio,
            skills: userProfile.skills,
            location: userProfile.location,
            education: userProfile.education,
            certifications: userProfile.certifications,
            projects: userProfile.projects,
            publications: userProfile.publications,
            recommendations: userProfile.recommendations,
            phone: userProfile.phone
          }];
          meetingAttendeesContext = formatAttendeesForContext(userAsAttendee);
        }
      }

      // Fetch related meetings
      const meetings = await fetchRelatedMeetings(data.user_id, data.topics, 15)
      const formattedMeetings = formatMeetingsForContext(meetings)

      // Fetch teammates
      const teammates = await fetchCompanyUsers(data.user_email)
      const teammatesContext = formatTeammatesForContext(teammates)
      
      // Create conversation with dynamic variables including research documents
      const conv = await Conversation.startSession({
        signedUrl,
        dynamicVariables: {
          user_name: data.user_name,
          user_id: data.user_id,
          user_email: data.user_email || '',
          agent_name: data.agent_name || '',
          meeting_id: data.meeting_id || '',
          token: data.token || '',
          agent_meeting_id: data.agent_meeting_id || '',
          topics: data.topics,
          intro: data.intro || '',
          previous_meetings: formattedMeetings,
          meetings_count: meetings.length.toString(),
          current_time: `${new Date().toUTCString()} - time now in UTC`,
          research_documents: researchContext,
          meeting_attendees: meetingAttendeesContext,
          teammates: teammatesContext,
          // Salesforce credentials
          sf_username: data.sf_username || '',
          sf_password: data.sf_password || '',
          sf_security_token: data.sf_security_token || '',
          sf_is_sandbox: data.sf_is_sandbox || false,
        },
        overrides: {
          tts: {
            voiceId: data.voice_id
          }
        },
        onMessage: (message) => {
          // We don't need to store messages since we're not showing chat
        },
        onError: (error) => {
          console.error('Conversation error:', error)
          setAutoStartError('Conversation error occurred. Please try again.')
        },
        onStatusChange: (status) => {
          // We don't need to show connection status
        },
        onModeChange: (mode) => {
          setIsSpeaking(mode.mode === 'speaking')
        },
      })
      setConversation(conv)
      setIsActive(true)
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setAutoStartError('Failed to start conversation. Please try again.')
    }
  }

  // Function to fetch related meetings from tools server
  const fetchRelatedMeetings = async (userId, query, topK = 15) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_TOOLS_SERVER_HOST}/search-meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.NEXT_PUBLIC_TOOLS_API_KEY || 'your-secret-api-key-here'
        },
        body: JSON.stringify({
          user_id: userId,
          query: query,
          top_k: topK
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        return data.meetings
      } else {
        console.error('Failed to fetch meetings:', data)
        return []
      }
    } catch (error) {
      console.error('Error fetching related meetings:', error)
      return []
    }
  }

  // Format meetings for the conversation context
  const formatMeetingsForContext = (meetings) => {
    if (!meetings || meetings.length === 0) {
      return "No previous related meetings found."
    }

    return meetings.map((meeting, index) => {
      const date = new Date(meeting.datetime).toLocaleString()
      return `<meeting_${index + 1}>
      <meeting_id>${meeting.meeting_id}</meeting_id>
      <title>${meeting.title}</title>
      <date>${date}</date>
      <summary>${meeting.summary}</summary>
      <similarity_score>${meeting.similarity_score}</similarity_score>
      </meeting_${index + 1}>`
    }).join('\n\n')
  }

  if (autoStartError) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-[#252422] p-4'>
        <div className='max-w-md text-center'>
          <h1 className='text-[#eb5e28] text-2xl font-bold mb-4'>Avatar Assistant Error</h1>
          <p className='text-[#ccc5b9] mb-6'>{autoStartError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-[#252422] flex items-center justify-center p-4'>
      <div className='flex justify-center'>
        <motion.div
          className={`relative rounded-full overflow-hidden transition-all duration-300 ${
            isSpeaking 
              ? 'ring-4 ring-[#eb5e28] ring-opacity-75 shadow-lg shadow-[#eb5e28]/50' 
              : 'ring-2 ring-[#403d39] ring-opacity-50'
          }`}
          style={{ width: '360px', height: '360px' }}
          animate={isSpeaking ? {
            scale: [1, 1.05, 1],
            rotate: [0, 1, -1, 0]
          } : {
            scale: 1,
            rotate: 0
          }}
          transition={{
            duration: 2,
            repeat: isSpeaking ? Infinity : 0,
            ease: "easeInOut"
          }}
        >
          <img
            src={avatarUrl}
            alt="Voice Assistant Avatar"
            className='w-full h-full object-cover'
            onError={(e) => {
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzYwIiBoZWlnaHQ9IjM2MCIgdmlld0JveD0iMCAwIDM2MCAzNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzNjAiIGhlaWdodD0iMzYwIiBmaWxsPSIjNDAzZDM5Ii8+Cjx0ZXh0IHg9IjE4MCIgeT0iMTkwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjY2NjNWI5IiBmb250LXNpemU9IjI0IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiI+QXZhdGFyPC90ZXh0Pgo8L3N2Zz4K'
            }}
          />
          
          {/* Speaking indicator overlay */}
          {isSpeaking && (
            <motion.div
              className='absolute inset-0 bg-[#eb5e28] bg-opacity-20 rounded-full'
              animate={{
                opacity: [0.2, 0.4, 0.2],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}

function AutoStartContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [autoStartData, setAutoStartData] = useState(null)
  const [error, setError] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)

  useEffect(() => {
    // Extract parameters from URL
    const username = searchParams.get('username')
    const userid = searchParams.get('userid')
    const meeting_topics = searchParams.get('meeting_topics')
    const voiceid = searchParams.get('voiceid')
    const avatar = searchParams.get('avatar')
    const intro = searchParams.get('intro')
    const user_email = searchParams.get('user_email')
    const agent_name = searchParams.get('agent_name')
    const meeting_id = searchParams.get('meeting_id')
    const token = searchParams.get('token') // Add token extraction
    const agent_meeting_id = searchParams.get('agent_meeting_id') // Add agent_meeting_id extraction

    // Salesforce credentials
    const sf_username = searchParams.get('sf_username')
    const sf_password = searchParams.get('sf_password')
    const sf_security_token = searchParams.get('sf_security_token')
    const sf_is_sandbox = searchParams.get('sf_is_sandbox')

    // Validate required parameters
    if (!username || !userid || !meeting_topics || !voiceid) {
      setError('Missing required parameters. Please provide: username, userid, meeting_topics, and voiceid')
      return
    }

    // Decode URL-encoded parameters
    const decodedTopics = decodeURIComponent(meeting_topics)
    const decodedAvatar = avatar ? decodeURIComponent(avatar) : null
    const decodedIntro = intro ? decodeURIComponent(intro) : ''
    const decodedUserEmail = user_email ? decodeURIComponent(user_email) : ''
    const decodedAgentName = agent_name ? decodeURIComponent(agent_name) : ''
    const decodedMeetingId = meeting_id ? decodeURIComponent(meeting_id) : ''
    const decodedToken = token ? decodeURIComponent(token) : '' // Decode token
    const decodedAgentMeetingId = agent_meeting_id ? decodeURIComponent(agent_meeting_id) : '' // Decode agent_meeting_id
    
    // Decode Salesforce credentials
    const decodedSfUsername = sf_username ? decodeURIComponent(sf_username) : ''
    const decodedSfPassword = sf_password ? decodeURIComponent(sf_password) : ''
    const decodedSfSecurityToken = sf_security_token ? decodeURIComponent(sf_security_token) : ''
    const decodedSfIsSandbox = sf_is_sandbox === 'true'

    // Set auto-start data
    setAutoStartData({
      user_name: username,
      user_id: userid,
      user_email: decodedUserEmail,
      agent_name: decodedAgentName,
      meeting_id: decodedMeetingId,
      topics: decodedTopics,
      intro: decodedIntro,
      voice_id: voiceid,
      token: decodedToken, // Add token to autoStartData
      agent_meeting_id: decodedAgentMeetingId, // Add agent_meeting_id to autoStartData
      // Salesforce credentials
      sf_username: decodedSfUsername,
      sf_password: decodedSfPassword,
      sf_security_token: decodedSfSecurityToken,
      sf_is_sandbox: decodedSfIsSandbox
    })

    // Set avatar URL if provided
    setAvatarUrl(decodedAvatar)
  }, [searchParams])

  if (error) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-[#252422] p-4'>
        <div className='max-w-md text-center'>
          <h1 className='text-[#eb5e28] text-2xl font-bold mb-4'>Auto-Start Error</h1>
          <p className='text-[#ccc5b9] mb-6'>{error}</p>
          <p className='text-[#ccc5b9] text-sm mb-4'>
            Expected URL format: /auto-start?username=YourName&userid=123&meeting_topics=Topic1,Topic2&voiceid=voice_id_here&intro=Introduction&avatar=image_url_here&user_email=user@example.com&agent_name=AgentName&meeting_id=123&token=your_token_here&agent_meeting_id=456&sf_username=sf_user&sf_password=sf_pass&sf_security_token=sf_token&sf_is_sandbox=true
          </p>
          <button
            onClick={() => router.push('/')}
            className='px-4 py-2 bg-[#eb5e28] text-[#fffcf2] rounded-lg hover:bg-[#d44f1f] transition-colors'
          >
            Go to Manual Start
          </button>
        </div>
      </div>
    )
  }

  if (!autoStartData) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center bg-[#252422] p-4'>
        <div className='text-[#ccc5b9]'>Loading...</div>
      </div>
    )
  }

  // Use AvatarAssistant if avatar URL is provided, otherwise use regular VoiceAssistant
  if (avatarUrl) {
    return <AvatarAssistant autoStartData={autoStartData} avatarUrl={avatarUrl} />
  }

  return <VoiceAssistant autoStart={true} autoStartData={autoStartData} />
}

export default function AutoStartPage() {
  return (
    <Suspense fallback={
      <div className='min-h-screen flex flex-col items-center justify-center bg-[#252422] p-4'>
        <div className='text-[#ccc5b9]'>Loading...</div>
      </div>
    }>
      <AutoStartContent />
    </Suspense>
  )
}
