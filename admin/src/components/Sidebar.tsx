import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut,
  Home,
  FileClock,
  MessageCircleCode,
  CreditCard,
  BarChart3,
  GitBranch,
  Key,
  PieChart,
  FileText,
  // NEW: CRM Icons
  UserCheck,
  TrendingUp,
  Cog,
  ListOrdered,
  Database,
  ChevronDown,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  onClose?: () => void;
}


const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const company = searchParams.get('company');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [companyName, setCompanyName] = useState<string>('');
  const [isCrmExpanded, setIsCrmExpanded] = useState(
    location.pathname.startsWith("/crm")
  );
  const [isPsaExpanded, setIsPsaExpanded] = useState(
    location.pathname.startsWith("/psa")
  );


  useEffect(() => {
    if (location.pathname.startsWith("/crm")) {
      setIsCrmExpanded(true);
    }
    if (location.pathname.startsWith("/psa")) {
      setIsPsaExpanded(true);
    }
  }, [location.pathname]);
  const { user } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchCompanyName = async () => {
      if (company) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(
            `${import.meta.env.VITE_API_BASE_URL}/company/${company}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          setCompanyName(response.data.company.name);
        } catch (error) {
          console.error('Error fetching company:', error);
          setCompanyName('Unknown Company');
        }
      }
    };

    fetchCompanyName();
  }, [company]);

  // NEW: CRM Menu Items
  const crmMenuItems = company ? [
    { path: `/crm?company=${company}`, icon: Building2, label: 'CRM Dashboard' },
    { path: `/crm/accounts?company=${company}`, icon: Building2, label: 'Accounts' },
    { path: `/crm/contacts?company=${company}`, icon: UserCheck, label: 'Contacts' },
    { path: `/crm/opportunities?company=${company}`, icon: TrendingUp, label: 'Opportunities' },
    { path: `/crm/custom-fields?company=${company}`, icon: Database, label: 'Custom Fields' },
    { path: `/crm/stages?company=${company}`, icon: ListOrdered, label: 'Opportunity Stages' },
    { path: `/crm/relationship-types?company=${company}`, icon: GitBranch, label: 'Relationship Types' },
    
  ] : [];

  const psaMenuItems = company ? [
    { path: `/psa?company=${company}`, icon: Building2, label: 'Dashboard' },
    { path: `/psa/resources?company=${company}`, icon: UserCheck, label: 'Resources' },
    { path: `/psa/projects?company=${company}`, icon: Building2, label: 'Projects' },
    { path: `/psa/templates?company=${company}`, icon: Database, label: 'Templates' },
    { path: `/psa/skills-certifications?company=${company}`, icon: GraduationCap, label: 'Skills & Certs' },
    { path: `/psa/reports?company=${company}`, icon: ListOrdered, label: 'Reports' },
  ] : [];

  const menuItems = company ? [
    { path: `/?company=${company}`, icon: Building2, label: 'Company' },
    { path: `user-management?company=${company}`, icon: Users, label: 'Users' },
    { path: `company-roles?company=${company}`, icon: Users, label: 'Company Roles' },
    { path: `workflows?company=${company}`, icon: GitBranch, label: 'Workflows' },
    { path: `initiative-intelligence?company=${company}`, icon: PieChart, label: "Initiative Intelligence" },
    { path: `templates?company=${company}`, icon: FileText, label: 'Templates' },
    { path: `email-processing?company=${company}`, icon: Building2, label: 'Email Processing' },
    { path: `user-analytics?company=${company}`, icon: BarChart3, label: 'User Analytics' },
    // { path: `user-licenses?company=${company}`, icon: Key, label: 'User Licenses' },
    { path: `settings?company=${company}`, icon: Settings, label: 'Settings' },
    { path: `meetings?company=${company}`, icon: FileClock, label: 'Activities' },
    // NEW: CRM Section Separator
    //  { path: '', icon: null, label: '--- CRM System ---', isSeparator: true },
    // NEW: CRM Menu Items
    ...crmMenuItems,
    { path: `lms-admin?company=${company}`, icon: GraduationCap, label: 'LMS Admin' },
  ] :
    [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/user-management', icon: Users, label: 'Users' },
      { path: '/company-management', icon: Building2, label: 'Companies' },
      { path: '/user-analytics', icon: BarChart3, label: 'User Analytics' },
      { path: '/user-licenses', icon: Key, label: 'User Licenses' },
      { path: '/lms-admin', icon: GraduationCap, label: 'LMS Admin' },
      // { path: "/initiative-intelligence", icon: PieChart, label: "Initiative Intelligence" },
      { path: '/system-settings', icon: Settings, label: 'System Settings' },
      { path: '/subscription-settings', icon: CreditCard, label: 'Subscriptions' },
      { path: '/feedback-management', icon: MessageCircleCode, label: 'Feedback' },
      { path: '/system-logs', icon: FileClock, label: 'System Logs' },
      
      // NEW: CRM Section Separator
      // { path: '', icon: null, label: '--- CRM System ---', isSeparator: true },
      // // NEW: CRM Menu Items
      // ...crmMenuItems,
    ];

  console.log("📌 CRM Menu Items:", crmMenuItems);
  console.log("📌 PSA Menu Items:", psaMenuItems);
  console.log("📌 Final Menu Items:", menuItems);

  const handleLogout = () => {
    localStorage.removeItem('token');

    // Clear meeting platform check flags for all users on logout
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('meeting-platform-check-shown-')) {
        localStorage.removeItem(key);
      }
    });

    if (isMobile && onClose) onClose();
    window.location.href = '/signin';
  };

  const handleNavigation = (path: string) => {
    if (isMobile && onClose) onClose();
    navigate(path);
  };

  const toggleCrmExpansion = () => {
    setIsCrmExpanded(!isCrmExpanded);
  };
  const togglePsaExpansion = () => {
    setIsPsaExpanded(!isPsaExpanded);
  };

  const isActive = (path: string) => {
    console.log(location.pathname)
    if (!company)
      return location.pathname === path;
    else {
      return location.pathname + location.search === path;
    }
  }

  return (
    <div className="bg-gray-900 text-white w-64 flex flex-col h-screen flex-0">
      <div className="p-5 border-b border-gray-800">
        <h2 className="text-xl font-bold">
          {company ? `Company: ${companyName}` : 'Platform'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-2 space-y-1">
          {company && (
            <>
              {/* Company menu items */}
              <button
                onClick={() => handleNavigation(`/?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`/?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Building2 className="mr-3 h-5 w-5" />
                Company
              </button>

              <button
                onClick={() => handleNavigation(`user-management?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`user-management?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Users className="mr-3 h-5 w-5" />
                Users
              </button>

              <button
                onClick={() => handleNavigation(`company-roles?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`company-roles?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Users className="mr-3 h-5 w-5" />
                Company Roles
              </button>

              <button
                onClick={() => handleNavigation(`workflows?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`workflows?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <GitBranch className="mr-3 h-5 w-5" />
                Workflows
              </button>

              <button
                onClick={() => handleNavigation(`initiative-intelligence?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`initiative-intelligence?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <PieChart className="mr-3 h-5 w-5" />
                Initiative Intelligence
              </button>

              <button
                onClick={() => handleNavigation(`templates?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`templates?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <FileText className="mr-3 h-5 w-5" />
                Templates
              </button>

              <button
                onClick={() => handleNavigation(`email-processing?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`email-processing?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <PieChart className="mr-3 h-5 w-5" />
                Email Processing
              </button>

              <button
                onClick={() => handleNavigation(`user-analytics?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`user-analytics?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <BarChart3 className="mr-3 h-5 w-5" />
                User Analytics
              </button>

              <button
                onClick={() => handleNavigation(`settings?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`settings?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <Settings className="mr-3 h-5 w-5" />
                Settings
              </button>

              <button
                onClick={() => handleNavigation(`meetings?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`meetings?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <FileClock className="mr-3 h-5 w-5" />
                Activities
              </button>

              {/* CRM Section Separator */}
              {/* <div className="px-4 py-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-700 pb-1">
                  CRM System
                </div>
              </div> */}

              {/* CRM Main Button */}
              <button
                onClick={toggleCrmExpansion}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <div className="flex items-center">
                  <Building2 className="mr-3 h-5 w-5" />
                  CRM
                </div>
                {isCrmExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>



              {/* CRM Sub-items */}
              {isCrmExpanded && (
                <div className="ml-4 space-y-1">
                  {crmMenuItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive(item.path)
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                    >
                      {item.icon && <item.icon className="mr-3 h-4 w-4" />}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={togglePsaExpansion}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <div className="flex items-center">
                  <Building2 className="mr-3 h-5 w-5" />
                  PSA
                </div>
                {isPsaExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>



              {/* CRM Sub-items */}
              {isPsaExpanded && (
                <div className="ml-4 space-y-1">
                  {psaMenuItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => handleNavigation(item.path)}
                      className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive(item.path)
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                    >
                      {item.icon && <item.icon className="mr-3 h-4 w-4" />}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => handleNavigation(`lms-admin?company=${company}`)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(`lms-admin?company=${company}`)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
              >
                <GraduationCap className="mr-3 h-5 w-5" />
                LMS Admin
              </button>
            </>
          )}

          {/* Non-company menu items */}
          {!company && menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-md ${isActive(item.path)
                ? 'bg-gray-800 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
            >
              {item.icon && <item.icon className="mr-3 h-5 w-5" />}
              {item.label}
            </button>
          ))}
          {/* Home Button */}
          <a
            href={company && user?.role !== 'cadmin' ? `${window.location.origin}${import.meta.env.VITE_ADMIN_SUBPATH}/` : "/"}
            onClick={() => {
              if (isMobile && onClose) {
                onClose();
              }
            }}
            className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <Home className="mr-3 h-5 w-5" />
            Home
          </a>
        </nav>
      </div>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;