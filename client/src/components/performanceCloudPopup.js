import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Typography, Grid, Card, CardContent, Box } from "@mui/material";
import ReactWordcloud from "react-wordcloud";
import { Dialog, Transition } from "@headlessui/react";
import { toast } from "react-toastify";
import { Fragment } from "react";
import { Loader2, ChevronDown, X, Star } from "lucide-react";

const PerformanceCloudPopup = ({ isOpen, onClose, user }) => {
  const [performanceData, setPerformanceData] = useState([]);
  const [fetchStatus, setFetchStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuarterChanging, setIsQuarterChanging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = React.useRef(null);
  const [options, setOptions] = useState({});
  const [selectedQuarter, setSelectedQuarter] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    reviews: null,
  });

  const getCurrentQuarter = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentQuat = Math.floor(now.getMonth() / 3) + 1;
    return `Q${currentQuat}/${currentYear}`;
  };

  const generateQuarters = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    // Start with YTD option
    const quarters = [`YTD/${currentYear}`];

    // Add quarters up to the current one
    for (let q = 1; q <= 4; q++) {
      if (q <= currentQuarter) {
        quarters.push(`Q${q}/${currentYear}`);
      }
    }

    return quarters;
  };

  useEffect(() => {
    console.log("isOpen", isOpen);
    setSelectedQuarter(getCurrentQuarter());
  }, []);

  const fetchPerformanceData = async (quarter) => {
    setIsQuarterChanging(true);
    try {
      const token = localStorage.getItem("token");
      const [period, year] = quarter.split("/");

      let params = {
        year: parseInt(year),
        userId: user.id, 
      };

      if (period !== "YTD") {
        params.quarter = parseInt(period.substring(1));
      }

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/tasks/get-user-performance-cloud`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params,
        }
      );
      setFetchStatus(true);
      setPerformanceData(response.data.performanceCloud);
    } catch (error) {
      toast.error("Failed to fetch performance data");
      console.error("Error fetching performance data:", error);
    } finally {
      setIsLoading(false);
      setIsQuarterChanging(false);
    }
  };

  useEffect(() => {
    if (selectedQuarter) {
      fetchPerformanceData(selectedQuarter);
    }
  }, [selectedQuarter]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const updateOptions = () => {
      setOptions({
        colors: [
          "#FF6B6B",
          "#4ECDC4",
          "#45B7D1",
          "#96CEB4",
          "#FFEEAD",
          "#D4A5A5",
          "#9B59B6",
          "#3498DB",
          "#E67E22",
          "#2ECC71",
          "#F1C40F",
          "#E74C3C",
        ],
        enableTooltip: false,
        deterministic: true,
        fontFamily: "Impact",
        fontSizes: [
          window.innerWidth < 600 ? 18 : window.innerWidth < 960 ? 22 : 25,
          window.innerWidth < 600 ? 30 : window.innerWidth < 960 ? 35 : 50,
        ],
        size: ["100%", "100%"],
        fontStyle: "normal",
        fontWeight: "bold",
        padding: 1,
        rotations: 2,
        rotationAngles: [0],
        scale: "log",
        spiral: "rectangular",
        transitionDuration: 1000,
        responsive: true,
      });
    };

    updateOptions();
    window.addEventListener("resize", updateOptions);
    return () => window.removeEventListener("resize", updateOptions);
  }, []);

  const words = performanceData.length > 0 ? performanceData : [];

  const handleQuarterSelect = (quarter) => {
    setSelectedQuarter(quarter);
    setIsDropdownOpen(false);
  };

  const handleWordClick = async (word) => {
    try {
      console.log(word);
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/tasks/get-task-review-details`,
        {
          id: word.id, // Array of task IDs associated with the theme
          period: selectedQuarter,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setReviewModal({
          isOpen: true,
          reviews: response.data.reviews,
        });
      }
    } catch (error) {
      toast.error("Failed to fetch review details");
      console.error("Error fetching review details:", error);
    }
  };

  const closeReviewModal = () => {
    setReviewModal({
      isOpen: false,
      reviews: null,
    });
  };

  const ReviewDetailModal = () => (
    <Transition appear show={reviewModal.isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[700003]" onClose={closeReviewModal}>
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
                              {review.meeting_owner_avatar ? (
                                <img
                                  src={`${process.env.REACT_APP_API_URL}/avatars/${review.meeting_owner_avatar}`}
                                  alt={review.meeting_owner_name}
                                  className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-700 shadow-md"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-300">
                                    {review.meeting_owner_name
                                      ?.charAt(0)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">
                                  {review.meeting_owner_name}
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(
                                    review.created_at
                                  ).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
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
                                      className={`w-5 h-5 ${
                                        i < review.rate
                                          ? "text-yellow-400 fill-yellow-400"
                                          : "text-gray-300 dark:text-gray-600"
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

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-[700000]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl z-[700001] y-[60%] overflow-y-auto w-full max-w-md"
          >
            <div className="flex-1 overflow-auto w-full px-4">
              <Box sx={{ py: 4 }} className="h-full">
                <div className="flex justify-between items-center mb-6">
                  <Typography variant="h4" component="h1">
                    {user.name} Performance
                  </Typography>

                  <div className="relative flex flex-column">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50"
                      disabled={isQuarterChanging}
                    >
                      <span className="font-medium">
                        {selectedQuarter.startsWith("YTD")
                          ? `Year to Date ${selectedQuarter.split("/")[1]}`
                          : selectedQuarter}
                      </span>
                      {isQuarterChanging ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[700002]">
                        {generateQuarters().map((quarter) => (
                          <button
                            key={quarter}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-50 ${
                              isQuarterChanging
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                            onClick={() => handleQuarterSelect(quarter)}
                            disabled={isQuarterChanging}
                          >
                            {quarter.startsWith("YTD")
                              ? `Year to Date ${quarter.split("/")[1]}`
                              : quarter}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                    >
                      <X className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <Grid container spacing={3} className="h-full">
                  <Grid item xs={12} className="h-full">
                    <Card className="h-full">
                      <CardContent className="h-full">
                        <Typography variant="h6" gutterBottom></Typography>
                        <Box
                          ref={containerRef}
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            height: "100%",
                            width: "100%",
                            overflow: "hidden",
                          }}
                        >
                          <div style={{ width: "100%", height: "100%" }}>
                            {isLoading || isQuarterChanging ? (
                              <div className="flex items-center justify-center min-h-[300px]">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                              </div>
                            ) : words.length === 0 && fetchStatus ? (
                              <Typography variant="h5" align="center">
                                No completed tasks yet. Start completing tasks
                                to see your performance cloud!
                              </Typography>
                            ) : (
                              <ReactWordcloud
                                words={words}
                                options={options}
                                callbacks={{
                                  onWordClick: (word) => {
                                    handleWordClick(word);
                                  },
                                }}
                              />
                            )}
                          </div>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            </div>
          </motion.div>
        </>
      )}
      <ReviewDetailModal />
    </AnimatePresence>
  );
};

export default PerformanceCloudPopup;
