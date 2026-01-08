#!/usr/bin/env node

// Simplified Plane ticket creator for current setup
const PLANE_URL = process.env.PLANE_URL || 'https://plane-production.up.railway.app';
const PLANE_API_KEY = process.env.PLANE_API_KEY || 'plane_api_9a3f1d487974422b8e59cd855d39c4df';

class PlaneTicketCreator {
  constructor() {
    this.apiUrl = PLANE_URL;
    this.apiKey = PLANE_API_KEY;
    this.workspace = 'indigo'; // From invitation link we saw earlier
    this.localDB = new Map(); // In-memory storage for now
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  // API request handler with fallback to local storage
  async apiRequest(endpoint, options = {}) {
    const apiPaths = ['/api/v1', '/api', '/api/public'];
    
    for (const apiPath of apiPaths) {
      const url = `${this.apiUrl}${apiPath}${endpoint}`;
      
      try {
        const response = await fetch(url, {
          headers: this.headers,
          ...options
        });

        if (response.status === 404) continue;
        
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`API error ${response.status}: ${text}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
      } catch (error) {
        console.log(`❌ API attempt failed for ${apiPath}: ${error.message}`);
        if (apiPath === apiPaths[apiPaths.length - 1]) {
          console.log('⚠️  Falling back to local storage');
          return null; // Fallback to local operations
        }
      }
    }
  }

  // AI-powered ticket analysis
  analyzeTicket(description) {
    const lowerDesc = description.toLowerCase();
    
    let category = 'Task';
    let priority = 'Medium';
    let labels = [];

    // Categorization
    if (lowerDesc.includes('bug') || lowerDesc.includes('error') || lowerDesc.includes('fix')) {
      category = 'Bug';
      priority = 'High';
    } else if (lowerDesc.includes('feature') || lowerDesc.includes('add') || lowerDesc.includes('implement')) {
      category = 'Feature';
      priority = 'Medium';
    } else if (lowerDesc.includes('improve') || lowerDesc.includes('optimize')) {
      category = 'Enhancement';
      priority = 'Low';
    }

    // Priority adjustment
    if (lowerDesc.includes('urgent') || lowerDesc.includes('critical')) {
      priority = 'Urgent';
    }

    // Tag extraction
    const techTags = ['api', 'database', 'frontend', 'backend', 'ui', 'security', 'performance'];
    labels = techTags.filter(tag => lowerDesc.includes(tag));

    // Complexity estimation
    const wordCount = description.split(' ').length;
    let complexity = wordCount > 50 ? 'High' : wordCount > 20 ? 'Medium' : 'Low';

    return {
      title: description.split('.')[0].trim().substring(0, 80),
      description: description,
      category,
      priority,
      complexity,
      labels,
      workspace: this.workspace
    };
  }

  // Generate local ticket data (for now, since API needs troubleshooting)
  createLocalTicket(prompt) {
    const analysis = this.analyzeTicket(prompt);
    const ticket = {
      id: `local-${Date.now()}`,
      created: new Date().toISOString(),
      ...analysis,
      status: 'Draft',
      aiGenerated: true
    };

    console.log('🎯 AI-Generated Ticket:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Title: ${ticket.title}`);
    console.log(`📂 Category: ${ticket.category}`);
    console.log(`⚡ Priority: ${ticket.priority}`);
    console.log(`🧩 Complexity: ${ticket.complexity}`);
    console.log(`🏷️  Labels: ${ticket.labels.join(', ') || 'none'}`);
    console.log(`🏢 Workspace: ${ticket.workspace}`);
    console.log(`📅 Created: ${ticket.created}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Description:\n${ticket.description}\n`);

    return ticket;
  }

  // Bulk ticket creation from list
  createBulkTickets(ticketList) {
    console.log(`📋 Creating ${ticketList.length} AI-analyzed tickets...\n`);
    
    const tickets = ticketList.map((prompt, index) => {
      console.log(`🎫 Ticket ${index + 1}/${ticketList.length}:`);
      const ticket = this.createLocalTicket(prompt);
      console.log(''); // spacing
      return ticket;
    });

    console.log('📊 Bulk Creation Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Generated: ${tickets.length} tickets`);
    
    const categories = tickets.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(categories).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count}`);
    });
    
    const priorities = tickets.reduce((acc, t) => {
      acc[t.priority] = (acc[t.priority] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📈 Priority Distribution:');
    Object.entries(priorities).forEach(([pri, count]) => {
      console.log(`   ${pri}: ${count}`);
    });
    
    return tickets;
  }

  // Show usage info
  showUsage() {
    console.log(`
🤖 Plane Ticket Creator - AI-powered ticket analysis

Usage:
  node plane-ticket-creator.js create "<description>"     # Create single ticket
  node plane-ticket-creator.js bulk "<ticket1>" "<ticket2>"...  # Create multiple
  node plane-ticket-creator.js help                      # Show this help

Examples:
  node plane-ticket-creator.js create "Fix authentication bug in login flow"
  node plane-ticket-creator.js bulk "Add dark mode to UI" "Fix mobile layout issues" "Update API documentation"

Features:
  🧠 AI categorization (Bug, Feature, Task, Enhancement)
  ⚡ Smart priority assignment based on keywords
  🏷️  Automatic tag extraction
  🧩 Complexity estimation
  📊 Bulk creation with analysis summary

Note: Currently generating local ticket data while API connectivity is being resolved.
Once API is working, tickets can be pushed directly to Plane workspace.
    `);
  }
}

// CLI interface
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  const creator = new PlaneTicketCreator();

  switch (command) {
    case 'create':
      if (!args[0]) {
        console.error('❌ Usage: node plane-ticket-creator.js create "<description>"');
        process.exit(1);
      }
      creator.createLocalTicket(args.join(' '));
      break;

    case 'bulk':
      if (args.length === 0) {
        console.error('❌ Usage: node plane-ticket-creator.js bulk "<ticket1>" "<ticket2>" ...');
        process.exit(1);
      }
      creator.createBulkTickets(args);
      break;

    case 'help':
    default:
      creator.showUsage();
  }
}

module.exports = PlaneTicketCreator;