const pool = require("../config/database");

const replaceWorkflowPlaceholders = async (input, workflowInstance) => {
  try {
    if (!input || typeof input !== "string") {
      return input;
    }

    if (!workflowInstance || !workflowInstance.id) {
      console.warn("Workflow instance is required for placeholder replacement");
      return input;
    }

    // Regular expression to match {{logicalId.field}} patterns
    const placeholderRegex = /\{\{([^}]+)\}\}/g;

    // Find all placeholders in the input
    const placeholders = input.match(placeholderRegex);

    if (!placeholders || placeholders.length === 0) {
      return input;
    }

    let result = input;

    // Process each placeholder
    for (const placeholder of placeholders) {
      try {
        // Extract the content inside {{}}
        const content = placeholder.replace(/\{\{|\}\}/g, "");

        // Split by dot to get logicalId and field path
        const parts = content.split(".");

        if (parts.length < 2) {
          console.warn(`Invalid placeholder format: ${placeholder}`);
          continue;
        }

        const logicalId = parts[0];
        let fieldPath = parts.slice(1).join(".");
       
        // Find the node instance by logicalId in config and workflow instance
        const { rows: nodeInstanceRows } = await pool.query(
          `
          SELECT wni.*, wn.config 
          FROM workflow_node_instances wni
          JOIN workflow_nodes wn ON wni.workflow_node_id = wn.id
          WHERE wni.workflow_instance_id = $1 
          AND (
            wn.config->>'logicalId' = $2 
            OR wn.config->>'nodeId' = $2
            OR wn.config->>'id' = $2
          )
        `,
          [workflowInstance.id, logicalId]
        );

        if (nodeInstanceRows.length === 0) {
          console.warn(
            `Node with logicalId '${logicalId}' not found in workflow ${workflowInstance.id}`
          );
          result = result.replace(
            placeholder,
            `[Node '${logicalId}' not found]`
          );
          continue;
        }

        const nodeInstance = nodeInstanceRows[0];

        // Try to get data from both 'data' and 'result' fields
        let nodeData = null;

        // First try the 'data' field
        if (nodeInstance.data) {
          try {
            nodeData =
              typeof nodeInstance.data === "string"
                ? JSON.parse(nodeInstance.data)
                : nodeInstance.data;
          } catch (e) {
            console.warn(
              `Failed to parse data field for node '${logicalId}':`,
              e
            );
          }
        }

        // If data field doesn't have the field, try the 'result' field
        if (!nodeData || !getNestedValue(nodeData, fieldPath)) {
          if (nodeInstance.result) {
            try {
              const resultData =
                typeof nodeInstance.result === "string"
                  ? JSON.parse(nodeInstance.result)
                  : nodeInstance.result;

              if (getNestedValue(resultData, fieldPath)) {
                nodeData = resultData;
              }
            } catch (e) {
              console.warn(
                `Failed to parse result field for node '${logicalId}':`,
                e
              );
            }
          }
        }

        // Get the value using the field path
        const value = getNestedValue(nodeData, fieldPath);

        if (value !== undefined && value !== null) {
          // Convert to string and replace the placeholder
          const stringValue = String(value);
          result = result.replace(placeholder, stringValue);
        } else {
          console.warn(`Field '${fieldPath}' not found in node '${logicalId}'`);
          result = result.replace(
            placeholder,
            `[Field '${fieldPath}' not found]`
          );
        }
      } catch (error) {
        console.error(`Error processing placeholder ${placeholder}:`, error);
        result = result.replace(placeholder, `[Error: ${error.message}]`);
      }
    }

    return result;
  } catch (error) {
    console.error("Error in replaceWorkflowPlaceholders:", error);
    return input; // Return original input if there's an error
  }
};

// Helper function to get nested object values using dot notation with space and case insensitive handling
const getNestedValue = (obj, path) => {
  if (!obj || !path) {
    return undefined;
  }

  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current === "object") {
      // First try exact match
      if (key in current) {
        current = current[key];
        continue;
      }

      // If exact match fails, try to find a key that matches when spaces and case are normalized
      const normalizedKey = key.replace(/\s+/g, "").toLowerCase(); // Remove spaces and convert to lowercase

      for (const objKey in current) {
        const normalizedObjKey = objKey.replace(/\s+/g, "").toLowerCase(); // Remove spaces and convert to lowercase

        if (normalizedObjKey === normalizedKey) {
          current = current[objKey];
          break;
        }
      }

      // If we still haven't found a match, return undefined
      if (current === obj) {
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  return current;
};

module.exports = {
  replaceWorkflowPlaceholders,
};
