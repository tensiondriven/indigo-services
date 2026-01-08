#!/usr/bin/env node

// Railway API Agent for automated ticket/deployment management
const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_KEY;

class RailwayAgent {
  constructor(token = RAILWAY_TOKEN) {
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async query(graphqlQuery, variables = {}) {
    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query: graphqlQuery,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`Railway API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  }

  // Get all projects
  async getProjects() {
    const query = `
      query {
        projects {
          edges {
            node {
              id
              name
              description
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const data = await this.query(query);
    return data.projects.edges.map(edge => edge.node);
  }

  // Get project services
  async getProjectServices(projectId) {
    const query = `
      query GetProject($projectId: String!) {
        project(id: $projectId) {
          id
          name
          services {
            edges {
              node {
                id
                name
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { projectId });
    return data.project.services.edges.map(edge => edge.node);
  }

  // Get deployments for a service
  async getServiceDeployments(serviceId) {
    const query = `
      query GetService($serviceId: String!) {
        service(id: $serviceId) {
          id
          name
          deployments {
            edges {
              node {
                id
                status
                createdAt
                meta {
                  commitSha
                  commitMessage
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query(query, { serviceId });
    return data.service.deployments.edges.map(edge => edge.node);
  }

  // Trigger deployment (redeploy latest)
  async triggerDeployment(serviceId) {
    const mutation = `
      mutation ServiceRedeploy($serviceId: String!) {
        serviceRedeploy(serviceId: $serviceId) {
          id
          status
        }
      }
    `;

    const data = await this.query(mutation, { serviceId });
    return data.serviceRedeploy;
  }

  // Get environment variables
  async getVariables(serviceId, environmentId) {
    const query = `
      query Variables($serviceId: String!, $environmentId: String!) {
        variables(serviceId: $serviceId, environmentId: $environmentId) {
          edges {
            node {
              id
              name
              value
            }
          }
        }
      }
    `;

    const data = await this.query(query, { serviceId, environmentId });
    return data.variables.edges.map(edge => edge.node);
  }

  // Create environment variable
  async setVariable(serviceId, environmentId, name, value) {
    const mutation = `
      mutation VariableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input) {
          id
          name
          value
        }
      }
    `;

    const data = await this.query(mutation, {
      input: {
        serviceId,
        environmentId,
        name,
        value
      }
    });

    return data.variableUpsert;
  }

  // Agent actions for ticket creation/management
  async createDeploymentTicket(projectName, serviceName, action = 'deploy') {
    console.log(`🎫 Creating ${action} ticket for ${serviceName} in ${projectName}`);
    
    try {
      // Get project info
      const projects = await this.getProjects();
      const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()));
      
      if (!project) {
        throw new Error(`Project ${projectName} not found`);
      }

      // Get services
      const services = await this.getProjectServices(project.id);
      const service = services.find(s => s.name.toLowerCase().includes(serviceName.toLowerCase()));
      
      if (!service) {
        throw new Error(`Service ${serviceName} not found in project ${projectName}`);
      }

      // Get recent deployments
      const deployments = await this.getServiceDeployments(service.id);
      
      const ticket = {
        id: `ticket-${Date.now()}`,
        project: project.name,
        service: service.name,
        action,
        status: 'pending',
        serviceId: service.id,
        projectId: project.id,
        recentDeployments: deployments.slice(0, 3),
        createdAt: new Date().toISOString()
      };

      console.log('✅ Ticket created:', JSON.stringify(ticket, null, 2));
      return ticket;

    } catch (error) {
      console.error('❌ Error creating ticket:', error.message);
      throw error;
    }
  }

  // Execute ticket (perform the actual action)
  async executeTicket(ticket) {
    console.log(`🚀 Executing ticket: ${ticket.action} for ${ticket.service}`);
    
    try {
      switch (ticket.action) {
        case 'deploy':
        case 'redeploy':
          const deployment = await this.triggerDeployment(ticket.serviceId);
          console.log('✅ Deployment triggered:', deployment);
          return { ...ticket, status: 'completed', deploymentId: deployment.id };
          
        case 'status':
          const deployments = await this.getServiceDeployments(ticket.serviceId);
          console.log('📊 Service status:', deployments[0]);
          return { ...ticket, status: 'completed', latestDeployment: deployments[0] };
          
        default:
          throw new Error(`Unknown action: ${ticket.action}`);
      }
    } catch (error) {
      console.error('❌ Error executing ticket:', error.message);
      return { ...ticket, status: 'failed', error: error.message };
    }
  }
}

// CLI usage
if (require.main === module) {
  const [,, command, ...args] = process.argv;
  
  const agent = new RailwayAgent();
  
  switch (command) {
    case 'projects':
      agent.getProjects().then(projects => {
        console.log('📁 Projects:');
        projects.forEach(p => console.log(`  - ${p.name} (${p.id})`));
      });
      break;
      
    case 'services':
      if (!args[0]) {
        console.error('Usage: node railway-agent.js services <project-name>');
        process.exit(1);
      }
      agent.getProjects().then(async projects => {
        const project = projects.find(p => p.name.toLowerCase().includes(args[0].toLowerCase()));
        if (!project) {
          console.error(`Project ${args[0]} not found`);
          process.exit(1);
        }
        const services = await agent.getProjectServices(project.id);
        console.log(`🛠️ Services in ${project.name}:`);
        services.forEach(s => console.log(`  - ${s.name} (${s.id})`));
      });
      break;
      
    case 'ticket':
      if (args.length < 3) {
        console.error('Usage: node railway-agent.js ticket <project> <service> <action>');
        process.exit(1);
      }
      agent.createDeploymentTicket(args[0], args[1], args[2]).then(ticket => {
        return agent.executeTicket(ticket);
      }).then(result => {
        console.log('🎯 Final result:', result.status);
      });
      break;
      
    default:
      console.log(`
🤖 Railway Agent - Automated ticket management

Usage:
  node railway-agent.js projects                    # List all projects
  node railway-agent.js services <project-name>     # List project services  
  node railway-agent.js ticket <project> <service> <action>  # Create & execute ticket

Examples:
  node railway-agent.js projects
  node railway-agent.js services indigo-services
  node railway-agent.js ticket indigo-services webhook-handler deploy
      `);
  }
}

module.exports = RailwayAgent;