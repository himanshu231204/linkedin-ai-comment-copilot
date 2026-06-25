"""
Test script to verify all LLM models and Router fallback are working correctly.
Run from the project root:
    python -m backend.test_models
"""

import asyncio
import os
import sys
from pathlib import Path

# Disable litellm background network calls before any imports
os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
os.environ["DO_NOT_TRACK"] = "1"

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from langchain_core.messages import HumanMessage, SystemMessage
from backend.models.llm import (
    create_llm,
    create_llm_with_router,
    get_analyzer_llm_config,
    get_planner_llm_config,
    get_writer_llm_config,
    get_reviewer_llm_config,
    get_fallback_llm_config,
)


DIVIDER = "=" * 60
TIMEOUT_SECONDS = 30


async def test_direct_llm(name: str, config_fn) -> bool:
    """Test a single model via direct ChatLiteLLM."""
    print(f"\n{DIVIDER}")
    print(f"  [Direct] {name}")
    print(DIVIDER)

    try:
        config = config_fn()
        print(f"  Model:   {config.model_name}")
        print(f"  Temp:    {config.temperature}")
        print(f"  Max Tok: {config.max_tokens}")

        llm = create_llm(config)

        messages = [
            SystemMessage(content="You are a helpful assistant. Reply in one short sentence."),
            HumanMessage(content="What is the capital of France?"),
        ]

        print("  Sending request...")
        response = await asyncio.wait_for(llm.ainvoke(messages), timeout=TIMEOUT_SECONDS)

        print(f"  Response: {response.content[:80]}...")
        print(f"  Status:   PASS")
        return True

    except asyncio.TimeoutError:
        print(f"  Status:   FAIL (timeout after {TIMEOUT_SECONDS}s)")
        return False
    except Exception as e:
        print(f"  Status:   FAIL")
        print(f"  Error:    {type(e).__name__}: {e}")
        return False


async def test_router_llm(name: str, primary_model: str, fallback_model: str) -> bool:
    """Test a model via ChatLiteLLMRouter with fallback."""
    print(f"\n{DIVIDER}")
    print(f"  [Router] {name}")
    print(DIVIDER)

    groq_key = os.getenv("GROQ_API_KEY")
    google_key = os.getenv("GOOGLE_API_KEY")

    if not groq_key:
        print("  Status:   SKIP (GROQ_API_KEY not set)")
        return True

    try:
        print(f"  Primary:  {primary_model}")
        print(f"  Fallback: {fallback_model}")

        llm = create_llm_with_router(
            primary_model=primary_model,
            primary_api_key=groq_key,
            fallback_model=fallback_model,
            fallback_api_key=google_key,
            temperature=0.3,
            max_tokens=50,
        )

        messages = [
            SystemMessage(content="Reply in one short sentence."),
            HumanMessage(content="Say hello."),
        ]

        print("  Sending request...")
        response = await asyncio.wait_for(llm.ainvoke(messages), timeout=TIMEOUT_SECONDS)

        print(f"  Response: {response.content[:80]}...")
        print(f"  Status:   PASS")
        return True

    except asyncio.TimeoutError:
        print(f"  Status:   FAIL (timeout after {TIMEOUT_SECONDS}s)")
        return False
    except Exception as e:
        print(f"  Status:   FAIL")
        print(f"  Error:    {type(e).__name__}: {e}")
        return False


async def test_router_fallback() -> bool:
    """Test that Router falls back when primary model fails."""
    print(f"\n{DIVIDER}")
    print(f"  [Router Fallback] Simulating primary failure")
    print(DIVIDER)

    groq_key = os.getenv("GROQ_API_KEY")
    google_key = os.getenv("GOOGLE_API_KEY")

    if not groq_key or not google_key:
        print("  Status:   SKIP (need both GROQ_API_KEY and GOOGLE_API_KEY)")
        return True

    try:
        # Use an invalid model name to force failure
        llm = create_llm_with_router(
            primary_model="groq/invalid-model-that-does-not-exist",
            primary_api_key=groq_key,
            fallback_model="gemini/gemini-2.5-flash",
            fallback_api_key=google_key,
            temperature=0.3,
            max_tokens=50,
        )

        messages = [
            SystemMessage(content="Reply with just 'OK'."),
            HumanMessage(content="Test"),
        ]

        print("  Sending request (primary will fail, fallback should work)...")
        response = await asyncio.wait_for(llm.ainvoke(messages), timeout=TIMEOUT_SECONDS)

        print(f"  Response: {response.content[:80]}...")
        print(f"  Status:   PASS (fallback worked)")
        return True

    except asyncio.TimeoutError:
        print(f"  Status:   FAIL (timeout after {TIMEOUT_SECONDS}s)")
        return False
    except Exception as e:
        print(f"  Status:   FAIL (fallback also failed)")
        print(f"  Error:    {type(e).__name__}: {e}")
        return False


async def test_agent(name: str, agent_fn, *args) -> bool:
    """Test a complete agent (analyzer, planner, writer, reviewer)."""
    print(f"\n{DIVIDER}")
    print(f"  [Agent] {name}")
    print(DIVIDER)

    try:
        print("  Sending request...")
        result = await asyncio.wait_for(agent_fn(*args), timeout=TIMEOUT_SECONDS)

        print(f"  Result:   {result}")
        print(f"  Status:   PASS")
        return True

    except asyncio.TimeoutError:
        print(f"  Status:   FAIL (timeout after {TIMEOUT_SECONDS}s)")
        return False
    except Exception as e:
        print(f"  Status:   FAIL")
        print(f"  Error:    {type(e).__name__}: {e}")
        return False


async def main():
    """Run all tests."""
    print("\n" + DIVIDER)
    print("  LinkedIn AI Comment Copilot - Full Model Test")
    print(DIVIDER)

    results = {}

    # ─── 1. Direct LLM Tests ─────────────────────────────────────────────
    print("\n\n### 1. Direct LLM Tests (ChatLiteLLM) ###")

    direct_models = [
        ("Analyzer  (Groq Llama 3.3 70B)", get_analyzer_llm_config),
        ("Planner   (Groq Llama 3.3 70B)", get_planner_llm_config),
        ("Writer    (Groq Llama 3.3 70B)", get_writer_llm_config),
        ("Reviewer  (Groq Llama 3.3 70B)", get_reviewer_llm_config),
        ("Fallback  (Gemini 2.5 Flash)", get_fallback_llm_config),
    ]

    for name, config_fn in direct_models:
        results[f"Direct: {name}"] = await test_direct_llm(name, config_fn)

    # ─── 2. Router Tests ─────────────────────────────────────────────────
    print("\n\n### 2. Router Tests (ChatLiteLLMRouter) ###")

    router_models = [
        ("Groq to Gemini", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.5-flash"),
    ]

    for name, primary, fallback in router_models:
        results[f"Router: {name}"] = await test_router_llm(name, primary, fallback)

    # ─── 3. Fallback Test ────────────────────────────────────────────────
    print("\n\n### 3. Fallback Behavior Test ###")
    results["Router Fallback"] = await test_router_fallback()

    # ─── 4. Agent Integration Tests ──────────────────────────────────────
    print("\n\n### 4. Agent Integration Tests ###")

    from backend.agents.analyzer import analyze_post
    from backend.agents.planner import plan_strategy
    from backend.agents.writer import write_comment
    from backend.agents.reviewer import review_comment

    sample_post = (
        "Excited to share that I've just started my new role as Software Engineer "
        "at Google! Grateful for this opportunity."
    )

    results["Agent: Analyzer"] = await test_agent(
        "Analyzer", analyze_post, sample_post
    )
    results["Agent: Planner"] = await test_agent(
        "Planner", plan_strategy, "job_update", "career", "professional"
    )
    results["Agent: Writer"] = await test_agent(
        "Writer", write_comment, sample_post, "professional", "congratulate on new role"
    )
    results["Agent: Reviewer"] = await test_agent(
        "Reviewer", review_comment, sample_post, "Congratulations on the new role!", "professional"
    )

    # ─── Summary ─────────────────────────────────────────────────────────
    print(f"\n\n{DIVIDER}")
    print("  Summary")
    print(DIVIDER)

    passed = 0
    failed = 0
    for name, success in results.items():
        status = "PASS" if success else "FAIL"
        icon = "+" if success else "X"
        print(f"  [{icon}] {name}: {status}")
        if success:
            passed += 1
        else:
            failed += 1

    print(f"\n  Total: {passed} passed, {failed} failed")
    print(DIVIDER + "\n")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
