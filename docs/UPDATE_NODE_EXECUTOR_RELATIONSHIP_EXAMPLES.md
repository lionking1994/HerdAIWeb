# UpdateNodeExecutor Relationship Creation Examples

## Overview

This document provides comprehensive examples of how the enhanced UpdateNodeExecutor correctly parses edges and nodes to create relationships in the appropriate CRM tables (account_relationships, account_contacts, opportunity_contacts).

## 🔧 Enhanced Features

### 1. Smart Relationship Type Parsing
- **Multiple Sources**: Parses relationship types from `relationship_type`, `role`, `type`, `label`, or `title` fields
- **Intelligent Inference**: Automatically infers relationship types based on entity combinations
- **Validation**: Validates against existing relationship types and predefined valid types

### 2. Improved Entity Mapping
- **Better Account Linking**: Enhanced logic to find appropriate accounts for opportunities
- **Multiple Search Methods**: Direct edges, indirect connections, company name matching, and fallbacks
- **Comprehensive Logging**: Detailed logging for debugging and monitoring

### 3. Robust Relationship Creation
- **Table-Specific Logic**: Creates relationships in the correct tables based on entity types
- **Duplicate Prevention**: Checks for existing relationships to prevent duplicates
- **Error Handling**: Graceful error handling with detailed error messages

## 📊 Example Graph Data Structures

### Example 1: Account ↔ Account Relationships

```javascript
const graphData = {
  visualization: {
    nodes: [
      {
        id: "company1",
        label: "Acme Corp",
        group: "company",
        name: "Acme Corporation",
        industry: "Technology"
      },
      {
        id: "company2", 
        label: "TechStart Inc",
        group: "company",
        name: "TechStart Inc",
        industry: "Software"
      }
    ],
    edges: [
      {
        from: "company1",
        to: "company2",
        relationship_type: "partner",
        description: "Strategic partnership for product development"
      }
    ]
  }
};
```

**Expected Output:**
- Creates 2 accounts: "Acme Corp" and "TechStart Inc"
- Creates 1 relationship in `account_relationships` table:
  - `parent_account_id`: Acme Corp ID
  - `child_account_id`: TechStart Inc ID  
  - `relationship_type`: "partner"
  - `description`: "Strategic partnership for product development"

### Example 2: Account ↔ Contact Relationships

```javascript
const graphData = {
  visualization: {
    nodes: [
      {
        id: "company1",
        label: "Acme Corp",
        group: "company",
        name: "Acme Corporation"
      },
      {
        id: "person1",
        label: "John Doe",
        group: "person", 
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@acme.com"
      }
    ],
    edges: [
      {
        from: "company1",
        to: "person1",
        relationship_type: "employs",
        role: "Senior Developer",
        is_primary: true
      }
    ]
  }
};
```

**Expected Output:**
- Creates 1 account: "Acme Corp"
- Creates 1 contact: "John Doe"
- Creates 1 relationship in `account_contacts` table:
  - `account_id`: Acme Corp ID
  - `contact_id`: John Doe ID
  - `relationship_type`: "employs"
  - `role`: "Senior Developer"
  - `is_primary`: true

### Example 3: Contact ↔ Opportunity Relationships

```javascript
const graphData = {
  visualization: {
    nodes: [
      {
        id: "person1",
        label: "Jane Smith",
        group: "person",
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@example.com"
      },
      {
        id: "opp1",
        label: "Enterprise Software Deal",
        group: "opportunity",
        name: "Enterprise Software Deal",
        amount: 50000,
        stage: "Proposal"
      }
    ],
    edges: [
      {
        from: "person1",
        to: "opp1",
        role: "Decision Maker",
        description: "Primary decision maker for the deal"
      }
    ]
  }
};
```

**Expected Output:**
- Creates 1 contact: "Jane Smith"
- Creates 1 opportunity: "Enterprise Software Deal" (without account_id initially)
- Creates 1 relationship in `opportunity_contacts` table:
  - `opportunity_id`: Opportunity ID
  - `contact_id`: Jane Smith ID
  - `role`: "Decision Maker"

### Example 4: Complex Multi-Entity Graph

```javascript
const graphData = {
  visualization: {
    nodes: [
      {
        id: "company1",
        label: "Acme Corp",
        group: "company",
        name: "Acme Corporation"
      },
      {
        id: "person1",
        label: "John Doe",
        group: "person",
        first_name: "John",
        last_name: "Doe"
      },
      {
        id: "person2",
        label: "Jane Smith", 
        group: "person",
        first_name: "Jane",
        last_name: "Smith"
      },
      {
        id: "opp1",
        label: "Software License Deal",
        group: "opportunity",
        name: "Software License Deal",
        amount: 100000
      }
    ],
    edges: [
      {
        from: "company1",
        to: "person1",
        relationship_type: "employs",
        role: "Sales Manager"
      },
      {
        from: "company1", 
        to: "person2",
        relationship_type: "employs",
        role: "Technical Lead"
      },
      {
        from: "person1",
        to: "opp1",
        role: "Owner"
      },
      {
        from: "person2",
        to: "opp1", 
        role: "Technical Contact"
      }
    ]
  }
};
```

**Expected Output:**
- Creates 1 account: "Acme Corp"
- Creates 2 contacts: "John Doe" and "Jane Smith"
- Creates 1 opportunity: "Software License Deal" (linked to Acme Corp)
- Creates 2 relationships in `account_contacts` table:
  - John Doe as "Sales Manager"
  - Jane Smith as "Technical Lead"
- Creates 2 relationships in `opportunity_contacts` table:
  - John Doe as "Owner"
  - Jane Smith as "Technical Contact"

## 🔍 Relationship Type Parsing Logic

### Priority Order for Relationship Types

1. **`edge.relationship_type`** - Explicit relationship type
2. **`edge.role`** - Role-based relationship
3. **`edge.type`** - Generic type field
4. **`edge.label`** - Edge label
5. **`edge.title`** - Edge title
6. **Inferred from entity types** - Default based on entity combination

### Default Relationship Types by Entity Combination

```javascript
const defaultTypes = {
  'account-account': 'parent_child',
  'account-contact': 'employs', 
  'contact-account': 'employed_by',
  'contact-opportunity': 'Influencer',
  'opportunity-contact': 'Influencer'
};
```

## 🎯 Account Linking for Opportunities

### Methods Used (in order of priority)

1. **Direct Edge to Account**: Look for direct edges from opportunity to account
2. **Indirect via Contact**: Look for opportunity → contact → account path
3. **Company Name Match**: Search existing accounts by company name
4. **Label Match**: Search existing accounts by opportunity label
5. **Fallback**: Use any account in the graph

### Example Account Linking

```javascript
// Method 1: Direct edge
{
  from: "opp1",
  to: "company1", 
  relationship_type: "belongs_to"
}

// Method 2: Indirect via contact
{
  from: "opp1",
  to: "person1",
  role: "Owner"
},
{
  from: "person1", 
  to: "company1",
  relationship_type: "employed_by"
}

// Method 3: Company name in node data
{
  id: "opp1",
  label: "Software Deal",
  group: "opportunity",
  company_name: "Acme Corp"  // This will be used to find the account
}
```

## 📋 Table-Specific Relationship Creation

### account_relationships Table
- **Used for**: Account ↔ Account relationships
- **Key fields**: `parent_account_id`, `child_account_id`, `relationship_type`
- **Example**: Partner, Competitor, Subsidiary relationships

### account_contacts Table  
- **Used for**: Account ↔ Contact relationships
- **Key fields**: `account_id`, `contact_id`, `relationship_type`, `role`, `is_primary`
- **Example**: Employee, Decision Maker, Advisor relationships

### opportunity_contacts Table
- **Used for**: Contact ↔ Opportunity relationships  
- **Key fields**: `opportunity_id`, `contact_id`, `role`
- **Example**: Owner, Influencer, Technical Contact relationships

## 🔧 Configuration Examples

### UpdateNodeExecutor Configuration

```javascript
const updateConfig = {
  updateType: 'database',
  table: 'crm_entities',
  method: 'insert'
};
```

### Workflow Data Structure

```javascript
const workflowData = {
  graph_data: {
    visualization: {
      nodes: [...],
      edges: [...]
    }
  }
};
```

## 🚨 Error Handling and Validation

### Common Error Scenarios

1. **Invalid Entity Types**: Logs error and skips relationship
2. **Missing Relationship Type**: Attempts to infer, falls back to default
3. **Duplicate Relationships**: Checks existing relationships, skips if found
4. **Missing Entities**: Validates entities exist before creating relationships
5. **Database Errors**: Logs detailed error, continues with other relationships

### Validation Rules

```javascript
// Entity type validation
const validTypes = ['account', 'contact', 'opportunity'];

// Self-relationship prevention
if (fromEntity.id === toEntity.id) {
  console.warn('Skipping self-relationship');
  continue;
}

// Duplicate relationship check
const existingRelationship = await this.checkExistingRelationship(
  fromEntity, toEntity, relationshipType, tenant_id
);
```

## 📊 Logging and Monitoring

### Enhanced Logging Examples

```javascript
// Entity creation
console.log(`✅ Created account: ${node.label} with ID: ${createdAccount.id}`);

// Relationship creation  
console.log(`🔗 Creating Account-Contact relationship using AccountContact model`);
console.log(`✅ Created relationship: account:123 -> contact:456 (employs)`);

// Account linking
console.log(`🔗 Found account ID ${accountId} for opportunity ${opportunityNode.label} via direct edge`);

// Error handling
console.error(`❌ Error creating ${node.group} node ${node.label}:`, error);
console.warn(`⚠️  Skipping invalid edge ${edge.from} -> ${edge.to}: entities not found`);
```

### Summary Output

```javascript
{
  type: 'database_update',
  table: 'crm_entities',
  updatedRows: 5,
  createdEntities: {
    "company1": { type: "account", id: "123", data: {...} },
    "person1": { type: "contact", id: "456", data: {...} },
    "opp1": { type: "opportunity", id: "789", data: {...} }
  },
  createdRelationships: [
    {
      id: "rel1",
      from: "account:123",
      to: "contact:456", 
      type: "employs",
      model: "AccountContact"
    }
  ],
  summary: {
    accounts: 1,
    contacts: 1,
    opportunities: 1,
    relationships: 1
  }
}
```

## 🔄 Testing and Validation

### Test Cases

1. **Basic Entity Creation**: Verify accounts, contacts, and opportunities are created
2. **Relationship Creation**: Verify relationships are created in correct tables
3. **Account Linking**: Verify opportunities are properly linked to accounts
4. **Error Handling**: Test with invalid data and edge cases
5. **Duplicate Prevention**: Test with duplicate relationships
6. **Performance**: Test with large graphs

### Validation Checklist

- [ ] All entities are created with correct data
- [ ] Relationships are created in appropriate tables
- [ ] Account linking works for opportunities
- [ ] Duplicate relationships are prevented
- [ ] Error handling works correctly
- [ ] Logging provides sufficient detail
- [ ] Performance is acceptable for large datasets

## 📚 Related Documentation

- [Relationship Types Enhancement](./RELATIONSHIP_TYPES_ENHANCEMENT.md)
- [CRM Multi-Tenancy Update](./CRM_MULTI_TENANCY_UPDATE.md)
- [Workflow Instance History](./WORKFLOW_INSTANCE_HISTORY.md)

---

*This documentation provides comprehensive examples and guidance for using the enhanced UpdateNodeExecutor for relationship creation in the CRM system.* 