# Meeting JSON Relationship Parsing Guide

## Overview

This document explains how the enhanced `UpdateNodeExecutor` processes meeting JSON data to automatically create relationships between CRM entities (accounts, contacts, and opportunities) based on the edges in the graph visualization.

## 🔄 Process Flow

### 1. Meeting JSON Generation
After a meeting ends, the system generates JSON data with nodes and edges representing the meeting content:

```json
{
  "graph_data": {
    "visualization": {
      "nodes": [
        {
          "id": "person_1",
          "label": "Matt Francis",
          "email": "matt.francis@getherd.ai",
          "group": "person"
        },
        {
          "id": "company_1", 
          "label": "getherd",
          "group": "company"
        },
        {
          "id": "opportunity_1",
          "label": "Small & Mid-Market Company CRM Licenses",
          "group": "opportunity"
        }
      ],
      "edges": [
        {
          "from": "person_1",
          "to": "company_1",
          "label": "works at",
          "thickness": 3
        },
        {
          "from": "person_1",
          "to": "opportunity_1",
          "label": "targets small/mid-market",
          "thickness": 3
        }
      ]
    }
  }
}
```

### 2. UpdateNodeExecutor Processing
The `UpdateNodeExecutor` processes this JSON data in two phases:

#### Phase 1: Entity Creation
- Creates accounts from `company` nodes
- Creates contacts from `person` nodes  
- Creates opportunities from `opportunity` nodes
- Builds a map of created entities for relationship creation

#### Phase 2: Relationship Creation
- Parses edges to extract relationship types
- Maps edge labels to standard relationship types
- Creates relationships in appropriate CRM tables

## 🔗 Relationship Type Parsing

### Edge Label Sources
The system looks for relationship types in this priority order:
1. `relationship_type` - Explicit relationship type
2. `role` - Role-based relationship
3. `type` - Type-based relationship
4. `label` - Edge label (most common in meeting data)
5. `title` - Title-based relationship
6. `group` - Group-based relationship

### Edge Label Mapping
The system maps natural language edge labels to standard relationship types:

#### Account ↔ Contact Relationships
| Edge Label | Mapped Type | Description |
|------------|-------------|-------------|
| "works at" | "employs" | Employee relationship |
| "employed by" | "employs" | Employee relationship |
| "employee" | "employs" | Employee relationship |
| "manager" | "employs" | Manager relationship |
| "director" | "employs" | Director relationship |
| "executive" | "employs" | Executive relationship |
| "owner" | "employs" | Owner relationship |
| "founder" | "employs" | Founder relationship |
| "ceo" | "employs" | CEO relationship |
| "cto" | "employs" | CTO relationship |
| "cfo" | "employs" | CFO relationship |
| "vice president" | "employs" | VP relationship |
| "vp" | "employs" | VP relationship |
| "head of" | "employs" | Head of department |
| "lead" | "employs" | Team lead |
| "specialist" | "employs" | Specialist |
| "analyst" | "employs" | Analyst |
| "decision maker" | "employs" | Decision maker |
| "advisor" | "employs" | Advisor |
| "consultant" | "employs" | Consultant |
| "vendor" | "employs" | Vendor |
| "stakeholder" | "employs" | Stakeholder |

#### Account ↔ Account Relationships
| Edge Label | Mapped Type | Description |
|------------|-------------|-------------|
| "parent company" | "parent_child" | Parent-child relationship |
| "child company" | "parent_child" | Parent-child relationship |
| "subsidiary" | "parent_child" | Subsidiary relationship |
| "sister company" | "parent_child" | Sister company relationship |
| "holding company" | "parent_child" | Holding company relationship |
| "affiliate" | "parent_child" | Affiliate relationship |
| "branch" | "parent_child" | Branch relationship |
| "division" | "parent_child" | Division relationship |
| "department" | "parent_child" | Department relationship |
| "partner" | "partner" | Partnership relationship |
| "competitor" | "competitor" | Competitor relationship |
| "supplier" | "supplier" | Supplier relationship |
| "customer" | "customer" | Customer relationship |

#### Contact ↔ Opportunity Relationships
| Edge Label | Mapped Type | Description |
|------------|-------------|-------------|
| "targets" | "Influencer" | Influencer role |
| "supports" | "Influencer" | Influencer role |
| "demonstrates" | "Influencer" | Influencer role |
| "engages" | "Influencer" | Influencer role |
| "focuses on" | "Influencer" | Influencer role |
| "focus on" | "Influencer" | Influencer role |
| "influencer" | "Influencer" | Influencer role |
| "decision maker" | "Decision Maker" | Decision maker role |
| "champion" | "Champion" | Champion role |
| "user" | "User" | User role |
| "technical contact" | "Technical Contact" | Technical contact role |
| "economic buyer" | "Economic Buyer" | Economic buyer role |
| "owner" | "Owner" | Owner role |
| "stakeholder" | "Stakeholder" | Stakeholder role |
| "team member" | "Team Member" | Team member role |
| "project manager" | "Project Manager" | Project manager role |
| "sponsor" | "Sponsor" | Sponsor role |

## 🗄️ Database Tables Used

### 1. Account Relationships (`account_relationships`)
For account-to-account relationships:
```sql
INSERT INTO account_relationships (
  id, tenant_id, parent_account_id, child_account_id, 
  relationship_type, description, created_by
) VALUES (...)
```

### 2. Account Contacts (`account_contacts`)
For account-to-contact relationships:
```sql
INSERT INTO account_contacts (
  id, tenant_id, account_id, contact_id, 
  relationship_type, role, is_primary, description
) VALUES (...)
```

### 3. Opportunity Contacts (`opportunity_contacts`)
For contact-to-opportunity relationships:
```sql
INSERT INTO opportunity_contacts (
  id, tenant_id, opportunity_id, contact_id, role
) VALUES (...)
```

## 📊 Example Processing

### Input JSON Edge
```json
{
  "from": "person_1",
  "to": "company_1", 
  "label": "works at",
  "thickness": 3
}
```

### Processing Steps
1. **Entity Lookup**: Find `person_1` (contact) and `company_1` (account) in created entities
2. **Label Parsing**: Extract "works at" from edge label
3. **Type Mapping**: Map "works at" → "employs"
4. **Validation**: Validate "employs" for contact→account relationship
5. **Relationship Creation**: Create record in `account_contacts` table

### Output Relationship
```json
{
  "id": "uuid-123",
  "tenant_id": "tenant-456",
  "account_id": "account-789",
  "contact_id": "contact-123",
  "relationship_type": "employs",
  "role": "Employee",
  "is_primary": false,
  "description": "Contact relationship between getherd and Matt Francis"
}
```

## 🔧 Configuration

### UpdateNodeExecutor Configuration
```javascript
const updateConfig = {
  updateType: 'database',
  table: 'crm_entities',
  method: 'insert'
};
```

### Workflow Node Configuration
```javascript
{
  "type": "update",
  "config": {
    "updateType": "database",
    "table": "crm_entities", 
    "method": "insert"
  }
}
```

## 🚀 Usage Examples

### 1. Basic Meeting Processing
```javascript
const executor = new UpdateNodeExecutor(io);
const result = await executor.execute(nodeInstance, node, workflowInstance, {
  graph_data: meetingJsonData
});
```

### 2. Custom Relationship Types
```javascript
// Add custom relationship type mapping
const customMapping = {
  "technical advisor": "Technical Contact",
  "business sponsor": "Sponsor",
  "key stakeholder": "Stakeholder"
};
```

### 3. Relationship Validation
```javascript
const validation = executor.validateRelationshipType(
  "works at", 
  "contact", 
  "account"
);
// Returns: { isValid: true, type: "employs" }
```

## 🛠️ Error Handling

### Common Issues and Solutions

1. **Missing Entities**
   - Error: "entities not found in created entities"
   - Solution: Ensure all nodes are processed before creating relationships

2. **Invalid Relationship Types**
   - Error: "Invalid relationship type"
   - Solution: Use standard relationship types or add custom mappings

3. **Duplicate Relationships**
   - Error: "duplicate relationship"
   - Solution: System automatically skips duplicates

4. **Missing Tenant Context**
   - Error: "Tenant ID is required"
   - Solution: Ensure tenant context is set

## 📈 Performance Considerations

### Optimization Tips
1. **Batch Processing**: Process all entities first, then all relationships
2. **Duplicate Prevention**: Check for existing relationships before creating
3. **Validation Caching**: Cache relationship type validations
4. **Error Recovery**: Continue processing other relationships if one fails

### Monitoring
- Log all relationship creation attempts
- Track mapping success rates
- Monitor processing time
- Alert on high error rates

## 🔍 Testing

### Test Script
Run the test script to verify functionality:
```bash
node test_meeting_json_parsing.js
```

### Test Cases
1. **Edge Label Mapping**: Verify correct mapping of edge labels
2. **Relationship Creation**: Test actual database insertions
3. **Error Handling**: Test with invalid data
4. **Performance**: Test with large datasets

## 📝 Logging

### Log Levels
- **INFO**: Successful operations
- **WARN**: Non-critical issues (missing mappings, duplicates)
- **ERROR**: Critical failures (database errors, missing entities)

### Log Format
```
🔗 Processing edge: person_1 -> company_1
   Edge data: { label: "works at", thickness: 3 }
✅ Found entities: contact:123 -> account:456
📝 Found relationship type source: works at
🔄 Mapped edge label "works at" to relationship type "employs"
✅ Created relationship using AccountContact: contact:123 -> account:456 (employs)
```

## 🔄 Future Enhancements

### Planned Features
1. **AI-Powered Mapping**: Use AI to improve edge label mapping
2. **Custom Relationship Types**: Allow users to define custom types
3. **Bidirectional Relationships**: Support for bidirectional relationship creation
4. **Relationship Strength**: Use edge thickness to determine relationship strength
5. **Temporal Relationships**: Support for time-based relationships

### API Extensions
1. **Bulk Relationship Creation**: API for bulk relationship processing
2. **Relationship Templates**: Predefined relationship templates
3. **Relationship Analytics**: Analytics on relationship patterns
4. **Relationship Validation Rules**: Custom validation rules

## 📚 Related Documentation

- [CRM Multi-Tenancy Update](./CRM_MULTI_TENANCY_UPDATE.md)
- [Relationship Types Enhancement](./RELATIONSHIP_TYPES_ENHANCEMENT.md)
- [UpdateNodeExecutor Examples](./UPDATE_NODE_EXECUTOR_RELATIONSHIP_EXAMPLES.md)
- [Account Consolidation](./ACCOUNT_CONSOLIDATION.md) 