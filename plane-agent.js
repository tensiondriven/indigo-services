#!/usr/bin/env node

// Plane API Agent for automated ticket/issue management
const PLANE_API_URL = process.env.PLANE_URL || 'https://plane-production.up.railway.app';
const PLANE_API_KEY = process.env.PLANE_API_KEY || 'plane_api_9a3f1d487974422b8e59cd855d39c4df';

class PlaneAgent {
  constructor(apiUrl = PLANE_API_URL, apiKey = PLANE_API_KEY) {
    this.apiUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    };
  }

  async request(endpoint, options = {}) {
    // Try different API path patterns for self-hosted Plane
    const apiPaths = ['/api/v1', '/api', '/api/public', ''];
    
    for (const apiPath of apiPaths) {
      const url = `${this.apiUrl}${apiPath}${endpoint}`;
      console.log(`🔍 Trying: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: this.headers,
          ...options
        });

        console.log(`📡 Response: ${response.status} ${response.statusText}`);
        
        if (response.status === 404) {
          continue; // Try next API path
        }

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`API error ${response.status}: ${text}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        } else {
          const text = await response.text();
          console.log('📄 Non-JSON response:', text.substring(0, 200));
          throw new Error('Expected JSON response but got HTML/text');
        }
      } catch (error) {
        console.log(`❌ Failed ${apiPath}: ${error.message}`);
        if (apiPath === apiPaths[apiPaths.length - 1]) {
          throw error; // Last attempt failed
        }
      }
    }
  }

  // Get all workspaces
  async getWorkspaces() {
    console.log('🏢 Getting workspaces...');
    return await this.request('/workspaces/');
  }

  // Get projects in workspace
  async getProjects(workspaceSlug) {
    console.log(`📁 Getting projects for workspace: ${workspaceSlug}`);
    return await this.request(`/workspaces/${workspaceSlug}/projects/`);
  }

  // Get issues in project
  async getIssues(workspaceSlug, projectId) {
    console.log(`🎫 Getting issues for project: ${projectId}`);
    return await this.request(`/workspaces/${workspaceSlug}/projects/${projectId}/issues/`);
  }

  // Create new issue
  async createIssue(workspaceSlug, projectId, issueData) {
    console.log(`✨ Creating issue in ${workspaceSlug}/${projectId}`);
    
    return await this.request(`/workspaces/${workspaceSlug}/projects/${projectId}/issues/`, {
      method: 'POST',
      body: JSON.stringify(issueData)
    });
  }

  // Add comment to issue
  async addComment(workspaceSlug, projectId, issueId, comment) {
    console.log(`💬 Adding comment to issue: ${issueId}`);
    
    return await this.request(`/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/comments/`, {
      method: 'POST',
      body: JSON.stringify({
        comment_html: `<p>${comment}</p>`,
        comment_json: { content: comment }
      })
    });
  }

  // AI-powered ticket creation
  async createAITicket(workspaceSlug, projectId, prompt) {
    console.log('🤖 Creating AI-powered ticket...');
    
    // Analyze prompt to determine ticket details
    const analysis = this.analyzePrompt(prompt);
    
    const issueData = {
      name: analysis.title,
      description: analysis.description,
      priority: analysis.priority,
      state: analysis.state,
      labels: analysis.labels
    };

    console.log('🎯 Generated issue data:', JSON.stringify(issueData, null, 2));
    
    try {
      const issue = await this.createIssue(workspaceSlug, projectId, issueData);
      
      // Add AI analysis comment
      if (issue && issue.id) {
        const aiComment = `🤖 **AI Analysis:**

**Category:** ${analysis.category}
**Estimated Complexity:** ${analysis.complexity}
**Suggested Priority:** ${analysis.priority}
**Auto-generated Tags:** ${analysis.labels.join(', ')}

*This ticket was created automatically by Plane Agent.*`;

        await this.addComment(workspaceSlug, projectId, issue.id, aiComment);
      }
      
      return issue;
    } catch (error) {
      console.error('❌ Error creating AI ticket:', error.message);
      throw error;
    }
  }

  // Analyze prompt to extract ticket details
  analyzePrompt(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Determine category
    let category = 'TASK';
    let priority = 'medium';
    let state = 'Todo';
    
    if (lowerPrompt.includes('bug') || lowerPrompt.includes('error') || lowerPrompt.includes('issue')) {
      category = 'BUG';
      priority = 'high';
    } else if (lowerPrompt.includes('feature') || lowerPrompt.includes('add') || lowerPrompt.includes('implement')) {
      category = 'FEATURE';
      priority = 'medium';
    } else if (lowerPrompt.includes('improve') || lowerPrompt.includes('optimize')) {
      category = 'IMPROVEMENT';
      priority = 'low';
    }

    // Extract urgency
    if (lowerPrompt.includes('urgent') || lowerPrompt.includes('asap') || lowerPrompt.includes('critical')) {
      priority = 'urgent';
    } else if (lowerPrompt.includes('low priority') || lowerPrompt.includes('when possible')) {
      priority = 'low';
    }

    // Generate title (first sentence or up to 80 chars)
    let title = prompt.split('.')[0].trim();
    if (title.length > 80) {
      title = title.substring(0, 77) + '...';
    }

    // Extract labels/tags
    const labels = [];
    const techKeywords = ['api', 'database', 'frontend', 'backend', 'ui', 'ux', 'security', 'performance'];
    techKeywords.forEach(keyword => {
      if (lowerPrompt.includes(keyword)) {
        labels.push(keyword);
      }
    });

    // Determine complexity
    const wordCount = prompt.split(' ').length;
    let complexity = 'LOW';
    if (wordCount > 50 || labels.length > 2) complexity = 'MEDIUM';
    if (wordCount > 100 || lowerPrompt.includes('integration') || lowerPrompt.includes('architecture')) {
      complexity = 'HIGH';
    }

    return {
      title,
      description: prompt,
      category,
      priority,
      state,
      labels,
      complexity
    };
  }

  // Bulk ticket operations
  async createTicketsFromList(workspaceSlug, projectId, ticketList) {
    console.log(`📋 Creating ${ticketList.length} tickets...`);
    
    const results = [];
    
    for (let i = 0; i < ticketList.length; i++) {
      const ticketPrompt = ticketList[i];
      console.log(`\n🎫 Creating ticket ${i + 1}/${ticketList.length}`);
      
      try {
        const ticket = await this.createAITicket(workspaceSlug, projectId, ticketPrompt);
        results.push({ success: true, ticket, prompt: ticketPrompt });
        
        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Failed to create ticket: ${error.message}`);
        results.push({ success: false, error: error.message, prompt: ticketPrompt });
      }
    }
    
    return results;
  }

  // Diagnostic method to test API connectivity
  async testConnection() {
    console.log('🔧 Testing Plane API connection...');
    console.log(`📍 API URL: ${this.apiUrl}`);
    console.log(`🔑 API Key: ${this.apiKey ? 'Set' : 'Missing'}`);
    
    try {
      const workspaces = await this.getWorkspaces();
      console.log('✅ Connection successful!');
      console.log('🏢 Workspaces:', workspaces?.length || 0);
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
  }
}

// CLI usage
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  
  const agent = new PlaneAgent();
  
  switch (command) {
    case 'test':
      agent.testConnection();
      break;
      
    case 'workspaces':
      agent.getWorkspaces().then(workspaces => {
        console.log('🏢 Workspaces:', workspaces);
      }).catch(console.error);
      break;
      
    case 'projects':
      if (!args[0]) {
        console.error('Usage: node plane-agent.js projects <workspace-slug>');
        process.exit(1);
      }
      agent.getProjects(args[0]).then(projects => {
        console.log(`📁 Projects in ${args[0]}:`, projects);
      }).catch(console.error);
      break;
      
    case 'issues':
      if (args.length < 2) {
        console.error('Usage: node plane-agent.js issues <workspace-slug> <project-id>');
        process.exit(1);
      }
      agent.getIssues(args[0], args[1]).then(issues => {
        console.log(`🎫 Issues in ${args[0]}/${args[1]}:`, issues);
      }).catch(console.error);
      break;
      
    case 'create':
      if (args.length < 3) {
        console.error('Usage: node plane-agent.js create <workspace-slug> <project-id> "<ticket description>"');
        process.exit(1);
      }
      agent.createAITicket(args[0], args[1], args.slice(2).join(' ')).then(ticket => {
        console.log('✅ Ticket created:', ticket);
      }).catch(console.error);
      break;
      
    case 'bulk':
      if (args.length < 3) {
        console.error('Usage: node plane-agent.js bulk <workspace-slug> <project-id> "<ticket1>" "<ticket2>" ...');
        process.exit(1);
      }
      const ticketList = args.slice(2);
      agent.createTicketsFromList(args[0], args[1], ticketList).then(results => {
        console.log(`\n📊 Bulk creation results:`);
        const successful = results.filter(r => r.success).length;
        console.log(`✅ Successful: ${successful}/${results.length}`);
        console.log(`❌ Failed: ${results.length - successful}/${results.length}`);
      }).catch(console.error);
      break;
      
    default:
      console.log(`
🤖 Plane Agent - Automated ticket management

Usage:
  node plane-agent.js test                           # Test API connection
  node plane-agent.js workspaces                     # List workspaces
  node plane-agent.js projects <workspace-slug>      # List projects
  node plane-agent.js issues <workspace> <project>   # List issues
  node plane-agent.js create <workspace> <project> "<description>"  # Create AI ticket
  node plane-agent.js bulk <workspace> <project> "<ticket1>" "<ticket2>"  # Bulk create

Examples:
  node plane-agent.js test
  node plane-agent.js workspaces  
  node plane-agent.js create indigo project-123 "Fix authentication bug in login flow"
  node plane-agent.js bulk indigo proj "Add dark mode" "Fix mobile layout" "Update docs"

Features:
  🤖 AI-powered ticket analysis and categorization
  📊 Auto-priority assignment based on keywords
  🏷️ Smart tag extraction from descriptions
  💬 Automatic AI analysis comments
  📋 Bulk ticket creation from lists
      `);
  }
}

module.exports = PlaneAgent;