// components/VoiceAssistant.jsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, MessageCircle, Bot, User, Download, Settings, Play, Pause, Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { downloadTranscript } from '@/utils/transcript'
import { Conversation } from '@11labs/client'
import { getSignedUrl } from '@/app/actions/getSignedUrl'

export default function VoiceAssistant({ autoStart = false, autoStartData = null }) {
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [relatedMeetings, setRelatedMeetings] = useState([])
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false)
  const [autoStartError, setAutoStartError] = useState(null)
  
  // Voice selection state
  const [availableVoices, setAvailableVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const [isLoadingVoices, setIsLoadingVoices] = useState(false)
  const [playingPreview, setPlayingPreview] = useState(null)
  
  // Form data state
  const [formData, setFormData] = useState({
    user_name: 'Matt Francis',
    user_id: '66',
    user_email: '',
    agent_name: '',
    meeting_id: '',
    agent_meeting_id: '',
    topics: '1. Onboarding\n2. Investor presentation\n3. More funding options',
    intro: '',
    voice_id: '',
    token: '',
    // Salesforce credentials
    sf_username: '',
    sf_password: '',
    sf_security_token: '',
    sf_is_sandbox: false
  })
  const [formErrors, setFormErrors] = useState({})
  
  const scrollAreaRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  // Fetch available voices from ElevenLabs
  const fetchVoices = async () => {
    try {
      setIsLoadingVoices(true)
      
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Filter for English voices only
      const englishVoices = data.voices.filter(voice => 
        voice.labels?.language === 'en' || 
        voice.fine_tuning?.language === 'en' ||
        voice.verified_languages?.some(lang => lang.language === 'en')
      )
      
      setAvailableVoices(englishVoices)
      
      // Set default voice if none selected
      if (englishVoices.length > 0 && !selectedVoice) {
        const defaultVoice = englishVoices[0]
        setSelectedVoice(defaultVoice)
        setFormData(prev => ({ ...prev, voice_id: defaultVoice.voice_id }))
      }
      
    } catch (error) {
      console.error('Error fetching voices:', error)
    } finally {
      setIsLoadingVoices(false)
    }
  }

  // Load voices on component mount
  useEffect(() => {
    fetchVoices()
  }, [])

  // Auto-start effect
  useEffect(() => {
    if (autoStart && autoStartData && availableVoices.length > 0) {
      handleAutoStart()
    }
  }, [autoStart, autoStartData, availableVoices])

  const handleAutoStart = async () => {
    try {
      // Validate voice ID
      const voice = availableVoices.find(v => v.voice_id === autoStartData.voice_id)
      if (!voice) {
        setAutoStartError(`Voice ID "${autoStartData.voice_id}" not found. Please use a valid voice ID.`)
        return
      }

      // Set form data and selected voice
      setFormData(autoStartData)
      setSelectedVoice(voice)
      
      // Start conversation automatically
      setTimeout(() => {
        startConversationWithData(autoStartData, voice)
      }, 1000) // Small delay to ensure everything is set up
      
    } catch (error) {
      console.error('Auto-start error:', error)
      setAutoStartError('Failed to auto-start conversation. Please try again.')
    }
  }

  const startConversationWithData = async (data, voice) => {
    try {
      setConnectionStatus('connecting')

      // Get signed URL using server action
      const { signedUrl } = await getSignedUrl()
      console.log('signedUrl', signedUrl)
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

      if (!researchResponse.ok) {
        throw new Error(`HTTP error! status: ${researchResponse.status}`);
      }

      const researchData = await researchResponse.json();
      const researchDocuments = researchData.documents;

      // Format research documents for context
      const researchContext = researchDocuments.length > 0
        ? researchDocuments.map((doc, index) => 
            `${index + 1}. Topic of research: "${doc.title}" (ID: ${doc.id})`
          ).join('\n')
        : "No research document";

      // Fetch meeting attendees if meeting_id is provided
      let meetingAttendeesContext = "No meeting attendees information.";
      if (data.meeting_id) {
        console.log('Fetching meeting attendees...')
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
      console.log('Fetching related meetings...')
      const meetings = await fetchRelatedMeetings(data.user_id, data.topics, 15)
      const formattedMeetings = formatMeetingsForContext(meetings)
      console.log('formattedMeetings', formattedMeetings)

      // Fetch teammates
      console.log('Fetching teammates...')
      const teammates = await fetchCompanyUsers(data.user_email)
      const teammatesContext = formatTeammatesForContext(teammates)
      console.log('Teammates found:', teammates.length)
      
      console.log('Auto-start data:', data);
      console.log('Related meetings found:', meetings.length);
      console.log(researchContext);
      
      // Create conversation with dynamic variables including research documents
      const conv = await Conversation.startSession({
        signedUrl,
        dynamicVariables: {
          user_name: data.user_name,
          user_id: data.user_id,
          user_email: data.user_email || '',
          agent_name: data.agent_name || '',
          meeting_id: data.meeting_id || '',
          agent_meeting_id: data.agent_meeting_id || '',
          token: data.token || '',
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
          console.log('message', message)
          setMessages((prev) => [
            ...prev,
            {
              source: message.source,
              message: message.message,
            },
          ])
        },
        onError: (error) => {
          console.error('Conversation error:', error)
          setConnectionStatus('disconnected')
        },
        onStatusChange: (status) => {
          console.log('Connection status:', status)
          setConnectionStatus(
            status.status === 'connected' ? 'connected' : 'disconnected'
          )
        },
        onModeChange: (mode) => {
          console.log('mode', mode)
          setIsSpeaking(mode.mode === 'speaking')
        },
      })
      setConversation(conv)
      setIsActive(true)
      setConnectionStatus('connected')
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setConnectionStatus('disconnected')
      setAutoStartError('Failed to start conversation. Please try again.')
    }
  }

  // Play voice preview
  const playVoicePreview = async (voice) => {
    try {
      if (playingPreview === voice.voice_id) {
        // Stop current preview
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        setPlayingPreview(null)
        return
      }

      setPlayingPreview(voice.voice_id)
      
      // Use the preview URL if available
      if (voice.preview_url) {
        if (audioRef.current) {
          audioRef.current.src = voice.preview_url
          audioRef.current.play()
        }
      } else {
        // Generate a quick preview using ElevenLabs TTS API
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}`, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY
          },
          body: JSON.stringify({
            text: "Hello! This is a preview of my voice. How do I sound?",
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5
            }
          })
        })
        
        if (response.ok) {
          const audioBlob = await response.blob()
          const audioUrl = URL.createObjectURL(audioBlob)
          
          if (audioRef.current) {
            audioRef.current.src = audioUrl
            audioRef.current.play()
          }
        }
      }
    } catch (error) {
      console.error('Error playing voice preview:', error)
      setPlayingPreview(null)
    }
  }

  // Handle audio end
  const handleAudioEnd = () => {
    setPlayingPreview(null)
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

  // Function to fetch related meetings from tools server
  const fetchRelatedMeetings = async (userId, query, topK = 15) => {
    try {
      setIsLoadingMeetings(true)
      
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
        setRelatedMeetings(data.meetings)
        return data.meetings
      } else {
        console.error('Failed to fetch meetings:', data)
        return []
      }
    } catch (error) {
      console.error('Error fetching related meetings:', error)
      return []
    } finally {
      setIsLoadingMeetings(false)
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

  const validateForm = () => {
    const errors = {}
    
    if (!formData.user_name.trim()) {
      errors.user_name = 'User name is required'
    }
    
    if (!formData.user_id.trim()) {
      errors.user_id = 'User ID is required'
    } else if (isNaN(Number(formData.user_id))) {
      errors.user_id = 'User ID must be a number'
    }
    
    if (!formData.topics.trim()) {
      errors.topics = 'Topics are required'
    }

    if (!formData.voice_id) {
      errors.voice_id = 'Please select a voice'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      setShowForm(false)
      startConversation()
    }
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleVoiceSelect = (voice) => {
    setSelectedVoice(voice)
    setFormData(prev => ({ ...prev, voice_id: voice.voice_id }))
    // Clear voice error
    if (formErrors.voice_id) {
      setFormErrors(prev => ({ ...prev, voice_id: '' }))
    }
  }

  const startConversation = async () => {
    try {
      setConnectionStatus('connecting')

      // Get signed URL using server action (without voice_id parameter)
      const { signedUrl } = await getSignedUrl()
      console.log('signedUrl', signedUrl)
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
          user_id: formData.user_id
        })
      });

      if (!researchResponse.ok) {
        throw new Error(`HTTP error! status: ${researchResponse.status}`);
      }

      const researchData = await researchResponse.json();
      const researchDocuments = researchData.documents;

      // Format research documents for context
      const researchContext = researchDocuments.length > 0
        ? researchDocuments.map((doc, index) => 
            `${index + 1}. Topic of research: "${doc.title}" (ID: ${doc.id})`
          ).join('\n')
        : "No research document";

      // Fetch meeting attendees if meeting_id is provided
      let meetingAttendeesContext = "No meeting attendees information.";
      if (formData.meeting_id) {
        console.log('Fetching meeting attendees...')
        const attendees = await fetchMeetingAttendees(formData.meeting_id);
        meetingAttendeesContext = formatAttendeesForContext(attendees);
      } else {
        // If no meeting_id, fetch user profile and use it as meeting attendees
        const userProfile = await fetchUserProfile(formData.user_id);
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
      console.log('Fetching related meetings...')
      const meetings = await fetchRelatedMeetings(formData.user_id, formData.topics, 15)
      const formattedMeetings = formatMeetingsForContext(meetings)
      console.log('formattedMeetings', formattedMeetings)

      // Fetch teammates
      console.log('Fetching teammates...')
      const teammates = await fetchCompanyUsers(formData.user_email)
      const teammatesContext = formatTeammatesForContext(teammates)
      console.log('Teammates found:', teammates.length)
      
      console.log('formData', formData);
      console.log('Related meetings found:', meetings.length);
      console.log(researchContext);
      
      // Create conversation with dynamic variables including research documents
      const conv = await Conversation.startSession({
        signedUrl,
        dynamicVariables: {
          user_name: formData.user_name,
          user_id: formData.user_id,
          user_email: formData.user_email || '',
          agent_name: formData.agent_name || '',
          meeting_id: formData.meeting_id || '',
          agent_meeting_id: formData.agent_meeting_id || '',
          token: formData.token || '',
          topics: formData.topics,
          intro: formData.intro || '',
          previous_meetings: formattedMeetings,
          meetings_count: meetings.length.toString(),
          current_time: `${new Date().toUTCString()} - time now in UTC`,
          research_documents: researchContext,
          meeting_attendees: meetingAttendeesContext,
          teammates: teammatesContext,
          // Salesforce credentials
          sf_username: formData.sf_username || '',
          sf_password: formData.sf_password || '',
          sf_security_token: formData.sf_security_token || '',
          sf_is_sandbox: formData.sf_is_sandbox || false
        },
        overrides: {
          tts: {
            voiceId: formData.voice_id  // Set the voice here instead!
          }
        },
        onMessage: (message) => {
          console.log('message', message)
          setMessages((prev) => [
            ...prev,
            {
              source: message.source,
              message: message.message,
            },
          ])
        },
        onError: (error) => {
          console.error('Conversation error:', error)
          setConnectionStatus('disconnected')
        },
        onStatusChange: (status) => {
          console.log('Connection status:', status)
          setConnectionStatus(
            status.status === 'connected' ? 'connected' : 'disconnected'
          )
        },
        onModeChange: (mode) => {
          console.log('mode', mode)
          setIsSpeaking(mode.mode === 'speaking')
        },
      })
      setConversation(conv)
      setIsActive(true)
      setConnectionStatus('connected')
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setConnectionStatus('disconnected')
    }
  }

  const endConversation = async () => {
    if (conversation) {
      await conversation.endSession()
      setConversation(null)
      setIsSpeaking(false)
      setIsActive(false)
      setConnectionStatus('disconnected')
      setRelatedMeetings([])
    }
  }

  const handleStartClick = () => {
    if (isActive) {
      endConversation()
    } else {
      // Check if form data is already filled
      if (!formData.user_name || !formData.user_id || !formData.topics || !formData.voice_id) {
        setShowForm(true)
      } else {
        startConversation()
      }
    }
  }

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-[#252422] p-4'>
      {/* Hidden audio element for voice previews */}
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnd}
        onError={() => setPlayingPreview(null)}
      />
      
      <div className='w-full max-w-xs'>
        {/* Voice Assistant Circle */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className='relative w-48 h-48 mx-auto mb-8 pt-2'
        >
          {/* Status Badge */}
          <div className='absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6'>
            <Badge
              variant='outline'
              className={`
                ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500/20 text-green-500 border-green-500/50'
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
                    : autoStartError
                    ? 'bg-red-500/20 text-red-500 border-red-500/50'
                    : 'bg-red-500/20 text-red-500 border-red-500/50'
                }
                font-medium capitalize
              `}
            >
              {autoStartError ? 'Auto-Start Error' : connectionStatus}
              {isLoadingMeetings && ' (Loading meetings...)'}
              {autoStart && !autoStartError && connectionStatus === 'disconnected' && ' (Auto-Starting...)'}
            </Badge>
          </div>

          {/* Base Circle */}
          <div className='relative w-full h-full'>
            <div
              className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                isActive ? 'bg-[#eb5e28]' : 'bg-[#403d39]'
              }`}
            />
            <div className='absolute inset-[10%] rounded-full bg-[#252422]' />
            {/* Pulse Effects */}
            {isSpeaking && (
              <div className='absolute inset-[15%]'>
                <div className='absolute inset-0 rounded-full bg-[#eb5e28] opacity-20 animate-pulse-fast' />
                <div className='absolute inset-0 rounded-full bg-[#eb5e28] opacity-15 animate-pulse-medium' />
                <div className='absolute inset-0 rounded-full bg-[#eb5e28] opacity-10 animate-pulse-slow' />
              </div>
            )}
          </div>
        </motion.div>

        {/* Auto-Start Error Display */}
        {autoStartError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-center'
          >
            <div className='text-red-400 text-sm font-medium mb-2'>Auto-Start Failed</div>
            <div className='text-red-300 text-xs mb-3'>{autoStartError}</div>
            <button
              onClick={() => {
                setAutoStartError(null)
                if (autoStartData && availableVoices.length > 0) {
                  handleAutoStart()
                }
              }}
              className='px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors'
            >
              Retry Auto-Start
            </button>
          </motion.div>
        )}

        {/* Auto-Start User Info Display */}
        {autoStart && autoStartData && !autoStartError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-4 p-3 bg-[#403d39] rounded-lg'
          >
            <div className='text-[#ccc5b9] text-sm font-medium mb-2'>Auto-Start Configuration</div>
            <div className='text-[#fffcf2] text-xs space-y-1'>
              <div><strong>User:</strong> {autoStartData.user_name} (ID: {autoStartData.user_id})</div>
              {autoStartData.user_email && <div><strong>Email:</strong> {autoStartData.user_email}</div>}
              {autoStartData.agent_name && <div><strong>Agent:</strong> {autoStartData.agent_name}</div>}
              {autoStartData.meeting_id && <div><strong>Meeting ID:</strong> {autoStartData.meeting_id}</div>}
              <div><strong>Topics:</strong> {autoStartData.topics}</div>
              {autoStartData.intro && <div><strong>Intro:</strong> {autoStartData.intro}</div>}
              <div><strong>Voice ID:</strong> {autoStartData.voice_id}</div>
            </div>
          </motion.div>
        )}

        {/* Selected Voice Display */}
        {selectedVoice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-4 p-3 bg-[#403d39] rounded-lg text-center'
          >
            <div className='text-[#ccc5b9] text-sm font-medium mb-1'>Selected Voice</div>
            <div className='text-[#fffcf2] text-sm'>{selectedVoice.name}</div>
            <div className='text-[#ccc5b9] text-xs mt-1'>
              {selectedVoice.labels?.gender} • {selectedVoice.labels?.age} • {selectedVoice.labels?.accent}
            </div>
          </motion.div>
        )}

        {/* Related Meetings Display */}
        {relatedMeetings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='mb-4 p-3 bg-[#403d39] rounded-lg'
          >
            <h4 className='text-[#ccc5b9] text-sm font-medium mb-2'>
              Related Meetings Found: {relatedMeetings.length}
            </h4>
            <div className='text-[#fffcf2] text-xs space-y-2 max-h-32 overflow-y-auto'>
              {relatedMeetings.slice(0, 3).map((meeting, index) => (
                <div key={meeting.meeting_id} className='border-b border-[#252422] pb-1 last:border-b-0'>
                  <div className='font-medium truncate'>{index + 1}. {meeting.title}</div>
                  <div className='text-[#ccc5b9] text-xs mt-1 line-clamp-2'>
                    {meeting.summary}
                  </div>
                  <div className='text-[#ccc5b9] text-xs mt-1'>
                    Relevance: {(meeting.similarity_score * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
              {relatedMeetings.length > 3 && (
                <div className='text-[#ccc5b9] text-center pt-1'>
                  +{relatedMeetings.length - 3} more meetings...
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Control Buttons */}
        <div className='space-y-4'>
          {/* Start Conversation button - only show in manual mode when not active */}
          {!isActive && !autoStart && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowForm(!showForm)}
              className='px-4 py-2 rounded-full bg-[#eb5e28] text-[#fffcf2] text-sm font-semibold flex items-center justify-center space-x-2 mx-auto'
            >
              <Mic className='w-4 h-4' />
              <span>Start Conversation</span>
            </motion.button>
          )}

          {/* Auto-start mode info when not active */}
          {!isActive && autoStart && !autoStartError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className='text-center'
            >
              <div className='text-[#ccc5b9] text-sm mb-2'>Auto-Start Mode</div>
              <div className='text-[#fffcf2] text-xs'>
                Starting conversation automatically...
              </div>
            </motion.div>
          )}

          {/* End Conversation button - only shows when active */}
          {isActive && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={endConversation}
              className='h-12 px-4 rounded-full flex items-center justify-center mx-auto bg-[#eb5e28] text-[#fffcf2]'
            >
              <span className='mr-2'>End</span>
              <MicOff className='w-6 h-6' />
            </motion.button>
          )}

          {/* Show/Hide chat button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowChat(!showChat)}
            className='px-4 py-2 rounded-full bg-[#ccc5b9] text-[#252422] text-sm font-semibold flex items-center justify-center space-x-2 mx-auto'
          >
            <MessageCircle className='w-4 h-4' />
            <span>{showChat ? 'Hide Chat' : 'Show Chat'}</span>
          </motion.button>
        </div>

        {/* User Input Form - only show in manual mode */}
        <AnimatePresence>
          {showForm && !autoStart && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className='mt-4 bg-[#403d39] rounded-xl overflow-hidden'
            >
              <form onSubmit={handleFormSubmit} className='p-4 space-y-4'>
                <h3 className='text-[#ccc5b9] font-semibold text-lg mb-4'>Conversation Settings</h3>
                
                {/* Voice Selection */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    Voice Selection
                  </label>
                  {isLoadingVoices ? (
                    <div className='text-[#ccc5b9] text-sm'>Loading voices...</div>
                  ) : (
                    <div className='space-y-2 max-h-40 overflow-y-auto'>
                      {availableVoices.map((voice) => (
                        <div
                          key={voice.voice_id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                            selectedVoice?.voice_id === voice.voice_id
                              ? 'bg-[#eb5e28] border-[#eb5e28] text-[#fffcf2]'
                              : 'bg-[#252422] border-[#252422] text-[#fffcf2] hover:border-[#eb5e28]'
                          }`}
                          onClick={() => handleVoiceSelect(voice)}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex-1'>
                              <div className='font-medium text-sm'>{voice.name}</div>
                              <div className='text-xs opacity-75 mt-1'>
                                {voice.labels?.gender} • {voice.labels?.age} • {voice.labels?.accent}
                              </div>
                              <div className='text-xs opacity-60 mt-1 line-clamp-2'>
                                {voice.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                playVoicePreview(voice)
                              }}
                              className='ml-2 p-2 rounded-full hover:bg-black/20 transition-colors'
                            >
                              {playingPreview === voice.voice_id ? (
                                <Pause className='w-4 h-4' />
                              ) : (
                                <Play className='w-4 h-4' />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {formErrors.voice_id && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.voice_id}</p>
                  )}
                </div>

                {/* User Name */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    User Name
                  </label>
                  <input
                    type='text'
                    value={formData.user_name}
                    onChange={(e) => handleInputChange('user_name', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter your name'
                  />
                  {formErrors.user_name && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.user_name}</p>
                  )}
                </div>

                {/* User ID */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    User ID
                  </label>
                  <input
                    type='text'
                    value={formData.user_id}
                    onChange={(e) => handleInputChange('user_id', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter your user ID'
                  />
                  {formErrors.user_id && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.user_id}</p>
                  )}
                </div>

                {/* User Email */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    User Email
                  </label>
                  <input
                    type='email'
                    value={formData.user_email}
                    onChange={(e) => handleInputChange('user_email', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter your email address'
                  />
                  {formErrors.user_email && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.user_email}</p>
                  )}
                </div>

                {/* Agent Name */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    Agent Name
                  </label>
                  <input
                    type='text'
                    value={formData.agent_name}
                    onChange={(e) => handleInputChange('agent_name', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter the agent name'
                  />
                  {formErrors.agent_name && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.agent_name}</p>
                  )}
                </div>

                {/* Meeting ID */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    Meeting ID <span className='text-xs text-[#ccc5b9] opacity-75'>(Optional)</span>
                  </label>
                  <input
                    type='text'
                    value={formData.meeting_id}
                    onChange={(e) => handleInputChange('meeting_id', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter meeting ID to get attendees info'
                  />
                  {formErrors.meeting_id && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.meeting_id}</p>
                  )}
                </div>

                {/* Agent Meeting ID */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    Agent Meeting ID <span className='text-xs text-[#ccc5b9] opacity-75'>(Optional)</span>
                  </label>
                  <input
                    type='text'
                    value={formData.agent_meeting_id}
                    onChange={(e) => handleInputChange('agent_meeting_id', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter agent meeting ID for research integration'
                  />
                  {formErrors.agent_meeting_id && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.agent_meeting_id}</p>
                  )}
                </div>

                {/* Topics */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    Meeting Topics
                  </label>
                  <textarea
                    value={formData.topics}
                    onChange={(e) => handleInputChange('topics', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter topics to discuss in the meeting'
                    rows={3}
                  />
                  {formErrors.topics && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.topics}</p>
                  )}
                </div>

                {/* Intro */}
                <div>
                  <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                    Introduction
                  </label>
                  <textarea
                    value={formData.intro}
                    onChange={(e) => handleInputChange('intro', e.target.value)}
                    className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                    placeholder='Enter an introduction or context for the conversation'
                    rows={2}
                  />
                  {formErrors.intro && (
                    <p className='text-red-400 text-xs mt-1'>{formErrors.intro}</p>
                  )}
                </div>

                {/* Salesforce Credentials Section */}
                <div className='border-t border-[#252422] pt-4'>
                  <h4 className='text-[#ccc5b9] font-semibold text-md mb-4'>Salesforce Integration</h4>
                  
                  {/* Salesforce Username */}
                  <div className='mb-4'>
                    <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                      Salesforce Username <span className='text-xs text-[#ccc5b9] opacity-75'>(Optional)</span>
                    </label>
                    <input
                      type='text'
                      value={formData.sf_username}
                      onChange={(e) => handleInputChange('sf_username', e.target.value)}
                      className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                      placeholder='Enter your Salesforce username'
                    />
                    {formErrors.sf_username && (
                      <p className='text-red-400 text-xs mt-1'>{formErrors.sf_username}</p>
                    )}
                  </div>

                  {/* Salesforce Password */}
                  <div className='mb-4'>
                    <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                      Salesforce Password <span className='text-xs text-[#ccc5b9] opacity-75'>(Optional)</span>
                    </label>
                    <input
                      type='password'
                      value={formData.sf_password}
                      onChange={(e) => handleInputChange('sf_password', e.target.value)}
                      className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                      placeholder='Enter your Salesforce password'
                    />
                    {formErrors.sf_password && (
                      <p className='text-red-400 text-xs mt-1'>{formErrors.sf_password}</p>
                    )}
                  </div>

                  {/* Salesforce Security Token */}
                  <div className='mb-4'>
                    <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                      Security Token <span className='text-xs text-[#ccc5b9] opacity-75'>(Optional)</span>
                    </label>
                    <input
                      type='password'
                      value={formData.sf_security_token}
                      onChange={(e) => handleInputChange('sf_security_token', e.target.value)}
                      className='w-full px-3 py-2 bg-[#252422] text-[#fffcf2] rounded-lg border border-[#252422] focus:border-[#eb5e28] focus:outline-none transition-colors'
                      placeholder='Enter your Salesforce security token'
                    />
                    {formErrors.sf_security_token && (
                      <p className='text-red-400 text-xs mt-1'>{formErrors.sf_security_token}</p>
                    )}
                  </div>

                  {/* Salesforce Environment */}
                  <div className='mb-4'>
                    <label className='block text-[#ccc5b9] text-sm font-medium mb-2'>
                      Environment
                    </label>
                    <div className='flex space-x-4'>
                      <label className='flex items-center'>
                        <input
                          type='radio'
                          name='sf_environment'
                          checked={!formData.sf_is_sandbox}
                          onChange={() => handleInputChange('sf_is_sandbox', false)}
                          className='mr-2'
                        />
                        <span className='text-[#fffcf2] text-sm'>Production</span>
                      </label>
                      <label className='flex items-center'>
                        <input
                          type='radio'
                          name='sf_environment'
                          checked={formData.sf_is_sandbox}
                          onChange={() => handleInputChange('sf_is_sandbox', true)}
                          className='mr-2'
                        />
                        <span className='text-[#fffcf2] text-sm'>Sandbox</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className='flex space-x-3 pt-2'>
                  <button
                    type='submit'
                    className='flex-1 px-4 py-2 bg-[#eb5e28] text-[#fffcf2] rounded-lg font-medium hover:bg-[#d44f1f] transition-colors'
                  >
                    Start Conversation
                  </button>
                  <button
                    type='button'
                    onClick={() => setShowForm(false)}
                    className='px-4 py-2 bg-[#252422] text-[#ccc5b9] rounded-lg font-medium hover:bg-[#1a1918] transition-colors'
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Display */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className='mt-4 bg-[#403d39] rounded-xl overflow-hidden'
            >
              <div className='p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h3 className='text-[#ccc5b9] font-semibold text-lg'>
                    Conversation Chat
                  </h3>
                  <button
                    onClick={() => downloadTranscript(messages)}
                    className='text-[#ccc5b9] hover:text-[#fffcf2] transition-colors'
                  >
                    <Download className='w-4 h-4' />
                  </button>
                </div>
                <div
                  ref={scrollAreaRef}
                  className='h-64 overflow-y-auto space-y-2 bg-[#252422] rounded-lg p-3'
                >
                  {messages.length === 0 ? (
                    <div className='text-[#ccc5b9] text-sm text-center py-8'>
                      No messages yet. Start a conversation to see the chat.
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex items-start space-x-2 ${
                          message.source === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {message.source === 'agent' && (
                          <div className='w-6 h-6 rounded-full bg-[#eb5e28] flex items-center justify-center flex-shrink-0 mt-1'>
                            <Bot className='w-3 h-3 text-[#fffcf2]' />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                            message.source === 'user'
                              ? 'bg-[#eb5e28] text-[#fffcf2] ml-auto'
                              : 'bg-[#403d39] text-[#fffcf2]'
                          }`}
                        >
                          {message.message}
                        </div>
                        {message.source === 'user' && (
                          <div className='w-6 h-6 rounded-full bg-[#ccc5b9] flex items-center justify-center flex-shrink-0 mt-1'>
                            <User className='w-3 h-3 text-[#252422]' />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
