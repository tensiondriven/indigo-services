#!/usr/bin/env node

// Plane Webhook Configuration for AI Integration
const config = {
  services: {
    plane: {
      url: process.env.PLANE_URL || 'https://plane-production.up.railway.app',
      apiKey: process.env.PLANE_API_KEY || '', // Set this once you get API key from Plane
    },
    webhook: {
      url: process.env.WEBHOOK_URL || 'http://webhooks.local:3000',
    }
  }
};

// Webhook events we want for AI collaboration
const webhookConfig = {
  url: `${config.services.webhook.url}/plane-webhook`,
  is_active: true,
  project: [], // Will be filled with project IDs
  // Event types for AI collaboration
  issue: true,           // Issue created/updated
  issue_comment: true,   // Comments added
  module: true,          // Sprint/module changes
  cycle: true,           // Cycle updates
  page: true,            // Wiki page changes
};

async function setupPlaneWebhook() {
  const { plane } = config.services;
  
  console.log('🚀 Setting up Plane webhook for AI collaboration...');
  console.log(`📍 Plane URL: ${plane.url}`);
  console.log(`🔗 Webhook URL: ${webhookConfig.url}`);
  
  if (!plane.apiKey) {
    console.log('\n⚠️  Need to set PLANE_API_KEY first!');
    console.log('1. Login to Plane at:', plane.url);
    console.log('2. Go to Profile Settings → API Tokens');
    console.log('3. Generate new token');
    console.log('4. Set environment variable: export PLANE_API_KEY=your_token');
    return;
  }

  try {
    // First, get workspace info
    const workspaceRes = await fetch(`${plane.url}/api/v1/workspaces/`, {
      headers: {
        'X-API-Key': plane.apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!workspaceRes.ok) {
      throw new Error(`Failed to get workspaces: ${workspaceRes.status}`);
    }
    
    const workspaces = await workspaceRes.json();
    console.log('✅ Found workspaces:', workspaces.length);
    
    // Create webhook for each workspace
    for (const workspace of workspaces) {
      console.log(`\n🔧 Setting up webhook for workspace: ${workspace.name}`);
      
      const webhookRes = await fetch(`${plane.url}/api/v1/workspaces/${workspace.slug}/webhooks/`, {
        method: 'POST',
        headers: {
          'X-API-Key': plane.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookConfig)
      });
      
      if (webhookRes.ok) {
        const webhook = await webhookRes.json();
        console.log('✅ Webhook created:', webhook.id);
      } else {
        console.log('❌ Failed to create webhook:', webhookRes.status);
      }
    }
    
  } catch (error) {
    console.error('❌ Error setting up webhooks:', error.message);
  }
}

// Export for use in other modules
module.exports = { config, webhookConfig, setupPlaneWebhook };

// Run if called directly
if (require.main === module) {
  setupPlaneWebhook();
}