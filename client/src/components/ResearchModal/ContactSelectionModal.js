import React, { useState } from 'react';
import { X, User, Building, Search } from 'lucide-react';
import './ResearchModal.css';

const ContactSelectionModal = ({ 
  isOpen, 
  onClose, 
  onProceed, 
  opportunityData,
  selectedContact,
  setSelectedContact 
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Get all contacts: opportunity owner + related contacts
  const allContacts = [];
  
  // Add opportunity owner
  if (opportunityData?.owner) {
    allContacts.push({
      ...opportunityData.owner,
      type: 'Opportunity Owner',
      isOwner: true
    });
  }
  
  // Add related contacts
  if (opportunityData?.related_contacts) {
    opportunityData.related_contacts.forEach(contact => {
      allContacts.push({
        ...contact,
        type: 'Related Contact',
        isOwner: false
      });
    });
  }

  // Filter contacts based on search
  const filteredContacts = allContacts.filter(contact =>
    contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContactSelect = (contact) => {
    setSelectedContact(contact);
  };

  const handleProceed = () => {
    if (selectedContact) {
      onProceed(selectedContact);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content research-modal contact-selection-modal">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center space-x-4">
            <div className="research-icon w-8 h-8">
              <Search className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Select Contact for Research</h2>
              <p className="text-sm text-gray-500">Choose which contact to research alongside the company</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Company Info */}
        <div className="company-info-section enhanced-company-info">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                {opportunityData?.account?.name || 'Company Name'}
              </h3>
              <p className="text-base text-gray-600">
                Company research will be conducted automatically
              </p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                <span>🏢 Industry: {opportunityData?.account?.industry || 'Technology'}</span>
                <span>🌐 Website: {opportunityData?.account?.website || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="search-section enhanced-search">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts by name, email, or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-base"
            />
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Found {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Contact List */}
        <div className="contact-list-section enhanced-contact-list">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Select a contact to research:
            </h4>
            <div className="text-sm text-gray-500">
              {allContacts.length} total contact{allContacts.length !== 1 ? 's' : ''} available
            </div>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {filteredContacts.map((contact, index) => (
              <div
                key={contact.id || index}
                className={`contact-item ${
                  selectedContact?.id === contact.id ? 'selected' : ''
                }`}
                onClick={() => handleContactSelect(contact)}
              >
                <div className="flex items-center space-x-4">
                  <div className={`contact-avatar w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base ${
                    contact.isOwner ? 'owner-avatar' : 'contact-avatar'
                  }`}>
                    {contact.name
                      ? contact.name
                          .split(' ')
                          .map((word) => word.charAt(0))
                          .join('')
                          .toUpperCase()
                      : 'UO'}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="text-lg font-semibold text-gray-900">
                        {contact.name || 'Unnamed Contact'}
                      </h5>
                      <span className={`badge enhanced-badge ${contact.isOwner ? 'owner-badge' : 'contact-badge'}`}>
                        {contact.type}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      {contact.title && (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">💼</span>
                          <span>{contact.title}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">📧</span>
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.department && (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">🏢</span>
                          <span>{contact.department}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-400">📞</span>
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Show which ID will be used for research */}
                    <div className="mt-2 text-xs text-gray-500">
                      {contact.user_id ? (
                        <span className="flex items-center space-x-1">
                          <span>🔑</span>
                          <span>Research ID: {contact.user_id} (INTEGER - Related Contact)</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1">
                          <span>🔑</span>
                          <span>Research ID: {contact.id} (INTEGER - Owner)</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {selectedContact?.id === contact.id && (
                      <div className="selected-indicator">
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer enhanced-footer">
          <button
            onClick={onClose}
            className="btn-secondary enhanced-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleProceed}
            disabled={!selectedContact}
            className={`btn-primary enhanced-btn-primary ${!selectedContact ? 'disabled' : ''}`}
          >
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <span>Start Research</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactSelectionModal;
