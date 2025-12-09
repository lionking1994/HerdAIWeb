import { Account, Contact, Opportunity, OpportunityStage, CustomFieldDefinition } from '../../types/crm';

export interface DuplicateResult {
  isDuplicate: boolean;
  similarity: number;
  existingRecord: any;
  message: string;
}

export interface DuplicateCheckOptions {
  threshold?: number; // Similarity threshold (0-1, default 0.8)
  checkFields?: string[]; // Specific fields to check
  excludeId?: string; // ID to exclude from comparison (for updates)
}

// Fuzzy string matching using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLength);
}

// Normalize text for better comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Check for account duplicates
export async function checkAccountDuplicates(
  newAccount: Partial<Account>,
  existingAccounts: Account[],
  options: DuplicateCheckOptions = {}
): Promise<DuplicateResult[]> {
  const { threshold = 0.8, excludeId } = options;
  const results: DuplicateResult[] = [];
  
  const normalizedNewName = normalizeText(newAccount.name || '');
  
  for (const existing of existingAccounts) {
    if (excludeId && existing.id === excludeId) continue;
    
    const normalizedExistingName = normalizeText(existing.name || '');
    const similarity = calculateSimilarity(normalizedNewName, normalizedExistingName);
    
    if (similarity >= threshold) {
      results.push({
        isDuplicate: true,
        similarity,
        existingRecord: existing,
        message: `There is already an Account named "${existing.name}" (${Math.round(similarity * 100)}% match). Click here to view it.`
      });
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

// Check for contact duplicates
export async function checkContactDuplicates(
  newContact: Partial<Contact>,
  existingContacts: Contact[],
  options: DuplicateCheckOptions = {}
): Promise<DuplicateResult[]> {
  const { threshold = 0.8, excludeId } = options;
  const results: DuplicateResult[] = [];
  
  const normalizedNewName = normalizeText(`${newContact.first_name || ''} ${newContact.last_name || ''}`);
  const normalizedNewEmail = normalizeText(newContact.email || '');
  
  for (const existing of existingContacts) {
    if (excludeId && existing.id === excludeId) continue;
    
    const normalizedExistingName = normalizeText(`${existing.first_name || ''} ${existing.last_name || ''}`);
    const normalizedExistingEmail = normalizeText(existing.email || '');
    
    // Check name similarity
    const nameSimilarity = calculateSimilarity(normalizedNewName, normalizedExistingName);
    
    // Check email similarity (exact match for emails)
    const emailSimilarity = normalizedNewEmail && normalizedExistingEmail && normalizedNewEmail === normalizedExistingEmail ? 1 : 0;
    
    // Use the higher similarity score
    const similarity = Math.max(nameSimilarity, emailSimilarity);
    
    if (similarity >= threshold) {
      let message = '';
      if (emailSimilarity === 1) {
        message = `There is already a Contact with email "${existing.email}" (${Math.round(similarity * 100)}% match). Click here to view it.`;
      } else {
        message = `There is already a Contact named "${existing.first_name} ${existing.last_name}" (${Math.round(similarity * 100)}% match). Click here to view it.`;
      }
      
      results.push({
        isDuplicate: true,
        similarity,
        existingRecord: existing,
        message
      });
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

// Check for opportunity duplicates
export async function checkOpportunityDuplicates(
  newOpportunity: Partial<Opportunity>,
  existingOpportunities: Opportunity[],
  options: DuplicateCheckOptions = {}
): Promise<DuplicateResult[]> {
  const { threshold = 0.8, excludeId } = options;
  const results: DuplicateResult[] = [];
  
  const normalizedNewName = normalizeText(newOpportunity.name || '');
  const newAccountId = newOpportunity.account_id;
  
  for (const existing of existingOpportunities) {
    if (excludeId && existing.id === excludeId) continue;
    
    const normalizedExistingName = normalizeText(existing.name || '');
    const nameSimilarity = calculateSimilarity(normalizedNewName, normalizedExistingName);
    
    // Check if same account and similar name
    if (newAccountId && existing.account_id === newAccountId && nameSimilarity >= threshold) {
      results.push({
        isDuplicate: true,
        similarity: nameSimilarity,
        existingRecord: existing,
        message: `There is already an Opportunity named "${existing.name}" for this account (${Math.round(nameSimilarity * 100)}% match). Click here to view it.`
      });
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

// Check for stage duplicates
export async function checkStageDuplicates(
  newStage: Partial<OpportunityStage>,
  existingStages: OpportunityStage[],
  options: DuplicateCheckOptions = {}
): Promise<DuplicateResult[]> {
  const { threshold = 0.8, excludeId } = options;
  const results: DuplicateResult[] = [];
  
  const normalizedNewName = normalizeText(newStage.name || '');
  
  for (const existing of existingStages) {
    if (excludeId && existing.id === excludeId) continue;
    
    const normalizedExistingName = normalizeText(existing.name || '');
    const similarity = calculateSimilarity(normalizedNewName, normalizedExistingName);
    
    if (similarity >= threshold) {
      results.push({
        isDuplicate: true,
        similarity,
        existingRecord: existing,
        message: `There is already a Stage named "${existing.name}" (${Math.round(similarity * 100)}% match). Click here to view it.`
      });
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

// Check for custom field duplicates
export async function checkCustomFieldDuplicates(
  newField: Partial<CustomFieldDefinition>,
  existingFields: CustomFieldDefinition[],
  options: DuplicateCheckOptions = {}
): Promise<DuplicateResult[]> {
  const { threshold = 0.8, excludeId } = options;
  const results: DuplicateResult[] = [];
  
  const normalizedNewLabel = normalizeText(newField.field_label || '');
  const newTableName = newField.table_name;
  
  for (const existing of existingFields) {
    if (excludeId && existing.id === excludeId) continue;
    
    // Only check duplicates within the same table
    if (newTableName && existing.table_name === newTableName) {
      const normalizedExistingLabel = normalizeText(existing.field_label || '');
      const similarity = calculateSimilarity(normalizedNewLabel, normalizedExistingLabel);
      
      if (similarity >= threshold) {
        results.push({
          isDuplicate: true,
          similarity,
          existingRecord: existing,
          message: `There is already a Custom Field named "${existing.field_label}" for this table (${Math.round(similarity * 100)}% match). Click here to view it.`
        });
      }
    }
  }
  
  return results.sort((a, b) => b.similarity - a.similarity);
}

// Generic duplicate checker
export async function checkDuplicates(
  entityType: 'account' | 'contact' | 'opportunity' | 'stage' | 'customField',
  newRecord: any,
  existingRecords: any[],
  options: DuplicateCheckOptions = {}
): Promise<DuplicateResult[]> {
  switch (entityType) {
    case 'account':
      return checkAccountDuplicates(newRecord, existingRecords, options);
    case 'contact':
      return checkContactDuplicates(newRecord, existingRecords, options);
    case 'opportunity':
      return checkOpportunityDuplicates(newRecord, existingRecords, options);
    case 'stage':
      return checkStageDuplicates(newRecord, existingRecords, options);
    case 'customField':
      return checkCustomFieldDuplicates(newRecord, existingRecords, options);
    default:
      return [];
  }
}

// Helper function to get duplicate warning message
export function getDuplicateWarningMessage(duplicates: DuplicateResult[]): string {
  if (duplicates.length === 0) return '';
  
  const topMatch = duplicates[0];
  return topMatch.message;
}

// Check if there are any duplicates above threshold
export function hasDuplicates(duplicates: DuplicateResult[], threshold: number = 0.8): boolean {
  return duplicates.some(d => d.similarity >= threshold);
}
