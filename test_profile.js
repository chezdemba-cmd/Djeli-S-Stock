const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://sygaudfbqnpflcxmdsef.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Z2F1ZGZicW5wZmxjeG1kc2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDI3MjAsImV4cCI6MjEwMDM3ODcyMH0.3a2xsVsratUJv5sTXCR2C8IateZd48-kcRnFqWXp1VY'
);

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .limit(10);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Profiles:", data);
  }
}

check();
