import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import ChartCard from '../components/ChartCard';
import WordCloudCard from '../components/WordCloudCard';
import TaskReviewCloud from '../components/TaskReviewCloud';
import axios from 'axios';
import { FeedbackItem } from '../types';
import { meetingsData, tasksData, taskRatingData, usersGrowthData, } from '../data';
import { useSearchParams } from 'react-router-dom';
import { Star, X } from 'lucide-react'; // Import icons
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import UserProfileDrawer from '../components/UserProfileDrawer';
import { useAuth } from '../contexts/AuthContext';

interface Feedback {
  subject: string;
  details: string;
  user_name: string;
  url: string;
  user_email: string;
  user_avatar: string;
  status?: string;
  date_time: string;
}

interface FeedbackModal {
  isOpen: boolean;
  feedback: Feedback | null;
}

interface ReviewModal {
  isOpen: boolean;
  reviews: {
    task_id: string;
    task_title: string;
    meeting_title: string;
    user_name: string;
    user_avatar: string;
    created_at: string;
    rate: number;
    review: string;
  }[] | null;
}

const AdminDashboard = () => {
  const selectedQuarter = useSelector((state: RootState) => state.quarter.currentQuarter);
  const [meetingsData1, setMeetingsData1] = useState(meetingsData);
  const [tasksData1, setTasksData1] = useState(tasksData);
  const [taskRatingData1, setTaskRatingData1] = useState(taskRatingData);
  const [usersGrowthData1, setUsersGrowthData1] = useState(usersGrowthData);
  const [costData1, setCostData1] = useState({ labels: ['Jul', 'Aug', 'Sep'], datasets: [{ label: 'Cost', data: [1000, 1200, 1500], borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true, tension: 0.4 }] });
  const [expensiveMeetings, setExpensiveMeetings] = useState<Array<{
    id: string;
    title: string;
    organizer: string;
    duration: number;
    datetime: string;
    cost: number;
    rank: number;
  }>>([]);
  const [taskReviewWords, setTaskReviewWords] = useState([]);
  const [feedbackWords, setFeedbackWords] = useState([]);
  const [isTaskReviewLoading, setIsTaskReviewLoading] = useState(false);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModal>({
    isOpen: false,
    feedback: null
  });
  const [reviewModal, setReviewModal] = useState<ReviewModal>({
    isOpen: false,
    reviews: null
  });
  const [searchParams] = useSearchParams();
  const company = searchParams.get('company');
  const [nonAlignedMeetings, setNonAlignedMeetings] = useState<Array<{
    id: string;
    title: string;
    averageAlignmentScore: number;
    cost: number;
    duration: number;
    datetime: string;
    rank: number;
  }>>([]);
  const [topRatedUsers, setTopRatedUsers] = useState<Array<{
    id: string;
    name: string;
    avatar: string | null;
    averageRating: number;
    ratedTasks: number;
    rank: number;
  }>>([]);
  const { user: currentUser } = useAuth ? useAuth() : { user: null };
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Function to convert quarter string to number (e.g., "Q1/2025" -> 1)
  const getQuarterNumber = (quarterString: string): number => {
    return parseInt(quarterString.charAt(1));
  };

  // Function to get year from quarter string (e.g., "Q1/2025" -> 2025)
  const getYearFromQuarter = (quarterString: string): number => {
    return parseInt(quarterString.split('/')[1]);
  };

  // Function to check if the quarter string is YTD (e.g., "YTD/2025")
  const isYTDQuarter = (quarterString: string): boolean => {
    return quarterString.startsWith('YTD');
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!selectedQuarter) return;

      try {
        const year = getYearFromQuarter(selectedQuarter);
        const isYTD = isYTDQuarter(selectedQuarter);
        const quat = isYTD ? null : getQuarterNumber(selectedQuarter);

        const [
          tasksResponse,
          meetingsResponse,
          taskRatingResponse,
          usersGrowthResponse,
          costResponse,
          expensiveMeetingsResponse,
          nonAlignedMeetingsResponse,
          topRatedUsersResponse,
        ] = await Promise.all([
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/tasks/tasksData`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/meeting/meetingsData`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/tasks/tasksRatingData`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/users/usersData`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/tasks/costData`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/meeting/top-expensive-meetings`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/tasks/top-non-aligned-meetings`,
            { year, quat, company, isYTD }),
          axios.post(`${import.meta.env.VITE_API_BASE_URL}/tasks/top-rated-users`,
            { year, quat, company, isYTD }),
        ]);

        if (tasksResponse.data.status) setTasksData1(tasksResponse.data.tasks);
        if (meetingsResponse.data.status) setMeetingsData1(meetingsResponse.data.meetings);
        if (taskRatingResponse.data.status) setTaskRatingData1(taskRatingResponse.data.taskRates);
        if (usersGrowthResponse.data.status) setUsersGrowthData1(usersGrowthResponse.data.users);
        if (costResponse.data.status) setCostData1(costResponse.data.cost);
        if (expensiveMeetingsResponse.data.status) setExpensiveMeetings(expensiveMeetingsResponse.data.expensiveMeetings);
        if (nonAlignedMeetingsResponse.data.status) setNonAlignedMeetings(nonAlignedMeetingsResponse.data.nonAlignedMeetings);
        if (topRatedUsersResponse.data.status) setTopRatedUsers(topRatedUsersResponse.data.topRatedUsers);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [company, selectedQuarter]);

  useEffect(() => {
    const fetchWordCloudData = async () => {
      if (!selectedQuarter) return;

      if (company) {
        setIsTaskReviewLoading(true);
        try {
          const year = getYearFromQuarter(selectedQuarter);
          const isYTD = isYTDQuarter(selectedQuarter);
          const quat = isYTD ? null : getQuarterNumber(selectedQuarter);

          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/tasks/taskReviewStatistic`,
            { year, quat, company, isYTD }
          );
          if (response.data.success) {
            setTaskReviewWords(response.data.reviews);
          }
        } catch (error) {
          console.error('Error fetching task reviews:', error);
        } finally {
          setIsTaskReviewLoading(false);
        }
      } else {
        setIsFeedbackLoading(true);
        try {
          const year = getYearFromQuarter(selectedQuarter);
          const isYTD = isYTDQuarter(selectedQuarter);
          const quat = isYTD ? null : getQuarterNumber(selectedQuarter);

          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/feedback/feedbackStatistic`,
            { year, quat, isYTD }
          );
          if (response.data.success) {
            setFeedbackWords(response.data.feedbacks);
          }
        } catch (error) {
          console.error('Error fetching feedback:', error);
        } finally {
          setIsFeedbackLoading(false);
        }
      }
    };

    fetchWordCloudData();
  }, [company, selectedQuarter]);

  const ChartCardSkeleton = () => (
    <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4 animate-pulse h-full flex flex-col">
      <div className="h-4 bg-gray-300/20 rounded w-1/2 mb-4"></div>
      <div className="h-[200px] bg-gray-300/20 rounded"></div>
    </div>
  );

  const WordCloudSkeleton = () => (
    <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4 animate-pulse h-full flex flex-col">
      <div className="h-4 bg-gray-300/20 rounded w-1/3 mb-4"></div>
      <div className="h-[300px] bg-gray-300/20 rounded h-full"></div>
    </div>
  );

  const handleFeedbackWordClick = async (word: FeedbackItem) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/feedback/get-feedback-details`,
        { id: word.id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      console.log(response.data)
      if (response.data.success) {
        setFeedbackModal({
          isOpen: true,
          feedback: response.data.feedback
        });
      }
    } catch (error) {
      console.error('Error fetching feedback details:', error);
    }
  };

  const closeFeedbackModal = () => {
    setFeedbackModal({
      isOpen: false,
      feedback: null
    });
  };

  useEffect(() => {
    console.log('changed taskReviewWords')
  }, [taskReviewWords])

  const handleTaskReviewWordClick = async (word: FeedbackItem) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/tasks/get-task-review-details`,
        { id: word.id },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.data.success) {
        setReviewModal({
          isOpen: true,
          reviews: response.data.reviews
        });
      }
    } catch (error) {
      console.error('Error fetching task review details:', error);
    }
  };

  const closeReviewModal = () => {
    setReviewModal(prev => {
      return {
        ...prev,
        isOpen: false
      }
    });
  };

  const FeedbackDetailModal = () => (
    <Transition appear show={feedbackModal.isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeFeedbackModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {feedbackModal.feedback && (
                  <>
                    {/* Header */}
                    <div className="relative border-b border-gray-200 dark:border-gray-700">
                      <Dialog.Title className="py-6 px-6 text-xl font-semibold text-gray-900 dark:text-white">
                        {feedbackModal.feedback.subject}
                      </Dialog.Title>
                      <button
                        onClick={closeFeedbackModal}
                        className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4">
                      {/* User Info */}
                      <div className="flex items-center gap-4 mb-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        {feedbackModal.feedback.user_avatar ? (
                          <img
                            src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${feedbackModal.feedback.user_avatar}`}
                            alt={feedbackModal.feedback.user_name}
                            className="w-16 h-16 rounded-full border-2 border-white dark:border-gray-700 shadow-md"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <span className="text-xl font-semibold text-blue-600 dark:text-blue-300">
                              {feedbackModal.feedback.user_name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {feedbackModal.feedback.user_name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {feedbackModal.feedback.user_email}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Submitted on {new Date(feedbackModal.feedback.date_time || '').toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>

                        {/* Status */}
                        {feedbackModal.feedback.status && (
                          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Status</p>
                            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium
                            ${feedbackModal.feedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${feedbackModal.feedback.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                            ${feedbackModal.feedback.status === 'rejected' ? 'bg-red-100 text-red-800' : ''}
                            ${feedbackModal.feedback.status === 'completed' ? 'bg-blue-100 text-blue-800' : ''}
                          `}>
                              {feedbackModal.feedback.status.charAt(0).toUpperCase() + feedbackModal.feedback.status.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>


                      {/* Feedback Details */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Feedback</p>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                          {feedbackModal.feedback.details}
                        </p>
                      </div>

                      {/* URL Info */}
                      {feedbackModal.feedback.url && (
                        <div className="mt-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Page URL</p>
                          <p className="text-gray-800 dark:text-gray-200 break-all">
                            {feedbackModal.feedback.url}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
                      {feedbackModal.feedback.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-700/50 dark:hover:bg-green-600/50 text-green-700 dark:text-green-200 font-medium transition-colors"
                            onClick={() => {
                              // Handle approve action
                              closeFeedbackModal();
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-700/50 dark:hover:bg-red-600/50 text-red-700 dark:text-red-200 font-medium transition-colors"
                            onClick={() => {
                              // Handle reject action
                              closeFeedbackModal();
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                        onClick={closeFeedbackModal}
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );

  const ReviewDetailModal = () => (
    <Transition appear show={reviewModal.isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeReviewModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {reviewModal.reviews && (
                  <>
                    {/* Header */}
                    <div className="relative border-b border-gray-200 dark:border-gray-700">
                      <Dialog.Title className="py-6 px-6 text-xl font-semibold text-gray-900 dark:text-white">
                        Task Reviews
                      </Dialog.Title>
                      <button
                        onClick={closeReviewModal}
                        className="absolute right-4 top-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                      <div className="space-y-6">
                        {reviewModal.reviews.map((review, index) => (
                          <div
                            key={`${review.task_id}-${index}`}
                            className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
                          >
                            {/* Task Info */}
                            <div className="mb-4">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {review.task_title}
                              </h3>
                              {review.meeting_title && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Activity: {review.meeting_title}
                                </p>
                              )}
                            </div>

                            {/* Reviewer Info */}
                            <div className="flex items-center gap-4 mb-4">
                              {review.user_avatar ? (
                                <img
                                  src={`${import.meta.env.VITE_API_BASE_URL}/avatars/${review.user_avatar}`}
                                  alt={review.user_name}
                                  className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 shadow-md"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-300">
                                    {review.user_name?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {review.user_name}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(review.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>

                            {/* Rating */}
                            <div className="mb-4">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`w-5 h-5 ${i < review.rate
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  {review.rate}/5
                                </span>
                              </div>
                            </div>

                            {/* Review Text */}
                            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                              {review.review}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                        onClick={closeReviewModal}
                      >
                        Close
                      </button>
                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );


  // const FeedbackWordCloud = () => (
  //   <>
  //     <div className="flex items-center gap-2 mb-4">
  //       <MessageSquare className="w-5 h-5 text-blue-400" />
  //       <h2 className="text-xl font-semibold text-white">
  //         Platform Feedback Word Cloud
  //       </h2>
  //     </div>
  //     <WordCloudCard
  //       title="Click on a word to see the feedback details"
  //       words={feedbackWords}
  //       onWordClick={handleFeedbackWordClick}
  //     />
  //   </>
  // );

  useEffect(() => {
    console.log(feedbackWords)
  }, [feedbackWords])

  // Fetch full user details by ID
  const fetchUserDetails = async (userId: string) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/users/get`,
        { userId },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );
      if (response.data.user) {
        setSelectedUser(response.data.user);
        setIsDrawerOpen(true);
      }
    } catch (err) {
      // fallback: open with minimal data if fetch fails
      const foundUser = topRatedUsers.find(u => u.id === userId);
      if (foundUser) {
        setSelectedUser(foundUser);
        setIsDrawerOpen(true);
      }
    }
  };

  // Handler for clicking a top-rated user
  const handleTopRatedUserClick = (user: any) => {
    // If we already have enough details, open directly, else fetch
    if (user && user.email) {
      setSelectedUser(user);
      setIsDrawerOpen(true);
    } else {
      fetchUserDetails(user.id);
    }
  };

  // Handler for clicking on meeting names
  const handleMeetingClick = (meetingId: string) => {
    // Get the client URL from environment variable, fallback to production URL
    const clientBaseUrl = import.meta.env.VITE_CLIENT_URL || 'https://app.getherd.ai';
    
    // Redirect to the meeting detail page
    window.open(`${clientBaseUrl}/meeting-detail?id=${meetingId}`, '_blank');
  };

  return (
    <div
      className="w-full h-full relative overflow-auto"
      style={{
        background: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
        backgroundImage: `
          radial-gradient(circle at 10% 20%, rgba(255,255,255,0.03) 0%, transparent 20%),
          radial-gradient(circle at 90% 80%, rgba(255,255,255,0.03) 0%, transparent 20%),
          linear-gradient(135deg, #1a365d 0%, #2d3748 100%)
        `,
      }}
    >
      <main className="relative z-10 overflow-auto h-full">
        <div className='p-4 sm:p-6 h-full flex flex-col gap-[20px]'>

          {/* 8-card grid: 2 rows x 4 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            {/* Top row */}
            {isLoading ? (
              <>
                <ChartCardSkeleton />
                <ChartCardSkeleton />
                <ChartCardSkeleton />
                <ChartCardSkeleton />
              </>
            ) : (
              <>
                <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
                  <ChartCard title="Number of Activities" chartData={meetingsData1} type="line" />
                </div>
                <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
                  <ChartCard title="Number of Tasks" chartData={tasksData1} type="line" />
                </div>
                <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
                  <ChartCard title="Average Task Rating" chartData={taskRatingData1} type="bar" />
                </div>
                <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
                  <ChartCard title="Total System Users" chartData={usersGrowthData1} type="line" />
                </div>
              </>
            )}
            {/* Bottom row: Cost/Top Meetings/Top Users */}
            <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
              <ChartCard title="Cost Per Month" chartData={costData1} type="line" />
            </div>
            {/* Top 5 Most Exp Meetings */}
            <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
            <div className="bg-white backdrop-blur-sm rounded-lg shadow-md p-3 sm:p-4 h-full flex flex-col">
              <h3 className="font-semibold text-lg mb-2">Top 5 Most Exp Meetings</h3>
              <ul className="space-y-2">
                {expensiveMeetings.length > 0 ? (
                  expensiveMeetings.map((meeting, idx) => (
                    <li key={meeting.id} className="flex justify-between items-center">
                      <button
                        className="text-left text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none truncate"
                        onClick={() => handleMeetingClick(meeting.id)}
                        title={meeting.title}
                      >
                        {meeting.title}
                      </button>
                      <span>${meeting.cost}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 italic">No expensive meetings found</li>
                )}
              </ul>
            </div>
            </div>
            {/* Top 5 Non Aligned Meetings */}
            <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 h-full flex flex-col">
              <h3 className="font-semibold text-lg mb-2">Top 5 Non Aligned Meetings</h3>
              <ul className="space-y-2">
                {nonAlignedMeetings.length > 0 ? (
                  nonAlignedMeetings.map((item) => (
                    <li key={item.id} className=" flex justify-between items-center">
                      <button
                        className="text-left text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none truncate"
                        onClick={() => handleMeetingClick(item.id)}
                        title={item.title}
                      >
                        {item.title}
                      </button>
                      <span>${item.cost}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 italic">No non aligned meetings found</li>
                )}
              </ul>
            </div>
            </div>
            {/* Top 5 Highly Rated Users */}
            <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4">
            <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 h-full flex flex-col">
              <h3 className="font-semibold text-lg mb-2">Top 5 Highly Rated Users</h3>
              <ul className="space-y-2">
                {topRatedUsers.length > 0 ? (
                  topRatedUsers.map((user) => (
                    <li key={user.id} className="flex justify-between items-center">
                      <button
                        className="text-left text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none"
                        onClick={() => handleTopRatedUserClick(user)}
                      >
                        {user.name}
                      </button>
                      <span>{user.averageRating.toFixed(1)}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-gray-500 italic">No highly rated users found</li>
                )}
              </ul>
            </div>
            </div>
          </div>

          {/* Task Reviews/Feedback Word Cloud at the bottom */}
          <div className="backdrop-blur-sm bg-white/10 rounded-xl p-4 h-full flex flex-col mt-6">
            {company && <>{isTaskReviewLoading && <WordCloudSkeleton />}
              <TaskReviewCloud
                title="Task Reviews Word Cloud"
                isLoading={isTaskReviewLoading}
                words={taskReviewWords}
                onWordClick={handleTaskReviewWordClick}
              /></>}
            {
              !company && <>{isFeedbackLoading && <WordCloudSkeleton />}
                <>
                  <WordCloudCard
                    isLoading={isFeedbackLoading}
                    title="Click on a word to see the feedback details"
                    words={feedbackWords}
                    onWordClick={handleFeedbackWordClick}
                  />
                </>
              </>
            }
          </div>
        </div>
        {FeedbackDetailModal()}
        {ReviewDetailModal()}
        <UserProfileDrawer
          user={selectedUser}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          currentUserRole={currentUser?.role}
        />
      </main>
    </div>
  );
};

export default AdminDashboard;
