/**
 * src/agents/index.ts — Public barrel for the XPS agent system.
 *
 * Import agents from this file to avoid deep relative paths.
 */

export { BaseAgent } from './base/BaseAgent'
export type { AgentContext, AgentResult } from './base/BaseAgent'

export { PlannerAgent, plannerAgent } from './PlannerAgent'
export { ResearchAgent, researchAgent } from './ResearchAgent'
export { BuilderAgent, builderAgent } from './BuilderAgent'
export { ExecutorAgent, executorAgent } from './ExecutorAgent'
export { ValidatorAgent, validatorAgent } from './ValidatorAgent'
export { MonitorAgent, monitorAgent } from './MonitorAgent'
export { ScraperAgent, scraperAgent } from './ScraperAgent'
export { MediaAgent, mediaAgent } from './MediaAgent'
export { KnowledgeAgent, knowledgeAgent } from './KnowledgeAgent'
export { PredictorAgent, predictorAgent } from './PredictorAgent'
export { SimulatorAgent, simulatorAgent } from './SimulatorAgent'
export { MetaAgent, metaAgent } from './MetaAgent'
