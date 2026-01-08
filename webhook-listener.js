#!/usr/bin/env node

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint for Plane events
app.post('/plane-webhook', async (req, res) => {
  const { event_type, data } = req.body;
  
  console.log(`\n🚀 Received Plane event: ${event_type}`);
  console.log('📊 Event data:', JSON.stringify(data, null, 2));
  
  try {
    // Handle different event types
    switch (event_type) {
      case 'issue.created':
        await handleIssueCreated(data);
        break;
      case 'issue.updated':
        await handleIssueUpdated(data);
        break;
      case 'issue_comment.created':
        await handleCommentCreated(data);
        break;
      case 'project.created':
        await handleProjectCreated(data);
        break;
      default:
        console.log(`📝 Unhandled event type: ${event_type}`);
    }
    
    res.status(200).json({ status: 'success', processed: event_type });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// AI Integration Functions
async function handleIssueCreated(data) {
  console.log('🎯 New issue created:', data.name);
  
  // AI could analyze the issue and:
  // 1. Auto-assign labels based on content
  // 2. Suggest related issues
  // 3. Add initial analysis comments
  // 4. Set priority based on keywords
  
  // Example: Add AI analysis comment
  await addAIAnalysisComment(data);
}

async function handleIssueUpdated(data) {
  console.log('🔄 Issue updated:', data.name);
  
  // AI could:
  // 1. Track progress patterns
  // 2. Suggest next actions
  // 3. Update related tasks
}

async function handleCommentCreated(data) {
  console.log('💬 New comment added');
  
  // AI could:
  // 1. Analyze sentiment
  // 2. Extract action items
  // 3. Suggest solutions based on similar issues
  // 4. Auto-close resolved issues
}

async function handleProjectCreated(data) {
  console.log('📁 New project created:', data.name);
  
  // AI could:
  // 1. Set up default templates
  // 2. Create initial issues/milestones
  // 3. Configure project settings
}

async function addAIAnalysisComment(issue) {
  // Simulate AI analysis
  const analysis = `🤖 AI Analysis:
  
**Issue Type**: ${categorizeIssue(issue.description || '')}
**Priority Suggestion**: ${suggestPriority(issue.name, issue.description || '')}
**Estimated Complexity**: ${estimateComplexity(issue.description || '')}

*This analysis was generated automatically. Please review and adjust as needed.*`;

  console.log('🧠 Generated AI analysis for issue');
  
  // In real implementation, you'd call Plane API to add this comment
  // await planeAPI.addComment(issue.project, issue.id, analysis);
}

// AI Helper Functions
function categorizeIssue(description) {
  const categories = {
    bug: ['bug', 'error', 'issue', 'problem', 'broken'],
    feature: ['feature', 'add', 'implement', 'new'],
    improvement: ['improve', 'optimize', 'enhance', 'better'],
    task: ['task', 'todo', 'setup', 'configure']
  };
  
  const lowerDesc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      return category.toUpperCase();
    }
  }
  
  return 'GENERAL';
}

function suggestPriority(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes('urgent') || text.includes('critical') || text.includes('crash')) {
    return 'HIGH';
  } else if (text.includes('important') || text.includes('should')) {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

function estimateComplexity(description) {
  const wordCount = description.split(' ').length;
  const complexityKeywords = ['integration', 'database', 'api', 'security', 'performance'];
  
  const hasComplexKeywords = complexityKeywords.some(keyword => 
    description.toLowerCase().includes(keyword)
  );
  
  if (hasComplexKeywords || wordCount > 100) {
    return 'HIGH';
  } else if (wordCount > 30) {
    return 'MEDIUM';
  }
  
  return 'LOW';
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'plane-webhook-listener'
  });
});

// Start server
app.listen(port, () => {
  console.log(`\n🎯 Webhook listener running on port ${port}`);
  console.log(`🔗 Plane webhook URL: http://localhost:${port}/plane-webhook`);
  console.log(`🏥 Health check: http://localhost:${port}/health`);
  console.log(`\n✨ Ready to receive Plane collaboration events!`);
});

module.exports = app;