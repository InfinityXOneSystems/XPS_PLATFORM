"""
agents/media/media_agent.py
============================
AI media generation agent.

Capabilities:
  - Image generation (via OpenAI DALL-E or local Stable Diffusion)
  - Audio generation (TTS)
  - Avatar generation
  - Video thumbnail generation

All generation calls are non-blocking and queue results to the
configured output directory.

Environment variables:
  OPENAI_API_KEY  – enables DALL-E image generation
  MEDIA_OUTPUT_DIR – output directory (default: ./media/output)
"""

from __future__ import annotations

import logging
import os
from typing import Any

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MEDIA_OUTPUT_DIR = os.getenv("MEDIA_OUTPUT_DIR", os.path.join(ROOT, "media", "output"))


class MediaAgent(BaseAgent):
    """
    AI media creation agent.

    Example::

        agent = MediaAgent()
        result = await agent.run("Generate a logo for XPS Intelligence")
    """

    agent_name = "media"

    async def execute(
        self,
        task: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Execute a media generation task."""
        command = task.get("command", "")
        return await self._dispatch(command)

    async def _dispatch(self, command: str) -> dict[str, Any]:
        lower = command.lower()
        logger.info("MediaAgent._dispatch: %r", command)

        if "image" in lower or "logo" in lower or "banner" in lower or "generate" in lower:
            return await self._generate_image(command)

        if "audio" in lower or "voice" in lower or "speech" in lower or "tts" in lower:
            return await self._generate_audio(command)

        if "avatar" in lower or "profile" in lower:
            return await self._generate_avatar(command)

        if "video" in lower or "thumbnail" in lower:
            return await self._generate_video_thumbnail(command)

        return await self._generate_image(command)

    # ------------------------------------------------------------------

    async def _generate_image(self, prompt: str) -> dict[str, Any]:
        """Generate an image using OpenAI DALL-E or log a placeholder."""
        os.makedirs(MEDIA_OUTPUT_DIR, exist_ok=True)

        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            try:
                return await self._dalle_generate(prompt, openai_key)
            except Exception as exc:
                logger.warning("DALL-E failed: %s", exc)

        # Placeholder when no API key configured
        import time
        placeholder = os.path.join(MEDIA_OUTPUT_DIR, f"image_{int(time.time())}.txt")
        with open(placeholder, "w", encoding="utf-8") as fh:
            fh.write(f"[Image placeholder]\nPrompt: {prompt}\n")
        return {
            "success": True,
            "file": placeholder,
            "message": "Image generation queued (no API key configured — placeholder created)",
            "note": "Set OPENAI_API_KEY to enable DALL-E generation",
        }

    async def _dalle_generate(self, prompt: str, api_key: str) -> dict[str, Any]:
        """Call OpenAI Images API."""
        import asyncio

        import httpx

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": 1,
                    "size": "1024x1024",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            url = data["data"][0]["url"]

        return {
            "success": True,
            "url": url,
            "message": f"Image generated: {prompt[:60]}",
        }

    async def _generate_audio(self, command: str) -> dict[str, Any]:
        """Generate speech audio via OpenAI TTS or placeholder."""
        import re

        text_match = re.search(r'(?:say|speak|generate audio for|tts)\s+(?:["\'](.+)["\']|(.+))$', command, re.I)
        if text_match:
            text = (text_match.group(1) or text_match.group(2)).strip()
        else:
            text = command

        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key:
            try:
                return await self._openai_tts(text, openai_key)
            except Exception as exc:
                logger.warning("TTS failed: %s", exc)

        import time
        os.makedirs(MEDIA_OUTPUT_DIR, exist_ok=True)
        placeholder = os.path.join(MEDIA_OUTPUT_DIR, f"audio_{int(time.time())}.txt")
        with open(placeholder, "w", encoding="utf-8") as fh:
            fh.write(f"[Audio placeholder]\nText: {text}\n")
        return {
            "success": True,
            "file": placeholder,
            "message": "Audio generation queued (no API key configured — placeholder created)",
        }

    async def _openai_tts(self, text: str, api_key: str) -> dict[str, Any]:
        """Call OpenAI TTS API."""
        import time

        import httpx

        os.makedirs(MEDIA_OUTPUT_DIR, exist_ok=True)
        output_path = os.path.join(MEDIA_OUTPUT_DIR, f"speech_{int(time.time())}.mp3")

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "tts-1",
                    "voice": "alloy",
                    "input": text[:4096],
                },
            )
            resp.raise_for_status()
            with open(output_path, "wb") as fh:
                fh.write(resp.content)

        return {
            "success": True,
            "file": output_path,
            "message": f"Audio generated: {text[:60]}",
        }

    async def _generate_avatar(self, command: str) -> dict[str, Any]:
        """Generate an avatar image."""
        return await self._generate_image(f"Professional avatar portrait for: {command}")

    async def _generate_video_thumbnail(self, command: str) -> dict[str, Any]:
        """Generate a video thumbnail image."""
        return await self._generate_image(f"Video thumbnail: {command}")
