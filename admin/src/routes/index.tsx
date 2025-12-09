import { Outlet, useRoutes, useSearchParams, useNavigate } from 'react-router-dom';
import AdminDashboard from '../pages/AdminDashboard';
import Forbidden from '../pages/Forbidden';
import UserManagement from '../pages/UserManagement';
import CompanyManagement from '../pages/CompanyManagement';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useEffect, useState } from 'react';
import Footer from '../components/Footer';
import Settings from '../pages/Settings';
import SystemSettings from '../pages/SystemSettings';
import FeedbackManagement from '../pages/FeedbackManagement';
import SystemLogs from '../pages/SystemLogs';
import { useAuth } from '../contexts/AuthContext';
import Meetings from '../pages/Meetings';
import SubscriptionSettings from '../pages/SubscriptionSettings';
import CompanyRoles from '../pages/CompanyRoles';
import UserAnalytics from '../pages/UserAnalytics';
import Workflows from '../pages/Workflows';
import WorkflowBuilderPage from '../pages/WorkflowBuilderPage';
import UserLicenses from '../pages/UserLicenses';
import InitiativeIntelligence from "../pages/InitiativeIntelligence";
import TemplateManagement from '../pages/TemplateManagement';
import LmsAdministration from '../pages/LmsAdministration';
import axios from 'axios';
import LoadingScreen from '../components/LoadingScreen';
import PSADashboard from '../pages/PSA/Dashboard';
import PSAResources from '../pages/PSA/Resources';
import PSAProjects from '../pages/PSA/Projects';
import PSATemplates from '../pages/PSA/Templates';
import PSASkillsCertifications from '../pages/PSA/SkillsCertifications';
import PSAReports from '../pages/PSA/Reports';


// NEW: Import CRM components
import CRMDashboard from '../pages/CRM/Dashboard';
import CRMAccounts from '../pages/CRM/Accounts';
import CRMContacts from '../pages/CRM/Contacts';
import CRMOpportunities from '../pages/CRM/Opportunities';
// import OpportunityDetail from '../pages/CRM/OpportunityDetail';
import CRMCustomFields from '../pages/CRM/CustomFields';
import CRMStages from '../pages/CRM/Stages';
import CRMRelationshipTypes from '../pages/CRM/RelationshipTypes';
import CRMEmailProcessing from '../pages/EmailProcessing'

export default function Routes() {
  // const { user } = useAuth();
  return useRoutes([
    {
      path: '/',
      element: <MainLayout />,
      children: [
        {
          path: '/',
          element: <AdminDashboard />,
        },
        {
          path: '/user-management',
          element: <UserManagement />,
        },
        {
          path: '/company-management',
          element: <CompanyManagement />,
        },
        {
          path: '/settings',
          element: <Settings />,
        },
        {
          path: '/system-settings',
          element: <SystemSettings />,
        },
        {
          path: '/feedback-management',
          element: <FeedbackManagement />,
        },
        {
          path: '/system-logs',
          element: <SystemLogs />,
        },
        {
          path: '/meetings',
          element: <Meetings />,
        },
        {
          path: '/subscription-settings',
          element: <SubscriptionSettings />,
        },
        {
          path: '/company-roles',
          element: <CompanyRoles />,
        },
        {
          path: '/user-analytics',
          element: <UserAnalytics />,
        },
        {
          path: '/workflows',
          element: <Workflows />,
        },
        {
          path: '/workflow-builder',
          element: <WorkflowBuilderPage />,
        },
        {
          path: '/user-licenses',
          element: <UserLicenses />,
        },
        {
          path: '/email-processing',
          element: <CRMEmailProcessing />,
        },
        {
          path: '/initiative-intelligence',
          element: <InitiativeIntelligence/>,
        },
        {
          path: '/templates',
          element: <TemplateManagement />,
        },
        //CRM
        {
          path: '/crm',
          element: <CRMDashboard />,
        },
        {
          path: '/crm/accounts',
          element: <CRMAccounts />,
        },
        {
          path: '/crm/contacts',
          element: <CRMContacts />,
        },
        {
          path: '/crm/opportunities',
          element: <CRMOpportunities />,
        },
        // {
        //   path: '/crm/opportunities/:id',
        //   element: <OpportunityDetail />,
        // },
        {
          path: '/crm/custom-fields',
          element: <CRMCustomFields />,
        },
        {
          path: '/crm/stages',
          element: <CRMStages />,
        },
        {
          path: '/crm/relationship-types',
          element: <CRMRelationshipTypes />,
        },
          {
              path: '/lms-admin',
              element: <LmsAdministration />,
          },
          {
            path: '/psa',
            element: <PSADashboard />,
          },
          {
            path: '/psa/resources',
            element: <PSAResources />,
          },
          {
            path: '/psa/projects',
            element: <PSAProjects />,
          },
          {
            path: '/psa/templates',
            element: <PSATemplates />,
          },
          {
            path: '/psa/skills-certifications',
            element: <PSASkillsCertifications />,
          },
          {
            path: '/psa/reports',
            element: <PSAReports />,
          },
      ],
    },
    {
      path: '/403',
      element: <Forbidden />,
    }
  ]);
}

const MainLayout = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log(token)
    if (token) {
      localStorage.setItem('token', token);
      setSearchParams({});
      console.log(token);
    }
    else {
      if (!localStorage.getItem('token')) {
        checkPermission();
        navigate('/403');
      }
    }
  }, [token, setSearchParams]);

  const checkPermission = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/auth/check-admin-permission`,
        {}, // Empty body for POST request
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },  
      );

      if (response.status === 403) {
        navigate('/403');
      }

    } catch (error) {
      console.error("Error fetching user data:", error);
      navigate('/403');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function checkPermission1() {
      try {
        console.log(user)
        console.log("----------------------------------------")
        if (user && (user.role != 'padmin' && user.role != 'cadmin' && user.role != 'dev')) {
          await checkPermission();
          navigate('/403');
          // alert('user role not allowed');
        }
        if (user?.role === 'cadmin' && !searchParams.get('company')) {
          navigate(`/?company=${user?.company_id}`);
        }

      } catch (error) {
        console.error("Error checking permissions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    if (user)
      checkPermission1();
  }, [user])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <div className='w-screen h-screen overflow-hidden flex'>
      {isMobile && isMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="bg-gray-900 text-white w-64 h-screen overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar onClose={handleCloseMenu} />
          </div>
        </div>
      )}
      {!isMobile && <Sidebar />}
      <div className='w-full h-full flex flex-col min-h-0'>
        <Header
          isMobile={isMobile}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
        />
        <div className='flex-1 min-h-0 overflow-y-auto flex flex-col'>
          <Outlet />
        </div>
        <Footer />
      </div>
    </div>
  );
};
