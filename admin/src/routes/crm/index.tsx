// import React from 'react';
// import { Routes, Route } from 'react-router-dom';
// import Dashboard from '../../pages/CRM/Dashboard';
// import Accounts from '../../pages/CRM/Accounts';
// import Contacts from '../../pages/CRM/Contacts';
// import Opportunities from '../../pages/CRM/Opportunities';
// import CustomFields from '../../pages/CRM/CustomFields';
// import Stages from '../../pages/CRM/Stages';

// const CRMRoutes: React.FC = () => {
//   return (
//     <Routes>
//       <Route path="/" element={<Dashboard />} />
//       <Route path="/accounts" element={<Accounts />} />
//       <Route path="/contacts" element={<Contacts />} />
//       <Route path="/opportunities" element={<Opportunities />} />
//       <Route path="/custom-fields" element={<CustomFields />} />
//       <Route path="/stages" element={<Stages />} />
//     </Routes>
//   );
// };

// export default CRMRoutes;

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from '../../pages/CRM/Dashboard';
import Accounts from '../../pages/CRM/Accounts';
import Contacts from '../../pages/CRM/Contacts';
import Opportunities from '../../pages/CRM/Opportunities';
import CustomFields from '../../pages/CRM/CustomFields';
import Stages from '../../pages/CRM/Stages';
import RelationshipTypes from '../../pages/CRM/RelationshipTypes';

const CRMRoutes: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* CRM Header/Navigation */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">CRM System</h1>
              </div>
              <nav className="ml-6 flex space-x-8">
                <a href="/crm" className="text-gray-900 hover:text-gray-500 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </a>
                <a href="/crm/accounts" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Accounts
                </a>
                <a href="/crm/contacts" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Contacts
                </a>
                <a href="/crm/opportunities" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Opportunities
                </a>
                <a href="/crm/custom-fields" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Custom Fields
                </a>
                <a href="/crm/stages" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Stages
                </a>
                <a href="/crm/relationship-types" className="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Relationship Types
                </a>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* CRM Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/custom-fields" element={<CustomFields />} />
          <Route path="/stages" element={<Stages />} />
          <Route path="/relationship-types" element={<RelationshipTypes />} />
        </Routes>
      </div>
    </div>
  );
};

export default CRMRoutes;