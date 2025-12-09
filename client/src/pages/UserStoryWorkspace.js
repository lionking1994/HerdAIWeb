import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Edit,
  MessageSquare,
  Flag,
  Clock,
  Users,
  User,
  Paperclip,
  Download,
  Calendar,
  CheckCircle,
  AlertCircle,
  Star,
  FileText,
  Send,
  MoreHorizontal,
  X,
  Plus,
  Loader2
} from 'lucide-react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
// import StoryDetailModal from '../../admin/src/components/PSA/Projects/StoryDetailModal' // Not needed - using custom EditStoryModal
import { useSelector } from 'react-redux'
import { toast } from "react-toastify";
import UserSuggestions from '../components/UserSuggestions'
import { FaTimes, FaFile, FaPaperPlane, FaEdit, FaTrash } from 'react-icons/fa'
import EmojiReactions from '../components/EmojiReactions'

// Custom Time Logging Modal Component
const TimeLoggingModal = ({ story, onClose, onTimeLogged }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Today's date
    timeFrom: '09:00',
    timeTo: '17:00',
    description: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const calculateDuration = () => {
    const fromTime = formData.timeFrom.split(':')
    const toTime = formData.timeTo.split(':')
    const fromMinutes = parseInt(fromTime[0]) * 60 + parseInt(fromTime[1])
    const toMinutes = parseInt(toTime[0]) * 60 + parseInt(toTime[1])
    const durationMinutes = toMinutes - fromMinutes

    if (durationMinutes <= 0) return '0 hours'

    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60

    if (hours === 0) return `${minutes} minutes`
    if (minutes === 0) return `${hours} hours`
    return `${hours}h ${minutes}m`
  }

  const handleSubmit = async () => {
    if (!formData.date || !formData.timeFrom || !formData.timeTo) {
      alert('Please fill in all required fields')
      return
    }

    // Validate time range
    const fromTime = formData.timeFrom.split(':')
    const toTime = formData.timeTo.split(':')
    const fromMinutes = parseInt(fromTime[0]) * 60 + parseInt(fromTime[1])
    const toMinutes = parseInt(toTime[0]) * 60 + parseInt(toTime[1])

    if (toMinutes <= fromMinutes) {
      alert('End time must be after start time')
      return
    }

    try {
      setIsSubmitting(true)

      // Call the parent's time logging function
      await onTimeLogged({
        date: formData.date,
        timeFrom: formData.timeFrom,
        timeTo: formData.timeTo,
        duration: calculateDuration(),
        description: formData.description
      })

      onClose()
    } catch (error) {
      console.error('Error logging time:', error)
      alert('Failed to log time. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 rounded-lg mr-3 border-2 bg-blue-50 text-blue-700 border-blue-500">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Log Time</h2>
              <p className="text-gray-600">Track time spent on this story</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time From *
              </label>
              <input
                type="time"
                value={formData.timeFrom}
                onChange={(e) => handleInputChange('timeFrom', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time To *
              </label>
              <input
                type="time"
                value={formData.timeTo}
                onChange={(e) => handleInputChange('timeTo', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Duration Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">Total Duration:</span>
              <span className="text-lg font-bold text-blue-900">{calculateDuration()}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="What did you work on?"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center ${isSubmitting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Logging...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Log Time
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Custom Edit Story Modal Component (based on StoryDetailModal but without assignee field)
const EditStoryModal = ({ story, onClose, onUpdate, teamMembers }) => {
  // Parse JSON fields safely
  const parseJsonField = (jsonString, fallback = []) => {
    try {
      if (typeof jsonString === 'string') {
        return JSON.parse(jsonString)
      }
      return jsonString || fallback
    } catch (error) {
      console.error('Error parsing JSON field:', error)
      return fallback
    }
  }

  const [formData, setFormData] = useState({
    title: story.title || '',
    description: story.description || '',
    status: story.status || 'backlog',
    priority: story.priority || 'medium',
    storyPoints: story.story_points || 0,
    tags: Array.isArray(story.tags) ? [...story.tags] : [],
    acceptanceCriteria: parseJsonField(story.acceptance_criteria, []),
    requiredSkills: parseJsonField(story.required_skills, []),
  })

  const [newTag, setNewTag] = useState('')
  const [newSkill, setNewSkill] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
      setHasChanges(true)
    }
  }

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
    setHasChanges(true)
  }

  const addRequiredSkill = () => {
    if (newSkill.trim() && !formData.requiredSkills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        requiredSkills: [...prev.requiredSkills, newSkill.trim()]
      }))
      setNewSkill('')
      setHasChanges(true)
    }
  }

  const removeRequiredSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(skill => skill !== skillToRemove)
    }))
    setHasChanges(true)
  }

  const addAcceptanceCriteria = () => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: [...prev.acceptanceCriteria, '']
    }))
    setHasChanges(true)
  }

  const updateAcceptanceCriteria = (index, value) => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.map((criteria, i) =>
        i === index ? value : criteria
      )
    }))
    setHasChanges(true)
  }

  const removeAcceptanceCriteria = (index) => {
    setFormData(prev => ({
      ...prev,
      acceptanceCriteria: prev.acceptanceCriteria.filter((_, i) => i !== index)
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    const updatedStory = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      storyPoints: formData.storyPoints,
      tags: formData.tags,
      acceptanceCriteria: formData.acceptanceCriteria.filter(criteria => criteria.trim() !== ''),
      requiredSkills: formData.requiredSkills
    }

    onUpdate(updatedStory)
    onClose()
  }

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose()
      }
    } else {
      onClose()
    }
  }


  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-700'
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-700'
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-700'
      case 'low': return 'border-green-500 bg-green-50 text-green-700'
      default: return 'border-gray-500 bg-gray-50 text-gray-700'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'review': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center">
            <div className="p-2 rounded-lg mr-3 border-2 bg-green-50 text-green-700 border-green-500">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Story Details</h2>
              <p className="text-gray-600">Update story information (Assignee field hidden)</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left Panel - Story Details */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Story Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="As a [user], I want [goal] so that [benefit]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Detailed description of the user story requirements"
                />
              </div>

              {/* Status and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['low', 'medium', 'high', 'critical'].map((priority) => {
                      const isSelected = formData.priority === priority
                      return (
                        <button
                          key={priority}
                          type="button"
                          onClick={() => handleInputChange('priority', priority)}
                          className={`p-2 border-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${isSelected
                              ? getPriorityColor(priority) + ' shadow-md'
                              : 'border-gray-200 hover:border-gray-300 bg-white text-gray-600'
                            }`}
                        >
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Story Points */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Points *
                </label>
                <select
                  value={formData.storyPoints}
                  onChange={(e) => handleInputChange('storyPoints', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[1, 2, 3, 5, 8, 13].map(points => (
                    <option key={points} value={points}>{points} points</option>
                  ))}
                </select>
              </div>

              {/* Required Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Required Skills
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.requiredSkills.map(skill => (
                    <span
                      key={skill}
                      className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeRequiredSkill(skill)}
                        className="ml-2 text-yellow-600 hover:text-yellow-800 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequiredSkill())}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add skill (press Enter)"
                  />
                  <button
                    type="button"
                    onClick={addRequiredSkill}
                    className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map(tag => (
                    <span
                      key={tag}
                      className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-green-600 hover:text-green-800 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add tag (press Enter)"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Acceptance Criteria */}
          <div className="w-1/2 border-l border-gray-200 p-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Acceptance Criteria</h3>
                <button
                  type="button"
                  onClick={addAcceptanceCriteria}
                  className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Criteria
                </button>
              </div>

              <div className="space-y-3">
                {formData.acceptanceCriteria.map((criteria, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <textarea
                        value={criteria}
                        onChange={(e) => updateAcceptanceCriteria(index, e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        placeholder={`Acceptance criteria ${index + 1}`}
                        rows={2}
                      />
                    </div>
                    {formData.acceptanceCriteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAcceptanceCriteria(index)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {formData.acceptanceCriteria.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No acceptance criteria defined</p>
                  <button
                    type="button"
                    onClick={addAcceptanceCriteria}
                    className="text-green-600 hover:text-green-700 text-sm font-medium mt-2"
                  >
                    Add the first criteria
                  </button>
                </div>
              )}

              {/* Story Information */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Story Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-800 border-green-200">
                      User Story
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Status:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}>
                      {formData.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assignee:</span>
                    <span className="font-medium text-gray-900">{story.assignee_name || 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span className="text-orange-600 font-medium">
                <Clock className="w-4 h-4 inline mr-1" />
                You have unsaved changes
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {hasChanges ? 'Cancel' : 'Close'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasChanges}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center ${hasChanges
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              <Star className="w-4 h-4 mr-2" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const UserStoryWorkspace = () => {
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { storyId } = useParams()
  const [story, setStory] = useState(null)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [attachments, setAttachments] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [assignedResources, setAssignedResources] = useState([])
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isTimeLoggingModalOpen, setIsTimeLoggingModalOpen] = useState(false)
  const [timeLogs, setTimeLogs] = useState([])
  const [isLoadingTimeLogs, setIsLoadingTimeLogs] = useState(false)
  const messageInputRef = useRef(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [message, setMessage] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingThread, setEditingThread] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [myTaskDetail, setMyTaskDetail] = useState({});
  const [finalFileName, setFinalFileName] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const userSuggestionsRef = useRef(null);
  
  // Separate state for upload modal mentions
  const [showUploadSuggestions, setShowUploadSuggestions] = useState(false);
  const [uploadSuggestions, setUploadSuggestions] = useState([]);
  const uploadSuggestionsRef = useRef(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  
  // State for editing comments
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");

  useEffect(() => {
    if (storyId) {
      fetchStoryDetails()
    }
  }, [storyId])

  const fetchStoryDetails = async () => {
    try {
      setIsLoading(true)
      const token = localStorage.getItem('token')

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        setStory(response.data.data.story)
        setAttachments(response.data.data.attachments || [])
        setTeamMembers(response.data.data.team_members || [])

        // Transform team members to assignedResources format for the modal
        const resources = (response.data.data.team_members || []).map(member => ({
          id: member.id.toString(),
          name: member.name,
          project_role: member.role || 'Team Member'
        }))
        setAssignedResources(resources)

        // Fetch discussions separately
        await fetchStoryDiscussions()
      }
    } catch (error) {
      console.error('Error fetching story details:', error)
      // Don't call setDemoData anymore - let the error handling show proper UI
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStoryDiscussions = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}/discussions`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        setComments(response.data.data.discussions)
      }
    } catch (error) {
      console.error('Error fetching discussions:', error)
      setComments([]) // Set empty array on error
    }
  }

  const fetchTimeLogs = async () => {
    try {
      setIsLoadingTimeLogs(true)
      const token = localStorage.getItem('token')
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}/time-logs`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        setTimeLogs(response.data.data.timeLogs)
      }
    } catch (error) {
      console.error('Error fetching time logs:', error)
      setTimeLogs([]) // Set empty array on error
    } finally {
      setIsLoadingTimeLogs(false)
    }
  }

  const updateStory = async (updatedStory) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/psa/backlog/item/${storyId}`,
        {
          title: updatedStory.title,
          description: updatedStory.description,
          status: updatedStory.status,
          priority: updatedStory.priority,
          story_points: updatedStory.storyPoints,
          tags: updatedStory.tags,
          acceptance_criteria: JSON.stringify(updatedStory.acceptanceCriteria),
          required_skills: JSON.stringify(updatedStory.requiredSkills)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        setStory(prevStory => ({
          ...prevStory,
          title: updatedStory.title,
          description: updatedStory.description,
          status: updatedStory.status,
          priority: updatedStory.priority,
          story_points: updatedStory.storyPoints,
          tags: updatedStory.tags,
          acceptance_criteria: JSON.stringify(updatedStory.acceptanceCriteria),
          required_skills: JSON.stringify(updatedStory.requiredSkills)
        }))
      }
    } catch (error) {
      console.error('Error updating story:', error)
    }
  }

  // Parse JSON fields safely
  const parseJsonField = (jsonString, fallback = []) => {
    try {
      if (typeof jsonString === 'string') {
        return JSON.parse(jsonString)
      }
      return jsonString || fallback
    } catch (error) {
      console.error('Error parsing JSON field:', error)
      return fallback
    }
  }

  // Demo data for testing (fallback only)
  const setDemoData = () => {
    const demoStory = {
      id: storyId,
      title: "Story Not Available",
      description: "Unable to load story details",
      status: "unknown",
      tags: [],
      acceptanceCriteria: [],
      details: {
        id: "Unknown",
        project: "Unknown",
        type: "User Story",
        priority: "Unknown",
        status: "Unknown",
        assignee: "Unknown",
        reporter: "Unknown",
        sprint: "Unknown"
      }
    }

    setStory(demoStory)
    setComments([])
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    
    // Format as "Oct 3, 2025 at 5:13 PM"
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'in progress': return 'bg-blue-100 text-blue-800'
      case 'review': return 'bg-orange-100 text-orange-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'backlog': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'


    }
  }

  const handleCommentSubmit = async (isUpload = false) => {
    const messageToUse = isUpload ? uploadMessage : message;
    
    if ((!messageToUse.trim() && !selectedFile) || isSubmittingComment) {
      return;
    }

    try {
      setIsSubmittingComment(true);
      const token = localStorage.getItem("token");

      // Use FormData for file + text
      const formData = new FormData();
      formData.append("comment_text", messageToUse.trim());

      if (selectedFile) {
        formData.append("file", selectedFile); // ✅ Add file if one is selected
        formData.append("customFileName", selectedFile.name); // optional
      }      

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}/discussions`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            
          },
        }
      );

      if (response.data?.success) {
        if (isUpload) {
          setUploadMessage("");
          setIsModalOpen(false);
        } else {
          setMessage("");
        }
        setSelectedFile(null);
        await fetchStoryDiscussions(); // refresh discussion list
      }
    } catch (error) {
      console.error("Error adding comment:", error.response?.data || error);
      alert("Failed to add comment. Please try again.");
    } finally {
      setIsSubmittingComment(false);
    }
  };


  // Handle status change for Mark as Done and Request Review buttons
  const handleStatusChange = async (newStatus) => {
    if (isUpdatingStatus) return; // Prevent multiple clicks

    try {
      setIsUpdatingStatus(true)
      const token = localStorage.getItem('token')
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/psa/backlog/item/${storyId}/status`,
        {
          status: newStatus
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        // Update the story status in local state
        setStory(prevStory => ({
          ...prevStory,
          status: newStatus
        }))

        // Show success message
        alert(`Story status updated to ${newStatus.replace('_', ' ')} successfully!`)
      }
    } catch (error) {
      console.error('Error updating story status:', error)
      alert('Failed to update story status. Please try again.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Handle @ mention
  const handleMessageChange = async (e) => {
    const newMessage = e.target.value;
     setMessage(newMessage);

    // Get cursor position
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    // Check for @ mentions
    const lastAtSymbolIndex = newMessage.lastIndexOf("@", cursorPos);

    // Handle @ mentions
    if (lastAtSymbolIndex !== -1) {
      const textAfterAt = newMessage.substring(
        lastAtSymbolIndex + 1,
        cursorPos
      );

      // If there's text after @ and no space, show suggestions
      if (textAfterAt && !textAfterAt.includes(" ")) {
        try {
          const token = localStorage.getItem("token");

          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/documents/users/search`,
            {
              params: { query: textAfterAt, taskId: myTaskDetail.id },
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.success) {
            setUserSuggestions(response.data.users || []);
            setShowUserSuggestions(true);
          }
        } catch (error) {
          console.error("Error fetching user suggestions:", error);
        }
      } else {
        setShowUserSuggestions(false);
      }
    } else {
      setShowUserSuggestions(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    setUploadMessage(message);
    setSelectedFile(file);
    setIsModalOpen(true);
    setFinalFileName("");
  };

  const handleSelectUser = (user) => {
    // Check if we're in the main message or upload message
    const isUploadMessage = document.activeElement?.value === uploadMessage;
    const currentMessage = isUploadMessage ? uploadMessage : message;
    const lastAtSymbolIndex = currentMessage.lastIndexOf("@", cursorPosition);

    if (lastAtSymbolIndex !== -1) {
      const beforeAt = currentMessage.substring(0, lastAtSymbolIndex);
      const afterCursor = currentMessage.substring(cursorPosition);

      // Replace the @mention with the selected user (use full name)
      const newMessage = `${beforeAt}@${user.name} ${afterCursor}`;

      if (isUploadMessage) {
        setUploadMessage(newMessage);
      } else {
        setMessage(newMessage);
      }

      // Add to mentioned users if not already included
      if (!mentionedUsers.some((u) => u.id === user.id)) {
        setMentionedUsers([
          ...mentionedUsers,
          {
            id: user.id,
            username: user.name,
            name: user.name,
            avatar: user.avatar,
            email: user.email,
            bio: user.bio,
            phone: user.phone,
            location: user.location,
          },
        ]);
      }
    }

    setShowUserSuggestions(false);
    if (isUploadMessage) {
      document.activeElement?.focus();
    } else {
      messageInputRef.current?.focus();
    }
  };

  // Handle file download
  const handleFileDownload = async (fileUrl, fileName) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/files/${fileUrl}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'blob', // Important for file downloads
        }
      );

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleSendMessage = async (upload = false) => {
    const upMessage = upload ? uploadMessage : message;
    if (!upMessage.trim()) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // If we're editing a message, use a different endpoint
      if (editingThread) {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/update-message`,
          // {
          //   threadId: editingThread.task_threads_id,
          //   message: upMessage,
          // },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          toast.success("Message updated successfully");
          setEditingThread(null);
          setMessage("");
        }
      } else {
        
        // Regular message or reply
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("taskId", myTaskDetail.id);
        formData.append("message", upMessage);
        formData.append("customFileName", finalFileName);
        // formData.append('message', uploadMessage);
        // formData.append(
        //   "reply_from",
        //   replyToThread ? replyToThread.task_threads_id : null
        // );

        // Add mentioned users if any
        if (mentionedUsers.length > 0) {
          formData.append("mentionedUsers", JSON.stringify(mentionedUsers));
        }

        const token = localStorage.getItem("token");

        await axios.post(
          `${process.env.REACT_APP_API_URL}/tasks/insert-message-task`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            },
          }
        );

        // Clear the message input and reset state
        setMessage("");
        setUploadMessage("");
        setSelectedFile(null);
        setIsModalOpen(false);
        setMentionedUsers([]); // Clear mentioned users
        setFinalFileName("");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle time logging
  const handleTimeLog = async (timeData) => {
    try {
      const token = localStorage.getItem('token')

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}/time-logs`,
        {
          log_date: timeData.date,
          time_from: timeData.timeFrom,
          time_to: timeData.timeTo,
          description: timeData.description
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (response.data?.success) {
        // Update the story actual_hours in local state (convert to number)
        setStory(prevStory => ({
          ...prevStory,
          actual_hours: parseFloat(response.data.data.totalActualHours)
        }))

        // Show success message
        const durationHours = response.data.data.timeLog.duration_hours
        alert(`Time logged successfully! Duration: ${durationHours.toFixed(2)} hours`)
        setIsTimeLoggingModalOpen(false)

        // Refresh time logs if we have them displayed
        if (timeLogs.length > 0) {
          await fetchTimeLogs()
        }
      }
    } catch (error) {
      console.error('Error logging time:', error)
      alert('Failed to log time. Please try again.')
    }
  }

  const handleCloseModal = () => {
    setFinalFileName("");
    setIsModalOpen(false);
    setSelectedFile(null);
  };

  const formatFileSize = (size) => {
    if (!size) return "0 B";
    if (size < 1024) return `${size} B`;
    else if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    else return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleUploadMessageChange = async (e) => {
    const newMessage = e.target.value;
    setUploadMessage(newMessage);

    // Get cursor position
    const cursorPos = e.target.selectionStart;

    // Check for @ mentions
    const lastAtSymbolIndex = newMessage.lastIndexOf("@", cursorPos);

    // Handle @ mentions
    if (lastAtSymbolIndex !== -1) {
      const textAfterAt = newMessage.substring(
        lastAtSymbolIndex + 1,
        cursorPos
      );

      // If there's text after @ and no space, show suggestions
      if (textAfterAt && !textAfterAt.includes(" ")) {
        try {
          const token = localStorage.getItem("token");

          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/documents/users/search`,
            {
              params: { query: textAfterAt, taskId: myTaskDetail.id },
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.success) {
            setUploadSuggestions(response.data.users || []);
            setShowUploadSuggestions(true);
          }
        } catch (error) {
          console.error("Error fetching user suggestions:", error);
        }
      } else {
        setShowUploadSuggestions(false);
      }
    } else {
      setShowUploadSuggestions(false);
    }
  };

  // Separate handler for upload modal user selection
  const handleUploadSelectUser = (user) => {
    const lastAtSymbolIndex = uploadMessage.lastIndexOf("@");
    
    if (lastAtSymbolIndex !== -1) {
      const beforeAt = uploadMessage.substring(0, lastAtSymbolIndex);
      const afterAt = uploadMessage.substring(lastAtSymbolIndex);
      const afterCursor = afterAt.substring(afterAt.indexOf(" ") + 1);

      // Replace the @mention with the selected user (use full name)
      const newMessage = `${beforeAt}@${user.name} ${afterCursor}`;

      setUploadMessage(newMessage);
      
      // Add to mentioned users if not already included
      if (!mentionedUsers.some((u) => u.id === user.id)) {
        setMentionedUsers([
          ...mentionedUsers,
          {
            id: user.id,
            username: user.name,
            name: user.name,
            avatar: user.avatar,
          },
        ]);
      }
    }

    // Hide suggestions
    setShowUploadSuggestions(false);
  };

  // Handle edit comment
  const handleEditComment = (comment) => {
    setEditingComment(comment.id);
    setEditCommentText(comment.comment_text);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}/discussions/${editingComment}`,
        { comment_text: editCommentText },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.success) {
        await fetchStoryDiscussions();
        setEditingComment(null);
        setEditCommentText("");
        toast.success("Comment updated successfully");
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      toast.error("Failed to update comment");
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditCommentText("");
  };

  // Handle delete comment
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${process.env.REACT_APP_API_URL}/psa/story/${storyId}/discussions/${commentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        await fetchStoryDiscussions();
        toast.success("Comment deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Story Not Found</h2>
          <button onClick={() => navigate('/psa/my-work')} className="text-purple-600 hover:underline">
            Return to My Work
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar isAuthenticated={true} user={user} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/psa/my-work')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">User Story Workspace</h1>
                <p className="text-gray-600 mt-1">Collaborate and track progress on your assigned story</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <User className="w-5 h-5" />
              <span>Designed by {story.assignee_name || 'Unknown Assignee'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Story Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <h2 className="text-xl font-semibold text-gray-900 pr-4">{story.title}</h2>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(story.status)}`}>
                    {story.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || story.status}
                  </span>
                </div>
              </div>

              <p className="text-gray-600 mb-4">{story.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {story.story_points || 0} Points
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  {story.priority?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Medium'}
                </span>
                {story.sprint_name && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    {story.sprint_name}
                  </span>
                )}
                {parseJsonField(story.tags, []).map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
                {parseJsonField(story.required_skills, []).map((skill, index) => (
                  <span key={`skill-${index}`} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>

              {/* Dependencies */}
              {story.dependencies?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Dependencies</h4>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {story.dependencies.map((dependency, index) => (
                      <li key={index}>{dependency}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 mt-6">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-4 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  EDIT STORY
                </button>
                <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors">
                  ADD COMMENT
                </button>
                <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors">
                  REPORT
                </button>
              </div>
            </div>

            {/* Acceptance Criteria */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acceptance Criteria</h3>
              <div className="space-y-3">
                {(() => {
                  const criteriaArray = parseJsonField(story.acceptance_criteria, []);
                  if (criteriaArray.length > 0) {
                    return criteriaArray.map((criteria, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <CheckCircle className="w-5 h-5 mt-0.5 text-gray-400" />
                        <span className="text-gray-900">
                          {typeof criteria === 'string' ? criteria : String(criteria)}
                        </span>
                      </div>
                    ));
                  } else {
                    return (
                      <div className="text-gray-500 text-sm italic">
                        No acceptance criteria defined yet
                      </div>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Time Logs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Time Logs ({timeLogs.length})
                </h3>
                <button
                  onClick={fetchTimeLogs}
                  disabled={isLoadingTimeLogs}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                  {isLoadingTimeLogs ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-1" />
                      Refresh
                    </>
                  )}
                </button>
              </div>

              {timeLogs.length > 0 ? (
                <div className="space-y-3">
                  {timeLogs.map((log) => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(log.log_date).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-blue-600">
                          {log.duration_hours}h
                        </span>
                      </div>

                      <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                        <span>{log.time_from} - {log.time_to}</span>
                        <span>by {log.user_name}</span>
                      </div>

                      {log.description && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                          {log.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No time logs yet</p>
                  <p className="text-sm">Click "Log Time" to start tracking your work</p>
                </div>
              )}
            </div>

            {/* Discussion */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Discussion ({comments.length})
              </h3>

              {/* Comment Input */}
              <div className="mb-6">
                {/* <textarea
                  placeholder="Add a comment, @tag or mention team members"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full h-24 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                /> */}
                <div className="relative">
                  <textarea
                    ref={messageInputRef}
                    value={message}
                    onChange={handleMessageChange}
                    placeholder={
                      myTaskDetail.status !== "Rated" &&
                        myTaskDetail.status !== "Completed" &&
                        myTaskDetail.status !== "Ready For Review"
                        ? "Type your message... Use @ to mention users"
                        : ""
                    }
                    disabled={
                      myTaskDetail.status === "Rated" ||
                      myTaskDetail.status === "Completed" ||
                      myTaskDetail.status === "Ready For Review"
                    }
                    className="flex-1 w-full min-h-[80px] p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />

                  {/* User suggestions for @mentions */}
                  <UserSuggestions
                    suggestions={userSuggestions}
                    isVisible={showUserSuggestions}
                    onSelectUser={handleSelectUser}
                    suggestionsRef={userSuggestionsRef}
                    prefix="@"
                  />
                </div>
                <div className="flex items-center justify-between mt-3">

                  <input
                    type="file"
                    onChange={handleFileUpload}  // Reuse the same file upload handler
                    className="hidden"
                    id="attach-file-input"
                  />

                  {/* Paperclip icon + text triggers file input */}
                  <label
                    htmlFor="attach-file-input"
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span>Attach ({selectedFile ? 1 : 0})</span>
                  </label>

                  <button
                    onClick={() => {
                       handleCommentSubmit();
                    }}
                    disabled={!message.trim() || isSubmittingComment}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center ${message.trim() && !isSubmittingComment
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    {isSubmittingComment ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Posting...
                      </>
                    ) : (
                      'Comment'
                    )}
                  </button>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className={`${comment.parent_comment_id ? 'ml-6' : ''}`}>
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {comment.user_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{comment.user_name}</span>
                            <span className="text-sm text-gray-500">{formatDate(comment.created_at)}</span>
                          </div>
                          
                          {/* Edit and Delete Icons - Only show for current user's comments */}
                          {comment.user_id === user?.id && (
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEditComment(comment)}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit comment"
                              >
                                <FaEdit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete comment"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Comment Text - Show edit mode if editing */}
                        {editingComment === comment.id ? (
                          <div className="mb-2">
                            <textarea
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              rows="3"
                            />
                            <div className="flex items-center space-x-2 mt-2">
                              <button
                                onClick={handleSaveEdit}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-700 mb-2">{comment.comment_text}</p>
                        )}

                        {/* Attachments */}
                        {comment.attachment_filename && (
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 text-sm">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span className="text-blue-600 hover:underline cursor-pointer">
                                {comment.attachment_filename}
                              </span>
                              
                              <button
                                onClick={() => handleFileDownload(comment.attachment_url, comment.attachment_filename)}
                                className="text-blue-600 hover:underline cursor-pointer bg-transparent border-none p-0"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        )}

                        {/* <button
                          className="text-blue-600 hover:underline text-sm mt-2 cursor-pointer"
                          onClick={() => {
                            // TODO: Implement reply functionality
                            console.log('Reply to comment:', comment.id)
                          }}
                        >
                          Reply
                        </button> */}
                        
                        {/* Emoji Reactions */}
                         <div className="mt-2">
                           <EmojiReactions
                             threadId={comment.id}
                             currentUser={user}
                             apiType="psa"
                           />
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => setIsTimeLoggingModalOpen(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  <span>Log Time</span>
                </button>
                <button
                  onClick={() => handleStatusChange('done')}
                  disabled={isUpdatingStatus}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isUpdatingStatus
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                >
                  {isUpdatingStatus ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Mark as Done</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleStatusChange('review')}
                  disabled={isUpdatingStatus}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isUpdatingStatus
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-700'
                    }`}
                >
                  {isUpdatingStatus ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Request Review</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Story Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Story Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">ID:</span>
                  <span className="text-gray-900">US-{story.id?.slice(-8)?.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Project:</span>
                  <span className="text-gray-900">{story.project_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Type:</span>
                  <span className="text-gray-900">{story.type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Priority:</span>
                  <span className="text-gray-900">{story.priority?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Status:</span>
                  <span className="text-gray-900">{story.status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Assignee:</span>
                  <span className="text-gray-900">{story.assignee_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Reporter:</span>
                  <span className="text-gray-900">{story.reporter_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Feature:</span>
                  <span className="text-gray-900">{story.feature_title}</span>
                </div>
                {story.sprint_name && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Sprint:</span>
                    <span className="text-gray-900">{story.sprint_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Actual Hours:</span>
                  <span className="text-gray-900">{story.actual_hours ? `${parseFloat(story.actual_hours).toFixed(2)}h` : '0h'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-600">Estimated Hours:</span>
                  <span className="text-gray-900">{story.estimated_hours ? `${story.estimated_hours}h` : 'Not set'}</span>
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {member.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'M'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.role}</p>
                    </div>
                  </div>
                ))}
                {teamMembers.length === 0 && (
                  <div className="text-gray-500 text-sm italic">
                    No team members assigned to this project yet
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {story.recentActivity?.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm text-gray-900">{activity.text}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for file upload confirmation */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0004]">
          <div className="bg-white rounded-lg p-4 shadow-lg relative max-w-md w-full mx-4">
            <button
              onClick={handleCloseModal}
              disabled={isUploading}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              <FaTimes className="w-5 h-5" />
            </button>
            +<h2 className="text-lg font-semibold">Upload File</h2>
            <div className="mt-2 flex items-center">
              <div className="w-20 h-20 flex items-center justify-center bg-blue-100 rounded-lg">
                {isUploading ? (
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                ) : (
                  <FaFile className="w-10 h-10 text-blue-600" />
                )}
              </div>
              <div className="ml-2">
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    {isEditingName ? (
                      <input
                        className="border p-1 text-sm rounded"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const ext = selectedFile.name.split(".").pop();
                            setFinalFileName(`${editedName}`);
                            setIsEditingName(false);
                          }
                        }}
                        onBlur={() => {
                          const ext = selectedFile.name.split(".").pop();
                          setFinalFileName(`${editedName}`);
                          setIsEditingName(false);
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        <p className="text-sm font-medium">
                          {finalFileName ||
                            setFinalFileName(selectedFile.name.split(".")[0])}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            // Remove the extension when entering edit mode
                            setEditedName(finalFileName);

                            setIsEditingName(true);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* set here edit icon when user clicks on that icon they can edit the existing name  */}
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile?.size)}
                </p>
              </div>
            </div>
            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-blue-700">
                    Uploading...
                  </span>
                  <span className="text-sm font-medium text-blue-700">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <div className="mt-4 flex gap-2 items-center">
              <div className="flex-1 relative">
                <textarea
                  value={uploadMessage}
                  onChange={handleUploadMessageChange}
                  placeholder="Type your message... Use @ to mention users"
                  disabled={isUploading}
                  className="w-full min-h-[80px] p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                />
                {/* User suggestions for @mentions */}
                <UserSuggestions
                  suggestions={uploadSuggestions}
                  isVisible={showUploadSuggestions}
                  onSelectUser={handleUploadSelectUser}
                  suggestionsRef={uploadSuggestionsRef}
                  prefix="@"
                />
              </div>
              <button
                onClick={() => handleCommentSubmit(true)}
                disabled={!uploadMessage.trim() || isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <FaPaperPlane className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />

      {/* Edit Story Modal - Custom Version with Hidden Assignee */}
      {story && isEditModalOpen && (
        <EditStoryModal
          story={story}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={updateStory}
          teamMembers={teamMembers}
        />
      )}

      {/* Time Logging Modal */}
      {story && isTimeLoggingModalOpen && (
        <TimeLoggingModal
          story={story}
          onClose={() => setIsTimeLoggingModalOpen(false)}
          onTimeLogged={handleTimeLog}
        />
      )}
    </div>
  )
}

export default UserStoryWorkspace
