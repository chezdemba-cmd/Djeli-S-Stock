import re

file_path = 'c:/Users/chezd/Documents/GitHub/Djeli-S-Stock/types/database.types.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add Relationships
content = re.sub(r'(Update: \{[^\}]+\})', r'\1\n        Relationships: any[]', content)

# Add Functions, Enums, CompositeTypes
views_replacement = """
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
    Views: {"""
content = content.replace('Views: {', views_replacement.strip())

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
