import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { FaSpinner, FaLightbulb } from "react-icons/fa";
import { useDispatch } from "react-redux";
import { addResearch } from "../store/slices/upcomingResearchSlice";
import { addcreatemeeting } from "../store/slices/createMeetingSlice";
import { addTask } from "../store/slices/discussTaskSlice";
import DynamicFormModal from "./DynamicFormModal";


const ThreadRecommendationButton = ({
  thread,
  user,
  recommendation,
  isRecommendLoading,
  error,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [config, setConfig] = useState(false)

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  return (
    <div className="inline-flex items-center">
      {recommendation && (
        <button
          onClick={async() => {
            console.log("click this remonnednsklafd", recommendation);
            switch (recommendation) {
              case "Go to Workflow Details": 
                navigate(thread.workflow_link);
                break;
              case "Schedule meeting":
                dispatch(
                  addcreatemeeting({ meeting_topic: thread.task_message })
                );
                break;
              case "Do research":
                dispatch(addResearch({ research_topic: thread.task_message }));
                break;
              case "Help with task":
                dispatch(addTask({ task_title: thread.task_message }));
                break;
              default:
                const token = localStorage.getItem("token");
                console.log("thread", thread);
                const response = await axios.post(
                  `${process.env.REACT_APP_API_URL}/workflow/webhook`,
                  {
                    workflowName : recommendation, 
                    basic_data :  {
                      threadId: thread.task_threads_id,
                      taskId: thread.task_id,
                      threadTitle: thread.task_message,
                      threadDescription: thread.task_description,
                      assignedTo: thread.task_assigned_name,
                      userId: user.id,
                      companyId: thread.task_company_id
                    }
                  },
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );
                // if(response.data.status || response.data.current_node[0]?.type=="formNode"){
                //   setConfig(response.data.current_node[0]?.config);
                //   openModal();
                // }
                break;
            }
          }}
          disabled={isRecommendLoading}
          className="flex items-center gap-1 text-xs text-gray-500 p-1 border-2 rounded-lg border-blue-500 hover:border-3 transition-colors"
          title="Get AI recommendation"
        >
          {isRecommendLoading ? (
            <FaSpinner className="animate-spin" />
          ) : (
            <FaLightbulb className="text-blue-600" />
          )}
          <span>{recommendation}</span>
        </button>
      )}
      {error && <div className="text-xs text-red-500 ml-2">{error}</div>}
      <DynamicFormModal config={config} isOpen={modalOpen} onClose={closeModal} />
    </div>
  );
};

export default ThreadRecommendationButton;
