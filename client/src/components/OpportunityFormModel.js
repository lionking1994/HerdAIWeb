import React, { useState, useEffect } from "react";
import axios from "axios";

export default function OpportunityForm({
  opportunity = null,
  relationShip = null,
  onSubmit,
  onCancel,
  isSubmitting,
  setrefreshdata,
  refreshdata
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    amount: 0,
    probability: 0,
    stage: "",
    stage_id: "",
    expected_close_date: "",
    actual_close_date: "",
    lead_source: "",
    meeting_id: "",
    account_id: "",
    custom_fields: {},
    opportunity_owner: "",
    relationships: [] // ✅ Added for UI consistency
  });

  const [accounts, setAccounts] = useState([]);
  const [stages, setStages] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [errors, setErrors] = useState({});
  const [relationships, setRelationships] = useState([]);
  const [showAddRelationshipModal, setShowAddRelationshipModal] = useState(false);
  const [newRelationship, setNewRelationship] = useState({});
  const [allContacts, setAllContacts] = useState([]);
  const [isLoadingRelationships, setIsLoadingRelationships] = useState(false);

  const getToken = () => localStorage.getItem("token");
  const getCurrentUserId = () => {
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        return user.id || user.user_id;
      }
      return null;
    } catch {
      return null;
    }
  };


  const apiBase = `${process.env.REACT_APP_API_URL}/crm`;

  const loadFormData = async () => {
    const companyId = opportunity.tenant_id;
    const token = getToken();
    if (!companyId || !token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [accountsRes, stagesRes, usersRes, contactsRes] = await Promise.all([
        axios.get(`${apiBase}/accounts`, { params: { company: companyId }, headers }),
        axios.get(`${apiBase}/stages`, { params: { company: companyId }, headers }),
        axios.post(`${process.env.REACT_APP_API_URL}/users/all`, {
          company: parseInt(companyId || "0"),
          status: "enabled",
          filter: "",
          page: 1,
          per_page: 100
        }, { headers }),
        axios.get(`${apiBase}/contacts`, { params: { company: companyId }, headers })
      ]);

      setAccounts(accountsRes.data?.data || []);
      const sortedStages = (stagesRes.data?.data || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setStages(sortedStages);
      setCompanyUsers(usersRes.data?.users || []);
      setAllContacts(contactsRes.data?.data || []);

      if (!opportunity && sortedStages.length > 0) {
        const firstStage = sortedStages[0];
        setFormData(prev => ({ ...prev, stage: firstStage.name, stage_id: firstStage.id }));
      }
    } catch (e) {
      // Fail silent for client widget
    }
  };

  // Prefill form if editing
  useEffect(() => {
    if (opportunity) {
      setFormData({
        name: opportunity.name || "",
        description: opportunity.description || "",
        amount: opportunity.amount || 0,
        probability: opportunity.probability || 0,
        stage: opportunity.stage || "",
        stage_id: opportunity.stage_id || "",
        expected_close_date: opportunity.expected_close_date?.split("T")[0] || "",
        actual_close_date: opportunity.actual_close_date?.split("T")[0] || "",
        lead_source: opportunity.lead_source || "",
        account_id: opportunity.account_id || "",
        custom_fields: opportunity.custom_fields || {},
        opportunity_owner: opportunity.owner_id || "",
        relationships: relationShip || []
      });
    }
  }, [opportunity]);

  useEffect(() => {
    loadFormData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync local relationships state with incoming prop
  useEffect(() => {
    if (Array.isArray(relationShip)) {
      setRelationships(relationShip);
    } else {
      setRelationships([]);
    }
  }, [relationShip]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name?.trim()) newErrors.name = "Name is required";
    if (!formData.stage_id) newErrors.stage_id = "Stage is required";
    if (formData.amount < 0) newErrors.amount = "Amount must be ≥ 0";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Relationship handlers
  const handleAddRelationship = () => {
    setNewRelationship({});
    setShowAddRelationshipModal(true);
  };

  const handleEditRelationship = (relationship) => {
    setNewRelationship({
      id: relationship.opport_contactid,
      related_entity_type: 'contact',
      related_entity_id: relationship.id,
      relationship_type: relationship.role,
    });
    setShowAddRelationshipModal(true);
  };

  const handleDeleteRelationship = async (relationshipId) => {
    const companyId = opportunity.tenant_id;
    const token = getToken();
    if (!companyId || !token || !relationshipId) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${apiBase}/opportunities/contacts/${relationshipId}`, { params: { company: companyId }, headers });
      // setrefreshdata(!refreshdata)
      setIsLoadingRelationships(true);
      const relRes = await axios.get(`${apiBase}/opportunities/${opportunity.id}/contacts`, { params: { company: companyId }, headers });
      const list = relRes.data?.data || [];
      setRelationships(list.map(rel => ({
        id: rel.contact_id,
        opport_contactid: rel.id,
        related_entity_id: rel.contact_id,
        name: `${rel.first_name || ''} ${rel.last_name || ''}`.trim(),
        role: rel.role,
        created_at: rel.created_at
      })));
      setIsLoadingRelationships(false);
    } catch (e) {
      // ignore
    }
  };

  const handleSaveRelationship = async () => {
    const companyId = opportunity.tenant_id;
    const token = getToken();
    if (!companyId || !token || !opportunity?.id) return;
    if (!newRelationship.related_entity_id || !newRelationship.relationship_type) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      if (newRelationship.id) {
        const existing = relationships.find(r => r.id === newRelationship.id);
        const oldContactId = existing?.related_entity_id || existing?.contact_id;
        const contactChanged = oldContactId && oldContactId !== newRelationship.related_entity_id;
        if (contactChanged) {
          await axios.delete(`${apiBase}/opportunities/contacts/${newRelationship.id}`, { params: { company: companyId }, headers });
          await axios.post(`${apiBase}/opportunities/contacts`, {
            opportunity_id: opportunity.id,
            contact_id: newRelationship.related_entity_id,
            role: newRelationship.relationship_type,
            tenant_id: parseInt(companyId || "0")
          }, { params: { company: companyId }, headers });
        } else {
          await axios.put(`${apiBase}/opportunities/contacts/${newRelationship.id}`, {
            role: newRelationship.relationship_type
          }, { params: { company: companyId }, headers });
        }
      } else {
        await axios.post(`${apiBase}/opportunities/contacts`, {
          opportunity_id: opportunity.id,
          contact_id: newRelationship.related_entity_id,
          role: newRelationship.relationship_type,
          tenant_id: parseInt(companyId || "0")
        }, { params: { company: companyId }, headers });
      }

      // Reload list
      try {
        setIsLoadingRelationships(true);
        const relRes = await axios.get(`${apiBase}/opportunities/${opportunity.id}/contacts`, { params: { company: companyId }, headers });
        const list = relRes.data?.data || [];
        setRelationships(list.map(rel => ({
          id: rel.contact_id,
          opport_contactid: rel.id,
          related_entity_id: rel.contact_id,
          name: `${rel.first_name || ''} ${rel.last_name || ''}`.trim(),
          role: rel.role,
          created_at: rel.created_at
        })));
      } catch {
        // ignore
      } finally {
        setIsLoadingRelationships(false);
        setrefreshdata(!refreshdata)
      }

      setShowAddRelationshipModal(false);
      setNewRelationship({});
    } catch (e) {
      // ignore
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: formData.name,
      description: formData.description,
      amount: formData.amount,
      probability: formData.probability,
      stage_id: formData.stage_id,
      expected_close_date: formData.expected_close_date ? formData.expected_close_date : null,
      actual_close_date: formData.actual_close_date ? formData.actual_close_date : null,
      lead_source: formData.lead_source,
      account_id: formData.account_id,
      owner_id: formData.opportunity_owner ? Number(formData.opportunity_owner) : null,
      custom_fields: { ...formData.custom_fields }
    };

    const allowed = [
      "name", "description", "amount", "probability", "stage_id",
      "expected_close_date", "actual_close_date", "lead_source",
      "account_id", "owner_id", "custom_fields"
    ];
    Object.keys(payload).forEach(k => { if (!allowed.includes(k)) delete payload[k]; });

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-opacity-50 z-50 mt-20 overflow-y-auto">
      <div className="relative mb-30 top-10 mx-auto p-6 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {opportunity ? "Edit Opportunity" : "Create Opportunity"}
          </h3>
          <button
            onClick={onCancel}
            type="button"
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row: Name + Account */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opportunity Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => handleChange("name", e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500 ${errors.name ? 'border-red-500' : ''}`}
                required
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account
              </label>
              <select
                value={formData.account_id}
                onChange={e => handleChange("account_id", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500"
              >
                <option value="">Select Account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}{acc.industry ? ` (${acc.industry})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={e => handleChange("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500"
              placeholder="Enter opportunity description"
            />
          </div>

          {/* Row: Amount, Stage, Lead Source */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={e => handleChange("amount", Number(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500 ${errors.amount ? 'border-red-500' : ''}`}
              />
              {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Stage *
              </label>
              <select
                value={formData.stage_id}
                onChange={e => {
                  const s = stages.find(st => st.id === e.target.value);
                  handleChange("stage_id", e.target.value);
                  handleChange("stage", s?.name || "");
                }}
                className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500 ${errors.stage_id ? 'border-red-500' : ''}`}
                required
              >
                <option value="">Select Stage</option>
                {stages.map(stage => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
              {errors.stage_id && <p className="text-red-500 text-sm mt-1">{errors.stage_id}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead Source
              </label>
              <select
                value={formData.lead_source}
                onChange={e => handleChange("lead_source", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500"
              >
                <option value="">Select Lead Source</option>
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Trade Show">Trade Show</option>
                <option value="Social Media">Social Media</option>
                <option value="Email Campaign">Email Campaign</option>
                <option value="Partner">Partner</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Row: Dates + Owner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Close Date
              </label>
              <input
                type="date"
                value={formData.expected_close_date}
                onChange={e => handleChange("expected_close_date", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                When you expect this opportunity to close
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Close Date
              </label>
              <input
                type="date"
                value={formData.actual_close_date}
                onChange={e => handleChange("actual_close_date", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                When this opportunity actually closed (optional)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Opportunity Owner
              </label>
              <select
                value={formData.opportunity_owner}
                onChange={e => handleChange("opportunity_owner", e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-500"
              >
                <option value="">Select owner</option>
                {companyUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}{u.company_role_name ? ` - ${u.company_role_name}` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Relationships Section */}
          {opportunity?.id && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-md font-medium text-gray-900">Relationships</h4>
                <button
                  type="button"
                  onClick={handleAddRelationship}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                >
                  + Add Relationship
                </button>
              </div>
              {isLoadingRelationships ? (
                <div className="text-center py-4 text-gray-500">Loading relationships...</div>
              ) : relationships.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Relationship
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {relationships.map((relationship) => (
                        <tr key={relationship.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {relationship.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Contact
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {relationship.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {relationship.created_at ? new Date(relationship.created_at).toLocaleDateString() : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => handleEditRelationship(relationship)}
                              className="text-blue-600 hover:text-blue-900 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRelationship(relationship.opport_contactid)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No relationships added yet. Click "Add Relationship" to get started.
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : (opportunity ? "Update Opportunity" : "Create Opportunity")}
            </button>
          </div>
        </form>
      </div>
      {showAddRelationshipModal && (
        <div className="fixed inset-0 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {newRelationship.id ? 'Edit Contact Relationship' : 'Add Contact Relationship'}
              </h3>
              <button
                onClick={() => setShowAddRelationshipModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact *
                </label>
                <select
                  value={newRelationship.related_entity_id || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, related_entity_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select contact</option>
                  {allContacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={newRelationship.relationship_type || ''}
                  onChange={(e) => setNewRelationship(prev => ({ ...prev, relationship_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select role</option>
                  <option value="Owner">Owner</option>
                  <option value="Team Member">Team Member</option>
                  <option value="Stakeholder">Stakeholder</option>
                  <option value="Influencer">Influencer</option>
                  <option value="Decision Maker">Decision Maker</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddRelationshipModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleSaveRelationship();
                    setShowAddRelationshipModal(false);
                    onCancel(); 
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  {newRelationship.id ? 'Update Relationship' : 'Add Relationship'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Modal rendering block appended above within component