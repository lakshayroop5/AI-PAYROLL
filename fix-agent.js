// Simple script to fix stuck agent
const fetch = require('node-fetch');

const REPO_ID = 'cmg1lczsg0003u6dc9x40jm7l';  // From your screenshot
const API_URL = `http://localhost:3000/api/repositories/${REPO_ID}/analytics`;

async function fixStuckAgent() {
  try {
    console.log('Attempting to fix stuck agent...');
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'initialize_agent'
      })
    });

    const result = await response.json();
    console.log('Response:', result);
    console.log('Status:', response.status);

    if (response.ok) {
      console.log('✅ Agent fix completed successfully!');
    } else {
      console.log('❌ Fix failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixStuckAgent();
