"""
agents/frontend/frontend_agent.py
===================================
Frontend editing agent with live component registry support.

Capabilities:
  - Create new Next.js pages
  - Add/modify React components
  - Register components in dynamic registry
  - Add charts / scraping dashboards
  - Generate Tailwind-styled UI widgets
"""

from __future__ import annotations

import logging
import os
import textwrap
from typing import Any

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGES_DIR = os.path.join(ROOT, "pages")
COMPONENTS_DIR = os.path.join(ROOT, "dashboard", "components")
REGISTRY_FILE = os.path.join(ROOT, "dashboard", "component_registry.json")


class FrontendAgent:
    """
    Autonomous frontend editing agent.

    Generates and modifies Next.js pages and React components.

    Example::

        agent = FrontendAgent()
        result = await agent.run("Create a lead analytics dashboard")
    """

    async def run(self, command: str) -> dict[str, Any]:
        lower = command.lower()
        logger.info("FrontendAgent.run: %r", command)

        if "analytics" in lower or "dashboard" in lower:
            return await self._create_analytics_page()

        if "chart" in lower:
            return await self._add_chart_component(command)

        if "page" in lower:
            return await self._create_page(command)

        if "component" in lower:
            return await self._create_component(command)

        return await self._generate_with_llm(command)

    # ------------------------------------------------------------------

    async def _create_analytics_page(self) -> dict[str, Any]:
        """Generate a lead analytics dashboard page."""
        page_code = textwrap.dedent("""\
            // pages/analytics.js
            import React, { useEffect, useState } from 'react';

            export default function AnalyticsPage() {
              const [leads, setLeads] = useState([]);
              const [stats, setStats] = useState({ total: 0, highValue: 0, avgScore: 0 });

              useEffect(() => {
                fetch('/api/leads?limit=1000')
                  .then(r => r.json())
                  .then(data => {
                    const arr = data.data?.leads || [];
                    setLeads(arr);
                    const highValue = arr.filter(l => (l.lead_score || l.score || 0) >= 40).length;
                    const avgScore = arr.length
                      ? arr.reduce((s, l) => s + (l.lead_score || l.score || 0), 0) / arr.length
                      : 0;
                    setStats({ total: arr.length, highValue, avgScore: avgScore.toFixed(1) });
                  })
                  .catch(() => {});
              }, []);

              return (
                <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '2rem', fontFamily: 'sans-serif' }}>
                  <h1 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem' }}>
                    📊 Lead Analytics
                  </h1>

                  {/* Stat Cards */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Total Leads', value: stats.total, color: '#4CAF50' },
                      { label: 'High Value', value: stats.highValue, color: '#FFD700' },
                      { label: 'Avg Score', value: stats.avgScore, color: '#2196F3' },
                    ].map(card => (
                      <div key={card.label} style={{
                        background: '#111', border: `1px solid ${card.color}`,
                        borderRadius: '8px', padding: '1rem 1.5rem', minWidth: '160px',
                      }}>
                        <div style={{ color: card.color, fontSize: '2rem', fontWeight: 'bold' }}>{card.value}</div>
                        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>{card.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Leads Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #333', color: '#FFD700' }}>
                          {['Company', 'City', 'State', 'Score', 'Phone', 'Website'].map(h => (
                            <th key={h} style={{ padding: '0.5rem', textAlign: 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leads.slice(0, 50).map((l, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #1a1a1a' }}>
                            <td style={{ padding: '0.4rem' }}>{l.company_name || l.name || '—'}</td>
                            <td style={{ padding: '0.4rem', color: '#aaa' }}>{l.city || '—'}</td>
                            <td style={{ padding: '0.4rem', color: '#aaa' }}>{l.state || '—'}</td>
                            <td style={{ padding: '0.4rem', color: '#FFD700' }}>{l.lead_score || l.score || 0}</td>
                            <td style={{ padding: '0.4rem', color: '#4CAF50' }}>{l.phone || '—'}</td>
                            <td style={{ padding: '0.4rem' }}>
                              {l.website ? <a href={l.website} style={{ color: '#2196F3' }} target="_blank" rel="noopener noreferrer">🔗</a> : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }
        """)

        path = os.path.join(PAGES_DIR, "analytics.js")
        written = self._write(path, page_code)
        await self._register_component("AnalyticsPage", "pages/analytics.js", "analytics")
        return {"success": written, "file": "pages/analytics.js", "type": "page"}

    async def _create_page(self, command: str) -> dict[str, Any]:
        """Generate a generic Next.js page via LLM."""
        import re

        name_match = re.search(r"(?:page|create|add)\s+([a-zA-Z0-9_-]+)", command, re.I)
        page_name = name_match.group(1).lower() if name_match else "new-page"
        code = await self._llm_generate(f"Create a Next.js page component for: {command}", "tsx")
        path = os.path.join(PAGES_DIR, f"{page_name}.js")
        written = self._write(path, code)
        return {"success": written, "file": f"pages/{page_name}.js"}

    async def _create_component(self, command: str) -> dict[str, Any]:
        """Generate a React component via LLM."""
        import re

        name_match = re.search(r"(?:component|create)\s+([a-zA-Z0-9_-]+)", command, re.I)
        comp_name = name_match.group(1) if name_match else "NewComponent"
        code = await self._llm_generate(f"Create a React component for: {command}", "tsx")
        os.makedirs(COMPONENTS_DIR, exist_ok=True)
        path = os.path.join(COMPONENTS_DIR, f"{comp_name}.tsx")
        written = self._write(path, code)
        await self._register_component(comp_name, f"dashboard/components/{comp_name}.tsx", "component")
        return {"success": written, "file": f"dashboard/components/{comp_name}.tsx"}

    async def _add_chart_component(self, command: str) -> dict[str, Any]:
        """Generate a chart component."""
        code = textwrap.dedent("""\
            // dashboard/components/LeadScoreChart.tsx
            import React from 'react';

            interface Props {
              leads: Array<{ lead_score?: number; score?: number; company_name?: string }>;
            }

            export function LeadScoreChart({ leads }: Props) {
              const buckets = [0, 0, 0, 0, 0]; // 0-19, 20-39, 40-59, 60-79, 80+
              leads.forEach(l => {
                const s = l.lead_score ?? l.score ?? 0;
                if (s < 20) buckets[0]++;
                else if (s < 40) buckets[1]++;
                else if (s < 60) buckets[2]++;
                else if (s < 80) buckets[3]++;
                else buckets[4]++;
              });
              const max = Math.max(...buckets) || 1;
              const labels = ['0-19', '20-39', '40-59', '60-79', '80+'];
              const colors = ['#555', '#888', '#FFD700', '#4CAF50', '#2196F3'];

              return (
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ color: '#FFD700', marginBottom: '0.75rem' }}>Score Distribution</h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '120px' }}>
                    {buckets.map((count, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <span style={{ color: '#aaa', fontSize: '0.7rem', marginBottom: '2px' }}>{count}</span>
                        <div style={{
                          width: '100%', background: colors[i],
                          height: `${(count / max) * 100}px`,
                          borderRadius: '3px 3px 0 0',
                          minHeight: count > 0 ? '4px' : '0',
                        }} />
                        <span style={{ color: '#888', fontSize: '0.7rem', marginTop: '4px' }}>{labels[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
        """)
        os.makedirs(COMPONENTS_DIR, exist_ok=True)
        path = os.path.join(COMPONENTS_DIR, "LeadScoreChart.tsx")
        written = self._write(path, code)
        await self._register_component("LeadScoreChart", "dashboard/components/LeadScoreChart.tsx", "chart")
        return {"success": written, "file": "dashboard/components/LeadScoreChart.tsx"}

    async def _generate_with_llm(self, command: str) -> dict[str, Any]:
        """Fall through to LLM for general frontend tasks."""
        code = await self._llm_generate(command, "tsx")
        return {"success": True, "code": code, "message": f"Generated: {command[:60]}"}

    async def _llm_generate(self, prompt: str, lang: str = "tsx") -> str:
        try:
            import asyncio
            from llm.ollama_client import complete

            system = (
                "You are an expert React/Next.js developer. "
                "Generate production-quality Tailwind CSS components. "
                "Use a dark theme with black background and electric gold (#FFD700) accents. "
                "Return ONLY the code block."
            )
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, lambda: complete(prompt, system=system, task="code"))
        except Exception as exc:
            logger.debug("LLM frontend generation unavailable: %s", exc)
            return f"// TODO: implement {prompt}\nexport default function Component() {{ return <div>TBD</div>; }}"

    async def _register_component(self, name: str, path: str, component_type: str) -> None:
        """Register a component in the dynamic component registry."""
        import json
        import time

        registry: list[dict[str, Any]] = []
        if os.path.exists(REGISTRY_FILE):
            try:
                with open(REGISTRY_FILE, "r", encoding="utf-8") as fh:
                    registry = json.load(fh)
            except Exception:
                registry = []

        # Upsert
        existing_ids = {c["name"] for c in registry}
        if name not in existing_ids:
            registry.append({
                "name": name,
                "path": path,
                "type": component_type,
                "created_at": time.time(),
            })
            try:
                os.makedirs(os.path.dirname(REGISTRY_FILE), exist_ok=True)
                with open(REGISTRY_FILE, "w", encoding="utf-8") as fh:
                    json.dump(registry, fh, indent=2)
            except Exception as exc:
                logger.debug("Registry write failed: %s", exc)

    @staticmethod
    def _write(path: str, content: str) -> bool:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(content)
            logger.info("FrontendAgent wrote: %s", path)
            return True
        except OSError as exc:
            logger.error("FrontendAgent write error: %s", exc)
            return False
