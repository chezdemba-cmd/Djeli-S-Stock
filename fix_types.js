const fs = require('fs');

const filePath = 'c:/Users/chezd/Documents/GitHub/Djeli-S-Stock/types/database.types.ts';

let content = fs.readFileSync(filePath, 'utf-8');

// Add Relationships
content = content.replace(/(Update: \{[^\}]+\})/g, '$1\n        Relationships: any[]');

// Add Functions, Enums, CompositeTypes
const viewsReplacement = `
    Functions: {
      get_accessible_orgs: {
        Args: Record<string, never>;
        Returns: { id: string; name: string }[];
      };
      current_orgs: {
        Args: Record<string, never>;
        Returns: string[];
      };
    }
    Enums: {}
    CompositeTypes: {}
    Views: {`;
content = content.replace('Views: {', viewsReplacement.trim());

fs.writeFileSync(filePath, content, 'utf-8');
